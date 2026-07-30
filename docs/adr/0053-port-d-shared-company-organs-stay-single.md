# ADR 0053 — PORT-D: shared company organs stay single

**Status:** accepted
**Date:** 2026-07-30
**Reversibility:** one-way
**Revisit trigger:** a multi-person team joins arc — re-examine per-lane organs (owner column, per-lane inbox) then.

## Context

Splitting tracker state per lane invites splitting everything per lane. That would break
the integration guarantee that separately-built products compose into one arc. Source
pack: `docs/strategy/plans/PLAN-portfolio.md` §5 PORT-D.

## Options considered

- Per-lane spine/inbox/ADR sequence — rejected: per-lane ADR numbering breaks the single
  company-law ledger and every existing cross-ref (§14); a split spine breaks "receipts
  are the API" (ADR-0027/0030).
- Single company organs, lanes namespace only tracker state — accepted.

## Decision

The spine, approval inbox, ADR ledger (global sequence, allocated at kickoff), council,
retro-log, HISTORY.md, trial-ledger, templates, and the central test suite (ADR-0021)
stay **single, company-level**. Products interact through the spine and by calling each
other's commands/scripts — never by writing into another lane's workspace.

## Consequences

- One-way in spirit: unwinding a shared ledger after the fact rewrites history.
- HISTORY.md entries gain `[lane]` tags; ADRs gain a one-line `Product:` field (template
  change lands with Phase 3 docs, REQ-05).
- Cross-lane writes are exactly what the ownership lint (ADR 0057) exists to catch.
