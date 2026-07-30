# Ranking — juror 3

- ranked: variant-b > variant-a > variant-c

## Why variant-b over variant-a

Both put status/next-hearing/overdue in an always-visible strip at the top, satisfying A.4
equally well. The split shows up in how each treats the primary action (A.3 — "record what just
happened... set what is due next").

- variant-b puts a dedicated, high-contrast "Record outcome" button directly on the 14 Jul
  hearing row — the one row flagged "Unrecorded." The action sits exactly on the fact that needs
  it. variant-a flags the same fact in red text ("Outcome not recorded") but the one prominent
  button on the page is "Add hearing" in the top-right corner — a different action from the one
  the case actually needs right now. A user scanning variant-a sees the problem stated but not an
  obvious control for it.
- variant-b's chronological ledger (dated entries, month grouping, a visible "New since last
  opened, above this line" divider) reads like a court record and gives A.6's return contract a
  concrete answer — you can see what's new since you left. variant-a's four-column board of
  simultaneous card-lists is dense and functional but reads closer to a dashboard than the
  "exact · unhurried · durable" instrument the brief asks for.
- variant-b resolves the actions-panel-hierarchy debt with one generic "Add entry" plus the one
  contextually relevant action placed inline on the record that needs it. variant-a decentralises
  "Add X" per column, which removes the four-identical-buttons problem but still promotes
  "Add hearing" as the sole header CTA even though the case's actual pending need is recording an
  outcome, not adding a new one.
- Both variants explicitly reason about the width debt on the page itself (b: 56rem, kept
  single-column "so it does not open a second region"; a: 96rem board). This is close — variant-a
  arguably uses the desktop canvas more fully — but variant-b's restraint (wide enough to read,
  not wide enough to become a second dashboard region) fits the unhurried/durable feel words more
  precisely than a's four simultaneous lanes.

## Why variant-a over variant-c

- variant-a directly answers the brief's named "biggest remaining design debt" (the width
  column): the live page uses the full desktop canvas for four side-by-side ledgers. variant-c's
  content sits in a narrower, left-of-centre column with a wide band of unused space on the right
  of the same 1440px canvas, and nothing on the page explains that choice the way both a and b do
  for their own width decisions.
- variant-a declares the five-state matrix (empty/loading/error/success/disabled) for all five
  surfaces the brief names — case header, hearings, documents, tasks, notes — at full coverage.
  variant-c's reference section substantively covers only the case header and one wizard step
  ("hearing outcome"); next-hearing and documents get only a one-line disabled reason inline, and
  tasks/notes are not addressed by the state reference at all. The brief asks for "the case header
  and each section" to declare all five — a is the more literal, complete answer.
- variant-a keeps the brief's four content nouns (hearing/document/task/note) as four distinct,
  separately labelled sections throughout. variant-c folds documents/tasks/notes behind a single
  "Recent record" accordion (collapsed in the render, so its contents aren't visible), which
  blurs the object-type distinctions the content contract names explicitly.
- This is close, though: variant-c's step-locked flow (step 2 and 3 visibly disabled until step
  1's action is taken) is a more literal, more forceful read of "advance the case" than variant-a
  offers, and its "Waiting on: Hearing held 14 Jul 2026 · outcome not recorded" line is the single
  clearest translation of raw status data into a plain sentence a lawyer can act on, of any of the
  three renders.

## What would change my mind

variant-c's case-to-case chaining is the strongest thing either losing variant does that the
winner lacks: the reference note describes the same Enter key that records the current step's
action also advancing, once the case reaches "nothing due," straight to the next case awaiting
one ("Vishnu Menon v. Ashirvad Developers, next hearing 04 Aug 2026"). That is a direct, elegant
answer to A.7's explicit gap ("a way to go from this case is done for today to the next case that
needs him"). variant-b has no cross-case shortcut visible anywhere on the page — its keyboard
list is entirely within-case (next/previous entry, jump to next-due entry, cycle filter). If that
gap in variant-b turns out to matter more than the ledger/inline-action strengths it wins on, it
would move c above b.
