# ADR 0602 — ABS-C: a rebuild lands only on an allowlist, and widening it is an amendment

**Status:** accepted
**Date:** 2026-08-09
**Product:** `absorb`
**Reversibility:** two-way
**Revisit trigger:** a technique worth adopting cannot be expressed anywhere on the allowlist —
which is evidence about the allowlist, and reaches this ADR as an amendment rather than reaching
the lint as an exception.

## Context

absorb's output is an **edit to arc's own files**. That is the whole point of the lane and also its
sharpest hazard: a loop whose product is "arc edits itself" needs a hard boundary on *where*, or
one bad study reaches the engine, the spine, or a hook.

The precedent is evolve's `promote_via` discipline. The negative precedent is more instructive:
Cycle 7's propose-only guard was a grep, and a mutant module that overwrote the canonical file,
deleted the champion, committed and spawned a deploy walked straight past it. So the boundary must
be a list a parser can read, and the test that protects it must be attacked by a mutant built to
walk past it.

## Options considered

1. **Denylist** (block engine, spine, settings, workflows). Pros: permissive, fewer amendments.
   Cons: every new sensitive path is unprotected until someone remembers to add it — the boundary
   defaults to open, which is the wrong default for a self-editing loop.
2. **Allowlist, amendable only by ADR.** Pros: defaults to closed; the unknown path is refused.
   Cons: friction, and the friction lands exactly when someone is mid-adoption.
3. **Human review only, no list.** Rejected: the reviewer sees a diff, not the absence of a rule,
   and this repo has already shipped three vacuous passes written by careful people.

## Decision

**Rebuilds land only here:**

- `processes/**`
- `docs/playbooks/**`
- `.claude/commands/**` (command bodies)
- `tests/**` — fixtures that accompany a rebuild

**Explicitly out:** engine code · spine and hq scripts · `.claude/settings.json` · workflows ·
anything executable by a hook.

The list lives in **one** place — this ADR, plus a lint-readable copy the gate reads, generated
from it rather than retyped. Widening the allowlist is an amendment to this ADR. It is never a
convenience edit made while mid-rebuild, and it is never an argument made in a PR description.

Out-of-allowlist rebuild attempts warn from birth (**WARN-first in TRIAL**), promoted to FAIL via
`/arc-retro`. The guard's own test gets a **negative control that runs a mutant** built to walk
past it — a grep is never the guard where a parse is available.

## Consequences

**Easier.** The blast radius of a wrong study is bounded by a list rather than by judgement. A
reviewer can check "is this path on the list" without understanding the technique.

**Harder.** Genuinely good techniques that live in engine code cannot be absorbed in v1 — they
route to develop's vet+lock path or to executor's INTEGRATE verdict instead, and some will simply
wait. The allowlist will feel wrong the first time it refuses something obviously fine; that
feeling is the control working, and the amendment path exists so it is answerable without
weakening the gate mid-cycle.
