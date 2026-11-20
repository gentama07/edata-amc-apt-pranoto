-- Remove Supabase's broad default grants from browser roles and restore only
-- the operations used by this application. RLS remains the row-level boundary.

revoke create on schema public from public, anon, authenticated;
revoke usage on schema public from anon;
grant usage on schema public to authenticated;

alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant select (id, display_name, email, role, active, organization, nip, position, avatar_url)
  on public.profiles to authenticated;
grant update (display_name, nip, position, avatar_url)
  on public.profiles to authenticated;

grant select, insert, update, delete on public.movements to authenticated;
grant select, insert, update, delete on public.incoming_letters to authenticated;
grant select, insert (letter_id, body) on public.correspondence_messages to authenticated;
grant select on public.support_messages to authenticated;
grant select on public.admin_notifications to authenticated;
grant update (read_at) on public.admin_notifications to authenticated;

grant execute on function public.is_amc_active() to authenticated;
grant execute on function public.is_amc_admin() to authenticated;
grant execute on function public.can_write_amc() to authenticated;
grant execute on function public.is_amc_internal() to authenticated;
grant execute on function public.can_read_correspondence(uuid) to authenticated;
grant execute on function public.can_reply_correspondence(uuid, uuid) to authenticated;
grant execute on function public.my_ground_handling_org() to authenticated;
grant execute on function public.submit_ground_handling_letter(text, date, text, text, text, text) to authenticated;
grant execute on function public.confirm_correspondence_complete(uuid) to authenticated;
grant execute on function public.claim_account_recovery_token(uuid, text) to service_role;

drop policy if exists "deny direct client access to account recovery requests" on public.account_recovery_requests;
create policy "deny direct client access to account recovery requests"
  on public.account_recovery_requests for all to anon, authenticated
  using (false) with check (false);
drop policy if exists "deny direct client access to account recovery attempts" on public.account_recovery_attempts;
create policy "deny direct client access to account recovery attempts"
  on public.account_recovery_attempts for all to anon, authenticated
  using (false) with check (false);

-- Storage clients need object operations only; bucket administration and
-- internal Storage metadata remain server-managed. Object RLS scopes access.
revoke all on all tables in schema storage from public, anon, authenticated;
grant select, insert, delete on storage.objects to authenticated;

update storage.buckets
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'profile-avatars';

update storage.buckets
set public = false,
    file_size_limit = 26214400,
    allowed_mime_types = array['video/mp4']
where id = 'airport-video';

drop policy if exists "users upload own profile photo" on storage.objects;
create policy "users upload own profile photo"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (
    (lower(storage.extension(name)) in ('jpg', 'jpeg') and metadata->>'mimetype' = 'image/jpeg')
    or (lower(storage.extension(name)) = 'png' and metadata->>'mimetype' = 'image/png')
    or (lower(storage.extension(name)) = 'webp' and metadata->>'mimetype' = 'image/webp')
  )
);

notify pgrst, 'reload schema';
