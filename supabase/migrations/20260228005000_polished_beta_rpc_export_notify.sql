create or replace function public.export_user_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile jsonb;
  v_events jsonb;
  v_connections jsonb;
  v_preferences jsonb;
  v_ics_events text;
  v_ics text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select to_jsonb(u) into v_profile
  from public.users u
  where u.id = v_user_id;

  select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb) into v_events
  from public.events e
  where e.creator_id = v_user_id
     or exists (
       select 1 from public.event_participants ep
       where ep.event_id = e.id
         and ep.user_id = v_user_id
     );

  select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) into v_connections
  from public.connections c
  where (c.user_1_id = v_user_id or c.user_2_id = v_user_id)
    and c.status <> 'removed';

  select to_jsonb(up) into v_preferences
  from public.user_preferences up
  where up.user_id = v_user_id;

  select coalesce(string_agg(
    'BEGIN:VEVENT' || E'\n' ||
    'UID:' || e.id::text || '@planny' || E'\n' ||
    'DTSTAMP:' || to_char((e.created_at at time zone 'UTC'), 'YYYYMMDD"T"HH24MISS"Z"') || E'\n' ||
    'DTSTART:' || to_char((e.start_at_utc at time zone 'UTC'), 'YYYYMMDD"T"HH24MISS"Z"') || E'\n' ||
    'DTEND:' || to_char((e.end_at_utc at time zone 'UTC'), 'YYYYMMDD"T"HH24MISS"Z"') || E'\n' ||
    'SUMMARY:' || replace(coalesce(e.title, 'Planny Event'), E'\n', ' ') || E'\n' ||
    'END:VEVENT',
    E'\n'
  ), '')
  into v_ics_events
  from public.events e
  where e.creator_id = v_user_id;

  v_ics :=
    'BEGIN:VCALENDAR' || E'\n' ||
    'VERSION:2.0' || E'\n' ||
    'PRODID:-//Planny//EN' || E'\n' ||
    coalesce(v_ics_events, '') || E'\n' ||
    'END:VCALENDAR';

  return jsonb_build_object(
    'json_export', jsonb_build_object(
      'profile', coalesce(v_profile, '{}'::jsonb),
      'events', coalesce(v_events, '[]'::jsonb),
      'connections', coalesce(v_connections, '[]'::jsonb),
      'preferences', coalesce(v_preferences, '{}'::jsonb)
    ),
    'ics_export', v_ics
  );
end;
$$;

create or replace function public.send_notification(
  p_recipient_user_id uuid,
  p_kind text,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.notification_outbox (recipient_user_id, kind, payload, status)
  values (p_recipient_user_id, p_kind, coalesce(p_payload, '{}'::jsonb), 'queued')
  returning id into v_id;

  return v_id;
end;
$$;
