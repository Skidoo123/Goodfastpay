-- 004_drop_plaintext_secrets.sql
-- Removes plaintext credential columns. RUN ONLY AFTER:
--  1. All users forced through password reset (Supabase Auth owns passwords now)
--  2. Transaction PIN replaced by TOTP / server-side verified PIN
--  3. Full backup taken
-- If PIN gating is still a product requirement, use public.user_pins (hash only).

alter table public.profiles drop column if exists password;
alter table public.profiles drop column if exists password_hash;
alter table public.profiles drop column if exists transaction_pin;
alter table public.profiles drop column if exists pin;

create table if not exists public.user_pins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  pin_hash   text not null,
  updated_at timestamptz not null default now()
);
alter table public.user_pins enable row level security;
alter table public.user_pins force row level security;
-- No policies at all: service_role only. Verify via RPC, never in the browser.
