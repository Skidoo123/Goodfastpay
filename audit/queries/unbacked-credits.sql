-- audit/queries/unbacked-credits.sql — positive balance, no ledger history. Must be ZERO rows.
select p.id, p.email, p.wallet_balance, p.usd_balance
from profiles p
where (p.wallet_balance > 0 or p.usd_balance > 0)
  and not exists (select 1 from ledger_entries l where l.user_id = p.id);
