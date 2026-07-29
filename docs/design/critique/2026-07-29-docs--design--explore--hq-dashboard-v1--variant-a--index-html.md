# Design critique — docs/design/explore/hq-dashboard-v1/variant-a/index.html

- target: `docs/design/explore/hq-dashboard-v1/variant-a/index.html`
- screenshot_sha256: `8d9c1fb1a131b231c9f2371442aeb09669c4d5529adff5e86b73f332bf51dc10`
- viewport: `1440x900@1`
- brief: `docs/design/briefs/docs--strategy--arc-hq-mockup-html/brief.md`

## What I looked at
Round 2 full-page render (taller than the 1440x900 viewport) of the same ARC HQ day surface: header
with keyboard legend, a six-tile KPI row, a seven-row approval inbox (row 3 selected with evidence
expanded, row 4 in an error state, row 5 disabled) with a "done today" log beneath, a right-hand
"today's event timeline" sidebar, and a bottom "state matrix — reference" appendix. Again a single
full-page composite, no scrolled-viewport state captured.

## Round 1 re-verification

- **Timeline wrap VIOLATION — FIXED.** Every entry in "Today's event timeline" (07:58 through 10:09,
  ten entries) now renders on one line each, including the four that previously wrapped (Bhoomi
  Agritech, Arthveda Capital, the sync-delayed line, Trellis Logistics). No wrapped or truncated-looking
  line is visible in the sidebar this round.

- **"Hold" vocabulary WEAKNESS — NOT SUBSTANTIVELY ADDRESSED.** "Hold" is still on screen as a verdict
  value on two rows ("Hold 5.1" on Trellis Logistics, "Hold 6.0" on Arthveda Capital). The stated fix —
  a visually-hidden "Council verdict:" prefix — is a screen-reader-only addition and produces no visible
  change; it also answers a question nobody asked (round 1 never claimed "Hold" was a button label, only
  that it appears as a verdict value outside the declared closed vocabulary). The actual question —
  whether "Hold" is accepted spine vocabulary alongside promote/kill, or an invented third state — is
  still open on the pixels. Keeping this as WEAKNESS, not escalating, because I still can't confirm
  invention vs. legitimate spine value from the render alone.

- **Dim-text contrast WEAKNESS — visually improved, kept open as a suspicion.** The "Stale 41m — spine
  sync failed" caption, the disabled Approve/Reject pair and "Locked — awaiting L2 sign-off" caption on
  Arthveda Capital, and the phase captions under venture names all read legibly now and no longer look
  alarmingly faint. They are still, relatively, the dimmest text on the page — that's a hierarchy
  observation, not a measurement. Per iron law 5 I'm not asserting a pass or fail on the actual contrast
  ratio; hand this to design-lint to confirm the four raised tokens clear the declared floor.

- **Target-size WEAKNESS — partially confirmed, partially unverifiable.** The Retry button on the failed
  NeoKirana row no longer reads as artificially narrow — it looks proportionate to its own label now,
  consistent with the claimed width-cap removal. The evidence receipt-id links and the L0–L3 level badges
  look visually unchanged from round 1 (still compact, still read as lower-priority than the row's primary
  Approve/Reject pair) — which is exactly what you'd expect if the fix added invisible hit-area padding
  rather than changing visible size, so this is consistent with the claimed fix but not something a static
  render can confirm either way. Design-lint should verify the actual target-size numbers before this is
  considered closed.

- **State-matrix appendix POLISH — FIXED.** The appendix now carries a "NOT LIVE DATA" kicker next to its
  heading and every reference card in it uses a dashed border, visibly distinct from the solid-bordered
  live panels above. It now reads unambiguously as a documentation aid, not part of the live surface.

- **Thesis "stays in view" WEAKNESS — still an open gap, unchanged.** This round is again a single
  full-page composite with no scrolled-viewport capture, so whether the KPI row and timeline actually stay
  pinned while the inbox scrolls during a j/k/a/r clear session remains unconfirmed from what I've been
  given. Not blaming the page for this — flagging that the verification gap from round 1 persists.

## Findings

- VIOLATION: no revenue chart, sparkline, or chart-tooltip trigger of any kind appears anywhere on the
  rendered page — checked the KPI row (MRR/Burn/Runway/Approvals Pending/Promoted Today/Active Ventures
  tiles are plain label+number, no chart affordance on any of them) and the rest of the page end to end.
  The brief's interaction model explicitly declares "revenue chart tooltips" as one of three on-demand
  progressive-disclosure surfaces (alongside per-event evidence and autonomy-ladder detail, both of which
  ARE present and working). With no chart present at all, that disclosure surface has nothing to attach
  to — the progressive-disclosure split does not match what's declared.

- WEAKNESS: "Hold" still renders as a verdict value (Trellis Logistics, Arthveda Capital) outside the
  content contract's declared closed vocabulary (approve · reject · promote · kill) — carried over from
  round 1, unresolved in substance; see re-verification above.

- WEAKNESS: the KPI-row/timeline "stays in view" thesis claim is still unconfirmed by any scrolled-state
  evidence — carried over from round 1; see re-verification above.

- WEAKNESS: the dim-text cluster (stale-runway caption, disabled-row controls and lock caption, phase
  captions) still reads as the dimmest content on the page and may sit under the declared contrast floor —
  verify the four raised tokens with design-lint before closing.

- WEAKNESS: evidence receipt-id links and L0–L3 level badges still visually read as smaller/lower-priority
  than the row's primary Approve/Reject controls — verify the actual target-size numbers with design-lint;
  visual size is unchanged from round 1 which is consistent with (but doesn't confirm) a hit-area-only fix.

- WEAKNESS: row 7's action-button pair for Vistara Mobility ("Kill Vistara Mobility — halts funding —
  unrecoverable" stacked over "Reject — keep active") sits noticeably further left and wider than the
  two-button pairs in every other row, and doesn't line up under the "ACTIONS (A/R)" column header the way
  rows 1, 2, 3, 5, and 6 do — breaks the table's column rhythm for this one exception row.

- POLISH: the "PROMOTED TODAY" KPI tile shows both an em-dash value and a "None yet" caption — two ways of
  saying the same empty state on one small tile reads as slightly redundant.

- POLISH: receipt IDs are abbreviated in the inbox's EVIDENCE column ("RCPT-...1187") but shown in full in
  the "Done today" log ("RCPT-20260729-1042") — a minor inconsistency in how the same identifier format is
  presented across the two lists on the same screen.

## What is working
The round-1 VIOLATION (timeline wrap) and the appendix-styling POLISH are both genuinely fixed and confirm
on the pixels — the timeline column now holds ten distinct one-line entries with no wrap, and the state
matrix reads as a clearly separate reference block via its dashed borders and kicker. Beyond the fixes:
the kill-action button on Vistara Mobility still names the venture and states the consequence directly;
the failed NeoKirana row still states what failed, the next step, and a named escalation contact; the
stale Runway tile still greys its value and states staleness instead of a spinner; the selected row's
highlight, left accent, and expanded evidence panel remain a clean, legible visualization of the
keyboard-first model. ₹ amounts use correct Indian digit grouping throughout, timestamps are consistent
HH:MM 24h IST, and no gradient hero, emoji iconography, or centre-everything layout is present anywhere
on the page.
