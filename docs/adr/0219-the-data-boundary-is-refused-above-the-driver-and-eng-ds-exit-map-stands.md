# ADR 0219 — the data boundary is refused above the driver, and ENG-D's three-code exit map stands

**Status:** accepted
**Date:** 2026-08-12
**Product:** `engine` — Cycle 7, executor v1
**Reversibility:** one-way
**Revisit trigger:** a runtime is found able to receive data arc did not hand it — a runtime-side connector, an inbound webhook, a skill that fetches on its own authority. The boundary would then have to exist at the driver too, because refusing above it would no longer be refusing at all.

Discovered at kickoff, 2026-08-12. Not one of the design source's EXE-A..K set.

## Context

`docs/strategy/plans/PLAN-executor.md` lists, under **"Inherited (this cycle decides nothing these
decided)"**, an ENG-D driver exit map of `0` ok · `2` schema-fail · `3` budget-stop · `4` driver-error
· `5` data-boundary-refusal.

**That map does not exist.** Verified in the tree at kickoff:

- `.claude/scripts/engine/drivers/common.mjs:30` —
  `export const EXIT = Object.freeze({ OK: 0, DRIVER_FAIL: 1, BUDGET_DECLINED: 2 });`
- [ADR-0203](0203-eng-d-the-driver-interface-and-which-layer-owns-a-retry.md) — *"A driver exits `0`
  on a produced answer (even a bad one — judging it is `arc-run`'s job)"*
- No exit 3, no exit 4, no exit 5, and **no data-boundary concept anywhere in the engine**. `arc-run`
  itself uses `1` for cannot-proceed and `2` for operator error.

So five of the design source's codes are wrong in three different ways, and the plan built on them
contains a contradiction it could not have survived: the isolation certification suite asserts
`exit 5` in two of its twelve fixtures, while a non-negotiable states **"ENG-D contract untouched"**.
Left unresolved, Phase 05 would have discovered this after the ADRs citing it had already merged —
the failure shape this repository recorded on 2026-08-02 as *when a plan says "per ADR-X", OPEN ADR-X
before acting.*

Mapping each imagined state onto what actually exists:

| Design source | Reality |
|---|---|
| `0` ok | exit `0`. Unchanged. |
| `2` schema-fail | **Not a driver code at all.** The driver exits `0`; `arc-run` judges the output and produces `fail/schema`. |
| `3` budget-stop | `EXIT.BUDGET_DECLINED` = **2**. |
| `4` driver-error | `EXIT.DRIVER_FAIL` = **1**. |
| `5` data-boundary | **Does not exist at any layer.** The only genuinely new state. |

## Options considered

1. **Extend the driver exit map to five codes.** Matches the design source's numbers; edits the ENG-D
   contract a non-negotiable forbids editing, and changes every existing driver for one new one.
2. **Drop the data boundary.** No contradiction; deletes the control that certification fixtures #2
   and #3 exist to prove, on a cycle whose whole subject is a boundary.
3. **Refuse above the driver.**

## Decision

**Option 3.** The driver's three-code map is **untouched**, and the data boundary is enforced in
`arc-run` **before dispatch**, exiting **5**.

This is not a compromise, it is what the fixtures already described. Appendix C fixture #2 reads
*"Exit 5 **before** the runtime starts"* and #3 reads *"Exit 5 **at routing**"*. Both refusals happen
above the driver boundary, before any driver process is spawned — so they were never driver exit codes
in the first place. The design source mislabelled an `arc-run`-level refusal as a driver-level one.
The **number survives; only the layer was wrong.**

Exit `5` is new **at the arc-run layer**, and it needs to be its own code rather than reusing `1`,
because a fixture must distinguish *refused for boundary reasons* from *process did not parse* — both
of which exit `1` today. A boundary refusal that is indistinguishable from a parse error is a boundary
nobody can assert.

**The two exit spaces are separate, and this ADR publishes both.** Saying "the real exit map is
0/1/2" is true of the *driver* and false of *arc-run*, which already overloads `1` (cannot proceed:
unknown process, unparseable router, unknown driver) and `2` (operator error: bad option, malformed
budget, duplicate budget key) across `arc-run.mjs`. Before any fixture asserts `5`, arc-run's full
table is written down — including that `3` and `4` are **unused and reserved**, so a later reader
cannot mistake their absence for a meaning. A new code added to a namespace nobody has enumerated is
a collision waiting for the first person who enumerates it.

| Layer | Code | Meaning |
|---|---|---|
| driver (`common.mjs`) | 0 / 1 / 2 | ok · driver-fail · budget-declined. **Unchanged by this cycle.** |
| arc-run | 0 | the run produced an accepted answer |
| arc-run | 1 | cannot proceed — unknown process, unparseable router, unknown driver |
| arc-run | 2 | operator error — bad option, malformed or duplicated budget key |
| arc-run | 3, 4 | unused and reserved; absence is deliberate, not accidental |
| arc-run | 5 | **new:** data-boundary refusal, before any driver process is spawned |

Consequently: a wall-clock timeout is `EXIT.BUDGET_DECLINED` (**2**), a driver error is
`EXIT.DRIVER_FAIL` (**1**), and a schema failure is `arc-run`'s judgement producing `fail/schema` and
the ADR-0204 ladder — one same-tier retry, then a proposal receipt. REQ-01's "exit map honored" means
**the real map**, and REQ-02's fixtures assert an `arc-run` exit rather than a driver exit.

**Reversibility is one-way** because an exit code is a published interface: once fixtures, CI and any
caller assert on `5`, changing its meaning breaks them silently rather than loudly.

**Confidence:** high — this is a code reading, not a judgement. Every claim above cites a file and
line in the current tree.

## Consequences

**Easier.** The non-negotiable holds literally: no existing driver changes, and the runtime adapts to
arc rather than the reverse. The new code lives in exactly one place, at the layer that already owns
routing and judging.

**Harder.** `arc-run` now owns a boundary check that must run before **every** dispatch, not just
runtime ones, or it is a check with one call site — and this repository has already recorded that a
gate with one call site is only sole-entry if nothing else can reach what it guards (which is why
`common.mjs` carries the policy gate a second time). Whether the data boundary needs the same
belt-and-braces treatment is a Phase-06 question, and the answer depends on whether anything can reach
a driver without passing through `arc-run` — the engine suite itself does exactly that today.
