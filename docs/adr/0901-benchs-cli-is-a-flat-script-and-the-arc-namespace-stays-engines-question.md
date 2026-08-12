# ADR 0901 — bench's CLI is a flat script, and the `arc <noun> <verb>` namespace stays engine's question

**Status:** accepted
**Date:** 2026-08-12
**Product:** `bench`
**Reversibility:** two-way
**Revisit trigger:** the engine lane decides the namespace fork and ships a real dispatcher —
bench then registers `bench` as a subcommand and keeps the flat script as an alias for one
cycle.

## Context

`PLAN-bench.md` REQ-01 states the CLI contract as
`arc engine bench --driver <driver> --model <provider/model> --budget inr=<cap>`, described as
"namespace inherited from the engine's ENG-D decision".

Verified 2026-08-12: **there is nothing to inherit.**

- No `arc` binary, no dispatcher, no `bin/` directory, no `package.json` anywhere in the repo.
- The live invocation form is a flat script:
  `node .claude/scripts/engine/arc-run.mjs --process NAME [--driver NAME|auto] [--budget inr=N,min=M]`
  (`arc-run.mjs:29-32`), with a **closed six-flag set** and `exit 2` on any unknown option
  (`arc-run.mjs:55-64`). A bare positional token like `bench` hits that branch.
- ENG-D (**ADR-0203**) defines only the driver interface. It never records a namespace decision,
  despite `PLAN-engine-process-layer.md:169-172` flagging it as "decide ONCE at kickoff…
  bench's brief assumes `arc engine bench`, so the namespace chosen here is the one bench
  inherits." The engine cycle closed without deciding, so the namespace resolved **by default**
  to the flat-script form.

Assumption 6 of `PLAN-bench.md` is therefore falsified on this half.

## Options considered

1. **Build a general `arc <noun> <verb>` dispatcher** so REQ-01's text works literally — the
   largest scope add, and it retroactively answers the engine lane's open question from inside
   bench, for every engine command, not just this one.
2. **Mirror the proven flat-script convention** — `arc-bench.mjs` beside `arc-run.mjs`, same
   closed-flag parser, same `exit 2` on unknown, and record the namespace question as
   explicitly still open and still engine's.
3. **A thin one-off `arc` wrapper that only knows the word `bench`** — a half-dispatcher that
   pre-empts the real decision while implementing none of it.

## Decision

**Option 2.** Bench ships:

```
node .claude/scripts/engine/arc-bench.mjs --driver <name> --model <provider/model> --budget inr=<cap> [--champion] [--propose] [--dry-run]
```

It reuses `arc-run.mjs`'s flag-parsing shape verbatim: a closed flag set, `exit 2` naming any
unknown option, and `--budget` keys closed to `inr` and `min` with a duplicate key treated as
operator error.

Deciding the whole company's CLI namespace from inside a lane whose no-gos already forbid
engine-territory work is exactly the scope creep this plan is meant to refuse. Option 3 is the
worst of both — it creates a dispatcher surface without the decision that should govern it.

**REQ-01's acceptance text is rewritten to name the real command.** A requirement whose
acceptance criterion names a command that has never existed cannot fail honestly.

## Consequences

**Easier:** Phase 0 ships a working CLI on day one against a proven parser, and the engine
lane keeps its own decision.

**Harder:** the documented command differs from every prose mention of `arc engine bench` in
`docs/strategy/**` and `docs/archive/BRIEF-bench.md`. Those are design sources, not contracts,
and are left alone — but the runbook (Phase 3) states the real form, and `--model` is a **new
flag with no precedent**: `arc-run.mjs` has none, resolving the model from `engine/router.yaml`
by tier and passing it to the driver as `ARC_DRIVER_MODEL` (`arc-run.mjs:121-125, 377`). Bench
passes its explicit `--model` through the same env channel, so the driver contract is unchanged.
