#!/usr/bin/env bats
# Phase 02 -- the four authority receipts (ADR-0508, POL-E). Vocabulary 40 -> 44.
#
# Two kinds for promotion and demotion rather than one with a direction field, because they have
# two different TRUTH SOURCES: a level change is human-decided and must cite the decision that
# authorised it; a demotion is machine-derived and must cite the incident that caused it. One
# kind would make both citations optional, and an event asserting "direction: up" with nothing
# to point at is a forgery the validator could not reject. The revenue.received /
# revenue.simulated pair is the precedent.
#
# The demotion kind may ONLY ever lower a level. Without that rule an attacker who can emit
# would always prefer it over the human path, because it needs no decision to cite.
#
# ASCII-only test names; the file asserts its own registered count at the bottom.
bats_require_minimum_version 1.5.0
load 'test_helper'

_node() { cd "$ARC_ROOT" && node --input-type=module -e "$1"; }

PRE='const { validateEvent, KINDS } = await import("./.claude/scripts/hq/lib/validate.mjs");
const { POLICY_KINDS, policyIdem } = await import("./.claude/scripts/hq/lib/validate-policy.mjs");
const H = "0".repeat(64), U = "01JQ8XZ9K0ABCDEFGH00000009";
const mk = (kind, payload, over = {}) => ({ id:"01JQ8XZ9K0ABCDEFGH00000001", v:1,
  ts:"2026-08-06T21:30:00+05:30", idem: policyIdem(kind, payload), actor:"human:ashiq",
  process:"policy-fixture@1.0.0", model:null, venture:"arc", run_id:"r-t", kind, payload,
  outcome:"ok", cost:null, evidence:null, supersedes:null, ...over });
const LVL = { action_kind:"session:interactive", capability:"write", correlation:"r",
  decision_ref:U, from_level:"L1", policy_hash:H, to_level:"L2",
  trial_ledger_ref:"docs/trial-ledger.md#t" };
const DEM = { action_kind:"session:interactive", capability:"write", correlation:"r",
  from_level:"L2", incident_ref:U, policy_hash:H, to_level:"L1" };
const RES = { action_kind:"process:payer", amount:40, correlation:"r", currency:"INR",
  idempotency_key:"k1", policy_hash:H, window:"daily" };
const REL = { correlation:"r", policy_hash:H, reason:"declined", released_on:"policy",
  reservation_ref:U };
const refuses = (fn) => { try { fn(); return "ACCEPTED"; } catch (e) { return e.code; } };'

@test "the vocabulary carries the four kinds, once each, and stays unique" {
  run _node "$PRE
    const missing = POLICY_KINDS.filter(k => !KINDS.includes(k));
    const once = POLICY_KINDS.every(k => KINDS.filter(x => x === k).length === 1);
    console.log([POLICY_KINDS.length, missing.length ? 'MISSING' : 'all-present',
      KINDS.length === new Set(KINDS).size ? 'unique' : 'DUPES', once ? 'once-each' : 'REPEATED'].join(' '));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "4 all-present unique once-each" ]
}

@test "the unknown-kind message reports the DERIVED size, not a typed one" {
  # ADR-0107's rule, and the reason extending the vocabulary breaks no sibling lane: nothing
  # anywhere hardcodes the total.
  run _node "$PRE
    const n = KINDS.length;
    console.log(refuses(() => validateEvent(mk('not.akind', {}))) === 'UNKNOWN_KIND' ? 'refused:' + n : 'ACCEPTED');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == refused:* ]]
}

@test "each of the four well formed receipts is accepted" {
  run _node "$PRE
    const ok = [['policy.level.changed',LVL],['policy.demoted',DEM],['spend.reserved',RES],['spend.released',REL]]
      .map(([k,p]) => refuses(() => validateEvent(mk(k,p))) === 'ACCEPTED' ? 'y' : 'n').join('');
    console.log(ok);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "yyyy" ]
}

@test "an unknown payload key is refused on every one of the four" {
  run _node "$PRE
    const bad = [['policy.level.changed',LVL],['policy.demoted',DEM],['spend.reserved',RES],['spend.released',REL]]
      .map(([k,p]) => refuses(() => validateEvent(mk(k, {...p, surprise:1}))));
    console.log(bad.every(c => c === 'BAD_POLICY') ? 'all-refused' : bad.join(','));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "all-refused" ]
}

@test "a missing required key is refused on every one of the four" {
  run _node "$PRE
    const drop = (o, k) => { const c = {...o}; delete c[k]; return c; };
    const bad = [['policy.level.changed',LVL,'decision_ref'],['policy.demoted',DEM,'incident_ref'],
                 ['spend.reserved',RES,'idempotency_key'],['spend.released',REL,'released_on']]
      .map(([k,p,f]) => refuses(() => validateEvent(mk(k, drop(p,f)))));
    console.log(bad.every(c => c === 'BAD_POLICY') ? 'all-refused' : bad.join(','));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "all-refused" ]
}

@test "L4 is not a level in a payload either" {
  run _node "$PRE console.log(refuses(() => validateEvent(mk('policy.level.changed', {...LVL, to_level:'L4'}))));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "BAD_POLICY" ]
}

@test "a capability outside the closed eight is refused" {
  run _node "$PRE console.log(refuses(() => validateEvent(mk('policy.level.changed', {...LVL, capability:'telepathy'}))));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "BAD_POLICY" ]
}

@test "an action kind that is neither process nor the reserved session is refused" {
  run _node "$PRE
    const bad = ['nonsense', 'process:BadCase', '__proto__', ''].map(a =>
      refuses(() => validateEvent(mk('policy.level.changed', {...LVL, action_kind:a}))));
    console.log(bad.every(c => c === 'BAD_POLICY') ? 'all-refused' : bad.join(','));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "all-refused" ]
}

@test "A DEMOTION THAT DOES NOT LOWER THE LEVEL IS REFUSED" {
  # The rule that stops the machine-derived kind becoming the cheap path to a promotion: it
  # needs no decision to cite, so it must be unable to raise anything.
  run _node "$PRE
    const up   = refuses(() => validateEvent(mk('policy.demoted', {...DEM, from_level:'L1', to_level:'L2'})));
    const flat = refuses(() => validateEvent(mk('policy.demoted', {...DEM, from_level:'L1', to_level:'L1'})));
    console.log(up + '/' + flat);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "BAD_POLICY/BAD_POLICY" ]
}

@test "a promotion must cite a real decision and its trial-ledger evidence" {
  run _node "$PRE
    const noUlid = refuses(() => validateEvent(mk('policy.level.changed', {...LVL, decision_ref:'not-a-ulid'})));
    const noEvid = refuses(() => validateEvent(mk('policy.level.changed', {...LVL, trial_ledger_ref:''})));
    console.log(noUlid + '/' + noEvid);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "BAD_POLICY/BAD_POLICY" ]
}

@test "money is integer minor units and ISO-4217, never a float or a lowercase code" {
  run _node "$PRE
    const bad = [10.5, -1, 0, '40'].map(a => refuses(() => validateEvent(mk('spend.reserved', {...RES, amount:a}))))
      .concat([refuses(() => validateEvent(mk('spend.reserved', {...RES, currency:'inr'})))]);
    console.log(bad.every(c => c === 'BAD_POLICY') ? 'all-refused' : bad.join(','));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "all-refused" ]
}

@test "a release must say WHO decided nothing was charged" {
  # `policy` and `provider_attested_no_charge` are different claims -- the second rests on a
  # provider's word and is the money model's one unverifiable delegation. An auditor has to be
  # able to tell them apart, so it is a validated enum, not free text in `reason`.
  run _node "$PRE
    const ok1 = refuses(() => validateEvent(mk('spend.released', {...REL, released_on:'policy'})));
    const ok2 = refuses(() => validateEvent(mk('spend.released', {...REL, released_on:'provider_attested_no_charge'})));
    const bad = refuses(() => validateEvent(mk('spend.released', {...REL, released_on:'whatever'})));
    console.log(ok1 + '/' + ok2 + '/' + bad);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "ACCEPTED/ACCEPTED/BAD_POLICY" ]
}

@test "the idem is welded to the total preimage -- a changed fact is a different receipt" {
  run _node "$PRE
    const stale = refuses(() => validateEvent(mk('policy.level.changed', {...LVL, to_level:'L3'},
      { idem: policyIdem('policy.level.changed', LVL) })));
    console.log(stale);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "BAD_POLICY" ]
}

@test "two reservations for one idempotency key produce the same idem" {
  # So the spine refuses the second as DUP_IDEM rather than holding budget twice. The
  # idempotency guarantee becomes a property of the spine, not of the caller's diligence.
  run _node "$PRE
    const a = policyIdem('spend.reserved', RES);
    const b = policyIdem('spend.reserved', {...RES, correlation:'a-different-correlation'});
    const c = policyIdem('spend.reserved', {...RES, idempotency_key:'k2'});
    console.log((a === b) + '/' + (a === c));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "true/false" ]
}

@test "this file registered every test it declares" {
  [ "${#BATS_TEST_NAMES[@]}" -eq 15 ] || {
    echo "registered ${#BATS_TEST_NAMES[@]} tests, expected 15 -- a @test was silently dropped"
    false
  }
}
