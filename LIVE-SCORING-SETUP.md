# Irish Course Invitational — live scoring setup

## Recommended backend
Use **Supabase** for one shared tournament-state row and Realtime subscriptions. It fits a static GitHub Pages site and supports near-instant score updates across phones. Official docs: https://supabase.com/docs/guides/realtime/getting_started

## Set up on iPhone
1. Open https://supabase.com and create/sign in to an account. Create a project named `irish-course-invitational`.
2. Wait for the database to finish provisioning.
3. Open **SQL Editor** in the project dashboard, create a query, paste all of `supabase-setup.sql`, and run it.
4. Open **Project Settings → API** (or the project's Connect dialog). Copy the Project URL and the **publishable** key (usually starts with `sb_publishable_`). Never share a secret/service-role key.
5. Send those two values back in ChatGPT so they can be added to the website. They are public client config, not admin credentials; database policies still determine access.
6. Open the deployed website on each phone and use the same tournament link.

## Important current limitation
The SQL file prepares the database, but the website is **not connected until the project URL/key are added and the client integration is committed**. Do not treat the website as live-scoring-ready yet.

## Net-birdie alerts
Realtime can update the page and show in-page/browser notifications while the site is open and notification permission is granted. True push notifications when Safari is closed require a web push/PWA service worker and a server-side sender (for example, an Edge Function plus push subscription storage). iPhone web push generally requires adding the site to the Home Screen and enabling notifications. That is a second step after basic shared scoring works.

## Security note
This initial schema intentionally permits anonymous read/write access to the single tournament row so a no-login golf group can get started easily. Anyone who discovers the public website/backend could alter scores. For a real tournament, use a private room code enforced server-side or authenticated group membership before entering official scores. Do not put sensitive data in this table.
