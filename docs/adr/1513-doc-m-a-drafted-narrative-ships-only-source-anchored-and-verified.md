# ADR 1513 — DOC-M: a model-drafted narrative ships only source-anchored, independently verified and owner-read

**Status:** accepted (the owner's ruling on the `/arc-change --lane face` of 2026-09-27)
**Date:** 2026-09-27
**Product:** docs
**Reversibility:** two-way
**Revisit trigger:** a shipped narrative is found to state something its anchored source does not say. The method then failed at the verifier step, and every page that verifier passed is re-verified before any new page ships.
**Amends:** ADR-1508 (DOC-H). ADR-1508 still binds all prose this method does not cover.

## Context

ADR-1508 locked narrative to hand-written or absent: a model writes pages that are about 90% right, and by reading
alone the wrong 10% cannot be told apart from the rest. It left one door open: a new owner decision, recorded as an
ADR, that **names a verification method able to tell the 10% from the 90%**.

On 2026-09-27 the owner asked for every product and lane in arc to be explained the way `arc-wiki-engine_1.html`
explains engine: in plain words, why it exists, arc words to normal words, how a job flows, the stages one by one,
the life of a run, a glossary. It should be detailed, but a layman should understand it in one read. The wiki then
had 3 narratives across 34 product and lane pages, 2 paragraphs each. Line-by-line owner acceptance of 34 long pages
is not a method he can run; he chose this one.

## Decision

A narrative drafted by a model ships only when all three hold. The reading tests *understanding*; the first two test
*truth*, which is what reading could not do.

1. **Every factual block is anchored.** Every paragraph, list item and table row that states a fact about arc carries
   at least one hidden anchor, `<!-- src: <anchor>[; <anchor>...] -->`. An anchor is one of three things:
   - a tracked repo path, optionally with `#<symbol>`;
   - `ADR-NNNN`;
   - `fact:<type>/<id>.<key>`, a key in `wiki-build --json`'s extract.

   A block that only explains, such as an analogy or a "think of it as", carries `<!-- plain -->` and states no fact
   about arc. The `narrative-anchors` gate FAILs a block with neither marker and an anchor that does not resolve.
   It also FAILs a `plain` block that names a file, a command, an ADR or a number. The wiki and the Reference room
   strip both markers before rendering.
2. **An independent verifier passes every block.** A fresh agent on the independent-family-verifier tier (ADR-0069)
   gets the page and its anchored sources, and nothing of the session that drafted it. It marks every block
   SUPPORTED, UNSUPPORTED or CONTRADICTED. One non-SUPPORTED block keeps the page out. The verdict is written to
   `docs/narrative-verify/<dir>/<id>.json` (outside `docs/wiki/`, which wiki-coverage owns) together with the sha256 of the narrative it judged. The gate
   FAILs a narrative whose current hash has no passing receipt, so an edit after verification unships it until it
   is verified again.
3. **The owner reads it for understanding.** Pages merge in batches once anchored and verified -- the room can only show what main holds -- and `narrative-anchors` counts every verified page he has not read yet (`awaiting-owner`); Phase 07 closes only when that count is 0. The owner reads each batch in the Reference
   room and accepts it: does a layman understand this product from this page? The acceptance is recorded in each
   receipt (`accepted: { by: "owner", on: <date> }`). A page he does not accept is rewritten, then verified again.

**Every feature is explained, not only listed.** A product's narrative names, in plain words, every command, agent,
process, gate and rule that the extract assigns to that product. A lane's narrative does the same for its product
and its ADR band. `narrative-anchors` counts every entity no narrative names (its *explanation debt*) and reports the
count on stdout, on the wiki index and in the Reference room. It is a count, never a target (ADR-1506's posture).
So a product, lane or feature born tomorrow gets its page from the extract automatically (ADR-1503), and it shows
as explanation debt until a narrative covers it.

## Consequences

- Narrative coverage can grow at model speed, while every shipped sentence stays traceable to a source a gate
  resolves and a verifier checked.
- The verifier is the most expensive step and the one that must not be skipped. A page with no receipt reads
  "narrative pending", exactly as before.
- Staleness is unchanged (ADR-1507). When a fact under a narrative moves, its fingerprint warns. The anchors
  point at what to re-verify.

## Amendment 1 (2026-09-27) -- how the verifier actually runs, learned on the first 34 pages

Running the method on every product and lane taught five things the first text did not say:

1. **Chunks, excerpts, not whole pages.** A page with its whole sources inlined was 160-835 KB and timed out on every
   model. `narrative-verify.mjs` now sends chunks of at most 25 KB, four at a time. Each chunk carries, for every
   source its blocks cite, the windows around the lines that share the most words with EACH block (a long line is
   clipped around those words). The first version sent a source's first 5 KB, and claims further down were judged
   unsupported while the file said them word for word.
2. **Secret-shaped text is withheld by name before anything is sent.** A fixture key in a cited file, or a file name
   like `...-risk-checkpoints-...` that looks like a key, stopped chunks at the data boundary.
3. **A verdict is carried, never re-rolled.** The verifier is not deterministic: re-judging unchanged text flipped
   settled blocks both ways. A block whose exact text, anchors and plain-marker a previous run judged SUPPORTED keeps
   that verdict; the receipt lists every carried block (`carried`) and the key it was carried by (`supportedKeys`).
   A changed block is always judged fresh. Re-running a rejected block until it passes is not the method.
4. **Fix, then prune.** A rejected block goes to a fixer (a fresh Claude agent) that re-anchors it to the file that
   states it, narrows it to the source's words, splits it, or corrects it when the page was wrong. Across the 34
   pages the fixers found well over a hundred CONTRADICTED claims -- real errors reading would not have caught. After
   three fix rounds, whatever a verifier still rejects is removed (`narrative-verify.mjs --prune`) and the page is
   verified again. A pruned block is lost information; the cap exists because rounds past three stopped converging.
5. **The owner's read is recorded after merge.** The room shows only what main holds, so verified pages merge first
   and `narrative-anchors` counts them `awaiting-owner` until `--accept` records the read. Phase 07 closes only at
   zero.
