# ADR 1725 — `dns` follows `hosting` and reads its CNAME target through `ctx.upstream`

**Status:** accepted
**Date:** 2026-10-05
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** a hosting provider whose DNS target is not known until after the record exists (a verify-by-TXT-first flow)

## Context

`sandbox.automemory.ai` must CNAME to the hosting project. PLAN's test-surface note (Vercel row, 2026-10-03 re-verify) says the
target is the per-project value from Vercel's domain config, so it exists only after `hosting` has run. The catalog had `dns`
depend on `domain` alone, so `dns` ran first and had no target to write. ADR-1704's ctx gave an adapter no way to read another
slot's output, and an adapter that knew Vercel's generic target would be a dns adapter holding hosting knowledge.

## Options considered

1. **Generic `cname.vercel-dns.com` in the venture profile** — no DAG change / departs from PLAN; Vercel may flag the record.
2. **`dns` depends on `hosting`; ctx exposes upstream slots' reported resources read-only** — PLAN's target / one edge, one ctx field.

## Decision

Option 2 (owner, 2026-10-05). `dns.depends_on` = `domain`, `hosting`. `ctx.upstream` is a frozen map of the resources the
runner recorded for this slot's own `depends_on` slots only — `{ [slot]: [{ kind, id }] }` — read from state, never from the
adapter that wrote them. The hosting adapter reports its target as `{ kind: "dns-target", id: <host> }`. Upstream values are
another adapter's output: the reader validates them (a dns adapter refuses a target that is not a plain hostname).

## Consequences

REQ-03's drive order becomes repo → ci → environments → hosting → dns → tls → … The day-3 kill question is unchanged. An
adapter still cannot see a slot it does not depend on, so the swap-by-one-file property of ADR-1704 holds.
