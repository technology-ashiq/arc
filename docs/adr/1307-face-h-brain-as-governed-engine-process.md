# ADR 1307 — FACE-H: Ask arc runs as a governed engine process, zero write tools

**Status:** accepted
**Date:** 2026-08-19
**Product:** face
**Reversibility:** two-way
**Revisit trigger:** block C squeeze → the pre-decided cut is deterministic-only (the
LLM path is the designated cut, never the governance); a change to ADR-0219's data
boundary classes reopens the `hosted:` row.

## Context

A brain that answers from live state is useful; a brain with hands is unconstitutional.
The engine already governs exactly this shape: process file + router row + policy row +
budget + receipts (`run.completed` with cost). Pre-mortem row 7: a brain that hallucinates
receipts must be caught structurally.

## Options considered

1. **Engine process `face-ask` via `arc-run`** — pros: receipted, budgeted, keys never in
   the browser, data boundary enforced by ADR-0219 (`hosted:` class — internal-only input
   ⇒ local driver only); POL-I birth rule gives it a `hq.policy.yaml` `process:face-ask`
   row in the same change. Cons: answer latency is a shell round-trip.
2. **LLM call from L2 with an env key** — cons: an ungoverned spend path beside the
   spine; no receipts; exactly what the engine exists to prevent.
3. **Deterministic answers only, no LLM** — kept as the designated CUT, not the default:
   offline/no-key mode answers live-state questions (open approvals, burn, overdue jobs,
   kill distance) from L2 alone.

## Decision

Option 1 with option 3 as its built-in fallback. `processes/face-ask.process.yaml` ·
router row `face-ask` with tier per ADR-0069 · `hosted:` class per ADR-0219 ·
`hq.policy.yaml` row landed in the same change (POL-I) · budget · `run.completed` receipt
with cost. **Zero write tools** (tool-list fixture). Because virtually all face-ask input
is internal company data, ADR-0219 resolves to the local driver on effectively all
traffic: **face-ask is local-only by design in v1**, and Phase 07's 20-golden-question
bar is planned and graded against a local-tier model — the deterministic fallback is the
real safety net, not an edge case. A query genuinely needing external, non-company
context reopens the hosted class via `/arc-change` before the router row widens. The brain answers from live L2 reads
only, cites receipts (ULIDs become links — a citation that does not resolve via L2 marks
the answer *unverified*), can navigate and can **draft** a decision — the human still
stamps. It never emits, never approves, never runs a command. Conversation stays local.
Relation to chat-mcp: the face fires `BRIEF-chat-mcp.md`'s trigger; chat-mcp is the same
L2 + the same decision path exposed as MCP tools (`hq_query · hq_brief · hq_pnl ·
hq_inbox · hq_approve`) — Ask arc and chat-mcp share L2, never fork it.

## Consequences

Easier: the brain's cost, model tier and receipts are ordinary engine facts; the 20
golden questions are a fixture. Harder: REQ-07 depends on the engine lane's `arc-run`
being stable — already true on `main`.
