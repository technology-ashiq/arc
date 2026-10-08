# PROGRESS.md — policy cycle 2 "Evidenced levels"

status: IDLE
cycle: arc-policy cycle 2 (opened 2026-10-07)
phase: 02 (cycle closed)
appetite: 3d
burn: 2.5d
blocked-on: —
depends-on: —

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green on CI + live demo + exit criteria + evidence). Evidence over assertion.
> Cycle 9 (2026-08-06 → 2026-08-10, phases 00–04, PR #130/#147) is archived in-lane:
> `archive/PLAN-cycle9-2026-08-10.md`, `archive/PROGRESS-cycle9-2026-08-10.md`,
> `archive/phases-cycle9-2026-08-10/`, `archive/evidence-cycle9-2026-08-10/` — except
> `evidence/phase-00/hook-matrix.{json,md}`, a live generator output CI rewrites in place.
> ADR band 0500–0599 (ADR-0500); this cycle adds ADR-0509..0511.

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Steel thread: refusal profile + `arc-run`'s typed L0 refusal receipt → pure fold → `check` with BELOW-BAR, invariants (a)(b) + mutants | 1.25 days | ✅ done 2026-10-07 |
| 01 | Guard (invariant (c)) + `/api/policy` evidence + the room's per-cell age | 0.75 days | ✅ done 2026-10-07 |
| 02 | Owner paste: `evidence_days`, lint key, hook's interactive receipt, `policy-lint --evidence`, deny floor | 0.5 days | ✅ done 2026-10-09 |

**Appetite burn: 2.5 of 3 days used (83%).** All three phases closed inside the 2.5 days they were allocated; the
day Phase 02 spent waiting on the owner's paste was waiting, not effort, and is not counted. 0.5 days of slack unspent.

**Tripwires:** at 1.5 days, Phase 00 not closed → face cell cut to the API field only. Phase 02
waits on the owner's paste, never on effort.

## Done-log

| Date | What closed | Evidence |
|---|---|---|
| 2026-10-09 | **Phase 02 CLOSED — the cycle's last phase.** The owner applied the six deny-listed files (`verify-paste`: six APPLIED, byte-identical): `evidence_days: 35` on the 17 in-scope L1 grants, a lint that refuses an unusable N (0, -1, 1.5, `"35"`, 3651), `policy-lint --evidence` delegating to `check` (exit 3 = law but BELOW-BAR), the hook's ≤1 `policy.refusal` per capability, decision and IST day under a 3000 ms bound that never changes the block, and the evidence code on the deny floor and the un-grantable list. In a throwaway root the armed hook's propose turns `session:interactive/shell` `absent` → `fresh`; the canonical spine reads 17 in scope, 17 BELOW-BAR, every one now `N=35` (15 `unknown`, 2 `absent`), 0 lines rejected, as predicted. 12 tests in `policy-evidence-paste.bats`. Two attack rounds on the paste's code paths (debt rows 10–13). **The agent could not commit the files either**: the auto-mode classifier refused it as `[Self-Modification]`, so the owner committed them (PR #384; a duplicate from a resume that missed #384 was closed as #393). The merged-tree dispatch went red once on an engine timing check unrelated to the paste, green on rerun, and the check was made load-proof in #394. `amendments: 0` (the two REQ-05 amendments were made at phase start, before the build) · `reopened: n` | Merged `494e0f46` (PR #384) + `a9f7a0fa` (PR #394); **main verified by `workflow_dispatch` 37828894878, 19/19 on attempt 2** (attempt 1: windows shard 11, `engine-attack-watch` check F, 2 heartbeats where it counted 3) · `evidence/phase-02/live-demo.md` (+ `live-demo.txt`, `manifest.json`) · `phase.closed` `01M4EHTBQ2SQ38A9FGZZ5T41XY` · `approval.requested` `01M4EHTC6YQM8VJYZEFPP2CMMF` (canonical spine, 0 quarantined; the stamp is the owner's) |
| 2026-10-07 | **Phase 01 CLOSED.** The monthly guard (ADR-0511): clean only with zero BELOW-BAR cells over the full cell list (invariant c, mutant M-c); clean seals only `run.completed`, not clean seals one `approval.requested` split no-writer/clearable and raised only when the set changes; receipts written into the spine that was read and read back; an `--as-of` run is never an audit and never raises an approval. `/api/policy` serves each cell's evidence from the policy lane's own fold, and the room draws `L1 · unknown` on the real spine (opened and looked at; the screenshot stays off this public repo). 67 tests in `policy-evidence.bats` plus the face fold and door checks. Two attack rounds (34 findings: 17 fixed, 8 rejected, 9 LOW to the ledger); CI then caught the guard's read-back bypassing the spine reader. `amendments: 0` · `reopened: n` | Merged `f1d72536` (PR #370); **main verified by `workflow_dispatch` 37629185502, 19/19** · `evidence/phase-01/live-demo.md` (+ `live-demo.txt`) · `phase.closed` `01M4BDVH6ZE6ZDYX0SCDARHEW5` · `approval.requested` `01M4BDVHKX8M01CFKPSHPME8P6` (canonical spine, 0 quarantined; the stamp is the owner's) |
| 2026-10-07 | **Phase 00 CLOSED.** A headless refusal becomes a typed `note.logged policy.refusal` receipt (zero new kinds), corroborated by the gate incident that precedes it; a pure evidence fold (IST days, as-of injected, no clock, never parses prose); `policy-evidence report|check` with BELOW-BAR exit 3; a reader that refuses a non-canonical spine. **The real reading is the one predicted at kickoff: 17 in-scope cells, all BELOW-BAR, 0 refusals, 0 of the spine's lines rejected.** 59 tests, 18 named mutants. Two attack rounds (36 findings: 29 fixed, 4 rejected, 3 LOW to the ledger), then CI found four things no attacker did, the worst being 38 one-line `@test` bodies bats never gathers. `amendments: 0` · `reopened: n` · `t-to-phase0: 0 days` | Merged `091675de` (PR #368); **main verified by `workflow_dispatch` 37611397941, 19/19** · `evidence/phase-00/live-demo.md` (+ `live-demo.txt`, `baseline.txt`) · `phase.closed` `01M4B92PPECPBM6GK8WW51Q4GR` · `approval.requested` `01M4B92Q2TPHGWDPG6NJAMN0QH` (canonical spine, 0 quarantined; the stamp is the owner's) |
| 2026-10-07 | Cycle 2 kickoff. Design source amended first through `/arc-change` (PLAN-policy v1.1, POL-L, PR #365). Tier S, 5 REQ, ADR-0509..0511. **Not a phase close** | `kickoff.done` `01M49X88ZWME12Y9AZC5YQ90MP` · `approval.requested` `01M49X8BNTYZRP2GHTQHQGT2ZD` (canonical spine, main clone, 0 quarantined; the stamp is the owner's) · 1 merged plan-attacker run: 7 findings, 7 accepted, 0 rejected |

## Now

**Current position: Cycle 2 phases all closed (00, 01, 02); the retro is next.** Every configured L1 level in scope
now carries a declared bar (`N=35`) and a measured age, and a level whose refusal path is unproven reads BELOW-BAR,
never PASS. The canonical reading is the predicted one: 17 in scope, 17 BELOW-BAR (15 `unknown`, 2 `absent`).

**Open with the owner (not blocking anything):** the STOP-or-fund-the-first-headless-job decision that Cycle 9’s
assumption row 1 forced when it fired (archived PLAN, row 1) · naming the lane that owns "Gap B’s Availability enum" ·
the four approval stamps (kickoff `01M49X8BNTYZRP2GHTQHQGT2ZD`, Phase 00 `01M4B92Q2TPHGWDPG6NJAMN0QH`, Phase 01
`01M4BDVHKX8M01CFKPSHPME8P6`, Phase 02 `01M4EHTC6YQM8VJYZEFPP2CMMF`).

**Next:** `/arc-retro --lane policy` seals Cycle 2 (the deny-floor commit row is the headline).
