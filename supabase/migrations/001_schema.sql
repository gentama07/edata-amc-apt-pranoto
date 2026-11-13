-- E-data AMC APT Pranoto: skema database (PostgreSQL / Supabase)

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  nama text, nip text,
  role text not null default 'pimpinan' check (role in ('pimpinan','personel','admin'))
);

create function app_role() returns text language sql stable security definer set search_path = public
as $$ select role from profiles where id = auth.uid() $$;

create function handle_new_user() returns trigger language plpgsql security definer set search_path = public
as $$ begin insert into profiles(id, nama) values (new.id, coalesce(new.raw_user_meta_data->>'nama', new.email)); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

create table movements (
  id uuid primary key default gen_random_uuid(),
  tanggal date not null,
  operator text not null, ac_type text, reg text not null,
  flt_arr text, flt_dep text, orig text, dest text,
  sched_arr time, ata time, block_on time, sched_dep time, block_off time, atd time,
  gh text, parking_stand int, riu_arr text, riu_dep text,
  pax_arr int not null default 0, pax_dep int not null default 0,
  bagasi_arr numeric not null default 0, bagasi_dep numeric not null default 0,
  kargo_arr numeric not null default 0, kargo_dep numeric not null default 0,
  remark text,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(),
  constraint ada_flight check (flt_arr is not null or flt_dep is not null),
  -- validasi logika waktu (kebutuhan fungsional TA): ATA <= Block ON <= Block OFF <= ATD
  constraint time_order check (
    (ata is null or block_on is null or block_on >= ata) and
    (block_on is null or block_off is null or block_off >= block_on) and
    (block_off is null or atd is null or atd >= block_off))
);
create index on movements (tanggal);

create view daily_summary with (security_invoker = true) as
select tanggal, count(flt_arr)::int flt_arr, count(flt_dep)::int flt_dep,
  sum(pax_arr)::int pax_arr, sum(pax_dep)::int pax_dep,
  sum(bagasi_arr)::float8 bagasi_arr, sum(bagasi_dep)::float8 bagasi_dep,
  sum(kargo_arr)::float8 kargo_arr, sum(kargo_dep)::float8 kargo_dep
from movements group by tanggal;

create table surat (
  id uuid primary key default gen_random_uuid(),
  drive_file_id text unique not null,
  nama_file text not null, kategori text not null default 'Lainnya',
  mime text, drive_url text,
  tanggal date not null default current_date,
  uploaded_by uuid, created_at timestamptz not null default now()
);

-- Row Level Security: pimpinan hanya membaca, personel/admin boleh menulis pergerakan.
-- Tabel surat hanya ditulis Edge Function (service role), tidak oleh browser.
alter table profiles enable row level security;
alter table movements enable row level security;
alter table surat enable row level security;
create policy p_self on profiles for select to authenticated using (id = auth.uid());
create policy m_read on movements for select to authenticated using (true);
create policy m_write on movements for all to authenticated
  using (app_role() in ('personel','admin')) with check (app_role() in ('personel','admin'));
create policy s_read on surat for select to authenticated using (true);

alter publication supabase_realtime add table movements, surat;
