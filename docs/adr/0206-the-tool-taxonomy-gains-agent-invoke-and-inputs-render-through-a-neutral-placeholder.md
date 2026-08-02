# ADR 0206 — the tool taxonomy gains `agent.invoke`, and inputs render through a neutral placeholder

**Status:** accepted
**Date:** 2026-08-03
**Product:** `engine` — lane `engine`, ADR band 0200–0299
**Reversibility:** two-way
**Revisit trigger:** a fourth pilot needs an eighth primitive. One addition per cycle is
disciplined growth; two in one cycle means the taxonomy is being designed by accretion and should
be rethought as a whole.

## Context

The design source fixes the starting taxonomy at six — `fs.read`, `fs.write`, `shell.run`,
`web.search`, `git.op`, `ask.human` — and says extend by ADR, while listing "perfect abstract-tool
taxonomy" as a rabbit hole. This ADR is that extension, kept to the minimum the three locked
pilots actually demand.

Reading the pilots against the six:

- `arc-commit.md` — `Bash(git …)` and `Bash(.../arc-event.sh)`. Covered: `git.op`, `shell.run`.
- `arc-review.md` — the above plus **`Task`** (invoke the `code-reviewer` subagent) and `Write`.
  `Write` is `fs.write`. **`Task` maps to nothing.**
- `arc-kickoff.md` — reads, writes, runs scripts, asks the owner, and spawns `codebase-surveyor`,
  `question-planner`, `plan-attacker` ×3, `plan-simulator`. **Delegation is most of what it does.**

Delegation is not an implementation detail of these commands; for `arc-kickoff` it is the command.
Leaving it untyped means the canonical file's `tools:` list is a lie about the most consequential
thing the process does, and the codex adapter has nothing to translate — REQ-03's "runnable
equivalent" would be unreachable for exactly the pilot that matters most.

Separately, the bodies contain argument placeholders in claude-code syntax: `${1:-main}` in
`arc-review.md`, `$ARGUMENTS` in `arc-kickoff.md`. Under ADR 0205 the body is shared by every
adapter, so a claude-code placeholder sitting in it would make the body target-specific — the one
thing 0205 forbids.

## Options considered

1. **Leave `Task` untyped, dialect-only** — pros: no taxonomy growth. Cons: `agent.invoke` is
   invisible to the router and to `router.yaml`'s task-class mapping, and REQ-03 degrades to
   re-emitting claude-code text for the hardest pilot.
2. **Add a full delegation model** — roles, isolation, tool grants, return contracts. Pros:
   expressive. Cons: this is the rabbit hole the design source names, inside a 2-week cap.
3. **Add exactly one primitive plus a neutral placeholder syntax** — pros: types the thing that
   matters, costs one row. Cons: `agent.invoke`'s payload stays coarse in v1.

## Decision

**The taxonomy becomes seven: the original six plus `agent.invoke`.** Its canonical form names the
agent and nothing more — `agent.invoke: { agent: code-reviewer }`. Isolation semantics, tool
grants and return contracts are **not** modelled in v1; each target renders its own (claude-code →
the `Task` tool with `subagent_type`; codex → its own delegation form, or an explicit
"unsupported on this target" compile failure, which is a fact worth surfacing rather than
papering over).

**Inputs render through one neutral placeholder: `{{input.NAME}}` and `{{input.NAME|default:VALUE}}`.**
The shared body carries only these; each adapter renders them into its dialect (`${1:-main}` for
claude-code positional arguments, and so on). `process-lint` FAILs on any dialect-native
placeholder appearing in a body — a placeholder that leaks is a body that has quietly become
target-specific, which is ADR 0205's failure mode arriving through a side door.

**Extension is capped at this one addition for this cycle.** A seventh primitive is a decision; an
eighth, this cycle, is scope creep and gets routed through `/arc-change`.

**Confidence:** high — derived by reading the three locked pilots' actual `allowed-tools` lines and
bodies at `7abeda1`, not from anticipating future commands.

## Consequences

**Easier.** `router.yaml` can route on a task class that includes delegation, because delegation
is a typed step. The codex adapter's inability to express delegation becomes a visible compile
failure rather than a silently degraded output.

**Harder.** `agent.invoke` is deliberately under-specified, so two targets may render the same
canonical delegation with materially different isolation. That is acceptable while the output
contract is the equalizer (the design source's own framing), and it is a real limit rather than a
solved problem.

**What we'd revisit if this goes wrong.** If the coarse payload lets two targets diverge in a way
the output schema does not catch, the fix is a return-contract field on `agent.invoke` — one
field, not the full delegation model rejected above.
