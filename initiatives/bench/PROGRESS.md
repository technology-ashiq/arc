# PROGRESS.md — arc-bench "the model market"

status: LIVE
cycle: arc-bench (Cycle 13, opened 2026-08-12)
phase: 01
appetite: 8d
burn: 3d
blocked-on: —
depends-on: —

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green on CI + live demo + exit criteria + evidence). Evidence over assertion.
> Evidence is lane-scoped at `initiatives/bench/evidence/phase-NN/` (ADR-0055). ADRs, the
> retro-log, HISTORY and the trial-ledger stay at repo root (ADR-0053). This lane holds ADR
> century **0900–0999**; ADR-0900..0914 are locked there.

## Phases

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | The road + steel thread — `drivers/mock`, `version` verb, assertion schema, fixture-repo harness, `commit-msg-draft` armed to 5, one fixture end to end | 3.0d | ✅ done 2026-08-13 |
| 01 | Bench core — full run, K=3 sequential, K-group admission control, provenance, total encoder, replay proof | 1.5d | ⬜ not started |
| 02 | Router proposal — three artifacts, gates-first eligibility, `NO PROPOSAL` with reason, `approval.requested` | 0.75d | ⬜ not started |
| 03 | Drift guard + the real event — split axes, three tiers, enumerated re-pin causes, one real model to a recorded verdict | 1.0d | ⬜ not started |
| 04 | Seal + retro — two mutants, two adversarial surfaces, redaction sweep, runbook, production count from the spine | 1.0d | ⬜ not started |

Phases sum to **7.25d**; the remaining **0.75d is named reserve, not unallocated scope**.

## Appetite burn

**3 of 8 days used** (Phase 00 closed at its 3.0d appetite, neither under nor over). 50% tripwire
at 4d — see `PLAN.md` § Appetite for the kill criteria and the pre-planned cut order (decided at
kickoff, not at 6pm on day 8).

## Done-log

- **2026-08-13 — Phase 00 CLOSED.** The road + steel thread, 14 slices, `c6e14bf` green
  **19/19 per JOB** on CI (run `31673195412`, head SHA confirmed equal to the local HEAD).
  `drivers/mock` replays pinned bytes and swaps the RESPONSE not the code path · the opt-in
  `version` verb answers on `claude-code` and `mock` · the ADR-0905 assertion substrate scores a
  zero denominator as **ABSENT, never 100%** · the fixture-repo harness materializes `base/` +
  `work/` and **does not stage** · `commit-msg-draft` armed to **6 declared fixtures** with 6
  assertions each · the coverage gate counts the DECLARED `evals:` list, so `review-diff` and
  `kickoff-plan` read `NO PROPOSAL - evidence insufficient (1 of 5 fixtures)` · and the steel
  thread runs discover → materialize → `arc-run` → score → emit, with the receipt **verified
  present in `events/` and absent from `_quarantine/`**.

  **Four engine defects found by RUNNING it, none of them fixed here** — `arc-run.mjs` is a
  one-line-only path for this lane, so bench reports and moves on:
  1. `ARC_ROOT` does not survive `arc-run`, so the fixture-repo harness **cannot reach a real
     driver** — and `commit-msg-draft` holds `add:*`/`commit:*`, so a real driver today would
     stage and commit **inside the arc repo**.
  2. `ARC_DRIVER_MODEL` does not survive either, so **bench cannot vary the model** — the premise
     of a model market. A model can only be pinned via `--driver auto` + a router row, and
     `engine/router.yaml` is do-not-touch here, permanently.
  3. A payload carrying a Windows path cannot go through `bash` argv: `REJECT BAD_JSON --
     invalid escape \U`, so the one receipt that mattered (the failure one) was the only one that
     could not be written. Bench uses `--payload-file`; `arc-run.mjs:257` still does not.
  4. `--budget rupees=1` parsed and bounded nothing.

  **M1 is amended in the phase spec with the measured evidence** rather than left standing wrong.
  Phase 00 authored no new ADR: the findings contradict a phase-spec non-negotiable, not a
  decision, and an ADR would have implied something was reversed.

- **2026-08-12 — kickoff.** Lane `bench` born. Century 0900–0999 claimed; ADR-0900..0914
  written. PLAN.md, 5 phase specs and this tracker created. Attack panel ×3 returned 21
  findings: 20 accepted as PLAN mutations, 1 rejected (`unsupported`). Kickoff verification
  falsified five of the design source's inherited premises — see § Kickoff findings below.
  **Simulation gate CLOSED at 0 blockers**, trajectory **10 → 4 → 2 → 0** across four rounds.
  Round 3's two findings were the valuable ones: both were self-contradictions in this plan —
  it required writing `arc-bench.mjs` and registering `mock` in `arc-run.mjs` while authorizing
  neither path, and it required appending to `commit-msg-draft`'s `evals:` list while forbidding
  edits to pilot processes. Round 3 also caught that the mock selected its recording by input
  hash, which would have handed all five fixtures the same response, since that process declares
  `inputs: []`. CI green 19/19 at `97faea9`.

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

**Current position, 2026-08-13: Phase 00 CLOSED. Phase 01 IN PROGRESS.**

Phase 00 landed across seven PRs (#166, #169, #170, #173, #174, #178, #179) plus the phase-close
branch `feat/arc-bench-phase-00-rest`. Its last commit `c6e14bf` is **19/19 green per JOB**.

Phase 01 is being built on the same branch, to be merged as one PR once every phase is done
(owner instruction, 2026-08-13: *build all phases, merge at the end*).

**Blocking Phase 03, not Phase 01 — and it needs an engine decision, not a bench one.** Bench
cannot vary the model through `arc-run`, so *"one real model to a recorded verdict"* has no
mechanism. Phase 01 does not need it (**one** driver+model pair, K=3 repeats), and Phase 02 does
not either (proposals are about the numbers, not about producing new ones). Phase 03 does. The
seam is `arc-run`'s driver environment, and `arc-run.mjs` is a one-line-only path for this lane —
so this is a `/arc-change` for the **engine** lane, and Phase 03 records it rather than reaching
across the fence.

**Carried forward as a known, unfixed engine defect:** `common.mjs:180-191` returns inside the
`ARC_DRIVER_FAKE` branch before `await produce()` runs, while
`tests/engine-driver-contract.bats:6-8` asserts the opposite. Bench reports it; engine owns the
repair. `drivers/mock` deliberately takes the opposite approach — it IS a `produce()`, so it runs
the whole real path and swaps only the response.
