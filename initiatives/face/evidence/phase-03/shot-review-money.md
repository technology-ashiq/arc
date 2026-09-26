# Design critique — face v2 Phase 03, money ring (eight modules × two moods)

All 40 PNGs were opened and read with vision: the 16 v0.7 canonical baseline shots
(`.playwright-mcp/face-v2-baseline-2026-09-17/.shots/`, `dark-`/`light-` × `money`, `ventures`,
`growth`, `leads`, `legal`, `ops`, `trader`, `discover`), the 16 Phase 03 money-ring candidate
shots (scratchpad `shots-money-3/`, same eight rooms), sha256-pinned by
`initiatives/face/evidence/phase-03/shots-money.json`, and 8 factory-ring candidate shots from
the same scratchpad directory (`dark-`/`light-` × `develop`, `review-ship`, `design-studio`,
`toolbelt`) re-read to close out the factory ring's carried WEAKNESS rows. Each module was read
baseline-then-candidate, dark-then-light. The baseline is used only as the "before" reference
for what a room used to render (its playback/day-speed controls, its simulated council/gate/day
scaffolding) — it is never treated as the standard the candidate is graded against. No dedicated
design brief exists for this ring; the candidate was judged against `initiatives/face/phases/
phase-03-spec.md`'s money-ring contract: real vs. simulated money as two substances never
summed (ADR-1308, ADR-1313), `ops`/`trader`/`discover` planned and dotted with REHEARSAL writes
and never a LIVE pill (ADR-1328, carried F3), `NOT SERVED`/`WORK DOOR · PHASE NN` cards
(ADR-1324, ADR-1326), file-borne kill lines, the reserved-colour palette (amber/green/red/violet,
LIVE resolving to accent teal), and the no-wall-of-refusal-cards rule. Two crops (`dark-ops.png`
card-border detail; `dark-review-ship.png` COMMANDS/AGENTS contrast) were made at 2x from the
same pinned files to confirm what plain-eye viewing suggested — not to measure colour or size,
only to resolve what the un-zoomed render made ambiguous.

## Findings

| module | mood | class | finding |
|---|---|---|---|
| money | dark | none | — |
| money | light | none | — |
| ventures | dark | WEAKNESS | the three "—" stat tiles ("Ventures in the roster", "Kill lines crossed", "Money with no kill line") all carry the identical caption "UNRECEIPTED CRITERIA CHANGE" verbatim, with no per-metric distinction — the reader learns the same fact three times instead of once per tile |
| ventures | light | WEAKNESS | same triple-identical-caption pattern, same three tiles, light mood |
| growth | dark | none | — |
| growth | light | none | — |
| leads | dark | none | — |
| leads | light | none | — |
| legal | dark | none | — |
| legal | light | none | — |
| ops | dark | none | — |
| ops | light | none | — |
| trader | dark | none | — |
| trader | light | none | — |
| discover | dark | none | — |
| discover | light | none | — |

Additional findings, cross-cutting rather than tied to one module:

- WEAKNESS: every one of the 16 money-ring shots (both the three LIVE rooms — growth, leads,
  legal — and the five not-day-scoped ones — money, ventures, ops, trader, discover) renders the
  header's "AS OF" field as the literal format placeholder `dd-mm-yyyy`, never an actual date.
  The LIVE rooms show a calendar icon beside it (implying an active control) and the
  not-day-scoped rooms omit the icon (implying it's inert), which is a legible distinction, but
  in neither case does the field ever resolve to a real value — so "AS OF" reads as dead chrome
  rather than a working timestamp anywhere in the ring.
- POLISH: `legal`'s body is composed entirely of `NOT SERVED` and `WORK DOOR · PHASE 05` cards
  once past the top stat row (four content cards: "The gates", "The five seals", "The publish
  gate", "Hash chain" are all `NOT SERVED`) — each one honestly names its route per ADR-1324, and
  the stat row above it is real (1,000+ notes, 2 lints/gates held, 1 product guarded,
  `CONSTITUTION.md` at 110 lines with its sha256), so this does not cross into "a wall of dashed
  cards with nothing real above the fold." But `legal` is the thinnest room in the ring on real
  substance below the fold, and would be the first room worth re-visiting once `/api/gates` or
  `/api/legal` route reads land.

## Factory ring re-read

- develop's duplicated Phase/Build-Brief sentences — **GONE**. The right-column "Phases" list now
  renders one line per phase ("Phase 00 — Steel thread: the lifecycle runs end-to-end, offline,
  lane-native" · "Phase 01 — The proof floor: a gate that can fail, and a parser that survives
  attack" · etc.), with no second "Build Brief — phase NN" line repeating the same sentence
  underneath. Confirmed in both `dark-develop.png` and `light-develop.png`.
- review-ship's dim AGENTS list — **STILL THERE**. In "What this room holds," the AGENTS row
  (`code-reviewer · qa-tester · security-auditor`) still renders visibly dimmer than the COMMANDS
  list directly above it (`arc-audit · arc-canary · arc-commit (G) · …`), confirmed at 2x crop in
  `dark-review-ship.png`; the same de-emphasis is present in `light-review-ship.png`. Both lists
  are equally real served-registry data, so the weight drop still reads as
  disabled/de-prioritized rather than merely secondary — still a design-lint contrast-floor
  suspicion, not resolved by this ring's work.
- design-studio's truncated "The trail" hint — **GONE**. The sub-heading now reads the complete
  sentence "the oldest 1,000 receipts of its kinds, more past them — the last 8 of that page
  here, not the newest" with no ellipsis or mid-sentence cutoff, in both `dark-design-studio.png`
  and `light-design-studio.png`.
- toolbelt's truncated header LIVE note — **GONE**. The header's third field now reads the
  complete phrase "not day-scoped here" (no ellipsis), replacing the earlier "LIVE  not this
  room — its numbers are …" cutoff; a separate, complete "FACE LANE · LIVE" badge sits at the top
  right instead. Confirmed in both moods.
- design-studio's "NO APPETITE BOUGHT"/"no appetite bought" duplicate — **GONE**. "The lane" card
  now pairs "NO APPETITE BOUGHT" (bold) with "no phase spec written yet" (dim) directly below it
  — different, additive information rather than the same words restated in a second case. Same
  fix present in both moods.

## What is working

The money ring's central thesis — that real and simulated money are different substances that
are never summed or averaged — is carried all the way into the pixels, not just stated in prose.
The `money` room's four lead stat tiles use three distinct non-numeric states (`NEVER` as a word
for a route that has truly never fired, an em-dash for a value the room deliberately declines to
compute because doing so would imply a comparison across substances, and a real `0` only where a
route has actually been read and returned zero) instead of collapsing all three into a
misleading `0`; this is a genuinely careful piece of information design, not just copy. Across
all sixteen shots I did not see money-green used anywhere, which matters precisely because
`revenue.received` has never fired — the palette is honest by omission exactly where the contract
requires it, and violet is reserved for the simulated/rehearsal/planned family consistently. The
three planned rooms (`ops`, `trader`, `discover`) never wear a LIVE pill — confirmed by close crop
on `ops`, which also confirmed the REHEARSAL cards genuinely use a dotted border, matching
ADR-1328's letter and not just its badge text. `leads` is the strongest single room in the ring:
its "80" researched-leads stat and its seven-column funnel table (RESEARCHED/CONTACTED/REPLIED/
MEETING/WON/LOST/SUPPRESSED, each a real receipt count) give the room real substance above the
fold that the rest of the ring has to lean on `NOT SERVED` cards for. Every `NOT SERVED` card
across the ring names its route and gives one honest sentence, consistent with the factory ring's
prior pattern and with ADR-1324's intent.

VIOLATION: 0 · BELOW-BAR: 0 · WEAKNESS: 3 · POLISH: 1

---

# Design critique — face v2 Phase 03, money ring RE-READ (post-fix)

I opened, with vision, all 16 candidate PNGs in `scratchpad/shots-money-5/`
(`dark-`/`light-` × `money`, `ventures`, `growth`, `leads`, `legal`, `ops`, `trader`,
`discover`), sha256-pinned by `initiatives/face/evidence/phase-03/shots-money.json`. For
the ventures stat-tile caption question I opened the matching `dark-ventures.png` in
`scratchpad/shots-money-3/` as the "before" for direct comparison. I also opened
`dark-review-ship.png` in `shots-money-5/`, read `face/src/ui/bits.tsx`'s `Holds`
component in full and `face/src/shell/Dock.tsx` in full, read the prior critique
(`docs/design/critique/2026-09-18-face-v2-phase-03-shot-review-money.md`) and the ring
contract in `initiatives/face/phases/phase-03-spec.md`. No dedicated design brief exists
for this ring; the candidate is judged against the same phase-03 money-ring contract the
first critique used (real vs. simulated money as substances never summed, ADR-1308/1313;
planned rooms dotted + REHEARSAL and never LIVE, ADR-1328/F3; `NOT SERVED` cards named by
route, ADR-1324/1326; the reserved-colour palette; no wall-of-refusal-cards).

## Findings

| module | mood | class | finding |
|---|---|---|---|
| money | dark | none | — |
| money | light | none | — |
| ventures | dark | none | the three stat-tile captions are now distinct — see "first critique's rows" below |
| ventures | light | none | same fix, light mood |
| growth | dark | none | — |
| growth | light | none | — |
| leads | dark | none | — |
| leads | light | none | — |
| legal | dark | POLISH | past the top stat row, all four content cards ("The gates", "The five seals", "The publish gate", "Hash chain") are still `NOT SERVED` — legal remains the thinnest room in the ring on real substance below the fold, unchanged from the first critique |
| legal | light | POLISH | same, light mood |
| ops | dark | none | — |
| ops | light | none | — |
| trader | dark | none | — |
| trader | light | none | — |
| discover | dark | none | — |
| discover | light | none | — |

## The first critique's rows

- WEAKNESS (ventures dark, triple-identical caption) — **RESOLVED**. Comparing
  `shots-money-3/dark-ventures.png` (before) against `shots-money-5/dark-ventures.png`
  (after): before, all three tiles — "Ventures in the roster," "Kill lines crossed,"
  "Money with no kill line" — carried the identical caption "UNRECEIPTED CRITERIA CHANGE."
  After, only "Ventures in the roster" keeps that caption (correctly — that is literally
  the roster's own blocker); "Kill lines crossed" now reads "unread · no distance is drawn
  without the roster" and "Money with no kill line" now reads "unread · no finding is made
  without the roster." Three tiles, three distinct facts.
- WEAKNESS (ventures light, same pattern) — **RESOLVED**. Same distinct captions confirmed
  in `light-ventures.png`.
- WEAKNESS (AS OF renders literal `dd-mm-yyyy` placeholder across all 16 shots) —
  **RESOLVED**. Every one of the 16 money-ring shots now shows a resolved-looking header
  control instead of the placeholder string. The five not-day-scoped rooms (money,
  ventures, ops, trader, discover) show a plain "not day-scoped" chip with no calendar
  icon. The three day-scoped rooms (growth, leads, legal) show a "pick a day" chip
  (dashed/affordance styling) beside a "LIVE" badge. Neither ever again shows the literal
  `dd-mm-yyyy` string; the two states read as distinct and legible, in both moods,
  everywhere I looked.
- POLISH (legal's body is entirely `NOT SERVED`/`WORK DOOR` cards past the top stat row) —
  **STILL THERE**. `dark-legal.png` and `light-legal.png` show the identical four content
  cards from the first critique, unchanged: "The gates" (`NOT SERVED`), "The five seals"
  (`NOT SERVED`), "The publish gate" (`NOT SERVED`), "Hash chain" (`NOT SERVED`), each
  paired with a `WORK DOOR · PHASE 05` card naming its route honestly. The real stat row
  above it (1,000+ notes, 2 lints/gates held, 1 product guarded, `CONSTITUTION.md` at 110
  lines with its sha256) is unchanged too. This was logged as a POLISH item to revisit once
  `/api/gates` or `/api/legal` route reads land — that has not happened in this ring, which
  is expected since new door routes are explicitly out of scope for Phase 03. Not a
  regression; simply not addressed, correctly, because it wasn't this ring's job.

## review-ship AGENTS

Ruling: the dimness is **not the `Holds` component's own styling** — it is the `Dock`'s
fixed bottom-fade overlay sitting over that row's position in the viewport.

What I based this on: `bits.tsx`'s `Holds` component (`face/src/ui/bits.tsx`) renders every
group in its `groups` array through the exact same `.map()` with no per-group branch —
each label gets `color: 'var(--text-3)'` and each items line gets `color: 'var(--text-2)'`,
identically, whether the group is COMMANDS or AGENTS. There is nothing in the component
that could make one group render dimmer than another; both are styled by the same two
lines of JSX.

`Dock.tsx` renders a `fixed bottom-0 right-0 left-0 lg:left-[240px] z-40` container — fixed
to the viewport, not the scrolling content, positioned above room content with no
competing z-index anywhere in `RoomFrame.tsx`. Its inner wrapper (`pb-4 pt-8 px-4`) carries
`background: 'linear-gradient(to top, var(--bg-0) 30%, transparent)'`: solid background
colour for the bottom ~30% of that wrapper's height, fading to fully transparent toward its
top edge. That wrapper's height is built from a chip row (present and taking layout space
even when invisible at `opacity: 0`, since `chipsVisible` only toggles opacity/pointer-events,
not `display`), plus the input pill, plus its own padding — tens of pixels tall, anchored to
the bottom of a `1440×1000` viewport (the capture contract's own declared size, from
`shots-money.json`). In `dark-review-ship.png`, "What this room holds" is the bottom-most
card in its column, and its AGENTS line — `code-reviewer · qa-tester · security-auditor` —
is the very last line in that card, i.e. the line sitting closest to the viewport's bottom
edge, exactly where the Dock's gradient is still partially opaque. COMMANDS sits several
lines higher in the same card, further from that bottom edge and outside (or in the fully
transparent part of) the same gradient. Same room, same component, two groups one card
apart — the only thing that differs between their positions is proximity to the Dock's
fixed overlay. That is a positional/stacking argument from the code, not a colour sample:
I'm not reporting a measured contrast value, I'm reporting that a fixed, semi-opaque layer
sits, by construction, over the lower part of the content column, and the AGENTS line falls
inside that footprint while COMMANDS does not.

Classed WEAKNESS, not VIOLATION: the room's substance (both lists) is untouched and real;
this is a rendering-layer collision, not a broken contract, and the actual dimming amount is
a design-lint contrast question, not mine to number. It also redirects where a fix should
land — this isn't a `bits.tsx` colour problem, it's the `Dock`'s gradient/z-index footprint
over room content, worth trying at a lower viewport-height capture or with the dock's fade
kept clear of the content column before re-treating it as a component bug.

## What is working

The two cross-cutting issues from the first critique are both genuinely fixed, not
half-fixed: the AS OF control now communicates two distinct real states (inert / pick-a-day)
instead of dead placeholder chrome in all sixteen shots, and the ventures stat row now
teaches three separate facts instead of the same sentence three times. Nothing regressed
elsewhere in the ring — the real/simulated palette discipline (no money-green anywhere,
violet reserved for the simulated/rehearsal family), the absence of a LIVE pill on any of
the three planned rooms (ops, trader, discover), and every `NOT SERVED` card naming its
route are all still intact across every shot I opened, in both moods.

VIOLATION: 0 · BELOW-BAR: 0 · WEAKNESS: 1 · POLISH: 2

## Disposition (the ring author, after both reads)

- The two first-read WEAKNESS rows (ventures' repeated caption, the as-of mask) are paid in this PR and ruled RESOLVED by the fresh re-read on `shots-money-5`, the capture `shots-money.json` pins.
- review-ship's AGENTS row: accepted, not a defect. The re-read rules it the dock's fixed bottom gradient, not the kit (`Holds` draws every group in one ink); the page's `main` carries `pb-40` (160 px) against a dock of about 100 px, so every row scrolls clear of the fade, and v0.7's dock draws the same fade. A shot at scroll 0 will always catch whatever row sits in the last 100 px.
- legal's POLISH (thin below the fold): the four cards are NOT SERVED because `/api/gates` and `/api/legal` are Phase 04 routes; the room fills when they land.

Merge verdict: VIOLATION 0 · BELOW-BAR 0 — the ring may merge.
