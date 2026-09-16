# ADR 1318 — FV2-A: v0.7 is the canonical design; the explore rounds and the v0.4 reference retire to the record

**Status:** accepted
**Date:** 2026-09-16
**Product:** face
**Reversibility:** two-way
**Revisit trigger:** the owner supplies a v0.8 (or later) of the same app → it replaces v0.7 by the same intake, and this ADR is superseded, never edited.
**Provenance:** `docs/strategy/plans/PLAN-face-v2.md` §3 FV2-A — adjudicated by the owner 2026-09-15 and LOCKED at the Cycle 16 kickoff. Recorded here, not re-opened.

## Context

Cycle 15 canonicalised the owner's **v0.4** HQ (eleven rooms) as the reference
(`docs/design/reference/face-hq/`, SOURCE.md) and kept the explore rounds
(`docs/design/explore/face-hq-v{1,2}/`) for the record. On 2026-09-15 the owner supplied
**v0.7** — a finished, self-consistent 36-room system (`src/hq/roomRegistry.js`, `ui/kit.jsx`,
`HQ.jsx`, a design-system spec, and a smoke + flows harness) — and ruled it the final design:
"ithu than final design… inime ellame arc oda frontend ithu than".

At kickoff the v0.7 source lives only on the owner's disk
(`E:/Work_Hub/01_Automemory/arc-face-hq2/assets/arcface`); the repo still carries v0.4.

## Options considered

1. **v0.7 replaces v0.4 as the reference; the old tree is marked superseded and kept** — one bar, full history.
2. **Re-explore on top of v0.7 in the repo's own taste** — rejected in PLAN-face-v2 §2 OUT: the reference is the target, not an input to re-explore.
3. **Keep both references live** — two bars; every module review would have to pick one.

## Decision

Option 1. `docs/design/reference/face-hq/assets/arcface` is replaced by v0.7 in Phase 00,
`SOURCE.md` is rewritten against it, and `docs/design/system/hq-design-system-v0.7.md` lands
beside `tokens.css` as the spec every module is polished against. The v0.4 tree and the
explore rounds stay on disk, marked superseded — never deleted. A lane that re-explores a
decided design burns the appetite the modules need.

## Consequences

- Easier: one bar for REQ-01 (smoke + a fresh-agent shot review against the v0.7 baseline).
- Harder: the intake must carry source only — `node_modules/` and `dist/` exist in the owner's folder and must not enter git.
- The reference is not product: FV2-G's facts-bundle refusal applies to `face/src/**`, not to the reference folder.
- ADR-1308's blind-exploration process does not run for v0.7: the owner supplied the finished design. Its clause that tokens flow from the repo, never the reverse, stands; the generated-copy rule this cycle cites as "ADR-1308" is enforced by `.claude/scripts/core/face-tokens.mjs`, not written in ADR-1308's text.
