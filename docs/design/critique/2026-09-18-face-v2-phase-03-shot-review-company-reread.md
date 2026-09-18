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
