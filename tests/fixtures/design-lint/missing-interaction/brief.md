# Design brief — ARC HQ dashboard (docs/strategy/arc-hq-mockup.html)

- **date:** 2026-07-29
- **base revision:** `f7de2d0`
- **tier:** S

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
