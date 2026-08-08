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
  # which is the same green a deleted feature produces.
  #
  # The target is INSIDE the repo, for the same Windows reason the `tmp()` helper above already
  # is. `$BATS_TEST_TMPDIR` on the Windows runner is under `C:/Users/RUNNER~1/...` -- an 8.3 short
  # name -- and the resource guard refuses any path with a short component, because a short name
  # can alias a guarded path. The guard was right and the fixture was wrong.
  cd "$ARC_ROOT"
  local d; d="$(mktemp -d "$ARC_ROOT/.pol-tmp-XXXXXX")"
  run node .claude/scripts/hq/policy-matrix.mjs --from .mcp.json --out "$d/matrix.json"
  local status_seen="$status" output_seen="$output"
  local wrote=0; [ -s "$d/matrix.json" ] && wrote=1
  rm -rf "$d"
  [ "$status_seen" -eq 0 ] || { echo "$output_seen"; false; }
  [ "$wrote" -eq 1 ] || { echo "the permitted write produced no file -- the absence above proves nothing"; false; }
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

@test "PHASE 04 -- a target that CONTAINS a guarded path is recognised" {
  # A Phase 04 attacker ran these at shell L3 against the shipped ungrantable list: a recursive
  # delete of .claude/hooks was denied, and the same delete of .claude, of .claude/scripts and of
  # the repo root all EXECUTED -- taking the hooks, the settings file and the policy library with
  # them. Every branch of guardedEntryFor asks "is this target inside something guarded?"; none
  # asked the reverse. ADR-0502: a backstop that the thing it binds can delete is not a backstop.
  run _node "$PRE
    const g = P.buildResourceGuard(base().ungrantable_resources, process.cwd());
    const hit = (r) => P.containsGuardedEntry(r, g) ? 'CONTAINS' : 'clear';
    const out = [];
    for (const r of ['.claude', '.claude/scripts', '.claude/scripts/hq', '.'])
      out.push(r + '=' + hit(r));
    for (const r of ['docs', 'tests', 'initiatives', 'README.md'])
      out.push(r + '=' + hit(r));
    console.log(out.join(' '));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *".claude=CONTAINS"* ]] || { echo "$output"; false; }
  [[ "$output" == *".claude/scripts=CONTAINS"* ]] || { echo "$output"; false; }
  [[ "$output" == *".claude/scripts/hq=CONTAINS"* ]] || { echo "$output"; false; }
  [[ "$output" == *".=CONTAINS"* ]] || { echo "$output"; false; }
  # The write roots must NOT be swept up. A guard that denies everything is not a guard.
  [[ "$output" == *"docs=clear"* ]] || { echo "$output"; false; }
  [[ "$output" == *"tests=clear"* ]] || { echo "$output"; false; }
  [[ "$output" == *"initiatives=clear"* ]] || { echo "$output"; false; }
  [[ "$output" == *"README.md=clear"* ]] || { echo "$output"; false; }
}

@test "PHASE 04 -- deleting an ancestor is denied at a level that EXECUTES" {
  # The decision, not the guard lookup. TWO things have to be true before this measures anything.
  # The grant needs a real argv0_allow, or the sibling fix caps an allowlist-less shell to the
  # birth cap. And the EVENTS matter as much as the ceiling: every pair is born at L1, so a
  # ceiling of L3 against an empty stream still resolves to min of L3 and L1, and every row reads
  # propose for a reason unrelated to this guard. Both versions of this test got that wrong and
  # CI caught both.
  run _node "$PRE
    const pol = base({ shell:{level:'L3', argv0_allow:['rm','jq']}, write:{level:'L3', roots:['**']} });
    pol.argv0_classes.rm = { class:'narrow', reproduces:[] };
    pol.argv0_classes.jq = { class:'narrow', reproduces:[] };
    const ev = [up('shell','L3'), up('write','L3')];
    const D = (resource) => P.authorizeAction(
      {kind:'session:interactive', capability:'shell', resource}, {policy: pol, events: ev}).decision;
    const out = [];
    out.push('parent=' + D('rm -rf .claude'));
    out.push('scripts=' + D('rm -rf .claude/scripts'));
    out.push('root=' + D('rm -rf .'));
    out.push('hooks=' + D('rm -r .claude/hooks'));
    out.push('control=' + D('rm -rf docs/scratch'));
    out.push('readonly=' + D('jq .'));
    console.log(out.join(' '));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"parent=deny"* ]] || { echo "$output"; false; }
  [[ "$output" == *"scripts=deny"* ]] || { echo "$output"; false; }
  [[ "$output" == *"root=deny"* ]] || { echo "$output"; false; }
  [[ "$output" == *"hooks=deny"* ]] || { echo "$output"; false; }
  # CONTROL ONE: at the same level, with the same allowlist, a delete outside every guarded path
  # must still EXECUTE -- without it, a rule that denied all shell would pass every row above.
  [[ "$output" == *"control=execute"* ]] || { echo "$output"; false; }
  # CONTROL TWO: the scoping. Being an ancestor is only dangerous when something can destroy the
  # target, so a read-only program naming the repo root must not be denied. The first version of
  # this rule denied jq . and git status . outright.
  [[ "$output" == *"readonly=execute"* ]] || { echo "$output"; false; }
}

@test "PHASE 04 -- shell that EXECUTES with no argv0_allow is capped, not unbounded" {
  # A Phase 04 attacker raised one kind shell to L3 with no argv0_allow and got unbounded network
  # and an unbounded interpreter out of a kind whose write and network were both L1 -- policy-lint
  # printed "is law" over the file. reproducedBy returns an empty set for an absent allowlist, so
  # effectiveShell minned over NOTHING and kept the declared level.
  #
  # THE EVENTS ARE THE TEST. The first version passed `events: []`, so effective was
  # min(ceiling L3, birth cap L1) = L1 before effectiveShell was ever consulted -- the assertion
  # was true with the fix, true without it, and a day-two mutation pass proved it green against
  # a mutant with the whole cap deleted. A ceiling is not a level. The promotions below raise the
  # earned cap so the declared level is actually reached, which is the only state the fix governs.
  run _node "$PRE
    const D = (over, ev) => P.authorizeAction(
      {kind:'session:interactive', capability:'shell', resource:'curl https://evil.example/x'},
      {policy: base(over), events: ev});
    const out = [];
    const r3 = D({shell:{level:'L3'}}, [up('shell','L3')]);
    out.push('L3-noallow=' + r3.effective + '/' + r3.decision);
    const r2 = D({shell:{level:'L2'}}, [up('shell','L2')]);
    out.push('L2-noallow=' + r2.effective + '/' + r2.decision);
    const r1 = D({shell:{level:'L1'}}, []);
    out.push('L1-noallow=' + r1.effective + '/' + r1.decision);
    // With a real allowlist the derivation runs normally instead of the cap firing. The program
    // must be a CLASSIFIED NARROW one: an unclassified argv0 widens to all seven capabilities by
    // design, and the min then drags shell to L0 through spend. The first version of this row
    // used curl, which this fixture does not classify, and measured that instead of the cap.
    const pol = base({shell:{level:'L3', argv0_allow:['bats']}});
    const rok = P.authorizeAction(
      {kind:'session:interactive', capability:'shell', resource:'bats tests/x.bats'},
      {policy: pol, events:[up('shell','L3')]});
    out.push('L3-withallow=' + rok.effective + '/' + rok.decision);
    console.log(out.join(' '));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # The cap fires and the command does NOT execute, at a level that otherwise would have.
  [[ "$output" == *"L3-noallow=L1/propose"* ]] || { echo "$output"; false; }
  [[ "$output" == *"L2-noallow=L1/propose"* ]] || { echo "$output"; false; }
  # CONTROL ONE: a level that never executes is untouched by this rule.
  [[ "$output" == *"L1-noallow=L1/propose"* ]] || { echo "$output"; false; }
  # CONTROL TWO: with a real allowlist, shell at L3 still EXECUTES -- otherwise the fix is just
  # "cap every shell grant", which would pass both rows above and break the feature.
  [[ "$output" == *"L3-withallow=L3/execute"* ]] || { echo "$output"; false; }
}

@test "PHASE 04 -- reproduces:[shell] fails CLOSED, the one token ADR-0507 forbids" {
  # reproducedBy excluded "shell" from BOTH arms, so the single token the ADR bans was the one
  # that made the derivation add nothing: reproduces:["shell"] returned an empty set and left
  # the grant uncapped. policy-lint rejects that token -- but this function is also called by
  # hooks that never ran the lint, which is the reasoning already written for an unclassified
  # program, one branch further up.
  run _node "$PRE
    const r = (list) => [...P.reproducedBy(['p'], {p:{class:'x', reproduces:list}})].sort().join(',');
    const out = [];
    out.push('shell=[' + r(['shell']) + ']');
    out.push('star=[' + r(['*']) + ']');
    out.push('unknown=[' + r(['nonsense']) + ']');
    out.push('narrow=[' + r([]) + ']');
    out.push('network=[' + r(['network']) + ']');
    console.log(out.join(' '));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # malformed widens: identical to the unknown-token and the "*" cases
  [[ "$output" == *"shell=[deploy,message,network,publish,read,spend,write]"* ]] || { echo "$output"; false; }
  [[ "$output" == *"unknown=[deploy,message,network,publish,read,spend,write]"* ]]
  # CONTROLS: a genuinely narrow entry and a single-capability entry must stay narrow, or the
  # fix is just "widen everything", which caps every shell grant and proves nothing.
  [[ "$output" == *"narrow=[]"* ]] || { echo "$output"; false; }
  [[ "$output" == *"network=[network]"* ]] || { echo "$output"; false; }
}

@test "PHASE 04 -- a forged spine line cannot raise a cap, and a copied one cannot undo a demotion" {
  # TWO findings, one loop. loadPolicyEvents ran every line through validateEvent and called that
  # integrity. It is not: validateEvent checks SHAPE and never recomputes the content hash --
  # `eventSha` is exported by canonical.mjs and nothing on the read path called it. A Phase 04
  # attacker raised a cap L1 -> L2 with ONE appended line carrying a deliberately wrong sha, a
  # decision_ref naming no event that exists, and a zeroed policy_hash.
  #
  # And the loader de-duplicated nothing, while `policy.level.changed` is an ABSOLUTE set in the
  # reducer -- so a genuine, correctly-sealed, already-applied promotion appearing a second time
  # RESTORES a cap a later demotion took away. No forgery needed for that one: `cp` is enough.
  #
  # Both are driven through the REAL loadPolicyEvents against a temp spine, not through the
  # reducer with injected objects, because the hole was in the READ path.
  run _node "$PRE
    const { policyIdem } = await import('./.claude/scripts/hq/lib/validate-policy.mjs');
    const { eventSha, sha256Hex } = await import('./.claude/scripts/hq/lib/canonical.mjs');
    const root = fs.mkdtempSync(pth.join(os.tmpdir(), 'forge-'));
    const dir = pth.join(root, '.claude', 'state', 'hq', 'events');
    fs.mkdirSync(dir, { recursive: true });
    const DEC = '01JQ8XZ9K0ABCDEFGH00000002';
    // The approval the promotion cites, sealed the same way. Before this existed the fixture
    // named a decision that was never on the spine -- which is precisely the forgery the
    // decision_ref check now refuses, so the CONTROL row was itself the attack.
    const decision = (() => {
      const e = { v:1, id:DEC, kind:'decision.recorded', ts:'2026-08-06T09:00:00+05:30',
        actor:'human', process:'arc-inbox@1.0.0', run_id:'r-01JQ8XZ9K0ABCDEFGH00000003',
        venture:'arc', model:null, cost:null, outcome:'ok', evidence:null, supersedes:null,
        payload:{ decides:'01JQ8XZ9K0ABCDEFGH00000001', reason:'fixture', verdict:'approve' } };
      e.idem = sha256Hex('decision.recorded|' + e.payload.decides); e.sha = eventSha(e); return e;
    })();
    const mk = (id, to, ref) => {
      const e = { v:1, id, kind:'policy.level.changed', ts:'2026-08-06T10:00:00+05:30',
        actor:'human', process:'policy-promotion@1.0.0', run_id:'r-01JQ8XZ9K0ABCDEFGH00000003',
        venture:'arc', model:null, cost:null, outcome:'ok', evidence:null, supersedes:null,
        payload:{ action_kind:'session:interactive', capability:'write', correlation:'r',
          decision_ref: ref || DEC, from_level:'L1',
          policy_hash:'a'.repeat(64), to_level:to, trial_ledger_ref:'t' } };
      e.idem = policyIdem(e.kind, e.payload); e.sha = eventSha(e); return e;
    };
    const drop = (id) => {
      const e = { v:1, id, kind:'policy.demoted', ts:'2026-08-06T11:00:00+05:30',
        actor:'engine', process:'policy-hook@1.0.0', run_id:'r-01JQ8XZ9K0ABCDEFGH00000003',
        venture:'arc', model:null, cost:null, outcome:'ok', evidence:null, supersedes:null,
        payload:{ action_kind:'session:interactive', capability:'write', correlation:'r',
          from_level:'L2', incident_ref:'01JQ8XZ9K0ABCDEFGH00000004',
          policy_hash:'a'.repeat(64), to_level:'L1' } };
      e.idem = policyIdem(e.kind, e.payload); e.sha = eventSha(e); return e;
    };
    const f = pth.join(dir, '2026-08-06.jsonl');
    // The decision is on every write: it is the standing fact the promotions cite, not one of
    // the lines under test.
    const w = (o) => fs.writeFileSync(f, JSON.stringify(decision) + '\n' + JSON.stringify(o) + '\n');
    // NOT named n: the shared PRE block already declares one as the ULID counter for up(),
    // and a duplicate const in the same module scope is a SyntaxError before a line runs.
    const loaded = () => P.loadPolicyEvents(root).length;
    const good = mk('01JQ8XZ9K0ABCDEFGH00000010', 'L2');
    const out = [];
    w(good);                                              out.push('genuine=' + loaded());
    w({ ...good, sha: 'f'.repeat(64) });                  out.push('wrongsha=' + loaded());
    const t = JSON.parse(JSON.stringify(good)); t.payload.to_level = 'L3';
    w(t);                                                 out.push('tampered=' + loaded());
    // AN APPROVAL THAT DOES NOT EXIST. Correctly sealed, correct idem, plausible in every field
    // -- and citing a ULID no decision.recorded carries. Two day-two attackers raised a cap with
    // exactly this line, because eventSha is exported and pure so the forger seals their own.
    w(mk('01JQ8XZ9K0ABCDEFGH00000011', 'L2', '01JQ8XZ9K0ABCDEFGH00000099'));
    out.push('orphan=' + loaded());
    // A DECISION THAT IS ITSELF FORGED cannot launder a promotion: the loader sha-verifies the
    // decision before admitting its id, so a promotion citing it is as orphaned as the row above.
    fs.writeFileSync(f, JSON.stringify({ ...decision, sha:'f'.repeat(64) }) + '\n'
      + JSON.stringify(good) + '\n');
    out.push('forgeddecision=' + loaded());
    // THE FAIL-OPEN CONTROL. A demotion carries no decision_ref at all -- it is engine-raised on
    // an incident. Gating it the same way would leave a cap HIGH, the one direction this must
    // never fail in, so it must load with no decision anywhere on the spine.
    fs.writeFileSync(f, JSON.stringify(drop('01JQ8XZ9K0ABCDEFGH00000012')) + '\n');
    out.push('demotiononly=' + loaded());
    w(good);
    fs.appendFileSync(pth.join(dir, '2026-08-08.jsonl'), JSON.stringify(good) + '\n');
    out.push('duplicated=' + loaded());
    // SAME IDEM, FRESH ID, RE-SEALED. The dedup keyed on the ULID until day two, so this is the
    // copy that walked past the fix above and restored a cap a demotion had taken.
    const twin = JSON.parse(JSON.stringify(good));
    twin.id = '01JQ8XZ9K0ABCDEFGH00000013';
    delete twin.sha; twin.sha = eventSha(twin);
    fs.writeFileSync(f, JSON.stringify(decision) + '\n' + JSON.stringify(good) + '\n'
      + JSON.stringify(twin) + '\n');
    out.push('reidcopy=' + loaded());
    console.log(out.join(' '));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # THE CONTROL FIRST: a correctly sealed event must still load, or every row below passes for
  # the wrong reason and the engine has simply stopped reading its own spine.
  [[ "$output" == *"genuine=1"* ]] || { echo "a genuine sealed event was rejected: $output"; false; }
  [[ "$output" == *"wrongsha=0"* ]] || { echo "$output"; false; }
  [[ "$output" == *"tampered=0"* ]] || { echo "$output"; false; }
  [[ "$output" == *"orphan=0"* ]] || { echo "a promotion citing no real decision was folded: $output"; false; }
  [[ "$output" == *"forgeddecision=0"* ]] || { echo "a forged decision laundered a promotion: $output"; false; }
  [[ "$output" == *"demotiononly=1"* ]] || { echo "a demotion was gated on a decision -- the cap stays high: $output"; false; }
  [[ "$output" == *"duplicated=1"* ]] || { echo "the copy was counted twice: $output"; false; }
  [[ "$output" == *"reidcopy=1"* ]] || { echo "a re-sealed copy with a fresh id folded twice: $output"; false; }
}

@test "PHASE 04 -- every event on the REAL spine passes the new integrity check" {
  # The control that makes the check safe to ship. A sha comparison that rejects the live spine
  # would not be hardening, it would be an outage -- and the only honest way to know is to run it
  # over the real thing. Measured at 531 lines, 531 verified, 0 mismatches.
  run _node "$PRE
    const { eventSha } = await import('./.claude/scripts/hq/lib/canonical.mjs');
    const dir = pth.join(process.cwd(), '.claude', 'state', 'hq', 'events');
    if (!fs.existsSync(dir)) { console.log('total=0 bad=0'); process.exit(0); }
    let total = 0, bad = 0;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.jsonl'))) {
      for (const line of fs.readFileSync(pth.join(dir, f), 'utf8').split('\n')) {
        if (!line.trim()) continue;
        let e; try { e = JSON.parse(line); } catch { continue; }
        total++;
        if (eventSha(e) !== e.sha) bad++;
      }
    }
    console.log('total=' + total + ' bad=' + bad);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *" bad=0"* ]] || { echo "the real spine fails its own seal: $output"; false; }
  # Not vacuous on an empty checkout: assert the loop actually saw lines.
  [[ "$output" != *"total=0 "* ]] || { echo "no spine events were read at all: $output"; false; }
}

@test "PHASE 04 -- a trailing dot or space is a second name for a guarded file, and is refused" {
  # THE ONLY FINDING IN THIS CYCLE WITH A PROVEN BYTE-LEVEL SIDE EFFECT. Win32 STRIPS a trailing
  # dot or space at the API layer, so "hq.policy.yaml." is the same file as "hq.policy.yaml" to
  # every Win32 caller and a different string to every check in resources.mjs. Measured through
  # PowerShell -- which is a CLASSIFIED interpreter, so this is a program the policy contemplates
  # permitting: .claude/settings.json went 3219 -> 14 bytes and hq.policy.yaml 6660 -> 14, while
  # guardedEntryFor reported the target clear.
  #
  # Rejected outright the way hasShortName rejects 8.3 names, never trimmed: trimming means this
  # module deciding which of two names the OS meant, and the aliasing IS the attack -- one path,
  # two identities, one of them invisible to the guard.
  run _node "$PRE
    const W = { write:{level:'L3'} };
    const d = (r) => JSON.stringify(r) + '=' + A('write', r, W, [up('write','L3')]);
    console.log([d('hq.policy.yaml'), d('hq.policy.yaml.'), d('hq.policy.yaml '),
                 d('./.claude/settings.json.'), d('docs/sub./y.md'),
                 d('docs/x.md'), d('docs/v1.2.md')].join(' '));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # The plain name, as the reference every alias below is measured against.
  [[ "$output" == *'"hq.policy.yaml"=deny'* ]] || { echo "$output"; false; }
  [[ "$output" == *'"hq.policy.yaml."=deny'* ]] || { echo "the trailing-dot alias reached the file: $output"; false; }
  [[ "$output" == *'"hq.policy.yaml "=deny'* ]] || { echo "the trailing-space alias reached the file: $output"; false; }
  [[ "$output" == *'"./.claude/settings.json."=deny'* ]] || { echo "$output"; false; }
  # A DIRECTORY segment aliases too -- the rule is per-segment, not just on the basename.
  [[ "$output" == *'"docs/sub./y.md"=deny'* ]] || { echo "an aliased parent directory passed: $output"; false; }
  # CONTROLS. Without these the rule could be "deny every write" and every row above would still
  # pass. A dot INSIDE a segment is an ordinary filename and must be untouched.
  [[ "$output" == *'"docs/x.md"=execute'* ]] || { echo "an ordinary write was denied: $output"; false; }
  [[ "$output" == *'"docs/v1.2.md"=execute'* ]] || { echo "an interior dot was treated as an alias: $output"; false; }
}

@test "PHASE 04 -- a wrapper program is refused outright, because argv0 is not its identity" {
  # THE ARGV0 MODEL FAILING ON ITS OWN TERMS. shellArgv0 returns the FIRST word and every check
  # downstream keys on it -- the argv0_classes lookup, ADR-0507's derivation, FILE_MUTATORS. So
  # `env rm -r .claude` is classified as `env`, and a day-two attacker got PROPOSE out of eleven
  # wrappers while the bare `rm` correctly denied. That is not a gap in one Set: any allowlist
  # keyed on the first word is one wrapper away from meaningless.
  #
  # Refused OUTRIGHT, like chaining. Resolving them means parsing each wrapper's flag grammar to
  # find the real program -- the rabbit hole ADR-0507 named when it chose to model `git` by what
  # it CAN do rather than by subcommand.
  run _node "$PRE
    const SH = { shell:{level:'L3', argv0_allow:['bats']} };
    const d = (c) => c.split(' ')[0] + '=' + A('shell', c, SH, [up('shell','L3')]);
    const wrapped = ['env','nice','nohup','timeout','setsid','stdbuf','flock','sudo','doas',
                     'busybox','xargs','watch','command','exec','su','chroot','ionice','script']
      .map((w) => d(w + ' bats tests/x.bats'));
    console.log([...wrapped, d('bats tests/x.bats')].join(' '));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # Every wrapper the two attackers ran, each one prefixing a command that is otherwise allowed.
  for w in env nice nohup timeout setsid stdbuf flock sudo doas busybox xargs watch command exec su chroot ionice script; do
    [[ "$output" == *"$w=deny"* ]] || { echo "$w laundered its argv0 through: $output"; false; }
  done
  # THE CONTROL: the same command WITHOUT a wrapper must still execute, or this rule is just
  # "deny shell" and every row above passes for the wrong reason.
  [[ "$output" == *"bats=execute"* ]] || { echo "the unwrapped control was denied: $output"; false; }
}

@test "PHASE 04 -- argv0_allow is enforced at L3, because it is what bought the level" {
  # FOUND ATTACKING THE PREVIOUS FIX rather than the original code. The empty-allowlist hole was
  # closed one commit earlier ("what if the list is missing"); this is the same shape one step
  # over ("what if the list is present and then ignored").
  #
  # argv0_allow was enforced only inside the L2 branch, on the reading that "L3 is unbounded
  # within the capability". For the other seven capabilities that is coherent. For shell it is
  # circular: ADR-0507 DERIVES effective(shell) from reproduced_by(argv0_allow), so the declared
  # list is the input to the cap that permitted L3. `bats` is classified narrow and reproduces
  # nothing, so it caps nothing and L3 is reached -- and then node, curl, dd and a recursive
  # delete all executed under a grant whose safety argument was the word "bats".
  #
  # Latent rather than live: every shell grant in the shipped hq.policy.yaml sits at L1 with no
  # allowlist. Pinned anyway -- the ceiling is one reviewed repo edit away, and the engine's own
  # invariant is what was broken.
  run _node "$PRE
    const out = [];
    for (const lvl of ['L2','L3']) {
      const SH = { shell:{level:lvl, argv0_allow:['bats']} };
      for (const c of ['bats t', 'node -e 1', 'curl http://x', 'dd if=/dev/zero of=/tmp/y'])
        out.push(lvl + ':' + c.split(' ')[0] + '=' + A('shell', c, SH, [up('shell',lvl)]));
    }
    console.log(out.join(' '));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # L2 is the reference behaviour -- it always enforced the list. L3 must now match it.
  for lvl in L2 L3; do
    [[ "$output" == *"$lvl:bats=execute"* ]] || { echo "$lvl denied its own allowlisted program: $output"; false; }
    [[ "$output" == *"$lvl:node=deny"* ]] || { echo "$lvl admitted an interpreter outside the list: $output"; false; }
    [[ "$output" == *"$lvl:curl=deny"* ]] || { echo "$output"; false; }
    [[ "$output" == *"$lvl:dd=deny"* ]] || { echo "$output"; false; }
  done
}

@test "PHASE 04 -- a case-variant processes directory throws rather than resolving per platform" {
  # THE FOURTH TWIN-FIX RECURRENCE IN THIS LANE. processSubjects branched on "absent" and
  # "not-a-directory" and FELL THROUGH for "case-variant" -- so a `Processes/` directory yielded
  # a real subject set on Windows and macOS and an uncaught ENOENT throw on Linux, inside
  # policy-lint, which is the FAIL-capable gate. kickoff-lint gates on that state before calling
  # and got it right; this caller did not. Same guard, one consumer, not the other.
  #
  # Decided by exact BYTES (a directory listing) rather than existsSync, which is the one thing
  # all three CI legs agree on -- so this test measures the same thing on every runner.
  run _node "$PRE
    const S = await import('./.claude/scripts/hq/lib/policy/subjects.mjs');
    const out = [];
    const probe = (label, fn) => { try { out.push(label + '=' + fn()); }
                                   catch (e) { out.push(label + '=throw:' + e.code); } };
    const a = tmp();
    try {
      fs.mkdirSync(pth.join(a, 'Processes'));
      out.push('state=' + S.processesDirState(a));
      probe('subjects', () => 'list' + S.processSubjects(a).length);
      probe('names', () => 'list' + S.processNames(a).length);
    } finally { cleanup(a); }
    const b = tmp();
    try {
      fs.mkdirSync(pth.join(b, 'processes'));
      fs.writeFileSync(pth.join(b, 'processes', 'demo.process.yaml'), 'name: demo');
      probe('exact', () => S.processNames(b).join(','));
    } finally { cleanup(b); }
    const c = tmp();
    try { probe('absent', () => String(S.processNames(c))); } finally { cleanup(c); }
    console.log(out.join(' '));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"state=case-variant"* ]] || { echo "the dir state itself is wrong: $output"; false; }
  # BOTH consumers, not just the one that was reported. The typed code is what policy-lint keys
  # on to FAIL loudly instead of dying on a raw ENOENT.
  [[ "$output" == *"subjects=throw:PROCESSES_UNREADABLE"* ]] || { echo "$output"; false; }
  [[ "$output" == *"names=throw:PROCESSES_UNREADABLE"* ]] || { echo "processNames still resolves a case-variant dir: $output"; false; }
  # CONTROLS, both directions. An exact directory must still be READ, and an absent one must
  # still be null -- "cannot check" is not the empty list, and a rule that threw on everything
  # would pass the rows above while breaking the gate.
  [[ "$output" == *"exact=demo"* ]] || { echo "an exact processes dir stopped resolving: $output"; false; }
  [[ "$output" == *"absent=null"* ]] || { echo "an absent dir is no longer null: $output"; false; }
}

@test "this file registered every test it declares" {
  [ "${#BATS_TEST_NAMES[@]}" -eq 24 ] || {
    echo "registered ${#BATS_TEST_NAMES[@]} tests, expected 24 -- a @test was silently dropped"
    false
  }
}
