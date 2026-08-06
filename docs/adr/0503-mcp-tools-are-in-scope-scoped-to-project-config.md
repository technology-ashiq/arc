# ADR 0503 — MCP tools are in-scope capability surfaces, scoped to the project's own `.mcp.json`

**Status:** accepted
**Date:** 2026-08-06
**Product:** `policy`
**Reversibility:** two-way
**Revisit trigger:** a fifth server is added to the project `.mcp.json`, **or** a user-level
connector is used by an automated run in this repo. Either one means the scope line drawn here
no longer matches reality, and the matrix must be re-derived before the next promotion.

## Context

`PLAN-policy.md` describes the interactive surface as "`Bash` and `Edit|Write` matchers" and
never mentions MCP. Two facts found at kickoff make that a hole rather than an omission:

1. PreToolUse **does** fire for MCP tool calls, matched as `mcp__SERVER__TOOL` (regex after the
   `mcp__` prefix). They are interceptable by the same mechanism as built-in tools.
2. This project's `.mcp.json` declares **four servers**, and two of them are side-effect-bearing
   in exactly the classes this build governs:

| Server | Capability classes it reaches | Note |
|---|---|---|
| `stripe` | **spend** (and E2 territory: payees, prices, refunds) | real money |
| `supabase` | **write**, **deploy** (migrations, edge functions, branches) | real data |
| `playwright` | **network**, and file/shell reach through the browser | |
| `context7` | **read** (documentation fetch) | read-only |

A policy engine that governs `Bash` and `Write` while `stripe` moves money through an
unenforced channel is the "polices politely" outcome the plan's own kill criteria name. Against
that: the MCP surface is unbounded in principle. The session running this kickoff has access to
user-level connectors — Vercel `deploy_to_vercel`, Slack `slack_send_message`, Notion page
writes, Higgsfield `buy_domain` / `buy_credits` / `confirm_billing_purchase` — which between
them cover every one of the 8 capability classes. Putting "all MCP" in scope makes REQ-01's
matrix grow with every server anyone ever connects, against a 7-day cap with a day-2 kill
criterion on REQ-01.

## Options considered

1. **A — in scope, the four project servers only.** Bounded and verifiable; the boundary is a
   file in the repo, not a judgement.
2. **B — `stripe` and `supabase` only.** Narrowest useful. Cons: `playwright` drives a real
   browser, which reaches network and the filesystem; leaving it out is a named gap in a class
   the build claims to cover.
3. **C — out of scope, recorded in No-gos.** Protects appetite fully. Cons: ships a policy
   engine with a live money channel outside it.
4. **D — all MCP including user-level connectors.** Most complete, and unbounded: the matrix
   would have to be re-derived whenever any user connects a server, which no fixture can pin.

## Decision

**Option A.** MCP tools are first-class capability surfaces, and the in-scope set is exactly the
servers declared in this repo's `.mcp.json`: `stripe`, `supabase`, `playwright`, `context7`.
Each server's tools are mapped to capability classes in REQ-01's feasibility matrix and enforced
through the same shared library as every built-in tool (POL-D — one implementation, not a
parallel MCP path).

The one reason that carried the most weight: **the scope boundary is a file in the repo**, so it
is derivable, diffable, and it fails loudly. The matrix is generated from `.mcp.json`, and a
server present in that file with no matrix row is a Phase-0 exit failure — which means adding a
fifth server breaks the build rather than silently widening the unenforced surface. A boundary
drawn by judgement would have needed a human to remember; this one does not.

Two consequences of that boundary are written down rather than left implicit:

- **User-level connectors are a No-go this cycle, by name and with the reason** — not silently
  absent. They are outside the repo, unpinnable by fixture, and unbounded.
- `stripe` is **spend and E2 territory**. Per POL-F it is never above L1 in v1 and per ADR-0501
  it carries a static `permissions.deny` backstop as well as a hook fragment. `supabase` gets
  the same backstop for its deploy-class tools.

**Evidence:** `.mcp.json` in this repo → servers `supabase, playwright, context7, stripe`
(derived, not recalled). MCP matcher syntax and the fact that PreToolUse fires for MCP tools per
`https://code.claude.com/docs/en/hooks.md`, checked 2026-08-06. MCP deny-rule syntax
(`mcp__SERVER__*`, `mcp__*__writeTOOL` patterns) per
`https://code.claude.com/docs/en/permissions.md`.
**Confidence:** medium — that PreToolUse fires for MCP tools is documented but not yet observed
in this repo. It is row 2 of REQ-01's feasibility matrix and is proven by fixture in Phase 0
before anything is built on it. Tracked in the Assumptions ledger.
**Rejected because:** B — leaves `playwright`'s network and file reach unenforced while claiming
those classes. C — leaves a live money channel outside a policy engine. D — unbounded matrix
against a hard 7-day cap and a day-2 kill criterion.

## Consequences

Easier: the largest side-effect channel in a modern Claude Code repo is inside the model from
day one instead of being a v2 retrofit, and the money-bearing server is treated as money rather
than as a generic tool. Harder: REQ-01's matrix gains roughly 40 tool rows, and Phase 0 must
generate it from `.mcp.json` rather than hand-list it, so that the "server with no row" check is
real. If the revisit trigger fires, the matrix is re-derived — it is not a decision to re-take.
