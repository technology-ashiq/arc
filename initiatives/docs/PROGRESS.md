# PROGRESS.md — docs v1 "arc's own reference, generated"

status: LIVE
cycle: arc-docs (Cycle 17, opened 2026-09-25)
phase: 02
appetite: 6.5d
burn: 2d
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
| 00 | Steel thread — the extractor: ruling on the spine, `docs` product born, additive `treeWorld` export, `wiki-build --json` → `wiki.json`, REQ-09 import scan + mutant | 1.5d | ✅ 2026-09-25 |
| 01 | The coverage gate before any renderer — `wiki-coverage` both directions, FAIL-FROM-BIRTH, `--mutant-selftest` M0–M4; **day-3 kill checkpoint** | 1.5d | ✅ 2026-09-25 |
| 02 | The renderer — `docs/wiki/**`, banners, regenerate-and-diff, REQ-04 fixture product; the four overlapping docs stubbed + archived | 1d | in progress |
| 03 | Drift BLOCK + stale WARN + `--audit-counts`; three narratives (hand-written or absent); retro and seal | 1.5d | pending |

## Done-log

_(empty — nothing closed yet)_

**Phase 00 — closed 2026-09-25.** `wiki-build --json` turns the tree into one deterministic `wiki.json` over eight entity types, reading what exists ONLY through face-coverage's new `treeWorld` export (ADR-1501) and one named file per entity. Evidence: `initiatives/docs/evidence/phase-00/bundle.md`.

- **CI:** red first on all three OS legs (run `36121696244`, tests-only commit), then **19/19 green** at PR head `33e47f99` (`36127560286`) and **19/19 on merged `main` `f32d8957`** (dispatch `36132146108`). 18 tests in `tests/docs-extract.bats` (2 symlink cases skip on Windows by design), measured weight 38 s.
- **The ruling is on the spine:** `decision.recorded` `01M3C6WQ3XA2XAGS7KCE6A9JVR` (A-08 discharged).
- **Attack:** boundary surface, two rounds, 27 findings — 22 fixed and pinned, 5 LOW in `debt-ledger.md`. **The logic surface NEVER RAN**: the free trial model answered 503 (round 1) and 429 (a direct retry on the merged diff). Owner ruled 2026-09-25: close with the gap recorded; the next working logic round covers this diff too.
- **CI caught what no attacker did:** a `sed` edit left `expected-set.json` out of canonical key order and turned three face-dash ring tests red (fixed-defects.md).
- **A-02 FIRED as written** (65 of 308 ADRs carry no Product line; the count is printed, never hidden). A-03, A-06, A-07 held.
- Time: 1d of 1.5d appetite. `amendments: 0` · `reopened: n` · `t-to-phase0: 0 days` (kickoff and close the same day).

**Phase 01 — closed 2026-09-25.** `wiki-coverage.mjs` fails, naming it, on an entity with no page AND on a page, page directory or narrative with no entity; an empty inventory is never covered. **Day-3 kill checkpoint: YES, `--mutant-selftest` fails closed** — six arms (M0 covered, M1–M5 each FAIL naming the plant) through the CLI's own `collect()`, green on all three OS legs; the TEST was attacked too (reverse-direction-cut and find-nothing gate copies). The cycle proceeds. Evidence: `initiatives/docs/evidence/phase-01/bundle.md`.

- **CI:** red first (`36136673617`, only `docs-coverage`), then **19/19** at `c63d4411` (`36141361740`). 19 tests in `tests/docs-coverage.bats` (34 s on Windows), 19 in `docs-extract` (40 s).
- **Attack:** boundary, two rounds, 25 findings — 19 fixed, 6 LOW to the ledger. Round 2's high was a crash the round-1 fix introduced on its own test input. **Logic surface did not run** (transport), the standing gap.
- **Refinements at build, in the spec:** a sixth arm (M5, directories); arms run in-process through `collect()` because the DOC-A scan forbids `child_process`; the always-exit-0 stub commit replaced by two gate mutants inside the suite.
- One push went out without the new script's manifest line; `product-lint` caught it, the run was cancelled, fixed in `c63d4411`.
- Time: ~1d of 1.5d. `amendments: 0` · `reopened: n`.

## Appetite burn

2 of 6.5 days used (Phase 00 1d of 1.5d · Phase 01 ~1d of 1.5d). Day-3 checkpoint passed on day 2. (5.5 planned · 1 slack). Day-3 checkpoint: end of Phase 01.

## Now

**Current position →** Phase 01 ✅ 2026-09-25 (day-3 kill checkpoint: fails closed — proceed). Phase 02 open: the renderer.
**Next step →** red-first `tests/docs-render.bats` (regenerate-and-diff, one-byte-edit mutant, REQ-04 fixture product), then pages under `docs/wiki/`, then REQ-08: the four overlapping docs stubbed in place with archived copies and the strategy file map, same commit.
