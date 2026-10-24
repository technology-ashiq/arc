# Dropped tests

Bats tests deleted with no replacement. `ci-floor.mjs` subtracts one floor slot per row.

| test | status | reason |
|---|---|---|
| root-golden: SessionEnd writes a byte-stable session-log entry | DROPPED | tests a deleted hook: SessionEnd.d/00-session-log.sh retired (ci REQ-11, ADR-2212) |
| root-golden: SessionEnd writes nothing inside a headless arc-run driver run | DROPPED | tests a deleted hook: SessionEnd.d/00-session-log.sh retired (ci REQ-11, ADR-2212) |
| shard-tests: every discovered .bats file lands in exactly one shard, for every shard count 1..12 | DROPPED | tests a deleted script: .github/scripts/shard-tests.mjs removed (ci REQ-07, ADR-2212) |
| shard-tests: shard count 1 returns the entire suite | DROPPED | tests a deleted script: .github/scripts/shard-tests.mjs removed (ci REQ-07, ADR-2212) |
| shard-tests: more shards than files still places every file and never emits a duplicate | DROPPED | tests a deleted script: .github/scripts/shard-tests.mjs removed (ci REQ-07, ADR-2212) |
| shard-tests: the packing is deterministic -- a second run assigns identical shards | DROPPED | tests a deleted script: .github/scripts/shard-tests.mjs removed (ci REQ-07, ADR-2212) |
| shard-tests: determinism holds across every shard, not just one | DROPPED | tests a deleted script: .github/scripts/shard-tests.mjs removed (ci REQ-07, ADR-2212) |
| shard-tests: a file with no measured timing is still placed, never skipped | DROPPED | tests a deleted script: .github/scripts/shard-tests.mjs removed (ci REQ-07, ADR-2212) |
| shard-tests: every .bats file in the repo carries a measured timing (balance, not coverage) | DROPPED | tests a deleted script: .github/scripts/shard-tests.mjs removed (ci REQ-07, ADR-2212) |
| shard-tests: an unreadable timings file degrades to equal weights, never to a refusal | DROPPED | tests a deleted script: .github/scripts/shard-tests.mjs removed (ci REQ-07, ADR-2212) |
| shard-tests: refuses a zero, negative or non-numeric --total | DROPPED | tests a deleted script: .github/scripts/shard-tests.mjs removed (ci REQ-07, ADR-2212) |
| shard-tests: refuses an --index outside 1..total, at both ends | DROPPED | tests a deleted script: .github/scripts/shard-tests.mjs removed (ci REQ-07, ADR-2212) |
| shard-tests: refuses when the tests dir holds no .bats files (never emits empty shards) | DROPPED | tests a deleted script: .github/scripts/shard-tests.mjs removed (ci REQ-07, ADR-2212) |
| shard-tests: --plan balances by measured seconds, not by file count | DROPPED | tests a deleted script: .github/scripts/shard-tests.mjs removed (ci REQ-07, ADR-2212) |
| shard-tests: no .bats file hides in a subdirectory (invisible to every shard) | DROPPED | guards the deleted sharder's flat discovery; ci-bats-shard.sh finds nested files (ci REQ-07) |
