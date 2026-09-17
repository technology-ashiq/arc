# Design critique — face v2 Phase 03, kernel ring (eight modules × two moods)

All 32 PNGs were opened and read with vision: the 16 v0.7 canonical baseline shots
(`.playwright-mcp/face-v2-baseline-2026-09-17/.shots/`, `dark-`/`light-engine`, `-model-policy`,
`-policy`, `-scheduler`, `-memory`, `-evolve`, `-bench`, `-absorb`) and the 16 Phase 03
kernel-ring candidate shots (scratchpad `shots-kernel-2/`, same eight rooms with
`engine-room` replacing `engine`), sha256-pinned by `shots-kernel.json`. Each module was
read baseline-then-candidate, dark-then-light. The baseline is used only as the "before"
reference for what a room used to render (its API key field, its live buttons, its
simulated data in place of NOT SERVED) — it is never treated as the standard the candidate
is graded against. The candidate was judged against ADR-1324 (NOT SERVED cards), ADR-1326
(WORK DOOR · PHASE 05 cards for the nine named write verbs), ADR-1325 (no provider key in
the engine room), ADR-1308's reserved colour palette, the per-room checklist (instrument
strip, lane card, trail, source-on-disk, "what this room holds"), and scheduler's
Cycle-15 F2 requirement (jobs, next fire, last outcome, heartbeat each shown or NOT SERVED).

## Findings

| module | mood | class | finding |
|---|---|---|---|
| engine-room | dark | none | — |
| engine-room | light | none | — |
| model-policy | dark | none | — |
| model-policy | light | none | — |
| policy | dark | none | — |
| policy | light | none | — |
| scheduler | dark | WEAKNESS | the "SCHEDULER LANE · LIVE" badge (top right) and the "LIVE" word in the first instrument-strip card render as a saturated, filled green — visibly different from the muted teal outline used for "IDLE" states on every other kernel room — worth confirming with design-lint that this is a distinct "liveness" token and not the ADR-1308 real-money green, since a filled treatment alone can make the same hue read more saturated than an outline does |
| scheduler | light | WEAKNESS | same LIVE-badge / LIVE-stat green-fill suspicion as the dark mood, same location, same reasoning |
| memory | dark | none | — |
| memory | light | none | — |
| evolve | dark | none | — |
| evolve | light | none | — |
| bench | dark | WEAKNESS | the "BENCH LANE · LIVE" badge and the "LIVE" instrument-strip word carry the same saturated green-fill treatment as scheduler's LIVE state — same design-lint suspicion, same reasoning |
| bench | light | WEAKNESS | same LIVE-badge / LIVE-stat suspicion in light mood |
| absorb | dark | none | — |
| absorb | light | none | — |

Additional findings, cross-cutting rather than tied to one module:

- WEAKNESS: on every light-mood shot that carries a `NOT SERVED` or `WORK DOOR · PHASE 05`
  pill (model-policy, policy, scheduler, memory, evolve, bench, absorb — engine-room's
  light shot too), the pill reads as pale warm-gray text on a barely-lighter gray fill,
  inside a card that is already near-white with a light dashed border. It stays legible,
  but it sits with visibly thinner separation than the same pill in dark mood, where light
  text on a dark card reads cleanly. Flagging as a suspicion for design-lint's contrast
  check, not as a measured failure.
- POLISH: phase-list rows inside every "The lane" / "Lane phases" card clip mid-word with
  an ellipsis rather than wrapping or breaking at a word boundary — e.g. engine-room's
  "Phase 03 — Dogfood and seal: used for real, and a 4th driver t…" and policy's
  "Phase 03 — Attacker rejections leave a trace; mode-ladder do…". Minor, but every row
  longer than the column reads as cut off rather than summarized.
- POLISH: the receipts trail sits as its own full-width block near the bottom-left in
  engine-room, policy, scheduler and bench, but is folded into the right-hand column
  instead in evolve and absorb — a small rhythm inconsistency in a grid that is otherwise
  identical across all eight rooms.

Gap, not a finding: this shot set captures exactly one state per room (populated,
simulated day 1, sim mode) in two moods. Hover/focus states, motion and reduced-motion
handling, and any empty/loading/error variant of these eight kernel rooms were not part of
the 32 files reviewed here, so the state-matrix and a11y-interaction checks the brief asks
for cannot be answered from these pixels.

## What is working

Every one of the nine write verbs ADR-1326 names — Propose a tier change, Propose a cap /
demote a pair, Declare a subject, Register / Fire / Pause a job, Log a correction, Recall,
Open an experiment, Add a model to the bench, Absorb something — renders as a dashed
`WORK DOOR · PHASE 05` card in all eight rooms and both moods, with zero live buttons left
behind anywhere for any of them; genuine read-only navigation (Ask arc, Scorecards live on
the bench, Tiers → model policy) is correctly kept as a real button instead. That
read/write distinction holds ring-wide, not just in one room. Engine room fully honors
ADR-1325 — no API key field, no model-id field, no Save + test or Remove-key control in
either mood, replaced by a card naming where the key actually lives. Every NOT SERVED card
names its route and gives one honest sentence in a consistent dashed style. And wherever
the old v0.7 lede described a write action ("Paste any model…", "Paste a skill, repo, tool
or technique…"), the candidate rewrote the lede to describe the served read state instead
(bench, absorb) rather than leaving it pointing at a control that no longer exists.
Scheduler specifically answers Cycle 15's F2 in full: jobs are named with real run counts,
next-fire is honestly NOT SERVED, and the heartbeat is both narrated and named NOT SERVED —
nothing the lede promises is silently dropped.

VIOLATION: 0 · BELOW-BAR: 0 · WEAKNESS: 5 · POLISH: 2
