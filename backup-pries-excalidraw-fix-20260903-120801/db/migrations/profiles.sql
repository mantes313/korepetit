-- Base profiles table, one row per auth user (teacher or student).
-- Apply via Supabase SQL editor or `supabase db push`.
-- Must run before lessons.sql, messages.sql, profiles_phone.sql,
-- profiles_student_info.sql.

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         text not null default 'student' check (role in ('teacher', 'student')),
  name         text,
  email        text,
  photo_url    text,
  headline     text,
  price_60     numeric,
  price_intro  boolean not null default false,
  subjects     jsonb not null default '[]'::jsonb,
  tags         jsonb not null default '[]'::jsonb,
  bio          text,
  availability jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);

alter table public.profiles enable row level security;

-- Read: any signed-in user (tutor browsing, lesson partners, messaging partners).
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- Insert/update: only your own row.
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Keep profiles.email in sync with auth.users so lesson/message partner
-- cards can show a mailto link without extra app-layer writes.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'student'),
    new.raw_user_meta_data->>'full_name'
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
