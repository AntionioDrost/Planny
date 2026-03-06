-- Drift diagnostics: verify required polished-beta objects exist.
select to_regclass('public.user_preferences') as user_preferences;
select to_regclass('public.connection_handshakes') as connection_handshakes;
select to_regclass('public.qr_tokens') as qr_tokens;
select to_regclass('public.event_proposals') as event_proposals;
select to_regclass('public.event_sync_state') as event_sync_state;
select to_regclass('public.device_push_tokens') as device_push_tokens;
select to_regclass('public.notification_outbox') as notification_outbox;

-- Trigger diagnostics: ensure auth->public user sync trigger exists.
select t.tgname, pg_get_triggerdef(t.oid) as trigger_def
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'auth'
  and c.relname = 'users'
  and t.tgname = 'on_auth_user_created'
  and not t.tgisinternal;
