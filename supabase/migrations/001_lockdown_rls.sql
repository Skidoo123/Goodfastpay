-- 001_lockdown_rls.sql
-- Kills FOR ALL USING (true); replaces with ownership RLS.
-- Apply AFTER backing up. Run in Supabase SQL Editor or via migration runner.

-- 1. Drop EVERY existing permissive policy in public
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- 2. Force RLS on every table
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', r.tablename);
    execute format('alter table public.%I force row level security', r.tablename);
  end loop;
end $$;

-- 3. Revoke blanket grants; policies (below) grant back scoped access
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;

-- 4. Admin helper
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN','SUPER_ADMIN'));
$$;
revoke all on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;

-- 5. profiles
create policy profiles_select_own on public.profiles
  for select to authenticated using (auth.uid() = id or public.is_admin());
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role           = (select role           from public.profiles where id = auth.uid())
    and wallet_balance = (select wallet_balance from public.profiles where id = auth.uid())
    and usd_balance    = (select usd_balance    from public.profiles where id = auth.uid())
  );
create policy profiles_admin_all on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 6. submissions / withdrawals: owner reads+inserts, admin updates
create policy submissions_select_own on public.submissions
  for select to authenticated using (auth.uid() = user_id or public.is_admin());
create policy submissions_insert_own on public.submissions
  for insert to authenticated with check (auth.uid() = user_id);
create policy submissions_admin_update on public.submissions
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy withdrawals_select_own on public.withdrawals
  for select to authenticated using (auth.uid() = user_id or public.is_admin());
create policy withdrawals_insert_own on public.withdrawals
  for insert to authenticated with check (auth.uid() = user_id);
create policy withdrawals_admin_update on public.withdrawals
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- 7. bank_accounts: strictly private
create policy bank_accounts_own on public.bank_accounts
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 8. inventory: public read when AVAILABLE, admin write
create policy inventory_public_read on public.inventory
  for select to anon, authenticated using (status = 'AVAILABLE');
create policy inventory_admin_all on public.inventory
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 9. tickets + messages: participants and admins only
create policy tickets_own on public.tickets
  for all to authenticated
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());
create policy ticket_msgs_own on public.ticket_messages
  for all to authenticated
  using (public.is_admin() or exists (
    select 1 from public.tickets t where t.id = ticket_messages.ticket_id and t.user_id = auth.uid()))
  with check (public.is_admin() or exists (
    select 1 from public.tickets t where t.id = ticket_messages.ticket_id and t.user_id = auth.uid()));

-- 10. notifications: owner read, owner mark-read
create policy notifications_select_own on public.notifications
  for select to authenticated using (auth.uid() = user_id or public.is_admin());
create policy notifications_update_own on public.notifications
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 11. currencies / brand_rates: public read, admin write
create policy currencies_public_read on public.currencies
  for select to anon, authenticated using (true);
create policy currencies_admin_all on public.currencies
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy brand_rates_public_read on public.brand_rates
  for select to anon, authenticated using (true);
create policy brand_rates_admin_all on public.brand_rates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- NOTE: ledger_entries / transactions / audit tables are defined in 002/003.
-- Any table not listed keeps RLS forced with NO policy = deny-all (service_role only).
