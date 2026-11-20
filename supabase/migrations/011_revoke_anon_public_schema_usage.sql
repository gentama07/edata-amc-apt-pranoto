-- The application uses Supabase Auth before accessing the public API. Keep the
-- exposed public schema available only to authenticated sessions.
revoke usage on schema public from public, anon;
grant usage on schema public to authenticated;
