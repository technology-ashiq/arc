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

## Amendment 1 (2026-08-09, Phase 04) — the three PILOT processes are out, despite `processes/**`

The first real rebuild landed on `processes/review-diff.process.yaml`, recompiled cleanly, passed
`rebuild-lint` with 0 warnings — and **turned CI red on 7 of 19 jobs**, all of them engine tests.

**`processes/**` admits a path that is effectively frozen, and this ADR did not know it.** The three
pilot processes — `review-diff`, `commit-msg-draft`, `kickoff-plan` — are engine Cycle 6's **proof
that its compiler is faithful**. `tests/engine-compile.bats` asserts *"all 3 pilots compile
byte-identical to their hand-written baselines"*, `tests/engine-process-lint.bats` asserts each body
*"round-trips byte-for-byte out of its block scalar"* against a committed pre-flip fixture, and a
codex-target golden is pinned per pilot. Each process file even carries its own `baseline.sha256` of
the generated output.

Those are not stale hashes to bump. **They are the evidence, and editing the body destroys it.** A
rebuild that "fixed" them by regenerating every baseline would have deleted engine Cycle 6's fidelity
proof and reported itself as a clean absorb.

**Therefore: `processes/**` excludes the three pilot processes** for as long as they serve as the
engine's fidelity evidence. Changing a pilot body needs an **engine-side ruling** — the same shape as
ADR-0605's rule that flipping absorb's A/B venue needs an evolve-side ruling, and for the same reason:
the artifact belongs to another lane's proof, not to absorb's convenience.

**What this cost, recorded honestly:** the rebuild was reverted, engine is back to 3/3 byte-identical,
and T-01 has **no landing site inside the current allowlist**. The technique belongs in the review
*method*, which lives in `.claude/agents/code-reviewer.md` (CLAUDE.md: *"that agent is where the
scanners + review method live"*) — and `.claude/agents/**` is **not** on the allowlist. Reaching it is
an allowlist widening, which this ADR says is an amendment and never a convenience edit. So the
amendment is proposed rather than taken: **it is the owner's call, not a mid-phase decision by the
lane that wants the room.**

### The owner's ruling, 2026-08-09: DO NOT WIDEN

**The allowlist is not widened. `.claude/agents/**` stays off it, and T-01 stays a `candidate` row.**

The first real absorb therefore ends at a recorded classification rather than at an adoption — and
that is the outcome, not a failure to reach one. The technique is real, the verdict stands, the
evidence is committed, and the row will still be there when a landing site exists.

**Why this is the right call and not merely the cautious one:** the first thing to test this boundary
asked to be let through, and a boundary that widens for its first real applicant was never a boundary.
The pressure came from the lane that wanted the room, which is exactly the case ADR-0602 exists to
refuse. Holding it costs one blocked rebuild; conceding it would have cost the rule.

**What would legitimately unblock T-01 later**, in order of preference:

1. An **engine-side ruling** on the three pilot processes — whether their bodies stay frozen as
   fidelity evidence permanently, or whether the engine grows a deliberate re-baseline path. That is
   engine's call about engine's own proof, and it is the clean route.
2. A **playbook** under `docs/playbooks/**` (already allowlisted) that a future reviewed diff points
   the `code-reviewer` agent at — but a playbook nothing references is a guard with no caller, which
   this cycle already shipped once and had to fix.
3. A widening, later, decided on its own merits rather than under the pressure of a blocked rebuild.

**The generated-file trap, worth keeping even though the target moved.** `.claude/commands/arc-review.md`
carries `GENERATED FILE — DO NOT EDIT … deleted by the next regeneration`. A rebuild landing there
survives until the next `arc-compile` and then vanishes, with the registry still claiming it shipped.
Any future rebuild aimed at `.claude/commands/**` must first check whether that body is compiled from
`processes/`.

**Easier.** The blast radius of a wrong study is bounded by a list rather than by judgement. A
reviewer can check "is this path on the list" without understanding the technique.

**Harder.** Genuinely good techniques that live in engine code cannot be absorbed in v1 — they
route to develop's vet+lock path or to executor's INTEGRATE verdict instead, and some will simply
wait. The allowlist will feel wrong the first time it refuses something obviously fine; that
feeling is the control working, and the amendment path exists so it is answerable without
weakening the gate mid-cycle.
