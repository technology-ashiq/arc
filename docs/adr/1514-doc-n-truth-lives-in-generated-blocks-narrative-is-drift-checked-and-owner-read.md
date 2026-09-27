# ADR 1514 — DOC-N: truth lives in generated blocks; a narrative is drift-checked and owner-read, not verified block by block

**Status:** proposed (the owner's `/arc-change --lane face` of 2026-09-27, second pass)
**Date:** 2026-09-27
**Product:** docs
**Reversibility:** two-way
**Revisit trigger:** the owner finds a narrative stating something false about arc that the drift check passed.
Then `narrative-verify` goes back to being a gate for the pages that carry that kind of claim.
**Amends:** ADR-1513 §1 and §2. §3 (the owner reads for understanding) stands and becomes the main gate.

## Context

ADR-1513 let model-drafted narrative ship on three conditions: every factual block anchored, an independent verifier
passing every block, and the owner's read. The first two held for all 34 pages, and the owner still rejected them
(ADR-1348). The method measured the wrong thing. It proved that each sentence was supported. It never asked whether
a person could understand the page.

The method also pushed the writing toward the failure. A sentence that restates a source file is easy to anchor and
easy to verify. An analogy ("engine is the dispatch office") is neither. Drafting agents learned to restate, and
pruning what the verifier rejected made the pages drier still. Roughly 40% of a week's tokens went on draft, verify
and fix rounds.

## Decision

1. **Hard facts are generated, not written.** Counts, names, versions, ADR lists, gates, lane status and exit codes
   come from the extract through ADR-1348's generated sections. A narrative explains. It does not re-list.
2. **A narrative is drift-checked.** `narrative-anchors` keeps one hard rule: every file path, command, agent,
   process, script, gate and ADR that a narrative names must resolve in the extract or the tree. The rule that every
   block carry a `src` or `plain` marker is retired. Markers that are present are still resolved, and still stripped
   before rendering.
3. **The per-block verifier becomes advisory.** `narrative-verify` stays as a tool the owner or a session may run on
   a page. Its receipt is no longer required to ship. The explanation-debt count stays (ADR-1513, "every feature is
   explained").
4. **The owner's read is the gate.** A page ships when the owner has read it in the room and accepted it:
   `narrative-anchors --accept <dir>/<id>` records his acceptance against the narrative's sha256. An edit after
   acceptance shows the page as awaiting-owner again. Phase 07 closes when that count is 0.
5. **The narrative is drafted directly by the session, from the sources.** It is still model-drafted, and ADR-1508's
   concern is answered by points 1, 2 and 4 together. No fleet of agents, no verify rounds and no pruning are used.

## Consequences

- An analogy and a story ("the life of a bug") can be written freely. They are what the owner asked for.
- A wrong number can no longer hide in prose, because the numbers come from generated sections. A wrong claim in
  prose is caught by the owner's read or by nothing. That is the accepted risk, and it is named in the revisit
  trigger.
- `tests/docs-narrative.bats` loses the arms for the every-block marker and the verify receipt, and gains the arms
  for acceptance-hash and drift. Each new arm FAILs from birth with its mutant.
