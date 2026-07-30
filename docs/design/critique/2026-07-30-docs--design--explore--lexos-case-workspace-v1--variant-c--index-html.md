# Design critique — variant C (guided workflow), LexOS case workspace explore — round 2

- target: `docs/design/explore/lexos-case-workspace-v1/variant-c/index.html`
- screenshot_sha256: `68b2e14c0de10c77e2efcfdb320954bc16632170c76a6ed9bf8e64ce08a5ed30`
- viewport: `1440x900@1`
- brief: `docs/design/briefs/lexos-case-workspace/brief.md` · thesis: `docs/design/explore/lexos-case-workspace-v1/variant-c/thesis.txt` · matrix: `docs/design/explore/lexos-case-workspace-v1/matrix.md`

## What I looked at

The full-page desktop render at 1440 wide (full scrolled height, well beyond the 900px
viewport): the topbar breadcrumb, the case-header card (name, status badge, case number, next
hearing, overdue count, and the "Waiting on" line), the secondary court/client/claim line, the
three-step rail, the "Return opens at Hearing outcome." line, the printed KEYS legend, the open
Step 1 card with its single button, the blocked Step 2 and Step 3 cards with their stated
reasons, the two foot disclosures (both collapsed), and the "Reference — state matrix" appendix
(case header × 4 states, a step × 4 states, run end-state). This is a fresh render — the
screenshot hash differs from round 1's — and this critique was formed against these pixels only,
full sweep, not a diff against the round-1 text.

**Two properties this run cannot rule on, by design of the tool, not by omission on my
part.** The renderer produces one flattened full-page capture with no scroll or viewport-clipped
frame. (1) Round 1's VIOLATION was that the case-identity card was not pinned through scroll.
Stickiness is scroll-time behaviour; a full-page capture shows a sticky element sitting in its
normal flow position exactly as a static one would, at whatever page height the tool renders —
there is no evidence in this image that could distinguish "now sticky" from "still static." I am
not reporting the fix as verified, confirmed, or resolved, and I am not reporting it as broken
either — this run produces no evidence either way, and that is a gap in the run, not a finding.
(2) The same applies to the printed KEYS legend: a static image shows three key-cap labels and
their stated behaviour in prose; it cannot show whether Enter/→/← actually fire anything. Treat
that claim as equally unverified by this run.

**Other gaps, carried from round 1, still true of a single desktop capture:** the two foot
disclosures are collapsed in this render exactly as they were in round 1, so their content (and
any content-level overlap between them) is not pixels I can see this round either — I can only
confirm the two collapsed rows do not collide or overlap each other as boxes on screen, which
they don't. No `:focus-visible` state is captured (nothing is focused in a static render), no
mobile reflow is visible (desktop-only capture), and reduced motion cannot be observed from a
still image.

## Findings

- WEAKNESS: several of the dimmest-reading text elements on the page — the "Not set" value in
  the quartet, the "Case number"/"Next hearing"/"Overdue" column labels, the Step 2/Step 3
  headings and their reason sentences, and the small caps labels throughout the reference
  appendix (EMPTY/LOADING/ERROR/DISABLED, etc.) — read as the dimmest ink on the page and are
  worth a design-lint pass to confirm the numbers. This is a suspicion only, not a measured
  failure: the brief itself pre-clears this exact ink level as "earned and deliberate," so intent
  isn't in question, only whether every instance lands on the cleared pairing. Location: quartet
  "Not set" and column labels, Step 2/3 card text, appendix labels throughout.

- WEAKNESS: "Recent record" is a label that doesn't map cleanly to any single noun in the
  brief's declared object list (case · hearing · document · task · note · client · firm), and the
  brief's own on-demand list names four distinct surfaces separately (full hearing history,
  document list, task list, notes) rather than one folded catch-all. The variant is free to
  choose its own arrangement — the brief explicitly leaves the split's shape open — but the label
  itself gives a lawyer no idea which of those four object types are inside it before opening it.
  I can't re-examine the actual contents this round since the row is collapsed in this render (as
  it was in round 1), so this is a naming-clarity observation on the visible label, not a repeat
  of round 1's content-overlap claim. Location: the second `<details>` row at the foot of the run.

- WEAKNESS: the compact "Enter" / "→" / "←" key-cap chips in the KEYS legend read visually
  small next to the full-size "Record hearing outcome" button directly below them — worth a
  design-lint target-size check if any of the three is meant to be an actual clickable control
  rather than pure legend. Flagged as a suspicion for measurement, not a counted defect.
  Location: the KEYS row beneath the step rail.

- POLISH: two of the action verbs used in explanatory copy sit outside the six-verb closed list
  (add · edit · remove · save · record · file) — "fire" in "Enter — fire the current step's
  action" and "advances" in "the same Enter key advances to the next case awaiting action."
  Neither is a button label, so neither is the invented-label violation the content contract
  exists to catch, but both are the kind of stray verb worth folding into the closed set on a
  tidy pass. Location: the KEYS legend's Enter row, and the "RUN — END STATE (REFERENCE)" note.

- POLISH: the header's "Overdue 2" states a bare count with no noun attached (2 what — hearings,
  tasks, filings?), while the brief's own reference example two panels down shows the same field
  correctly resolving to "Overdue 0" in plain ink. Not a violation of anything declared, just a
  spot where one more word would remove an ambiguity a lawyer currently has to resolve from
  context. Location: the case-header quartet, "Overdue" column.

## What is working

Zero VIOLATIONs this round. The primary object (the case) and primary action (the single
"Record hearing outcome" button) remain unambiguous, and the quartet's completeness half holds
cleanly: the case name, case number, and the reference appendix's second case name all render in
full with no ellipsis or clipping at this width — the thing round 1 could rule on from pixels
still passes. Two things round 1 flagged as weaker than the rest of the page read as fixed in
this pass: the topbar no longer repeats the full case name a second time next to the mandated H1
(it now reads just "LexOS / Cases"), and the return-state line has been reworded from commentary
aimed at a reviewer ("not a section") to a plain factual sentence ("Return opens at Hearing
outcome.") that fits the court-record voice. The full five-state matrix is still an honest,
non-padded reuse of what's already live on the page, loading states exist here where the shipped
baseline had none, error text states what failed and what to do next rather than a bare
"Confirm," dates and the ₹ amount follow the declared formats, and the white identity band
sitting visually apart from the grey page canvas below it reinforces the header's intended
persistence even where this run has no way to confirm the persistence itself.
