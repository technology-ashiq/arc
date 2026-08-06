# ADR 0504 — An action kind is the authorization subject: `process:NAME` or `session:interactive`

**Status:** accepted
**Date:** 2026-08-06
**Product:** `policy`
**Reversibility:** two-way
**Revisit trigger:** a third execution surface appears that is neither a `processes/` entry nor
an interactive session — a scheduler job that is not a process, or a driver invoked outside
`arc-run`. That is a new namespace, decided by amending this ADR, never by widening
`session:interactive` to mean "everything else".

## Context

The design source keys the entire policy model on "action kind" — POL-A's ceiling is per action
kind, POL-C's reducer folds "the kind's transition events", REQ-04's promotion payload carries
`action_kind`, and REQ-03's deny-by-default is "an action kind absent from the file is
read-only". It never says what an action kind **is**.

The kickoff's simulation gate found this first, and rated it the blocker that stops day one
earliest: an executor cannot write a single valid line of `hq.policy.yaml` without knowing what
the keys are. Candidate readings were all live — a spine event kind, a process name, a tool
name, or a new namespace this build invents — and they are not interchangeable. Spine kinds are
receipts of things that happened, not units of authority. Tool names exist only on the
interactive side. Process names exist only on the headless side.

## Options considered

1. **A — spine event kinds** (the closed 40). Pros: already closed and validated. Cons: they
   describe what was recorded, not what may be attempted; `arc-run` invokes a process, not an
   event, so there is nothing to look up at the authorization point.
2. **B — process names only**, from `processes/*.process.yaml`. Pros: exactly what `arc-run`
   authorizes, already a closed derivable set, and it makes POL-D's "process `permissions:`
   blocks declare ≤ policy grants" a direct comparison. Cons: the interactive surface has no
   process, so hooks would have no subject to authorize against.
3. **C — tool names** (`Bash`, `Write`, `mcp__stripe__*`). Pros: matches the hook matcher
   surface. Cons: inverts the model — a tool is the *object* a capability acts through, not the
   subject holding authority; and it leaves headless runs with no subject.
4. **D — two closed namespaces**: `process:NAME` for headless, plus one reserved
   `session:interactive` for the interactive surface.

## Decision

**Option D.** An **action kind is the authorization subject** — a stable string naming a unit of
automated work that can hold a capability vector. Exactly two namespaces, both closed:

| Kind | Source of the closed set | Authorized at |
|---|---|---|
| `process:NAME` | the `name:` field of each `processes/*.process.yaml` | the `arc-run` wrapper, before any driver is invoked |
| `session:interactive` | reserved, exactly one | the PreToolUse fragments |

The one reason that carried the most weight: **the set has to be derivable so that
deny-by-default is checkable rather than aspirational.** Because `process:` kinds come from a
directory listing, a process with no policy row is a *detectable* condition — which is exactly
what REQ-07's birth-rule lint checks and what REQ-03's "absent kind is read-only" fixture
asserts. A namespace invented per-entry would make both of those unenforceable.

Capabilities remain the *verbs* (read/write/shell/network/message/publish/deploy/spend) and
tools remain the *instruments* a capability acts through — a tool is mapped to a capability by
REQ-01's feasibility matrix, never granted a level of its own. Keeping subject, verb and
instrument distinct is what stops the schema collapsing into a per-tool allowlist, which is
POL-J's separation applied one level down.

**Evidence:** `processes/*.process.yaml` exist and already carry a `permissions:` block that
nothing currently validates (verified in the kickoff cap inventory);
`.claude/scripts/engine/arc-run.mjs` invokes a driver by process name;
`.claude/hooks/PreToolUse.sh` and `_dispatch.sh` receive a tool payload with no process context
at all, which is why the interactive surface needs its own reserved subject.
**Confidence:** high — derived from the two entry points as they exist today.
**Rejected because:** A — an event kind is a receipt, not a subject. B — leaves the interactive
surface with nothing to authorize. C — makes the instrument the subject, which collapses the
capability model into a tool allowlist and loses the headless surface entirely.

## Consequences

Easier: `hq.policy.yaml` has an obvious top-level shape; the birth rule and deny-by-default both
become mechanical checks against a directory listing; POL-D's process-declares-less-than-grant
lint is a straight comparison of two blocks keyed the same way. Harder: `session:interactive` is
a single subject covering a whole human session, so it is inherently coarse — it gets exactly
one vector, and anything needing finer interactive granularity is a v2 question, not a runtime
exception. If the revisit trigger fires, the answer is a third namespace in a superseding ADR.
