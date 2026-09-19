#!/usr/bin/env bats
# evolve Phase 02 -- the pinned verdict test (ADR-0306) and its expression tree (ADR-0311).
#
# The reference vectors in tests/fixtures/evolve/newcombe-wilson-difference-v1.json were derived
# by TWO agents that saw no implementation (none existed) and did not see each other, and were
# committed BEFORE this code was written. That ordering is the whole point: expected values taken
# from the code under test prove only that the code agrees with itself.
#
# They also AGREED on a mistake: both paired Newcombe's terms for p1 - p2 while the test is on
# d = p2 - p1, and the code followed them, so every bound with unequal arms was too high. Two
# derivations sharing a misreading prove nothing, so since 2026-09-19 the independent values come
# from tests/fixtures/evolve/newcombe-exact.mjs (exact fixed-point arithmetic, anchored on
# Newcombe's published worked example), and a test below holds the method to that example.
#
# The pinned tree and the exact values differ by up to 22 ULP on well-conditioned cases (228 on
# D), writing the same formula in floating point -- so acceptance is two assertions, not one:
#   bit-for-bit against the pinned tree   -> catches a refactor silently changing the math
#   agreeing with the independent one     -> catches the pinned tree being WRONG, not different
#
# The agreement band is ABSOLUTE first (1e-15), because the decision-relevant question is
# whether the bound crosses effect_floor -- not how many ULP it sits from another
# implementation. ULP is a tighter secondary check, relaxed per-case where a near-0 or
# near-1 cancellation makes the measure misleading: case D sits 228 ULP and 9.9e-17 from the
# exact value, which is the same number to sixteen decimal places.
bats_require_minimum_version 1.5.0
load 'test_helper'

_node() { cd "$ARC_ROOT" && node --input-type=module -e "$1"; }

VIMPORT='const {newcombeWilsonDifference, decide, configHash, metricHash, zFor} = await import("./.claude/scripts/evolve/verdict.mjs"); const fs = await import("node:fs"); const V = JSON.parse(fs.readFileSync("tests/fixtures/evolve/newcombe-wilson-difference-v1.json","utf8"));'

@test "every reference vector reproduces BIT-FOR-BIT against the pinned expression tree" {
  run _node "$VIMPORT
    const hex = (x) => Buffer.from(Float64Array.of(x).buffer).toString('hex');
    const bad = [];
    for (const c of V.cases) {
      const r = newcombeWilsonDifference(c.x1, c.n1, c.x2, c.n2, V.alpha);
      if (!Object.is(r.lower, c.lower)) bad.push(c.id + ' lower ' + hex(r.lower) + ' != ' + c.lower_hex64_le);
      if (!Object.is(r.upper, c.upper)) bad.push(c.id + ' upper ' + r.upper + ' != ' + c.upper);
      if (!Object.is(r.d, c.d)) bad.push(c.id + ' d ' + r.d + ' != ' + c.d);
    }
    if (bad.length) { console.log(bad.join('\n')); process.exit(1); }
    console.log('BIT-FOR-BIT ' + V.cases.length + '/' + V.cases.length);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"BIT-FOR-BIT 8/8"* ]]
}

@test "every case agrees with the INDEPENDENT derivation, absolute then ULP" {
  run _node "$VIMPORT
    const ulpDiff = (a, b) => {
      const ba = new BigInt64Array(Float64Array.of(a).buffer)[0];
      const bb = new BigInt64Array(Float64Array.of(b).buffer)[0];
      return Number(ba > bb ? ba - bb : bb - ba);
    };
    const bad = [];
    for (const c of V.cases) {
      const r = newcombeWilsonDifference(c.x1, c.n1, c.x2, c.n2, V.alpha);
      // ABSOLUTE first: it is the decision-relevant measure. What matters is whether the bound
      // crosses effect_floor, not how many ULP it sits from another implementation.
      const abs = Math.abs(r.lower - c.independent_lower);
      if (abs > V.assertions.independent_absolute_tolerance) bad.push(c.id + ' is ' + abs + ' absolute from the independent derivation');
      // ULP second, tighter, and per-case where a cancellation makes the measure misleading.
      const cap = c.max_ulp ?? V.assertions.independent_tolerance_ulp;
      const u = ulpDiff(r.lower, c.independent_lower);
      if (u > cap) bad.push(c.id + ' is ' + u + ' ULP from the independent derivation (cap ' + cap + ')');
      if (c.strict && !Object.is(r.lower, c.independent_lower)) bad.push(c.id + ' is marked strict but is not bit-identical to the independent derivation');
    }
    if (bad.length) { console.log(bad.join('\n')); process.exit(1); }
    console.log('INDEPENDENT OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"INDEPENDENT OK"* ]]
}

@test "the method reproduces Newcombe (1998)'s published worked example, and the old term pairing does not" {
  run _node "$VIMPORT
    const { newcombeWilsonDifferenceAtZ, wilson } = await import('./.claude/scripts/evolve/verdict.mjs');
    // Newcombe 1998, Statistics in Medicine 17:873-890, Table II (a): 56/70 vs 48/80 at the two-sided 95% z,
    // theta = p1 - p2 = 0.2, interval 0.0524 to 0.3339. Here d = p2 - p1, so the groups go in swapped.
    const z = 1.959963984540054;
    const r = newcombeWilsonDifferenceAtZ(48, 80, 56, 70, z);
    const bad = [];
    if (r.lower.toFixed(4) !== '0.0524' || r.upper.toFixed(4) !== '0.3339') bad.push('published example: got ' + r.lower + ' .. ' + r.upper);
    // MUTANT CONTROL: the pairing the first version shipped. It must MISS the published value, or this
    // check could not have caught it.
    const a1 = wilson(48, 80, z), a2 = wilson(56, 70, z);
    const oldLower = (a2.p - a1.p) - Math.sqrt((a1.p - a1.l) ** 2 + (a2.u - a2.p) ** 2);
    if (oldLower.toFixed(4) === '0.0524') bad.push('the mutant pairing reproduces the example too - the check cannot tell them apart');
    // The case the attack found: 2/20 vs 6/20 at the pinned alpha. The old pairing called a verdict here.
    const x = newcombeWilsonDifference(2, 20, 6, 20, 0.05);
    if (!(x.lower < 0)) bad.push('2/20 vs 6/20 has a positive bound ' + x.lower);
    // The exact derivation refuses to load unless it reproduces the same published example.
    const E = await import('./tests/fixtures/evolve/newcombe-exact.mjs');
    for (const c of V.cases) {
      const e = E.newcombeExact(c.x1, c.n1, c.x2, c.n2, V.z);
      if (!Object.is(e.lower, c.independent_lower)) bad.push(c.id + ' independent_lower is not what the exact derivation gives');
      if (!Object.is(e.upper, c.independent_upper)) bad.push(c.id + ' independent_upper is not what the exact derivation gives');
      const pinned = newcombeWilsonDifference(c.x1, c.n1, c.x2, c.n2, V.alpha);
      if (Math.abs(pinned.upper - e.upper) > V.assertions.independent_absolute_tolerance) bad.push(c.id + ' upper is off the exact value');
    }
    if (bad.length) { console.log(bad.join('\n')); process.exit(1); }
    console.log('PUBLISHED OK ' + V.cases.length);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"PUBLISHED OK 8"* ]]
}

@test "Wilson bounds stay inside 0..1 after clamping, and the difference stays in -1..1 with no clamp at all" {
  run _node "$VIMPORT
    const bad = [];
    for (const c of V.cases) {
      const r = newcombeWilsonDifference(c.x1, c.n1, c.x2, c.n2, V.alpha);
      for (const [t,l,u] of [['1',r.l1,r.u1],['2',r.l2,r.u2]])
        if (!(l >= 0 && l <= 1 && u >= 0 && u <= 1)) bad.push(c.id + ' arm' + t + ' bound outside [0,1]');
      if (!(r.lower <= r.d && r.d <= r.upper)) bad.push(c.id + ' containment lower<=d<=upper failed');
    }
    // The method keeps the difference in -1..1 by itself (U <= u2 - l1, L >= l2 - u1). The first
    // term pairing did not: its upper reached 2.03 on case G, and that was mistaken for a property
    // of the method rather than the sign of a wrong formula.
    for (const c of V.cases) {
      const r = newcombeWilsonDifference(c.x1, c.n1, c.x2, c.n2, V.alpha);
      if (!(r.lower >= -1 && r.upper <= 1)) bad.push(c.id + ' difference outside -1..1: ' + r.lower + ' .. ' + r.upper);
    }
    for (const [x1, n1, x2, n2] of [[0,1,1,1],[1,1,0,1],[0,5,5,5],[5,5,0,5]]) {
      const r = newcombeWilsonDifference(x1, n1, x2, n2, 0.05);
      if (!(r.lower >= -1 && r.upper <= 1)) bad.push('extreme ' + [x1,n1,x2,n2].join('/') + ' outside -1..1');
    }
    if (bad.length) { console.log(bad.join('\n')); process.exit(1); }
    console.log('INVARIANTS OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"INVARIANTS OK"* ]]
}

@test "an unpinned alpha is refused rather than silently approximated" {
  run _node "$VIMPORT
    let refused = 0;
    for (const a of [0.01, 0.1, 0.5, 0, 1, null]) { try { zFor(a); } catch { refused++; } }
    if (refused !== 6) { console.log('an unpinned alpha was accepted'); process.exit(1); }
    console.log('ALPHA PINNED');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"ALPHA PINNED"* ]]
}

# ---------- the gate ----------

@test "a verdict is refused when EITHER arm is below floor, and the arm is named" {
  run _node "$VIMPORT
    const r = decide({arms:['+champion','+challenger-a'], floor:1800, alpha:0.05, effectFloor:0, mde:0, guardrails:[],
      counts:{'+champion':{units:1900,successes:190},'+challenger-a':{units:1000,successes:120}}});
    if (r.outcome !== 'no-verdict') { console.log('a below-floor arm produced a verdict'); process.exit(1); }
    if (!r.reasons.some(x => x.includes('+challenger-a') && x.includes('below floor'))) { console.log('arm not named: ' + r.reasons.join(' / ')); process.exit(1); }
    console.log('FLOOR OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"FLOOR OK"* ]]
}

@test "an UNRESOLVED guardrail refuses the verdict, never scored as no-breach-found" {
  run _node "$VIMPORT
    const base = {arms:['+champion','+challenger-a'], floor:100, alpha:0.05, effectFloor:0, mde:0,
      counts:{'+champion':{units:1900,successes:190},'+challenger-a':{units:1874,successes:225}}};
    const ok = decide({...base, guardrails:[{name:'tickets', status:'ok'}]});
    if (ok.outcome !== 'verdict') { console.log('clean case gave no verdict: ' + ok.reasons.join(' / ')); process.exit(1); }
    const un = decide({...base, guardrails:[{name:'tickets', status:'unresolved'}]});
    if (un.outcome !== 'no-verdict' || !un.reasons.some(x => x.includes('unresolved'))) { console.log('unresolved guardrail did not refuse'); process.exit(1); }
    const br = decide({...base, guardrails:[{name:'tickets', status:'breached'}]});
    if (br.outcome !== 'no-verdict') { console.log('breached guardrail did not refuse'); process.exit(1); }
    console.log('GUARDRAIL OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"GUARDRAIL OK"* ]]
}

@test "a second verdict compute is refused: fixed-horizon, compute once" {
  run _node "$VIMPORT
    const r = decide({arms:['+champion','+challenger-a'], floor:100, alpha:0.05, effectFloor:0, mde:0,
      counts:{'+champion':{units:1900,successes:190},'+challenger-a':{units:1874,successes:225}}, guardrails:[], computedBefore:true});
    if (r.outcome !== 'no-verdict' || !r.reasons.some(x => x.includes('compute once'))) { console.log('a re-compute was allowed'); process.exit(1); }
    console.log('COMPUTE-ONCE OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"COMPUTE-ONCE OK"* ]]
}

@test "a cohort violation refuses the verdict" {
  run _node "$VIMPORT
    const r = decide({arms:['+champion','+challenger-a'], floor:100, alpha:0.05, effectFloor:0, mde:0,
      counts:{'+champion':{units:1900,successes:190},'+challenger-a':{units:1874,successes:225}}, guardrails:[], cohortViolations:1});
    if (r.outcome !== 'no-verdict') { console.log('a cohort violation was ignored'); process.exit(1); }
    console.log('COHORT OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"COHORT OK"* ]]
}

@test "a bound below effect_floor, or a delta below MDE, refuses the verdict" {
  run _node "$VIMPORT
    // Case H from the vectors: a tiny effect at large n, LOWER is negative.
    const r = decide({arms:['+champion','+challenger-a'], floor:100, alpha:0.05, effectFloor:0, mde:0, guardrails:[],
      counts:{'+champion':{units:2000,successes:100},'+challenger-a':{units:2000,successes:101}}});
    if (r.outcome !== 'no-verdict' || !r.reasons.some(x => x.includes('effect_floor'))) { console.log('a negative bound produced a verdict'); process.exit(1); }
    const m = decide({arms:['+champion','+challenger-a'], floor:100, alpha:0.05, effectFloor:0, mde:0.5, guardrails:[],
      counts:{'+champion':{units:1900,successes:190},'+challenger-a':{units:1874,successes:225}}});
    if (m.outcome !== 'no-verdict' || !m.reasons.some(x => x.includes('MDE'))) { console.log('a sub-MDE delta produced a verdict'); process.exit(1); }
    console.log('THRESHOLDS OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"THRESHOLDS OK"* ]]
}

# ---------- the hashes a replay re-derives from ----------

@test "the config hash changes when ANY hashed input changes, and is stable otherwise" {
  run _node "$VIMPORT
    const base = {alpha:0.05, effectFloor:0, floor:1800, mde:0, arms:['+champion','+challenger-a'], split:[50,50], guardrails:[{name:'tickets'}], metric:'signup_conversion', direction:'higher-is-better'};
    const h = configHash(base);
    if (h !== configHash({...base})) { console.log('the hash is not stable'); process.exit(1); }
    const variants = [{effectFloor:0.01},{floor:1801},{mde:0.001},{arms:['+challenger-a','+champion']},{split:[60,40]},{guardrails:[{name:'other'}]},{metric:'other_metric'},{direction:'lower-is-better'}];
    for (const v of variants) if (configHash({...base, ...v}) === h) { console.log('the hash did not change for ' + JSON.stringify(v)); process.exit(1); }
    console.log('CONFIG HASH OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"CONFIG HASH OK"* ]]
}

@test "the metric hash is order-independent but content-sensitive" {
  run _node "$VIMPORT
    const rows = [
      {arm:'+champion', unit_id:'u1', metric:'m', window_start:'2026-08-01', window_end:'2026-08-07', unit_count:1},
      {arm:'+challenger-a', unit_id:'u2', metric:'m', window_start:'2026-08-01', window_end:'2026-08-07', unit_count:1}];
    if (metricHash(rows) !== metricHash([...rows].reverse())) { console.log('the metric hash depends on row order'); process.exit(1); }
    if (metricHash(rows) === metricHash([{...rows[0], unit_count:2}, rows[1]])) { console.log('the metric hash is blind to a changed count'); process.exit(1); }
    console.log('METRIC HASH OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"METRIC HASH OK"* ]]
}
