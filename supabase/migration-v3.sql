-- =====================================================================
-- ReCircle — migration v3 (exchange + account-deletion fixes)
-- Run ONCE in Supabase → SQL Editor, AFTER migration-v2.sql.
-- One transaction: if any line fails, nothing changes.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- 1. Keep chats when an account or listing is deleted
--    Before: deleting an account deleted every conversation it was in,
--    including the other person's messages.
--    Now: the conversation and all messages stay; the deleted side shows
--    as "Former member" and the chat becomes read-only.
-- ---------------------------------------------------------------------
alter table public.conversations alter column listing_id     drop not null;
alter table public.conversations alter column owner_id       drop not null;
alter table public.conversations alter column participant_id drop not null;
alter table public.messages      alter column sender_id      drop not null;

alter table public.conversations drop constraint if exists conversations_listing_id_fkey;
alter table public.conversations add  constraint conversations_listing_id_fkey
  foreign key (listing_id) references public.listings(id) on delete set null;

alter table public.conversations drop constraint if exists conversations_owner_id_fkey;
alter table public.conversations add  constraint conversations_owner_id_fkey
  foreign key (owner_id) references public.profiles(id) on delete set null;

alter table public.conversations drop constraint if exists conversations_participant_id_fkey;
alter table public.conversations add  constraint conversations_participant_id_fkey
  foreign key (participant_id) references public.profiles(id) on delete set null;

alter table public.messages drop constraint if exists messages_sender_id_fkey;
alter table public.messages add  constraint messages_sender_id_fkey
  foreign key (sender_id) references public.profiles(id) on delete set null;

-- No new messages in a closed chat (other person or listing deleted).
create or replace function public.enforce_message_limits()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c public.conversations%rowtype;
begin
  select * into c from public.conversations where id = new.conversation_id;
  if c.owner_id is null or c.participant_id is null or c.listing_id is null then
    raise exception 'This conversation is closed';
  end if;
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

-- ---------------------------------------------------------------------
-- 2. Listing lifecycle rules (website/API users only; the SQL Editor
--    and the complete_exchange() function are not restricted)
--    - status 'exchanged' can only be set by complete_exchange()
--    - an exchanged listing can't be reopened or edited
-- ---------------------------------------------------------------------
create or replace function public.protect_listing_lifecycle()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if old.status = 'exchanged' then
    raise exception 'This listing has been exchanged and can no longer be changed';
  end if;
  if new.status = 'exchanged' then
    raise exception 'Use "Confirm exchange" in the chat to mark a listing as exchanged';
  end if;
  return new;
end;
$$;

drop trigger if exists listings_protect_lifecycle on public.listings;
create trigger listings_protect_lifecycle
  before update on public.listings
  for each row execute function public.protect_listing_lifecycle();

-- If the owner changes what is being exchanged, pending confirmations
-- are cleared so both people confirm the new details.
create or replace function public.reset_confirmations_on_listing_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status <> 'exchanged'
     and (new.title is distinct from old.title
          or new.category is distinct from old.category
          or new.kind is distinct from old.kind
          or new.weight_kg is distinct from old.weight_kg
          or new.qty is distinct from old.qty
          or new.unit is distinct from old.unit) then
    update public.conversations
       set owner_confirmed_at = null, participant_confirmed_at = null
     where listing_id = new.id
       and (owner_confirmed_at is not null or participant_confirmed_at is not null);
  end if;
  return new;
end;
$$;

drop trigger if exists listings_reset_confirmations on public.listings;
create trigger listings_reset_confirmations
  after update on public.listings
  for each row execute function public.reset_confirmations_on_listing_change();

-- ---------------------------------------------------------------------
-- 3. complete_exchange() — safer version
-- ---------------------------------------------------------------------
create or replace function public.complete_exchange(p_conversation uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c public.conversations%rowtype;
  l public.listings%rowtype;
  r public.exchanges%rowtype;
begin
  select * into c from public.conversations where id = p_conversation for update;
  if not found or auth.uid() is null or auth.uid() not in (c.owner_id, c.participant_id) then
    raise exception 'Only the two people in this chat can confirm the exchange';
  end if;
  if c.owner_id is null or c.participant_id is null or c.listing_id is null then
    raise exception 'This conversation is closed';
  end if;

  select * into l from public.listings where id = c.listing_id for update;
  if not found then
    raise exception 'Listing not found';
  end if;
  if l.status = 'exchanged'
     or exists (select 1 from public.exchanges where listing_id = l.id) then
    raise exception 'This item has already been exchanged';
  end if;

  update public.conversations
     set owner_confirmed_at       = case when auth.uid() = owner_id       then coalesce(owner_confirmed_at, now())       else owner_confirmed_at end,
         participant_confirmed_at = case when auth.uid() = participant_id then coalesce(participant_confirmed_at, now()) else participant_confirmed_at end
   where id = c.id
   returning * into c;

  if c.owner_confirmed_at is null or c.participant_confirmed_at is null then
    return jsonb_build_object(
      'completed', false,
      'confirmed_at', now(),
      'listing_id', l.id,
      'owner_confirmed_at', c.owner_confirmed_at,
      'participant_confirmed_at', c.participant_confirmed_at);
  end if;

  update public.listings set status = 'exchanged' where id = l.id;

  insert into public.exchanges (listing_id, conversation_id, title, category, weight_kg, from_id, to_id)
  values (l.id, c.id, l.title, l.category, l.weight_kg,
          case when l.kind = 'offer' then c.owner_id else c.participant_id end,
          case when l.kind = 'offer' then c.participant_id else c.owner_id end)
  returning * into r;

  -- Other buyers' pending confirmations on this item are no longer valid.
  update public.conversations
     set owner_confirmed_at = null, participant_confirmed_at = null
   where listing_id = l.id and id <> c.id;

  return jsonb_build_object(
    'completed', true,
    'confirmed_at', now(),
    'listing_id', l.id,
    'exchange_id', r.id,
    'owner_confirmed_at', c.owner_confirmed_at,
    'participant_confirmed_at', c.participant_confirmed_at);
end;
$$;

-- Undo my confirmation (before the exchange is completed).
create or replace function public.withdraw_exchange_confirmation(p_conversation uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c public.conversations%rowtype;
  l public.listings%rowtype;
begin
  select * into c from public.conversations where id = p_conversation for update;
  if not found or auth.uid() is null or auth.uid() not in (c.owner_id, c.participant_id) then
    raise exception 'Only the two people in this chat can change the confirmation';
  end if;
  select * into l from public.listings where id = c.listing_id;
  if found and l.status = 'exchanged' then
    raise exception 'This item has already been exchanged';
  end if;

  update public.conversations
     set owner_confirmed_at       = case when auth.uid() = owner_id       then null else owner_confirmed_at end,
         participant_confirmed_at = case when auth.uid() = participant_id then null else participant_confirmed_at end
   where id = c.id
   returning * into c;

  return jsonb_build_object(
    'owner_confirmed_at', c.owner_confirmed_at,
    'participant_confirmed_at', c.participant_confirmed_at);
end;
$$;

revoke execute on function public.complete_exchange(uuid)              from public, anon;
revoke execute on function public.withdraw_exchange_confirmation(uuid) from public, anon;
grant  execute on function public.complete_exchange(uuid)              to authenticated;
grant  execute on function public.withdraw_exchange_confirmation(uuid) to authenticated;

-- Real-time updates for confirmations (needed by the chat page).
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
-- 4. Data clean-up
-- ---------------------------------------------------------------------
-- Listings that already have an exchange record go back to 'exchanged'.
update public.listings l
   set status = 'exchanged'
 where l.status <> 'exchanged'
   and exists (select 1 from public.exchanges e where e.listing_id = l.id);

-- Clear unfinished confirmations on items that are already exchanged
-- (keeps the confirmations of the chat that completed the exchange).
update public.conversations c
   set owner_confirmed_at = null, participant_confirmed_at = null
  from public.listings l
 where l.id = c.listing_id
   and l.status = 'exchanged'
   and not exists (select 1 from public.exchanges e where e.conversation_id = c.id)
   and (c.owner_confirmed_at is not null or c.participant_confirmed_at is not null);

commit;
