create table if not exists public.account_recovery_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','resetting','completed','rejected','expired','locked')),
  request_count integer not null default 1 check (request_count > 0),
  requested_at timestamptz not null default now(),
  last_requested_at timestamptz not null default now(),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  token_hash text,
  token_expires_at timestamptz,
  token_attempts integer not null default 0 check (token_attempts between 0 and 5),
  token_claimed_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists account_recovery_requests_user_history_idx
  on public.account_recovery_requests (user_id, requested_at desc);
create index if not exists account_recovery_requests_admin_queue_idx
  on public.account_recovery_requests (status, last_requested_at desc);
create unique index if not exists account_recovery_requests_one_open_idx
  on public.account_recovery_requests (user_id)
  where status in ('pending','approved','resetting');

alter table public.account_recovery_requests enable row level security;
revoke all on public.account_recovery_requests from anon, authenticated;
grant all on public.account_recovery_requests to service_role;

create table if not exists public.account_recovery_attempts (
  id bigint generated always as identity primary key,
  email_hash text not null,
  ip_hash text not null,
  action text not null check (action in ('request','reset')),
  created_at timestamptz not null default now()
);
create index if not exists account_recovery_attempts_email_idx
  on public.account_recovery_attempts (email_hash, action, created_at desc);
create index if not exists account_recovery_attempts_ip_idx
  on public.account_recovery_attempts (ip_hash, action, created_at desc);
alter table public.account_recovery_attempts enable row level security;
revoke all on public.account_recovery_attempts from anon, authenticated;
grant all on public.account_recovery_attempts to service_role;

create or replace function public.claim_account_recovery_token(p_user_id uuid, p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.account_recovery_requests%rowtype;
begin
  select * into request_row
  from public.account_recovery_requests
  where user_id = p_user_id and status = 'approved'
  order by approved_at desc
  limit 1
  for update;

  if not found then return null; end if;
  if request_row.token_expires_at is null or request_row.token_expires_at <= now() then
    update public.account_recovery_requests set status = 'expired', token_hash = null, updated_at = now()
    where id = request_row.id;
    return null;
  end if;
  if request_row.token_attempts >= 5 then
    update public.account_recovery_requests set status = 'locked', token_hash = null, updated_at = now()
    where id = request_row.id;
    return null;
  end if;
  if request_row.token_hash is distinct from p_token_hash then
    update public.account_recovery_requests
      set token_attempts = token_attempts + 1,
          status = case when token_attempts + 1 >= 5 then 'locked' else 'approved' end,
          token_hash = case when token_attempts + 1 >= 5 then null else token_hash end,
          updated_at = now()
    where id = request_row.id;
    return null;
  end if;

  update public.account_recovery_requests
    set status = 'resetting', token_claimed_at = now(), updated_at = now()
  where id = request_row.id;
  return request_row.id;
end;
$$;
revoke all on function public.claim_account_recovery_token(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_account_recovery_token(uuid, text) to service_role;

