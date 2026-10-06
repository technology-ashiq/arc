# ADR 1900 — The `discover` lane is born to feed `launch`

**Status:** accepted
**Date:** 2026-10-06
**Product:** `discover`
**Reversibility:** two-way
**Revisit trigger:** `launch` Phase 02 has not closed when discover's Phase 02 opens. Then the exporter's output stays `honesty_class: rehearsal`, and REQ-07's real hunt goes ahead without a launch run.

## Context

The money chain is discover → launch → bill → distribute → measure → ledger. On 2026-10-03 the owner ruled *"ippo idea illa"*: there is no venture idea on the table, and no Nilluvai (ADR-1700). `launch` was built first, and its only input is a `venture.yaml` (ADR-1710). Nothing in arc produces one, so the venture factory has no source. The design source `docs/strategy/plans/PLAN-discover.md` (v2, 2026-10-06, owner-approved) names its trigger as `launch` Phase 02 exit plus that ruling. On 2026-10-06 the owner pasted the kickoff prompt while launch was still on Phase 01. That is the ruling firing the trigger early, under the build-everything mandate.

## Options considered

1. **Wait for launch Phase 02 to close.** The trigger's letter is kept, but discover's 7 days sit idle behind launch's tokens.
2. **Kick off now and gate only the real export.** Every artifact discover writes is a rehearsal until launch can consume a real one.

## Decision

Option 2. Phase 00 records the ruling on the spine as `decision.recorded`, emitted from the main clone, and each later ADR in this band cites that receipt id. The design source's gate checklist marks `launch P02 CLOSED (or owner waives in writing — then honesty_class: rehearsal only)`. The waiver is this kickoff prompt, and it holds until launch's Phase 02 closes.

## Consequences

ADR century 1900–1999 is claimed. On 2026-10-06 the sweep checked 17 worktrees and every `origin/*` branch, and none held an ADR numbered 19xx. Every `venture.yaml` discover writes before launch P02 closes is `honesty_class: rehearsal`.
