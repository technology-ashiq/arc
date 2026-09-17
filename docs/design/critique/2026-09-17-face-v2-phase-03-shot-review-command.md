# Design critique — face v2 Phase 03, command ring (six modules × two moods)

Compared the six command-ring modules (today, inbox, map, spine, board, ask-arc) in both
dark and light mood, baseline (v0.7 canonical, ADR-1318) against candidate (real fixture
spine through the door, sim mode), at 1440×1000 / dpr 1 / Chrome 152.0.7977.83. All 24 PNGs
were opened and read with vision — 12 baseline + 12 candidate — before writing this file.
Static screenshots do not show hover/focus states or motion, so visible-focus and
reduced-motion (Contract B a11y floor) were not assessable from this evidence and are
reported here as a gap, not a finding.

## Findings

| module | mood | class | finding |
|---|---|---|---|
| today | dark | POLISH | the header's "AS OF" date field permanently shows its own format hint (`dd-mm-yyyy`) next to a calendar icon and "LIVE" even while live — top of the page, every load — reading as an unfilled input parked in the chrome rather than a live date |
| today | light | POLISH | same "AS OF" placeholder-as-content pattern as dark (see above); no additional issue found in light mode |
| inbox | dark | VIOLATION | the Waiting card's two stamp buttons ("Arm · approve" filled green, "Arm · reject" outlined red) spend the reserved real-money green and incident red on a generic approve/reject affordance that is neither money nor an incident — breaks the reserved-colour law (ADR-1308); this is delta #4 (buttons replacing keyboard hints) executed with a colour choice the delta never called for |
| inbox | light | VIOLATION | same green "Arm · approve" / red "Arm · reject" buttons, same reserved-colour misuse, confirmed in light mode |
| map | dark | none | reserved-colour delta correctly executed (money-ring green and company-ring violet accents removed, as declared) with no clipping, overlap, or missing element found |
| map | light | none | same clean read as dark |
| spine | dark | WEAKNESS | the log's default "all kinds" view is dominated by roughly ten consecutive, visually identical `note.logged · arc · gen-spine` rows before any other kind appears — undercuts the panel's own "6 kind families, reserved meanings, one ink each" pitch by showing no visible variety in the fold a first-time viewer actually sees |
| spine | light | WEAKNESS | same repetitive-row issue as dark; the log's first screenful reads monotone rather than demonstrating the closed vocabulary |
| board | dark | VIOLATION | the Lanes panel's baseline had four controls — `sort · ring`, `sort · burn`, `sort · status`, and a distinctly-styled `The roster → org` link — the candidate ships only the three sort controls; the roster→org navigation affordance is gone with no declared reason among the five deltas |
| board | light | VIOLATION | same missing `The roster → org` button, confirmed in light mode |
| ask-arc | dark | none | structure, panels (Ask / Answers / No hands / The reader / chat-mcp), and chip-question layout all match the baseline's shape; disabled "Ask →" state reads correctly for an empty question |
| ask-arc | light | none | same clean read as dark |

Additional findings beyond the row's primary, by module/mood:

- **today (dark & light):** the hero copy dropped the owner's name — baseline's "Good
  morning, Ashiq." became "The company ran all night. Here is what it did." This isn't
  among the five declared deltas; it reads as a defensible copy choice, not a defect, but
  it is a loss of the one personalized touch the baseline had, worth a POLISH note.
- **today (light):** the NOT SERVED cards (Policy, Learned this week) use a muted
  grey-on-white label for "NOT SERVED · GET /api/…" that looks like the dimmest text on
  the card — suspected AA contrast risk, not measured; hand to design-lint.

## What is working

The candidate holds the baseline's grid and rhythm faithfully across all six modules and
both moods — no clipping, no overlap, no placeholder/lorem-ipsum copy anywhere in 24
screens. The NOT SERVED cards (today's Policy and Learned-this-week, ask-arc's fully-served
panels needing none) are drawn cleanly and consistently, with a dashed border and one honest
sentence that reads as a deliberate design language rather than an error state. The board and
map most cleanly execute the reserved-colour delta: burn bars are uniformly blue with the
risk signal preserved in text ("AT THE LINE" / "X.Xd left") rather than color, and the map's
former green money-ring and violet company-ring decorative accents are gone exactly as
declared, without losing any station or lane from the visible structure.

VIOLATION: 4 · BELOW-BAR: 0 · WEAKNESS: 2 · POLISH: 2

## Re-verification (shots-command-3)

Re-opened the four baseline PNGs (unchanged) and the four new candidate PNGs for inbox and
board, both moods, same capture contract (1440x1000, dpr 1, Chrome 152.0.7977.83), and
judged only whether the described fix landed and whether it introduced anything new.

| module | mood | new class | what I saw |
|---|---|---|---|
| inbox | dark | none | the Waiting card's stamp controls no longer spend reserved colour: "Arm · approve" is now a plain light/solid button and "Arm · reject" a plain outlined button, both in the neutral ink used elsewhere in the shell — no green, no red anywhere on the card. The card's left edge still carries an amber accent, which is the correct reserved use (needs-you). Fix landed clean; no new clipping, overlap, or contrast concern introduced. |
| inbox | light | none | same fix confirmed in light mode: "Arm · approve" renders as a solid dark/ink primary button, "Arm · reject" as a plain outlined button — neither reads as green or red. Layout and spacing match the dark version and the baseline's card shape. No new issue. |
| board | dark | none | the Lanes panel header now carries all four baseline controls — `sort · board order`, `sort · burn`, `sort · status`, and `The roster → org` — in the same position and style as the baseline's `sort · ring` / `sort · burn` / `sort · status` / `The roster → org` row. The restored fourth button does not crowd or misalign the other three. Fix landed clean. |
| board | light | none | same four-button row confirmed in light mode, matching the baseline's spacing and alignment; no new defect from the restored button. |

RE-VERIFIED: VIOLATION: 0 · BELOW-BAR: 0
