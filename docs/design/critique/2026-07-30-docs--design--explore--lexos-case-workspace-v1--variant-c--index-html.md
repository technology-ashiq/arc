# Design critique — variant C (guided workflow), LexOS case workspace explore

- target: `docs/design/explore/lexos-case-workspace-v1/variant-c/index.html`
- screenshot_sha256: `76e0c8537bcfe80ca4123d120c8d2392169c15e741617980eb85b8fa778f0294`
- viewport: `1440x900@1`
- brief: `docs/design/briefs/lexos-case-workspace/brief.md` · thesis: `docs/design/explore/lexos-case-workspace-v1/variant-c/thesis.txt` · matrix: `docs/design/explore/lexos-case-workspace-v1/matrix.md`

## What I looked at

The full-page desktop render at 1440 wide (full scrolled height, well beyond the 900px viewport):
the topbar breadcrumb, the case-header quartet card, the three-step horizontal rail, the printed
keyboard legend, the open Step 1 card with its single button, the blocked Step 2 and Step 3 cards
with their stated reasons, the two foot disclosures (collapsed), and the "Reference — state
matrix" appendix (case header × 4 states, a step × 4 states, run end-state). I also read
`index.html` and `tokens.css` to settle three things a single static capture cannot: whether the
quartet card is pinned through scroll (it is not — see Findings), whether the printed keyboard
legend is backed by a script (it is not — the file ships no `<script>` element at all), and what
the two collapsed disclosures actually contain (checked for lorem ipsum, date format and the
destructive-link styling, since none of that is visible as pixels while collapsed).

**Gaps in this run, not judged as pass or fail:** only a 1440×900 desktop capture exists, so the
declared mobile reflow ("Step 1 of 3" compact rail) cannot be verified from pixels — the CSS
media query for it is present in source but that is not the same as seeing it rendered. No
`:focus-visible` state was captured (nothing is focused in a static render) and reduced-motion
cannot be observed from a still image either, even though both are declared in the stylesheet.

## Findings

- VIOLATION: the always-visible quartet card is not pinned through scroll, so it is not "on
  screen at all times" once a lawyer scrolls past roughly the first third of the page. This
  render's own full-page capture shows the quartet as the very first block on a page that runs
  to well over two screens' worth of content beneath it (step rail, keys, three step cards, two
  disclosures, the full state appendix) — none of it visible without scrolling the quartet out of
  view first. I checked the stylesheet because a single full-page image can't settle
  scroll-persistence either way: there is no `position: sticky` or `fixed` anywhere on
  `.case-header`, `.topbar`, or any ancestor — the only `position` rule in the whole file is on
  the accessibility skip-link. This variant's own expected entry for dimension 3 in the matrix
  promises "the quartet as a fixed status line," and the shared floor states the quartet must be
  on screen at all times, never behind a click and never behind a step — the matrix's own words
  are that a guided run hiding the case's status is a VIOLATION, not a thesis. Location: `.case-header`
  (top of page) versus the page's full scrollable height.

- WEAKNESS: the printed "KEYS" legend (Enter / → / ←) is declared but not demonstrated — the page
  ships zero `<script>` elements, so none of the three bindings actually fires. The legend itself
  is internally clean (three keys, no key bound twice), which is the specific defect this pass was
  asked to check for, but the larger gap is that this variant's whole expert-path thesis (dimension
  6: "keys move over steps") and the "keyboard-first: yes" platform surface are both asserted in
  copy with no working implementation behind them on this page. Location: the "KEYS" block under
  the step rail.

- WEAKNESS: "Opens here on return — Hearing outcome, not a section." reads as commentary aimed at
  whoever is judging the IA rather than at the lawyer using the product — it only fully parses
  against knowledge of the shipped baseline's five-tab shape (the contrast implied by "not a
  section"), which is not something a working lawyer needs mid-case. Against a voice contract of
  "a court record, not an assistant," this is closer to design rationale bleeding into the
  interface than a stated fact. Location: the line directly beneath the step rail, above the KEYS
  legend.

- WEAKNESS: the two foot disclosures ("Full hearing history" and "Recent record") overlap in
  content — both carry facts about the same 19 May and 14 Jul hearings — and "Recent record" is a
  seven-item mixed-type dated list (hearing, fee, document, note, task, task) that is a small-scale
  version of variant B's whole record stream. The matrix's own director notes flag this exact spot
  as the one place C comes closest to converging with B, ruled acceptable only because it is
  collapsed by default. This render confirms both disclosures are in fact collapsed by default, so
  the ruling holds for what's on screen — but it is the single most fragile point in the build, one
  content edit away from becoming what the matrix warned against. Location: the two `<details>`
  elements at the foot of the run.

- WEAKNESS: several of the dimmest-reading text elements on the page — the "Not set" values in the
  quartet, the "Step 2"/"Step 3" headings and reason text on the blocked steps, and the small
  labels throughout the reference appendix — read as the dimmest ink on the page and are worth a
  design-lint pass to reconfirm the numbers. I'm flagging this as a suspicion only, not a measured
  failure: the brief itself pre-clears exactly this ink as "earned and deliberate," so the intent
  is not in question, only whether every instance of it actually lands on the cleared pairing.
  Location: quartet "Not set" values, Step 2/3 card text, appendix labels.

- POLISH: the topbar breadcrumb carries the case name a second time
  ("LexOS / Cases / Meera Raghunathan v. Sunvale Housing Pvt. Ltd.") styled with ellipsis
  truncation in source, while the mandated copy of the same name in the case-header H1 directly
  below has no such truncation risk. Nothing clipped in this 1440px render and the breadcrumb isn't
  the mandated field, but it's the one place on the page where the case name could silently clip
  under a narrower width. Location: `.topbar__current`.

- POLISH: "advances" (in the Enter key's description) sits outside the six-verb closed list. It's
  descriptive prose echoing the brief's own A.3 wording ("Advance the case"), not a button label,
  so it isn't the invented-label violation the content contract exists to catch — but worth a
  tidy pass to keep every verb on the page inside the closed set even in explanatory copy.
  Location: the "Enter" key legend item.

## What is working

Exactly one `<button>` exists on the page ("Record hearing outcome") — this variant's whole thesis
is delivered, not merely claimed, and the two blocked steps state their reasons as plain sentences
rather than rendering as dimmed secondary buttons standing next to the primary one. The always-
visible quartet's data is correct against the canonical fixture and "Not set" is shown as a
labelled, unhidden empty value; the overdue count only takes on alarm styling when it's actually
nonzero (the reference example correctly shows "Overdue 0" in plain ink). Status badges carry both
a tone and a human-readable label ("Active", "On hold", "Intake") — never a raw enum, never colour
alone. The system stance holds throughout — no drop shadows, no gradients, no emoji, left-aligned
quiet-fill empty states, a single radius token. The state-matrix appendix is an efficient, honest
reading of the five-state requirement: it reuses what's already live above (Step 1 open = success,
Steps 2–3 = disabled) and adds only the three states that aren't otherwise on screen, rather than
padding out a redundant 5×2 grid. And the exact defect flagged as a VIOLATION on a sibling variant —
a mandated name clipped with no recovery — does not recur here: every party name and case name on
this page renders in full.
