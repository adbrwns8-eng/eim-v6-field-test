# BOS B23 saved onboarding pilot

This additive pilot implements two training records from the uploaded Borland and JK Farms packets: site-specific hazard awareness and First Aid CPR AED awareness. It records actual training delivery; it does not supply site-specific instruction, issue official certificates, or authorize work. The other nine safety forms, HR intake, separate trainer/certifier assignment, and renewal notifications are not enabled here.

## Implemented flow

An existing pilot manager signs in at `onboarding-pilot.html`, selects an existing active employee, creates a saved draft, selects the site, and enters actual training dates and subject minutes. Save and resume are supported. Submitting freezes a canonical content snapshot and SHA-256 hash. The assigned trainer and employee each sign in separately and draw their signature. Each signature binds its signer, timestamp, revision and content hash. Both signatures are required before manager review. The manager reviews and approves; the record can be retrieved and printed. Retrying creation, signing and approval does not duplicate their results. A submitted record cannot be edited; corrections require a future revision workflow, not silent replacement.

## Test authentication boundary

Existing pilot PINs remain the first credential for this test. The server verifies each PIN, issues a random eight-hour bearer session, stores only its hash, checks the current employee's active status and manager role on requests, and revokes the session on sign-out. PINs do not enter URLs. The browser cannot select its own signer identity or grant itself a role. Logins have persisted network, credential and global throttles. The service key stays inside the Edge Function. All new data is under `b23_private`, with RLS enabled and no anonymous/authenticated direct access. The exposed `b23_onboarding` SQL entry point uses SECURITY INVOKER and can be executed only by `service_role`.

These controls do not repair the legacy V6 API or make short PINs suitable for production personnel records. Use sample signatures and test records only. Production rollout requires stronger credentials, authorized trainer mapping, role/access review and remediation of the legacy anonymous SECURITY DEFINER RPCs and unprotected tables. Existing V6 tables, RPCs, users and PINs are not modified by this pilot.

## Installation

Apply `supabase/migrations/b23_onboarding_pilot.sql` once to the existing EIM test project. It creates a new schema, four private tables and one service-only entry point in a transaction when applied by the migration tool. Do not overwrite an existing installed schema on a retry; verify whether the first application succeeded.

Deploy `supabase/functions/b23-onboarding/index.ts` as `b23-onboarding`. The function does its own bearer-session verification, so its platform `verify_jwt` setting is false. Allow only `https://adbrwns8-eng.github.io` for browser origins. No new external service secret is needed: Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the function environment.

Publish the three `onboarding-pilot.*` frontend files to the existing Pages site only after the migration and function have been verified. The existing home page is unchanged; use the separate onboarding URL for this first test. Do not present a published frontend as working before its backend is installed.

## Validation

Run `npm ci`, then `npm test` with Node 24 or later. The database tests use embedded PostgreSQL and exercise service-role access, denied anonymous access, employee isolation, signer identity, edit locks, duplicate retries, required signatures, approval permissions, session expiry and login throttles. Local pgcrypto stand-ins test flow and permissions; production cryptographic primitives must be verified separately on Supabase. The DOM integration test routes the actual Edge handler to that local PostgreSQL instance and exercises separate sign-ins, draft resume, signatures, approval and reload persistence. Canvas rendering is mocked in that test.

The additional `npm run test:browser` suite requires `npx playwright install chromium` (or a working executable provided in `BOS_BROWSER_EXECUTABLE`). It checks real drawing and mobile/desktop layout. In the authoring environment the standard download failed and an alternate Chromium binary crashed, so this browser suite has not passed. These local tests do not establish deployed end-to-end validation.

No email or SMS is sent. The 30-, 15-, 5-day and 24-hour renewal reminders remain planned work and require record-specific renewal rules and routing.
