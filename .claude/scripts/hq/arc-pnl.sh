#!/usr/bin/env bash
# arc-pnl -- thin wrapper over arc-pnl.mjs. All logic lives in Node (one derivation core), and
# this file exists so a shell caller has an entry point.
#
# UNLIKE arc-event.sh THERE IS NO HOOK MODE HERE. arc-event absorbs its own failures because a
# missing interpreter must never block somebody's session. arc-pnl is a READER of money: a run
# that cannot produce a P&L must say so and exit non-zero, because the one thing worse than no
# number is a missing number that looked like a clean run.
#
# bash-3.2 / POSIX-safe: no arrays, no case-modifying expansions, no GNU-only flags (macOS BSD leg).
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
NODE_BIN="${ARC_NODE:-node}"

if ! command -v "$NODE_BIN" >/dev/null 2>&1; then
  echo "arc-pnl: ERROR NO_NODE -- node not found on PATH (set ARC_NODE)" >&2
  exit 2
fi

"$NODE_BIN" "$HERE/arc-pnl.mjs" "$@"
exit $?
