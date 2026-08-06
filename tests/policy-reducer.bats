#!/usr/bin/env bats
# Phase 00 -- resolveEffectivePolicy, the two-key state machine (POL-C, ADR-0505).
#
# Authority is keyed per (action kind, capability) PAIR. effective = min(ceiling, cap).
# Birth cap = min(ceiling, L1): every pair starts at propose and climbs only by a human decision.
# A demotion bites from the EFFECTIVE level, so a cap sitting above a lower ceiling can never
# absorb it into a no-op -- that no-op was found in design review and is pinned here.
#
# ORDER: line order in the stream is spine append order and is the only ordering the reducer may
# use. `ts` is carried for humans and must never be sorted on -- the race test proves it by
# putting the LATER timestamp first in the stream.
#
# ASCII-only test names; the file asserts its own registered count at the bottom.
bats_require_minimum_version 1.5.0
load 'test_helper'

_node() { cd "$ARC_ROOT" && node --input-type=module -e "$1"; }

PRE='const P = await import("./.claude/scripts/hq/lib/policy/index.mjs");
const policy = (over={}) => ({ version:1, constitution:{version:"1.0",sha256:"x",receipt:"r"},
  levels:{L0:"d",L1:"p",L2:"b",L3:"u"}, ungrantable_actions:[], ungrantable_resources:[],
  targets:{message:[],publish:[],deploy:[]}, argv0_classes:{},
  kinds:{ "session:interactive": { e2:[], read:{level:"L3"}, write:{level:"L2"},
    shell:{level:"L0"}, network:{level:"L2"}, message:{level:"L0"}, publish:{level:"L0"},
    deploy:{level:"L0"}, spend:{level:"L0"}, ...over } } });
let n = 0;
const ev = (kind, payload, ts) => ({ id:"01JQ8XZ9K0ABCDEFGH" + String(++n).padStart(8,"0"),
  kind, ts: ts || "2026-08-06T10:00:00+05:30", payload });
const up = (capability, to, ts) => ev("policy.level.changed", { action_kind:"session:interactive",
  capability, correlation:"r-t", decision_ref:"01JQ8XZ9K0ABCDEFGH00000002", from_level:"L1",
  policy_hash:"0000", to_level:to, trial_ledger_ref:"docs/trial-ledger.md#t" }, ts);
const down = (capability, from, to, ts) => ev("policy.demoted", { action_kind:"session:interactive",
  capability, correlation:"r-t", from_level:from, incident_ref:"01JQ8XZ9K0ABCDEFGH00000003",
  policy_hash:"0000", to_level:to }, ts);
const R = (capability, events, over={}) => {
  const r = P.resolveEffectivePolicy("session:interactive", capability, { policy: policy(over), events });
  return r.ceiling + "/" + r.cap + "/" + r.effective;
};'

@test "with no events a pair is born at min of ceiling and L1" {
  run _node "$PRE console.log(R('write', []));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "L2/L1/L1" ]
}

@test "a ceiling of L0 wins over the L1 birth cap" {
  run _node "$PRE console.log(R('shell', []));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "L0/L1/L0" ]
}

@test "a level change raises the cap for that pair" {
  run _node "$PRE console.log(R('write', [up('write','L2')]));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "L2/L2/L2" ]
}

@test "a demotion bites one level down from the effective level" {
  run _node "$PRE console.log(R('write', [up('write','L2'), down('write','L2','L1')]));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "L2/L1/L1" ]
}

@test "a cap above a lowered ceiling still demotes -- the no-op bite is closed" {
  # cap L3 against ceiling L1: effective is L1, so the bite must land on L0, not on L2.
  run _node "$PRE console.log(R('write', [up('write','L3'), down('write','L1','L0')], { write:{level:'L1'} }));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "L1/L0/L0" ]
}

@test "two incidents in one run demote twice, the second from the already demoted level" {
  run _node "$PRE console.log(R('write', [up('write','L2'), down('write','L2','L1'), down('write','L1','L0')]));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "L2/L0/L0" ]
}

@test "a demotion never falls below L0" {
  run _node "$PRE console.log(R('write', [down('write','L1','L0'), down('write','L0','L0')]));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "L2/L0/L0" ]
}

@test "append order decides a race, never the timestamp" {
  # The demotion carries the LATER wall-clock time but appears FIRST in the stream. Append order
  # must win, so the promotion that follows it is the final state. A reducer that sorts by ts
  # returns L1 here and fails.
  run _node "$PRE console.log(R('write', [
    down('write','L1','L0','2026-08-06T23:59:00+05:30'),
    up('write','L2','2026-08-06T00:00:01+05:30')]));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "L2/L2/L2" ]
}

@test "a network incident leaves the same kind write cap untouched" {
  run _node "$PRE
    const events = [up('write','L2'), up('network','L2'), down('network','L2','L1')];
    console.log(R('write', events) + ' ' + R('network', events));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "L2/L2/L2 L2/L1/L1" ]
}

@test "events for another action kind are ignored" {
  run _node "$PRE
    const other = up('write','L3'); other.payload.action_kind = 'process:somebody-else';
    console.log(R('write', [other]));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "L2/L1/L1" ]
}

@test "replaying the same stream yields the same effective level" {
  run _node "$PRE
    const s = [up('write','L2'), down('write','L2','L1'), up('write','L2')];
    const a = R('write', s), b = R('write', s), c = R('write', s.slice());
    console.log(a === b && b === c ? 'deterministic:' + a : 'DRIFT:' + a + b + c);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "deterministic:L2/L2/L2" ]
}

@test "the committed reducer fixtures replay to their expected results" {
  run _node 'const P = await import("./.claude/scripts/hq/lib/policy/index.mjs");
    const fs = await import("node:fs"); const path = await import("node:path");
    const dir = "tests/fixtures/policy/reducer";
    const streams = fs.readdirSync(dir).filter(f => f.endsWith(".jsonl")).sort();
    if (streams.length === 0) { console.log("NO-FIXTURES"); process.exit(1); }
    let checked = 0;
    for (const f of streams) {
      const events = fs.readFileSync(path.join(dir, f), "utf8").split("\n")
        .filter(l => l.trim()).map(l => JSON.parse(l));
      const exp = JSON.parse(fs.readFileSync(path.join(dir, f.replace(/\.jsonl$/, ".expected.json")), "utf8"));
      const pol = JSON.parse(fs.readFileSync(path.join(dir, f.replace(/\.jsonl$/, ".policy.json")), "utf8"));
      for (const row of (Array.isArray(exp) ? exp : [exp])) {
        const r = P.resolveEffectivePolicy(row.action_kind, row.capability, { policy: pol, events });
        if (r.ceiling !== row.ceiling || r.cap !== row.cap || r.effective !== row.effective)
          throw new Error(f + " " + row.capability + " => " + JSON.stringify(r) + " expected " + JSON.stringify(row));
        checked++;
      }
    }
    console.log("replayed " + streams.length + " streams, " + checked + " pairs");'
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"replayed"* ]]
}

@test "this file registered every test it declares" {
  [ "${#BATS_TEST_NAMES[@]}" -eq 13 ] || {
    echo "registered ${#BATS_TEST_NAMES[@]} tests, expected 13 -- a @test was silently dropped"
    false
  }
}
