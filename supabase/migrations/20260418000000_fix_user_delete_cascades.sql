-- Allow deleting auth users from Supabase Auth by cascading through the
-- mirrored public.users row and the legacy tables created before cascades
-- were added to newer user-owned tables.

alter table public.users
  drop constraint if exists users_id_fkey;

alter table public.users
  add constraint users_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;

alter table public.connections
  drop constraint if exists connections_user_1_id_fkey,
  drop constraint if exists connections_user_2_id_fkey;

alter table public.connections
  add constraint connections_user_1_id_fkey
    foreign key (user_1_id) references public.users(id) on delete cascade,
  add constraint connections_user_2_id_fkey
    foreign key (user_2_id) references public.users(id) on delete cascade;

alter table public.events
  drop constraint if exists events_creator_id_fkey;

alter table public.events
  add constraint events_creator_id_fkey
  foreign key (creator_id) references public.users(id) on delete cascade;

alter table public.event_participants
  drop constraint if exists event_participants_user_id_fkey;

alter table public.event_participants
  add constraint event_participants_user_id_fkey
  foreign key (user_id) references public.users(id) on delete cascade;

alter table public.event_visibility
  drop constraint if exists event_visibility_viewer_user_id_fkey;

alter table public.event_visibility
  add constraint event_visibility_viewer_user_id_fkey
  foreign key (viewer_user_id) references public.users(id) on delete cascade;

alter table public.availability_blocks
  drop constraint if exists availability_blocks_user_id_fkey;

alter table public.availability_blocks
  add constraint availability_blocks_user_id_fkey
  foreign key (user_id) references public.users(id) on delete cascade;
