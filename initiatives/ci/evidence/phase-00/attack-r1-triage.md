# Attack round 1 triage (`c9aab1d`, 2026-10-24)

Boundary: claude-code (router class attack-diff), 11 findings. Logic: `deepseek/deepseek-v4-flash-0731` direct on OpenRouter, reasoning off, 15 findings in 32 s. The first logic attempt used the env default `qwen/qwen3.8-27b:free` and failed with HTTP 400.

**Fixed** (fixed-defects i-n): B1/L6, B2, B3/L4, B4, B6, B7/L2, B8, L1, L13 (critical: sha256-pinned tool downloads).
**Debt ledger** (LOW): B9, B11, L11 -> D1-D3. B10 is L13, fixed.

REJECTED: B5 shard exit drops the reconcile result — already-covered (the reconcile prints before the exit, and both nonzero paths fail)
REJECTED: L3 DROPPED reason containing a pipe — non-actionable (any non-empty reason satisfies the rule)
REJECTED: L5 an empty diff fails open — already-covered (deliberate, fixed-defect b)
REJECTED: L7 lanes with .count but zero test files fail — already-covered (deliberate fail-closed)
REJECTED: L8 a cancelled shard fails the aggregator — already-covered (a superseded run is cancelled by design)
REJECTED: L9 a test body printing "ok " inflates executed — unsupported (bats prints test output only on failure, prefixed "# ")
REJECTED: L10 shard index validation — non-actionable (the finding concludes it is safe)
REJECTED: L12 ci-gate arms that do not all assert output — non-actionable (the command always prints)
REJECTED: L14 "face/../docker" traversal in --files — unsupported (the workflow feeds git-normalised paths only)
