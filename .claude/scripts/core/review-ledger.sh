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
# Kinds: scan code security qa design docs
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
LEDGER_DIR="$ROOT/.claude/state/reviews"
SHA="$(git rev-parse --short HEAD 2>/dev/null || echo 'no-git')"
LEDGER="$LEDGER_DIR/$SHA.txt"
mkdir -p "$LEDGER_DIR"

# Every review kind arc knows about -- the no-registry fallback for VALID_KINDS.
KNOWN_KINDS="scan code security qa design docs"

# Which product enables each kind. Used to derive VALID_KINDS from an install's registry
# AND to hint the right `--products` install when a kind isn't available here (REQ-08).
# review ships arc-review/arc-audit/arc-docs + the scan pipeline; qa ships arc-qa/arc-design.
_product_for_kind() {
  case "$1" in
    scan|code|security|docs) echo "review";;
    qa|design)               echo "qa";;
    *)                        echo "";;
  esac
}

# Installed products from the target's arc-registry.json (space-separated); non-zero if
# there is no registry or it doesn't parse. node does the JSON read (already an arc
# requirement); ANY failure falls through to the hardcoded fallback -- old installs unbroken.
_installed_products() {
  local reg="$ROOT/.claude/arc-registry.json"
  [ -f "$reg" ] || return 1
  command -v node >/dev/null 2>&1 || return 1
  node -e 'try{const j=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));if(j&&j.products&&typeof j.products==="object"&&!Array.isArray(j.products)){const k=Object.keys(j.products);if(!k.length)process.exit(1);process.stdout.write(k.join(" "))}else process.exit(1)}catch{process.exit(1)}' "$reg" 2>/dev/null
}

# VALID_KINDS: derived from the registry's installed products when present; else KNOWN_KINDS.
_derive_valid_kinds() {
  local prods kinds="" p
  if prods="$(_installed_products)" && [ -n "$prods" ]; then
    set -f                       # registry product keys are data, never shell globs
    for p in $prods; do
      case "$p" in
        review) kinds="$kinds scan code security docs";;
        qa)     kinds="$kinds qa design";;
      esac
    done
    set +f
    printf '%s\n' $kinds | sort -u | tr '\n' ' ' | sed 's/  */ /g;s/^ //;s/ $//'
  else
    echo "$KNOWN_KINDS"
  fi
}
VALID_KINDS="$(_derive_valid_kinds)"

_is_valid() { case " $VALID_KINDS " in *" $1 "*) return 0;; *) return 1;; esac; }
_is_known() { case " $KNOWN_KINDS " in *" $1 "*) return 0;; *) return 1;; esac; }
_cmd_for() {
  case "$1" in
    scan) echo "arc-scan";; code) echo "/arc-review";; security) echo "/arc-audit";;
    qa) echo "/arc-qa";; design) echo "/arc-design";; docs) echo "/arc-docs";;
    *) echo "/arc-$1";;
  esac
}

cmd="${1:-status}"; kind="${2:-}"
case "$cmd" in
  stamp)
    if ! _is_valid "$kind"; then
      if _is_known "$kind"; then
        p="$(_product_for_kind "$kind")"
        echo "review-ledger: kind '$kind' needs the '$p' product, not installed here -- sync-to-project.sh <target> --products $p" >&2
      else
        echo "review-ledger: unknown kind '$kind' (valid here: ${VALID_KINDS:-none})" >&2
      fi
      exit 1
    fi
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
  require-profile)
    # resolve the required review set from the active strictness profile (Phase 01)
    reviews="$(bash "$ROOT/.claude/scripts/core/arc-profile.sh" reviews 2>/dev/null || echo '')"
    if [ -z "$reviews" ]; then echo "review-ledger: no required reviews for this profile"; exit 0; fi
    exec bash "$0" require "$reviews"
    ;;
  status)
    if [ -f "$LEDGER" ] && [ -s "$LEDGER" ]; then
      printf 'reviews @ %s: ' "$SHA"; tr '\n' ' ' < "$LEDGER"; echo
    else
      echo "reviews @ $SHA: (none)"
    fi
    ;;
  *)
    echo "usage: review-ledger.sh {stamp|unstamp|check|require|require-profile|status} [kind]" >&2; exit 1;;
esac
