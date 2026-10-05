#!/usr/bin/env bash
# composer-bash-check.sh -- the ui-composer's BASH boundary (ADR-1415 amendment, 2026-09-17).
# Since ADR-1420 it also bounds the design-curator's Bash and WebFetch; see the design-curator block.
#
# ui-composer.md declares `Bash(bash .claude/scripts/design/design-render.sh:*)`: one entry point.
# On the lexos-p02 live demo every composer ran node, sed -i, python3, PowerShell and cmd through
# it, because a subagent's `tools:` field takes tool NAMES and the specifier granted all of Bash.
# Bash walks past both boundaries -- `cat` reads a sibling, `sed -i` writes anywhere, and
# `composer-scope-check.sh --end` releases the read boundary. Isolation held on that run only
# because no composer looked, which is compliance, not refusal.
#
# The documented per-subagent control is a PreToolUse hook, and a subagent's tool-call payload
# carries `agent_type` -- measured 2026-09-17 with an owner-approved probe: present for a subagent,
# absent for the main session. It is written by the harness, not by the agent, so it can be
# trusted where a marker file cannot.
#
# So for `ui-composer`, and nobody else, exactly one Bash command shape is allowed:
#
#   bash .claude/scripts/design/design-render.sh docs/design/explore/<id>/<variant>/<page>
#        --mode explore --session <id>--<variant> [--iter N] [--viewport WxH]
#
# where <id>/<variant> is the ONE armed composer boundary. The route and the session are both
# pinned to it: rendering a sibling into the composer's own session would put a sibling's pixels
# exactly where the composer is allowed to read.
#
#   composer-bash-check.sh     # payload JSON on stdin (the PreToolUse dispatcher's contract)
#   composer-bash-check.sh --identity   # payload on stdin; answers only WHO is calling
#
# Exit: 0 allow | 2 BLOCK. Never any other code. bash-3.2 / POSIX-safe.
#
# --identity is how the read and write boundaries learn who is calling (ADR-1419): they judge only
# a ui-composer call, and they ask THIS parser rather than carrying a second hand-written one (the
# twin-fix rule). Its exit: 0 a ui-composer call | 10 someone else's | 12 the call may be a
# composer's and its identity cannot be read exactly, which the caller refuses. Neither verdict is
# a code bash makes on its own: 1 is what it exits with when a script dies (an unbound variable, a
# failed fork -- attack r1, B2) and 2 is a syntax error (r2, B2), and a crash must never read as a
# verdict. The caller judges every code it does not know, and says the parser is at fault. The next line is the handshake a caller checks before it asks (B8):
# composer-bash-check: speaks --identity
set -uo pipefail
# Byte semantics for every string operation below: under a UTF-8 locale bash counts and strips
# characters, which is slower and made a long string's cost grow faster than its length (eighth
# attack pass, SH8-1). Every character class in this file is spelled out, so nothing depends on it.
LC_ALL=C; export LC_ALL

IDENTITY=0
[ "${1:-}" = "--identity" ] && IDENTITY=1
# Not a composer's call: allowed by the Bash boundary, answered "someone else" by --identity.
_other() { [ "$IDENTITY" -eq 1 ] && exit 10; exit 0; }

[ -t 0 ] && { [ "$IDENTITY" -eq 1 ] && exit 12; exit 0; }
PAYLOAD="$(cat)"

# Cheap first: nearly every call is not a composer's, and they must not pay for the parse. The
# letters are matched without case, so `UI-Composer` still reaches the identity check. A payload
# carrying any JSON escape is parsed too, because an identity spelled with one never shows the
# word (eighth attack pass, G); without a working jq that case is let go below, not refused.
# --identity skips the shortcut: it runs only while a composer is armed, and a payload it cannot
# parse must reach the checks below rather than be waved through as "someone else" (B3).
[ "$IDENTITY" -eq 1 ] \
  || case "$PAYLOAD" in *[Uu][Ii]-[Cc][Oo][Mm][Pp][Oo][Ss][Ee][Rr]*|*[Dd][Ee][Ss][Ii][Gg][Nn]-[Cc][Uu][Rr][Aa][Tt][Oo][Rr]*|*'\u'*) ;; *) _other;; esac
NAMES_COMPOSER=0
# Names either agent this file governs (ADR-1420 added the curator); the name is kept.
case "$PAYLOAD" in *[Uu][Ii]-[Cc][Oo][Mm][Pp][Oo][Ss][Ee][Rr]*|*[Dd][Ee][Ss][Ii][Gg][Nn]-[Cc][Uu][Rr][Aa][Tt][Oo][Rr]*) NAMES_COMPOSER=1;; esac

_refuse() {
  if [ "$IDENTITY" -eq 1 ]; then echo "ui-composer identity: $1" >&2; exit 12; fi
  echo "BLOCKED by ui-composer bash scope: $1" >&2
  echo "A composer runs one command through Bash -- the renderer, on its own variant, into its own session:" >&2
  echo "  bash .claude/scripts/design/design-render.sh docs/design/explore/<id>/<variant>/index.html --mode explore --session <id>--<variant> --iter N --viewport WxH" >&2
  exit 2
}

# From here the payload may be a composer's, so anything that stops this script from reading who is
# calling refuses. It used to allow: the parser was picked by `command -v jq`, not by jq working,
# so a broken jq read the identity as empty and let a composer's `cat` of a sibling through
# (fifth attack pass, BL-3/BS-6). jq is used only once it has answered a probe correctly. `-j`
# everywhere: no line terminator, so jq.exe's CRLF never reaches a value and nothing has to be
# stripped from the command (eighth pass, A and H).
# Every jq call runs with HOME pointed nowhere: jq loads `$HOME/.jq` on its own, and a file there
# could redefine `length` and wave a long command under the cap (ninth attack pass).
_jq() { HOME=/nonexistent-arc-jq-home jq "$@"; }
JQ_OK=0
if command -v jq >/dev/null 2>&1 && [ "$(printf '{"k":"v"}' | _jq -j '.k' 2>/dev/null)" = "v" ]; then
  JQ_OK=1
fi
# --identity answers "someone else" only about a payload it could read. An empty one, or with jq
# one that is not a JSON object, is unreadable: a Write it cannot parse used to reach the write
# check's fail-closed branch, and the identity question must not open that door (B3). Without jq
# only the empty case is visible; the harness writes these payloads, so a truncated one is not a
# composer's to make.
if [ "$IDENTITY" -eq 1 ]; then
  [ -n "$(printf '%s' "$PAYLOAD" | tr -d ' \t\r\n')" ] || _refuse "the call carries no payload."
  if [ "$JQ_OK" -eq 1 ]; then
    printf '%s' "$PAYLOAD" | _jq -e 'type == "object"' >/dev/null 2>&1 \
      || _refuse "the payload is not a JSON object."
  fi
fi
# Without jq, a payload that only carries an escape cannot be decoded, and the harness never
# escapes the letters of an agent name, so it is not treated as a composer's.
[ "$JQ_OK" -eq 1 ] || [ "$NAMES_COMPOSER" -eq 1 ] || _other

# A payload whose raw text shows a composer identity and is larger than any render's call is
# refused before it is parsed: a composer controls its command's size, and the jq stream count
# grows with every JSON leaf (1M leaves: 42 s; the hook budget is 60 s -- ninth attack pass). A
# render's whole call is under 2 KB. Anyone else's large call is parsed as before.
# --identity also answers for a composer's Write of its own page, which is 40-100 KB of real HTML,
# so its cap is 1 MiB (B1): at two bytes a leaf at worst that is under 22 s of stream count.
_CAP=65536; [ "$IDENTITY" -eq 1 ] && _CAP=1048576
if [ "${#PAYLOAD}" -gt "$_CAP" ] \
   && printf '%s' "$PAYLOAD" | grep -qE '"agent_type"[[:space:]]*:[[:space:]]*"[^"]*([Uu][Ii]-[Cc][Oo][Mm][Pp][Oo][Ss][Ee][Rr]|[Dd][Ee][Ss][Ii][Gg][Nn]-[Cc][Uu][Rr][Aa][Tt][Oo][Rr])'; then
  _refuse "the call is ${#PAYLOAD} bytes, longer than any render's; nothing over $_CAP bytes from a composer is checked or run."
fi

# `_field <key> <stream path> <jq path> <max bytes> [name]` sets FIELD. Returns 0 read (possibly
# absent: FIELD empty), 1 cannot be read EXACTLY, 3 longer than <max bytes>.
#
# With jq, jq decides everything. `--stream` counts every occurrence of the key BEFORE the parser
# merges duplicates, so a second copy spelled with an escape is still a second copy (eighth pass,
# F; BL-7 was the plain-spelling version). A key present once must hold a string; any other shape
# is unreadable.
#
# Without jq, the grep reader is exact only on a payload with no escapes and no line breaks: an
# escaped key name or one split from its colon was read as absent (seventh pass F4; eighth pass B).
# Anything else it cannot read exactly, and a composer's call it cannot read refuses.
#
# A `name` field (the identity and the tool) must also be spelled from letters, digits and `:_.-`
# once whitespace is trimmed: a control character inside one read as "someone else" (eighth pass, D).
#
# The length is checked BEFORE any string work on the value: a strip that grew faster than the
# value held the check past the hook timeout at 600 KB, and a timed-out hook reads as allow (eighth
# pass, A; running defect #25 re-made by its own fix).
_field() {
  _fk="$1"; _fsp="$2"; _fp="$3"; _fmax="$4"; _fname="${5:-}"; FIELD=""
  if [ "$JQ_OK" -eq 1 ]; then
    _fn="$(printf '%s' "$PAYLOAD" | _jq -c --stream --argjson p "$_fsp" 'select(length == 2 and .[0][0:($p | length)] == $p)' 2>/dev/null | wc -l | tr -d ' ')" \
      || return 1
    _fs="$(printf '%s' "$PAYLOAD" | _jq -j "$_fp"' | if . == null then "absent" elif type == "string" then "string" else "other" end' 2>/dev/null)" \
      || return 1
    case "$_fs:$_fn" in
      absent:0) return 0;;
      string:1) ;;
      *) return 1;;
    esac
    _fl="$(printf '%s' "$PAYLOAD" | _jq -j "$_fp"' | length' 2>/dev/null)" || return 1
    case "$_fl" in ""|*[!0123456789]*) return 1;; esac
    [ "$_fl" -le "$_fmax" ] || return 3
    FIELD="$(printf '%s' "$PAYLOAD" | _jq -j "$_fp" 2>/dev/null)" || return 1
  else
    case "$PAYLOAD" in *'\u'*|*'
'*) return 1;; esac
    _fn="$(printf '%s' "$PAYLOAD" | grep -o "\"$_fk\"[[:space:]]*:" 2>/dev/null | wc -l | tr -d ' ')"
    case "$_fn" in 0) return 0;; 1) ;; *) return 1;; esac
    FIELD="$(printf '%s' "$PAYLOAD" | grep -o "\"$_fk\"[[:space:]]*:[[:space:]]*\"[^\"\\]*\"" 2>/dev/null | head -1 \
      | sed 's/^[^:]*:[[:space:]]*"//; s/"$//')"
    [ "${#FIELD}" -le "$_fmax" ] || return 3
  fi
  if [ -n "$_fname" ]; then
    FIELD="$(printf '%s' "$FIELD" | tr -d ' \t\r')"
    case "$FIELD" in *[!ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789:_.-]*) return 1;; esac
  fi
  [ -n "$FIELD" ] || return 1
  return 0
}

# An identity that cannot be read refuses only when the call could be a composer's: the raw text
# names it, or the decoded identity does. A payload that merely carries an escape jq rejects -- a
# lone surrogate in the main session's command -- or an agent name outside the plain alphabet
# is someone else's call, and refusing it scoped the main session again (ninth attack pass, both
# attackers; running defects #19 and #26).
if ! _field agent_type '["agent_type"]' '.agent_type' 256 name; then
  case "$NAMES_COMPOSER:$FIELD" in
    1:*|0:*[Uu][Ii]-[Cc][Oo][Mm][Pp][Oo][Ss][Ee][Rr]*|0:*[Dd][Ee][Ss][Ii][Gg][Nn]-[Cc][Uu][Rr][Aa][Tt][Oo][Rr]*)
      _refuse "the calling agent cannot be identified exactly, and this call may be ui-composer's.";;
  esac
  _other
fi
# Normalised, so a namespaced install (`arc:ui-composer`) or a case change is still the composer
# rather than silently nobody (BL-9). Letters spelled out: `tr '[:upper:]'` maps I to a dotless i
# under tr_TR.
AGENT="$(printf '%s' "$FIELD" | tr 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' 'abcdefghijklmnopqrstuvwxyz')"
# A read identity that normalises to nothing is a failed `tr`, not an answer: a fork that fails on
# the MSYS box leaves AGENT empty, and empty used to be "someone else" (attack r2, B1).
[ -z "$FIELD" ] || [ -n "$AGENT" ] || _refuse "the agent name could not be normalised."
AGENT="${AGENT##*:}"

# ---------- design-curator (ADR-1420) ----------
#
# The scaffold grants tool NAMES, so the curator holds plain Bash and WebFetch, and this is what
# scopes them. Bash: exactly `node .claude/scripts/design/design-refpack.mjs` and its five flags,
# each once. A principle is a sentence, so a value may be double-quoted; inside the quotes only
# CQ's characters appear -- no $, backtick, backslash or inner quote, so bash expands nothing
# there. Outside quotes only CB's. WebFetch: design-refpack.mjs --check-browse decides (https,
# an active pack-eligible registry host, robots ALLOW, inside 40 s). Its other tools are Read,
# Grep and Glob, which no rule here governs.
CB='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._/:-'
CQ="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,:;()'/?!=&%+~@#_-"
_crefuse() {
  echo "BLOCKED by design-curator scope: $1" >&2
  echo "A curator runs one command through Bash -- node .claude/scripts/design/design-refpack.mjs --brief <id> --source <registry id> --url \"<https url>\" --principle \"<sentence>\" --avoid \"<sentence>\" -- and fetches only an active registry host whose robots.txt allows it." >&2
  exit 2
}
# The project root, or a refusal. A failed probe used to fall back to pwd, so the root became the
# hook's own directory and every comparison against it was vacuous (staging attack, B4).
_croot() {
  if [ -n "${CLAUDE_PROJECT_DIR:-}" ]; then printf '%s' "$CLAUDE_PROJECT_DIR"; return 0; fi
  git rev-parse --show-toplevel 2>/dev/null
}
# One spelling for a path, for COMPARISON only: forward slashes, no trailing slash, an MSYS `/c/`
# drive as `c:/`. Case is folded only where the filesystem folds it: on a case-sensitive one,
# `/work/Arc` and `/work/arc` are two checkouts (staging attack, B13). Never used to open anything.
_normp() {
  _o="$(printf '%s' "$1" | tr '\\' '/' | sed 's#/*$##; s#^/\([A-Za-z]\)/#\1:/#; s#^/\([A-Za-z]\)$#\1:#')"
  case "$(uname -s 2>/dev/null)" in
    MINGW*|MSYS*|CYGWIN*) _o="$(printf '%s' "$_o" | tr 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' 'abcdefghijklmnopqrstuvwxyz')";;
  esac
  printf '%s' "$_o"
}
# A relative path in a curator call names a file only from the project root, so a call whose
# working directory is elsewhere is refused -- for Bash (attack r2, B10) and for the reads alike
# (staging attack, B3). An absent cwd is accepted: the harness always sends one.
_cpin() {
  _field cwd '["cwd"]' '.cwd' 4096 || _crefuse "the call's working directory cannot be read exactly."
  [ -n "$FIELD" ] || return 0
  _pr="$(_croot)"; [ -n "$_pr" ] || _crefuse "the project root cannot be found, so where this call runs cannot be judged."
  [ "$(_normp "$FIELD")" = "$(_normp "$_pr")" ] || _crefuse "a curator's call runs from the project root; this one would run in '${FIELD:0:120}'."
}
# The curator's reads (attack r2, B1): its Read, Grep and Glob were ungoverned, so a fetched page
# could tell it to read a secret and carry the text out through a principle. It reads the registry,
# the design docs (the brief) and the screens it staged, nothing else. The path key is chosen by
# the tool -- Read's file_path, Grep's and Glob's path -- and the other key present is a refusal,
# so the hook never judges one field while the tool uses another (staging attack, B5).
_curator_read() {
  _tool="$1"
  _cpin
  if [ "$_tool" = "Read" ]; then _pk=file_path; _ok=path; else _pk=path; _ok=file_path; fi
  _field "$_ok" "[\"tool_input\",\"$_ok\"]" ".tool_input.$_ok" 1024 || _crefuse "the input of a curator $_tool cannot be read exactly."
  [ -z "$FIELD" ] || _crefuse "a curator's $_tool carries $_ok, which $_tool does not use."
  _field "$_pk" "[\"tool_input\",\"$_pk\"]" ".tool_input.$_pk" 1024 || _crefuse "the path of a curator $_tool cannot be read exactly."
  _p="$FIELD"
  # A Glob pattern is a path, so it is held to a plain alphabet: no braces, groups, classes or
  # negation that could expand into a climb, never absolute, never `..`. A Grep pattern is a
  # regex over contents, not a path, and only its path is bound (staging attack, B6 and B7).
  if [ "$_tool" = "Glob" ]; then
    _field pattern '["tool_input","pattern"]' '.tool_input.pattern' 256 || _crefuse "the pattern of a curator Glob cannot be read exactly."
    case "$FIELD" in
      ""|/*|*[!abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._*/-]*) _crefuse "a curator's Glob pattern uses letters, digits and . _ * / - only, and is relative.";;
      ..|../*|*/..|*/../*) _crefuse "a curator's Glob pattern never climbs.";;
    esac
  fi
  [ -n "$_p" ] || _crefuse "a curator's $_tool names a path: design.sources.yaml or something under docs/design/."
  _np="$(_normp "$_p")"; _pr="$(_croot)"
  [ -n "$_pr" ] || _crefuse "the project root cannot be found, so the path cannot be judged."
  _nr="$(_normp "$_pr")"
  [ -n "$_np" ] && [ -n "$_nr" ] || _crefuse "the path could not be normalised."
  case "$_np" in "$_nr"/*) _np="${_np#"$_nr"/}";; esac
  while :; do case "$_np" in ./*) _np="${_np#./}";; *) break;; esac; done
  case "$_np" in
    ..|../*|*/..|*/../*) _crefuse "'${_p:0:120}' climbs out of where a curator reads.";;
    design.sources.yaml|docs/design|docs/design/*) exit 0;;
    # The screens it staged, so it looks before it writes a principle -- the pack's staged/
    # directory only, never its logs or another state file.
    .claude/state/design/refpacks/*/staged/?*)
      _b="${_np#.claude/state/design/refpacks/}"; _b="${_b%%/*}"
      case "$_b" in ""|*[!abcdefghijklmnopqrstuvwxyz0123456789-]*) ;; *) exit 0;; esac;;
  esac
  _crefuse "'${_p:0:120}' is outside what a curator reads: design.sources.yaml, docs/design/, and the screens it staged."
}
# A URL is a request to the registry host, and a query is text the host receives. Capped, and no
# fragment: a fetched page could otherwise have the curator read a brief and send it out 1 KB at
# a time (staging attack, B2).
_curl_ok() {
  case "$1" in *'#'*) _crefuse "a curator's URL carries no fragment.";; esac
  case "$1" in
    *'?'*) _q="${1#*\?}"; [ "${#_q}" -le 64 ] || _crefuse "a curator's URL query is at most 64 bytes.";;
  esac
}
_curator_bash() {
  _cpin
  # The status is captured in a conditional, so no errexit in force can end the script on it and
  # hand the dispatcher a code it reads as allow (attack r1, B7).
  if _field command '["tool_input","command"]' '.tool_input.command' 2000; then _frc=0; else _frc=$?; fi
  case $_frc in
    0) ;;
    3) _crefuse "the command is longer than 2000 bytes; a refpack call is at most a 1024-byte URL and two 300-character sentences.";;
    *) _crefuse "the command could not be read from the payload.";;
  esac
  CMD="$FIELD"
  [ -n "$CMD" ] || _crefuse "the call carries no command."
  # The quote goes FIRST: CQ ends in `-`, which must stay last to be a literal. Written after CQ,
  # the quote made `_-"` a reversed range and emptied the class of `_`, `-` and `"` (attack r1, B1).
  case "$CMD" in *[!\"$CQ]*) _crefuse "the command carries a character no refpack call needs (shell syntax, a backslash or a line break).";; esac
  # One pass over the characters: words split on single spaces, a quote opens only a word and
  # closes only at its end, and nothing outside quotes leaves CB. Words are joined with a line
  # break, which the alphabet above already excludes from the command itself.
  _toks=""; _cur=""; _inq=0; _had=0; _i=0; _len=${#CMD}
  while [ "$_i" -lt "$_len" ]; do
    _c="${CMD:$_i:1}"; _i=$((_i + 1))
    if [ "$_inq" -eq 1 ]; then
      if [ "$_c" = '"' ]; then
        [ -n "$_cur" ] || _crefuse "an empty quoted value is not a value."
        _inq=0
        case "${CMD:$_i:1}" in ""|" ") ;; *) _crefuse "a closing quote must end its word.";; esac
      else
        _cur="$_cur$_c"
      fi
      continue
    fi
    case "$_c" in
      " ") [ "$_had" -eq 1 ] || _crefuse "the command must be single-spaced."
           _toks="$_toks$_cur
"; _cur=""; _had=0;;
      '"') [ "$_had" -eq 0 ] || _crefuse "a quote may only open a word."
           _inq=1; _had=1;;
      *) case "$_c" in [$CB]) ;; *) _crefuse "'$_c' outside quotes is shell syntax.";; esac
         _cur="$_cur$_c"; _had=1;;
    esac
  done
  [ "$_inq" -eq 0 ] || _crefuse "a quote is never closed."
  [ "$_had" -eq 1 ] || _crefuse "the command ends in a space."
  _toks="$_toks$_cur"
  set -f; IFS='
'
  # shellcheck disable=SC2086
  set -- $_toks
  unset IFS; set +f
  [ "${1:-}" = "node" ] && [ "${2:-}" = ".claude/scripts/design/design-refpack.mjs" ] \
    || _crefuse "'${CMD:0:120}' is not the refpack builder."
  shift 2
  _seen=" "
  while [ "$#" -gt 0 ]; do
    [ "$#" -ge 2 ] || _crefuse "the flag '${1:0:40}' has no value."
    case "$_seen" in *" $1 "*) _crefuse "the flag '${1:0:40}' is given twice.";; esac
    case "$1" in
      --brief|--source|--url|--principle|--avoid) ;;
      --stage) [ "$2" = "1" ] || _crefuse "--stage takes 1.";;
      --staged) case "$2" in [0123456789abcdef][0123456789abcdef][0123456789abcdef][0123456789abcdef][0123456789abcdef][0123456789abcdef][0123456789abcdef][0123456789abcdef][0123456789abcdef][0123456789abcdef][0123456789abcdef][0123456789abcdef][0123456789abcdef][0123456789abcdef][0123456789abcdef][0123456789abcdef]) ;; *) _crefuse "--staged takes the 16-hex prefix the stage printed.";; esac;;
      *) _crefuse "the flag '${1:0:40}' is not one a curator's refpack call takes (a test seam never is).";;
    esac
    case "$2" in --*) _crefuse "the flag '$1' has no value.";; esac
    # A second line of defence, not trusting the builder alone to reject a value that becomes a
    # path (attack r1, B11): ids follow the lane grammar, and the URL is https.
    case "$1" in
      --brief|--source)
        case "$2" in ""|-*|*[!abcdefghijklmnopqrstuvwxyz0123456789-]*) _crefuse "$1 takes lowercase letters, digits and hyphens.";; esac
        [ "${#2}" -le 64 ] || _crefuse "$1 is longer than 64 characters."
        case "$2" in con|prn|aux|nul|com[0123456789]|lpt[0123456789]) _crefuse "$1 is a Windows device name.";; esac;;
      --url)
        case "$2" in https://?*) ;; *) _crefuse "--url is an https URL.";; esac
        [ "${#2}" -le 1024 ] || _crefuse "--url is longer than 1024 bytes."
        # The registry binds hosts: no port and no userinfo in the authority (attack r2, B4).
        _auth="${2#https://}"; _auth="${_auth%%/*}"; _auth="${_auth%%\?*}"; _auth="${_auth%%#*}"
        case "$_auth" in *:*|*@*) _crefuse "--url carries a port or userinfo; the registry binds hosts.";; esac
        _curl_ok "$2";;
      --principle|--avoid)
        # Free text is capped and must say something: a sentence is not a channel for whatever a
        # fetched page told the curator to read (attack r2, B1 and B6).
        [ "${#2}" -le 300 ] || _crefuse "$1 is longer than 300 characters; it is one sentence."
        case "$2" in *[abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789]*) ;; *) _crefuse "$1 says nothing: it needs a letter or a digit.";; esac;;
    esac
    _seen="$_seen$1 "
    shift 2
  done
  # Two shapes: a --stage (fetch to look at it, no row) or an add (with its principle).
  case "$_seen" in
    *" --stage "*)
      case "$_seen" in *" --principle "*|*" --avoid "*|*" --staged "*) _crefuse "a call is a stage OR add: a staged screen carries no principle yet.";; esac
      _need="--brief --source --url";;
    # An add is bound to the bytes the curator looked at (staging attack, B8).
    *) _need="--brief --source --url --principle --avoid --staged";;
  esac
  for _f in $_need; do
    case "$_seen" in *" $_f "*) ;; *) _crefuse "a refpack call needs $_f.";; esac
  done
  exit 0
}
_curator_fetch() {
  _field url '["tool_input","url"]' '.tool_input.url' 1024 || _crefuse "the URL of a WebFetch cannot be read exactly, or is longer than 1024 bytes."
  [ -n "$FIELD" ] || _crefuse "the WebFetch carries no URL."
  _url="$FIELD"
  _curl_ok "$_url"
  _root="$(_croot)"
  [ -n "$_root" ] || _crefuse "the project root cannot be found, so the preflight cannot run."
  [ -f "$_root/.claude/scripts/design/design-refpack.mjs" ] \
    || _crefuse "design-refpack.mjs is missing, so a curator's fetch cannot be preflighted."
  set -- --check-browse "$_url"
  # The offline seams, for the suite only. A curator cannot set the hook's environment, but an
  # operator's shell can leak ARC_DESIGN_OFFLINE into the session, so forwarding needs a second,
  # hook-specific switch, and the builder stamps a fixture answer `fixture` in its log (attack
  # r1, B5).
  if [ "${ARC_DESIGN_OFFLINE:-}" = "1" ] && [ "${ARC_DESIGN_HOOK_SEAMS:-}" = "1" ]; then
    [ -z "${ARC_DESIGN_ROBOTS_FILE:-}" ] || set -- "$@" --robots-file "$ARC_DESIGN_ROBOTS_FILE"
    [ -z "${ARC_DESIGN_ROBOTS_STATUS:-}" ] || set -- "$@" --robots-status "$ARC_DESIGN_ROBOTS_STATUS"
  fi
  # From the root and by a relative path: a POSIX path handed to a native node is red on the
  # Windows leg only.
  # In a conditional, the twin of r1 B7: under errexit a bare failing substitution ended the script
  # with the builder's 3 or 4, which the harness reads as allow (attack r2, B2).
  if _out="$(cd "$_root" && node .claude/scripts/design/design-refpack.mjs "$@" 2>&1 >/dev/null)"; then _rc=0; else _rc=$?; fi
  [ "$_rc" -eq 0 ] && exit 0
  _crefuse "WebFetch ${_url:0:120} -- ${_out:0:300}"
}

case "$AGENT" in
  ui-composer) ;;
  design-curator)
    # --identity answers for the composer's read and write boundaries, and a curator is not the
    # composer: it holds no Write or Edit, and its reads are its own.
    [ "$IDENTITY" -eq 1 ] && _other
    _field tool_name '["tool_name"]' '.tool_name' 64 name || _crefuse "the tool of a design-curator call cannot be read exactly."
    case "$PAYLOAD" in *'\u00'[01]*) _crefuse "the call carries an escaped control character.";; esac
    # An explicit list: an absent or empty tool name is not "some other tool" (attack r1, B6).
    case "$FIELD" in
      Bash) _curator_bash;;
      WebFetch) _curator_fetch;;
      Read|Grep|Glob) _curator_read "$FIELD";;
      *) _crefuse "the tool '${FIELD:0:40}' is not one the curator holds.";;
    esac;;
  *) _other;;
esac
# The identity is all --identity answers; the tool and the command below are the Bash boundary's.
[ "$IDENTITY" -eq 1 ] && exit 0
_field tool_name '["tool_name"]' '.tool_name' 64 name || _refuse "the tool of a ui-composer call cannot be read exactly."
[ "$FIELD" = "Bash" ] || exit 0

# Only now, with the caller known to be a composer running Bash: a JSON escape for a control
# character refuses. jq decodes the escape for NUL to a real NUL, which bash then drops without a
# word, so the checked command and the run command could differ (BL-7). It ran before the identity
# check at first, and blocked the MAIN session's own probes that mentioned ui-composer (seventh
# attack pass, F1; running defect #19).
case "$PAYLOAD" in *'\u00'[01]*) _refuse "the call carries an escaped control character, and a command that cannot be read exactly is not run.";; esac

# Length before shape. A real render is under 200 bytes and a dozen words. An uncapped command was
# split into its words and THEN core/common.sh was sourced with every word still in `$@`, which
# grows with the word count: 240k words held this check for 129 s, past the hook timeout, and a
# timed-out hook is read as ALLOW (seventh attack pass, S1; running defects #14 and #17). The cap is
# applied inside `_field`, before its own string work (eighth pass, SH8-1).
_field command '["tool_input","command"]' '.tool_input.command' 400
case $? in
  0) ;;
  3) _refuse "the command is longer than any render; nothing longer than 400 bytes is checked or run.";;
  *) _refuse "the command could not be read from the payload, and an unreadable composer command is not run.";;
esac
CMD="$FIELD"
[ -n "$CMD" ] || _refuse "the call carries no command, and an unreadable composer command is not run."

# One line, one command, from a closed alphabet. Anything a shell treats as syntax -- ; & | > < $
# backtick, quotes, backslash, parentheses, braces, globs, newlines -- is outside the alphabet, so a
# second command can never ride along. Checked with a case on explicit characters, never a regex
# range, which resolves through the locale's collation table.
case "$CMD" in
  *[!abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._/\ -]*)
    _refuse "'${CMD:0:120}' contains a character outside the renderer's argument alphabet (shell syntax, quotes or a line break).";;
esac
case "$CMD" in
  *"  "*) _refuse "the command must be single-spaced.";;
esac

# Word-split on spaces only, with globbing off (the alphabet has no glob characters, but a split
# that could glob is a split nobody should have to reason about).
set -f
IFS=' '
# shellcheck disable=SC2086
set -- $CMD
unset IFS
set +f

[ "${1:-}" = "bash" ] && [ "${2:-}" = ".claude/scripts/design/design-render.sh" ] \
  || _refuse "'${CMD:0:120}' is not the renderer."
ROUTE="${3:-}"
shift 3 2>/dev/null || _refuse "the renderer was given no page."

# The armed boundary names the variant this composer owns. Exactly one, valid, or nothing runs:
# a composer outside an explore has nothing to render, and two armed is the serial-composition
# refusal the read boundary makes.
# The project the harness names, not whatever repo the hook's cwd is in: the fragment finds this
# script through CLAUDE_PROJECT_DIR, and a marker read from another checkout allowed variant-b
# (BL-4, lane defect #3).
ROOT="${CLAUDE_PROJECT_DIR:-}"
[ -n "$ROOT" ] || ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
. "$ROOT/.claude/scripts/core/common.sh" 2>/dev/null || true
type arc_cm_load >/dev/null 2>&1 || _refuse "core/common.sh cannot be loaded, so the armed composer boundary cannot be read."
_n=0; _mk=""
for _m in "$ROOT/.claude/state/design"/composer-session--*; do
  [ -f "$_m" ] || continue
  _n=$((_n + 1)); _mk="$_m"
  # Two is already a refusal, so the count stops there: a cap on the output must also cap the
  # work (running defect #17).
  [ "$_n" -lt 2 ] || break
done
[ "$_n" -eq 1 ] || _refuse "$([ "$_n" -eq 0 ] && echo "no composer boundary is" || echo "more than one composer boundary is") armed; a composer's render is judged against exactly one."
arc_cm_load "$_mk" || _refuse "the armed composer marker is malformed."
EX="$ARC_MF_EXPLORE"; VARIANT="$ARC_MF_VARIANT"

# Every echoed value is capped: a 20KB route used to come back as 20KB of stderr (BS-10, lane
# defect #14).
case "$ROUTE" in
  */../*|../*|*/..|..|*//*|/*) _refuse "the page '${ROUTE:0:120}' is not a plain repo-relative path.";;
  "docs/design/explore/$EX/$VARIANT/"?*) ;;
  *) _refuse "the page '${ROUTE:0:120}' is not inside your own variant, docs/design/explore/$EX/$VARIANT/.";;
esac

# A viewport the renderer can honour: two whole numbers, no leading zero, each 200 to 4096. `0x0`
# hung the renderer for 32 s and a leading zero never matches a declared viewport (BL-6). The
# renderer applies the same bound to itself.
_viewport_ok() {
  case "$1" in
    [123456789][0123456789][0123456789]x[123456789][0123456789][0123456789]) ;;
    [123456789][0123456789][0123456789]x[1234][0123456789][0123456789][0123456789]) ;;
    [1234][0123456789][0123456789][0123456789]x[123456789][0123456789][0123456789]) ;;
    [1234][0123456789][0123456789][0123456789]x[1234][0123456789][0123456789][0123456789]) ;;
    *) return 1;;
  esac
  [ "${1%x*}" -ge 200 ] && [ "${1%x*}" -le 4096 ] && [ "${1#*x}" -ge 200 ] && [ "${1#*x}" -le 4096 ]
}

# Each flag at most once. Last-wins let `--session lexos-v1--variant-b --session lexos-v1--variant-a`
# be judged on the second value while the renderer's own reading was never checked here (BL-5,
# lane defect #13).
MODE=""; SESSION=""; _seen=" "
while [ "$#" -gt 0 ]; do
  [ "$#" -ge 2 ] || _refuse "the flag '${1:0:40}' has no value."
  case "$_seen" in *" $1 "*) _refuse "the flag '${1:0:40}' is given twice.";; esac
  case "$1" in
    --mode)     MODE="$2";;
    --session)  SESSION="$2";;
    --iter)     case "$2" in 1|2|3) ;; *) _refuse "--iter takes 1, 2 or 3.";; esac;;
    --viewport) _viewport_ok "$2" || _refuse "--viewport takes WxH, each a whole number from 200 to 4096 with no leading zero.";;
    *)          _refuse "the flag '${1:0:40}' is not one a composer's render takes.";;
  esac
  _seen="$_seen$1 "
  shift 2
done
[ "$MODE" = "explore" ] || _refuse "a composer renders with --mode explore."
[ "$SESSION" = "$EX--$VARIANT" ] || _refuse "a composer renders into its own session, --session $EX--$VARIANT."
exit 0
# composer-bash-check: end
