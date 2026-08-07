#!/usr/bin/env bats
# Phase 01 -- the headless gate (REQ-02, REQ-03).
#
# arc-run consults policy BEFORE any driver is invoked, at ONE call site, and a denial produces
# no side effect: the driver process never starts.
#
# What this phase hardens is a declaration that declared nothing. `processes/*.process.yaml`
# carries `permissions: unrestricted | declared` and a `tools:` list, and until now neither was
# validated against anything -- the engine cycle's own adversarial pass found the same shape from
# the other side (a forged `allowed-tools:` grant; `permissions: declared` with only `ask.human`
# meaning unrestricted).
#
# THE GATE IS COARSE ON PURPOSE. It blocks a run that declares a capability policy denies
# outright (L0) and permits at L1 or above, because L1 means "prepare and record, never perform"
# -- and a headless run producing a proposal IS that. The per-action question (may THIS write
# land) belongs to authorizeAction at the tool boundary, which is Phase 2. Collapsing the two
# would either brick the runner or wave through every write inside a run allowed to start.
#
# ASCII-only test names; the file asserts its own registered count at the bottom.
bats_require_minimum_version 1.5.0
load 'test_helper'

_node() { cd "$ARC_ROOT" && node --input-type=module -e "$1"; }

# A copy of the repo's own policy in which the kind `process:denied` exists and its write is L0.
#
# This was two `sed` expressions -- a `0,/re/` range plus an empty `s//.../` regex -- and both are
# traps. BSD sed rejects a line-0 address outright, and `//` means "the last regex USED", which on
# CI resolved to the RENAME expression rather than the range's. The write line was therefore never
# lowered: `process:denied` kept its L2 grant, the gate correctly permitted the run, and the two
# end-to-end tests below reported a fail-open that did not exist. A fixture that quietly fails to
# deny is a pass generator pointed the other way -- it makes a WORKING gate look broken, and next
# time it will make a broken one look fine.
#
# One awk pass, no implicit state, and it asserts its own output before any caller trusts it.
_denying_policy() {
  awk '
    /^  "process:kickoff-plan":/ { print "  \"process:denied\":"; inblock = 1; next }
    /^  [^ ]/                    { inblock = 0 }
    inblock && /^    write:/     { print "    write: { level: L0 }"; next }
    { print }
  ' "$ARC_ROOT/hq.policy.yaml" > "$1"
  grep -q '"process:denied":' "$1" || {
    echo "fixture policy carries no process:denied kind -- the rename did not apply"; return 1; }
  # SCOPED to that kind's own block. A bare `grep 'level: L0'` over the whole file is satisfied by
  # process:commit-msg-draft, which is already L0 -- an assertion that holds whether or not the
  # edit landed, which is the same class of nothing-measured this helper exists to remove.
  grep -A4 '"process:denied":' "$1" | grep -q 'write: { level: L0 }' || {
    echo "fixture policy does not deny process:denied/write -- the L0 edit did not apply"; return 1; }
}

PRE='const G = await import("./.claude/scripts/hq/lib/policy/run-gate.mjs");
const { parseYamlSubset } = await import("./.claude/scripts/engine/yaml-subset.mjs");
const fs = await import("node:fs");
const pol = (over={}) => ({ version:1, constitution:{version:"1.0",sha256:"x",receipt:"r"},
  levels:{L0:"d",L1:"p",L2:"b",L3:"u"}, ungrantable_actions:[],
  ungrantable_resources:[".claude/settings.json",".claude/hooks/**","hq.policy.yaml"],
  targets:{message:[],publish:[],deploy:[]}, argv0_classes:{},
  kinds:{ "process:demo": { e2:[], read:{level:"L3"}, write:{level:"L1"}, shell:{level:"L1"},
    network:{level:"L1"}, message:{level:"L0"}, publish:{level:"L0"}, deploy:{level:"L0"},
    spend:{level:"L0"}, ...over } } });
const run = (doc, over={}, events=[]) =>
  G.authorizeRun({ processName:"demo", doc, root: process.cwd(), policy: pol(over), events });'

@test "a process declaring only what policy grants may invoke" {
  run _node "$PRE
    const g = run({ permissions:'declared', tools:['fs.read','fs.write'] });
    console.log(g.mayInvoke + ' denials=' + g.denials.length);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "true denials=0" ]
}

@test "a process declaring a capability policy denies outright is blocked" {
  run _node "$PRE
    const g = run({ permissions:'declared', tools:['fs.read','fs.write'] }, { write:{level:'L0'} });
    console.log(g.mayInvoke + ' ' + g.denials.map(d => d.capability).join(','));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "false write" ]
}

@test "an unknown tool token declares everything -- deny-by-default on the declaration itself" {
  run _node "$PRE
    const g = run({ permissions:'declared', tools:['fs.read','telepathy.invoke'] });
    console.log(g.declared.length + ' ' + g.mayInvoke);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # All eight declared, and spend/message/publish/deploy are L0, so it cannot invoke.
  [ "$output" = "8 false" ]
}

@test "an empty tools list declares everything rather than nothing" {
  run _node "$PRE console.log(run({ permissions:'declared', tools:[] }).declared.length);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "8" ]
}

@test "a tool entry that parses as a mapping does not throw" {
  # A real process file carries `shell.run:` with a sub-block, which the parser returns as an
  # object. Stringifying it threw a TypeError out of the gate -- and a gate that dies is a gate
  # that does not deny.
  run _node "$PRE
    const g = run({ permissions:'declared', tools:[{ 'shell.run': { note:'x' } }, 'fs.read'] });
    console.log(g.declared.join(','));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "read,shell" ]
}

@test "git.op declares network as well as shell, because git fetches" {
  run _node "$PRE console.log(run({ permissions:'declared', tools:['git.op'] }).declared.join(','));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "network,shell" ]
}

@test "ask.human is not a capability the machine holds" {
  run _node "$PRE console.log(run({ permissions:'declared', tools:['ask.human'] }).declared.length);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "0" ]
}

@test "a root with no policy file is NOT IN FORCE, and says so" {
  # The one place the deny-by-default reflex is wrong. Deny-by-default is a rule INSIDE a policy
  # file -- an absent action kind is read-only -- not a rule about the file's own absence. A root
  # that never adopted policy has declared nothing, so refusing to run would brick every consumer
  # repo and every test fixture that copies the scripts into a temp dir. What keeps this from
  # being a fail-open: where policy IS in force, hq.policy.yaml is un-grantable (ADR-0502), so no
  # policed write can delete it to reach this branch -- and the runner announces it out loud.
  run _node "$PRE
    const g = G.authorizeRun({ processName:'demo', doc:{permissions:'declared',tools:['fs.write']},
      root: process.cwd(), policy: null, events: [] });
    console.log(g.inForce + '/' + g.mayInvoke + '/' + (g.reason || '').includes('not in force'));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "false/true/true" ]
}

@test "arc-run announces an unpoliced run rather than passing quietly" {
  cd "$ARC_ROOT"
  grep -q "this run is unpoliced" .claude/scripts/engine/arc-run.mjs || {
    echo "arc-run does not announce that policy is not in force -- a disarmed guard must never be silent"
    false
  }
}

@test "with a policy file present an unlisted kind is still deny-by-default" {
  # The rule that DOES apply inside a file: a kind nobody listed gets read at L1 and nothing else.
  run _node "$PRE
    const r = G.authorizeRun({ processName:'ghost', doc:{permissions:'declared',tools:['fs.read']},
      root: process.cwd(), policy: pol(), events: [] });
    const w = G.authorizeRun({ processName:'ghost', doc:{permissions:'declared',tools:['fs.write']},
      root: process.cwd(), policy: pol(), events: [] });
    console.log(r.mayInvoke + '/' + w.mayInvoke + '/' + w.denials[0].capability);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "true/false/write" ]
}

@test "a demotion event lands on the gate without restarting the run" {
  run _node "$PRE
    const demote = { id:'01JQ8XZ9K0ABCDEFGH00000001', kind:'policy.demoted',
      ts:'2026-08-06T10:00:00+05:30',
      payload:{ action_kind:'process:demo', capability:'write', correlation:'r',
                from_level:'L1', incident_ref:'01JQ8XZ9K0ABCDEFGH00000002', policy_hash:'0', to_level:'L0' } };
    const before = run({ permissions:'declared', tools:['fs.write'] });
    const after  = run({ permissions:'declared', tools:['fs.write'] }, {}, [demote]);
    console.log(before.mayInvoke + '->' + after.mayInvoke);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "true->false" ]
}

@test "the cross-check warns that permissions unrestricted narrows nothing" {
  run _node "$PRE
    const w = G.crossCheckDeclared({ processName:'demo', doc:{permissions:'unrestricted',tools:['fs.read']},
      policy: pol(), events: [], root: process.cwd() });
    console.log(w.length > 0 && w[0].includes('narrows nothing') ? 'warned' : 'SILENT');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "warned" ]
}

@test "the cross-check is advisory and returns nothing when there is no policy" {
  run _node "$PRE
    console.log(G.crossCheckDeclared({ processName:'demo', doc:{permissions:'declared',tools:['fs.write']},
      policy: null, events: [], root: process.cwd() }).length);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "0" ]
}

@test "every process in the repo passes its own gate" {
  # The gate must not brick the runner. If a real process is blocked, either the policy file is
  # wrong about what that process does, or the process declares something it should not -- and
  # either way this test is where it surfaces, not in someone's failed run.
  run _node "$PRE
    const names = fs.readdirSync('processes').filter(f => f.endsWith('.process.yaml'))
      .map(f => f.replace(/\\.process\\.yaml\$/, ''));
    if (names.length === 0) throw new Error('no processes found -- this test would pass vacuously');
    const blocked = [];
    for (const n of names) {
      const doc = parseYamlSubset(fs.readFileSync('processes/' + n + '.process.yaml','utf8')).value;
      const g = G.authorizeRun({ processName: n, doc, root: process.cwd() });
      if (!g.mayInvoke) blocked.push(n + '(' + g.denials.map(d=>d.capability).join(',') + ')');
    }
    console.log(blocked.length ? 'BLOCKED: ' + blocked.join(' ') : 'all ' + names.length + ' processes pass');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == "all "*" processes pass" ]]
}

@test "arc-run calls the gate before it spawns, at exactly one call site" {
  # The architecture claim, asserted rather than described: one gate, and it is upstream of the
  # only spawnSync. A second driver path is a Phase-4 kill-criterion finding, so it is searched
  # for here rather than hoped about.
  cd "$ARC_ROOT"
  local spawns; spawns="$(grep -c 'spawnSync("bash", \[sh' .claude/scripts/engine/arc-run.mjs)"
  [ "$spawns" -eq 1 ] || { echo "expected exactly 1 driver spawn site, found $spawns"; false; }
  local gate_line spawn_line
  gate_line="$(grep -n 'policyGate(name)' .claude/scripts/engine/arc-run.mjs | tail -1 | cut -d: -f1)"
  spawn_line="$(grep -n 'spawnSync("bash", \[sh' .claude/scripts/engine/arc-run.mjs | cut -d: -f1)"
  [ -n "$gate_line" ] && [ "$gate_line" -lt "$spawn_line" ] || {
    echo "the policy gate at line $gate_line is not upstream of the driver spawn at $spawn_line"; false; }
}

@test "the gate fails closed when the policy check throws" {
  # ADR-0028's fail-safe precedent: a check that breaks blocks. "The check threw, so we ran it
  # anyway" is the entire failure class this build exists to remove.
  cd "$ARC_ROOT"
  run grep -A3 "catch (e)" .claude/scripts/engine/arc-run.mjs
  [ "$status" -eq 0 ]
  grep -q "fail-closed" .claude/scripts/engine/arc-run.mjs || {
    echo "arc-run's policy gate has no fail-closed catch"; false; }
}

@test "END TO END -- arc-run refuses a denied process and the driver never runs" {
  # THE TEST THIS SUITE DID NOT HAVE. Everything else here proves the library or greps the
  # source; not one test executed arc-run. An adversarial pass changed `if (blocked)` to
  # `if (blocked && false)` -- a fail-open wiring that ignores the gate entirely -- and all
  # three guarding assertions stayed green while the driver ran. Textual ordering is not
  # evidence that a gate is wired.
  #
  # The governing policy root is derived from the module's own location, so copying the scripts
  # into a temp root makes THAT root's policy the law -- which is how a denying policy can be
  # tested without touching the repo's own.
  local d; d="$(mktemp -d)"
  mkdir -p "$d/processes" "$d/.claude"
  cp -r "$ARC_ROOT/.claude/scripts" "$d/.claude/"

  # A process that declares a write, and a policy that denies write for its kind.
  cat > "$d/processes/denied.process.yaml" <<'EOF'
name: denied
version: 1.0.0
permissions: declared
inputs: []
tools:
  - fs.write
output:
  type: object
EOF
  _denying_policy "$d/hq.policy.yaml" || return 1

  # A driver that writes a marker if it ever starts. Its absence is the assertion.
  cat > "$d/.claude/scripts/engine/drivers/claude-code.sh" <<'EOF'
#!/usr/bin/env bash
echo "DRIVER-RAN" > "$(dirname "$0")/../../../../DRIVER-RAN.txt"
echo '{"ok":true}'
EOF
  chmod +x "$d/.claude/scripts/engine/drivers/claude-code.sh" 2>/dev/null || true

  run node "$d/.claude/scripts/engine/arc-run.mjs" --process denied --driver claude-code --root "$d"
  [ "$status" -ne 0 ] || { echo "arc-run exited 0 on a denied process"; echo "$output"; false; }
  # NO SIDE EFFECT: the marker proves the driver started, so its absence is the property.
  [ ! -f "$d/DRIVER-RAN.txt" ] || { echo "the driver RAN despite the denial"; false; }
  # A POSITIVE marker too -- an absence alone is also satisfied by a crash before the gate.
  [[ "$output" == *"policy denied"* ]] || { echo "no policy denial in the output: $output"; false; }
}

@test "END TO END -- a permitted process still reaches its driver" {
  # The other half, and the one that stops the test above from passing against a runner that
  # refuses everything. An absence assertion needs a positive control.
  local d; d="$(mktemp -d)"
  mkdir -p "$d/processes" "$d/.claude"
  cp -r "$ARC_ROOT/.claude/scripts" "$d/.claude/"
  cp "$ARC_ROOT/hq.policy.yaml" "$d/hq.policy.yaml"
  cat > "$d/processes/allowed.process.yaml" <<'EOF'
name: allowed
version: 1.0.0
permissions: declared
inputs: []
tools:
  - fs.read
output:
  type: object
EOF
  cat > "$d/.claude/scripts/engine/drivers/claude-code.sh" <<'EOF'
#!/usr/bin/env bash
echo "DRIVER-RAN" > "$(dirname "$0")/../../../../DRIVER-RAN.txt"
echo '{}'
EOF
  chmod +x "$d/.claude/scripts/engine/drivers/claude-code.sh" 2>/dev/null || true

  run node "$d/.claude/scripts/engine/arc-run.mjs" --process allowed --driver claude-code --root "$d"
  [ -f "$d/DRIVER-RAN.txt" ] || { echo "a permitted process did not reach its driver: $output"; false; }
}

@test "ARC_ROOT cannot move the law -- the governing root is where this code lives" {
  # A one-variable disarm: --root and $ARC_ROOT chose which policy applied, so
  # `ARC_ROOT=/tmp/anywhere` produced an unpoliced run of an attacker-authored process and
  # driver. The work root and the law root are now different things.
  cd "$ARC_ROOT"
  # Assert the PROPERTY, not a directory name: the governing root is not the one ARC_ROOT names,
  # and it is a root that actually carries a policy file. The first version compared against the
  # local checkout's folder name and went red on CI, where the checkout is `D:\a\arc\arc` --
  # the resolution was right and the assertion was parochial.
  run env ARC_ROOT=/tmp/definitely-not-the-repo node --input-type=module -e "
    const G = await import('./.claude/scripts/hq/lib/policy/run-gate.mjs');
    const gov = G.policyRoot().replace(/\\\\/g,'/');
    const moved = gov === '/tmp/definitely-not-the-repo';
    console.log(!moved && !!G.loadPolicyFromDisk() ? 'pinned' : 'MOVED:' + gov);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "pinned" ]
}

@test "a forged policy event cannot raise a cap" {
  # loadPolicyEvents accepted any JSON line whose `kind` matched -- no sha recomputation, no key
  # set, no ULID, no idem. One hand-written line lifted session:interactive write from the L1
  # birth cap to its L2 ceiling, turning propose into execute. It now runs every line through
  # the spine's OWN validator, so a forgery is dropped whether or not the vocabulary carries
  # the kind yet.
  cd "$ARC_ROOT"
  local d; d="$(mktemp -d)"
  mkdir -p "$d/.claude/state/hq/events"
  cat > "$d/.claude/state/hq/events/2026-08-06.jsonl" <<'EOF'
{"id":"01FORGED0000000000000000AA","kind":"policy.level.changed","ts":"2026-08-06T10:00:00+05:30","payload":{"action_kind":"session:interactive","capability":"write","to_level":"L3"}}
EOF
  run node --input-type=module -e "
    const G = await import('./.claude/scripts/hq/lib/policy/run-gate.mjs');
    console.log(G.loadPolicyEvents('$(echo "$d" | sed 's#\\#/#g')').length);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "0" ] || { echo "a forged transition was folded into the cap"; false; }
}

@test "the vocabulary carries the four authority kinds, exactly once each" {
  # ADR-0508. The count is DERIVED, never typed -- ADR-0107's rule, and the reason extending
  # the vocabulary does not go around breaking every sibling lane's count assertion.
  cd "$ARC_ROOT"
  run node --input-type=module -e "
    const { KINDS } = await import('./.claude/scripts/hq/lib/validate.mjs');
    const { POLICY_KINDS } = await import('./.claude/scripts/hq/lib/validate-policy.mjs');
    const missing = POLICY_KINDS.filter(k => !KINDS.includes(k));
    const dup = KINDS.length !== new Set(KINDS).size;
    const once = POLICY_KINDS.every(k => KINDS.filter(x => x === k).length === 1);
    console.log([POLICY_KINDS.length, missing.length ? 'MISSING:' + missing : 'all-present',
                 dup ? 'DUPLICATES' : 'unique', once ? 'once-each' : 'REPEATED'].join(' '));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "4 all-present unique once-each" ]
}

@test "an inherited property name is not a known tool token" {
  run _node "$PRE
    const sizes = ['constructor','toString','valueOf','hasOwnProperty'].map(t =>
      run({ permissions:'declared', tools:[t] }).declared.length);
    console.log(sizes.join(','));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "8,8,8,8" ]
}

@test "a tools mapping with more than one key declares everything" {
  # Taking only the first key meant a second tool was on the page and invisible to the gate --
  # fewer declared capabilities means fewer denials, so the silence widened the grant.
  run _node "$PRE
    console.log(run({ permissions:'declared', tools:[{ 'fs.read':'a', 'shell.run':'b' }] }).declared.length);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "8" ]
}

@test "a policy denial is its own verdict, not a driver fault" {
  # One denial produced three high-severity incidents as the fallback chain retried, and the
  # append-only receipt claimed the driver had failed when no driver had run.
  cd "$ARC_ROOT"
  grep -q 'verdict: "policy"' .claude/scripts/engine/arc-run.mjs || {
    echo "a policy denial still falls through to verdict: driver"; false; }
  grep -q 'reason: "policy"' .claude/scripts/engine/arc-run.mjs || {
    echo "the run receipt does not record a policy outcome"; false; }
}

@test "BYPASS -- a driver invoked DIRECTLY still refuses a denied process" {
  # arc-run is not the only way to start a driver. `bash drivers/claude-code.sh run <p> '{}' ''`
  # reaches runDriver with no wrapper in sight, and the repo's own engine suite does exactly
  # that. A gate with one call site is only sole-entry if nothing else can call the thing it
  # guards -- so the same check lives at runDriver, the one function every driver core funnels
  # through. phase-01-spec lists this as a required bypass fixture.
  local d; d="$(mktemp -d)"
  mkdir -p "$d/processes" "$d/.claude"
  cp -r "$ARC_ROOT/.claude/scripts" "$d/.claude/"
  cat > "$d/processes/denied.process.yaml" <<'EOF'
name: denied
version: 1.0.0
permissions: declared
inputs: []
tools:
  - fs.write
output:
  type: object
EOF
  _denying_policy "$d/hq.policy.yaml" || return 1

  # A REAL recording. ARC_DRIVER_FAKE names a DIRECTORY holding <process>.json, and it was being
  # handed a JSON document -- so the driver died on its own fake-contract check and the exit-code
  # assertion below passed for a reason that had nothing to do with policy. With a valid recording
  # the fixture is a negative control: delete the gate and this run SUCCEEDS, so the test fails.
  mkdir -p "$d/fake"
  echo '{"ok":true}' > "$d/fake/denied.json"

  run env ARC_DRIVER_FAKE="$d/fake" bash "$d/.claude/scripts/engine/drivers/claude-code.sh" run denied '{}' ''
  [ "$status" -ne 0 ] || { echo "the driver ran a denied process when invoked directly"; echo "$output"; false; }
  [[ "$output" == *"policy denied"* ]] || { echo "no policy denial from the direct driver call: $output"; false; }
  [[ "$output" != *'"ok":true'* ]] || { echo "the denied driver still emitted its recording: $output"; false; }
}

@test "BYPASS -- every driver funnels through the gated entry point" {
  # If a new driver core stops calling runDriver, it silently leaves the gate behind. Assert the
  # structure rather than trusting the convention.
  cd "$ARC_ROOT"
  local missing=""
  for core in .claude/scripts/engine/drivers/*.mjs; do
    case "$core" in *common.mjs) continue ;; esac
    grep -q "runDriver" "$core" || missing="$missing $(basename "$core")"
  done
  [ -z "$missing" ] || { echo "driver cores that bypass runDriver:$missing"; false; }
  grep -q "driverPolicyDenial" .claude/scripts/engine/drivers/common.mjs || {
    echo "runDriver does not consult policy"; false; }
}

@test "BYPASS -- a driver in a tree with no policy library still runs" {
  # An older consumer repo or a partial install has no policy library. Refusing there would
  # brick the driver rather than police it -- the same contract arc-run keeps for a root with no
  # policy file.
  #
  # THE FIXTURE WAS THE BUG. It copied three driver files into an otherwise empty tree, so the
  # driver died on a missing `yaml-subset.mjs` long before policy was ever consulted -- and the
  # sole assertion, "the output does not say policy denied", is satisfied by any crash. A green
  # test measuring a stack trace, which is exactly the shape testing.md names. The tree now has
  # everything EXCEPT the policy library, which is the condition the test claims to describe, and
  # a positive assertion proves the driver reached the end.
  local d; d="$(mktemp -d)"
  mkdir -p "$d/.claude" "$d/fake"
  cp -r "$ARC_ROOT/.claude/scripts" "$d/.claude/"
  # Moved rather than deleted: the point is a tree where the module cannot be imported.
  mv "$d/.claude/scripts/hq/lib/policy" "$d/policy-parked"
  echo '{"ok":true}' > "$d/fake/anything.json"

  run env ARC_DRIVER_FAKE="$d/fake" bash "$d/.claude/scripts/engine/drivers/claude-code.sh" run anything '{}' ''
  [ "$status" -eq 0 ] || { echo "a driver with no policy library did not run: $output"; false; }
  [[ "$output" == *'"ok":true'* ]] || { echo "the driver produced no response: $output"; false; }
  [[ "$output" != *"policy denied"* ]] || { echo "a tree with no policy library was denied: $output"; false; }
}

@test "this file registered every test it declares" {
  [ "${#BATS_TEST_NAMES[@]}" -eq 28 ] || {
    echo "registered ${#BATS_TEST_NAMES[@]} tests, expected 28 -- a @test was silently dropped"
    false
  }
}
