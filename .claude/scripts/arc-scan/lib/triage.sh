#!/usr/bin/env bash
# triage.sh -- Phase 00 triage STUB. No LLM (that is Phase 2). Pure threshold:
# any error-level finding => block, else pass. Requires jq (caller guards).
#
# Deliberately dumb and deterministic: the steel thread proves the wiring
# (merge -> verdict -> ledger), not the intelligence. Phase 2 replaces the body
# with dedupe + LLM false-positive filtering, keeping this same output shape.

# arc_triage_counts <merged-sarif>  -> JSON {findings,errors,warnings,notes}
arc_triage_counts() {
  local sarif="$1"
  [ -f "$sarif" ] || { echo '{"findings":0,"errors":0,"warnings":0,"notes":0}'; return 0; }
  jq '
    [ (.runs // [])[]? | (.results // [])[]? ] as $r
    | {
        findings: ($r | length),
        errors:   ([ $r[] | select(.level=="error") ] | length),
        warnings: ([ $r[] | select(.level=="warning") ] | length),
        notes:    ([ $r[] | select(.level=="note") ] | length)
      }
  ' "$sarif" 2>/dev/null || echo '{"findings":0,"errors":0,"warnings":0,"notes":0}'
}

# arc_triage_verdict <merged-sarif> <ran-csv> <skipped-csv> -> full verdict JSON
arc_triage_verdict() {
  local sarif="$1" ran="${2:-}" skipped="${3:-}"
  local counts; counts="$(arc_triage_counts "$sarif")"
  local errors; errors="$(printf '%s' "$counts" | jq '.errors')"
  local verdict="pass"
  [ "${errors:-0}" -gt 0 ] 2>/dev/null && verdict="block"

  printf '%s' "$counts" | jq \
    --arg verdict "$verdict" \
    --arg ran "$ran" \
    --arg skipped "$skipped" '
    {
      verdict: $verdict,
      findings: .findings, errors: .errors, warnings: .warnings, notes: .notes,
      tools_ran:     ($ran     | split(",") | map(select(length>0))),
      tools_skipped: ($skipped | split(",") | map(select(length>0)))
    }'
}
