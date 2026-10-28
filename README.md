# RelayBid

RelayBid is a campus auction where graduating seniors pass useful things on to juniors, who can bid for a new-to-them home for the next semester.

## Start locally

Requires Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Included in this first pass

- Browse sample auctions, search by keyword, filter by category, condition and price, and sort by closing time or bid activity.
- Open an auction to see its description, countdown, current bid, and public bid history.
- Place bids with the starting-price and minimum-increment checks; valid bids in the final 30 seconds extend the auction by 60 seconds.
- Create, edit (before the first bid), and cancel listings, including an optional item photo.
- Close auctions in the browser, mark no-bid auctions unsold, approve or reject a leading bid, and record confirmed or failed pickup.
- Save items and enable browser notifications.

## Current prototype boundary

This pass is a single-browser prototype. Sample data and changes live in that browser’s `localStorage`; the sign-in, student identity, seller, and other bidders are illustrative. It is useful for reviewing the main screens and interaction flow, but it is not a multi-user auction service. Client-side bid checks are not authoritative and must not be used for a real auction.

The next implementation step is to connect Supabase Auth, PostgreSQL, Storage, and Realtime; move bid validation and closing into trusted transactional server/database operations; and replace the sample identities with verified campus accounts. Browser notification permission is supported here, but durable cross-device push delivery needs a server-side subscription and notification worker.
