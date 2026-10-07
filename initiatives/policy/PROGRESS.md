# PROGRESS.md — policy cycle 2 "Evidenced levels"

status: BLOCKED
cycle: arc-policy cycle 2 (opened 2026-10-07)
phase: 02
appetite: 3d
burn: 2.25d
blocked-on: owner — the Phase 02 paste (six deny-listed files, one Git Bash line)
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
| 02 | Owner paste: `evidence_days`, lint key, hook's interactive receipt, `policy-lint --evidence`, deny floor | 0.5 days | 🔨 merged (#372): paste generated and proven in a sandbox; BLOCKED on the owner's one-line apply (`evidence/phase-02/owner-action.md`) |

**Appetite burn: 2.25 of 3 days used (75%).** Phases 00 and 01 closed; Phase 02's build is done and merged, and what
remains is the owner's paste, which is waiting rather than effort. Phases allocate 2.5 of 3 days; 0.5 days of slack.

**Tripwires:** at 1.5 days, Phase 00 not closed → face cell cut to the API field only. Phase 02
waits on the owner's paste, never on effort.

## Done-log

| Date | What closed | Evidence |
|---|---|---|
| 2026-10-07 | **Phase 01 CLOSED.** The monthly guard (ADR-0511): clean only with zero BELOW-BAR cells over the full cell list (invariant c, mutant M-c); clean seals only `run.completed`, not clean seals one `approval.requested` split no-writer/clearable and raised only when the set changes; receipts written into the spine that was read and read back; an `--as-of` run is never an audit and never raises an approval. `/api/policy` serves each cell's evidence from the policy lane's own fold, and the room draws `L1 · unknown` on the real spine (opened and looked at; the screenshot stays off this public repo). 67 tests in `policy-evidence.bats` plus the face fold and door checks. Two attack rounds (34 findings: 17 fixed, 8 rejected, 9 LOW to the ledger); CI then caught the guard's read-back bypassing the spine reader. `amendments: 0` · `reopened: n` | Merged `f1d72536` (PR #370); **main verified by `workflow_dispatch` 37629185502, 19/19** · `evidence/phase-01/live-demo.md` (+ `live-demo.txt`) · `phase.closed` `01M4BDVH6ZE6ZDYX0SCDARHEW5` · `approval.requested` `01M4BDVHKX8M01CFKPSHPME8P6` (canonical spine, 0 quarantined; the stamp is the owner's) |
| 2026-10-07 | **Phase 00 CLOSED.** A headless refusal becomes a typed `note.logged policy.refusal` receipt (zero new kinds), corroborated by the gate incident that precedes it; a pure evidence fold (IST days, as-of injected, no clock, never parses prose); `policy-evidence report|check` with BELOW-BAR exit 3; a reader that refuses a non-canonical spine. **The real reading is the one predicted at kickoff: 17 in-scope cells, all BELOW-BAR, 0 refusals, 0 of the spine's lines rejected.** 59 tests, 18 named mutants. Two attack rounds (36 findings: 29 fixed, 4 rejected, 3 LOW to the ledger), then CI found four things no attacker did, the worst being 38 one-line `@test` bodies bats never gathers. `amendments: 0` · `reopened: n` · `t-to-phase0: 0 days` | Merged `091675de` (PR #368); **main verified by `workflow_dispatch` 37611397941, 19/19** · `evidence/phase-00/live-demo.md` (+ `live-demo.txt`, `baseline.txt`) · `phase.closed` `01M4B92PPECPBM6GK8WW51Q4GR` · `approval.requested` `01M4B92Q2TPHGWDPG6NJAMN0QH` (canonical spine, 0 quarantined; the stamp is the owner's) |
| 2026-10-07 | Cycle 2 kickoff. Design source amended first through `/arc-change` (PLAN-policy v1.1, POL-L, PR #365). Tier S, 5 REQ, ADR-0509..0511. **Not a phase close** | `kickoff.done` `01M49X88ZWME12Y9AZC5YQ90MP` · `approval.requested` `01M49X8BNTYZRP2GHTQHQGT2ZD` (canonical spine, main clone, 0 quarantined; the stamp is the owner's) · 1 merged plan-attacker run: 7 findings, 7 accepted, 0 rejected |

## Now

**Current position: Phases 00 and 01 closed; Phase 02 merged (#372) and BLOCKED on the owner's paste** — the one
step this cycle cannot take for itself, because every target is on the deny floor (ADR-0502). The owner instructed
every phase without waiting and ask only when truly blocked. So the build proceeds; the
kickoff approval request is left on the spine for the owner to stamp, and is not stamped by an
agent.

**What the kickoff decided** (no owner questions, by instruction; forks recorded as ADRs):
POL-L1 → a `note.logged` `policy.refusal` profile (ADR-0509), zero new kinds; POL-L2 → one cell
per subject × capability (ADR-0510); POL-L3 → scheduler `policy-declined` counts only with a
typed `capability` (ADR-0509); the guard is policy's own, adopting ADR-0910's rule (ADR-0511).

**The first honest reading is predicted in advance:** 17 in-scope cells (shell L1 × 11,
network L1 × 6), every one BELOW-BAR, 0 refusals. The 15 `process:*` cells read `unknown`
because a headless L1 run is not offered the tool, so no attempt exists to refuse. That is
the engine lane's to instrument, not this cycle's.

**Open with the owner (not blocking any phase):** the STOP-or-fund-the-first-headless-job
decision that Cycle 9's assumption row 1 forced when it fired (archived PLAN, row 1) · naming
the lane that owns "Gap B's Availability enum" · stamping the kickoff approval · the Phase 02
paste when it is generated.

**Next:** the owner runs ONE line from Git Bash at the repo root (`evidence/phase-02/owner-action.md`):
`node initiatives/policy/evidence/phase-02/verify-paste.mjs --pre && cp -r initiatives/policy/evidence/phase-02/paste/. . && node initiatives/policy/evidence/phase-02/verify-paste.mjs`.
Then the agent commits the six files, reads CI per job, runs the armed-hook demo on the canonical spine (a cell turns
`unknown` → `fresh`), and closes Phase 02 and the cycle.
