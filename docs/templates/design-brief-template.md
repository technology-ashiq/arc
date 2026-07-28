# Design brief — <product / surface>

> **Minimal template (Phase 00).** Just enough declared intent for the critic to have
> something to critique *against* — post-hoc review can fix padding, it can never fix the
> wrong screen. Full brief mode with `design-lint` enforcement is Phase 01; until then these
> sections are the shape, not a gate.
>
> Four contracts, all four required. Fill them before any pixels exist.
> Source of truth for the contracts: `docs/strategy/plans/PLAN-design.md` §2.4.

- **base revision:** `<SHA the design work starts from>`
- **tier:** S | M | L  <!-- effort depth only: S = brief-lite + review · M = + explore 2-3 variants · L = full + deeper critique -->

---

## A. Interaction model — 7 answers, no pixels until they exist

1. **The user's job, in ONE sentence.**
2. **The primary OBJECT of the product.**
3. **The primary ACTION on it.**
4. **What must be VISIBLE before that action.**
5. **Progressive disclosure vs always-visible — the explicit split.**
6. **After success / failure / interruption / return — what does the user see?**
7. **What becomes FASTER once the user has learned the product** (the expert path).

## B. Art direction

**Taste is a DECISION, not a research finding.** Derive it from premise + brand stance +
audience, and record the one-way doors (dark mode, density, brand mark, motion stance) as
design ADRs, each with a revisit trigger. Research receipts are required only for *factual*
claims — user expectations, domain conventions, competitor IA — never for taste itself.

- **3 feel words:**
- **3 anti-words:**
- **State matrix** (per surface): empty · loading · error · success · disabled
- **Slop kill-list** (product-specific, beyond the generic list the critic already carries):
- **a11y floor:** AA contrast · visible focus · ≥44px targets · reduced motion honoured

## C. Platform contract

The critic verifies EXACTLY this table — nothing skipped, nothing padded.

| Surface | Required? |
|---|---|
| Desktop | yes/no |
| Mobile | yes/no |
| Tablet | yes/no |
| Keyboard-first | yes/no |
| Reduced motion | yes/no |

## D. Content contract

- **Product nouns + object naming** (mental-model decisions, not copy details):
- **Primary action verbs:**
- **Voice + tone:**
- **Terms users ALREADY understand** (domain vocabulary — never invented labels):
- **Sensitive / error / destructive-action language:**
- **Content density rules:**

Composers must use this vocabulary. The critic flags departures as `VIOLATION`.
Realistic content is mandatory — real-shaped data (real names, ₹ amounts, real-length
titles). **Lorem ipsum is always a VIOLATION.**
