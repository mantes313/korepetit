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
| Backend     | Supabase — Postgres, Auth, Realtime, Storage, RLS         |
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
```

### 3. Apply the schema

The SQL for `profiles`, `lessons`, `messages`, plus the RLS policies live in [`db/migrations/`](./db/migrations). Run them **in this order** against your Supabase project (e.g. via the SQL editor or `supabase db push`), since later files reference tables/columns the earlier ones create:

1. `profiles.sql`
2. `profiles_phone.sql`
3. `profiles_student_info.sql`
4. `lessons.sql`
5. `messages.sql`
6. `storage_avatars.sql`

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Sign up

Register two accounts — one teacher, one student. Fill out the teacher's profile (subjects + availability + hourly rate), then book a lesson from the student account to try the full flow including the live room.

---

## Project layout

```
app/
  (app)/                  protected routes — wrapped by ProtectedLayout + AppShell
    dashboard/            week calendar + pending requests
    lessons/              list, create, [id]/call (the lesson room)
    messages/             1-to-1 chat
    profile/              role-aware profile editor
    tutors/               browse + filter tutors
  lib/                    Supabase client, lessons / messages / auth helpers
  login/, register/       public routes

src/
  components/             AppShell, Sidebar, Topbar, AuthProvider, LanguageProvider, …
  features/
    auth/                 LoginPage, RegisterPage
    call/                 CallRoomPage, VideoCall, CollabWhiteboard
    dashboard/            DashboardPage
    lessons/              LessonsPage, CreateLessonPage, LessonDetailModal
    messages/             MessagesPage
    profile/              ProfilePage
    tutors/               TutorsPage

db/migrations/            SQL for tables, RLS, and policy updates
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

### Row-level security
Lessons and messages are RLS-protected so a user can only read/write rows where they are a participant. The `messages` insert policy specifically requires that sender and receiver share at least one lesson.

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
