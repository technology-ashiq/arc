#!/usr/bin/env bats
# Phase 00 -- the index exists and is honest.
#
# Every fixture tree is COPIED into $BATS_TEST_TMPDIR before the builder runs: the builder writes
# `<root>/.claude/state/memory/index.json`, and pointing it at a tracked fixture would write
# derived state into tests/.
#
# The spine fixture is produced by the REAL emitter, so a receipt the validators would refuse can
# never quietly become index input. ARC_SPINE_ROOT is read by PRESENCE, not truthiness, so it is
# always given a real non-empty path -- ARC_SPINE_ROOT= is a recorded failure shape, not a no-op.
#
# @test names are ASCII-only: bats silently DROPS a test whose name carries a non-ASCII
# character, and five such tests once ran zero times while their file stayed green.
bats_require_minimum_version 1.5.0
load 'test_helper'

MEM="$ARC_ROOT/.claude/scripts/memory/memory-index.mjs"
EVENT="$ARC_ROOT/.claude/scripts/hq/arc-event.sh"
FIXTURES="$ARC_ROOT/tests/fixtures/memory"

setup() {
  SPINE="$BATS_TEST_TMPDIR/spine"
  mkdir -p "$SPINE"
  export ARC_SPINE_ROOT="$SPINE"
  export ARC_SPINE_NOW="1785000000000"
  export ARC_SPINE_RAND="00112233445566778899"
}

_tree() {
  cp -r "$FIXTURES/$1" "$BATS_TEST_TMPDIR/$1"
  echo "$BATS_TEST_TMPDIR/$1"
}

# Path + LF-normalized sha per file, .claude/state excluded. Used to prove memory wrote nothing
# outside its own derived directory.
_manifest_no_state() {
  ( cd "$1" && find . -type f -not -path './.claude/state/*' | LC_ALL=C sort | while IFS= read -r f; do
      printf '%s\t%s\n' "${f#./}" "$(tr -d '\r' < "$f" | _arc_sha256)"
    done )
}

@test "memory-index: the builder is present at its contracted path" {
  # Guards the invocation contract itself. Without this, a rename would fail every other test in
  # the file with MODULE_NOT_FOUND and the cause would be one level removed from the symptom.
  [ -f "$MEM" ]
}

@test "memory-index: the positive control parses every organ and every count matches" {
  tree="$(_tree organs-good)"
  run node "$MEM" --root "$tree" --rebuild
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # Positive assertions only: a crash satisfies any does-not-contain check.
  [[ "$output" == *"retro-log        3/3"* ]]
  [[ "$output" == *"trial-ledger     2/2"* ]]
  [[ "$output" == *"learning-ledger  1/1"* ]]
  [[ "$output" == *"adr              2/2"* ]]
  [[ "$output" == *"wrote .claude/state/memory/index.json"* ]]
  [ -f "$tree/.claude/state/memory/index.json" ]
}

@test "memory-index: a pipe inside a code span is data, not a separator" {
  # THE fixture of this phase. Fixture row 2 carries a literal pipe inside a code span. A naive
  # split reports it as a 6-field malformed row and walls off a genuine lesson -- while
  # N_parsed == N_indexed stays perfectly true throughout, because an excluded row sits OUTSIDE
  # N_parsed. So this asserts the CLASSIFICATION, which is the thing the count cannot see.
  tree="$(_tree organs-good)"
  run node "$MEM" --root "$tree" --rebuild
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"retro-log        3/3"* ]]
  [[ "$output" == *"0 malformed"* ]]
  grep -q 'retro:2026-01-01#2' "$tree/.claude/state/memory/index.json"
}

@test "memory-index: count-verify fails loudly when an organ under-parses" {
  # organs-53of54 removes one pattern row and leaves the expectation at 3. parsed and indexed
  # still agree with each other -- they agree on the WRONG number.
  tree="$(_tree organs-53of54)"
  run node "$MEM" --root "$tree" --rebuild
  [ "$status" -ne 0 ]
  [[ "$output" == *"expected 3 indexed record(s), got 2"* ]]
}

@test "memory-index: a dropped record fails even when no expectation covers that organ" {
  # organs-adr-collision ships two ADR files claiming the same number, so two parsed records
  # collapse onto one id. Not hypothetical: docs/retro-log.md records two sessions doing exactly
  # this on 2026-08-02, which is why the per-lane century bands exist. Its memory-expect.json
  # deliberately omits adr, so ONLY the N_parsed == N_indexed channel can catch it.
  tree="$(_tree organs-adr-collision)"
  run node "$MEM" --root "$tree" --rebuild
  [ "$status" -ne 0 ]
  [[ "$output" == *"N_parsed 2 != N_indexed 1"* ]]
}

@test "memory-index: every excluded row is named with its file and line" {
  tree="$(_tree organs-good)"
  run node "$MEM" --root "$tree" --rebuild
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"docs/retro-log.md:7  scoreboard row (9 fields)"* ]]
  [[ "$output" == *"docs/trial-ledger.md:4  table separator row"* ]]
  # The count is printed too, so "zero exclusions" and "exclusions never checked" cannot look
  # alike on screen.
  [[ "$output" == *"exclusions: 6 named, 0 malformed"* ]]
}

@test "memory-index: delete the index and rebuild yields an identical record set" {
  tree="$(_tree organs-good)"
  run node "$MEM" --root "$tree" --rebuild --dump-records
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  echo "$output" | sed -n '/--- records ---/,$p' > "$BATS_TEST_TMPDIR/first.txt"
  # A non-empty dump, or two empty files would compare equal and this would pass on nothing.
  [ "$(wc -l < "$BATS_TEST_TMPDIR/first.txt")" -gt 5 ]

  rm -r "$tree/.claude/state/memory"
  [ ! -f "$tree/.claude/state/memory/index.json" ]

  run node "$MEM" --root "$tree" --rebuild --dump-records
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  echo "$output" | sed -n '/--- records ---/,$p' > "$BATS_TEST_TMPDIR/second.txt"
  diff "$BATS_TEST_TMPDIR/first.txt" "$BATS_TEST_TMPDIR/second.txt"
}

@test "memory-index: an empty spine reports zero AND says which spine it read" {
  # A bare 0/0 cannot distinguish an empty spine from a spine that was never opened -- L-002
  # exactly. This phase shipped that bug and caught it: the builder was handing the reader the
  # REPO root instead of the SPINE root and reporting 0/0 on a spine it had never looked at.
  tree="$(_tree organs-good)"
  run node "$MEM" --root "$tree" --rebuild
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"decisions        0/0"* ]]
  [[ "$output" == *"reader returned 0 event(s) from"* ]]
}

@test "memory-index: a seeded decision is indexed with its reason byte-exact" {
  # decides must be the ULID of a real approval.requested: a decision cannot decide itself.
  approval="$(bash "$EVENT" emit approval.requested --strict --payload \
    '{"what":"seed for the memory decisions fixture","gate":"fixture"}')"
  [ -n "$approval" ]
  # Through arc-inbox, NOT a raw emit. decision.recorded carries a WELDED idem --
  # sha256("decision.recorded|" + decides) -- so that a decision naming a decoy approval cannot
  # pre-claim a real one's key and lock it open forever. A raw emit is refused with BAD_DECISION,
  # which is how CI found that this phase's own spec section C had the emit snippet wrong.
  run node "$ARC_ROOT/.claude/scripts/hq/arc-inbox.mjs" reject "$approval" \
    --reason "worktree mode B is not certified"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # Exit 0 from a writer is not evidence that anything was written. Look in BOTH places.
  [ -z "$(ls -A "$SPINE/events/_quarantine" 2>/dev/null)" ]
  [ -n "$(ls -A "$SPINE/events" 2>/dev/null)" ]

  tree="$(_tree organs-good)"
  run node "$MEM" --root "$tree" --rebuild
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"decisions        1/1"* ]]
  grep -q 'worktree mode B is not certified' "$tree/.claude/state/memory/index.json"
}

@test "memory-index: a tree missing an organ says so instead of miscounting" {
  tree="$(_tree organs-good)"
  rm "$tree/docs/trial-ledger.md"
  run node "$MEM" --root "$tree" --rebuild
  [ "$status" -ne 0 ]
  [[ "$output" == *"not found"* ]]
  [[ "$output" == *"trial-ledger"* ]]
}

@test "memory-index: the staleness manifest notices a changed organ" {
  tree="$(_tree organs-good)"
  run node "$MEM" --root "$tree" --rebuild
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run node "$MEM" --root "$tree" --status
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"stale: no"* ]]

  printf '2026-01-03 | fixture | a fourth pattern | a fourth prevention | delta\n' >> "$tree/docs/retro-log.md"
  run node "$MEM" --root "$tree" --status
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"stale: YES"* ]]
  [[ "$output" == *"docs/retro-log.md changed"* ]]
}

@test "memory-index: memory writes nothing outside its own state directory" {
  tree="$(_tree organs-good)"
  before="$(_manifest_no_state "$tree")"
  [ -n "$before" ]
  run node "$MEM" --root "$tree" --rebuild
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  after="$(_manifest_no_state "$tree")"
  [ "$before" = "$after" ]
}

@test "memory-index: the golden query set carries no unresolved placeholder" {
  # ADR-0706: the set is committed before the thing it grades, with placeholders for the
  # content-positional ids. A leftover placeholder must FAIL rather than silently skip a row.
  file="$FIXTURES/golden-queries.tsv"
  [ -f "$file" ]
  rows="$(grep -cv '^#' "$file")"
  [ "$rows" -eq 12 ]
  run grep -v '^#' "$file"
  [ "$status" -eq 0 ]
  [[ "$output" != *"unresolved:"* ]]
  # every data row carries exactly four tab-separated columns
  cols="$(grep -v '^#' "$file" | awk -F'\t' '{print NF}' | LC_ALL=C sort -u)"
  [ "$cols" = "4" ]
}

@test "memory-index: this suite registers the number of tests it claims" {
  # bats silently DROPS a @test whose name carries a non-ASCII character. A suite running fewer
  # tests than it declares is indistinguishable from a suite that passes, and the only signal is
  # the count.
  count="$(grep -c '^@test ' "$BATS_TEST_FILENAME")"
  [ "$count" -eq 14 ]
}
