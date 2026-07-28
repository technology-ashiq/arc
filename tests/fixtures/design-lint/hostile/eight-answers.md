# Design brief — ARC HQ dashboard (docs/strategy/arc-hq-mockup.html)

- **date:** 2026-07-29
- **base revision:** `f7de2d0`
- **tier:** S

## A. Interaction model

1. **The user's job, in ONE sentence.** — See what the company did today and clear the three decisions waiting on him in under ten minutes.
2. **The primary OBJECT of the product.** — The approval card: a decision with its evidence attached.
3. **The primary ACTION on it.** — Approve (or reject) with one click.
4. **What must be VISIBLE before that action.** — The council score, the ₹ amount at stake, and the kill-criteria line for the venture the card touches.
5. **Progressive disclosure vs always-visible — the explicit split.** — KPI row and approval inbox always visible; per-event evidence (🧾) and autonomy-ladder detail open on demand.
6. **After success / failure / interruption / return — what does the user see?** — Success: the card collapses into the done log with its receipt id. Failure: the card stays, error inline. Return: inbox reordered newest-first, nothing lost.
7. **What becomes FASTER once the user has learned the product (expert path).** — Keyboard: j/k between cards, a approve, r reject — the daily clear drops from ten minutes to three.
8. **Extra.** — an answer nobody asked for.

## B. Art direction

- **3 feel words:** calm · dense · factual
- **3 anti-words:** playful · promotional · vague
- **State matrix** (per surface): inbox and timeline declare all five (empty · loading · error · success · disabled); the KPI row declares empty and error only — numbers never spin, they grey the last known value.
- **Slop kill-list:** no gradient heroes · no emoji as icons · no three-equal-column rows · no invented labels where the spine vocabulary exists
- **a11y floor:** contrast ≥4.5:1 · targets ≥44px · visible focus · reduced motion honoured
- **Declared contrast pairs** — every fg/bg pairing the direction relies on:

| pair | fg | bg |
|---|---|---|
| body text | #c3c2b7 | #1a1a19 |
| dim labels | #918f88 | #1a1a19 |
| primary button | #ffffff | #184f95 |

## C. Platform contract

| Surface | Required? |
|---|---|
| Desktop | yes |
| Mobile | no |
| Tablet | no |
| Keyboard-first | yes |
| Reduced motion | yes |

## D. Content contract

- **Product nouns + object naming:** venture · phase · receipt · council verdict · approval · autonomy level (L0–L3)
- **Primary action verbs:** approve · reject · promote · kill
- **Voice + tone:** terse operator console; the numbers carry the sentence; no exclamation marks
- **Terms users ALREADY understand:** MRR · burn · kill criteria · ₹ amounts in Indian notation
- **Sensitive / error / destructive-action language:** kill actions name the venture and the irreversible consequence; errors state what failed and the next step, never "something went wrong"
- **Content density rules:** one line per event · amounts right-aligned tabular numerals · timestamps HH:MM 24h IST
