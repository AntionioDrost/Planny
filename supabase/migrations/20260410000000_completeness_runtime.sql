alter table public.notification_outbox
  add column if not exists attempt_count integer default 0 not null,
  add column if not exists last_attempt_at timestamp with time zone,
  add column if not exists delivered_at timestamp with time zone,
  add column if not exists last_error text;

alter table public.notification_outbox
  drop constraint if exists notification_outbox_kind_check;

alter table public.notification_outbox
  add constraint notification_outbox_kind_check
  check (kind in ('event_invite', 'event_response', 'proposal_created', 'proposal_decided', 'connection_confirmed'));

create index if not exists notification_outbox_status_created_idx
  on public.notification_outbox(status, created_at);

create or replace function public.get_default_existing_visibility(p_user_id uuid)
returns public.visibility_level
language sql
stable
as $$
  select coalesce(
    (
      select up.default_existing_visibility
      from public.user_preferences up
      where up.user_id = p_user_id
    ),
    'busy_only'::public.visibility_level
  );
$$;

create or replace function public.seed_visibility_for_connection_pair(
  p_creator_id uuid,
  p_viewer_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_level public.visibility_level := public.get_default_existing_visibility(p_creator_id);
begin
  insert into public.event_visibility (
    event_id,
    viewer_user_id,
    level,
    can_see_participants
  )
  select
    e.id,
    p_viewer_id,
    v_level,
    v_level = 'full_details'::public.visibility_level
  from public.events e
  where e.creator_id = p_creator_id
    and not exists (
      select 1
      from public.event_visibility ev
      where ev.event_id = e.id
        and ev.viewer_user_id = p_viewer_id
    );
end;
$$;

create or replace function public.seed_visibility_for_active_connection_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active'::public.connection_status
     and (
       tg_op = 'INSERT'
       or old.status is distinct from 'active'::public.connection_status
     ) then
    perform public.seed_visibility_for_connection_pair(new.user_1_id, new.user_2_id);
    perform public.seed_visibility_for_connection_pair(new.user_2_id, new.user_1_id);
  end if;

  return new;
end;
$$;

drop trigger if exists connections_seed_visibility_after_write on public.connections;
create trigger connections_seed_visibility_after_write
after insert or update of status on public.connections
for each row execute procedure public.seed_visibility_for_active_connection_trigger();

with active_pairs as (
  select c.user_1_id as creator_id, c.user_2_id as viewer_id
  from public.connections c
  where c.status = 'active'::public.connection_status
  union all
  select c.user_2_id as creator_id, c.user_1_id as viewer_id
  from public.connections c
  where c.status = 'active'::public.connection_status
),
pair_defaults as (
  select
    ap.creator_id,
    ap.viewer_id,
    public.get_default_existing_visibility(ap.creator_id) as level
  from active_pairs ap
)
insert into public.event_visibility (
  event_id,
  viewer_user_id,
  level,
  can_see_participants
)
select
  e.id,
  pd.viewer_id,
  pd.level,
  pd.level = 'full_details'::public.visibility_level
from pair_defaults pd
join public.events e on e.creator_id = pd.creator_id
left join public.event_visibility ev
  on ev.event_id = e.id
 and ev.viewer_user_id = pd.viewer_id
where ev.event_id is null;

create or replace function public.enqueue_notification(
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
  insert into public.notification_outbox (
    recipient_user_id,
    kind,
    payload,
    status
  )
  values (
    p_recipient_user_id,
    p_kind,
    coalesce(p_payload, '{}'::jsonb),
    'queued'
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.notify_event_participant_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator_id uuid;
begin
  select e.creator_id into v_creator_id
  from public.events e
  where e.id = coalesce(new.event_id, old.event_id);

  if v_creator_id is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    if new.user_id <> v_creator_id then
      perform public.enqueue_notification(
        new.user_id,
        'event_invite',
        jsonb_build_object(
          'event_id', new.event_id,
          'actor_user_id', v_creator_id,
          'participant_status', new.status
        )
      );
    end if;
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status in ('accepted'::public.participant_status, 'declined'::public.participant_status) then
      perform public.enqueue_notification(
        v_creator_id,
        'event_response',
        jsonb_build_object(
          'event_id', new.event_id,
          'actor_user_id', new.user_id,
          'participant_status', new.status
        )
      );
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists event_participants_enqueue_notifications on public.event_participants;
create trigger event_participants_enqueue_notifications
after insert or update on public.event_participants
for each row execute procedure public.notify_event_participant_change();

create or replace function public.notify_event_proposal_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator_id uuid;
begin
  select e.creator_id into v_creator_id
  from public.events e
  where e.id = coalesce(new.event_id, old.event_id);

  if v_creator_id is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    perform public.enqueue_notification(
      v_creator_id,
      'proposal_created',
      jsonb_build_object(
        'proposal_id', new.id,
        'event_id', new.event_id,
        'actor_user_id', new.proposer_id
      )
    );
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status in ('accepted'::public.proposal_status, 'rejected'::public.proposal_status) then
      perform public.enqueue_notification(
        new.proposer_id,
        'proposal_decided',
        jsonb_build_object(
          'proposal_id', new.id,
          'event_id', new.event_id,
          'actor_user_id', v_creator_id,
          'proposal_status', new.status
        )
      );
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists event_proposals_enqueue_notifications on public.event_proposals;
create trigger event_proposals_enqueue_notifications
after insert or update on public.event_proposals
for each row execute procedure public.notify_event_proposal_change();

create or replace function public.notify_connection_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active'::public.connection_status
     and (
       tg_op = 'INSERT'
       or old.status is distinct from 'active'::public.connection_status
     ) then
    perform public.enqueue_notification(
      new.user_1_id,
      'connection_confirmed',
      jsonb_build_object(
        'connection_id', new.id,
        'other_user_id', new.user_2_id
      )
    );
    perform public.enqueue_notification(
      new.user_2_id,
      'connection_confirmed',
      jsonb_build_object(
        'connection_id', new.id,
        'other_user_id', new.user_1_id
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists connections_enqueue_notifications_after_write on public.connections;
create trigger connections_enqueue_notifications_after_write
after insert or update of status on public.connections
for each row execute procedure public.notify_connection_confirmed();

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
begin
  return public.enqueue_notification(p_recipient_user_id, p_kind, p_payload);
end;
$$;
