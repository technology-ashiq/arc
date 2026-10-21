# Design critique — face v2 Phase 03, factory ring (five modules × two moods)

All 20 PNGs were opened and read with vision: the 10 v0.7 canonical baseline shots
(`.playwright-mcp/face-v2-baseline-2026-09-17/.shots/`, `dark-`/`light-council`, `-develop`,
`-review-ship`, `-design-studio`, `-toolbelt` — the baseline names the council room `council`
where the candidate names it `council-chamber`; `dark-council.png`/`light-council.png` were
used as that room's baseline pair) and the 10 Phase 03 factory-ring candidate shots
(scratchpad `shots-factory-4/`, `council-chamber`, `develop`, `review-ship`, `design-studio`,
`toolbelt`), sha256-pinned by `initiatives/face/evidence/phase-03/shots-factory.json`. Each
module was read baseline-then-candidate, dark-then-light. The baseline is used only as the
"before" reference for what a room used to render (its playback/day-speed controls, its
simulated council/gate/phase data standing in for real registry content) — it is never
treated as the standard the candidate is graded against. The candidate was judged against
ADR-1324 (`NOT SERVED` cards), ADR-1326 (`WORK DOOR · PHASE 05` cards for the twelve named
write verbs), ADR-1308's reserved-colour palette (amber/green/red/violet, with LIVE resolving
to accent teal, not money-green), ADR-1322 (council in accent + dim, violet only for
non-real), the served-lede/served-heading rule, and the no-lane-card rule for council-chamber
and review-ship.

## Findings

| module | mood | class | finding |
|---|---|---|---|
| council-chamber | dark | none | — |
| council-chamber | light | none | — |
| develop | dark | WEAKNESS | the right-column "Phases" trail repeats itself: phases 01–04 each show a "Phase NN — …" line immediately followed by a "Build Brief — phase NN · …" line carrying the identical sentence verbatim (e.g. "The proof floor: a gate that can fail, and a parser that survives attack" appears twice back to back) — the second line adds no new information in an already-dense, partly below-the-fold list |
| develop | light | WEAKNESS | same duplicate Phase/Build-Brief sentence pairs, same location, light mood |
| review-ship | dark | WEAKNESS | in the right column's "What this room holds" card, the "AGENTS" sub-list (code-reviewer · qa-tester · security-auditor) renders in a visibly dimmer tone than the "COMMANDS" list directly above it, even though both are equally real served-registry data — reads as de-emphasized/disabled rather than merely secondary; suspect it may be under the contrast floor, verify with design-lint |
| review-ship | light | WEAKNESS | same dim-AGENTS-list suspicion, same location; against the white card background the drop in weight from COMMANDS to AGENTS is, if anything, more visible in light mood |
| design-studio | dark | WEAKNESS | the "The trail" sub-heading truncates mid-sentence with a hard ellipsis — "…the last 8 of that page here, not the n…" — inside the frame, not at the screenshot's bottom edge, so real words are being cut rather than simply falling below the fold; the reader cannot tell what the shown 8 are being contrasted against |
| design-studio | light | WEAKNESS | same mid-sentence truncation in "The trail" sub-heading, same wording, light mood |
| toolbelt | dark | WEAKNESS | the header row's "LIVE" annotation truncates mid-sentence with a hard ellipsis — "LIVE  not this room — its numbers are …" — sitting inline in the header bar (not a viewport cutoff), so the qualifier LIVE is presumably making about the toolbelt's counts is left unstated |
| toolbelt | light | WEAKNESS | same header-row truncation, same wording, light mood |

Additional findings, cross-cutting rather than tied to one module:

- WEAKNESS: design-studio's right-column "The lane" card repeats itself the same way develop's
  Phases trail does — "NO APPETITE BOUGHT" (bold) is immediately followed by "no appetite
  bought" (dim, lowercase), the identical words with no added information, in both moods. Taken
  together with develop's Phase-NN/Build-Brief-NN duplication (tabled above), this reads as one
  shared registry-rendering habit — a template calling the same field twice, once styled as a
  label and once as its own sub-line — rather than two unrelated bugs, and is probably worth
  fixing once rather than per room.
- POLISH: council-chamber's head badge states its no-lane status explicitly ("12 SEATS · A
  COMPANY ORGAN, NOT A LANE"); review-ship's badge ("EVERY LANE PASSES THROUGH HERE") implies
  the same status but doesn't say it outright. Both satisfy the contract, but matching
  council-chamber's directness would read as more deliberate across the two no-lane rooms.
- POLISH: review-ship's "Gates" list (7 plain rows) and "What runs it" workflow list sit at the
  same flat visual weight as the surrounding prose panels; some light differentiation (a
  monospace treatment, a subtle divider rhythm) would help the eye separate "a list of names"
  from "a paragraph" in a room that otherwise mixes both freely.

Gap, not a finding: this shot set captures exactly one state per room (populated, sim mode) in
two moods. Hover/focus states, motion and reduced-motion handling, and any empty/loading/error
variant of these five factory rooms were not part of the 20 files reviewed here, so the
state-matrix and a11y-interaction checks a full brief would ask for cannot be answered from
these pixels.

## What is working

The reserved-colour contract holds cleanly across all 10 candidate shots: "Simulated" stays
violet, "1 waiting" stays amber, and every room's LIVE-family badge (council-chamber's "12
SEATS…", develop's "DEVELOP LANE · IDLE", review-ship's "EVERY LANE PASSES THROUGH HERE",
design-studio's "DESIGN LANE · IDLE", toolbelt's "FACE LANE · LIVE") renders in the accent teal
family, never the money-green — no reserved hue is spent on anything outside its class anywhere
in the set. Every `NOT SERVED` and `WORK DOOR · PHASE 05` card is dashed, names its route or
phase, and gives one honest sentence, consistently in both moods across all five rooms; no room
reads as a wall of dashed cards with nothing real above the fold — each has a real stat row plus
at least one real prose or list panel visible without scrolling. council-chamber's twelve seats
(council-advocate through council-verifier) match the "12 Seats" stat exactly with no clipping,
and review-ship's flat, undecorated Gates/workflow lists are the honest choice given the
contract only makes the gate names and CI workflow names real — resisting the temptation to
re-add baseline's fabricated per-gate mode/evidence detail is restraint that carries a thesis,
not timidity. The toolbelt's catalogue (visible commands: arc, arc-absorb, arc-audit, arc-canary
… each paired with its owning room) reads as a usable index rather than a wall, at a comfortable
row density with the room column doing real work.

VIOLATION: 0 · BELOW-BAR: 0 · WEAKNESS: 9 · POLISH: 2
