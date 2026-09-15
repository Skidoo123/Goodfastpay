# Goodfastpay — Digital Gift Card & Currency Exchange Platform

Gift-card trading (sell/buy), NGN bank withdrawals, and admin operations,
backed by Supabase Postgres with a server-authoritative API layer.

> **Security status:** this repo completed a full hardening pass (Sept 2026).
> `npm run verify` and `bash audit/scripts/full-audit.sh` are green.
> Before first production deploy, complete **Phase -1** in `docs/REBUILD_REFERENCE.md`
> (key rotation, git-history scrub, password resets). Do not skip it.

## Quick start

```bash
# 1. Tooling
node --version   # >= 20.11 required (.nvmrc)
npm install

# 2. Config (placeholders only — real values live in Vercel/Doppler, never git)
cp .env.example .env
# fill in SUPABASE_URL / SUPABASE_ANON_KEY (public) for local dev

# 3. Verify everything
npm run verify                    # syntax + secret guards
bash audit/scripts/full-audit.sh  # full gates (DB layers need DATABASE_URL)

# 4. Serve locally (static frontend + Vercel dev for APIs)
npx serve .
# APIs: deploy preview via `vercel` or run `vercel dev`
```

## Layout

```
├── index.html / portal.html / admin.html   # marketing, customer portal, ops console
├── css/style.css  images/logo.png          # static assets
├── js/                                     # frontend (hardened in place; see DECISIONS.md)
│   ├── safe-dom.js                         # escaping helpers — use instead of innerHTML
│   └── app|portal|admin|supabase-config…   # app logic
├── api/
│   ├── _lib/                               # shared server lib (never routed)
│   │   ├── env.js http.js auth.js supabaseAdmin.js validate.js ledger.js
│   ├── config.js                           # public config only (GET, no secrets)
│   ├── client/action.js                    # JWT-required customer API
│   └── admin/action.js                     # JWT + DB-role admin API
├── supabase/migrations/                    # 001 RLS lockdown → 004 drop plaintext creds
├── supabase_schema.sql                     # ⚠️ LEGACY base tables only — DO NOT APPLY (see header)
├── scripts/                                # scan-syntax.mjs, check-secrets.mjs (CI gates)
├── audit/                                  # continuous-audit system (scripts, queries, config, log)
├── docs/                                   # AUDIT_PLAYBOOK.md + rebuild reference
└── .github/workflows/                      # nightly audit
```

## Scripts

| Command | What it does |
|---|---|
| `npm run verify` | `lint:syntax` + `lint:secrets` — must pass before every commit |
| `npm run lint:syntax` | Ground-truth `node --check` + duplicate-function detection (21 files) |
| `npm run lint:secrets` | FAIL on server secrets/sinks; WARN on tracked legacy debt |
| `bash audit/scripts/full-audit.sh` | The one command: repo audit + verify + (with `DATABASE_URL`) ledger/RLS/audit-log SQL + provider check |

With `DATABASE_URL` set (staging replica), the audit also runs
`audit/scripts/{ledger,rls,audit-log}-audit.sql` — every query must return zero rows.

## API contract

All mutations go through two endpoints. The client sends **intent**, never amounts.

- `POST /api/client/action` — `Authorization: Bearer <supabase JWT>`.
  Actions: `create_submission|submit_card`, `request_withdrawal`,
  `update_profile`, `save_bank`, `delete_bank`, `log_security_event`.
- `POST /api/admin/action` — Bearer JWT + `profiles.role` in (`ADMIN`,`SUPER_ADMIN`), checked server-side.
  Actions: `approve|reject_submission`, `approve|decline_withdrawal`,
  `adjust_wallet_balance` (supports `currency: NGN|USD`), `update_user_status`,
  `add|delete_inventory`, `dispatch_broadcast`, `sync_currencies_and_rates`.
- `GET /api/config` — public Supabase URL + anon key only. Nothing secret, ever.

Balances move exclusively through the `apply_ledger_entry` Postgres RPC
(`supabase/migrations/002_ledger_and_atomic.sql`): atomic, overdraft-safe, idempotent
on `(user_id, entry_type, reference_id)`.

## Database

Apply in order, staging first: `001_lockdown_rls` → `002_ledger_and_atomic` →
`003_audit_log` → `004_drop_plaintext_secrets` (004 only after backups + forced resets).
`supabase_schema.sql` is the legacy base-table reference — **never apply it to a live DB**
(its RLS/seeds are superseded and unsafe; header says so).

## Deployment (Vercel)

Required env vars (all server-side; nothing with a public prefix except the two marked):
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`ALLOWED_ORIGINS`, `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`.
Rotate all keys before first deploy (Phase -1). See `SECURITY.md`.

## Docs

- `DECISIONS.md` — locked product/architecture decisions + deletion log
- `CHANGELOG.md` — release history (keep-a-changelog)
- `CONTRIBUTING.md` — branches, commits, PR rules
- `SECURITY.md` — disclosure policy + current posture
- `docs/AUDIT_PLAYBOOK.md` — the 10 audit rules
- `audit/AUDIT_LOG.md` — append-only audit sign-off log
