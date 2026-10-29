-- audit/scripts/rls-audit.sql — verifies RLS is actually enforced.
-- R1–R3 must return zero rows. R4 lists intentional deny-all tables for review.

\echo '>>> R1: Tables with RLS disabled (must be zero rows)'
select schemaname, tablename from pg_tables
where schemaname = 'public' and rowsecurity = false;

\echo '>>> R2: Tables with RLS enabled but not forced (must be zero rows)'
select schemaname, tablename from pg_tables
where schemaname = 'public' and rowsecurity = true and forcerowsecurity = false;

\echo '>>> R3: Permissive policies USING(true) outside the 3 intentional public rate reads (must be zero rows)'
select schemaname, tablename, policyname, qual from pg_policies
where schemaname = 'public' and qual = 'true'
  and policyname not in ('currencies_public_read', 'brand_rates_public_read');

\echo '>>> R4: RLS tables with ZERO policies (deny-all — review: must all be intentional)'
select t.tablename from pg_tables t
where t.schemaname = 'public' and t.rowsecurity = true
  and not exists (select 1 from pg_policies p
                  where p.schemaname = t.schemaname and p.tablename = t.tablename);
-- Expected: ledger_entries (select-only lives in 002), admin_audit_log, user_pins.
-- Anything else here is a table nobody can read — confirm intentional.

\echo '>>> R5: Blanket write grants to anon/authenticated (review each row)'
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');
