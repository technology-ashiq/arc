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
# EVERY REFUSAL NAMES ITSELF. The refusal tests originally asserted `status -eq 2` and an EMPTY
# stdout and nothing else -- which is the absence-assertion this header condemns four lines up,
# wearing an exit code as its disguise. An adversarial pass replaced every refusal branch in the
# command with a crash and killed NONE of the eleven tests, because two of the refusals reach
# exit 2 only through the catch-all `die(2, e.message)` that any unexpected exception also takes.
# So each refusal now pins a SUBSTRING OF ITS OWN MESSAGE on stderr: the assertion fails when the
# wrong refusal fires, and fails when no refusal fires and something merely died.
#
# AND THE ARGUMENT SURFACE IS A SURFACE. Neutralising all five of `cmdReport`s flag refusals
# killed zero tests, so `--campaign pilot --campaign other` silently last-won -- the exact
# resolution `.claude/rules/lanes.md` forbids by name, in the command that answers whether a real
# cold send happened. Five tests below, one per branch.
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

# A raw day-file line, for the shapes the emitter refuses to write and the field still holds.
# `$1` is the ULID, `$2` the campaign JSON value, `$3` the submitted_at, `$4` the rehearsal JSON
# value, `$5` the supersedes JSON value. Written straight to a day file for the same reason
# `_unmarked_receipt` is: an older build, a foreign writer or a correction put it there, and the
# reader is what has to survive it.
_raw_receipt() {
  mkdir -p "$ARC_SPINE_ROOT/events"
  printf '%s\n' "{\"id\":\"$1\",\"v\":1,\"ts\":\"2026-08-04T19:00:00+05:30\",\"idem\":\"$ZERO64\",\"actor\":\"arc-leads\",\"process\":\"leads@0.9.0\",\"model\":null,\"venture\":\"arc\",\"run_id\":\"r-raw\",\"kind\":\"outreach.sent\",\"payload\":{\"lead_id\":\"lead_hmac_v1_cccccccccccccccccccccccccccccccc\",\"campaign\":$2,\"touch_n\":1,\"idem_key\":\"kraw$1\",\"provider_message_id\":\"mraw$1\",\"submitted_at\":\"$3\",\"draft_sha\":\"$SHA64\",\"rehearsal\":$4},\"outcome\":\"ok\",\"cost\":null,\"evidence\":null,\"supersedes\":$5,\"sha\":\"$ZERO64\"}" \
    >> "$ARC_SPINE_ROOT/events/2026-08-04.jsonl"
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

# One TOP-LEVEL field out, as compact JSON, so a test can assert on a field that is deliberately
# not a number -- `sends: null` is the whole point of the missing-spine case, and `_field` would
# throw on it rather than read it.
_top() {   # field-name, JSON on stdin
  node -e 'let s = ""; process.stdin.on("data", (d) => { s += d; }).on("end", () => {
    const o = JSON.parse(s); process.stdout.write(JSON.stringify(o[process.argv[1]])); });' "$1"
}

# ONE number out of ONE campaign, and the key must be the campaign's OWN. `hasOwnProperty` is the
# assertion, not a convenience: `campaigns.__proto__` resolved to Object.prototype on the old
# shape, which is truthy and non-null, so a lookup that merely checked for a value would read the
# prototype back and call the bug a pass.
_campaign_field() {   # campaign-name, field-name (submitted|replied|sends_total), JSON on stdin
  node -e 'let s = ""; process.stdin.on("data", (d) => { s += d; }).on("end", () => {
    const o = JSON.parse(s); const name = process.argv[1], key = process.argv[2];
    if (!Object.prototype.hasOwnProperty.call(o.campaigns, name)) {
      process.stderr.write("campaigns has no OWN key " + JSON.stringify(name)); process.exit(1); }
    const c = o.campaigns[name];
    const v = key === "sends_total" ? c.sends.total : c[key];
    if (typeof v !== "number") { process.stderr.write(name + "." + key + " is not a number"); process.exit(1); }
    process.stdout.write(String(v)); });' "$1" "$2"
}

# Whether `campaigns` carries an OWN key of that name at all -- prints 1 or 0, never empty, so the
# comparison below is an integer one and a crashed state command is an error rather than a pass.
_has_campaign() {   # campaign-name, JSON on stdin
  node -e 'let s = ""; process.stdin.on("data", (d) => { s += d; }).on("end", () => {
    const o = JSON.parse(s);
    process.stdout.write(Object.prototype.hasOwnProperty.call(o.campaigns, process.argv[1]) ? "1" : "0"); });' "$1"
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
    # WHICH refusal, and it says `report.--from` rather than `sendCounts.from`. The surface-level
    # `assertTs` call carries a three-line comment justifying its duplication -- "so the operator
    # sees their own spelling" -- and deleting BOTH calls killed none of these tests, because the
    # counter validates the same bounds one layer down and refuses with its own parameter names.
    # This is the assertion that makes the duplicated call load-bearing instead of decorative.
    [[ "$stderr" == *'report.--from'* ]] || { echo "from=$w refused with the wrong voice: $stderr"; false; }
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
  [[ "$stderr" == *"an inverted window matches no receipt"* ]] || { echo "wrong refusal: $stderr"; false; }
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
    [[ "$stderr" == *"carries campaign"* ]] || { echo "campaign=$c refused for another reason: $stderr"; false; }
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
  [[ "$stderr" == *"does not exist"* ]] || { echo "wrong refusal: $stderr"; false; }
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
  for f in rehearsal real unmarked unplaceable total; do
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
  for f in rehearsal real unmarked unplaceable total; do
    j="$(printf '%s' "$output" | _field "$f")"
    h="$(printf '%s\n' "$human" | awk -v k="$f" '$1 == k { print $2 }')"
    [ "$h" -eq "$j" ] || { echo "$f: printed=$h json=$j"; false; }
  done
  # Pinned so a human surface that printed four zeros could not agree its way to a pass.
  h="$(printf '%s\n' "$human" | awk '$1 == "total" { print $2 }')"
  [ "$h" -eq 7 ] || { echo "printed total=$h (expected 7)"; false; }
}

# ---------- the reads that answered zero from having read nothing ----------

# THE SPINE THAT WAS NEVER NAMED. `spineRoot()` tested `process.env.ARC_SPINE_ROOT` for TRUTH, so
# an empty value -- what `--spine-root "$UNSET"` expands to, and the unquoted-empty-value failure
# `.claude/rules/lanes.md` records -- fell through to walking up from cwd and read the REPO's own
# spine. Reproduced: five rehearsal receipts on the named spine, and the report answered from a
# different one at exit 0. The refusal covered "does not exist" and never covered "was never
# named", and answering confidently out of the wrong file is the worse of the two.
@test "a spine root that was never named refuses instead of reading another spine" {
  _spine_rehearsal_only
  ARC_SPINE_ROOT="" run --separate-stderr _report
  [ "$status" -eq 2 ] || { echo "status=$status (expected 2)"; false; }
  [ -z "$output" ] || { echo "an unnamed spine root printed a count: $output"; false; }
  [[ "$stderr" == *"set but empty"* ]] || { echo "wrong refusal: $stderr"; false; }
  run --separate-stderr _report
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  n="$(printf '%s' "$output" | _field rehearsal)"
  [ "$n" -eq 5 ] || { echo "rehearsal=$n (expected 5)"; false; }
}

# AN EMPTY events/ IS THE SAME ZERO AS A MISSING ONE, and only the missing one was guarded. The
# directory exists the moment anything takes the write lock, so this is a real field state and it
# returned `[]` -- `real: 0`, exit 0 -- from a spine that had recorded nothing at all.
@test "an events directory holding no day file refuses instead of answering zero" {
  mkdir -p "$ARC_SPINE_ROOT/events"
  [ -d "$ARC_SPINE_ROOT/events" ]
  run --separate-stderr _report --from "$FROM" --to "$TO"
  [ "$status" -eq 2 ] || { echo "status=$status (expected 2)"; false; }
  [ -z "$output" ] || { echo "an empty events dir printed a count: $output"; false; }
  [[ "$stderr" == *"holds no day file"* ]] || { echo "wrong refusal: $stderr"; false; }
  _spine_rehearsal_only
  run --separate-stderr _report --from "$FROM" --to "$TO"
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  n="$(printf '%s' "$output" | _field rehearsal)"
  [ "$n" -eq 5 ] || { echo "rehearsal=$n (expected 5)"; false; }
}

# A FILENAME IS NOT A REASON TO SKIP A FILE. The listing was `readdirSync(...).filter(DAY_RE)`,
# which DISCARDED every non-match in silence -- one line from the missing-directory guard and one
# from the unreadable-file guard, both of which refuse. A `.jsonl.orig` left by a merge or a
# restore therefore hid a real send: the line was physically on disk and the report said zero.
# The positive control is the other half of the fix -- the three entries spine-io itself creates
# are known and skipped, so a closed day or a quarantine directory must NOT refuse.
@test "a file in the events directory that is not a day file refuses" {
  _spine_rehearsal_only
  cp "$ARC_SPINE_ROOT"/events/*.jsonl "$ARC_SPINE_ROOT/events/restored.jsonl.orig"
  [ -s "$ARC_SPINE_ROOT/events/restored.jsonl.orig" ]
  run --separate-stderr _report --campaign pilot --from "$FROM" --to "$TO"
  [ "$status" -eq 2 ] || { echo "status=$status (expected 2)"; false; }
  [ -z "$output" ] || { echo "an unclassifiable events entry printed a count: $output"; false; }
  [[ "$stderr" == *"neither a day file nor a known marker"* ]] || { echo "wrong refusal: $stderr"; false; }
  rm "$ARC_SPINE_ROOT/events/restored.jsonl.orig"
  : > "$ARC_SPINE_ROOT/events/2026-08-04.closed"
  mkdir -p "$ARC_SPINE_ROOT/events/_quarantine"
  run --separate-stderr _report --campaign pilot --from "$FROM" --to "$TO"
  [ "$status" -eq 0 ] || { echo "a known marker was treated as unclassifiable: $stderr"; false; }
  n="$(printf '%s' "$output" | _field rehearsal)"
  [ "$n" -eq 5 ] || { echo "rehearsal=$n (expected 5)"; false; }
}

# `42`, `null` and `[]` are valid JSON and none of them is an event. They were PUSHED, then read
# as an event with no `kind` -- dropped from every count with none of the `path:lineNo` diagnostic
# the JSON-parse branch directly above them provides.
@test "a day file line that is not an event object refuses and names the line" {
  _spine_rehearsal_only
  mkdir -p "$ARC_SPINE_ROOT/events"
  printf '%s\n' '42' > "$ARC_SPINE_ROOT/events/2026-08-04.jsonl"
  run --separate-stderr _report
  [ "$status" -eq 2 ] || { echo "status=$status (expected 2)"; false; }
  [ -z "$output" ] || { echo "a non-event line printed a count: $output"; false; }
  [[ "$stderr" == *"2026-08-04.jsonl:1"* ]] || { echo "the refusal did not name the line: $stderr"; false; }
}

# THE RECEIPT NOBODY HAS EVER READ. `readAllEvents` reads `events/*.jsonl`; nothing under
# `.claude/scripts/leads/` has ever opened `events/_quarantine/`. The emitter quarantines-and-
# exits-0, so a REAL send whose receipt was rejected -- one unknown payload key is enough -- left
# `real: 0` at exit 0 with the send sitting in a file beside it. That is the zero that means "I
# could not look", which is the one thing this reporter exists not to say.
@test "a quarantined receipt refuses instead of a count that could not see it" {
  _spine_rehearsal_only
  run env ARC_LEADS_FAKE=1 bash "$ARC_ROOT/.claude/scripts/hq/arc-event.sh" emit outreach.sent \
    --payload "{\"lead_id\":\"lead_hmac_v1_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb9\",\"campaign\":\"pilot\",\"touch_n\":1,\"idem_key\":\"kq\",\"provider_message_id\":\"mq\",\"submitted_at\":\"2026-08-04T18:00:00+05:30\",\"draft_sha\":\"$SHA64\",\"rehearsal\":false,\"surprise\":1}" \
    --actor arc-leads
  # The emitter EXITS 0 on it. That is the whole reason the report has to look: nothing upstream
  # of here reports a problem, and the fixture asserts both halves rather than assuming them.
  [ "$status" -eq 0 ] || { echo "the emitter did not exit 0 on a quarantined receipt: $status"; false; }
  [ -n "$(ls "$ARC_SPINE_ROOT/events/_quarantine" 2>/dev/null)" ] || { echo "nothing was quarantined; the fixture built nothing"; false; }
  run --separate-stderr _report --campaign pilot --from "$FROM" --to "$TO"
  [ "$status" -eq 2 ] || { echo "status=$status (expected 2)"; false; }
  [ -z "$output" ] || { echo "a spine with a quarantined receipt printed a count: $output"; false; }
  [[ "$stderr" == *"spine quarantine"* ]] || { echo "wrong refusal: $stderr"; false; }
  rm -rf "$ARC_SPINE_ROOT/events/_quarantine"
  run --separate-stderr _report --campaign pilot --from "$FROM" --to "$TO"
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  n="$(printf '%s' "$output" | _field rehearsal)"
  [ "$n" -eq 5 ] || { echo "rehearsal=$n (expected 5)"; false; }
}

# ---------- the counts themselves, each pinned against a mutant that survived ----------

# THE BOUNDS WERE VALIDATED AND THE PAYLOADS THEY ARE COMPARED AGAINST WERE NOT. `sendCounts` ran
# `assertTs` on the window and tested the receipt stamp with an 11-character PREFIX, then compared
# the two as strings -- so `2026-08-04T04:00:00Z`, a real send at 09:30 IST, passed the prefix
# test, sorted after every `+05:30` stamp because `Z` > `+`, and was EXCLUDED from the 09:00-10:00
# IST window that contains it: `real: 0` for a window holding one real cold send.
#
# The stamp is now judged by the payload grammar, so it is UNPLACEABLE: counted in every window
# (an unplaceable receipt must not escape the count by being unreadable) and reported on its own
# axis, because a window whose counts silently include receipts it could not place had no field
# that said so.
@test "a stamp that is not the pinned spelling is unplaceable, counted and named" {
  _spine_rehearsal_only
  _raw_receipt 01KZK97CXRN728PDA7BAX44091 '"pilot"' "2026-08-04T04:00:00Z" false null
  run --separate-stderr _report --campaign pilot --from "2026-08-04T09:00:00+05:30" --to "2026-08-04T10:00:00+05:30"
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  real="$(printf '%s' "$output" | _field real)"
  unplaceable="$(printf '%s' "$output" | _field unplaceable)"
  rehearsal="$(printf '%s' "$output" | _field rehearsal)"
  [ "$real" -eq 1 ] || { echo "real=$real (expected 1) -- the window that contains it answered zero"; false; }
  [ "$unplaceable" -eq 1 ] || { echo "unplaceable=$unplaceable (expected 1)"; false; }
  [ "$rehearsal" -eq 0 ] || { echo "rehearsal=$rehearsal (expected 0)"; false; }
  # The pinned-spelling receipts in the same spine are NOT unplaceable, or the axis would just be
  # a second name for the send count.
  run --separate-stderr _report --campaign pilot --from "$FROM" --to "$TO"
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  u="$(printf '%s' "$output" | _field unplaceable)"
  t="$(printf '%s' "$output" | _field total)"
  [ "$u" -eq 1 ] || { echo "unplaceable=$u (expected 1) over six receipts, five of them pinned"; false; }
  [ "$t" -eq 6 ] || { echo "total=$t (expected 6)"; false; }
  # And the human surface names it, or an operator reads a count with no way to know.
  run --separate-stderr _report_human --campaign pilot --from "$FROM" --to "$TO"
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  h="$(printf '%s\n' "$output" | awk '$1 == "unplaceable" { print $2 }')"
  [ "$h" -eq 1 ] || { echo "printed unplaceable=$h (expected 1)"; false; }
}

# `at < from` mutated to `at <= from` SURVIVED: nothing pinned whether `--from` is inclusive,
# while the `to` end was pinned by the narrow-window test. A bound half the operators would read
# as inclusive and half as exclusive decides whether one send is in the claim or outside it.
@test "the from bound includes a receipt stamped exactly on it" {
  _spine_rehearsal_only
  run --separate-stderr _report --campaign pilot --from "2026-08-04T15:00:00+05:30" --to "$TO"
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  n="$(printf '%s' "$output" | _field rehearsal)"
  t="$(printf '%s' "$output" | _field total)"
  [ "$n" -eq 1 ] || { echo "rehearsal=$n (expected 1) -- the receipt stamped exactly on --from"; false; }
  [ "$t" -eq 1 ] || { echo "total=$t (expected 1)"; false; }
}

# `p.campaign !== campaign` mutated to `startsWith` SURVIVED: the only campaign test exercised the
# SURFACE refusal, which fires before `sendCounts` is ever called, so the match rule inside the
# counter had no test at all. Two names where one is a prefix of the other is the negative control
# that mutant cannot pass.
@test "a campaign whose name is a prefix of another counts only its own" {
  _receipt 1 true "2026-08-04T11:00:00+05:30" pilot
  _receipt 2 false "2026-08-04T12:00:00+05:30" pilot-b
  _receipt 3 false "2026-08-04T13:00:00+05:30" pilot-b
  [ "$(cat "$ARC_SPINE_ROOT"/events/*.jsonl | grep -c 'outreach.sent')" -eq 3 ]
  run --separate-stderr _report --campaign pilot --from "$FROM" --to "$TO"
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  t="$(printf '%s' "$output" | _field total)"
  r="$(printf '%s' "$output" | _field real)"
  [ "$t" -eq 1 ] || { echo "campaign pilot total=$t (expected 1) -- pilot-b leaked into it"; false; }
  [ "$r" -eq 0 ] || { echo "campaign pilot real=$r (expected 0)"; false; }
  run --separate-stderr _report --campaign pilot-b --from "$FROM" --to "$TO"
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  t="$(printf '%s' "$output" | _field total)"
  [ "$t" -eq 2 ] || { echo "campaign pilot-b total=$t (expected 2)"; false; }
}

# Adding `|| e.outcome !== "ok"` to the kind test SURVIVED, because nothing pinned that every
# `outreach.sent` counts whatever its envelope says. The emitter accepts `--outcome partial`, and
# a partial send is a mail that left the building: dropping it from the count would delete a real
# send from the number that claims none happened.
@test "an outreach sent receipt counts whatever its envelope outcome" {
  _spine_rehearsal_only
  ARC_LEADS_FAKE=1 bash "$ARC_ROOT/.claude/scripts/hq/arc-event.sh" emit outreach.sent \
    --payload "{\"lead_id\":\"lead_hmac_v1_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb8\",\"campaign\":\"pilot\",\"touch_n\":1,\"idem_key\":\"kp\",\"provider_message_id\":\"mp\",\"submitted_at\":\"2026-08-04T18:00:00+05:30\",\"draft_sha\":\"$SHA64\",\"rehearsal\":false}" \
    --outcome partial --strict --actor arc-leads >/dev/null
  [ "$(cat "$ARC_SPINE_ROOT"/events/*.jsonl | grep -c '"outcome":"partial"')" -eq 1 ]
  run --separate-stderr _report --campaign pilot --from "$FROM" --to "$TO"
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  r="$(printf '%s' "$output" | _field real)"
  t="$(printf '%s' "$output" | _field total)"
  [ "$r" -eq 1 ] || { echo "real=$r (expected 1) -- a partial-outcome send left the count"; false; }
  [ "$t" -eq 6 ] || { echo "total=$t (expected 6)"; false; }
}

# ONE PHYSICAL SEND MAY NOT APPEAR IN TWO CLASSES, and `supersedes` was ignored entirely -- so a
# correction reclassifying a send rehearsal-to-real left the superseded original counted beside
# its own replacement. Reproduced: six rehearsals and one real out of five rehearsals and one
# corrected send. Resolving a supersedes chain is a fold-shaped change and is not being invented
# inside a fix commit, so the reporter refuses and names the pair.
@test "a correction that supersedes a counted send refuses instead of double counting" {
  _spine_rehearsal_only
  _raw_receipt 01KZK97CXRN728PDA7BAX44092 '"pilot"' "2026-08-04T18:00:00+05:30" false null
  _raw_receipt 01KZK97CXRN728PDA7BAX44093 '"pilot"' "2026-08-04T18:00:00+05:30" true '"01KZK97CXRN728PDA7BAX44092"'
  [ "$(cat "$ARC_SPINE_ROOT"/events/*.jsonl | grep -c 'outreach.sent')" -eq 7 ]
  run --separate-stderr _report --campaign pilot --from "$FROM" --to "$TO"
  [ "$status" -eq 2 ] || { echo "status=$status (expected 2)"; false; }
  [ -z "$output" ] || { echo "a superseded send was counted: $output"; false; }
  [[ "$stderr" == *"supersede an outreach.sent inside this window"* ]] || { echo "wrong refusal: $stderr"; false; }
  # A window that holds neither the original nor its correction still answers, or the refusal is
  # just a reporter that stopped working once any correction existed anywhere on the spine.
  run --separate-stderr _report --campaign pilot --from "2026-08-04T11:00:00+05:30" --to "2026-08-04T12:00:00+05:30"
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  n="$(printf '%s' "$output" | _field rehearsal)"
  [ "$n" -eq 2 ] || { echo "rehearsal=$n (expected 2)"; false; }
}

# ---------- state, the other configuration of the same reader ----------

# D5 (a): ONE READER, TWO CONFIGURATIONS, and the unguarded one published the safety number.
# `report` refuses a spine that does not exist while `state --json` printed `sends: {0,0,0,0}` at
# exit 0 under the key its own comment calls "ADR-0416's mixing guard, reported as a COUNT".
# `state` may not refuse -- a fresh install legitimately knows nothing -- so it says so in the
# field instead of answering zero.
@test "state publishes no send counts when it read no day file" {
  [ ! -d "$ARC_SPINE_ROOT/events" ]
  run --separate-stderr _state
  [ "$status" -eq 0 ] || { echo "state refused a fresh install: $stderr"; false; }
  s="$(printf '%s' "$output" | _top sends)"
  [ "$s" = "null" ] || { echo "state published sends=$s over a spine it never read"; false; }
  u="$(printf '%s' "$output" | _top sends_unavailable)"
  [ "$u" != "null" ] || { echo "sends was withheld with no reason given"; false; }
  # And the moment there IS a day to read, the counts come back -- or "null" is just a reporter
  # that stopped answering.
  _spine_rehearsal_only
  run --separate-stderr _state
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  n="$(printf '%s' "$output" | _field rehearsal)"
  [ "$n" -eq 5 ] || { echo "rehearsal=$n (expected 5)"; false; }
}

# D5 (b), and row 8 of the carried-forward table: `cmdState` folded `outreach.sent` TWICE over one
# event list -- once by hand into `campaigns[k].submitted`, once through `sendCounts` -- so two
# numbers about one set were free to disagree. They did: a receipt whose `campaign` is absent
# produced `campaigns.undefined` with `submitted: 1` sitting beside its own `sends.total: 0`, two
# derivations disagreeing inside ONE printed object. `submitted` is now the fold's own total, and
# the campaign map is keyed off the same string-filtered set the report resolves `--campaign`
# against, so a receipt with no name is counted globally and never invented as a campaign.
@test "state derives a campaign submitted count from the same fold it prints" {
  _spine_rehearsal_only
  _raw_receipt 01KZK97CXRN728PDA7BAX44090 null "2026-08-04T19:00:00+05:30" false null
  run --separate-stderr _state
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  sub="$(printf '%s' "$output" | _campaign_field pilot submitted)"
  tot="$(printf '%s' "$output" | _campaign_field pilot sends_total)"
  [ "$sub" -eq "$tot" ] || { echo "pilot submitted=$sub sends.total=$tot -- two derivations of one number"; false; }
  [ "$sub" -eq 5 ] || { echo "pilot submitted=$sub (expected 5) -- the agreement above was between two zeros"; false; }
  # Both spellings the raw key coercion produces: `campaigns[undefined]` keys "undefined" and
  # `campaigns[null]` keys "null", and either one is a campaign the system invented out of a
  # receipt that never named one -- published with `submitted: 1` beside its own `sends.total: 0`.
  for ghost in null undefined; do
    has="$(printf '%s' "$output" | _has_campaign "$ghost")"
    [ "$has" -eq 0 ] || { echo "a receipt with no campaign was published as campaign $ghost"; false; }
  done
  # It is still COUNTED, or the fix would be a second way to lose a real send.
  g="$(printf '%s' "$output" | _field total)"
  [ "$g" -eq 6 ] || { echo "global total=$g (expected 6) -- the unnamed receipt fell out of the count"; false; }
}

# `(campaigns[p.campaign] ||= { replied: 0, submitted: 0 }).submitted += 1` on a receipt naming
# `__proto__` resolved to Object.prototype -- truthy, so `||=` never assigned -- wrote NaN onto
# the prototype of every object in the process, and the campaign vanished from `Object.keys` and
# from the printed report. Reproduced: `campaign keys: []` beside `sends.total: 1`.
@test "a campaign named after a prototype key is an own key with its own count" {
  _raw_receipt 01KZK97CXRN728PDA7BAX44094 '"__proto__"' "2026-08-04T19:00:00+05:30" false null
  run --separate-stderr _state
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  sub="$(printf '%s' "$output" | _campaign_field __proto__ submitted)"
  tot="$(printf '%s' "$output" | _campaign_field __proto__ sends_total)"
  [ "$sub" -eq 1 ] || { echo "__proto__ submitted=$sub (expected 1)"; false; }
  [ "$tot" -eq 1 ] || { echo "__proto__ sends.total=$tot (expected 1)"; false; }
  g="$(printf '%s' "$output" | _field total)"
  [ "$g" -eq 1 ] || { echo "global total=$g (expected 1)"; false; }
}

# ---------- the argument surface, which had no test at all ----------
#
# Neutralising all five refusals below killed ZERO tests. Each one is its own `@test` rather than
# a loop, so a branch that stops refusing is one named failure rather than a loop that dies on its
# first iteration and hides the other four.

@test "the same flag given twice refuses" {
  _spine_rehearsal_only
  run --separate-stderr _report --campaign pilot --campaign other
  [ "$status" -eq 2 ] || { echo "status=$status (expected 2)"; false; }
  [ -z "$output" ] || { echo "a duplicated flag printed a count: $output"; false; }
  [[ "$stderr" == *"given twice"* ]] || { echo "wrong refusal: $stderr"; false; }
}

@test "an unknown flag refuses" {
  _spine_rehearsal_only
  run --separate-stderr _report --campaign pilot --since "$FROM"
  [ "$status" -eq 2 ] || { echo "status=$status (expected 2)"; false; }
  [ -z "$output" ] || { echo "an unknown flag printed a count: $output"; false; }
  [[ "$stderr" == *"unknown flag --since"* ]] || { echo "wrong refusal: $stderr"; false; }
}

@test "a positional argument refuses" {
  _spine_rehearsal_only
  run --separate-stderr _report pilot
  [ "$status" -eq 2 ] || { echo "status=$status (expected 2)"; false; }
  [ -z "$output" ] || { echo "a bare positional printed a count: $output"; false; }
  [[ "$stderr" == *"no positional argument"* ]] || { echo "wrong refusal: $stderr"; false; }
}

@test "a flag with no value refuses" {
  _spine_rehearsal_only
  run --separate-stderr _report --campaign pilot --from
  [ "$status" -eq 2 ] || { echo "status=$status (expected 2)"; false; }
  [ -z "$output" ] || { echo "a valueless flag printed a count: $output"; false; }
  [[ "$stderr" == *"--from needs a value"* ]] || { echo "wrong refusal: $stderr"; false; }
}

# The one with a positive control attached, because the refusal has an escape hatch and a refusal
# whose escape hatch does not work is just a refusal.
@test "a flag whose value looks like a flag refuses and names the escape" {
  _spine_rehearsal_only
  run --separate-stderr _report --from --to "$TO"
  [ "$status" -eq 2 ] || { echo "status=$status (expected 2)"; false; }
  [ -z "$output" ] || { echo "a flag-shaped value printed a count: $output"; false; }
  [[ "$stderr" == *"--from needs a value"* ]] || { echo "wrong refusal: $stderr"; false; }
  run --separate-stderr _report --from="$FROM" --to="$TO"
  [ "$status" -eq 0 ] || { echo "the documented equals form did not work: $stderr"; false; }
  n="$(printf '%s' "$output" | _field rehearsal)"
  [ "$n" -eq 5 ] || { echo "rehearsal=$n (expected 5)"; false; }
}

# LAST on purpose: BATS_TEST_NUMBER is then the count bats registered AND REACHED, so comparing
# it against what the file declares catches a declared test that never ran. The grep covers the
# comment form of a `@test` too -- bats registers a shell function whose opening brace is
# followed by a `# @test` marker, and a plain `^@test ` grep cannot see one, which makes it
# blind to exactly the test it exists to notice. `[{]` rather than a backslash-escaped brace: a
# brace after `.*` reads as an interval bound to some ERE engines.
#
# The BATS_TEST_NUMBER cross-check assumes the whole file runs. `bats --filter` counts tests RUN,
# not file position, so filtering to a subset makes this test fail on a suite that is perfectly
# healthy. Latent today -- CI runs whole files, never a filter -- and the note is here so the
# first person to reach for `--filter` reads why it reddens rather than chasing it.
@test "this suite declares as many tests as bats reached" {
  local pat='^[[:blank:]]*((@test[[:blank:]])|((function[[:blank:]]+)?[^[:blank:]()]+[[:blank:]]*\(\)[[:blank:]]+[{][[:blank:]]*#[[:blank:]]*@test))'
  declared="$(grep -cE "$pat" "$BATS_TEST_FILENAME")"
  registered=${#BATS_TEST_NAMES[@]}
  [ "$declared" -eq 29 ] || { echo "file declares $declared test(s); expected 29"; false; }
  [ "$registered" -eq "$declared" ] || {
    echo "file declares $declared test(s); bats registered $registered -- one was DROPPED"; false; }
  [ "$BATS_TEST_NUMBER" -eq "$declared" ] || {
    echo "file declares $declared test(s); bats reached $BATS_TEST_NUMBER"; false; }
  offenders="$(grep -E "$pat" "$BATS_TEST_FILENAME" | LC_ALL=C grep -c '[^ -~]' || true)"
  [ "$offenders" -eq 0 ] || { echo "$offenders test name(s) carry non-ASCII bytes"; false; }
}
