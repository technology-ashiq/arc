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
