# BRIEF — chat interface (HQ MCP server)

> **Trigger (pull):** dashboard exists AND conversational questions ("why did revenue dip
> Tuesday?") are genuinely frequent. **Prereqs:** spine reader + inbox + pnl stable.
> This is "talk to the company" — same API, zero new truth.

**Goal:** a local MCP server exposing the spine to any MCP-capable client (Claude Code /
desktop): `hq_query` (reader passthrough), `hq_brief`, `hq_pnl`, `hq_inbox`, `hq_approve`
— so any conversation can interrogate the company's receipts and clear the inbox, with
writes limited to the one decision path.

**REQs (measurable):**
1. MCP server (zero-dep node, stdio) exposing the 5 tools; every tool result derived from
   the reader (lint-proven); read tools have NO side effects (fixture: state hash unchanged).
2. `hq_approve/reject` produce decision events byte-identical to CLI ones (parity fixture).
3. Guardrails: tool responses respect redaction (no secrets ever serialized); result-size
   caps (no accidental full-spine dumps into a chat context).
4. Real use: one week where daily questions are answered via chat against the live spine;
   ≥5 real queries logged as evidence (`run.completed` events with tool name).
5. Registration documented: one-line `.mcp.json` entry; works in Claude Code + desktop.

**Appetite:** 3 days.
**Phases sketch:** 0 server + read tools + caps/redaction (adversarial pass on
serialization) → 1 approve parity + registration → real week + retro.

**Non-negotiables/no-gos:** localhost/stdio only — never a network service · writes =
approve/reject ONLY (no event-emitting tools; the factory emits, chat doesn't) · no
"agent that acts on the company" ambitions here (that's policy-engine territory, much
later, evidence-gated) · reader-only discipline inherited.

**Pre-mortem top-3:** (1) a chat tool becomes an unaudited write path → single-write-path
parity fixture; (2) context floods with spine dumps → size caps + pagination; (3) secrets
serialized into chat logs → redaction at the serializer, fixture-proven.

**Open decisions at kickoff:** exact tool list v1 · result cap sizes.

**Kickoff prompt:**
```
/arc-kickoff chat interface — HQ MCP server
Design source: docs/strategy/plans/BRIEF-chat-mcp.md (trigger: dashboard live +
conversational demand). Expand to full PLAN; single-write-path + caps + redaction locked.
STOP after PLAN + specs for my approval.
```
