# Phase 06 S1 -- rival terms clearance (ADR-1413)

- Provider: **Stitch (Google)**, chosen by the owner 2026-10-06 in the design session.
- `approval.requested` `01M46ZJ3K02JXSD7HHDXNHNJF1` (gate `rival-terms`, phase 06), emitted from the main clone.
- Decided `approve` by `decision.recorded` via `arc-inbox approve`, reason: owner chose Stitch first, accepting ADR-1413 read (free, generic clause; v0 performance-testing clause avoided).
- No outbound Stitch request had been made when this was recorded. The ordering check (S4) compares this decision time with the first request in the spike receipt.
