-- Who proposed the lesson.
--
-- Both sides can now create a lesson, and both create it as `pending`, so
-- "who still has to agree" is no longer implied by the role. Without this
-- column a student could accept their own request and skip the tutor's
-- approval entirely.
--
-- Rule: the party who did NOT create the lesson accepts it. Either party may
-- reject or cancel.
--
-- Apply via Supabase SQL editor or `supabase db push`.
-- Must run after lessons.sql and before security_hardening.sql.

begin;

alter table public.lessons
  add column if not exists created_by uuid references auth.users(id) on delete set null;

-- Backfill: before this migration only students could create a request, and
-- teacher-scheduled lessons were written directly as `accepted`.
update public.lessons
   set created_by = case
                      when status = 'accepted' then teacher_id
                      else student_id
                    end
 where created_by is null;

alter table public.lessons
  alter column created_by set not null;

create index if not exists lessons_created_by_idx on public.lessons (created_by);

commit;
