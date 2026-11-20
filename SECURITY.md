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
