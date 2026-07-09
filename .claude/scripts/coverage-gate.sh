#!/usr/bin/env bash
# coverage-gate.sh -- arc- enforcement moat
# Blocks deploy if line coverage drops below a floor. Turns "we test our code"
# from a vibe into physics. Called by the deploy-guard branch of PreToolUse.sh.
#
# Reads (all optional, with defaults):
#   .claude/settings.json  ->  arc.coverageFloor    (default 80)
#   .claude/settings.json  ->  arc.coverageSummary  (default coverage/coverage-summary.json)
#   .claude/settings.json  ->  arc.coverageMode     (block | warn, default block)
#
# Expects an istanbul-style coverage/coverage-summary.json (vitest/jest --coverage
# with json-summary reporter). If absent, behaviour depends on coverageMode.
#
# Exit: 0 ok/allow | 2 BLOCK (below floor in block mode)
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SETTINGS="$ROOT/.claude/settings.json"

_json() { # _json <jq-path> <default>
  local path="$1" def="$2"
  if command -v jq >/dev/null 2>&1 && [ -f "$SETTINGS" ]; then
    local v; v="$(jq -r "$path // empty" "$SETTINGS" 2>/dev/null)"
    [ -n "$v" ] && { echo "$v"; return; }
  fi
  echo "$def"
}

FLOOR="$(_json '.arc.coverageFloor' 80)"
SUMMARY_REL="$(_json '.arc.coverageSummary' 'coverage/coverage-summary.json')"
# Mode resolves through the active strictness profile (block-by-default). An
# explicit .arc.coverageMode in settings still overrides -- see arc-profile.sh.
MODE="$(bash "$ROOT/.claude/scripts/arc-profile.sh" mode coverage 2>/dev/null || echo block)"
SUMMARY="$ROOT/$SUMMARY_REL"

_fail_or_warn() { # <msg>
  if [ "$MODE" = "warn" ]; then echo "coverage-gate (warn): $1" >&2; exit 0
  else echo "BLOCKED by coverage-gate: $1" >&2; exit 2; fi
}

if [ ! -f "$SUMMARY" ]; then
  _fail_or_warn "no coverage summary at $SUMMARY_REL -- run tests with coverage (json-summary reporter) before deploy"
fi

if command -v jq >/dev/null 2>&1; then
  PCT="$(jq -r '.total.lines.pct // empty' "$SUMMARY" 2>/dev/null)"
else
  # crude fallback: first "pct" under total/lines
  PCT="$(grep -o '"pct"[[:space:]]*:[[:space:]]*[0-9.]*' "$SUMMARY" | head -1 | grep -o '[0-9.]*')"
fi

[ -z "${PCT:-}" ] && _fail_or_warn "could not parse line coverage from $SUMMARY_REL"

# float compare via awk (bash has no floats): below=1 when PCT < FLOOR
below="$(awk -v p="$PCT" -v f="$FLOOR" 'BEGIN{ print ((p+0) < (f+0)) ? 1 : 0 }')"
if [ "$below" = "1" ]; then
  _fail_or_warn "line coverage ${PCT}% < floor ${FLOOR}%"
fi

echo "coverage-gate: ${PCT}% >= floor ${FLOOR}% OK"
exit 0
