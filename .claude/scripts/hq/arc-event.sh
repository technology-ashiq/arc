#!/usr/bin/env bash
# arc-event -- thin wrapper over arc-event.mjs. All logic lives in Node (one validator core,
# ADR-0031); this file exists so hook fragments have a shell entry point and so a missing or
# broken Node interpreter still cannot block a session.
#
# bash-3.2 / POSIX-safe: no arrays, no ${var,,}, no GNU-only flags (macOS BSD leg).
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
NODE_BIN="${ARC_NODE:-node}"

# Is this a strict invocation? Scan the args without consuming them.
_arc_strict=0
for _arg in "$@"; do
  case "$_arg" in
    --strict) _arc_strict=1 ;;
    ingest)   _arc_strict=1 ;;
  esac
done

if ! command -v "$NODE_BIN" >/dev/null 2>&1; then
  # Strict callers (CI, ingest, tests) must hear about it. Hook callers must not: a missing
  # interpreter is an environment problem, never a reason to fail somebody's session.
  if [ "$_arc_strict" -eq 1 ]; then
    echo "arc-event: REJECT NO_NODE -- node not found on PATH (set ARC_NODE)" >&2
    exit 2
  fi
  echo "arc-event: SKIP NO_NODE -- node not found on PATH, event not recorded" >&2
  exit 0
fi

exec "$NODE_BIN" "$HERE/arc-event.mjs" "$@"
