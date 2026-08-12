# ADR 1005 — LEG-E: templates are authored in arc, executed venture-side, and never fleet-propagated

**Status:** accepted
**Date:** 2026-08-12
**Product:** `legal`
**Reversibility:** two-way
**Revisit trigger:** three or more ventures run the module and the explicit re-sync becomes the
bottleneck rather than the review gate — a pull-side "your template set is N versions behind"
report is then earned (a report, never an automatic update).

## Context

Decided under the owner's **Build-out Mandate (2026-08-09)**, receipt `01KZTM348858PDH44K4HA64CVA`
(ADR-1000). Locked at the v1.1 freeze as LEG-E; the kickoff survey confirms the code homes are free.

Verified this session: `products/` exists and holds 14 products (`absorb core council design develop
engine evolve git hq leads memory plan qa review`) — **no `legal`**. No legal code exists anywhere in
the tree. Confirmed greenfield.

The topology question is where the templates live versus where the render runs, and it is really a
question about blast radius: a template fix that reaches every venture automatically is a legal-text
change nobody approved, applied to pages strangers rely on.

## Options considered

1. **Everything venture-side** — each venture owns its own templates; no shared asset, no governance,
   and the second venture re-authors the first's work.
2. **Everything arc-side, arc renders into venture repos** — one place to fix, but arc then writes
   across repo boundaries and the spine gains cross-repo emitters (the single-emitter discipline
   exists because that goes wrong quietly).
3. **Authored in arc, shipped pinned, executed venture-side** — one canonical set, local execution,
   and propagation that is always a deliberate act.

## Decision

**Option 3.**

- **Templates + engine live in this lane:** `products/legal/` (templates, fixtures, manifest) and
  `.claude/scripts/legal/` (engine + CLI). Entry point `.claude/scripts/legal/arc-legal.mjs`,
  zero-dep Node ESM (`node:fs`, `node:path` only), mirroring `.claude/scripts/hq/arc-event.mjs`'s
  shape and exit-code convention.
- **`sync-to-project` ships the pinned, manifest-hashed set** into consumer repos, driven by
  `products/legal/manifest.json` (the COPY/MKDIR/ENVBLOCK protocol every other product uses).
- **`/arc-legal` runs in the venture repo, root-mode.** Facts, pages, pins and receipts are
  venture-local. **No cross-repo spine writes** — single-emitter discipline. HQ visibility, if it is
  ever wanted, arrives through the existing pull-side pattern.
- **Template fixes reach a venture only by explicit re-sync + `--bump-templates` re-approval.**
  Deliberate roll-forward, never silent fleet propagation.

**Two mechanical obligations this creates, recorded so they are not discovered late:**

- Editing any file the product ships moves the **sync-golden byte-identity fixture**. Regenerating
  `tests/fixtures/sync-golden/tree-manifest.txt` is a NAMED step in the same change — diff the delta
  first, confirm only intended paths moved, then re-record (`docs/retro-log.md` 2026-07-22:
  *"the golden fixture broke across 10 separate commits… at least twice as a surprise mid-task
  failure"*).
- Tests are central bats under `tests/legal-*.bats`, and **they run on CI, never on this box**. Any
  git-sandbox test sets repo-local git identity rather than subshell-scoped env, or a clean CI
  runner fails 128 while the local run is green.

**Evidence:** `products/` listing and `.claude/scripts/hq/` structure read this session; the
sync-golden regeneration contract and the COPY/MKDIR/ENVBLOCK protocol confirmed against existing
product manifests; `docs/retro-log.md` 2026-07-22 (golden fixture), `.claude/rules/testing.md`.
**Confidence:** high
**Rejected because:** Option 1 — no shared asset, no governance, duplicated authoring. Option 2 —
cross-repo writes and a second emitter, for no benefit that pinning does not already give.

## Consequences

Easier: one canonical text to fix, one place to attack adversarially, and a venture's legal pages
keep working with no arc process running.

Harder: a template fix is not "done" when it lands in arc — it is done when each venture has
re-synced and re-approved. That gap is visible (`--verify` and the pinned `template_set_sha` in
every receipt) rather than assumed away, and a venture sitting three versions behind is a fact the
next publish surfaces.
