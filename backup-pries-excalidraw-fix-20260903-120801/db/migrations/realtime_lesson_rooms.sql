-- Lock down the lesson-room realtime channels.
--
-- The room uses two Supabase Realtime channels per lesson:
--   lesson-call:<lessonId>   WebRTC signalling (SDP + ICE) and presence
--   lesson-board:<lessonId>  Excalidraw scene sync
--
-- Public broadcast channels are readable and writable by anyone holding the
-- anon key, which ships in the browser bundle. The participant check in
-- CallRoomPage is client-side and does not stop a third party subscribing.
--
-- Making the channels private routes every subscribe and broadcast through
-- these policies. The client must pass `config: { private: true }`, which
-- src/features/call/* now does.
--
-- ===========================================================================
-- STATUS: PART 1 APPLIED, PART 2 BLOCKED
-- ===========================================================================
-- Part 1 (the helper functions) ran successfully on 2026-09-02.
--
-- Part 2 (the policies) cannot be applied from the SQL editor on this
-- project. `realtime.messages` is owned by `supabase_realtime_admin`, and
-- CREATE POLICY requires ownership. Granting that role fails with:
--
--   ERROR: 42501: "supabase_realtime_admin" role memberships are reserved,
--                 only superusers can grant them
--
-- Because of that, `src/features/call/*` still opens PUBLIC channels: the
-- `private: true` flag is commented out there. Do not turn it on until these
-- policies exist — RLS is already enabled on `realtime.messages` with zero
-- policies, so a private channel would be denied to everyone and the lesson
-- room would stop working entirely.
--
-- To finish this, one of:
--   * ask Supabase support to run part 2, or to grant the membership
--   * use a plan or environment where the owner role is available
--   * move signalling off Supabase Realtime (own WebSocket server)
--
-- Until then the lesson-room channels remain reachable by anyone who holds
-- the anon key and a lesson id. Lesson ids are UUIDs and only participants
-- ever see them, so this is obscurity, not access control.
--
-- Apply via Supabase SQL editor or `supabase db push`.
-- Must run after lessons.sql.

-- ---------------------------------------------------------------------------
-- 1. Helper functions (public schema — owned by `postgres`)
-- ---------------------------------------------------------------------------

begin;

-- Topic looks like `lesson-call:<uuid>` or `lesson-board:<uuid>`.
-- Returns null for any other shape, which fails both policies below.
create or replace function public.lesson_id_from_topic(p_topic text)
returns uuid
language plpgsql
immutable
as $$
declare
  v_id text;
begin
  if p_topic !~ '^lesson-(call|board):[0-9a-fA-F-]{36}$' then
    return null;
  end if;
  v_id := split_part(p_topic, ':', 2);
  return v_id::uuid;
exception
  when others then
    return null;
end;
$$;

grant execute on function public.lesson_id_from_topic(text) to authenticated;

create or replace function public.can_join_lesson_room(p_topic text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.lessons l
    where l.id = public.lesson_id_from_topic(p_topic)
      and l.status = 'accepted'
      and (l.student_id = auth.uid() or l.teacher_id = auth.uid())
  );
$$;

revoke all on function public.can_join_lesson_room(text) from public, anon;
grant execute on function public.can_join_lesson_room(text) to authenticated;

commit;

-- ---------------------------------------------------------------------------
-- 2. Policies on realtime.messages
-- ---------------------------------------------------------------------------
-- RLS is already enabled on this table by the platform, so there is no
-- `alter table ... enable row level security` here — that statement fails
-- with "must be owner of table messages" and is unnecessary.
--
-- The table is owned by `supabase_realtime_admin`, and CREATE POLICY requires
-- ownership. `postgres` is not a member of that role by default, so take the
-- membership just long enough to write the policies, then hand it back.

grant supabase_realtime_admin to postgres;
set role supabase_realtime_admin;

-- Subscribing to a room.
drop policy if exists "lesson_room_read" on realtime.messages;
create policy "lesson_room_read"
  on realtime.messages for select
  to authenticated
  using (public.can_join_lesson_room(realtime.topic()));

-- Broadcasting into a room (signalling, presence, whiteboard scenes).
drop policy if exists "lesson_room_write" on realtime.messages;
create policy "lesson_room_write"
  on realtime.messages for insert
  to authenticated
  with check (public.can_join_lesson_room(realtime.topic()));

reset role;
revoke supabase_realtime_admin from postgres;
