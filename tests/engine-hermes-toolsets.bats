#!/usr/bin/env bats
# engine-hermes-toolsets.bats -- what the runtime is TOLD and what it may REACH FOR, both derived
# from the one process declaration (ADR-0224, and its 2026-08-19 amendment).
#
# The file name says toolsets because that is what it started as. It covers the prompt too, and
# deliberately in one place: both halves come from the same `canonicalDoc` read, and the bug that
# cost this cycle four sessions was that ONE of them was missing while the other looked fine.
#
# WHAT IS ASSERTED HERE AND WHAT IS NOT. These tests assert the ARGV the driver builds, through the
# fake-docker recorder, plus the pure derivation. Runtime BEHAVIOUR was measured against real
# containers and is written up in `initiatives/engine/evidence/phase-08/req07-what-the-runtime-was-told.md`.
# The isolated grid, one variable at a time -- the first version of this header quoted the CONFOUNDED
# pair instead, which is how the wrong cause reached an ADR:
#
#   thin prompt + all 17     fail, `$.draft` absent      thin prompt + -t vision   fail, same
#   full prompt + -t vision  exit 0, 55 s, a draft       full prompt + all 17      exit 0, 62 s, a draft
#
# So the PROMPT is what decides whether an answer arrives. What the toolset flag decides is what the
# runtime may reach for while producing it, which is an isolation property and is why it is still here:
#
#   -t ""     FAIL-OPEN -- 3 api calls, 30,248 input tokens, the full seventeen-toolset shape
#   -t none   exit 2, no output, no usage report (and ENG-D reads 2 as BUDGET_DECLINED)
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

# THE VALUE `-t` ACTUALLY CARRIES, extracted from the recorded argv rather than pattern-matched
# inside it. Two proven reasons, both from an adversarial pass on the first version of this file:
#
#   A glob like *'"-t"'*'"vision"'* is NOT adjacency-anchored. It passed on an argv reading
#   `"-t","browser", ... ,"--env-marker","vision"` -- the flag carrying the wrong value entirely,
#   with the expected token sitting somewhere else in the array.
#
#   Worse, `-t` carries ONE comma-joined string, so `"file"` only ever forms the quoted token
#   `"file"` when it is the SOLE toolset. Widening `git.op` to include `file` handed
#   commit-msg-draft the file toolset and the `!= *'"file"'*` assertion still passed -- the check
#   could not see the leak in the only shape the leak takes.
#
# So: pull the value out, and compare it as a LIST.
toolset_value() {
  node -e 'const fs=require("node:fs");const a=JSON.parse(fs.readFileSync(process.argv[1],"utf8").trim().split("\n").pop());const i=a.indexOf("-t");process.stdout.write(i<0?"":String(a[i+1]??""));' "$ARGV"
}

# Present-and-equal-to, as a whole list.
toolsets_are() {
  local want="$1" got; got="$(toolset_value)"
  [ "$got" = "$want" ] || { echo "-t carries [$got], expected [$want]"; return 1; }
}

# One member of the comma-separated list, never a substring of the whole string.
toolsets_include() {
  local want="$1" got; got="$(toolset_value)"
  case ",$got," in *",$want,"*) return 0;; esac
  echo "-t carries [$got], which does not include [$want]"; return 1
}

toolsets_exclude() {
  local want="$1" got; got="$(toolset_value)"
  case ",$got," in *",$want,"*) echo "-t carries [$got], which must not include [$want]"; return 1;; esac
  return 0
}

# What the runtime is actually TOLD -- the `-z` argument, extracted the same way and for the same
# reason as the toolset value.
prompt_value() {
  node -e 'const fs=require("node:fs");const a=JSON.parse(fs.readFileSync(process.argv[1],"utf8").trim().split("\n").pop());const i=a.indexOf("-z");process.stdout.write(i<0?"":String(a[i+1]??""));' "$ARGV"
}

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
  # The whole list, not a substring of the argv: see toolset_value.
  toolsets_are "vision" || { echo "$output"; false; }
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
  toolsets_include "terminal" || { echo "$output"; false; }
  # AND NOTHING WIDER. `file` is the one an authoring-adjacent process must not silently acquire, and
  # commit-msg-draft declares no fs token. Asserted as a LIST MEMBER: an adversarial pass widened
  # `git.op` to include `file`, this process was handed it, and the previous substring form still
  # passed -- because a comma-joined value never forms the quoted token `"file"` unless `file` is the
  # only toolset, which is the one shape the leak does not take.
  toolsets_exclude "file" || { echo "$output"; false; }
  toolsets_exclude "memory" || { echo "$output"; false; }
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
  # Two facts, and they are different: the flag is ABSENT here (not present-and-empty), and if any
  # future path did pass it, the value must never be the empty string. Extracting the value proves
  # both -- a glob for `"-t",""` cannot tell an absent flag from an empty one.
  [[ "$output" != *'"-t"'* ]] || { echo "the flag was passed for an unnarrowable declaration: $output"; false; }
  local got; got="$(toolset_value)"
  [ -z "$got" ] || { echo "-t carries [$got] for a process with no narrowable declaration"; false; }
}

@test "the unknown-toolset refusal is WIRED, and it is upstream of the container spawn" {
  # THE ARGS-SITE VALIDATION HAD NO COVERAGE AT ALL, proven by an adversarial pass: deleting the
  # `throw` left all eight tests green, because the only tests touching KNOWN_TOOLSETS check it as
  # pure data and never through the driver. Its trigger is unreachable through real data by
  # construction -- the map test below guarantees every value it can produce is defined -- so this
  # asserts the guard EXISTS and sits before the spawn, the same shape policy-runwrapper.bats uses to
  # pin the policy gate upstream of arc-run's only spawnSync.
  #
  # It is a grep, and a grep is the weakest assertion in this file. It is here because the
  # alternative was an env override that could WIDEN a dispatch, which is a worse thing to add than a
  # weak test is to keep.
  cd "$ARC_ROOT"
  local src=".claude/scripts/engine/drivers/hermes.mjs"
  local guard spawn
  guard="$(grep -n 'refusing to dispatch: .* is not a toolset' "$src" | head -1 | cut -d: -f1)"
  [ -n "$guard" ] || { echo "the unknown-toolset refusal is gone from $src"; false; }
  grep -q 'KNOWN_TOOLSETS.includes' "$src" || { echo "the refusal no longer consults KNOWN_TOOLSETS"; false; }
  spawn="$(grep -n 'spawnSync(' "$src" | tail -1 | cut -d: -f1)"
  [ -n "$spawn" ] || { echo "no spawn site found in $src"; false; }
  [ "$guard" -lt "$spawn" ] || {
    echo "the refusal at line $guard is not upstream of the container spawn at line $spawn"; false; }
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

@test "the gate and the driver never disagree about the same declaration" {
  # THE HOLE AN ADVERSARIAL PASS FOUND, pinned. The first draft required `permissions: declared`
  # before deriving anything, which discarded the tools list of every file marked `unrestricted` --
  # so `kickoff-plan` (unrestricted, six tokens) had the GATE reading a narrow declaration while the
  # DRIVER handed the runtime all seventeen toolsets. Two functions, one field, opposite answers, and
  # the wider one was the enforcement.
  #
  # The invariant is not "they return the same value" -- they speak different vocabularies. It is
  # that they never disagree about DIRECTION: whenever the gate falls back to all eight capabilities
  # (it could not read a narrow claim), the driver must pass no flag; and whenever the gate reads a
  # narrow claim, the driver must narrow too. A row where one narrows and the other widens is the bug.
  run _derive "
    const h = await import('./.claude/scripts/engine/drivers/hermes.mjs');
    const g = await import('./.claude/scripts/hq/lib/policy/run-gate.mjs');
    // CAPABILITIES lives in model.mjs, not run-gate -- derived rather than written as 8, because a
    // literal here would keep passing the day the vocabulary grows a ninth.
    const { CAPABILITIES } = await import('./.claude/scripts/hq/lib/policy/model.mjs');
    const rows = [
      ['declared+empty',          { permissions:'declared',     tools: [] }],
      ['unrestricted+empty',      { permissions:'unrestricted', tools: [] }],
      ['no-permissions+empty',    { tools: [] }],
      ['declared+read',           { permissions:'declared',     tools: ['fs.read'] }],
      ['unrestricted+read',       { permissions:'unrestricted', tools: ['fs.read'] }],
      ['unrestricted+six',        { permissions:'unrestricted', tools: ['fs.read','fs.write','shell.run','git.op','ask.human','agent.invoke'] }],
      ['declared+unknown',        { permissions:'declared',     tools: ['telepathy.invoke'] }],
      ['unrestricted+unknown',    { permissions:'unrestricted', tools: ['telepathy.invoke'] }],
      ['declared+absent',         { permissions:'declared' }],
      ['declared+null',           { permissions:'declared',     tools: null }],
      ['declared+scalar',         { permissions:'declared',     tools: 'everything' }],
      ['declared+mapping',        { permissions:'declared',     tools: [{ 'shell.run': ['x'] }] }],
    ];
    const bad = [];
    for (const [label, doc] of rows) {
      const gateWide = g.declaredCapabilities(doc).size === CAPABILITIES.length;
      const driverWide = h.toolsetsFor(doc) === '';
      if (gateWide !== driverWide) bad.push(label + '(gateWide=' + gateWide + ',driverWide=' + driverWide + ')');
    }
    console.log(bad.length ? 'DISAGREE: ' + bad.join(' ') : 'all ' + rows.length + ' shapes agree on direction');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == "all "*" shapes agree on direction" ]]
}

@test "the three readers of the tools vocabulary have no UNPINNED drift between them" {
  # There are three tables keyed by the same `tools:` tokens: the gate's TOOL_CAPABILITIES, this
  # driver's TOOLSET_FOR, and the adapter's TOOL_MAP which renders the interactive command files.
  # An adversarial pass found `web.search` present in the adapter and absent from the other two --
  # pre-existing, harmless today (an unclassified token makes the gate declare everything, so the run
  # is denied before any driver acts) and NOT silently tolerated: it is pinned by name here.
  #
  # Classifying it is a policy decision, not a tidy-up: adding `web.search` to TOOL_CAPABILITIES
  # would WIDEN it from all-eight to one capability, and that belongs in a reviewed diff with an ADR.
  # What this test buys is that the NEXT drift fails instead of joining it.
  run _derive "
    const h = await import('./.claude/scripts/engine/drivers/hermes.mjs');
    const g = await import('./.claude/scripts/hq/lib/policy/run-gate.mjs');
    const a = await import('./.claude/scripts/engine/adapters/claude-code.mjs');
    const gate = new Set(Object.keys(g.TOOL_CAPABILITIES));
    const drv  = new Set(Object.keys(h.TOOLSET_FOR));
    const adp  = new Set(Object.keys(a.TOOL_MAP ?? {}));
    const KNOWN_GAP = new Set(['web.search']);
    const diff = [];
    for (const t of adp) if (!gate.has(t) && !KNOWN_GAP.has(t)) diff.push('adapter-only:' + t);
    for (const t of gate) if (!drv.has(t)) diff.push('gate-only:' + t);
    for (const t of drv) if (!gate.has(t)) diff.push('driver-only:' + t);
    // The known gap must still BE a gap -- if it gets classified, this test must be updated rather
    // than quietly keep excusing a token that no longer needs excusing.
    for (const t of KNOWN_GAP) if (gate.has(t)) diff.push('stale-waiver:' + t);
    console.log(diff.length ? 'DRIFT: ' + diff.join(' ') : 'gate=' + gate.size + ' driver=' + drv.size + ' adapter=' + adp.size + ' no unpinned drift');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"no unpinned drift" ]]
}

# ---------------------------------------------------------------------------
# What the runtime is TOLD -- the other half of the same declaration
# ---------------------------------------------------------------------------

@test "the prompt carries the process BRIEF and its output contract, not just the process name" {
  # THE CONFOUND THAT COST THIS CYCLE FOUR SESSIONS. This driver's prompt was three lines -- the
  # process NAME, "reply with one JSON document", and the input. No body, no contract, not one field
  # name. `$.draft: required property is absent` was the only honest thing the runtime could produce,
  # because nothing had ever told it the contract HAS a `draft`. `drivers/claude-code.mjs` has always
  # sent `doc.body`; nothing compared the two.
  #
  # Isolated 2026-08-19, one variable at a time, same pack and image and key:
  #   thin prompt + all 17 toolsets   fail        thin prompt + `-t vision`      fail
  #   full prompt + `-t vision`       a draft     full prompt + all 17 toolsets  a draft
  # The toolsets were never the answer-reliability cause; ADR-0224 says so now, amended.
  run --separate-stderr bash "$DRIVER" run build-in-public-draft '{"pack_ref":"p","pack":"PACKMARKER"}' min=5
  [ "$status" -eq 0 ] || { echo "$output"; echo "$stderr"; false; }
  read_argv
  local p; p="$(prompt_value)"
  [ -n "$p" ] || { echo "no -z prompt in the argv at all"; false; }
  # The BRIEF itself, by a line only the process body contains.
  [[ "$p" == *"Draft ONE short build-in-public post"* ]] || {
    echo "the process brief did not reach the runtime; prompt was: ${p:0:200}"; false; }
  # And every field of the output contract it is being asked to satisfy.
  local missing=""
  for k in draft sources task-class pack-ref; do
    case "$p" in *"$k"*) ;; *) missing="$missing $k";; esac
  done
  [ -z "$missing" ] || { echo "the prompt never names these contract fields:$missing"; false; }
  # POSITIVE control that the input still rides along -- a brief with no input is the opposite bug.
  [[ "$p" == *"PACKMARKER"* ]] || { echo "the input did not reach the runtime"; false; }
}

@test "NEGATIVE CONTROL -- a process with no brief still runs, falls back, and SAYS so" {
  # `demo` and every fixture process have no canonical file. Refusing them would break the suites and
  # is the gate's job anyway. What must not happen is the SILENT fallback that hid the bug above for
  # four sessions, so the thin prompt is announced.
  run --separate-stderr bash "$DRIVER" run demo '{"q":1}' min=5
  [ "$status" -eq 0 ] || { echo "$output"; echo "$stderr"; false; }
  local said="$stderr"
  read_argv
  local p; p="$(prompt_value)"
  [[ "$p" == *"You are executing the arc process"* ]] || { echo "unexpected fallback prompt: ${p:0:120}"; false; }
  [[ "$said" == *"NO PROCESS BRIEF for demo"* ]] || { echo "the missing brief was silent: $said"; false; }
}

@test "the canonical document is read exactly ONCE per dispatch" {
  # The prompt and the toolset allowlist both derive from it. Two reads is the shape that let the
  # gate validate one copy while the dispatch used another -- already fixed once in this driver and
  # in two others, so it is pinned rather than remembered.
  cd "$ARC_ROOT"
  local n; n="$(grep -c 'await canonicalDoc(processName)' .claude/scripts/engine/drivers/hermes.mjs)"
  [ "$n" -eq 1 ] || { echo "canonicalDoc is called $n times in hermes.mjs, expected exactly 1"; false; }
}

@test "this file registered every test it declares" {
  [ "${#BATS_TEST_NAMES[@]}" -eq 14 ] || {
    echo "registered ${#BATS_TEST_NAMES[@]} tests, expected 14 -- a @test was silently dropped"
    false
  }
}
