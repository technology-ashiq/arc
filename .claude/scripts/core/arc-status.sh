#!/usr/bin/env bash
# arc-status.sh -- the read-only /arc orchestrator dashboard.
# Phase 0: file-presence detection. Phase 2: reads .claude/arc-registry.json instead.
# Never writes -- "the script is the gate, prose isn't" (arc-resume pattern).
#
# Usage: bash arc-status.sh [root-dir]   (default: the repo this script lives in)
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# git first, `..` chain only as the fallback: the fixed depth was correct for
# .claude/scripts/ and broke when Phase 03 moved this into .claude/scripts/core/.
ROOT="${1:-$(git rev-parse --show-toplevel 2>/dev/null || (cd "$HERE/../../.." && pwd))}"
exec node "$HERE/arc-products.mjs" --status --root "$ROOT"
