# Irish Course Invitational privacy-first cutover

The current live website remains on `main`. A privacy-ready front-end is staged on the `privacy-cutover` branch and must not be merged until the Edge Function is deployed and its secrets are configured. Do not run the SQL migration before the front end is switched to the Edge Function, or the existing client will lose database access.

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
5. The updated front end is staged in the `privacy-cutover` branch / pull request. Once the Edge Function and secrets are tested, merge that branch to `main`, then immediately take a database backup and run `supabase-privacy-migration.sql` in **SQL Editor**. This migration preserves scores and handicaps, removes old access-code fields from stored JSON, and revokes anonymous table access.
6. Test on two phones: unauthorized visitors should not see scores; each group can update its own scores only; another group's scores and all handicaps stay unchanged; admin can edit handicaps and reset scores only.

## Important
This is a staged privacy cutover, not yet active on the public website. Until the pull request is merged and the SQL migration is run, the live `main` website still uses the legacy public-access pattern. Do not run the SQL migration early, because that would break live scoring.
