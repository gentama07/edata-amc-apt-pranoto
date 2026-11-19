create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  admin_read_at timestamptz,
  user_read_at timestamptz
);

create index if not exists support_messages_thread_idx
  on public.support_messages (user_id, created_at asc);
create index if not exists support_messages_sender_idx
  on public.support_messages (sender_id);

alter table public.support_messages enable row level security;
revoke all on public.support_messages from public, anon, authenticated;
grant select on public.support_messages to authenticated;
grant all on public.support_messages to service_role;

create policy "active users read own support thread or admin reads all"
  on public.support_messages for select to authenticated
  using ((select public.is_amc_active()) and (user_id = (select auth.uid()) or (select public.is_amc_admin())));

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('support_message', 'account_recovery')),
  reference_id uuid,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create unique index if not exists admin_notifications_reference_idx
  on public.admin_notifications (type, reference_id)
  where reference_id is not null;
create index if not exists admin_notifications_user_idx
  on public.admin_notifications (user_id);
create index if not exists admin_notifications_unread_idx
  on public.admin_notifications (created_at desc) where read_at is null;

alter table public.admin_notifications enable row level security;
revoke all on public.admin_notifications from public, anon, authenticated;
grant select, update (read_at) on public.admin_notifications to authenticated;
grant all on public.admin_notifications to service_role;

create policy "active admins read web notifications"
  on public.admin_notifications for select to authenticated
  using (public.is_amc_admin());
create policy "active admins mark web notifications read"
  on public.admin_notifications for update to authenticated
  using (public.is_amc_admin())
  with check (public.is_amc_admin());

do $$ begin
  alter publication supabase_realtime add table public.support_messages;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.admin_notifications;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.profiles;
exception when duplicate_object then null; when undefined_object then null; end $$;
