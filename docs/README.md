# docs/ — the room map

> What every file in this folder is, who owns it, and what you may NOT touch.
> Lost in the repo? Read `how-arc-works-simple.md` first. Updated 2026-07-25.

## Placement rule (docs/ root)

A file lives at docs/ root only if it is one of: a **live ledger** machinery writes, a
**shipped manual** a product manifest lists, an **active guide** rules/CLAUDE/AGENTS cite,
or a **top-level orientation page**. Everything else goes to its subfolder — strategy
docs → `strategy/` (see its README's placement rule) · decisions → `adr/` · proof →
`evidence/` · finished/superseded → `archive/`. When in doubt: if nothing live references
it and no one reads it monthly, it's `archive/`.

## Root files by species

**Orientation (read these first)**

| File | Role |
|---|---|
| `how-arc-works-simple.md` | The owner's mental map — one rule, 3 time layers, lifecycle |
| `HISTORY.md` | Company logbook — what's been done, cycle by cycle |

**Live ledgers — machinery writes these. Append-only; never move, never hand-edit history**

| File | Written by |
|---|---|
| `retro-log.md` | `/arc-retro` (read by `/arc-kickoff` step 5 — kickoff quality compounds) |
| `session-log.md` | SessionEnd hook |
| `trial-ledger.md` | gate trial machinery (WARN→FAIL promotion evidence) |
| `suggestions-log.md` | `/arc` suggestion flow |
| `suppressions.md` | scan machinery |

**Shipped manuals — listed in `products/core/manifest.json`, synced to consumer repos.
Editing one = golden-fixture regen as a NAMED step (retro-log lesson)**

`how-it-works.md` · `usermanual.md` · `blueprint.md` · `product-runbook.md` · `plugins.md`

**Active guides — cited by `.claude/rules/`, `CLAUDE.md`, `AGENTS.md`, root `README.md`**

`build-playbook.md` (kickoff scaffolds §9 from it) · `stripe-setup.md` · `supabase-setup.md`
· `deployment.md` · `branding.md` · `ui-conventions.md` · `agent-browser-integration.md`

**History parked here pending retro (see TODO below)**

`kickoff-upgrade-plan.md` · `kickoff-v3-plan.md` · `kickoff-v3.5-plan.md` ·
`gstack-vs-arc-comparison.md`

## Subfolders

| Folder | Contents |
|---|---|
| `strategy/` | Vision + queue + rationale — has its own README with the layer map |
| `adr/` | Numbered permanent decisions (0001–0031) |
| `evidence/` | Proof bundles emitted by `/arc-phase-done` |
| `archive/` | Closed/parked/superseded — frozen, do not read for current truth |
| `council/` | Council sessions + historical kickoff eval work |
| `reviews/` | Review artifacts |
| `templates/` | Doc templates `/arc-kickoff` scaffolds from |

## ⚠ Phase-04 retro TODO — "docs cleanup, part 2"

2026-07-25 sweep moved 5 zero-reference history files to `archive/` (stage-comparison,
orchestrator-monorepo-plan, gsd-comparison, process-explainer-prompt, kickoff-v4-plan —
trial-ledger spec link updated). The remaining 4 history files above are **pinned by
product-shipped files** (`arc-kickoff` command cites v3-plan · `blueprint.md` cites
gstack-comparison · `build-playbook.md` cites v3/v3.5 · `suggestions-log.md` entries cite
upgrade-plan) — moving them means editing shipped files → golden-fixture regen as a named
step. Do it at retro or not at all; do not sweep them casually.

Also queued for the same retro slot:

- **Archive slug-naming** — kickoff step-0 archives as `PLAN-<date>.md`, which hides what
  the initiative was. Change to `PLAN-<date>-<slug>.md` (and matching PROGRESS/phases/
  evidence names). Shipped-command edit → fixture-aware named step. Until then,
  `HISTORY.md` is the archive index.
- **Park practice** — adopt: *park = ADR (why parked) + resume-BRIEF in `strategy/plans/`
  (pull-trigger + pointer to the archived PLAN/PROGRESS)*, so parked work re-enters the
  queue instead of rotting in archive. Candidate for a constitution working article or
  `how-arc-works-simple.md` §8.
