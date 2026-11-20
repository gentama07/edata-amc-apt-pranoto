<!-- antislop:start -->
## antislop
For UI, copy, people, mobile layout, or code comments work, read these installed skill files directly (use these paths even if a same-named global skill exists):
- Core filter, always on: `antislop`: `.codex/skills/antislop/SKILL.md`
- UI / visual: `antislop-ui`: `.codex/skills/antislop-ui/SKILL.md`
- Copy & text: `antislop-copywriting`: `.codex/skills/antislop-copywriting/SKILL.md`
- People: `antislop-human`: `.codex/skills/antislop-human/SKILL.md`
- Mobile / responsive: `antislop-layoutmobile`: `.codex/skills/antislop-layoutmobile/SKILL.md`
- Code comments: `antislop-code`: `.codex/skills/antislop-code/SKILL.md`
Before starting, follow the core's "Two Usage Modes" section in strict order: explicit session instruction first, then global preference, then ask. A session instruction always wins. For a resolved mode, say `antislop active: <mode> (session override).` or `antislop active: <mode> (global preference).` once before presenting findings or making edits, using the actual mode and source. Acknowledging the user's request without naming the source does not replace this notice.
Only an explicit choice of antislop during or after selects a session mode. A request to review, audit, or avoid file edits does not select a mode; read the global preference in that case. Another skill's mode does not select antislop's mode.
If the mode is unresolved, ask during/after and end the response; wait for the answer before any UI review, planning, or concept. For read-only tasks, put the active-mode notice only at the start of the final answer, never in progress messages. For editing tasks, announce before the first edit and omit it from the final answer.
To update antislop later: `npx antislop-ai --update`, or run `npx antislop-ai` and pick Overwrite them.
<!-- antislop:end -->

## Security baseline — required for every feature change

Before changing code or schema, trace the data flow from the browser to its server/database/storage boundary and identify who may read, create, update, and delete each value. Apply the least privilege needed and add checks at the trusted boundary; UI hiding and client-side validation are not authorization.

- **Supabase data:** every exposed table must have RLS enabled and role-specific policies. Explicitly revoke broad `PUBLIC`, `anon`, and `authenticated` table/sequence/function grants, then grant only the exact operations/columns the client uses. Review default privileges for newly created objects. Never grant `TRUNCATE` to browser roles. Keep sensitive workflows behind authenticated Edge Functions or narrowly scoped RPCs.
- **Authorization:** derive identity from a verified access token and load trusted role/active state from `profiles`; never trust user metadata, request-supplied role, account ID, organization, or hidden UI controls. Admin/service-role operations must re-check active admin status server-side. Keep service-role/provider secrets out of `VITE_` variables, browser responses, URLs, logs, and Git.
- **Edge Functions:** require gateway JWT validation for signed-in functions and validate it again when elevated service-role work occurs. Keep the intentionally public account-recovery endpoint rate-limited, generic about whether an account exists, and strictly limited to its documented actions. Validate HTTP method, origin/CORS, body shape/size, identifiers, file content and type; return safe errors without secrets or provider internals.
- Enforce request-size limits while reading the stream, before parsing JSON or multipart bodies; do not rely only on `Content-Length`. Trust only platform-injected client-IP headers for abuse controls, and keep raw request payloads, provider errors, and exception messages out of logs and responses.
- Check trusted `profiles.active` and role state at every privileged server boundary, even when the UI hides the feature. Validate externally navigated URLs against the exact HTTPS host allowlist before rendering them as links.
- **Files and media:** static files under `public/` are public to anyone. Do not place private records, user uploads, credentials, or identifying metadata there. Use private Storage buckets, RLS scoped to owner/recipient, size/MIME/extension checks, and server-side content signature checks for uploads. Review external links, SVG active content, video/image metadata, and alt text.
- **Frontend:** render untrusted content as text; avoid HTML injection, arbitrary URL navigation, and uncontrolled embeds. Maintain the restrictive CSP in `index.html` when adding a new external host, script, iframe, font, or media source; add only the required source.
- **Required before merge/deploy:** inspect the resulting diff and secrets; run `npm run security:audit`, `npm run lint`, `npm test`, and `npm run build`; inspect Supabase security advisors after database changes and verify the resulting grants/RLS/policies. Add regression coverage for changed authorization and input-validation behavior. Report unresolved findings and any configuration that requires the Supabase/GitHub dashboard.
