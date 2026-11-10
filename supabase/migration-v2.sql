-- =====================================================================
-- ReCircle — migration v2 (pre-launch hardening)
-- Run ONCE in Supabase → SQL Editor, AFTER schema.sql.
-- Everything is in one transaction: if any line fails, nothing changes.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- 0. Clean up test data that the new rules would reject
-- ---------------------------------------------------------------------
-- Old base64 photos are dropped (they will be re-uploaded to Storage).
update public.listings
   set image = null
 where image is not null
   and image not like 'https://axcpgigdwmhumvcuiqoy.supabase.co/storage/v1/object/public/listing-images/%';

-- ---------------------------------------------------------------------
-- 1. PROFILES — remove exact location, limit text, lock the admin role
-- ---------------------------------------------------------------------
-- Your own location now stays in your browser only (it is only used to
-- calculate distances). This also removes the Bengaluru default bug.
alter table public.profiles drop column if exists lat;
alter table public.profiles drop column if exists lng;

alter table public.profiles
  add constraint profiles_name_len  check (char_length(display_name) between 1 and 40) not valid,
  add constraint profiles_place_len check (char_length(place) <= 60) not valid;

-- Signup trigger: never create an empty or over-long name
-- (a blank "Name" field or a long email would otherwise break signup).
create or replace function public.create_profile_for_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
                                nullif(split_part(new.email, '@', 1), ''),
                                'ReCircle user'), 40));
  return new;
end;
$$;

-- Nobody can make themselves admin through the website/API.
-- (You can still set it from the SQL Editor, which runs as "postgres".)
create or replace function public.protect_profile_role()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('anon', 'authenticated')
     and new.role = 'admin'
     and (tg_op = 'INSERT' or old.role is distinct from 'admin') then
    raise exception 'You are not allowed to set this role';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
  before insert or update on public.profiles
  for each row execute function public.protect_profile_role();

-- ---------------------------------------------------------------------
-- 2. LISTINGS — thumbnails, validation, approximate location, limits
-- ---------------------------------------------------------------------
alter table public.listings add column if not exists thumb text;

alter table public.listings
  add constraint listings_title_len     check (char_length(title) between 3 and 70) not valid,
  add constraint listings_desc_len      check (char_length(description) <= 500) not valid,
  add constraint listings_place_len     check (char_length(place) <= 60) not valid,
  add constraint listings_condition_len check (char_length(condition) <= 40) not valid,
  add constraint listings_unit_ok       check (unit in ('pieces','kg','bags','items','sacks','kg/day')) not valid,
  add constraint listings_category_ok   check (category in ('paper','plastic','ewaste','metal','glass',
                                                            'textile','wood','organic','construction','other')) not valid,
  add constraint listings_numbers_ok    check (qty > 0 and qty <= 100000
                                               and weight_kg > 0 and weight_kg <= 10000
                                               and price >= 0 and price <= 1000000) not valid,
  add constraint listings_latlng_ok     check (lat between -90 and 90 and lng between -180 and 180) not valid,
  add constraint listings_image_ok      check (image is null or image like
    'https://axcpgigdwmhumvcuiqoy.supabase.co/storage/v1/object/public/listing-images/%') not valid,
  add constraint listings_thumb_ok      check (thumb is null or thumb like
    'https://axcpgigdwmhumvcuiqoy.supabase.co/storage/v1/object/public/listing-images/%') not valid;

-- Store only an approximate pickup point (3 decimals ≈ 110 m).
create or replace function public.round_listing_location()
returns trigger language plpgsql set search_path = public as $$
begin
  new.lat := round(new.lat::numeric, 3);
  new.lng := round(new.lng::numeric, 3);
  return new;
end;
$$;

drop trigger if exists listings_round_location on public.listings;
create trigger listings_round_location
  before insert or update of lat, lng on public.listings
  for each row execute function public.round_listing_location();

-- Max 20 active listings per user and max 10 new listings per hour.
create or replace function public.enforce_listing_limits()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.listings
       where owner_id = new.owner_id and status <> 'exchanged') >= 20 then
    raise exception 'You can have at most 20 active listings';
  end if;
  if (select count(*) from public.listings
       where owner_id = new.owner_id and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many new listings in the last hour. Please try again later';
  end if;
  return new;
end;
$$;

drop trigger if exists listings_limits on public.listings;
create trigger listings_limits
  before insert on public.listings
  for each row execute function public.enforce_listing_limits();

create index if not exists listings_owner_created_idx  on public.listings (owner_id, created_at);
create index if not exists listings_status_created_idx on public.listings (status, created_at desc);

-- ---------------------------------------------------------------------
-- 3. CONVERSATIONS — only the buyer can open a chat with the real owner,
--    read-state for unread badges, daily cap
-- ---------------------------------------------------------------------
drop policy if exists "Participants can create conversations" on public.conversations;
drop policy if exists "Buyers can start conversations" on public.conversations;
create policy "Buyers can start conversations" on public.conversations
  for insert to authenticated
  with check (
    auth.uid() = participant_id
    and participant_id <> owner_id
    and owner_id = (select l.owner_id from public.listings l
                     where l.id = listing_id and l.status <> 'exchanged')
  );

alter table public.conversations
  add column if not exists owner_read_at       timestamptz not null default now(),
  add column if not exists participant_read_at timestamptz not null default now(),
  add column if not exists owner_confirmed_at   timestamptz,
  add column if not exists participant_confirmed_at timestamptz;

create or replace function public.mark_conversation_read(p_conversation uuid)
returns void language sql security definer set search_path = public as $$
  update public.conversations
     set owner_read_at       = case when auth.uid() = owner_id       then now() else owner_read_at end,
         participant_read_at = case when auth.uid() = participant_id then now() else participant_read_at end
   where id = p_conversation
     and auth.uid() in (owner_id, participant_id);
$$;

create or replace function public.enforce_conversation_limits()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.conversations
       where participant_id = new.participant_id
         and created_at > now() - interval '1 day') >= 30 then
    raise exception 'Daily limit for new conversations reached';
  end if;
  return new;
end;
$$;

drop trigger if exists conversations_limits on public.conversations;
create trigger conversations_limits
  before insert on public.conversations
  for each row execute function public.enforce_conversation_limits();

create index if not exists conversations_owner_idx       on public.conversations (owner_id);
create index if not exists conversations_participant_idx on public.conversations (participant_id, created_at);

-- ---------------------------------------------------------------------
-- 4. MESSAGES — length limit, rate limit, real-time
-- ---------------------------------------------------------------------
alter table public.messages
  add constraint messages_body_len check (char_length(body) between 1 and 1000) not valid;

create or replace function public.enforce_message_limits()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.messages
       where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'You are sending messages too fast. Please wait a moment';
  end if;
  if (select count(*) from public.messages
       where sender_id = new.sender_id and created_at > now() - interval '1 day') >= 500 then
    raise exception 'Daily message limit reached';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_limits on public.messages;
create trigger messages_limits
  before insert on public.messages
  for each row execute function public.enforce_message_limits();

create index if not exists messages_conversation_created_idx on public.messages (conversation_id, created_at);
create index if not exists messages_sender_created_idx       on public.messages (sender_id, created_at);

do $$
begin
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime'
                    and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. EXCHANGES — shared history + impact dashboard
-- ---------------------------------------------------------------------
create table if not exists public.exchanges (
  id              uuid primary key default gen_random_uuid(),
  listing_id      uuid unique references public.listings(id)      on delete set null,
  conversation_id uuid        references public.conversations(id) on delete set null,
  title           text not null,
  category        text not null,
  weight_kg       numeric not null check (weight_kg > 0 and weight_kg <= 10000),
  from_id         uuid references public.profiles(id) on delete set null,
  to_id           uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

alter table public.exchanges enable row level security;
drop policy if exists "Exchanges are public" on public.exchanges;
create policy "Exchanges are public" on public.exchanges for select using (true);
-- No insert/update/delete policies: only complete_exchange() below can write.

create index if not exists exchanges_created_idx on public.exchanges (created_at desc);

-- Both participants confirm the hand-off. The second confirmation completes it.
drop function if exists public.complete_exchange(uuid);
create or replace function public.complete_exchange(p_conversation uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c public.conversations%rowtype;
  l public.listings%rowtype;
  r public.exchanges%rowtype;
  confirmed_at timestamptz := now();
begin
  select * into c from public.conversations where id = p_conversation for update;
  if not found or auth.uid() not in (c.owner_id, c.participant_id) then
    raise exception 'Only conversation participants can confirm the exchange';
  end if;

  select * into l from public.listings where id = c.listing_id for update;
  if not found then
    raise exception 'Listing not found';
  end if;
  if l.status = 'exchanged' then
    raise exception 'This listing is already marked as exchanged';
  end if;

  update public.conversations
     set owner_confirmed_at = case when auth.uid() = owner_id then confirmed_at else owner_confirmed_at end,
         participant_confirmed_at = case when auth.uid() = participant_id then confirmed_at else participant_confirmed_at end
   where id = c.id
   returning * into c;

  if c.owner_confirmed_at is null or c.participant_confirmed_at is null then
    return jsonb_build_object(
      'completed', false,
      'confirmed_at', confirmed_at,
      'listing_id', l.id
    );
  end if;

  update public.listings set status = 'exchanged' where id = l.id;

  insert into public.exchanges (listing_id, conversation_id, title, category, weight_kg, from_id, to_id)
  values (l.id, c.id, l.title, l.category, l.weight_kg,
          case when l.kind = 'offer' then c.owner_id else c.participant_id end,
          case when l.kind = 'offer' then c.participant_id else c.owner_id end)
  returning * into r;

  return jsonb_build_object(
    'completed', true,
    'confirmed_at', confirmed_at,
    'listing_id', l.id,
    'exchange_id', r.id
  );
end;
$$;

do $$
begin
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime'
                    and schemaname = 'public' and tablename = 'conversations') then
    alter publication supabase_realtime add table public.conversations;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. REPORTS — "Report listing" button (only you see them: Table Editor → reports)
-- ---------------------------------------------------------------------
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  listing_id  uuid references public.listings(id) on delete cascade,
  reason      text not null check (char_length(reason) between 3 and 300),
  created_at  timestamptz not null default now(),
  unique (reporter_id, listing_id)
);

alter table public.reports enable row level security;
drop policy if exists "Users can file reports" on public.reports;
create policy "Users can file reports" on public.reports
  for insert to authenticated with check (reporter_id = auth.uid());

-- ---------------------------------------------------------------------
-- 7. STORAGE — bucket for listing photos (max 300 KB, JPEG only)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-images', 'listing-images', true, 307200, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Counts how many photo files the current user has (max 40 = 20 listings × 2 files).
create or replace function public.my_listing_image_count()
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from storage.objects
   where bucket_id = 'listing-images'
     and (storage.foldername(name))[1] = auth.uid()::text;
$$;

drop policy if exists "ReCircle: upload own listing images" on storage.objects;
create policy "ReCircle: upload own listing images" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.my_listing_image_count() < 40
  );

drop policy if exists "ReCircle: see own listing image files" on storage.objects;
create policy "ReCircle: see own listing image files" on storage.objects
  for select to authenticated
  using (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "ReCircle: delete own listing images" on storage.objects;
create policy "ReCircle: delete own listing images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------
-- 8. ACCOUNT DELETION — removes the user and (via cascades) their
--    profile, listings, conversations, messages and reports.
--    Exchanges stay for the impact totals but lose the name (set null).
-- ---------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------
-- 9. Who may call the functions
-- ---------------------------------------------------------------------
revoke execute on function public.complete_exchange(uuid)      from public, anon;
revoke execute on function public.mark_conversation_read(uuid) from public, anon;
revoke execute on function public.delete_my_account()          from public, anon;
revoke execute on function public.my_listing_image_count()     from public, anon;
grant  execute on function public.complete_exchange(uuid)      to authenticated;
grant  execute on function public.mark_conversation_read(uuid) to authenticated;
grant  execute on function public.delete_my_account()          to authenticated;
grant  execute on function public.my_listing_image_count()     to authenticated;

commit;
