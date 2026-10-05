-- Student-facing fields on profiles. Teachers see these on incoming lesson
-- requests so they can prepare before accepting.
-- Apply via Supabase SQL editor or `supabase db push`.

alter table public.profiles
  add column if not exists grade              text,
  add column if not exists learning_struggles text,
  add column if not exists expectations       text;
