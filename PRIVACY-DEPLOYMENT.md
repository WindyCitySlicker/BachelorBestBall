# Irish Course Invitational privacy-first cutover

The current website remains live until the secure backend is deployed and tested. Do not run the SQL migration before the Edge Function is deployed/configured, or the existing client will lose database access.

## What this change prepares
- Access codes move into Supabase Edge Function secrets rather than browser JavaScript.
- An invitee must verify a foursome code or admin code to receive a random 12-hour session token.
- Tokens are stored hashed in a server-only table.
- The service endpoint returns the leaderboard only after session verification.
- Foursome sessions may update only their own group's scores; admin sessions can edit roster/handicaps and reset scores.
- The reset endpoint clears scores and scoring activity only; it preserves player names, handicaps, and course settings.
- Anonymous browser access to the tournament row is revoked by the migration.
- The API uses polling/client requests, so it must be wired into the front end before revoking old database policies. The current front end still uses the legacy direct Supabase client; do not run the migration yet.

## Supabase Dashboard steps
1. In Supabase, open **Edge Functions** and create a function named `tournament-api`.
2. Copy `supabase/functions/tournament-api/index.ts` into its editor and deploy it.
3. Open the function's **Secrets** settings and add:
   - `FOURSOME_1_CODE` = the new code for Foursome 1
   - `FOURSOME_2_CODE` = the new code for Foursome 2
   - `FOURSOME_3_CODE` = the new code for Foursome 3
   - `ADMIN_CODE` = a new, strong admin code
   Use new codes rather than reusing the old browser-exposed codes.
4. Test the function's `verify` action with each code before changing database policies. Do not share service-role keys or put them in website code.
5. Only after the front end has been switched to this API, take a database backup and run `supabase-privacy-migration.sql` in **SQL Editor**.
6. Test on two phones: unauthorized visitors should not see scores; each group can update its own scores only; another group's scores and all handicaps stay unchanged; admin can edit handicaps and reset scores only.

## Important
This is a prepared backend, not an activated privacy cutover. The current website is still using its old public-access pattern until the front end is connected to the function and the migration is run. Do not run the SQL migration early, because that would break live scoring.
