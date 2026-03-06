-- Must return 0 after running the backfill migration.
select count(*) as missing_public_user_rows
from auth.users au
left join public.users pu on pu.id = au.id
where pu.id is null;
