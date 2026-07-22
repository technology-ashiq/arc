# PROGRESS.md — Cycle 2 · Receipt Spine

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green + live demo + exit criteria + evidence). Evidence over assertion.
> Predecessor (orchestrator) CLOSED 2026-07-22: `docs/archive/PROGRESS-2026-07-22.md`.
> The v2 world-best initiative stays parked (ADR-0017).

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Spine core: dual-mode emitter · canonical serializer · hostile corpus + adversarial pass (ckpt A) · replay · reader · twin determinism CI (ckpt B) | 5 days | 🟡 both ckpts built + green; awaiting CI, then `/arc-phase-done 0` |
| 01 | Factory wiring: EVENT.d fragments + flow emissions + dry-run golden + overhead check | 2.5 days | ⬜ not started |
| 02 | Money + brief: strict revenue ingest (cross-day idem) + one-screen brief + cost (stretch) | 2.5 days | ⬜ not started |
| 03 | Inbox + API seal: approvals flow + cursor catch-up + reader-only grep-lint (TRIAL) | 1.5 days | ⬜ not started |
| 04 | Live dogfood: 5 real days · honest revenue · gap audit · evidence bundle · retro | 3 days (≥5 elapsed) | ⬜ not started |

## Done log

- 2026-07-22 — **Phase 00 ckpt B built** (`33357bb`). `spine.mjs` reader (arc's only public
  API — `--since` resolves by append order, not ULID sort), `arc-replay.mjs` (rebuilds all
  derived state from empty; repairs both crash windows), minimal `arc-brief.mjs`. REQ-04
  twin determinism + sqlite-vs-scan equivalence gate in CI; matrix 3 → 5 jobs (Node 18 leg
  for the no-sqlite path, Node 22 for the accelerator). Assumptions row 2 **measured and
  HOLDS**: 1.1s over a 90-day/3600-event synthetic spine against a 5s trigger, so the
  accelerator stays optional. 47/47 spine tests green. Two bugs found while writing the
  gate: sqlite couldn't see torn lines (engines disagreed on damage), and `withLock` dropped
  the lock when handed an async body.
- 2026-07-22 — **ckpt A validated on 3-OS CI** — PR #44, run 29958837544: ubuntu, windows,
  macOS, ci-tier all green. Local runs are one OS; this is the authority (`d53daed`).
- 2026-07-22 — **Phase 00 ckpt A hardened and DONE** (`107c3c8`). Adversarial pass: 45
  agents, 6 lenses, 38 claims, **25 confirmed** after independent refutation attempts —
  including an escaped-duplicate-key bypass that let a forged `actor`/`outcome` be sealed in
  strict mode, structural credentials landing on the spine untouched, raw secret bytes
  written to quarantine on non-secret rejections (ADR-0028 violated by the code citing it),
  and a lock three processes could hold at once. All 25 fixed. Corpus 37 → 50 fixtures +
  7 behavioural regressions; 29/29 green. Report: `docs/evidence/phase-00/adversarial-report.md`.
- 2026-07-22 — **Phase 00 ckpt A built** (`54c20ac`, `701e990`). Dual-mode `arc-event`
  (hook never blocks / `--strict` exits 2, one validator core), canonical serializer + sha +
  ULID, strict JSON reader, fail-safe multi-view secret scan, lock + single-write append +
  idem index + day-close markers. 37-fixture hostile corpus written and run RED first
  (`docs/evidence/phase-00/red-run-ckptA.txt`) → 22/22 green. Product `hq` registered;
  golden tree-manifest regenerated on a reviewed diff (no `state/` paths — SPINE-B holds).
  Two hardcoded six-product test lists now derive from `products/`. **Not closed:** the
  mandatory adversarial pass is still running; its holes get fixed and pinned before ckpt B.
- 2026-07-22 — **Kickoff.** Orchestrator tracker archived (`docs/archive/PLAN-2026-07-22.md`,
  `PROGRESS-2026-07-22.md`, `phases-orchestrator-2026-07-22/`). ADR-0024..0031 recorded
  (SPINE-A..H). PLAN.md + `phases/phase-00..04-spec.md` written from
  `docs/strategy/plans/PLAN-cycle2-receipt-spine-v2.1.md` (decisions locked, not re-litigated).
  Attack panel: 3 attackers, 18 findings, 12 accepted as exact mutations. Awaiting approval.

## Appetite burn

**~2 of ~12.5 part-time days used** (2.5-week hard cap). Kill check at ~6 days: REQ-02 +
REQ-04 green? If not → cut to spine+replay only. First cut REQ-08; second cut REQ-09's
cursor demo (lint stays). 100% → cut or kill, never extend.

## Now

**Phase 00 is built end to end (both checkpoints); the 5-job CI run is the last gate before
it closes.**
Kickoff approved by Ashiq 2026-07-22 (all three simulation blockers ruled "apply the
proposed fixes"; constants and the ADR-0028 reading accepted; Constitution adoption
deferred). The mandatory adversarial pass has run and its 25 confirmed holes are fixed and
pinned, which is what ckpt B was gated on.

**Next step:** Ashiq pushes `feat/arc-cycle2-receipt-spine` so PR #44 re-runs CI with the
new 5-job matrix (the Node 18 and Node 22 legs have never executed — they were added in this
same commit). Green → `/arc-phase-done 0` closes Phase 00 against its exit criteria and
bundles evidence. Red → fix before Phase 01 starts; Phase 01 wires hooks on top of this and
debugging two layers at once is the thing to avoid.

Then **Phase 01 (2.5 days):** EVENT.d `NN-emit` fragments + explicit emissions in the
kickoff/phase-done/review/qa/commit/ship/council flows · the REQ-01 dry-run golden sequence ·
emitter overhead measured (<1s or async) · guard-chain regression bats.
