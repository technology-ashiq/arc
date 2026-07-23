# PROGRESS.md — Cycle 2 · Receipt Spine

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green + live demo + exit criteria + evidence). Evidence over assertion.
> Predecessor (orchestrator) CLOSED 2026-07-22: `docs/archive/PROGRESS-2026-07-22.md`.
> The v2 world-best initiative stays parked (ADR-0017).

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Spine core: dual-mode emitter · canonical serializer · hostile corpus + adversarial pass (ckpt A) · replay · reader · twin determinism CI (ckpt B) | 5 days | ✅ done 2026-07-23 |
| 01 | Factory wiring: EVENT.d fragments + flow emissions + dry-run golden + overhead check | 2.5 days | ✅ done 2026-07-23 |
| 02 | Money + brief: strict revenue ingest (cross-day idem) + one-screen brief + cost (stretch) | 2.5 days | ✅ done 2026-07-23 |
| 03 | Inbox + API seal: approvals flow + cursor catch-up + reader-only grep-lint (TRIAL) | 1.5 days | ⬜ not started |
| 04 | Live dogfood: 5 real days · honest revenue · gap audit · evidence bundle · retro | 3 days (≥5 elapsed) | ⬜ not started |

## Done log

- 2026-07-23 — **Phase 02 CLOSED ✅** via `/arc-phase-done 2`. Money reaches the spine exactly
  once and the day reads in one screen. **REQ-03:** `revenue.received` / `revenue.simulated`
  ingest validates `amount` (positive integer, minor units, 1..1e12) + `currency` (ISO-4217);
  same-day AND cross-day duplicates dedupe to ONE (content idem). Parser-class **adversarial
  pass** (5 lenses, ~135 candidates) found + fixed **1 hole** — a fractional amount that
  IEEE-rounded to an integer was sealed as a value nobody sent; closed at the number-token
  scanner, pinned red. **REQ-05:** `arc brief` groups needs-you / money / progress / background
  (reader-only), money from minor units, background always collapses to a count (the noise
  floor), `--full` expands; REQ-04 determinism intact. **REQ-08 (cost) CUT** — owner's call
  (the pre-planned stretch cut; cost deferred to a later cycle). Full suite **334/334** (+10)
  3-OS CI green (run on 6a380fc). Live demo: ingest twice → ONE event, `arc brief` shows the
  money line. Evidence bundle verified (`docs/evidence/phase-02/`). **Metrics:** appetite 2.5d →
  **actual ~1d part-time** · `amendments: 0` · `reopened: n` · REQs: 2 validated / 1 dropped.
  Two CI catches (both the bare-sync golden going stale after editing synced hq scripts) —
  regenerated; now memorized as a pre-push step.
- 2026-07-23 — **Phase 01 CLOSED ✅** via `/arc-phase-done 1`. Every factory action now leaves a
  receipt: 7 flows wired to emit their Appendix-A kinds (6 core + council deep-runs-only) with
  scoped `arc-event.sh` permissions, and EVENT.d `90-emit` fragments (SessionStart/End +
  PostToolUse) drop `note.logged` lifecycle receipts through the existing dispatcher. REQ-01 →
  validated. Full suite **324/324** (+6) across 3-OS × Node CI green (run 29997447315). Live
  demo shown: a real session (this one) captured 5 receipts in gitignored `.claude/state/hq`,
  `arc brief` renders them; redaction-live pinned on the synthesis path (4/4), guard-chain
  regression 11/11, durability inherited from the Phase-0 corpus. Evidence bundle verified
  (`docs/evidence/phase-01/`). **Metrics:** appetite 2.5d → **actual ~1d part-time** (well
  under) · `amendments: 0` · `reopened: n`. **Assumptions fired-as-planned:** row 1 (golden gap
  → command-level emission) + row 3 (overhead ~2s > 1s → async append) — recorded in PLAN's
  ledger. One CI catch: the bare-sync golden was stale after the wiring (7 rehashed command
  files + 3 new fragments) → regenerated (`22cd656`) — the gate the local touched-files runs
  can't see, exactly why CI owns the full suite.
- 2026-07-23 — **Phase 00 CLOSED ✅** via `/arc-phase-done 0`. Both checkpoints shipped;
  REQ-02 + REQ-04 → validated. Full suite **318/318** local (Windows) + 3-OS × 3-Node CI
  green (ubuntu/windows/macOS on Node 20, ubuntu on Node 18 no-sqlite + Node 22 accelerator);
  spine suites 47/47. Live demo shown (hook-append, secret SKIP/exit-2, byte-identical
  rebuild). Evidence bundle verified (`docs/evidence/phase-00/`: scan-verdict + sarif +
  test-output.log pinned; adversarial-report, ckptB-measurements, red/green runs, golden diff
  committed alongside). **Metrics:** appetite 5d → **actual ~2d part-time** (well under) ·
  `amendments: 0` · `reopened: n` · `t-to-phase0: ~1 day since kickoff`. Adversarial pass
  found + fixed **25 confirmed holes** in code that had passed its own 22 tests — the phase's
  defining event. Assumption row 2 measured and HOLDS (1.1s vs 5s), so the sqlite accelerator
  stays optional.
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

**~4 of ~12.5 part-time days used** (Phase 00 + 01 + 02 done, each well under its own appetite
— ~32% burnt). 2.5-week hard cap. Kill check at ~6.25 days (50%): REQ-02 + REQ-04 green? —
**validated at Phase-0 close, so the tripwire is satisfied early; well under it.** REQ-08 was
the pre-planned **first cut** (taken at Phase-02 close, owner's call — NOT burn pressure);
REQ-09's cursor demo is the reserved second cut (lint stays). 100% → cut or kill, never extend.

## Now

**Phase 02 is CLOSED. Phase 03 (inbox + API seal) is next.**
Money reaches the spine exactly once and the day reads in one screen — `arc brief` groups
needs-you / money / progress / background (reader-only), money from minor units, background
collapsed to a count (the noise floor), `--full` expands. REQ-08 (cost) was cut (pre-planned
stretch). Kill-criteria check at close: ~4 of 12.5 days burnt (~32%, well under the 50%/6.25d
tripwire); REQ-02 + REQ-04 stay validated — no scope-cut pressure.

**Next step — Phase 03 (appetite 1.5d):** the approvals/inbox flow (REQ-06: `arc inbox` lists
`approval.requested`; `arc approve/reject ID --reason` writes `decision.recorded`; the full
request→decision flow replays identically; approving an unknown/already-decided ID is a pinned
error fixture) + per-consumer cursor catch-up + the reader-only grep-lint (REQ-09, TRIAL —
WARN-first). Refine `phases/phase-03-spec.md`'s Verification plan first (coarse), then the
Golden Loop.

**Branch state:** `feat/arc-cycle2-phase-02`, CI green on `6a380fc`; draft PR #46 covers all of
Phase 02 (REQ-03 + REQ-05; REQ-08 cut). Mark it ready + merge to main before stacking Phase 03
(a fresh branch off the updated main).
