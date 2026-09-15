-- audit/scripts/ledger-audit.sql
-- Financial integrity queries for THIS schema (ledger_entries + profiles).
-- Every query must return ZERO rows. Run against prod replica.

\echo '>>> L1: Negative balances (check constraint breach)'
select id, email, wallet_balance, usd_balance from profiles
where wallet_balance < 0 or usd_balance < 0;

\echo '>>> L2: Profile NGN balance != ledger sum'
select p.id, p.email, p.wallet_balance as profile_balance,
       coalesce(sum(case when l.direction='CREDIT' then l.amount else -l.amount end),0) as ledger_sum
from profiles p
left join ledger_entries l on l.user_id = p.id and l.currency = 'NGN'
group by p.id, p.email, p.wallet_balance
having p.wallet_balance <> coalesce(sum(case when l.direction='CREDIT' then l.amount else -l.amount end),0);

\echo '>>> L3: Profile USD balance != ledger sum'
select p.id, p.email, p.usd_balance as profile_balance,
       coalesce(sum(case when l.direction='CREDIT' then l.amount else -l.amount end),0) as ledger_sum
from profiles p
left join ledger_entries l on l.user_id = p.id and l.currency = 'USD'
group by p.id, p.email, p.usd_balance
having p.usd_balance <> coalesce(sum(case when l.direction='CREDIT' then l.amount else -l.amount end),0);

\echo '>>> L4: Positive balance, zero ledger entries (unbacked credit)'
select p.id, p.email, p.wallet_balance, p.usd_balance
from profiles p
where (p.wallet_balance > 0 or p.usd_balance > 0)
  and not exists (select 1 from ledger_entries l where l.user_id = p.id);

\echo '>>> L5: Duplicate idempotency keys (unique index must prevent)'
select user_id, entry_type, reference_id, count(*)
from ledger_entries
group by user_id, entry_type, reference_id
having count(*) > 1;

\echo '>>> L6: balance_after does not match running position'
with ordered as (
  select id, user_id, currency, direction, amount, balance_after,
         sum(case when direction='CREDIT' then amount else -amount end)
           over (partition by user_id, currency order by id) as running
  from ledger_entries
)
select id, user_id, currency, balance_after, running
from ordered where balance_after <> running;

\echo '>>> L7: Withdrawals PENDING older than 1h (stuck funds)'
select id, user_email, amount, status, created_at, now() - created_at as age
from withdrawals
where status = 'PENDING' and created_at < now() - interval '1 hour';

\echo '>>> L8: COMPLETED submissions with no matching CARD_SALE_SETTLE entry'
select s.id, s.user_email, s.payout_amount, s.updated_at
from submissions s
where s.status = 'COMPLETED'
  and not exists (
    select 1 from ledger_entries l
    where l.entry_type = 'CARD_SALE_SETTLE'
      and l.created_at between s.updated_at - interval '10 minutes'
                           and s.updated_at + interval '10 minutes'
  );
