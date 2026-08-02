# Phase 05 — Context Pack: what past work already knows about this slice

**Goal (one line):** before a slice is built, `next` hands over the code neighbourhood, the ADRs
that govern it, the learning and retro rows tagged to its area, and the files that churn most in its
blast radius — and records which source produced each one.
**Appetite:** 1.0 days
**Depends on:** phase-00, phase-04

Serves **REQ-05** (the pack), **REQ-06** (one-hop link following).

## What this phase actually builds

- **`.claude/scripts/develop/context-pack.mjs`** — assembly, with the code-graph adapter behind an
  interface so the grep path is a real implementation and not a stub.
- **`next` prints the pack** for the slice it hands out, and writes every contributing source into
  that slice's `sources:` field.

### The five retrieval sources

| source | how | fallback |
|---|---|---|
| code neighbourhood | `codegraph explore` when `.codegraph/` exists | grep + glob over the blast radius — **and the pack says which ran** |
| governing ADRs | the brief's `adrs:` list, plus any ADR whose `Product:` matches the lane | none needed |
| learning rows | `docs/develop/learning-ledger.md` matched on `area:` and on blast-radius overlap | none needed |
| retro patterns | `docs/retro-log.md` matched on tag overlap | none needed |
| churn | `git log --format=%H --name-only` over the blast radius, top 3 files by commit count | none — computed or absent |

### One hop, and only one (ADR-0111)

A matched learning row contributes itself **and** the things its own typed links name — the ADR, the
rule, the fixture. Those contribute nothing further. Walking transitively makes the pack everything,
which is the same as nothing, and *process tax* is the risk the design source ranks first.

### `sources:` is the audit trail

Every source that contributed is recorded on the slice, **including which retrieval path actually
ran and including sources that produced nothing.** A pack that cannot say where it looked cannot be
audited, and a silent fallback is the 2026-07-30 failure where a normalisation removed the property
being measured and no artifact showed it.

## Exit criteria (Definition of Done)

- [ ] `next` prints a pack carrying all five sources for a slice on the committed fixture
- [ ] the pack states which code-graph path ran — `codegraph` or `grep-fallback` — in both cases
- [ ] the same neighbourhood contract passes from both paths (the external-dependency contract test)
- [ ] a learning row's typed links are followed exactly one hop, and the resulting ADR / rule /
      fixture appear; a two-hop item provably does NOT appear — **including the case where that same
      item is also reachable one hop from a DIFFERENT matched row, where it must still surface by
      that other path.** Without this the absence test cannot tell a correct second-path inclusion
      from a transitive leak
- [ ] churn names the top 3 files by commit count over the blast radius, computed from `git log`
- [ ] every contributing source lands in the slice's `sources:` field, including ones that returned
      nothing
- [ ] a slice whose pack fell back to grep says so in `sources:` — asserted by a test that runs with
      no `.codegraph/` present
- [ ] the adversarial pass is run by a fresh agent that has not seen the code; holes pinned
- [ ] tests green on all 3 CI legs · `tree-manifest.txt` regenerated · tracker updated

## Verification plan

One coarse line at kickoff, refined via `/arc-change` when the phase starts: bats over the pack
assembler against a committed fixture repo carrying a seeded learning ledger, a retro row and a
known commit history — asserting the one-hop boundary in both directions (the linked item present,
the item one further hop absent) and asserting the fallback is named when `.codegraph/` is absent.

## Rabbit holes in this phase

- **Perfecting churn.** Commit count over the blast radius, top 3. Not a hotspot model, not
  time-decayed, not weighted by author.
- **Making the pack complete.** It is a starting point for a slice, not a briefing document. If it
  does not fit a screen it has failed at its own purpose.
- **A relevance score to rank what to include.** That is an invented number. The shape is fixed —
  five sources, one hop, top 3 churn — precisely so nothing needs ranking.
- **Building a code-graph.** `codegraph` exists or it does not; the fallback is grep, stated.

## Out of scope for this phase

- Two-hop following — the assumption ledger carries this and Phase 05 tests whether one is enough.
- Tag vocabulary beyond what Phase 04 defined.
- Any change to how slices are written; this phase only adds what is read before writing them.

## Your-setup / pending

Nothing. `codegraph` is optional by construction — if `.codegraph/` is absent the grep path runs and
says so.

**Tripwire:** at 0.8 days — 0.2d before the 1.0d appetite is spent, ship the pack with ADRs, learning rows, retro rows and churn, and cut
the code-graph adapter to grep-only. Four sources that always work beat five where one is flaky.

## Non-negotiables (verbatim from PLAN)

- The main session writes the code — develop supplies context, discipline, checkpoints and evidence; there is no coder subagent, ever.
- develop never modifies its own policies, gates, skills or capabilities without a recorded, Ashiq-approved promotion — this cycle builds the promotion machinery and is bound by it.
- Nothing is installed from the internet without a pinned version, a hash, recorded provenance and a content scan; a write-capable capability additionally needs Ashiq's recorded OK.
- A learning candidate is never graded by the context that authored it.
- Every number is computed by a tool or earned from a scored outcome — a self-declared score in any ledger row is a lint finding.
- Any gate, lint or parser this cycle ships gets an adversarial construct-a-breaking-input pass run by a FRESH agent that has not seen the implementation, with every hole pinned as a fixture.
- Every retrieval states which source it actually used, including when it fell back to grep.
