grant update (status) on public.listings to authenticated;

drop policy if exists "Students can edit their own listings before bidding" on public.listings;
create policy "Students can update their own listings"
  on public.listings for update to authenticated
  using ((select auth.uid()) = seller_id)
  with check ((select auth.uid()) = seller_id);

create or replace function private.validate_listing_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  has_bids boolean;
  allowed_transition boolean := false;
begin
  if (select auth.uid()) is distinct from old.seller_id then
    raise exception 'Only the listing owner can update this listing.';
  end if;

  select exists (select 1 from public.bids where listing_id = old.id) into has_bids;

  if has_bids and (
    new.title is distinct from old.title
    or new.category is distinct from old.category
    or new.condition is distinct from old.condition
    or new.description is distinct from old.description
    or new.emoji is distinct from old.emoji
    or new.image_url is distinct from old.image_url
    or new.start_price is distinct from old.start_price
    or new.bid_increment is distinct from old.bid_increment
    or new.closes_at is distinct from old.closes_at
  ) then
    raise exception 'A listing cannot be edited after it receives a bid.';
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  if old.status = 'live' and new.status = 'pending' then
    allowed_transition := old.closes_at <= now() and has_bids;
  elsif old.status = 'live' and new.status = 'unsold' then
    allowed_transition := old.closes_at <= now() and not has_bids;
  elsif old.status = 'live' and new.status = 'cancelled' then
    allowed_transition := not has_bids;
  elsif old.status = 'pending' and new.status in ('reserved', 'rejected') then
    allowed_transition := has_bids;
  elsif old.status = 'reserved' and new.status in ('sold', 'failed_pickup') then
    allowed_transition := true;
  end if;

  if not allowed_transition then
    raise exception 'That auction status change is not allowed.';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_listing_update() from public, anon, authenticated;
create trigger validate_listing_update_before_save
  before update on public.listings
  for each row execute function private.validate_listing_update();
