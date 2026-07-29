# Design critique — docs/design/explore/hq-dashboard-v1/variant-b/index.html

- target: `docs/design/explore/hq-dashboard-v1/variant-b/index.html`
- screenshot_sha256: `fc6988929cc74ede6e8d00800da674e21d1a3200bbd3a61acb213c2347740aaa`
- viewport: `1440x900@1`
- brief: `docs/design/briefs/docs--strategy--arc-hq-mockup-html/brief.md`

## What I looked at
Full-page render (taller than the 1440x900 viewport) of a single-approval "Review workspace": a header
with a keyboard legend and spine-sync freshness note, a left queue rail (six approvals — one selected,
one loading, one errored, one blocked/disabled) with a "done today" log and a labeled empty-state demo
card beneath it, and a large right-hand approval-detail pane for "Kirana Express" showing council
verdict + score, the ₹ amount, a four-row kill-criteria state block, a "compare prior receipts" table,
the action row (approve/reject/promote/kill with reason presets), and a bottom appendix demonstrating
the evidence pane's empty/loading/error/disabled states. This is the entire page — nothing below the
capture is cut off.

## Findings

- VIOLATION: the kill-criteria block's own numbers contradict its own status label — "Monthly burn
  ₹44,80,000" against "ceiling ₹42,00,000" (actual already above the ceiling) is badged "NEAR BREACH"
  (amber), while the row directly below it, "Gross margin 15.6%" against "floor 18%" (also already past
  its threshold), is correctly badged "BREACHED" (red) for the same shape of violation. One of the two
  is computed wrong. This sits exactly on the thesis this variant was built to prove — "judge... its
  venture's kill-criteria state in a single pane, without reconstructing that evidence" — and here the
  pane's own verdict doesn't survive being read against its own numbers, which is the reconstruction the
  thesis exists to prevent. Also breaks the "factual" feel word.

- VIOLATION: the trend sentence above the receipts table contradicts the table beneath it — "Council
  score trend: 8.0 → 7.1 → 7.6 → 6.9 → 7.4 now" does not match the chronological order of the SCORE
  column in the "Compare — Kirana Express prior receipts" table directly below it (read oldest-to-newest
  by date, the table gives 8.0 → 7.1 → 6.9 → 7.6 → 7.4). Same location and same failure mode as the
  finding above: a headline claim on the primary object that a reader would have to re-derive from the
  adjacent evidence to catch — breaks "factual" and the content contract's accuracy expectation.

- VIOLATION: two of the three surfaces the brief declares "always visible" on this page — the KPI row
  and today's event timeline — are absent from the render. Only the approval queue/inbox is present;
  "DONE TODAY" is a log of this queue's own approve/kill outcomes, not a company-wide activity timeline.
  No tab, link, or other navigation affordance anywhere on the page suggests either surface is reachable
  elsewhere from here. Breaks interaction-model item A5 (the explicit always-visible/on-demand split)
  and, downstream of that, undercuts item A1's job statement ("see everything the company did today").

- WEAKNESS: several status indicators pair same-hue text on a same-hue tinted background — the red
  "Evidence failed to load - retry" caption on the reddish-tinted Naaptol Foods queue card, and the
  amber "NEAR BREACH" / red "BREACHED" kill-criteria badges on their similarly tinted row backgrounds.
  These read as a plausible contrast risk but I have not measured them — verify with design-lint against
  the declared ≥4.5:1 floor before treating as settled.

- WEAKNESS: the "Compare" panel's caption "Lateral, same pane — not a new screen" reads like a designer
  annotating the interaction model for a reviewer, not copy a terse operator console would show its
  user — a voice/tone slip against the declared register (no other caption on the page explains its own
  navigation mechanics this way).

- WEAKNESS: the only visible highlighted-ring elements on the page (the selected Kirana Express queue
  card, the selected "Kill-criteria breached" reason chip) are already-selected states. Nothing in this
  render shows a keyboard-focus ring on an element that is focused but not selected/active, so the a11y
  floor's "visible focus" can't be confirmed as distinct from "selected" styling from what's here — flagging
  the gap rather than asserting a failure.

- POLISH: the bottom "Evidence pane — other states" appendix and the standalone "QUEUE — EMPTY STATE"
  card function as a state catalog appended to the live page rather than states the page would show one
  at a time. Fine for this exploration, but worth a visual break from the live surface so it isn't
  mistaken for shipped layout if this file is reused directly.

## What is working
The primary object is unambiguous: council verdict + score, the ₹ amount, and the kill-criteria block sit
stacked in the same pane above the action row, with nothing behind a click — a direct, well-executed read
of the assigned thesis. The full state matrix is demonstrated (queue: loading/error/blocked; evidence
pane: empty/loading/error/disabled; done-log: approved/killed), and the kill button names the venture and
states the irreversible consequence directly on itself rather than a bare confirm, matching the content
contract precisely. The error state ("Approve did not record... Retry, or escalate to manual receipt
entry") states what failed and the next step, never the banned phrase. Vocabulary discipline is clean
throughout — venture/phase/receipt/verdict/approval/autonomy, no invented synonyms — and ₹ amounts and
HH:MM IST timestamps are formatted correctly everywhere they appear. No gradient hero, emoji iconography,
or centre-everything layout.
