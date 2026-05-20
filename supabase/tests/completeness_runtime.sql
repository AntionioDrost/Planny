-- Manual verification queries for the completeness runtime changes.
-- Run after applying migrations and seeding test users/events.

-- 1. New active connection seeds visibility on existing events.
-- update public.connections
-- set status = 'active'
-- where id = '<connection_id>';
--
-- select event_id, viewer_user_id, level, can_see_participants
-- from public.event_visibility
-- where viewer_user_id in ('<user_a>', '<user_b>')
-- order by event_id, viewer_user_id;

-- 2. Changing privacy defaults later does not rewrite existing visibility rows.
-- update public.user_preferences
-- set default_existing_visibility = 'full_details'
-- where user_id = '<creator_id>';
--
-- select event_id, viewer_user_id, level
-- from public.event_visibility
-- where viewer_user_id = '<viewer_id>'
-- order by created_at desc;

-- 3. Invites, responses, proposals, and connection confirmations enqueue notifications.
-- select kind, status, payload
-- from public.notification_outbox
-- order by created_at desc
-- limit 20;

-- 4. Delivery worker state is tracked on the outbox row.
-- select id, kind, status, attempt_count, last_attempt_at, delivered_at, last_error
-- from public.notification_outbox
-- order by created_at desc
-- limit 20;
