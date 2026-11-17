-- Submit Ground Handling letters through a narrowly scoped, server-side check.
-- The authenticated user's profile determines the organization and requester ID.

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
    status, file_name, direction, requester_id, created_by
  ) values (
    coalesce(nullif(btrim(p_reference), ''), 'GH-' || to_char(now(), 'YYYYMMDD-HH24MISS')),
    coalesce(p_received_date, current_date),
    btrim(p_sender), actor_organization, btrim(p_subject),
    'Baru', btrim(p_file_name), 'inbound', actor_id, actor_id
  ) returning id into created_letter_id;

  return created_letter_id;
end;
$$;

revoke all on function public.submit_ground_handling_letter(text, date, text, text, text, text) from public;
grant execute on function public.submit_ground_handling_letter(text, date, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';

