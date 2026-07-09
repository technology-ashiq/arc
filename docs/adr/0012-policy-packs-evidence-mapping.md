# ADR 0012 — Policy packs map evidence to control IDs; arc never claims compliance

**Status:** proposed · 2026-07-10

## Context
Gate engine + profiles + passport make compliance framing possible: `arc enable <pack>` could
preset gates/thresholds and emit auditor-readable reports. The trap: PCI-DSS/SOC2/ISO controls
are majority non-technical (HR, physical security, vendor management) — a CLI claiming "you are
compliant" is a false and dangerous statement auditors will destroy. Fork: what may a pack claim,
and which framework first?

## Options considered
1. **"arc makes you compliant" framing, PCI first** — pros: sales headline; cons: legally wrong,
   credibility suicide with any real auditor.
2. **"Evidence mapped to control IDs" framing, OWASP ASVS first** — pros: ASVS is ~100%
   technical so gates map cleanly; honest claim; SOC2 CC-series (change-management/SDLC controls,
   which the ledger + ADR trail literally evidence) is the natural second; cons: weaker headline.

## Decision
Option 2. A pack = one yaml under `.claude/policy-packs/`: required gates, minimum thresholds
(profile overlay — ratchet rules apply), and a gate→control-ID map. Enabling a pack annotates
the passport's `control_refs` (ADR-0010) and adds a per-control evidence table to the bundle
report. Wording is fixed in the report template: "evidence contributing to <framework> control
<ID>" — the strings "compliant/compliance achieved" are banned from pack output. Order:
ASVS v1 this pack-cycle; SOC2 CC-series subset next; PCI/ISO only ever as evidence contribution.

## Consequences
+ Enterprise-credible artifact ("hand this table to your auditor") with zero new scanners.
+ Depends only on ADR-0010's reserved field — packs are data, not code.
− Mapping maintenance when frameworks rev — pack yaml carries a framework version pin.
− Honest framing means marketing can't say "compliance in one command"; that's the point.
