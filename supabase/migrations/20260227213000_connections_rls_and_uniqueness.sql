-- Allow users to view profiles of users they are connected to.
drop policy if exists "Users can view their connections' profiles." on public.users;
create policy "Users can view their connections' profiles."
  on public.users
  for select
  using (
    exists (
      select 1
      from public.connections c
      where (
        c.user_1_id = auth.uid()
        and c.user_2_id = users.id
      )
      or (
        c.user_2_id = auth.uid()
        and c.user_1_id = users.id
      )
    )
  );

-- Allow participants of a connection row to create/update it.
drop policy if exists "Users can create connections." on public.connections;
create policy "Users can create connections."
  on public.connections
  for insert
  with check (auth.uid() = user_1_id or auth.uid() = user_2_id);

drop policy if exists "Users can update their connections." on public.connections;
create policy "Users can update their connections."
  on public.connections
  for update
  using (auth.uid() = user_1_id or auth.uid() = user_2_id)
  with check (auth.uid() = user_1_id or auth.uid() = user_2_id);

-- Clean duplicate pairs before adding uniqueness.
delete from public.connections c1
using public.connections c2
where c1.id > c2.id
  and c1.user_1_id = c2.user_1_id
  and c1.user_2_id = c2.user_2_id;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'connections_user_pair_unique'
      and conrelid = 'public.connections'::regclass
  ) then
    alter table public.connections
      add constraint connections_user_pair_unique unique (user_1_id, user_2_id);
  end if;
end $$;
