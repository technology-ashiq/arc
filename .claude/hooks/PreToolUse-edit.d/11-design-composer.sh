#!/usr/bin/env bash
# design -- ui-composer WRITE boundary (PreToolUse/Edit|Write|MultiEdit). No-op unless an
# explore run armed a marker under .claude/state/design/. exit 2 = block a composer write
# outside its own variant directory.
#
# WHY THIS EXISTS. ADR-1415 gave the composer a READ boundary and left `Write` unbounded, and a
# fresh adversarial pass walked straight through the gap: blocked from READING variant-b, the
# composer wrote the marker that constrains it and then read variant-b. It can equally rewrite
# composer-scope-check.sh itself. A read boundary whose constrained party can rewrite the
# constraint is Cycle 7's propose-only guard again -- the mutant IS the negative control.
#
# Same shape as 10-design-critic.sh: the fragment stays thin, the logic lives in a script, and
# a missing script fails OPEN rather than breaking the session.
set -uo pipefail
SC="${CLAUDE_PROJECT_DIR:-.}/.claude/scripts/design/composer-write-check.sh"
[ -f "$SC" ] || exit 0
# Tell the scope check that whatever follows came from a tool payload, not from an operator --
# without this a write to a path named "--end" would be honoured as a control verb.
ARC_SCOPE_FORWARDED=1 exec bash "$SC" "$@"
