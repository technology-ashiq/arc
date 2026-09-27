# ADR 1347 — The Reference room explains every product and lane in plain words (widens REQ-12; Phase 07 +5.5d)

**Status:** accepted (the owner's ruling on the `/arc-change --lane face` of 2026-09-27)
**Date:** 2026-09-27
**Product:** face (+ an additive gate and 34 narrative files in the docs lane, ADR-1339's pattern)
**Reversibility:** two-way
**Revisit trigger:** Phase 07 passes 8.5d with fewer than 17 product narratives shipped. Then the scope-cut
conversation is due before another day is spent.

## Context

PRs A, B1 and B2 built the Reference room exactly to its spec (ADR-1346). At the live demo on 2026-09-27 the owner
found a room without the content he expected. Pages of `arc-wiki-engine_1.html`'s depth, for every product, were the
point of the room. Instead 31 of 34 product and lane pages read "Narrative pending", and the three narratives that
did exist were two paragraphs each, rendered as flat text with every table and heading gone.

His words, in short: every product, every feature, nothing missed, and anything new added to arc must reach these docs.
The pages must be detailed but readable by a layman, match the real process flow and stages, and leave a reader who
opens one product's page understanding that product completely. He chose to keep Phase 07 open until this lands
(option A), to verify drafts with ADR-1513's method, and to extend the appetite.

## Decision

1. **REQ-12 widens.** The Reference room is done when every one of the 17 products and 17 lanes (34 pages, counted
   from the extract, never from a list) shows an ADR-1513-verified, owner-accepted narrative. A narrative follows the
   design's shape:
   - Start here: in plain words, why it is a product at all, arc words → normal words, how a job flows, the stages one
     by one.
   - The bigger loop: the life of a run, and what happens around it.
   - Every feature the extract assigns to the entity, explained.
2. **The room renders narrative markdown as markdown.** Sub-headings, lists and tables render, not flattened
   paragraphs. The parser is pure and in the fold, with no HTML injection: the View draws elements from the fold's
   blocks. A fixture holds every block kind and a planted `<script>` renders as text.
3. **The explanation debt is on screen.** The index shows ADR-1513's count, and each page names the features its
   narrative does not yet explain.
4. **Appetite: 24d → 29.5d.** Phase 07 goes from 3d to 8.5d:

   | Part | Days |
   |---|---|
   | Rendering | 0.5d |
   | `narrative-anchors` + the verifier harness | 1d |
   | 34 narratives in about 6 batches (~0.12d each, verification included) | 4d |

   Phase 08 (dogfood) stays 2d and last. The added days are named here, so nothing extends silently.

## Consequences

- Phase 07 closes later, and dogfood runs on a surface that explains itself.
- Token cost is real. Each narrative reads its product's code, and each is verified by a second model. Batches keep
  every PR small enough for one CI run.
- Each batch PR regenerates `docs/wiki/` (ADR-1504: generated output is never hand-edited).
