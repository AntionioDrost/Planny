begin;

-- 1) Make auth -> public user sync idempotent and safe.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, display_name)
  values (
    new.id,
    coalesce(nullif(new.email, ''), new.id::text || '@no-email.local'),
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    display_name = coalesce(public.users.display_name, excluded.display_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();

-- 2) Backfill missing public.users rows for existing auth users.
insert into public.users (id, email, display_name, created_at)
select
  au.id,
  coalesce(nullif(au.email, ''), au.id::text || '@no-email.local') as email,
  coalesce(au.raw_user_meta_data->>'display_name', au.raw_user_meta_data->>'full_name') as display_name,
  coalesce(au.created_at, timezone('utc'::text, now())) as created_at
from auth.users au
left join public.users pu on pu.id = au.id
where pu.id is null;

-- 3) Ensure preferences exist for all users (skip when table is unavailable).
do $$
begin
  if to_regclass('public.user_preferences') is not null then
    insert into public.user_preferences (user_id)
    select u.id
    from public.users u
    left join public.user_preferences up on up.user_id = u.id
    where up.user_id is null;
  else
    raise notice 'Skipping user_preferences backfill because public.user_preferences does not exist.';
  end if;
end $$;

commit;
