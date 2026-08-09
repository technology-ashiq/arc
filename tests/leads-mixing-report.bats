#!/usr/bin/env bats
# leads Phase 03 slice 05 -- the MIXING GUARD, proved by its own negative.
#
# The phase spec asks for one thing here: "a report run over the rehearsal window, asked for
# real sends, returns zero -- and the assertion checks the count, not the absence of a word in
# the output". Slice 04 built the counter (`sendCounts`) and the adversarial pass then recorded
# what was still missing: the counter had no production caller that passed a window, so the
# claim in its own header -- no real cold send happened in the rehearsal window -- had no report
# behind it. `arc-leads report` is that caller, and this file is the proof.
#
# EVERY ASSERTION HERE IS A NUMBER, compared with `-eq`. That is not stylistic. An assertion
# shaped "the output does not contain the word rehearsal" is satisfied by a crash, by an empty
# stdout, and by any mutant that renames a field; the spec forbids that form by name. A count
# read out of the report and compared as an integer fails when the command dies, because an
# empty string is not an integer and `[ "" -eq 0 ]` is a bash error rather than a pass.
#
# AND EVERY ZERO HAS A NEGATIVE CONTROL. A reporter that answers zero to everything satisfies
# the headline test on its own, so the same window is asked again with a real send present and
# must come back non-zero. The counts that are NOT zero (rehearsal, total) are asserted in the
# same breath as the zero, for the same reason.
#
# The receipts are built through the REAL emitter, so the fixture is schema-valid by
# construction rather than by our guess at the shape -- with exactly one exception, the receipt
# that predates the ADR-0416 mark, which the emitter now refuses outright. That one is written
# straight to a day file, which is the only way it exists at all and also the only way it exists
# in the field: an older build wrote it before the schema had the key.
#
# No addresses appear anywhere in this file. It is a fixture-class path (pii-tripwire treats
# tests/leads-*.bats as one) and could carry RFC-2606 reserved literals, but a report over
# receipts never needs one -- lead ids are keyed HMACs and that is the whole point of ADR-0400.
# ASCII-only test names; the file asserts its own declared count at the end.
bats_require_minimum_version 1.5.0
load 'test_helper'

# The rehearsal window, in the one spelling the payload validator accepts (ADR-0400: one
# spelling per instant, no fractional part, +05:30 only).
FROM="2026-08-04T00:00:00+05:30"
TO="2026-08-04T23:59:59+05:30"
SHA64="cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
ZERO64="0000000000000000000000000000000000000000000000000000000000000000"

setup() {
  export ARC_LEADS_STORE="$BATS_TEST_TMPDIR/store"
  export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine"
}

# One `outreach.sent` receipt, through the emitter every leads receipt goes through. Written as
# a literal JSON string rather than assembled in node, because `process.argv` under `node -e` is
# a documented trap in this tree and a fixture builder that quietly builds the wrong payload is
# a silent pass generator.
_receipt() {   # n  mark(true|false)  submitted_at  campaign
  ARC_LEADS_FAKE=1 bash "$ARC_ROOT/.claude/scripts/hq/arc-event.sh" emit outreach.sent \
    --payload "{\"lead_id\":\"lead_hmac_v1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa$1\",\"campaign\":\"$4\",\"touch_n\":1,\"idem_key\":\"k$1\",\"provider_message_id\":\"m$1\",\"submitted_at\":\"$3\",\"draft_sha\":\"$SHA64\",\"rehearsal\":$2}" \
    --strict --actor arc-leads >/dev/null
}

# A receipt with NO mark at all. The emitter refuses to write one now -- `rehearsal` is
# `required` with an empty `optional` list -- so this goes straight to a day file. That is not a
# shortcut around the schema: it is the shape a build older than ADR-0416 left behind, and the
# counter's rule about it (unmarked counts as REAL) is the rule that keeps a zero meaningful.
_unmarked_receipt() {   # submitted_at
  mkdir -p "$ARC_SPINE_ROOT/events"
  printf '%s\n' "{\"id\":\"01KZK97CXRN728PDA7BAX44001\",\"v\":1,\"ts\":\"$1\",\"idem\":\"$ZERO64\",\"actor\":\"arc-leads\",\"process\":\"leads@0.9.0\",\"model\":null,\"venture\":\"arc\",\"run_id\":\"r-old\",\"kind\":\"outreach.sent\",\"payload\":{\"lead_id\":\"lead_hmac_v1_ccccccccccccccccccccccccccccccc9\",\"campaign\":\"pilot\",\"touch_n\":1,\"idem_key\":\"kold\",\"provider_message_id\":\"mold\",\"submitted_at\":\"$1\",\"draft_sha\":\"$SHA64\"},\"outcome\":\"ok\",\"cost\":null,\"evidence\":null,\"supersedes\":null,\"sha\":\"$ZERO64\"}" \
    >> "$ARC_SPINE_ROOT/events/2026-08-04.jsonl"
}

# Five rehearsal sends inside the window, and nothing else. This is the rehearsal campaign as
# ADR-0416 authorises it: five known people, every send marked.
_spine_rehearsal_only() {
  _receipt 1 true "2026-08-04T11:00:00+05:30" pilot
  _receipt 2 true "2026-08-04T12:00:00+05:30" pilot
  _receipt 3 true "2026-08-04T13:00:00+05:30" pilot
  _receipt 4 true "2026-08-04T14:00:00+05:30" pilot
  _receipt 5 true "2026-08-04T15:00:00+05:30" pilot
  # THE FIXTURE ASSERTS ITSELF. An emitter that quietly wrote nothing would leave every count
  # at zero and the headline test would pass on an empty spine -- a green run proving only that
  # the fixture never got built.
  [ "$(cat "$ARC_SPINE_ROOT"/events/*.jsonl | grep -c 'outreach.sent')" -eq 5 ]
}

# The same five, plus the two receipts that must NOT read as rehearsals: one real send inside
# the window, and one receipt from before the mark existed.
_spine_mixed() {
  _spine_rehearsal_only
  _receipt 6 false "2026-08-04T18:00:00+05:30" pilot
  _unmarked_receipt "2026-08-04T19:00:00+05:30"
  [ "$(cat "$ARC_SPINE_ROOT"/events/*.jsonl | grep -c 'outreach.sent')" -eq 7 ]
}

_report() { cd "$ARC_ROOT" && ARC_LEADS_FAKE=1 node .claude/scripts/leads/arc-leads.mjs report --json "$@"; }
_report_human() { cd "$ARC_ROOT" && ARC_LEADS_FAKE=1 node .claude/scripts/leads/arc-leads.mjs report "$@"; }
_state() { cd "$ARC_ROOT" && ARC_LEADS_FAKE=1 node .claude/scripts/leads/arc-leads.mjs state --json; }

# The report's own JSON in, ONE number out, and a hard failure if the field is not a number.
# This is what makes every assertion below a count: the caller compares with `-eq`, so an empty
# stdout from a crashed report is an error rather than a quietly passing absence.
_field() {   # field-name, JSON on stdin
  node -e 'let s = ""; process.stdin.on("data", (d) => { s += d; }).on("end", () => {
    const o = JSON.parse(s); const v = o.sends[process.argv[1]];
    if (typeof v !== "number") { process.stderr.write("sends." + process.argv[1] + " is not a number"); process.exit(1); }
    process.stdout.write(String(v)); });' "$1"
}

# ---------- the exit criterion ----------

# THE headline. The window is the rehearsal window, the question is real sends, the answer is a
# NUMBER, and it is zero. `rehearsal` and `total` are asserted in the same test and that is what
# stops a reporter which answers zero to every question from passing this line.
@test "the rehearsal window asked for real sends answers zero by count" {
  _spine_rehearsal_only
  run --separate-stderr _report --campaign pilot --from "$FROM" --to "$TO"
  [ "$status" -eq 0 ] || { echo "status=$status stderr=$stderr"; false; }
  real="$(printf '%s' "$output" | _field real)"
  rehearsal="$(printf '%s' "$output" | _field rehearsal)"
  total="$(printf '%s' "$output" | _field total)"
  [ "$real" -eq 0 ] || { echo "real=$real (expected 0)"; false; }
  [ "$rehearsal" -eq 5 ] || { echo "rehearsal=$rehearsal (expected 5)"; false; }
  [ "$total" -eq 5 ] || { echo "total=$total (expected 5)"; false; }
}

# THE NEGATIVE CONTROL, and the reason the test above means anything. Same window, same command,
# one real send present -- the real count must move. A reporter hard-wired to zero, a reporter
# that lost its window, and a reporter that classified everything as a rehearsal all pass the
# headline test and all fail here.
@test "the same window with a real send present returns a non-zero real count" {
  _spine_rehearsal_only
  _receipt 6 false "2026-08-04T18:00:00+05:30" pilot
  run --separate-stderr _report --campaign pilot --from "$FROM" --to "$TO"
  [ "$status" -eq 0 ] || { echo "status=$status stderr=$stderr"; false; }
  real="$(printf '%s' "$output" | _field real)"
  rehearsal="$(printf '%s' "$output" | _field rehearsal)"
  [ "$real" -eq 1 ] || { echo "real=$real (expected 1)"; false; }
  [ "$rehearsal" -eq 5 ] || { echo "rehearsal=$rehearsal (expected 5)"; false; }
}

# An unmarked receipt can only predate the mark, and "we cannot show this was a rehearsal" is
# not "it was a rehearsal". Counting it as REAL is what keeps a zero worth claiming; counting it
# as a rehearsal is the one direction ADR-0416 forbids outright, and silently dropping it is the
# other. Both are asserted here: it appears in `real`, it appears in `unmarked`, and it does not
# appear in `rehearsal`.
@test "a receipt predating the mark counts as real and never as a rehearsal" {
  _spine_rehearsal_only
  _unmarked_receipt "2026-08-04T19:00:00+05:30"
  run --separate-stderr _report --campaign pilot --from "$FROM" --to "$TO"
  [ "$status" -eq 0 ] || { echo "status=$status stderr=$stderr"; false; }
  real="$(printf '%s' "$output" | _field real)"
  unmarked="$(printf '%s' "$output" | _field unmarked)"
  rehearsal="$(printf '%s' "$output" | _field rehearsal)"
  total="$(printf '%s' "$output" | _field total)"
  [ "$real" -eq 1 ] || { echo "real=$real (expected 1)"; false; }
  [ "$unmarked" -eq 1 ] || { echo "unmarked=$unmarked (expected 1)"; false; }
  [ "$rehearsal" -eq 5 ] || { echo "rehearsal=$rehearsal (expected 5)"; false; }
  [ "$total" -eq 6 ] || { echo "total=$total (expected 6)"; false; }
}

# ---------- the refusals: never a zero for a question that was not asked ----------

# `sendCounts` refuses a window it cannot place, and this asserts the COMMAND SURFACE does not
# undo that by catching the refusal and printing a zero. Every spelling below is one a person
# would plausibly type and every one used to answer all-zeros: `Z` sorts after `+`, and a
# date-only bound sorts before every stamp on that day.
#
# The last two lines are the positive control. Without them, a report that refused everything --
# or one that failed to start at all -- would satisfy every refusal above it.
@test "a window the reporter cannot place refuses instead of answering zero" {
  _spine_rehearsal_only
  for w in "2026-08-04" "2026-08-04T04:00:00Z" "2026-08-04T00:00:00.000+05:30" "yesterday" "2026-02-30T00:00:00+05:30"; do
    run --separate-stderr _report --campaign pilot --from "$w" --to "$TO"
    [ "$status" -eq 2 ] || { echo "from=$w status=$status (expected 2)"; false; }
    [ -z "$output" ] || { echo "from=$w printed a count on a window it cannot place: $output"; false; }
  done
  run --separate-stderr _report --campaign pilot --from "$FROM" --to "$TO"
  [ "$status" -eq 0 ] || { echo "the placeable window did not answer: $stderr"; false; }
  n="$(printf '%s' "$output" | _field rehearsal)"
  [ "$n" -eq 5 ] || { echo "rehearsal=$n (expected 5)"; false; }
}

# An inverted window matches no receipt, so it answers zero to everything -- the same confident
# wrong answer an unplaceable bound gives, arriving through bounds that are each individually
# valid. The paired positive control is the identical pair the right way round.
@test "an inverted window refuses instead of answering zero" {
  _spine_mixed
  run --separate-stderr _report --from "$TO" --to "$FROM"
  [ "$status" -eq 2 ] || { echo "status=$status (expected 2)"; false; }
  [ -z "$output" ] || { echo "an inverted window printed a count: $output"; false; }
  run --separate-stderr _report --from "$FROM" --to "$TO"
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  n="$(printf '%s' "$output" | _field real)"
  [ "$n" -eq 2 ] || { echo "real=$n (expected 2)"; false; }
}

# The campaign axis is an EXACT match by design, and `sendCounts` says so: answering a name that
# does not exist with a silent zero is the caller's contract to keep. `state --json` keeps it by
# only asking about names it folded out of the spine. This command takes the name from a human's
# shell, where a capital and a trailing space are each one keystroke away and both would answer
# `real: 0` -- which reads exactly like the answer the operator was hoping for.
@test "a campaign no receipt carries refuses instead of answering zero real" {
  _spine_mixed
  for c in "Pilot" "pilot " "pilo" "other"; do
    run --separate-stderr _report --campaign "$c" --from "$FROM" --to "$TO"
    [ "$status" -eq 2 ] || { echo "campaign=$c status=$status (expected 2)"; false; }
    [ -z "$output" ] || { echo "campaign=$c printed a count: $output"; false; }
  done
  run --separate-stderr _report --campaign pilot --from "$FROM" --to "$TO"
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  n="$(printf '%s' "$output" | _field real)"
  [ "$n" -eq 2 ] || { echo "real=$n (expected 2)"; false; }
}

# A SPINE THE REPORTER CANNOT READ IS A REFUSAL. This is the same rule as the window one,
# arriving from the read side: an absent or mistyped ARC_SPINE_ROOT folded to zero events would
# produce the most reassuring number in the system from having read nothing at all. `state` may
# fold a missing spine to empty -- it answers a different question, "what does this install know
# about" -- and this asserts the two differ on purpose rather than by accident.
@test "a spine the reporter cannot read refuses instead of answering zero" {
  _spine_mixed
  ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/no-such-spine" run --separate-stderr _report
  [ "$status" -eq 2 ] || { echo "status=$status (expected 2)"; false; }
  [ -z "$output" ] || { echo "a missing spine printed a count: $output"; false; }
  run --separate-stderr _report
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  n="$(printf '%s' "$output" | _field total)"
  [ "$n" -eq 7 ] || { echo "total=$n (expected 7)"; false; }
}

# ---------- one reader, one fold ----------

# D5, this lane's most repeated defect: two derivations of one number. `state --json` and
# `report --json` answer the same question over the same receipts, and they must do it through
# the same reader and the same fold rather than through two folds that happen to agree today.
# Asserted field by field over a spine holding all three classes, with `total` pinned so four
# matching zeros cannot satisfy the loop.
@test "report and state derive one set of counts, never two" {
  _spine_mixed
  run --separate-stderr _report
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  rep="$output"
  run --separate-stderr _state
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  st="$output"
  for f in rehearsal real unmarked total; do
    a="$(printf '%s' "$rep" | _field "$f")"
    b="$(printf '%s' "$st" | _field "$f")"
    [ "$a" -eq "$b" ] || { echo "$f: report=$a state=$b"; false; }
  done
  t="$(printf '%s' "$rep" | _field total)"
  [ "$t" -eq 7 ] || { echo "total=$t (expected 7) -- the agreement above was between two zeros"; false; }
}

# Both filters have to BITE, or the window and the campaign are decoration on a count of
# everything. The narrow window holds two of the five rehearsal sends and neither of the two
# non-rehearsal receipts; the other campaign holds one send of its own.
@test "the window and campaign filters both bite through the command surface" {
  _spine_mixed
  _receipt 7 false "2026-08-04T20:00:00+05:30" other
  run --separate-stderr _report --from "$FROM" --to "2026-08-04T12:00:00+05:30"
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  narrow_r="$(printf '%s' "$output" | _field rehearsal)"
  narrow_real="$(printf '%s' "$output" | _field real)"
  [ "$narrow_r" -eq 2 ] || { echo "narrow rehearsal=$narrow_r (expected 2)"; false; }
  [ "$narrow_real" -eq 0 ] || { echo "narrow real=$narrow_real (expected 0)"; false; }
  run --separate-stderr _report --campaign other --from "$FROM" --to "$TO"
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  other_total="$(printf '%s' "$output" | _field total)"
  [ "$other_total" -eq 1 ] || { echo "campaign other total=$other_total (expected 1)"; false; }
  run --separate-stderr _report --from "$FROM" --to "$TO"
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  all_total="$(printf '%s' "$output" | _field total)"
  [ "$all_total" -eq 8 ] || { echo "unfiltered total=$all_total (expected 8)"; false; }
}

# The person runs the command without `--json` and reads the lines. A print path that showed a
# different number from the one derived would be the same defect as a second fold, wearing a
# formatting change as its disguise -- so the printed numbers are compared to the JSON ones.
@test "the printed report shows the same numbers as its json" {
  _spine_mixed
  run --separate-stderr _report_human --campaign pilot --from "$FROM" --to "$TO"
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  human="$output"
  run --separate-stderr _report --campaign pilot --from "$FROM" --to "$TO"
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  for f in rehearsal real unmarked total; do
    j="$(printf '%s' "$output" | _field "$f")"
    h="$(printf '%s\n' "$human" | awk -v k="$f" '$1 == k { print $2 }')"
    [ "$h" -eq "$j" ] || { echo "$f: printed=$h json=$j"; false; }
  done
  # Pinned so a human surface that printed four zeros could not agree its way to a pass.
  h="$(printf '%s\n' "$human" | awk '$1 == "total" { print $2 }')"
  [ "$h" -eq 7 ] || { echo "printed total=$h (expected 7)"; false; }
}

# LAST on purpose: BATS_TEST_NUMBER is then the count bats registered AND REACHED, so comparing
# it against what the file declares catches a declared test that never ran. The grep covers the
# comment form of a `@test` too -- bats registers a shell function whose opening brace is
# followed by a `# @test` marker, and a plain `^@test ` grep cannot see one, which makes it
# blind to exactly the test it exists to notice. `[{]` rather than a backslash-escaped brace: a
# brace after `.*` reads as an interval bound to some ERE engines.
@test "this suite declares as many tests as bats reached" {
  local pat='^[[:blank:]]*((@test[[:blank:]])|((function[[:blank:]]+)?[^[:blank:]()]+[[:blank:]]*\(\)[[:blank:]]+[{][[:blank:]]*#[[:blank:]]*@test))'
  declared="$(grep -cE "$pat" "$BATS_TEST_FILENAME")"
  registered=${#BATS_TEST_NAMES[@]}
  [ "$declared" -eq 11 ] || { echo "file declares $declared test(s); expected 11"; false; }
  [ "$registered" -eq "$declared" ] || {
    echo "file declares $declared test(s); bats registered $registered -- one was DROPPED"; false; }
  [ "$BATS_TEST_NUMBER" -eq "$declared" ] || {
    echo "file declares $declared test(s); bats reached $BATS_TEST_NUMBER"; false; }
  offenders="$(grep -E "$pat" "$BATS_TEST_FILENAME" | LC_ALL=C grep -c '[^ -~]' || true)"
  [ "$offenders" -eq 0 ] || { echo "$offenders test name(s) carry non-ASCII bytes"; false; }
}
