# PROGRESS.md — docs v1 "arc's own reference, generated"

status: LIVE
cycle: arc-docs (Cycle 17, opened 2026-09-25)
phase: 00
appetite: 6.5d
burn: 0d
blocked-on: —
depends-on: —

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green on CI + live demo + exit criteria + evidence). Evidence is lane-scoped at
> `initiatives/docs/evidence/phase-NN/` (ADR-0055). ADRs, the retro-log, HISTORY and the
> trial-ledger stay at repo root (ADR-0053). This lane holds ADR century **1500–1599**;
> ADR-1500..1512 are written.

## Phases

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Steel thread — the extractor: ruling on the spine, `docs` product born, additive `treeWorld` export, `wiki-build --json` → `wiki.json`, REQ-09 import scan + mutant | 1.5d | pending |
| 01 | The coverage gate before any renderer — `wiki-coverage` both directions, FAIL-FROM-BIRTH, `--mutant-selftest` M0–M4; **day-3 kill checkpoint** | 1.5d | pending |
| 02 | The renderer — `docs/wiki/**`, banners, regenerate-and-diff, REQ-04 fixture product; the four overlapping docs stubbed + archived | 1d | pending |
| 03 | Drift BLOCK + stale WARN + `--audit-counts`; three narratives (hand-written or absent); retro and seal | 1.5d | pending |

## Done-log

_(empty — nothing closed yet)_

**Phase 00 notes (in flight).** A-02 FIRED as written: of 308 ADRs, 65 carry no `**Product:**` line (all predate ADR-0053), 16 no Reversibility, 3 no Status/Date. Per its trigger the parse is reported partial and the count is printed by `wiki-build` and carried in `wiki.json` `stats.adrs.unparsed`, never hidden. The first ADRs wrote the date into the status line (`accepted · 2026-07-09`); that declared date is read. A-03 held: all 17 PROGRESS headers parse.

## Appetite burn

0 of 6.5 days used (5.5 planned · 1 slack). Day-3 checkpoint: end of Phase 01.

## Now

**Current position →** plan **APPROVED 2026-09-25** (`decision.recorded` `01M3BZPEC91SSZ4DCGS7KCFY9B`, deciding approval `01M3BV13NXSWEX377NVVRHWCHW`, verified on the canonical spine, not quarantined). Phase 00 open. **Next step →** record the 2026-09-18 ruling on the spine (owner keystroke), red-first `tests/docs-extract.bats`, then the `treeWorld` export commit.
