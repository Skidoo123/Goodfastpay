## What does this PR do?

<!-- One paragraph. Link issue: Fixes #NNN -->

## Verification (paste output)

```text
$ npm run verify
<paste>
$ bash audit/scripts/full-audit.sh
<paste>
```

## Checklist

- [ ] `npm run verify` green locally
- [ ] No secrets added (code, logs, tests, fixtures)
- [ ] No balance math outside `api/_lib/ledger.js` + RPC
- [ ] No client-supplied amounts (`newBalance`-class inputs)
- [ ] No `innerHTML` / `document.write` / `eval` in new code
- [ ] New server action? validation + auth + audit entry + `audit.config.json` row added
- [ ] Migration included? numbered, append-only, rollback noted
- [ ] `DECISIONS.md` updated (if architecture/product decision)
- [ ] `CHANGELOG.md` updated
- [ ] Tech-lead review requested (required for `api/`, `supabase/`, money paths)
