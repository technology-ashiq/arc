# PROGRESS.md — Cycle 2 · Receipt Spine

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green + live demo + exit criteria + evidence). Evidence over assertion.
> Predecessor (orchestrator) CLOSED 2026-07-22: `docs/archive/PROGRESS-2026-07-22.md`.
> The v2 world-best initiative stays parked (ADR-0017).

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Spine core: dual-mode emitter · canonical serializer · hostile corpus + adversarial pass (ckpt A) · replay · reader · twin determinism CI (ckpt B) | 5 days | ⬜ not started |
| 01 | Factory wiring: EVENT.d fragments + flow emissions + dry-run golden + overhead check | 2.5 days | ⬜ not started |
| 02 | Money + brief: strict revenue ingest (cross-day idem) + one-screen brief + cost (stretch) | 2.5 days | ⬜ not started |
| 03 | Inbox + API seal: approvals flow + cursor catch-up + reader-only grep-lint (TRIAL) | 1.5 days | ⬜ not started |
| 04 | Live dogfood: 5 real days · honest revenue · gap audit · evidence bundle · retro | 3 days (≥5 elapsed) | ⬜ not started |

## Done log

- 2026-07-22 — **Kickoff.** Orchestrator tracker archived (`docs/archive/PLAN-2026-07-22.md`,
  `PROGRESS-2026-07-22.md`, `phases-orchestrator-2026-07-22/`). ADR-0024..0031 recorded
  (SPINE-A..H). PLAN.md + `phases/phase-00..04-spec.md` written from
  `docs/strategy/plans/PLAN-cycle2-receipt-spine-v2.1.md` (decisions locked, not re-litigated).
  Attack panel: 3 attackers, 18 findings, 12 accepted as exact mutations. Awaiting approval.

## Appetite burn

**0 of ~12.5 part-time days used** (2.5-week hard cap). Kill check at ~6 days: REQ-02 +
REQ-04 green? If not → cut to spine+replay only. First cut REQ-08; second cut REQ-09's
cursor demo (lint stays). 100% → cut or kill, never extend.

## Now

**Kickoff written, awaiting Ashiq's approval.** PLAN.md, `phases/phase-00..04-spec.md`, and
ADR-0024..0031 are on disk; kickoff-lint GREEN (one trial WARN: appetite-sum 14.5d>12.5d,
from the locked design appetites). Simulation gate ran twice (5 blockers fixed → 3 remain):
per process, two non-zero rounds = human call — the 3 open blockers (dup-idem source at
ckpt A · equivalence-gate definition · 90-day synthetic <5s timing check) are listed in the
kickoff summary with proposed spec edits. Next step: Ashiq rules on the 3 blockers +
approves → Phase 00 ckpt A starts. No product code before that approval.
