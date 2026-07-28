# Design brief — ARC HQ dashboard (`docs/strategy/arc-hq-mockup.html`)

> The first real brief through brief mode (Phase 01). This is the declared intent the
> design-critic judges the HQ mockup against — Phase 00 critiqued this surface with "none
> declared"; that gap closes here. Machine-checked by `design-lint.mjs` (the `design` gate).

- **date:** 2026-07-29
- **base revision:** `f7de2d0`
- **tier:** S

## A. Interaction model

1. **The user's job, in ONE sentence.** — See everything the company did today and clear the decisions waiting on him in under ten minutes.
2. **The primary OBJECT of the product.** — The approval card: one decision with its evidence (council score, money at stake, kill criteria) attached.
3. **The primary ACTION on it.** — Approve or reject, one click, receipt recorded on the spine.
4. **What must be VISIBLE before that action.** — The council verdict with its score, the ₹ amount the decision touches, and the kill-criteria state of the venture it belongs to — on the card, never behind a click.
5. **Progressive disclosure vs always-visible — the explicit split.** — Always visible: KPI row, today's event timeline, the approval inbox. On demand: per-event evidence (🧾 links), autonomy-ladder detail, revenue chart tooltips.
6. **After success / failure / interruption / return — what does the user see?** — Success: the card collapses into the done log carrying its receipt id. Failure: the card stays put with the error stated inline (what failed + next step). Return after interruption: the inbox re-ordered newest-first with nothing lost — the spine is the state, the page only renders it.
7. **What becomes FASTER once the user has learned the product (expert path).** — Keyboard clears: j/k moves between approval cards, a approves, r rejects with a reason prompt — the daily clear drops from ~10 minutes of mousing to ~3 of keys.

## B. Art direction

- **3 feel words:** calm · dense · factual
- **3 anti-words:** playful · promotional · vague
- **State matrix** (per surface): inbox and timeline declare all five (empty · loading · error · success · disabled). The KPI row declares empty and error only — a number never shows a spinner; it greys the last known value and says how stale it is.
- **Slop kill-list:** no gradient heroes · no emoji as iconography · no three-equal-column feature rows · no centre-everything layouts · no invented labels where the spine vocabulary (venture, receipt, verdict, phase) already exists
- **a11y floor:** contrast ≥4.5:1 · targets ≥44px · visible focus · reduced motion honoured
- **Declared contrast pairs** — every fg/bg pairing the direction relies on:

| pair | fg | bg |
|---|---|---|
| body text | #c3c2b7 | #1a1a19 |
| dim labels | #918f88 | #1a1a19 |
| dim labels on raised cards | #918f88 | #212120 |
| primary button | #ffffff | #184f95 |
| money-in green | #0ca30c | #1a1a19 |

## C. Platform contract

| Surface | Required? |
|---|---|
| Desktop | yes |
| Mobile | no |
| Tablet | no |
| Keyboard-first | yes |
| Reduced motion | yes |

## D. Content contract

- **Product nouns + object naming:** venture · phase · receipt · council verdict · approval · autonomy level (L0–L3) — the spine's closed vocabulary, never synonyms invented per panel
- **Primary action verbs:** approve · reject · promote · kill
- **Voice + tone:** terse operator console — the numbers carry the sentence, prose only where a number cannot; no exclamation marks anywhere
- **Terms users ALREADY understand:** MRR · burn · kill criteria · council score · ₹ amounts in Indian digit grouping (₹1,54,300)
- **Sensitive / error / destructive-action language:** a kill action names the venture and states the irreversible consequence on the button, never a bare "Confirm"; errors state what failed and the next step — "something went wrong" is banned
- **Content density rules:** one line per timeline event · amounts right-aligned tabular numerals · timestamps HH:MM 24h IST · a card shows at most the three facts its decision needs

