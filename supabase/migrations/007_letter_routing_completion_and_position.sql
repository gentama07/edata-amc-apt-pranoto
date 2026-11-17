-- Add explicit addressee routing, two-party completion, and profile position.
-- Existing correspondence is preserved and remains readable by prior roles.

alter table public.profiles add column if not exists position text;
alter table public.incoming_letters
  add column if not exists recipient_role text,
  add column if not exists sender_confirmed_at timestamptz,
  add column if not exists recipient_confirmed_at timestamptz;

alter table public.incoming_letters drop constraint if exists incoming_letters_recipient_role_check;
alter table public.incoming_letters add constraint incoming_letters_recipient_role_check
  check (recipient_role is null or recipient_role in ('amc', 'pimpinan', 'ground_handling'));

update public.incoming_letters
set recipient_role = case
  when direction = 'inbound' then 'amc'
  when direction = 'outbound' then 'ground_handling'
  else recipient_role
end
where recipient_role is null;

create or replace function public.can_read_correspondence(target_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.incoming_letters l
    join public.profiles p on p.id = auth.uid()
    where l.id = target_id and p.active = true and (
      p.role in ('admin', 'personel')
      or (p.role = 'pimpinan' and coalesce(l.recipient_role, 'amc') in ('amc', 'pimpinan'))
      or (p.role = 'ground_handling' and (
        l.requester_id = auth.uid()
        or l.recipient_role = 'ground_handling'
      ))
    )
  )
$$;

drop policy if exists "internal and ground handling submit correspondence" on public.incoming_letters;
create policy "role routed correspondence insert" on public.incoming_letters
for insert to authenticated with check (
  (
    public.can_write_amc()
    and created_by = auth.uid()
    and (
      direction <> 'outbound'
      or recipient_role in ('pimpinan', 'ground_handling')
    )
  )
  or (
    public.is_amc_internal()
    and direction = 'outbound'
    and created_by = auth.uid()
    and reply_to_id is not null
    and requester_id is not null
    and recipient_role in ('amc', 'ground_handling')
    and public.can_reply_correspondence(reply_to_id, requester_id)
  )
  or (
    public.my_ground_handling_org() is not null
    and direction = 'inbound'
    and recipient_role = 'amc'
    and requester_id = auth.uid()
    and created_by = auth.uid()
    and sender_organization = public.my_ground_handling_org()
  )
);

create or replace function public.can_reply_correspondence(parent_id uuid, requester uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_amc_internal() and exists (
    select 1 from public.incoming_letters parent
    where parent.id = parent_id and (
      parent.requester_id = requester
      or (parent.recipient_role = 'pimpinan' and parent.created_by = requester)
    )
  )
$$;

create or replace function public.submit_ground_handling_letter(
  p_reference text,
  p_received_date date,
  p_sender text,
  p_sender_organization text,
  p_subject text,
  p_file_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_organization text;
  created_letter_id uuid;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Sesi login diperlukan untuk mengirim surat.';
  end if;

  select organization into actor_organization
  from public.profiles
  where id = actor_id and active = true and role = 'ground_handling';

  if actor_organization is null or btrim(actor_organization) = '' then
    raise exception using errcode = '42501', message = 'Akun Ground Handling tidak aktif atau belum memiliki perusahaan.';
  end if;
  if nullif(btrim(p_sender), '') is null or nullif(btrim(p_subject), '') is null then
    raise exception using errcode = '22023', message = 'Nama pengirim dan perihal wajib diisi.';
  end if;
  if p_sender_organization is distinct from actor_organization then
    raise exception using errcode = '42501', message = 'Perusahaan surat harus sesuai dengan perusahaan akun.';
  end if;
  if nullif(btrim(p_file_name), '') is null or lower(p_file_name) not like '%.pdf' then
    raise exception using errcode = '22023', message = 'Lampiran surat harus berupa PDF.';
  end if;

  insert into public.incoming_letters (
    reference, received_date, sender, sender_organization, subject,
    status, file_name, direction, requester_id, recipient_role, created_by
  ) values (
    coalesce(nullif(btrim(p_reference), ''), 'GH-' || to_char(now(), 'YYYYMMDD-HH24MISS')),
    coalesce(p_received_date, current_date), btrim(p_sender), actor_organization,
    btrim(p_subject), 'Baru', btrim(p_file_name), 'inbound', actor_id, 'amc', actor_id
  ) returning id into created_letter_id;
  return created_letter_id;
end;
$$;

revoke all on function public.submit_ground_handling_letter(text, date, text, text, text, text) from public;
grant execute on function public.submit_ground_handling_letter(text, date, text, text, text, text) to authenticated;

create or replace function public.set_correspondence_completion_status()
returns trigger language plpgsql set search_path = public
as $$
begin
  if new.sender_confirmed_at is not null and new.recipient_confirmed_at is not null then
    new.status := 'Selesai';
  end if;
  return new;
end;
$$;

drop trigger if exists incoming_letters_completion_status on public.incoming_letters;
create trigger incoming_letters_completion_status
before insert or update of sender_confirmed_at, recipient_confirmed_at
on public.incoming_letters
for each row execute function public.set_correspondence_completion_status();

create or replace function public.confirm_correspondence_complete(p_letter_id uuid)
returns void language plpgsql security definer set search_path = public, auth
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text;
  letter_row public.incoming_letters%rowtype;
  is_sender boolean;
  is_recipient boolean;
begin
  if actor_id is null then raise exception using errcode = '42501', message = 'Sesi login diperlukan.'; end if;
  select role into actor_role from public.profiles where id = actor_id and active = true;
  if actor_role is null then raise exception using errcode = '42501', message = 'Akun tidak aktif.'; end if;
  select * into letter_row from public.incoming_letters where id = p_letter_id;
  if not found then raise exception using errcode = 'P0002', message = 'Surat tidak ditemukan.'; end if;

  is_sender := letter_row.created_by = actor_id
    or (letter_row.direction = 'inbound' and letter_row.requester_id = actor_id);
  is_recipient := case coalesce(letter_row.recipient_role, case when letter_row.direction = 'inbound' then 'amc' else 'ground_handling' end)
    when 'amc' then actor_role in ('admin', 'personel')
    when 'pimpinan' then actor_role = 'pimpinan'
    when 'ground_handling' then actor_role = 'ground_handling'
    else false
  end;

  if is_sender then
    update public.incoming_letters set sender_confirmed_at = coalesce(sender_confirmed_at, now()) where id = p_letter_id;
  elsif is_recipient then
    update public.incoming_letters set recipient_confirmed_at = coalesce(recipient_confirmed_at, now()) where id = p_letter_id;
  else
    raise exception using errcode = '42501', message = 'Akun ini bukan pengirim atau penerima surat.';
  end if;
end;
$$;

revoke all on function public.confirm_correspondence_complete(uuid) from public;
grant execute on function public.confirm_correspondence_complete(uuid) to authenticated;

revoke update on public.profiles from authenticated;
grant update (display_name, nip, position, avatar_url) on public.profiles to authenticated;
grant select (id, display_name, email, role, active, organization, nip, position, avatar_url) on public.profiles to authenticated;

notify pgrst, 'reload schema';

