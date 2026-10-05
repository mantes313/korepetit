-- Teacher payout IBAN, shown to students so they know where to send the
-- bank transfer for a booked lesson.
-- Apply via Supabase SQL editor or `supabase db push`.

alter table public.profiles
  add column if not exists bank_iban text;
