#!/usr/bin/env bats
# Phase 01 -- the money guard (REQ-06, POL-F). Mode A only in v1 (ADR-0056).
#
# The property: NO PROVIDER CALL BEFORE A SUCCESSFUL RESERVATION, and the reservation is taken
# inside a lock that re-reads the chain. The first version checked and emitted in two steps with
# an await between, so three concurrent calls charged 240 against a cap of 100 and two sequential
# ones charged 160. The suite did not catch it because its emitter fake pushed into its own array
# and never fed the next check -- the fixture was shaped so the bug could not appear. That is why
# `_lockedStore` below is one object that emit writes to and readEvents reads from.
#
# A MALFORMED MONEY EVENT IS REFUSED, NEVER SKIPPED. Skipping always fails permissive: a float
# settlement amount used to coerce to 0 and hand back budget already spent, and a negative one
# manufactured budget outright.
#
# ASCII-only test names; the file asserts its own registered count at the bottom.
bats_require_minimum_version 1.5.0
load 'test_helper'

_node() { cd "$ARC_ROOT" && node --input-type=module -e "$1"; }

PRE='const S = await import("./.claude/scripts/hq/lib/policy/spend.mjs");
const KIND = "process:payer";
const DAY = "2026-08-06";
const T = (d = DAY) => d + "T10:00:00+05:30";
const pol = (amount = 100, level = "L1", currency = "INR") => ({ version:1,
  constitution:{version:"1.0",sha256:"x",receipt:"r"}, levels:{L0:"d",L1:"p",L2:"b",L3:"u"},
  ungrantable_actions:[], ungrantable_resources:[], targets:{}, argv0_classes:{},
  kinds:{ [KIND]: { e2:[], read:{level:"L3"}, write:{level:"L0"}, shell:{level:"L0"},
    network:{level:"L0"}, message:{level:"L0"}, publish:{level:"L0"}, deploy:{level:"L0"},
    spend:{ level: level, cap:{ amount, currency, window:"daily" } } } } });
let seq = 0;
const id = () => "01JQ8XZ9K0ABCDEFGH" + String(++seq).padStart(8, "0");
const reserved = (amount, rid, over = {}) => ({ id: rid, kind:"spend.reserved", ts: T(),
  payload:{ action_kind:KIND, amount, currency:"INR", correlation:"r",
            idempotency_key:"k"+rid, policy_hash:"0", window:"daily", ...over } });
const settledEv = (ref, amount, over = {}) => ({ id: id(), kind:"cost.incurred", ts: T(),
  payload:{ amount, currency:"INR", provider_ref:"p", reservation_ref: ref, ...over } });
const releasedEv = (ref) => ({ id: id(), kind:"spend.released", ts: T(),
  payload:{ correlation:"r", policy_hash:"0", reason:"declined", reservation_ref: ref } });
// A recording fake that COUNTS calls, so an absence assertion proves the call did not happen
// rather than that nothing came back.
const fakeProvider = (behaviour = "ok", amount = null) => {
  const calls = [];
  const fn = async (args) => {
    calls.push(args);
    if (behaviour === "throw") throw new Error("provider exploded");
    if (behaviour === "declined") return { attempted: false, reason: "declined" };
    return { amount: amount === null ? args.amount : amount, providerRef: "prov-1" };
  };
  fn.calls = calls;
  return fn;
};
// ONE store shared by emit and readEvents -- the shape the old fake lacked, which is the only
// reason the concurrency hole was invisible.
const store = (seed = []) => {
  const events = [...seed];
  let held = false;
  return {
    events,
    readEvents: async () => events.slice(),
    emit: async (kind, payload) => { const eid = id(); events.push({ id: eid, kind, ts: T(), payload }); return eid; },
    emitUnsealed: async () => "",
    // A real serialising lock: a second entrant waits rather than interleaving.
    withLock: async (fn) => {
      while (held) await new Promise((r) => setTimeout(r, 1));
      held = true;
      try { return await fn(); } finally { held = false; }
    },
    // The BROKEN lock the first version effectively had -- no serialisation at all.
    noLock: async (fn) => fn(),
  };
};
const call = (st, over = {}) => S.reserveAndSpend(
  { kind: KIND, amount: over.amount ?? 40, currency: over.currency ?? "INR",
    idempotencyKey: over.key ?? "k1", day: DAY },
  { policy: over.policy ?? pol(100), readEvents: st.readEvents, emit: over.emit ?? st.emit,
    providerCall: over.prov, withLock: over.lock ?? st.withLock });'

@test "an under-cap reservation is allowed" {
  run _node "$PRE console.log(S.checkReservation({kind:KIND, amount:40, currency:'INR', day:DAY}, {policy:pol(100), events:[]}).ok);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "true" ]
}

@test "the exact boundary is allowed -- the cap is inclusive, and that is pinned" {
  run _node "$PRE const r = S.checkReservation({kind:KIND, amount:100, currency:'INR', day:DAY}, {policy:pol(100), events:[]});
    console.log(r.ok + '/' + r.after);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "true/0" ]
}

@test "one minor unit over the cap is refused" {
  run _node "$PRE console.log(S.checkReservation({kind:KIND, amount:101, currency:'INR', day:DAY}, {policy:pol(100), events:[]}).ok);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "false" ]
}

@test "CONCURRENT calls cannot both reserve -- the lock re-reads the chain" {
  # The finding that mattered most. Three at once against a cap of 100, 40 each: exactly two
  # may succeed. Without the lock all three passed and charged 240.
  run _node "$PRE
    const st = store(); const prov = fakeProvider();
    const rs = await Promise.all([1,2,3].map(i => call(st, { prov, key:'k'+i })));
    const okCount = rs.filter(r => r.ok).length;
    const charged = prov.calls.reduce((a,c) => a + c.amount, 0);
    console.log('ok=' + okCount + ' charged=' + charged);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "ok=2 charged=80" ]
}

@test "SEQUENTIAL calls see each other -- the chain is re-read, not remembered" {
  run _node "$PRE
    const st = store(); const prov = fakeProvider();
    const a = await call(st, { prov, key:'k1', amount:80 });
    const b = await call(st, { prov, key:'k2', amount:80 });
    console.log(a.ok + '/' + b.ok + ' charged=' + prov.calls.reduce((x,c)=>x+c.amount,0));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "true/false charged=80" ]
}

@test "the same idempotency key does not open a second reservation" {
  run _node "$PRE
    const st = store(); const prov = fakeProvider('throw');
    await call(st, { prov, key:'same' });
    const second = await call(st, { prov: fakeProvider(), key:'same' });
    console.log(second.ok + ' ' + (second.reason||'').includes('already has open reservation'));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "false true" ]
}

@test "an OPEN reservation holds budget just as a settled one does" {
  run _node "$PRE console.log(S.checkReservation({kind:KIND, amount:40, currency:'INR', day:DAY},
    {policy:pol(100), events:[reserved(80, id())]}).ok);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "false" ]
}

@test "a released reservation gives its budget back" {
  run _node "$PRE const r1 = id();
    const r = S.checkReservation({kind:KIND, amount:80, currency:'INR', day:DAY}, {policy:pol(100), events:[reserved(80,r1), releasedEv(r1)]});
    console.log(r.ok + '/' + r.remaining);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "true/100" ]
}

@test "a settlement with a non-integer amount is REFUSED, never coerced to zero" {
  # Coercing to 0 handed back budget that had already been spent: reserve 80, settle 10.5,
  # committed became 0, and a fresh 100 was admitted on a cap of 100.
  run _node "$PRE const r1 = id();
    const r = S.checkReservation({kind:KIND, amount:100, currency:'INR', day:DAY},
      {policy:pol(100), events:[reserved(80,r1), settledEv(r1, 10.5)]});
    console.log(r.ok + ' ' + (r.reason||'').includes('could not be read'));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "false true" ]
}

@test "a negative settlement amount cannot manufacture budget" {
  run _node "$PRE const r1 = id();
    console.log(S.checkReservation({kind:KIND, amount:1000, currency:'INR', day:DAY},
      {policy:pol(100), events:[reserved(80,r1), settledEv(r1, -1000)]}).ok);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "false" ]
}

@test "a malformed reservation is refused rather than silently holding nothing" {
  run _node "$PRE
    console.log(S.checkReservation({kind:KIND, amount:10, currency:'INR', day:DAY},
      {policy:pol(100), events:[reserved(80.5, id())]}).ok);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "false" ]
}

@test "a cross-currency settlement is refused, never summed" {
  run _node "$PRE const r1 = id();
    console.log(S.checkReservation({kind:KIND, amount:10, currency:'INR', day:DAY},
      {policy:pol(100), events:[reserved(80,r1), settledEv(r1, 1, {currency:'USD'})]}).ok);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "false" ]
}

@test "the daily window is a real filter -- yesterday does not spend today" {
  # Named in four places and implemented in none: three past days folded into today and the cap
  # never reset.
  run _node "$PRE
    const old = reserved(90, id()); old.ts = T('2026-08-05');
    const r = S.checkReservation({kind:KIND, amount:90, currency:'INR', day:DAY}, {policy:pol(100), events:[old]});
    console.log(r.ok + '/' + r.remaining);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "true/100" ]
}

@test "two reservations sharing an id are refused, not merged" {
  run _node "$PRE const dup = id();
    console.log(S.checkReservation({kind:KIND, amount:10, currency:'INR', day:DAY},
      {policy:pol(100), events:[reserved(80,dup), reserved(80,dup)]}).ok);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "false" ]
}

@test "spend denied by policy refuses before any ledger arithmetic" {
  run _node "$PRE console.log(S.checkReservation({kind:KIND, amount:1, currency:'INR', day:DAY}, {policy:pol(100,'L0'), events:[]}).ok);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "false" ]
}

@test "a cap whose window is not daily is not a usable cap" {
  run _node "$PRE
    const p = pol(100); p.kinds[KIND].spend.cap.window = 'monthly';
    console.log(S.spendCap(p, KIND) === null);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "true" ]
}

@test "a bad currency on either side is refused, including undefined on both" {
  run _node "$PRE
    const p = pol(100, 'L1'); delete p.kinds[KIND].spend.cap.currency;
    const a = S.checkReservation({kind:KIND, amount:10, currency:undefined, day:DAY}, {policy:p, events:[]}).ok;
    const b = S.checkReservation({kind:KIND, amount:10, currency:'inr', day:DAY}, {policy:pol(100), events:[]}).ok;
    console.log(a + '/' + b);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "false/false" ]
}

@test "a non-integer or non-positive or absurd amount is refused" {
  run _node "$PRE
    console.log([10.5, -1, 0, '10', null, 1e21].map(a =>
      S.checkReservation({kind:KIND, amount:a, currency:'INR', day:DAY}, {policy:pol(100), events:[]}).ok).join(','));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "false,false,false,false,false,false" ]
}

@test "NO PROVIDER CALL BEFORE A SUCCESSFUL RESERVATION" {
  run _node "$PRE
    const st = store(); const prov = fakeProvider();
    const r = await call(st, { prov, amount:500 });
    console.log(r.ok + ' calls=' + prov.calls.length + ' events=' + st.events.length);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "false calls=0 events=0" ]
}

@test "the reservation receipt is sealed BEFORE the provider is called" {
  run _node "$PRE
    const st = store(); const prov = fakeProvider();
    await call(st, { prov });
    console.log(st.events[0].kind + ' then calls=' + prov.calls.length + ' then ' + st.events[1].kind);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "spend.reserved then calls=1 then cost.incurred" ]
}

@test "an UNSEALED reservation receipt stops the flow -- no provider call" {
  # A quarantined receipt that returns an id is indistinguishable from a sealed one, and
  # spend.reserved is not yet in the closed vocabulary, so today every one of them quarantines.
  run _node "$PRE
    const st = store(); const prov = fakeProvider();
    const r = await call(st, { prov, emit: st.emitUnsealed });
    console.log(r.ok + ' calls=' + prov.calls.length);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "false calls=0" ]
}

@test "an UNSEALED settlement receipt is stuck, not success" {
  # The twin the first version missed: the reserve emit was checked and its two siblings were not.
  run _node "$PRE
    const st = store(); const prov = fakeProvider();
    let n = 0;
    const emit = async (k, p) => (++n === 1 ? st.emit(k, p) : '');
    const r = await call(st, { prov, emit });
    console.log(r.ok + '/' + r.stuck + '/' + r.stage);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "false/true/settle" ]
}

@test "CRASH AFTER THE CALL leaves the reservation open, never auto-released" {
  run _node "$PRE
    const st = store(); const prov = fakeProvider('throw');
    const r = await call(st, { prov });
    const kinds = st.events.map(e => e.kind).join(',');
    console.log(r.stuck + ' ' + kinds + ' released=' + kinds.includes('spend.released'));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "true spend.reserved released=false" ]
}

@test "a provider certain it never charged IS released, and the release says so" {
  run _node "$PRE
    const st = store(); const prov = fakeProvider('declined');
    const r = await call(st, { prov });
    console.log(r.released + ' ' + st.events.map(e => e.kind).join(',') + ' ' + st.events[1].payload.released_on);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "true spend.reserved,spend.released provider_attested_no_charge" ]
}

@test "a provider that charges MORE than it was authorised is settled but flagged" {
  # The money moved, so it must be recorded -- but reporting ok for a charge outside the
  # authorised amount would be the lie. It settles the true figure and returns overCap.
  run _node "$PRE
    const st = store(); const prov = fakeProvider('ok', 100000);
    const r = await call(st, { prov });
    console.log(r.ok + '/' + r.overCap + '/' + r.amount + '/' + st.events[1].payload.amount);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "false/true/100000/100000" ]
}

@test "a missing idempotency key or providerCall is refused before anything is emitted" {
  run _node "$PRE
    const st = store();
    const a = await S.reserveAndSpend({kind:KIND, amount:10, currency:'INR', idempotencyKey:'', day:DAY},
      {policy:pol(100), readEvents:st.readEvents, emit:st.emit, providerCall:fakeProvider(), withLock:st.withLock});
    const b = await S.reserveAndSpend({kind:KIND, amount:10, currency:'INR', idempotencyKey:'k', day:DAY},
      {policy:pol(100), readEvents:st.readEvents, emit:st.emit, withLock:st.withLock});
    console.log(a.ok + '/' + b.ok + ' events=' + st.events.length);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "false/false events=0" ]
}

@test "every money receipt carries a real policy hash, never a placeholder" {
  run _node "$PRE
    const st = store(); const prov = fakeProvider();
    await call(st, { prov });
    const h = st.events[0].payload.policy_hash;
    console.log((h && h !== '0' && h.length === 64) ? 'real-hash' : 'PLACEHOLDER:' + h);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "real-hash" ]
}

@test "a settlement naming a reservation nobody opened is surfaced, not dropped" {
  run _node "$PRE
    const l = S.reservationLedger([reserved(80, id()), settledEv('01JQ8XZ9K0ABCDEFGHNOSUCHXX', 80)], KIND);
    console.log(l.committed + '/' + l.unreconciled.length);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "80/1" ]
}

@test "stuck reservations are visible across every kind, with their age" {
  run _node "$PRE
    const other = reserved(10, id()); other.payload.action_kind = 'process:someone-else';
    const all = S.stuckReservations([reserved(40, id()), other]);
    console.log(all.length + '/' + all.every(r => r.unreconciled || typeof r.ts === 'string'));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "2/true" ]
}

@test "replaying the same chain yields the same ledger" {
  run _node "$PRE const r1 = id(), r2 = id();
    const events = [reserved(30,r1), settledEv(r1,30), reserved(20,r2)];
    const a = S.reservationLedger(events, KIND), b = S.reservationLedger(events, KIND);
    console.log(a.committed === b.committed && a.committed === 50 ? 'deterministic:50' : 'DRIFT');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "deterministic:50" ]
}

@test "PHASE 04 -- a lock that does not exclude is DETECTED, not trusted" {
  # withLock arrives by INJECTION and is only type-checked. This module header says the
  # concurrency defect was closed because "the DoD asked for withLock and the module had never
  # imported it. It does now." It does not import it -- it accepts it. A Phase 04 attacker passed
  # `async (fn) => fn()` and charged 3 x 5000 against a cap of 10000, reproducing the exact defect
  # the header calls closed. The existing suite could not see it: every test supplies st.withLock,
  # a REAL lock, so it proves the parameter is used and never that it excludes. `st.noLock` was
  # already sitting in the harness, defined and referenced by nothing.
  #
  # A module with no I/O cannot prove another function serialises. It CAN re-read after appending
  # and check the outcome, which is what this pins.
  run _node "$PRE
    const st = store();
    const prov = fakeProvider();
    const rs = await Promise.all([
      call(st, { key:'a', amount:40, prov, lock: st.noLock }),
      call(st, { key:'b', amount:40, prov, lock: st.noLock }),
      call(st, { key:'c', amount:40, prov, lock: st.noLock }),
    ]);
    const led = S.reservationLedger(st.events, KIND, { day: DAY });
    console.log('ok=' + rs.filter(r => r.ok).length + ' committed=' + led.committed +
                ' detected=' + rs.filter(r => /did not exclude/.test(r.reason || '')).length);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # The cap is 100 and three calls of 40 would commit 120. Nothing may commit past the cap.
  [[ "$output" == *"committed=0"* ]] || { echo "a broken lock still overspent: $output"; false; }
  [[ "$output" == *"detected=3"* ]] || { echo "the breach was not detected as a lock failure: $output"; false; }
}

@test "PHASE 04 -- a REAL lock still settles up to the cap and refuses only past it" {
  # THE CONTROL for the test above, and it carries the whole weight. A post-append check that
  # rejects everything would pass that test perfectly while breaking the money flow entirely.
  # Two calls of 40 fit inside 100; the third must be refused by the CAP, not by the lock check.
  run _node "$PRE
    const st = store();
    const prov = fakeProvider();
    const a = await call(st, { key:'a', amount:40, prov });
    const b = await call(st, { key:'b', amount:40, prov });
    const c = await call(st, { key:'c', amount:40, prov });
    const led = S.reservationLedger(st.events, KIND, { day: DAY });
    console.log('a=' + a.ok + ' b=' + b.ok + ' c=' + c.ok + ' committed=' + led.committed +
                ' thirdReason=' + (/exceeds the remaining/.test(c.reason || '') ? 'cap' : 'other'));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"a=true"* ]] || { echo "$output"; false; }
  [[ "$output" == *"b=true"* ]] || { echo "$output"; false; }
  [[ "$output" == *"c=false"* ]] || { echo "$output"; false; }
  [[ "$output" == *"committed=80"* ]] || { echo "$output"; false; }
  # Refused by the CAP, not by the concurrency check -- otherwise the fix is masking the guard.
  [[ "$output" == *"thirdReason=cap"* ]] || { echo "$output"; false; }
}

@test "PHASE 04 -- money that reconciles to nothing blocks further reserving" {
  # reservationLedger collects `unreconciled` -- a settlement naming a reservation this window
  # does not hold -- and its header says they are "surfaced, never dropped". They were surfaced
  # and then dropped: `committed` is settled + open, so checkReservation never saw them. A Phase
  # 04 attacker moved 999,999 minor units past a cap of 10,000 with one such event.
  #
  # They cannot be ADDED to the total: the entry carries no trustworthy amount, because the
  # reservation that would declare its currency and magnitude is the missing thing. So it
  # refuses, which is the rule the rest of this module already follows.
  run _node "$PRE
    const orphan = settledEv('01JQ8XZ9K0ABCDEFGHNOSUCHXX', 999999);
    const r = S.checkReservation({kind:KIND, amount:40, currency:'INR', day:DAY},
                                 {policy:pol(100), events:[orphan]});
    const clean = S.checkReservation({kind:KIND, amount:40, currency:'INR', day:DAY},
                                 {policy:pol(100), events:[]});
    console.log('orphan=' + r.ok + ' unrec=' + /unreconciled/.test(r.reason || '') +
                ' clean=' + clean.ok);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"orphan=false"* ]] || { echo "$output"; false; }
  [[ "$output" == *"unrec=true"* ]] || { echo "refused, but not as an unreconciled chain: $output"; false; }
  # THE CONTROL: a clean chain must still reserve, or this is just a module that always says no.
  [[ "$output" == *"clean=true"* ]] || { echo "$output"; false; }
}

@test "PHASE 04 -- reserveAndSpend refuses without a day, so daily stays daily" {
  # `day` defaulted to null and inWindow returns true for everything when day is null, so the
  # daily cap silently became an all-time cap for any caller that forgot the argument -- in the
  # one entry point that calls a provider. It fails closed, which is why nothing noticed:
  # yesterday permanently consumes today. But a window that never resets is not the cap the grant
  # declares. Not derived from a clock: this module reads no global state, and an absent window
  # is an unanswered question.
  run _node "$PRE
    const st = store();
    const prov = fakeProvider();
    const noDay = await S.reserveAndSpend({kind:KIND, amount:40, currency:'INR', idempotencyKey:'k1'},
      {policy:pol(100), readEvents:st.readEvents, emit:st.emit, providerCall:prov, withLock:st.withLock});
    const bad = await S.reserveAndSpend({kind:KIND, amount:40, currency:'INR', idempotencyKey:'k2', day:'06-08-2026'},
      {policy:pol(100), readEvents:st.readEvents, emit:st.emit, providerCall:prov, withLock:st.withLock});
    const good = await call(st, { key:'k3', amount:40, prov });
    console.log('noDay=' + noDay.ok + ' bad=' + bad.ok + ' good=' + good.ok +
                ' providerCalls=' + prov.calls.length);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"noDay=false"* ]] || { echo "$output"; false; }
  [[ "$output" == *"bad=false"* ]] || { echo "a malformed day was accepted: $output"; false; }
  # THE CONTROL: a real day still settles, and the provider was called EXACTLY once -- the two
  # refusals must not have reached it. An absence assertion on its own would pass on a crash.
  [[ "$output" == *"good=true"* ]] || { echo "$output"; false; }
  [[ "$output" == *"providerCalls=1"* ]] || { echo "the refused calls still reached the provider: $output"; false; }
}

@test "this file registered every test it declares" {
  [ "${#BATS_TEST_NAMES[@]}" -eq 35 ] || {
    echo "registered ${#BATS_TEST_NAMES[@]} tests, expected 35 -- a @test was silently dropped"
    false
  }
}
