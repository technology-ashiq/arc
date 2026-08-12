# ADR 1008 — LEG-H: operational wording defaults — mailbox deletion, and a dark-pattern-clean cancellation

**Status:** accepted
**Date:** 2026-08-12
**Product:** `legal`
**Reversibility:** two-way
**Revisit trigger:** a venture's real deletion volume makes a monitored mailbox unworkable (requests
missed or answered past the printed window) — a form-plus-ticket route is then earned, and the
retention/response wording moves with it.

## Context

Decided under the owner's **Build-out Mandate (2026-08-09)**, receipt `01KZTM348858PDH44K4HA64CVA`
(ADR-1000). Locked at the v1.1 freeze as LEG-H.

Three operational sentences appear on every rendered set and each one is a promise the venture must
actually keep. A policy page that promises a deletion form the venture has not built is the same
class of defect as an invented compliance badge — it is just easier to write by accident.

## Options considered

Per sentence, the fork was always "the thing that is easy to say" versus "the thing the venture can
actually operate on day one".

## Decision

- **Deletion route v1 = a monitored mailbox.** A named address in the facts file, printed with the
  response window. A form is a future version, not a v1 promise — a promised form that does not
  exist is worse than an honest mailbox that does.
- **Cancellation is dark-pattern-clean, stated in the Refund/Cancellation page and CHECKED in the
  launch checklist:** cancelling takes no more clicks than subscribing · auto-renewal amount and
  date are disclosed before charge · no retention maze. The Dark Patterns Guidelines 2023 (CCPA) are
  live today, unlike the DPDP notice rules (ADR-1006), so this is a present obligation rather than a
  forward-looking one.
- **The Pricing page shows ONE all-inclusive INR figure with its tax treatment stated.** One number,
  and the sentence that says whether tax is included — no tax math anywhere (a CA owns tax; ADR-1001).

**The checklist row is what makes the cancellation sentence real.** REQ-04's probe compares the
cancel path the policy TEXT states against the venture's actual UI, and a mismatch is a finding.
Without that row the sentence is a claim about a UI nobody checked — and arc has already shipped a
control that existed only as a sentence (`docs/retro-log.md` 2026-08-02, `arc-portfolio`: *"a stated
control is not a control until something asserts it exists and something proves it can fail"*).

**Evidence:** Dark Patterns Guidelines 2023 (CCPA) — subscription-trap / cancellation provisions;
Consumer Protection (E-Commerce) Rules 2020 entity-disclosure and grievance duties. Both are cited
in the design source's external-evidence block and are **live today**, which the DPDP notice rules
are not.
**Confidence:** medium — the guideline text was carried from the design source's 2026-08-03 check
and was not re-fetched this session (the two re-checks the owner named were Razorpay and DPDP). The
assumptions ledger carries the row.

## Consequences

Easier: every operational sentence maps to something a solo operator can do on day one with an inbox
and no new software.

Harder: the mailbox is a standing human obligation, and the checklist will surface it as an open row
until the mailbox is real and answers. That is the correct discomfort — the alternative is a page
promising a route nobody watches.
