#!/usr/bin/env bats
# Phase 02 -- the month-close reconciliation gate (REQ-05, ADR-1005 / ADR-1015 / ADR-1004) and the
# cost trichotomy (REQ-06, ADR-1006 / ADR-1001).
#
# TWO CLAIMS, AND THEY ARE TESTED THROUGH DIFFERENT DOORS ON PURPOSE:
#
#   THE GATE     driven through the REAL CLI, `node .claude/scripts/hq/arc-pnl.mjs --close`, never
#                the library in isolation. The guarantee is "a month may not be frozen against a
#                number nobody checked", and only the real command has an exit code and a stdout
#                that a human and a pipeline actually consume. One test per blocker KIND, and each
#                asserts the kind AND the numbers -- a gate that blocked every month for the wrong
#                reason would satisfy a bare "it blocked" assertion on all of them at once.
#   THE RECEIPT  a green gate PRINTS a payload; it never emits (month-close is human-run, a lane
#                non-negotiable). So the receipt half is proved by feeding that exact printed
#                payload to the real `arc-event emit month.closed --strict` and then LISTING BOTH
#                `events/` and `events/_quarantine/`. Retro 2026-08-02 records an emitter exiting 0
#                while every receipt it wrote was quarantined, so the exit code is not the
#                assertion -- the two directory listings are.
#
# THE SHARPEST TEST IN THE FILE is `a rail netting to exactly zero`. A rail whose charges and
# refunds cancel sums to 0 on the spine, and a rail that genuinely settled nothing sums to 0 too. If
# an absent input were defaulted to 0 the two would compare EQUAL and the month would close green
# having checked nothing. So the same spine is closed twice -- once with no input (NO-INPUT,
# provider_minor NULL) and once with an explicit provider total of 0 (GREEN) -- and the two renders
# are compared byte for byte. The day they collapse into each other, a month closes against nothing.
#
# EVERY ASSERTION IS PAIRED. `_close` refuses to return at all when the command printed nothing, so
# no "output does not contain X" in this file can be satisfied by a crash; the quarantine-is-empty
# assertion carries its own negative control (a wrong idem, refused, in the same test) so an empty
# listing can never mean "the quarantine path is broken"; and the sum that must NOT appear in a cost
# render is FORMATTED BY money.mjs ITSELF through the runner rather than typed here.
#
# EVENT IDS ARE MINTED BY `arc-event`, NEVER BY THIS FILE, and `_note_id` asserts no two collide.
# A generator that collapsed every id to one string made derivePnl exclude every event as a
# duplicate, so no refund linked and the netting looked broken while the code was fine -- an entire
# false result. The builders here go through the emitter, and the collision check is the second lock.
#
# Test names are ASCII-only, and so is every byte of this file. bats SILENTLY DROPS a @test whose
# name carries a non-ASCII character (retro 2026-08-04): five tests once vanished from a suite in
# this repo, never ran, never failed, and the file stayed green. Every name starts `close:` so its
# TAP lines are attributable back here when shard timings are measured, and the final test compares
# the DECLARED count against the REGISTERED one -- both derived, neither pinned.
bats_require_minimum_version 1.5.0
load 'test_helper'

HQ="$ARC_ROOT/.claude/scripts/hq"
EVENT="$HQ/arc-event.sh"
PNL="$HQ/arc-pnl.mjs"
BRIEF="$HQ/arc-brief.mjs"
RUN="$ARC_ROOT/tests/ledger-close-runner.mjs"
# The committed happy-path export. Its BYTES are frozen by `.gitattributes`
# (tests/fixtures/ledger/** -text), which is what lets the file-sum below be a fixed number on all
# three CI legs.
RZP="$ARC_ROOT/tests/fixtures/ledger/razorpay/01-good-multi-row.csv"

# The clock, pinned at every end. Every timestamp in this file derives from these, so a month
# boundary is an arithmetic fact rather than a distance from whatever today happens to be.
#   JUL  2026-07-22T21:30:00+05:30   the month that gets closed
#   AUG  2026-08-11T21:30:00+05:30   the month a post-close correction lands in
#   JUN  2026-06-17T21:30:00+05:30   the month a charge sits in while its refund lands in JUL
#   NOW  2026-08-14T21:30:00+05:30   after every fixture event, so no render is mid-stream
DAY=86400000
JUL=1784736000000
AUG=$((JUL + 20 * DAY))
JUN=$((JUL - 35 * DAY))
NOW=$((AUG + 3 * DAY))

# `--reconcile-file razorpay:INR=$RZP` sums `gross - tax` over the INR rows of that fixture:
#   1180.00-180.00 + 2360.00-360.00 + 590.50-90.08 + 100.00-0.00
#   = 100000 + 200000 + 50042 + 10000 paise
# It is pinned rather than recomputed here on purpose -- recomputing it would be a second copy of
# the parser, and the whole point is that the number the PARSER produces is the number the gate
# compares. The spine fixture below is built to match it charge for charge, so if the fixture or the
# parser ever moves, the file-close test BLOCKS with both numbers on screen instead of going quiet.
FILE_SUM=360042

# U+2014 EM DASH, built from octal escapes so every byte of this file stays ASCII. It is what
# `money.mjs` prints for ABSENT, and it is the visible difference between "no provider figure at
# all" and "a provider figure of zero" -- the distinction this phase exists to keep.
printf -v _CLOSE_ABSENT '\342\200\224'

setup() {
  # `arc pnl` and `arc brief` resolve ventures.yaml from the REPOSITORY (kill-panel.mjs
  # venturesPath -> spine-io.mjs repoRoot), never from the spine. Run from inside this checkout they
  # would find arc's own criteria file, find it unreceipted against a scratch spine, and exit 3 with
  # an EMPTY stdout that satisfies every absence assertion below. Leaving the repo is what makes
  # these tests the CONSUMER configuration -- no criteria file at all -- which is the state every
  # install outside this repo runs in. See arc_leave_the_repo in test_helper.bash.
  arc_leave_the_repo || return 1
  SPINE="$BATS_TEST_TMPDIR/spine"; mkdir -p "$SPINE"
  export ARC_SPINE_ROOT="$SPINE"
  export ARC_SPINE_RAND="ledger-close-seed"
  _tick=0
  _IDS=""
}

# ---------- fixture builders (each asserts its own fixture) ----------

# Record a minted id and refuse a collision.
#
# THE WARNING THIS ENCODES, and it cost a previous run a false result: hand-rolled ULIDs that
# collapsed to one string made derivePnl's duplicate-exclusion set match every event, so no refund
# linked and the netting looked broken while the code was fine. Ids here come from `arc-event`,
# which mints real ones; this is the check that says so out loud rather than assuming it.
_note_id() {
  local id="$1" what="$2"
  [ -n "$id" ] || { echo "nothing was sealed for $what -- every assertion below would be measuring an empty spine"; return 1; }
  case " $_IDS " in
    *" $id "*)
      echo "event id $id was minted twice (at $what) -- collapsed ids make every event look like a duplicate of the first, which is a false RESULT and not a false failure"
      return 1;;
  esac
  _IDS="$_IDS $id"
}

# A charge: one real `revenue.received` on the razorpay/INR rail.
#
# `--run-id` carries the tick because the INGEST path derives its idem from content alone (ADR-0044:
# the same webhook delivered twice is one payment). That is exactly right for a payment and exactly
# wrong for the EXCESS fixture, which needs one provider_payment_id recorded TWICE -- two separate
# ingest runs of one id, which is the operational mistake the excess branch exists to catch.
_charge() { # <venture> <id-tag> <amount-minor> <clock>
  local id
  _tick=$((_tick + 1))
  printf '{"amount":%s,"currency":"INR","venture":"%s","provider":"razorpay","provider_payment_id":"razorpay:pay_%s"}' \
    "$3" "$1" "$2" > "$BATS_TEST_TMPDIR/charge-$_tick.json"
  id="$(ARC_SPINE_NOW=$(($4 + _tick * 1000)) bash "$EVENT" ingest revenue.received \
        --json "$BATS_TEST_TMPDIR/charge-$_tick.json" --venture "$1" --run-id "r-$_tick" | tr -d '\r')"
  _note_id "$id" "charge pay_$2 for $1"
}

# A refund: a `revenue.received` with a POSITIVE amount carrying `refund_of` (ADR-1016 / LED-Q).
# Never a negative amount -- assertMoney has required a positive integer since Cycle 2.
_refund() { # <venture> <id-tag> <amount-minor> <clock> <charge-id-tag>
  local id
  _tick=$((_tick + 1))
  printf '{"amount":%s,"currency":"INR","venture":"%s","provider":"razorpay","provider_payment_id":"razorpay:rfnd_%s","refund_of":"razorpay:pay_%s"}' \
    "$3" "$1" "$2" "$5" > "$BATS_TEST_TMPDIR/refund-$_tick.json"
  id="$(ARC_SPINE_NOW=$(($4 + _tick * 1000)) bash "$EVENT" ingest revenue.received \
        --json "$BATS_TEST_TMPDIR/refund-$_tick.json" --venture "$1" --run-id "r-$_tick" | tr -d '\r')"
  _note_id "$id" "refund rfnd_$2 of pay_$5 for $1"
}

# A cost that MUST be accepted. Its id is asserted, so a payload this suite believes is legal and
# the validator does not fails here rather than three assertions later as an empty render.
_cost() { # <venture> <clock> <payload-json>
  local id
  _tick=$((_tick + 1))
  printf '%s' "$3" > "$BATS_TEST_TMPDIR/cost-$_tick.json"
  id="$(ARC_SPINE_NOW=$(($2 + _tick * 1000)) bash "$EVENT" emit cost.incurred \
        --payload-file "$BATS_TEST_TMPDIR/cost-$_tick.json" --venture "$1" --strict | tr -d '\r')"
  _note_id "$id" "cost for $1"
}

# A cost emit whose OUTCOME is the thing under test. Streams go to files rather than through `run`,
# which merges them: the refusal is on stderr while the emptiness being asserted is on stdout, and a
# test that cannot tell the streams apart cannot assert that the ULID was never printed.
_cost_emit() { # <venture> <clock> <payload-json>  -> COST_RC / COST_OUT / COST_ERR
  _tick=$((_tick + 1))
  printf '%s' "$3" > "$BATS_TEST_TMPDIR/costx-$_tick.json"
  COST_RC=0
  ARC_SPINE_NOW=$(($2 + _tick * 1000)) bash "$EVENT" emit cost.incurred \
    --payload-file "$BATS_TEST_TMPDIR/costx-$_tick.json" --venture "$1" --strict \
    > "$BATS_TEST_TMPDIR/costx-$_tick.out" 2> "$BATS_TEST_TMPDIR/costx-$_tick.err" || COST_RC=$?
  COST_OUT="$(tr -d '\r' < "$BATS_TEST_TMPDIR/costx-$_tick.out")"
  COST_ERR="$(tr -d '\r' < "$BATS_TEST_TMPDIR/costx-$_tick.err")"
  return 0
}

# ---------- drivers ----------

# Run the gate and PIN its streams under <tag>.
#
# The empty-stdout guard is not ceremony: `--close` prints its verdict on stdout and its seal
# instruction on stderr, so a command that died on import would leave stdout empty and satisfy every
# "does not contain" assertion in this file at once. Nothing here returns until the gate has
# demonstrably produced a verdict.
_close() { # <tag> <month> [flags...]  -> CLOSE_RC / CLOSE_OUT / CLOSE_ERR / CLOSE_FILE
  local tag="$1" month="$2"; shift 2
  CLOSE_FILE="$BATS_TEST_TMPDIR/$tag.out"
  CLOSE_RC=0
  ARC_SPINE_NOW=$NOW node "$PNL" --close "$month" "$@" \
    > "$CLOSE_FILE" 2> "$BATS_TEST_TMPDIR/$tag.err" || CLOSE_RC=$?
  CLOSE_OUT="$(tr -d '\r' < "$CLOSE_FILE")"
  CLOSE_ERR="$(tr -d '\r' < "$BATS_TEST_TMPDIR/$tag.err")"
  [ -n "$CLOSE_OUT" ] \
    || { echo "arc-pnl --close $month printed NOTHING on stdout (exit $CLOSE_RC) -- every assertion below would pass on this: $CLOSE_ERR"; return 1; }
  return 0
}

# The `month.closed` payload a GREEN gate prints, into $PAYLOAD. It is the LAST line of stdout and
# the only one that starts with an open brace.
_payload() { # <close-file>
  PAYLOAD="$1.payload.json"
  grep '^{' "$1" > "$PAYLOAD" || true
  [ -s "$PAYLOAD" ] \
    || { echo "the gate reported GREEN and printed no sealable payload: $(cat "$1")"; return 1; }
}

# The idem the emit path will demand, DERIVED from canonical.mjs rather than pinned. Validated as a
# 64-char lowercase hex here so a runner that printed a usage line cannot be sealed as a key.
# Explicit character LIST, never a range: bash 3.2 is the macOS leg and under some locales `[a-f]`
# matches letters outside it (tests/portability.bats:31-40).
_idem() { # <month> -> IDEM
  IDEM="$(node "$RUN" idem "$1" 2> "$BATS_TEST_TMPDIR/idem.err" | tr -d '\r')"
  [ -n "$IDEM" ] \
    || { echo "the close runner printed no idem for $1: $(cat "$BATS_TEST_TMPDIR/idem.err")"; return 1; }
  [ ${#IDEM} -eq 64 ] || { echo "the idem for $1 is ${#IDEM} bytes, not a 64-char sha256: $IDEM"; return 1; }
  case "$IDEM" in *[!0123456789abcdef]*) echo "the idem for $1 is not lowercase hex: $IDEM"; return 1;; esac
  return 0
}

# The three strings a two-class cost render must show, and the one it must NOT -- formatted by
# money.mjs itself, so the forbidden total is exactly what a renderer that summed them would print.
_sums() { # <a-minor> <b-minor> <currency> -> SUM_A / SUM_B / SUM_TOTAL / SUM_TOTAL_MINOR
  local out
  out="$(node "$RUN" sums "$1" "$2" "$3" 2>&1)" \
    || { echo "the close runner could not format the subtotals: $out"; return 1; }
  case "$out" in *SUMS_OK*) ;; *) echo "the close runner never reached the end: $out"; return 1;; esac
  SUM_A="$(printf '%s\n' "$out" | sed -n 's/^A=//p' | head -n1 | tr -d '\r')"
  SUM_B="$(printf '%s\n' "$out" | sed -n 's/^B=//p' | head -n1 | tr -d '\r')"
  SUM_TOTAL="$(printf '%s\n' "$out" | sed -n 's/^SUM=//p' | head -n1 | tr -d '\r')"
  SUM_TOTAL_MINOR="$(printf '%s\n' "$out" | sed -n 's/^SUM_MINOR=//p' | head -n1 | tr -d '\r')"
  [ -n "$SUM_A" ] && [ -n "$SUM_B" ] && [ -n "$SUM_TOTAL" ] && [ -n "$SUM_TOTAL_MINOR" ] \
    || { echo "the close runner printed an incomplete subtotal set: $out"; return 1; }
  return 0
}

_pnl()   { ARC_SPINE_NOW=$NOW node "$PNL" "$@"; }
_brief() { ARC_SPINE_NOW=$NOW node "$BRIEF" "$@"; }

# `events/*.jsonl` never matches `events/_quarantine`, which is a DIRECTORY: the two counts below
# read two different places, which is the whole point of asserting both.
# `|| true` on every grep -c: it exits 1 on zero matches, and under errexit a zero count would abort
# the test instead of reaching the comparison that exists to report it.
_events_lines()      { cat "$SPINE"/events/*.jsonl 2>/dev/null | sed '/^$/d' | wc -l | tr -d ' \r'; }
_quarantine_lines()  { cat "$SPINE"/events/_quarantine/*.jsonl 2>/dev/null | sed '/^$/d' | wc -l | tr -d ' \r'; }
_events_hits()       { cat "$SPINE"/events/*.jsonl 2>/dev/null | grep -c -- "$1" || true; }
_quarantine_hits()   { cat "$SPINE"/events/_quarantine/*.jsonl 2>/dev/null | grep -c -- "$1" || true; }
# Both listings, printed together, for a failure message. "Listing both directories is the
# assertion" is only useful if a failure shows what was in each.
_both_listings() {
  echo "--- $SPINE/events:";            ls -1 "$SPINE/events" 2>&1
  echo "--- $SPINE/events/_quarantine:"; ls -1 "$SPINE/events/_quarantine" 2>&1
  cat "$SPINE"/events/_quarantine/*.jsonl 2>/dev/null || true
}

# The four charges that make the razorpay/INR rail sum to exactly the committed export's own total.
_rail_matching_the_export() {
  _charge lexos 00001 100000 $JUL
  _charge lexos 00002 200000 $JUL
  _charge lexos 00003 50042  $JUL
  _charge lexos 00004 10000  $JUL
}

# ===============================================================================================
# A. THE GATE -- one test per blocker kind, asserting the kind AND the numbers
# ===============================================================================================

@test "close: an exact match on every rail is GREEN, exits 0, and prints a sealable payload" {
  # The negative control for the whole of section A. Every test below asserts a REFUSAL, and a gate
  # that refused everything would satisfy all of them; this is the one that dies if the gate can no
  # longer say yes.
  _rail_matching_the_export

  _close green 2026-07 --reconcile-total "razorpay:INR=$FILE_SUM"
  [ "$CLOSE_RC" -eq 0 ] || { echo "an exactly-matching month did not close (exit $CLOSE_RC): $CLOSE_OUT $CLOSE_ERR"; false; }
  [[ "$CLOSE_OUT" == *"close 2026-07  GREEN"* ]] || { echo "$CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *"razorpay/INR  spine 360042  provider 360042  MATCHED"* ]] \
    || { echo "the rail line does not show both sides matching: $CLOSE_OUT"; false; }
  # Absence, paired with the two positives above.
  [[ "$CLOSE_OUT" != *"blocked ("* ]] || { echo "a green gate listed blockers: $CLOSE_OUT"; false; }

  # THE PAYLOAD IS PRINTED, NOT EMITTED. Month-close is human-run, always -- the gate says whether
  # the month MAY close and prints the exact receipt; a human seals it.
  _payload "$CLOSE_FILE"
  grep -q '"month":"2026-07"' "$PAYLOAD"        || { echo "$(cat "$PAYLOAD")"; false; }
  grep -q '"payment_count":4' "$PAYLOAD"        || { echo "the payload does not count the four payments it closed: $(cat "$PAYLOAD")"; false; }
  grep -q '"spine_minor":360042,"provider_minor":360042' "$PAYLOAD" \
    || { echo "the payload does not carry both sides of the rail: $(cat "$PAYLOAD")"; false; }
  grep -q '"source":"total"' "$PAYLOAD"         || { echo "$(cat "$PAYLOAD")"; false; }
  # And nothing was written to the spine by the gate itself (ADR-1000 / LED-A): four ingested
  # payments and not a fifth line.
  [ "$(_events_lines)" = "4" ] \
    || { echo "the gate wrote to the spine: $(_events_lines) line(s) for 4 ingested payments"; false; }
}

@test "close: a provider total above the spine blocks as SHORTFALL with the gap and the recorded ids" {
  # SHORTFALL is "the provider settled money this spine has no payment for". The missing ids cannot
  # be listed -- by definition they are not here -- so what is listed is every id the spine DOES
  # hold for the rail, which is precisely the left-hand side of the diff that finds them.
  _rail_matching_the_export

  _close short 2026-07 --reconcile-total razorpay:INR=400000
  [ "$CLOSE_RC" -eq 4 ] || { echo "a shortfall did not block with exit 4 (got $CLOSE_RC): $CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *"close 2026-07  BLOCKED"* ]] || { echo "$CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *"razorpay/INR  spine 360042  provider 400000  SHORTFALL"* ]] || { echo "$CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *"blocked (1)"* ]] || { echo "$CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *'"kind":"SHORTFALL"'* ]] || { echo "the blocker is not a SHORTFALL: $CLOSE_OUT"; false; }
  # THE NUMBERS, not merely the kind. 400000 - 360042.
  [[ "$CLOSE_OUT" == *'"gap_minor":39958'* ]]      || { echo "the gap is wrong or missing: $CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *'"provider_minor":400000'* ]] || { echo "$CLOSE_OUT"; false; }
  # All three trichotomy figures ride on every blocker, not only the compared one -- the FIRED
  # assumption about gross-vs-net settlement conventions is read off exactly these three.
  [[ "$CLOSE_OUT" == *'"gross_minor":360042'* ]] || { echo "$CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *'"refund_minor":0'* ]]     || { echo "$CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *'"net_minor":360042'* ]]   || { echo "$CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *'"recorded_payment_ids":["razorpay:pay_00001","razorpay:pay_00002","razorpay:pay_00003","razorpay:pay_00004"]'* ]] \
    || { echo "the shortfall does not list the ids the spine already holds: $CLOSE_OUT"; false; }
  # A BLOCKED gate must not print a payload anyone could pipe into the emitter. Written as an `if`
  # rather than `grep && { ...; false; } || true`, which swallows its own failure: the `|| true`
  # binds to the whole list, so the `false` inside the block never reaches the test.
  if grep -q '^{' "$CLOSE_FILE"; then
    echo "a blocked gate printed a sealable month.closed payload: $CLOSE_OUT"
    false
  fi
}

@test "close: a provider total below the spine blocks as EXCESS naming the repeated payment id" {
  # EXCESS is "the spine holds payments the provider did not settle", and the first suspect is one
  # provider_payment_id recorded twice. Two ingest RUNS of one id, which is the real operational
  # mistake; the ids are distinct events on the spine and _note_id proves it.
  _charge lexos 00007 120000 $JUL
  _charge lexos 00007 120000 $JUL

  _close excess 2026-07 --reconcile-total razorpay:INR=120000
  [ "$CLOSE_RC" -eq 4 ] || { echo "an excess did not block with exit 4 (got $CLOSE_RC): $CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *"razorpay/INR  spine 240000  provider 120000  EXCESS"* ]] || { echo "$CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *'"kind":"EXCESS"'* ]]   || { echo "$CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *'"gap_minor":120000'* ]] || { echo "$CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *'"charge_count":2'* ]]   || { echo "$CLOSE_OUT"; false; }
  # THE DUPLICATE SUSPECT, BY ID AND BY COUNT. An excess reported without it sends the reader
  # hunting through a settlement export for a payment that is sitting on the spine twice.
  [[ "$CLOSE_OUT" == *'"duplicate_suspects":[{"provider_payment_id":"razorpay:pay_00007","count":2}]'* ]] \
    || { echo "the excess does not name the repeated provider_payment_id: $CLOSE_OUT"; false; }
  # And it is an EXCESS rather than the opposite reading of the same gap.
  [[ "$CLOSE_OUT" != *"SHORTFALL"* ]] || { echo "an excess was reported as a shortfall: $CLOSE_OUT"; false; }
}

@test "close: a spine rail with no reconciliation input blocks as NO-INPUT with a null provider figure" {
  # A rail with no input blocks exactly as a mismatched one does. The provider figure is NULL and
  # never 0 -- see the zero-net test below for why that distinction is the whole gate.
  _charge lexos 00001 100000 $JUL

  _close noinput 2026-07
  [ "$CLOSE_RC" -eq 4 ] || { echo "a rail with no input did not block (exit $CLOSE_RC): $CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *"razorpay/INR  spine 100000  provider $_CLOSE_ABSENT  NO-INPUT"* ]] \
    || { echo "the rail line does not render an absent provider figure: $CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *'"kind":"NO-INPUT"'* ]]      || { echo "$CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *'"provider_minor":null'* ]]  || { echo "the absent input was not reported as null: $CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *'"net_minor":100000'* ]]     || { echo "$CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *'"charge_count":1'* ]]       || { echo "$CLOSE_OUT"; false; }
  # Paired absence: the null was not quietly turned into a zero on the way to the render.
  [[ "$CLOSE_OUT" != *'"provider_minor":0'* ]] \
    || { echo "an absent provider total was defaulted to zero: $CLOSE_OUT"; false; }
}

@test "close: an input naming a rail the spine never heard of blocks as NO-SPINE-RAIL" {
  # A whole rail of missing ingest, not a discrepancy inside one: the provider says it settled money
  # for an account with no payments on the log at all.
  _charge lexos 00001 100000 $JUL

  _close nsr 2026-07 --reconcile-total razorpay:INR=100000 --reconcile-total mor:USD=5000
  [ "$CLOSE_RC" -eq 4 ] || { echo "an unknown rail did not block (exit $CLOSE_RC): $CLOSE_OUT"; false; }
  # THE POSITIVE HALF FIRST: the rail that IS on the spine reconciled cleanly in the same render, so
  # the refusal below is about the unknown rail specifically and not about a broken gate.
  [[ "$CLOSE_OUT" == *"razorpay/INR  spine 100000  provider 100000  MATCHED"* ]] \
    || { echo "the known rail did not match, so the refusal below proves nothing: $CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *"mor/USD  spine null  provider 5000  NO-SPINE-RAIL"* ]] || { echo "$CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *"blocked (1)"* ]] || { echo "want exactly one blocker: $CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *'"kind":"NO-SPINE-RAIL"'* ]] || { echo "$CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *'"rail":{"provider":"mor","currency":"USD"}'* ]] || { echo "$CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *'"provider_minor":5000'* ]] || { echo "$CLOSE_OUT"; false; }
  # NULL across every spine figure, never 0. No rail at all is not a rail that settled nothing, and
  # a zero here would let the row read as "matched against a provider total of zero".
  [[ "$CLOSE_OUT" == *'"net_minor":null'* ]]    || { echo "$CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *'"gross_minor":null'* ]]  || { echo "$CLOSE_OUT"; false; }
}

@test "close: a file and a total that disagree on one rail block as INPUT-CONFLICT" {
  # ADR-1015: picking either number would close the month on a figure the other input says is wrong,
  # and the operator would never learn which of the two they got.
  _rail_matching_the_export

  _close conflict 2026-07 --reconcile-file "razorpay:INR=$RZP" --reconcile-total razorpay:INR=999999
  [ "$CLOSE_RC" -eq 4 ] || { echo "two disagreeing inputs did not block (exit $CLOSE_RC): $CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *'"kind":"INPUT-CONFLICT"'* ]] || { echo "$CLOSE_OUT"; false; }
  # BOTH numbers on screen, and the file number is the EXPORT PARSER's own sum -- which is what
  # makes this test the file path's arithmetic proof as well as the conflict rule's.
  [[ "$CLOSE_OUT" == *'"file_minor":360042'* ]] \
    || { echo "the file side is not the parser sum of $RZP: $CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *'"total_minor":999999'* ]]      || { echo "$CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *'"difference_minor":639957'* ]] || { echo "$CLOSE_OUT"; false; }
  # Each side pins the bytes it came from. A receipt naming a number without pinning its source is
  # a receipt of nothing, and that applies to a refusal too.
  [[ "$CLOSE_OUT" == *'"file_sha":"'* ]]  || { echo "$CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *'"total_sha":"'* ]] || { echo "$CLOSE_OUT"; false; }
  # The rail itself is UNRESOLVED-INPUT, never NO-INPUT: the input WAS supplied and was refused, and
  # reporting one problem as two sends the operator looking for a second missing number.
  [[ "$CLOSE_OUT" == *"razorpay/INR  spine 360042  provider $_CLOSE_ABSENT  UNRESOLVED-INPUT"* ]] \
    || { echo "$CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" != *'"kind":"NO-INPUT"'* ]] \
    || { echo "a refused input was also reported as a missing one: $CLOSE_OUT"; false; }
}

@test "close: two inputs of the same source for one rail block as INPUT-DUPLICATE-SOURCE" {
  # Silently keeping one of two numbers somebody typed for one rail is the same failure as silently
  # picking between a file and a total: the gate would report on a figure nobody chose. Note the
  # second total is the one that would have matched nothing -- last-wins would have blocked, and
  # first-wins would have closed the month GREEN.
  _charge lexos 00001 100000 $JUL

  _close dupsrc 2026-07 --reconcile-total razorpay:INR=100000 --reconcile-total razorpay:INR=1
  [ "$CLOSE_RC" -eq 4 ] || { echo "two totals for one rail did not block (exit $CLOSE_RC): $CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *'"kind":"INPUT-DUPLICATE-SOURCE"'* ]] || { echo "$CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *'"sources":["total"]'* ]]             || { echo "$CLOSE_OUT"; false; }
  # BOTH numbers, in the order they were given. A blocker that named only one of them would be the
  # last-wins bug wearing a refusal.
  [[ "$CLOSE_OUT" == *'"totals_minor":[100000,1]'* ]] \
    || { echo "the blocker does not carry both supplied totals: $CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" != *"GREEN"* ]] || { echo "a duplicated input closed the month: $CLOSE_OUT"; false; }
}

@test "close: a rail whose linked refunds exceed its charges blocks as NET-NEGATIVE" {
  # Net below zero is its own diagnosis and is checked before anything is compared. Reported as a
  # SHORTFALL it would read as "go find the missing payments", which is the plausible story ADR-1005
  # warns about instead of the real one. The fixture is the honest shape: a June charge refunded in
  # July, so July holds the refund and none of the charge.
  _charge lexos 00009 90000 $JUN
  _refund lexos 00009 40000 $JUL 00009

  _close netneg 2026-07
  [ "$CLOSE_RC" -eq 4 ] || { echo "a negative net did not block (exit $CLOSE_RC): $CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *"razorpay/INR  spine -40000  provider $_CLOSE_ABSENT  NET-NEGATIVE"* ]] || { echo "$CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *'"kind":"NET-NEGATIVE"'* ]] || { echo "$CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *'"gross_minor":0'* ]]       || { echo "$CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *'"refund_minor":40000'* ]]  || { echo "the refund did not link, so this fixture is not the one: $CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *'"net_minor":-40000'* ]]    || { echo "$CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *'"refund_payment_ids":["razorpay:rfnd_00009"]'* ]] \
    || { echo "the blocker does not name the refunds that put the rail under: $CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" != *"SHORTFALL"* ]] \
    || { echo "a negative net was reported as missing payments: $CLOSE_OUT"; false; }

  # AND A PROVIDER TOTAL OF ZERO CANNOT RESCUE IT. A provider total is non-negative by construction,
  # so no input can ever equal a negative net -- and this is the branch that stops the gate building
  # a payload `assertMonthClosed` would reject at the door.
  _close netnegzero 2026-07 --reconcile-total razorpay:INR=0
  [ "$CLOSE_RC" -eq 4 ] || { echo "a zero provider total closed a negative rail (exit $CLOSE_RC): $CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *"NET-NEGATIVE"* ]] || { echo "$CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" != *"MATCHED"* ]] || { echo "a negative net matched a zero total: $CLOSE_OUT"; false; }
}

@test "close: a reconcile file is summed through the export parser and closes GREEN on source file" {
  # The `--reconcile-file` half of ADR-1015, end to end: the committed export is read by the typed
  # parser, summed as gross - tax (the same quantity ingest would have put on the spine), and
  # compared against a spine built charge for charge to match it. The receipt records `file` rather
  # than `total` because the file is the stronger evidence -- a document whose bytes are pinned by
  # `input_sha`, where a typed total is a number a human retyped from one.
  _rail_matching_the_export

  _close filegreen 2026-07 --reconcile-file "razorpay:INR=$RZP"
  [ "$CLOSE_RC" -eq 0 ] \
    || { echo "the export sum did not match the spine (exit $CLOSE_RC) -- if $RZP or the parser moved, both numbers are on this line: $CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *"close 2026-07  GREEN"* ]] || { echo "$CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *"razorpay/INR  spine $FILE_SUM  provider $FILE_SUM  MATCHED"* ]] || { echo "$CLOSE_OUT"; false; }

  _payload "$CLOSE_FILE"
  grep -q '"source":"file"' "$PAYLOAD" \
    || { echo "the receipt records the weaker of two equal inputs: $(cat "$PAYLOAD")"; false; }
  # The sha is over the FILE BYTES, so the receipt pins the document rather than a number somebody
  # read out of it. Length plus an explicit character LIST, for the bash-3.2 locale reason above.
  local sha
  sha="$(sed -n 's/.*"input_sha":"\([0-9a-f]*\)".*/\1/p' "$PAYLOAD" | head -n1 | tr -d '\r')"
  [ ${#sha} -eq 64 ] || { echo "input_sha is ${#sha} bytes, not a 64-char sha256: $(cat "$PAYLOAD")"; false; }
  case "$sha" in *[!0123456789abcdef]*) echo "input_sha is not lowercase hex: $sha"; false;; esac
}

# ===============================================================================================
# B. THE SHARPEST ONE -- a defaulted zero and a real zero must never render the same
# ===============================================================================================

@test "close: a rail netting to zero blocks with no input and closes GREEN on an explicit zero" {
  # THE CLOSE THIS GATE EXISTS TO PREVENT. A rail whose charges and refunds cancel nets to 0, and a
  # rail that genuinely settled nothing sums to 0 as well. Defaulting an absent input to 0 would
  # make the first compare EQUAL and close the month green having checked nothing -- "no input" and
  # "matches" must never render the same. Both renders are produced from ONE spine and then compared
  # byte for byte, because the day they collapse into each other is the day a month closes against
  # nothing.
  _charge lexos 00001 50000 $JUL
  _refund lexos 00001 50000 $((JUL + 2 * DAY)) 00001

  # HALF ONE -- no input at all.
  _close zeronone 2026-07
  [ "$CLOSE_RC" -eq 4 ] || { echo "a zero-net rail with no input closed (exit $CLOSE_RC): $CLOSE_OUT"; false; }
  local none_file="$CLOSE_FILE"
  [[ "$CLOSE_OUT" == *"razorpay/INR  spine 0  provider $_CLOSE_ABSENT  NO-INPUT"* ]] \
    || { echo "the no-input render does not distinguish itself from a matched zero: $CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *'"kind":"NO-INPUT"'* ]]     || { echo "$CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *'"provider_minor":null'* ]] || { echo "the absent input was not null: $CLOSE_OUT"; false; }
  # The rail really did cancel -- otherwise this test is just the ordinary no-input case again.
  [[ "$CLOSE_OUT" == *'"gross_minor":50000'* ]]   || { echo "$CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *'"refund_minor":50000'* ]]  || { echo "the refund did not link, so the net is not a cancellation: $CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *'"net_minor":0'* ]]         || { echo "$CLOSE_OUT"; false; }
  # The two readings the null must never acquire, each paired with the positives above.
  [[ "$CLOSE_OUT" != *'"provider_minor":0'* ]] || { echo "an absent input was defaulted to zero: $CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" != *"MATCHED"* ]]            || { echo "a rail with no input reported as matched: $CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" != *"GREEN"* ]]              || { echo "a month closed against nothing: $CLOSE_OUT"; false; }

  # HALF TWO -- the identical rail, given a real provider total of 0.
  _close zeroreal 2026-07 --reconcile-total razorpay:INR=0
  [ "$CLOSE_RC" -eq 0 ] \
    || { echo "a rail that genuinely settled nothing could not be closed at zero (exit $CLOSE_RC): $CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *"close 2026-07  GREEN"* ]] || { echo "$CLOSE_OUT"; false; }
  [[ "$CLOSE_OUT" == *"razorpay/INR  spine 0  provider 0  MATCHED"* ]] \
    || { echo "a real zero did not render as a real zero: $CLOSE_OUT"; false; }
  _payload "$CLOSE_FILE"
  grep -q '"spine_minor":0,"provider_minor":0' "$PAYLOAD" \
    || { echo "the receipt does not record a genuine zero on both sides: $(cat "$PAYLOAD")"; false; }

  # AND THE TWO RENDERS ARE DIFFERENT BYTES. Every assertion above could survive a refactor that
  # made these two paths converge on one string; this one cannot.
  if cmp -s "$none_file" "$CLOSE_FILE"; then
    echo "a defaulted zero and a real zero rendered IDENTICALLY -- a month can now be closed against nothing:"
    cat "$CLOSE_FILE"
    false
  fi
}

# ===============================================================================================
# C. THE RECEIPT -- listing both directories, never trusting the exit code
# ===============================================================================================

@test "close: the green payload seals into events and never into quarantine, and a wrong idem is refused" {
  # RETRO 2026-08-02: an emitter exited 0 while every receipt it wrote was quarantined. So the
  # assertion here is the two directory LISTINGS, and the exit code is only the first of four
  # checks. The wrong-idem emit at the end is this test's own negative control: without it, an empty
  # quarantine listing is equally well produced by a quarantine path that never writes anything.
  _charge lexos 00001 100000 $JUL
  _charge lexos 00002 200000 $JUL

  _close seal 2026-07 --reconcile-total razorpay:INR=300000
  [ "$CLOSE_RC" -eq 0 ] || { echo "$CLOSE_OUT $CLOSE_ERR"; false; }
  _payload "$CLOSE_FILE"
  # The gate also prints the exact seal instruction, and it names the same derivation the runner
  # uses. If those two ever diverge, a human following the printed instruction seals a receipt the
  # validator refuses.
  [[ "$CLOSE_ERR" == *'sha256Hex("month.closed|2026-07")'* ]] \
    || { echo "the gate does not tell the human which idem to seal with: $CLOSE_ERR"; false; }

  _idem 2026-07
  local jul_idem="$IDEM"
  local before_events before_q id
  before_events="$(_events_lines)"
  before_q="$(_quarantine_lines)"
  [ "$before_events" = "2" ] || { echo "the fixture spine is not the two payments this test built: $before_events"; false; }
  [ "$before_q" = "0" ]      || { echo "the scratch spine already holds quarantined records: $(_both_listings)"; false; }

  id="$(ARC_SPINE_NOW=$NOW bash "$EVENT" emit month.closed \
        --payload-file "$PAYLOAD" --idem "$jul_idem" --strict --outcome ok | tr -d '\r')"
  [ -n "$id" ] || { echo "the emitter printed no id for the close receipt: $(_both_listings)"; false; }

  # LISTING ONE -- events/. Exactly one line carries the receipt, and the spine grew by exactly one.
  [ "$(_events_hits "$id")" = "1" ] \
    || { echo "the close receipt is not in events/ ($(_events_hits "$id") hit(s)): $(_both_listings)"; false; }
  [ "$(_events_lines)" = "3" ] \
    || { echo "the spine grew from $before_events to $(_events_lines), want exactly one new line: $(_both_listings)"; false; }
  [ "$(_events_hits '"kind":"month.closed"')" = "1" ] \
    || { echo "the sealed line is not a month.closed: $(_both_listings)"; false; }

  # LISTING TWO -- events/_quarantine/. Nothing at all, which is only meaningful because of the
  # control below.
  [ "$(_quarantine_lines)" = "0" ] \
    || { echo "the emitter exited 0 and the receipt was QUARANTINED: $(_both_listings)"; false; }

  # THE CONTROL, AND THE WRONG-IDEM RULE IN ONE. A month closes exactly once, so the idem is welded
  # to the month; the idem of a DIFFERENT month is a valid 64-hex key that must not seal this one.
  _idem 2026-08
  local wrong="$IDEM"
  [ "$wrong" != "$jul_idem" ] \
    || { echo "two months derived the same idem, so the assertion below tests nothing"; false; }
  local rc=0
  ARC_SPINE_NOW=$((NOW + 1000)) bash "$EVENT" emit month.closed \
    --payload-file "$PAYLOAD" --idem "$wrong" --strict --outcome ok \
    > "$BATS_TEST_TMPDIR/wrong.out" 2> "$BATS_TEST_TMPDIR/wrong.err" || rc=$?
  [ "$rc" -eq 2 ] || { echo "a close sealed under another month's idem was accepted (exit $rc): $(cat "$BATS_TEST_TMPDIR/wrong.err")"; false; }
  grep -q "REJECT BAD_MONTH_CLOSE" "$BATS_TEST_TMPDIR/wrong.err" \
    || { echo "the refusal does not name BAD_MONTH_CLOSE: $(cat "$BATS_TEST_TMPDIR/wrong.err")"; false; }
  [ ! -s "$BATS_TEST_TMPDIR/wrong.out" ] || { echo "a refused emit printed an id: $(cat "$BATS_TEST_TMPDIR/wrong.out")"; false; }

  # BOTH LISTINGS AGAIN, and this is what makes the empty one above an assertion rather than a
  # coincidence: the quarantine now holds exactly the refused record, and the good receipt is still
  # in events/ and was not superseded by the attempt.
  [ "$(_quarantine_lines)" = "1" ] \
    || { echo "the refused receipt did not reach the quarantine, so an empty quarantine proves nothing: $(_both_listings)"; false; }
  [ "$(_quarantine_hits 'BAD_MONTH_CLOSE')" = "1" ] || { echo "$(_both_listings)"; false; }
  [ "$(_events_hits "$id")" = "1" ] \
    || { echo "the good receipt left events/ when the second attempt was refused: $(_both_listings)"; false; }
  [ "$(_events_lines)" = "3" ] || { echo "a refused emit still grew the spine: $(_both_listings)"; false; }
}

@test "close: a month.closed whose two sides disagree is refused at emit" {
  # `assertMonthClosed` refuses a rail with spine_minor != provider_minor. A close exists ONLY behind
  # a green gate, so such a receipt would be a permanent, append-only record asserting a
  # reconciliation that did not happen -- and on an append-only log there is no later.
  #
  # The bad payload is DERIVED from the real one by a single substitution, so the only thing wrong
  # with it is the mismatch: same month, same rail, same input_sha, and the CORRECT idem.
  _charge lexos 00001 100000 $JUL
  _charge lexos 00002 200000 $JUL
  _close mismatch 2026-07 --reconcile-total razorpay:INR=300000
  [ "$CLOSE_RC" -eq 0 ] || { echo "$CLOSE_OUT $CLOSE_ERR"; false; }
  _payload "$CLOSE_FILE"

  # sed to a NEW file, never `sed -i`: the -i spelling differs between GNU and BSD and this suite
  # runs on all three legs.
  sed 's/"provider_minor":300000/"provider_minor":299999/' "$PAYLOAD" > "$PAYLOAD.bad"
  grep -q '"provider_minor":299999' "$PAYLOAD.bad" \
    || { echo "the edit did not land, so nothing below is a mismatched payload: $(cat "$PAYLOAD.bad")"; false; }
  grep -q '"spine_minor":300000' "$PAYLOAD.bad" \
    || { echo "the edit also moved the spine side, so the two still agree: $(cat "$PAYLOAD.bad")"; false; }

  _idem 2026-07
  local rc=0
  ARC_SPINE_NOW=$NOW bash "$EVENT" emit month.closed \
    --payload-file "$PAYLOAD.bad" --idem "$IDEM" --strict --outcome ok \
    > "$BATS_TEST_TMPDIR/mm.out" 2> "$BATS_TEST_TMPDIR/mm.err" || rc=$?
  [ "$rc" -eq 2 ] || { echo "a receipt carrying a mismatch was sealed (exit $rc): $(cat "$BATS_TEST_TMPDIR/mm.err")"; false; }
  grep -q "REJECT BAD_MONTH_CLOSE" "$BATS_TEST_TMPDIR/mm.err" || { echo "$(cat "$BATS_TEST_TMPDIR/mm.err")"; false; }
  grep -q "spine_minor 300000 against provider_minor 299999" "$BATS_TEST_TMPDIR/mm.err" \
    || { echo "the refusal does not name the two numbers that disagree: $(cat "$BATS_TEST_TMPDIR/mm.err")"; false; }
  [ ! -s "$BATS_TEST_TMPDIR/mm.out" ] || { echo "a refused emit printed an id: $(cat "$BATS_TEST_TMPDIR/mm.out")"; false; }
  # Both listings: nothing reached events/, and the refusal is on the record.
  [ "$(_events_hits '"kind":"month.closed"')" = "0" ] \
    || { echo "a mismatched close is on the spine: $(_both_listings)"; false; }
  [ "$(_quarantine_hits 'BAD_MONTH_CLOSE')" = "1" ] \
    || { echo "the refusal was not quarantined, so the count above may simply mean nothing ran: $(_both_listings)"; false; }
}

# ===============================================================================================
# D. POST-CLOSE CORRECTION (ADR-1004)
# ===============================================================================================

@test "close: a refund after the close leaves the closed month byte-identical and lands in the current one" {
  # A post-close correction books into the RECORDING month. Accrual accounting is the named rabbit
  # hole for this phase, and this is the boundary of what is shipped instead: a closed month is
  # frozen, and the correction is visible where it happened.
  _charge lexos 00001 300000 $JUL
  _close pc 2026-07 --reconcile-total razorpay:INR=300000
  [ "$CLOSE_RC" -eq 0 ] || { echo "$CLOSE_OUT $CLOSE_ERR"; false; }
  _payload "$CLOSE_FILE"
  _idem 2026-07
  local id
  id="$(ARC_SPINE_NOW=$NOW bash "$EVENT" emit month.closed \
        --payload-file "$PAYLOAD" --idem "$IDEM" --strict --outcome ok | tr -d '\r')"
  [ -n "$id" ] || { echo "the month was never actually closed, so nothing below is a POST-close correction"; false; }
  [ "$(_quarantine_lines)" = "0" ] || { echo "the close was quarantined: $(_both_listings)"; false; }

  # BEFORE. Captured as bytes, and asserted to be a real P&L first -- an empty file compares equal
  # to another empty file, which is the vacuous version of this whole test.
  local before="$BATS_TEST_TMPDIR/jul-before.txt" after="$BATS_TEST_TMPDIR/jul-after.txt"
  _pnl --month 2026-07 > "$before" 2> "$BATS_TEST_TMPDIR/jul-before.err" \
    || { echo "the closed month would not render: $(cat "$BATS_TEST_TMPDIR/jul-before.err")"; false; }
  grep -q "razorpay:pay_00001" "$before" || { echo "the July render does not show the payment it closed: $(cat "$before")"; false; }
  grep -q "3,000.00" "$before"           || { echo "the July render does not show the money: $(cat "$before")"; false; }

  # THE CORRECTION, recorded a month later.
  _refund lexos 00001 50000 $AUG 00001

  _pnl --month 2026-07 > "$after" 2> "$BATS_TEST_TMPDIR/jul-after.err" \
    || { echo "the closed month stopped rendering after a later refund: $(cat "$BATS_TEST_TMPDIR/jul-after.err")"; false; }
  if ! cmp -s "$before" "$after"; then
    echo "the CLOSED month changed after a refund recorded in a later month:"
    diff -u "$before" "$after" || true
    false
  fi

  # AND IT IS NOT LOST. A frozen month that swallowed the correction would pass the comparison above
  # just as well, so the other half is asserted in the same test.
  run _pnl --month 2026-08
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"refund of razorpay:pay_00001"* ]] \
    || { echo "the post-close refund appears in no month at all: $output"; false; }
  [[ "$output" == *"-500.00"* ]] || { echo "the refund is on the August P&L without its amount: $output"; false; }
}

# ===============================================================================================
# E. THE COST TRICHOTOMY (REQ-06, ADR-1006)
# ===============================================================================================

@test "close: a measured cost and a declared cost render two labelled subtotals and never a combined total" {
  # measured, declared and allocated are three different CLAIMS about money and are never added into
  # one number. The forbidden total is formatted by money.mjs itself rather than typed here: a
  # literal would stop matching the day the grouping or the exponent moved, and the test would then
  # pass by looking for something nobody prints.
  _cost lexos $JUL '{"amount":123400,"currency":"INR","source":"measured","label":"model tokens"}'
  _cost lexos $JUL '{"amount":567800,"currency":"INR","source":"declared","label":"office"}'
  _sums 123400 567800 INR

  run _pnl --month 2026-07
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"costs (measured)"* ]] || { echo "no measured block at all: $output"; false; }
  [[ "$output" == *"costs (declared)"* ]] || { echo "no declared block at all: $output"; false; }
  [[ "$output" == *"subtotal measured $SUM_A INR"* ]] || { echo "$output"; false; }
  [[ "$output" == *"subtotal declared $SUM_B INR"* ]] || { echo "$output"; false; }
  # EXACTLY TWO SUBTOTALS. A third line would be the combined total by another name, and this counts
  # rather than merely looking for the absence of one string.
  local subtotals
  subtotals="$(printf '%s\n' "$output" | grep -c 'subtotal ' || true)"
  [ "$subtotals" = "2" ] \
    || { echo "want exactly 2 subtotal lines for 2 classes, found $subtotals: $output"; false; }
  # AND NO NUMBER EQUAL TO THEIR SUM, in either spelling. Paired with the four positives above, so
  # neither absence can be satisfied by a crash or an empty render.
  [[ "$output" != *"$SUM_TOTAL"* ]] \
    || { echo "a line carries $SUM_TOTAL, which is measured + declared added together: $output"; false; }
  [[ "$output" != *"$SUM_TOTAL_MINOR"* ]] \
    || { echo "a line carries $SUM_TOTAL_MINOR minor units, which is measured + declared: $output"; false; }
}

@test "close: venture arc costs render under Overhead and never under a product venture" {
  # Building the factory is not a cost of any product made in it. Both costs land in one render, so
  # the absence below is about attribution and not about an empty section.
  _cost lexos $JUL '{"amount":123400,"currency":"INR","source":"measured","label":"model tokens"}'
  _cost arc   $JUL '{"amount":900000,"currency":"INR","source":"allocated","label":"the factory"}'

  run _pnl --month 2026-07
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"Overhead (venture: arc"* ]] || { echo "no Overhead section: $output"; false; }
  [[ "$output" == *"subtotal allocated 9,000.00 INR"* ]] \
    || { echo "the overhead cost is not rendered at all: $output"; false; }

  # THE PRODUCT VENTURE'S OWN SLICE, from its header up to the Overhead header. Asserted non-empty
  # first: an empty slice satisfies every absence below.
  local slice
  slice="$(printf '%s\n' "$output" | awk '/^lexos$/{f=1;next} /^Overhead \(venture: arc/{f=0} f')"
  [ -n "$slice" ] || { echo "the lexos section is empty, so the absences below prove nothing: $output"; false; }
  [[ "$slice" == *"subtotal measured 1,234.00 INR"* ]] \
    || { echo "the venture section does not carry its own cost: $slice"; false; }
  [[ "$slice" != *"allocated"* ]] \
    || { echo "an Overhead class leaked into the product venture: $slice"; false; }
  [[ "$slice" != *"9,000.00"* ]] \
    || { echo "the Overhead amount was attributed to a product venture: $slice"; false; }
  # One allocated block in the whole render, and it is the one under Overhead.
  local allocated
  allocated="$(printf '%s\n' "$output" | grep -c 'costs (allocated)' || true)"
  [ "$allocated" = "1" ] || { echo "want exactly 1 allocated block, found $allocated: $output"; false; }
}

@test "close: a cost with no amount renders ABSENT with its source still shown" {
  # ABSENT STAYS ABSENT (MP-F, ADR-1006). A subtotal that silently omits what it could not read is
  # shorter, greener, and indistinguishable from the truth -- and coercing the line to 0.00 would
  # make an unpriced run indistinguishable from a free one.
  _cost lexos $JUL '{"currency":"INR","source":"measured","label":"unpriced run"}'
  _cost lexos $JUL '{"amount":567800,"currency":"INR","source":"declared","label":"office"}'

  run _pnl --month 2026-07
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # POSITIVE CONTROL: numbers DO render on this spine, so the em-dash below is about this line.
  [[ "$output" == *"subtotal declared 5,678.00 INR"* ]] \
    || { echo "nothing rendered a number, so the absent line proves nothing: $output"; false; }
  # THE LINE IS THERE, its amount is ABSENT, and its source is still on it.
  [[ "$output" == *"  $_CLOSE_ABSENT  measured"* ]] \
    || { echo "the unreadable cost line is missing, or lost its source: $output"; false; }
  # AND THE SECTION SAYS SO. "1,234.00 INR" over a section that also holds an unreadable line is a
  # subtotal presenting itself as complete; the count is what stops that.
  [[ "$output" == *"subtotal measured $_CLOSE_ABSENT (1 absent)"* ]] \
    || { echo "the measured subtotal does not declare its absent line: $output"; false; }
  # Not dropped, and not coerced.
  local measured
  measured="$(printf '%s\n' "$output" | grep -c 'costs (measured)' || true)"
  [ "$measured" = "1" ] || { echo "the unreadable cost was dropped from the render: $output"; false; }
  [[ "$output" != *"subtotal measured 0.00"* ]] \
    || { echo "an unreadable amount was coerced to zero: $output"; false; }
}

@test "close: an unrecognised cost source gets its own unclassified block and a needs-you flag" {
  # Classification is CASE-EXACT and never normalizes: "Measured" is one character from "measured",
  # and trimming or case-folding a near-miss is how a cost silently changes what it claims.
  # `cost.incurred` has no closed source vocabulary at ingest (that is a cross-lane call), so the
  # render is where the near-miss has to stay visible.
  _cost lexos $JUL '{"amount":123400,"currency":"INR","source":"measured","label":"model tokens"}'
  _cost lexos $JUL '{"amount":11100,"currency":"INR","source":"Measured","label":"near miss"}'

  run _pnl --month 2026-07
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"costs (unclassified)"* ]] || { echo "the near miss was folded into a class: $output"; false; }
  [[ "$output" == *"subtotal unclassified 111.00 INR"* ]] || { echo "$output"; false; }
  # A NEEDS-YOU ITEM, quoting the exact spelling. A trailing space or a capital M is invisible on
  # screen without the quotes, and the operator has to SEE what failed to classify.
  [[ "$output" == *"needs you (1)"* ]] || { echo "the unrecognised source raised nothing: $output"; false; }
  [[ "$output" == *"COST_SOURCE_UNCLASSIFIED"* ]] || { echo "$output"; false; }
  [[ "$output" == *'carry source "Measured"'* ]] \
    || { echo "the flag does not quote the spelling that failed: $output"; false; }
  # AND IT WAS NOT FOLDED. The measured subtotal is the real cost ALONE -- 1,234.00, not the
  # 1,345.00 it would be if the near miss had been case-folded into it. That is the assertion a bare
  # "unclassified exists" check cannot make.
  [[ "$output" == *"subtotal measured 1,234.00 INR"* ]] || { echo "$output"; false; }
  [[ "$output" != *"1,345.00"* ]] \
    || { echo "the near-miss amount was folded into the measured subtotal: $output"; false; }
}

# ===============================================================================================
# F. assertCostIncurred -- money is money wherever it lands (ADR-1012)
# ===============================================================================================

@test "close: a string amount and a float amount are both refused at emit as BAD_LEDGER_COST" {
  # A Phase 02 probe put {"amount":"12.50",...} on the spine UNQUARANTINED, because nothing claimed
  # cost.incurred: assertMoney covers the two revenue kinds and assertCost governs the ENVELOPE
  # field describing what the agent RUN cost. Two different facts sharing one word. Both shapes are
  # refused rather than rounded, because a rounding step at ingest is permanent on an append-only log.
  _cost_emit lexos $JUL '{"amount":"12.50","currency":"INR","source":"measured"}'
  [ "$COST_RC" -eq 2 ] || { echo "a STRING amount was accepted (exit $COST_RC): $COST_ERR"; false; }
  [[ "$COST_ERR" == *"REJECT BAD_LEDGER_COST"* ]] || { echo "$COST_ERR"; false; }
  [[ "$COST_ERR" == *'"12.50"'* ]] || { echo "the refusal does not name the value it refused: $COST_ERR"; false; }
  [ -z "$COST_OUT" ] || { echo "a refused cost printed an id: $COST_OUT"; false; }

  _cost_emit lexos $JUL '{"amount":12.5,"currency":"INR","source":"measured"}'
  [ "$COST_RC" -eq 2 ] || { echo "a FLOAT amount was accepted (exit $COST_RC): $COST_ERR"; false; }
  [[ "$COST_ERR" == *"REJECT BAD_LEDGER_COST"* ]] || { echo "$COST_ERR"; false; }
  [[ "$COST_ERR" == *"12.5"* ]] || { echo "$COST_ERR"; false; }
  [ -z "$COST_OUT" ] || { echo "a refused cost printed an id: $COST_OUT"; false; }

  # BOTH LISTINGS. Nothing reached the spine, and the two refusals are on the record -- which is
  # what makes the empty events/ count an assertion rather than the shape of a suite that never ran.
  [ "$(_events_lines)" = "0" ] || { echo "a refused cost is on the spine: $(_both_listings)"; false; }
  [ "$(_quarantine_lines)" = "2" ] \
    || { echo "want 2 quarantined refusals, found $(_quarantine_lines): $(_both_listings)"; false; }
}

@test "close: a lowercase currency and a currency-less amount are refused, and an amount-less cost is kept" {
  # Minor units are meaningless without the currency that defines them, so only that direction is
  # refused. The reverse -- a currency and no amount -- is the ABSENT case and is a real, reportable
  # state (MP-F): refusing it would delete the honest answer and leave only the two dishonest ones.
  _cost_emit lexos $JUL '{"amount":1250,"currency":"inr","source":"measured"}'
  [ "$COST_RC" -eq 2 ] || { echo "a lowercase currency was accepted (exit $COST_RC): $COST_ERR"; false; }
  [[ "$COST_ERR" == *"REJECT BAD_LEDGER_COST"* ]] || { echo "$COST_ERR"; false; }
  [[ "$COST_ERR" == *'"inr"'* ]] || { echo "the refusal does not name the currency it refused: $COST_ERR"; false; }

  _cost_emit lexos $JUL '{"amount":1250,"source":"measured"}'
  [ "$COST_RC" -eq 2 ] || { echo "an amount with no currency was accepted (exit $COST_RC): $COST_ERR"; false; }
  [[ "$COST_ERR" == *"REJECT BAD_LEDGER_COST"* ]] || { echo "$COST_ERR"; false; }
  [[ "$COST_ERR" == *"amount with no currency"* ]] || { echo "$COST_ERR"; false; }

  # THE ACCEPTED ONE. Absence stays absent, all the way onto the spine.
  _cost_emit lexos $JUL '{"currency":"INR","source":"declared","label":"unpriced run"}'
  [ "$COST_RC" -eq 0 ] \
    || { echo "a cost with no amount was refused, which deletes the only honest way to record one (exit $COST_RC): $COST_ERR"; false; }
  [ -n "$COST_OUT" ] || { echo "the accepted cost printed no id: $COST_ERR"; false; }

  [ "$(_events_lines)" = "1" ] \
    || { echo "want exactly the one accepted cost on the spine, found $(_events_lines): $(_both_listings)"; false; }
  [ "$(_quarantine_lines)" = "2" ] \
    || { echo "want 2 quarantined refusals, found $(_quarantine_lines): $(_both_listings)"; false; }
}

# ===============================================================================================
# G. THE DAILY SPEND LINE (REQ-06)
# ===============================================================================================

@test "close: arc brief shows a spend line on a day with costs and none on a day without" {
  # A rendered "spend 0.00" on a day nobody spent anything is a CLAIM, and it is indistinguishable
  # from a day whose ingest never ran -- so the line is absent rather than zero. Each absence below
  # is paired with a positive assertion that the brief rendered that day at all.
  _cost lexos $JUL '{"amount":123400,"currency":"INR","source":"measured","label":"model tokens"}'
  _charge lexos 00001 50000 $AUG

  # THE DAY WITH SPEND.
  run _brief --date 2026-07-22
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"brief 2026-07-22"* ]] || { echo "the brief did not render: $output"; false; }
  [[ "$output" == *"money ("* ]] || { echo "the money group is missing, so the spend line has nowhere to sit: $output"; false; }
  [[ "$output" == *"  spend  measured 1,234.00 INR"* ]] \
    || { echo "a day with cost events shows no spend line: $output"; false; }

  # A DAY WITH MONEY EVENTS AND NO COSTS. The sharper of the two absences: the money group is
  # demonstrably rendering, and the spend line still does not appear.
  run _brief --date 2026-08-11
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"brief 2026-08-11"* ]] || { echo "the brief did not render: $output"; false; }
  [[ "$output" == *"money (1)"* ]] \
    || { echo "2026-08-11 is not the money-without-costs day this test needs: $output"; false; }
  [[ "$output" != *"spend"* ]] || { echo "a day with no cost events rendered a spend line: $output"; false; }

  # AND A QUIET DAY IS THE HEADER ALONE.
  run _brief --date 2026-07-25
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"brief 2026-07-25"* ]] || { echo "the brief did not render: $output"; false; }
  [[ "$output" != *"money ("* ]] || { echo "2026-07-25 is not the quiet day this test needs: $output"; false; }
  [[ "$output" != *"spend"* ]] || { echo "a spend line rendered on a day with no events at all: $output"; false; }
}

# ===============================================================================================

@test "close: this suite registers every test it declares" {
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
