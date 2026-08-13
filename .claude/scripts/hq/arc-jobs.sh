#!/usr/bin/env bash
# arc-jobs -- thin wrapper over arc-jobs.mjs. All logic lives in Node (one enforcement path,
# ADR-0031); this file exists so the OS scheduler and shell callers have an entry point.
#
# UNLIKE arc-event.sh, THIS HAS NO HOOK MODE AND ABSORBS NOTHING. arc-event swallows its own
# failures because a telemetry emitter must never block a human's session. A job runner is the
# opposite: its exit code IS the signal Task Scheduler records as LastTaskResult, and that is
# the only OS-side evidence a run failed. Turning a crash into exit 0 here would make a dead
# heartbeat indistinguishable from a healthy one -- the exact failure REQ-05 exists to detect.
#
# bash-3.2 / POSIX-safe: no arrays, no case-modifying expansions, no GNU-only flags (macOS BSD
# leg). Note the portability lint greps raw text, so naming a forbidden construct literally here
# would flag this file -- describe them, do not spell them.
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
NODE_BIN="${ARC_NODE:-node}"

if ! command -v "$NODE_BIN" >/dev/null 2>&1; then
  echo "arc-jobs: node not found on PATH (set ARC_NODE) -- no job was run" >&2
  exit 2
fi

"$NODE_BIN" "$HERE/arc-jobs.mjs" "$@"
exit $?
