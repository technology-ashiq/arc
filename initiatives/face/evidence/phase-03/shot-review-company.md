# Design critique — face v2 Phase 03, company ring (nine modules × two moods)

All 36 PNGs were opened and read with vision: the 18 v0.7 canonical baseline shots
(`.playwright-mcp/face-v2-baseline-2026-09-17/.shots/`, `dark-`/`light-` × `law`, `learn`,
`strategy`, `org`, `concepts`, `story`, `factory`, `executor`, `agents`) and the 18 Phase 03
company-ring candidate shots (scratchpad `shots-company-2/`, same nine rooms), sha256-pinned
by `initiatives/face/evidence/phase-03/shots-company.json`. Each module was read
baseline-then-candidate, dark-then-light. The baseline is used only as the "before" reference
for what a room used to render (its simulated council/juror scoreboards, its static factory
roadmap) — it is never treated as the standard the candidate is graded against. No dedicated
design brief exists for this ring; the candidate was judged against `initiatives/face/phases/
phase-03-spec.md`'s company-ring contract: `law`/`story`/`concepts` drawing real content from
the document the door serves (`CONSTITUTION.md`, `docs/HISTORY.md`, the contract's
`expected-set.json` glossary) rather than a wall of `NOT SERVED`; the carried F1 finding
(org's ADR band map naming lanes, never room names); `executor`/`agents` wearing a
not-in-registry badge and never violet, while `story`/`factory` now render as fully served
rooms (ADR-1327/ADR-1337); `NOT SERVED`/`WORK DOOR · PHASE 05` cards naming their route with
one honest sentence (ADR-1324/1326); and the reserved-colour palette (amber/green/red/violet,
LIVE resolving to accent teal).

## Findings

| module | mood | class | finding |
|---|---|---|---|
| law | dark | none | — |
| law | light | none | — |
| learn | dark | none | — |
| learn | light | none | — |
| strategy | dark | WEAKNESS | the "Plans" card's hint line reads "live = initiatives/<lane>/PLAN.md · history = the design-source plans and…" — the dangling "and…" before the tab row reads as a clause cut off mid-thought, not a deliberate list-continuation ellipsis |
| strategy | light | WEAKNESS | same dangling "…and…" in the Plans hint, light mood |
| org | dark | WEAKNESS | in the ADR bands panel, the "0200-0299 engine" row ends "0207 was written by me…" — the trailing ellipsis after a complete clause reads as an unfinished aside rather than a deliberate stylistic trail-off; worth a second look even though it may be intentional voice |
| org | light | WEAKNESS | same "…written by me…" line, light mood |
| concepts | dark | none | — |
| concepts | light | none | — |
| story | dark | none | — |
| story | light | none | — |
| factory | dark | none | — |
| factory | light | none | — |
| executor | dark | WEAKNESS | the "Name / runtime" field's placeholder text is clipped mid-word inside the input box — "e.g. hermes-agent · codex-cli · aider · a per" — with no ellipsis rendered, so the cut reads as a rendering clip, not an intentional shortened example list |
| executor | light | WEAKNESS | identical clipped placeholder, light mood |
| agents | dark | none | — |
| agents | light | none | — |

Additional findings, cross-cutting rather than tied to one module:

- WEAKNESS: the "REPO FACT" badge (seen on `org`'s lane rows and `executor`'s team rows) renders
  in what reads as the same violet/purple family as the header's "Simulated" indicator dot —
  visually suspicious because the badge is asserting the opposite of what violet is reserved
  for here (ADR-1308/1322: violet = the non-real/simulated/rehearsal/planned family alone;
  "REPO FACT" is asserting this line is real, sourced straight from a file). Not measured, not
  a confirmed colour match — flagging as a suspicion for `design-lint` to resolve with an actual
  token/hex read, since if it is genuinely the reserved violet, it is a semantic collision the
  eye keeps tripping on.
- POLISH: `executor` is the most `NOT SERVED`/`WORK DOOR`-dense room in the ring — six of its
  nine cards are dashed — but "The terms of a hire," "Where the hires are written," and
  "Employees" keep real, substantive prose above and alongside the fold, so it does not cross
  into a wall of refusal cards; it would be the first room worth revisiting once `/api/roster`
  lands.
- F1 (carried, ADR band map must name the lane, never a room) reads CLOSED in this ring: every
  band row visible in `org`'s "ADR bands" panel names a lane — `develop`, `engine`, `evolve`,
  `leads`, `policy`, `absorb` — plus the pre-portfolio root grouping "company / core / hq"; no
  row names a room (no "Toolbelt", "Money" or "Board" anywhere in the panel), confirmed in both
  `dark-org.png` and `light-org.png`.
- Gap: the harness's shot script captures one steady-state render per room per mood; no
  loading, error, or disabled-state screenshot was available for any of the nine modules, so
  the art-direction contract's full state matrix is not assessable from this shot set and is
  not scored here one way or the other.

## What is working

The ring's central discipline — that a room either draws real prose from the document the
door actually serves, or says so and stops — is carried through with unusual care. `law` pulls
its three eternal articles and ten working articles verbatim from the constitution with a real
stat row (3 eternal, 10 working, v1.0, 0 adoption receipts); `story` pulls its chapter list
straight from `docs/HISTORY.md` with real cycle numbers, dates, and burn percentages instead
of the baseline's simulated juror scoreboard; `concepts` pulls its 109-term, 28-room, 90-station
counts from `initiatives/face/contracts/expected-set.json` with a `0` unhomed count that is
plainly real rather than a hopeful default. None of the three reads as a wall of `NOT SERVED` —
each has substantial real content above the fold before any dashed card appears. `executor` and
`agents` both correctly wear a plain, uncoloured "not in arc's registry · ADR-1327" badge with
no violet tint anywhere on the badge itself, in both moods — exactly the distinction the
contract asks the ring to hold against `story` and `factory`, which now render as fully served
rooms with a teal-accent LIVE badge instead. `agents`' roster card is the strongest single room
in the ring: a full, real, room-grouped chip list (Develop, Review & Ship, Lane room, Council
chamber, Design studio) with only two dashed cards in the whole layout. The careful use of an
em-dash for a value a room has decided not to fabricate (`executor`'s "— Contractors on tenure",
`learn`'s "— Playbook rules") continues the money ring's honest-by-omission pattern rather than
resetting it back to a misleading `0`.

VIOLATION: 0 · BELOW-BAR: 0 · WEAKNESS: 7 · POLISH: 1

---

# Design critique — face v2 Phase 03, company ring (RE-READ)

All 18 Phase 03 company-ring **candidate** shots were opened and read with vision, from
`shots-company-3/` (`dark-`/`light-` × `law`, `learn`, `strategy`, `org`, `concepts`, `story`,
`factory`, `executor`, `agents`), and each file's sha256 was independently recomputed and
verified byte-for-byte against `initiatives/face/evidence/phase-03/shots-company.json` before
judging it — all 18 matched. No baseline shot was opened for this re-read: this pass exists
specifically to catch findings that were carried from `.playwright-mcp/…/baseline-…/.shots/`
into the first critique, so nothing here is sourced from that directory. Every finding below
names the exact candidate file it was seen in. Judged against `initiatives/face/phases/
phase-03-spec.md`'s company-ring contract (law/story/concepts drawing real served content
instead of a wall of `NOT SERVED`; F1 — org's ADR bands naming lanes, never rooms;
executor/agents wearing a not-in-registry badge with no violet; story/factory rendering as
fully served rooms; NOT SERVED/WORK DOOR cards naming their route with one honest sentence;
reserved-colour palette) — no dedicated design brief exists for this ring.

## Findings

| module | mood | class | finding |
|---|---|---|---|
| law | dark | none | — |
| law | light | none | — |
| learn | dark | none | — |
| learn | light | none | — |
| strategy | dark | none | — |
| strategy | light | none | — |
| org | dark | none | — |
| org | light | none | — |
| concepts | dark | none | — |
| concepts | light | none | — |
| story | dark | none | — |
| story | light | none | — |
| factory | dark | none | — |
| factory | light | none | — |
| executor | dark | POLISH | `dark-executor.png` — of the nine cards on the room ("The terms of a hire", "Hires on the books", "Hire someone", "Dispatch a task", "Terminate a hire", "Where the hires are written", "Employees", "Certification", "Runs"), six carry a `NOT SERVED`/`WORK DOOR · PHASE 05` dashed treatment and three ("The terms of a hire", "Where the hires are written", "Employees") hold real prose; still the ring's most refusal-dense room, worth a first look once `/api/roster` lands |
| executor | light | POLISH | `light-executor.png` — identical nine-card, six-dashed/three-real split, same candidate note as dark |
| agents | dark | none | — |
| agents | light | none | — |

No new VIOLATION, BELOW-BAR, or WEAKNESS was found anywhere in the 18 candidates. No `REPO
FACT` badge, no dangling mid-clause ellipsis, and no clipped input placeholder was visible in
any of the 9 rooms × 2 moods opened for this re-read (see ruling below on where those strings
actually lived).

## The first critique's rows

The first critique (`2026-09-18-face-v2-phase-03-shot-review-company.md`) carried seven
WEAKNESS rows and one POLISH row. Each is ruled against the candidate named, not the baseline:

1. **WEAKNESS — strategy/dark — dangling "…and…" in the Plans hint.** NOT PRESENT.
   `dark-strategy.png`'s "Live plans" card subtitle reads "initiatives/<lane>/PLAN.md · one
   per lane, from the board" — no "live = … history = the design-source plans and…" string
   anywhere on the room. The quoted text does not exist in this candidate.
2. **WEAKNESS — strategy/light — same dangling "…and…".** NOT PRESENT. Checked
   `light-strategy.png`; identical "Live plans" card, same absence.
3. **WEAKNESS — org/dark — ADR band row ending "0207 was written by me…".** NOT PRESENT.
   `dark-org.png`'s "ADR bands" panel rows read "0001-0099 company / core / hq — model-policy's
   Cycle 5 holds 0063-0071 inside this range", "0100-0199 develop", "0200-0299 engine —
   claimed 2026-08-03 · 0200-0219 taken", "0300-0399 evolve — claimed 2026-08-03 · 0300-0310
   taken", "0400-0499 leads — claimed 2026-08-04 · 0400-0413 taken", "0500-0599 policy —
   claimed 2026-08-06 · 0500-0508 taken" (the row after that is cut by the viewport, not by a
   clipped sentence). No "0207 was written by me" text appears anywhere on the panel.
4. **WEAKNESS — org/light — same "…written by me…" line.** NOT PRESENT. Checked
   `light-org.png`; identical panel, same absence.
5. **WEAKNESS — executor/dark — clipped "Name / runtime" placeholder.** NOT PRESENT.
   `dark-executor.png` has no text input field anywhere on the room at all — the layout is
   nine narrative/NOT-SERVED cards ("The terms of a hire", "Hires on the books", "Hire
   someone", "Dispatch a task", "Terminate a hire", "Where the hires are written",
   "Employees", "Certification", "Runs"). No "Name / runtime" field, no placeholder text, no
   clip.
6. **WEAKNESS — executor/light — identical clipped placeholder.** NOT PRESENT. Checked
   `light-executor.png`; same nine cards, no input field.
7. **WEAKNESS — cross-cutting — "REPO FACT" badge in the violet/purple family.** NOT PRESENT.
   Checked `dark-org.png` / `light-org.png` (the cited "lane rows") and `dark-executor.png` /
   `light-executor.png` (the cited "team rows"): every badge visible on these four candidates
   is either the plain grey `NOT SERVED` / `WORK DOOR · PHASE 05` / "not in arc's registry ·
   ADR-1327" style, or the teal-accent `LIVE`. No badge reading "REPO FACT" exists on any of
   the 18 candidates opened for this re-read.
8. **POLISH — executor — "six of its nine cards are dashed… three keep real prose".**
   PRESENT. Checked `dark-executor.png` and `light-executor.png`: the room still has exactly
   nine cards in the same layout, six wearing `NOT SERVED`/`WORK DOOR · PHASE 05` dashing
   ("Hires on the books", "Hire someone", "Dispatch a task", "Terminate a hire",
   "Certification", "Runs") and three holding substantive, non-dashed prose ("The terms of a
   hire", "Where the hires are written", "Employees") — the observation still accurately
   describes the candidate.

## What is working

`law`, `story`, and `concepts` each carry real served content above the fold with no wall of
refusal cards: `dark-law.png`/`light-law.png` pulls three eternal and ten working articles
verbatim with a real `3 / 10 / v1.0 / 0` stat row; `dark-story.png`/`light-story.png` pulls its
chapter list straight from the logbook with real cycle numbers, burn percentages, and a
verbatim stat line; `dark-concepts.png`/`light-concepts.png` shows real `109 / 27 / 90 / 8`
counts with an "Unhomed" list of exactly 8 named terms matching the stat. F1 reads closed in
both `dark-org.png` and `light-org.png`: every "ADR bands" row names a lane (`develop`,
`engine`, `evolve`, `leads`, `policy`) or the pre-portfolio "company / core / hq" grouping,
never a room. `dark-executor.png`/`light-executor.png` and `dark-agents.png`/`light-agents.png`
both wear a plain, uncoloured "not in arc's registry · ADR-1327" badge with no violet
anywhere, while `dark-factory.png`/`light-factory.png` and the story room now show a
teal-accent `LIVE`/served treatment instead. `agents`' roster card
(`dark-agents.png`/`light-agents.png`) is a full, real, room-grouped chip list (Develop,
Review & Ship, Lane room, Council chamber, Design studio) with only one dashed card on the
whole room. Most importantly for this re-read: none of the seven fabricated/clipped strings
the first critique quoted from the baseline are reachable in these candidates — the ring
author's fix genuinely removed them rather than leaving them present under a different crop.

VIOLATION: 0 · BELOW-BAR: 0 · WEAKNESS: 0 · POLISH: 1

## Disposition (the ring author, after both reads)

- The first read's seven WEAKNESS rows quoted v0.7 baseline pixels, not candidates: a `Name / runtime` input, a `REPO FACT` badge, a Plans hint ending "…history = the design-source plans and…", and an ADR band note "0207 was written by me…". The author checked each against the candidate crops (strategy's hint reads "initiatives/<lane>/PLAN.md · one per lane, from the board"; executor draws no input; org's engine row reads "claimed 2026-08-03 · 0200–0219 taken"), and the fresh re-read -- told to quote only what it can see in a named candidate file -- ruled all of them NOT PRESENT.
- Between the two reads the ring was changed by its attackers' 23 fixes and re-captured (`shots-company-3`, which `shots-company.json` pins); the re-read judged those pixels.
- The one POLISH (executor is the most NOT SERVED-dense room: six of nine cards) stands: the hires, certification and runs are what `/api/roster` will fold in Phase 04, and the room carries real content above the fold (the employees, the terms of a hire, the router file's provenance).

Merge verdict: VIOLATION 0 · BELOW-BAR 0 — the ring may merge.
