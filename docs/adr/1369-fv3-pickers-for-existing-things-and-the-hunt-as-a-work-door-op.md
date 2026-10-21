# ADR 1369 — FV3-M: pickers name existing things; a discover hunt runs from the face as a work-door op (supersedes ADR-1356 decision 2's "no new op")

**Status:** accepted 2026-10-21 at the Cycle 17 kickoff (two-way, auto-decided per kickoff step 2b; the hunt verb was the owner's ask: "Discover pannu")
**Lane:** face (Cycle 17) · **REQ:** REQ-03, REQ-09 · **Phase:** 01, 03
**Reversibility:** two-way
**Revisit trigger:** a hunt starts spending on a model (then it is a session with its own process, not an op)
**Bound by:** ADR-1356 (superseded in its decision 2 only: "ops.mjs stays empty") · ADR-1339 · `arc-hunt.md` (a niche is never on argv)

## Context

Fields that name an existing venture, model, agent or campaign are typed by hand. ADR-1356 kept the discover room read-only. `arc-discover.mjs hunt` mines HN through growth's adapter and spends on no model (the council judge is a separate step).

## Options considered

1. **Pickers: a field naming an EXISTING thing is a door-served select through the existing `/api/ops` registry and `FIELD_SOURCES`; a field naming a NEW thing stays text with a pattern and a real example; month is a generated list. Hunt: an op whose apply writes the niche to a file under `.claude/state/discover/` and runs `hunt --niche-file` (chosen).**
2. **Hunt as a session** — needs a new process and class row for a step that calls no model.

## Decision

Pickers in Phase 01 (REQ-03); the hunt op in Phase 03 (REQ-09). ADR-1356's decision 2 is superseded explicitly here, not reversed quietly.

## Consequences

- Create-ops stay possible. The judge stays `/arc-hunt`'s council step.
