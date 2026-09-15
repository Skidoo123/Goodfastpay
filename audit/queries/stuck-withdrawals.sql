-- audit/queries/stuck-withdrawals.sql — PENDING withdrawals older than 1h. Must be ZERO rows.
select id, user_email, amount, status, created_at, now() - created_at as age
from withdrawals
where status = 'PENDING' and created_at < now() - interval '1 hour';
