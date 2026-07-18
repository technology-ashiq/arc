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
the full suite green **on CI, which is the authority** (see the velocity note below) + Phase-02
tree-diff invariant re-verified + byte-diff gate green
(installed tree unchanged) + the gate transcript attached to the checkpoint's evidence bundle
(not just eyeballed locally) + commit (REQ-07); a checkpoint with no attached gate transcript
fails phase-done review. The plan-product move additionally dry-runs kickoff-lint against a
throwaway PLAN.md/phases layout (pre-mortem row 4).

Two additions to the per-checkpoint contract, from the ckpt-1 adversarial pass (2026-07-18):

- **Reference integrity is checked separately from content integrity.** The byte-diff gate proves
  the moved bytes are unchanged; NOTHING proves the callers still resolve. Each checkpoint greps
  every `.claude/scripts/...` reference out of `.claude/commands/*.md` and asserts each path exists
  — `council-lint.mjs:357-364` validates only arc-council.md's YAML frontmatter, never the body, and
  `product-lint.mjs` never opens payload contents. A move can be byte-perfect and still ship broken.
- **Each checkpoint's bundle goes to a checkpoint-private dir** (`--out docs/evidence/ckpt-N-PRODUCT`).
  `arc-evidence.sh:31` builds a per-PHASE dir and `:56` copies to a fixed `test-output.log`, so all
  five checkpoints otherwise resolve to `docs/evidence/phase-03/` and silently overwrite each other —
  and `verify` (`:68-78`) only re-hashes what is currently listed, so the loss leaves no trace.

- [x] ckpt 0 hardening (gate is not done until this lands — PLAN non-negotiable #49): the four holes
      the adversarial pass found in `arc-bytediff.sh` are fixed AND pinned as red fixtures in
      `tests/bytediff.bats` — (a) `:69` `while IFS=$'\t' read` drops the final pair when the pairs file
      has no trailing newline and still exits 0, with `verified N move(s)` corroborating the omission;
      (b) `:53` `[ -e "$new" ]` is case-blind on `core.ignorecase=true`, and `:55` `_mode_idx` then
      returns empty so `newmode="$oldmode"` masks it — verify paths as git sees them, not via filesystem
      stat; (c) no completeness check — the gate cannot know it was handed every move; (d) no
      old-path-removed check. ALSO: `product-lint.mjs` skips only `state`/`attic` (`:174`) while both
      twins exclude `worktrees` — align it, and wire product-lint into CI at repo root (it has no CI
      step today, so "product-lint green" in the contract above is currently unenforced). Fix this by
      teaching product-lint the exclusion, NOT by removing the worktree: `.claude/worktrees/` holds a
      LIVE registered worktree (`claude/arc-orchestrator-design-758d70`), not stale leftovers.
- [x] council moved (council-*.mjs → scripts/council/). Fixtures + eval harness **DEFERRED** (Ashiq,
      2026-07-18): `docs/council/kickoff-v2/fixtures/phase-00/{good-full,bad-nodecision}.md` are pinned
      by `phases/phase-00-spec.md:26` as a CLOSED phase's named REQ-01 fixtures — moving them invalidates
      a closed phase's evidence. Revisit in Phase 5 alongside the doc rewrite. Council-lint's pinned paths
      (`:356` → `.claude/commands/`, `:384` → `.claude/agents/`) are deliberately NOT touched: commands and
      agents do not move in Phase 3 (assumptions ledger row 1), so editing them breaks a passing gate and
      fails byte-diff as a same-file edit. Record the verification, not an edit.
- [x] core moved (gates/profile/ledger/toolcheck/freeze/common.sh → scripts/core/; common.sh relocated OUT of arc-scan/ — EVERY sourcer of common.sh repo-wide is patched in THIS checkpoint's commit, not only those inside the not-yet-moved arc-scan/ tree: `.claude/scripts/arc-evidence.sh:14` (plan-owned) and `tests/test_helper.bash:6,11,21` (used by 9 of 22 bats files, including evidence.bats and bytediff.bats) both source it from outside that tree, so the narrower reading would break the evidence tool during the checkpoint it must document)
- [x] plan moved (kickoff-lint.mjs, arc-evidence.sh → scripts/plan/; kickoff-lint root assumptions verified)
- [ ] review moved (arc-scan/ tree, docs-drift, coverage/rls/version gates → scripts/review/; scan-summary.bats grep + gates.yaml check commands updated)
- [x] qa + git manifests finalized; command frontmatter allowed-tools paths updated across all 21 commands
- [ ] final: CI discovers every relocated test (no stale `tests/` path anywhere in workflow YAML); tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

Per-move = the byte-diff gate transcript + the full suite green on CI; final = one real
`/arc-review` run + one council session on the mold itself proving the daily driver works
post-move.

### Velocity note — where the checkpoint time actually goes (measured 2026-07-18)

Checkpoint 1 took ~2.5h wall clock. The move itself was ~15 min; the rest was analysis,
tracker ceremony, and **waiting on a local test suite that duplicates CI and is slower than it**.
Numbers, so this is not re-litigated from memory:

| | measured |
|---|---|
| bats per-test floor, Git Bash (5 no-op tests) | **2.5s/test** — framework overhead, not our code |
| `_arc_sandbox` per test | ~1s (git block 751ms of it) |
| Full suite, local, one OS | **~20-25 min** |
| Full suite, CI, **three** OS in parallel | **~13 min** |
| `bats self-tests` step: windows leg vs ubuntu leg | **674s vs 76s (8.9×)** |

Consequences, now binding on every remaining checkpoint:

- **CI is the authority for the full suite.** Locally run only the files a checkpoint touches
  (sync/products/gates/bytediff for a move). Running all 22 locally blocks ~20 min to learn
  what CI establishes better, on three platforms, unattended.
- **The evidence bundle carries the CI run reference**, not a local test log. That is stronger
  evidence — 3 OS instead of 1 — and free.
- **Parallelism is unavailable here, do not keep re-testing it:** `bats -j` requires
  `flock`/`shlock`; Git Bash ships neither and scoop has no package. `-j` exits instantly with
  an error, which is easy to misread as a fast green run. It is not one.
- The windows leg's 674s is process-spawn cost, not our tests. It is not optimizable from here;
  it is the price of proving the target runtime works, and it is CI's time, not ours.

### Checkpoint batching — decide after ckpt 2, do not skip

ADR-0018 pre-authorized this exact trade: *"after the first two product moves, if the byte-diff
gate has caught zero issues AND per-move overhead dominates (ceremony > work), the remaining
three may merge into one move — recorded as a phase-spec amendment via /arc-change."*

Ckpt 1: gate caught zero move-integrity issues (it did catch four holes in *itself*, pre-move —
that is the adversarial pass working, not the gate firing).

**Evaluated at ckpt 2 close (2026-07-18) — trigger does NOT fire cleanly. Partial batch.**
The trigger has two conditions and they split:

- *"byte-diff gate has caught zero issues"* — **true.** 13 moves across two checkpoints, all
  content+mode preserved. Ckpt 2 did exercise the mode half for real (4 of its 10 files are
  `100755`), so that half is no longer unrehearsed.
- *"per-move overhead dominates (ceremony > work)"* — **false, and ckpt 2 is the evidence.**
  The gate/evidence/golden ceremony was a small share of the time. The bulk was real breakage
  that only the per-product structure surfaced: three scripts resolved the repo root by counting
  `..` segments and broke the instant they moved one level deeper (`product-lint.mjs`,
  `arc-products.mjs`, `arc-status.sh` — now depth-independent); `sync-to-project.sh`'s RESOLVER
  path pointed at the old location, so a bare sync failed outright; and a path sweep quietly
  rewrote two self-contained test fixtures and the golden manifest itself. None of that was
  caught by the byte-diff gate — the moves were byte-perfect. It was caught by smoke-running each
  moved script and by the affected-file tests.

**Decision: batch plan + qa + git into ONE checkpoint; keep review separate.** plan is small,
qa+git are manifest-only. review is the ~315-ref `arc-scan/` subtree and earns its own gate run
and its own rollback point. Recorded here as the phase-spec amendment ADR-0018 requires.

Consumer-side fallout of these moves — a re-homed script leaves an *executable* stale copy in every
already-installed target — is tracked in **ADR-0020** (proposed): deletion is forbidden by
non-negotiable #51, REQ-10 owns the remedy, and the open question is whether the report half lands
before Phase 4 (first real consumers, REQ-09) rather than Phase 5. Phase 3 does not build prune/attic.

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
