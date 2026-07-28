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

**Two honest gaps, neither blocking the DoD:**
1. **The live PASS path was never exercised.** Both real surfaces genuinely FAILed, so
   stamp-on-PASS is proven only by bats (tests 8, 13), not by a live run. First clean surface
   in Phase 1/2 exercises it for real.
2. **The critic missed the third planted defect** — mismatched corner radii on KPI cards 2 and
   4. It caught 2 of 3. Real signal about critique sensitivity on shape-system defects; worth a
   Phase-1 brief/kill-list line or a retro item, not a silent pass.

**Next action:** `/arc-phase-done 0` — every exit criterion is met except the tracker row
itself, which is that command's job.

**Two spec amendments this session, both recorded:** ADR-0047 (runner owns the verdict + the
`review.completed` receipt; the critic emits evidence only — criteria 3 and 7 contradicted each
other) · `products/design/manifest.json` + the `arc-products.mjs` CATALOG entry were pulled
into Phase 00, because arc's own invariant (`sync.bats` test 23) refuses any file under
`.claude/` that no manifest owns. Registration only; REQ-06's resolution/lint/install proof
stays in Phase 01. sync-golden regenerated twice, each time a reviewed diff (8 intended new
paths, then 1 intended hash).
