# Security baseline and audit notes

## Scope

The landing page is a static GitHub Pages site. Browser code and files in `public/` are public. Supabase is the authority for user identity, roles, operational records, private files, and privileged workflows.

## Controls in this repository

- `AGENTS.md` contains the required security checklist for every feature change.
- The landing page uses a restrictive Content Security Policy and a strict referrer policy. Add a host only when a feature needs it.
- Database migration `010_security_privilege_hardening.sql` removes broad client/default grants and restores only app-required privileges; server-only tables remain inaccessible to browser roles.
- Signed-in Edge Functions require gateway JWT validation. Account recovery remains callable before sign-in and performs its own admin authentication for admin actions.
- The deploy workflow runs dependency audit, lint, tests, and build before publishing.
- Profile avatars are in a private bucket with a 5 MiB limit and image MIME allowlist. Airport video assets are private and selected by a narrow read policy. Files committed under `public/assets/` are intentionally public.

## Findings reviewed

- Supabase security advisor reported excessive default table, sequence, schema, and function privileges for `anon` and `authenticated`, plus client-executable `SECURITY DEFINER` functions. The migration revokes the broad grants, blocks browser schema creation, grants only required operations, and removes direct access to recovery tables. Role helpers needed by RLS and two validated authenticated RPCs remain available to signed-in users.
- Account-recovery tables intentionally have no client grants; service-role Edge Function access is required. Deny-all RLS policies make this explicit.
- Storage buckets are private. Avatar read/write/delete policies scope objects to the signed-in user's folder. The airport-video bucket permits only authenticated active users to read the two named videos.
- Public asset images inspected locally have no EXIF/GPS metadata. SVGs contain no script or active event handlers. The two MP4s are visual landing/login assets; they must remain non-sensitive because GitHub Pages serves them publicly.
- `npm audit` reported no known dependency vulnerabilities at the time of audit.

## Dashboard configuration still required

Supabase's security advisor reports leaked-password protection is disabled. Enable it in the Supabase Auth password security settings. This is project authentication configuration and cannot be safely switched through the available database migration tools.

GitHub Pages does not let this repository set response headers such as HSTS, `X-Content-Type-Options`, or `Permissions-Policy`. The HTML CSP/referrer meta policies provide browser-side protection, but response-header controls require a hosting proxy/CDN or a host that supports custom headers.

## Operational checks

Run `npm run security:audit`, `npm run lint`, `npm test`, and `npm run build`. After database changes, inspect Supabase security advisors and verify that anonymous clients cannot read/write app tables or execute privileged functions. Rotate any provider key that has appeared in a screenshot, URL, log, or chat before production use.

## Follow-up audit — 2026-11-20

- The live Supabase project was checked read-only. Application tables have RLS enabled; recovery tables deny direct browser access. Both `profile-avatars` and `airport-video` are private, with 5 MiB image and 25 MiB MP4 limits respectively. Public asset image files have no EXIF/GPS metadata, and the SVG scan found no script or active event handlers.
- Security improvements are prepared in the repository: shared streamed request-size validation for JSON and multipart endpoints, an active-account check and origin allowlist for flight tracking, generic support-chat errors, trusted-IP-only recovery throttling, reduced exception logging, and HTTPS Google Drive link validation. Regression tests cover malformed/oversized request bodies.
- The hardened Edge Functions are deployed and active: `flight-tracking` v19, `support-chat` v5, `manage-users` v10, `account-recovery` v12, `drive-sync` v11, and `drive` v10. Each uses the shared bounded-body reader where it accepts a request body; flight tracking now checks active-account status and uses an origin allowlist. The Aviationstack call remains paused.
- The live Supabase security advisor still reports leaked-password protection disabled and nine authenticated-callable `SECURITY DEFINER` functions. The latter include RLS helpers and two validated application RPCs; review their exposure and consider moving RLS-only helpers to a non-exposed schema before changing grants.
- An Aviationstack access key was visible in prior screenshots/URLs in the conversation. Rotate it in Aviationstack and update the Supabase secret before enabling provider calls again. Do not reuse the exposed key.
- Enable leaked-password protection in Supabase Auth password security settings. This dashboard setting is outside the repository and was not changed here.
- The Drive-link allowlist and the already-requested landing-page update are included in the pending GitHub Pages source publication. Confirm the Pages workflow completes before treating browser changes as live.
