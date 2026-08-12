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
# Roughly half the tests below exist because two fresh adversarial agents (ADR-0708) walked past
# the first version of this module: every test whose comment names a defect is a regression test
# for a hole that was real, reachable and reported nothing.
#
# @test names are ASCII-only: bats silently DROPS a test whose name carries a non-ASCII character,
# and five such tests once ran zero times while their file stayed green.
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

# Path + LF-normalized sha per file, .claude/state excluded. Proves memory wrote nothing outside
# its own derived directory.
_manifest_no_state() {
  ( cd "$1" && find . -type f -not -path './.claude/state/*' | LC_ALL=C sort | while IFS= read -r f; do
      printf '%s\t%s\n' "${f#./}" "$(tr -d '\r' < "$f" | _arc_sha256)"
    done )
}

# ---------- the module does what it says ----------

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

@test "memory-index: a comma inside a code span is data too" {
  # The twin-fix this lane's own pre-mortem predicted, found by a fresh agent: the pipe split was
  # masked and the tag split one line below it was not, so a tag list containing a code span was
  # shredded into fragments. A fix is not applied until it is attacked where it was never made.
  tree="$(_tree organs-good)"
  rm "$tree/memory-expect.json"   # this test adds a row on purpose; the pinned counts are not what it checks
  printf '2026-02-01 | fixture | tags with a code span | prevent it | shell, `sed -i, awk`, parsing\n' >> "$tree/docs/retro-log.md"
  run node "$MEM" --root "$tree" --rebuild
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  grep -q '"shell","`sed -i, awk`","parsing"' "$tree/.claude/state/memory/index.json"
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

# ---------- nothing is silently dropped ----------

@test "memory-index: a piped row that is not a lesson is NAMED, never skipped" {
  # The worst hole the adversarial pass found. The leading-date regex was a FILTER, so anything it
  # rejected was skipped with no record AND no exclusion: markdown's own pipe escape, one leading
  # space, a one-digit day, a row written as a table -- each vanished at 53 records, 0 exclusions,
  # exit 0, with N_parsed == N_indexed perfectly true. That is the "54 lessons or 53 plus a lie"
  # this module exists to prevent, reached by a route the masking rule does not cover.
  tree="$(_tree organs-good)"
  printf '2026-02-02 \\| fixture \\| an escaped-pipe lesson \\| its prevention \\| tag\n' >> "$tree/docs/retro-log.md"
  printf '  2026-02-03 | fixture | a leading-space lesson | its prevention | tag\n' >> "$tree/docs/retro-log.md"
  printf '2026-2-4 | fixture | a one-digit-day lesson | its prevention | tag\n' >> "$tree/docs/retro-log.md"
  run node "$MEM" --root "$tree" --rebuild
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # still 3 lessons, but the three rejects are now NAMED and counted as malformed
  [[ "$output" == *"retro-log        3/3"* ]]
  [[ "$output" == *"3 malformed"* ]]
  [[ "$output" == *"does not begin with a YYYY-MM-DD date"* ]]
}

@test "memory-index: a documented example inside a code fence is not evidence" {
  # These organs are markdown written by this repo ABOUT its own formats, so a fenced example row
  # is the normal case, not an exotic one. Before fence tracking it was indexed as a recorded run.
  tree="$(_tree organs-good)"
  printf '\n```\n| 2026-03-01 | example-gate | run-000 | yes | no |\n```\n' >> "$tree/docs/trial-ledger.md"
  run node "$MEM" --root "$tree" --rebuild
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"trial-ledger     2/2"* ]]
  [[ "$output" == *"inside a fenced code block"* ]]
}

@test "memory-index: an ADR the glob would skip is named rather than made invisible" {
  # Case-sensitive, non-recursive globbing put a whole class of ADR in neither the index nor any
  # other list -- and on the case-insensitive windows and macOS filesystems `.MD` and `.md` are
  # the same name to the OS, so only one of a pair was indexed.
  tree="$(_tree organs-good)"
  rm "$tree/memory-expect.json"   # this test adds an ADR on purpose
  printf '# ADR 0902 -- shouty\n\n**Status:** accepted\n\nBody.\n' > "$tree/docs/adr/0902-shouty.MD"
  mkdir -p "$tree/docs/adr/archive"
  run node "$MEM" --root "$tree" --rebuild
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"adr              3/3"* ]]
  [[ "$output" == *"is a directory"* ]]
}

# ---------- the two count channels ----------

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

@test "memory-index: an organ that empties is refused" {
  # N_parsed == N_indexed is satisfied by 0 == 0, and the live tree pins no absolute counts, so
  # without this there is NO channel at all that notices an emptied, truncated or re-encoded organ
  # on the real run -- which is the DoD's own live-demo command.
  tree="$(_tree organs-good)"
  run node "$MEM" --root "$tree" --rebuild
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  : > "$tree/docs/retro-log.md"
  run node "$MEM" --root "$tree" --rebuild
  [ "$status" -ne 0 ]
  [[ "$output" == *"had 3 record(s) in the previous index and has 0 now"* ]]
}

@test "memory-index: a UTF-16 organ is refused instead of reading as empty" {
  # PowerShell 5.1 writes UTF-16LE by default, so this is one redirect away on the windows leg.
  # Read as UTF-8 the bytes decode to NUL-interleaved mojibake, every row stops matching, and the
  # organ reports zero records with no error and no exclusion.
  tree="$(_tree organs-good)"
  node -e 'const f=require("fs");const p=process.argv[1];const t=f.readFileSync(p,"utf8");f.writeFileSync(p,Buffer.concat([Buffer.from([0xff,0xfe]),Buffer.from(t,"utf16le")]));' "$tree/docs/retro-log.md"
  run node "$MEM" --root "$tree" --rebuild
  [ "$status" -ne 0 ]
  [[ "$output" == *"UTF-16 byte-order mark"* ]]
}

@test "memory-index: a malformed expectation file is refused, never silently disarmed" {
  # `null`, `[]`, `{}` and `5` all used to switch off every expectation in silence -- the design's
  # ONLY pinning channel, disabled by a one-token file from any generator or jq pipeline, taking
  # the phase's own negative control down with it.
  tree="$(_tree organs-53of54)"
  for bad in 'null' '[]' '{}' '5'; do
    printf '%s\n' "$bad" > "$BATS_TEST_TMPDIR/e.json"
    run node "$MEM" --root "$tree" --rebuild --expect "$BATS_TEST_TMPDIR/e.json"
    [ "$status" -eq 2 ] || { echo "input=$bad status=$status"; echo "$output"; false; }
  done
  # and a BOM, which PowerShell writes by default, must not crash with a raw stack
  printf '\xEF\xBB\xBF{"retro-log":3}\n' > "$BATS_TEST_TMPDIR/bom.json"
  run node "$MEM" --root "$tree" --rebuild --expect "$BATS_TEST_TMPDIR/bom.json"
  [ "$status" -eq 1 ]
  [[ "$output" == *"expected 3 indexed record(s), got 2"* ]]
}

# ---------- determinism and staleness ----------

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

@test "memory-index: the staleness manifest notices a changed organ" {
  tree="$(_tree organs-good)"
  run node "$MEM" --root "$tree" --rebuild
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run node "$MEM" --root "$tree" --status
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"stale: no"* ]]

  printf '2026-01-03 | fixture | a fourth pattern | a fourth prevention | delta\n' >> "$tree/docs/retro-log.md"
  run node "$MEM" --root "$tree" --status
  # exit 3, not 0: `memory-index --status && use-the-index` must not proceed on a stale index.
  [ "$status" -eq 3 ]
  [[ "$output" == *"stale: YES"* ]]
  [[ "$output" == *"docs/retro-log.md changed"* ]]
}

@test "memory-index: a change that preserves the mtime is still caught" {
  # The hash used to be consulted only INSIDE `if (mtime differs)`, while the comment beside it
  # claimed the opposite -- a comment asserting a property the code did not have. Reachable with
  # `touch -r`, `rsync -t`, a checkout, or any one-second-resolution filesystem.
  tree="$(_tree organs-good)"
  run node "$MEM" --root "$tree" --rebuild
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  node -e 'const f=require("fs");const p=process.argv[1];const st=f.statSync(p);f.writeFileSync(p,f.readFileSync(p,"utf8").replace("2026-01-01","2099-12-31"));f.utimesSync(p,st.atime,st.mtime);' "$tree/docs/retro-log.md"
  run node "$MEM" --root "$tree" --status
  [ "$status" -eq 3 ]
  [[ "$output" == *"docs/retro-log.md changed"* ]]
}

@test "memory-index: an ADDED ADR makes the index stale" {
  # isStale iterated the manifest, i.e. the files that existed at build time, so it could see a
  # file change or vanish but never see one appear. Adding an ADR is the single most ordinary
  # change this repo makes to that organ -- 140 to 150 during this lane's own kickoff.
  tree="$(_tree organs-good)"
  run node "$MEM" --root "$tree" --rebuild
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  printf '# ADR 0903 -- brand new\n\n**Status:** accepted\n\nBody.\n' > "$tree/docs/adr/0903-brand-new.md"
  run node "$MEM" --root "$tree" --status
  [ "$status" -eq 3 ]
  [[ "$output" == *"docs/adr/ gained or lost a file"* ]]
}

@test "memory-index: a new decision on the spine makes the index stale" {
  # The spine is an indexed organ with no manifest entry at all, so --status could never observe
  # a new decision and a consumer that rebuilds only when told to go stale never saw one again.
  tree="$(_tree organs-good)"
  run node "$MEM" --root "$tree" --rebuild
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  approval="$(bash "$EVENT" emit approval.requested --strict --payload '{"what":"a later approval","gate":"fixture"}')"
  [ -n "$approval" ]
  run node "$MEM" --root "$tree" --status
  [ "$status" -eq 3 ]
  [[ "$output" == *"spine gained or lost events"* ]]
}

# ---------- the spine ----------

@test "memory-index: an empty spine reports zero AND names the spine it read" {
  # A bare 0/0 cannot distinguish an empty spine from a spine that was never opened -- L-002
  # exactly. This phase shipped that bug: the builder handed the reader the REPO root instead of
  # the SPINE root and reported 0/0 on a spine it had never looked at. The first version of THIS
  # test matched only the prefix of the sentence and so could not tell one spine from another --
  # it asserts the actual path now.
  tree="$(_tree organs-good)"
  run node "$MEM" --root "$tree" --rebuild
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"decisions        0/0"* ]]
  # NOT a full-path compare. The builder prints a node-side path, and on the windows leg that is
  # `C:/Users/RUNNER~1/...` (8.3-shortened, forward slashes) while bash holds `/c/Users/...` --
  # the two never match, and the first version of this assertion went red on windows alone.
  # The per-test directory name is the discriminator that actually matters: it is unique to this
  # test and can never be the repo root, which is the substitution this test exists to catch.
  [[ "$output" == *"$(basename "$BATS_TEST_TMPDIR")/spine via ARC_SPINE_ROOT"* ]]
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

@test "memory-index: a build with no reachable spine fails unless told otherwise" {
  # A build whose fifth organ was never read used to exit 0 and write a knowingly incomplete
  # index. The `unavailable` state was honoured on stdout and nowhere else.
  tree="$(_tree organs-good)"
  unset ARC_SPINE_ROOT
  run node "$MEM" --root "$tree" --rebuild
  [ "$status" -eq 1 ]
  [[ "$output" == *"NOT READ"* ]]
  run node "$MEM" --root "$tree" --rebuild --allow-missing-spine
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"UNAVAILABLE"* ]]
}

# ---------- the operator surface ----------

@test "memory-index: an empty --root is refused, not turned into the current directory" {
  # `--root "$DIR"` with DIR unset expands to `--root ""` -- the QUOTED form .claude/rules/lanes.md
  # mandates. An empty value used to fall through to the git toplevel and then to cwd, building an
  # index for a directory nobody named and writing it there. Presence, not truthiness: the exact
  # lesson spine-io.mjs was rewritten for, un-applied in the file that imports it.
  run node "$MEM" --root "" --rebuild
  [ "$status" -eq 2 ]
  [[ "$output" == *"named but is empty"* ]]
}

@test "memory-index: a value flag given twice is an operator error" {
  # Never a last-wins override. lanes.md settled this for --lane and the reasoning is identical:
  # silently picking one of two named values IS the never-guess failure.
  tree="$(_tree organs-good)"
  run node "$MEM" --root "$tree" --root "$tree" --rebuild
  [ "$status" -eq 2 ]
  [[ "$output" == *"given twice"* ]]
}

@test "memory-index: --status and --rebuild together are refused" {
  # Together, --status won and nothing was built, at exit 0 -- a CI step written that way reported
  # success having built nothing.
  tree="$(_tree organs-good)"
  run node "$MEM" --root "$tree" --status --rebuild
  [ "$status" -eq 2 ]
  [[ "$output" == *"Pick one"* ]]
}

@test "memory-index: an unreadable organ names the file it could not read" {
  # With 150 ADRs, a bare EISDIR with no path leaves the operator nothing to act on.
  tree="$(_tree organs-good)"
  rm "$tree/docs/retro-log.md"
  mkdir "$tree/docs/retro-log.md"
  run node "$MEM" --root "$tree" --rebuild
  [ "$status" -eq 2 ]
  [[ "$output" == *"docs/retro-log.md"* ]]
  [[ "$output" == *"directory"* ]]
}

@test "memory-index: a tree missing an organ says so instead of miscounting" {
  tree="$(_tree organs-good)"
  rm "$tree/docs/trial-ledger.md"
  run node "$MEM" --root "$tree" --rebuild
  [ "$status" -ne 0 ]
  [[ "$output" == *"not found"* ]]
  [[ "$output" == *"trial-ledger"* ]]
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

@test "memory-index: importing the module does not run the CLI" {
  # `endsWith("memory-index.mjs")` is a SUFFIX test, so any importer whose own filename ended in
  # that string ran the CLI against the importer's argv and exited 2 before the wrapper's own code
  # ran. Phase 1's arc-recall imports this module.
  # The module URL is computed BY NODE, from node's own cwd. Handing node the bash-side path is
  # what broke this on windows alone: MSYS gives `/d/a/arc/arc/...`, and pathToFileURL turns that
  # into `D:\d\a\arc\arc\...`, a path that does not exist. node resolving its own cwd is the only
  # form that is right on all three legs.
  MEM_URL="$(cd "$ARC_ROOT" && node -e 'const {pathToFileURL}=require("node:url");const {resolve}=require("node:path");process.stdout.write(pathToFileURL(resolve(".claude/scripts/memory/memory-index.mjs")).href);')"
  [ -n "$MEM_URL" ]
  cat > "$BATS_TEST_TMPDIR/check-memory-index.mjs" <<'EOF'
const { build } = await import(process.env.MEM_URL);
console.log("WRAPPER OK", typeof build);
EOF
  MEM_URL="$MEM_URL" run node "$BATS_TEST_TMPDIR/check-memory-index.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"WRAPPER OK function"* ]]
}

# ---------- the golden set ----------

@test "memory-index: the golden query set is complete and carries no placeholder" {
  # ADR-0706: the set is committed before the thing it grades, with placeholders for the
  # content-positional ids. A leftover placeholder must FAIL rather than silently skip a row.
  file="$FIXTURES/golden-queries.tsv"
  [ -f "$file" ]
  rows="$(grep -cv '^#' "$file")"
  [ "$rows" -eq 12 ]
  run grep -v '^#' "$file"
  [ "$status" -eq 0 ]
  [[ "$output" != *"unresolved:"* ]]
  cols="$(grep -v '^#' "$file" | awk -F'\t' '{print NF}' | LC_ALL=C sort -u)"
  [ "$cols" = "5" ]
}

@test "memory-index: every golden anchor still resolves to the record its id names" {
  # A retro id is content-positional, so inserting one row earlier on the same date renumbers
  # every later id on that date. The id still EXISTS, so an id-only gate keeps passing while
  # grading a different lesson -- verified: one back-filled 2026-08-02 row silently repointed two
  # golden rows at unrelated lessons. The anchor is what makes that drift loud.
  tree="$(_tree organs-good)"
  run node "$MEM" --root "$ARC_ROOT" --rebuild --allow-missing-spine
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run node "$ARC_ROOT/.claude/scripts/memory/golden-check.mjs" --root "$ARC_ROOT"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"12/12 anchors resolve"* ]]
}

@test "memory-index: this suite registers the number of tests it claims" {
  # bats silently DROPS a @test whose name carries a non-ASCII character. A suite running fewer
  # tests than it declares is indistinguishable from a suite that passes, and the only signal is
  # the count. CI reconciles declared-vs-executed TAP lines for real on every leg; this is the
  # in-file restatement.
  count="$(grep -c '^@test ' "$BATS_TEST_FILENAME")"
  [ "$count" -eq 31 ]
}
