# PROGRESS.md — design v2 "Eyes, Taste, Rivals"

status: LIVE
cycle: arc-design v2 (Cycle 16, opened 2026-08-23)
phase: 01
appetite: 12.5d
burn: 1.5d
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

**1.5 of 12.5 days used.** Kill criteria: 50% tripwire if phases 00+01 are not green by end of day 3;
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

**Next step:** wire the three gates into the explore flow — that is what turns the rest of the
list from "untested" into "testable against the path production actually uses". Then the second
two-surface adversarial pass, because every one of those fixes is new code.

**Owner items running in parallel** (none block Phase 00):
- ~~merge PR #61~~ — **already merged 2026-07-29**; no action outstanding.
- By Phase 05: pay for Mobbin Pro or keep it `off` (recommendation on file: galleries-only,
  revisit after Phase 03's score).
- By Phase 06: which rival goes first. The design source recommended v0; the evidence gathered at
  kickoff points the other way — see ADR-1413.
- Before Phase 04: replace the session-authored EXP-A1 prediction with his own, if he wants one.
