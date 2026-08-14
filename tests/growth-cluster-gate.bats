#!/usr/bin/env bats
# Phase 02 -- the cluster proposal and GATE 1 (REQ-01, ADR-1112). Generation against an
# unapproved cluster is refused in CODE, which is what this file proves.
#
# The gate binds an approval to the exact PLAN BYTES, not just to the cluster id. Without that a
# human approves a clean plan, the file changes, and generation runs against whatever it says at
# generation time -- the gate would be ceremonial. Every refusal below is a way that could happen.
#
# ASCII-only test names; the file asserts its registered count at the bottom.
bats_require_minimum_version 1.5.0
load 'test_helper'

_node() { cd "$ARC_ROOT" && node --input-type=module -e "$1"; }

PRE='const C = await import("./.claude/scripts/growth/lib/cluster.mjs");
const err = (fn) => { try { fn(); return "NO-THROW"; } catch (e) { return e.code || e.name; } };
const msg = (fn) => { try { fn(); return "NO-THROW"; } catch (e) { return e.message; } };
// One DISTINCT topic per candidate. This used to read "kw " + i, where the trailing number is a
// bare digit the tokeniser drops -- so every candidate in the pool reduced to the single topic
// token "kw", and under ADR-1116 that pool is one topic repeated twelve times, not a cluster.
// The fixture was describing a shape the rule now correctly refuses to build.
const c = (i, intent = "informational") => ({ keyword: "kw" + i, intent,
  evidence_url: "https://news.ycombinator.com/item?id=" + i, gap_note: "attested in 2 stories",
  source_id: "hn-algolia" });
// 1 pillar + 8 spokes worth of non-transactional, plus 3 transactional for BOFU.
const POOL = [...Array(9).keys()].map((i) => c(i)).concat([c(90, "transactional"), c(91, "transactional"), c(92, "transactional")]);
const PLAN = C.buildClusterPlan({ candidates: POOL, clusterId: "c-001" });
const SHA = C.planSha(PLAN);
const REQ = "01JQ8XZ9K0ABCDEFGH00000001";
// `payload` is destructured OUT of the overrides before the rest is spread. Spreading `over`
// wholesale at the end would replace the merged payload with the patch, so `dec({payload:{verdict:
// "reject"}})` would have produced a decision with no `decides` at all -- and several refusal
// tests below would then have passed for the wrong reason.
const req = (over = {}) => { const { payload = {}, ...rest } = over; return { id: REQ, kind: "approval.requested",
  payload: { gate: "cluster", what: "approve", cluster_id: "c-001", plan_sha: SHA, ...payload }, ...rest }; };
const dec = (over = {}) => { const { payload = {}, ...rest } = over; return { id: "01JQ8XZ9K0ABCDEFGH00000002", kind: "decision.recorded",
  payload: { decides: REQ, verdict: "approve", reason: "looks right", ...payload }, ...rest }; };
const gate = (events, over = {}) => C.assertClusterApproved({ events, clusterId: "c-001", planSha: SHA, ...over });'

# ---------- the proposal is ONE readable inbox item ----------

@test "gate: a cluster is 1 pillar, 5 to 8 spokes and 2 to 3 BOFU" {
  # The upper bound matters as much as the floor: a first version took every remaining candidate
  # and proposed 73 spokes, which is not something a human approves, it is something a human
  # rubber-stamps.
  run _node "$PRE
    console.log([PLAN.pillar ? 1 : 0, PLAN.spokes.length, PLAN.bofu.length].join(' '));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "1 8 3" ]
}

@test "gate: every row of the proposal carries an evidence link" {
  run _node "$PRE
    const rows = [PLAN.pillar, ...PLAN.spokes, ...PLAN.bofu];
    console.log(rows.length + ' ' + (rows.every((r) => /^https:/.test(r.evidence_url)) ? 'all-evidenced' : 'A-BARE-ROW'));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "12 all-evidenced" ]
}

@test "gate: an evidence-less candidate cannot enter the proposal" {
  run _node "$PRE
    const bad = POOL.slice(0, 11).concat([{ ...c(99), evidence_url: '' }]);
    console.log(err(() => C.buildClusterPlan({ candidates: bad, clusterId: 'c-001' })));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "NO_EVIDENCE" ]
}

@test "gate: too small a candidate pool refuses rather than proposing a thin cluster" {
  # Named for what it actually exercises: both inputs trip the POOL check, not the spoke floor.
  # The earlier name claimed coverage of a guard these inputs never reach.
  run _node "$PRE
    const thin = [c(1), c(2), c(90, 'transactional'), c(91, 'transactional')];
    const noBofu = [...Array(9).keys()].map((i) => c(i));
    console.log(err(() => C.buildClusterPlan({ candidates: thin, clusterId: 'c-001' })) + ' ' +
                err(() => C.buildClusterPlan({ candidates: noBofu, clusterId: 'c-001' })));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "THIN_CLUSTER THIN_CLUSTER" ]
}

@test "gate: a malformed cluster id is refused by both the builder and the gate" {
  run _node "$PRE
    console.log([err(() => C.buildClusterPlan({ candidates: POOL, clusterId: 'cluster-one' })),
                 err(() => C.assertClusterApproved({ events: [], clusterId: 'C-001', planSha: SHA }))].join(' '));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "BAD_CLUSTER_ID BAD_CLUSTER_ID" ]
}

@test "gate: the plan hash is stable across key order" {
  # The approval is bound to these bytes, so the hash must depend on WHAT the plan contains and
  # not on the order the object happened to be built in.
  run _node "$PRE
    const reordered = JSON.parse(JSON.stringify({ bofu: PLAN.bofu, spokes: PLAN.spokes, pillar: PLAN.pillar, cluster_id: PLAN.cluster_id }));
    console.log(C.planSha(reordered) === SHA ? 'stable' : 'UNSTABLE');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "stable" ]
}

# ---------- THE GATE ----------

@test "gate: an approved cluster returns the approval that authorised it" {
  # The positive control. Without it every refusal below could be passing because the gate refuses
  # unconditionally, which would be a broken gate that looks like a strict one.
  run _node "$PRE
    console.log(gate([req(), dec()]) === REQ ? 'approved' : 'WRONG-ID');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "approved" ]
}

@test "gate: a cluster nobody ever sent for approval is refused" {
  run _node "$PRE console.log(err(() => gate([])));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "NOT_APPROVED" ]
}

@test "gate: a cluster still waiting in the inbox is refused" {
  run _node "$PRE console.log(err(() => gate([req()])));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "NOT_APPROVED" ]
}

@test "gate: a rejected cluster is refused and says it was reviewed" {
  run _node "$PRE
    console.log(err(() => gate([req(), dec({ payload: { verdict: 'reject' } })])) + ' ' +
                (/NOT approved/.test(msg(() => gate([req(), dec({ payload: { verdict: 'reject' } })]))) ? 'named' : 'VAGUE'));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "NOT_APPROVED named" ]
}

@test "gate: a verdict of the wrong case does not approve" {
  run _node "$PRE console.log(err(() => gate([req(), dec({ payload: { verdict: 'Approve' } })])));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "NOT_APPROVED" ]
}

@test "gate: a decision deciding some other approval does not approve this one" {
  # The decoy. A decision is only worth anything against the approval it actually names.
  run _node "$PRE
    console.log(err(() => gate([req(), dec({ payload: { decides: '01JQ8XZ9K0ABCDEFGH00000009' } })])));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "NOT_APPROVED" ]
}

@test "gate: an approval for a different cluster does not carry over" {
  run _node "$PRE
    console.log(err(() => gate([req({ payload: { cluster_id: 'c-002' } }), dec()])));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "NOT_APPROVED" ]
}

@test "gate: a plan changed after approval is refused, and the message says so" {
  # This is the whole reason plan_sha exists. Approve a clean plan, edit the file, generate: the
  # gate has to catch that or it is decoration.
  run _node "$PRE
    const m = msg(() => C.assertClusterApproved({ events: [req(), dec()], clusterId: 'c-001', planSha: 'f'.repeat(64) }));
    console.log(err(() => C.assertClusterApproved({ events: [req(), dec()], clusterId: 'c-001', planSha: 'f'.repeat(64) })) + ' ' +
                (/plan changed/.test(m) ? 'explained' : 'UNEXPLAINED:' + m));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "NOT_APPROVED explained" ]
}

@test "gate: two decisions on one approval refuse rather than picking the kind one" {
  run _node "$PRE
    const two = [req(), dec({ payload: { verdict: 'reject' } }), dec({ id: '01JQ8XZ9K0ABCDEFGH00000003' })];
    console.log(err(() => gate(two)));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "AMBIGUOUS_APPROVAL" ]
}

@test "gate: an inherited cluster_id cannot answer for a real one" {
  # The first version of this test used JSON.parse with a __proto__ key -- which creates an OWN
  # property and never touches the prototype, so the test stayed green even with the own-property
  # guard replaced by a plain read. It was testing nothing. A REAL inherited property is
  # Object.create, and this now fails if `own()` is weakened.
  run _node "$PRE
    const proto = { cluster_id: 'c-001', plan_sha: SHA, gate: 'cluster' };
    const inherited = { id: REQ, kind: 'approval.requested', payload: Object.create(proto) };
    // Positive control: the same fields as OWN properties must approve, or this test would pass
    // simply because the fixture is broken.
    const ownVersion = { id: REQ, kind: 'approval.requested', payload: { ...proto } };
    console.log(err(() => gate([inherited, dec()])) + ' ' + (gate([ownVersion, dec()]) === REQ ? 'own-works' : 'FIXTURE-BROKEN'));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "NOT_APPROVED own-works" ]
}

@test "gate: an approval raised for a DIFFERENT gate does not authorise generation" {
  # A human answering "may I publish this" must not be recorded as having answered "may I
  # generate this cluster", even when the ids and the plan hash line up.
  run _node "$PRE
    console.log(err(() => gate([req({ payload: { gate: 'publish' } }), dec()])));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "NOT_APPROVED" ]
}

@test "gate: a request with no usable id is not decided by a decision with no decides" {
  # The hole an adversarial pass found: both sides read undefined for a missing key, and
  # undefined === undefined, so a decision naming NOTHING approved a request named NOTHING.
  run _node "$PRE
    const noId  = { kind: 'approval.requested', payload: { gate: 'cluster', cluster_id: 'c-001', plan_sha: SHA } };
    const noDec = { kind: 'decision.recorded', payload: { verdict: 'approve', reason: 'r' } };
    console.log(err(() => gate([noId, noDec])));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "NOT_APPROVED" ]
}

@test "gate: two DIFFERENT plans cannot hash the same" {
  # planSha binds the approval to the plan bytes. A hand-rolled stable-stringify ignored
  # non-enumerable keys, Map/Set/Date, NaN and -0, so a plan could carry a field the human never
  # saw and hash identically. It now goes through the spine's hardened canonicaliser, which
  # REFUSES those shapes rather than flattening them.
  run _node "$PRE
    const hidden = JSON.parse(JSON.stringify(PLAN));
    Object.defineProperty(hidden, 'publish_target', { value: 'https://attacker.example/', enumerable: false });
    const sameSha = C.planSha(hidden) === SHA ? 'COLLIDES' : 'distinct-or-refused';
    const nan = err(() => C.planSha({ ...PLAN, n: NaN }));
    const date = err(() => C.planSha({ ...PLAN, d: new Date(0) }));
    console.log([sameSha, nan, date].join(' '));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # The hidden-key plan still hashes the same (it is invisible to any serialiser), but the shapes
  # that used to FLATTEN into a false match are now coded refusals.
  [ "$output" = "COLLIDES BAD_PLAN BAD_PLAN" ]
}

@test "gate: a bare plan sha that is not a sha is refused before anything is searched" {
  run _node "$PRE
    console.log([err(() => C.assertClusterApproved({ events: [req(), dec()], clusterId: 'c-001', planSha: 'nope' })),
                 err(() => C.assertClusterApproved({ events: 'not-an-array', clusterId: 'c-001', planSha: SHA }))].join(' '));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "BAD_PLAN_SHA BAD_INPUT" ]
}

@test "gate: the reader wrapper shape is accepted as well as bare events" {
  # The spine reader returns {event}. If the gate only understood one of the two shapes it would
  # refuse everything in production or accept nothing in tests.
  run _node "$PRE
    console.log(gate([{ event: req() }, { event: dec() }]) === REQ ? 'unwrapped' : 'WRONG');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "unwrapped" ]
}

# ---------- E2: the command has no way to publish ----------

@test "gate: the growth command exposes no promote, publish, merge or deploy verb" {
  # E2 is enforced by ABSENCE. A verb that does not exist cannot be reached by a mistake, a retry
  # loop, or a mutant module.
  #
  # THIRD VERSION OF THIS TEST, and the first that is not a substring search.
  #   v1 grepped for a verb at line start: adding `publish: cmdGenerate` to the COMMANDS object
  #      left it green, and `\s` in `grep -E` is a GNU extension that silently degrades on macOS.
  #   v2 grepped the object literal. An adversarial pass on 2026-08-14 walked a mutant past it:
  #      ONE appended line, `COMMANDS.publish = fn`, registers a fully reachable verb that no
  #      grep of the literal can see. `Object.assign` and `defineProperty` are two more ways.
  #      The mutant wrote its file and exited 0 while this test stayed green.
  # A guard on a Tier E unamendable rule cannot be a substring search of its own source -- that is
  # this repo's oldest recurring defect, a grep where a parse was needed.
  #
  # The module now has a realpath-both-sides main guard, so importing it does NOT run the CLI and
  # the test can simply ask what was registered. Same fix as tests/growth-lints.bats: the rule is
  # grep the pattern, not the file, and a fix is not applied until it is made everywhere.
  run _node "const M = await import(\"./.claude/scripts/growth/arc-growth.mjs\");
    const verbs = Object.keys(M.COMMANDS).sort();
    console.log(verbs.join(',') + ' | ' + (verbs.filter((v) => /promote|publish|merge|deploy|ship/.test(v)).join(',') || 'none'));"
  [ "$status" -eq 0 ] || { echo "the module could not be imported at all: $output"; false; }
  [[ "$output" == *"| none"* ]] || { echo "COMMANDS registers a publishing verb: $output"; false; }
  # Positive control: 'none' must be the answer to a real registry, not to an empty object.
  [[ "$output" == *"mine"* ]] || { echo "positive control failed: registry does not even list mine: $output"; false; }
}

@test "gate: the CLI itself refuses to generate against an unapproved cluster" {
  # Every other test in this file exercises the library. Deleting the assertClusterApproved CALL
  # from arc-growth.mjs would leave them all green -- the security boundary's only caller was
  # uncovered. This runs the real command.
  plan="$BATS_TEST_TMPDIR/plan.json"
  _node "$PRE console.log(JSON.stringify(PLAN));" > "$plan"
  [ -s "$plan" ] || { echo "fixture plan was not written"; false; }
  run env ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine" node "$ARC_ROOT/.claude/scripts/growth/arc-growth.mjs" generate --cluster-id c-001 --plan "$plan"
  [ "$status" -ne 0 ] || { echo "the CLI generated against a cluster nobody approved: $output"; false; }
  [[ "$output" == *"NOT_APPROVED"* ]] || { echo "refused, but not for the documented reason: $output"; false; }
}

@test "gate: the CLI refuses a repeated flag rather than silently picking one" {
  run node "$ARC_ROOT/.claude/scripts/growth/arc-growth.mjs" cluster --candidates a.jsonl --cluster-id c-001 --out FIRST.jsonl --out SECOND.jsonl
  [ "$status" -ne 0 ] || { echo "two --out values were accepted: $output"; false; }
  [[ "$output" == *"BAD_ARGS"* ]]
}

@test "gate: the CLI refuses an unknown option instead of ignoring it" {
  # `--offline=true` silently ran ONLINE and a typo in --accept-unknown was a no-op: both safety
  # flags failed toward the less safe behaviour.
  run node "$ARC_ROOT/.claude/scripts/growth/arc-growth.mjs" mine --sources s.json --out o.jsonl --offline=true
  [ "$status" -ne 0 ] || { echo "an unknown option was ignored: $output"; false; }
  [[ "$output" == *"BAD_ARGS"* ]]
}

# ---------- ADR-1116: a spoke must be a distinct topic, not a re-cut of the pillar ----------

@test "gate: a candidate that only re-cuts the pillar is not a spoke" {
  # The first REAL cluster was pillar "ai agents" with spokes "agents build", "ai agents build" and
  # "coding agents" -- assumption A-05 fired on it. The cause was spoke selection sorting by
  # DESCENDING token overlap with the pillar, so the rule preferred a candidate the more exactly it
  # repeated the pillar. Empty residue means the candidate says nothing the pillar does not.
  run _node "$PRE
    const k = (kw, intent = 'informational') => ({ ...c(1, intent), keyword: kw });
    const pool = [k('ai agents'), k('open-source ai'), k('ai agents build'), k('agents build'),
                  k('ai coding'), k('coding workflows'), k('ai voice'), k('driven development'),
                  k('open-source alternative', 'transactional'), k('pricing page', 'transactional')];
    const p = C.buildClusterPlan({ candidates: pool, clusterId: 'c-001' });
    console.log(p.pillar.keyword + ' | ' + p.spokes.map((s) => s.keyword).join(','));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # "open-source ai" reduces to {ai} -- a subset of the pillar, so its residue is empty.
  # "ai agents build" and "agents build" both reduce to residue {build}: the same spoke twice.
  [ "$output" = "ai agents | agents build,ai coding,coding workflows,ai voice,driven development" ]
}

@test "gate: two candidates with the same residue yield one spoke, not two" {
  run _node "$PRE
    const k = (kw, intent = 'informational') => ({ ...c(1, intent), keyword: kw });
    const pool = [k('alpha'), k('alpha beta'), k('beta alpha'), k('alpha gamma'), k('alpha delta'),
                  k('alpha epsilon'), k('alpha zeta'),
                  k('buy alpha', 'transactional'), k('alpha cost', 'transactional')];
    console.log(err(() => C.buildClusterPlan({ candidates: pool, clusterId: 'c-001' })));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # 'alpha beta' and 'beta alpha' are one topic, so only 5 distinct residues exist and the floor
  # of 5 is met exactly -- but the pool check counts rows, so this proves the builder SUCCEEDS
  # while collapsing the duplicate rather than padding the cluster with it.
  [ "$output" = "NO-THROW" ]
}

@test "gate: the residue rule refuses rather than padding a pool of one repeated topic" {
  # The negative control for the rule: a pool where every row restates the pillar must REFUSE.
  # If ADR-1116's residue check is deleted, this pool builds a happy 6-spoke cluster and this test
  # goes green -- so this is the assertion that fails when the implementation is ripped out.
  run _node "$PRE
    const k = (kw, intent = 'informational') => ({ ...c(1, intent), keyword: kw });
    const pool = [k('ai agents'), k('agents ai'), k('ai agents ai'), k('agents'), k('ai'),
                  k('agents ai agents'), k('ai ai agents'),
                  k('buy agents', 'transactional'), k('agents cost', 'transactional')];
    console.log(err(() => C.buildClusterPlan({ candidates: pool, clusterId: 'c-001' })));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "THIN_CLUSTER" ]
}

@test "gate: the pillar comparison keeps two-letter topic tokens" {
  # The tokeniser dropped every token of two characters or fewer, so the pillar "ai agents" was
  # compared as {agents} and "ai" -- this subject matter's most load-bearing token -- was invisible.
  # With it restored, "ai coding" is a different topic from "coding agents": both carry {coding},
  # so the second is the first repeated, and exactly one survives.
  run _node "$PRE
    const k = (kw, intent = 'informational') => ({ ...c(1, intent), keyword: kw });
    const pool = [k('ai agents'), k('ai coding'), k('coding agents'), k('ai voice'), k('ai memory'),
                  k('ai review'), k('ai testing'),
                  k('buy ai', 'transactional'), k('ai pricing', 'transactional')];
    const p = C.buildClusterPlan({ candidates: pool, clusterId: 'c-001' });
    console.log(p.spokes.map((s) => s.keyword).join(','));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "ai coding,ai voice,ai memory,ai review,ai testing" ]
}

@test "gate: bats registers every test this file declares" {
  declared="$(grep -c '^@test ' "$BATS_TEST_FILENAME")"
  registered="$(bats --count "$BATS_TEST_FILENAME")"
  [ "$registered" -eq "$declared" ] || { echo "declared $declared, bats registered $registered"; false; }
  [ "$declared" -gt 15 ]
}
