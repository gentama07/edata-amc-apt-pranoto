-- E-data AMC React application compatibility layer.
-- Keeps the original 001_schema.sql tables and data intact while adding
-- the columns and incoming-letter table used by the current application.

create extension if not exists pgcrypto;

alter table public.profiles add column if not exists display_name text not null default '';
alter table public.profiles add column if not exists email text not null default '';
alter table public.profiles add column if not exists active boolean not null default true;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

update public.profiles p
set display_name = coalesce(nullif(p.display_name, ''), nullif(p.nama, ''), split_part(u.email, '@', 1), 'Personel AMC'),
    email = coalesce(nullif(p.email, ''), u.email, '')
from auth.users u
where u.id = p.id;

alter table public.movements add column if not exists operating_date date;
alter table public.movements add column if not exists aircraft_type text;
alter table public.movements add column if not exists registration text;
alter table public.movements add column if not exists sta time;
alter table public.movements add column if not exists std time;
alter table public.movements add column if not exists ground_handler text;
alter table public.movements add column if not exists riu text;
alter table public.movements add column if not exists baggage_kg numeric(10,2) not null default 0;
alter table public.movements add column if not exists cargo_kg numeric(10,2) not null default 0;
alter table public.movements add column if not exists updated_at timestamptz not null default now();

update public.movements
set operating_date = coalesce(operating_date, tanggal),
    aircraft_type = coalesce(nullif(aircraft_type, ''), nullif(ac_type, ''), 'Tidak diketahui'),
    registration = coalesce(nullif(registration, ''), reg),
    sta = coalesce(sta, sched_arr),
    std = coalesce(std, sched_dep),
    ground_handler = coalesce(ground_handler, gh),
    riu = coalesce(riu, riu_arr, riu_dep),
    baggage_kg = case when baggage_kg = 0 then coalesce(bagasi_arr, 0) + coalesce(bagasi_dep, 0) else baggage_kg end,
    cargo_kg = case when cargo_kg = 0 then coalesce(kargo_arr, 0) + coalesce(kargo_dep, 0) else cargo_kg end;

alter table public.movements alter column operating_date set not null;
alter table public.movements alter column aircraft_type set default 'Tidak diketahui';
alter table public.movements alter column aircraft_type set not null;
alter table public.movements alter column registration set not null;

create index if not exists movements_operating_date_v2_idx on public.movements (operating_date desc);
create index if not exists movements_registration_v2_idx on public.movements (registration);

create table if not exists public.incoming_letters (
  id uuid primary key default gen_random_uuid(),
  reference text not null,
  received_date date not null default current_date,
  sender text not null,
  subject text not null,
  status text not null default 'Baru' check (status in ('Baru', 'Perlu ditindaklanjuti', 'Diarsipkan')),
  file_name text,
  drive_file_id text,
  drive_web_view_link text,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists incoming_letters_drive_file_id_idx
  on public.incoming_letters (drive_file_id);
create index if not exists incoming_letters_received_date_v2_idx
  on public.incoming_letters (received_date desc);

-- Preserve existing Drive records in `surat` by copying them into the new app's table.
insert into public.incoming_letters
  (reference, received_date, sender, subject, file_name, drive_file_id, drive_web_view_link, created_by, created_at)
select coalesce(nullif(s.drive_file_id, ''), 'LEGACY-' || s.id::text),
       s.tanggal,
       'Google Drive',
       s.nama_file,
       s.nama_file,
       s.drive_file_id,
       s.drive_url,
       s.uploaded_by,
       s.created_at
from public.surat s
where s.drive_file_id is not null
on conflict (drive_file_id) where drive_file_id is not null do nothing;

create or replace function public.is_amc_active()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and active = true) $$;

create or replace function public.is_amc_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and active = true and role = 'admin') $$;

create or replace function public.can_write_amc()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and active = true and role in ('personel', 'admin')) $$;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at = now(); return new; end $$;

create or replace function public.protect_profile_role()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if current_setting('app.amc_email_sync', true) = 'on' then return new; end if;
  if auth.uid() = old.id and not public.is_amc_admin() then
    if new.role is distinct from old.role then raise exception 'Only an AMC admin can change a profile role'; end if;
    if new.active is distinct from old.active then raise exception 'Only an AMC admin can change account status'; end if;
    if new.email is distinct from old.email then raise exception 'Only an AMC admin can change a profile email'; end if;
  end if;
  return new;
end $$;

create or replace function public.provision_amc_profile()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nama, display_name, email, role, active)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
          coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), new.email, 'personel', true)
  on conflict (id) do nothing;
  return new;
end $$;

create or replace function public.sync_amc_profile_email()
returns trigger language plpgsql security definer set search_path = public
as $$ begin
  perform set_config('app.amc_email_sync', 'on', true);
  update public.profiles set email = new.email where id = new.id;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_created_amc on auth.users;
create trigger on_auth_user_created_amc after insert on auth.users
for each row execute procedure public.provision_amc_profile();
drop trigger if exists on_auth_user_email_updated_amc on auth.users;
create trigger on_auth_user_email_updated_amc after update of email on auth.users
for each row execute procedure public.sync_amc_profile_email();

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role before update on public.profiles
for each row execute procedure public.protect_profile_role();
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
for each row execute procedure public.set_updated_at();
drop trigger if exists movements_updated_at on public.movements;
create trigger movements_updated_at before update on public.movements
for each row execute procedure public.set_updated_at();
drop trigger if exists incoming_letters_updated_at on public.incoming_letters;
create trigger incoming_letters_updated_at before update on public.incoming_letters
for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.movements enable row level security;
alter table public.incoming_letters enable row level security;

drop policy if exists p_self on public.profiles;
drop policy if exists "profiles read own or admin" on public.profiles;
create policy "profiles read own or admin" on public.profiles for select to authenticated
using (id = auth.uid() or public.is_amc_admin());
drop policy if exists "profiles update own safe fields or admin" on public.profiles;
create policy "profiles update own safe fields or admin" on public.profiles for update to authenticated
using (id = auth.uid() or public.is_amc_admin()) with check (id = auth.uid() or public.is_amc_admin());

drop policy if exists m_read on public.movements;
drop policy if exists m_write on public.movements;
create policy "active users read movements" on public.movements for select to authenticated
using (public.is_amc_active());
create policy "personel and admin insert movements" on public.movements for insert to authenticated
with check (public.can_write_amc() and created_by = auth.uid());
create policy "personel and admin update movements" on public.movements for update to authenticated
using (public.can_write_amc()) with check (public.can_write_amc());
create policy "personel and admin delete movements" on public.movements for delete to authenticated
using (public.can_write_amc());

drop policy if exists "active users read incoming letters" on public.incoming_letters;
create policy "active users read incoming letters" on public.incoming_letters for select to authenticated
using (public.is_amc_active());
create policy "personel and admin insert incoming letters" on public.incoming_letters for insert to authenticated
with check (public.can_write_amc() and created_by = auth.uid());
create policy "personel and admin update incoming letters" on public.incoming_letters for update to authenticated
using (public.can_write_amc()) with check (public.can_write_amc());
create policy "personel and admin delete incoming letters" on public.incoming_letters for delete to authenticated
using (public.can_write_amc());

grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.movements, public.incoming_letters to authenticated;
grant execute on function public.is_amc_active(), public.is_amc_admin(), public.can_write_amc() to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.movements;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.incoming_letters;
exception when duplicate_object then null; when undefined_object then null; end $$;
