# Phase 04 — the assumptions ledger, evaluated at close

**Date:** 2026-08-13 · **Lane:** bench

`/arc-retro`'s rule: **run every count a trigger names before writing any status**, and record a
dogfood-gated row as **NOT EVALUABLE** rather than VALIDATED. A row marked validated on a count
nobody ran is worse than a row left open.

| # | Assumption | Status | The count that was actually run |
|---|---|---|---|
| 1 | The 5 armed `commit-msg-draft` fixtures can discriminate a champion from a candidate | **NOT EVALUABLE** | The trigger names *"Phase 3's real event returns identical assertion pass-rates for both models"*, and the real event is **blocked** — bench cannot vary the model through `arc-run` at all. What WAS measured: the drift probe replaced every recorded subject with `"changed some stuff."` and the fixtures scored **3/6** against **6/6**, so they discriminate GOOD output from BAD. They have never discriminated two MODELS, and this row stays open until they have. |
| 2 | A full 3-class run at K=3 fits the ₹500 cap at the placeholder ceilings | **NOT EVALUABLE** | Only **one** class clears the fixture floor, so a full run is 5 fixtures × K=3 = **15 invocations of one class**. Under `mock` the declared worst case is ₹0, so ₹0 is committed and the caps do not bind. No real driver+model pair has a ceiling **because no real pair can be invoked** — adding one would declare a bound on spend that nothing can spend. Recorded in `ceilings.json`'s `_arithmetic`. |
| 3 | `drivers/mock` replaying pinned bytes exercises the same code path a real driver takes | **VALIDATED** | Slice 02's M9 negative control: the driver tree is copied, the COPY is patched to throw inside `produce()`, and the contract suite is run against it. The mock IS a `produce()`, so the break reaches it — unlike `ARC_DRIVER_FAKE`, which returns at `common.mjs:180-191` before `produce()` runs. |
| 4 | A bench run is semantically a `run.completed` and needs no new kind | **VALIDATED** | Every bench emit across five probe suites landed in `events/` and **none** in `events/_quarantine/`; no emit was ever rejected `UNKNOWN_KIND`. The quarantine directory is asserted empty on every happy path, so the absence is checked rather than assumed. |
| 5 | The canonical encoder yields byte-identical scorecards on all 3 CI OS legs | **VALIDATED on CI** | `tests/bench-core.bats` re-scores a capture bundle and diffs the bytes; it runs on ubuntu (18/20/22), macos and windows. Two encoder defects were fixed to earn this: `canonicalJson` validated one read and rendered another, and `-0` survived the hash while `JSON.stringify` destroyed it in the bytes. |
| 6 | Bench's driver invocations resolve their policy subject to the underlying process | **VALIDATED — and the trigger text is superseded** | The row's trigger reads *"the mutant is NOT rejected, or is rejected for a reason unrelated to the policy gate"*. **ADR-0912's correction inverts the second half**: `common.mjs:156-168` already polices a direct spawn, so being stopped THERE proves nothing about what the spawn breaks. The seal probe asserts the mutant is rejected **for bench's own reason** (no `arc-run` receipt, citing M1) and explicitly **not** by policy. The assumption holds; the trigger as written would have fired on the correct behaviour. |
| 7 | The monthly guard gets run, and its absence is visible on the spine | **FIRED — and the answer is zero** | The count the trigger names, run against the canonical spine in the main clone: **17 day files, 0 events carrying `process: bench@0.1.0`.** Bench has emitted **no production receipt at all**, so the guard has never run in production. That is visible on the spine exactly as the assumption predicted — the mechanism works; the guard has simply not been started yet. NEXT-CHECK is recorded in `PROGRESS.md`. |

## Bench's PRODUCTION `run.completed` count

```bash
cd E:/Work_Hub/01_Automemory/arc      # the main clone; .claude/state/ is gitignored per worktree
cat .claude/state/hq/events/*.jsonl | grep -c '"process":"bench@0.1.0"'
# -> 0     (across 17 day files)
```

**Zero, and it is written here rather than inferred.** Every run this cycle used a throwaway
`ARC_SPINE_ROOT`, and this lane works in a linked worktree where the emitter refuses by design
(`spine-io.mjs` `assertNotLinkedWorktree`). A cycle that adds machinery has to assert its
production count at close: policy's Cycle 9 shipped 4 kinds with 0 emissions and only the ledger
could say so. Bench shipped 1 kind reused and 0 production emissions, and says so.

## Did the eval packs discriminate?

**Partly, and the honest answer is "not on the question they exist to answer."**

- They **do** separate good output from bad: a degraded subject scored 3/6 where the recorded one
  scores 6/6, and each of the six assertions failed for its own stated reason.
- They have **never** separated two models, because no second model has been reachable.
- The `basic.json` fixture carries **no assertions at all** and measures nothing. It clears the
  declared floor and is excluded from the new measuring floor — which is the retro's own finding
  turned into a gate.

Per the retro rule: the follow-up strengthens the **owning process's** eval pack, not bench.
`review-diff` and `kickoff-plan` ship **one** fixture each and read `NO PROPOSAL` by construction.
That is the gate working, and it is engine's pack to arm, not bench's.
