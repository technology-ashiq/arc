#!/usr/bin/env bash
# spine-reader-lint -- REQ-09 / ADR-0030: the spine is arc's ONLY public API.
#
# Every hq module OTHER than the spine implementation layer must reach events and derived state
# through the reader (spine.mjs) -- never by opening events/*.jsonl or state.db, and never by
# importing node:sqlite directly. This lint greps the TRACKED hq .mjs source (minus the
# implementation layer) for those bypass tokens, ignoring comments, so a consumer added after
# this cycle is covered without editing this lint. WARN-first (TRIAL): it reports and exits 1 on
# a violation, but arc.gates.yaml runs it as mode: warn, so it never blocks a session.
#
# Zero-dep bash/POSIX (bash-3.2 / macOS BSD leg): no process substitution, no GNU-only flags.
set -u

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT" || exit 0

# Tracked hq .mjs only -- a glob over git-tracked paths (REQ-09: coverage without a hardcoded
# file list). Not a git repo / nothing tracked -> advisory pass, never a false alarm.
FILES="$(git ls-files .claude/scripts/hq 2>/dev/null | grep '\.mjs$' || true)"
[ -n "$FILES" ] || exit 0

# The implementation layer is ALLOWED these tokens: the reader itself, the replayer that rebuilds
# state.db from the JSONL, and everything under lib/ (spine-io owns raw file + sqlite access).
# Everything else is a consumer and must go through the reader.
_exempt() {
  case "$1" in
    .claude/scripts/hq/spine.mjs)      return 0 ;;
    .claude/scripts/hq/arc-replay.mjs) return 0 ;;
    .claude/scripts/hq/lib/*)          return 0 ;;
    *)                                 return 1 ;;
  esac
}

# Strip comments before grepping: /* ... */ blocks (incl. multi-line) and // to end-of-line. A
# token that appears only inside a comment (e.g. brief's "no path to events/*.jsonl") is
# documentation, not a bypass. Line count is preserved so grep -n reports real line numbers.
_strip_comments() {
  awk '
    {
      s=$0
      if (inb) {
        idx=index(s,"*/")
        if (idx==0) { print ""; next }
        s=substr(s,idx+2); inb=0
      }
      while ((a=index(s,"/*"))>0) {
        rest=substr(s,a+2); b=index(rest,"*/")
        if (b>0) { s=substr(s,1,a-1) substr(rest,b+2) }
        else { s=substr(s,1,a-1); inb=1; break }
      }
      c=index(s,"//"); if (c>0) s=substr(s,1,c-1)
      print s
    }' "$1"
}

# Bypass tokens: raw event/day files, the derived db, and direct sqlite.
PATTERN='events/|\.jsonl|state\.db|node:sqlite|DatabaseSync'

report="$(
  for f in $FILES; do
    _exempt "$f" && continue
    _strip_comments "$f" | grep -nE "$PATTERN" | sed "s#^#$f:#"
  done
)"

if [ -n "$report" ]; then
  EVIDENCE="$ROOT/.claude/state/spine-lint/violations.txt"
  mkdir -p "$(dirname "$EVIDENCE")" 2>/dev/null || true
  printf '%s\n' "$report" > "$EVIDENCE" 2>/dev/null || true
  printf '%s\n' "$report" >&2
  echo "spine-reader-lint: WARN -- consumer(s) bypass the spine reader (ADR-0030 / REQ-09); route access through spine.mjs." >&2
  exit 1
fi
exit 0
