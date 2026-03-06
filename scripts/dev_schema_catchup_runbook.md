# Dev Schema Catch-Up Runbook

Use this after the FK hotfix when Dev is missing polished-beta tables.

## 1) Baseline
Run:

```sql
-- scripts/dev_schema_baseline.sql
select version
from supabase_migrations.schema_migrations
order by version;
```

## 2) Drift diagnostics
Run:

```sql
-- scripts/dev_schema_diagnostics.sql
select to_regclass('public.user_preferences') as user_preferences;
select to_regclass('public.connection_handshakes') as connection_handshakes;
select to_regclass('public.qr_tokens') as qr_tokens;
select to_regclass('public.event_proposals') as event_proposals;
select to_regclass('public.event_sync_state') as event_sync_state;
select to_regclass('public.device_push_tokens') as device_push_tokens;
select to_regclass('public.notification_outbox') as notification_outbox;

select t.tgname, pg_get_triggerdef(t.oid) as trigger_def
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'auth'
  and c.relname = 'users'
  and t.tgname = 'on_auth_user_created'
  and not t.tgisinternal;
```

## 3) Apply migrations in this exact order
1. `supabase/migrations/20260228000000_polished_beta_tables.sql`
2. `supabase/migrations/20260228001000_polished_beta_functions.sql`
3. `supabase/migrations/20260228002000_polished_beta_rls.sql`
4. `supabase/migrations/20260228003000_polished_beta_rpc_qr.sql`
5. `supabase/migrations/20260228004000_polished_beta_rpc_events.sql`
6. `supabase/migrations/20260228005000_polished_beta_rpc_export_notify.sql`
7. `supabase/migrations/20260228006000_profile_settings_columns.sql`
8. `supabase/migrations/20260228007000_fix_users_backfill_and_trigger.sql`

Note: migration `07000` now safely skips preference backfill if `public.user_preferences` is missing.

## 4) Post-apply validation
Run:

```sql
-- scripts/dev_schema_post_apply_validation.sql
select count(*) as missing_public_user_rows
from auth.users au
left join public.users pu on pu.id = au.id
where pu.id is null;

select to_regclass('public.user_preferences') as user_preferences;
select to_regclass('public.connection_handshakes') as connection_handshakes;

select
  case
    when to_regclass('public.user_preferences') is null then null
    else (select count(*)::bigint from public.user_preferences)
  end as preference_rows;
```

## 5) Dev app smoke test
1. Log in with legacy account and save profile.
2. Open Privacy Settings and save defaults.
3. Toggle hide-everything and push settings on User page.
4. Generate QR, scan with second account, confirm handshake.
5. Create/edit event with participants + visibility.

## 6) Promote to prod
Repeat the same migration order, validation, and smoke tests in Prod.
