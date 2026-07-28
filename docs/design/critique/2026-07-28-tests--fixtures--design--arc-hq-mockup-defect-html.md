# Design critique — tests/fixtures/design/arc-hq-mockup-defect.html

- target: `tests/fixtures/design/arc-hq-mockup-defect.html`
- screenshot_sha256: `e14d5caa9655e5126559fb661e57cce008c9b6f4e0e34ea40642765a83f07f8f`
- viewport: `1440x900@1`
- brief: none declared — no brief exists for this fixture. Intent (feel words, anti-words,
  declared surfaces, declared nouns/verbs) is undeclared for this run. What follows judges
  only what is objectively broken: contrast, hierarchy, clipping, placeholder content, and
  action-vocabulary consistency, against the desktop-only static surface actually rendered.
  No mobile or interactive/hover/focus states are reported on — none were rendered.

## What I looked at
The full 1440×900 desktop-static render of "ARC HQ": header + status pills, a greeting
banner, a 6-card KPI row, a left "Today" event timeline, and a right column with an
Approval Inbox (3 decision cards) and an Autonomy Ladder panel — inspected at full
resolution plus targeted pixel-level crops (KPI labels, timeline head/tail rows, the
inbox action buttons) with RGB sampling to check WCAG contrast where legibility looked
suspect.

## Findings

- VIOLATION: literal Lorem ipsum shipped as real content — first "Today" timeline row,
  06:02, `discover` event: "Lorem ipsum dolor sit amet, consectetur adipiscing elit sed do
  **eiusmod tempor**" — styled identically to the genuine rows around it (same bold-phrase
  emphasis pattern real rows use for key facts), so it reads as a real captured idea, not
  a stub. Placeholder copy shipped as content is an automatic violation regardless of brief.
- VIOLATION: AA contrast failure on all six KPI-card eyebrow labels — "REVENUE · TODAY",
  "MRR · PORTFOLIO", "IDEAS CAPTURED", "BUILDS ACTIVE", "CONTENT PUBLISHED",
  "YOUR TIME NEEDED" (top of each card in the KPI row, y≈190–200). Pixel sampling of the
  brightest label pixel found RGB(49,49,48) against a card background of RGB(26,26,25) —
  a measured contrast ratio of **1.34:1**, against a WCAG AA floor of 4.5:1 for text this
  size. The labels are functionally illegible at a glance (confirmed against a 3x crop —
  they read as near-invisible ghosting), while the section headers elsewhere on the same
  page ("TODAY — EVERYTHING THE COMPANY DID", "APPROVAL INBOX") sample at 4.85:1, so this
  isn't the theme's baseline — it's a localized regression on exactly the labels a reader
  needs to know what each big number means.

- WEAKNESS: the bottom timeline row is hard-clipped mid-sentence — 21:00 "retro" row reads
  "Daily retro: 2 playbook rules added · market-juror weight +0.03 (hit-rate ↑) · 1" and
  cuts off there at the panel's bottom edge, with no fade gradient, "N more" affordance, or
  visible scrollbar to signal there's more below. On a static render this presents as a
  broken/truncated list rather than an intentionally scrollable feed.
- WEAKNESS: no visual hierarchy between the one actionable KPI and the five descriptive
  ones — "YOUR TIME NEEDED" (9 min · 3 decisions in inbox), the card that is explicitly the
  call to action per the banner copy above it, is styled identically (same size, weight,
  color, card treatment) to "Revenue Today", "MRR", "Ideas Captured", etc. Nothing in the
  KPI row tells the eye which of the six numbers is the one requiring the operator to act.
- WEAKNESS: destructive and routine actions share one button color — "Confirm kill" (Kill:
  PromptVault → attic card, an irreversible portfolio-level action) uses the identical
  solid-blue button style as "Approve" / "Approve all" (routine, reversible content
  approvals) elsewhere in the same Approval Inbox column. On a dense screen built for fast
  repeated approvals, a high-stakes action carrying no distinct color from routine ones is
  a mis-click risk.

- POLISH: the six KPI cards are visually near-identical in weight and layout (uniform dark
  card, same corner radius, same number size) — reads as a flat, evenly-weighted row with
  no single focal point, worth a second pass even setting aside the "Your Time Needed"
  hierarchy issue above.

## What is working
The dark, dense operator-console aesthetic is genuinely restrained — no default
purple-blue gradient, no emoji-as-icon, a single reused glyph for the tag pills rather
than a mixed icon set, and consistent corner radii across cards. The event timeline's
color-coded category dots and right-aligned action pills (`run`, `verdict`, `diff`,
`txn`, `auto`, `L0`/`L1`/`L2`) form a legible, consistent vocabulary once you're past the
KPI row, and the big white numbers against the dark cards (17:1+ contrast measured) are
genuinely easy to scan.
