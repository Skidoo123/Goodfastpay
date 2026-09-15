-- audit/queries/orphaned-funds.sql — ledger entries for unknown users. Must be ZERO rows.
select l.id, l.user_id, l.currency, l.direction, l.amount, l.entry_type, l.created_at
from ledger_entries l
left join profiles p on p.id = l.user_id
where p.id is null;
