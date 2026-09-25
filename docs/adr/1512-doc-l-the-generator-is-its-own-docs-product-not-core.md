# ADR 1512 — DOC-L: the generator is its own `docs` product, not part of `core`

**Status:** accepted
**Date:** 2026-09-25
**Product:** docs
**Reversibility:** two-way
**Revisit trigger:** a venture repo asks for a generated wiki of its own tree → reconsider moving the extractor (not the renderer) into `core`.

## Context

The design source left this open (DOC-L): a new `docs` product with its own manifest and
`.claude/scripts/docs/`, or the generator in `core` beside `face-coverage.mjs` as a second consumer
of the same walkers. The lane `docs` is born either way — this is where the **code** lives.

Facts checked at kickoff: `face-coverage.mjs` is owned by `products/core/manifest.json`. `core` is
the floor every other product `requires`, and it is the payload `sync-to-project` copies into every
venture repo (sync-golden `tests/fixtures/sync-golden/tree-manifest.txt`). A venture tree has no
`products/`, no `initiatives/` lanes of arc's kind and no arc ADR bands, so a wiki generator there
would render an empty wiki.

**Correction found by the kickoff attack panel (focus B).** The venture-payload boundary is only
real for **selective** installs: `sync-to-project.sh <dir> --products a,b` resolves manifests, but
the default full sync (`sync-to-project.sh:137`) rsyncs `.claude/` wholesale, so `.claude/scripts/docs/**`
reaches a full-sync venture exactly as `.claude/scripts/legal/**` already does. The first draft of
this ADR claimed the product boundary kept it out of every venture; that was false.

## Options considered

1. **In `core`** — no new product; but every **selective** install (which always resolves `core`) gets a generator with nothing to generate, and `core` — the floor every product requires — gains a rendering concern.
2. **New `docs` product, `requires: ["core"]`** — imports `face-coverage.mjs` across the product boundary in the allowed direction (docs → core), stays out of selective installs that do not name it (the default full sync carries it like every other product), and is documented by its own generator like everything else.

## Decision

Option 2 — carried by the dependency direction and core's minimality, not by any claim about full syncs. `products/docs/manifest.json` lists `.claude/scripts/docs/*.mjs`; the generator imports
`.claude/scripts/core/face-coverage.mjs`; `core` never imports `docs`. The additive exports
ADR-1501 adds to `face-coverage.mjs` are the only `core` change this cycle makes.

## Consequences

- A new product needs its `face` rows and a `products.docs` entry in the face contract in the
  change that creates it, and a product-lint-clean manifest — Phase 00 work.
- If the product is later judged not worth keeping, moving four scripts into `core` is a cheap
  diff; nothing outside `.claude/scripts/docs/` imports them.
