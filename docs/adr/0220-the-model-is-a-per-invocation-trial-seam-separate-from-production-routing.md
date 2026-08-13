# ADR 0220 — the model is a per-invocation trial seam, and a trial override never wears a routed pin's clothes

**Status:** accepted
**Date:** 2026-08-13
**Product:** `engine` — **out-of-cycle**, outside Cycle 7's 7.5-day appetite (owner-ruled 2026-08-13). It serves `bench` Cycle 13's model market, not the Hermes hire.
**Reversibility:** two-way
The seam is opt-in and additive: deleting the flag restores today's behaviour byte-for-byte, and no caller that omits it can observe a change.
**Revisit trigger:** a consumer needs the seam for something that is **not** a receipted trial — a scheduled job, a production process, a second lane routing real work through it. At that point ADR-0069(g)'s clause no longer covers it honestly, and the override needs its own policy row rather than this ADR.

Routed via `/arc-change --lane engine` on 2026-08-13, raised by the `bench` lane after Cycle 13 merged as `15a61c7`.

## Context

`bench` shipped its model market end to end and then could not vary the model — the one thing a model
market exists to do.

`.claude/scripts/engine/arc-run.mjs:402` rebuilds the driver's environment from scratch:

```js
env: { ...process.env, ARC_DRIVER_COST_FILE: costFile, ARC_ROOT: root, ARC_DRIVER_MODEL: pinnedModel ?? "" },
```

Two caller-set variables are overwritten unconditionally.

**`ARC_DRIVER_MODEL` is clobbered on purpose, and that purpose is still correct.** The comment
directly above `pinnedModel` (lines 140–145) records why:

> THE TIER MUST REACH THE DRIVER OR IT IS A LABEL. Without this the routed tier changed nothing:
> `high-judgment` and `balanced-workhorse` produced byte-identical invocations, the receipt asserted
> `model: tier:X` that nothing had applied, and **the real model knob was a run-time env var — an
> un-reviewed tier change of exactly the kind ADR-0069 b1 forbids.**

So the empty-string write is a closed hole, not an oversight. The naive fix — honour a caller-set
`ARC_DRIVER_MODEL` — reopens it exactly.

**But the only surviving pin path is unreachable from `bench`.** `pinnedModel` is non-null only when
`--driver auto` selects a `classes.NAME` row *and* `models.TIER.DRIVER` resolves. `bench` has **no
write path to `engine/router.yaml`, ever** — that is not a convention it could bend, it is asserted by
bench's own REQ-02: the `sha256` of the router is compared at run-start and again at proposal-emit, and
a mismatch aborts the run. Bench reads the router and never writes it, by construction.

The result: **the only lane whose whole job is comparing models is the one lane that cannot select
one.** Without a router row, `pinnedModel` is null, the driver receives an empty string, and the
receipt payload reads `model: "unpinned"` (line 540) no matter what the caller intended.

**`ARC_ROOT` is a second, quieter defect on the same line.** `root` (line 74) is doing two unrelated
jobs at once:

1. **where arc's own machinery lives** — `processes/`, `engine/router.yaml`,
   `.claude/scripts/engine/drivers/*.sh`, `.claude/scripts/hq/arc-event.sh`
2. **where the driver should do its work** — handed down as `ARC_ROOT`

`--root` sets both, so they can never differ. `bench` needs them to differ: arc's machinery is in the
arc repo, but a benched `commit-msg-draft` must operate on a materialized fixture repo. That process
carries `git.op: add:*` and `commit:*`, so **today the real driver would stage and commit inside the
arc repo itself** — a benchmark run mutating the harness it is measuring.

Both failures are pinned in `tests/bench-steel-probe.mjs`, which passes today for the wrong reasons and
must fail loudly once this lands:

- `ARC_ROOT` is pointed at a directory holding no recording, and the run still replays the correct bytes
- the probe sets `claude-opus-5` and arc-run's receipt still reads `model: unpinned`

Four `bench` Phase 03 DoD items sit behind this seam: one real model benched end to end · a candidate
proven REACHED (real model id, non-zero tokens) · the REQ-05 preflight · the human verdict.

## Decision

**One seam, four constraints.**

1. **Explicit and opt-in.** The override arrives as a named flag on the `arc-run` invocation. Ambient
   inheritance of `ARC_DRIVER_MODEL` from the surrounding environment stays closed — that is the
   ADR-0069 b1 hole and it is not reopened. A caller that says nothing gets today's behaviour exactly.

2. **Trial-scoped, under ADR-0069(g), never a production routing change.** Block (g) already grants
   this: *"A trial may use any candidate model, from any provider, without amending this policy —
   provided it is isolated and receipted: a branch or worktree, plus an MP-F fingerprint."* A bench run
   is precisely that. **Only production tier changes require an amendment**, and this seam performs
   none: it cannot write `router.yaml`, cannot alter a `classes` row, and cannot change what any
   un-flagged invocation does.

3. **The receipt tells the truth about where the model came from.** The model field today has two
   states — a routed pin, or `unpinned`. It gains a third that is visibly distinct, so a trial override
   can never be read back as a routing decision. This is the ADR-0069 b5 / Constitution E3 rule the code
   already states at lines 283–285: *a label here asserted a routing decision nothing had applied — a
   false claim in an append-only ledger, which is worse than an absent one.* A trial override recorded
   as a routed pin would be that same false claim, arriving through a new door.

4. **The driver's workspace root is separated from arc's own root.** `arc-run` keeps resolving its own
   machinery against the arc repo; the driver's working directory becomes independently addressable. A
   caller that sets neither sees no change.

## Consequences

**What this buys.** `bench` can drive `arc-run` per invocation with a chosen model and a fixture repo,
touching no company organ. Its Phase 03 unblocks. The seam is generic — any future receipted trial gets
it for free, which is the point of building it in the engine rather than in bench.

**What it deliberately does not do.**

- It grants **no lane a write path to `engine/router.yaml`**. Production routing remains a reviewed
  diff citing ADR-0069, and runtimes still never self-register.
- It does **not** raise any ceiling. The L1-drafts cap, the policy gate and the human publish gate are
  untouched.
- It does **not** make the override ambient. An unset flag is not an invitation to read the environment.

**The residue, stated rather than hidden.** A trial seam is still a seam. Its safety rests on the
receipt being honest about provenance and on the flag being explicit — both of which are assertions
about code that must be tested with a negative control, not trusted. The fixture that proves the
override was applied is worth less than the fixture that proves an *un-flagged* run is still byte-identical
to today, because the regression this seam can cause is silent.

## Alternatives rejected

| Option | Why not |
|---|---|
| **Honour a caller-set `ARC_DRIVER_MODEL`** | Reopens ADR-0069 b1 verbatim — the un-reviewed tier change through a run-time env var, the exact defect lines 140–145 exist to record. One line of code, and it undoes a fix that has held since Cycle 6. |
| **Give `bench` a `router.yaml` row** | Contradicts bench's own no-go and its REQ-02 SHA assertion. It also mis-models the thing: a trial is not a production route, and writing one into the router makes every experiment look like a hiring decision. |
| **Let `bench` invoke the driver directly, bypassing `arc-run`** | Throws away the policy gate, the run-owned budget, the secret scrub and the receipt — every control that makes a dispatch legible. The measurement would no longer be of the thing arc actually runs. |
| **Give bench its own forked copy of `arc-run`** | Two copies of the dispatch path drift, and the lane measuring models would be measuring a different engine than production uses. ADR-0202's generated-file rule applies in spirit: one body, no per-consumer passthrough. |

## Related

- [ADR-0069](0069-balanced-model-policy.md) — blocks (b1) production tier changes are reviewed diffs, (e) MP-F fingerprint, **(g) exploratory-trial freedom** — the clause this seam runs under
- [ADR-0203](0203-eng-d-the-driver-interface-and-which-layer-owns-a-retry.md) — the driver interface this seam parameterises without altering
- [ADR-0204](0204-eng-e-escalation-terminates-in-a-proposal-receipt-never-a-tier-change.md) — escalation never ends in a tier change; this seam is not an escalation path
- `initiatives/bench/PLAN.md` REQ-02 — bench's read-only relationship to the router, which this ADR must not break
