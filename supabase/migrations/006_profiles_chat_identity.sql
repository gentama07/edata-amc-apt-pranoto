-- Add profile identity fields and preserve the real sender name in chat threads.
alter table public.profiles
  add column if not exists nip text,
  add column if not exists avatar_url text;

alter table public.correspondence_messages
  add column if not exists sender_name text;

update public.correspondence_messages m
set sender_name = coalesce(nullif(p.display_name, ''), p.email, 'Petugas AMC')
from public.profiles p
where p.id = m.sender_id and m.sender_name is null;

update public.correspondence_messages
set sender_name = 'Petugas AMC'
where sender_name is null;

alter table public.correspondence_messages
  alter column sender_name set default 'Petugas AMC',
  alter column sender_name set not null;

create or replace function public.set_correspondence_sender_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.sender_id := auth.uid();
  select coalesce(nullif(display_name, ''), email, 'Petugas AMC')
  into new.sender_name
  from public.profiles
  where id = auth.uid() and active = true;
  if new.sender_name is null then
    raise exception 'Akun aktif tidak ditemukan.';
  end if;
  return new;
end;
$$;

drop trigger if exists correspondence_messages_set_sender on public.correspondence_messages;
create trigger correspondence_messages_set_sender
before insert on public.correspondence_messages
for each row execute function public.set_correspondence_sender_name();

revoke update on public.profiles from authenticated;
grant update (display_name, nip, avatar_url) on public.profiles to authenticated;
grant select (id, display_name, email, role, active, organization, nip, avatar_url) on public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-avatars', 'profile-avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "users read own profile photo" on storage.objects;
create policy "users read own profile photo" on storage.objects
for select to authenticated using (
  bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users upload own profile photo" on storage.objects;
create policy "users upload own profile photo" on storage.objects
for insert to authenticated with check (
  bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users delete own profile photo" on storage.objects;
create policy "users delete own profile photo" on storage.objects
for delete to authenticated using (
  bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text
);

