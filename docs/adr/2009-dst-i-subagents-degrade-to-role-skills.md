# ADR 2009 — DST-I: subagents degrade to role skills; they are never emulated by nesting harness calls

**Status:** accepted
**Date:** 2026-10-07
**Product:** `distribute`
**Reversibility:** two-way

## Context

32 agents carry a role prompt, a `tools:` list and a `model:` tier. Some harnesses have no subagent model. Spawning one harness from inside another to fake a subagent is the "agent-to-agent call" that ORG-E already refuses, with a harness in the middle. Cited from ADR-2000.

## Options considered

1. **Nested harness calls** — a fake subagent, forbidden by ORG-E's reasoning.
2. **Role skills** — the role prompt and the tools rendered as prose, run in a single session, with the matrix saying so.

## Decision

Option 2. Where a harness has no subagent model, an agent renders as a skill carrying its role prompt and its `tools` as prose, and the matrix cell says `partial: single-session`.

## Consequences

The `tools:` fence is a real constraint in Claude Code. In a role skill it is advice. The install prints that degradation by name (REQ-02), so nobody mistakes a role skill for a fenced agent.
