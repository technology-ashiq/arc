# BRIEF — leads v1 (outbound engine)

> **Trigger (pull):** a venture or the MVP-service lane needs outbound. **Prereqs:** spine
> + inbox (every send is an event; sequences need approval flow) · a real offer to sell.

**Goal:** `/arc-leads <icp>` builds a small, deeply-researched lead list (quality over
volume), drafts genuinely-personalized first-touches, and runs a capped sequence — every
send/reply/meeting an event, hard caps enforced in code, L1 (draft-approve) until the
trial ledger proves L2.

**REQs (measurable):**
1. ICP definition file → 25 researched leads with evidence per lead (why they fit, source
   links) — no bought lists, no scraped emails from login-walled sources.
2. Personalization gate: a draft referencing nothing specific to the lead FAILS lint
   (WARN-first) — template-blast is structurally impossible.
3. Hard caps in code: ≤20 sends/day, ≤2 touches/lead/week, auto-stop on reply — fixture-
   proven (the cap CANNOT be exceeded even if asked).
4. Reply triage: replies classified (interested / later / no / bounce) → events;
   "interested" → calendar-link draft in inbox same day.
5. One real campaign: ≥25 sends over ≥3 days, reply-rate + meeting count recorded;
   deliverability basics evidenced (SPF/DKIM/DMARC green before send #1).

**Appetite:** 1 week.
**Phases sketch:** 0 ICP format + researcher + evidence lint → 1 sequencer with caps
(adversarial pass on cap enforcement) + inbox approval → 2 reply triage + events →
3 real campaign + retro.

**Non-negotiables/no-gos:** every send human-approved until promotion · caps are code,
not policy text · no fake personalization, no scraped private data, no purchased lists ·
domain reputation is a company asset — warm-up respected, unsubscribe honored instantly ·
no LinkedIn automation (ToS) — LinkedIn drafts are for manual sending only.

**Pre-mortem top-3:** (1) domain burned by volume → caps + warm-up + separate sending
domain decision at kickoff; (2) generic outreach = 0 replies + reputation cost →
personalization lint + 25-not-2500 philosophy; (3) replies rot unanswered → same-day
triage REQ + inbox surfacing.

**Open decisions at kickoff:** sending domain/tool · which offer (venture vs service) ·
calendar link setup.

**Kickoff prompt:**
```
/arc-kickoff leads v1 — outbound engine
Design source: docs/strategy/plans/BRIEF-leads.md (trigger: <offer> needs outbound).
Expand to full PLAN; REQs/caps/no-gos locked; deliverability checklist (SPF/DKIM/DMARC)
goes in Phase 0. STOP after PLAN + specs for my approval.
```
