create index if not exists event_proposals_event_idx on public.event_proposals(event_id);
create index if not exists event_proposals_proposer_idx on public.event_proposals(proposer_id);
create index if not exists connection_handshakes_pair_idx on public.connection_handshakes(user_1_id, user_2_id);
create index if not exists connection_handshakes_status_idx on public.connection_handshakes(status);
create index if not exists device_push_tokens_user_idx on public.device_push_tokens(user_id);
create index if not exists user_preferences_hide_everything_idx on public.user_preferences(hide_everything_enabled);

create or replace function public.is_connection_active(user_a uuid, user_b uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.connections c
    where c.status = 'active'
      and (
        (c.user_1_id = user_a and c.user_2_id = user_b)
        or (c.user_1_id = user_b and c.user_2_id = user_a)
      )
  );
$$;

create or replace function public.is_creator_hidden_everything(creator uuid)
returns boolean
language sql
stable
as $$
  select coalesce((
    select up.hide_everything_enabled
    from public.user_preferences up
    where up.user_id = creator
  ), false);
$$;

create or replace function public.recompute_event_status(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer := 0;
  v_accepted integer := 0;
  v_new_status public.event_status := 'tentative'::public.event_status;
begin
  select count(*), count(*) filter (where status = 'accepted')
  into v_total, v_accepted
  from public.event_participants
  where event_id = p_event_id;

  if v_total = 0 then
    v_new_status := 'confirmed'::public.event_status;
  elsif v_total = 1 then
    if v_accepted = 1 then
      v_new_status := 'confirmed'::public.event_status;
    else
      v_new_status := 'tentative'::public.event_status;
    end if;
  else
    if v_accepted = v_total then
      v_new_status := 'confirmed'::public.event_status;
    else
      v_new_status := 'tentative'::public.event_status;
    end if;
  end if;

  update public.events
  set status = v_new_status,
      updated_at = timezone('utc'::text, now())
  where id = p_event_id;
end;
$$;

create or replace function public.recompute_event_status_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recompute_event_status(coalesce(new.event_id, old.event_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists event_participants_recompute_status on public.event_participants;
create trigger event_participants_recompute_status
after insert or update or delete on public.event_participants
for each row execute procedure public.recompute_event_status_trigger();

drop trigger if exists user_preferences_touch_updated_at on public.user_preferences;
create trigger user_preferences_touch_updated_at
before update on public.user_preferences
for each row execute procedure public.touch_updated_at();

drop trigger if exists connection_handshakes_touch_updated_at on public.connection_handshakes;
create trigger connection_handshakes_touch_updated_at
before update on public.connection_handshakes
for each row execute procedure public.touch_updated_at();

drop trigger if exists event_proposals_touch_updated_at on public.event_proposals;
create trigger event_proposals_touch_updated_at
before update on public.event_proposals
for each row execute procedure public.touch_updated_at();

drop trigger if exists event_sync_state_touch_updated_at on public.event_sync_state;
create trigger event_sync_state_touch_updated_at
before update on public.event_sync_state
for each row execute procedure public.touch_updated_at();

drop trigger if exists device_push_tokens_touch_updated_at on public.device_push_tokens;
create trigger device_push_tokens_touch_updated_at
before update on public.device_push_tokens
for each row execute procedure public.touch_updated_at();

drop trigger if exists notification_outbox_touch_updated_at on public.notification_outbox;
create trigger notification_outbox_touch_updated_at
before update on public.notification_outbox
for each row execute procedure public.touch_updated_at();
