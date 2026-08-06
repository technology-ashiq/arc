#!/usr/bin/env bats
# Phase 01 -- the money guard (REQ-06, POL-F). Mode A only in v1 (ADR-0056).
#
# The property, in one line: NO PROVIDER CALL BEFORE A SUCCESSFUL RESERVATION. Everything else
# here is in service of that, plus its uncomfortable corollary -- when a process dies between
# the call and the settlement, the chain cannot know whether money moved, so the reservation
# stays open FOREVER and a human decides. Auto-releasing frees budget that may already be gone;
# auto-retrying risks paying twice. A4's no-auto-recovery rule applies to money for exactly the
# reason it applies to trust: the machine cannot know, so it must not guess.
#
# Reservation state is DERIVED from the event chain and never stored. A status field on an
# append-only receipt is a field that learns to lie.
#
# ASCII-only test names; the file asserts its own registered count at the bottom.
bats_require_minimum_version 1.5.0
load 'test_helper'

_node() { cd "$ARC_ROOT" && node --input-type=module -e "$1"; }

PRE='const S = await import("./.claude/scripts/hq/lib/policy/spend.mjs");
const KIND = "process:payer";
const pol = (amount = 100, level = "L1") => ({ version:1, constitution:{}, levels:{},
  ungrantable_actions:[], ungrantable_resources:[], targets:{}, argv0_classes:{},
  kinds:{ [KIND]: { e2:[], read:{level:"L3"}, write:{level:"L0"}, shell:{level:"L0"},
    network:{level:"L0"}, message:{level:"L0"}, publish:{level:"L0"}, deploy:{level:"L0"},
    spend:{ level: level, cap:{ amount, currency:"INR", window:"daily" } } } } });
let seq = 0;
const id = () => "01JQ8XZ9K0ABCDEFGH" + String(++seq).padStart(8, "0");
const reserved = (amount, rid) => ({ id: rid, kind:"spend.reserved", ts:"2026-08-06T10:00:00+05:30",
  payload:{ action_kind:KIND, amount, currency:"INR", correlation:"r", idempotency_key:"k"+rid,
            policy_hash:"0", window:"daily" } });
const settledEv = (ref, amount) => ({ id: id(), kind:"cost.incurred", ts:"2026-08-06T10:01:00+05:30",
  payload:{ amount, currency:"INR", provider_ref:"p", reservation_ref: ref } });
const releasedEv = (ref) => ({ id: id(), kind:"spend.released", ts:"2026-08-06T10:01:00+05:30",
  payload:{ correlation:"r", policy_hash:"0", reason:"declined", reservation_ref: ref } });
// A recording fake. It counts calls, so an absence assertion can prove the call never happened
// rather than merely that nothing was returned.
const fakeProvider = (behaviour = "ok") => {
  const calls = [];
  const fn = async (args) => {
    calls.push(args);
    if (behaviour === "throw") throw new Error("provider exploded");
    if (behaviour === "declined") return { attempted: false, reason: "declined" };
    return { amount: args.amount, providerRef: "prov-1" };
  };
  fn.calls = calls;
  return fn;
};
const emitter = () => { const out = []; const fn = async (kind, payload) => { const eid = id(); out.push({ id: eid, kind, payload }); return eid; }; fn.events = out; return fn; };'

@test "an under-cap reservation is allowed" {
  run _node "$PRE console.log(JSON.stringify(S.checkReservation({kind:KIND, amount:40, currency:'INR'}, {policy:pol(100), events:[]}).ok));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "true" ]
}

@test "the exact boundary is allowed -- the cap is inclusive, and that is pinned" {
  run _node "$PRE const r = S.checkReservation({kind:KIND, amount:100, currency:'INR'}, {policy:pol(100), events:[]});
    console.log(r.ok + '/' + r.after);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "true/0" ]
}

@test "one minor unit over the cap is refused" {
  run _node "$PRE console.log(S.checkReservation({kind:KIND, amount:101, currency:'INR'}, {policy:pol(100), events:[]}).ok);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "false" ]
}

@test "a second run cannot double-spend what the first already settled" {
  run _node "$PRE
    const r1 = id(); const events = [reserved(80, r1), settledEv(r1, 80)];
    const r = S.checkReservation({kind:KIND, amount:40, currency:'INR'}, {policy:pol(100), events});
    console.log(r.ok + ' ' + (r.reason || '').includes('remaining 20'));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "false true" ]
}

@test "an OPEN reservation holds budget just as a settled one does" {
  # The race this closes: two runs both check, both see room, both call. An open reservation is
  # committed budget from the moment its receipt is sealed.
  run _node "$PRE
    const events = [reserved(80, id())];
    console.log(S.checkReservation({kind:KIND, amount:40, currency:'INR'}, {policy:pol(100), events}).ok);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "false" ]
}

@test "a released reservation gives its budget back" {
  run _node "$PRE
    const r1 = id(); const events = [reserved(80, r1), releasedEv(r1)];
    const r = S.checkReservation({kind:KIND, amount:80, currency:'INR'}, {policy:pol(100), events});
    console.log(r.ok + '/' + r.remaining);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "true/100" ]
}

@test "replaying the same chain yields the same ledger" {
  run _node "$PRE
    const r1 = id(), r2 = id();
    const events = [reserved(30, r1), settledEv(r1, 30), reserved(20, r2)];
    const a = S.reservationLedger(events, KIND), b = S.reservationLedger(events, KIND);
    console.log(a.committed === b.committed && a.committed === 50 ? 'deterministic:50' : 'DRIFT');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "deterministic:50" ]
}

@test "a settlement naming a reservation nobody opened cannot free budget" {
  run _node "$PRE
    const events = [reserved(80, id()), settledEv('01JQ8XZ9K0ABCDEFGHNOSUCHXX', 80)];
    console.log(S.reservationLedger(events, KIND).committed);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "80" ]
}

@test "spend denied by policy refuses before any ledger arithmetic" {
  run _node "$PRE console.log(S.checkReservation({kind:KIND, amount:1, currency:'INR'}, {policy:pol(100,'L0'), events:[]}).ok);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "false" ]
}

@test "a currency that does not match the declared cap is refused, never converted" {
  run _node "$PRE console.log(S.checkReservation({kind:KIND, amount:10, currency:'USD'}, {policy:pol(100), events:[]}).ok);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "false" ]
}

@test "a non-integer or non-positive amount is refused" {
  run _node "$PRE
    const bad = [10.5, -1, 0, '10', null].map(a => S.checkReservation({kind:KIND, amount:a, currency:'INR'}, {policy:pol(100), events:[]}).ok);
    console.log(bad.join(','));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "false,false,false,false,false" ]
}

@test "NO PROVIDER CALL BEFORE A SUCCESSFUL RESERVATION" {
  # The absence assertion that matters, and it is not vacuous: the fake COUNTS calls, so a zero
  # here means the call did not happen rather than that nothing was returned.
  run _node "$PRE
    const prov = fakeProvider(); const emit = emitter();
    const r = await S.reserveAndSpend({kind:KIND, amount:500, currency:'INR', idempotencyKey:'k1'},
      {policy:pol(100), events:[], emit, providerCall:prov});
    console.log(r.ok + ' calls=' + prov.calls.length + ' events=' + emit.events.length);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "false calls=0 events=0" ]
}

@test "the reservation receipt is sealed BEFORE the provider is called" {
  run _node "$PRE
    const prov = fakeProvider(); const emit = emitter();
    await S.reserveAndSpend({kind:KIND, amount:40, currency:'INR', idempotencyKey:'k1'},
      {policy:pol(100), events:[], emit, providerCall:prov});
    console.log(emit.events[0].kind + ' then calls=' + prov.calls.length + ' then ' + emit.events[1].kind);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "spend.reserved then calls=1 then cost.incurred" ]
}

@test "an unsealed reservation receipt stops the flow -- no provider call" {
  run _node "$PRE
    const prov = fakeProvider(); const emit = async () => '';
    const r = await S.reserveAndSpend({kind:KIND, amount:40, currency:'INR', idempotencyKey:'k1'},
      {policy:pol(100), events:[], emit, providerCall:prov});
    console.log(r.ok + ' calls=' + prov.calls.length);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "false calls=0" ]
}

@test "CRASH AFTER THE CALL leaves the reservation open, never auto-released" {
  run _node "$PRE
    const prov = fakeProvider('throw'); const emit = emitter();
    const r = await S.reserveAndSpend({kind:KIND, amount:40, currency:'INR', idempotencyKey:'k1'},
      {policy:pol(100), events:[], emit, providerCall:prov});
    const kinds = emit.events.map(e => e.kind).join(',');
    console.log(r.stuck + ' ' + kinds + ' released=' + kinds.includes('spend.released'));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "true spend.reserved released=false" ]
}

@test "a provider certain it never charged IS released -- the only safe case" {
  run _node "$PRE
    const prov = fakeProvider('declined'); const emit = emitter();
    const r = await S.reserveAndSpend({kind:KIND, amount:40, currency:'INR', idempotencyKey:'k1'},
      {policy:pol(100), events:[], emit, providerCall:prov});
    console.log(r.released + ' ' + emit.events.map(e => e.kind).join(','));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "true spend.reserved,spend.released" ]
}

@test "a stuck reservation is visible to a human" {
  run _node "$PRE
    const rid = id(); const stuck = S.stuckReservations([reserved(40, rid)], KIND);
    console.log(stuck.length + '/' + stuck[0].amount);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "1/40" ]
}

@test "this file registered every test it declares" {
  [ "${#BATS_TEST_NAMES[@]}" -eq 18 ] || {
    echo "registered ${#BATS_TEST_NAMES[@]} tests, expected 18 -- a @test was silently dropped"
    false
  }
}
