-- Payment groundwork: each lesson gets a short unique code so a bank
-- transfer can be matched back to the lesson it pays for. `paid_at` is null
-- until payment is confirmed; the join/call flow will later gate on it.
-- Apply via Supabase SQL editor or `supabase db push`.
-- Must run after lessons.sql.

alter table public.lessons
  add column if not exists payment_code text,
  add column if not exists paid_at      timestamptz;

update public.lessons
  set payment_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  where payment_code is null;

alter table public.lessons
  alter column payment_code set not null,
  alter column payment_code set default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

create unique index if not exists lessons_payment_code_key on public.lessons (payment_code);
