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
