# Attack round 2 triage (`4e32cb7`, 2026-10-24) — the last round (cap: two per PR)

Boundary 6 findings; logic (`deepseek/deepseek-v4-flash-0731`, 2nd attempt — the 1st failed behind the worktree spine warning) 15 findings.

**Fixed:** B1/L4/L7 (node-test asserts the reported total >= the sum of `.count`; per-lane is migrate-guard, Phase 02), B3 (`--no-renames`), B4 (a change to `ci.yml`/`ci-changes.mjs` runs face + ci-tier), B5 (`find -type f`), B6/L3 (a test dropped twice is refused).
**Debt:** L13 -> D3 (already), L14 -> D4, L15 -> D5.

REJECTED: B2 above-floor exits 0 and the floor can rot — already-covered (CI-H/ADR-2202: a shared number would make parallel lane PRs conflict; the printed raise is the review signal)
REJECTED: L1 fewer than 4 bats files leaves shards empty — non-actionable (243 files; an empty shard already fails closed)
REJECTED: L2 reconcile counts tests, not assertions — already-covered (assertion density is a migrate-guard guard, Phase 02)
REJECTED: L5 --files splits on CRLF — non-actionable (the list is one path per line by contract)
REJECTED: L6 flag parser takes the next token — already-covered (a flag-shaped base fails cat-file, so the filter fails open)
REJECTED: L8 a malformed `face = false` output line — unsupported (the script prints `k=v` only)
REJECTED: L9 a body-printed `not ok` inflates executed — unsupported (bats prints test output only on failure, prefixed "# ")
REJECTED: L10 a symlinked file read by walk — unsupported (Dirent.isFile() is false for a symlink)
REJECTED: L11 a head that is an ancestor of base gives an empty diff — already-covered (empty fails open)
REJECTED: L12 the empty-shard test arm — non-actionable
