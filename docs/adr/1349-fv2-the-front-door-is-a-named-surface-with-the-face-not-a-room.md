# ADR 1349 — FV2-Q: the front door is a named surface that carries the face, not a room

**Status:** accepted (the owner chose option A, the hero, on 2026-09-30 during `/arc-resume --lane face`; option B stays his next question)
**Date:** 2026-09-30
**Product:** face
**Reversibility:** two-way
**Revisit trigger:** the owner reads the front door beside his design and asks for the story sections under it (the faithful landing), or finds the warp or the face's presence wrong. Then the faithful landing is its own REQ and phase, not an edit of this one.
**Amends:** the Phase 02 ruling of 2026-09-17 (face v2 debt ledger, "the face stage renders behind the rooms in the dark mood only"), which unmounted `FaceStage.tsx` because "the product has no front door". ADR-1306 and ADR-1321 stand: a room is still a served id.

## Context

The owner's design has two surfaces. His own `CHANGES-v0.5.6.md` names them: "the front door glows, the workroom stays easy on the eyes." The front door is the Landing: the neon particle face at full presence, a message beside it, and an ENTER HQ control that fires a camera warp into the workroom. The workroom is a clean room with no face. His `App.jsx` says so in a comment: "the HQ is a clean room, the face belongs to the front door."

The v2 plan ported the workroom only: 36 modules, the rail, the header, the palette, the dock. It never listed the front door as a deliverable. No REQ names it, and the tokens line says only that the landing root is "untouched". On 2026-09-17 a session read v0.7's `App.jsx`, took "the product has no front door" as a fact about the product, unmounted `FaceStage.tsx` in both moods and kept it guarded and unused. It recorded that as a paid debt row. **It never asked the owner**, and he did not see the face again until he looked at home on 2026-09-30 and it was gone. That is a scope decision made silently, and this ADR replaces it with one the owner makes.

The size matters for the choice. The design's Landing is not only the face:

| Piece | Lines in the design bundle |
|---|---|
| `hq/Landing.jsx` (hero, nav, sections) | 552 |
| `sections/S1..S6` (the face of arc, products, commands, agents, loop, footer) | about 1,270 (S1 alone 813) |
| `chapters/C01..C09` (idea, OS, factory, spine, council, HQ, ventures, roadmap, law) | about 1,400 |
| spine store and derive (the live panels) | 450 |
| `FaceStage` (already ported, guarded) | 692 |

## Decision

1. **The front door is a surface, not a room.** It is not in the served registry and not a module. The rule "the served registry is the only room list" (ADR-1306, ADR-1321) is unchanged. The front door is named once, in the contract, as a surface with an exemption row of its own, so `face-coverage` still checks both directions and a second unnamed surface still fails.
2. **Option A, chosen for this change: the hero.** `/` (no hash) renders the front door: `FaceStage` mounted at full presence on the neon ground, a one-line message, and one ENTER HQ control (pointer and keyboard) that fires the stage warp and switches to the workroom (`#hq`). The workroom never mounts the stage, in either mood, as the design has it. If WebGL is unavailable the front door shows a visible fallback and ENTER HQ still works: the guard the debt ledger asked for. The palette (⌘K) works on the front door, as in the design.
3. **Option B, not in this change: the faithful landing** (the sections and chapters and their live spine panels). About 2,700 lines of design JSX and a live read of the spine; measured only by line count, so an effort of 5 to 8 days is a guess and not a number. It would be its own REQ, its own phase and its own owner decision after he has seen the hero.
4. **Both moods are settled by the design:** the front door has one look, the neon dark identity (`#00ffd1` family on black); the light mood is a workroom mood only. The colour-literal lint learns the front door: it reads `face/src/face` and the front-door directory, with the neon palette allowed by name in one file, which pays the ledger row that says the lint does not read them.
5. **Order:** this lands before Phase 08, because the two dogfood days are on "the final surface" and the front door is the first thing the owner sees on it.

## Consequences

- One new REQ (REQ-13), one new phase (09, before 08), 1.5 days added to the cycle (31.5 to 33).
- `FaceStage.tsx` is mounted again, in one place, and only on the front door. The debt row for the stage is re-opened as paid a second time.
- Option B stays visible as the next question. It is not hidden inside this one, and it is not started without the owner's word.
- **Risk:** the warp and the particle stage are the heaviest code in the face and the CI browser harness runs on every leg. The smoke opens `/` and `#hq` on each leg, and a stage that throws must not take the workroom down with it.
- **What the owner sees:** the face at the door, one button, the workroom behind it. He does not get the story pages under the face until he asks for them.
