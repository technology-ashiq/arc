# ADR 1348 — FV2: the Reference room draws the owner's page shape, with its own flow and loop diagrams

**Status:** proposed (the owner's `/arc-change --lane face` of 2026-09-27, second pass)
**Date:** 2026-09-27
**Product:** face
**Reversibility:** two-way
**Revisit trigger:** a page needs a diagram that neither the flow nor the loop layout can draw. Then a third layout
is a new decision, and it is not added quietly to the component.
**Amends:** ADR-1347 §2 (rich markdown rendering). ADR-1346 and the rest of ADR-1347 stand.

## Context

Slice 3 of Phase 07 (#299) shipped 34 narratives that passed every gate. The owner read them in the room and
rejected them. The pages are unreadable. They are not what he asked for. They cost 40% of a week's tokens.

He had asked for pages like `arc-wiki-engine_1.html`, which he calls "product page shape v1". Reading that file
side by side with what shipped shows three differences. Markdown rendering closes none of them:

1. **A design system.** That page is built from about ten parts: masthead chips, a left nav, an "In one line" lede,
   panels (plain and warning), a numbered step pipeline (plain words, then code, then file), captioned figures, a
   rosetta table, stat boxes, pills and a glossary. Markdown has headings, lists and tables. That is all it has.
2. **Diagrams.** Figure 1 is a flow. Boxes run left to right, with a label on every arrow. A refusal box hangs
   under each step. A dashed money line splits "free to refuse" from "money is spent". Figure 2 is a loop. Stages
   run to a fork, and a dashed arrow goes back. The room draws no picture.
3. **Generated vs narrative.** Every section is labelled. It is either rebuilt from source (header chips, drivers,
   rota, processes, stations, exit codes, ADRs, gates, lane status, not-claimed, drift check, sources) or written
   by hand. The shipped narratives restated generated facts in prose instead.

The owner chose two things on 2026-09-27. The first is **React components in the room** over embedding a static
HTML page. The second is **our own SVG component drawn from a small spec** ("vazhi 1") over Mermaid, React Flow or
D2. Those look like their own libraries, not like his page, and Mermaid alone adds about 1 MB.

## Decision

1. **Page shape v1 is the room's entity page.** An entity page has the sections Start here · The bigger loop ·
   Reference · Evidence · Meta and a left nav built from them. Each section carries a `narrative` or `generated`
   pill. The masthead shows the name, the version, a one-line tagline and chips (ring, face room, requires, ADR band,
   lane and cycle).
2. **The parts are kit components.** Lede, Panel (plain · warn · big), StepPipe, Figure, Rosetta, StatGrid, Pill,
   Gloss and ProvPill live in the face kit and use face tokens only. Accent maps to the owner's accent, `--blue` to
   *generated*, `--amber` to *narrative* and `--red` to *warn*. No token is added and no colour literal is written
   (non-negotiable, ADR-1308).
3. **Generated sections come from the extract, never from prose.** Chips, the parts tables (commands, agents,
   processes, scripts, stations), ADRs, gates, lane status stats, the drift check and sources are drawn from
   `/api/reference`'s extract. If the extract does not hold a fact, that section is left out. It is not written by
   hand.
4. **Diagrams are drawn by `Diagram`, from a spec, in two layouts only.**
   - `flow` — boxes left to right with arrow labels. Optional refusal boxes sit under the boxes, one of them can be
     highlighted, and an optional divider (the money line) carries a left and a right caption.
   - `loop` — stages left to right, then a fork into two outcomes, then a dashed back-arrow to a named stage.

   The geometry (box positions, arrow paths, the divider) is computed by a pure `diagram.mjs` that node imports with
   no install. `View.tsx` only maps the geometry to `<svg>` elements. A fixture asserts the geometry: no overlapping
   boxes, every arrow ending on a box, and the divider between the boxes it names.
5. **Narrative files gain fenced blocks.** `lede`, `steps`, `flow`, `loop`, `panel`, `stats` and `rosetta` are
   parsed by the fold into typed blocks. A block that fails to parse renders as its source text with a visible
   error. It is never dropped, and no HTML is injected (ADR-1347 §2 still holds).

## Consequences

- One sample page (qa) goes through the whole pipeline first. The remaining 33 are rewritten only after the owner
  accepts that sample.
- The static `docs/wiki/*.md` pages stay as they are. The room is the reading surface for page shape v1.
- Phase 07 gains 2 days: 1.5 for the components, the diagram and the fold, and 0.5 for ADR-1514's gate change. The
  rewrite reuses the 4 narrative days ADR-1347 allocated.
