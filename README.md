# RelayBid

RelayBid is a campus auction where graduating seniors pass useful things on to juniors, who can bid for a new-to-them home for the next semester.

## Start locally

Requires Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Supabase connection

RelayBid is connected locally to the Supabase project. The project URL and publishable key are stored in the ignored `.env.local` file. To configure another checkout, copy `.env.example` to `.env.local` and add the project URL and publishable key. Never put a secret or service-role key in a `NEXT_PUBLIC_` variable.

The base schema and its two follow-up migrations have been applied to the project. The local migration files are:

- `supabase/migrations/20261028054938_relaybid_core.sql`
- `supabase/migrations/20261028055046_relaybid_invoker_bid_rpc.sql`
- `supabase/migrations/20261028055510_relaybid_listing_status_rules.sql`

To apply future local migrations, sign in and link the CLI to this project:

   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push --linked
   ```

Passwordless email sign-in is available at `/login`. Configure `http://localhost:3000/auth/callback` in the Supabase Auth redirect allow list. The campus email domain has not been supplied or enforced yet; add that restriction before opening sign-ups to students.

## Included in this first pass

- Browse shared auctions when Supabase is configured, or sample auctions in demo mode; search, filter and sort listings.
- Open an auction to see its description, countdown, current bid, and public bid history.
- Place bids with database-side starting-price, minimum-increment, auction-close and seller checks.
- Create and edit listings, upload listing photos, and save favorites.
- Close auctions, approve or reject leading bids, and record pickup outcomes.
- Receive shared listing and bid changes through Supabase Realtime; enable browser notifications.

## Current prototype boundary

Without Supabase environment variables, the app stays in browser-local demo mode. With them, users must sign in by email link and listings, bids, favorites, and photos use the shared Supabase project. Campus-domain enforcement still needs to be configured after the domain is confirmed. Browser notifications are device-local; cross-device push delivery needs a server-side subscription and notification worker.
