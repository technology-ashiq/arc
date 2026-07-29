# Design critique — docs/design/explore/hq-dashboard-v1/variant-a/index.html

- target: `docs/design/explore/hq-dashboard-v1/variant-a/index.html`
- screenshot_sha256: `05ccb3bea05b4b2daf880a03959a67421ec724bffb018790eccf2923feeb75b8`
- viewport: `1440x900@1`
- brief: `docs/design/briefs/docs--strategy--arc-hq-mockup-html/brief.md`

## What I looked at
Full-page render (taller than the 1440x900 viewport) of the ARC HQ day surface: header with keyboard
legend, a six-tile KPI row, a seven-row approval inbox (one row keyboard-selected with its evidence
expanded, one row in an error state, one row disabled) with a "done today" log beneath it, a right-hand
"today's event timeline" sidebar, and a bottom "state matrix — reference" appendix demonstrating
loading/empty/disabled states not otherwise reachable on this data set. I did not capture a scrolled
viewport state, only the single full-page composite.

## Findings

- VIOLATION: several entries in "Today's event timeline" wrap onto a second line — the 07:58 Bhoomi
  Agritech entry, the 09:31 Arthveda Capital entry, the 10:03 "retrying automatically" entry, and the
  10:09 Trellis Logistics entry all break across two lines in the sidebar column — breaks the content
  contract's explicit density rule "one line per timeline event."

- WEAKNESS: the variant's assigned thesis is that the KPI row and today's event timeline "stay in view"
  while the user clears approvals with j/k/a/r — this full-page capture can't confirm that, since it
  shows the whole document at once regardless of any sticky/fixed positioning. The approval inbox's own
  content (seven rows, two of them taller than the rest for the selected row's expanded evidence and the
  failed-row error message) runs long, and nothing on the page signals a pinned-header or
  independently-scrolling-column treatment (no visible seam, shadow break, or split-scroll affordance
  between header/KPI/timeline and the inbox). This needs a scrolled-viewport check before the thesis
  claim can be trusted — I'm flagging the gap, not asserting the page fails it.

- WEAKNESS: "Hold" appears as a verdict value on two of the seven rows (Trellis Logistics, Arthveda
  Capital) but is not part of the content contract's declared closed vocabulary (approve · reject ·
  promote · kill / venture · phase · receipt · council verdict · approval · autonomy level). Worth
  confirming this is accepted spine vocabulary rather than a per-panel invention before it ships, since
  the brief treats invented labels as a violation when a domain term already exists.

- WEAKNESS: a cluster of text reads as the dimmest on the page and may sit under the declared contrast
  floor — the "Stale 41m — spine sync failed" note under Runway, the disabled Approve/Reject controls
  and the "Locked — awaiting L2 sign-off" caption on the Arthveda Capital row, and the small phase
  captions under each venture name — measurable, verify with design-lint before fixing.

- WEAKNESS: a few interactive elements read as noticeably smaller than the row's primary Approve/Reject
  buttons — the underlined evidence receipt-id links, the L0–L3 level badges, and the "Retry" button on
  the failed row — worth checking against the declared ≥44px target-size floor with design-lint rather
  than assuming from the eye.

- POLISH: the "STATE MATRIX — REFERENCE" appendix at the foot of the page shares the same panel styling
  as the live day-surface above it. A lighter or more clearly separated treatment would keep "this is the
  product" and "this is a documentation aid for critique" from blurring together if the file is later
  reused directly as implementation.

## What is working
The kill-action button on the Vistara Mobility row names the venture and states the irreversible
consequence directly on the button ("Kill Vistara Mobility — halts funding — unrecoverable") instead of
a bare confirm — exactly what the content contract asks for. The failed NeoKirana row states what failed
and the concrete next step with a named escalation contact, never "something went wrong." The stale
Runway tile greys its last-known value and states how stale it is instead of showing a spinner, matching
the KPI state-matrix rule precisely. The selected row (keyboard focus ring, row highlight, and an
evidence panel that expands only for the focused row) is a clean, coherent visualization of the
keyboard-first model the thesis depends on. ₹ amounts use correct Indian digit grouping throughout and
timestamps are consistent HH:MM 24h IST. No gradient hero, emoji iconography, or centre-everything
layout is present.
