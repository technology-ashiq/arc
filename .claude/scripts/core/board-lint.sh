#!/usr/bin/env bash
# board-lint.sh -- does PORTFOLIO.md still say what the lanes say?
# Cycle 4 (arc-portfolio), Phase 02 / REQ-03. ADR-0051 (the board is a VIEW; every value
# derives from that lane's PROGRESS machine header) · ADR-0059 (a venture is a passport row
# and nothing else) · ADR-0061 (the board indexes BORN lanes only -- a row exists iff
# `initiatives/<lane>/` does, in BOTH directions) · ADR-0062 (a row's lane always carries a
# header, so a missing one is an ordinary WARN and never a special case in the parser).
#
# WARN-FIRST, and that is a contract rather than a style: this script EXITS 0 on every path
# -- missing board, unreadable lane, unparseable table, no git, no resolver. A WARN-first
# lint that exits non-zero is a BLOCK wearing a WARN's label.
#
# Zero deps, offline, READ-ONLY: it never creates, moves or writes anything.
#
# Usage: board-lint.sh [--root DIR]
#   Whole-board by design; there is no `--lane`. The board is a company organ (ADR-0053)
#   and half a board is not a verdict about a board. Every other token is ignored, exactly
#   as lane-resolve.sh ignores tokens that belong to the calling command.
#
# Output shape (STDOUT only -- tests/test_helper.bash:806 captures stdout and feeds THAT to
# the shape assertion, so a WARN on stderr is a WARN nobody sees):
#
#   WARN [<class>] <location> <U+2014> <summary>
#     Expected: <value>   <U+2190> <repo-relative path>:<line>
#     Found:    <value>   <U+2190> <repo-relative path>:<line>
#     Example:  <the correction>
#
# The three label columns are exactly 12 bytes and the gap before the arrow is exactly 3
# spaces. They are spelled out as literals and must never be rebuilt with `%-*s` padding:
# one space either way fails all eight classes at once.
#
# There is NO summary, banner or count line. Silence when the board is clean is the whole
# assertion a fixture can make, and any line starting `WARN ` that is not `WARN [` is read
# as header-form drift (the two-space kickoff-lint.mjs form) by the shape sweep.
set -uo pipefail

# Byte semantics, not the operator's collation -- same reasoning as lane-resolve.sh:34-42.
# It also pins awk's [[:cntrl:]] class and awk's substr()/length() to BYTES, so a stray
# CP1252 byte in a board cell cannot change how a row is scanned, and pins every tr range
# below to ASCII rather than to a collation table.
export LC_ALL=C LANG=C

# Constants set with `printf -v`, never `$( )`: these are the bytes the shape assertion
# compares, so they are written as octal escapes rather than pasted glyphs -- a source file
# re-saved in another encoding must not be able to change what this lint emits.
printf -v _DASH  '\342\200\224'   # U+2014 EM DASH   -- the WARN-line separator AND the
                                  #                     board's empty-cell marker
printf -v _ARROW '\342\206\220'   # U+2190 LEFTWARDS -- the derived-from pointer
printf -v _US    '\037'           # UNIT SEPARATOR   -- the awk->bash record delimiter.
                                  # Not TAB: tab is IFS-whitespace, so `read` COLLAPSES
                                  # runs of it and one empty middle field silently shifts
                                  # every field after it. US is inside [[:cntrl:]], which
                                  # both parsers strip from values, so no value can ever
                                  # contain the delimiter that carries it.
_ABSENT='(none)'                  # a genuinely missing artifact -- byte-distinct from the
                                  # board's U+2014 marker and from the empty string, which
                                  # are three different facts and must never be conflated

# Every helper below writes its result to a global rather than echoing into `$( )`: a
# subshell per value in a per-row loop is the measurable cost lane-resolve.sh's one-awk-
# pass note is about, and `set -u` wants them to exist before the first branch reads one.
_T=""; _N=""; _V=""; _CL=1; _BN=""; _EX=""; _C5=""; _C6=""

# ---------- flags ----------
ROOT=""
while [ $# -gt 0 ]; do
  case "$1" in
    --root)    if [ $# -ge 2 ]; then ROOT="$2"; shift 2; else shift; fi;;
    --root=*)  ROOT="${1#--root=}"; shift;;
    *)         shift;;
  esac
done

[ -n "$ROOT" ] || ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# A PowerShell caller hands bash an `E:\Work_Hub\arc` string; bash then reads `\W` as an
# escaped W and every path built from it silently misses. Normalise ONCE, here. ROOT is
# used to OPEN files and is never, anywhere, interpolated into a citation -- citations are
# repo-relative literals assembled from the lane name, because `pwd` and
# `git rev-parse --show-toplevel` disagree on windows-git-bash (/tmp/x vs C:/Users/.../x)
# and on macOS (/var vs /private/var), so subtracting one from the other strips nothing.
ROOT="$(printf '%s' "$ROOT" | tr '\\' '/')"

HERE="$(dirname "$0")"
RESOLVER="$HERE/lane-resolve.sh"
BOARD="$ROOT/PORTFOLIO.md"
BOARD_CITE='PORTFOLIO.md'

# ---------- small helpers ----------
_trim() {
  local s="${1-}"
  while :; do case "$s" in " "*|"	"*) s="${s#?}";; *) break;; esac; done
  while :; do case "$s" in *" "|*"	") s="${s%?}";; *) break;; esac; done
  _T="$s"
}

# The markdown markup the header parser already tolerates, removed the same way on the
# board side. Without this a board cell written `**LIVE**` reads as drift against a header
# that says `LIVE`, which is the lint crying wolf about its own strictness.
_norm() {
  local s="${1-}"
  s="${s//\*/}"; s="${s//\`/}"
  _trim "$s"; _N="$_T"
}

# Render a value for a WARN line. Byte 13 of an Expected/Found line may not be whitespace,
# so an absent value is SPELLED, never left blank.
_val() { _trim "${1-}"; if [ -z "$_T" ]; then _V="$_ABSENT"; else _V="$_T"; fi; }

# lane-resolve.sh:95's renderer. A lane name is ASCII by grammar, so a byte outside
# printable ASCII in one is not data -- it is a Cyrillic look-alike or a stray control
# byte, and it must not reach a CI log raw.
_safe_name() { printf '%s' "${1-}" | LC_ALL=C tr -c '\040-\176' '?'; }

# Two values whose ASCII projections are equal but whose bytes differ are INVISIBLY
# different in a rendered log: U+2013 and U+2014 are one byte apart and pixel-identical,
# and a lone CP1252 0x97 looks like both. An unactionable WARN is a muted WARN, so exactly
# those pairs -- and no others, or every em dash on the board would drag a hex dump along
# -- get their bytes named in the summary.
_ascii() { printf '%s' "${1-}" | LC_ALL=C tr -d '\200-\377'; }
_hex()   { printf '%s' "${1-}" | od -An -v -tx1 2>/dev/null | tr '\n' ' ' | tr -s ' '; }
_bytenote() {
  local a="${1-}" b="${2-}" ha hb
  _BN=""
  [ "$a" = "$b" ] && return 0
  [ "$(_ascii "$a")" = "$(_ascii "$b")" ] || return 0
  _trim "$(_hex "$a")"; ha="$_T"
  _trim "$(_hex "$b")"; hb="$_T"
  [ -n "$ha" ] && [ -n "$hb" ] || return 0
  _BN=" (header bytes $ha; board bytes $hb)"
}

# Strict ISO date, digits spelled out as a LIST. A bracket RANGE is resolved through the
# locale's collation table and a NEGATED one fails OPEN -- that is how the lane name
# `Design` passed on exactly one of three CI legs (A5). The zero-padding is load-bearing:
# `2026-8-1` sorts AFTER `2026-12-31`, so an unpadded date would read as permanently fresh.
_date_ok() {
  case "${1-}" in
    [0123456789][0123456789][0123456789][0123456789]-[0123456789][0123456789]-[0123456789][0123456789]) return 0;;
  esac
  return 1
}

_status_ok() { case "${1-}" in LIVE|BLOCKED|QUEUED|IDLE) return 0;; esac; return 1; }

# A line number for a citation. 0 means "that key is not in the file", and `path:0` is
# refused by the shape checker (a leading zero is not a line number), so it degrades to
# line 1 -- the top of the file the fix belongs in.
_cite_line() { if [ "${1:-0}" -gt 0 ] 2>/dev/null; then _CL="$1"; else _CL=1; fi; }

# ---------- the four WARN lines ----------
# Spelled as literals. `  Expected: ` = 2sp + 9 + 1sp · `  Found:    ` = 2sp + 6 + 4sp ·
# `  Example:  ` = 2sp + 8 + 2sp. Value and source are separated by exactly 3 spaces:
# 2 reads as "source pointer missing", 4 as "value padded with whitespace".
_w_head() { printf 'WARN [%s] %s %s %s\n' "$1" "$2" "$_DASH" "$3"; }
_w_exp()  { _val "$1"; printf '  Expected: %s   %s %s\n' "$_V" "$_ARROW" "$2"; }
_w_fnd()  { _val "$1"; printf '  Found:    %s   %s %s\n' "$_V" "$_ARROW" "$2"; }
_w_ex()   { printf '  Example:  %s\n' "$1"; }

# ---------- lane inventory: asked, never re-derived ----------
# The lane set comes from lane-resolve.sh's own `lanes=` field. That is deliberate, and it
# closes five whole families of defect in one move: a case-folded `initiatives/Design`, a
# reserved device name `initiatives/nul`, a GUI-copied `initiatives/design - Copy`, a
# dot-entry, and a Cyrillic look-alike are all decided by ONE grammar in ONE place. A
# second copy of `_valid_name` here would be a second answer to "is this a lane", which is
# exactly what lane-resolve.sh:75-79 exists to warn against.
#
# `lanes=` is space-joined and the grammar forbids spaces and glob characters in a lane
# name, which is why that ONE field may be word-split below -- and why `skipped=`, whose
# entries are arbitrary directory names, is never read.
if [ ! -f "$RESOLVER" ]; then
  # Degrade LOUDLY, never silently: with no inventory this lint has no opinion, and
  # inventing one is the "gate reporting on itself" failure this whole phase is about.
  printf 'board-lint: lane-resolve.sh not found beside this script; no lane inventory, nothing linted.\n' >&2
  exit 0
fi

# The resolver's exit code is deliberately dropped. `status=ambiguous` (exit 3) is the
# NORMAL state for a repo with two LIVE lanes -- the exact state Phase 02 exists to make
# safe -- and it is not an error for a whole-board lint that never needed a selected lane.
_RES="$(bash "$RESOLVER" --root "$ROOT" --for lint --print machine 2>/dev/null)"
_MODE="$(printf '%s\n' "$_RES" | sed -n 's/^mode=//p' | head -n1)"
_LANE_STR="$(printf '%s\n' "$_RES" | sed -n 's/^lanes=//p' | head -n1)"

# ROOT-MODE SILENCE is a permanent consumer contract (ADR-0054): LexOS and every venture
# repo run root-mode. No initiatives/ dir -- or one holding no VALID lane -- means zero
# bytes on stdout AND stderr, and we return here, before any file read, any git call and
# any path work. A `git log` in a non-repo prints to stderr and that alone breaks silence.
#
# This wins even when PORTFOLIO.md exists and is full of rows. A tree whose only
# `initiatives/` entry is `.attic/` or `Design/` is root-mode by ADR-0054's own words, and
# root-mode's contract is silence -- not "silence unless there happens to be a board".
[ -n "$_MODE" ] || exit 0
[ "$_MODE" = "root" ] && exit 0

LANES=()
for _l in $_LANE_STR; do LANES+=("$_l"); done
[ "${#LANES[@]}" -gt 0 ] || exit 0

# ---------- the machine header (ADR-0051 source grammar) ----------
# lane-resolve.sh:133-159 generalised from one key to seven. EVERY other line is byte-for-
# byte the reference: CR strip, leading-whitespace tolerance, tolower + asterisk-stripped
# DETECTION, the value sliced out of the ORIGINAL line at its first colon, the four value
# gsubs in their load-bearing order (asterisks, backticks, [[:cntrl:]], trim), fenced
# blocks skipped for ``` AND ~~~ and closed only by the marker that opened them, the block
# ending at the first `^##`, and LAST value wins. A fixture drives both on one input.
#
# The generalisation is provably behaviour-preserving because `^KEY[ \t]*:` requires a
# colon as the next non-blank byte after KEY, so no two keys can match one line. The key
# list is a hardcoded CLOSED set and never operator input -- it is interpolated into a
# regex, and a key carrying a metacharacter would silently widen the match.
#
# Two fields the reference does not need and this lint does:
#   seen mask  -- `status:` with nothing after it and an ABSENT `status:` both yield the
#                 empty value, but they are different defects with different fixes.
#   line nos   -- last-wins means a corrected value can sit far below the first one, and a
#                 WARN citing the FIRST line points the operator at a line that states the
#                 opposite of the value the WARN just printed.
_HKEYS='status cycle phase appetite burn blocked-on depends-on'

PROGFILES=()
for _l in "${LANES[@]}"; do
  _p="$ROOT/initiatives/$_l/PROGRESS.md"
  # `-f` and not `-e`: a directory or a FIFO named PROGRESS.md must not reach awk. gawk
  # warns-and-skips a directory, BWK awk is fatal, and a read on a FIFO never returns --
  # three answers on three legs, none of them a decision. lane-resolve.mjs:46 guards the
  # same thing for the same reason. An empty PROGFILES list also means awk is never run
  # with no file operands, which would read stdin and hang the caller.
  [ -f "$_p" ] && [ -r "$_p" ] && PROGFILES+=("$_p")
done

HDRS=()
if [ "${#PROGFILES[@]}" -gt 0 ]; then
  _HREC="$(awk -v keys="$_HKEYS" -v US="$_US" '
    BEGIN { nk = split(keys, K, " ") }
    function flush(   i, s, o) {
      if (curname == "") return
      s = ""
      for (i = 1; i <= nk; i++) s = s (SEEN[i] ? "1" : "0")
      o = curname US s US (fence ? fline : 0)
      for (i = 1; i <= nk; i++) o = o US V[i]
      for (i = 1; i <= nk; i++) o = o US (LN[i] + 0)
      print o
    }
    FNR == 1 {
      flush()
      fence = 0; fchar = ""; fline = 0; stop = 0
      for (i = 1; i <= nk; i++) { V[i] = ""; SEEN[i] = 0; LN[i] = 0 }
      n = split(FILENAME, pp, "/"); curname = pp[n - 1]
    }
    stop { next }
    {
      line = $0; sub(/\r$/, "", line)
      t = line; sub(/^[ \t]+/, "", t)
      f3 = substr(t, 1, 3)
      if (f3 == "```" || f3 == "~~~") {
        if (!fence) { fence = 1; fchar = f3; fline = FNR }
        else if (f3 == fchar) { fence = 0; fchar = "" }
        next
      }
      if (fence) next
      if (t ~ /^##/) { stop = 1; next }
      low = tolower(t); gsub(/\*/, "", low)
      for (i = 1; i <= nk; i++) {
        if (low ~ ("^" K[i] "[ \t]*:")) {
          p = index(line, ":"); val = substr(line, p + 1)
          gsub(/\*/, "", val); gsub(/`/, "", val); gsub(/[[:cntrl:]]/, "", val)
          gsub(/^[ \t]+|[ \t]+$/, "", val)
          V[i] = val; SEEN[i] = 1; LN[i] = FNR
          break
        }
      }
    }
    END { flush() }
  ' "${PROGFILES[@]}" 2>/dev/null)"
  if [ -n "$_HREC" ]; then
    while IFS= read -r _r; do HDRS+=("$_r"); done <<< "$_HREC"
  fi
fi

# Load one lane's header into _H_*. Returns 1 when the lane produced no record at all: a
# zero-byte PROGRESS.md never fires FNR==1, so "no record" and "no key matched" are both
# reachable and mean the same thing to the board -- nothing to derive from.
_hdr_get() {
  local want="$1" r x
  _H_FOUND=0; _H_SEEN='0000000'; _H_HINT=0
  _H_V1=""; _H_V2=""; _H_V3=""; _H_V4=""; _H_V5=""; _H_V6=""; _H_V7=""
  _H_L1=0; _H_L2=0; _H_L3=0; _H_L4=0; _H_L5=0; _H_L6=0; _H_L7=0
  for r in ${HDRS[@]+"${HDRS[@]}"}; do
    case "$r" in "$want$_US"*) ;; *) continue;; esac
    IFS="$_US" read -r x _H_SEEN _H_HINT \
      _H_V1 _H_V2 _H_V3 _H_V4 _H_V5 _H_V6 _H_V7 \
      _H_L1 _H_L2 _H_L3 _H_L4 _H_L5 _H_L6 _H_L7 <<< "$r"
    _H_FOUND=1
    return 0
  done
  return 1
}
_hdr_get __none__ || :

# ONE key detected is a header. `lane-no-machine-header` means the block is unreadable as a
# whole -- a UTF-8 BOM on line 1, an unclosed fence, a missing file. A single key that the
# parser could not see inside a header whose other six keys are right there is that key's
# own defect, and it gets that key's own class (`status` -> board-bad-status, everything
# else -> board-header-drift against an empty Expected). Firing lane-no-machine-header
# instead would print "no readable machine header" about a file with six readable keys.
_has_header() { case "$_H_SEEN" in *1*) return 0;; esac; return 1; }

# ---------- the board (two tables, one grammar each) ----------
# One awk pass, and the order of its three state machines is the whole correctness story:
#   1. inside a fence   -> nothing else is looked at, so a `<!--` in a code block is code
#   2. inside a comment -> `<!-- ... -->` ranges are removed BEFORE any grammar runs, and
#                          an UNTERMINATED `<!--` swallows to EOF, which is what a markdown
#                          renderer shows and therefore what the human sees. PORTFOLIO.md
#                          already ends with an eight-line comment naming rows and lanes.
#   3. headings / rows  -> on what is left
# Section headings match by EXACT equality, never a prefix: `index(low, want) == 1` -- the
# shape both existing board readers use -- also opens on `## Active initiatives (archived)`
# and silently concatenates a retired table onto the live one, so a lane that was quietly
# dropped from the board still looks present.
# Rows are recognised POSITIONALLY (pipe-row 1 = header, 2 = separator, 3..N = data), never
# by content: `a ~ /^-+$/` misses a GFM alignment row `|:---:|`, and dropping a row whose
# first cell reads `lane` drops a lane legitimately named `lane`.
# A SECOND heading that matches exactly re-opens the section and its rows are collected
# too, with its own header/separator rows skipped. Ignoring them would make a lane whose
# row lives in the second table look absent, and "two Active initiatives headings" has no
# registered class -- the shape sweep fails on any name outside the nine, so a tenth class
# cannot be invented here to say so.
_BOARDREC=""
if [ -f "$BOARD" ] && [ -r "$BOARD" ]; then
  _BOARDREC="$(awk -v US="$_US" '
    # A `|` separates cells only when preceded by an EVEN number of backslashes. GFM `\|`
    # is a literal pipe and `\\|` is an escaped backslash followed by a REAL separator, so
    # a gsub pre-pass gets the second case wrong. Getting this wrong is the worst failure
    # available in this file: every column after the escape shifts by one and the drift
    # check then emits a confident, well-formed, WRONG verdict about a column it never read.
    function cells(s, out,   i, n, ch, cur, bs, cnt) {
      cnt = 0; cur = ""; bs = 0; n = length(s)
      for (i = 1; i <= n; i++) {
        ch = substr(s, i, 1)
        if (ch == "|" && bs % 2 == 0) { cnt++; out[cnt] = cur; cur = ""; bs = 0; continue }
        if (ch == "\\") bs++; else bs = 0
        cur = cur ch
      }
      cnt++; out[cnt] = cur
      return cnt
    }
    function tr(s) { gsub(/^[ \t]+|[ \t]+$/, "", s); return s }
    {
      line = $0; sub(/\r$/, "", line)
      if (fence) {
        t = tr(line); f3 = substr(t, 1, 3)
        if ((f3 == "```" || f3 == "~~~") && f3 == fchar) { fence = 0; fchar = "" }
        next
      }
      if (incomment) {
        p = index(line, "-->")
        if (p == 0) next
        line = substr(line, p + 3); incomment = 0
      }
      vis = ""
      while (1) {
        p = index(line, "<!--")
        if (p == 0) { vis = vis line; break }
        vis = vis substr(line, 1, p - 1)
        rest = substr(line, p + 4)
        q = index(rest, "-->")
        if (q == 0) { incomment = 1; break }
        line = substr(rest, q + 3)
      }
      line = vis
      t = tr(line); f3 = substr(t, 1, 3)
      if (f3 == "```" || f3 == "~~~") { fence = 1; fchar = f3; next }
      # FIRST match wins for the fact line. The header parsers LAST-wins rule is wrong
      # here: prose and the trailing HTML comment below the tables can carry the word too.
      if (!updseen) {
        u = t; gsub(/\*/, "", u); u = tolower(u)
        if (u ~ /^updated[ \t]*:/) {
          p = index(line, ":"); uv = substr(line, p + 1)
          gsub(/\*/, "", uv); gsub(/`/, "", uv); gsub(/[[:cntrl:]]/, "", uv)
          print "UPD" US FNR US tr(uv)
          updseen = 1
        }
      }
      if (substr(t, 1, 1) == "#") {
        low = tolower(t); gsub(/[*#]/, "", low); low = tr(low)
        nrow = 0
        if (low == "active initiatives")     { sect = "R"; print "SEC" US FNR }
        else if (low == "venture passports") { sect = "P" }
        else                                 { sect = "" }
        next
      }
      if (sect == "") next
      if (substr(t, 1, 1) != "|") next
      nrow++
      if (nrow == 2) next
      nc = cells(line, C)
      lo = 1; hi = nc
      if (tr(C[1]) == "") lo = 2
      if (hi > lo && tr(C[hi]) == "") hi = hi - 1
      o = ((nrow == 1) ? sect "H" : sect) US FNR US (hi - lo + 1)
      for (i = 1; i <= 7; i++) {
        v = (lo + i - 1 <= hi) ? C[lo + i - 1] : ""
        gsub(/[[:cntrl:]]/, "", v)
        o = o US v
      }
      print o
    }
  ' "$BOARD" 2>/dev/null)"
fi

SEC_LINE=""; UPD_LINE=""; UPD_VAL=""; IHDR_OK=0
ROWS=(); VENTURES=()
if [ -n "$_BOARDREC" ]; then
  while IFS="$_US" read -r _k _a _b _c1 _c2 _c3 _c4 _c5 _c6 _c7; do
    case "$_k" in
      SEC) [ -n "$SEC_LINE" ] || SEC_LINE="$_a";;
      UPD) [ -n "$UPD_LINE" ] || { UPD_LINE="$_a"; UPD_VAL="$_b"; };;
      RH)
        # The column header row is ASSERTED, not trusted. That turns "is this the header
        # row" from a guess into a checked contract, and it is the precondition for
        # reading columns 5 and 6 by position at all.
        if [ "$_b" -eq 7 ] 2>/dev/null; then
          _norm "$_c1"; _h1="$_N"; _norm "$_c2"; _h2="$_N"; _norm "$_c3"; _h3="$_N"
          _norm "$_c4"; _h4="$_N"; _norm "$_c5"; _h5="$_N"; _norm "$_c6"; _h6="$_N"
          _norm "$_c7"; _h7="$_N"
          if [ "$_h1" = "lane" ] && [ "$_h2" = "status" ] && [ "$_h3" = "cycle" ] &&
             [ "$_h4" = "position" ] && [ "$_h5" = "appetite/burn" ] &&
             [ "$_h6" = "blocked-on / depends-on" ] && [ "$_h7" = "next" ]; then
            IHDR_OK=1
          fi
        fi
        ;;
      R)  ROWS+=("$_a$_US$_b$_US$_c1$_US$_c2$_US$_c3$_US$_c4$_US$_c5$_US$_c6$_US$_c7");;
      P)  _norm "$_c1"; [ -n "$_N" ] && VENTURES+=("$_N");;
    esac
  done <<< "$_BOARDREC"
fi

# A board whose initiatives table cannot be parsed -- no section heading, or a column
# header row that is not the ADR-0051 grammar -- has NO rows, so every born lane is a lane
# with no row. That is true, it is actionable, and it needs no tenth class: a column-header
# defect has no registered class, and the shape sweep fails on any name outside the nine.
_PARSEABLE=0
[ -n "$SEC_LINE" ] && [ "$IHDR_OK" -eq 1 ] && _PARSEABLE=1
_SEC_CITE="$SEC_LINE"; [ -n "$_SEC_CITE" ] || _SEC_CITE=1

# Membership is a byte comparison against what the resolver's listing actually returned,
# never `[ -d "initiatives/$name" ]` -- that answers TRUE for `initiatives/Design` when the
# row says `design` on Windows and macOS and FALSE on Linux. A sorted set difference
# (`comm`, `join`) is worse still: each side picks up its own collation, and glibc's UTF-8
# table ignores the hyphen, so `design / design-system / designops` can be reported as both
# a missing row AND a missing lane for a name that is present on both sides.
_is_venture() {
  local v
  for v in ${VENTURES[@]+"${VENTURES[@]}"}; do [ "$v" = "$1" ] && return 0; done
  return 1
}
_is_lane() {
  local l
  for l in "${LANES[@]}"; do [ "$l" = "$1" ] && return 0; done
  return 1
}
_row_for_lane() {
  local r ln a b c1 c2 c3 c4 c5 c6 c7
  for r in ${ROWS[@]+"${ROWS[@]}"}; do
    IFS="$_US" read -r a b c1 c2 c3 c4 c5 c6 c7 <<< "$r"
    _norm "$c1"; ln="$_N"
    [ "$ln" = "$1" ] && return 0
  done
  return 1
}

# ---------- derived cell renderers ----------
# The column -> key map is a hardcoded CLOSED table, never a lookup by column name. Board
# column `position` derives from machine-header key `phase`: they have DIFFERENT names, so
# a name-driven lookup returns the empty string, the drift check compares "" against a real
# value, and the lint emits a confident WARN about its own failed lookup. Column `next` is
# free prose with no derived source and is excluded from the drift check entirely.
_c5_expected() { local a b; _val "$_H_V4"; a="$_V"; _val "$_H_V5"; b="$_V"; _C5="$a / $b"; }

# Columns 5 and 6 do NOT share a join rule, and both live conventions are on the shipped
# board: column 5 is ALWAYS `<appetite> / <burn>` (so `— / —` when both are empty) while
# column 6 collapses to a single `—` when blocked-on AND depends-on are both empty. A
# uniform renderer flags a board that is correct; a uniform tolerance accepts a `—` in the
# appetite cell of a lane that is burning days. The mixed case joins with ` / `.
_c6_expected() {
  local a b
  _val "$_H_V6"; a="$_V"; _val "$_H_V7"; b="$_V"
  if [ "$a" = "$_DASH" ] && [ "$b" = "$_DASH" ]; then _C6="$_DASH"; else _C6="$a / $b"; fi
}

# ADR-0051's dependency convention: `<lane|owner|external> — <reason>`, or the single
# U+2014 empty marker. The em dash does double duty -- empty marker for the whole cell AND
# the separator inside a populated one -- so "is this cell empty" is a BYTE comparison
# against one spelled-out literal, never a dash-shaped character class and never a
# length test (an em dash measures 3 under LC_ALL=C and 1 under a UTF-8 locale). U+2013 and
# a lone CP1252 0x97 are not the empty marker; they only look like it.
_dep_half_ok() {
  local h t r
  _trim "${1-}"; h="$_T"
  [ "$h" = "$_DASH" ] && return 0
  case "$h" in *" $_DASH "*) ;; *) return 1;; esac
  t="${h%%" $_DASH "*}"; r="${h#*" $_DASH "}"
  _trim "$t"; [ -n "$_T" ] || return 1
  _trim "$r"; [ -n "$_T" ] || return 1
  return 0
}
_dep_ok() {
  local cell="${1-}" part rest
  [ "$cell" = "$_DASH" ] && return 0
  [ -n "$cell" ] || return 1
  rest="$cell"
  while :; do
    case "$rest" in
      *" / "*) part="${rest%%" / "*}"; rest="${rest#*" / "}";;
      *)       part="$rest"; rest="";;
    esac
    _dep_half_ok "$part" || return 1
    [ -n "$rest" ] || break
  done
  return 0
}

# A paste-able row rebuilt from the lane's header -- never by substituting one cell into
# the raw board row. A raw row carries its own trailing-space column, its own CR on a
# Windows checkout, and (in principle) a U+2190; the shape checker rejects all three inside
# an Example, and an Example is a correction rather than a citation.
# $4 overrides the status cell for the one case where the header cannot supply it: when
# the HEADER's status is the broken side, `(none)` in the Example is honest but nobody can
# paste it, and the board's own valid status is what the row should read once the header
# is written.
_example_row() {
  local lane="$1" nx="$2" c6="$3" ovr="${4-}" st cy ph ab
  _val "$_H_V1"; st="$_V"; _val "$_H_V2"; cy="$_V"; _val "$_H_V3"; ph="$_V"
  [ -n "$ovr" ] && st="$ovr"
  _c5_expected; ab="$_C5"
  if [ -z "$c6" ]; then _c6_expected; c6="$_C6"; fi
  _trim "$nx"; nx="$_T"
  [ -n "$nx" ] || nx="$_DASH"
  case "$nx" in *"$_ARROW"*) nx="$_DASH";; esac
  _EX="| $lane | $st | $cy | $ph | $ab | $c6 | $nx |"
}

# ---------- board-stale-updated ----------
# Freshness is measured against the repository's OWN facts, never `date +%F`: a gate whose
# verdict changes with the day it runs is not reporting on the thing. ISO-8601 strings
# compare correctly byte-wise under LC_ALL=C, so there is no date arithmetic at all --
# `date -d` is GNU-only, `date -j -f` is BSD-only, and tests/portability.bats:20 catches
# neither of the long forms.
_REF_DATE=""; _REF_LANE=""
if git -C "$ROOT" rev-parse --git-dir >/dev/null 2>&1 &&
   [ "$(git -C "$ROOT" rev-parse --is-shallow-repository 2>/dev/null)" != "true" ] &&
   [ ! -f "$ROOT/.git/shallow" ]; then
  for _l in "${LANES[@]}"; do
    _d="$(git -C "$ROOT" log -1 --format=%cd --date=short -- "initiatives/$_l/PROGRESS.md" 2>/dev/null)"
    _trim "$_d"; _d="$_T"
    _date_ok "$_d" || continue
    if [ -z "$_REF_DATE" ] || [[ "$_REF_DATE" < "$_d" ]]; then _REF_DATE="$_d"; _REF_LANE="$_l"; fi
  done
fi

# A shallow clone attributes EVERY path to the tip commit (actions/checkout defaults to
# depth 1, and a pull_request tip is the merge commit made moments ago), so without the
# guard above this class fires on all three CI legs against a board that is correct and
# never reproduces in a developer's full clone. No reference date means no verdict:
# WARN-first never invents a fact.
#
# A FUTURE Updated: date is wrong but it is not stale and no registered class covers it --
# stated here rather than left to the comparison operator. A MISSING Updated: line likewise
# has no class, and is silent.
if [ -n "$UPD_LINE" ] && [ -n "$_REF_DATE" ]; then
  _stale=0; _why=""
  if ! _date_ok "$UPD_VAL"; then
    _stale=1
    _why="the board's Updated: value is not a zero-padded ISO date, so its freshness cannot be compared at all"
  elif [[ "$UPD_VAL" < "$_REF_DATE" ]]; then
    _stale=1
    _why="the board's Updated: date is older than the newest lane header commit, so the board was not touched when the lane was"
  fi
  if [ "$_stale" -eq 1 ]; then
    _w_head board-stale-updated "$BOARD_CITE:$UPD_LINE" "$_why"
    _w_exp "$_REF_DATE" "initiatives/$_REF_LANE/PROGRESS.md:1, last commit $_REF_DATE"
    _w_fnd "$UPD_VAL"   "$BOARD_CITE:$UPD_LINE"
    _w_ex  "Updated: $_REF_DATE"
  fi
fi

# ---------- rows -> lanes ----------
# Classification order is load-bearing. Three checks have an opinion about a venture row
# pasted into the initiatives table, and only one of them names the actual mistake: the iff
# check would tell the operator to run `/arc-kickoff --lane lexos`, which is precisely what
# ADR-0059 forbids. So the venture test runs FIRST and suppresses every other check for
# that row, and lane membership is settled before any value is looked at.
for _r in ${ROWS[@]+"${ROWS[@]}"}; do
  IFS="$_US" read -r _ln _nc _b1 _b2 _b3 _b4 _b5 _b6 _b7 <<< "$_r"
  _norm "$_b1"; _lane="$_N"
  [ -n "$_lane" ] || continue

  if _is_venture "$_lane"; then
    _sn="$(_safe_name "$_lane")"
    _w_head board-venture-in-initiatives "$BOARD_CITE:$_ln" \
      "\`$_sn\` is a venture and belongs only in the Venture passports table (ADR-0059); a venture never gets a lane"
    _w_exp "no \`$_sn\` row in Active initiatives"  "$BOARD_CITE:$_ln"
    _w_fnd "\`$_sn\` listed in Active initiatives"  "$BOARD_CITE:$_ln"
    _w_ex  "delete line $_ln of PORTFOLIO.md; the passport row under \`## Venture passports\` is the whole of a venture's presence, and initiatives/$_sn/ must never be created"
    continue
  fi

  if ! _is_lane "$_lane"; then
    _sn="$(_safe_name "$_lane")"
    _w_head board-row-no-lane "$BOARD_CITE:$_ln" \
      "board row \`$_sn\` names a lane that does not exist (ADR-0061: a row exists iff initiatives/<lane>/ does)"
    _w_exp "no row, or a lane directory initiatives/$_sn/"                 "$BOARD_CITE:$_ln"
    _w_fnd "row present, initiatives/$_sn/ absent from the lane inventory" "$BOARD_CITE:$_ln"
    _w_ex  "delete line $_ln of PORTFOLIO.md, or run \`/arc-kickoff --lane $_sn\` so the lane and its row are born in one commit"
    continue
  fi

  _hdr_get "$_lane" || :
  # A lane with no readable header has no derived values, so every per-column check is
  # suppressed for it: six WARNs for one unclosed fence is a lint people mute. The
  # lane-no-machine-header WARN itself is emitted once, in the lane loop below.
  _has_header || continue

  # Wrong column count -> no positional read. There is no column-count class, and
  # inventing one is forbidden, so this is a deliberate STATED silence rather than a guess
  # about which cell is which. The row still counts as this lane's row: the two directions
  # of ADR-0061's iff must share one parse, or the lint reports on its own parse failure.
  [ "$_nc" -eq 7 ] 2>/dev/null || continue

  # --- status: vocabulary on both sides, before drift ---
  _norm "$_b2"; _bst="$_N"
  _val "$_H_V1"; _hst="$_V"
  _cite_line "$_H_L1"; _stl="$_CL"
  if ! _status_ok "$_H_V1"; then
    if _status_ok "$_bst"; then _example_row "$_lane" "$_b7" "" "$_bst"; else _example_row "$_lane" "$_b7" ""; fi
    _w_head board-bad-status "$BOARD_CITE:$_ln" \
      "lane \`$_lane\`'s machine header carries no valid status, so the board's status cell derives from nothing"
    _w_exp "one of LIVE|BLOCKED|QUEUED|IDLE" "initiatives/$_lane/PROGRESS.md:$_stl"
    _w_fnd "$_H_V1"                          "initiatives/$_lane/PROGRESS.md:$_stl"
    _w_ex  "$_EX"
  elif ! _status_ok "$_bst"; then
    _example_row "$_lane" "$_b7" ""
    _w_head board-bad-status "$BOARD_CITE:$_ln" \
      "board row \`$_lane\` carries a status outside the ADR-0051 vocabulary"
    _w_exp "one of LIVE|BLOCKED|QUEUED|IDLE" "initiatives/$_lane/PROGRESS.md:$_stl"
    _w_fnd "$_bst"                           "$BOARD_CITE:$_ln, column \`status\`"
    _w_ex  "$_EX"
  elif [ "$_bst" != "$_hst" ]; then
    _bytenote "$_hst" "$_bst"
    _example_row "$_lane" "$_b7" ""
    _w_head board-header-drift "$BOARD_CITE:$_ln" \
      "initiatives row \`$_lane\` column \`status\` disagrees with its lane header$_BN"
    _w_exp "$_hst" "initiatives/$_lane/PROGRESS.md:$_stl"
    _w_fnd "$_bst" "$BOARD_CITE:$_ln, column \`status\`"
    _w_ex  "$_EX"
  fi

  # --- cycle ---
  _norm "$_b3"; _bv="$_N"; _val "$_H_V2"; _hv="$_V"; _cite_line "$_H_L2"
  if [ "$_bv" != "$_hv" ]; then
    _bytenote "$_hv" "$_bv"
    _example_row "$_lane" "$_b7" ""
    _w_head board-header-drift "$BOARD_CITE:$_ln" \
      "initiatives row \`$_lane\` column \`cycle\` disagrees with its lane header$_BN"
    _w_exp "$_hv" "initiatives/$_lane/PROGRESS.md:$_CL"
    _w_fnd "$_bv" "$BOARD_CITE:$_ln, column \`cycle\`"
    _w_ex  "$_EX"
  fi

  # --- position (derives from the `phase` key, not from a key called `position`) ---
  _norm "$_b4"; _bv="$_N"; _val "$_H_V3"; _hv="$_V"; _cite_line "$_H_L3"
  if [ "$_bv" != "$_hv" ]; then
    _bytenote "$_hv" "$_bv"
    _example_row "$_lane" "$_b7" ""
    _w_head board-header-drift "$BOARD_CITE:$_ln" \
      "initiatives row \`$_lane\` column \`position\` disagrees with its lane header key \`phase\`$_BN"
    _w_exp "$_hv" "initiatives/$_lane/PROGRESS.md:$_CL"
    _w_fnd "$_bv" "$BOARD_CITE:$_ln, column \`position\`"
    _w_ex  "$_EX"
  fi

  # --- appetite/burn (the pair) ---
  _norm "$_b5"; _bv="$_N"; _c5_expected; _hv="$_C5"
  if [ "$_bv" != "$_hv" ]; then
    # Cite the half that actually differs. A citation pointing at the line that states the
    # OTHER value is shape-perfect and unfalsifiable advice.
    case "$_bv" in *" / "*) _fb="${_bv#*" / "}";; *) _fb="";; esac
    _eb="${_hv#*" / "}"
    if [ "$_fb" != "$_eb" ] && [ "$_H_L5" -gt 0 ]; then _cite_line "$_H_L5"; else _cite_line "$_H_L4"; fi
    _bytenote "$_hv" "$_bv"
    _example_row "$_lane" "$_b7" ""
    _w_head board-header-drift "$BOARD_CITE:$_ln" \
      "initiatives row \`$_lane\` column \`appetite/burn\` disagrees with its lane header$_BN"
    _w_exp "$_hv" "initiatives/$_lane/PROGRESS.md:$_CL"
    _w_fnd "$_bv" "$BOARD_CITE:$_ln, column \`appetite/burn\`"
    _w_ex  "$_EX"
  fi

  # --- blocked-on / depends-on: grammar before drift ---
  _norm "$_b6"; _bv="$_N"; _c6_expected; _hv="$_C6"
  if [ "$_H_L6" -gt 0 ]; then _cite_line "$_H_L6"; else _cite_line "$_H_L7"; fi
  if ! _dep_ok "$_bv"; then
    # A cell that fails the grammar gets ONE WARN, not two: the drift check is skipped,
    # because a smart-dash substitution applied to BOTH files leaves a malformed cell with
    # no drift to give it away, and reporting the same defect twice makes the count
    # non-deterministic for the fixture that has to pin it.
    if _dep_ok "$_hv"; then _exp6="$_hv"; else _exp6="<lane|owner|external> $_DASH <reason>, or $_DASH when empty"; fi
    # A cell with no letter or digit was meant to be the empty marker and got the wrong
    # bytes; a cell with words is a real dependency missing its target, so the Example
    # keeps the words and supplies the target rather than silently deleting the fact.
    case "$_bv" in
      *[abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789]*) _fix6="external $_DASH $_bv";;
      *) _fix6="$_DASH";;
    esac
    _bytenote "$_exp6" "$_bv"
    _example_row "$_lane" "$_b7" "$_fix6"
    _w_head board-bad-dependency-line "$BOARD_CITE:$_ln" \
      "board row \`$_lane\` column \`blocked-on / depends-on\` is not the ADR-0051 dependency convention$_BN"
    _w_exp "$_exp6" "initiatives/$_lane/PROGRESS.md:$_CL"
    _w_fnd "$_bv"   "$BOARD_CITE:$_ln, column \`blocked-on / depends-on\`"
    _w_ex  "$_EX"
  elif [ "$_bv" != "$_hv" ]; then
    _bytenote "$_hv" "$_bv"
    _example_row "$_lane" "$_b7" ""
    _w_head board-header-drift "$BOARD_CITE:$_ln" \
      "initiatives row \`$_lane\` column \`blocked-on / depends-on\` disagrees with its lane header$_BN"
    _w_exp "$_hv" "initiatives/$_lane/PROGRESS.md:$_CL"
    _w_fnd "$_bv" "$BOARD_CITE:$_ln, column \`blocked-on / depends-on\`"
    _w_ex  "$_EX"
  fi
done

# ---------- lanes -> rows (the other direction of the iff) ----------
# The lane set is the DIRECTORY listing, never the set of readable PROGRESS.md files. A
# lane whose header is missing is exactly the lane a file-glob enumeration cannot see, and
# a gate that reports on the set it enumerated rather than on the thing is this project's
# most expensive recurring bug.
for _l in "${LANES[@]}"; do
  _cite="initiatives/$_l/PROGRESS.md"
  if ! _hdr_get "$_l" || ! _has_header; then
    if [ ! -f "$ROOT/$_cite" ]; then
      _why="lane \`$_l\` has no readable PROGRESS.md, so its board row would have nothing to derive from (ADR-0062)"
      _line=1
    elif [ "${_H_HINT:-0}" -gt 0 ]; then
      _why="lane \`$_l\`'s machine header is swallowed by a fenced block that never closes, so no value is readable (ADR-0062)"
      _line="$_H_HINT"
    else
      _why="lane \`$_l\` has no readable ADR-0051 machine header, so its board row would have nothing to derive from (ADR-0062)"
      _line=1
    fi
    _w_head lane-no-machine-header "$_cite:$_line" "$_why"
    _w_exp "a machine header block: status / cycle / phase / appetite / burn / blocked-on / depends-on" "$_cite:$_line"
    _w_fnd "$_ABSENT" "$_cite:$_line"
    _w_ex  "status: IDLE"
    # No lane-no-board-row for the same lane. One defect, one fix: the header is written
    # first and the row lands in the same commit (ADR-0061 §4), and a row Example built
    # from a header that does not exist would be seven `(none)` cells -- not paste-able
    # advice, and not something anyone should paste.
    continue
  fi
  if [ "$_PARSEABLE" -eq 0 ] || ! _row_for_lane "$_l"; then
    _cite_line "$_H_L1"
    _example_row "$_l" "" ""
    if [ "$_PARSEABLE" -eq 0 ]; then
      _why="lane \`$_l\` has no row: PORTFOLIO.md has no parseable \`## Active initiatives\` table (ADR-0061: a row exists iff the lane directory does)"
    else
      _why="lane \`$_l\` has no row in the Active initiatives table (ADR-0061: a row exists iff the lane directory does)"
    fi
    # loc-kind `file`: a BARE repo-relative path, no colon anywhere. The defect is the
    # whole file's missing row, and this is the only board class whose WARN location and
    # whose Expected citation point at different files.
    _w_head lane-no-board-row "$BOARD_CITE" "$_why"
    _w_exp "a row for \`$_l\`" "$_cite:$_CL"
    _w_fnd "$_ABSENT"          "$BOARD_CITE:$_SEC_CITE"
    _w_ex  "$_EX"
  fi
done

exit 0
