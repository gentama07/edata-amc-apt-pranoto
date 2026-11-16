-- Ground handling correspondence portal and real-time reply threads.
-- Existing letters and their Drive metadata remain intact.

alter table public.profiles add column if not exists organization text;

do $$
declare constraint_name text;
begin
  for constraint_name in
    select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.profiles add constraint profiles_role_check
  check (role in ('pimpinan', 'personel', 'admin', 'ground_handling'));

alter table public.incoming_letters
  add column if not exists direction text not null default 'inbound',
  add column if not exists requester_id uuid references auth.users(id) on delete set null,
  add column if not exists sender_organization text,
  add column if not exists reply_to_id uuid references public.incoming_letters(id) on delete cascade,
  add column if not exists drive_folder text;

do $$
declare constraint_name text;
begin
  for constraint_name in
    select conname from pg_constraint
    where conrelid = 'public.incoming_letters'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.incoming_letters drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.incoming_letters add constraint incoming_letters_status_check
  check (status in ('Baru', 'Dalam proses', 'Menunggu balasan', 'Dibalas', 'Selesai', 'Diarsipkan'));
alter table public.incoming_letters add constraint incoming_letters_direction_check
  check (direction in ('inbound', 'outbound'));

update public.incoming_letters
set requester_id = coalesce(requester_id, created_by),
    sender_organization = coalesce(sender_organization, sender)
where requester_id is null or sender_organization is null;

create index if not exists incoming_letters_requester_idx on public.incoming_letters (requester_id, received_date desc);
create index if not exists incoming_letters_reply_to_idx on public.incoming_letters (reply_to_id, created_at);

create table if not exists public.correspondence_messages (
  id uuid primary key default gen_random_uuid(),
  letter_id uuid not null references public.incoming_letters(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  body text not null check (length(trim(body)) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index if not exists correspondence_messages_thread_idx
  on public.correspondence_messages (letter_id, created_at);

create or replace function public.is_amc_internal()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from public.profiles
  where id = auth.uid() and active = true and role in ('admin', 'personel', 'pimpinan')
) $$;

create or replace function public.can_read_correspondence(target_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.is_amc_internal() or exists (
  select 1 from public.incoming_letters l
  join public.profiles p on p.id = auth.uid()
  where l.id = target_id and p.active = true and p.role = 'ground_handling'
    and l.requester_id = auth.uid()
) $$;

create or replace function public.my_ground_handling_org()
returns text language sql stable security definer set search_path = public
as $$ select organization from public.profiles
  where id = auth.uid() and active = true and role = 'ground_handling' $$;

create or replace function public.protect_profile_role()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if current_setting('app.amc_email_sync', true) = 'on' then return new; end if;
  if auth.uid() = old.id and not public.is_amc_admin() then
    if new.role is distinct from old.role then raise exception 'Only an AMC admin can change a profile role'; end if;
    if new.active is distinct from old.active then raise exception 'Only an AMC admin can change account status'; end if;
    if new.email is distinct from old.email then raise exception 'Only an AMC admin can change a profile email'; end if;
    if old.role = 'ground_handling' and new.organization is distinct from old.organization then
      raise exception 'Only an AMC admin can change a Ground Handling organization';
    end if;
  end if;
  return new;
end $$;

create or replace function public.can_reply_correspondence(parent_id uuid, requester uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.is_amc_internal() and exists (
  select 1 from public.incoming_letters parent
  where parent.id = parent_id and parent.requester_id = requester
) $$;

create or replace function public.protect_pimpinan_correspondence()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if exists (select 1 from public.profiles where id = auth.uid() and role = 'pimpinan' and active = true) then
    if new.id is distinct from old.id or new.reference is distinct from old.reference
      or new.received_date is distinct from old.received_date or new.sender is distinct from old.sender
      or new.subject is distinct from old.subject or new.file_name is distinct from old.file_name
      or new.drive_file_id is distinct from old.drive_file_id or new.drive_web_view_link is distinct from old.drive_web_view_link
      or new.created_by is distinct from old.created_by or new.direction is distinct from old.direction
      or new.requester_id is distinct from old.requester_id or new.sender_organization is distinct from old.sender_organization
      or new.reply_to_id is distinct from old.reply_to_id or new.drive_folder is distinct from old.drive_folder then
      raise exception 'Pimpinan may only update correspondence status';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists incoming_letters_protect_pimpinan on public.incoming_letters;
create trigger incoming_letters_protect_pimpinan before update on public.incoming_letters
for each row execute procedure public.protect_pimpinan_correspondence();

alter table public.correspondence_messages enable row level security;

drop policy if exists "active users read movements" on public.movements;
create policy "internal users read movements" on public.movements
  for select to authenticated using (public.is_amc_internal());

drop policy if exists "active users read incoming letters" on public.incoming_letters;
drop policy if exists "personel and admin insert incoming letters" on public.incoming_letters;
drop policy if exists "personel and admin update incoming letters" on public.incoming_letters;
drop policy if exists "personel and admin delete incoming letters" on public.incoming_letters;
drop policy if exists "internal and requester read correspondence" on public.incoming_letters;
create policy "internal and requester read correspondence" on public.incoming_letters
  for select to authenticated using (public.can_read_correspondence(id));

drop policy if exists "internal and ground handling submit correspondence" on public.incoming_letters;
create policy "internal and ground handling submit correspondence" on public.incoming_letters
  for insert to authenticated with check (
    (public.can_write_amc() and created_by = auth.uid())
    or (
      public.is_amc_internal()
      and direction = 'outbound'
      and created_by = auth.uid()
      and reply_to_id is not null
      and requester_id is not null
      and public.can_reply_correspondence(reply_to_id, requester_id)
    )
    or (
      public.my_ground_handling_org() is not null
      and direction = 'inbound'
      and requester_id = auth.uid()
      and created_by = auth.uid()
      and sender_organization = public.my_ground_handling_org()
    )
  );

drop policy if exists "internal update correspondence" on public.incoming_letters;
create policy "internal update correspondence" on public.incoming_letters
  for update to authenticated using (public.is_amc_internal()) with check (public.is_amc_internal());

drop policy if exists "internal delete correspondence" on public.incoming_letters;
create policy "internal delete correspondence" on public.incoming_letters
  for delete to authenticated using (public.can_write_amc());

drop policy if exists "thread participants read messages" on public.correspondence_messages;
create policy "thread participants read messages" on public.correspondence_messages
  for select to authenticated using (public.can_read_correspondence(letter_id));

drop policy if exists "thread participants send messages" on public.correspondence_messages;
create policy "thread participants send messages" on public.correspondence_messages
  for insert to authenticated with check (
    sender_id = auth.uid() and public.can_read_correspondence(letter_id)
  );

grant select, insert, update, delete on public.incoming_letters to authenticated;
grant select, insert on public.correspondence_messages to authenticated;
grant execute on function public.is_amc_internal(), public.can_read_correspondence(uuid), public.my_ground_handling_org(), public.can_reply_correspondence(uuid, uuid) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.correspondence_messages;
exception when duplicate_object then null; when undefined_object then null; end $$;

