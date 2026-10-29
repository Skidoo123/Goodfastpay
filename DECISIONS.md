# Goodfastpay — Decisions (ADR log, newest first)

Every entry: date, status (Accepted | Deprecated | Superseded), context, decision,
consequences. New decisions append at the top. Never edit a decided entry —
supersede it with a new one.

---

## 2026-10-29 — Canonical admin audit row + dead-surface alignment (Accepted)

- **Context:** Structural audit found `admin_audit_log` (003) never written
  (only legacy `audit_trail`), and `rate_snapshots` present in
  `complete-supabase-setup.sql` but absent from migrations.
- **Decision:** Admin API audits write `admin_audit_log` canonically and mirror
  a legacy row into `audit_trail` (the console reads/streams it). Delete
  `rate_snapshots` from the setup script — dead surface.
- **Consequences:** Migration 003 becomes live; setup script is now truly
  policy-identical to 001–004; no action for existing data.

---

## 2026-09-15 — Harden in place, rebuild on `main` later (Accepted)

- **Context:** Full audit found 20+ findings (open RLS, client-trusted balances,
  backdoor logins, broken JS parse). Two paths: patch the flat repo, or greenfield
  monorepo rebuild (9–10 wks, 3–4 people).
- **Decision:** Harden the existing repo in place now (auth, ledger RPC, RLS
  migrations, crash fixes, audit system). Greenfield rebuild stays on the roadmap;
  nothing built here conflicts with it (`api/_lib` boundaries mirror the future
  `packages/` split).
- **Consequences:** Legacy files remain but neutralized; `innerHTML` migration,
  Auth.js, BullMQ stay as tracked follow-ups.

## 2026-09-15 — Fail-closed server APIs (Accepted)

- **Context:** Old endpoints trusted body email/roles and accepted `newBalance`.
- **Decision:** Every privileged route requires a Supabase JWT; admin routes add a
  DB role lookup; unknown callers get 401/403; unknown actions get 400. Legacy
  callers attach the session token via `callClientApi`/`callAdminApi` bridges.
- **Consequences:** Unauthenticated legacy cloud-sync stops syncing (safe direction)
  until the caller holds a session.

## 2026-09-15 — Ledger RPC is the only balance writer (Accepted)

- **Context:** Read-modify-write on `profiles.wallet_balance` (FIN-01) + $250
  auto-credit (FIN-02) + cross-currency refund bug (FIN-03).
- **Decision:** `apply_ledger_entry` RPC owns all movement: atomic, overdraft-safe,
  idempotent on `(user_id, entry_type, reference_id)`; `ledger_entries` is
  append-only (trigger + no write policies); direct balance writes removed
  client- and server-side.

## 2026-09-15 — No signup credit (Accepted)

- **Context:** `$250` USD auto-credit + `₦150,000` fixture balance.
- **Decision:** Ship with zero. Any future bonus debits a real
  `platform:marketing` account, once per user, behind a flag, post-KYC.
  Reconciliation query `audit/queries/unbacked-credits.sql` enforces it.

## 2026-09-15 — Delete dead surface, keep live surface (Accepted)

- **Deleted:** `diagnostic.html` (leaked project IDs), `admin-support.html`
  (unlinked stub), `js/rate-ticker.js` (loaded nowhere), `example.env`
  (untracked secret duplicate).
- **Kept:** `js/copilot-ai.js` (self-mounts, live widget — Drop is a product
  decision for the rebuild, not cleanup), `supabase_schema.sql` (only base-table
  reference — kept with a DO-NOT-APPLY guard header).

## 2026-09-15 — Audit is a property, not a phase (Accepted)

- **Decision:** `audit/` ships in-repo: `full-audit.sh` is the one command,
  nightly CI runs it, DB layers gate on `DATABASE_URL`, findings append to
  `audit/AUDIT_LOG.md`. See `docs/AUDIT_PLAYBOOK.md` rules A1–A10.

---

## Template for new entries

```markdown
## YYYY-MM-DD — Title (Proposed)

- **Context:** ...
- **Decision:** ...
- **Consequences:** ...
```
