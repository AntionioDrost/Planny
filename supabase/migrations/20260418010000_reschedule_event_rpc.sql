create or replace function public.reschedule_event(
  p_event_id uuid,
  p_start_at_utc timestamp with time zone,
  p_end_at_utc timestamp with time zone,
  p_timezone text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_creator_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_end_at_utc <= p_start_at_utc then
    raise exception 'Event end must be after start';
  end if;

  select creator_id
  into v_creator_id
  from public.events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'Event not found';
  end if;

  if v_creator_id <> v_user_id then
    raise exception 'Only the event creator can reschedule this event';
  end if;

  if not exists (
    select 1
    from public.event_participants ep
    where ep.event_id = p_event_id
  ) then
    raise exception 'Add at least one participant before proposing a new time';
  end if;

  update public.events
  set start_at_utc = p_start_at_utc,
      end_at_utc = p_end_at_utc,
      timezone = p_timezone,
      date = (p_start_at_utc at time zone p_timezone)::date,
      start_time = (p_start_at_utc at time zone p_timezone)::time,
      end_time = (p_end_at_utc at time zone p_timezone)::time,
      status = 'tentative'::public.event_status,
      updated_at = timezone('utc'::text, now())
  where id = p_event_id;

  update public.event_participants
  set status = 'pending'::public.participant_status
  where event_id = p_event_id;

  perform public.recompute_event_status(p_event_id);

  return p_event_id;
end;
$$;
