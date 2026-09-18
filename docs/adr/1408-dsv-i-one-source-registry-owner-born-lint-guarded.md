# ADR 1408 — DSV-I: one source registry, owner-born, lint-guarded, future-proof

**Status:** accepted
**Date:** 2026-08-23
**Product:** `design`
**Reversibility:** two-way
**Revisit trigger:** a source arrives that the grammar cannot express without a new top-level
field — the schema is then under-specified and gains a version bump, not a free-text column.

## Context

Design v2 pulls from many external surfaces: component MCPs, generator APIs, free galleries,
paid galleries, and browser-only tools that can never be automated. Cycle 3 had no registry at
all, so "which sources may we use, for what, at what cost" lived in prose across three files.

## Options considered

1. **A list of URLs in the brief template** — pros: nothing to build / cons: no way to express
   permission, cost, or observed availability, and no gate can read it.
2. **A typed YAML registry with a lint** — pros: adding a future site is one clean entry, and
   a new access pattern is one small adapter / cons: schema design has to be right early.

## Decision

Option 2. `design.sources.yaml` with: `id` · `kind[]` (inspiration/generator/components) ·
`access` (mcp/api/browser/fetch/manual) · `allowed_use[]` · `auth` (none/env/oauth/manual) ·
optional `credential_ref` · `cost` · `status` (owner intent: active/trial/off) ·
`availability` (observed per run, **never hand-set**) · `approved_by` · `added`.

**Only the owner adds entries** — the lane-birth pattern, for the same reason: a machine that
can add its own permitted sources has no permission model.

**Arrays are load-bearing.** Day-one facts falsified a singular grammar immediately: 21st.dev
is `components` **and** `generator`, and Mobbin's access is OAuth rather than an env key.

`status` (what the owner intends) and `availability` (what the last run observed) are separate
fields on purpose. Collapsing them would let a network failure look like a policy decision.

**Evidence:** 21st.dev ships a hosted MCP at `https://21st.dev/api/mcp` authenticated by an
`x-api-key` header, with a legacy stdio proxy `@21st-dev/magic` reading `API_KEY_21ST`
(21st.dev/mcp; github.com/21st-dev/magic-mcp, checked 2026-08-23). Its free tier is **search
only, 2 installs/day**; AI generation is credit-gated and therefore paid — narrower than the
`freemium` label alone conveys, so its `draft-variant` use is recorded as costed.
`ARC_DESIGN_21ST_KEY` **does not exist upstream** and is arc's internal reference name only:
`credential_ref` names the arc-side secret, and the adapter maps it to the real upstream name.
Exact npm versions were not registry-readable this session (npmjs.com returned 403); nothing
is pinned from unverified version numbers — the adapter phase runs `npm view` before pinning.
**Confidence:** medium — the MCP endpoint and auth header are high-confidence from two
agreeing official sources; the free-tier boundary rests on official wording that conflicts with
a third-party claim, and is treated as the stricter of the two.

## Consequences

Easier: adding a future tool is one lint-clean entry, and every gate downstream can ask the
registry rather than a human. Harder: the registry is now a permission surface, so its lint is
gate-shaped and inherits this repo's adversarial-pass requirement before it ships.
