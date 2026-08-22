# Explore `face-hq-v1` — synthesis, and what is left for the owner

**This is an input to the PICK, not the PICK.** The design lane's law (ADR-1308) makes the
choice the owner's, made after opening the renders himself. Cycle 3 is the record of what
happens when pixels are judged by report: five critique rounds, three blind rankings and a
sealed prediction, all built on screens nobody had opened — the owner opened them once and
scored the result 23/100.

## The key, now unsealed

| item | is |
|---|---|
| item-1 | **variant-b** — canvas / map-first, warm paper cartographic |
| item-2 | **the REFERENCE** — a Linear-idiom execution, the craft anchor (jurors were not told) |
| item-3 | **variant-a** — command center, cold ink monospace |
| item-4 | **variant-c** — review workspace, warm serif dossier |

## The three blind rankings

| juror | lens | ranking (decoded) |
|---|---|---|
| 1 | the brief, straight | **variant-a** > variant-b > *reference* > variant-c |
| 2 | would it survive daily use for a year | **variant-b** > variant-a > *reference* > variant-c |
| 3 | hostile craft + honesty | **variant-a** > variant-c > variant-b > *reference* |

Positional tally (1st = 4 points … 4th = 1):

| item | j1 | j2 | j3 | total |
|---|---|---|---|---|
| **variant-a** (command center) | 4 | 3 | 4 | **11** |
| variant-b (canvas / map-first) | 3 | 4 | 2 | 9 |
| variant-c (review workspace) | 1 | 1 | 3 | 5 |
| *reference* (craft anchor) | 2 | 2 | 1 | 5 |

**variant-a is 1st or 2nd on every card** — the only item no juror ranked below second.

## Where the reference landed, and what that is worth

3rd, 3rd, 4th. Taken at face value that says all three theses reach or beat a competent
Linear-idiom execution of the same brief. **Do not take it at face value.** Two jurors
penalised the reference on a content claim that is void (see `JURY-CONFOUND.md`), so its
low placement is partly an artifact of my own bookkeeping error.

What is NOT an artifact: juror 3 — the hostile craft-and-honesty lens, the one that did not
lean on the void claim — placed it last on the strength of a real defect it found by doing
arithmetic on the page: the reference's inbox reads `49 ever · 41 decided · 2 open`, and
49 − 41 = 8. That contradiction came from **my original fact-pack**, not the composer. It is
the single most useful thing the whole panel produced, because it demonstrates the product's
own thesis: derived numbers reconcile, quoted numbers contradict each other in public.

## What survives the confound, per item

Only reasoning about structure, density, resting space, colour discipline and honesty
affordances is carried forward; every content-accuracy argument is discarded as void.

- **variant-a — command center.** Cited by two jurors for an Inbox that separates
  ready-to-decide from already-settled and puts the most-at-risk first; a Map that is a
  scannable per-lane status table carrying a visible "zero receipts ever" mark rather than a
  picture; the honesty classes as first-class filters instead of a legend; per-lane clocks
  and appetite/burn kept on the same surface. The criticism against it: one juror found its
  `LIVE` badge rendered in the green the brief reserves for real money — a genuine
  reserved-colour violation, and a cheap fix.
- **variant-b — canvas / map-first.** Praised for rhythm and rest: numbered section
  dividers, generous vertical spacing, the only item a juror said the eye can rest in. The
  drawn transit map is the most distinctive artifact in the set. Criticised for using a
  cream/paper surface as the *daily* screen rather than as the brief's print mode, and for a
  circular hub-and-spoke map that reads as a diagram rather than a scannable status.
- **variant-c — review workspace.** The deepest single-decision treatment: a full receipt
  drawer with raw JSON, the seal rendered as explained prose rather than an icon, and an
  explicit qualifying line when no prior `decision.recorded` exists. Ranked last by two
  jurors for spending most of the fold on one approval and for a Map that is a paragraph
  rather than a drawing.
- **reference.** Persistent sidebar carrying the needs-you count and the LIVE/REPLAY/SIM
  toggle; a real drawn map and arc-ring. Undone by the arithmetic defect above.

## The honest reading

The panel points at **variant-a**, with **variant-b** holding the strongest single asset in
the set (the drawn map) and the best-rated reading rhythm. Those two are not exclusive: the
map is a room, and variant-a's own Map section is its weakest zone by its own jurors'
description. The obvious synthesis — variant-a's structure, variant-b's map and vertical
rhythm — is available and is what a pick could specify.

But the recommendation stops here, because the ranking is contaminated, three of four
content arguments in it are void, and the law puts the choice with the person who has to
live in this surface for an hour a day.

## What the owner does

1. Open the four renders (they are the artifact; everything above is commentary):
   `.claude/state/design/renders/docs--design--explore--face-hq-v1--variant-{a,b,c}--index-html.png`
   and `…--reference--index-html.png`.
2. Pick one thesis — or name a synthesis (e.g. "a's structure, b's map and rhythm").
3. State a **falsifiable PREDICTION** about the pick, so the choice can be scored later
   rather than merely defended. The lane records it as `decision.recorded` from the main
   clone; that receipt is what unblocks Phase 02's canonical `tokens.css` and, after it,
   the L3 build.
