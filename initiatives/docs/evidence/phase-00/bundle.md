# Phase 00 evidence — the extractor

Lane `docs`, Cycle 17. PR #275, branch `feat/arc-docs-cycle17`.

## Red first, then green (CI, read per job)

| Run | Head | What it proves |
|---|---|---|
| `36121696244` | `90942d6d` (tests only) | All 7 `docs-extract` tests red on ubuntu, macOS and Windows: `wiki-build.mjs` absent, `treeWorld` not exported. The suite could fail before the code existed. |
| `36127560286` | `a1c0f047` | **19 of 19 jobs success**, head SHA confirmed. 18 `docs-extract` tests on each leg (2 symlink cases skipped on Windows by design). |

The first run also exposed a kickoff defect the attackers had not: a `sed` edit left
`expected-set.json` out of canonical JSON key order, and three `face-dash` ring tests went red
on two legs. Fixed in `be0294b5`, recorded in `fixed-defects.md`.

## Live demo

`demo.txt` in this folder: `wiki-build --json` over the live tree, two runs byte-identical, and
the per-type counts matching the last line `face-coverage.mjs` prints for the same tree —
17 products, 17 lanes, 8 processes, 15 ADR bands, 28 commands, 30 agents, 7 rules, 7 gates.

## Adversarial pass (DOC-K, ADR-1511)

| Round | File | Result |
|---|---|---|
| 1 | `attack-65f2423-r1-boundary.json` | 15 findings (2 high, 9 medium, 4 low), all fixed in `fb17189c` |
| 2 | `attack-fb17189-r2-boundary.json` | 12 findings (3 medium, 9 low): 3 medium + 2 low fixed in `75d4c177`, 5 low to `../../debt-ledger.md` |

**The logic surface did NOT run.** Round 1's trial model (`ARC_ATTACK_TRIAL_MODEL`, a free
OpenRouter model) returned HTTP 503 after three attempts, and round 2 requires a round-1 logic
result, so it refused. No general-purpose agent was substituted (ADR-0226). This is an open gap
in DOC-K for Phase 00, stated rather than hidden.

## Assumptions

- **A-02 FIRED as written:** 65 of 308 ADRs have no `**Product:**` line (all predate ADR-0053).
  The count is printed by `wiki-build` and carried in `wiki.json` `stats.adrs.unparsed`.
- **A-03 held:** all 17 PROGRESS headers parse.
- **A-06/A-07 held:** `face-coverage --selftest` and `tests/face-coverage.bats` green unmodified
  after the `treeWorld` export; `main` merged face's #274 mid-phase with no conflict in that file.
- **A-08 OPEN:** the 2026-09-18 ruling's approval request `01M3BZYGR7CNYE3E6D1ATC6TG2` is on the
  canonical spine, awaiting the owner's `arc-inbox approve`. Phase 00 cannot close until it is.

## Shard weight

`docs-extract.bats` = **38 s**, measured from run `36127560286`'s Windows shard (37.3 s wall for
18 tests on a passing tree), rather than a 170-job `weigh-tests` dispatch that would have queued
every other lane's CI behind it. macOS 6.5 s, ubuntu 3.7 s.
