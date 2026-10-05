-- Lesson requests between students and teachers.
-- Apply via Supabase SQL editor or `supabase db push`.

create table if not exists public.lessons (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references auth.users(id) on delete cascade,
  teacher_id   uuid not null references auth.users(id) on delete cascade,
  date         date not null,
  time         time not null,
  subject      text,
  notes        text,
  status       text not null default 'pending'
                 check (status in ('pending', 'accepted', 'rejected')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Follow-up columns; idempotent for existing tables.
alter table public.lessons add column if not exists subject   text;
alter table public.lessons add column if not exists meet_link text;

create index if not exists lessons_student_idx on public.lessons (student_id, date);
create index if not exists lessons_teacher_idx on public.lessons (teacher_id, date);

alter table public.lessons enable row level security;

-- Read: only the student or teacher on the lesson.
drop policy if exists "lessons_select_participants" on public.lessons;
create policy "lessons_select_participants"
  on public.lessons for select
  using (auth.uid() = student_id or auth.uid() = teacher_id);

-- Insert: only the student themselves, only as pending.
-- Admin emails bypass the role check so they can test the request flow
-- regardless of their actual profile role. Keep this list in sync with
-- ADMIN_EMAILS in frontend/components/AuthProvider.jsx.
drop policy if exists "lessons_insert_student" on public.lessons;
create policy "lessons_insert_student"
  on public.lessons for insert
  with check (
    auth.uid() = student_id
    and status = 'pending'
    and (
      exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'student'
      )
      or auth.email() = any (array['autornas123@gmail.com'])
    )
  );

-- Insert: only the teacher themselves, only as accepted (they're scheduling
-- it directly, so it doesn't need the pending-approval flow). Admin emails
-- bypass the role check.
drop policy if exists "lessons_insert_teacher" on public.lessons;
create policy "lessons_insert_teacher"
  on public.lessons for insert
  with check (
    auth.uid() = teacher_id
    and status = 'accepted'
    and (
      exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'teacher'
      )
      or auth.email() = any (array['autornas123@gmail.com'])
    )
  );

-- Update: only the teacher on the lesson. Admin emails bypass the role check.
drop policy if exists "lessons_update_teacher" on public.lessons;
create policy "lessons_update_teacher"
  on public.lessons for update
  using (
    auth.uid() = teacher_id
    and (
      exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'teacher'
      )
      or auth.email() = any (array['autornas123@gmail.com'])
    )
  )
  with check (
    auth.uid() = teacher_id
    and status in ('pending', 'accepted', 'rejected')
  );
