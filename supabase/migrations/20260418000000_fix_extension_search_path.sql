create extension if not exists "pgcrypto";

create or replace function public.issue_qr_payload()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_token text := encode(gen_random_bytes(16), 'hex');
  v_expires_at timestamp with time zone := timezone('utc'::text, now()) + interval '1 minute';
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.qr_tokens
  where user_id = v_user_id
    and expires_at < timezone('utc'::text, now());

  insert into public.qr_tokens (user_id, token, expires_at)
  values (v_user_id, v_token, v_expires_at);

  return jsonb_build_object(
    'user_id', v_user_id,
    'token', v_token,
    'expires_at', v_expires_at
  );
end;
$$;

create or replace function public.create_event_bundle(
  p_title text,
  p_start_at_utc timestamp with time zone,
  p_end_at_utc timestamp with time zone,
  p_timezone text,
  p_is_all_day boolean default false,
  p_location text default null,
  p_notes text default null,
  p_participant_ids uuid[] default '{}',
  p_visibility jsonb default '[]'::jsonb,
  p_recurrence_kind public.recurrence_kind default 'none'::public.recurrence_kind,
  p_recurrence_interval_weeks integer default 1,
  p_recurrence_until date default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_creator_id uuid := auth.uid();
  v_series_id uuid;
  v_event_id uuid;
  v_first_event_id uuid;
  v_occurrence_start timestamp with time zone := p_start_at_utc;
  v_occurrence_end timestamp with time zone := p_end_at_utc;
  v_recurrence_end date := coalesce(p_recurrence_until, (p_start_at_utc at time zone p_timezone)::date);
  v_is_first boolean := true;
  v_offset integer := 0;
  v_participant uuid;
  v_visibility record;
begin
  if v_creator_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_end_at_utc <= p_start_at_utc then
    raise exception 'Event end must be after start';
  end if;

  if p_recurrence_kind = 'weekly'::public.recurrence_kind then
    v_series_id := gen_random_uuid();
  end if;

  loop
    insert into public.events (
      creator_id, title, date, start_time, end_time, is_all_day, location, notes, status,
      start_at_utc, end_at_utc, timezone, series_id, is_series_master,
      recurrence_kind, recurrence_interval_weeks, recurrence_until
    )
    values (
      v_creator_id,
      p_title,
      (v_occurrence_start at time zone p_timezone)::date,
      (v_occurrence_start at time zone p_timezone)::time,
      (v_occurrence_end at time zone p_timezone)::time,
      p_is_all_day,
      p_location,
      p_notes,
      'tentative'::public.event_status,
      v_occurrence_start,
      v_occurrence_end,
      p_timezone,
      v_series_id,
      v_is_first,
      p_recurrence_kind,
      p_recurrence_interval_weeks,
      p_recurrence_until
    )
    returning id into v_event_id;

    if v_is_first then
      v_first_event_id := v_event_id;
    end if;

    foreach v_participant in array p_participant_ids
    loop
      insert into public.event_participants (event_id, user_id, status)
      values (v_event_id, v_participant, 'pending'::public.participant_status)
      on conflict do nothing;
    end loop;

    for v_visibility in
      select *
      from jsonb_to_recordset(coalesce(p_visibility, '[]'::jsonb))
      as x(viewer_user_id uuid, level public.visibility_level, can_see_participants boolean)
    loop
      insert into public.event_visibility (event_id, viewer_user_id, level, can_see_participants)
      values (v_event_id, v_visibility.viewer_user_id, v_visibility.level, coalesce(v_visibility.can_see_participants, false))
      on conflict (event_id, viewer_user_id)
      do update set
        level = excluded.level,
        can_see_participants = excluded.can_see_participants;
    end loop;

    foreach v_participant in array p_participant_ids
    loop
      insert into public.event_visibility (event_id, viewer_user_id, level, can_see_participants)
      values (v_event_id, v_participant, 'full_details'::public.visibility_level, true)
      on conflict (event_id, viewer_user_id)
      do update set
        level = 'full_details'::public.visibility_level,
        can_see_participants = true;
    end loop;

    perform public.recompute_event_status(v_event_id);

    exit when p_recurrence_kind = 'none'::public.recurrence_kind;

    v_offset := v_offset + p_recurrence_interval_weeks;
    v_occurrence_start := p_start_at_utc + make_interval(weeks => v_offset);
    v_occurrence_end := p_end_at_utc + make_interval(weeks => v_offset);
    v_is_first := false;

    exit when (v_occurrence_start at time zone p_timezone)::date > v_recurrence_end;
  end loop;

  return v_first_event_id;
end;
$$;
