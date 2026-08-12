# ADR 0912 — bench adds no policy subject, and must not become a policy bypass (POL-I)

**Status:** accepted
**Date:** 2026-08-12
**Product:** `bench`
**Reversibility:** two-way
**Revisit trigger:** bench gains a capability no underlying process authorizes (a bench-only
provider call, a network fetch outside a driver) — it then becomes its own subject and is born
with its row in the same change.

## Context

POL-I's birth rule says a module born after the policy engine lands is born WITH its policy row.
`PLAN-bench.md:68-70` schedules that check for kickoff.

Verified 2026-08-12. `hq.policy.yaml` keys exactly four action kinds — `session:interactive`,
`process:kickoff-plan`, `process:review-diff`, `process:commit-msg-draft` — and the subject
model is closed: *"`process:NAME` resolves against `processes/*.process.yaml`… authorized at
the `arc-run` wrapper, before any driver is invoked"* (ADR-0504).

**Bench is a runner, not a process.** It has no `processes/bench.process.yaml` and should not
have one: it is the same shape as `arc-run.mjs`, which is itself an enforcement point and holds
no row. What bench executes are the three existing pilot processes — each of which **already
has a row**.

An initial reading of this gate concluded bench needed a `process:bench` row carrying spend,
network and write. That reading was wrong, and it matters why: it would have created a **new
subject that authorizes bench's spending in its own name**, decoupled from the process actually
being run — precisely the coupling the policy engine exists to maintain.

## Options considered

1. **Author a `process:bench` row** with spend/network/write — makes bench self-authorizing and
   lets a bench run spend under an authorization the underlying process never received.
2. **No new subject; bench routes every driver invocation through the same policy gate**, so
   authorization is resolved against the process being benched.
3. **Bench spawns drivers directly for speed** — fastest, and it is an unpoliced path to
   provider spend.

## Decision

**Option 2. Bench introduces no action kind and adds no row to `hq.policy.yaml`.**

Every driver invocation bench makes resolves its policy subject as `process:<the process being
benched>` and passes through the identical gate `arc-run.mjs` uses (`arc-run.mjs:334-362`). A
denial behaves exactly as it does for a normal run: no driver process starts, an
`incident.raised` receipt is emitted, and the run terminates with `reason: "policy"` — and a
policy denial never triggers the fallback driver chain.

**Option 3 is a declared no-go for this lane**, stated here because it is the shortest path and
would be invisible in review: a runner that spawns `drivers/<name>.sh` itself, bypassing the
gate, is an unpoliced spend path wearing a test harness. Phase 3's adversarial pass includes a
mutant bench that spawns a driver directly, and the suite must reject it.

**One honest consequence recorded rather than routed around:** because the policy subject is
the underlying process, benching a class whose process has no row would run **read-only at L1**
and be denied its spend — which is the birth rule working. All three pilots have rows, so this
does not bite today.

## Consequences

**Easier:** no new policy surface, no new ceiling to maintain, and bench inherits every
authorization decision already made about these processes.

**Harder:** bench cannot bench a process that has no policy row, and must fail loudly with that
reason rather than degrading to a partial run that looks like a budget skip.

**The trap this closes:** `docs/retro-log.md` 2026-08-04 (arc-evolve) — *"the GUARD protecting
this lane's single most important rule was a grep, and it was porous… a mutant module that
overwrote the canonical file, deleted the champion, committed and spawned a deploy passed it
clean."* The propose-only and no-bypass rules are guarded by a **parse and a running mutant**,
never a grep (ADR-0913, Phase 3).
