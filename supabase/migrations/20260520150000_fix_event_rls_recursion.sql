create or replace function public.is_event_creator(p_event_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and e.creator_id = p_user_id
  );
$$;

create or replace function public.is_event_participant(p_event_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.event_participants ep
    where ep.event_id = p_event_id
      and ep.user_id = p_user_id
  );
$$;

create or replace function public.has_visible_event_rule(p_event_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.event_visibility ev
    where ev.event_id = p_event_id
      and ev.viewer_user_id = p_user_id
      and ev.level != 'hidden'
  );
$$;

create or replace function public.can_view_event_participants(p_event_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and e.creator_id = p_user_id
  )
  or exists (
    select 1
    from public.events e
    join public.event_participants ep on ep.event_id = e.id
    where e.id = p_event_id
      and ep.user_id = p_user_id
      and public.is_connection_active(e.creator_id, p_user_id)
      and not public.is_creator_hidden_everything(e.creator_id)
  )
  or exists (
    select 1
    from public.events e
    join public.event_visibility ev on ev.event_id = e.id
    where e.id = p_event_id
      and ev.viewer_user_id = p_user_id
      and ev.can_see_participants = true
      and public.is_connection_active(e.creator_id, p_user_id)
      and not public.is_creator_hidden_everything(e.creator_id)
  );
$$;

drop policy if exists "View events based on visibility and participation" on public.events;
create policy "View events based on visibility and participation"
  on public.events
  for select
  using (
    creator_id = (select auth.uid())
    or (
      public.is_connection_active(events.creator_id, (select auth.uid()))
      and not public.is_creator_hidden_everything(events.creator_id)
      and public.is_event_participant(events.id, (select auth.uid()))
    )
    or (
      public.is_connection_active(events.creator_id, (select auth.uid()))
      and not public.is_creator_hidden_everything(events.creator_id)
      and public.has_visible_event_rule(events.id, (select auth.uid()))
    )
  );

drop policy if exists "View event visibility rules" on public.event_visibility;
create policy "View event visibility rules"
  on public.event_visibility
  for select
  using (
    viewer_user_id = (select auth.uid())
    or public.is_event_creator(event_visibility.event_id, (select auth.uid()))
  );

drop policy if exists "Creators can manage event visibility" on public.event_visibility;
create policy "Creators can manage event visibility"
  on public.event_visibility
  for all
  using (public.is_event_creator(event_visibility.event_id, (select auth.uid())))
  with check (public.is_event_creator(event_visibility.event_id, (select auth.uid())));

drop policy if exists "View event participants" on public.event_participants;
create policy "View event participants"
  on public.event_participants
  for select
  using (public.can_view_event_participants(event_participants.event_id, (select auth.uid())));

drop policy if exists "Users can view related proposals" on public.event_proposals;
create policy "Users can view related proposals"
  on public.event_proposals
  for select
  using (
    proposer_id = (select auth.uid())
    or public.is_event_creator(event_proposals.event_id, (select auth.uid()))
    or public.is_event_participant(event_proposals.event_id, (select auth.uid()))
  );

drop policy if exists "Participants can propose times" on public.event_proposals;
create policy "Participants can propose times"
  on public.event_proposals
  for insert
  with check (
    proposer_id = (select auth.uid())
    and public.is_event_participant(event_proposals.event_id, (select auth.uid()))
  );

drop policy if exists "Creators and proposers can update proposals" on public.event_proposals;
create policy "Creators and proposers can update proposals"
  on public.event_proposals
  for update
  using (
    proposer_id = (select auth.uid())
    or public.is_event_creator(event_proposals.event_id, (select auth.uid()))
  )
  with check (
    proposer_id = (select auth.uid())
    or public.is_event_creator(event_proposals.event_id, (select auth.uid()))
  );
