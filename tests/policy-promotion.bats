#!/usr/bin/env bats
# Phase 02 -- the promotion chain and automatic demotion (REQ-04, POL-C).
#
#   request   approval.requested under the strict `policy.promotion` profile
#   decide    a human decision.recorded through the inbox
#   apply     policy.level.changed citing that decision
#
# THE CEILING IS RE-CHECKED AT DECISION TIME, and that is the case worth reading. A ceiling is a
# human repo edit (POL-A), so it can be LOWERED between a promotion being requested and approved,
# and the request carries the old one in its policy_hash. Checking only at request time would let
# a stale approval apply a level the file no longer permits, with a receipt that looks perfectly
# legitimate. A stale approval is REFUSED rather than clamped: silently granting less than a
# human approved is its own lie.
#
# ASCII-only test names; the file asserts its own registered count at the bottom.
bats_require_minimum_version 1.5.0
load 'test_helper'

_node() { cd "$ARC_ROOT" && node --input-type=module -e "$1"; }

PRE='const P = await import("./.claude/scripts/hq/lib/policy/promotion.mjs");
const { validateEvent } = await import("./.claude/scripts/hq/lib/validate.mjs");
const { policyIdem } = await import("./.claude/scripts/hq/lib/validate-policy.mjs");
const K = "session:interactive";
const pol = (over = {}) => ({ version:1, constitution:{version:"1.0",sha256:"x",receipt:"r"},
  levels:{L0:"d",L1:"p",L2:"b",L3:"u"}, ungrantable_actions:[], ungrantable_resources:[],
  targets:{message:[],publish:[],deploy:[]}, argv0_classes:{},
  kinds:{ [K]: { e2:[], read:{level:"L3"}, write:{level:"L2"}, shell:{level:"L1"},
    network:{level:"L1"}, message:{level:"L0"}, publish:{level:"L0"}, deploy:{level:"L0"},
    spend:{level:"L0"}, ...over } } });
const REQ = (over = {}) => P.buildPromotionRequest(
  { kind:K, capability:"write", toLevel:"L2", trialLedgerRef:"docs/trial-ledger.md#t", ...over },
  { policy: pol(), events: [] });
const reqEv = (payload) => ({ id:"01JQ8XZ9K0ABCDEFGH00000001", kind:"approval.requested", payload });
const decEv = (over = {}) => ({ id:"01JQ8XZ9K0ABCDEFGH00000002", kind:"decision.recorded",
  payload:{ decides:"01JQ8XZ9K0ABCDEFGH00000001", verdict:"approve", reason:"ok", ...over } });
const threw = (fn) => { try { fn(); return "NO-THROW"; } catch (e) { return e.message; } };'

@test "a request records the level in force now, not the one in the file" {
  run _node "$PRE const r = REQ(); console.log(r.from_level + '->' + r.to_level + ' ' + r.subject);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "L1->L2 policy.promotion" ]
}

@test "a request above the declared ceiling is refused -- a ceiling is a repo edit" {
  run _node "$PRE console.log(threw(() => REQ({ capability:'shell', toLevel:'L3' })).includes('ceiling is L1'));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "true" ]
}

@test "a request with no trial-ledger citation is refused" {
  # A4: trust is re-earned, never argued back. A request with no evidence is a nudge.
  run _node "$PRE console.log(threw(() => REQ({ trialLedgerRef:'' })).includes('trial-ledger'));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "true" ]
}

@test "a request that does not raise the level is refused" {
  run _node "$PRE console.log(threw(() => REQ({ toLevel:'L1' })).includes('already at'));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "true" ]
}

@test "an approved decision applies the level and cites the decision" {
  run _node "$PRE
    const a = P.applyDecision({ request: reqEv(REQ()), decision: decEv() }, { policy: pol(), events: [] });
    console.log(a.to_level + ' ' + a.decision_ref + ' hash=' + a.policy_hash.length);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "L2 01JQ8XZ9K0ABCDEFGH00000002 hash=64" ]
}

@test "a REJECTED decision applies nothing" {
  run _node "$PRE
    console.log(threw(() => P.applyDecision({ request: reqEv(REQ()), decision: decEv({ verdict:'reject' }) },
      { policy: pol(), events: [] })).includes('only an approval'));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "true" ]
}

@test "a decision that answers a different request applies nothing" {
  run _node "$PRE
    console.log(threw(() => P.applyDecision({ request: reqEv(REQ()), decision: decEv({ decides:'01JQOTHER0000000000000000' }) },
      { policy: pol(), events: [] })).includes('not this request'));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "true" ]
}

@test "A STALE APPROVAL IS REFUSED AFTER THE CEILING DROPS" {
  # The case this module exists for. The request was legitimate when made; the ceiling was
  # lowered by a human before it was approved. Applying it would grant a level the file no
  # longer permits, with a receipt that looks perfectly legitimate. Clamping it silently would
  # grant less than the human approved, which is its own lie.
  run _node "$PRE
    const msg = threw(() => P.applyDecision({ request: reqEv(REQ()), decision: decEv() },
      { policy: pol({ write:{ level:'L1' } }), events: [] }));
    console.log(msg.includes('out of date') + '/' + msg.includes('lowered after the request'));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "true/true" ]
}

@test "the applied payload is a valid spine event" {
  # The chain has to end in a receipt the spine accepts, or it ends in quarantine -- and a
  # quarantined authority change is an authority change nobody made.
  run _node "$PRE
    const a = P.applyDecision({ request: reqEv(REQ()), decision: decEv() }, { policy: pol(), events: [] });
    const ev = { id:'01JQ8XZ9K0ABCDEFGH00000003', v:1, ts:'2026-08-06T21:30:00+05:30',
      idem: policyIdem('policy.level.changed', a), actor:'human:ashiq', process:'p@1.0.0',
      model:null, venture:'arc', run_id:'r-t', kind:'policy.level.changed', payload:a,
      outcome:'ok', cost:null, evidence:null, supersedes:null };
    validateEvent(ev); console.log('valid');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "valid" ]
}

@test "a demotion bites one level down from the EFFECTIVE level" {
  run _node "$PRE
    const a = P.applyDecision({ request: reqEv(REQ()), decision: decEv() }, { policy: pol(), events: [] });
    const up = { id:'01JQ8XZ9K0ABCDEFGH00000004', kind:'policy.level.changed', ts:'t', payload:a };
    const d = P.buildDemotion({ kind:K, capability:'write', incidentId:'01JQ8XZ9K0ABCDEFGH00000005' },
      { policy: pol(), events:[up] });
    console.log(d.from_level + '->' + d.to_level + ' cites=' + d.incident_ref.slice(0,4));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "L2->L1 cites=01JQ" ]
}

@test "a demotion with nothing left to take emits no receipt at all" {
  # A receipt asserting a change that did not happen is a false claim in an append-only ledger.
  run _node "$PRE
    console.log(P.buildDemotion({ kind:K, capability:'publish', incidentId:'01JQ8XZ9K0ABCDEFGH00000005' },
      { policy: pol(), events: [] }));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "null" ]
}

@test "a demotion must cite the incident that caused it" {
  run _node "$PRE
    console.log(threw(() => P.buildDemotion({ kind:K, capability:'write' }, { policy: pol(), events: [] })).includes('cite the incident'));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "true" ]
}

@test "the promotion profile is closed, and other approvals are untouched" {
  run _node "$PRE
    const mk = (payload) => ({ id:'01JQ8XZ9K0ABCDEFGH00000001', v:1, ts:'2026-08-06T21:30:00+05:30',
      idem:'a'.repeat(64), actor:'human:ashiq', process:'p@1.0.0', model:null, venture:'arc',
      run_id:'r-t', kind:'approval.requested', payload, outcome:'ok', cost:null, evidence:null,
      supersedes:null });
    const strict = threw(() => validateEvent(mk({ ...REQ(), surprise: 1 }))) !== 'NO-THROW';
    const generic = threw(() => validateEvent(mk({ what:'approve the plan', gate:'kickoff' }))) === 'NO-THROW';
    console.log(strict + '/' + generic);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "true/true" ]
}

@test "a downward promotion request is refused by the validator too" {
  # Belt to the module's brace: a request to "promote" downward is a demotion arriving through
  # the human door, where nothing checks for an incident.
  run _node "$PRE
    const mk = (payload) => ({ id:'01JQ8XZ9K0ABCDEFGH00000001', v:1, ts:'2026-08-06T21:30:00+05:30',
      idem:'a'.repeat(64), actor:'human:ashiq', process:'p@1.0.0', model:null, venture:'arc',
      run_id:'r-t', kind:'approval.requested', payload, outcome:'ok', cost:null, evidence:null,
      supersedes:null });
    console.log(threw(() => validateEvent(mk({ ...REQ(), from_level:'L2', to_level:'L1' }))) !== 'NO-THROW');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "true" ]
}

@test "this file registered every test it declares" {
  [ "${#BATS_TEST_NAMES[@]}" -eq 15 ] || {
    echo "registered ${#BATS_TEST_NAMES[@]} tests, expected 15 -- a @test was silently dropped"
    false
  }
}
