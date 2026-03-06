alter table public.user_preferences
  add column if not exists push_notifications_enabled boolean default true not null,
  add column if not exists connected_calendar_provider text default 'none' not null,
  add column if not exists calendar_push_enabled boolean default false not null;

alter table public.user_preferences
  drop constraint if exists user_preferences_connected_calendar_provider_check;

alter table public.user_preferences
  add constraint user_preferences_connected_calendar_provider_check
  check (connected_calendar_provider in ('none', 'apple', 'google', 'outlook', 'ical'));

alter table public.users
  add column if not exists deletion_requested_at timestamp with time zone;
