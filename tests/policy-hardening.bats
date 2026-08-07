#!/usr/bin/env bats
# Phase 00 -- the adversarial pass, pinned.
#
# Two fresh agents that had not written the code attacked it on two surfaces (decision logic;
# shell and OS boundary) and between them proved ~24 capability escalations against code that
# was green on its own tests. Every finding is closed, and every finding lives here or in
# tests/fixtures/policy/hostile/ so it can never quietly reopen. This file holds the ones that
# need a REAL filesystem object or a library-level assertion; the rest are corpus rows driven by
# policy-hostile.bats.
#
# The two surfaces overlapped on the three worst findings, which is itself the argument for
# running two: a single agent's blind spot is structural, not a matter of effort.
#
# ASCII-only test names; the file asserts its own registered count at the bottom.
bats_require_minimum_version 1.5.0
load 'test_helper'

_node() { cd "$ARC_ROOT" && node --input-type=module -e "$1"; }

PRE='const P = await import("./.claude/scripts/hq/lib/policy/index.mjs");
const fs = await import("node:fs"); const os = await import("node:os"); const pth = await import("node:path");
const base = (over={}) => ({ version:1, constitution:{version:"1.0",sha256:"x",receipt:"r"},
  levels:{L0:"d",L1:"p",L2:"b",L3:"u"}, ungrantable_actions:[],
  ungrantable_resources:[".claude/settings.json",".claude/settings.local.json",".claude/hooks/**",
    "hq.policy.yaml",".claude/scripts/hq/lib/policy/**",".claude/scripts/hq/policy-lint.mjs"],
  targets:{message:[],publish:[],deploy:[]},
  argv0_classes:{ git:{class:"vcs",reproduces:["write","network"]}, bats:{class:"narrow",reproduces:[]} },
  kinds:{ "session:interactive": { e2:[], read:{level:"L3"}, write:{level:"L0"}, shell:{level:"L0"},
    network:{level:"L0"}, message:{level:"L0"}, publish:{level:"L0"}, deploy:{level:"L0"},
    spend:{level:"L0"}, ...over } } });
let n = 0;
const up = (capability, to) => ({ id:"01JQ8XZ9K0ABCDEFGH"+String(++n).padStart(8,"0"),
  kind:"policy.level.changed", ts:"2026-08-06T10:00:00+05:30",
  payload:{ action_kind:"session:interactive", capability, correlation:"r",
            decision_ref:"01JQ8XZ9K0ABCDEFGH00000002", from_level:"L1", policy_hash:"0",
            to_level:to, trial_ledger_ref:"t" } });
const A = (capability, resource, over={}, events=[]) =>
  P.authorizeAction({kind:"session:interactive", capability, resource}, {policy:base(over), events}).decision;
// INSIDE THE REPO, so a hardlink is same-device by construction. The Windows runner puts the
// checkout on D: and its temp dirs on C: on some shards, and a cross-device EXDEV would make
// this suite skip exactly the checks it exists to pin.
const tmp = () => fs.mkdtempSync(pth.join(process.cwd(), ".pol-tmp-"));
const cleanup = (d) => { try { fs.rmSync(d, { recursive: true, force: true }); } catch {} };'

@test "a parsed mapping has a null prototype, so __proto__ cannot reach a grant" {
  # The worst finding of the pass, and both surfaces found it independently. A `{}` literal
  # accepts __proto__ as a key and assigning it sets the PROTOTYPE: Object.keys never sees it,
  # so the lint never saw it, so the file lint-printed "is law" while granting L3 spend -- and
  # policyHash was identical to the honest file, so the receipt agreed too.
  run _node "$PRE
    const m = P.parsePolicyYaml('a: 1');
    console.log(Object.getPrototypeOf(m) === null ? 'null-proto' : 'INHERITS');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "null-proto" ]
}

@test "a hardlink into a guarded DIRECTORY tree is caught by identity" {
  # The exact case the module's header claims dev+ino was chosen for -- and the one it missed.
  # A hardlink to .claude/settings.json (an exact entry) was caught; a hardlink to
  # .claude/hooks/PreToolUse.sh (a glob entry) was not, because the glob was matched by walking
  # the LINK's parents and by string prefix, both of which a hardlink defeats by construction.
  run _node "$PRE
    const dir = tmp();
    try {
      const link = pth.join(dir, 'looks-fine.sh');
      fs.linkSync('.claude/hooks/PreToolUse.sh', link);
      console.log(A('write', link, { write:{level:'L3'} }, [up('write','L3')]));
    } finally { cleanup(dir); }"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "deny" ]
}

@test "a junction inside an allowed write root cannot escape it" {
  # withinRoots was purely lexical, so a junction at initiatives/esc -> C:\secrets made
  # initiatives/esc/keys.txt look like a legal write that landed outside the repo entirely.
  # The un-grantable list survived (it realpaths); nothing else did.
  run _node "$PRE
    const outside = tmp(); const inside = tmp();
    try {
      fs.writeFileSync(pth.join(outside,'keys.txt'), 'x');
      const link = pth.join(inside, 'esc');
      try { fs.symlinkSync(outside, link, 'junction'); }
      catch (e) { console.log('false:skipped-' + e.code); process.exit(0); }
      console.log(P.withinRoots(pth.join(link,'keys.txt'), [pth.basename(inside) + '/**'], pth.dirname(inside)));
    } finally { cleanup(outside); cleanup(inside); }"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == false* ]]
}

@test "a transition event with no payload throws rather than being dropped" {
  # Dropping a malformed transition always fails PERMISSIVE: a mistyped demotion leaves the cap
  # high and nothing reports it -- ADR-0501's "an event that lands in quarantine is never
  # reported as enforcement success", one layer in.
  run _node "$PRE
    const bad = { id:'01JQ8XZ9K0ABCDEFGH99999999', kind:'policy.demoted' };
    try { P.resolveEffectivePolicy('session:interactive','write',{policy:base(),events:[bad]});
          console.log('SILENTLY-IGNORED'); }
    catch { console.log('threw'); }"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "threw" ]
}

@test "a promotion above the ceiling is clamped at fold time, not stored raw" {
  # Stored raw it was a no-op its reviewer could see -- and a time bomb: a later, unrelated
  # ceiling edit would arm L3 instantly with no second human decision.
  run _node "$PRE
    const r = P.resolveEffectivePolicy('session:interactive','write',
      { policy: base({ write:{level:'L1'} }), events:[up('write','L3')] });
    console.log(r.cap + '/' + r.effective);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "L1/L1" ]
}

@test "policyHash covers the constitution pin and the level table" {
  # policy_hash is what every policy.level.changed carries to say WHICH LAW the decision was
  # made under. Repinning to a different adopted Constitution, or redefining what L2 means,
  # both hashed identically to the honest file.
  run _node "$PRE
    const a = base();
    const b = base(); b.constitution = { version:'9.9', sha256:'different', receipt:'other' };
    const c = base(); c.levels = { L0:'d', L1:'p', L2:'means something else', L3:'u' };
    const ok = P.policyHash(a) !== P.policyHash(b) && P.policyHash(a) !== P.policyHash(c);
    console.log(ok ? 'distinct' : 'COLLIDES');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "distinct" ]
}

@test "an unclassified argv0 reproduces everything, never an implicit narrow" {
  run _node "$PRE console.log(P.reproducedBy(['totally-unknown'], {}).size);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "7" ]
}

@test "a missing CONSTITUTION.md makes a policy file not-law" {
  # Both E2 checks are on the never-cut list, so "is law -- 0 violations" with them skipped is
  # the poster document the build exists to end. It was a stderr warning and an exit 0.
  run _node "$PRE
    const text = fs.readFileSync('hq.policy.yaml','utf8');
    const v = P.lintPolicy(text, { constitutionBuffer: null, processNames: ['kickoff-plan'] });
    console.log(v.length > 0 ? 'refused' : 'DECLARED-LAW-ANYWAY');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "refused" ]
}

@test "decisionForLevel fails closed on a level it does not recognise" {
  run _node "$PRE console.log(P.decisionForLevel('L9'));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "deny" ]
}

@test "the shipped policy classifies bats and git as interpreters" {
  # bats executes arbitrary bash from the file it is handed, and session:interactive may write
  # tests/** -- so classed `narrow`, write-then-run was a complete arbitrary-code path. git -c
  # alias.x=!cmd makes git a general machine the same way.
  run _node "$PRE
    const s = P.parsePolicyYaml(fs.readFileSync('hq.policy.yaml','utf8'));
    const ok = s.argv0_classes.bats.class === 'interpreter' && s.argv0_classes.git.class === 'interpreter'
      && s.argv0_classes.gh.reproduces.includes('publish') && s.argv0_classes.gh.reproduces.includes('deploy');
    console.log(ok ? 'classified' : 'UNDERSTATED');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "classified" ]
}

@test "WRITE ABSENCE ROW -- policy-matrix refuses an un-grantable --out and the file is untouched" {
  # mkdirSync recursive + writeFileSync on an attacker-supplied --out is an arbitrary-path write
  # primitive living inside the policy engine itself.
  #
  # The exit code and the message prove the guard RAN and reached its decision. They do not prove
  # the write did not happen -- a guard that refuses AFTER writing would satisfy both. This is
  # phase-01's `denied write -> the target file is byte-identical` row, and the byte comparison
  # is the half it was missing.
  cd "$ARC_ROOT"
  local before; before="$(_arc_sha256 < .claude/settings.json)"
  run node .claude/scripts/hq/policy-matrix.mjs --from .mcp.json --out .claude/settings.json
  [ "$status" -eq 2 ]
  [[ "$output" == *"un-grantable"* ]]
  local after; after="$(_arc_sha256 < .claude/settings.json)"
  [ "$before" = "$after" ] || { echo "the denied write CHANGED the target file"; false; }
}

@test "WRITE ABSENCE ROW -- the positive control: the same writer does write when permitted" {
  # Without this the row above is satisfied by a policy-matrix that never writes anything at all,
  # which is the same green from a deleted feature.
  cd "$ARC_ROOT"
  local out="$BATS_TEST_TMPDIR/matrix.json"
  run node .claude/scripts/hq/policy-matrix.mjs --from .mcp.json --out "$out"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ -s "$out" ] || { echo "the permitted write produced no file -- the absence above proves nothing"; false; }
}

@test "the shipped policy lints clean and prints its DERIVED table" {
  # The table is the mitigation that would have made the __proto__ finding visible to a
  # reviewer: the lint used to print only a count.
  cd "$ARC_ROOT"
  run node .claude/scripts/hq/policy-lint.mjs hq.policy.yaml
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"session:interactive"* ]]
  [[ "$output" == *"is law"* ]]
}

@test "this file registered every test it declares" {
  [ "${#BATS_TEST_NAMES[@]}" -eq 14 ] || {
    echo "registered ${#BATS_TEST_NAMES[@]} tests, expected 14 -- a @test was silently dropped"
    false
  }
}
