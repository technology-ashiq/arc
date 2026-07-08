#!/usr/bin/env bash
# review-ledger.sh -- arc- enforcement moat
# Tracks which reviews have PASSED against the current commit SHA, so /arc-ship
# can be BLOCKED until the required set is green. Enforced version of gstack's
# advisory "Review Readiness Dashboard".
#
# Ledger: .claude/state/reviews/<SHA>.txt, one review-kind per line. Keyed by
# HEAD, so a NEW commit resets the ledger -> new code always requires re-review.
#
# Usage:
#   review-ledger.sh stamp   <kind>       # record kind=passed for HEAD
#   review-ledger.sh unstamp <kind>       # remove a stamp
#   review-ledger.sh check   <kind>       # exit 0 if stamped, 1 if not
#   review-ledger.sh require <k1,k2,...>  # exit 0 if ALL stamped; else exit 2 (BLOCK)
#   review-ledger.sh status               # print stamped kinds for HEAD
#
# Kinds: code security qa design docs
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
LEDGER_DIR="$ROOT/.claude/state/reviews"
SHA="$(git rev-parse --short HEAD 2>/dev/null || echo 'no-git')"
LEDGER="$LEDGER_DIR/$SHA.txt"
VALID_KINDS="code security qa design docs"
mkdir -p "$LEDGER_DIR"

_is_valid() { case " $VALID_KINDS " in *" $1 "*) return 0;; *) return 1;; esac; }
_cmd_for() {
  case "$1" in
    code) echo "/arc-review";; security) echo "/arc-audit";;
    qa) echo "/arc-qa";; design) echo "/arc-design";; docs) echo "/arc-docs";;
    *) echo "/arc-$1";;
  esac
}

cmd="${1:-status}"; kind="${2:-}"
case "$cmd" in
  stamp)
    _is_valid "$kind" || { echo "review-ledger: unknown kind '$kind' (valid: $VALID_KINDS)" >&2; exit 1; }
    touch "$LEDGER"
    grep -qxF "$kind" "$LEDGER" 2>/dev/null || echo "$kind" >> "$LEDGER"
    echo "review-ledger: stamped '$kind' for $SHA"
    ;;
  unstamp)
    if [ -f "$LEDGER" ]; then
      grep -vxF "$kind" "$LEDGER" > "$LEDGER.tmp" 2>/dev/null || true
      mv "$LEDGER.tmp" "$LEDGER"
    fi
    echo "review-ledger: unstamped '$kind' for $SHA"
    ;;
  check)
    if [ -f "$LEDGER" ] && grep -qxF "$kind" "$LEDGER" 2>/dev/null; then exit 0; fi
    exit 1
    ;;
  require)
    IFS=',' read -r -a needed <<< "$kind"
    missing=()
    for k in "${needed[@]}"; do
      k="$(echo "$k" | tr -d '[:space:]')"; [ -z "$k" ] && continue
      if ! { [ -f "$LEDGER" ] && grep -qxF "$k" "$LEDGER" 2>/dev/null; }; then missing+=("$k"); fi
    done
    if [ "${#missing[@]}" -gt 0 ]; then
      echo "BLOCKED: required reviews not run on $SHA -- missing: ${missing[*]}" >&2
      hint=""; for k in "${missing[@]}"; do hint="$hint $(_cmd_for "$k")"; done
      echo "Run them first:$hint" >&2
      exit 2
    fi
    exit 0
    ;;
  status)
    if [ -f "$LEDGER" ] && [ -s "$LEDGER" ]; then
      printf 'reviews @ %s: ' "$SHA"; tr '\n' ' ' < "$LEDGER"; echo
    else
      echo "reviews @ $SHA: (none)"
    fi
    ;;
  *)
    echo "usage: review-ledger.sh {stamp|unstamp|check|require|status} [kind]" >&2; exit 1;;
esac
