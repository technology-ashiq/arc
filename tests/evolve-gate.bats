#!/usr/bin/env bats
# evolve Phase 02 -- the 15 breaks a fresh unanchored agent found in the assignment layer and the
# verdict gate. Every case here PASSED before the fix.
#
# Three root causes account for most of them, and all three are worth naming because they recur:
#
#   IN-BAND SEPARATORS. Three hash preimages joined values with `|`, `,` or `\n`, so a value
#   containing the separator merged two fields. `configHash(floor: 1000)` and
#   `configHash(floor: "1000")` produced the SAME HASH and OPPOSITE VERDICTS.
#
#   A REFUSAL SHARING A CHANNEL WITH AN ANSWER. `ttlExpired` returned `null` when it could not
#   evaluate, and `null` is falsy, so `if (ttlExpired(...)) kill()` read "I don't know" as
#   "not expired". `concurrencyRefusal(undefined)` returned null, meaning "go ahead".
#
#   A GATE THAT THROWS INSTEAD OF REFUSING. An exception carries no outcome and no reasons, and a
#   caller looping inside try/catch skips the experiment rather than recording no-verdict.
bats_require_minimum_version 1.5.0
load 'test_helper'

_node() { cd "$ARC_ROOT" && node --input-type=module -e "$1"; }

AIMPORT='const {armFor,cohortFor,assign,concurrencyRefusal,sealBroken,ttlExpired} = await import("./.claude/scripts/evolve/assign.mjs");'
VIMPORT='const {decide, configHash, metricHash, zFor} = await import("./.claude/scripts/evolve/verdict.mjs");'
BASE="arms:['+champion','+challenger-a'], floor:100, alpha:0.05, effectFloor:0, mde:0, guardrails:[], counts:{'+champion':{units:1900,successes:190},'+challenger-a':{units:1874,successes:225}}"

# ---------- assignment ----------

@test "BREAK 2+12: a fractional, zero or negative split share is refused" {
  # [99.9, 0.1] summed to 100 and gave the second arm ZERO units over 500,000 draws, because the
  # walk is over 100 integer buckets. [0,100] and [-50,150] passed the sum check too.
  run _node "$AIMPORT
    const bad = [];
    for (const s of [[99.9,0.1],[0.5,99.5],[0,100],[100,0],[-50,150],[150,-50],[-1,101],[50.5,49.5]]) {
      try { armFor('e','u',['+a','+b'], s); bad.push(JSON.stringify(s)); } catch {}
    }
    if (bad.length) { console.log('accepted: ' + bad.join(' ')); process.exit(1); }
    console.log('SPLIT VALIDATED');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"SPLIT VALIDATED"* ]]
}

@test "BREAK 5: a unit id cannot imitate the cohort domain and collapse the two draws" {
  # armFor(e, 'u7|cohort') used to produce the SAME preimage as cohortFor(e, 'u7'), so for that
  # unit the arm and the cohort were one draw -- 100% correlated, which is precisely what the
  # separate preimage existed to prevent.
  run _node "$AIMPORT
    let agree = 0, n = 0;
    for (let i = 0; i < 5000; i++) {
      const a = armFor('exp-1', 'u' + i + '|cohort', ['+a','+b'], [50,50]);
      const c = cohortFor('exp-1', 'u' + i);
      n++; if ((a === '+a') === (c === 'generation')) agree++;
    }
    const rate = agree / n;
    console.log('agreement ' + rate.toFixed(4));
    if (rate > 0.55 || rate < 0.45) process.exit(1);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "BREAK 5b: (a|b, c) and (a, b|c) are DIFFERENT assignments" {
  run _node "$AIMPORT
    const x = armFor('a|b','c',['+a','+b'],[50,50]);
    const y = armFor('a','b|c',['+a','+b'],[50,50]);
    const cx = cohortFor('a|b','c'), cy = cohortFor('a','b|c');
    // They MAY coincide by chance on a 50/50 draw, so compare the full assignment across many
    // pairs rather than one.
    let same = 0;
    for (let i = 0; i < 500; i++) {
      const p = armFor('e' + i + '|b','c',['+a','+b'],[50,50]) + cohortFor('e' + i + '|b','c');
      const q = armFor('e' + i,'b|c',['+a','+b'],[50,50]) + cohortFor('e' + i,'b|c');
      if (p === q) same++;
    }
    console.log('collision rate ' + (same/500).toFixed(3));
    if (same / 500 > 0.4) process.exit(1);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "BREAK 11: a non-string unit id, a duplicate arm tag or a non-string arm is refused" {
  # Every object-valued unit id stringified to '[object Object]', so a whole run landed in one
  # arm AND one cohort. Duplicate tags made a two-arm experiment one-arm, silently.
  run _node "$AIMPORT
    const bad = [];
    const t = (label, f) => { try { f(); bad.push(label); } catch {} };
    t('object unit', () => armFor('e', {id:1}, ['+a','+b'], [50,50]));
    t('number unit', () => armFor('e', 1, ['+a','+b'], [50,50]));
    t('null unit',   () => armFor('e', null, ['+a','+b'], [50,50]));
    t('empty unit',  () => armFor('e', '', ['+a','+b'], [50,50]));
    t('dup arms',    () => armFor('e', 'u', ['+a','+a'], [50,50]));
    t('undef arm',   () => armFor('e', 'u', [undefined,'+b'], [50,50]));
    t('null arms',   () => armFor('e', 'u', [null,null], [50,50]));
    t('object exp',  () => armFor({}, 'u', ['+a','+b'], [50,50]));
    if (bad.length) { console.log('accepted: ' + bad.join(', ')); process.exit(1); }
    console.log('INPUTS VALIDATED');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"INPUTS VALIDATED"* ]]
}

@test "BREAK 3+13: ttlExpired THROWS on what it cannot evaluate, and demands an explicit offset" {
  # The refusal used to be `null`, which is falsy and sat in the same channel as a legitimate
  # `false` -- so a bad timestamp meant the experiment never expired. And an offset-less
  # timestamp is parsed as LOCAL, so the same experiment died on one machine and not another.
  run _node "$AIMPORT
    const T0 = '2026-08-01T00:00:00+05:30';
    const now = Date.parse(T0) + 40 * 86400000;
    const bad = [];
    const mustThrow = (label, f) => { try { const v = f(); bad.push(label + ' -> ' + JSON.stringify(v)); } catch {} };
    mustThrow('no offset',     () => ttlExpired('2026-08-01T00:00:00', 28, now));
    mustThrow('not a date',    () => ttlExpired('not-a-date', 28, now));
    mustThrow('epoch ms ts',   () => ttlExpired(1767225600000, 28, now));
    mustThrow('ttl 0',         () => ttlExpired(T0, 0, now));
    mustThrow('ttl -5',        () => ttlExpired(T0, -5, now));
    mustThrow('ttl 0.5',       () => ttlExpired(T0, 0.5, now));
    mustThrow('ttl string',    () => ttlExpired(T0, '28', now));
    mustThrow('now string',    () => ttlExpired(T0, 28, '2026-03-01T00:00:00Z'));
    mustThrow('now undefined', () => ttlExpired(T0, 28, undefined));
    mustThrow('now NaN',       () => ttlExpired(T0, 28, NaN));
    if (bad.length) { console.log('returned instead of throwing:\n' + bad.join('\n')); process.exit(1); }
    // ...and the real boundary still works, to the millisecond.
    const t = Date.parse(T0);
    if (ttlExpired(T0, 28, t + 28 * 86400000 - 1) !== false) { console.log('expired early'); process.exit(1); }
    if (ttlExpired(T0, 28, t + 28 * 86400000) !== true) { console.log('did not expire at the boundary'); process.exit(1); }
    console.log('TTL FAILS CLOSED');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"TTL FAILS CLOSED"* ]]
}

@test "BREAK 8: a missing open-experiment list REFUSES rather than allowing an open" {
  run _node "$AIMPORT
    const bad = [];
    for (const v of [undefined, null, 'exp-1', 'aa', 5, {0:'a',1:'b',length:2}, [null], [undefined,'a']]) {
      let r; try { r = concurrencyRefusal(v, 2); } catch (e) { bad.push(JSON.stringify(v) + ' THREW'); continue; }
      if (r === null) bad.push(JSON.stringify(v) + ' -> allowed');
    }
    if (bad.length) { console.log(bad.join('\n')); process.exit(1); }
    // A real list still behaves.
    if (concurrencyRefusal([], 2) !== null) { console.log('empty list refused'); process.exit(1); }
    if (concurrencyRefusal(['x-1','x-1'], 2) !== null) { console.log('a duplicate inflated the count'); process.exit(1); }
    if (concurrencyRefusal(['x-1','x-2'], 2) === null) { console.log('the cap did not fire'); process.exit(1); }
    console.log('CONCURRENCY FAILS CLOSED');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"CONCURRENCY FAILS CLOSED"* ]]
}

# ---------- the verdict gate ----------

@test "BREAK 1: an UNRESOLVED cohort-violation count refuses, never reads as zero" {
  # The same discipline the guardrails already had, which had not been applied here: a violation
  # counter that FAILED TO COMPUTE returns null, and `null > 0` is false, so it read as clean.
  run _node "$VIMPORT
    const base = {$BASE};
    const bad = [];
    for (const v of [null, NaN, {}, '', 'abc', -1, -0.5, false, []])
      if (decide({...base, cohortViolations: v}).outcome === 'verdict') bad.push(JSON.stringify(v));
    if (bad.length) { console.log('read as zero violations: ' + bad.join(', ')); process.exit(1); }
    if (decide({...base, cohortViolations: 0}).outcome !== 'verdict') { console.log('a genuine zero was refused'); process.exit(1); }
    console.log('COHORT UNRESOLVED OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"COHORT UNRESOLVED OK"* ]]
}

@test "BREAK 4: the gate REFUSES rather than throwing, on every malformed shape" {
  run _node "$VIMPORT
    const base = {arms:['+champion','+challenger-a'], floor:100, alpha:0.05, effectFloor:0, mde:0, guardrails:[]};
    const ok = {'+champion':{units:1900,successes:190},'+challenger-a':{units:1874,successes:225}};
    const shapes = [
      {counts:{...ok, '+champion':{units:'2000',successes:100}}},
      {counts:{...ok, '+champion':{units:2000.5,successes:100}}},
      {counts:{...ok, '+champion':{units:NaN,successes:100}}},
      {counts:{...ok, '+champion':{units:Infinity,successes:100}}},
      {counts:{...ok, '+champion':{units:2000,successes:3000}}},
      {counts:{...ok, '+champion':{units:2000,successes:-1}}},
      {counts:undefined}, {counts:null}, {counts:'x'},
      {counts:ok, guardrails:null}, {counts:ok, guardrails:[null]}, {counts:ok, guardrails:{g:1}},
      {counts:ok, alpha:0.01}, {counts:ok, alpha:'0.05'},
    ];
    const bad = [];
    for (const s of shapes) {
      let r;
      try { r = decide({...base, ...s}); } catch (e) { bad.push('THREW: ' + e.message); continue; }
      if (r.outcome !== 'no-verdict' || !Array.isArray(r.reasons) || r.reasons.length === 0)
        bad.push('not refused: ' + JSON.stringify(s).slice(0, 90));
    }
    for (const v of [undefined, null, 'x', 42]) {
      let r; try { r = decide(v); } catch { bad.push('THREW on ' + JSON.stringify(v)); continue; }
      if (r.outcome !== 'no-verdict') bad.push('not refused: ' + JSON.stringify(v));
    }
    if (bad.length) { console.log(bad.join('\n')); process.exit(1); }
    console.log('GATE NEVER THROWS');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"GATE NEVER THROWS"* ]]
}

@test "BREAK 9: counts are read as OWN properties, so a polluted prototype cannot supply an arm" {
  run _node "$VIMPORT
    Object.prototype['+challenger-a'] = {units:5000, successes:4900};
    const r = decide({arms:['+champion','+challenger-a'], floor:1000, alpha:0.05, effectFloor:0, mde:0, guardrails:[],
      counts:{'+champion':{units:2000,successes:1000}}});
    delete Object.prototype['+challenger-a'];
    if (r.outcome !== 'no-verdict' || !r.reasons.some(x => x.includes('missing'))) { console.log('a polluted prototype supplied an arm: ' + JSON.stringify(r)); process.exit(1); }
    console.log('OWN PROPS OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"OWN PROPS OK"* ]]
}

@test "BREAK 10: counts are read ONCE, so an accessor cannot show one value then another" {
  # The floor check read c.units, then the math read c1.units again. With an accessor property
  # the two reads returned different numbers, and a verdict was declared on an arm of ONE unit
  # against a floor of 1000.
  run _node "$VIMPORT
    let n = 0;
    const champ = { successes: 0, get units() { return ++n === 1 ? 1000000 : 1; } };
    const r = decide({arms:['+champ','+chal'], counts:{'+champ':champ,'+chal':{units:5000,successes:4800}},
      floor:1000, alpha:0.05, effectFloor:0, mde:0, guardrails:[{name:'latency',status:'ok'}]});
    if (r.outcome === 'verdict') { console.log('a verdict on a re-read arm: ' + JSON.stringify(r.stats)); process.exit(1); }
    console.log('SINGLE READ OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"SINGLE READ OK"* ]]
}

@test "BREAK 14: MISSING windows gate the verdict, and guardrails must be PRESENT" {
  run _node "$VIMPORT
    const base = {$BASE};
    const m = decide({...base, missingWindows:999});
    if (m.outcome !== 'no-verdict' || !m.reasons.some(x => x.includes('MISSING'))) { console.log('a verdict over known-incomplete data'); process.exit(1); }
    const {guardrails, ...noGuards} = base;
    if (decide(noGuards).outcome === 'verdict') { console.log('omitted guardrails read as none declared'); process.exit(1); }
    console.log('MISSING+GUARDRAILS OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"MISSING+GUARDRAILS OK"* ]]
}

@test "BREAK 15: an unpinned or non-numeric alpha throws, never resolving off the prototype" {
  run _node "$VIMPORT
    const bad = [];
    for (const a of ['constructor','valueOf','toString','0.05',0.01,null,{}]) {
      try { const z = zFor(a); bad.push(JSON.stringify(a) + ' -> ' + String(z).slice(0, 30)); } catch {}
    }
    if (bad.length) { console.log('resolved: ' + bad.join(' ; ')); process.exit(1); }
    if (zFor(0.05) !== 1.6448536269514722) { console.log('the pinned alpha stopped working'); process.exit(1); }
    console.log('ALPHA LOOKUP OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"ALPHA LOOKUP OK"* ]]
}

# ---------- the hashes ----------

@test "BREAK 6: configHash does not collide across genuinely different configs" {
  # The sharpest pair was floor 1000 vs floor '1000': the SAME hash and OPPOSITE verdicts, which
  # is exactly what a config hash exists to make impossible.
  run _node "$VIMPORT
    const base = {alpha:0.05, effectFloor:0, floor:1800, mde:0, arms:['+champion','+challenger-a'], split:[50,50], guardrails:[]};
    const pairs = [
      [{arms:['+a','+b']}, {arms:['+a,+b']}],
      [{arms:['a','b','c']}, {arms:['a,b,c']}],
      [{split:[50,50]}, {split:['50,50']}],
      [{guardrails:[{name:'a,b'}]}, {guardrails:[{name:'a'},{name:'b'}]}],
      [{floor:1000}, {floor:'1000'}],
      [{guardrails:[{name:'lat',threshold:200}]}, {guardrails:[{name:'lat',threshold:9999}]}],
    ];
    const bad = [];
    for (const [x,y] of pairs) if (configHash({...base,...x}) === configHash({...base,...y})) bad.push(JSON.stringify(x) + ' == ' + JSON.stringify(y));
    if (bad.length) { console.log('COLLISIONS:\n' + bad.join('\n')); process.exit(1); }
    if (configHash(base) !== configHash({...base})) { console.log('the hash is not stable'); process.exit(1); }
    console.log('CONFIG HASH INJECTIVE');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"CONFIG HASH INJECTIVE"* ]]
}

@test "BREAK 7: metricHash does not collide, and BINDS the measured values" {
  run _node "$VIMPORT
    const row = (o) => ({arm:'+a', unit_id:'u1', metric:'m', window_start:'2026-08-01', window_end:'2026-08-07', unit_count:1, successes:0, ...o});
    const bad = [];
    if (metricHash([row({unit_id:'u|m', metric:'x'})]) === metricHash([row({unit_id:'u', metric:'m|x'})])) bad.push('separator collision on unit_id/metric');
    if (metricHash([row({arm:'+a|u1', unit_id:'u2'})]) === metricHash([row({arm:'+a', unit_id:'u1|u2'})])) bad.push('separator collision on arm/unit_id');
    // The first version bound WHICH windows contributed but not WHAT they said, so two runs over
    // identical windows with opposite outcomes hashed the same.
    if (metricHash([row({successes:0})]) === metricHash([row({successes:5})])) bad.push('blind to the measured value');
    if (metricHash([row({})]) !== metricHash([row({})])) bad.push('unstable');
    let threw = false; try { metricHash('abc'); } catch { threw = true; }
    if (!threw) bad.push('a non-array was accepted');
    if (bad.length) { console.log(bad.join('\n')); process.exit(1); }
    console.log('METRIC HASH INJECTIVE');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"METRIC HASH INJECTIVE"* ]]
}
