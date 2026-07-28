# PROGRESS.md — Cycle 3 · arc-design "The Designer"

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green + live demo + exit criteria + evidence). Evidence over assertion.
> Predecessor (Cycle 2 · Receipt Spine) CLOSED 2026-07-28: `docs/archive/PROGRESS-2026-07-28.md`.

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Steel thread: read-only vision critic + edit-hook scope + spine receipt + warn gate + minimal brief template → one real route inspected e2e | 1.25 days | ✅ 2026-07-28 |
| 01 | Brief mode (4 contracts) + design-lint v0 (adversarially passed) + `products/design/` manifest module | 1 day | pending |
| 02 | Explore: theses → 3 isolated variants → critique loop → blind ranking → pick + prediction receipt (GATE: spine dedup fix landed, ADR-0044) | 1.5 days | pending |
| 03 | Intelligence library + LexOS pilot e2e + blind-test launch (evidence may trail, ADR-0041) | 0.75 days | pending |

**Appetite burn:** ~1.1 of 5 days used (Phase 00 closed). Kill tripwire is 2.5 days with
Phase 01 not done — checked at this close, not fired, 1.4 days of headroom before it is.

## Done log

- 2026-07-28 — **Phase 00 CLOSED** (`/arc-phase-done 0`). Shipped: `design-critic` agent
  (no Edit, scoped receipt Bash) · write boundary (`10-design-critic.sh` +
  `critic-scope-check.sh`, marker-scoped) · deterministic full-page render
  (`design-render.sh`) with blank + stale-duplicate refusals · runner
  (`design-critique.sh begin|finish`, PASS ≡ zero VIOLATION) · `design` warn gate + its
  `arc.gates.yaml` row · minimal brief template · planted-defect fixture (regenerable).
  **Tests: 389 full-suite green on 3 OS** (CI run `30364828766`, the authority — local runs
  are touched-files only). 29 of those are this phase's own `design-steel-thread.bats`.
  **Time: ~1.1 days vs 1.25 appetite** — inside it. Evidence bundle verified at `fa794ea`.
  REQ-02/03/04 → validated. Live proof: critic caught the planted lorem ipsum; the real
  route went 2 VIOLATION → 1 → 0 across three rounds ending in a live PASS with the ledger
  stamped; the hook blocked a real out-of-boundary write.
  `amendments: 2` (ADR-0047 verdict ownership, ADR-0048 agents-judge-scripts-measure —
  both amended phase specs) · `reopened: n` · `t-to-phase0: 0 days` (kickoff and Phase 00
  both 2026-07-28).
  **Cost of the close: 3 CI rounds.** Two cross-OS path bugs that no local run could catch
  (macOS `/var` symlink, Windows 8.3 names + MSYS argv/env conversion). Both were the same
  mistake — comparing path strings instead of resolving them.
- 2026-07-28 — Kickoff complete (`/arc-kickoff`, tier M): Cycle-2 tracker archived;
  ADR-0033..0046 written (8 locked DES decisions + 4 owner forks + 2 auto-decides);
  PLAN.md + 4 phase specs on branch `feat/design-kickoff`. Design source:
  `docs/strategy/plans/PLAN-design.md` (frozen 2026-07-26).

## Now

**Phase 00 is CLOSED (2026-07-28).** Next: **Phase 01 — brief mode, design-lint v0, module
manifest** (`phases/phase-01-spec.md`, 1 day). Nothing needed from the owner to start
("Your-setup / pending: None").

Phase 00's own record — what shipped, the 389-test 3-OS CI proof, the metrics and the two
cross-OS bugs it cost — is in the Done log above, not repeated here.

### What Phase 01 inherits, and what it now owes

- **Part of REQ-06 already landed.** `products/design/manifest.json` and the
  `arc-products.mjs` CATALOG entry had to exist the moment Phase 00 put a file under
  `.claude/` — `sync.bats`'s manifests-vs-reality invariant refuses any payload file no
  manifest owns. Phase 01 owns what remains: install/resolve proof, product-lint in CI, and
  the old-`/arc-design`-untouched check (ADR-0042).
- **ADR-0048 added work here.** `design-lint` v0 must own contrast and target size for real —
  computed from declared tokens, checked against the floor **the brief declares**, never a
  hardcoded constant. The earlier "contrast-AA deferred" line in the Phase 01 spec is
  reversed. Until that lint ships, contrast defects are suspicions with no authoritative
  number, because the critic is now forbidden from producing one.
- **The critic's blind spot is Phase 01's problem.** It caught 2 of 3 planted defects and
  missed the mismatched corner radii — shape-system inconsistency. The brief's art-direction
  slop kill-list has to carry that weight, not the critic's eye.

### Open follow-ups (neither blocks Phase 01)

1. **`freeze-check.sh` traversal hole.** With a boundary of `docs/design`, a target of
   `docs/design/../../etc/passwd` satisfies its prefix match. The critic's own guard refuses
   `..`; the pre-existing core guard does not. Owner call 2026-07-28: track, do not touch —
   it is a core change with a sync-golden regen. Route via `/arc-change` before Phase 01 closes.
2. **`docs/evidence/phase-00..04` still hold Cycle 2's evidence.** Cycle 2's close archived
   its PLAN/PROGRESS/phase specs but left its evidence in place, so Cycle 3's phase numbering
   now collides with it. Phase 00's bundle manifest is honest (it lists only the artifacts it
   verified, hashed, at `fa794ea`), but the directory reads as mixed. Archiving it the way
   `docs/archive/evidence-orchestrator-2026-07-22/` was archived also means updating three
   live comment references in `.claude/scripts/hq/lib/*.mjs` plus two ADRs, so it is its own
   small change, not a phase-close side effect.

### Awaiting owner sign-off

`approval.requested` is on the spine for moving past Phase 00. Record the decision with
`arc-inbox approve <id> --reason ...` (or `reject`).
