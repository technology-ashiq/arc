# ADR 1116 — A spoke must be a distinct topic, not a re-cut of the pillar's own tokens

**Status:** accepted
**Date:** 2026-08-14
**Product:** `growth`
**Reversibility:** two-way
**Revisit trigger:** a cluster is refused as THIN whose rejected spokes a human reads as genuinely
different topics — the residue rule is then too strict for this subject matter and the distinctness
test moves to the human at gate 1.

## Context

Assumption **A-05** — *"1 pillar + ≥5 spokes is the right cluster shape for arc's subject matter"* —
carried the trigger *"the first cluster proposal has spokes that only restate the pillar"*.

The first real cluster, `c-001`, fired it. Pillar `ai agents`, with spokes `agents build`,
`ai agents build`, `coding agents` and `multi-agent ai coding workflows`. Two of those are the
pillar plus one word; one is the pillar reordered. The proposal put the same topic in front of a
human four times and called it a cluster.

The diagnosis is **not** that the shape is wrong. It is that spoke selection was sorting by
*descending token overlap with the pillar* (`cluster.mjs`), so the rows the algorithm ranked
highest were by construction the rows that repeated the pillar most. The closer a candidate came to
being the pillar, the more certain it was to be chosen as a spoke.

A second, smaller defect sat next to it: the tokeniser dropped every token of two characters or
fewer, so the pillar `ai agents` reduced to `{agents}` and **`ai` — the single most load-bearing
token in arc's subject matter — was invisible to the comparison.** A length threshold is a stopword
list that cannot be reviewed.

## Options considered

1. **Select spokes by residue-distinctness, and drop the length threshold for the reviewable
   stopword list already in `adapters.mjs`.**
2. Raise `minAttestations` so weaker n-grams never become candidates. Con: attestation measures how
   often people say a phrase, not whether two phrases are the same topic — `ai agents build` is
   genuinely attested, and it is still a re-cut.
3. Leave it to the human at gate 1. Con: the gate exists to choose between real options, not to
   clean up after a generator that produced four spellings of one. E3's honesty is about what the
   machine *claims*, and proposing the pillar four times claims a cluster that is not there.
4. Change the cluster shape (fewer spokes). Con: treats a selection bug as a policy problem, and
   A-05 is about the shape being right — which, tested properly, it still is.

## Decision

**Option 1.** A candidate is eligible as a spoke only if its **residue** — its topic tokens minus
the pillar's topic tokens — is:

- **non-empty** (a candidate that adds no token the pillar lacks is the pillar re-cut); and
- **not equal to, and not a subset of, the residue of an already-selected spoke** (a candidate whose
  only news is news another spoke already carries is that spoke again).

Topic tokens are NFKC-normalised, lowercased, split on non-alphanumerics, and filtered by the
**existing** `STOP` set in `adapters.mjs` — now exported rather than duplicated — never by length.
`STOP` gains the bare determiners and quantifiers (`any`, `every`, `some`, `all`, …), which is what
admitted `any llm` as a topic.

Spokes are then taken **in candidate order**, which is most-attested-first. Ordering by evidence
strength is the honest ordering; ordering by similarity to the pillar is the bug this ADR removes.
Nothing here scores a candidate as better or worse — the machine still only evidences, and the human
still chooses at gate 1.

**What this deliberately does NOT fix.** Fragment keywords that are not topics at all — `yc s23`
survives every rule above, because two independent headlines really do contain it. Killing that
class needs either a blocklist (fragile, and the spec names it a rabbit hole) or token-level
attestation (a second mechanism, unevidenced). It stays a **known limit handled at gate 1**, written
down here rather than discovered by the next reader of a proposal.

**Evidence:** `initiatives/growth/clusters/c-001.json` as first built (the four restating spokes) ·
`cluster.mjs` spoke selection sorting on `overlap` descending · `adapters.mjs:97` `STOP` ·
PLAN.md Assumptions ledger A-05 · ADR-1111 (the shape this keeps).
**Confidence:** high on the residue rule; medium on candidate-order-as-selection-order, which is
why the revisit trigger names the THIN refusal a human disagrees with.
**Rejected because:** option 2 measures the wrong thing; option 3 spends the human gate on cleanup;
option 4 changes a policy to hide a bug.

## Consequences

Easier: a cluster proposal reads as N different articles, and a pool that cannot yield N different
articles refuses instead of padding. Harder: the pool must be genuinely broad — `c-001`'s original
13 candidates yield 6 distinct spokes against a floor of 5, which is a thin margin and means the
source query list, not the selection rule, is what buys headroom from here.
