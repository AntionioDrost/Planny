alter table public.user_preferences enable row level security;
alter table public.qr_tokens enable row level security;
alter table public.connection_handshakes enable row level security;
alter table public.event_proposals enable row level security;
alter table public.event_sync_state enable row level security;
alter table public.device_push_tokens enable row level security;
alter table public.notification_outbox enable row level security;

drop policy if exists "Users can view their connections' profiles." on public.users;
create policy "Users can view their connections' profiles."
  on public.users
  for select
  using (
    exists (
      select 1
      from public.connections c
      where c.status in ('active', 'limited')
        and (
          (c.user_1_id = auth.uid() and c.user_2_id = users.id)
          or (c.user_2_id = auth.uid() and c.user_1_id = users.id)
        )
    )
  );

drop policy if exists "View events based on visibility and participation" on public.events;
create policy "View events based on visibility and participation"
  on public.events
  for select
  using (
    creator_id = auth.uid()
    or (
      is_connection_active(events.creator_id, auth.uid())
      and not is_creator_hidden_everything(events.creator_id)
      and exists (
        select 1 from public.event_participants ep
        where ep.event_id = events.id
          and ep.user_id = auth.uid()
      )
    )
    or (
      is_connection_active(events.creator_id, auth.uid())
      and not is_creator_hidden_everything(events.creator_id)
      and exists (
        select 1 from public.event_visibility ev
        where ev.event_id = events.id
          and ev.viewer_user_id = auth.uid()
          and ev.level != 'hidden'
      )
    )
  );

drop policy if exists "View event visibility rules" on public.event_visibility;
create policy "View event visibility rules"
  on public.event_visibility
  for select
  using (
    viewer_user_id = auth.uid()
    or exists (
      select 1 from public.events e
      where e.id = event_visibility.event_id
        and e.creator_id = auth.uid()
    )
  );

drop policy if exists "Creators can manage event visibility" on public.event_visibility;
create policy "Creators can manage event visibility"
  on public.event_visibility
  for all
  using (
    exists (
      select 1 from public.events e
      where e.id = event_visibility.event_id
        and e.creator_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.events e
      where e.id = event_visibility.event_id
        and e.creator_id = auth.uid()
    )
  );

drop policy if exists "Users can read own availability blocks" on public.availability_blocks;
create policy "Users can read own availability blocks"
  on public.availability_blocks
  for select
  using (user_id = auth.uid());

drop policy if exists "Users can write own availability blocks" on public.availability_blocks;
create policy "Users can write own availability blocks"
  on public.availability_blocks
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can manage own preferences" on public.user_preferences;
create policy "Users can manage own preferences"
  on public.user_preferences
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can manage own qr tokens" on public.qr_tokens;
create policy "Users can manage own qr tokens"
  on public.qr_tokens
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Handshake participants can view" on public.connection_handshakes;
create policy "Handshake participants can view"
  on public.connection_handshakes
  for select
  using (auth.uid() = user_1_id or auth.uid() = user_2_id);

drop policy if exists "Handshake participants can insert" on public.connection_handshakes;
create policy "Handshake participants can insert"
  on public.connection_handshakes
  for insert
  with check (auth.uid() = user_1_id or auth.uid() = user_2_id);

drop policy if exists "Handshake participants can update" on public.connection_handshakes;
create policy "Handshake participants can update"
  on public.connection_handshakes
  for update
  using (auth.uid() = user_1_id or auth.uid() = user_2_id)
  with check (auth.uid() = user_1_id or auth.uid() = user_2_id);

drop policy if exists "Users can view related proposals" on public.event_proposals;
create policy "Users can view related proposals"
  on public.event_proposals
  for select
  using (
    proposer_id = auth.uid()
    or exists (
      select 1 from public.events e
      where e.id = event_proposals.event_id
        and e.creator_id = auth.uid()
    )
    or exists (
      select 1 from public.event_participants ep
      where ep.event_id = event_proposals.event_id
        and ep.user_id = auth.uid()
    )
  );

drop policy if exists "Participants can propose times" on public.event_proposals;
create policy "Participants can propose times"
  on public.event_proposals
  for insert
  with check (
    proposer_id = auth.uid()
    and exists (
      select 1 from public.event_participants ep
      where ep.event_id = event_proposals.event_id
        and ep.user_id = auth.uid()
    )
  );

drop policy if exists "Creators and proposers can update proposals" on public.event_proposals;
create policy "Creators and proposers can update proposals"
  on public.event_proposals
  for update
  using (
    proposer_id = auth.uid()
    or exists (
      select 1 from public.events e
      where e.id = event_proposals.event_id
        and e.creator_id = auth.uid()
    )
  )
  with check (
    proposer_id = auth.uid()
    or exists (
      select 1 from public.events e
      where e.id = event_proposals.event_id
        and e.creator_id = auth.uid()
    )
  );

drop policy if exists "Users can manage their event sync state" on public.event_sync_state;
create policy "Users can manage their event sync state"
  on public.event_sync_state
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can manage own push tokens" on public.device_push_tokens;
create policy "Users can manage own push tokens"
  on public.device_push_tokens
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Recipients can read own notifications" on public.notification_outbox;
create policy "Recipients can read own notifications"
  on public.notification_outbox
  for select
  using (recipient_user_id = auth.uid());

drop policy if exists "View event participants" on public.event_participants;
create policy "View event participants"
  on public.event_participants
  for select
  using (
    exists (
      select 1 from public.events e
      where e.id = event_participants.event_id
        and e.creator_id = auth.uid()
    )
    or (
      user_id = auth.uid()
      and exists (
        select 1 from public.events e
        where e.id = event_participants.event_id
          and is_connection_active(e.creator_id, auth.uid())
          and not is_creator_hidden_everything(e.creator_id)
      )
    )
    or exists (
      select 1
      from public.event_visibility ev
      join public.events e on e.id = ev.event_id
      where ev.event_id = event_participants.event_id
        and ev.viewer_user_id = auth.uid()
        and ev.can_see_participants = true
        and is_connection_active(e.creator_id, auth.uid())
        and not is_creator_hidden_everything(e.creator_id)
    )
  );
