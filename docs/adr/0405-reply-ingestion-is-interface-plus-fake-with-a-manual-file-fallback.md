# ADR 0405 — Reply ingestion is interface + fake, with a manual `--file` fallback

**Status:** accepted
**Date:** 2026-08-04
**Product:** `leads`
**Reversibility:** two-way
**Revisit trigger:** manual ingest cadence proves too slow to meet the `ADR-0406`-adjacent
triage SLA in a real campaign.

## Context

Replies must stop sequences before the next batch, or the system mails someone who already
answered. But inbound webhook support varies by provider, and `ADR-0402` deliberately does
not name a vendor until Phase-3 entry. Phases 0–2 must build and prove out with zero real
provider.

## Options considered

1. **Webhook only** — pros: automatic. cons: couples Phases 0–2 to a vendor that is not yet
   chosen, and makes the whole reply path unbuildable offline.
2. **Manual only** — pros: no vendor coupling. cons: leaves automation on the table forever.
3. **Interface + fake from Phase 0; webhook as v1 default when supported; `--file` as the
   designated cut.**

## Decision

**Option 3.**

- Interface + fake from Phase 0 — offline-first, so the entire reply path is fixture-proven
  before any real mail exists.
- v1 default: provider inbound webhook, **if** the `ADR-0402` vendor supports it.
- Fallback (**designated cut #1**): `arc-leads ingest-reply --file <path>` — raw mail saved
  into the private store, imported from **file or stdin, never argv** (`ADR-0412`: shell
  history and process listings are logs).
- Auto-stop is enforced at **pre-send check** time, not at ingest time. This is what keeps
  `ADR-0403` honest even on a once-a-day manual cadence: a reply ingested any time before the
  next send blocks that send.
- The reply parser is **parser-class** → fixtures before code, adversarial pass before any
  promotion.

**Confidence:** high — the fallback is strictly less capable, not less correct, and the
auto-stop placement makes the cadence difference invisible to the safety property.

**Rejected because:** Option 1 — unbuildable offline, couples to an unchosen vendor.
Option 2 — forecloses automation for no gain.

## Consequences

**Easier:** taking the designated cut costs a daily ritual, not a safety property.

**Harder:** in manual mode the triage SLA clock starts at *ingestion*, not at mail arrival —
because the system cannot act on mail it has not seen. That is stated explicitly in the SLA
so the fixture is testable in both modes.
