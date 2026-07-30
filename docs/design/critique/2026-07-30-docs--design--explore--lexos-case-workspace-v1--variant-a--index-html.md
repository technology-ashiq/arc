# Design critique — variant A, LexOS case workspace explore

- target: `docs/design/explore/lexos-case-workspace-v1/variant-a/index.html`
- screenshot_sha256: `b69d9d175785bb0d26449989e4c84e81f5b39306f029a74cd9c1a212174649d3`
- viewport: `1440x900@1`
- brief: `docs/design/briefs/lexos-case-workspace/brief.md`

## What I looked at
Full-page flattened capture at 1440×900, light mode, animations off — the sticky case header +
ledger-jump nav, the four-up Hearings/Documents/Tasks/Notes board, the five-state reference
block, and the printed keyboard legend, top to bottom of the rendered PNG. This is a fresh sweep
against all four contracts, verifying the post-strip render after the `width-note` paragraph and
its two dead CSS rules were removed from the top of the sticky header (screenshot hash moved
`5e4cf063` → `b69d9d17`).

## Findings

- WEAKNESS: the quiet inline "+ File a document / + Add a task / + Add a note" row-links and the
  "Retry" links inside each error-state card read as slim single-line text controls, visually
  shorter than the primary/secondary buttons elsewhere on the page — they may fall under the
  brief's 44px target-size floor. Suspicion only, not a measured claim — verify with design-lint.
- POLISH: the "Reference — the five states" block's framing prose ("illustrated here rather than
  duplicated live… rather than invented") reads as internal design-process narration rather than
  either the case record's court-record voice or plain documentation copy — worth a tighter,
  less self-referential rewrite given this page is headed to a blind panel outside arc, in the
  same spirit as the width-note removal that prompted this pass.

## What is working

The deletion left no visible seam. The H1 is now the literal first element under the sticky
header's own padding; the two identity lines and the status/next-hearing/overdue trio below it
keep the same tight, even rhythm they had before; and nothing downstream — tab rail, four-card
board, reference block, keyboard legend — shows a stretched gap, a doubled rule, or a collapsed
margin where the paragraph used to sit. I checked the current markup directly: `case-title-row`
is the first child inside `case-header-inner`, with no orphaned wrapper left behind.

Case identity is complete and untruncated — full party names ("Meera Raghunathan v. Sunvale
Housing Pvt. Ltd."), O.S. number, court, case type, client name, and claim amount all render in
full. The always-visible quartet (identity, status, next hearing, overdue count) is intact and
reads first, matching the interaction-model contract — status is "Active" via a labelled badge,
next hearing shows the explicit empty value "Not set" rather than being omitted, and overdue "2"
sits under its own "OVERDUE" text label so colour is reinforcement, not the sole carrier.

Content contract holds throughout: statuses render as title-case labels (Active, Intake, On
hold) never a raw enum; currency uses Indian digit grouping (₹18,45,000); dates match the
declared `27 Jul 2026` format; row separators use `·` consistently, including the documents row
the brief flagged as inconsistent in the shipped build; verbs used ("Add hearing," "File
document," "Add task," "Add note") are all in the brief's shipped-verb list. No drop shadows, no
gradient hero, no emoji iconography, no centred dashed empty states, no lorem ipsum, no invented
court vocabulary — the flat, hairline-bordered, unhurried system the brief describes is intact.

I did not observe a violation of the interaction model, art direction, platform contract, or
content contract anywhere on this render. Two platform-contract surfaces — mobile, and any
behaviour that only shows at scroll time or on focus/interaction (live stickiness,
`:focus-visible`, reduced-motion) — are declared but not observable from this single flattened
desktop capture. That is a run gap, not a pass or a fail, and is not counted as a finding.
