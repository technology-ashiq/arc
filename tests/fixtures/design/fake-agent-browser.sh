#!/usr/bin/env bash
# Fake agent-browser -- emulates ONLY the slice design-render.sh drives, so the render
# script's guards can be tested on every CI leg. CI installs no browser (ci.yml), so a
# determinism test that needed a real one would skip everywhere and guard nothing.
#
# It cannot fake a browser's judgment; it fakes the exact thing issue #57 was about -- what
# comes back from two consecutive captures.
#
# Driven by env:
#   FAKE_AB_STATE   dir holding the screenshot counter (required)
#   FAKE_AB_SHOTS   space-separated payloads, one consumed per screenshot call, in order.
#                   Equal payloads hash equal, so "A A" is a stable shutter and "A B" is #57.
#                   Past the end of the list the last payload repeats.
#   FAKE_AB_SETTLE  what `eval` prints (default: rules applied and painted)
#   FAKE_AB_TEXT    what `get text body` prints (default: long enough to clear the blank guard)
#   FAKE_AB_OPEN_FAIL  non-empty makes `open` fail
set -uo pipefail

# Drop the global flags design-render.sh always passes.
while [ "$#" -gt 0 ]; do
  case "$1" in
    # The `|| break` matters: `shift 2` on a single remaining arg fails silently under
    # `set -u`-without-`-e`, the loop never advances, and a test fixture hangs a CI leg.
    --session) [ "$#" -ge 2 ] || break; shift 2;;
    *) break;;
  esac
done

CMD="${1:-}"; shift 2>/dev/null || true

case "$CMD" in
  set)    exit 0;;
  close)  exit 0;;
  open)
    [ -n "${FAKE_AB_OPEN_FAIL:-}" ] && exit 1
    exit 0
    ;;
  eval)
    printf '%s\n' "${FAKE_AB_SETTLE-arc-determinism:applied=1:painted=1:h=1200}"
    exit 0
    ;;
  get)
    # design-render.sh calls: get text body. The default must clear its 200-char blank-page
    # guard. Built without `seq` (not POSIX) so the fixture has no tool dependency of its own.
    # Note the `-` (not `:-`): FAKE_AB_TEXT="" deliberately yields empty, which is how a test
    # drives the blank-page refusal.
    DEFAULT_TEXT=""
    n=0
    while [ "$n" -lt 40 ]; do DEFAULT_TEXT="${DEFAULT_TEXT}xxxxxxxxxx"; n=$((n + 1)); done
    printf '%s\n' "${FAKE_AB_TEXT-$DEFAULT_TEXT}"
    exit 0
    ;;
  screenshot)
    OUTPATH="${1:-}"
    [ -n "$OUTPATH" ] || exit 1
    STATE="${FAKE_AB_STATE:-}"
    [ -n "$STATE" ] || exit 1
    mkdir -p "$STATE" 2>/dev/null || true
    N=0
    [ -f "$STATE/count" ] && N="$(cat "$STATE/count" 2>/dev/null || echo 0)"
    case "$N" in ''|*[!0-9]*) N=0;; esac
    N=$((N + 1))
    printf '%s' "$N" > "$STATE/count"
    # Pick the Nth payload without arrays (bash-3.2 / POSIX-safe, same rule as the script).
    i=0; PICK=""
    for tok in ${FAKE_AB_SHOTS:-A A}; do
      i=$((i + 1)); PICK="$tok"
      [ "$i" -ge "$N" ] && break
    done
    printf '%s' "$PICK" > "$OUTPATH" || exit 1
    exit 0
    ;;
  *) exit 0;;
esac
