# Phase 05 — Stale-file safety, docs, promotions, retro

**Goal (one line):** consumers can see and safely quarantine stale files (report → attic, never delete), the docs describe the product model, and proven TRIAL lints get promoted.
**Appetite:** 0.5 weeks — blown appetite = cut scope or kill, never extend silently.
**Depends on:** phase-04

## Exit criteria (Definition of Done)

- [ ] `--prune-report` lists unowned target files, exit 0, mutates nothing (REQ-10)
- [ ] Attic mode moves unowned files to `.claude/attic/<date>/` and prints the moved list; no delete code path exists in either twin (REQ-10)
- [ ] ~~per-product docs sets~~ CUT (no REQ or ADR behind that architecture); sync keeps ONE corrected meta-doc set
- [ ] README + docs/usermanual.md + docs/blueprint.md + docs/how-it-works.md rewritten for the product model; known drift fixed (gstack-comparison installer line)
- [ ] product-lint TRIAL checks promoted to FAIL via docs/trial-ledger.md evidence (fixture-proven + 3 clean runs) — or explicitly kept WARN with the ledger saying why
- [ ] `/arc-retro` run; scoreboard row appended to docs/retro-log.md; tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

Coarse (refined at phase start): prune-report bats (stray file listed, nothing moved) + attic
bats (moved, printed, restorable) + docs-drift gate green + live demo on a legacy-layout target.

## Rabbit holes in this phase

Auto-pruning ambition — report and attic only; deletion never ships (No-go, non-negotiable).

## Out of scope for this phase

Extraction/packaging — demand-triggered next cycle (ADR-0016). v2 resume decision (ADR-0017 trigger fires at initiative close).

## Your-setup / pending

Nothing — all local.

## Non-negotiables (verbatim from PLAN)

- Bare `sync-to-project TARGET` output stays byte-identical to pre-initiative — golden-output bats case green on every PR of this initiative (products are additive under the umbrella, ADR-0014); the golden fixture may only be regenerated via a reviewed diff naming the intentional change — silently re-recording it to match new output is a gate failure, not a fix.
- Every new parser (manifest reader, resolver, product-lint) AND the byte-diff/golden-output comparison gates get an adversarial construct-a-breaking-input pass; found holes fixed + pinned as red fixtures BEFORE any FAIL-mode promotion (council v2+v3: 43 holes in gates that passed their own tests).
- Physical re-homing lands only behind the byte-diff gate — defined as: per-file SHA-256 over content with line endings normalized to LF before hashing, executable bit compared separately, symlinks resolved before hashing; installed tree provably unchanged, per product move (ADR-0018).
- Consumer repos: never delete — attic move to `.claude/attic/DATE/` only, report before mutate.
- Every hook/script change ships with a bats test. CI red = no merge on the arc repo.
- Cross-platform: Git Bash (Windows) + ubuntu + macos CI; bash-3.2/POSIX; no new PowerShell logic beyond the dumb copy loop (ADR-0015).
- New lint checks start WARN in the TRIAL set; FAIL promotion only via docs/trial-ledger.md evidence.
- Engine scripts assume no Claude (ADR-0013 writing rule, inherited).
- Every `/arc-phase-done` on this initiative commits an evidence bundle.
