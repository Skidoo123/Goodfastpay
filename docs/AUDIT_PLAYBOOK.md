# Goodfastpay — Audit Playbook (human rules)

## Rule A1 — Every PR runs the repo audit
`bash audit/scripts/repo-audit.sh` must pass. No `--no-verify`. No admin override.

## Rule A2 — Every release runs the full audit
`bash audit/scripts/full-audit.sh` with `DATABASE_URL` pointed at a staging replica.
All green. Attach output to the release notes.

## Rule A3 — Reconciliation drift stops the line
If `audit/queries/drift.sql` returns rows in prod, pause money movement first, fix second.

## Rule A4 — Findings append, never delete
`audit/AUDIT_LOG.md` is append-only. Correct mistakes with new rows referencing old ones.

## Rule A5 — Every alert gets a runbook
Alert fires with no runbook → first action is writing the runbook.

## Rule A6 — New forbidden pattern? Same-PR rule
Found in the wild → add to `repo-audit.sh` Section 3 in the same PR that removes it.

## Rule A7 — New architectural element? Same-PR rule
New guard/interface → add a presence check to `repo-audit.sh` Section 4 in the same PR.

## Rule A8 — No silent skips
A check that can't run (no CLI, no DB) fails loudly or prints an explicit skip banner.
Never `|| true` a real assertion.

## Rule A9 — Thresholds live in config, not scripts
Tune via `audit/config/audit.config.json`. Script edits need tech-lead review.

## Rule A10 — Quarterly meta-review
1. Bug shipped that a check would have caught? → Add the check.
2. Check missed a real problem? → Improve it.
3. Check fired falsely? → Fix or remove it.
4. Manual step automatable? → Automate it.
