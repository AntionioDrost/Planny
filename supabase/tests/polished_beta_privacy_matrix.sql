-- Manual SQL verification matrix for polished beta privacy model.
-- Run these after seeding users A/B/C and creating sample events.

-- 1) Hidden user cannot see creator event.
-- select * from public.events where id = '<event_id>';

-- 2) Participant can see invited event when connection is active.
-- select * from public.events where id = '<event_id>';

-- 3) Limiting a connection hides event details immediately.
-- update public.connections set status = 'limited' where id = '<connection_id>';
-- select * from public.events where id = '<event_id>';

-- 4) Hide-everything preference overrides per-event visibility.
-- update public.user_preferences set hide_everything_enabled = true where user_id = '<creator_id>';
-- select * from public.events where id = '<event_id>';
