-- audit/queries/drift.sql — reconciliation. Must return ZERO rows. Run every 15 min.
select p.id, p.email,
       p.wallet_balance as profile_ngn,
       coalesce(sum(case when l.currency='NGN' and l.direction='CREDIT' then l.amount
                         when l.currency='NGN' and l.direction='DEBIT'  then -l.amount end),0) as ledger_ngn,
       p.usd_balance as profile_usd,
       coalesce(sum(case when l.currency='USD' and l.direction='CREDIT' then l.amount
                         when l.currency='USD' and l.direction='DEBIT'  then -l.amount end),0) as ledger_usd
from profiles p
left join ledger_entries l on l.user_id = p.id
group by p.id, p.email, p.wallet_balance, p.usd_balance
having p.wallet_balance <> coalesce(sum(case when l.currency='NGN' and l.direction='CREDIT' then l.amount
                                              when l.currency='NGN' and l.direction='DEBIT'  then -l.amount end),0)
    or p.usd_balance <> coalesce(sum(case when l.currency='USD' and l.direction='CREDIT' then l.amount
                                           when l.currency='USD' and l.direction='DEBIT'  then -l.amount end),0);
