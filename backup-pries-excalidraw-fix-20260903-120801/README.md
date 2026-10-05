# Koris

A Lithuanian peer-tutoring platform where students find a tutor, book a lesson, and meet inside a live room with video and a shared whiteboard. Built with Next.js 16, React 19, Tailwind v4, and Supabase.

The UI is fully bilingual (English / Lithuanian) and the role layer (`teacher` ↔ `student`) drives what each user can see and do.

---

## Features

### Auth & profiles
- Email + password sign-up and sign-in (Supabase Auth)
- Google OAuth
- Role-aware profile pages — teachers fill out subjects, hourly rate, bio, weekly availability; students fill out grade, struggles, expectations
- Photo upload to Supabase Storage

### Discover & book
- Browse all tutors with subject and max-price filters
- Tutor detail modal showing subjects, topics, bio, weekly availability grid, and price
- Request a lesson against a tutor's open slots — date, time, subject, optional notes

### Manage lessons
- Tabs for **All / Pending / Accepted / Rejected**
- Teachers accept, reject, or cancel; students track outgoing requests
- Per-lesson detail modal with countdown to start time and a join button that activates 15 min before until 60 min after the scheduled start

### Messaging
- Direct chat between participants of a shared lesson (RLS-enforced)
- Unread badges, list ordered by most recent message, deep-link via `/messages?with=<userId>`
- Lightweight 5 s polling — no realtime channel needed

### Live lesson room (`/lessons/[id]/call`)
- 1-to-1 WebRTC video, signaled through a Supabase Realtime channel — deterministic offerer/answerer roles based on `userId` ordering
- Cameras displayed in a 4:3 side panel; the rest of the screen hosts a collaborative **Excalidraw** whiteboard synced through Supabase broadcast
- Sidebar auto-slides off the left edge when you enter the room and exposes a hamburger toggle so you can pop it back in

### i18n
- Every user-facing string flows through `LanguageProvider`'s `t(key)` helper
- Persisted to `localStorage`; toggle in the topbar

---

## Tech stack

| Layer       | Choice                                                    |
| ----------- | --------------------------------------------------------- |
| Framework   | Next.js 16 (App Router) with the React Compiler enabled   |
| UI          | React 19, Tailwind CSS v4                                 |
| API         | Route handlers under `app/api` — the only path to the DB  |
| Validation  | Zod schemas at every request boundary                     |
| Backend     | Supabase — Postgres, Auth, Realtime, Storage, RLS         |
| Auth        | `@supabase/ssr` — cookie sessions the server can read     |
| Whiteboard  | `@excalidraw/excalidraw` (dynamic import, `ssr: false`)   |
| Video       | Native `RTCPeerConnection` + Supabase Realtime signaling  |
| Tooling     | Biome (lint + format)                                     |

---

## Getting started

### 1. Install

```bash
npm install
```

### 2. Configure Supabase

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>

# Optional, server-only. Never prefix with NEXT_PUBLIC_.
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

The first two are public by design — they ship in the browser bundle, and
everything they can do is bounded by RLS.

`SUPABASE_SERVICE_ROLE_KEY` **bypasses RLS entirely**, so it lives only on the
server. Find it in Dashboard → Settings → API Keys → `service_role` (Reveal).
It is optional: route handlers run as the signed-in user, and the privileged
reads (a tutor's payout IBAN, a lesson partner's contact details) go through
`SECURITY DEFINER` functions that authorise themselves in SQL. Setting it lets
the server repair a missing profile row on first sign-in.

### 3. Apply the schema

The SQL for `profiles`, `lessons`, `messages`, plus the RLS policies live in [`db/migrations/`](./db/migrations). Run them **in this order** against your Supabase project (e.g. via the SQL editor or `supabase db push`), since later files reference tables/columns the earlier ones create:

1. `profiles.sql`
2. `profiles_phone.sql`
3. `profiles_student_info.sql`
4. `profiles_bank_iban.sql`
5. `lessons.sql`
6. `lessons_payment.sql`
7. `lessons_created_by.sql`
8. `messages.sql`
9. `storage_avatars.sql`
10. `security_hardening.sql`
11. `realtime_lesson_rooms.sql` — part 2 (policies) cannot be applied; see "Known gap" below

> **Take a backup before step 10.** `security_hardening.sql` revokes column
> privileges and replaces policies — the app assumes it has run. `npm run
> backup:db` snapshots the data first.
>
> Step 11 applies only in part: its helper functions install, but the policies
> it contains need an owner role Supabase does not hand out. See
> **Known gap** below.

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Sign up

Register two accounts — one teacher, one student. Fill out the teacher's profile (subjects + availability + hourly rate), then book a lesson from the student account to try the full flow including the live room.

---

## Project layout

The browser never talks to the database. Every read and write goes
**browser → `/api` → Supabase**, and the server decides what comes back:

```
   browser (client components)
        │  fetch, via src/lib/api/*
        ▼
   app/api/**/route.js          thin: parse, validate, delegate
        │
        ▼
   src/server/services/*        all business rules and authorisation
        │  request-scoped client, acting as the signed-in user
        ▼
   Supabase Postgres + RLS      second line of defence, not the only one
```

```
app/
  (app)/                  protected routes — wrapped by ProtectedLayout + AppShell
    dashboard/            week calendar + pending requests
    lessons/              list, create, [id]/call (the lesson room)
    messages/             1-to-1 chat
    profile/              role-aware profile editor
    tutors/               browse + filter tutors
  api/                    route handlers — the only path to the database
    auth/                 register, session
    lessons/              list, create, [id] actions, access, counterpart, meet
    messages/             conversations, [partnerId] thread
    profile/              me, [id], avatar
    teachers/, students/  discovery lists
  auth/callback/          OAuth PKCE code exchange (writes session cookies)
  login/, register/       public routes

src/
  components/             AppShell, Sidebar, Topbar, AuthProvider, LanguageProvider, …
  features/               one client component per screen (unchanged in shape)
  lib/
    api/                  the browser's only backend interface
    supabase/             browser / server / admin clients
    env.js                public vs server-only environment access
  server/
    handler.js            withRoute — uniform error handling
    session.js            requireUser / requireProfile / requireRole
    validate.js           Zod helpers, shared field schemas
    errors.js             typed ApiError + Supabase error mapping
    response.js           { ok, data } / { ok, error } envelope
    services/             profiles, lessons, messages, calendar, storage

db/migrations/            SQL for tables, RLS, grants, and policy updates
```

---

## How a few pieces work

### `LanguageProvider`
Wraps the tree, persists `lang` to `localStorage`, and exposes `{ lang, setLang, t }`. The `t(key)` helper falls back to English if a key is missing in the active language, then to the raw key — so an unmapped string is loud rather than silent.

### `AppShell`
Client wrapper around `<Sidebar />` plus `{children}`. It watches `usePathname()` and auto-collapses the sidebar on `/lessons/[id]/call` routes. A floating hamburger toggle (top-left) and a close button inside the sidebar let the user override the auto behavior.

### `VideoCall`
Subscribes both peers to `lesson-call:<lessonId>` and uses presence to discover the other party. The peer with the lexicographically smaller `userId` creates the SDP offer; the other answers. SDP and ICE candidates are sent as `signal` broadcasts addressed by `to`. Public Google STUN only — add a TURN server for symmetric-NAT reliability.

### `CollabWhiteboard`
Excalidraw with broadcast-based sync over the same channel pattern. Loaded with `dynamic(() => …, { ssr: false })` because Excalidraw touches `window` at import time.

### The API layer
`withRoute` wraps every handler so failures produce one shape: `ApiError` and
Zod errors become their proper status, and anything unexpected is logged
server-side and returned as a bare 500 — Postgres error text never reaches the
client. Handlers stay thin (parse → validate → delegate); the rules live in
`src/server/services`.

`requireUser()` calls `supabase.auth.getUser()`, which revalidates the JWT
against Supabase Auth. `getSession()` would only trust the cookie, which is
fine in the browser but is not an authentication check on the server.

### Two layers of defence
The anon key ships in the browser bundle, so anyone can call PostgREST
directly. The API decides *what the app returns*; RLS and column grants decide
*what the database will hand out at all* — and they are written to hold on
their own:

- **Column grants on `profiles`.** RLS is row-level only, so `email`, `phone`,
  `bank_iban`, `grade`, `learning_struggles` and `expectations` are simply not
  selectable by the `authenticated` role. Your own row comes back through
  `get_my_profile()`, a lesson partner's through
  `lesson_counterpart_profile()`; both are `SECURITY DEFINER` and authorise
  themselves in SQL. IBAN travels one way — a student sees the tutor they owe,
  never the reverse.
- **`role` is not updatable.** It is set once at sign-up and excluded from the
  update grant, so a student cannot promote themselves to teacher.
- **Every lesson starts `pending`**, whoever creates it, and `created_by` says
  who proposed it — the *other* party accepts. Neither side can manufacture an
  accepted lesson against someone who never agreed.
- **Messaging requires an accepted shared lesson**, and only `read_at` is
  updatable, so a receiver cannot rewrite the body of a message sent to them.
### Known gap: the lesson-room channels are still public
`realtime_lesson_rooms.sql` installs the helper functions but **not** the RLS
policies that would make `lesson-call:<id>` and `lesson-board:<id>` private.
`realtime.messages` is owned by `supabase_realtime_admin`, `CREATE POLICY`
requires owning it, and Supabase reserves that role for superusers:

```
ERROR: 42501: "supabase_realtime_admin" role memberships are reserved,
              only superusers can grant them
```

So `src/features/call/*` opens public channels. Anyone holding the anon key
(which ships in the bundle) and a lesson id can subscribe to the signalling and
the whiteboard. Lesson ids are UUIDs seen only by participants, so this is
obscurity rather than access control.

**Do not set `private: true` before those policies exist.** RLS is already
enabled on `realtime.messages` with zero policies, so a private channel would
be denied to everyone and the lesson room would stop working. To close this,
ask Supabase support to install the policies, or move signalling to your own
WebSocket server.

---

## Scripts

```bash
npm run dev       # next dev
npm run build     # next build
npm run start     # next start
npm run lint      # biome check
npm run format    # biome format --write
```

---

## Notes for contributors

- The Next.js install in this repo is a custom build with breaking changes from the public version. Read the relevant guide in `node_modules/next/dist/docs/` before touching framework-level code.
- Don't add new hard-coded strings to UI components — extend the dictionary in `src/components/LanguageProvider.jsx` and use `t('your.key')`.
- Profile rows are linked to `auth.users.id` by foreign key, so a profile only exists once a user has registered.
