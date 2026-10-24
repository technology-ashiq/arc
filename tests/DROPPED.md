# Dropped tests

Bats tests deleted with no replacement. `ci-floor.mjs` subtracts one floor slot per row.

| test | status | reason |
|---|---|---|
| root-golden: SessionEnd writes a byte-stable session-log entry | DROPPED | tests a deleted hook: SessionEnd.d/00-session-log.sh retired (ci REQ-11, ADR-2212) |
| root-golden: SessionEnd writes nothing inside a headless arc-run driver run | DROPPED | tests a deleted hook: SessionEnd.d/00-session-log.sh retired (ci REQ-11, ADR-2212) |
