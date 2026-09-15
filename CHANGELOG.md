# Changelog

Keep-a-changelog. Newest first. Every release links its full-audit output.

## [Unreleased]

### Added
- `supabase/complete-supabase-setup.sql`: one-script Supabase setup (hardened
  base tables + 001–004 + verification queries). `pglast`-parsed (104 statements),
  policy-identical to `migrations/`; seeds currencies only.

### Added
- `tests/` suite (80 tests, zero new deps, `node:test`): unit tests for
  `api/_lib` (validate, http, env, ledger via stubbed Supabase, auth pre-paths);
  static tests for parse/duplicates, frontend↔API action parity, migration
  contents, forbidden-pattern greps, and critical DOM-ID resolution.
  `npm test` is now part of `full-audit.sh` and nightly CI.

### Security
- Require Supabase JWT on `/api/client/action`; JWT + DB role on `/api/admin/action`
- Remove all hardcoded service-role/anon JWT fallbacks from server code
- Ship RLS lockdown migration (001): drop `USING (true)`, ownership policies, forced RLS
- Ship ledger migration (002): append-only `ledger_entries` + atomic idempotent `apply_ledger_entry` RPC (service-role only)
- Ship audit-log migration (003) and plaintext-credential drop migration (004, gated)
- Neutralize backdoor logins, universal passwords, signup overwrite, login auto-provision, role self-grants
- Remove client balance mirrors, direct status writes, plaintext password writes
- Untrack `example.env`; `.env.example` placeholders only

### Fixed
- `portal.js` stray-brace parse failure; orphaned counters → `refreshPortalCounters()`
- `admin.js` duplicate `renderCurrencyManager` (+3 more duplicates) — file parses
- `rate-ticker.js` orphaned block (file since removed as dead surface)
- `handleCardSubmit` undeclared `rate` — resolved from synced rates with guard
- OCR scanner DOM IDs aligned to `sell-*`; fake code generator removed
- Loyalty volume reads live store, not dead key
- Bank-save TypeError (`bank-name`); drawer-toggle null deref
- Restored 5 dropped server actions; full frontend↔API parity verified

### Changed
- Admin `adjust_wallet_balance` accepts `currency` (NGN/USD, same-currency discipline)
- Ticket printing builds DOM via `textContent` (no `document.write`)
- Password updates go through `auth.updateUser`, never the profiles table
- Legacy API bridges attach Bearer tokens; demo-email fallbacks removed

## [2.0.0] — 2026-09-14
- Baseline audited snapshot (20+ findings recorded; see `audit/AUDIT_LOG.md`).
