# PROGRESS.md — design v2 "Eyes, Taste, Rivals"

status: LIVE
cycle: arc-design v2 (Cycle 16, opened 2026-08-23)
phase: 01
appetite: 12.5d
burn: 3d
blocked-on: —
depends-on: —

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green on CI read per JOB + live demo + exit criteria + evidence). Evidence over
> assertion. Evidence is lane-scoped at `initiatives/design/evidence/phase-NN/` (ADR-0055).
> ADRs, the retro-log, HISTORY and the trial-ledger stay at repo root (ADR-0053). This lane
> holds ADR century **1400–1499**; ADR-1400..1417 are written there.
> Cycle 3's frozen history: [`HISTORY-INDEX.md`](HISTORY-INDEX.md). The pre-v2 idle tracker is
> archived at [`archive/PROGRESS-idle-2026-08-23.md`](archive/PROGRESS-idle-2026-08-23.md).

## Phases

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Renderer proof + isolation — `--session` mandatory in explore mode, `(route, session)` duplicate discriminator, session-less meta refuses, stable-shutter re-proved, callers swept mechanically, and the route-keyed output path re-scoped so two renders of one route can coexist | 1.5d | ✅ 2026-08-23 |
| 01 | Eyes + viewports + canvas gate — composer scoped-Bash render grant, iron-law read allowlist, ≤3 immutable iterations, platform-contract viewports, marker-based doc-surface gate, sibling-render negative control | 1.5d | pending |
| 02 | Registry + curator — `design.sources.yaml` + lint, `design-curator` at balanced-workhorse, robots.txt preflight, real pack from the two permitted galleries, planted-PNG ignore assertion | 1.5d | pending |
| 03 | Taste loop — jury amended FOUR→N, one juror at high-judgment, pack-anchored BELOW-BAR, controlled owner blind score. **Carries the taste tripwire that gates phases 05–07** | 2d | pending |
| 04 | EXP-A1 — ADR-0070's paired harness in the new regime, prediction pre-registered, reference item present, zero writes into model-policy's sealed bundle | 0.5d | pending |
| 05 | Live sources — shadcn + 21st.dev search wiring, `.mcp.json` under the shared-file protocol, per-run availability lines, COULD-NOT-SCAN as its own outcome | 1.5d | pending |
| 06 | Rival spike — terms clearance recorded FIRST, one provider one fixture, version+request+schema receipted, offline self-containment check, no adapter before the receipt | 1d | pending |
| 07 | Rival integration — adapters on the engine driver pattern, one blind jury over arc×3 + rival + reference, rival-beats-all-arc rate receipted either way, blindness proved adversarially on two surfaces | 2d | pending |
| 08 | Governance + retro — packager refuses non-arc renders and absent provenance, spend caps, manual-drop door, all three sealed predictions settled | 1d | pending |

## Done-log

**Phase 00 — CLOSED 2026-08-23.** REQ-01 green on `arc-ci` run **32655931704**, head SHA
`40bbc2be`, **19/19 jobs read per JOB** across ubuntu 18/20/22, macOS and Windows. Tests 490–509
ran as a contiguous block with no gaps. Red-first is a fact in git history, not a claim: run
**32653287707** on the tests-only commit recorded `not ok 490` and `not ok 491` before any
implementation existed. Evidence: `initiatives/design/evidence/phase-00/bundle.md`.

Two fresh attackers on different surfaces returned **26 findings with one overlap** — both
independently found that a value-taking flag given last spins the argument loop **forever**,
hanging a CI leg, with the fix already written in the test fixture 30 lines away and never
carried to the script it fakes. 22 fixed, 4 explicitly accepted in writing.

**CI then found three things neither attacker did**, all invisible on this box: `[!a-z0-9-]` on
the session id is a locale-collation trap that accepts `Design` on macOS and collides with
`design` on a case-insensitive filesystem — the exact defect documented in a comment two files
away; `portability.bats` keys its allowlist on `path:lineno` and my edits shifted every entry;
and `portfolio-board.bats` had pinned "the design lane is IDLE" as an invariant, which Cycle 16
falsified. **The caller sweep's twin was in CONSUMPTION, not invocation** — no caller needed a
new flag, but `design-critique.sh` reads the output path.

**Kickoff, 2026-08-23.** Lane resolved `design` (via arg); WIP 6 counted, informational. Preflight
archived the idle tracker rather than overwriting it. Brownfield survey run, then **its two
load-bearing claims were checked against the tree and one was wrong** — `ui-composer` has no Bash
at all, so DSV-B is a larger change than filed. Century **1400–1499** claimed after a 24-worktree
sweep found `face` already holding 1300–1316 from an unmerged branch, which this worktree's own
band table still lists as free. Research verified three external forks; four claims in the design
source turned out stale or wrong (PR #61 already merged, v0 GA not beta, the composer grant, and
a phase table summing to 11d against a declared 10d). **Three fresh attackers then returned 21
findings across three surfaces with almost no overlap** — 19 applied, 2 applied in modified form,
0 rejected outright. The two that changed the shape of the build: the renderer's output path is
keyed on route ALONE, so iteration receipts could not have coexisted on disk and ADR-1417's
discriminator had nothing to compare (moved into Phase 00); and ADR-1415's read allowlist had no
enforcement surface at all, since `ui-composer` declares unscoped `Read` and the iron law is
prompt prose — its negative control would have tested compliance, not refusal. Appetite moved
11d -> 12.5d to cover that plus the mandatory adversarial pass missing from Phases 03 and 07.
**Simulation gate: 12 blockers -> 2.** Both remaining were closed (ADR-1417's third case had a
named fixture but no refusal contract; the caller-sweep DoD contradicted the out-of-scope line)
but are **NOT re-verified** -- the process permits one respawn and it is spent, the same posture
the engine lane recorded at 18 -> 6. A third round would be patching against the gate.

## Appetite burn

**3 of 12.5 days used (24%)** — corrected 2026-09-16 from a `1.5d` that stopped moving when Phase
00 closed; the branch carries commits on three build days (08-23, 08-24, 08-25). **The 50%
tripwire is CROSSED:** day 3 ended with Phase 01 open. Its stated purpose is to reassess the
renderer approach, and the renderer phase (00) closed green on day 1 — the overrun is Phase 01's
two adversarial passes (42 findings), not the renderer. **Owner ruled 2026-09-16: no scope cut,
all nine phases continue on the corrected burn.** Kill criteria: 50% tripwire if phases 00+01 are not green by end of day 3;
taste tripwire before any rival spend if the post-Phase-03 controlled owner score does not beat
a FRESHLY MEASURED plain-prompt bar after one re-run. The `~40/100` figure was carried forward
from prose and has no measurement behind it, so Phase 03 re-derives it on the same brief, item
count and panel before comparing.

## Now

**Position:** **APPROVED by the owner 2026-08-23** and building. **Phase 00 is CLOSED**; Phase 01 is open. Working mode
set by him at approval: phases run SERIAL, one lane branch `feat/arc-design-v2-c16`, pushed
freely, **one PR kept open and merged only when all nine phases are done**. No local test runs at
all -- CI is the only gate. Multiple agents are authorised where they help.

**Spine receipts:** the two kickoff receipts are NOT on the spine
yet and cannot be emitted from here** — `arc-event` refuses inside a linked worktree by design
(`SKIP WORKTREE_SPINE`), because `.claude/state/` is gitignored and an approval written here would
be real, valid, and invisible to `arc-inbox`, which would print "no open approvals" while one sat
in this tree. Both must be emitted from the main clone at `E:/Work_Hub/01_Automemory/arc`, or
after this branch merges.

**Phase 01 build state.** Three slices are in, each red-first: REQ-02a the composer read boundary
as a marker-armed PreToolUse Read hook (ADR-1415), REQ-02b the self-review manifest substantiated
against the artifacts, REQ-03 the platform contract becoming the render set plus the surface gate.
Two fresh attackers on different surfaces then returned **26 findings**; `05fc34d0` closed the
mechanical half.

**The open half is written down** at
[`evidence/phase-01/adversarial-open.md`](evidence/phase-01/adversarial-open.md) — it is a live
worklist, not a report. Its headline is the one that matters: **the three gates have zero
production callers**, so nothing arms the marker and the hook is a no-op outside `tests/`. The
slices are green on CI and the gates do not yet guard. Also open: the boundary matches `Read`
while `ui-composer` also holds `Grep` and `Glob` (this is the kickoff assumptions-ledger trigger,
**FIRED**, owed a `/arc-change` route); the scope suite tests argv while production sends stdin;
`--surfaces` only checks `<section>`, so a div-built page passes with zero markers; `selfreview`
is opt-in; and the renderer's output path carries no viewport, which makes `coverage`
unsatisfiable by anything it can write.

**Update 2026-08-24.** Six of the seven findings are closed, each red-first on CI and then green:
`L1` the gates get a caller (`design-explore.sh compose` / `compose-done`, on the
`design-critique.sh begin/finish` pattern), `L2` the scope check reads `tool_name` so an
unscoped `Grep`/`Glob` fails closed while a malformed `Read` still fails open, `L3`/`S2` the
suite now drives the real dispatcher on stdin, `L4` a page declaring no surface at all is
refused, `L5` iteration receipts with no `self-review/` are a contradiction rather than a pass,
`S3` the viewport joins the explore render path and a self-review row claims about the widest
viewport, `S4` `render` writes where the gates read.

**One row is blocked and is the owner's:** `.claude/settings.json` must change
`"matcher": "Read"` to `"matcher": "Read|Grep|Glob"` on the `PreToolUse-read.sh` entry. That
file is outside what this session may edit. Until it moves, Grep and Glob never reach the
dispatcher and `L2`'s script-side fix is unreachable in production. Two cases are left RED
naming exactly that, and on the fix run they were the **only** failures on any leg.

**Update 2026-08-25 — the second adversarial pass RAN, and it was the expensive one.** Two fresh
agents on different surfaces returned **16 CONFIRMED findings and 2 surviving mutants**, all
executed against the real scripts. Both found the `NF=8` defect independently. All 16 are closed
(`e1f24c93`, `55b3af56`, `24be889a`, `2c2481e6`).

Two of them said the *design* was wrong, not a line:

- **the read boundary was a single global marker** while explore mode runs three composers, so
  the last `--begin` won for everybody: composer a was allowed to read variant-b and refused its
  own directory. Now per-composer, `--end` names what it releases, and more than one armed is a
  refusal — a filesystem marker cannot tell which composer is calling, so the honest contract is
  serial composition and the gate says so.
- **the composer held unbounded `Write` with no write boundary at all**, so it rewrote the marker
  that constrains it and then read the sibling. `composer-write-check.sh` +
  `PreToolUse-edit.d/11-design-composer.sh` now scope composer writes to its own variant dir,
  naming the marker and the guard as escapes rather than ordinary mistakes.

**Phase 02 has started** (it depends on phase-00, not phase-01). Slice A is in: `design.sources.yaml`
with ADR-1412's eight rows, `design-sources-lint.mjs` as the permission gate, verified with a
control plus one mutant per invalid-field class. Registry deliberately does **not** ship to
consumer projects — it carries the owner's approvals.

**Update 2026-09-16 — resumed after a three-week gap.**

- **An abandoned composer boundary had locked this worktree.** `lexos-p01/variant-a` was armed on
  08-25 by an explore run that never reached `compose-done`, and every Read, Grep and Glob here was
  refused — the operator's included — until it was released by hand. Released with
  `composer-scope-check.sh --end lexos-p01 variant-a`; the variant's files are untouched. Routed
  via `/arc-change` as a Phase 01 exit criterion plus an ADR-1415 amendment: the marker's `pid=` is
  the `--begin` process's own pid and is dead immediately, so it can never be a liveness signal,
  and age must never relax a refusal.
- **The kickoff assumption on the read allowlist is marked `FIRED 2026-08-24`** in PLAN's ledger.
  Its fix (`5e33f34b`, matcher `Read|Grep|Glob`) and its tests were already in; the route was not.
  The matcher change was the "owner row" listed above as blocked — it is closed.
- **`origin/main` merged in** at `2f49aad1` (8 commits, incl. #225's calendar fix), no conflicts;
  `tree-manifest.txt` re-derived after the merge and byte-identical to the merged file (352
  lines). `arc-ci` run **35120950390**: 14/19 jobs green, and the 5 red selftest jobs fail on
  `tests/design-refpack.bats` alone (14 each) — Slice B's red-first tests, as designed —
  with `reconcile: declared 3535, executed 3535`.
- **Phase 01's live demo brief was an owner question.** The spec names `lexos-case-workspace`
  because it declares mobile `yes`; `face-hq` declares mobile `no` and cannot prove the
  two-viewport path. LexOS explores are already committed four times, but committing more LexOS
  pixels to this public repo is an outward action.
- **Owner ruling 2026-09-16, one "ok" over three recommendations:** (1) no scope cut, (2) the
  stale-boundary fix plan as filed in the Phase 01 spec, (3) the demo runs on the LexOS brief as
  specified, and its evidence commits **text only** — shas, manifests, the by-hand verdict — never
  the LexOS HTML or PNGs. Not yet a `decision.recorded` receipt: `arc-event` refuses in a linked
  worktree, so it is emitted from the main clone or after the merge, with the kickoff pair.
- **The lock covered writes too.** The same marker arms `composer-write-check.sh`, so the note
  lands on both refusals — the read-fixed, write-left-open twin is exactly the shape this lane has
  shipped before.

- **The stale-boundary fix, built and attacked.** The fix was proven red-first twice on
  `arc-ci`:
  - Run **35124911002** at `c6f33b7f`: 9 of the 10 composer cases were red for the reasons they
    name, and the release pin was green as designed.
  - Run **35126856883** at `2c8ae714`: those 10 went green, and the 4 critic-twin cases were red
    first.
  - Both runs showed `reconcile: declared = executed`, and the only other failure was Slice B's
    14 known reds.

  Two fresh attackers then returned **20 findings with one overlap**. 18 are fixed and 2 are
  accepted in writing; the dispositions are in `evidence/phase-01/adversarial-open.md` § Third
  pass.

  Most findings were against the tests. A "stale allows non-siblings" mutant, a note on only some
  paths, and a note on stdout all passed. The worst code finding was the change manufacturing the
  lock it diagnoses: `--begin` exited 2 after writing the marker. Fixing turned up two more that
  were my own:
  - a line-bounded reader that took over five minutes on a megabyte marker line — a timeout the
    harness treats as allow;
  - a late library load that clobbered `MARKER` and refused the composer's own writes. The
    scratch replay caught this before commit.

- **Review pass, then CI clean on the whole slice.** `code-reviewer` returned fix-first with 4
  warnings; all were fixed at `fba9a89e`. Dispositions are in `adversarial-open.md` § Fourth
  pass. W2 happened to this session mid-edit: a stale core refused its own reads with nothing
  armed.

  `arc-ci` run **35133832959** at `fba9a89e`: 14/19 jobs green. Each of the 5 red jobs fails on
  `design-refpack.bats` alone, which is Slice B's 14 red-first tests, with `reconcile: declared =
  executed` on every leg. **macOS shard 1/3 is green and ran every critic and adversarial case**
  (declared 1236, executed 1236). That confirms the macOS-only critic failure was the test
  helper's nested escaped quotes and not the boundary.

- **Phase 01 live demo, in flight: explore `lexos-p02`.** Two real defects have already been
  found in Phase 01's own machinery, both before any evidence was written.

  **Setup.** The director assigned command center / guided workflow / narrative, differing on 7/7
  structure dimensions and 4/4 art axes. Each `thesis.txt` carries the canonical case data,
  because composers may not read `matrix.md`.

  **Defect 1, the composer contract.** It never named `self-review/manifest.md`, its row shape,
  the hash source or the mobile render, so a composer following it to the letter failed the gates
  it feeds. Fixed at `334e991a`, before any composer ran.

  **Variant A** cleared every gate with 2 iterations. **Its four claimed fixes were checked by
  opening the iter-1 and iter-2 PNGs by hand**, at both viewports:
  - an uppercased status pill
  - a command line cut mid-word
  - four boxed registers
  - a mobile dock that swallowed the Notes register

  All four are visibly fixed. Seen by hand but not caught by the composer: legal content truncated
  with ellipses, the mobile due-this-week strip clipping, and about 60% empty ruled rows on
  desktop. Those are critique inputs for Phase 03, not Phase 01 gates.

  **Composer prompts are not identical.** B's prompt (and C's) adds a line asking the composer to
  look hard for truncation and mobile clipping, learned from A. Phase 03 must weigh that before
  comparing the three.

  **Defect 2, the self-review gate.** Variant B's iteration 3 fixed a mobile-only textarea
  defect. The gate judged every row at the widest viewport, so a single-surface fix was
  unrecordable. Red-first at `6f99ff09`. The row now names its surface by its hashes; the rule
  is in the Phase 01 spec.

- **The live demo is complete; Phase 01 still cannot close.** Evidence:
  [`evidence/phase-01/live-demo-lexos-p02.md`](evidence/phase-01/live-demo-lexos-p02.md). It is
  text only, and all 13 full hashes in it were verified against the renders.
  - All three variants cleared the composer gates (4 manifest rows) and `check` (director call
    6/7 structure, 4/4 art).
  - Nine claimed fixes were each confirmed by opening the iteration PNGs by hand.
  - Five defects were found in Phase 01's own machinery: four fixed or recorded, one open.
  - **The open one: `ui-composer` Bash was never scoped.** A subagent's `tools:` field takes
    tool names only, so `Bash(prefix:*)` granted all of Bash. The composers used Bash for node,
    sed, python and PowerShell. A transcript audit found no sibling or boundary file touched,
    which means isolation held in practice but was never enforced.
  - Red-first for the one-surface self-review rule was confirmed on every leg of run
    35142810771: exactly the two intended cases failed.
- **Owner ruling 2026-09-17 ("sari pannu"), on both recommendations:**
  1. approve the temporary probe that checks whether a PreToolUse payload carries `agent_type`;
  2. a composer Bash-scope enforcement fragment under `.claude/hooks/PreToolUse.d/`, which is
     the owner's edit because `.claude/hooks/**` is governance-denied.

  The auto-mode classifier had denied the probe earlier as Self-Modification, before this
  ruling.
- **CI: Windows shard 6/12 hung in `Run bats self-tests`** on two consecutive runs (35136412678
  and 35142810771, both cancelled after about 90 minutes) with no TAP in the log, because the
  MSYS pipe is buffered. `fba9a89e` passed the identical 14-file shard. Cause not yet known.

- **2026-09-17, early hours: where this stopped.**
  - **Pushed and green:** `a420fa48`, arc-ci run 35150455604, 14/19 jobs green. The 5 red jobs
    fail on Slice B's 14 refpack tests alone, with `declared = executed` on every leg. That run
    covers the self-review fix (`8c0d46be`), the colour-literal message fix (`d42ee967`) and the
    demo evidence. **Windows shard 6 did not hang on it**, so the two earlier hangs look like
    runner flake. Watch for a third.
  - **The `agent_type` probe was run under the owner ruling and removed immediately.** Hook
    payloads carry `agent_id` + `agent_type` for a subagent (`"Explore"` measured) and neither for
    the main session.
  - **Composer Bash boundary:**
    - red-first at `a16b189e`, 12 cases in `tests/design-composer-bash.bats`;
    - implementation pushed at `fd94e8f1` (`composer-bash-check.sh`, plus the contract, the
      ADR-1415 amendment, the manifest and the golden);
    - a jq and no-jq smoke run in a scratch repo passed every case.
    - Its two CI runs were still in flight at the stop.
    - **A two-surface adversarial pass was running at the stop.** Its findings are appended to
      `evidence/phase-01/adversarial-open.md` § Fifth pass, if they arrived before the session
      closed. If that section is missing, re-run the pass.

**Resume here, in order:**
1. **CI.** Read per JOB for `a16b189e` and `fd94e8f1`.
   - Expected at `a16b189e`: the composer-bash refusal cases red.
   - Expected at `fd94e8f1`: only the owner-fragment case red, plus the refpack 14.
2. **Attack findings.** Fix every finding in § Fifth pass (red-first where it is a behaviour),
   push, and read CI.
3. **Owner edit.** Once the pass is fixed, the owner runs
   `cp tests/fixtures/hooks/PreToolUse.d/10-design-composer.sh .claude/hooks/PreToolUse.d/10-design-composer.sh`.
   Then register that fragment in `products/design/manifest.json` → `files`, regenerate the sync
   golden, push, and confirm the fragment case goes green.
4. **Re-verify one composer.** Run one live composer turn to prove the enforced scope does not
   break the real loop (render, read the PNG, Write the manifest).
5. **`/arc-phase-done 01`.**
6. **Decision queued for the owner.** The read and write boundaries can scope to `ui-composer` by
   `agent_type` (ADR-1415 revisit trigger), which ends the operator lock and allows parallel
   composition. Route it through `/arc-change` with a recommendation.
7. Phase 02 Slice B.

Open findings and the running defect list for the next attacker prompt are in
[`evidence/phase-01/adversarial-open.md`](evidence/phase-01/adversarial-open.md).

**Owner items running in parallel** (none block Phase 00):
- ~~merge PR #61~~ — **already merged 2026-07-29**; no action outstanding.
- By Phase 05: pay for Mobbin Pro or keep it `off` (recommendation on file: galleries-only,
  revisit after Phase 03's score).
- By Phase 06: which rival goes first. The design source recommended v0; the evidence gathered at
  kickoff points the other way — see ADR-1413.
- Before Phase 04: replace the session-authored EXP-A1 prediction with his own, if he wants one.
