# ADR 0606 — ABS-G: absorb claims the 0600s, lives in `products/absorb/`, seeds its registry empty, and takes the unspecified-input defect class as its first target

**Status:** accepted
**Date:** 2026-08-09
**Product:** `absorb`
**Reversibility:** one-way
**Revisit trigger:** the century is one-way in practice — once these files merge to `main` they are
left alone (the 2026-08-02 precedent: develop renumbered, model-policy's already-merged numbers
stayed). The reopenable half is the **first target**: if its study returns a SKIP or its A/B fails,
the next target is chosen from the registry's candidate rows, not by re-deciding this ADR.

## Context

ABS-G was left open at the design source's v1.0 freeze precisely because three of its four parts
depend on the state of the tree on kickoff day, and the fourth depends on the trigger. All four are
now decidable and are decided here in one file, because they were specified as one decision.

The brief's original `0400–0499` line went stale within days — leads claimed the 0400s at birth —
and the design source predicted absorb would land on 0500 or 0600 depending on whether policy
kicked off first. It did: policy claimed **0500–0508** at birth on 2026-08-06.

## Options considered

Per part, only where a real fork existed:

1. **Registry seed — empty vs seeded from pilot notes.** Seeding assumes pilot notes exist. They do
   not: no trigger arm has fired (ADR-0074 records the audit), so there is no pilot to draw from,
   and inventing candidate rows would put unstudied names in the one file that is supposed to be an
   honest ledger.
2. **Code home — `products/absorb/` with scripts split out, vs everything under `.claude/scripts/`.**
   The split mirrors develop, whose docs-and-data live apart from its scripts, and keeps the
   registry where a human looks for data rather than inside a scripts directory.
3. **First target — the strongest receipt in the tree, vs a target named fresh.** Under ADR-0074 no
   arm needed to fire, so merit governs. A target with a receipt behind it is strictly better than
   one without, and one exists.

## Decision

**Century: `0600–0699`.** Verified free on 2026-08-09 by listing `docs/adr/` — nothing in the 0600s
exists, and the band table's `0600–0699 | next lane to be born` row is claimed by this cycle.
absorb never numbers outside it. `kickoff-lint [adr-dup]` is the control.

**Code home: `products/absorb/`** for docs and the registry (`products/absorb/registry.json`),
with scripts at **`.claude/scripts/absorb/`** — develop-lane symmetry. Lean only: no directory is
created that this cycle does not fill.

**Registry seed: EMPTY.** Born with its schema and zero rows. The first row is written by the first
real study (Phase 4), which is also the first honest test of the row shape.

**First target: the unspecified-input defect class**, and specifically the technique that beat arc
at it — **gstack's post-build review pass**.

The receipt is `docs/evidence/planner-bench/LEDGER.md`, PLANOFF-01, 2026-07-12. arc took the top
composite (94.5) and still lost this narrow class outright:

- **gstack (90.8)** — *"Its post-build review pass found the only real defect anyone caught
  (malformed percent-escape → 500) — a defect no plan predicted and no acceptance test probed."*
- **superpowers (88.8)** — *"the only other arm to survive the malformed-escape probe"*
- **arc (94.5)** — planned by risk, executed verbatim, zero fix commits, and **neither found nor
  survived that defect.**

That is a task class arc runs (review and QA), a named external technique that demonstrably beat
it, and a receipt in the house's own PLANOFF format. Being the best planner and still shipping the
one defect nobody specified is the sharpest weakness the evidence actually supports.

The rebuild target is arc's own review surface — `/arc-review` and `/arc-qa` command bodies, or a
playbook — all inside the ADR-0602 allowlist. The source is readable locally, so study needs no
network.

**This is a merit choice under ADR-0074, not a fired trigger.** Stated plainly so no later retro
mistakes the PLANOFF-01 row for arm 1 firing: arm 1 requires arc to *lose*, and arc won PLANOFF-01
on composite. What the row supports is a narrower and still-true claim — arc lost *this class*.

## Amendment 1 (2026-08-09, Phase 00) — the code home is right, its stated reason was wrong

Phase 00's DEV-B/C audit (`initiatives/absorb/evidence/phase-00/dev-bc-audit.md` §4) contradicted
this ADR's reasoning and is recorded here rather than silently reinterpreted.

**What was wrong:** this ADR justified `products/absorb/` by "develop-lane symmetry". All twelve
product directories contain exactly one file, `manifest.json`. `products/develop/` holds no docs and
no data — develop's data lives at `.claude/scripts/develop/`. There is no precedent for a product
directory holding data, so the symmetry claim was false.

**Why the decision stands anyway, on a stronger reason:** `sync-to-project.sh:137` rsyncs all of
`.claude/` into a consumer project on a bare install, and `tests/sync.bats:69,76` assert the result
is byte-identical to `tests/fixtures/sync-golden/tree-manifest.txt`. `products/` is never synced.
`capability-lock.json` therefore sits hash-pinned in that golden fixture
(`tree-manifest.txt:119`), so **every write to develop's lock forces a golden regeneration**.
absorb's registry is written on every technique transition — far more often than a lock file — so
housing it inside the synced surface would put a byte-identity gate in front of routine data writes.
`products/absorb/` avoids that.

**The reason is sync-surface exclusion, not symmetry.** The decision is unchanged.

**Two consequences recorded with it.** First, `.claude/scripts/absorb/report-lint.mjs` lands inside
the synced surface, so `tests/fixtures/sync-golden/tree-manifest.txt` is regenerated once in Phase
00 — acceptable for a stable lint script, and precisely what would not have been acceptable for a
registry written on every technique transition.

Second, **`products/absorb/manifest.json` is required.** `product-lint` refuses any synced file that
appears in no product manifest (exit 2, in a CI step before bats — it cost a full cycle on
2026-08-07, `a06cdb8`), and `products/develop/manifest.json` lists every develop file explicitly. So
the symmetry claim is wrong about the *registry* — no product directory holds data — but right about
the *scripts*: develop has both `.claude/scripts/develop/` and a product manifest, and absorb needs
both too. `registry.json` is deliberately **not** listed, because it is unsynced and a manifest row
would make the selective-install path copy arc's technique registry into consumer repos.

## Consequences

**Easier.** Phase 4 has a concrete target with a citation from day one instead of a placeholder,
and the target's own weakness class is one arc can test against its existing fixtures.

**Harder.** The century is effectively permanent. The empty seed means the registry proves nothing
until Phase 4, so REQ-04's cap and displacement logic are fixture-tested rather than
usage-tested — the assumptions ledger carries that as a live bet. And the first target is arc's
*review* surface, which means the first absorb edits the machinery that reviews absorb; Phase 4
runs its A/B on fixtures, never on its own diff, and that ordering is not optional.
