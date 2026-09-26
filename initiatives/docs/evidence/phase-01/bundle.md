# Phase 01 evidence — the coverage gate, before any renderer

Lane `docs`, Cycle 17. PR #277, branch `feat/arc-docs-p01`. Approved to start by
`decision.recorded` `01M3C9B6HNR9TTACHMCGBJ2E7D`.

## Day-3 kill checkpoint — does `--mutant-selftest` fail closed?

**Yes.** Six arms, run through `collect()` — the same path the CLI takes — against scratch page
trees written from the real tree's own wiki: M0 covered (exit 0); M1 unknown product + unknown
lane, M2 orphan page, M3 orphan narrative, M4 inventories cut to nothing, M5 a page directory the
wiki does not define — each exit 1 naming exactly what was planted. Green on ubuntu, macOS and
Windows (run `36141361740`). The test was attacked as well as the rule: a copy of the gate with
`reverseFindings` cut lets the orphan through, and a copy whose `coverageFindings` finds nothing
fails its own self-test on arms M1–M5 by name. The cycle proceeds to the renderer.

## Red first, then green (CI, read per job)

| Run | Head | What it proves |
|---|---|---|
| `36136673617` | `71f662ae` (tests only) | Every `docs-coverage` test red on all three OS legs; nothing else red. |
| `36141361740` | `c63d4411` | **19 of 19 jobs success**, head SHA confirmed. `docs-coverage` 19 tests, `docs-extract` 19 tests (symlink and device-name cases skip on Windows by design). |

One push (`e425d232`) went out with `wiki-coverage.mjs` missing from the product manifest;
`product-lint` caught it locally right after the push, the run was cancelled before it consumed
a runner cycle, and the fix is `c63d4411` (recorded in `fixed-defects.md`).

## Live demo

`demo.txt`: the self-test's six arms and `ran 6 of 6`; then the gate on the REAL tree, where no
page exists yet — it exits 1 naming all 129 entities (17 products, 17 lanes, 8 processes,
15 ADR bands, 28 commands, 30 agents, 7 rules, 7 gates), the fix command on its first line.

## Adversarial pass (DOC-K)

| Round | File | Result |
|---|---|---|
| 1 | `attack-8bc7826-r1-boundary.json` | 14 findings (1 high, 7 medium, 6 low): 13 fixed in `f3b311da`, 1 low to the ledger |
| 2 | `attack-f3b311d-r2-boundary.json` | 11 findings (1 high, 3 medium, 7 low): high + mediums + 1 low fixed in `1f27a811`, 5 low to the ledger. The first round-2 try was stopped by the secret guard on the attacker's own output; the retry ran. |

Round 2's high was a crash the round-1 fix introduced on exactly the input its own test built.
**The logic surface did not run** (round 1 transport failure on the same free trial model, so
round 2 had nothing to follow) — the standing gap from Phase 00, in `debt-ledger.md`.

## Shard weights (measured, Windows shard of `36141361740`)

`docs-coverage.bats` 34 s (new) · `docs-extract.bats` 40 s (was 38, grew by four tests).
