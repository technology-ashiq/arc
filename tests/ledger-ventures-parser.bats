#!/usr/bin/env bats
# Phase 00 -- the strict `ventures.yaml` reader, its digest, and the receipt gate that stands on
# both (ADR-1008 / LED-I, ADR-1017 / LED-R).
#
# THREE SEPARATE CLAIMS LIVE HERE, and they are separate on purpose:
#
#   A. THE PARSER REFUSES. ADR-1008 calls this file parser-class for one reason, quoted: "a criteria
#      parser that accepts a malformed line is a criteria parser that silently disables a kill
#      switch". So each refusal test asserts the specific error CODE, never merely that something
#      failed -- a parser that refused every document for the wrong reason would satisfy a bare
#      "it failed" assertion on all of them at once.
#
#   B. THE DIGEST IS OVER THE PARSED VALUES AND NEVER OVER THE FILE BYTES. That is the whole design
#      of the control: reformatting, comments, CRLF, a BOM and a missing trailing newline must leave
#      a receipt standing, while any threshold, any added or removed venture, and the schema version
#      must break it. A digest that fired on whitespace would be a control everyone learns to mute;
#      a digest blind to a number would be a rubber stamp. Both directions are asserted below.
#
#   C. THE GATE REFUSES THE WHOLE RENDER, through the REAL CLI (`node .claude/scripts/hq/arc-pnl.mjs`)
#      and never the library in isolation, because the guarantee is "nothing downstream can consume a
#      partial answer" and only the real command has a stdout to be empty. The stdout BYTE COUNT is
#      asserted at zero, which is the half that actually proves it.
#
# THE NEGATIVE CONTROL is `ventures: the right digest approved through arc-inbox renders the P&L and
# the kill panel`. It pins the exact panel line `days_without_revenue  10 of 90  80 to the line`,
# which no crash, no empty output and no absent panel can produce -- rip out parseVentures,
# deriveKillPanel or the receipt fold and that test dies rather than passing on a stack trace. The
# refusal tests are crash-proofed the same way: each asserts the SPECIFIC stderr string
# `UNRECEIPTED CRITERIA CHANGE`, so a command that died on import can never satisfy them, and the
# runner keeps READ_ERROR (2), LOAD_ERROR (3) and INTERNAL (4) distinct from a refusal (1) so
# "the implementation is gone" cannot masquerade as "the input was refused".
#
# WHERE THE DOCUMENTS COME FROM. Three are COMMITTED under tests/fixtures/ledger/ventures/ because
# their BYTES are the thing under test: `02-crlf-bom.yaml` carries a leading UTF-8 BOM, CRLF endings
# and no trailing newline, and `03-tab-indent.yaml` carries one literal TAB used as indentation.
# `.gitattributes` already freezes `tests/fixtures/ledger/** -text`, so git stores those bytes
# verbatim on all three CI legs -- and one test counts them, because a fixture git normalized is a
# fixture that reports HANDLED while testing nothing. Every other document is built inside the test
# that uses it, next to the assertion it feeds, through a builder that asserts its own output is
# non-empty: an empty document is refused as BAD_VENTURES_VERSION, so a heredoc that never reached
# the builder's stdin would make the version tests pass while measuring nothing at all.
#
# Test names are ASCII-only on purpose, and so is every byte of this file: bats SILENTLY DROPS a
# @test whose name carries a non-ASCII character (retro 2026-08-04, arc-evolve) -- five tests once
# vanished and the file stayed green. The final test asserts the registered count against the
# declared count, both derived.
bats_require_minimum_version 1.5.0
load 'test_helper'

HQ="$ARC_ROOT/.claude/scripts/hq"
RUN="$ARC_ROOT/tests/ledger-ventures-runner.mjs"
FIX="$ARC_ROOT/tests/fixtures/ledger/ventures"
EVENT="$HQ/arc-event.sh"
PNL="$HQ/arc-pnl.mjs"
INBOX="$HQ/arc-inbox.mjs"

# The clock is pinned at BOTH ends, because the panel prints a distance measured between them.
# Ingest at T_INGEST (2026-07-22T21:30:00+05:30), render at T_RENDER (2026-08-01) -- ten days later,
# which is what makes `10 of 90  80 to the line` a fixed string rather than a moving one.
T_INGEST=1784736000000
T_RENDER=1785600000000

setup() {
  SPINE="$BATS_TEST_TMPDIR/spine"; mkdir -p "$SPINE"
  export ARC_SPINE_ROOT="$SPINE"
  export ARC_SPINE_RAND="ventures-seed"
  export ARC_SPINE_NOW="$T_INGEST"
  # ARC_VENTURES_FILE is deliberately NOT exported here. venturesPath() branches on the key being
  # PRESENT in the environment, so a suite-wide export would make the consumer case -- no criteria
  # file at all -- unreachable, and that case is the one every install outside this repo runs.
  VY="$BATS_TEST_TMPDIR/ventures.yaml"
}

# ---------- document builders ----------

# Write a criteria document from stdin and leave its path in $DOC.
#
# The non-empty assertion is the fixture-builder rule, and here it is load-bearing rather than
# ceremonial: an EMPTY document is refused as BAD_VENTURES_VERSION, so a heredoc that never reached
# this helper's stdin would leave the version tests green over a file with nothing in it.
_doc() {
  DOC="$BATS_TEST_TMPDIR/doc-$1.yaml"
  cat > "$DOC"
  [ -s "$DOC" ] || { echo "the builder produced an EMPTY document for $1 -- the heredoc never reached its stdin"; return 1; }
}

# The canonical document with ONE criterion value replaced. Everything else is exactly the baseline,
# so a refusal can only be about the value under test.
_with_value() {
  printf 'version: 1\nventures:\n  lexos:\n    kill:\n      days_without_revenue: %s\n      traffic_floor_monthly: 100\n' "$1"
}

# The canonical document with ONE venture name replaced.
_with_venture() {
  printf 'version: 1\nventures:\n  %s:\n    kill:\n      days_without_revenue: 90\n      traffic_floor_monthly: 100\n' "$1"
}

# The canonical document with a scalar attached to `kill:`.
_with_kill() {
  printf 'version: 1\nventures:\n  lexos:\n    kill: %s\n      days_without_revenue: 90\n      traffic_floor_monthly: 100\n' "$1"
}

# ---------- assertions ----------

# Assert <file> is refused with exactly <code>.
#
# Exit status is checked FIRST and against 1 SPECIFICALLY -- the runner reserves 2 for READ_ERROR,
# 3 for LOAD_ERROR and 4 for a throw that is not a SpineError. Without that, a deleted module and a
# missing file both read as "refused" and this whole section would stay green over no implementation.
_expect_code() {
  local code="$1" p="$2" label="$3"
  [ -s "$p" ] || { echo "[$label] the document is EMPTY -- the builder never wrote it"; return 1; }
  run node "$RUN" digest "$p"
  [ "$status" -eq 1 ] || { echo "[$label] expected a refusal (exit 1), got exit $status: $output"; return 1; }
  [[ "$output" == *"REFUSED $code"* ]] || { echo "[$label] expected $code, got: $output"; return 1; }
}

# The criteria digest of <file>, as a bare lowercase sha256 hex. Fails loudly rather than echoing
# an empty string, because an empty digest compares equal to another empty digest.
_digest() {
  local d
  d="$(node "$RUN" digest "$1" 2>&1)" || { echo "no digest for $1: $d" >&2; return 1; }
  [[ "$d" =~ ^[0-9a-f]{64}$ ]] || { echo "not a digest for $1: $d" >&2; return 1; }
  printf '%s' "$d"
}

# Emit the ADR-1017 criteria approval for <file> and echo its ULID.
#
# The idem is DERIVED, never pinned: validate-ledger.mjs welds it to sha256("ledger.criteria|"+digest)
# and refuses anything else, so a hardcoded key would turn every receipt test below into an assertion
# that a REJECTED emit produced no receipt -- which is true, and measures nothing.
_seal() {
  local file="$1" what="$2" dg idem payload id
  dg="$(_digest "$file")" || return 1
  idem="$(node "$RUN" idem "$dg" 2>&1)" || { echo "no idem: $idem" >&2; return 1; }
  [[ "$idem" =~ ^[0-9a-f]{64}$ ]] || { echo "not an idem: $idem" >&2; return 1; }
  payload="$(printf '{"subject":"ledger.criteria","digest":"%s","what":"%s"}' "$dg" "$what")"
  id="$(bash "$EVENT" emit approval.requested --payload "$payload" --idem "$idem" --strict 2>&1)" \
    || { echo "the criteria approval was refused: $id" >&2; return 1; }
  [[ "$id" =~ ^[0-9A-HJKMNP-TV-Z]{26}$ ]] || { echo "the approval did not seal: $id" >&2; return 1; }
  printf '%s' "$id"
}

# Decide <ULID> through the inbox and nothing else. The inbox names the approval it recorded, so
# that string is the marker proving the decision was written rather than merely attempted.
_approve() {
  run node "$INBOX" approve "$1" --reason "kill lines reviewed and adopted"
  [ "$status" -eq 0 ] || { echo "the inbox refused the decision: $output"; return 1; }
  [[ "$output" == *"$1"* ]] || { echo "the inbox did not name the approval it decided: $output"; return 1; }
}

# One real revenue event for lexos, so the days-without-revenue clock has a zero to count from.
_revenue() {
  local p="$BATS_TEST_TMPDIR/rev.json" id
  printf '%s' '{"amount":50000,"currency":"INR","venture":"lexos","provider":"razorpay","provider_payment_id":"razorpay:pay_0001"}' > "$p"
  [ -s "$p" ] || { echo "the revenue payload builder wrote nothing"; return 1; }
  id="$(bash "$EVENT" ingest revenue.received --json "$p" --venture lexos 2>&1)" \
    || { echo "the revenue ingest was refused: $id" >&2; return 1; }
  [[ "$id" =~ ^[0-9A-HJKMNP-TV-Z]{26}$ ]] || { echo "the revenue event did not seal: $id"; return 1; }
}

# Run the REAL CLI with stdout and stderr kept APART. bats `run` merges them, and the ADR-1008
# refusal is a claim about stdout SPECIFICALLY -- merged streams cannot express "stdout is empty".
_pnl() {
  PNL_OUT="$BATS_TEST_TMPDIR/pnl.out"; PNL_ERR="$BATS_TEST_TMPDIR/pnl.err"
  PNL_STATUS=0
  ARC_SPINE_NOW="$T_RENDER" node "$PNL" "$@" > "$PNL_OUT" 2> "$PNL_ERR" || PNL_STATUS=$?
  return 0
}
_pnl_bytes() { wc -c < "$PNL_OUT" | tr -d ' \r'; }

# The refusal, asserted whole: non-zero exit, the named reason on stderr, and NOTHING on stdout.
# The stderr string is what stops a crash satisfying this -- a command that died on import also
# writes zero bytes to stdout and also exits non-zero.
_assert_refused() {
  [ "$PNL_STATUS" -ne 0 ] || { echo "[$1] arc-pnl rendered when it should have refused:"; cat "$PNL_OUT"; return 1; }
  grep -qF "UNRECEIPTED CRITERIA CHANGE" "$PNL_ERR" \
    || { echo "[$1] arc-pnl failed for some OTHER reason (exit $PNL_STATUS):"; cat "$PNL_ERR"; return 1; }
  [ "$(_pnl_bytes)" = "0" ] \
    || { echo "[$1] the refusal still wrote $(_pnl_bytes) bytes to stdout:"; cat "$PNL_OUT"; return 1; }
}

# ---------- A. the parser refusals ----------

@test "ventures: a key repeated at any level is refused as DUPLICATE_VENTURES_KEY, never last-wins" {
  # NEVER last-wins. A duplicated days_without_revenue is precisely how a real threshold gets
  # shadowed by a fake one in a diff that reads as an addition.
  _doc dup-version <<'YAML'
version: 1
version: 1
ventures:
  lexos:
    kill:
      days_without_revenue: 90
      traffic_floor_monthly: 100
YAML
  _expect_code DUPLICATE_VENTURES_KEY "$DOC" "a second version key"

  _doc dup-name <<'YAML'
version: 1
ventures:
  lexos:
    kill:
      days_without_revenue: 90
      traffic_floor_monthly: 100
  lexos:
    kill:
      days_without_revenue: 5
      traffic_floor_monthly: 5
YAML
  _expect_code DUPLICATE_VENTURES_KEY "$DOC" "the same venture declared twice"

  _doc dup-kill <<'YAML'
version: 1
ventures:
  lexos:
    kill:
    kill:
      days_without_revenue: 90
      traffic_floor_monthly: 100
YAML
  _expect_code DUPLICATE_VENTURES_KEY "$DOC" "two kill blocks in one venture"

  _doc dup-criterion <<'YAML'
version: 1
ventures:
  lexos:
    kill:
      days_without_revenue: 90
      days_without_revenue: 120
      traffic_floor_monthly: 100
YAML
  _expect_code DUPLICATE_VENTURES_KEY "$DOC" "one criterion set twice"
}

@test "ventures: a threshold that is not a bare positive decimal integer is refused as BAD_VENTURES_VALUE" {
  # Eight shapes, one rule. `0` is in the list on purpose: a floor nothing can fall below is a
  # disabled switch spelled as an armed one, and it is the one entry here a reader might defend.
  local i=0 v p fails=""
  for v in 090 90.5 '"90"' -90 0 9e1 9_0 0x5a; do
    i=$((i+1))
    p="$BATS_TEST_TMPDIR/val-$i.yaml"
    _with_value "$v" > "$p"
    _expect_code BAD_VENTURES_VALUE "$p" "value $v" || fails="$fails|$v"
  done
  [ "$i" -eq 8 ] || { echo "expected 8 value shapes, ran $i"; false; }
  [ -z "$fails" ] || { echo "refused wrongly:$fails" | tr '|' '\n'; false; }
}

@test "ventures: a tab indent and a three-space indent are refused as BAD_VENTURES_INDENT" {
  # The TAB case is a COMMITTED fixture rather than a here-doc because the BYTE is the whole point:
  # a tab renders at whatever width the reader is configured for, so a tab-indented block is a
  # document whose structure depends on the editor that opens it. The next test counts that byte.
  _expect_code BAD_VENTURES_INDENT "$FIX/03-tab-indent.yaml" "a tab used as indentation"

  _doc three-space <<'YAML'
version: 1
ventures:
   lexos:
     kill:
       days_without_revenue: 90
       traffic_floor_monthly: 100
YAML
  _expect_code BAD_VENTURES_INDENT "$DOC" "three spaces where every level is two"
}

@test "ventures: an unknown key at each of the three levels is refused as UNKNOWN_VENTURES_FIELD" {
  # All three levels, because a closed schema that is closed at only two of them is a closed schema
  # with a door in it, and the criterion level is the door that matters -- an unknown criterion is a
  # kill line nobody evaluates sitting in a file that reads as if it declared one.
  _doc unknown-top <<'YAML'
version: 1
owner: ashiq
ventures:
  lexos:
    kill:
      days_without_revenue: 90
      traffic_floor_monthly: 100
YAML
  _expect_code UNKNOWN_VENTURES_FIELD "$DOC" "an unknown top-level key"

  _doc unknown-venture <<'YAML'
version: 1
ventures:
  lexos:
    notes: paused for now
    kill:
      days_without_revenue: 90
      traffic_floor_monthly: 100
YAML
  _expect_code UNKNOWN_VENTURES_FIELD "$DOC" "an unknown key inside a venture"

  _doc unknown-criterion <<'YAML'
version: 1
ventures:
  lexos:
    kill:
      mrr_floor: 5000
      days_without_revenue: 90
      traffic_floor_monthly: 100
YAML
  _expect_code UNKNOWN_VENTURES_FIELD "$DOC" "an unknown criterion inside kill"
}

@test "ventures: a line that is neither key nor key-value is refused as BAD_VENTURES_SYNTAX" {
  _doc no-colon <<'YAML'
version: 1
ventures
YAML
  _expect_code BAD_VENTURES_SYNTAX "$DOC" "a line carrying no colon"

  _doc ventures-scalar <<'YAML'
version: 1
ventures: 1
YAML
  _expect_code BAD_VENTURES_SYNTAX "$DOC" "ventures given a scalar"

  _doc kill-scalar <<'YAML'
version: 1
ventures:
  lexos:
    kill: 1
YAML
  _expect_code BAD_VENTURES_SYNTAX "$DOC" "kill given a scalar"

  # The trailing space is a VARIABLE, not a literal at the end of a line in this file. A whitespace
  # stripper -- an editor, a formatter, a pre-commit hook -- would otherwise silently delete the one
  # byte this case exists to carry and leave the assertion passing on a well-formed document.
  local sp=" "
  local p="$BATS_TEST_TMPDIR/trailing-space.yaml"
  printf 'version: 1\nventures:\n  lexos:\n    kill:\n      days_without_revenue: 90%s\n      traffic_floor_monthly: 100\n' "$sp" > "$p"
  _expect_code BAD_VENTURES_SYNTAX "$p" "trailing whitespace after a value"

  p="$BATS_TEST_TMPDIR/no-space.yaml"
  printf 'version: 1\nventures:\n  lexos:\n    kill:\n      days_without_revenue:90\n      traffic_floor_monthly: 100\n' > "$p"
  _expect_code BAD_VENTURES_SYNTAX "$p" "no space between key and value"
}

@test "ventures: a kill block missing one criterion is refused as MISSING_VENTURES_FIELD" {
  # BOTH criteria are required and an absent one is NOT a default. Each is checked on its own,
  # because a check written for the pair passes when only the first is present.
  _doc missing-traffic <<'YAML'
version: 1
ventures:
  lexos:
    kill:
      days_without_revenue: 90
YAML
  _expect_code MISSING_VENTURES_FIELD "$DOC" "traffic_floor_monthly absent"

  _doc missing-days <<'YAML'
version: 1
ventures:
  lexos:
    kill:
      traffic_floor_monthly: 100
YAML
  _expect_code MISSING_VENTURES_FIELD "$DOC" "days_without_revenue absent"

  _doc missing-kill <<'YAML'
version: 1
ventures:
  lexos:
    kill:
      days_without_revenue: 90
      traffic_floor_monthly: 100
  arc:
YAML
  _expect_code MISSING_VENTURES_FIELD "$DOC" "a venture with no kill block"

  _doc missing-ventures <<'YAML'
version: 1
YAML
  _expect_code MISSING_VENTURES_FIELD "$DOC" "no ventures key at all"
}

@test "ventures: a ventures map holding no ventures is refused as EMPTY_VENTURES" {
  # An empty map disables every kill switch at once and looks like a tidy file while doing it.
  _doc empty-map <<'YAML'
version: 1
ventures:
YAML
  _expect_code EMPTY_VENTURES "$DOC" "ventures declared and left empty"

  _doc empty-after-tidy <<'YAML'
version: 1
ventures:
  # every venture was removed in a tidy-up and the key was left behind
YAML
  _expect_code EMPTY_VENTURES "$DOC" "every venture commented out"
}

@test "ventures: version 2 and a missing version are both refused as BAD_VENTURES_VERSION" {
  _doc version-two <<'YAML'
version: 2
ventures:
  lexos:
    kill:
      days_without_revenue: 90
      traffic_floor_monthly: 100
YAML
  _expect_code BAD_VENTURES_VERSION "$DOC" "version 2"

  _doc version-absent <<'YAML'
ventures:
  lexos:
    kill:
      days_without_revenue: 90
      traffic_floor_monthly: 100
YAML
  _expect_code BAD_VENTURES_VERSION "$DOC" "no version key"

  # A version that arrives AFTER the data decided nothing about how the data was read.
  _doc version-last <<'YAML'
ventures:
  lexos:
    kill:
      days_without_revenue: 90
      traffic_floor_monthly: 100
version: 1
YAML
  _expect_code BAD_VENTURES_VERSION "$DOC" "version after the data"

  _doc version-empty <<'YAML'
version:
ventures:
  lexos:
    kill:
      days_without_revenue: 90
      traffic_floor_monthly: 100
YAML
  _expect_code BAD_VENTURES_VERSION "$DOC" "version with no value"
}

@test "ventures: an uppercase name and the reserved device name nul are refused as BAD_VENTURES_NAME" {
  # `nul`, `com1` and `lpt9` pass the grammar and break mkdir on exactly ONE of the three CI legs
  # (.claude/rules/lanes.md), which is the worst possible place for them to be discovered.
  local i=0 n p fails=""
  for n in Lexos nul com1 lpt9 1lexos lex_os; do
    i=$((i+1))
    p="$BATS_TEST_TMPDIR/name-$i.yaml"
    _with_venture "$n" > "$p"
    _expect_code BAD_VENTURES_NAME "$p" "venture named $n" || fails="$fails|$n"
  done
  [ "$i" -eq 6 ] || { echo "expected 6 name shapes, ran $i"; false; }
  [ -z "$fails" ] || { echo "refused wrongly:$fails" | tr '|' '\n'; false; }
}

@test "ventures: real YAML this subset does not implement is refused as UNSUPPORTED_VENTURES_YAML" {
  # Refused BY NAME rather than as "unexpected token": a general YAML reader resolves anchors, merges
  # keys and reads 090 as 90 or as a string depending on which spec version it implements. Accepting
  # a superset of this document's one legal shape IS the risk, so each construct is named back.
  _with_kill "&killdefaults"                                     > "$BATS_TEST_TMPDIR/u1.yaml"
  _with_kill "*killdefaults"                                     > "$BATS_TEST_TMPDIR/u2.yaml"
  _with_kill "{days_without_revenue: 90, traffic_floor_monthly: 100}" > "$BATS_TEST_TMPDIR/u3.yaml"
  _with_value "|"                                                > "$BATS_TEST_TMPDIR/u4.yaml"
  printf 'version: 1\nventures:\n  - lexos\n'                    > "$BATS_TEST_TMPDIR/u5.yaml"
  # `printf` is NOT given `---` as its format string: a format beginning with a dash is read as a
  # flag ("printf: - : invalid option") and nothing is written at all.
  { printf '%s\n' '---'; cat "$FIX/01-baseline.yaml"; }          > "$BATS_TEST_TMPDIR/u6.yaml"

  # An INDEXED array, never an associative one: this suite runs on the macOS leg, whose bash is 3.2
  # and has no associative arrays (tests/portability.bats:42-49 records the same constraint).
  local i fails=""
  local labels=("an anchor" "an alias" "a flow mapping" "a block scalar" "a sequence item" "a multi-document marker")
  for i in 0 1 2 3 4 5; do
    _expect_code UNSUPPORTED_VENTURES_YAML "$BATS_TEST_TMPDIR/u$((i + 1)).yaml" "${labels[$i]}" \
      || fails="$fails|u$((i + 1))"
  done
  [ "${#labels[@]}" -eq 6 ] || { echo "expected 6 unsupported constructs, listed ${#labels[@]}"; false; }
  [ -z "$fails" ] || { echo "refused wrongly:$fails" | tr '|' '\n'; false; }
}

@test "ventures: a control byte anywhere in the document is refused as BAD_VENTURES_CHAR" {
  # CRLF is collapsed BEFORE the control scan, so a Windows checkout is ordinary input while a LONE
  # CR -- a legacy ending, or half of a mangled edit -- still lands in the scan as the control byte
  # it is. The TAB case here is the twin of the tab-indent test above and must NOT land on
  # BAD_VENTURES_INDENT: a tab after a value is not indentation, and a check that answered INDENT
  # for both would be answering by byte rather than by position.
  local p
  p="$BATS_TEST_TMPDIR/c-cr.yaml"
  printf 'version: 1\015ventures:\n  lexos:\n    kill:\n      days_without_revenue: 90\n      traffic_floor_monthly: 100\n' > "$p"
  _expect_code BAD_VENTURES_CHAR "$p" "a lone CR"

  p="$BATS_TEST_TMPDIR/c-del.yaml"
  printf 'version: 1\177\nventures:\n  lexos:\n    kill:\n      days_without_revenue: 90\n      traffic_floor_monthly: 100\n' > "$p"
  _expect_code BAD_VENTURES_CHAR "$p" "a DEL byte"

  # NUL gets its own case because a raw 0x00 makes a file BINARY to git, which hides its entire diff
  # -- it already happened once to another file in this lane.
  p="$BATS_TEST_TMPDIR/c-nul.yaml"
  printf 'version: 1\000\nventures:\n  lexos:\n    kill:\n      days_without_revenue: 90\n      traffic_floor_monthly: 100\n' > "$p"
  _expect_code BAD_VENTURES_CHAR "$p" "a NUL byte"

  p="$BATS_TEST_TMPDIR/c-tab.yaml"
  printf 'version: 1\011\nventures:\n  lexos:\n    kill:\n      days_without_revenue: 90\n      traffic_floor_monthly: 100\n' > "$p"
  _expect_code BAD_VENTURES_CHAR "$p" "a TAB that is not indentation"
}

@test "ventures: a missing file and a missing module are NOT refusals" {
  # THE CONTROL THAT MAKES EVERY `exit 1` ABOVE MEAN SOMETHING. Its sibling runner shipped without
  # this separation and a suite asserting `status -eq 1` over a glob of malformed fixtures stayed
  # green with the fixtures deleted, and green again with both parsers deleted.
  run node "$RUN" digest "$BATS_TEST_TMPDIR/does-not-exist.yaml"
  [ "$status" -eq 2 ] || { echo "a missing file reported status $status: $output"; false; }
  [[ "$output" == *"READ_ERROR"* ]] || { echo "$output"; false; }

  run env ARC_VENTURES_MODULE="$BATS_TEST_TMPDIR/no-such-module.mjs" node "$RUN" digest "$FIX/01-baseline.yaml"
  [ "$status" -eq 3 ] || { echo "a missing module reported status $status: $output"; false; }
  [[ "$output" == *"LOAD_ERROR"* ]] || { echo "$output"; false; }

  # And the real module still works, so the two cases above are not simply "this runner never runs".
  run node "$RUN" digest "$FIX/01-baseline.yaml"
  [ "$status" -eq 0 ] || { echo "the real module could not parse the baseline fixture: $output"; false; }
  [[ "$output" =~ ^[0-9a-f]{64}$ ]] || { echo "not a digest: $output"; false; }
}

# ---------- B. the digest contract, both directions ----------
#
# THE DIGEST IS TAKEN OVER THE PARSED, CANONICALIZED VALUES AND NEVER OVER THE FILE BYTES. Every
# assertion in this section is a restatement of that one sentence, in one direction or the other.

@test "ventures: the digest is unchanged by comments, blank lines, CRLF, a BOM and no trailing newline" {
  local base cmts crlf
  base="$(_digest "$FIX/01-baseline.yaml")"

  _doc formatted <<'YAML'
# a whole-line comment above everything

version: 1

ventures:

  # a comment about lexos
  lexos:
    kill:
      days_without_revenue: 90    # marker-9f3a lives in the bytes and never in the digest
      traffic_floor_monthly: 100
  arc:
    kill:
      days_without_revenue: 30
      traffic_floor_monthly: 500
YAML
  cmts="$(_digest "$DOC")"

  # 02-crlf-bom.yaml is the SAME criteria carrying a leading BOM, CRLF endings and no trailing
  # newline. Three byte-level differences, one digest.
  crlf="$(_digest "$FIX/02-crlf-bom.yaml")"

  [ "$cmts" = "$base" ] || { echo "comments and blank lines moved the digest: $cmts vs $base"; false; }
  [ "$crlf" = "$base" ] || { echo "a BOM, CRLF or the missing trailing newline moved the digest: $crlf vs $base"; false; }
}

@test "ventures: the crlf-bom fixture really carries its BOM and its CR bytes in the checkout" {
  # A NEGATIVE CONTROL ON THE CONTROL. If .gitattributes stops holding, the test above quietly starts
  # comparing two identical LF files and reports the byte-independence it never checked. That has
  # already happened once in this lane, on the commit that created tests/fixtures/ledger/.
  local crs tabs
  crs="$(tr -cd '\015' < "$FIX/02-crlf-bom.yaml" | wc -c | tr -d ' ')"
  [ "$crs" -eq 9 ] || { echo "expected 9 CR bytes in 02-crlf-bom.yaml, found $crs -- git normalized the fixture"; false; }
  [ "$(head -c 3 "$FIX/02-crlf-bom.yaml" | od -An -tx1 | tr -d ' \n')" = "efbbbf" ] \
    || { echo "02-crlf-bom.yaml no longer opens with a UTF-8 BOM"; false; }
  # The LAST byte is pinned to the digit rather than asserted to be "not a newline": an assertion
  # shaped "does not contain X" is satisfied by an empty file.
  [ "$(tail -c 1 "$FIX/02-crlf-bom.yaml" | od -An -tx1 | tr -d ' \n')" = "30" ] \
    || { echo "02-crlf-bom.yaml no longer ends mid-line -- the no-trailing-newline case is gone"; false; }
  tabs="$(tr -cd '\011' < "$FIX/03-tab-indent.yaml" | wc -c | tr -d ' ')"
  [ "$tabs" -eq 1 ] || { echo "expected 1 TAB in 03-tab-indent.yaml, found $tabs"; false; }
}

@test "ventures: the digest is unchanged when ventures and criteria are reordered" {
  # canonicalize() sorts by key, so declaration order is not part of what was approved. If it were,
  # an alphabetising editor would revoke a receipt nobody edited.
  local base reordered
  base="$(_digest "$FIX/01-baseline.yaml")"
  _doc reordered <<'YAML'
version: 1
ventures:
  arc:
    kill:
      traffic_floor_monthly: 500
      days_without_revenue: 30
  lexos:
    kill:
      traffic_floor_monthly: 100
      days_without_revenue: 90
YAML
  reordered="$(_digest "$DOC")"
  [ "$reordered" = "$base" ] || { echo "reordering moved the digest: $reordered vs $base"; false; }
}

@test "ventures: the digest changes on any threshold, an added venture and a removed venture" {
  # The other direction, and the one that decides whether this control is a control at all. All four
  # digests must be DISTINCT: three tests that each compared one variant against the baseline would
  # pass for a digest that collapsed every edit onto one value.
  local base changed added removed
  base="$(_digest "$FIX/01-baseline.yaml")"

  _doc changed <<'YAML'
version: 1
ventures:
  lexos:
    kill:
      days_without_revenue: 120
      traffic_floor_monthly: 100
  arc:
    kill:
      days_without_revenue: 30
      traffic_floor_monthly: 500
YAML
  changed="$(_digest "$DOC")"

  _doc added <<'YAML'
version: 1
ventures:
  lexos:
    kill:
      days_without_revenue: 90
      traffic_floor_monthly: 100
  arc:
    kill:
      days_without_revenue: 30
      traffic_floor_monthly: 500
  third:
    kill:
      days_without_revenue: 7
      traffic_floor_monthly: 9
YAML
  added="$(_digest "$DOC")"

  _doc removed <<'YAML'
version: 1
ventures:
  lexos:
    kill:
      days_without_revenue: 90
      traffic_floor_monthly: 100
YAML
  removed="$(_digest "$DOC")"

  local d fails=""
  for d in "$changed" "$added" "$removed"; do
    [ "$d" != "$base" ] || fails="$fails|$d equals the baseline digest"
  done
  [ "$changed" != "$added" ]   || fails="$fails|a changed threshold and an added venture share a digest"
  [ "$changed" != "$removed" ] || fails="$fails|a changed threshold and a removed venture share a digest"
  [ "$added"   != "$removed" ] || fails="$fails|an added venture and a removed venture share a digest"
  [ -z "$fails" ] || { echo "$fails" | tr '|' '\n'; false; }
}

@test "ventures: the digest preimage carries the schema version and none of the formatting" {
  # WHAT THIS TEST IS STANDING IN FOR, said plainly: "the digest changes when `version` changes"
  # cannot be exercised end to end, because v1 is the ONLY accepted version -- parseVentures refuses
  # `version: 2` as BAD_VENTURES_VERSION (tested above) and canonicalVentures refuses it again, so a
  # version-2 document has no digest to compare against. What CAN be asserted, and is what makes the
  # claim true the day v2 exists, is that the version is IN the preimage the digest is taken over.
  run node "$RUN" canon "$FIX/01-baseline.yaml"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *'"version":1'* ]]                  || { echo "the preimage carries no version: $output"; false; }
  [[ "$output" == *'"days_without_revenue":90'* ]]    || { echo "$output"; false; }
  [[ "$output" == *'"traffic_floor_monthly":500'* ]]  || { echo "$output"; false; }

  # And the same preimage out of the heavily formatted document: identical, and carrying none of the
  # comment text. The positive assertions above are what stop this pair being satisfied by a crash.
  _doc formatted-canon <<'YAML'
version: 1
ventures:
  lexos:
    kill:
      days_without_revenue: 90    # marker-9f3a lives in the bytes and never in the digest
      traffic_floor_monthly: 100
  arc:
    kill:
      days_without_revenue: 30
      traffic_floor_monthly: 500
YAML
  local canon_base="$output"
  run node "$RUN" canon "$DOC"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "$canon_base" ] || { echo "formatting changed the preimage:"; echo "$output"; echo "$canon_base"; false; }
  [[ "$output" != *"marker-9f3a"* ]] || { echo "a comment reached the digest preimage: $output"; false; }
}

@test "ventures: the CLI criteria-digest agrees with the digest this suite derives" {
  # The receipt below is only as good as the two derivations agreeing. `arc-pnl --criteria-digest` is
  # the command an operator actually runs before emitting an approval; if it disagreed with the render
  # path, every receipt anyone ever produced would be for a digest the render never looks for.
  cp "$FIX/01-baseline.yaml" "$VY"
  export ARC_VENTURES_FILE="$VY"
  run node "$PNL" --criteria-digest
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" =~ ^[0-9a-f]{64}$ ]] || { echo "the CLI printed no digest: $output"; false; }
  [ "$output" = "$(_digest "$VY")" ] || { echo "the CLI digest and the module digest disagree: $output"; false; }
}

# ---------- C. the receipt gate, through the real CLI ----------

@test "ventures: with a criteria file and no receipt, arc pnl refuses and writes NOTHING to stdout" {
  cp "$FIX/01-baseline.yaml" "$VY"
  export ARC_VENTURES_FILE="$VY"
  _pnl --month 2026-07
  _assert_refused "no receipt at all"
  # The refusal names the digest the operator has to get approved. A refusal nobody can act on is a
  # refusal they will route around, which is how a control becomes a habit of ignoring a control.
  grep -qF "$(_digest "$VY")" "$PNL_ERR" || { echo "the refusal does not name the digest:"; cat "$PNL_ERR"; false; }
}

@test "ventures: an approval carrying the digest is a request, not a receipt, until it is decided" {
  cp "$FIX/01-baseline.yaml" "$VY"
  export ARC_VENTURES_FILE="$VY"
  local aid
  aid="$(_seal "$VY" "adopt the v1 kill lines")" || { echo "the approval could not be sealed"; false; }

  # THE APPROVAL REALLY IS ON THE SPINE AND MERELY UNDECIDED. Without this the test passes when the
  # emit silently did nothing, which is the same refusal for an entirely different reason.
  run node "$INBOX" inbox
  [ "$status" -eq 0 ] || { echo "the inbox could not be read: $output"; false; }
  [[ "$output" == *"$aid"* ]] || { echo "the approval is not OPEN on the spine: $output"; false; }

  _pnl --month 2026-07
  _assert_refused "approved by nobody"
}

@test "ventures: an approved approval for a DIFFERENT digest does not receipt this file" {
  # The honest limit ADR-1017 records is that this approves a STATE. That is only safe if the state
  # is matched exactly -- an approval for some other criteria must not carry this file.
  local other="$BATS_TEST_TMPDIR/other.yaml" aid
  _doc other-criteria <<'YAML'
version: 1
ventures:
  lexos:
    kill:
      days_without_revenue: 120
      traffic_floor_monthly: 100
  arc:
    kill:
      days_without_revenue: 30
      traffic_floor_monthly: 500
YAML
  cp "$DOC" "$other"
  aid="$(_seal "$other" "raise the lexos clock to 120")" || { echo "the approval could not be sealed"; false; }
  _approve "$aid"

  cp "$FIX/01-baseline.yaml" "$VY"
  export ARC_VENTURES_FILE="$VY"
  _pnl --month 2026-07
  _assert_refused "a receipt for other criteria"

  # And the receipt IS good for the file it was taken over -- otherwise this test proves only that
  # the whole receipt path is broken, which would satisfy the refusal above for free.
  export ARC_VENTURES_FILE="$other"
  _pnl --month 2026-07
  [ "$PNL_STATUS" -eq 0 ] || { echo "the receipt did not honor its OWN criteria file:"; cat "$PNL_ERR"; false; }
  grep -qF "kill lines (as of" "$PNL_OUT" || { echo "no kill panel for the receipted file:"; cat "$PNL_OUT"; false; }
}

@test "ventures: the right digest approved through arc-inbox renders the P&L and the kill panel" {
  # THE NEGATIVE CONTROL FOR THIS SUITE. Every string pinned below is derived from the criteria file
  # and the spine together: `10 of 90` is the distance between the pinned ingest clock and the pinned
  # render clock measured against a threshold read out of the fixture. Delete parseVentures,
  # deriveKillPanel or the receipt fold and this test fails -- it cannot be satisfied by a crash, by
  # empty output, or by a panel that silently omits what it could not evaluate.
  _revenue
  cp "$FIX/01-baseline.yaml" "$VY"
  export ARC_VENTURES_FILE="$VY"
  local aid
  aid="$(_seal "$VY" "adopt the v1 kill lines")" || { echo "the approval could not be sealed"; false; }
  _approve "$aid"

  _pnl --month 2026-07
  [ "$PNL_STATUS" -eq 0 ] || { echo "arc-pnl refused a receipted file (exit $PNL_STATUS):"; cat "$PNL_ERR"; false; }
  [ "$(_pnl_bytes)" -gt 0 ] || { echo "arc-pnl exited 0 and rendered nothing at all"; false; }
  grep -qF "kill lines (as of 2026-08-01)" "$PNL_OUT" || { echo "no kill panel:"; cat "$PNL_OUT"; false; }
  grep -qF "days_without_revenue  10 of 90  80 to the line" "$PNL_OUT" \
    || { echo "the kill distance is not the pinned one:"; cat "$PNL_OUT"; false; }
  # ABSENT rows are PRINTED and counted, never dropped: a list that omits what it could not evaluate
  # is shorter, greener and indistinguishable from a healthy venture.
  grep -qF "3 criteria could not be evaluated" "$PNL_OUT" || { echo "the absent count is gone:"; cat "$PNL_OUT"; false; }
  # The refusal string is asserted ABSENT here rather than stderr being asserted empty: node writes
  # its own ExperimentalWarning lines to stderr on some runners, and a suite that demanded a silent
  # stderr would go red on a warning that has nothing to do with this contract. The absence does not
  # stand alone -- the four positive assertions above are what make it mean something.
  if grep -qF "UNRECEIPTED" "$PNL_ERR"; then
    echo "a receipted file still reported an unreceipted change:"; cat "$PNL_ERR"; false
  fi
}

@test "ventures: editing a threshold after a valid receipt flips the render back to refused" {
  _revenue
  cp "$FIX/01-baseline.yaml" "$VY"
  export ARC_VENTURES_FILE="$VY"
  local aid
  aid="$(_seal "$VY" "adopt the v1 kill lines")" || { echo "the approval could not be sealed"; false; }
  _approve "$aid"

  # The receipt WORKS first. Without this half, "refused after the edit" is equally well explained by
  # a receipt that never held, and the test would pass over a permanently broken gate.
  _pnl --month 2026-07
  [ "$PNL_STATUS" -eq 0 ] || { echo "the receipt did not hold before the edit:"; cat "$PNL_ERR"; false; }
  grep -qF "days_without_revenue  10 of 90  80 to the line" "$PNL_OUT" \
    || { echo "the receipted render is not the pinned one:"; cat "$PNL_OUT"; false; }

  # 90 -> 120, written whole rather than patched in place: `sed -i` needs an argument on BSD sed and
  # not on GNU sed, and this suite runs on both.
  printf 'version: 1\nventures:\n  lexos:\n    kill:\n      days_without_revenue: 120\n      traffic_floor_monthly: 100\n  arc:\n    kill:\n      days_without_revenue: 30\n      traffic_floor_monthly: 500\n' > "$VY"
  [ -s "$VY" ] || { echo "the edited criteria file is empty"; false; }
  [ "$(_digest "$VY")" != "$(_digest "$FIX/01-baseline.yaml")" ] \
    || { echo "the edit did not move the digest, so this test measures nothing"; false; }

  _pnl --month 2026-07
  _assert_refused "a goalpost moved after its receipt"
}

@test "ventures: with no ventures.yaml at all the P&L renders normally, exit 0" {
  # THE CONSUMER CASE, and the one a lane-local test suite forgets. `ventures.yaml` is arc's OWN
  # company organ and is NOT in the sync set, so every consumer install has none. Refusing to render
  # a P&L because a file that was never shipped is missing would break all of them.
  #
  # BOTH ways of having none are checked, because they take different branches: venturesPath returns
  # null when ARC_VENTURES_FILE is unset under a pinned spine root, and returns a resolved path that
  # existsSync then denies when it names a file that is not there. A fix applied to one is not a fix.
  _revenue

  # `absent` is asserted with an `if`, never `grep ... && { ...; false; }`: that second form returns
  # the grep's own non-zero status on the GOOD path, which under bats' set -e fails the test for
  # passing. And the absence never stands alone -- it is paired above with the P&L header and the
  # revenue row, because "output does not contain kill lines" is satisfied by a crash.
  _no_panel() {
    if grep -qF "kill lines" "$PNL_OUT"; then
      echo "[$1] a kill panel appeared with no criteria file:"; cat "$PNL_OUT"; return 1
    fi
  }

  export ARC_VENTURES_FILE="$BATS_TEST_TMPDIR/there-is-no-such-file.yaml"
  [ ! -e "$ARC_VENTURES_FILE" ] || { echo "the absent-file case is not absent"; false; }
  _pnl --month 2026-07
  [ "$PNL_STATUS" -eq 0 ] || { echo "a named-but-missing criteria file broke the render:"; cat "$PNL_ERR"; false; }
  grep -qF "P&L" "$PNL_OUT" || { echo "no P&L rendered:"; cat "$PNL_OUT"; false; }
  grep -qF "razorpay:pay_0001" "$PNL_OUT" || { echo "the P&L rendered without its revenue row:"; cat "$PNL_OUT"; false; }
  _no_panel "named but missing"

  unset ARC_VENTURES_FILE
  _pnl --month 2026-07
  [ "$PNL_STATUS" -eq 0 ] || { echo "an unset ARC_VENTURES_FILE broke the render:"; cat "$PNL_ERR"; false; }
  grep -qF "P&L" "$PNL_OUT" || { echo "no P&L rendered:"; cat "$PNL_OUT"; false; }
  grep -qF "razorpay:pay_0001" "$PNL_OUT" || { echo "the P&L rendered without its revenue row:"; cat "$PNL_OUT"; false; }
  _no_panel "not named at all"
}

@test "ventures: this suite registers every test it declares" {
  # bats SILENTLY DROPS a @test whose name carries a non-ASCII character: five tests once vanished
  # from a suite in this repo, never ran, never failed, and the file stayed green -- the only signal
  # was the count falling. So the count is checked.
  #
  # DERIVED on both sides, never pinned to a literal. Retro 2026-08-12 (arc-memory) recorded a suite
  # that pinned its registered count as a literal and went red for the crime of adding a test, while
  # the suite next door derived it. Comparing declared against registered catches a dropped test and
  # stays quiet when the suite legitimately grows.
  declared="$(grep -c '^@test ' "$BATS_TEST_FILENAME")"
  registered=${#BATS_TEST_NAMES[@]}
  [ "$declared" -gt 0 ] || { echo "no @test lines found -- the count itself is broken"; false; }
  [ "$registered" -eq "$declared" ] \
    || { echo "declared $declared tests but bats registered $registered -- one was dropped, check for a non-ASCII @test name"; false; }
}
