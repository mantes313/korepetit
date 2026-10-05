-- Security hardening pass.
--
-- Context: the app now routes every read and write through /api, but the
-- anon key still ships in the browser bundle, so anyone can call PostgREST
-- directly. These policies are what actually stops them; the API layer adds
-- shaping and business rules on top.
--
-- Apply via Supabase SQL editor or `supabase db push`.
-- Must run after every other migration in this folder.
--
-- Take a database backup before running this: it revokes column privileges
-- and replaces existing policies.

begin;

-- ---------------------------------------------------------------------------
-- 1. profiles: hide sensitive columns from other users
-- ---------------------------------------------------------------------------
-- Previously `profiles_select_authenticated` was `using (true)` over every
-- column, so any signed-up account could read every user's email, phone,
-- payout IBAN, school grade and free-text learning struggles.
--
-- RLS is row-level only, so column protection uses GRANTs. The `authenticated`
-- role keeps SELECT on the discovery columns and loses it on the rest; the
-- owner reads their own full row through `get_my_profile()` below.

revoke all on public.profiles from anon, authenticated;

grant select (
  id, role, name, photo_url, headline,
  price_60, price_intro, subjects, tags, bio, availability,
  created_at
) on public.profiles to authenticated;

-- `role` is deliberately NOT grantable: self-promotion student -> teacher was
-- the first link in the privilege-escalation chain.
grant update (
  name, phone, photo_url, headline,
  price_60, price_intro, subjects, tags, bio, availability,
  bank_iban, grade, learning_struggles, expectations,
  updated_at
) on public.profiles to authenticated;

grant insert (id, role, name, email) on public.profiles to authenticated;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Your own row, every column. SECURITY DEFINER because the grants above
-- deliberately hide those columns from the `authenticated` role.
create or replace function public.get_my_profile()
returns table (
  id uuid, role text, name text, email text, phone text, photo_url text,
  headline text, price_60 numeric, price_intro boolean, subjects jsonb,
  tags jsonb, bio text, availability jsonb, bank_iban text, grade text,
  learning_struggles text, expectations text,
  created_at timestamptz, updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.role, p.name, p.email, p.phone, p.photo_url,
         p.headline, p.price_60, p.price_intro, p.subjects,
         p.tags, p.bio, p.availability, p.bank_iban, p.grade,
         p.learning_struggles, p.expectations,
         p.created_at, p.updated_at
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke all on function public.get_my_profile() from public, anon;
grant execute on function public.get_my_profile() to authenticated;

-- Contact details for the other party on a lesson you are actually on.
-- IBAN travels one way only: a student may see the teacher they owe, never
-- the reverse.
create or replace function public.lesson_counterpart_profile(p_lesson_id uuid)
returns table (
  id uuid, name text, email text, phone text, photo_url text,
  headline text, price_60 numeric, bank_iban text, grade text,
  learning_struggles text, expectations text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lesson public.lessons%rowtype;
  v_is_student boolean;
begin
  select * into v_lesson from public.lessons l where l.id = p_lesson_id;
  if not found then
    raise exception 'Lesson not found' using errcode = 'PGRST116';
  end if;

  if auth.uid() <> v_lesson.student_id and auth.uid() <> v_lesson.teacher_id then
    raise exception 'Not a participant' using errcode = '42501';
  end if;

  v_is_student := auth.uid() = v_lesson.student_id;

  return query
  select p.id, p.name, p.email, p.phone, p.photo_url,
         p.headline, p.price_60,
         case
           when v_is_student and v_lesson.status = 'accepted' then p.bank_iban
           else null
         end as bank_iban,
         case when v_is_student then null else p.grade end,
         case when v_is_student then null else p.learning_struggles end,
         case when v_is_student then null else p.expectations end
  from public.profiles p
  where p.id = case when v_is_student then v_lesson.teacher_id
                    else v_lesson.student_id end;
end;
$$;

revoke all on function public.lesson_counterpart_profile(uuid) from public, anon;
grant execute on function public.lesson_counterpart_profile(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. lessons: no unilateral "accepted", no column free-for-all
-- ---------------------------------------------------------------------------
-- `lessons_insert_teacher` let a teacher mint an `accepted` lesson against
-- any student id. Combined with self-promotion and the messaging policy, that
-- was unsolicited DM access to any user on the platform. Every lesson now
-- starts pending, whoever creates it.
--
-- The hardcoded admin-email bypass is also gone: anyone who registered that
-- address would have inherited it.

revoke all on public.lessons from anon, authenticated;

grant select on public.lessons to authenticated;
grant insert (student_id, teacher_id, date, time, subject, notes, status, created_by)
  on public.lessons to authenticated;
-- Participants may move status and payment state; they may not reassign the
-- lesson to a different student or rewrite its payment code.
grant update (status, meet_link, paid_at, updated_at)
  on public.lessons to authenticated;

drop policy if exists "lessons_select_participants" on public.lessons;
create policy "lessons_select_participants"
  on public.lessons for select
  to authenticated
  using (auth.uid() = student_id or auth.uid() = teacher_id);

drop policy if exists "lessons_insert_student" on public.lessons;
create policy "lessons_insert_student"
  on public.lessons for insert
  to authenticated
  with check (
    auth.uid() = student_id
    and auth.uid() = created_by
    and status = 'pending'
    and student_id <> teacher_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'student'
    )
  );

drop policy if exists "lessons_insert_teacher" on public.lessons;
create policy "lessons_insert_teacher"
  on public.lessons for insert
  to authenticated
  with check (
    auth.uid() = teacher_id
    and auth.uid() = created_by
    and status = 'pending'
    and student_id <> teacher_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'teacher'
    )
  );

-- Either participant may accept, reject, or cancel.
drop policy if exists "lessons_update_teacher" on public.lessons;
drop policy if exists "lessons_update_participants" on public.lessons;
create policy "lessons_update_participants"
  on public.lessons for update
  to authenticated
  using (auth.uid() = student_id or auth.uid() = teacher_id)
  with check (
    (auth.uid() = student_id or auth.uid() = teacher_id)
    and status in ('pending', 'accepted', 'rejected')
    -- You cannot accept your own proposal; the other party has to.
    and (status <> 'accepted' or auth.uid() <> created_by)
  );

-- ---------------------------------------------------------------------------
-- 3. messages: accepted lessons only, and read_at is the only mutable column
-- ---------------------------------------------------------------------------
-- The old insert policy accepted any shared lesson row, including a pending
-- one either side could create alone. The old update policy let a receiver
-- rewrite `body` on messages sent to them.

revoke all on public.messages from anon, authenticated;

grant select on public.messages to authenticated;
grant insert (sender_id, receiver_id, body) on public.messages to authenticated;
grant update (read_at) on public.messages to authenticated;

drop policy if exists "messages_select_participants" on public.messages;
create policy "messages_select_participants"
  on public.messages for select
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "messages_insert_lesson_partners" on public.messages;
create policy "messages_insert_lesson_partners"
  on public.messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and sender_id <> receiver_id
    and exists (
      select 1 from public.lessons l
      where l.status = 'accepted'
        and (
          (l.student_id = sender_id and l.teacher_id = receiver_id)
          or (l.teacher_id = sender_id and l.student_id = receiver_id)
        )
    )
  );

drop policy if exists "messages_update_receiver_read" on public.messages;
create policy "messages_update_receiver_read"
  on public.messages for update
  to authenticated
  using (auth.uid() = receiver_id)
  with check (auth.uid() = receiver_id);

-- ---------------------------------------------------------------------------
-- 4. storage: close the folder-escape on UPDATE
-- ---------------------------------------------------------------------------
-- `avatars_owner_update` had a USING clause but no WITH CHECK, so a user
-- could rename their own object into somebody else's folder.

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_owner_delete" on storage.objects;
create policy "avatars_owner_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Server-side ceiling on top of the checks in src/server/services/storage.js.
update storage.buckets
   set file_size_limit = 2097152,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'avatars';

commit;
