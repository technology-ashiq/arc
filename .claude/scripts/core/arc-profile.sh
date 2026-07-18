#!/usr/bin/env bash
# arc-profile.sh -- resolve the active strictness profile to concrete gate modes.
# ADR-0008 (block-by-default). ONE settings key (.arc.profile) switches every
# gate as a set; an explicit per-gate key in settings overrides the profile for
# just that gate (the sanctioned fine-tune / escape hatch).
#
# Profiles:
#   starter  -- warn-all; nothing blocks. Gentle onboarding (pre-Phase-01 behavior).
#   standard -- block core gates (scan, coverage, docs); require code,security reviews.
#   strict   -- block all gates; require the full review set.
#
# Precedence:
#   profile name : $ARC_PROFILE env  >  settings .arc.profile  >  "standard"
#   gate mode    : settings .arc.<gate>Mode override  >  profile table
#   reviews      : $ARC_REQUIRED_REVIEWS env  >  settings .arc.requiredReviews  >  profile table
#
# Usage:
#   arc-profile.sh name                       -> active profile name
#   arc-profile.sh mode <coverage|docs|scan>  -> warn | block
#   arc-profile.sh reviews                    -> comma list, e.g. "code,security"
#   arc-profile.sh show                       -> human-readable summary
#
# Settings path is overridable via $ARC_SETTINGS (for tests / non-standard layouts).
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SETTINGS="${ARC_SETTINGS:-$ROOT/.claude/settings.json}"
VALID_PROFILES="starter standard strict"

# Read a jq path from settings, empty if absent/unavailable (jq with grep fallback).
_setting() { # <jq-path>
  local path="$1"
  if command -v jq >/dev/null 2>&1 && [ -f "$SETTINGS" ]; then
    jq -r "$path // empty" "$SETTINGS" 2>/dev/null
  fi
}

_active_profile() {
  local p="${ARC_PROFILE:-}"
  [ -z "$p" ] && p="$(_setting '.arc.profile')"
  [ -z "$p" ] && p="standard"                       # block-by-default
  case " $VALID_PROFILES " in
    *" $p "*) echo "$p";;
    *) echo "arc-profile: unknown profile '$p', falling back to 'standard'" >&2; echo "standard";;
  esac
}

# Profile table: mode per gate.
_profile_mode() { # <profile> <gate>
  case "$1" in
    starter) echo "warn";;
    standard|strict)
      # standard & strict both block the three core gates in this phase
      echo "block";;
    *) echo "warn";;
  esac
}

_profile_reviews() { # <profile>
  case "$1" in
    starter)  echo "";;
    standard) echo "code,security";;
    strict)   echo "code,security,qa,design,docs";;
    *)        echo "code,security";;
  esac
}

# Map a gate name to its explicit settings override key.
_override_key() { # <gate>
  case "$1" in
    coverage) echo '.arc.coverageMode';;
    docs)     echo '.arc.docsGate';;
    scan)     echo '.arc.scanMode';;
    *)        echo '';;
  esac
}

cmd="${1:-show}"
case "$cmd" in
  name)
    _active_profile
    ;;
  mode)
    gate="${2:?usage: arc-profile.sh mode <coverage|docs|scan>}"
    key="$(_override_key "$gate")"
    [ -z "$key" ] && { echo "arc-profile: unknown gate '$gate'" >&2; exit 1; }
    ov="$(_setting "$key")"                          # explicit per-gate override
    if [ -n "$ov" ]; then echo "$ov"; else _profile_mode "$(_active_profile)" "$gate"; fi
    ;;
  reviews)
    if [ -n "${ARC_REQUIRED_REVIEWS:-}" ]; then echo "$ARC_REQUIRED_REVIEWS"
    else
      ov="$(_setting '.arc.requiredReviews')"
      if [ -n "$ov" ]; then echo "$ov"; else _profile_reviews "$(_active_profile)"; fi
    fi
    ;;
  show)
    p="$(_active_profile)"
    printf 'arc profile: %s\n' "$p"
    printf '  coverage : %s\n' "$("$0" mode coverage)"
    printf '  docs     : %s\n' "$("$0" mode docs)"
    printf '  scan     : %s\n' "$("$0" mode scan)"
    printf '  reviews  : %s\n' "$("$0" reviews | sed 's/^$/(none)/')"
    ;;
  *)
    echo "usage: arc-profile.sh {name|mode <gate>|reviews|show}" >&2; exit 1;;
esac
