-- ReCircle user management schema.
-- Run this file in Supabase SQL Editor before using production data.

create type public.user_role as enum ('individual', 'student', 'recycler', 'business', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'ReCircle user',
  role public.user_role not null default 'individual',
  place text not null default '',
  lat double precision not null default 12.9716,
  lng double precision not null default 77.5946,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "Profiles are publicly readable" on public.profiles for select using (true);
create policy "Users can create their profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update their profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.create_profile_for_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_profile_for_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
for each row execute procedure public.set_updated_at();

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('offer', 'wanted')),
  category text not null,
  title text not null,
  description text not null default '',
  qty numeric not null default 1,
  unit text not null default 'items',
  weight_kg numeric not null default 0,
  condition text not null default '',
  price numeric not null default 0,
  place text not null default '',
  lat double precision not null,
  lng double precision not null,
  image text,
  status text not null default 'available' check (status in ('available', 'reserved', 'exchanged')),
  created_at timestamptz not null default now()
);

alter table public.listings enable row level security;
create policy "Anyone can view listings" on public.listings for select using (true);
create policy "Users can create listings" on public.listings for insert with check (auth.uid() = owner_id);
create policy "Owners can update listings" on public.listings for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "Owners can delete listings" on public.listings for delete using (auth.uid() = owner_id);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  participant_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (listing_id, participant_id)
);

alter table public.conversations enable row level security;
create policy "Participants can view conversations" on public.conversations for select
  using (auth.uid() in (owner_id, participant_id));
create policy "Participants can create conversations" on public.conversations for insert
  with check (auth.uid() in (owner_id, participant_id));

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;
create policy "Participants can view messages" on public.messages for select using (
  exists (select 1 from public.conversations c
    where c.id = conversation_id and auth.uid() in (c.owner_id, c.participant_id))
);
create policy "Participants can send messages" on public.messages for insert with check (
  auth.uid() = sender_id and exists (select 1 from public.conversations c
    where c.id = conversation_id and auth.uid() in (c.owner_id, c.participant_id))
);
