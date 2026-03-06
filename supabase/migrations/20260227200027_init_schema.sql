-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- 1. users
create table public.users (
  id uuid references auth.users not null primary key,
  email text not null,
  display_name text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.users enable row level security;

-- Users can read their own profile
create policy "Users can view their own profile."
  on public.users for select
  using ( auth.uid() = id );

-- Users can update their own profile
create policy "Users can update their own profile."
  on public.users for update
  using ( auth.uid() = id );

-- Function to handle new user creation from Supabase Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, display_name)
  values (new.id, new.email, new.raw_user_meta_data->>'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. connections
create type public.connection_status as enum ('pending', 'active', 'limited', 'removed');

create table public.connections (
  id uuid default uuid_generate_v4() primary key,
  user_1_id uuid references public.users not null,
  user_2_id uuid references public.users not null,
  status public.connection_status default 'pending'::public.connection_status not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint connection_user_order check (user_1_id < user_2_id)
);

-- Index for fast lookup by user
create index connections_user_1_id_idx on public.connections(user_1_id);
create index connections_user_2_id_idx on public.connections(user_2_id);

alter table public.connections enable row level security;

-- Users can read connections they are part of
create policy "Users can view their own connections."
  on public.connections for select
  using ( auth.uid() = user_1_id or auth.uid() = user_2_id );

-- 3. events
create type public.event_status as enum ('tentative', 'confirmed', 'canceled');

create table public.events (
  id uuid default uuid_generate_v4() primary key,
  creator_id uuid references public.users not null,
  title text not null,
  date date not null,
  start_time time without time zone,
  end_time time without time zone,
  is_all_day boolean default false not null,
  location text,
  notes text,
  is_recurring boolean default false not null,
  status public.event_status default 'tentative'::public.event_status not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.events enable row level security;

-- 4. event_participants
create type public.participant_status as enum ('pending', 'accepted', 'declined', 'proposed_new_time');

create table public.event_participants (
  event_id uuid references public.events on delete cascade not null,
  user_id uuid references public.users not null,
  status public.participant_status default 'pending'::public.participant_status not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (event_id, user_id)
);

alter table public.event_participants enable row level security;

-- 5. event_visibility
create type public.visibility_level as enum ('hidden', 'busy_only', 'title_only', 'full_details');

create table public.event_visibility (
  id uuid default uuid_generate_v4() primary key,
  event_id uuid references public.events on delete cascade not null,
  viewer_user_id uuid references public.users not null,
  level public.visibility_level default 'hidden'::public.visibility_level not null,
  can_see_participants boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (event_id, viewer_user_id)
);

create index event_visibility_viewer_idx on public.event_visibility(viewer_user_id);

alter table public.event_visibility enable row level security;

-- 6. availability_blocks
create table public.availability_blocks (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users not null,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.availability_blocks enable row level security;

-- RLS for Events
create policy "View events based on visibility and participation"
  on public.events for select
  using (
    creator_id = auth.uid()
    or exists (
      select 1 from public.event_participants ep 
      where ep.event_id = events.id and ep.user_id = auth.uid()
    )
    or exists (
      select 1 from public.event_visibility ev 
      where ev.event_id = events.id 
      and ev.viewer_user_id = auth.uid() 
      and ev.level != 'hidden'
    )
  );

create policy "Creators can insert events"
  on public.events for insert
  with check ( creator_id = auth.uid() );

create policy "Creators can update events"
  on public.events for update
  using ( creator_id = auth.uid() );

-- RLS for Participants
create policy "View event participants"
  on public.event_participants for select
  using (
    user_id = auth.uid() -- Can see own response
    or exists (
      select 1 from public.events e where e.id = event_participants.event_id and e.creator_id = auth.uid()
    )
    or exists (
      select 1 from public.event_visibility ev
      where ev.event_id = event_participants.event_id
      and ev.viewer_user_id = auth.uid()
      and ev.can_see_participants = true
    )
  );

create policy "Participants can update their own status"
  on public.event_participants for update
  using ( user_id = auth.uid() );
