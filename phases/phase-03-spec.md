# Phase 03 — Physical re-homing (incremental, council first)

**Goal (one line):** scripts move to `.claude/scripts/<product>/` and tests to `products/<name>/tests/`, one product at a time behind the byte-diff gate, with every hardcoded path updated (ADR-0018).
**Appetite:** 1.5 weeks — blown appetite = cut scope or kill, never extend silently.
**Depends on:** phase-02

## Exit criteria (Definition of Done)

Five checkpoints, one per product move, in order **council → core → plan → review → qa**
(git has no scripts — manifest update only). Each checkpoint = git mv + THAT product's
manifest.json explicit-path entries updated to the new locations (resolver plan regenerated,
product-lint green) + hardcoded-path updates + the moved product's tests landing under
`products/NAME/tests/` with the CI workflow's test-discovery path edited in the SAME commit +
full serial bats green + Phase-02 tree-diff invariant re-verified + byte-diff gate green
(installed tree unchanged) + the gate transcript attached to the checkpoint's evidence bundle
(not just eyeballed locally) + commit (REQ-07); a checkpoint with no attached gate transcript
fails phase-done review. The plan-product move additionally dry-runs kickoff-lint against a
throwaway PLAN.md/phases layout (pre-mortem row 4):

- [ ] council moved (council-*.mjs → scripts/council/; fixtures + eval harness → products/council/tests/; council-lint pinned paths updated)
- [ ] core moved (gates/profile/ledger/toolcheck/freeze/common.sh → scripts/core/; common.sh relocated OUT of arc-scan/ — every source path inside the NOT-yet-moved arc-scan/ tree that points at the old common.sh location is patched in THIS checkpoint's commit, since review's own move lands two checkpoints later)
- [ ] plan moved (kickoff-lint.mjs, arc-evidence.sh → scripts/plan/; kickoff-lint root assumptions verified)
- [ ] review moved (arc-scan/ tree, docs-drift, coverage/rls/version gates → scripts/review/; scan-summary.bats grep + gates.yaml check commands updated)
- [ ] qa + git manifests finalized; command frontmatter allowed-tools paths updated across all 21 commands
- [ ] final: CI discovers every relocated test (no stale `tests/` path anywhere in workflow YAML); tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

Coarse (refined at phase start): per-move = full bats (serial, foreground) + byte-diff gate
transcript; final = one real `/arc-review` run + one council session on the mold itself
proving the daily driver works post-move.

## Rabbit holes in this phase

Renaming scripts while moving them — NO: `git mv` only, names frozen (byte-diff depends on it).
Fixing unrelated script debt "while in there" — file it via /arc-change instead.

## Out of scope for this phase

External repos (Phase 4) · attic/prune (Phase 5) · any extraction (ADR-0016).

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
