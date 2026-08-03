#!/usr/bin/env bats
# evolve Phase 02 -- deterministic assignment, the canonical seal, TTL, concurrency.
#
# Every assertion here is DETERMINISTIC despite looking statistical: the hash is a pure function,
# so "10000 units split 4800-5200" is the same number on every run and every OS. A band is used
# rather than an exact count because pinning the exact count would mean deriving it from the
# implementation under test, which proves only that the code agrees with itself.
bats_require_minimum_version 1.5.0
load 'test_helper'

# _node <script> -- run an ES module snippet from the repo root so relative imports resolve
_node() { cd "$ARC_ROOT" && node --input-type=module -e "$1"; }

IMPORT='const {armFor,cohortFor,assign,concurrencyRefusal,sealBroken,ttlExpired,COHORTS} = await import("./.claude/scripts/evolve/assign.mjs");'
ARMS='["+champion","+challenger-a"]'
SPLIT='[50,50]'

# ---------- determinism ----------

@test "the same unit always lands in the same arm and the same cohort" {
  run _node "$IMPORT
    const a = [], c = [];
    for (let r = 0; r < 5; r++) {
      a.push(armFor('x-1','unit-42',$ARMS,$SPLIT));
      c.push(cohortFor('x-1','unit-42'));
    }
    if (new Set(a).size !== 1 || new Set(c).size !== 1) { console.log('NONDETERMINISTIC', a, c); process.exit(1); }
    console.log('STABLE', a[0], c[0]);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"STABLE"* ]]
}

@test "a different experiment id moves the same unit (the preimage carries both)" {
  # If the arm depended on unit alone, every experiment would place a unit identically and the
  # arms would be correlated across experiments forever.
  run _node "$IMPORT
    let moved = 0;
    for (let i = 0; i < 200; i++)
      if (armFor('x-1','u'+i,$ARMS,$SPLIT) !== armFor('x-2','u'+i,$ARMS,$SPLIT)) moved++;
    console.log('moved', moved);
    if (moved < 60 || moved > 140) process.exit(1);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

# ---------- the split is honoured ----------

@test "a 50/50 split lands within 4800-5200 of 10000 units" {
  run _node "$IMPORT
    let champ = 0;
    for (let i = 0; i < 10000; i++) if (armFor('x-split','u'+i,$ARMS,$SPLIT) === '+champion') champ++;
    console.log('champion', champ);
    if (champ < 4800 || champ > 5200) process.exit(1);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "a 90/10 split honours the declared proportions, not an even one" {
  run _node "$IMPORT
    let champ = 0;
    for (let i = 0; i < 10000; i++) if (armFor('x-90','u'+i,$ARMS,[90,10]) === '+champion') champ++;
    console.log('champion', champ);
    if (champ < 8800 || champ > 9200) process.exit(1);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

# ---------- THE independence test ----------

@test "arm and cohort are INDEPENDENT, not two reads of one draw" {
  # Deriving both from a single hash correlates them: every unit in the low buckets would land
  # in one arm AND one cohort together, so the verdict cohort would systematically
  # over-represent whichever arm the split puts first. A correlated derivation produces a 2x2
  # contingency of roughly [5000, 0, 0, 5000]; an independent one gives four ~2500 cells.
  run _node "$IMPORT
    const cell = {};
    for (let i = 0; i < 10000; i++) {
      const a = assign('x-ind','u'+i,$ARMS,$SPLIT);
      const k = a.arm + '/' + a.cohort;
      cell[k] = (cell[k] || 0) + 1;
    }
    console.log(JSON.stringify(cell));
    const vals = Object.values(cell);
    if (vals.length !== 4) { console.log('expected 4 cells'); process.exit(1); }
    for (const v of vals) if (v < 2300 || v > 2700) { console.log('cell out of band: ' + v); process.exit(1); }"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "the cohort split is 50:50 per ADR-0310" {
  run _node "$IMPORT
    let gen = 0;
    for (let i = 0; i < 10000; i++) if (cohortFor('x-c','u'+i) === 'generation') gen++;
    console.log('generation', gen);
    if (gen < 4800 || gen > 5200) process.exit(1);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

# ---------- refusals ----------

@test "a split that does not sum to 100, or fewer than two arms, is refused" {
  run _node "$IMPORT
    const bad = [];
    const t = (f) => { try { f(); bad.push('accepted'); } catch (e) { /* expected */ } };
    t(() => armFor('x','u',$ARMS,[50,40]));
    t(() => armFor('x','u',$ARMS,[50]));
    t(() => armFor('x','u',['+only'],[100]));
    t(() => cohortFor('x','u',0));
    t(() => cohortFor('x','u',100));
    if (bad.length) { console.log('ACCEPTED BAD INPUT', bad.length); process.exit(1); }
    console.log('ALL REFUSED');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"ALL REFUSED"* ]]
}

# ---------- the canonical seal ----------

@test "a moved seal is canonical-drift, and an intact seal passes" {
  run _node "$IMPORT
    const a = 'a'.repeat(64), b = 'b'.repeat(64);
    if (sealBroken(a, a) !== null) { console.log('intact seal reported broken'); process.exit(1); }
    const msg = sealBroken(a, b);
    if (!msg || !msg.includes('canonical-drift')) { console.log('drift not detected: ' + msg); process.exit(1); }
    // A malformed digest must be refused rather than compared as a string.
    if (!sealBroken('nope', a) || !sealBroken(a, 'nope')) { console.log('malformed digest accepted'); process.exit(1); }
    console.log('SEAL OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"SEAL OK"* ]]
}

# ---------- TTL ----------

@test "TTL expires at the boundary and not before" {
  run _node "$IMPORT
    const opened = '2026-08-01T00:00:00+05:30';
    const t = Date.parse(opened), DAY = 86400000;
    if (ttlExpired(opened, 28, t + 27 * DAY) !== false) { console.log('expired early'); process.exit(1); }
    if (ttlExpired(opened, 28, t + 28 * DAY) !== true)  { console.log('did not expire at the boundary'); process.exit(1); }
    console.log('TTL OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"TTL OK"* ]]
}

# ---------- concurrency ----------

@test "the concurrency cap counts OPEN experiments, and duplicates do not inflate it" {
  run _node "$IMPORT
    if (concurrencyRefusal([], 2) !== null) { console.log('empty refused'); process.exit(1); }
    if (concurrencyRefusal(['x-1'], 2) !== null) { console.log('one refused'); process.exit(1); }
    // The same id twice is ONE open experiment -- a counter someone increments would say two.
    if (concurrencyRefusal(['x-1','x-1'], 2) !== null) { console.log('duplicate inflated the count'); process.exit(1); }
    const r = concurrencyRefusal(['x-1','x-2'], 2);
    if (!r || !r.includes('cap is 2')) { console.log('cap not enforced: ' + r); process.exit(1); }
    console.log('CAP OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"CAP OK"* ]]
}
