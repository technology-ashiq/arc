# Design critique — tests/fixtures/design/arc-hq-mockup-defect.html

- target: `tests/fixtures/design/arc-hq-mockup-defect.html`
- screenshot_sha256: `052fcc606e5536826033288b06b38a1c17f3f1758b17418140da4a43e6642d7e`
- viewport: `1440x900@1`
- brief: none declared for this fixture — `docs/templates/design-brief-template.md` used only
  for the shape of the four contracts, not as this product's literal requirements. Feel
  words, anti-words, declared platform surfaces, and declared vocabulary are all undeclared
  for this run. What follows judges only what is objectively broken against the four
  contracts' shape: hierarchy, alignment, clipping, placeholder content, vocabulary
  consistency, and the a11y floor — no mobile, hover, or focus states are reported on, since
  none were rendered (this is a single full-page static desktop capture).

## What I looked at
The full-page 1440-wide desktop-static render of "ARC HQ": header with status pills, a
greeting banner, a 6-card KPI row, a left column (Today event timeline, 14-day revenue
chart, Idea→Money pipeline, Portfolio cards), and a right column (Approval Inbox with 3
decision cards, Autonomy Ladder, "What the company learned this week") — inspected end to
end at full resolution.

## Findings

- VIOLATION: literal Lorem ipsum shipped as real content — the first "Today" timeline row,
  06:02, `discover` event, reads "Lorem ipsum dolor sit amet, consectetur adipiscing elit
  sed do **eiusmod tempor**". It carries the exact same bold-phrase-for-key-fact emphasis
  pattern the genuine rows around it use (e.g. the 09:12 `invoicefly` row bolds "Phase 3
  closed"), so it reads as a captured real event, not an obvious stub. Lorem ipsum anywhere
  is an automatic content-contract violation regardless of brief.

- WEAKNESS: the six KPI-card eyebrow labels ("REVENUE · TODAY", "MRR · PORTFOLIO", "IDEAS
  CAPTURED", "BUILDS ACTIVE", "CONTENT PUBLISHED", "YOUR TIME NEEDED", top of each card in
  the KPI row) read as the dimmest text anywhere on the page — visibly fainter than every
  other secondary label on the surface (section headers like "TODAY — EVERYTHING THE
  COMPANY DID", the pipeline-card captions, the portfolio-card status lines). This is a
  suspected AA-contrast floor issue on exactly the labels a reader needs to know what each
  big number underneath means — measurable, verify with design-lint before fixing.

- WEAKNESS: no visual hierarchy distinguishes the one actionable KPI from the five purely
  descriptive ones. "YOUR TIME NEEDED" (9 min · 3 decisions in inbox) is the card the
  banner text directly above it calls out as needing the operator's attention ("await you —
  9 minutes of your time"), yet it is styled identically — same size, weight, color, card
  treatment — to "Revenue Today", "MRR", "Ideas Captured", "Builds Active", and "Content
  Published". Notably, the page already demonstrates it knows how to size cards by
  importance (the lower "Pipeline — Idea → Money" row of cards is visibly smaller/more
  compact than this top KPI row), which makes the flat treatment here read as an
  inconsistency rather than a fixed constraint of the page's system.

- WEAKNESS: destructive and routine actions share the identical button treatment — "Confirm
  kill" (Kill: PromptVault → attic, an irreversible portfolio-level action) uses the same
  solid-color primary-button style as "Approve" and "Approve all" (routine, reversible
  content approvals) elsewhere in the same Approval Inbox column. On a screen built for fast
  repeated approvals, giving a high-stakes irreversible action no distinct visual treatment
  from routine ones is a mis-click risk.

- POLISH: the six KPI cards are near-identical in weight and layout (same card treatment,
  same corner radius, same number size, evenly spaced) — the row reads flat with no single
  focal point even setting aside the hierarchy finding above; worth a second pass on which
  1-2 cards should visually lead.

## What is working
The dark, dense operator-console aesthetic holds together well: no default purple-blue
gradient, no emoji-as-icon, a single reused colored-dot vocabulary for timeline event
categories rather than a mixed icon set, and consistent corner radii across every card type
on the page. Content is realistic and specific almost everywhere — real-shaped rupee
amounts, specific counts ("41/41 tests", "2,140 stars · 41 forks", "28.4k subs"), and
consistent internal vocabulary (council, kickoff, L0/L1/L2 autonomy, kill-distance) rather
than invented placeholder labels — which makes the single lorem-ipsum row stand out as the
one real gap. The portfolio cards' status bars use color semantically and consistently
(green = healthy, amber = watch, red = kill-criteria-met), and the KPI numbers themselves
are large and easy to scan against the dark card background.
