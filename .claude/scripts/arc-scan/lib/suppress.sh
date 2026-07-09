#!/usr/bin/env bash
# suppress.sh -- suppression ledger (ADR-0002). A finding is waived ONLY by a
# justified entry in docs/suppressions.md: fingerprint + justification + date.
# No silent ignores -- an entry without a justification does NOT suppress (the
# finding still blocks) and is reported as an unjustified suppression.
#
# docs/suppressions.md carries a markdown table:
#   | fingerprint | justification | date | by |
# Parsing is column-based; header and the |---| separator row are skipped.

# _suppress_rows <suppressions.md> -> "fingerprint<TAB>justification" per data row
_suppress_rows() {
  local f="$1"
  [ -f "$f" ] || return 0
  awk -F'|' '
    /^[ \t]*\|/ {
      fp=$2;  gsub(/^[ \t]+|[ \t]+$/,"",fp)
      just=$3; gsub(/^[ \t]+|[ \t]+$/,"",just)
      if(fp=="" || fp=="fingerprint" || fp ~ /^:?-+:?$/) next
      print fp "\t" just
    }
  ' "$f"
}

# arc_suppress_valid <suppressions.md> -> fingerprints WITH a non-empty justification
arc_suppress_valid() {
  _suppress_rows "$1" | awk -F'\t' '$2 != "" { print $1 }'
}

# arc_suppress_unjustified <suppressions.md> -> fingerprints listed but NOT justified
arc_suppress_unjustified() {
  _suppress_rows "$1" | awk -F'\t' '$2 == "" { print $1 }'
}

# arc_suppress_annotate <findings-jsonl> <suppressions.md>
# Adds `.suppressed` = true when the fingerprint has a valid (justified) entry.
arc_suppress_annotate() {
  local jsonl="$1" sfile="$2"
  local valid; valid="$(arc_suppress_valid "$sfile" 2>/dev/null | jq -R . | jq -s -c . 2>/dev/null)"
  [ -z "$valid" ] && valid='[]'
  jq -c --argjson sup "$valid" '.suppressed = (( .fingerprint as $f | $sup | index($f) ) != null)' "$jsonl"
}
