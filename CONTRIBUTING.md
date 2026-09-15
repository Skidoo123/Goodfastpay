# Contributing to Goodfastpay

## Branches

- `main` is protected. Never push directly.
- Branch naming: `feat/<slug>`, `fix/<slug>`, `sec/<slug>`, `chore/<slug>`.
  Example: `fix/withdrawal-currency-refund`.

## Commits

Conventional Commits. Scope the area. One logical change per commit.

```
feat(api): add delete_bank owner-scoped handler
fix(portal): guard bank-name resolution with modal fallback
sec(auth): remove demo-email fallback from callClientApi
chore(audit): add rate-ticker to forbidden-files list
```

## Pull requests

Every PR must:
1. Pass `npm run verify` locally (paste output in the PR).
2. Fill out `.github/pull_request_template.md` completely.
3. Get 1 approval; **tech-lead approval is mandatory** for `api/`, `supabase/`, or any money path.
4. Keep `audit/AUDIT_LOG.md` updated if the change affects security posture.

## Non-negotiable code rules

1. No balance math outside `api/_lib/ledger.js` + the `apply_ledger_entry` RPC.
2. No amounts from the client — intent only; the server decides numbers.
3. No `innerHTML`/`document.write`/`eval` in new code — use `js/safe-dom.js`.
4. No secrets in code, logs, or tests. Ever. `npm run lint:secrets` enforces it.
5. No new `getElementById` target without a matching `id` in HTML or a null guard.
6. Every new server action needs: validation, auth check, audit entry, and a row in
   `audit/config/audit.config.json` `server_actions`.
7. Migrations are append-only and numbered. Never edit a shipped migration —
   write a new one. 004-pattern rule: destructive migrations ship gated with a
   backup + rollback note.
