-- Direct messages between the two participants of a shared lesson.
-- Apply via Supabase SQL editor or `supabase db push`.
-- Must run after profiles.sql and lessons.sql (insert policy checks for a
-- shared lesson row).

create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  sender_id   uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);

create index if not exists messages_conversation_idx
  on public.messages (least(sender_id, receiver_id), greatest(sender_id, receiver_id), created_at);
create index if not exists messages_receiver_unread_idx
  on public.messages (receiver_id, read_at);

alter table public.messages enable row level security;

-- Read: only sender or receiver.
drop policy if exists "messages_select_participants" on public.messages;
create policy "messages_select_participants"
  on public.messages for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

-- Insert: only as yourself, and only to someone you share a lesson with.
drop policy if exists "messages_insert_lesson_partners" on public.messages;
create policy "messages_insert_lesson_partners"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.lessons l
      where (l.student_id = sender_id and l.teacher_id = receiver_id)
         or (l.teacher_id = sender_id and l.student_id = receiver_id)
    )
  );

-- Update: only the receiver, and only to mark a message read.
drop policy if exists "messages_update_receiver_read" on public.messages;
create policy "messages_update_receiver_read"
  on public.messages for update
  using (auth.uid() = receiver_id)
  with check (auth.uid() = receiver_id);
