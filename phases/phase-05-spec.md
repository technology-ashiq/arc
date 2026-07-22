# Phase 05 — Docs, promotions, retro

**Goal (one line):** the docs describe the product model, and TRIAL lints that earned it become blocking.
**Appetite:** 0.5 weeks — blown appetite = cut scope or kill, never extend silently.
**Depends on:** phase-04
**Amended 2026-07-19 (ADR-0023):** the attic strand is **scope-cut**. It was built and then cut on the adversarial pass — "not in the registry" also describes every file the consumer wrote, so the mode quarantined their own commands and agents, reproduced on a *fresh* install with a valid registry. Demand was one self-owned repo and 21 files. `--prune-report` (REQ-10, shipped in Phase 4) already covers the real need. REQ-11 → `dropped`; REQ-12 added for what this phase actually delivers. Implementation preserved at `e2b3646`.

## Exit criteria (Definition of Done)

- [x] ~~`--prune-report` lists unowned target files, exit 0, mutates nothing~~ — **shipped in Phase 4** (REQ-10, pulled forward by ADR-0020); validated on venturemind, 21 files
- [ ] ~~Attic mode moves unowned files to `.claude/attic/<date>/`~~ **SCOPE-CUT (ADR-0023)** — REQ-11 `dropped`. Not a deferral for lack of time: the eligibility rule was unsafe and the feature has no user yet. Revisit triggers live in ADR-0023
- [x] `--prune-report`'s output says plainly that the list includes files arc did not install — including the consumer's own — and that not everything in it is stale (REQ-12). The one live defect the attic investigation surfaced — **done 2026-07-19**, three bats cases pin the wording (`tests/prune-report.bats`)
- [ ] ~~per-product docs sets~~ CUT (no REQ or ADR behind that architecture); sync keeps ONE corrected meta-doc set
- [x] README + docs/usermanual.md + docs/blueprint.md + docs/how-it-works.md rewritten for the product model; known drift fixed (gstack-comparison installer line) (REQ-12) — **done 2026-07-22**, all four name the six products and the selective-install command (checked mechanically, 6/6 each); every `/arc-*` command they mention verified to exist
- [x] product-lint TRIAL checks promoted to FAIL via docs/trial-ledger.md evidence (fixture-proven + 3 clean runs) — or explicitly kept WARN with the ledger saying why (REQ-12) — **done 2026-07-22 via the second branch**: all 8 kept WARN, each with a recorded per-gate reason. No gate clears the ≥3-exercised-run bar, and council session 001 conditioned promotion on a governed escape hatch that does not exist
- [x] `/arc-retro` run; scoreboard row appended to docs/retro-log.md; tracker updated (PROGRESS.md row ✅ + done-log) — **done 2026-07-22**: 2 recurring patterns + the scoreboard row in `docs/retro-log.md`, 1 gate-fire row in `docs/trial-ledger.md`, 1 rule in `.claude/rules/testing.md`

## Verification plan

Prune-report bats stay green (the shipped half) + a bats case pinning the new "not everything here
is stale" note + docs-drift gate green + the trial-ledger showing a decision recorded for every
TRIAL check. Attic's verification is retired with REQ-11; its 16 hostile-input cases are preserved
at `e2b3646` rather than deleted.

## Rabbit holes in this phase

Auto-pruning ambition — deletion never ships (No-go, non-negotiable). **And the deeper hole this
phase actually fell into:** building an ownership model (append-only ledger, content hashes, merge
strategies) to make quarantining safe. That work touches the sync write path — the most
golden-gated code in the repo — to serve a cleanup tool with one user, and it was ~5× the whole
phase's appetite. ADR-0023 cut it. The trigger to revisit is a *sync-safety* bug, not an attic one.

## Out of scope for this phase

Extraction/packaging — demand-triggered next cycle (ADR-0016). v2 resume decision (ADR-0017 trigger fires at initiative close).

## Your-setup / pending

Nothing — all local.

## Non-negotiables (verbatim from PLAN)

- Bare `sync-to-project TARGET` output stays byte-identical to pre-initiative — golden-output bats case green on every PR of this initiative (products are additive under the umbrella, ADR-0014); the golden fixture may only be regenerated via a reviewed diff naming the intentional change — silently re-recording it to match new output is a gate failure, not a fix.
- Every new parser (manifest reader, resolver, product-lint) AND the byte-diff/golden-output comparison gates get an adversarial construct-a-breaking-input pass; found holes fixed + pinned as red fixtures BEFORE any FAIL-mode promotion (council v2+v3: 43 holes in gates that passed their own tests).
- Physical re-homing lands only behind the byte-diff gate — defined as: per-file SHA-256 over content with line endings normalized to LF before hashing, executable bit compared separately, symlinks resolved before hashing; installed tree provably unchanged, per product move (ADR-0018).
- Consumer repos: never delete, and never mutate without reporting first. `--prune-report` is read-only and stays that way. Automated quarantine (the attic move) is **scope-cut — ADR-0023**; building one requires an ADR-0023 revisit trigger, because deciding what is arc's to move is the hard part, not the moving.
- Every hook/script change ships with a bats test. CI red = no merge on the arc repo.
- Cross-platform: Git Bash (Windows) + ubuntu + macos CI; bash-3.2/POSIX; no new PowerShell logic beyond the dumb copy loop (ADR-0015).
- New lint checks start WARN in the TRIAL set; FAIL promotion only via docs/trial-ledger.md evidence.
- Engine scripts assume no Claude (ADR-0013 writing rule, inherited).
- Every `/arc-phase-done` on this initiative commits an evidence bundle.
