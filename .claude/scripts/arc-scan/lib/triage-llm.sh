#!/usr/bin/env bash
# triage-llm.sh -- LLM false-positive triage v1 (Phase 02 #3). Downgrade-only:
# a NEW error-level finding whose confidence < ARC_TRIAGE_MIN (default 8) is
# downgraded error->note (tagged, kept in SARIF for the audit trail), so it no
# longer counts as a new_error and stops blocking. It can ONLY downgrade -- it
# never upgrades a finding and never invents a new blocking one (PLAN rabbit
# hole #6). Any backend error, unparseable score, or absent backend => the
# finding is KEPT (confidence 10): fail-closed, so a real finding is never
# silently dropped. Requires jq (caller guards jq_ok).
#
# Confidence backend resolver (mirrors the runtime chain native->docker->skip):
#   ARC_TRIAGE_CMD set -> finding JSON on stdin, backend prints either
#                         {"confidence":N,"reason":"..."} or a bare integer N.
#   unset              -> deterministic fake: trust all (confidence 10).
# Tune with a real backend later (e.g. ARC_TRIAGE_CMD='claude -p ...'); the
# security-auditor zero-noise rule is the intended v1 prompt (spec rabbit hole).

# arc_triage_confidence <finding-json> -> "<int>\t<reason>" (tab-separated).
# Always emits a 0-10 integer; fail-closed to 10 on any ambiguity.
arc_triage_confidence() {
  local finding="$1" out conf reason
  if [ -z "${ARC_TRIAGE_CMD:-}" ]; then
    printf '%s\t%s' 10 "no triage backend (ARC_TRIAGE_CMD unset); trusted"
    return 0
  fi
  out="$(printf '%s' "$finding" | bash -c "$ARC_TRIAGE_CMD" 2>/dev/null)" || out=""
  conf="$(printf '%s' "$out"   | jq -r 'if type=="object" then (.confidence // empty)
                                        elif type=="number" then . else empty end' 2>/dev/null)"
  reason="$(printf '%s' "$out" | jq -r 'if type=="object" then (.reason // "") else "" end' 2>/dev/null)"
  case "$conf" in
    ''|*[!0-9]*)
      printf '%s\t%s' 10 "triage backend returned no valid score; kept (fail-closed)"
      return 0;;
  esac
  if [ "$conf" -lt 0 ] || [ "$conf" -gt 10 ]; then
    printf '%s\t%s' 10 "triage score out of range ($conf); kept (fail-closed)"
    return 0
  fi
  [ -n "$reason" ] || reason="triaged confidence=$conf"
  printf '%s\t%s' "$conf" "$reason"
}

# arc_triage_llm_filter <in-sarif> <out-sarif>
# Downgrade every NEW, unsuppressed error below the threshold to note.
arc_triage_llm_filter() {
  local in="$1" out="$2" min="${ARC_TRIAGE_MIN:-8}"
  [ -f "$in" ] || { printf '{"version":"2.1.0","runs":[]}\n' > "$out"; return 0; }

  # Enumerate only the findings that could block: new, unsuppressed errors.
  # Each carries its (run, result) index so decisions map back by path.
  local candidates
  candidates="$(jq -c '
    .runs as $runs
    | range(0; ($runs|length)) as $ri
    | ($runs[$ri].results // []) as $res
    | range(0; ($res|length)) as $xi
    | $res[$xi] as $r
    | select($r.level=="error" and ($r.properties.new != false) and ($r.properties.suppressed != true))
    | {ri:$ri, xi:$xi, finding:$r}
  ' "$in" 2>/dev/null)"

  if [ -z "$candidates" ]; then cp "$in" "$out"; return 0; fi

  local dec="[]" line ri xi finding cr conf reason
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    ri="$(printf '%s' "$line" | jq -r '.ri')"
    xi="$(printf '%s' "$line" | jq -r '.xi')"
    finding="$(printf '%s' "$line" | jq -c '.finding')"
    cr="$(arc_triage_confidence "$finding")"
    conf="${cr%%$'\t'*}"; reason="${cr#*$'\t'}"
    if [ "$conf" -lt "$min" ] 2>/dev/null; then
      dec="$(printf '%s' "$dec" | jq -c \
        --argjson ri "$ri" --argjson xi "$xi" --argjson c "$conf" --arg r "$reason" \
        '. + [{ri:$ri, xi:$xi, conf:$c, reason:$r}]')"
    fi
  done <<EOF
$candidates
EOF

  # Apply downgrades by path (indices unchanged -> stable). Empty dec => no-op.
  jq --argjson dec "$dec" '
    reduce $dec[] as $d (.;
        .runs[$d.ri].results[$d.xi].level = "note"
      | .runs[$d.ri].results[$d.xi].properties.triage_downgraded = true
      | .runs[$d.ri].results[$d.xi].properties.triage_confidence = $d.conf
      | .runs[$d.ri].results[$d.xi].properties.triage_reason = $d.reason
    )
  ' "$in" > "$out" 2>/dev/null || cp "$in" "$out"
}
