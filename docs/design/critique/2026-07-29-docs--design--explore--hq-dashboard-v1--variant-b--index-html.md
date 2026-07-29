# Design critique — docs/design/explore/hq-dashboard-v1/variant-b/index.html

- target: `docs/design/explore/hq-dashboard-v1/variant-b/index.html`
- screenshot_sha256: `52e507eea9b89860f40871dfc00fdea24672b1aa1ffd1de6f2c3a97dadecf95b`
- viewport: `1440x900@1`
- brief: `docs/design/briefs/docs--strategy--arc-hq-mockup-html/brief.md`

## What I looked at
Round 2, full-page render of the same "Review workspace": header with keyboard legend and spine-sync
note, a new compact KPI strip (MRR, burn, runway, ventures live, cleared today) directly beneath it, a
left rail (six-card queue, a "done today" log, a new "today's events" list, and a reference/empty-state
demo card), and the right-hand evidence pane for "Kirana Express" (verdict + score, ₹ amount,
kill-criteria block, prior-receipts compare table, action row), followed by a bottom appendix of the
evidence pane's other states. Nothing below the capture is cut off.

## Round-1 status (not counted as current findings — see Findings below for what still stands)
- Kill-criteria self-contradiction (burn vs ceiling badged wrong): **FIXED.** Monthly burn now reads
  ₹40,95,000 against a ceiling of ₹42,00,000 — under the ceiling, so "NEAR BREACH" now follows from its
  own number. All four rows (runway/burn/margin/growth) now read consistently with their own OK/NEAR
  BREACH/BREACHED badge.
- Trend sentence contradicting the receipts table: **FIXED.** The caption now reads "Council score,
  oldest to newest: 8.0 → 7.1 → 6.9 → 7.6 → 7.4 now," and reading the table's four rows from its oldest
  date to its newest produces exactly that sequence, with 7.4 matching the verdict score shown at the
  top of the pane.
- Missing KPI row and today's event timeline: **FIXED, as new surfaces** — see the fresh finding below
  for a cost this introduced.
- Same-hue badge text on tinted backgrounds: **PARTIALLY FIXED, unconfirmed** — see WEAKNESS below.
- "Lateral, same pane — not a new screen" designer-voice caption: **FIXED.** Replaced with the
  table-derived trend sentence; no other caption on the page narrates its own navigation mechanics.
- Focus ring indistinguishable from selection: **FIXED.** The Kirana Express queue card (currently open
  in the evidence pane) and the "Kill-criteria breached" reason chip carry an elevated/filled selected
  treatment; the Bazaarly queue card and the "Runway below floor" chip carry a ring only, on the same
  plain background as their unselected neighbours — the two states now read as visually distinct.
- Reference/demo sections reading as shipped layout: **FIXED** for its stated scope — both now carry a
  "Reference —" heading prefix, which was the requested change.

## Findings

- VIOLATION: the newly added "Today's events" list — one of the two surfaces built to satisfy the
  brief's always-visible requirement — puts a bare council verdict score in the rail: the line "07:15
  Bazaarly verdict posted, 6.8" names a venture and a verdict number with no ₹ amount and no
  kill-criteria state attached. This is a different venture from the one open in the evidence pane, so a
  reader gets a number with no way to judge it from where it sits — the exact "reconstruct the evidence
  from receipts he has to go find" pattern the assigned thesis exists to prevent, just relocated from the
  approval card into the rail. It also directly contradicts the creation side's own account of this
  round's fix ("kept... the rail identifier-only") on a surface that account explicitly claims to cover:
  every queue card in this render shows venture/id/₹ only, but this one rail-column line breaks that
  rule.

- WEAKNESS: the contrast risk flagged in round 1 (status-badge text on similarly tinted backgrounds)
  looks improved for the kill-criteria "NEAR BREACH"/"BREACHED" pills, which now read as solid filled
  chips rather than tinted-on-tinted text. The Naaptol Foods queue card's "Evidence failed to load -
  retry" caption, however, still reads as a muted warm-toned text sitting on a similarly warm-toned
  card background — I have not measured either, but this pairing in particular still looks like the same
  risk round 1 named. Verify both with design-lint against the declared ≥4.5:1 floor before treating as
  settled.

- WEAKNESS: the new "Today's events" list duplicates two of its five lines verbatim against the "Done
  today" log directly above it in the same rail column — "Udhaar Metrics approved, RCT-114820" and
  "Farmstack Direct killed, RCT-114796" appear in both lists, one card-styled and one line-styled, within
  the same short vertical span. A reader scanning top-to-bottom meets the identical fact twice before
  reaching new information, which adds rail density without adding evidence — a cost worth weighing
  against the "calm" feel word and the content contract's "one line per timeline event" expectation.

- POLISH: the "Today's events" list entries are structured inconsistently — most pair an action with a
  trailing receipt id ("...approved, RCT-114820"), one pairs an action with a score ("...verdict posted,
  6.8"), and one has neither ("Kirana Express approval opened"). A single consistent shape per line would
  read calmer.

## What is working
The core evidence pane is unchanged and still does its job well: verdict, score, ₹ amount, and a now
internally-consistent kill-criteria block sit stacked above the action row, nothing behind a click. The
trend sentence now actually matches its own table, which is the single most important repair this round
made — a reader no longer has to catch the page contradicting itself on the exact claim the thesis is
built on. The new KPI strip is genuinely compact (one row, five values, the two unavailable/stale ones
correctly shown as greyed-with-caption rather than a spinner) and does not compete with the evidence
pane for dominance. Selected-vs-focused styling is now legible as two different things rather than one.

## What I did not verify
Reduced motion and keyboard behaviour are not visible in a static render and the recipe disables all
animation/transition for this capture, so neither is judged here.
