-- 002_ledger_and_atomic.sql
-- Immutable ledger + atomic balance mutation. The ONLY way balances move.
-- Depends on: profiles(id), profiles.wallet_balance, profiles.usd_balance.

create table if not exists public.ledger_entries (
  id            bigserial primary key,
  user_id       uuid        not null references auth.users(id) on delete cascade,
  currency      text        not null check (currency in ('NGN','USD')),
  direction     text        not null check (direction in ('CREDIT','DEBIT')),
  amount        numeric(18,2) not null check (amount > 0),
  entry_type    text        not null,
  reference_id  text        not null,
  balance_after numeric(18,2) not null,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create unique index if not exists ledger_idempotency_idx
  on public.ledger_entries (user_id, entry_type, reference_id);
create index if not exists ledger_user_created_idx
  on public.ledger_entries (user_id, created_at desc);

alter table public.ledger_entries enable row level security;
alter table public.ledger_entries force row level security;

-- Read-only for owner/admin. No INSERT/UPDATE/DELETE policies: append-only.
create policy ledger_select_own on public.ledger_entries
  for select to authenticated using (auth.uid() = user_id or public.is_admin());

-- Belt-and-braces: block UPDATE/DELETE even for service_role misuse via API
create or replace function public.deny_ledger_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'LEDGER_APPEND_ONLY: % on ledger_entries is forbidden', TG_OP;
end $$;
drop trigger if exists ledger_no_update on public.ledger_entries;
create trigger ledger_no_update before update or delete on public.ledger_entries
  for each row execute function public.deny_ledger_mutation();

create or replace function public.apply_ledger_entry(
  p_user_id      uuid,
  p_currency     text,
  p_direction    text,
  p_amount       numeric,
  p_entry_type   text,
  p_reference_id text,
  p_metadata     jsonb default '{}'::jsonb
) returns public.ledger_entries
language plpgsql security definer set search_path = public as $$
declare
  v_delta   numeric(18,2);
  v_row     public.ledger_entries;
  v_balance numeric(18,2);
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'AMOUNT_INVALID' using errcode = '22023';
  end if;
  if p_currency not in ('NGN','USD') then
    raise exception 'CURRENCY_INVALID' using errcode = '22023';
  end if;
  if p_direction not in ('CREDIT','DEBIT') then
    raise exception 'DIRECTION_INVALID' using errcode = '22023';
  end if;

  -- Idempotency: same (user, type, reference) returns the original entry.
  select * into v_row from public.ledger_entries
   where user_id = p_user_id and entry_type = p_entry_type and reference_id = p_reference_id;
  if found then return v_row; end if;

  v_delta := case when p_direction = 'CREDIT' then p_amount else -p_amount end;

  -- Single-statement, overdraft-safe update. Row lock held to commit.
  if p_currency = 'NGN' then
    update public.profiles set wallet_balance = wallet_balance + v_delta,
      updated_at = now()
     where id = p_user_id and wallet_balance + v_delta >= 0
    returning wallet_balance into v_balance;
  else
    update public.profiles set usd_balance = usd_balance + v_delta,
      updated_at = now()
     where id = p_user_id and usd_balance + v_delta >= 0
    returning usd_balance into v_balance;
  end if;

  if v_balance is null then
    raise exception 'INSUFFICIENT_FUNDS_OR_UNKNOWN_USER' using errcode = 'P0001';
  end if;

  insert into public.ledger_entries
    (user_id, currency, direction, amount, entry_type, reference_id, balance_after, metadata)
  values
    (p_user_id, p_currency, p_direction, p_amount, p_entry_type, p_reference_id, v_balance, coalesce(p_metadata,'{}'::jsonb))
  returning * into v_row;
  return v_row;
end $$;

-- Only the server (service_role) may move money.
revoke all on function public.apply_ledger_entry(uuid,text,text,numeric,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.apply_ledger_entry(uuid,text,text,numeric,text,text,jsonb) to service_role;
