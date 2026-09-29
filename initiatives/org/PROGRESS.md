# PROGRESS.md — org v1 "arc's company layer"

status: LIVE
cycle: arc-org (Cycle 18, opened 2026-09-29)
phase: 00
appetite: 10d
burn: 0d
blocked-on: —
depends-on: —

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green on CI + live demo + exit criteria + evidence). Evidence is lane-scoped at
> `initiatives/org/evidence/phase-NN/` (ADR-0055). ADRs, the retro-log, HISTORY and the
> trial-ledger stay at repo root (ADR-0053). This lane holds ADR century **1600–1699**;
> ADR-1600..1622 are written.

## Phases

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | The catalog + its gate — ruling on the spine, `products/org`, 71 cards, `org-coverage` + `--mutant-selftest`, generated chart, genesis digest | 2.5d | 🔨 in progress |
| 01 | Attribution + scorecard — `org/attribution.yaml`, `org review --role` + `--audit`; **day-3 kill checkpoint**; Nilluvai pilot gate | 1.5d | ⬜ |
| 02 | Staffing — team manifest + `org.team` digest, `sync-to-project --team`, Nilluvai staffed, hire path + bench interview, three skills | 2.5d | ⬜ (needs Nilluvai registered) |
| 03 | The COO + the review loop — `org-dispatch` script-job, five pilot days, first `org review`, retro + seal | 2d + 5 elapsed | ⬜ |

**Appetite burn:** 0 of 10 days used (8.5 d planned · 1.5 d slack · + 5 elapsed pilot days in Phase 03).

## Done-log

_(empty — nothing closed yet)_

## Now

**Current position:** kickoff complete 2026-09-29 — PLAN, four phase specs, ADR-1600..1623 written;
century 1600 claimed after a 13-worktree + remote-branch sweep. `kickoff-lint` PASSES (two honest
WARNs: 85% appetite use, one heuristic vague-word). Attack panel: 21 findings — 19 applied, 1 partial
(the checkpoint keeps its locked name "day-3"), 1 rejected. Simulation gate 12 → 6 blockers, all 6
closed but NOT re-verified (two non-zero rounds = owner's call). Birth rows applied: `expected-set.json`
(`lanes.org`, `adrs.1600`, and the missing `PLAN-org` plan row), `rooms.generated.json`, PORTFOLIO, wiki.
Receipts (main clone): `kickoff.done` `01M3QF38HX8BA33G1B52RRQZ3G` · approval request `01M3QF3A1FSQHMR16RV01967AF` · **APPROVED** `01M3QF5AFYG944NQHBDHC6CFKR` (owner confirmed in session 2026-09-30). ANOMALY: that decision landed ~2 s after the request, actor `arc-event`, reason `approved`, not written by this session — an approval gate that decides itself is a governance hole to trace (no action taken here).

**Kickoff trace (REJECTED lines, ADR-0067):**
- REJECTED: the `org.*` profiles must be registered in `hq.policy.yaml` or be refused at emit — unsupported (`approval.requested` is generic, `validate.mjs:410`)
- REJECTED: rename the day-3 kill checkpoint to "Phase 01 step-2 checkpoint" — violates-no-go (the owner locked the name and question; its timing was tightened instead)

**Next step:** on approval → Phase 00 step 1: record the 2026-09-29 owner ruling as a
`decision.recorded` from the MAIN clone, then `products/org` birth + card schema.

**Open owner items (not blocking Phase 00):** register Nilluvai via `venture-register` by the end of
Phase 01 (else the cycle pauses there, ADR-1612) · rejustify-or-retire the expired
`build-in-public-draft` router hire (engine lane, ADR-1622).
