-- 003_audit_log.sql
-- Dedicated admin audit table. Service-role writes only (no RLS write policies).

create table if not exists public.admin_audit_log (
  id          bigserial primary key,
  actor_id    uuid references auth.users(id),
  actor_email text,
  action      text not null,
  target      text,
  payload     jsonb not null default '{}'::jsonb,
  ip          text,
  created_at  timestamptz not null default now()
);

create index if not exists admin_audit_actor_idx on public.admin_audit_log (actor_id, created_at desc);
create index if not exists admin_audit_action_idx on public.admin_audit_log (action, created_at desc);

alter table public.admin_audit_log enable row level security;
alter table public.admin_audit_log force row level security;

create policy audit_admin_read on public.admin_audit_log
  for select to authenticated using (public.is_admin());
-- No insert/update/delete policy: only service_role writes.
