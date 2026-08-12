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
# `evolve` joined the scope in Cycle 7: its board is a spine CONSUMER (ADR-0302, reader-only),
# and a consumer that lives outside this lint's file glob is a consumer nothing checks. Listing
# the directory rather than the file keeps later evolve modules covered without editing this lint.
# `memory` joined for the same reason in Cycle 11 (ADR-0703): its decisions adapter is reader-only
# by design, and a DoD line reading "spine-reader-lint stays green" would otherwise pass because
# the file was never scanned -- a green that proves nothing is the vacuous-pass shape itself.
FILES="$(git ls-files .claude/scripts/hq .claude/scripts/evolve .claude/scripts/memory 2>/dev/null | grep '\.mjs$' || true)"
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

# ONE sanctioned non-spine JSONL, neutralised at the TOKEN and never at the line.
#
# `.jsonl` is a proxy for "raw spine file access", but the token's meaning depends on WHICH
# jsonl. `.claude/state/memory/surfaced-cited.jsonl` is memory's own instance state -- the
# observational surfaced->cited log of ADR-0706, gitignored, beside the index, and explicitly not
# the spine (ADR-0703: memory emits nothing and reads events only through the reader). Without
# this, the lint reports a file that is obeying the very rule it enforces.
#
# Neutralised by substituting the TOKEN, not by dropping the line: a `grep -v` on the filename
# would also mask a genuine bypass that happened to mention it on the same line, e.g.
# `events/surfaced-cited.jsonl`. After this sed such a line still carries `events/` and still
# trips. tests/memory-golden.bats drives both halves against a throwaway git repo.
#
# The substitution runs AFTER comment stripping, so line numbers stay real. `sed` here is
# BRE with no GNU-only flags -- the macOS BSD leg is a first-class runner.
_sanction() { sed 's#surfaced-cited\.jsonl#surfaced-cited.SANCTIONED-NON-SPINE#g'; }

# SCANNED CLEAN and COULD NOT SCAN are different answers, and this loop used to give the same one.
#
# `for f in $FILES` word-split on whitespace, so a tracked `.../bad file.mjs` reached awk as two
# nonexistent paths; awk printed `fatal: cannot open file` and the pipeline's exit status was never
# read, because an empty `report` was taken to mean clean. A planted bypass in that file passed at
# exit 0. Reproduced a second way with awk stubbed to `exit 127`: same silent pass. A gate that
# cannot tell "I looked and found nothing" from "I never looked" is the exact shape this lint
# exists to prevent (2026-08-12, shell/OS row 5).
#
# `while IFS= read -r` preserves every character in the name, and each file's strip is run and its
# status CHECKED before anything is matched against it. `grep` exiting 1 on no-match is normal and
# stays out of the failure path -- only the reader is allowed to fail loudly.
#
# The here-doc is deliberate: a pipe would run the loop in a subshell on bash-3.2 and the two
# accumulators would come back empty, which is this same defect one layer down.
# The stripped text goes through a FILE, never through `$(...)`. A command substitution silently
# drops NUL bytes and warns on stderr about it, and `.claude/scripts/evolve/board.mjs:166` really
# does carry one -- a NUL is its composite map-key separator -- so every single run of this lint
# printed a bash warning to stderr while quietly scanning altered content. A gate that mutates what
# it measures has to say what the mutation destroys; not mutating it is better.
TMPF="$(mktemp 2>/dev/null || echo "${TMPDIR:-/tmp}/spine-reader-lint.$$")"
trap 'rm -f "$TMPF"' EXIT

report=""
unscanned=""
while IFS= read -r f; do
  [ -n "$f" ] || continue
  _exempt "$f" && continue
  if [ ! -r "$f" ]; then
    unscanned="$unscanned$f: not readable
"
    continue
  fi
  if ! _strip_comments "$f" > "$TMPF" 2>/dev/null; then
    unscanned="$unscanned$f: the comment stripper exited non-zero -- this file was NOT scanned
"
    continue
  fi
  hit="$(_sanction < "$TMPF" | grep -nE "$PATTERN" | sed "s#^#$f:#")"
  if [ -n "$hit" ]; then
    report="$report$hit
"
  fi
done <<EOF
$FILES
EOF

# Reported BEFORE the violations and on its own exit, because an unscanned file is not a clean file
# and the operator has to be told which files the verdict below does not cover.
if [ -n "$unscanned" ]; then
  printf '%s' "$unscanned" >&2
  echo "spine-reader-lint: FAIL -- file(s) above could not be scanned at all, so this run cannot report them clean." >&2
  [ -n "$report" ] && printf '%s' "$report" >&2
  exit 1
fi

if [ -n "$report" ]; then
  report="$(printf '%s' "$report")"
  EVIDENCE="$ROOT/.claude/state/spine-lint/violations.txt"
  mkdir -p "$(dirname "$EVIDENCE")" 2>/dev/null || true
  printf '%s\n' "$report" > "$EVIDENCE" 2>/dev/null || true
  printf '%s\n' "$report" >&2
  echo "spine-reader-lint: WARN -- consumer(s) bypass the spine reader (ADR-0030 / REQ-09); route access through spine.mjs." >&2
  exit 1
fi
exit 0
