# BRIEF — legal pack (customer-facing policies per venture)

> **Trigger (pull):** the first venture reaches launch prep (distribution phase — for
> Cycle 3 that's Phase 2) and needs real policy pages before real payments. **Prereqs:**
> venture with a live site · payment rail chosen (V-A ADR) — the refund/tax language must
> match the actual provider. Origin: `../arc-company-org-blueprint.md` role #51.

**Goal:** one command — `/arc-legal <venture>` — generates the three customer-facing
policy pages (Terms of Service · Privacy Policy · Refund/Cancellation) from a pinned
template set + a per-venture facts file, plus a launch legal checklist. Every publish is
human-signed via the inbox. **This is a template engine with receipts, not a lawyer.**

**REQs (measurable):**
1. Venture facts file (name, operator/entity, jurisdiction, contact, data collected,
   analytics used, payment provider, refund window) → three rendered pages; every clause
   traces to the pinned template set — a clause with no template source FAILS lint
   (WARN-first). No invented legal claims, ever.
2. Provider alignment: refund window + billing/tax lines consistent with the chosen
   MoR/gateway's actual terms — evidence link per claim recorded in the run output.
3. Launch checklist rendered and checkable: policies linked in footer + signup flow ·
   contact/data-deletion route stated · no unearned compliance badges (no "GDPR/SOC2
   compliant" unless demonstrably true — Constitution truth article).
4. Versioning: pages carry version + effective-date; a change produces a new version,
   never a silent edit; each publish leaves a receipt (kind decision: see open decisions).
5. Human gate: `approval.requested` → `decision.recorded` before any page goes live —
   this stays L1 permanently unless a future ADR explicitly revisits it.

**Appetite:** 2–3 days.
**Phases sketch:** 0 template set + facts schema + trace-lint (adversarial pass on the
lint) → 1 render + checklist + inbox wiring → 2 run on the live venture + retro.

**Non-negotiables/no-gos:** output is NOT legal advice — one real-lawyer review of the
template set when revenue justifies it (~₹25k MRR trigger) · no compliance claims that
aren't true · no jurisdiction tourism (templates target an Indian operator selling
globally via MoR; anything fancier is out of scope) · MoR remains merchant of record for
tax — this module never does tax math · no cookie-banner/consent-management build v1
(privacy-light analytics only, per the venture plan).

**Pre-mortem top-3:** (1) template drifts from provider terms → REQ-2 evidence links +
re-check at every provider change; (2) fake compliance language slips in → trace-lint +
truth article + human gate; (3) "legal" scope creep (DPAs, contracts, IP assignments) →
no-gos hold; anything beyond the three pages is a future brief.

**Open decisions at kickoff:** spine receipt kind for policy publishes — the event
vocabulary is a closed 18-kind set, so extend (`legal.updated`) vs reuse (`note.logged` +
tag) is an ADR here · entity/operator wording (individual vs registered entity) ·
data-deletion workflow (mailbox vs form).

**Kickoff prompt:**
```
/arc-kickoff legal pack — customer-facing policies per venture
Design source: docs/strategy/plans/BRIEF-legal-pack.md (trigger: <venture> is in launch
prep). Expand to full PLAN; REQs/no-gos locked; the trace-lint and the human gate are
non-negotiable. STOP after PLAN + specs for my approval.
```
