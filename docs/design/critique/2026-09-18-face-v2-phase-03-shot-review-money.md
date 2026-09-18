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
