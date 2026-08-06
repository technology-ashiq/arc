#!/usr/bin/env bats
# Phase 00 -- authorizeAction, the decision function.
#
# The decision is THREE-VALUED, not a boolean: deny (L0) / propose (L1, prepared and recorded but
# never executed) / execute (L2 within bound, or L3). A binary allow-or-deny would collapse L1
# into either a synonym for deny -- killing the born-at-L1 climb the whole trust model rests on --
# or into a lie.
#
# The filesystem tests build REAL objects (hardlinks, symlinks, nested dirs) in a temp tree. A
# string-only test of a filesystem-identity check is the vacuous pass this phase exists to avoid:
# it would still pass if the identity comparison never ran.
#
# ASCII-only test names; the file asserts its own registered count at the bottom.
bats_require_minimum_version 1.5.0
load 'test_helper'

_node() { cd "$ARC_ROOT" && node --input-type=module -e "$1"; }

# Shared preamble. `A` runs one authorization against a policy built from `mk()` and returns
# "decision:effective" so a test pins both, never just the verdict.
PRE='const P = await import("./.claude/scripts/hq/lib/policy/index.mjs");
const CAPS = ["read","write","shell","network","message","publish","deploy","spend"];
const base = (over={}) => {
  const k = { e2: [], read:{level:"L3"}, write:{level:"L0"}, shell:{level:"L0"},
              network:{level:"L0"}, message:{level:"L0"}, publish:{level:"L0"},
              deploy:{level:"L0"}, spend:{level:"L0"}, ...over };
  return { version:1,
    constitution:{version:"1.0",sha256:"x",receipt:"r"},
    levels:{L0:"denied",L1:"propose",L2:"bounded",L3:"unbounded"},
    ungrantable_actions:[],
    ungrantable_resources:[".claude/settings.json",".claude/settings.local.json",".claude/hooks/**","hq.policy.yaml"],
    targets:{message:[],publish:[],deploy:[]},
    argv0_classes:{ node:{class:"interpreter",reproduces:["*"]},
                    git:{class:"vcs",reproduces:["write","network"]},
                    bats:{class:"narrow",reproduces:[]} },
    kinds:{ "session:interactive": k } };
};
const raise = (capability, to) => ({ id:"01JQ8XZ9K0ABCDEFGH00000001", kind:"policy.level.changed",
  ts:"2026-08-06T10:00:00+05:30",
  payload:{ action_kind:"session:interactive", capability, correlation:"r-t",
            decision_ref:"01JQ8XZ9K0ABCDEFGH00000002", from_level:"L1",
            policy_hash:"0000", to_level:to, trial_ledger_ref:"docs/trial-ledger.md#t" } });
const A = (capability, resource, over={}, events=[]) => {
  const r = P.authorizeAction({ kind:"session:interactive", capability, resource },
                              { policy: base(over), events });
  return r.decision + ":" + r.effective;
};'

@test "authorizeAction denies a write to a hardlink of settings.json" {
  # The named red-first test. It creates a REAL hardlink, so it can only pass if the
  # dev+ino identity comparison actually ran -- a path-string check would allow it.
  # The temp dir MUST be on the same volume as the repo: a hardlink cannot cross devices, and
  # on the Windows runner the checkout is on D: while os.tmpdir() is on C: -- EXDEV, every time.
  # BATS_TEST_TMPDIR sits beside the checkout, so it is the right base on all three legs.
  run _node "$PRE
    const fs = await import('node:fs'); const os = await import('node:os'); const p = await import('node:path');
    const base = process.env.BATS_TEST_TMPDIR || os.tmpdir();
    const dir = fs.mkdtempSync(p.join(base, 'pol-'));
    const link = p.join(dir, 'innocent.json');
    fs.linkSync('.claude/settings.json', link);
    console.log(A('write', link, { write:{level:'L3'} }, [raise('write','L3')]));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == deny:* ]]
}

@test "every pair is born at L1 and returns propose, not execute" {
  run _node "$PRE console.log(A('write', 'tmp/x', { write:{level:'L2', roots:['tmp/**']} }));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "propose:L1" ]
}

@test "a level change event in the stream raises the pair to execute" {
  run _node "$PRE console.log(A('write', 'tmp/x', { write:{level:'L2', roots:['tmp/**']} }, [raise('write','L2')]));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "execute:L2" ]
}

@test "L0 denies and no bound is consulted" {
  run _node "$PRE console.log(A('network', 'example.com'));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "deny:L0" ]
}

@test "a write outside the declared roots is denied even at L2" {
  run _node "$PRE console.log(A('write', 'elsewhere/x', { write:{level:'L2', roots:['tmp/**']} }, [raise('write','L2')]));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == deny:* ]]
}

@test "a kind absent from the file can read and do nothing else" {
  run _node "$PRE
    const r1 = P.authorizeAction({kind:'process:ghost', capability:'read', resource:'x'}, {policy:base(), events:[]});
    const r2 = P.authorizeAction({kind:'process:ghost', capability:'write', resource:'x'}, {policy:base(), events:[]});
    console.log(r1.decision + '/' + r2.decision);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"/deny"* ]]
}

@test "an interpreter in argv0_allow caps shell at the minimum of what it reproduces" {
  # node reproduces everything, and network is L0, so shell collapses to L0 -- ADR-0507.
  run _node "$PRE console.log(A('shell', 'node -e 1',
    { shell:{level:'L3', argv0_allow:['node','bats']} }, [raise('shell','L3')]));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "deny:L0" ]
}

@test "the same grant with only narrow programs is not capped" {
  run _node "$PRE console.log(A('shell', 'bats tests',
    { shell:{level:'L2', argv0_allow:['bats']} }, [raise('shell','L2')]));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "execute:L2" ]
}

@test "node -e writing a guarded path is denied -- the bypass ADR-0507 exists to close" {
  run _node "$PRE console.log(A('shell', 'node -e \"require(0).writeFileSync(1,2)\"',
    { shell:{level:'L3', argv0_allow:['node']}, write:{level:'L3'}, network:{level:'L3'},
      read:{level:'L3'}, message:{level:'L3'}, publish:{level:'L3'}, deploy:{level:'L3'} },
    [raise('shell','L3')]));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # spend stays L0, so the interpreter drags shell to L0 whatever else is granted.
  [ "$output" = "deny:L0" ]
}

@test "a chained shell command is rejected outright" {
  run _node "$PRE console.log(A('shell', 'bats tests; rm -rf /',
    { shell:{level:'L2', argv0_allow:['bats']} }, [raise('shell','L2')]));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == deny:* ]]
}

@test "an argv0 outside the allowlist is denied" {
  run _node "$PRE console.log(A('shell', 'curl example.com',
    { shell:{level:'L2', argv0_allow:['bats']} }, [raise('shell','L2')]));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == deny:* ]]
}

@test "a create at a guarded path is denied although it has no inode yet" {
  run _node "$PRE console.log(A('write', '.claude/hooks/99-evil.sh',
    { write:{level:'L3'} }, [raise('write','L3')]));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == deny:* ]]
}

@test "a path traversal that lands on a guarded file is denied" {
  run _node "$PRE console.log(A('write', 'tmp/../.claude/settings.json',
    { write:{level:'L2', roots:['tmp/**']} }, [raise('write','L2')]));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == deny:* ]]
}

@test "a guarded path that does not exist in this checkout never throws" {
  # .claude/settings.local.json is gitignored and often absent. An uncaught throw here would
  # surface as a non-2 exit, which is one of ADR-0501's four fail-open modes.
  run _node "$PRE console.log(A('write', 'tmp/ok', { write:{level:'L2', roots:['tmp/**']} }, [raise('write','L2')]));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "execute:L2" ]
}

@test "a symlink to a guarded file is denied" {
  run _node "$PRE
    const fs = await import('node:fs'); const os = await import('node:os'); const p = await import('node:path');
    const base = process.env.BATS_TEST_TMPDIR || os.tmpdir();
    const dir = fs.mkdtempSync(p.join(base, 'pol-'));
    const link = p.join(dir, 'ln.json');
    let made = true;
    try { fs.symlinkSync(p.resolve('.claude/settings.json'), link); } catch { made = false; }
    if (!made) { console.log('deny:skip'); }
    else console.log(A('write', link, { write:{level:'L3'} }, [raise('write','L3')]));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == deny:* ]]
}

@test "a decision always carries a reason" {
  run _node "$PRE
    const r = P.authorizeAction({kind:'session:interactive', capability:'network', resource:'x'},
                                {policy:base(), events:[]});
    console.log(typeof r.reason === 'string' && r.reason.length > 0 ? 'has-reason' : 'MISSING');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "has-reason" ]
}

@test "authorizeAction reads no file of its own -- every input is injected" {
  # If it opened hq.policy.yaml itself, Phase 1 would not be wiring, it would be a rewrite.
  run bash -c "cd '$ARC_ROOT' && grep -nE 'readFileSync\\(|readFile\\(' .claude/scripts/hq/lib/policy/authorize.mjs | grep -v 'ungrantable\\|identity' || true"
  [ -z "$output" ]
}

@test "this file registered every test it declares" {
  [ "${#BATS_TEST_NAMES[@]}" -eq 18 ] || {
    echo "registered ${#BATS_TEST_NAMES[@]} tests, expected 18 -- a @test was silently dropped"
    false
  }
}
