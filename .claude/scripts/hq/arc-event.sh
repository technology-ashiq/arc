#!/usr/bin/env bash
# arc-event -- thin wrapper over arc-event.mjs. All logic lives in Node (one validator core,
# ADR-0031); this file exists so hook fragments have a shell entry point, and so that NO
# failure of the Node side -- missing interpreter, missing library, syntax error, crash --
# can ever block a session in hook mode.
#
# bash-3.2 / POSIX-safe: no arrays, no case-modifying expansions, no GNU-only flags
# (macOS BSD leg). Note the portability lint greps raw text, so naming a forbidden
# construct literally here would flag this file -- describe them, do not spell them.
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
NODE_BIN="${ARC_NODE:-node}"

# Strict detection must WALK the command line, not grep it. Scanning every argument meant a
# flag VALUE of "ingest" turned a hook into a session-blocking exit 2, and a payload
# containing the text --strict did the same.
_arc_strict=0
_arc_expect_value=0
_arc_first_positional=""
for _arc_arg in "$@"; do
  if [ "$_arc_expect_value" -eq 1 ]; then
    _arc_expect_value=0
    continue
  fi
  case "$_arc_arg" in
    --strict|--strict=*)
      _arc_strict=1 ;;
    --payload|--payload-file|--event-file|--json|--actor|--process|--model|--venture|--run-id|--outcome|--evidence|--supersedes|--idem|--cost|--date)
      _arc_expect_value=1 ;;
    --*)
      ;;
    *)
      if [ -z "$_arc_first_positional" ]; then _arc_first_positional="$_arc_arg"; fi ;;
  esac
done
if [ "$_arc_first_positional" = "ingest" ]; then _arc_strict=1; fi

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

"$NODE_BIN" "$HERE/arc-event.mjs" "$@"
_arc_code=$?

# Strict mode reports the truth, whatever it is.
if [ "$_arc_strict" -eq 1 ]; then
  exit "$_arc_code"
fi

# Hook mode: the emitter's own handler already converts its errors to exit 0. Anything else
# reaching here is a failure BELOW that handler -- a deleted or truncated lib/*.mjs, an
# out-of-memory kill -- which would otherwise surface to the user as a raw stack trace and a
# non-zero hook. Absorb it.
if [ "$_arc_code" -ne 0 ]; then
  echo "arc-event: SKIP RUNTIME -- emitter exited $_arc_code, event not recorded (session unaffected)" >&2
  exit 0
fi
exit 0
