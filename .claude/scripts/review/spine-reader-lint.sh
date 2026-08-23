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
# state.db from the JSONL, and the lib modules that own raw file and sqlite access.
#
# `lib/*` USED TO BE THE WHOLE EXEMPTION, and a shell case glob's `*` crosses `/`, so every module
# in every lib SUBDIRECTORY was exempt too -- 33 of 63 tracked files never scanned. An adversarial
# pass planted a real `events/<day>.jsonl` bypass in `lib/ledger/kill-panel.mjs` and this lint
# exited 0 on it, while the identical token in a non-lib file was caught. That file's own header
# asserts it "is subject to" this lint. A DoD line reading "spine-reader-lint stays green" was
# passing over files it had never opened, which is the vacuous-pass shape the comment above warns
# about, one directory deeper.
#
# So the exemption is now the FLAT lib directory only -- where spine-io.mjs and canonical.mjs
# actually live -- and every lib SUBDIRECTORY (ledger/, policy/, ...) is scanned like any other
# consumer, because none of them owns raw access and none of them should.
_exempt() {
  case "$1" in
    .claude/scripts/hq/spine.mjs)      return 0 ;;
    .claude/scripts/hq/arc-replay.mjs) return 0 ;;
    # EXPOSED BY THE NARROWING, 2026-08-13, and exempted rather than silently changed or silently
    # buried. `lib/policy/run-gate.mjs` reads the day files directly, deliberately: it is the
    # policy REDUCER, it folds `decision.recorded` across days to resolve a promotion chain, and it
    # re-validates and sha-checks every line it accepts. That is implementation-layer work by the
    # same argument spine.mjs and arc-replay.mjs are exempt for -- but it belongs to the POLICY
    # lane, not this one, and rerouting another lane's authority reducer through the reader is that
    # lane's call to make with its own tests in front of it. Recorded here so the next policy-lane
    # reader sees it, instead of being hidden by a `lib/*` glob that never scanned the file at all.
    .claude/scripts/hq/lib/policy/run-gate.mjs) return 0 ;;
    .claude/scripts/hq/lib/*/*)        return 1 ;;
    .claude/scripts/hq/lib/*)          return 0 ;;
    *)                                 return 1 ;;
  esac
}

# Strip comments before grepping: /* ... */ blocks (incl. multi-line) and // to end-of-line. A
# token that appears only inside a comment (e.g. brief's "no path to events/*.jsonl") is
# documentation, not a bypass. Line count is preserved so grep -n reports real line numbers.
#
# A `/*` PRECEDED BY A WORD CHARACTER IS NOT A COMMENT OPENER (2026-08-24).
#
# arc-dash.mjs serves an HTML shell containing `every <code>/api/*</code> read needs ...`. The
# `/*` in `/api/*` opened a phantom block comment, and the stripper then blanked the next 99
# LINES until it found something that looked like `*/`. Two real token-bearing lines lived in
# that window and were invisible to this lint -- measured, not suspected: 2 hidden before the
# rule, 0 after.
#
# That is precisely the failure this file's own loop comment names further down -- "a gate that
# cannot tell 'I looked and found nothing' from 'I never looked'" -- reached through the
# stripper rather than through awk exiting 127. It was found because an unrelated edit moved
# where the phantom `*/` landed, which changed which lines were hidden. Nothing reported it.
#
# The rule is deliberately small: a real block comment opens after whitespace or after one of
# `( = , ; { : ?`, never immediately after a letter, digit or `_`. A full JS lexer in awk is
# not the answer to a path-shaped false positive, and a bigger rule here would be its own risk.
_strip_comments() {
  awk '
    function nquote(str, ch,   n, i) {
      # how many of `ch` appear in `str`. Escaped quotes are NOT discounted -- see instring().
      n=0
      for (i=1; i<=length(str); i++) if (substr(str,i,1)==ch) n++
      return n
    }
    function instring(str, pos,   head, bt) {
      # Is position `pos` inside a string literal? An ODD number of any one quote character
      # before it means an unclosed opener. Cheap, imperfect, and paired with the EOF check
      # below, which is what turns a wrong guess into a reported non-scan instead of silence.
      head = substr(str, 1, pos-1)
      bt = sprintf("%c", 96)          # backtick, built rather than typed
      return (nquote(head, "\"") % 2) || (nquote(head, "\047") % 2) || (nquote(head, bt) % 2)
    }
    function opener(str, from,   pos, prev) {
      # index of the next REAL block-comment opener at or after `from`, or 0.
      #
      # TWO THINGS DISQUALIFY A `/*`, both found by tracing real tracked files:
      #   a word char before it -- `/api/*` in the door served HTML, which blanked 99 lines
      #   inside a string       -- `"/**"` and `` `/**` ``, globs in policy/lint.mjs,
      #                            policy/resources.mjs and jobs/schema.mjs
      while ((pos=index(substr(str,from),"/*"))>0) {
        pos = pos + from - 1
        prev = (pos==1) ? "" : substr(str,pos-1,1)
        if (prev !~ /[A-Za-z0-9_]/ && !instring(str, pos)) return pos
        from = pos + 2
      }
      return 0
    }
    {
      s=$0
      if (inb) {
        idx=index(s,"*/")
        if (idx==0) { print ""; next }
        s=substr(s,idx+2); inb=0
      }
      # WHICHEVER COMES FIRST WINS. `//` used to be handled only after the block loop, so a
      # `/*`-looking sequence inside a LINE comment opened a phantom block that ran to EOF.
      # Real example, and the one that found this: schema.mjs:388 is a `//` comment whose prose
      # contains `` `/**` `` -- a glob in backticks -- and everything after it was blanked.
      # Three tracked files were affected. A comment cannot open a comment.
      pos=1
      while (1) {
        a=opener(s,pos)
        c=index(substr(s,pos),"//"); if (c>0) c=c+pos-1
        if (c>0 && (a==0 || c<a)) { s=substr(s,1,c-1); break }
        if (a==0) break
        rest=substr(s,a+2); b=index(rest,"*/")
        if (b>0) { s=substr(s,1,a-1) substr(rest,b+2); pos=a }
        else { s=substr(s,1,a-1); inb=1; break }
      }
      print s
    }
    END {
      # An unterminated block at EOF means the tail of this file was blanked, so it was NOT
      # fully scanned -- and a bypass sitting in that tail is invisible. Signalled through the
      # EXIT CODE, not stderr: the caller redirects this command stderr to /dev/null (for a
      # stated reason about NUL bytes) and CHECKS the status, so stderr here would be exactly
      # the silent channel this lint exists to not have.
      if (inb) exit 3
    }' "$1"
}

# Bypass tokens: raw event/day files, the derived db, and direct sqlite.
PATTERN='events/|\.jsonl|state\.db|node:sqlite|DatabaseSync'

# TWO sanctioned non-spine JSONLs, neutralised at the TOKEN and never at the line.
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
# The SECOND is arc-dash's own request journal, `journal-${day}.jsonl` (2026-08-24). Same
# justification, different file: it is the DOOR's instance state -- the evidence half of REQ-10,
# written beside the spine and never read as the spine -- and the door reaches actual spine data
# only through spine.mjs, which is what this lint is for. It became visible when the stripper
# stopped mis-parsing `/api/*` in the served HTML as a comment opener; it had been hidden, not
# absent, which is the more useful half of that finding.
#
# The substitution runs AFTER comment stripping, so line numbers stay real. `sed` here is
# BRE with no GNU-only flags -- the macOS BSD leg is a first-class runner. `[$]` rather than
# `\$` for the same reason: a bracket expression means the same thing to both seds.
_sanction() { sed -e 's#surfaced-cited\.jsonl#surfaced-cited.SANCTIONED-NON-SPINE#g' -e 's#journal-[$]{day}\.jsonl#journal.SANCTIONED-NON-SPINE#g'; }

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
  _strip_comments "$f" > "$TMPF" 2>/dev/null
  _strip_status=$?
  if [ "$_strip_status" -eq 3 ]; then
    unscanned="$unscanned$f: unterminated block comment -- the tail of this file was blanked and NOT scanned
"
    continue
  fi
  if [ "$_strip_status" -ne 0 ]; then
    unscanned="$unscanned$f: the comment stripper exited $_strip_status -- this file was NOT scanned
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
