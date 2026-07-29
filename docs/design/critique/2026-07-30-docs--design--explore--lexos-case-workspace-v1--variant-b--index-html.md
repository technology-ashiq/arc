# Design critique — variant B (narrative)

- target: `docs/design/explore/lexos-case-workspace-v1/variant-b/index.html`
- screenshot_sha256: `a45af2c8a218c0afb34a05532da6ff9630475e715f8ea81dbb3cabf8d343f0ea`
- viewport: `1440x900@1`
- brief: `docs/design/briefs/lexos-case-workspace/brief.md`

## What I looked at

Full-page desktop render (1440 wide, full scrolled height) of the case-record stream: topbar,
case identity, the sticky quartet strip, the measure-departure note, the "Add entry" compose
point, the five-item "Show:" filter, the "Ahead" future entry, the open `1–30 Jul 2026` period
with six dated entries, the collapsed `May 2026` period, the keyboard legend, and the full
appendix of declared states for the case header and a period.

**Gaps in this run, not judged as pass or fail:** only a 1440×900 desktop capture exists, so the
declared mobile reflow cannot be verified from pixels. No focus-visible state was captured
(nothing is focused in a static render), so the a11y floor's visible-focus requirement is
unverified here even though the stylesheet declares one. Only the default `All` state of the
in-stream filter was rendered, so I cannot confirm from pixels whether selecting `Hearings` /
`Documents` / `Tasks` / `Notes` truly filters in place versus repositioning the page — my read on
that dimension leans on the static evidence available (single region, no route change visible)
plus the fact that only one filter state exists in this capture. The collapsed `May 2026` period
and the closed `Add entry` form body were not rendered open, so their contents (including a
lorem-ipsum check) could not be visually verified.

## Findings

- VIOLATION: the **Parties** field in the always-visible quartet strip is rendered with a hard
  ellipsis clipping the case name (`Meera Raghunathan v. Sunvale Housing Pvt. ...`) — the full
  name is only spelled out in the page's H1 above it, which is not part of the sticky strip and
  scrolls out of view. Once the reader has scrolled into the record, the only persistently-visible
  copy of the mandated "parties" fact is the truncated one, with no way to recover the clipped
  text — no tooltip, no expansion, no wrap. The brief's A.5 and the matrix's shared floor both
  require the case's identity to be "on screen at all times ... never behind a click"; a fact that
  is silently clipped with no recovery path is not on screen in full, and for a case with a longer
  party list or a longer corporate suffix this will clip more, not less. Location: the "Parties"
  field of the sticky quartet strip, directly under the measure note.

- WEAKNESS: the five-item "Show:" filter (All · Hearings · Documents · Tasks · Notes) reads
  visually as a tab bar — evenly sized rounded pills, one filled solid dark as the active state
  among outline pills — even though the "Show:" prefix and its in-stream placement support the
  matrix's own "lens, not address" ruling. This is the exact tension the matrix's own director
  call flagged when it was built ("the filter's inverse-filled pills read tab-like even though the
  IA underneath is not"), and the rendered pixels confirm that concern rather than resolve it.
  Location: the filter row directly below "Add entry".

- WEAKNESS: the single most operationally important action on the page — "Record outcome" on the
  14 Jul entry, which is what the interaction model's primary action (A.3, "record what just
  happened") actually looks like in this fixture — is styled identically to a routine "Edit" link
  elsewhere in the record (same plain, unweighted link style). The row it sits in is tinted to
  flag it, but the action text itself carries no more visual weight than editing a filed document.
  For the one entry the whole case is waiting on, this undersells the action the brief calls the
  case's primary one. Location: the "14 Jul 2026 / Held 14 Jul 2026 / Unrecorded" entry's action
  link.

- POLISH: period headers are inconsistent in form — the open period reads as a day range
  (`1–30 Jul 2026`) while the collapsed period reads as a bare month (`May 2026`) — a small
  rhythm break between two instances of the same component.

- POLISH: the keyboard legend describes the filter cycle in lowercase singular ("all → hearing →
  document → task → note") while the actual filter pills read capitalized and plural ("All,
  Hearings, Documents, Tasks, Notes") — same closed vocabulary, mismatched inflection between the
  legend and the control it describes.

- POLISH: the case-header "Empty" state in the declared-states appendix reads as a list-level
  empty state ("No case selected. Choose a case from All cases to open its record.") rather than
  an empty state of this case's own header — a plausible interpretation for a reference appendix
  but a slight conceptual mismatch worth a second look.

## What is working

The thesis is genuinely built, not merely claimed: every dated row — document, task, note,
hearing — sits in one continuous stream carrying its type as a small inline tag, never as a
section container, and there is exactly one compose affordance ("Add entry") at the head of the
stream with no per-type buttons scattered anywhere else on the page. The full five-state matrix
(empty · loading · error · success · disabled) is rendered concretely for both the case header and
a period, not just described. Destructive language is textbook — every "Remove ... — cannot be
undone" names the thing, states irreversibility, and is visually distinguished from a benign
"Edit" link beside it. Every colour used on the page traces to the brief's own declared, pre-cleared
fg/bg pairs, including the deliberately dim "Not set" / eyebrow-label ink, used as intended rather
than "cleaned up." Dates and the ₹ amount are formatted exactly to the content contract, and the
licensed departure from `max-w-shell` is declared on the page, in plain language, in the right
place, and correctly spends the width on line length rather than a second region.

The variant's weakest moment is the truncated parties field — a real fact clipped with no recovery
in the one place the brief most insists it must always be readable — set against an otherwise
disciplined, well-argued build of its own thesis.
