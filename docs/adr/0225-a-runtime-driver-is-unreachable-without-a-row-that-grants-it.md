# ADR-0225 — a runtime driver is unreachable without a row that grants it

- **Status:** accepted
- **Date:** 2026-08-23
- **Lane:** engine (Cycle 7, executor v1). Amends **ADR-0216** (tenure) and **ADR-0217** (the hire
  row) by naming where the four terms are enforced. Does not touch ADR-0219's driver exit map.
- **Supersedes in part:** the TERMINATION SPEC comment in `engine/router.yaml`, twice now.

## The finding

`engine/router.yaml` carries the termination spec for the hire. Step 2 says **delete the row**, and
the comment argues it is *"the only form with no reachable remainder: no row, no route"*.

Measured 2026-08-23, with the row deleted and the driver named explicitly:

```
arc-run: would run `build-in-public-draft` on `hermes`
exit 0
```

No row. No `cap`, no `hosted`, no `judge`, no `review_by`. The dispatch proceeds.

**This is the second time this comment has been wrong, and the correction repeated the mistake.**
The original wording said to set `driver:` to an uninstalled driver so the router would refuse to
load. That was measured on 2026-08-17 and found false — the router loads fine, and `--driver hermes`
against the same tree still dispatched. It was replaced with "delete the row", and **the replacement
was never measured**. A false claim about a governance mechanism, corrected by another false claim
about the same mechanism, inside the same comment.

## The hole behind it, which is larger than termination

The four terms are validated by `router-row.mjs` when the router LOADS, for any row whose driver or
fallback chain names a member of `RUNTIME_DRIVERS`. That is enforcement on the **routing** path.

Naming the driver on the command line is a different path, and it was ungoverned. `--driver hermes
--process commit-msg-draft` runs the hired runtime under a row that grants it nothing: the class row
names `claude-code`, so `isRuntime` is false, so none of the four terms is checked, so the cap does
not apply, the tenure does not apply, and there is no judge.

**This is not a hypothetical entry point.** `arc-bench.mjs` makes `--driver` MANDATORY, so the one
lane that spends real money is the lane that took the ungoverned path. The same observation was made
on 2026-08-17 about tenure (`loadRouter()` ran only inside the `--driver auto` branch) and fixed for
tenure alone; the general form — *a runtime is reachable without a grant* — was left standing.

## Decision

**A driver in `RUNTIME_DRIVERS` may only be dispatched for a class whose router row names it**,
either as `driver:` or somewhere in `fallback:`. However the driver was selected — routed, an
explicit `--driver`, or a fallback hop — the question asked is the same one: *does this class grant
this runtime?* If there is no row for the class, or the row does not name the runtime, `arc-run`
refuses at exit **2**, naming the class, the driver and `engine/router.yaml`.

The refusal happens at the same place the tenure check does: after routing is resolved, before any
driver process exists.

**Why exit 2 and not 5.** Exit 5 is the data boundary (ADR-0219) and means *this document may not go
there*. This is an operator/configuration error — the caller named a contractor nobody hired — which
is what arc-run already spends 2 on. The two are different questions and a fixture has to be able to
tell them apart.

**Why not simply require any row to exist.** Because "a row for a different driver vouches for a
runtime" is the near-miss guard shape this lane keeps finding: `commit-msg-draft` has a row, and
under that weaker rule `--driver hermes --process commit-msg-draft` would still bypass every term.
The grant has to name the thing being granted.

**What this does NOT change.** In-house drivers (`claude-code`, `codex`, `generic-api`, `mock`) are
untouched: they carry no terms, they are not hires, and an explicit `--driver mock` on any class
behaves exactly as it did. The rule is scoped by `RUNTIME_DRIVERS`, which is the same set
`router-row.mjs` already uses to decide which rows must carry the four terms — one definition of
"this is a hire", read by both the loader and the dispatcher, so the two cannot drift.

## Consequences

- **Termination becomes true as written.** Deleting the row makes the runtime unreachable by every
  path, which is what the spec claimed and did not deliver. Step 1 (revoke the credential first)
  keeps its own justification: the key is the money bound, and a live key spends if anything else
  reaches the runtime.
- **The four terms stop being optional.** A cap, a tenure, a judge and a review date now apply to
  every dispatch of a hired runtime rather than to the subset that arrived by routing.
- **Test suites driving a runtime on a class that does not grant it must move.** They point at a
  fixture root whose router carries the grant. That is the correct shape anyway: a suite exercising
  the driver contract under a router that grants nothing was exercising the hole.
- **`arc-bench`'s mandatory `--driver` is now governed.** The lane that spends real money gets the
  same load-time validation the routed path has had since ADR-0216.

## The rule this ADR is really about

A comment stating a governance figure that contradicts what the code does is the false-comment class
applied to a decision record, and it is the expensive version: the code enforced nothing, so nothing
could have caught it. **This one was corrected once and stayed false.** The lesson is not "write
better comments" — it is that a termination step is a claim about behaviour and belongs in a
fixture, not in prose. `tests/engine-router-row.bats` now carries it.
