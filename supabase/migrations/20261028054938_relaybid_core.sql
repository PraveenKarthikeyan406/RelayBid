create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Campus member' check (char_length(display_name) between 1 and 60),
  created_at timestamptz not null default now()
);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete restrict,
  title text not null check (char_length(title) between 1 and 90),
  category text not null check (category in ('Cycles', 'Electronics', 'Books', 'Sports', 'Furniture', 'Other')),
  condition text not null check (condition in ('Like new', 'Good', 'Fair')),
  description text not null check (char_length(description) between 1 and 500),
  emoji text not null default '📦',
  image_url text,
  start_price integer not null check (start_price > 0),
  bid_increment integer not null check (bid_increment > 0),
  closes_at timestamptz not null,
  status text not null default 'live' check (status in ('live', 'pending', 'reserved', 'unsold', 'rejected', 'cancelled', 'failed_pickup', 'sold')),
  created_at timestamptz not null default now()
);

create table public.bids (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  bidder_id uuid not null references public.profiles (id) on delete restrict,
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now()
);

create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create index listings_live_closes_at_idx on public.listings (closes_at) where status = 'live';
create index listings_seller_id_idx on public.listings (seller_id, created_at desc);
create index bids_listing_created_idx on public.bids (listing_id, created_at desc);
create index bids_bidder_id_idx on public.bids (bidder_id, created_at desc);
create index favorites_listing_id_idx on public.favorites (listing_id);

alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.bids enable row level security;
alter table public.favorites enable row level security;

revoke all on public.profiles, public.listings, public.bids, public.favorites from anon, authenticated;
grant select on public.profiles, public.listings, public.bids, public.favorites to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant insert (seller_id, title, category, condition, description, emoji, image_url, start_price, bid_increment, closes_at)
  on public.listings to authenticated;
grant update (title, category, condition, description, emoji, image_url, start_price, bid_increment, closes_at)
  on public.listings to authenticated;
grant insert, delete on public.favorites to authenticated;

create policy "Signed-in students can read display profiles"
  on public.profiles for select to authenticated using (true);
create policy "Students can update their own display profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Signed-in students can browse listings"
  on public.listings for select to authenticated using (true);
create policy "Students can create their own listings"
  on public.listings for insert to authenticated
  with check ((select auth.uid()) = seller_id);
create policy "Students can edit their own listings before bidding"
  on public.listings for update to authenticated
  using (
    (select auth.uid()) = seller_id
    and not exists (select 1 from public.bids where bids.listing_id = listings.id)
  )
  with check ((select auth.uid()) = seller_id);

create policy "Signed-in students can read public bid history"
  on public.bids for select to authenticated using (true);
create policy "Students can submit bids as themselves"
  on public.bids for insert to authenticated
  with check ((select auth.uid()) = bidder_id);

create policy "Students can read their own favorites"
  on public.favorites for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Students can save favorites for themselves"
  on public.favorites for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Students can remove their own favorites"
  on public.favorites for delete to authenticated
  using ((select auth.uid()) = user_id);

create or replace function private.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Campus member'
    )
  );
  return new;
end;
$$;

revoke all on function private.create_profile_for_auth_user() from public, anon, authenticated;
create trigger on_auth_user_created_create_profile
  after insert on auth.users
  for each row execute function private.create_profile_for_auth_user();

create or replace function private.validate_new_bid()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  listing public.listings%rowtype;
  leading_amount integer;
  minimum_amount integer;
begin
  select * into listing
  from public.listings
  where id = new.listing_id
  for update;

  if not found then
    raise exception 'Listing not found.';
  end if;
  if listing.status <> 'live' or listing.closes_at <= now() then
    raise exception 'This auction is closed.';
  end if;
  if listing.seller_id = (select auth.uid()) then
    raise exception 'You cannot bid on your own listing.';
  end if;

  select max(amount) into leading_amount
  from public.bids
  where listing_id = new.listing_id;

  minimum_amount := coalesce(leading_amount + listing.bid_increment, listing.start_price);
  if new.amount < minimum_amount then
    raise exception 'Your bid must be at least %.', minimum_amount;
  end if;

  return new;
end;
$$;

revoke all on function private.validate_new_bid() from public, anon, authenticated;
create trigger validate_bid_before_insert
  before insert on public.bids
  for each row execute function private.validate_new_bid();

create or replace function public.place_bid(p_listing_id uuid, p_amount integer)
returns public.bids
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  listing public.listings%rowtype;
  leading_amount integer;
  minimum_amount integer;
  created_bid public.bids%rowtype;
begin
  if current_user_id is null then
    raise exception 'Sign in before placing a bid.';
  end if;

  select * into listing
  from public.listings
  where id = p_listing_id
  for update;

  if not found then
    raise exception 'Listing not found.';
  end if;
  if listing.status <> 'live' or listing.closes_at <= now() then
    raise exception 'This auction is closed.';
  end if;
  if listing.seller_id = current_user_id then
    raise exception 'You cannot bid on your own listing.';
  end if;

  select max(amount) into leading_amount
  from public.bids
  where listing_id = p_listing_id;

  minimum_amount := coalesce(leading_amount + listing.bid_increment, listing.start_price);
  if p_amount is null or p_amount < minimum_amount then
    raise exception 'Your bid must be at least %.', minimum_amount;
  end if;

  insert into public.bids (listing_id, bidder_id, amount)
  values (p_listing_id, current_user_id, p_amount)
  returning * into created_bid;

  return created_bid;
end;
$$;

revoke all on function public.place_bid(uuid, integer) from public, anon;
grant execute on function public.place_bid(uuid, integer) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-photos', 'listing-photos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Anyone can view public listing photos"
  on storage.objects for select using (bucket_id = 'listing-photos');
create policy "Students can upload photos into their own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Students can update their own listing photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Students can delete their own listing photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'listings'
    ) then
      alter publication supabase_realtime add table public.listings;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bids'
    ) then
      alter publication supabase_realtime add table public.bids;
    end if;
  end if;
end;
$$;
