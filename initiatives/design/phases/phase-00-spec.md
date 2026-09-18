# Phase 00 — renderer proof + isolation

**Goal (one line):** `design-render.sh` becomes session-safe and iteration-safe, and its
existing stable-shutter guard is re-proved on this platform — so nothing composes in parallel
on a renderer that races itself.
**Appetite:** 1.5 days — blown appetite = cut scope or kill, never extend silently
**Depends on:** none
**Implements:** ADR-1402 · ADR-1417

## Exit criteria (Definition of Done)

- [ ] The output path is **session- and iteration-scoped**, so two renders of one route can
      coexist as distinct files — the precondition for both ADR-1417 and Phase 01's receipts
- [ ] A `--mode explore|critique` discriminator exists, because the script cannot otherwise
      tell "critique caller, session correctly omitted" from "explore caller, session forgotten"
- [ ] `--session <id>` is **mandatory when `--mode explore`**; omitting it there exits non-zero
      with a named message and never falls back to a default
- [ ] The critique path keeps its existing named session, so isolation from an ambient QA
      session is preserved rather than traded away
- [ ] 3 concurrent renders produce 3 correct route/hash pairs — no cross-contamination
- [ ] Render meta carries a `session` field, and the stale-duplicate guard resolves **all three**
      cases per [ADR-1417](../../../docs/adr/1417-the-stale-duplicate-guard-must-tell-iteration-from-stale-page.md),
      each with its own fixture: same route + same session + same pixels → `unchanged: true` ·
      different route + same pixels → refuse · **same route + a DIFFERENT session + same pixels
      (a crash-retry that minted a fresh session id) → refuse**, which the ADR left unspecified
      and which would otherwise fall through and delete a legitimate retry
- [ ] A meta with an **absent** `session` field **refuses** — it does not fall through to the
      old route-only comparison
- [ ] A same-route, same-session repeat render records `unchanged: true` instead of being
      refused and deleted
- [ ] Stable-shutter guard re-proved: the same route hashes identically across 3 runs on this
      platform (cross-OS equality is explicitly out of contract)
- [ ] Every existing caller of `design-render.sh` located **mechanically** (`git grep -l`) and
      reconciled — not from memory. **The expected result is ZERO required changes**, because
      `--mode` defaults to `critique` and `--session` defaults to `design-critic`: the sweep
      exists to PROVE that, and any caller that would break is a finding, not a chore. Explore
      -mode wiring belongs to Phase 01; the session-id contract Phase 01 must honour is fixed
      here as `<explore-id>--variant-<x>` matching `[a-z0-9-]+`, so Phase 01 invents nothing
      — AND every other route-based staleness or duplicate comparator
      in `.claude/scripts/design/` located the same way (`git grep -n route` across
      `design-critique.sh`, `design-gate.sh`, `critic-scope-check.sh`) and either confirmed
      absent or moved to the same discriminator. The twin fix is the one this repo misses
- [ ] Two-surface adversarial pass by fresh agents (decision logic · shell/OS boundary) on the
      amended guard, holes fixed and pinned as fixtures
- [ ] tests added & green **on CI, read per JOB at the branch head SHA**
- [ ] live demo run + output checked
- [ ] contract tests green against fakes (no external dependency is called this phase)
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

- **Test command:** `bats tests/design-render-session.bats`
- **Expected failure first:** `render_requires_session_in_explore_mode` fails RED before this
  phase is built, with `expected exit 1, got 0` — because today `SESSION` is hardcoded at
  `design-render.sh` L62 and no flag exists to omit, so the runner cannot refuse. A second red
  test, `session_less_meta_is_refused`, fails with `expected refusal, got exit 0`, because the
  current guard compares on route alone and has no session field to miss. Both must be observed
  RED before the fix lands — a green-from-birth test here would prove nothing, and this repo has
  shipped that three times.
- **Live demo scenario:** launch 3 renders concurrently against 3 different routes with 3
  distinct `--session` ids, **repeated 5 times** — the guard walks `$OUT_DIR/*.json` with no lock
  while sibling processes are still writing, so one green run is a coin rather than a gate, and
  zero spurious stale-duplicate refusals across all 5 is the bar; confirm 3 PNG+JSON pairs, each route's hash matching its own
  single-render baseline. Then re-render route 1 twice in the same session with no source change
  and confirm the second is recorded `unchanged: true` and **not** deleted.
- **Real-system check:** inspect `.claude/state/design/renders/` after the concurrent run —
  three metas, three distinct routes, three distinct sessions, no orphaned PNG left behind by a
  refusal path.
- **Expected evidence:** bats output on CI (per JOB), the three meta JSONs, and the pair of
  hashes from the unchanged-iteration case, bundled to `initiatives/design/evidence/phase-00/`.

## Concrete contract — so the executor invents nothing

Every value below was read off the tree on 2026-08-23. The simulation gate returned 12 blockers
against the first draft of this spec; each one is answered here. An executor who has to choose a
filename, a flag spelling or a JSON key has found a gap in this section, not a decision to make.

**Output path (blocker 1).** `OUT_DIR` becomes session-scoped:
`.claude/state/design/renders/$SESSION/`. Within it, `$SLUG.png` / `$SLUG.json` as today, and
`$SLUG--iter-$ITER.png` / `.json` when an iteration is named. `_slug()` is unchanged — it stays
the full repo-relative route with separators encoded, because a basename slug collides.

**Iteration (blocker 2).** A new `--iter N` flag, integer 1–3, optional. Absent means no suffix.
Phase 00 ships the flag and the path only; Phase 01 is what drives it.

**Meta JSON (blocker 3).** Existing keys stay exactly as the Node writer emits them —
`route`, `url`, `png`, `screenshot_sha256`, `viewport` (`WxH@1`), `recipe` — and three are
added: `session` (string, REQUIRED), `iter` (integer or null), `unchanged` (boolean).
**Twin fix, mandatory:** the `printf` fallback branch used when `node` is absent already emits a
DIFFERENT and smaller object than the Node branch (it omits `url` and `png`). Both branches gain
the three new keys, or a box without node silently writes a meta the guard cannot read.

**Refusals — exact text and exit code (blocker 4).** Both exit `1`:
- `design-render: REFUSED -- --session is required in explore mode (no default; a shared session races parallel renders).`
- `design-render: REFUSED -- meta <path> carries no session field; refusing to fall back to route-only comparison.`
- `design-render: REFUSED -- these exact pixels are already recorded for route <r> in session <s>; a different session re-rendering one route to identical pixels is a retry that never re-rendered.`
  (This is ADR-1417's third case. It had a named fixture and no refusal contract until the
  simulation gate caught the gap in round 2.)

**`--mode` default (blocker 5).** `--mode` is OPTIONAL and defaults to `critique`, so every
unmodified caller keeps working unchanged. In `critique`, `--session` defaults to the literal
below. In `explore`, `--session` is mandatory and its absence refuses. This is what makes the
migration safe rather than a flag day.

**Critique session literal (blocker 6).** `design-critic` — the value currently hardcoded at
`design-render.sh` L62. It is preserved exactly, so critique renders keep their isolation from an
ambient QA session.

**Hashing (blocker 7).** Unchanged: sha256 via `sha256sum`, else `shasum`. The existing shape
guard stays — a result that is not 64 hex characters REFUSES rather than recording a CRC in a
field named `screenshot_sha256`.

**Guard scan scope.** The duplicate guard now walks `renders/*/*.json` — ALL sessions, not just
its own — because case 3 (same route, different session, same pixels) is only visible across
sessions. It skips its own meta by path as it does today.

**CI (blocker 8).** Workflow `arc-ci` (`.github/workflows/ci.yml`); the jobs that must be green
are named `selftest (<os>, <node>[, shard i/n])`. Read them per JOB with
`gh run view <id> --json jobs`, and confirm the run's head SHA equals the branch tip before
reporting anything green.

**Adversarial pass mechanism (blocker 9).** Two fresh subagents that have not seen the
implementation, dispatched separately: one prompted on DECISION LOGIC (the three-case
discriminator, the mode/session interaction, the meta parser) and one on the SHELL/OS BOUNDARY
(quoting, glob expansion, exit-status reading, path separators, the node-absent branch). Each is
given the source, the rules, the existing fixtures, and this lane's running list of already-fixed
defects, with the instruction to check each past defect in every OTHER file. Proof it ran:
`initiatives/design/evidence/phase-00/adversarial-logic.md` and `adversarial-shell.md`, each
finding either fixed with a pinned fixture or explicitly accepted in writing.

**done-log (blocker 10).** The `## Done-log` section of `initiatives/design/PROGRESS.md`. The
tracker is the lane's, never the repo root — this is lane-mode.

**Fixtures (blocker 11).** Bats suite at `tests/design-render-session.bats`, helper
`tests/test_helper.bash`, fixture data under the existing `tests/fixtures/design/`. One fixture
per ADR-1417 case, named `iter-unchanged`, `cross-route-duplicate`, `cross-session-same-route`.

**Concurrency harness (blocker 12).** Bash job control inside the bats suite — three
`design-render.sh` invocations backgrounded with `&`, then `wait`, the loop repeated 5 times.
Assertions read `renders/*/*.json` with `jq` (installed on all three CI legs by `arc-ci`).
Read each background job's exit status individually; a `wait` whose status nobody reads is how a
concurrency test passes while a child failed.

## Rabbit holes in this phase

- **Rebuilding the stable-shutter guard.** It is already in tree (~L239). Detour: re-prove it,
  do not touch it.
- **Chasing cross-OS hash equality.** Impossible under `PIN_FONT=0`. Detour: assert per-platform
  internal stability only, and say so in the receipt.
- **Treating the flat output directory as someone else's problem.** It is not a rabbit hole,
  it is this phase's dependency. `SLUG` derives from `ROUTE` alone and the output is
  `$OUT_DIR/$SLUG.png`, so a same-route re-render overwrites the single file at that path, and
  the guard excludes it from comparison by path identity (`case "$m" in "$META") continue;;`).
  Nothing reads a session field to decide anything today. Phase 01's immutable `iter-N`
  receipts cannot coexist on disk, and ADR-1417's (route, session) discriminator has nothing to
  compare, until the output path is session- and iteration-scoped. Detour: **this phase makes
  that path change; Phase 01 does not repeat it.**

## Out of scope for this phase

The composer's render-in-loop and its iteration receipts (Phase 01) · the read-path allowlist
(Phase 01) · viewports derived from the platform contract (Phase 01) · anything touching the
curator, registry or rivals.

## Your-setup / pending

None. This phase calls no external service and needs no credential.

## Non-negotiables (verbatim from PLAN)

- **Look at the artifact before carrying its verdict.** No ranking, score, receipt or package
  is produced from a report about pixels that nobody in the session opened.
- **Zero new spine event kinds.** This cycle rides `review.completed {lens:design}`,
  `decision.recorded` and `note.logged` only.
- **Agents judge, scripts measure — ADR-0048.** A gate never asks an agent for a number it
  can compute.
- **Every new gate, lint and parser gets a two-surface adversarial pass by fresh agents that
  did not write it** — one on decision logic, one on the shell/OS boundary — and that pass runs
  against the PR THAT SHIPS THE GATE, never batched into the phase-close PR that comes after
  all of them. The attacker prompt carries this lane's running list of already-fixed defects.
- **A test that passes proves the assertion held, not that the code ran.** Every gate ships with
  a negative control that actually fails.
- **No reference image, rival draft or third-party screenshot is ever committed to git or
  placed in an outbound package.**
- **A `model:` frontmatter change is a governed tier change** citing ADR-0069 in a reviewed
  diff, never a quiet edit.
- **Shared organs are edited under the shared-file protocol.** Agent contracts under
  `.claude/agents/`, `.mcp.json`, `hq.policy.yaml` and `tests/**` belong to no lane:
  `git log origin/main -5` on the file runs BEFORE the edit, the stronger version is taken at
  merge, and a change to a contract another LIVE lane reads gets a cross-lane note first.
- **Closing a phase moves the lane's bookkeeping in the same commit as the merge, or the one
  right after it.** PROGRESS.md's row, its `## Now`, and `docs/HISTORY.md` move together — a
  lane whose HISTORY says CLOSED while PROGRESS still says LIVE is a failure, not a follow-up.
- **Tests are green on CI, per JOB, at the branch head SHA** — never on this box.
