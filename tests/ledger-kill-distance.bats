#!/usr/bin/env bats
# Phase 01 -- REQ-03: the kill meter (ADR-1008 criteria, ADR-1018 absence, ADR-1000 zero emissions).
#
# Three surfaces, one contract, and they are tested through three different doors on purpose:
#
#   THE ARITHMETIC   `kill-distance.mjs` is pure -- criteria and observations in, statuses out --
#                    so it is driven directly through `tests/ledger-kill-runner.mjs`, the same
#                    shape `ledger-parsers.bats` uses. A Node program embedded in a shell string
#                    has broken this repo four times (docs/retro-log.md); the runner is a file.
#   THE RENDER       `arc pnl` derives the panel at render time and must print ABSENT rows rather
#                    than drop them. A list that silently omits what it could not compute is
#                    shorter, greener and indistinguishable from a healthy venture (ADR-1018).
#   THE BRIEF        a CROSSED line is a needs-you item; a WARNING is not. A warning in the one
#                    group that must never be skimmed is how a reader learns to skim it. Both
#                    surfaces raise the item, so both surfaces are asserted -- "closed in one file,
#                    left open in its twin" is this lane's recorded scar.
#
# THREE OF THESE TESTS ARE RED FIXTURES FOR DEFECTS THE ADVERSARIAL PASS FOUND, and each names the
# defect in its own body rather than here: a future-dated revenue event erasing a crossing, `unit`
# declared and never returned, and a crossing computed and then discarded before needs-you.
#
# BOUNDARIES ARE PINNED ON BOTH POLARITIES, at the exact unit. `days_without_revenue` is a CEILING
# climbed toward from below and `traffic_floor_monthly` is a FLOOR sunk toward from above, and the
# 80% warning band is decided by integer cross-multiplication rather than by a division -- so a
# threshold whose 80% point is NOT an integer (7 on the ceiling: 5 is OK, 6 is WARNING) is pinned
# too. That row is the one a float implementation cannot fake its way through forever.
#
# Test names are ASCII-only. bats SILENTLY DROPS a @test whose name carries a non-ASCII character:
# five tests once vanished from a suite in this repo, never ran, never failed, and the file stayed
# green. Every name here also starts `kill:` so its TAP lines are attributable back to this file
# when shard timings are measured.
bats_require_minimum_version 1.5.0
load 'test_helper'

HQ="$ARC_ROOT/.claude/scripts/hq"
EVENT="$HQ/arc-event.sh"
PNL="$HQ/arc-pnl.sh"
BRIEF="$HQ/arc-brief.mjs"
INBOX="$HQ/arc-inbox.mjs"
KD="$ARC_ROOT/tests/ledger-kill-runner.mjs"

# 2026-07-22 in IST, and one day in ms. Every clock in this file is derived from these two, so a
# "days without revenue" figure is an exact arithmetic fact rather than a distance from whatever
# today happens to be on the runner.
DAY0=1784736000000
DAY=86400000

setup() {
  SPINE="$BATS_TEST_TMPDIR/spine"; mkdir -p "$SPINE"
  export ARC_SPINE_ROOT="$SPINE"
  export ARC_SPINE_RAND="kill-distance-seed"
  VENTURES="$BATS_TEST_TMPDIR/ventures.yaml"
  _tick=0
}

# One field out of the runner's key=value output, anchored at column 1 and compared for EQUALITY.
# A substring glob cannot do this job: `*distance=1*` is satisfied by `distance=10`, so a boundary
# that moved by nine units would pass.
_kd_field() { printf '%s\n' "$2" | sed -n "s/^$1=//p" | head -n1 | tr -d '\r'; }

# ---------- fixture builders (each asserts its own fixture) ----------

# A real revenue event on 2026-07-22, which is the ONLY thing that gives the days-without-revenue
# clock a zero to count from (ADR-1018).
_revenue() {
  local venture="$1" tag="$2" id
  _tick=$((_tick+1))
  printf '{"amount":100000,"currency":"INR","venture":"%s","provider":"razorpay","provider_payment_id":"razorpay:pay_%s"}' \
    "$venture" "$tag" > "$BATS_TEST_TMPDIR/rev-$_tick.json"
  id="$(ARC_SPINE_NOW=$((DAY0 + _tick*1000)) bash "$EVENT" ingest revenue.received \
        --json "$BATS_TEST_TMPDIR/rev-$_tick.json" --venture "$venture" | tr -d '\r')"
  [ -n "$id" ] || { echo "no revenue was sealed for $venture -- every kill clock below would count from nothing"; return 1; }
}

# Revenue dated AFTER every render in this file. Emitted through the ordinary clock door
# (ARC_SPINE_NOW) rather than hand-written, because that is exactly how it happens for real: a box
# with a skewed clock, and `revenue.received` needs no approval from anyone.
# DAY0 + 400 days is 2027-08-26, comfortably past every `asOf` here.
_future_revenue() {
  local venture="$1" tag="$2" id
  _tick=$((_tick+1))
  printf '{"amount":250000,"currency":"INR","venture":"%s","provider":"razorpay","provider_payment_id":"razorpay:pay_%s"}' \
    "$venture" "$tag" > "$BATS_TEST_TMPDIR/rev-$_tick.json"
  id="$(ARC_SPINE_NOW=$((DAY0 + 400*DAY)) bash "$EVENT" ingest revenue.received \
        --json "$BATS_TEST_TMPDIR/rev-$_tick.json" --venture "$venture" | tr -d '\r')"
  [ -n "$id" ] || { echo "the future-dated revenue event was never sealed -- the exclusion below would be testing nothing"; return 1; }
}

_cost() {
  local venture="$1" id
  _tick=$((_tick+1))
  printf '{"amount":50000,"currency":"INR","source":"declared"}' > "$BATS_TEST_TMPDIR/cost-$_tick.json"
  id="$(ARC_SPINE_NOW=$((DAY0 + _tick*1000)) bash "$EVENT" ingest cost.incurred \
        --json "$BATS_TEST_TMPDIR/cost-$_tick.json" --venture "$venture" | tr -d '\r')"
  [ -n "$id" ] || { echo "no cost was sealed for $venture"; return 1; }
}

# Write ventures.yaml for ONE venture and RECEIPT it.
#
# BOTH halves are required (ADR-1008 / ADR-1017): an `approval.requested` carrying the digest under
# subject `ledger.criteria`, with its idem welded to that digest, and a `decision.recorded`
# approving it by ULID. An approval alone is a request, not a decision. Without the pair `arc pnl`
# refuses the WHOLE render at exit 3 -- so a fixture that skipped this would turn every panel
# assertion below into an accidental test of the refusal path, which passes for the wrong reason.
#
# The digest comes from `arc pnl --criteria-digest`, i.e. from the code under test rather than from
# a literal pasted into this file: a pinned digest would go stale the first time the fixture changed
# and the suite would then be proving that an unreceipted file refuses.
#
# ARC_VENTURES_FILE is exported here and every CLI test in this file goes through this builder --
# which matters since `venturesPath()` stopped returning null for a named spine and now walks up
# from cwd for the repo's own `ventures.yaml`. A CLI test that skipped this builder would silently
# be reading arc's real criteria file against a scratch spine, find it unreceipted, and exit 3 with
# an EMPTY stdout that satisfies every "does not contain" assertion in the file.
_criteria() {
  local venture="$1" days="$2" traffic="$3" digest idem id
  printf 'version: 1\nventures:\n  %s:\n    kill:\n      days_without_revenue: %s\n      traffic_floor_monthly: %s\n' \
    "$venture" "$days" "$traffic" > "$VENTURES"
  export ARC_VENTURES_FILE="$VENTURES"

  digest="$(ARC_SPINE_NOW=$DAY0 bash "$PNL" --criteria-digest | tr -d '\r')"
  [ -n "$digest" ] || { echo "arc-pnl printed no criteria digest -- the criteria fixture is empty"; return 1; }
  # Published for the tests that assert the panel names its own criteria. Deliberately NOT local.
  CRITERIA_DIGEST="$digest"

  idem="$(printf '%s' "ledger.criteria|$digest" | _arc_sha256 | tr -d '\r')"
  printf '{"subject":"ledger.criteria","digest":"%s","what":"kill-distance suite fixture"}' "$digest" \
    > "$BATS_TEST_TMPDIR/criteria-approval.json"

  # Ten minutes past the revenue events, still on 2026-07-22: a distinct clock keeps the fixture
  # readable in a dumped day file without depending on idem uniqueness for its ULIDs.
  id="$(ARC_SPINE_NOW=$((DAY0 + 600000)) bash "$EVENT" emit approval.requested \
        --payload-file "$BATS_TEST_TMPDIR/criteria-approval.json" --idem "$idem" --strict | tr -d '\r')"
  [ -n "$id" ] || { echo "the criteria approval was never sealed -- arc-pnl will refuse every render below"; return 1; }

  ARC_SPINE_NOW=$((DAY0 + 601000)) node "$INBOX" approve "$id" --reason "kill-distance suite fixture" >/dev/null \
    || { echo "the criteria approval was never decided -- a request is not a receipt"; return 1; }
}

# MOVE THE GOALPOST WITHOUT A RECEIPT. Rewrites ventures.yaml and takes the new digest, and emits
# NO approval and NO decision -- which is the whole point: the file on disk no longer matches
# anything the spine has approved.
#
# It asserts the digest actually MOVED. If the edit left the digest where it was, the original
# receipt would still cover the file, every assertion downstream would be exercising the receipted
# path, and the test would report a green unreceipted-behaviour gate that never saw one.
_criteria_unreceipted() {
  local venture="$1" days="$2" traffic="$3"
  [ -n "${CRITERIA_DIGEST:-}" ] || { echo "no receipted digest to move away from -- call _criteria first"; return 1; }
  printf 'version: 1\nventures:\n  %s:\n    kill:\n      days_without_revenue: %s\n      traffic_floor_monthly: %s\n' \
    "$venture" "$days" "$traffic" > "$VENTURES"
  CRITERIA_DIGEST_NEW="$(ARC_SPINE_NOW=$DAY0 bash "$PNL" --criteria-digest | tr -d '\r')"
  [ -n "$CRITERIA_DIGEST_NEW" ] || { echo "arc-pnl printed no digest for the edited criteria file"; return 1; }
  [ "$CRITERIA_DIGEST_NEW" != "$CRITERIA_DIGEST" ] \
    || { echo "the edit did not move the digest, so the original receipt still covers this file and nothing below is unreceipted"; return 1; }
}

_pnl_at()   { local now="$1"; shift; ARC_SPINE_NOW="$now" bash "$PNL" "$@"; }
_brief_at() { local now="$1"; shift; ARC_SPINE_NOW="$now" node "$BRIEF" "$@"; }
_lines()    { cat "$SPINE"/events/*.jsonl 2>/dev/null | sed '/^$/d' | wc -l | tr -d ' '; }

# ---------- one row of a boundary ladder ----------
#
# Records its reason in _KD_WHY instead of failing on the spot, so one run reports every boundary
# that moved rather than only the first.
_band_row() {
  local crit="$1" th="$2" val="$3" want="$4" wdist="$5" out st=0 got dist
  _KD_WHY=""
  out="$(node "$KD" eval "$crit" "$th" "$val" 2>&1 </dev/null)" || st=$?
  if [ "$st" -ne 0 ]; then
    _KD_WHY="$crit threshold=$th value=$val: the evaluator exited $st instead of answering -- $out"
    return 1
  fi
  # EVAL_OK is written LAST and only after every field. Without it a truncated answer whose status
  # line happened to be right would pass -- the vacuous shape .claude/rules/testing.md names.
  case "$out" in *EVAL_OK*) ;; *)
    _KD_WHY="$crit threshold=$th value=$val: no EVAL_OK marker, so the evaluator never reached the end -- $out"
    return 1;;
  esac
  got="$(_kd_field status "$out")"
  dist="$(_kd_field distance "$out")"
  if [ "$got" != "$want" ] || [ "$dist" != "$wdist" ]; then
    _KD_WHY="$crit threshold=$th value=$val: want status=$want distance=$wdist, got status=$got distance=$dist"
    return 1
  fi
  return 0
}

# One row that must be REFUSED. Exit 1 EXACTLY: the runner exits 2 when it cannot load
# kill-distance.mjs at all, so a bare non-zero check would stay green with the module deleted.
_refuse_row() {
  local crit="$1" th="$2" val="$3" want="$4" out st=0
  _KD_WHY=""
  out="$(node "$KD" eval "$crit" "$th" "$val" 2>&1 </dev/null)" || st=$?
  if [ "$st" -ne 1 ]; then
    _KD_WHY="$crit threshold=$th value=$val: want a refusal (exit 1), got exit $st -- $out"
    return 1
  fi
  case "$out" in "EVAL_REFUSED BAD_LEDGER_KILL "*) ;; *)
    _KD_WHY="$crit threshold=$th value=$val: the refusal does not carry code BAD_LEDGER_KILL -- $out"
    return 1;;
  esac
  case "$out" in *"$want"*) ;; *)
    _KD_WHY="$crit threshold=$th value=$val: the refusal never says [$want] -- $out"
    return 1;;
  esac
  return 0
}

# Count the rows a table DECLARES and the rows the loop actually CHECKED, and compare them. A
# heredoc that never reaches its loop is the second failure in .claude/rules/testing.md's vacuous
# list: every fixture it built was empty and the tests passed on nothing at all. Zero iterations
# through a table of boundaries looks exactly like a table of boundaries that all held.
#
# `|| true` because grep -c exits 1 on zero matches: without it an EMPTY table would abort the test
# under errexit instead of reaching the `-gt 0` guard that exists to report it.
_declared_rows() { printf '%s\n' "$1" | grep -c '[^[:space:]]' || true; }

# ---------- A. the 80% band, both polarities, at the exact unit ----------

@test "kill: on a ceiling the 80 percent band is exact and crossing wins at the line" {
  # days_without_revenue is climbed toward from below and crossed AT the line. Threshold 10 puts
  # the 80% point on an exact integer, so every rung of the ladder is nameable:
  #   7  = 70%  OK          8 = exactly 80%  WARNING       9 = one below the line  WARNING
  #   10 = the line itself  CROSSED         11 = past it   CROSSED
  # Crossing wins at 100%, where BOTH predicates are true: reporting that as a warning would
  # under-report the one status that needs a human.
  local rows checked=0 declared fails="" crit th val want dist
  rows="$(cat <<'ROWS'
days_without_revenue 10 7 OK 3
days_without_revenue 10 8 WARNING 2
days_without_revenue 10 9 WARNING 1
days_without_revenue 10 10 CROSSED 0
days_without_revenue 10 11 CROSSED -1
ROWS
)"
  declared="$(_declared_rows "$rows")"
  [ "$declared" -gt 0 ] || { echo "the ceiling ladder never reached the loop"; false; }
  while read -r crit th val want dist; do
    [ -n "$crit" ] || continue
    checked=$((checked+1))
    _band_row "$crit" "$th" "$val" "$want" "$dist" || fails="$fails$_KD_WHY
"
  done <<< "$rows"
  [ "$checked" -eq "$declared" ] || { echo "the ladder declares $declared rungs but only $checked were checked"; false; }
  [ -z "$fails" ] || { printf '%s' "$fails"; false; }
}

@test "kill: on a floor the 80 percent band is exact and crossing wins at the line" {
  # traffic_floor_monthly is sunk toward from ABOVE, so the ladder runs downward and the exact 80%
  # point sits at threshold/0.8. Threshold 8 puts it on an integer (8 of 10 is exactly 80%):
  #   11 = above the band  OK         10 = exactly 80%  WARNING     9 = one above the line  WARNING
  #    8 = the line itself  CROSSED    7 = past it      CROSSED
  # distance stays SIGNED and stays positive-means-short-of-the-line on this polarity too, which is
  # the invariant that lets a renderer print "2 to the line" without knowing the direction.
  local rows checked=0 declared fails="" crit th val want dist
  rows="$(cat <<'ROWS'
traffic_floor_monthly 8 11 OK 3
traffic_floor_monthly 8 10 WARNING 2
traffic_floor_monthly 8 9 WARNING 1
traffic_floor_monthly 8 8 CROSSED 0
traffic_floor_monthly 8 7 CROSSED -1
ROWS
)"
  declared="$(_declared_rows "$rows")"
  [ "$declared" -gt 0 ] || { echo "the floor ladder never reached the loop"; false; }
  while read -r crit th val want dist; do
    [ -n "$crit" ] || continue
    checked=$((checked+1))
    _band_row "$crit" "$th" "$val" "$want" "$dist" || fails="$fails$_KD_WHY
"
  done <<< "$rows"
  [ "$checked" -eq "$declared" ] || { echo "the ladder declares $declared rungs but only $checked were checked"; false; }
  [ -z "$fails" ] || { printf '%s' "$fails"; false; }
}

@test "kill: a threshold whose 80 percent point is not an integer bands by exact cross-multiplication" {
  # THE ROW THAT PROVES THE COMPARISON IS INTEGER ARITHMETIC. Threshold 7 puts the ceiling's 80%
  # point at 5.6 and the floor's at 8.75 -- neither is a value anything can be observed at, so the
  # band edge has to be decided by `value * 100 >= 80 * threshold` rather than by a division whose
  # last bit differs between platforms. A kill switch whose warning band is decided by a double is
  # a kill switch that fires on one CI leg and not the other two.
  #   ceiling 7: 5 is OK (500 < 560), 6 is WARNING (600 >= 560), 7 is the line
  #   floor   7: 9 is OK (700 < 720), 8 is WARNING (700 >= 640), 7 is the line
  local rows checked=0 declared fails="" crit th val want dist
  rows="$(cat <<'ROWS'
days_without_revenue 7 5 OK 2
days_without_revenue 7 6 WARNING 1
days_without_revenue 7 7 CROSSED 0
traffic_floor_monthly 7 9 OK 2
traffic_floor_monthly 7 8 WARNING 1
traffic_floor_monthly 7 7 CROSSED 0
ROWS
)"
  declared="$(_declared_rows "$rows")"
  [ "$declared" -gt 0 ] || { echo "the fractional-band table never reached the loop"; false; }
  while read -r crit th val want dist; do
    [ -n "$crit" ] || continue
    checked=$((checked+1))
    _band_row "$crit" "$th" "$val" "$want" "$dist" || fails="$fails$_KD_WHY
"
  done <<< "$rows"
  [ "$checked" -eq "$declared" ] || { echo "the table declares $declared rows but only $checked were checked"; false; }
  [ -z "$fails" ] || { printf '%s' "$fails"; false; }
}

# ---------- B. ABSENT (ADR-1018) ----------

@test "kill: a null observation is ABSENT with a reason, and is never OK and never CROSSED" {
  # Absent renders as neither of the two answers that would be convenient. As OK it is the kill
  # switch silently disabled and reporting green forever; as CROSSED it cries wolf on day one for
  # every venture and gets muted inside a week. It is its own status, and the reason is mandatory.
  local crit fails="" out st reason
  for crit in days_without_revenue traffic_floor_monthly; do
    st=0
    out="$(node "$KD" eval "$crit" 500 null 2>&1 </dev/null)" || st=$?
    if [ "$st" -ne 0 ]; then fails="$fails|$crit: evaluator exited $st -- $out"; continue; fi
    case "$out" in *EVAL_OK*) ;; *) fails="$fails|$crit: no EVAL_OK marker -- $out"; continue;; esac
    [ "$(_kd_field status "$out")" = "ABSENT" ] || fails="$fails|$crit: status is $(_kd_field status "$out"), want ABSENT"
    # The two forbidden readings, named explicitly. Each is paired with the positive above, so
    # neither absence assertion is standing on its own -- a crash satisfies an absence.
    case "$out" in *"status=OK"*)      fails="$fails|$crit: an unmeasured criterion rendered OK";; esac
    case "$out" in *"status=CROSSED"*) fails="$fails|$crit: an unmeasured criterion rendered CROSSED";; esac
    [ "$(_kd_field value "$out")" = "-" ]    || fails="$fails|$crit: ABSENT carries a value"
    [ "$(_kd_field distance "$out")" = "-" ] || fails="$fails|$crit: ABSENT carries a distance to a line it was never measured against"
    reason="$(_kd_field reason "$out")"
    [ "$reason" != "-" ] && [ ${#reason} -gt 20 ] \
      || fails="$fails|$crit: ABSENT carries no usable reason (got [$reason]) -- ADR-1018 makes it mandatory"
  done
  [ -z "$fails" ] || { printf '%s\n' "$fails" | tr '|' '\n'; false; }
}

@test "kill: an undeclared line is ABSENT with its own reason rather than a pass" {
  # A venture whose criteria block lost a key must not render healthy against a line that no longer
  # exists. The observation here is a perfectly good 5 -- it is the THRESHOLD that is missing, and
  # the answer is still ABSENT.
  run node "$KD" eval days_without_revenue null 5
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"EVAL_OK"* ]] || { echo "the evaluator never reached the end: $output"; false; }
  [ "$(_kd_field status "$output")" = "ABSENT" ] || { echo "an undeclared line did not render ABSENT: $output"; false; }
  [ "$(_kd_field threshold "$output")" = "-" ]   || { echo "$output"; false; }
  [[ "$output" == *"no days_without_revenue line is declared"* ]] \
    || { echo "the reason does not name the missing declaration: $output"; false; }
  [[ "$output" != *"status=OK"* ]] || { echo "a missing line rendered as a pass: $output"; false; }
}

@test "kill: unit rides on every row, absent rows included, and reaches the rendered panel" {
  # `unit` was declared in POLARITY and never RETURNED, so arc-pnl's `${c.unit ?? ""}` was dead from
  # the day it was written and every distance rendered as a bare number: "999776 to the line", of
  # what. Asserted at all three construction sites, because a row built by one path and a row built
  # by another are exactly where a field goes missing from one of them.
  local out
  # 1. an EVALUATED row
  run node "$KD" eval days_without_revenue 90 224
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"EVAL_OK"* ]] || { echo "$output"; false; }
  [ "$(_kd_field unit "$output")" = "days" ] || { echo "an evaluated row carries no unit: $output"; false; }

  # 2. an ABSENT row from a null OBSERVATION -- the row the renderer reaches most often, since
  #    traffic is absent on every render in this lane
  run node "$KD" eval traffic_floor_monthly 500 null
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$(_kd_field status "$output")" = "ABSENT" ] || { echo "$output"; false; }
  [ "$(_kd_field unit "$output")" = "visits/month" ] || { echo "an ABSENT row lost its unit: $output"; false; }

  # 3. an ABSENT row from an UNDECLARED LINE -- a different early return, and the one that would
  #    have to thread the unit through by hand
  run node "$KD" eval days_without_revenue null 5
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$(_kd_field status "$output")" = "ABSENT" ] || { echo "$output"; false; }
  [ "$(_kd_field unit "$output")" = "days" ] || { echo "an undeclared-line row lost its unit: $output"; false; }

  # 4. and through evaluateVenture, which is what the panel actually calls
  run node "$KD" venture lexos '{"days_without_revenue":90,"traffic_floor_monthly":500}' '{"lexos":{"days_without_revenue":5,"traffic_floor_monthly":null}}'
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"row criterion=days_without_revenue status=OK distance=85 unit=days"* ]] || { echo "$output"; false; }
  [[ "$output" == *"row criterion=traffic_floor_monthly status=ABSENT distance=- unit=visits/month"* ]] || { echo "$output"; false; }

  # 5. AND IT REACHES THE RENDER. Every assertion above is about a field on an object; this is the
  #    one that fails if the renderer stops reading it, which is the state this whole test found.
  _revenue lexos u0001
  _criteria lexos 90 500
  run _pnl_at $((DAY0 + 5*DAY))
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"days_without_revenue  5 of 90 days  85 to the line"* ]] \
    || { echo "the unit never reached the rendered panel line: $output"; false; }
}

@test "kill: ABSENT criteria are counted and never fold into the venture worst" {
  # absentCount exists so a caller can print "2 criteria could not be evaluated" instead of a
  # shorter, healthier-looking list. And ABSENT is deliberately NOT ranked in the severity scale:
  # folding it in is exactly how it comes to mean "safe" or "crossed" by accident.
  run node "$KD" venture lexos '{"days_without_revenue":90,"traffic_floor_monthly":500}' '{}'
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"VENTURE_OK"* ]] || { echo "the evaluator never reached the end: $output"; false; }
  [ "$(_kd_field absentCount "$output")" = "2" ] || { echo "both criteria are unobservable and absentCount disagrees: $output"; false; }
  [ "$(_kd_field worst "$output")" = "-" ] || { echo "an all-absent venture was given a severity: $output"; false; }
  # BOTH rows survive into the result. A row that vanished would leave absentCount honest and the
  # list short, which is the same lie one layer down.
  [[ "$output" == *"row criterion=days_without_revenue status=ABSENT"* ]] || { echo "$output"; false; }
  [[ "$output" == *"row criterion=traffic_floor_monthly status=ABSENT"* ]] || { echo "$output"; false; }

  # One healthy observation beside one absent: worst must be OK. If ABSENT were ranked it would
  # either outrank OK (and this reads CROSSED) or be pinned at zero (and an all-absent venture
  # above would read OK) -- the two halves of this test are each other's negative control.
  run node "$KD" venture lexos '{"days_without_revenue":90,"traffic_floor_monthly":500}' '{"lexos":{"days_without_revenue":5,"traffic_floor_monthly":null}}'
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"VENTURE_OK"* ]] || { echo "$output"; false; }
  [ "$(_kd_field absentCount "$output")" = "1" ] || { echo "$output"; false; }
  [ "$(_kd_field worst "$output")" = "OK" ] || { echo "an absent criterion changed the venture worst: $output"; false; }
}

@test "kill: the rendered kill panel keeps a row for a criterion it could not evaluate" {
  # THE FAILURE THIS GUARDS: a panel that silently omits what it could not compute is shorter than
  # the truth, every visible line on it is green, and no reader can tell it from a healthy venture.
  # `traffic_floor_monthly` has no data source in this lane at all and is ABSENT on every render.
  _revenue lexos k0001
  _criteria lexos 90 500

  run _pnl_at $((DAY0 + 5*DAY))
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ -n "$output" ]
  # The panel rendered at all, and the criteria receipt held (an unreceipted file exits 3 with an
  # EMPTY stdout, which would satisfy every "does not contain" below).
  [[ "$output" == *"kill lines (as of 2026-07-27)  criteria $CRITERIA_DIGEST"* ]] || { echo "no kill panel was rendered: $output"; false; }
  # The measurable criterion is there with its exact figures AND its unit -- so the absent row below
  # is an ADDITION to a working list, not the only thing the panel managed to print. The trailing
  # `days` is load-bearing: `unit` was declared and never returned, so this line read `5 of 90` and
  # the distance read `85 to the line` -- 85 of what.
  [[ "$output" == *"days_without_revenue  5 of 90 days  85 to the line"* ]] || { echo "the observable criterion is wrong or missing: $output"; false; }
  # And the unmeasurable one is there too, carrying its reason.
  [[ "$output" == *"traffic_floor_monthly"* ]] || { echo "the criterion that could not be evaluated was DROPPED from the panel: $output"; false; }
  [[ "$output" == *"not evaluated: ledger has no traffic data source"* ]] || { echo "the absent row carries no reason: $output"; false; }
  [[ "$output" == *"1 criterion could not be evaluated"* ]] || { echo "the absent count is not surfaced: $output"; false; }
}

@test "kill: a crossing is a needs-you item in arc pnl and the panel names its criteria digest" {
  # `crossings`, `warnings` and `worst` were all computed and DISCARDED: a crossed kill line exited
  # 0, raised nothing, and was findable only by string-matching the middle of the P&L body. The
  # brief had the item; its twin one file over did not.
  _revenue lexos n0001
  _criteria lexos 30 500

  run _pnl_at $((DAY0 + 40*DAY))
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"needs you (1)"* ]] || { echo "a crossed kill line raised no needs-you item: $output"; false; }
  [[ "$output" == *"kill line CROSSED: lexos days_without_revenue 40 of 30 days"* ]] \
    || { echo "the needs-you item does not name the crossing: $output"; false; }

  # THE DIGEST, NOT THE PATH. A path is different bytes on ubuntu, macos and windows and this
  # stdout is compared against a golden on all three; the digest identifies the criteria exactly
  # and is identical everywhere. Asserted as the SAME digest the receipt was written against, so a
  # panel that printed some other file's criteria fails here.
  [[ "$output" == *"kill lines (as of 2026-08-31)  criteria $CRITERIA_DIGEST"* ]] \
    || { echo "the panel header does not name its criteria digest: $output"; false; }
  # The basename, not "$VENTURES": a scratch path is spelled differently by bash and by node on
  # windows, so comparing the variable would pass on that leg no matter what was printed.
  ! [[ "$output" == *"ventures.yaml"* ]] \
    || { echo "the criteria PATH reached stdout, which is byte-compared on three operating systems: $output"; false; }

  # And the path IS available -- on stderr, under the same debug flag the engine name uses. The two
  # streams go to files rather than through `run`, which merges them: a test that cannot tell the
  # streams apart cannot assert that the path is on one and not the other.
  local dbg_rc=0
  ( export ARC_SPINE_DEBUG=1; _pnl_at $((DAY0 + 40*DAY)) ) \
    > "$BATS_TEST_TMPDIR/dbg.out" 2> "$BATS_TEST_TMPDIR/dbg.err" || dbg_rc=$?
  [ "$dbg_rc" -eq 0 ] || { echo "the debug render exited $dbg_rc: $(cat "$BATS_TEST_TMPDIR/dbg.err")"; false; }
  [ -s "$BATS_TEST_TMPDIR/dbg.out" ] || { echo "the debug render produced no P&L at all"; false; }
  grep -q "ventures.yaml" "$BATS_TEST_TMPDIR/dbg.err" \
    || { echo "the criteria path is on neither stream: $(cat "$BATS_TEST_TMPDIR/dbg.err")"; false; }
  grep -q "digest=$CRITERIA_DIGEST" "$BATS_TEST_TMPDIR/dbg.err" \
    || { echo "stderr names a path but not the digest it belongs to: $(cat "$BATS_TEST_TMPDIR/dbg.err")"; false; }
}

@test "kill: a future-dated revenue event cannot erase a crossing, and its exclusion is visible" {
  # THE SHARPEST OF THE THREE. The clock took the MAX revenue day and nulled the observation when it
  # was ahead of today, so ONE event dated 2027 turned a venture past its line from CROSSED into
  # ABSENT -- printing "this venture has no revenue event on the spine" directly beneath a P&L
  # listing that venture's revenue rows. `revenue.received` needs no approval, so ordinary clock
  # skew does this.
  _revenue lexos c0001                 # 2026-07-22, the day the clock counts from
  _future_revenue lexos f0002          # 2027-08-26, ahead of every render below
  _criteria lexos 30 500

  run _pnl_at $((DAY0 + 40*DAY))
  [ "$status" -eq 0 ] || { echo "$output"; false; }

  # HALF ONE -- the crossing SURVIVES, measured from the newest NON-future revenue day.
  [[ "$output" == *"days_without_revenue  40 of 30 days  CROSSED"* ]] \
    || { echo "a future-dated event erased the crossing: $output"; false; }
  [[ "$output" == *"kill line CROSSED: lexos days_without_revenue 40 of 30 days"* ]] \
    || { echo "the crossing survived the panel but not the needs-you group: $output"; false; }
  # THE EXACT SELF-CONTRADICTION the bug produced: the days-criterion absent reason, printed
  # directly beneath the venture's own revenue rows. Pinned by that reason's own words rather than
  # by the em-dash cell, so the assertion is ASCII and cannot turn on how a runner decodes the file.
  [[ "$output" == *"2027-08-26"* ]] || { echo "the future-dated revenue row is not in the P&L, so this fixture is not the one: $output"; false; }
  ! [[ "$output" == *"this venture has no revenue event on the spine"* ]] \
    || { echo "the panel says this venture has no revenue while listing its revenue: $output"; false; }
  # Paired positive: the not-evaluated machinery IS working on this render -- it is the days
  # criterion specifically that must not be using it.
  [[ "$output" == *"traffic_floor_monthly"*"not evaluated: ledger has no traffic data source"* ]] \
    || { echo "the absent row is missing, so the assertion above proves nothing: $output"; false; }

  # HALF TWO -- the exclusion is VISIBLE. Without this the test passes just as well on an
  # implementation that quietly ignores every future-dated event, which is a different wrong
  # answer: an operator whose clock is skewed would never learn that a receipt is being skipped.
  [[ "$output" == *"revenue dated in the future: lexos has 1 revenue event(s) after today, excluded from the days-without-revenue clock"* ]] \
    || { echo "the excluded event went silent: $output"; false; }
  [[ "$output" == *"needs you (2)"* ]] || { echo "want both the crossing and the exclusion in needs-you: $output"; false; }
}

# ---------- C. degenerate inputs are refused, not clamped ----------

@test "kill: a threshold of 0 or a negative threshold is refused on both polarities" {
  # 0 is the most likely parse of an empty or truncated YAML value and it means the opposite wrong
  # thing on each side: on a ceiling `value >= 0` marks every venture CROSSED from birth, on a floor
  # `value <= 0` is a line only a venture with exactly zero traffic can ever cross. Neither is a
  # line a human drew, so both polarities refuse rather than evaluate.
  local rows checked=0 declared fails="" crit th val want
  rows="$(cat <<'ROWS'
days_without_revenue 0 5 threshold 0 must be an integer of at least 1
traffic_floor_monthly 0 5 threshold 0 must be an integer of at least 1
days_without_revenue -5 5 threshold -5 must be an integer of at least 1
traffic_floor_monthly -5 5 threshold -5 must be an integer of at least 1
ROWS
)"
  declared="$(_declared_rows "$rows")"
  [ "$declared" -gt 0 ] || { echo "the threshold table never reached the loop"; false; }
  while read -r crit th val want; do
    [ -n "$crit" ] || continue
    checked=$((checked+1))
    _refuse_row "$crit" "$th" "$val" "$want" || fails="$fails$_KD_WHY
"
  done <<< "$rows"
  [ "$checked" -eq "$declared" ] || { echo "the table declares $declared rows but only $checked were checked"; false; }
  [ -z "$fails" ] || { printf '%s' "$fails"; false; }
}

@test "kill: a negative or non-integer observation is refused, never clamped" {
  # Clamping invents a fact: -3 days clamped to 0 reads as "earned revenue today" on a ceiling, and
  # a negative visit count clamped to 0 reads as CROSSED on a floor. Both are upstream arithmetic
  # bugs and the kill meter is the last surface that should paper one over. A non-integer is refused
  # for the same reason money is (ADR-1012).
  local rows checked=0 declared fails="" crit th val want
  rows="$(cat <<'ROWS'
days_without_revenue 90 -1 observation days_without_revenue = -1 must be a non-negative integer
days_without_revenue 90 3.5 observation days_without_revenue = 3.5 must be a non-negative integer
traffic_floor_monthly 500 -1 observation traffic_floor_monthly = -1 must be a non-negative integer
traffic_floor_monthly 500 2.5 observation traffic_floor_monthly = 2.5 must be a non-negative integer
ROWS
)"
  declared="$(_declared_rows "$rows")"
  [ "$declared" -gt 0 ] || { echo "the observation table never reached the loop"; false; }
  while read -r crit th val want; do
    [ -n "$crit" ] || continue
    checked=$((checked+1))
    _refuse_row "$crit" "$th" "$val" "$want" || fails="$fails$_KD_WHY
"
  done <<< "$rows"
  [ "$checked" -eq "$declared" ] || { echo "the table declares $declared rows but only $checked were checked"; false; }
  [ -z "$fails" ] || { printf '%s' "$fails"; false; }
}

@test "kill: an unknown criterion name is refused at every entry point" {
  # Attacked in three places rather than one, because "validate one read, compare another" is this
  # lane's twin-fix scar: a rule closed in one function and left open in the next door one. A `kill:`
  # entry no evaluator knows is a line the owner believes is being watched and is not; an
  # observation key that matches nothing is almost always a misspelling of one that does.
  run node "$KD" eval mrr_floor_monthly 90 5
  [ "$status" -eq 1 ] || { echo "evaluateCriterion accepted an unknown criterion (exit $status): $output"; false; }
  [[ "$output" == "EVAL_REFUSED BAD_LEDGER_KILL "* ]] || { echo "$output"; false; }
  [[ "$output" == *"has no polarity row"* ]] || { echo "$output"; false; }

  run node "$KD" venture lexos '{"mrr_floor_monthly":90}' '{}'
  [ "$status" -eq 1 ] || { echo "a kill block declared an unknown criterion and was accepted (exit $status): $output"; false; }
  [[ "$output" == "VENTURE_REFUSED BAD_LEDGER_KILL "* ]] || { echo "$output"; false; }
  [[ "$output" == *"mrr_floor_monthly"* ]] || { echo "the refusal does not name the offending key: $output"; false; }

  run node "$KD" venture lexos '{"days_without_revenue":90,"traffic_floor_monthly":500}' '{"lexos":{"dyas_without_revenue":4}}'
  [ "$status" -eq 1 ] || { echo "a misspelled observation key was silently skipped (exit $status): $output"; false; }
  [[ "$output" == "VENTURE_REFUSED BAD_LEDGER_KILL "* ]] || { echo "$output"; false; }
  [[ "$output" == *"dyas_without_revenue"* ]] || { echo "the refusal does not name the misspelling: $output"; false; }
}

# ---------- D. the vocabulary drift guard, with a negative control ----------

@test "kill: the vocabulary drift guard fires when the two criterion lists disagree" {
  # kill-distance.mjs asserts at module LOAD that POLARITY's keys equal ventures.mjs's KILL_CRITERIA.
  # A guard with no negative control is a guard nobody has ever seen fire, so this test makes it
  # fire: lib/ is copied, a third criterion is added to the COPY's schema only, and the copy is
  # imported in a FRESH node process (an in-process second import would be served from the module
  # cache and prove nothing).
  local lib="$BATS_TEST_TMPDIR/lib" v hits
  cp -r "$HQ/lib" "$lib"
  v="$lib/ledger/ventures.mjs"
  [ -s "$v" ] || { echo "the copied lib carries no ventures.mjs -- the fixture is empty"; false; }
  [ -s "$lib/ledger/kill-distance.mjs" ] || { echo "the copied lib carries no kill-distance.mjs"; false; }

  # CONTROL ON THE CONTROL. The untouched copy must import. Without this the refusal below could be
  # produced by a copy that was simply broken -- a missing dependency, a truncated file -- and the
  # drift guard would still never have been seen to fire.
  run node "$KD" import "$lib/ledger/kill-distance.mjs"
  [ "$status" -eq 0 ] || { echo "the PRISTINE copy did not import, so nothing below measures drift: $output"; false; }
  [[ "$output" == *"IMPORT_OK"* ]] || { echo "$output"; false; }

  # sed to a new file then mv, never `sed -i`: the -i spelling differs between GNU and BSD and this
  # suite runs on all three legs.
  sed 's/"traffic_floor_monthly"\]/"traffic_floor_monthly", "mrr_floor_monthly"]/' "$v" > "$v.next"
  mv "$v.next" "$v"
  hits="$(grep -c 'mrr_floor_monthly' "$v" | tr -d ' \r')"
  [ "$hits" = "1" ] || { echo "the drift edit landed $hits time(s), want exactly 1 -- KILL_CRITERIA no longer matches the pattern this test edits"; false; }

  run node "$KD" import "$lib/ledger/kill-distance.mjs"
  [ "$status" -eq 1 ] || { echo "a drifted vocabulary imported anyway (exit $status): $output"; false; }
  [[ "$output" == "IMPORT_FAILED BAD_LEDGER_KILL "* ]] || { echo "the drift did not raise BAD_LEDGER_KILL: $output"; false; }
  [[ "$output" == *"DRIFTED"* ]] || { echo "the refusal does not name the drift: $output"; false; }
  [[ "$output" == *"mrr_floor_monthly"* ]] || { echo "the refusal does not name the criterion that drifted: $output"; false; }

  # And the SHIPPED module -- the one every other test in this file drives -- still imports cleanly.
  run node "$KD" import "$HQ/lib/ledger/kill-distance.mjs"
  [ "$status" -eq 0 ] || { echo "the shipped kill-distance.mjs does not import: $output"; false; }
  [[ "$output" == *"IMPORT_OK criteria=days_without_revenue,traffic_floor_monthly"* ]] || { echo "$output"; false; }
}

# ---------- E. a render emits nothing (ADR-1000 / LED-A) ----------

@test "kill: rendering emits nothing onto the spine" {
  # A crossing is a fact about data the spine already holds. Recording a second fact saying so would
  # make the meter part of the history it measures, and a replay would then re-derive crossings that
  # a later replay disagrees with.
  _revenue lexos e0001
  _revenue arc   e0002
  _cost   arc
  _criteria lexos 90 500

  local before after dg
  before="$(_lines)"
  # AN UNCHANGED COUNT OF ZERO IS THE VACUOUS VERSION OF THIS TEST: it is produced equally by a
  # spine that was never built and by renders that all crashed. So the corpus is asserted first.
  [ "$before" -gt 0 ] || { echo "the scratch spine holds no events, so an unchanged count would prove nothing"; false; }

  run _pnl_at $((DAY0 + 5*DAY))
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"kill lines (as of"*"  criteria $CRITERIA_DIGEST"* ]] || { echo "the plain render produced no panel: $output"; false; }

  run _pnl_at $((DAY0 + 5*DAY)) --venture lexos
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"lexos"* ]] || { echo "the venture-scoped render produced nothing: $output"; false; }

  run _pnl_at $((DAY0 + 5*DAY)) --criteria-digest
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  dg="$(printf '%s' "$output" | tr -d '\r')"
  # Length plus an explicit character LIST, not a bash `=~` with an interval and not `[!0-9a-f]`:
  # bash 3.2 is the macOS leg's shell, and under some locales a glob range matches letters outside
  # it (tests/portability.bats:31-40 -- a lane called Design passed one twin and failed the other).
  [ ${#dg} -eq 64 ] || { echo "--criteria-digest printed ${#dg} bytes, not a 64-char sha256: $output"; false; }
  case "$dg" in *[!0123456789abcdef]*) echo "--criteria-digest is not lowercase hex: $output"; false;; esac

  # The brief derives the same panel, so it is on this gate too.
  run _brief_at $((DAY0 + 5*DAY)) --date 2026-07-22
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"brief 2026-07-22"* ]] || { echo "the brief produced nothing: $output"; false; }

  after="$(_lines)"
  [ "$after" = "$before" ] \
    || { echo "a render wrote to the spine: $before line(s) before, $after after"; cat "$SPINE"/events/*.jsonl; false; }
}

# ---------- F. the brief integration ----------

@test "kill: a crossed line is a needs-you item in arc brief" {
  _revenue lexos c0001
  _criteria lexos 30 500          # 40 days later, 40 of 30 is CROSSED

  run _brief_at $((DAY0 + 40*DAY)) --date 2026-07-22
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"brief 2026-07-22"* ]] || { echo "the brief did not render: $output"; false; }
  [[ "$output" == *"needs-you"* ]] || { echo "no needs-you group at all: $output"; false; }
  [[ "$output" == *"kill line CROSSED  lexos  days_without_revenue 40 of 30 days"* ]] \
    || { echo "the crossing is not a needs-you item: $output"; false; }
}

@test "kill: a WARNING is never a needs-you item, in arc pnl or in arc brief" {
  # A warning in the one group that must never be skimmed is how a reader learns to skim it. BOTH
  # surfaces are asserted in one test on purpose: "closed in one file, left open in its twin" is
  # this lane's recorded scar, and the crossing twin of this rule lives in two separate tests.
  _revenue lexos w0001
  _criteria lexos 50 500          # 40 days later, 40 of 50 is exactly the 80% band: WARNING

  # POSITIVE FIRST: the warning genuinely exists on this spine. Without this every absence
  # assertion below is satisfied by a spine with no criteria file, a refused render, or no
  # revenue at all.
  run _pnl_at $((DAY0 + 40*DAY))
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"days_without_revenue  40 of 50 days  WARNING 10 to the line"* ]] \
    || { echo "the fixture does not produce a WARNING, so nothing below is being tested: $output"; false; }
  # ARC PNL: the panel row above is the whole of a warning's reach. No needs-you item.
  #
  # This one MAY assert the whole group's absence, unlike its arc-brief twin below, and the reason is
  # worth stating rather than leaving as a difference someone later "tidies up": arc-pnl's needs-you
  # is written ENTIRELY by this lane (pnl flags, kill crossings, future-dated revenue), while
  # arc-brief's is shared -- scheduler writes overdue-job lines into the same group, which is exactly
  # what broke the twin. Even here it is a landmine against this lane's own future additions, so the
  # specific-line check on the next line is the real assertion and this is the belt.
  [[ "$output" != *"needs you"* ]] || { echo "a WARNING opened the arc-pnl needs-you group: $output"; false; }
  [[ "$output" != *"kill line CROSSED"* ]] || { echo "a WARNING was reported as a crossing: $output"; false; }

  # The brief on the revenue day DOES render needs-you -- the criteria approval is one -- and the
  # warning still did not join it. That pairing is what makes the absence meaningful: the group is
  # demonstrably working.
  run _brief_at $((DAY0 + 40*DAY)) --date 2026-07-22
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"needs-you"* ]] || { echo "the needs-you group did not render at all, so its contents prove nothing: $output"; false; }
  [[ "$output" != *"kill line"* ]] || { echo "a WARNING was reported as a needs-you item: $output"; false; }

  # And on a quiet day the brief is the header alone.
  run _brief_at $((DAY0 + 40*DAY)) --date 2026-08-31
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"brief 2026-08-31"* ]] || { echo "the brief did not render: $output"; false; }
  [[ "$output" != *"kill line"* ]] || { echo "a WARNING surfaced on a quiet day: $output"; false; }
  # ASSERT THE LINE'S ABSENCE, NOT THE GROUP'S. This used to require that `needs-you` did not appear
  # at all, which was true when this lane was the only one putting derived lines there -- and stopped
  # being true the moment scheduler's Cycle 12 merged, because an overdue job opens the same group.
  # The test then failed for a fact about ANOTHER lane while the thing it actually guards was intact.
  #
  # An absence assertion has to name what must be absent. Scoping it to the whole group made this
  # lane's test a hostage to every future lane that ever writes a needs-you line, which is the
  # opposite of what a shared surface needs. The `kill line` check above IS the assertion; this one
  # now only pins that no LEDGER line joined the group.
  [[ "$output" != *"kill lines NOT EVALUATED"* ]] \
    || { echo "the criteria notice surfaced on a day with a receipted file: $output"; false; }
}

@test "kill: needs-you renders on a day with zero events when a line is crossed" {
  # A quiet day is exactly when a crossed kill line is the only thing that matters. The guard this
  # protects returned early on zero EVENTS, which dropped every crossing on precisely those days.
  _revenue lexos q0001
  _criteria lexos 30 500

  run _brief_at $((DAY0 + 40*DAY)) --date 2026-08-31
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"brief 2026-08-31"* ]] || { echo "the brief did not render: $output"; false; }
  # The day carries no events at all -- proven by the absence of every event-bearing group -- and
  # needs-you is non-empty anyway.
  [[ "$output" != *"money ("* ]] || { echo "2026-08-31 is not the quiet day this test needs: $output"; false; }
  # THE GROUP, NOT ITS COUNT. This spine spans forty days, so the scheduler lane's derived job
  # lines land in the same group and the number is not this lane's to own -- exactly the shape
  # `.claude/rules/testing.md` names ("a test asserting the ABSENCE of a shared group passes only
  # while your lane is the sole writer"), in the positive direction. The claim here is that
  # needs-you is non-empty on a day with no events, and the crossing line below is what proves
  # WHICH line put it there.
  [[ "$output" == *"needs-you ("* ]] || { echo "needs-you vanished on a day with no events: $output"; false; }
  [[ "$output" == *"kill line CROSSED  lexos  days_without_revenue 40 of 30 days"* ]] || { echo "$output"; false; }
}

@test "kill: moving a kill line without a receipt makes the brief say so instead of going quiet" {
  # THE FINDING. With the criteria file PRESENT but UNRECEIPTED, arc-brief fell back to an empty
  # crossings array and said nothing at all -- exit 0, zero bytes of warning. The adversary took a
  # genuinely crossed line and nudged the threshold by one: still crossed, only the receipt broken,
  # and the brief went from naming the crossing to silence. Moving a goalpost was a one-line way to
  # make the alarm stop, on the surface a human actually reads daily.
  _revenue lexos b0001
  _criteria lexos 30 500

  # BEFORE: receipted, and the brief names the crossing. Without this the silence below is
  # indistinguishable from a fixture that was never crossed in the first place.
  run _brief_at $((DAY0 + 40*DAY)) --date 2026-08-31
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"kill line CROSSED  lexos  days_without_revenue 40 of 30 days"* ]] \
    || { echo "the fixture is not crossed to begin with, so nothing below is being tested: $output"; false; }

  # NUDGE THE LINE BY ONE AND KEEP IT CROSSED: 40 days is still past a 31-day line. An edit that
  # also un-crossed the line would make this test pass for the wrong reason -- and keep passing if
  # somebody restored the silent-drop behaviour.
  _criteria_unreceipted lexos 31 500

  run _brief_at $((DAY0 + 40*DAY)) --date 2026-08-31
  # STILL EXIT 0: the brief is a daily read, not a gate. It reports; it does not refuse.
  [ "$status" -eq 0 ] || { echo "the brief exited $status instead of reporting: $output"; false; }
  [[ "$output" == *"brief 2026-08-31"* ]] || { echo "the brief did not render: $output"; false; }
  # PRESENT and ABSENT asserted in the same breath. The notice alone is satisfied by an
  # implementation that prints it unconditionally; the missing crossing alone is satisfied by a
  # crash. Only the pair says "it stopped vouching for the line AND it told you".
  # The GROUP, not its count -- see the note above: this spine spans forty days, so another lane
  # writes derived lines into needs-you too and the number is not this lane's to pin. The notice
  # line asserted immediately below is what proves the group is non-empty for the right reason.
  [[ "$output" == *"needs-you ("* ]] || { echo "the notice did not land in the needs-you group: $output"; false; }
  [[ "$output" == *"kill lines NOT EVALUATED -- ventures.yaml is unreceipted (digest $CRITERIA_DIGEST_NEW)"* ]] \
    || { echo "an unreceipted criteria file produced no notice at all: $output"; false; }
  [[ "$output" != *"kill line CROSSED"* ]] \
    || { echo "the brief reported a crossing it cannot vouch for: $output"; false; }

  # THE OTHER SURFACE, ON THE SAME STATE. The finding is that these two disagreed and only one of
  # them was loud, so both are pinned here rather than one per file -- which is how the twin got
  # left open in the first place. Streams to files, because the refusal is on stderr while the
  # emptiness being asserted is on stdout.
  local pnl_rc=0
  _pnl_at $((DAY0 + 40*DAY)) > "$BATS_TEST_TMPDIR/unrec.out" 2> "$BATS_TEST_TMPDIR/unrec.err" || pnl_rc=$?
  [ "$pnl_rc" -eq 3 ] || { echo "arc-pnl exited $pnl_rc on an unreceipted file, want 3: $(cat "$BATS_TEST_TMPDIR/unrec.err")"; false; }
  [ ! -s "$BATS_TEST_TMPDIR/unrec.out" ] \
    || { echo "arc-pnl printed a partial P&L while refusing, which is exactly what downstream must not be able to consume: $(cat "$BATS_TEST_TMPDIR/unrec.out")"; false; }
  grep -q "UNRECEIPTED CRITERIA CHANGE" "$BATS_TEST_TMPDIR/unrec.err" \
    || { echo "arc-pnl refused without naming why: $(cat "$BATS_TEST_TMPDIR/unrec.err")"; false; }
  grep -q "$CRITERIA_DIGEST_NEW" "$BATS_TEST_TMPDIR/unrec.err" \
    || { echo "the refusal does not name the digest that needs a receipt: $(cat "$BATS_TEST_TMPDIR/unrec.err")"; false; }
}

@test "kill: this suite registers every test it declares" {
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
