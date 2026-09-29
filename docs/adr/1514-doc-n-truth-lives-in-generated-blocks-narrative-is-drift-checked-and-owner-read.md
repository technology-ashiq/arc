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

## Amendment 1 (2026-09-29, `/arc-change --lane face`): `--accept` carries an owner proof

**Why.** The round-2 attack (B6) showed section 4 rests on a premise nothing enforces: `--accept` stamps `by: "owner"`
for any caller. An agent session could accept all 34 pages and take awaiting-owner to 0, and the gate Phase 07 closes on
would read as an owner's act when it was not. The owner chose to close this in code, not to park it (2026-09-29).

**Decision.** `narrative-anchors --accept <dir>/<id> --approval <ULID>` writes an entry only when the spine holds:
1. an `approval.requested` with `gate: narrative-accept` whose payload lists that page and its **current** sha256;
2. a `decision.recorded` for it with verdict `approve`, written through `arc-inbox approve` (the owner's stamp).

Anything else is refused with a plain sentence, exit 1, nothing written: no `--approval`, an unknown ULID, an undecided or
rejected request, a request for another page, or a hash that no longer matches (an edit after approval needs a new one).
The entry records the ULID. The gate FAILs an entry that names none, so a hand-edited `accepted.json` does not pass either.

**How the request is made.** `narrative-anchors --request-accept <dir>/<id>...` computes the pages' hashes and asks the main
clone's `arc-event` to emit the `approval.requested`; the owner runs `arc-inbox approve` there. One request may name many pages
(the 34 existing acceptances are re-stamped under one batch request).

**The worktree constraint.** The spine refuses reads and writes inside a linked worktree (`WORKTREE_SPINE`), and the canonical
spine is in the main clone. So both new steps locate the main clone from git's common dir and use it read-only for `--accept`
and through its own `arc-event` for the request. Nothing else reaches across, and `ARC_SPINE_ROOT` stays test-only.

**Not decided here, checked in the build.** Whether `arc-event` accepts a new `gate` string on `approval.requested` as it
stands, or `validate.mjs` needs a row (an hq-lane file, so the change would land as a small additive edit). If it needs more
than a row, the build stops and this amendment returns to the owner.

**Cost.** About 0.75 day: the two commands, the spine read, a fixture per refusal (each FAILs against the old code), one
attack round. Charged to Phase 07. **Revisit trigger:** the owner reads a page in the room and cannot accept it without a
terminal, which would make the proof a chore and the room the place to record it.

### What Amendment 1 proves, and what it does not (added after the round-3 attack)

The owner proof is a **deliberate-step proof, not authentication.** It makes an accepted page cost one thing an agent cannot
do by accident: a request the owner decided through `arc-inbox`, naming the page's exact hash. It does **not** prove that a
human wrote that decision, for two reasons the attack found and this ADR states instead of hiding:

1. **CI cannot re-verify it.** The gate checks that an entry carries a well-formed ULID and no more, because the spine is
   gitignored and absent on a CI runner. A hand-edited `accepted.json` with an invented ULID therefore reads as accepted on
   CI. On CI the awaiting-owner count is **advisory**; the real check runs only inside `--accept`, on the owner's own clone.
2. **Anything that can run `arc-event` from the main clone can write both events.** `arc-inbox approve` and a direct
   `decision.recorded{decides, verdict: approve}` are indistinguishable to the reader. Closing that needs an owner-only token
   that only `arc-inbox` can stamp and the validator can require, which is a new authentication design in the hq lane. It is
   **not built here** and is the owner's call.

So the guarantee is: an agent cannot accept a page by running `--accept` alone, or by pointing `ARC_SPINE_ROOT` at a spine of
its own (refused by name), and any forgery leaves two receipts on the real spine that a reader can see. It is not: an agent
with a shell in the main clone cannot forge them. **Revisit trigger, added:** the owner asks for the owner-only token.
