# Phase 04 live demo -- the loop, run for real, outputs verbatim

Captured 2026-08-10 on the closing tree. Every block below is the actual stdout of the command
above it, pasted unedited. Nothing here is a transcription of what a command would have said.

## 1. The rebuild survives its own allowlist gate

```
$ node .claude/scripts/absorb/rebuild-lint.mjs --paths <the two rebuild paths> \
    --allowlist products/absorb/allowlist.txt --root . --license none
rebuild-lint: 0 warnings (2 of 2 paths parsed, against 4 allowlist patterns)
```

## 2. The A/B, deterministic, on fixtures chosen by an agent blind to the rebuild

```
$ node .claude/scripts/absorb/ab-run.mjs --fixtures tests/fixtures/absorb/finding-verification
ab-run: 3 fixture(s), 22 candidate(s)
  truth split                          true 14 / false 8
  PRIMARY unresolvable-false-in-main   OLD 3 -> NEW 0   (reduction 3)
  SECONDARY true-in-appendix           OLD 0 -> NEW 6   (cost, not loss)
  GATE     true-lost                   0   (must be 0)
  excluded supported-false-in-main     5   (byte-match cannot catch; not claimed)
  bucket   near-miss-demoted           2   (reviewer error, one re-cite away)
  --- composition: NOT part of the pass condition, reported because it complicates it ---
  main report OLD  22 findings  14 true / 8 false  precision 63.6%
  main report NEW  13 findings  8 true / 5 false  precision 61.5%  (delta -2.1 pts)
  removed from main 6 TRUE + 3 false -- NEW removes more truth than falsehood in absolute terms
ab-run: VERDICT NEW-WINS  (on the PRE-COMMITTED pass condition; read the composition line before believing it means "better")
  01-release-tag-shell/F1  truth=true  quote=yes resolves=yes match=yes OLD=main NEW=main
... (per-candidate rows follow; full table in the --json output)
```

## 3. The seal verifies against its commitment

```
$ node .claude/scripts/absorb/judgement.mjs verify --correlation PHASE04-T01
judgement: OK -- 0169fd065351f99d945a2ef00f7ee56f14e782ce48c203693120db02f7866e5c
```

## 4. The registry row, and its lint

```
$ node .claude/scripts/absorb/registry-ref.mjs products/absorb/registry.json .claude/scripts/develop/capability-lock.json
registry-ref: 0 warnings (1 row checked against 1 lock entry)
```
