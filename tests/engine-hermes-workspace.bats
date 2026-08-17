#!/usr/bin/env bats
# engine-hermes-workspace.bats -- Phase 06 fixture 8 (ADR-0222): a dispatch cannot inherit the
# previous dispatch's memory, because it never mounts the previous dispatch's volume.
#
# THE ASSERTION IS ON THE VOLUME, NEVER ON THE ANSWER, and that is the whole finding. When this was
# first measured against the real runtime, a marker planted in run N did NOT appear in run N+1's
# stdout -- so the obvious test would have recorded a PASS -- while the string sat on disk in
# memories/MEMORY.md and in state.db. Asking the model whether it remembers is asking the model.
#
# TWO FILES ARE PLANTED, not one. The marker turned up in state.db as well as the MEMORY.md the
# vendor's docs name, which is exactly why ADR-0222 copies the whole home instead of wiping a list:
# a wipe list one file short reads green while carrying data across.
#
# REWRITTEN 2026-08-17 AFTER TWO ADVERSARIAL SURFACES ATTACKED IT. Four of its six tests could not
# fail, and the biggest hole was not in this file at all: with ARC_HERMES_DATA pointing at a path
# that did not exist, the driver SKIPPED the copy entirely and mounted the template path -- and no
# test here covered that branch, because setup() always created the directory.
#
# EVERY RUN GOES THROUGH `drivers/hermes.sh`, the entry point ADR-0203 specifies. This suite called
# `node hermes.mjs` directly, so the wrapper was a production path no test exercised.

bats_require_minimum_version 1.5.0

load test_helper

setup() {
  ARC_ROOT="$(cd "$BATS_TEST_DIRNAME/.." && pwd)"
  DRIVER="$ARC_ROOT/.claude/scripts/engine/drivers/hermes.sh"
  TEMPLATE="$BATS_TEST_TMPDIR/template"
  mkdir -p "$TEMPLATE"
  printf 'seed\n' > "$TEMPLATE/config.yaml"
  export ARC_HERMES_DOCKER="$ARC_ROOT/tests/fixtures/engine/hermes/fake-docker.mjs"
  export ARC_HERMES_IMAGE="nousresearch/hermes-agent@sha256:16788311e2fa3035456bdc1bafb8ec2b1777db64ebf020af9bb7eb73c3712c9e"
  export ARC_HERMES_DATA="$TEMPLATE"
  export ARC_DRIVER_COST_FILE="$BATS_TEST_TMPDIR/cost.json"
  export ARC_HERMES_USAGE_FILE=""
  export ARC_HERMES_NETWORK=""
  export ARC_HERMES_PROXY=""
  # A PER-TEST MARKER, NOT A CONSTANT. The fixture used to fall back to a hardcoded literal that was
  # byte-identical to what setup() exported, so misspelling the export left every marker assertion
  # passing against the fixture's own default -- a control that proves the default, not the wiring.
  export ARC_HERMES_MARKER="ZEBRAQUARTZ$$-${BATS_TEST_NUMBER:-0}"
  export ARC_HERMES_FAKE_MARKER="$ARC_HERMES_MARKER"
}

run_case() {
  export ARC_HERMES_FAKE_CASE="$1"
  run --separate-stderr bash "$DRIVER" run demo '{"q":1}' min=5
}

# The workspace the driver ACTUALLY used, read off the transcript it prints. Every assertion about
# the copy is made against this path rather than against a guessed temp root -- see the removal test.
workspace_from_stderr() {
  printf '%s\n' "$stderr" | sed -n 's/.*copy of .* at \(.*\) (ADR-0222)$/\1/p' | tail -1
}

@test "ADR-0222: dispatch N+1 does NOT see the memory dispatch N wrote" {
  run_case plant-memory
  [ "$status" -eq 0 ]
  [[ "$output" == *'"ok":true'* ]]
  # THE FIXTURE IS PROVEN TO HAVE PLANTED SOMETHING. Mutating plant-memory into a no-op used to
  # leave tests 1, 2 and 4 green: an isolation suite passing against a fixture that writes nothing
  # is the vacuous pass wearing an isolation test's name, which the old comment claimed to close
  # while closing only the reader half.
  [[ "$stderr" == *"planted"* ]] || { echo "the fixture did not report planting anything"; false; }

  run_case read-memory
  [ "$status" -eq 0 ]
  # The second dispatch reports what its OWN volume held. Empty is the requirement.
  [[ "$output" == *'"memory_seen":""'* ]]
  [[ "$output" == *'"state_seen":""'* ]]
  [[ "$output" != *"$ARC_HERMES_MARKER"* ]]
}

@test "ADR-0222: the TEMPLATE is never written to, so it cannot carry state forward either" {
  # If a dispatch could mutate the template, run N's memories would reach run N+1 through the
  # template itself and the copy would buy nothing.
  run_case plant-memory
  [ "$status" -eq 0 ]
  [ ! -f "$TEMPLATE/memories/MEMORY.md" ]
  [ ! -f "$TEMPLATE/state.db" ]
  # An absence assertion never stands alone: prove the template is readable and non-empty first, or
  # an unreadable or empty directory satisfies the grep miss for the wrong reason.
  [ -s "$TEMPLATE/config.yaml" ]
  run grep -rl "$ARC_HERMES_MARKER" "$TEMPLATE"
  [ "$status" -ne 0 ]
}

@test "ADR-0222 NEGATIVE CONTROL: the mechanism CAN see a marker when one is present" {
  # Seeded into the template, so the copy carries it. If read-memory reports the marker here, the
  # mechanism can see one when one is there -- which is what makes the EMPTY result in test 1 a
  # finding rather than a fixture that writes nothing.
  #
  # It goes through the DRIVER rather than invoking the fixture from bash. An earlier version did
  # the latter and failed for a reason that had nothing to do with the code: Git Bash rewrites an
  # argument shaped `path:path` into a Windows path LIST, so the fixture received
  # `C:/...;C:/opt/data`, took the drive colon as the separator, and wrote to a relative directory
  # called `C`. Production never sees that -- drivers/hermes.mjs spawns docker with an ARGV ARRAY
  # and no shell -- so a control that only fails inside bash is testing bash.
  mkdir -p "$TEMPLATE/memories"
  printf '%s\n' "$ARC_HERMES_MARKER" > "$TEMPLATE/memories/MEMORY.md"
  printf 'sqlite-ish %s\n' "$ARC_HERMES_MARKER" > "$TEMPLATE/state.db"

  run_case read-memory
  [ "$status" -eq 0 ]
  [[ "$output" == *"$ARC_HERMES_MARKER"* ]]
  [[ "$output" == *'"memory_seen":"'"$ARC_HERMES_MARKER"'"'* ]]
}

@test "ADR-0222: the private workspace EXISTED during the dispatch and is GONE after it" {
  # THE OLD VERSION COULD NOT FAIL, and both attackers proved it: it counted `arc-hermes-ws-*` under
  # `${TMPDIR:-/tmp}`, but in Git Bash TMPDIR is unset while Node's os.tmpdir() -- where the
  # workspace is actually created -- is C:\Users\...\AppData\Local\Temp. So before=0, after=0,
  # `0 -le 0` passed with the cleanup deleted. And even where the two roots agree, `after -le before`
  # cannot tell "created and removed" from "never created".
  #
  # The path the driver actually used is read off its own transcript, so the assertion is about the
  # directory that existed rather than about a count of a directory nobody wrote to.
  run_case plant-memory
  [ "$status" -eq 0 ]
  local ws
  ws="$(workspace_from_stderr)"
  [ -n "$ws" ] || { echo "the driver did not report a workspace path: $stderr"; false; }
  case "$ws" in
    *arc-hermes-ws-*) : ;;
    *) echo "reported workspace is not a private scratch dir: $ws"; false ;;
  esac
  [ ! -e "$ws" ] || { echo "the private workspace survived the dispatch: $ws"; false; }
}

@test "ADR-0222: the driver SAYS which workspace it MOUNTED, not merely that it copied" {
  # The line was derived from `workspaceIsCopy`, set the instant cpSync returns -- so the minimal
  # mutant (keep the copy, change the -v spec back to the template) still printed "PRIVATE copy" on
  # a dispatch that mounted the template, and the claimed "3 of 6 redden" was really 2. The path is
  # now in the line, and it is asserted to be the scratch dir rather than the template.
  run_case clean
  [ "$status" -eq 0 ]
  [[ "$stderr" == *"workspace is a PRIVATE copy"* ]]
  local ws
  ws="$(workspace_from_stderr)"
  [ -n "$ws" ]
  [ "$ws" != "$TEMPLATE" ] || { echo "the driver reported the template as its private workspace"; false; }
}

@test "ADR-0222: a template that does not exist is REFUSED, never silently mounted" {
  # THE HOLE BOTH ATTACKERS FOUND, and the worst one in the change. `existsSync(DATA_DIR)` false
  # meant the copy block was SKIPPED rather than failed: the template path went straight into -v,
  # docker created it host-side, and every dispatch from then on shared one directory -- exactly the
  # memory-carrying mechanism ADR-0222 exists to stop, reached by the state .env.example itself
  # describes as normal ("seed the template once"). setup() always created the directory, so no test
  # in this file could see it.
  export ARC_HERMES_DATA="$BATS_TEST_TMPDIR/never-created"
  run_case clean
  [ "$status" -ne 0 ]
  [[ "$stderr" == *"cannot be read"* ]]
  [ ! -d "$BATS_TEST_TMPDIR/never-created" ] || { echo "the refused path was created anyway"; false; }
}

@test "ADR-0222: a template that is a FILE, not a directory, is refused" {
  printf 'not a directory\n' > "$BATS_TEST_TMPDIR/afile"
  export ARC_HERMES_DATA="$BATS_TEST_TMPDIR/afile"
  run_case clean
  [ "$status" -ne 0 ]
  [[ "$stderr" == *"is not a directory"* ]]
}

@test "ADR-0222: a template containing a SYMLINK is refused" {
  # `dereference:false` does not mean the same thing on all three legs -- on POSIX it reproduces the
  # link, so a "private" copy still writes to shared state; on Windows it was measured FOLLOWING an
  # inner junction and copying the target's contents in. Refusing needs no per-OS reasoning.
  #
  # Skipped only where the OS refuses to create a symlink at all (unprivileged Windows). The skip is
  # explicit and narrow: a suite that skips everywhere is the tripwire this cycle already shipped
  # dead, so the reason is asserted rather than assumed.
  ln -s "$BATS_TEST_TMPDIR" "$TEMPLATE/loop" 2>/dev/null || skip "this OS/user cannot create symlinks"
  [ -L "$TEMPLATE/loop" ] || skip "symlink was not created as a link"
  run_case clean
  [ "$status" -ne 0 ]
  [[ "$stderr" == *"contains a symlink"* ]]
}

@test "suite: every test in this file is REGISTERED, not merely declared" {
  # FIXED after an attacker defeated the first version, which counted `^@test` lines in the SOURCE.
  # bats silently DROPS a @test whose name carries a non-ASCII character and the source line
  # survives, so the number never moved while a test did not run -- the precise defect this guard
  # exists to catch. `bats --count` reports what bats actually REGISTERED.
  declared="$(grep -c "^@test " "$BATS_TEST_FILENAME")"
  registered="$(bats --count "$BATS_TEST_FILENAME")"
  [ "$registered" = "9" ] || { echo "expected 9 REGISTERED tests, bats registered $registered"; false; }
  [ "$declared" = "$registered" ] || { echo "declared $declared but bats registered $registered -- a test was silently dropped"; false; }
}
