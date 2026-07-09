#!/usr/bin/env bash
# sarif.sh -- normalize per-tool SARIF to a minimal field set, then merge.
# ADR-0001: SARIF is the single findings format; we keep only
#   ruleId, level, message, location (file+line), fingerprint.
# Requires jq (the caller guards on arc_jq_bin and SKIPs if absent).
#
# Internal wire format between normalize and merge is JSONL -- one finding per
# line -- which is append-only + sortable, hence merge-friendly (PLAN rabbit
# hole: baseline files must not conflict).

# arc_sarif_normalize <tool> <native-sarif-file>
# Emits normalized JSONL on stdout. Fills a stable fingerprint when the tool
# did not supply one. Missing/oversized fields degrade to sane defaults.
arc_sarif_normalize() {
  local tool="$1" sarif="$2"
  [ -f "$sarif" ] || { arc_log "normalize: no sarif file for $tool"; return 0; }

  # Severity resolution order (SARIF allows severity to live on the rule, not the
  # result): result.level -> matching rule.defaultConfiguration.level (by id, then
  # by ruleIndex) -> tool default. gitleaks emits no severity at all, so a leaked
  # secret defaults to error; semgrep-family findings default to warning.
  jq -c --arg tool "$tool" '
    (.runs // [])[]? as $run
    | (($run.tool.driver.rules) // []) as $rules
    | ($run.results // [])[]? as $res
    | (($res.ruleId // $res.rule.id // "unknown") | tostring) as $rid
    | ($rules | map(select(.id == $rid)) | .[0].defaultConfiguration.level) as $byId
    | (if ($res.ruleIndex != null) then ($rules[$res.ruleIndex].defaultConfiguration.level) else null end) as $byIdx
    | ($res.level // $byId // $byIdx // (if $tool=="gitleaks" then "error" else "warning" end)) as $lvl
    | {
        tool:    $tool,
        ruleId:  $rid,
        level:   ($lvl | tostring),
        message: ((($res.message.text) // ($res.message) // "") | tostring),
        file:    ((($res.locations[0].physicalLocation.artifactLocation.uri) // "") | tostring),
        line:    ((($res.locations[0].physicalLocation.region.startLine) // 0) | tonumber? // 0),
        # Always empty here so the shell pass computes our OWN deterministic
        # fingerprint from the normalized fields. Tool-provided fingerprints are
        # NOT stable (gitleaks keys on the fresh staging temp dir), which would
        # break baseline + suppression matching and evidence reproducibility.
        fingerprint: ""
      }
  ' "$sarif" 2>/dev/null | while IFS= read -r obj; do
    local fp; fp="$(printf '%s' "$obj" | jq -r '.fingerprint')"
    if [ -z "$fp" ] || [ "$fp" = "null" ]; then
      local t r f l m
      t="$(printf '%s' "$obj" | jq -r '.tool')"
      r="$(printf '%s' "$obj" | jq -r '.ruleId')"
      f="$(printf '%s' "$obj" | jq -r '.file')"
      l="$(printf '%s' "$obj" | jq -r '.line')"
      m="$(printf '%s' "$obj" | jq -r '.message')"
      fp="$(arc_fingerprint "$t" "$r" "$f" "$l" "$m")"
      obj="$(printf '%s' "$obj" | jq -c --arg fp "$fp" '.fingerprint=$fp')"
    fi
    printf '%s\n' "$obj"
  done
}

# arc_sarif_merge <jsonl-file>
# Reads normalized JSONL, dedupes by fingerprint, sorts, and emits one minimal
# SARIF document (scan-result.sarif) on stdout.
arc_sarif_merge() {
  local jsonl="$1"
  [ -f "$jsonl" ] || : > "${jsonl:=/dev/null}"
  # dedupe by fingerprint (keep first), sort for stable output
  jq -s '
    (map({(.fingerprint): .}) | add // {}) | to_entries | map(.value) | sort_by(.fingerprint)
    | {
        version: "2.1.0",
        "$schema": "https://json.schemastore.org/sarif-2.1.0.json",
        runs: [ {
          tool: { driver: {
            name: "arc-scan",
            informationUri: "https://github.com/technology-ashiq/arc"
          } },
          results: [ .[] | {
            ruleId: .ruleId,
            level: .level,
            message: { text: .message },
            locations: [ { physicalLocation: {
              artifactLocation: { uri: .file },
              region: { startLine: .line }
            } } ],
            partialFingerprints: { arcFingerprint: .fingerprint },
            properties: { tool: .tool, new: (.new != false), suppressed: (.suppressed == true) }
          } ]
        } ]
      }
  ' "$jsonl"
}
