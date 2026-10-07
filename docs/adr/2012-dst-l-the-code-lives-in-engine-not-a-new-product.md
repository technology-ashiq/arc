# ADR 2012 — DST-L: the code lives in `engine` beside `arc-compile`; the gates live in `core`; no new product

**Status:** accepted
**Date:** 2026-10-07
**Product:** `distribute`
**Reversibility:** two-way
**Revisit trigger:** the install adapters grow a surface that `engine` has no other reason to own, such as a user-facing package release or a public README. That is the publish decision ADR-2008 defers, and the product split comes with it.

## Context

The design source left the home open. One option is a new `products/distribute` with `.claude/scripts/distribute/`. The other is to put the adapters in `engine` beside `arc-compile`, as a second consumer of its adapter registry. A product birth is not free. It costs a manifest, a `CATALOG` row, a face room, a `face-sections` regeneration, a sync-golden line and a wiki page, and in this repo it took three CI runs to learn (`new-product-birth-rows`). The No-go "no second compiler, no second walker" means the render adapters must sit beside `arc-compile` regardless. Cited from ADR-2000.

## Options considered

1. **`products/distribute`** — `engine` does not own a CLI. But it is a product whose only job is installation, with seven shared birth rows, and its render half has to call into `engine` anyway.
2. **`engine` owns rendering, install-targets and the CLI front; `core` owns the two new company gates** — one compiler and no product birth. The objection ("engine owning a CLI") does not hold, because `engine` already owns `arc-run`, `arc-compile` and `arc-bench`.

## Decision

Option 2:

- **Render adapters** go in `.claude/scripts/engine/adapters/{opencode,skills-only}.mjs`, beside the existing `claude-code.mjs` and `codex.mjs`.
- **Install adapters** go in `.claude/scripts/engine/install-targets/<harness>.mjs`.
- **The matrix and the enforcement contract** are data files beside `engine/router.yaml`: `engine/harnesses.yaml` and `engine/enforcement.yaml`.
- **The CLI front** `bin/arc.mjs` is listed in `products/engine/manifest.json`.
- **`gate-parity.mjs` and `brain-drift.mjs`** go in `.claude/scripts/core/`, beside `product-lint.mjs` and `face-coverage.mjs`, because they gate the whole repo and not the engine.

The design source wrote `engine/install-targets/`. Code in this repo lives under `.claude/scripts/`, so this is the corrected path.

## Consequences

The lane has no product of its own, and its face presence is the lane room, which is generic. Every new `engine` or `core` script is a manifest line. If `sync-to-project.sh` copies it, it is also a sync-golden change in the same commit (`arc-sync-golden-regen-on-synced-edits`).
