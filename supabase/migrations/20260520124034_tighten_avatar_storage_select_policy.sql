grant select, insert, update, delete on storage.objects to authenticated;

drop policy if exists "Avatar images are publicly readable" on storage.objects;
drop policy if exists "Users can read their own avatar metadata" on storage.objects;
create policy "Users can read their own avatar metadata"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
