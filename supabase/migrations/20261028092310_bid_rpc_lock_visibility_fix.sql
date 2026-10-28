-- Let the bid validator lock the listing as the trusted table owner. Bidders
-- keep no UPDATE permission on listings; the lock remains protected by the
-- trigger and all bidder identity checks still use auth.uid().
alter function private.validate_new_bid() security definer;

-- The trigger takes the row lock and rechecks the live status and minimum bid.
-- The invoker RPC only reads the listing, which is allowed to every signed-in
-- student, before it inserts the bid and invokes that trusted validator.
create or replace function public.place_bid(p_listing_id uuid, p_amount integer)
returns public.bids
language plpgsql
security invoker
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
  where id = p_listing_id;

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
