-- audit/scripts/audit-log-audit.sql
-- Audit completeness for audit_trail (legacy) + admin_audit_log (new).
-- A1/A2 must return zero rows. A3/A4 are for manual review.

\echo '>>> A1: COMPLETED/DECLINED withdrawals (24h) with no audit entry nearby'
select w.id, w.user_email, w.status, w.updated_at
from withdrawals w
where w.status in ('COMPLETED', 'DECLINED')
  and w.updated_at > now() - interval '24 hours'
  and not exists (
    select 1 from audit_trail a
    where a.created_at between w.updated_at - interval '5 minutes'
                            and w.updated_at + interval '5 minutes'
  )
  and not exists (
    select 1 from admin_audit_log l
    where l.created_at between w.updated_at - interval '5 minutes'
                            and w.updated_at + interval '5 minutes'
  );

\echo '>>> A2: Audit entries with no actor (must be zero rows)'
select id, event as action, created_at from audit_trail
where operator_email is null;
select id, action, created_at from admin_audit_log
where actor_id is null and actor_email is null;

\echo '>>> A3: Admin action volume, last 7 days (review)'
select event as action, count(*), min(created_at), max(created_at)
from audit_trail where created_at > now() - interval '7 days'
group by event order by count(*) desc;
select action, count(*), min(created_at), max(created_at)
from admin_audit_log where created_at > now() - interval '7 days'
group by action order by count(*) desc;
