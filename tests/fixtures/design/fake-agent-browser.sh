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
#
# ADR-1418 (explore renders are confined to their variant directory). The fake cannot run a
# page, so it plays the page's REQUESTS against the loopback server the renderer opened:
#   FAKE_AB_FETCH       space-separated paths requested from the opened origin on `open`, sent
#                       with --path-as-is so raw `..` reaches the server. Bodies land in
#                       $FAKE_AB_STATE/fetch-N.body, status codes in $FAKE_AB_STATE/fetch-codes
#   FAKE_AB_CSP_REPORT  a JSON body POSTed to /__arc/csp-report, as a browser reports a
#                       blocked load
#   FAKE_AB_URL         what `get url` prints instead of the opened URL (a page that navigated)
#   FAKE_AB_URL_APPEND  appended to the opened URL by `get url` (a same-page hash change)
#   FAKE_AB_TABS        how many tabs `tab` lists (default 1)
# Always recorded: the opened URL ($FAKE_AB_STATE/url), the served headers of an http page
# ($FAKE_AB_STATE/headers), and every `set` command's arguments ($FAKE_AB_STATE/set).
set -uo pipefail

# Drop the global flags design-render.sh always passes.
while [ "$#" -gt 0 ]; do
  case "$1" in
    # The `|| break` matters: `shift 2` on a single remaining arg fails silently under
    # `set -u`-without-`-e`, the loop never advances, and a test fixture hangs a CI leg.
    # (That rule lived HERE and not in the script this fakes, until 2026-08-23.)
    --session)
      [ "$#" -ge 2 ] || break
      # Record which session each invocation was given. Without this the suite could not
      # observe session isolation at all: the fixture simply DROPPED the flag, so deleting
      # `--session "$SESSION"` from design-render.sh left every test green while the whole
      # point of ADR-1402 was gone. A headline acceptance that cannot fail is not one.
      [ -n "${FAKE_AB_STATE:-}" ] && { mkdir -p "$FAKE_AB_STATE" 2>/dev/null || true; printf '%s
' "$2" >> "$FAKE_AB_STATE/sessions"; }
      FAKE_SESSION="$2"
      shift 2;;
    *) break;;
  esac
done

CMD="${1:-}"; shift 2>/dev/null || true

# The opened URL is kept PER SESSION as well, because a real browser session answers `get url`
# for itself. One shared file let three concurrent explore renders read each other's loopback
# port and refuse one another as "navigated away" (macOS leg, run 35186056146). `url` stays as
# the last URL opened in any session, for single-render cases to read.
_url_file() { printf '%s/url.%s' "$FAKE_AB_STATE" "${FAKE_SESSION:-default}"; }
_state_url() { [ -n "${FAKE_AB_STATE:-}" ] && [ -f "$(_url_file)" ] && cat "$(_url_file)"; }

case "$CMD" in
  set)
    # Arguments recorded one command per line, so a stray token is observable: a literal `\n`
    # inside design-render.sh once turned `set media light` into `set media light n`.
    [ -n "${FAKE_AB_STATE:-}" ] && { mkdir -p "$FAKE_AB_STATE" 2>/dev/null || true; printf '%s\n' "$*" >> "$FAKE_AB_STATE/set"; }
    exit 0;;
  close)  exit 0;;
  open)
    [ -n "${FAKE_AB_OPEN_FAIL:-}" ] && exit 1
    URL="${1:-}"
    [ -n "${FAKE_AB_STATE:-}" ] || exit 0
    mkdir -p "$FAKE_AB_STATE" 2>/dev/null || true
    printf '%s' "$URL" > "$FAKE_AB_STATE/url"
    printf '%s' "$URL" > "$(_url_file)"
    case "$URL" in
      http://*)
        rest="${URL#http://}"
        ORIGIN="http://${rest%%/*}"
        curl -s --max-time 10 -D "$FAKE_AB_STATE/headers" -o "$FAKE_AB_STATE/page.body" "$URL" >/dev/null 2>&1 || true
        i=0
        for p in ${FAKE_AB_FETCH:-}; do
          i=$((i + 1))
          curl -s --max-time 10 --path-as-is -o "$FAKE_AB_STATE/fetch-$i.body" -w '%{http_code}\n' \
            "$ORIGIN$p" >> "$FAKE_AB_STATE/fetch-codes" 2>/dev/null || echo "000" >> "$FAKE_AB_STATE/fetch-codes"
        done
        if [ -n "${FAKE_AB_CSP_REPORT:-}" ]; then
          curl -s --max-time 10 -o /dev/null -X POST -H 'Content-Type: application/csp-report' \
            --data "$FAKE_AB_CSP_REPORT" "$ORIGIN/__arc/csp-report" >/dev/null 2>&1 || true
        fi
        ;;
    esac
    exit 0
    ;;
  tab)
    # The real CLI's shape, measured 2026-09-17 on agent-browser 0.31.1: one line per tab, the
    # active one marked with an arrow, e.g. `→ [t2]  - ` after a popup took focus.
    n="${FAKE_AB_TABS:-1}"
    u="$(_state_url)"
    i=1
    while [ "$i" -le "$n" ]; do
      if [ "$i" -eq "$n" ]; then pre="→ "; else pre="  "; fi
      printf '%s[t%s] page - %s\n' "$pre" "$i" "$u"
      i=$((i + 1))
    done
    exit 0
    ;;
  eval)
    printf '%s\n' "${FAKE_AB_SETTLE-arc-determinism:applied=1:painted=1:h=1200}"
    exit 0
    ;;
  get)
    if [ "${1:-}" = "url" ]; then
      if [ -n "${FAKE_AB_URL+x}" ]; then
        printf '%s\n' "$FAKE_AB_URL"
      else
        printf '%s%s\n' "$(_state_url)" "${FAKE_AB_URL_APPEND:-}"
      fi
      exit 0
    fi
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
