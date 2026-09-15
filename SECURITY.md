# Security Policy

## Current posture (Sept 2026 hardening pass)

- Server APIs require Supabase JWT; admin routes add a DB role lookup.
- Balances move only via the atomic, idempotent `apply_ledger_entry` RPC.
- RLS lockdown + ledger + audit migrations ship in `supabase/migrations/`
  (apply 001–004 in order, staging first; 004 only after backups + forced resets).
- `npm run verify` (syntax + secret guards) and `audit/scripts/full-audit.sh`
  gate every change. See `docs/AUDIT_PLAYBOOK.md`.

## Known open items (do not treat as resolved)

- Leaked keys in git history are **not yet rotated/scrubbed** (owner action, Phase -1).
- Migrations are **not yet applied** to any live database.
- Auth.js migration, `innerHTML` migration, and provider failover are tracked
  follow-ups, not completed work.

## Reporting a vulnerability

Email **security@goodfastpay.com** (create this inbox before launch) with:
subject, affected surface, reproduction steps, and impact assessment.
Do **not** open a public issue for security reports.

What happens next:
1. Acknowledgement within 48 hours.
2. Triage (Critical/High/Medium/Low) + timeline.
3. Fix on a private branch, backported if needed.
4. Post-mortem appended to `audit/AUDIT_LOG.md` within 48h of the fix.
5. Credit in `CHANGELOG.md` if you want it.

## Safe harbor

Good-faith research against staging (never production user data) that follows
this policy will not result in legal action. Do not exfiltrate, degrade, or
ransom anything; stop at proof-of-access and report.
