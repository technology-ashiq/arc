#!/usr/bin/env bats
# engine-hermes-toolsets.bats -- ADR-0224: what the runtime may reach for is what the process declared.
#
# WHAT IS ASSERTED HERE AND WHAT IS NOT. These tests assert the ARGV the driver builds, through the
# fake-docker recorder, plus the pure derivation. They do NOT prove that a restricted toolset makes
# the runtime answer in one shot -- that was measured against real containers on 2026-08-18 and is
# written up in `initiatives/engine/evidence/phase-08/req07-toolsets-are-the-confound.md`:
#
#   all 17 toolsets   3 dispatches, 2 attempts each, 150-307 s, `$.draft` absent every time
#   -t vision         exit 0, 55 s, ONE api call, a valid draft citing its pack entry
#   -t ""             FAIL-OPEN -- 3 api calls, 30,248 input tokens, the full agentic shape
#   -t none           exit 2, no output, no usage report
#
# The split is the same one engine-hermes-egress.bats makes and for the same reason: a CI runner has
# no Docker and no image, so a suite that tried to prove runtime BEHAVIOUR here would skip on every
# leg and be a green tick nobody earned. What CI can prove is that the driver asks for the narrowing
# every time, and stops asking loudly if someone deletes the code.
#
# EVERY RUN GOES THROUGH `drivers/hermes.sh`, the entry point ADR-0203 specifies, never `node
# hermes.mjs` -- the wrapper is where a CDPATH defect was proven, and calling Node directly is a path
# no test exercises.

bats_require_minimum_version 1.5.0

load test_helper

setup() {
  ARC_ROOT="$(cd "$BATS_TEST_DIRNAME/.." && pwd)"
  DRIVER="$ARC_ROOT/.claude/scripts/engine/drivers/hermes.sh"
  WORK="$BATS_TEST_TMPDIR/w"
  mkdir -p "$WORK/data"
  ARGV="$WORK/argv.jsonl"
  export ARC_HERMES_DOCKER="$ARC_ROOT/tests/fixtures/engine/hermes/fake-docker.mjs"
  export ARC_HERMES_FAKE_ARGV_FILE="$ARGV"
  export ARC_HERMES_FAKE_CASE=clean
  export ARC_HERMES_IMAGE="nousresearch/hermes-agent@sha256:16788311e2fa3035456bdc1bafb8ec2b1777db64ebf020af9bb7eb73c3712c9e"
  export ARC_HERMES_DATA="$WORK/data"
  export ARC_DRIVER_COST_FILE="$WORK/cost.json"
  export ARC_HERMES_USAGE_FILE=""
  export ARC_HERMES_NETWORK=""
  export ARC_HERMES_PROXY=""
}

# THE ARGV FILE IS ASSERTED NON-EMPTY BEFORE IT IS READ. `run cat "$ARGV"` with the status unchecked
# is satisfied by `cat: No such file` -- misspell the recorder variable and the whole file goes green.
read_argv() {
  [ -s "$ARGV" ] || { echo "the fixture recorded no invocation at all"; false; }
  run cat "$ARGV"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

_derive() { cd "$ARC_ROOT" && node --input-type=module -e "$1"; }

# ---------------------------------------------------------------------------
# The ARGV the driver actually builds
# ---------------------------------------------------------------------------

@test "a process declaring NO tools dispatches with the narrowest toolset, not with the runtime defaults" {
  # build-in-public-draft carries `permissions: declared` and `tools: []` deliberately -- ADR-0223
  # made that mean "asks for nothing", and this is where that declaration stops being a pre-flight
  # check and becomes the runtime's allowlist.
  run --separate-stderr bash "$DRIVER" run build-in-public-draft '{"pack_ref":"p","pack":"x"}' min=5
  [ "$status" -eq 0 ] || { echo "$output"; echo "$stderr"; false; }
  # STASHED BEFORE read_argv, because read_argv runs `cat` and `run` REPLACES $output and $stderr.
  # Asserting on $stderr afterwards reads cat's stderr, which is always empty -- so the assertion
  # passed on a driver that announced nothing and failed on one that announced correctly. Found by
  # running it: the same "assert a different command's output" shape testing.md names.
  local said="$stderr"
  read_argv
  [[ "$output" == *'"-t"'*'"vision"'* ]] || { echo "no narrowed toolset in the argv: $output"; false; }
  # POSITIVE assertion on the announcement too: a narrowing nobody can see in the trail is one an
  # operator cannot audit.
  [[ "$said" == *"toolsets vision"* ]] || { echo "the driver did not announce the narrowing: $said"; false; }
}

@test "a process declaring real tools dispatches with those tools mapped, and nothing wider" {
  # commit-msg-draft declares `git.op` and `shell.run`. git reaches the network as well as the shell,
  # which is what TOOL_CAPABILITIES already records, so the mapping says so too.
  run --separate-stderr bash "$DRIVER" run commit-msg-draft '{"q":1}' min=5
  [ "$status" -eq 0 ] || { echo "$output"; echo "$stderr"; false; }
  read_argv
  [[ "$output" == *'"-t"'* ]] || { echo "no toolset flag at all: $output"; false; }
  [[ "$output" == *"terminal"* ]] || { echo "shell.run/git.op did not map to terminal: $output"; false; }
  # AND NOTHING WIDER. `file` is the one an authoring-adjacent process must not silently acquire,
  # and commit-msg-draft declares no fs token.
  [[ "$output" != *'"file"'* ]] || { echo "a process declaring no fs token was handed the file toolset: $output"; false; }
}

@test "NEGATIVE CONTROL -- a declaration that cannot be narrowed passes NO flag, and says so out loud" {
  # `demo` has no canonical file. An absence of information is not a narrow claim, so the runtime
  # keeps its own defaults -- and the wide posture is ANNOUNCED, the contract this driver already
  # keeps for an unconfined egress and PreToolUse.sh keeps for a missing dispatcher.
  #
  # This is also the control for the two tests above: if the driver narrowed everything
  # unconditionally, they would pass while proving nothing about the declaration.
  run --separate-stderr bash "$DRIVER" run demo '{"q":1}' min=5
  [ "$status" -eq 0 ] || { echo "$output"; echo "$stderr"; false; }
  local said="$stderr"   # see the note in the first test: read_argv clobbers $stderr
  read_argv
  [[ "$output" != *'"-t"'* ]] || { echo "an undeclared process was narrowed anyway: $output"; false; }
  [[ "$said" == *"toolsets UNRESTRICTED"* ]] || { echo "the wide posture was silent: $said"; false; }
}

@test "the flag is never passed with an EMPTY value, on any of the shapes that derive to nothing" {
  # `-t ""` was measured as a FAIL-OPEN on the pinned image: the empty string reads as no override
  # and the run came back with the full seventeen-toolset agentic shape. So an empty derivation must
  # produce an ABSENT flag, never a present-but-empty one -- the same distinction ADR-0223 fixed
  # inside arc's own gate, here in the runtime's argument parser.
  run --separate-stderr bash "$DRIVER" run demo '{"q":1}' min=5
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  read_argv
  [[ "$output" != *'"-t",""'* ]] || { echo "an empty -t value reached docker: $output"; false; }
  [[ "$output" != *'"-t", ""'* ]] || { echo "an empty -t value reached docker: $output"; false; }
}

# ---------------------------------------------------------------------------
# The derivation itself
# ---------------------------------------------------------------------------

@test "the derivation maps every declared token, and widens on every shape it cannot read" {
  # Enumerated rather than sampled. The four bottom rows are the deny-by-default arms: an absence of
  # information, `unrestricted` (which means nobody has narrowed this file yet), and a token nobody
  # has classified all keep the runtime's defaults, because narrowing a process nobody has described
  # is not this function's call to make -- refusing an undeclared process is the GATE's job.
  run _derive "
    const m = await import('./.claude/scripts/engine/drivers/hermes.mjs');
    const rows = [
      ['declared+empty',      { permissions:'declared', tools: [] }],
      ['fs.read',             { permissions:'declared', tools: ['fs.read'] }],
      ['fs.write',            { permissions:'declared', tools: ['fs.write'] }],
      ['shell.run',           { permissions:'declared', tools: ['shell.run'] }],
      ['git.op',              { permissions:'declared', tools: ['git.op'] }],
      ['agent.invoke',        { permissions:'declared', tools: ['agent.invoke'] }],
      ['ask.human',           { permissions:'declared', tools: ['ask.human'] }],
      ['mapping-entry',       { permissions:'declared', tools: [{ 'shell.run': ['x'] }] }],
      ['unknown-token',       { permissions:'declared', tools: ['telepathy.invoke'] }],
      ['unrestricted+empty',  { permissions:'unrestricted', tools: [] }],
      ['tools-absent',        { permissions:'declared' }],
      ['tools-null',          { permissions:'declared', tools: null }],
    ];
    console.log(rows.map(([l,d]) => l + '=' + (m.toolsetsFor(d) || '(none)')).join(' '));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "declared+empty=vision fs.read=file fs.write=file shell.run=terminal,code_execution git.op=terminal,web agent.invoke=delegation ask.human=clarify mapping-entry=terminal,code_execution unknown-token=(none) unrestricted+empty=(none) tools-absent=(none) tools-null=(none)" ]
}

@test "the map cannot produce a toolset the pinned image does not define" {
  # An unknown name makes the runtime exit 2, and ENG-D reads 2 as BUDGET_DECLINED -- so a typo in
  # this map would be reported to arc as a budget decline. The driver validates before dispatch, and
  # this asserts the map can never be the thing that trips it.
  run _derive "
    const m = await import('./.claude/scripts/engine/drivers/hermes.mjs');
    const known = new Set(m.KNOWN_TOOLSETS);
    const bad = [];
    for (const [tok, sets] of Object.entries(m.TOOLSET_FOR))
      for (const s of sets) if (!known.has(s)) bad.push(tok + '->' + s);
    if (!known.has(m.NARROWEST_TOOLSET)) bad.push('NARROWEST->' + m.NARROWEST_TOOLSET);
    console.log(bad.length ? 'UNDEFINED: ' + bad.join(',') : 'all ' + Object.keys(m.TOOLSET_FOR).length + ' tokens map into the image vocabulary');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == "all "*" tokens map into the image vocabulary" ]]
}

@test "the narrowest toolset is not one that writes files, keeps state, or reads past sessions" {
  # `vision` is a workaround for a CLI that cannot say "nothing", and the alternatives were each
  # worse: `todo` keeps planning state, `session_search` reads previous sessions and is
  # memory-adjacent (what ADR-0222 exists to contain), `tts` and `image_gen` produce FILES. If a
  # later change reaches for one of those as the default, this fails and names it.
  run _derive "
    const m = await import('./.claude/scripts/engine/drivers/hermes.mjs');
    const forbidden = ['file','terminal','code_execution','memory','session_search','todo','tts','image_gen','video_gen','browser','web','computer_use','cronjob','delegation','skills'];
    console.log(forbidden.includes(m.NARROWEST_TOOLSET) ? 'FORBIDDEN: ' + m.NARROWEST_TOOLSET : 'narrowest=' + m.NARROWEST_TOOLSET);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "narrowest=vision" ]
}

@test "this file registered every test it declares" {
  [ "${#BATS_TEST_NAMES[@]}" -eq 8 ] || {
    echo "registered ${#BATS_TEST_NAMES[@]} tests, expected 8 -- a @test was silently dropped"
    false
  }
}
