-- Phone number on profiles. Required at the application layer; nullable in
-- the DB so existing rows do not break.
-- Apply via Supabase SQL editor or `supabase db push`.

alter table public.profiles
  add column if not exists phone text;
