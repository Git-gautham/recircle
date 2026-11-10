-- Run after schema.sql has already been applied.
-- Adds shared listings, conversations and messages to the existing project.

create table if not exists public.listings (
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
drop policy if exists "Anyone can view listings" on public.listings;
drop policy if exists "Users can create listings" on public.listings;
drop policy if exists "Owners can update listings" on public.listings;
drop policy if exists "Owners can delete listings" on public.listings;
create policy "Anyone can view listings" on public.listings for select using (true);
create policy "Users can create listings" on public.listings for insert with check (auth.uid() = owner_id);
create policy "Owners can update listings" on public.listings for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "Owners can delete listings" on public.listings for delete using (auth.uid() = owner_id);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  participant_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (listing_id, participant_id)
);

alter table public.conversations enable row level security;
drop policy if exists "Participants can view conversations" on public.conversations;
drop policy if exists "Participants can create conversations" on public.conversations;
create policy "Participants can view conversations" on public.conversations for select using (auth.uid() in (owner_id, participant_id));
create policy "Participants can create conversations" on public.conversations for insert with check (auth.uid() in (owner_id, participant_id));

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;
drop policy if exists "Participants can view messages" on public.messages;
drop policy if exists "Participants can send messages" on public.messages;
create policy "Participants can view messages" on public.messages for select using (
  exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.owner_id, c.participant_id))
);
create policy "Participants can send messages" on public.messages for insert with check (
  auth.uid() = sender_id and exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.owner_id, c.participant_id))
);
