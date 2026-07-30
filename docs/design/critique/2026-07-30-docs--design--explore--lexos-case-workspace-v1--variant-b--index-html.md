# Design critique — variant B (narrative), post-strip re-verification

- target: `docs/design/explore/lexos-case-workspace-v1/variant-b/index.html`
- screenshot_sha256: `ad50b5621daa1aa3183c22a0676281e7e9b91c7c0744c79b9b2e387cee732331`
- viewport: `1440x900@1`
- brief: `docs/design/briefs/lexos-case-workspace/brief.md`

## What I looked at

Full-page desktop render (1440 wide, full scrolled height) of the current pixels, after the
19-line removal of the `measure-note` block (and its CSS) that sat between the identity quartet
and "Add entry". Swept fresh against all four contracts, not limited to the diff: the topbar,
case identity (H1 + O.S./court/suit line + client/claim line), the quartet strip (Parties /
Case number / Status / Next hearing / Overdue), the seam where the note used to sit, "Add entry",
the five-item "Show:" filter, the "Ahead" card, the "Jump to next-due entry" link, the open
`Jul 2026` period with six dated entries (including the highlighted, unrecorded 14 Jul hearing),
the collapsed `May 2026` period, the keyboard legend, and the full appendix of declared states
for the case header and a period.

**The seam, specifically.** Cropped and enlarged the region spanning the quartet's closing rule
through "Add entry" through the "Show:" filter row. The gap above "Add entry" and the gap below
it read as the same order of spacing — neither collapsed against the quartet's rule nor doubled
against the filter row beneath. "Add entry" still sits inside its own full-width bordered box, so
it reads as a distinct object against the quartet above it on its own border alone; the record and
the compose affordance do not run together. No orphaned gap, no leftover rule, no dangling
margin from the removed block was visible anywhere in that region.

**The quartet, specifically.** Case number, Status, Next hearing, and Overdue all render complete
and untruncated — `O.S. No. 412 of 2024`, `Active` (pilled), `Not set`, `2` — matching the
full case name repeated above it verbatim. The round-1 violation this variant carried does not
show on these pixels.

**Gaps in this run, not judged pass or fail:** only a 1440×900 desktop capture exists, so mobile
reflow, focus-visible state, reduced motion, and scroll-time stickiness of the quartet/"Add entry"
are all unverified from a flattened, animations-off, single-viewport render — reported as gaps,
not verdicts.

## Findings

- WEAKNESS: the **Overdue** field in the quartet — the fact the brief names directly as required
  pre-action knowledge — still renders as plain bold text with no badge, while the less
  time-pressured **Status** field gets a filled pill (`Active`). Unaffected by this edit but still
  visible on these pixels. Location: "OVERDUE" field of the quartet, right of "NEXT HEARING".

- WEAKNESS: suspect several interactive elements still fall under the brief's declared 44px
  target floor — the row-action links (`Edit` / `Remove … — cannot be undone`) render as plain,
  unpadded inline text sitting close together, and the "Show:" filter items read the same way.
  Suspicion only, not a measurement — hand the real number to design-lint. Location: row actions
  on every dated entry (24 Jul, 21 Jul, 16 Jul, 08 Jul, 02 Jul), and the filter row under
  "Add entry".

- WEAKNESS: the "Reference — declared states" section (case header + period state matrix, lower
  half of the page) still carries process-facing prose — "Shown here together for review; the
  page above is always the success state" — that describes this as a review artifact rather than
  product content. Given this render is headed to external designers and lawyers who don't know
  arc made it, this is the same category of tell the measure-note strip was meant to remove, on a
  section that takes up roughly a third of the page's scroll length. Not part of this edit and
  not evaluated for blind-packaging risk in the prior round, but visible now on a full sweep with
  that framing in mind. Location: everything under the "Reference — declared states" heading,
  both the "CASE HEADER" and "PERIOD" panel groups.

- POLISH: "Add entry" — the page's own declared primary action — renders as an outlined card with
  a small icon chip, while "Record outcome", a single-row contextual action, uses the solid
  filled primary-button treatment. A minor hierarchy inversion between the whole-page action and
  a row-scoped one; arguable rather than clear-cut, since "Add entry" likely opens a chooser
  rather than committing directly. Location: "Add entry" box vs. the "Record outcome" button in
  the highlighted 14 Jul row.

- POLISH: the full case name is set twice within a few lines of each other — once as the page H1,
  once again inside the "Parties" quartet card. Reads as pure repetition in this flattened,
  single-viewport capture; may be justified if the quartet card is a sticky companion once the
  header scrolls away, which this render cannot confirm. Location: page H1 vs. "Parties" line in
  the quartet card.

- POLISH: the active "Show:" filter item (`All`) still carries an underline beneath bold text —
  a residual tab-navigation cue. Location: filter row directly below "Add entry".

## What is working

The edit did exactly what it was scoped to do: no collapsed or doubled gap, no leftover border or
rule, no orphaned spacing at the seam, and the record-to-compose transition still reads as two
distinct regions rather than running together. The always-visible quartet remains complete and
untruncated, so the variant's original violation has not regressed. Destructive row actions still
name the thing and state irreversibility in a colour distinct from the benign "Edit" beside them,
every visible term still traces to the content contract's closed vocabulary, dates and amounts
are still in the declared formats, and no lorem ipsum appears anywhere on the page. The five-state
matrix (empty · loading · error · success · disabled) is still rendered concretely for both the
case header and a period, each using a semantic label rather than colour alone to carry status.

## What I could not check

Scroll-time stickiness of the quartet or "Add entry" cannot be judged from a flattened full-page
capture — reported as a run gap, not a pass or fail, per instruction.
