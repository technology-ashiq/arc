#!/usr/bin/env bash
# baseline.sh -- new-code-only blocking (ADR-0002, PLAN pre-mortem #1).
# The single most important noise defense: pre-existing findings are frozen to a
# committed baseline so only NEW findings block. Without this, the first scan of
# a real repo dumps hundreds of findings and the gates get flipped to warn/off.
#
# Baseline file: JSONL, one record per line {fingerprint, tool, ruleId, file},
# sorted by fingerprint, unique, append-only (freezing can only ADD, never drop
# silently) -> merge-friendly by construction (PLAN rabbit hole: baseline files
# must not conflict). Requires jq (caller guards).

# arc_baseline_freeze <findings-jsonl> <baseline-file>
# Union the current findings' fingerprints into the baseline (add-only), sorted+unique.
arc_baseline_freeze() {
  local jsonl="$1" bfile="$2"
  mkdir -p "$(dirname "$bfile")"
  # tr -d '\r': jq-windows emits CRLF; keep the committed baseline LF-clean so
  # line endings (and any downstream hash of it) are platform-stable.
  { [ -f "$bfile" ] && cat "$bfile"
    [ -f "$jsonl" ] && jq -c '{fingerprint, tool, ruleId, file}' "$jsonl" 2>/dev/null
  } | jq -s -c 'map(select(.fingerprint != null and .fingerprint != ""))
                | unique_by(.fingerprint) | sort_by(.fingerprint) | .[]' \
    | tr -d '\r' > "$bfile.tmp" 2>/dev/null && mv "$bfile.tmp" "$bfile" || rm -f "$bfile.tmp"
}

# arc_baseline_partition <findings-jsonl> <baseline-file>
# Emit each finding with `.new` set: true if its fingerprint is NOT in the
# baseline (so it blocks), false if it is (pre-existing, reported but non-blocking).
arc_baseline_partition() {
  local jsonl="$1" bfile="$2"
  local blarr='[]'
  [ -f "$bfile" ] && blarr="$(jq -s 'map(.fingerprint)' "$bfile" 2>/dev/null || echo '[]')"
  jq -c --argjson bl "$blarr" '.new = (( .fingerprint as $f | $bl | index($f) ) == null)' "$jsonl"
}

# arc_baseline_count <baseline-file> -> number of frozen fingerprints
arc_baseline_count() {
  local bfile="$1"
  [ -f "$bfile" ] || { echo 0; return 0; }
  jq -s 'length' "$bfile" 2>/dev/null || echo 0
}
