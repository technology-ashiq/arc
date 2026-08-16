# ADR 1006 — LEG-F: DPDP depth v1 is light-but-correct, and the notice rules are NOT yet in force

**Status:** accepted
**Date:** 2026-08-12
**Product:** `legal`
**Reversibility:** two-way
**Revisit trigger:** MeitY gazettes the compressed compliance timeline now under consultation
(full commencement pulled from May-2027 to ~Nov-2026), or any SDF class is notified — either event
moves the lawyer-review trigger (ADR-1207) from tripwire to immediate.

## Context

Decided under the owner's **Build-out Mandate (2026-08-09)**, receipt `01KZTM348858PDH44K4HA64CVA`
(ADR-1200). Locked at the v1.1 freeze as LEG-F; the kickoff re-check changed what the surrounding
prose may claim, not what gets built.

**The kickoff DPDP re-check found the design source's framing wrong in one material way.** The plan
says soft enforcement ends Nov-2026 and full enforcement lands ~2027-05-13, as though obligations
are partially live today. They are not:

- **In force today (2026-08-12):** only the institutional and definitional provisions — Act
  ss.1(2), 2, 18–26, 35, 38–43, 44(1)&(3) and Rules 1, 2, 17–21. Data Protection Board constitution
  and procedure. **No data-fiduciary obligation is live.**
- **14-Nov-2026:** Consent Manager registration only (s.6(9), s.27(1)(d), Rule 4 + First Schedule).
  Nothing else.
- **13/14-May-2027:** everything that matters here commences at once — **Rule 3 (notice contents)**,
  Rules 5–16 incl. **Rule 14(3) grievance redressal**, security safeguards, breach reporting,
  data-principal rights, SDF duties, cross-border restrictions.

Three further findings, recorded because they change posture rather than content:

- **No SDF class has been notified.** Designation is by affirmative Central Government notification
  under s.10(1) — no threshold, no self-classification. A small solo operator is not automatically
  caught, and SDF duties commence for nobody until May-2027 regardless.
- **The Data Protection Board is constituted in law and empty in fact** — no Chairperson and no
  Members appointed as of 1-Aug-2026, with nominations still open.
- **A live, ungazetted MeitY proposal** (consultation 23-Jan-2026, comments closed 4-Feb-2026) would
  compress the timeline to ~12 months and notify SDFs and cross-border restrictions immediately.
  Proposal only — nothing gazetted as of 2026-08-12.

What IS live today and does bind: the **Consumer Protection (E-Commerce) Rules 2020** entity
disclosures and grievance-officer duty, and the **IT Rules** acknowledgement windows.

## Options considered

1. **Wait for May-2027 and ship a thinner privacy page now** — technically sufficient today, and it
   means re-authoring the highest-risk page under deadline, with every venture needing re-approval.
2. **Build the Rule-3 notice block now, and describe its status honestly** — the page is
   forward-compatible, and nothing on it claims a compliance status the law has not yet created.
3. **Build a consent-management platform** — out of appetite and out of scope.

## Decision

**Option 2. Build to the Rule-3 shape now; claim nothing about it.**

v1 contains: the **Rule 3 notice block** (itemised personal data · specified purposes · the
communication link and means to withdraw consent, exercise rights, and complain to the Board) · a
**unified grievance block** — one named contact serving the DPDP ≤90-day window (Rule 14(3)), the
e-commerce-rules 48-hour acknowledgement / one-month resolution, and the IT-rules windows, with the
**strictest printed** · the **s.5(3) language line** (English in v1 plus a request mailto; no
twenty-two translations) · data-principal rights · the Board-complaint line.

**NO consent-management platform. NO cookie banner.** Signup consent CAPTURE is venture-side work,
named in the REQ-08 handoff checklist and never built here.

**And the constraint that follows from the commencement finding, which is the real decision:** the
rendered pages, the checklist and the evidence bundle **must not state or imply that a DPDP
obligation is currently in force**, and must not imply the venture is "DPDP compliant". The page
gives the notice; the *evidence line* records commencement status with its date. This is Constitution
E3 applied in the direction nobody expected — the no-unearned-badges rule bites on over-claiming the
law as much as on over-claiming the venture. The compliance-claim denylist (ADR-1202) is checked
against rendered output for exactly this class of sentence.

**Evidence:** PIB notification press note (https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf) ·
PRS India monthly policy review, Nov-2025 (https://prsindia.org/policy/monthly-policy-review/november-2025) ·
MeitY canonical Rules page (https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa) ·
LiveLaw, *India's Data Protection Board: Established In Law, Absent In Fact*, 1-Aug-2026
(https://www.livelaw.in/articles/india-data-protection-board-established-law-543751) · bare Act PDF
(https://prsindia.org/files/bills_acts/bills_parliament/2023/Digital_Personal_Data_Protection_Act,_2023.pdf).
**Confidence:** medium — and the reason is recorded rather than smoothed: **meity.gov.in and
egazette.gov.in both returned HTTP 403 to direct fetch this session**, so no rule or section text
here was confirmed against the raw gazette PDF. Rule 3 and s.5(3) text came from mirrors
cross-checked against two to three law-firm summaries each; the notification date is reported as
13-Nov-2025 by some primary-adjacent sources and 14-Nov-2025 by others, and that split is left
visible rather than resolved. The phased-commencement schedule is triangulated across four
independent secondary sources including PRS.
**Rejected because:** Option 1 — moves the hardest authoring under a deadline. Option 3 — out of
scope by the plan's own no-gos.

## Consequences

Easier: the privacy page is written once, before the deadline, with the research banked.

Harder: **the plan's evidence for its most legally-loaded page is medium-confidence, from mirrors.**
The assumptions ledger carries a row citing this ADR with a trigger a wrong line of prose would set
off. Before any REAL venture publish (REQ-08), the Rule-3 and s.5(3) text is re-verified against the
gazette PDF by a human or an unblocked fetch — a page rendered from a mirror's transcription of a
statute is exactly the invented legal claim this module exists to prevent.
