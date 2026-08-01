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
# -C "$HERE" so the answer is this script's repo, not the caller's cwd's repo.
ROOT="${1:-$(git -C "$HERE" rev-parse --show-toplevel 2>/dev/null || (cd "$HERE/../../.." && pwd))}"
node "$HERE/arc-products.mjs" --status --root "$ROOT"

# Spooled receipts (REQ-04). Composed here in the shell rather than read by arc-products.mjs,
# so a core script never opens events/ itself -- the spine stays the only way to ask the spine
# (ADR-0030). `spine pending` prints one line when the spool is non-empty and NOTHING when it
# is empty, which is what keeps an idle dashboard idle.
#
# Never fatal: this is a read-only dashboard, and a spine that cannot answer must not turn a
# status call into a failure. `set -e` is live, hence the guard.
if [ -f "$ROOT/.claude/scripts/hq/spine.mjs" ]; then
  node "$ROOT/.claude/scripts/hq/spine.mjs" pending 2>/dev/null || true
fi
