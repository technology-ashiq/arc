# Design critique — docs/design/explore/hq-dashboard-v1/variant-c/index.html

- target: `docs/design/explore/hq-dashboard-v1/variant-c/index.html`
- screenshot_sha256: `d95fa17b829acc190d34b1917c746748e4d5742ffe0c8447945a3eec48e1ff23`
- viewport: `1440x900@1`
- brief: `docs/design/briefs/docs--strategy--arc-hq-mockup-html/brief.md`

## What I looked at
Full-page render (taller than the 1440x900 viewport) of a single-column dark dashboard: header with keyboard-shortcut legend, an orange "position in the day" banner, a chronological "TODAY — IN ORDER" event list that switches to a "SINCE YOU LEFT — NEWEST FIRST" list past the resume point, then a locked "LATER TODAY — NOT YET DISCLOSED" list, plus a right-hand "Skim mode" undecided-only index and a state-matrix legend.

## Findings

- VIOLATION: no KPI row anywhere on the page — no MRR/burn/portfolio-level numbers surface at all, only a beat-count summary ("10 beats today — 2 settled, 5 undecided, 3 not yet disclosed") — top of page, below the header — breaks Interaction Model contract A5, which declares the KPI row as always-visible alongside the timeline and the approval surface.
- VIOLATION: the page's own vocabulary invents "beat" as the unit of the timeline ("Position in the day: beat 3 of 10", "10 beats today", "Beats logged after 09:02") everywhere the brief's own interaction-model prose already uses "event" ("today's event timeline", "per-event evidence") — banner text, section stat line, and the "SINCE YOU LEFT" subheading — breaks the Content Contract's rule that an invented label where a domain term already exists is a violation.
- VIOLATION: content-density rule "one line per timeline event" is not met — nearly every event row (07:40 Kadamba Foods, 09:02 NeoKirana, 12:00 Aharam Meals, 11:15 Dilli Dosa Co, 10:30 Chai Point Express, 09:47 Bombay Bites) wraps its verdict/kill-criteria clause across two to three stacked lines instead of one — main timeline rows — breaks the Content Contract's declared density rule.
- WEAKNESS: settled events (07:40 Kadamba Foods, 08:15 Suvidha Grocers) render at the same visual weight and same multi-line density as the still-open cards, rather than the "collapses into the done log" treatment the brief describes for success — main timeline, top two rows — this flattens the priority signal the thesis depends on (what still needs the operator's eyes vs. what is already closed).
- WEAKNESS: the 09:02 NeoKirana row's own badge reads "UNRESOLVED" while the page's own bottom caption ("State matrix — day surface: ... error at 09:02 ...") names the identical state "error" — same event, two different state words on the same screen — a small but real vocabulary-consistency gap worth tightening.
- WEAKNESS: the secondary metadata text (phase/autonomy-level clauses, the right-panel "STATE MATRIX — SKIM SURFACE" captions) reads as noticeably dimmer than the body copy and may sit close to or under the brief's declared 4.5:1 contrast floor — suspected only, hand to design-lint to confirm the actual values before treating as settled.
- POLISH: the "TODAY — IN ORDER" heading covers only the first three (already-decided-or-current) rows before the list switches to a differently-ordered "SINCE YOU LEFT — NEWEST FIRST" section under a new heading — defensible given the return-state contract, but on first read the page doesn't stay "in order" for its full length, which the heading doesn't signal.

## What is working
The failure state is a genuine, faithful build of the brief's spec: the NeoKirana card stays in place, states exactly what failed and the two next steps ("Retry the capture, or mark it settled manually"), and its primary action carries a visible focus ring. The kill action names the venture and its irreversible consequence directly on the button rather than a bare "Confirm." Most importantly, the thesis is actually embodied: every decision's verdict, kill-criteria state, and amount live on the timeline row that produced it, actions sit inline, and the right-hand "Skim" panel is a navigation index with no action buttons of its own — not a second decision surface duplicating the same cards. The return-after-interruption state ("SINCE YOU LEFT — NEWEST FIRST" with nothing lost) is rendered, not just described. No slop-kill-list items (gradients, emoji icons, centered layout, equal-column feature rows) are present.
