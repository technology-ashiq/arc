# PROGRESS.md — arc-bench "the model market"

status: BLOCKED
cycle: arc-bench (Cycle 13, opened 2026-08-12)
phase: 04
appetite: 8d
burn: 7.25d
blocked-on: engine — arc-run overwrites ARC_DRIVER_MODEL, so bench cannot vary the model (Phase 03's real event)
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
| 01 | Bench core — full run, K=3 sequential, K-group admission control, provenance, total encoder, replay proof | 1.5d | ✅ done 2026-08-13 |
| 02 | Router proposal — three artifacts, gates-first eligibility, `NO PROPOSAL` with reason, `approval.requested` | 0.75d | ✅ done 2026-08-13 |
| 03 | Drift guard + the real event — split axes, three tiers, enumerated re-pin causes, one real model to a recorded verdict | 1.0d | ⚠️ guard done · real event BLOCKED |
| 04 | Seal + retro — two mutants, two adversarial surfaces, redaction sweep, runbook, production count from the spine | 1.0d | ✅ done 2026-08-13 |

Phases sum to **7.25d**; the remaining **0.75d is named reserve, not unallocated scope**.

## Appetite burn

**7.25 of 8 days used** — every phase closed at its own appetite, none over. The remaining
0.75d is the named reserve and it stays unspent. 50% tripwire at 4d — see `PLAN.md` § Appetite for the kill criteria and the pre-planned cut order (decided at
kickoff, not at 6pm on day 8).

## Done-log

- **2026-08-13 — Phases 01, 02 and 04 CLOSED; Phase 03 half-closed.** `786a378` green **per JOB**
  on CI run `31680704721`, head SHA confirmed equal to the local HEAD.

  **01 — bench core.** K=3 per fixture and K is **never collapsed**; medians carry their spread.
  Schema and assertion pass-rates stay separate, read from `arc-run`'s **own receipt** rather than
  scraped from its stderr. K-group admission control reserves `K × worst case` against both caps
  before a fixture starts, and **a missing ceiling is a refusal, never a default**. Replay
  re-scores captured bytes **byte-identically**; a normalizer bump is **stale-format on exit 3**,
  not a mismatch on exit 1.

  **02 — the router proposal.** Six gates in ADR-0906 order, three artifacts, and a stable unified
  diff **pinned to the router SHA the run read and re-read at emit**. A class at `NO PROPOSAL`
  gets artifacts 1 and 2 and **no diff at all**.

  **03 — the drift guard (half).** Two split comparability axes, every cost delta classified into
  exactly one cause, three tiers with **tier 3 report-only at any size**, muted classes named, and
  the anti-goalpost clause: **a score movement alone never re-pins**. A clean guard run leaves
  **no approval** on the spine and says so. **The real-event half is BLOCKED** — see the current-position section below.

  **04 — the seal.** Two mutants, **run not grepped**, each proved to have reached its target
  behaviour before its rejection counts. The direct-spawn mutant is rejected for **bench's** reason
  (no `arc-run` receipt, citing M1) and explicitly **not** by the policy gate, which ADR-0912
  records as proving nothing. Redaction swept over every stored artifact class with a planted key.
  Runbook at `docs/runbooks/bench.md`.

  **The phase's real output: 23 confirmed holes from two fresh adversarial surfaces, with almost
  no overlap between them.** Fourteen were in code written the same day by the session that also
  wrote its tests. The worst three: `reconcileGroup` let a run **overspend its cap 2.16×**; the
  drift guard reported **"no drift" on a run where every attempt failed**; and `repo_state` was
  confined in `mock.mjs` but **unconfined in `arc-bench.mjs`, including on a WRITE path**. Full
  table with severities and fixes: `initiatives/bench/evidence/phase-04/adversarial-pass.md`.

  **Bench's PRODUCTION `run.completed` count, read off the canonical spine: ZERO**, across 17 day
  files. Every run this cycle used a throwaway `ARC_SPINE_ROOT`, and this lane works in a linked
  worktree where the emitter refuses by design. Written down rather than inferred, because a cycle
  that adds machinery has to assert its production count at close.

  Assumptions evaluated with the counts actually run:
  `initiatives/bench/evidence/phase-04/assumptions-at-close.md` — 3 VALIDATED, 2 NOT EVALUABLE
  (both gated on the blocked real event), 1 validated with its trigger text superseded by
  ADR-0912, and 1 FIRED with the answer zero.

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

**Current position, 2026-08-13: 4 of 5 phases CLOSED. Phase 03's real-event half is BLOCKED on
the engine lane.**

Everything bench can build is built and green on CI at `786a378` (run `31680704721`, read per JOB).
The whole cycle rides one branch and merges once — `feat/arc-bench-phase-00-rest`, **PR #180**.

## THE BLOCKER, and why it is not a bench change

`arc-run` rebuilds the driver environment (`arc-run.mjs:378-381`) and **overwrites**
`ARC_DRIVER_MODEL` with `pinnedModel ?? ""`. With an explicit `--driver` there is no tier, so a
model can only be pinned through `--driver auto` plus a `classes.NAME` row in
`engine/router.yaml` — and that file is **do-not-touch for this lane, permanently**.

**Bench therefore cannot vary the model, which is the entire premise of a model market.** Four
Phase-03 DoD items depend on it: one real model benched end to end, the candidate proven REACHED,
the REQ-05 preflight, and the human verdict on a run that cannot be configured.

The same rebuild also overwrites `ARC_ROOT`, so the fixture-repo harness **cannot reach a real
driver** — and `commit-msg-draft` holds `git.op: add:*` and `commit:*`, so a real driver run
today would stage and commit **inside the arc repo itself**. **One engine seam closes both.**

Measured, not read: `tests/bench-steel-probe.mjs` points `ARC_ROOT` at a directory holding no
recordings and the run still replays the right bytes, and it asserts `arc-run`'s own receipt reads
`model: unpinned` while bench set `claude-opus-5`.

**Next step, and it belongs to ENGINE:** `/arc-change --lane engine` for a seam that lets a caller
name the model for one invocation without editing the router, or a router row bench may propose
against. Either is a reviewed diff citing ADR-0069. Bench reaches across no fence to make it.

**Also carried to engine:** `arc-run.mjs:257` still passes `--payload` inline and carries the
Windows-path `BAD_JSON` bug bench fixed on its own emit path, and `arc-run` emits
`run.completed` **without `--strict`**, so a rejected payload quarantines at exit 0. Bench guards
its own side: `drivers/mock` refuses a `__cost.source` outside the spine's closed set.

## The monthly guard

**NEXT-CHECK: 2026-09-01** (the first working day of September 2026). Owner-started, from the main
clone — never a worktree. The command and how to read its report are in
`docs/runbooks/bench.md` § *The monthly drift guard*.

Absence is never inferred from nobody having looked: the count that answers it is
`cat .claude/state/hq/events/*.jsonl | grep -c '"process":"bench@0.1.0"'`, run in the main clone.
At close it read **0**.

