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

@test "this file registered every test it declares" {
  [ "${#BATS_TEST_NAMES[@]}" -eq 17 ] || {
    echo "registered ${#BATS_TEST_NAMES[@]} tests, expected 17 -- a @test was silently dropped"
    false
  }
}
