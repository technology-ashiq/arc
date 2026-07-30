# Content for the baseline experiment — same screen, same facts

This is a **diagnostic experiment, not a product artifact.** It exists to test one claim the owner
made: that a plain prompt with no arc pipeline would produce a better design than arc's explore
loop did. Nothing here goes to any external respondent.

Use exactly this content. Do not invent case facts, and do not add or rename any legal term.

## The screen

A **case workspace** for a practising litigation lawyer in India. The lawyer opens ONE court case
and needs to see, without hunting: what has already happened on it, and what they must do next.

The primary object is the **case** (not the client — this was settled by a real practising lawyer).

## The case on screen

- **Meera Raghunathan v. Sunvale Housing Pvt. Ltd.**
- O.S. No. 412 of 2024 · City Civil Court, Bengaluru · Civil suit
- Client: Meera Raghunathan · Claim ₹18,45,000
- Status: Active · Next hearing: Not set · Overdue: 2

## Everything on the record

| Date | Type | What |
|---|---|---|
| 24 Jul 2026 | Document | Reply to written statement — due 24 Jul 2026, **not filed, OVERDUE** |
| 21 Jul 2026 | Task | File rejoinder — due 21 Jul 2026, **not done, OVERDUE** |
| 16 Jul 2026 | Note | Client confirmed balance fee payable on final decree |
| 14 Jul 2026 | Hearing | **Held 14 Jul 2026 — outcome NOT recorded.** This is the single most important thing on the page: the case cannot move until this outcome is entered |
| 08 Jul 2026 | Document | Written statement — filed 08 Jul 2026 |
| 02 Jul 2026 | Note | Fee received — ₹42,500 |
| 19 May 2026 | Hearing | Held — interim application disposed; matter listed for evidence |
| 15 May 2026 | Document | Vakalatnama — filed |
| 15 May 2026 | Document | Memo of appearance — filed |
| 30 Jul 2026 | Task | Confirm client's availability for hearing — due 30 Jul 2026 |
| 05 Aug 2026 | Task | Prepare list of documents for evidence — due 05 Aug 2026 |

## Vocabulary — the only constraint, and it is a real one

These are the words this product actually uses. Do not introduce others.

**Allowed:** case · hearing · document · task · note · filed · held · due · overdue · outcome ·
record outcome · add · edit · remove · client · claim · status · active · on hold · intake · closed

**Forbidden** (real Indian court words, but words THIS product's users have never seen here —
using them is the exact failure this experiment must not repeat): *close the case* · *reschedule* ·
*reopen* · *cause title* · *adjournment*.

## Deliverable

ONE self-contained `index.html`. All CSS inline in a `<style>` block. No external requests of any
kind — no CDN, no web fonts, no images from a URL. It must render correctly opened straight from
disk in a headless Chromium at 1440px wide.
