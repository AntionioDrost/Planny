create extension if not exists "pgcrypto";

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'handshake_status') then
    create type public.handshake_status as enum ('pending', 'scanned', 'confirmed', 'connected', 'expired', 'failed');
  end if;

  if not exists (select 1 from pg_type where typname = 'proposal_status') then
    create type public.proposal_status as enum ('pending', 'accepted', 'rejected', 'withdrawn');
  end if;

  if not exists (select 1 from pg_type where typname = 'recurrence_kind') then
    create type public.recurrence_kind as enum ('none', 'weekly');
  end if;
end $$;

alter table public.events
  add column if not exists start_at_utc timestamp with time zone,
  add column if not exists end_at_utc timestamp with time zone,
  add column if not exists timezone text,
  add column if not exists series_id uuid,
  add column if not exists is_series_master boolean default false not null,
  add column if not exists recurrence_kind public.recurrence_kind default 'none'::public.recurrence_kind not null,
  add column if not exists recurrence_interval_weeks integer default 1 not null,
  add column if not exists recurrence_until date;

update public.events
set timezone = coalesce(timezone, 'UTC');

update public.events
set start_at_utc = coalesce(
  start_at_utc,
  (date::timestamp + coalesce(start_time, '00:00:00'::time)) at time zone 'UTC'
);

update public.events
set end_at_utc = coalesce(
  end_at_utc,
  case
    when is_all_day then start_at_utc + interval '1 day'
    else (date::timestamp + coalesce(end_time, start_time, '01:00:00'::time)) at time zone 'UTC'
  end
);

alter table public.events
  alter column timezone set not null,
  alter column start_at_utc set not null,
  alter column end_at_utc set not null;

create table if not exists public.user_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  default_existing_visibility public.visibility_level default 'busy_only'::public.visibility_level not null,
  hide_everything_enabled boolean default false not null,
  sleep_start_local time without time zone default '23:00:00'::time not null,
  sleep_end_local time without time zone default '07:00:00'::time not null,
  timezone text default 'UTC' not null,
  notification_privacy_mode text default 'generic' not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint user_preferences_notification_privacy_mode_check check (notification_privacy_mode in ('generic'))
);

create table if not exists public.qr_tokens (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  token text not null,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, token)
);

create table if not exists public.connection_handshakes (
  id uuid default gen_random_uuid() primary key,
  user_1_id uuid references public.users(id) on delete cascade not null,
  user_2_id uuid references public.users(id) on delete cascade not null,
  scan_1_at timestamp with time zone,
  scan_2_at timestamp with time zone,
  confirm_1_at timestamp with time zone,
  confirm_2_at timestamp with time zone,
  expires_at timestamp with time zone not null,
  status public.handshake_status default 'pending'::public.handshake_status not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint connection_handshakes_user_order check (user_1_id < user_2_id),
  unique (user_1_id, user_2_id)
);

create table if not exists public.event_proposals (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references public.events(id) on delete cascade not null,
  proposer_id uuid references public.users(id) on delete cascade not null,
  start_at_utc timestamp with time zone not null,
  end_at_utc timestamp with time zone not null,
  timezone text not null,
  note text,
  status public.proposal_status default 'pending'::public.proposal_status not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint event_proposals_time_check check (end_at_utc > start_at_utc)
);

create table if not exists public.event_sync_state (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references public.events(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  external_id text,
  last_sync_status text default 'pending' not null,
  last_sync_error text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint event_sync_state_status_check check (last_sync_status in ('pending', 'synced', 'failed')),
  unique (event_id, user_id)
);

create table if not exists public.device_push_tokens (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  token text not null unique,
  platform text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint device_push_tokens_platform_check check (platform in ('ios', 'android', 'web'))
);

create table if not exists public.notification_outbox (
  id uuid default gen_random_uuid() primary key,
  recipient_user_id uuid references public.users(id) on delete cascade not null,
  kind text not null,
  payload jsonb default '{}'::jsonb not null,
  status text default 'queued' not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint notification_outbox_status_check check (status in ('queued', 'sent', 'failed'))
);

insert into public.user_preferences (user_id)
select u.id
from public.users u
where not exists (
  select 1 from public.user_preferences up where up.user_id = u.id
);
