# PROGRESS.md — Cycle 8 · arc-engine "Governed Fallback"

status: IDLE
cycle: arc-engine (Cycle 8, opened 2026-10-07)
phase: 10 (cycle closed)
appetite: 3d
burn: 1.5d
blocked-on: —
depends-on: —

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green on CI + live demo + exit criteria + evidence). Evidence over assertion.
> Cycle 7 is archived at `archive/PLAN-cycle7-2026-10-07.md` and `archive/PROGRESS-cycle7-2026-10-07.md`
> (its full done-log and every out-of-cycle entry live there); Cycle 6 beside it. This cycle claims **ADR 0228**.
> Design source: `docs/strategy/plans/PLAN-engine-process-layer.md` § Amendment 1 (ENG-H).

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Steel thread — **parked, shipped in Cycle 6** | — | ✅ done 2026-08-03 |
| 09 | Steel thread for ENG-H — classifier, `nextHop`, sidecar class, mock replay, hop record, invariants (a)(b)(d) + mutant | 1.25 days | ✅ done 2026-10-07 |
| 10 | Chain terms at load, refuse-before-spend (invariant c), real-driver declarations, attack, close | 1.25 days | ✅ done 2026-10-07 |

**Appetite burn: 1.5 of 3 days used (50%) — CYCLE CLOSED 2026-10-07, both phases inside the cap.** Was 0.5 of 3 (17%) — set 2026-10-07: the `/arc-change` routing, the design-source
amendment and this kickoff, one session. Phases allocate 2.5 of 3 (83%). Kill checkpoint at 1.5 days: Phase 09 not
done → scope cut (REQ-11's claude-code/codex declarations stay `unknown`).

## Done log

- 2026-10-07 — **PHASES 09 AND 10 CLOSED. CYCLE 8 CLOSED. 2/2 phases, 4/4 REQ validated (REQ-08..11).**
  `amendments: 1` (ADR-0228 items 6/7 and F3 refined by kickoff evidence and by the attack rounds) · `reopened: n`.
  **Actual vs appetite: 1.5 of 3 days (50%), one long day including CI waits; the kill checkpoint at 1.5 days found
  Phase 09 done.**
  - **CI 19/19, read per job**, run 37609810462 at `f3c00fb0` (= local HEAD). Ubuntu 22 leg: **4320 of 4320 ok**.
    `tests/engine-failure-class.bats` on every leg: unit 58, invariants 20, mutants 13, drivers 15, exact counts.
  - **The four invariants hold through the real arc-run**, the second driver counted by its own hits: (a) transport
    hops, a contract fault hops across families once and stops at 2 attempts; (b) policy-refusal leaves the count at 0;
    (c) a term breach refuses before spend and `nextHop` replays identically; (d) undeclared is `unknown` and does not
    hop. **Five mutants of `failure-class.mjs`, each killing a named invariant.**
  - **Two adversarial rounds, two surfaces: 32 findings, 23 fixed, 9 rejected with one line each, 0 left for the
    debt ledger.** Plus a self-review that found the m1/m2 mutants would have died for the wrong reason.
  - **CI's first run found three defects in this cycle's own tests**, none in the product: a check matching a comment,
    two checks matching round 1's new stop line, and a profile fixture whose undeclared CLI failure the new rule
    correctly refused to hop on — the old suite had been asserting the behaviour this cycle removes.
  - **A run never created for a pushed SHA, for three hours**: `docs/wiki/index.md` conflicted with main, and GitHub
    builds no `refs/pull/N/merge` for a conflicting PR. Resolved by regenerating the wiki on the merged tree.
  - **What this does NOT claim:** no real provider was called; `max_cost` binds nothing live (every row
    `unmetered`); `max_wall_ms` is an uncalibrated 1-hour ceiling; claude-code and codex chains do not hop on CLI
    failures past launch (A-08 FIRED, as pre-decided). Evidence: `evidence/phase-09/`, `evidence/phase-10/`, both
    bundles VERIFIED.
  - **A cross-lane test fixed, stronger not weaker:** `tests/policy-evidence.bats` (policy cycle 2, merged mid-PR) asserted
    no refusal with `grep '"policy.refusal"'`, an unescaped regex dot -- and this cycle's receipts now carry
    `"failure_class":"policy-refusal"`, which it matched. The refusal had not landed (arc-run said "NOT written"). All
    four greps now match `"subject":"policy.refusal"` as a fixed string. The policy lane's assertions are unchanged.
  - **Face flake, not engine debt:** `face-browser` front-door `org-who` (light mood) red once on ubuntu 20, green on
    rerun; a different face check red once on ubuntu 22 the run before. The branch touches no face file.

- 2026-10-07 — `/arc-kickoff --lane engine`, Tier S. Cycle 7 archived; `PLAN.md`, phase specs 09–10 and
  **ADR-0228** written. Design source amended first (§ Amendment 1, commit `0bda9a51`).
  - **Owner instruction (2026-10-07):** finish every phase, do not wait, push permitted, ask only when truly blocked,
    tests on CI only. The plan-approval gate is treated as given in-session; its spine receipts (`kickoff.done` +
    `approval.requested` → `decision.recorded`) cannot be emitted from a worktree and are owed to the main clone
    after the merge.
  - **Survey done in-session** against `main` @ `9864ee29` (no separate surveyor agent — every line of PLAN
    `## Current state` was read in the source this session). Blast radius counted: 14 fixture-router writers,
    24 real-router copies, 23 `run.completed` readers.
  - **A contradiction caught before it shipped:** the amendment first filed the capped key's 403 under
    `policy-refusal`; `drivers/hermes` already maps it to BUDGET_DECLINED (ADR-0213, fixture 10). Corrected to
    `budget` in the design source and ADR-0228 — it never hops either way, but the receipt would have disagreed
    with the driver.
  - **Forks F1–F4 resolved inside ADR-0228 with the recommendations** (all two-way doors; none reached the owner).

## Now

**Position:** CYCLE 8 CLOSED and **MERGED** as PR #375, squash `3ffc2220` (2026-10-07), CI 19/19 at the PR head `8c73e0c4`.
`git diff origin/main 8c73e0c4` is empty, so the squash carried the whole branch. The owner's three stamps below are
**recorded** (one `decision.recorded` each, read in the main clone 2026-10-08).

**2026-10-08 — Cycle 8 retro done** (`docs/retro-log.md` two recurring rows + scoreboard, `docs/HISTORY.md` C8,
`docs/trial-ledger.md` one row). Its three items were routed by `/arc-change --lane engine`, owner-approved, into the
design source as **Amendment 2** (`docs/strategy/plans/PLAN-engine-process-layer.md`): ENG-I the logic attacker leaves
its trial (router row + ADR-0069 amendment filling `independent-family-verifier` + a governed chain), ENG-J ci-digest
exits 5 on a CONFLICTING PR with no run, ENG-K `nonneg-drift` skips closed phases. **Next: `/arc-kickoff --lane engine`
builds Amendment 2; nothing is live until then.**

**Kickoff attack panel (Tier S, one merged A+C plan-attacker run): 7 findings, 6 applied, 1 rejected.** Applied:
F1 the schema ladder must not retry after a cross-family hop (2 attempts, never 3); F2 a deadline-edge transport
stops; F3 money-worded 429/403 and 402 are budget; F4 a check over the real router; F5 five named mutants; F6 one
mock key spelling plus the ignore-rule fixture.
`REJECTED: F7 a derived glob sweep of every tests/** classes: block — already-covered`

**Evidence that changed a decision at kickoff:** no production driver reports `inr`, and a failed attempt writes no
cost, so F3 as recommended would have made every chain hop-less. ADR-0228 item 6 and F3 were refined in place:
`max_cost` is paise or `unmetered` (required when no driver in the chain meters), and an answer-less
`transport`/`provider-unavailable` attempt's absent spend counts as 0.

**Attack round 1 on `27dcf39`** (`evidence/phase-09/attack-27dcf39-r1-{boundary,logic}.json`). The logic surface
first FAILED on the trial model (`qwen3.8-27b:free`, input 588 KB) and was re-run as round 1 on the fallback model
(`deepseek-v4-flash-0731`, reasoning off) before any fix, per the skill. Boundary 10 (1 high, 6 medium, 3 low),
logic 14 (3 high, 11 medium/low). **Fixed:** B1-B10, L1-L3, L5 (the stop line), L9, L14 — see `fixed-defects.md`.
**A self-review found one more, worse than most:** the m1/m2 mutants would have survived, because their fixtures
carried no spend and F3 stopped the hop before the class rule was ever tested. Rejected, one line each:
```
REJECTED: L4 a no-family retry counts 3 attempts — unsupported
REJECTED: L5 max_attempts should bind the first attempt — already-covered
REJECTED: L6 exit-0 branches treat the sidecar differently — unsupported
REJECTED: L7 a success can carry a failure_class — already-covered
REJECTED: L8 hops record a declared class on an exit-0 success — unsupported
REJECTED: L10 termsCheck skips money for unmetered+mock — already-covered
REJECTED: L11 a failed cross-family hop leads to 3 attempts — unsupported
REJECTED: L12 model-invalid must never retry the same driver — already-covered
REJECTED: L13 a bare generic-api model counts as the same family — already-covered
```
(L5's first-attempt half: the load already requires `max_attempts >= 1`. L12 contradicts ADR-0228 F1, L13 F2.)

**Attack round 2 on `a4e3f33`** (`evidence/phase-09/attack-a4e3f33-r2-{boundary,logic}.json`; logic again re-run by
hand on the fallback model after arc-attack's run failed). Boundary 7 (3 medium, 4 low), logic 1. **All 7 boundary
findings fixed**, so nothing goes to the debt ledger: B1 the run's money total read spend with a bare `isFinite` while
the hop record used the round-1 predicate (the twin, one round later) -- one `okInr` now; B2 a missing CLI is declared
only when the work root is a usable directory, so a local cwd fault cannot hop to a gateway; B3 only ENOENT/EACCES/EPERM
make a launch failure `provider-unavailable`; B4 an exit-0 attempt that is not an accepted answer is `unknown`, never
the success marker; B5 a name outside the closed driver set has no family and the router is not consulted for it; B6
the class and the cost are written under separate guards, class never lost to a cost write; B7 `max_wall_ms` caps the
first attempt on the routed path too (ADR-0228 item 7 and the router header now say so).
`REJECTED: L1 (r2) max_attempts should refuse the first dispatch — already-covered`
(Round 1's L5 again; its own fix text describes the existing behaviour: `max_attempts: 1` allows the first attempt and
no hop.) Two rounds is the cap; push next.

**Receipts, emitted from the MAIN clone after the merge (2026-10-07), each verified in `events/2026-10-07.jsonl` and
absent from `_quarantine/`:** `kickoff.done` `01M4BJT821YEE8E3F28X69BMBV` · `phase.closed` 09 `01M4BJT9WJC9Z6G54C9N3VHZ23` ·
`phase.closed` 10 `01M4BJTAJH5194GGF0BM5NR9WD`.
**The owner's three stamps (approval.requested, decided only by him -- approving my own plan is the self-authorising act
POL-I exists to prevent):** plan `01M4BJT9GZRA9SD9D8WZVYJ3A1` · past phase 09 `01M4BJTA7RR6JJFMV3N64V314K` · past phase 10
`01M4BJTAXKG0H54443VZAWWZ3Y`. Stamp with `node .claude/scripts/hq/arc-inbox.mjs approve <ULID> --reason ...` from the main clone.

**The merged tree, by dispatch:** run 37651480130 at `3ffc2220` -- **18/19, and the one red is not engine's**, recorded
rather than smoothed: `face-browser`'s `bench.run-model` flow timed out at its fixed 30 s CDP limit on Windows shard 1, on
the run and again on a rerun. The same flow measured **25.6 s on main BEFORE this merge** (dispatch 37629185502) and
**16.0 s on this PR's own head** (run 37643247522) -- it was already within a few seconds of its ceiling, and runner
variance crossed it. The flow is the face lane's harness and its limit is a gate; raising it is a gate change that needs
`/arc-change` in the face lane and the owner's OK, so it is handed over, not touched here.
