-- Must be 0 after catch-up + backfill.
select count(*) as missing_public_user_rows
from auth.users au
left join public.users pu on pu.id = au.id
where pu.id is null;

-- Must be non-null once polished beta tables are applied.
select to_regclass('public.user_preferences') as user_preferences;
select to_regclass('public.connection_handshakes') as connection_handshakes;

-- Preference row sanity.
select
  case
    when to_regclass('public.user_preferences') is null then null
    else (select count(*)::bigint from public.user_preferences)
  end as preference_rows;
