# PROGRESS.md — arc-bench "the model market"

status: BLOCKED
cycle: arc-bench (Cycle 13, opened 2026-08-12)
phase: 00
appetite: 8d
burn: 0d
blocked-on: owner approval of `initiatives/bench/PLAN.md` before any Phase 0 code
depends-on: —

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green on CI + live demo + exit criteria + evidence). Evidence over assertion.
> Evidence is lane-scoped at `initiatives/bench/evidence/phase-NN/` (ADR-0055). ADRs, the
> retro-log, HISTORY and the trial-ledger stay at repo root (ADR-0053). This lane holds ADR
> century **0900–0999**; ADR-0900..0914 are locked there.

## Phases

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | The road + steel thread — `drivers/mock`, `version` verb, assertion schema, fixture-repo harness, `commit-msg-draft` armed to 5, one fixture end to end | 3.0d | ⬜ not started |
| 01 | Bench core — full run, K=3 sequential, K-group admission control, provenance, total encoder, replay proof | 1.5d | ⬜ not started |
| 02 | Router proposal — three artifacts, gates-first eligibility, `NO PROPOSAL` with reason, `approval.requested` | 0.75d | ⬜ not started |
| 03 | Drift guard + the real event — split axes, three tiers, enumerated re-pin causes, one real model to a recorded verdict | 1.0d | ⬜ not started |
| 04 | Seal + retro — two mutants, two adversarial surfaces, redaction sweep, runbook, production count from the spine | 1.0d | ⬜ not started |

Phases sum to **7.25d**; the remaining **0.75d is named reserve, not unallocated scope**.

## Appetite burn

**0 of 8 days used.** 50% tripwire at 4d — see `PLAN.md` § Appetite for the kill criteria and
the pre-planned cut order (decided at kickoff, not at 6pm on day 8).

## Done-log

*(nothing closed yet — this lane was born 2026-08-12)*

- **2026-08-12 — kickoff.** Lane `bench` born. Century 0900–0999 claimed; ADR-0900..0914
  written. PLAN.md, 5 phase specs and this tracker created. Attack panel ×3 returned 21
  findings: 20 accepted as PLAN mutations, 1 rejected (`unsupported`). Kickoff verification
  falsified five of the design source's inherited premises — see § Kickoff findings below.

## Kickoff findings — read before starting Phase 0

The design source `docs/strategy/plans/PLAN-bench.md` v1.0 described a handshake that was never
shipped. Verified in-tree 2026-08-12:

1. **1 driver in real use, not ≥2.** Only `claude-code` has produced a real receipt; `codex` is
   not installed, `generic-api` has no credentials. Engine's own Phase 03 evidence already said
   so: *"NOT MET, and it is not close… remains UNPROVEN"*.
2. **3 eval fixtures, one per class, against a floor of 5 — and zero assertions anywhere.**
   "Quality = assertion pass-rate" had no substrate at all.
3. **`drivers/mock` does not exist**, and **no driver implements `--version`** — both were
   recorded as shipped in `docs/strategy/plans/README.md:42`.
4. **`arc engine bench` has never existed** — no `arc` binary, no dispatcher (ADR-0901).
5. **No pricing snapshot exists**, so the ₹500/₹100 caps could not be "re-priced against the
   then-current snapshot" (ADR-0904).

**Still-open engine defect bench must not inherit:** `common.mjs:180-191` returns inside the
`ARC_DRIVER_FAKE` branch **before `await produce()` runs**, while
`tests/engine-driver-contract.bats:6-8` asserts the opposite — so *"every driver satisfies the
same contract"* is vacuous for all three drivers today. This is the 2026-08-03 retro-log finding,
still open. Bench reports it and builds `drivers/mock` correctly; repairing engine's fake is
engine's work.

**Board correction made in the same commit:** `PORTFOLIO.md`'s band table said `0700–0799 | next
lane to be born`. It was stale — `memory` holds 0700–0709 and `scheduler` holds 0800–0806, both
in unmerged worktrees. Third occurrence of that staleness pattern. Bench took **0900**.

## Now

**Current position, 2026-08-12: kickoff COMPLETE, Phase 00 NOT STARTED — blocked on owner
approval.**

`PLAN.md`, `phases/phase-00-spec.md` … `phase-04-spec.md`, ADR-0900..0914 and this tracker are
written. `kickoff-lint --lane bench` passes and the Tier-M simulation gate has run.

An `approval.requested` receipt (gate `kickoff`) is on the spine. **No Phase 0 code may be
written until the owner records a decision** via `arc-inbox approve <ULID> --reason "…"` — run
from the main clone at `E:/Work_Hub/01_Automemory/arc`, because the canonical spine is
gitignored and each worktree has its own.

**Next step after approval:** Phase 00, first slice — `drivers/mock` and the
swap-the-response negative control, which is the one test that must stay RED until the mock is
built correctly.
