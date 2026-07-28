# PROGRESS.md — Cycle 3 · arc-design "The Designer"

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green + live demo + exit criteria + evidence). Evidence over assertion.
> Predecessor (Cycle 2 · Receipt Spine) CLOSED 2026-07-28: `docs/archive/PROGRESS-2026-07-28.md`.

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Steel thread: read-only vision critic + edit-hook scope + spine receipt + warn gate + minimal brief template → one real route inspected e2e | 1.25 days | pending |
| 01 | Brief mode (4 contracts) + design-lint v0 (adversarially passed) + `products/design/` manifest module | 1 day | pending |
| 02 | Explore: theses → 3 isolated variants → critique loop → blind ranking → pick + prediction receipt (GATE: spine dedup fix landed, ADR-0044) | 1.5 days | pending |
| 03 | Intelligence library + LexOS pilot e2e + blind-test launch (evidence may trail, ADR-0041) | 0.75 days | pending |

**Appetite burn:** ~0.6 of 5 days used (Phase 00 build session 1).

## Done log

- 2026-07-28 — Kickoff complete (`/arc-kickoff`, tier M): Cycle-2 tracker archived;
  ADR-0033..0046 written (8 locked DES decisions + 4 owner forks + 2 auto-decides);
  PLAN.md + 4 phase specs on branch `feat/design-kickoff`. Design source:
  `docs/strategy/plans/PLAN-design.md` (frozen 2026-07-26).

## Now

**Phase 00 build in progress** (owner gave the start signal 2026-07-28). Kickoff itself is
closed: plan APPROVED, receipt `01KYJZ09NVQJ3F98T6H51Q5RJ5`, artifacts committed in `5eaa8dd`.

**Built and green — 25 of 26 tests in `tests/design-steel-thread.bats`:**
critic write-boundary (hook fragment + `critic-scope-check.sh`, marker-scoped, `..` refused) ·
deterministic render (`design-render.sh`, byte-identical across 3 cold runs, blank + stale-
duplicate guards) · runner (`design-critique.sh begin|finish`, PASS ≡ zero VIOLATION, receipt +
ledger stamp) · `design` warn gate + its `arc.gates.yaml` row · `design-critic` agent ·
minimal brief template · planted-defect fixture (3 defects, regenerable). Touched suites all
green: products 34 · sync 23 · gates 15 · portability 3 · hooks-dispatch 11. kickoff-lint ✔.

**Adversarial pass on the gate: 3 real holes found and fixed, all pinned as tests** — an
artifact declaring no target passed silently (the dangerous one: a malformed critique escaped
enforcement and the gate reported OK); a target inside a fenced code block was enforced as
real; an absolute declared target never matched its repo-relative receipt. 5 further attacks
held (case-varied lens, path-prefix target, non-string target, README, FAIL-counts-as-reviewed).

**LIVE DEMO DONE — 26/26 green (`78c6f6f`).** The registry picked the new agent up without a
restart, so the demo ran in-session with the real `design-critic`.

- Defect fixture → the critic classed the planted **lorem ipsum** and the planted **KPI-label
  contrast failure** as VIOLATION, measuring contrast from sampled pixels (1.34:1 vs the 4.5:1
  AA floor) rather than eyeballing. FAIL, ledger correctly unstamped.
- Real route → 2 VIOLATION, also pixel-measured (badge contrast ~2.76:1; inbox buttons
  ~31–32px against the ≥44px floor). It flagged the un-rendered state matrix as a **reporting
  gap** instead of inventing findings — its iron law holding under real conditions.
- Boundary proven live in both directions: a real out-of-boundary `Write` was blocked by the
  actual hook; the critique-dir write succeeded; the marker was released after each run.
- Gate demonstrated both ways: WARN with receipts absent, exit 0 with both present.
- Both receipts readable through the reader: the runner's verdict + the critic's separate
  `note.logged` evidence — the ADR-0047 split working.

**GAP 1 NOW CLOSED — the PASS path ran live.** Three critique rounds on the real route drove
2 VIOLATION → 1 → **0**, and `finish` emitted `result: PASS` and stamped the review ledger
(`reviews @ 477f3d3: design`). Both halves of the verdict path are now proven live, not just in
bats. The fix loop itself (critic reports → creation side fixes → critic re-verifies) ran for
real, and the boundary caught the creation side mid-run: an attempt to edit
`design-render.sh` while a critique was armed was **blocked by the hook**, exactly as designed.

**Fixes made to the mockup (creation side, tracked by the critique artifact):** `--muted`
`#898781` → `#918f88` (it was 4.49:1 on `--surface-2` cards — a real AA failure, verified
independently) and `button` `min-height:44px` (was 32px, under this project's declared ≥44px
floor).

**BIGGEST FINDING OF THE SESSION — the critic fabricates measurements.** Round 1 reported a
VIOLATION with specific evidence: the L0/L1/L2 badges at `rgb(122,90,48)`, contrast `2.76:1`.
Independent measurement (`getComputedStyle` + a WCAG script) showed those elements are actually
`rgb(137,135,129)` at **4.85:1** and `rgb(183,211,246)` at **7.52:1** — both PASS. The claimed
colour exists nowhere in those elements. Its arithmetic was right *for the colour it invented*
(2.76:1 is correct for `rgb(122,90,48)`); the sampling was invented. In round 2, handed the
real hex value, it computed 5.38:1 / 4.98:1 — matching the independent script exactly.

So: **its arithmetic is reliable, its pixel-sampling by eye is not.** Fabricated precision is
more dangerous than vague vibes, because the numbers make a wrong finding look verified. Note
it also had the right *instinct* — a real marginal failure (4.49:1) did exist nearby, on a
different element than the one it named.

Second render finding, also real: the render captured **viewport only**, so every page taller
than the viewport drew a permanent false "hard clip, no affordance" VIOLATION — the fix loop
could never converge, because the defect was in the camera, not the page. Fixed with `--full`;
recipe now records `full-page`. The critic then **retracted its own finding** as a capture
artifact, unprompted — good behaviour worth keeping.

**Consequences to route before Phase 1 builds design-lint (owner decision pending):**
1. The critic must stop stating measured RGB values and computed ratios as evidence — report
   the visual suspicion, defer the number to the lint.
2. `design-lint` v0 must own contrast and target-size for real (reads tokens, computes WCAG).
   The frozen plan already lists "declared contrast pairs pass AA" — this finding says that
   line is load-bearing, not optional.

**Still open (unchanged):** the critic caught only 2 of 3 planted defects — it missed the
mismatched corner radii on KPI cards 2 and 4. Shape-system defects need the brief's slop
kill-list doing that work, not the critic's eye.

**Tests:** design-steel-thread 26 · sync 23 · products 34 · gates 15 · portability 3 — all green.
sync-golden regenerated once more (1 intended hash: `design-render.sh`).

**Next action:** `/arc-phase-done 0` — every exit criterion is met except the tracker row
itself, which is that command's job.

**Two spec amendments this session, both recorded:** ADR-0047 (runner owns the verdict + the
`review.completed` receipt; the critic emits evidence only — criteria 3 and 7 contradicted each
other) · `products/design/manifest.json` + the `arc-products.mjs` CATALOG entry were pulled
into Phase 00, because arc's own invariant (`sync.bats` test 23) refuses any file under
`.claude/` that no manifest owns. Registration only; REQ-06's resolution/lint/install proof
stays in Phase 01. sync-golden regenerated twice, each time a reviewed diff (8 intended new
paths, then 1 intended hash).
