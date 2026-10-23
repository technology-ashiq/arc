# Full-history gitleaks scan (ADR-2208, Phase 00 owner prep 2)

Run 2026-10-24 by the session, on the owner's instruction ("ellame neeye pannu"):
`gitleaks git --log-opts="--all" --redact` with gitleaks 8.30.1, every ref.

**83 findings, 0 real secrets. Nothing to rotate.**

| Rule | Count | Where | Verdict |
|---|---|---|---|
| generic-api-key | 68 | `tests/**` (design-rival 38, launch 15, face 9, others) | planted fixtures that the scanners' own tests detect |
| github-pat | 8 | `tests/{arc-scan,suppress,triage-llm,baseline,arc-profile}.bats` (all 2026-07-09) | planted fixture tokens for the arc-scan suite |
| stripe-access-token | 1 | `tests/fixtures/spine/hostile/43-secret-prefixed-key.json` | hostile-input fixture |
| generic-api-key | 6 | `PLAN.md:245`, `docs/archive/PLAN-2026-07-28.md:259`, `docs/strategy/arc-cycle2-receipt-spine-PLAN-v2.md:165` ("API seal: <hash>"), `initiatives/design/evidence/phase-04/seal-*.json` x2 (sealed-file hashes), `initiatives/legal/evidence/phase-01/fixture-publish-ledger.json:62` (a field named `access_within_hours`) | content hashes and a field name, not credentials |

Per-file context was read only in `--redact` form; no value was printed or stored.
