-- Keep bidding callable from authenticated clients while leaving row authorization
-- under grants and RLS rather than bypassing them with SECURITY DEFINER.
grant insert on public.bids to authenticated;
alter function public.place_bid(uuid, integer) security invoker;
