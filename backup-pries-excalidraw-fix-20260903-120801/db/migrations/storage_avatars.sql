-- Public bucket for profile photos, uploaded to `${uid}/avatar`.
-- Apply via Supabase SQL editor or `supabase db push`.
-- Must run after profiles.sql (no table dependency, but keeps setup order
-- consistent with the rest of the app's auth/profile flow).

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Read: public, since profile photos are shown via getPublicUrl().
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Write: only into your own uid-prefixed folder.
drop policy if exists "avatars_owner_insert" on storage.objects;
create policy "avatars_owner_insert"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
