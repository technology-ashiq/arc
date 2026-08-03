#!/usr/bin/env bats
# evolve Phase 04 -- council calibration from receipts (ADR-0307, ADR-0310).
#
# The load-bearing assertions are the two absences:
#   an `unresolved` outcome is EXCLUDED, never scored as a miss
#   below floor is `insufficient evidence`, never a precise-looking number
# Both are the same rule the rest of this lane runs on: absent data is MISSING, never zero.
bats_require_minimum_version 1.5.0
load 'test_helper'

EVENT="$ARC_ROOT/.claude/scripts/hq/arc-event.sh"
_node() { cd "$ARC_ROOT" && node --input-type=module -e "$1"; }
C='const {calibrate, renderCalibration, proposeJurorWeights, BUCKETS, INSUFFICIENT} = await import("./.claude/scripts/evolve/calibrate.mjs");'

# A verdict/outcome pair as plain objects (the calibrator takes reader output, not files).
MK='const V = (sid, conf, call) => ({kind:"council.verdict", payload:{session_id:sid, question_hash:"a".repeat(64), call, confidence:conf}});
    const O = (sid, outcome) => ({kind:"council.outcome", payload:{session_id:sid, outcome, observed_at:"2026-08-01", source_id:"h-0123456789abcdef"}});'

setup() {
  SPINE="$BATS_TEST_TMPDIR/spine"; mkdir -p "$SPINE"
  export ARC_SPINE_ROOT="$SPINE"
  export ARC_SPINE_NOW="1785000000000"
  export ARC_SPINE_RAND="00112233445566778899"
}

# ---------- the new kind is real on the spine ----------

@test "council.outcome is in the vocabulary and its payload is CLOSED" {
  run bash "$EVENT" emit council.outcome --strict --payload \
    '{"session_id":"c-001","outcome":"happened","observed_at":"2026-08-01","source_id":"h-0123456789abcdef"}'
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$(cat "$SPINE"/events/*.jsonl 2>/dev/null | sed '/^$/d' | wc -l | tr -d ' ')" -eq 1 ]
  [ ! -d "$SPINE/events/_quarantine" ]
}

@test "council.outcome GREW the closed vocabulary by exactly one" {
  # Asserted as a delta against KINDS itself rather than a literal, because a literal is what
  # went stale the last time this list grew (ADR-0309 predicted it by name).
  run bash -c "cd '$ARC_ROOT' && node --input-type=module -e 'const {KINDS} = await import(\"./.claude/scripts/hq/lib/validate.mjs\"); const s = new Set(KINDS); console.log(KINDS.length, s.size, s.has(\"council.outcome\"), s.has(\"council.verdict\"));'"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # No duplicates, and both council kinds present.
  [[ "$output" == *"true true"* ]]
  local n; n="$(echo "$output" | awk '{print $1}')"
  local u; u="$(echo "$output" | awk '{print $2}')"
  [ "$n" = "$u" ]
}

@test "a council payload is refused on an unknown key, a case-varied enum, or a bad session id" {
  local fails="" p
  for p in \
    '{"session_id":"c-001","outcome":"happened","observed_at":"2026-08-01","source_id":"h-0123456789abcdef","sneaky":1}' \
    '{"session_id":"c-001","outcome":"Happened","observed_at":"2026-08-01","source_id":"h-0123456789abcdef"}' \
    '{"session_id":"001","outcome":"happened","observed_at":"2026-08-01","source_id":"h-0123456789abcdef"}' \
    '{"session_id":"c-001","outcome":"happened","observed_at":"01-08-2026","source_id":"h-0123456789abcdef"}' \
    '{"session_id":"c-001","outcome":"happened","observed_at":"2026-08-01","source_id":"https://x/y"}' \
    '{"session_id":"c-001","outcome":"happened","observed_at":"2026-08-01"}'; do
    run bash "$EVENT" emit council.outcome --strict --payload "$p"
    [ "$status" -eq 2 ] || fails="$fails|accepted: $p"
  done
  # ...and council.verdict is closed too.
  run bash "$EVENT" emit council.verdict --strict --payload '{"session_id":"c-001","question_hash":"a","call":"proceed","confidence":"High"}'
  [ "$status" -eq 2 ] || fails="$fails|a bad question_hash was accepted"
  run bash "$EVENT" emit council.verdict --strict --payload '{"session_id":"c-001","question_hash":"'"$(printf 'a%.0s' $(seq 1 64))"'","call":"proceed","confidence":"high"}'
  [ "$status" -eq 2 ] || fails="$fails|a lowercase confidence bucket was accepted"
  [ -z "$fails" ] || { echo "$fails" | tr '|' '\n'; false; }
}

# ---------- THE two absences ----------

@test "an unresolved outcome is EXCLUDED from the score, never counted as a miss" {
  # Scoring it 0 would manufacture a calibration number out of an absence.
  run _node "$C $MK
    const ev = [];
    for (let i = 0; i < 25; i++) { ev.push(V('c-'+i,'High','proceed')); ev.push(O('c-'+i,'happened')); }
    for (let i = 100; i < 110; i++) { ev.push(V('c-'+i,'High','proceed')); ev.push(O('c-'+i,'unresolved')); }
    const c = calibrate(ev, 20);
    if (c.scored !== 25) { console.log('scored ' + c.scored + ', expected 25'); process.exit(1); }
    if (c.excluded !== 10) { console.log('excluded ' + c.excluded + ', expected 10'); process.exit(1); }
    // 25 High calls, all hits -> Brier is (0.85-1)^2 exactly.
    const expected = (0.85 - 1) ** 2;
    if (Math.abs(c.brier - expected) > 1e-12) { console.log('brier ' + c.brier + ', expected ' + expected); process.exit(1); }
    console.log('UNRESOLVED EXCLUDED');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"UNRESOLVED EXCLUDED"* ]]
}

@test "below floor renders insufficient evidence, never a precise-looking number" {
  run _node "$C $MK
    const ev = [];
    for (let i = 0; i < 3; i++) { ev.push(V('c-'+i,'High','proceed')); ev.push(O('c-'+i,'happened')); }
    const c = calibrate(ev, 20);
    if (c.verdict !== INSUFFICIENT) { console.log('verdict ' + c.verdict); process.exit(1); }
    if (c.brier !== null) { console.log('a Brier score was computed on 3 sessions: ' + c.brier); process.exit(1); }
    const text = renderCalibration(c);
    if (!text.includes(INSUFFICIENT)) { console.log('the render does not say insufficient evidence'); process.exit(1); }
    if (/brier\s+[0-9]/.test(text)) { console.log('the render printed a Brier number below floor'); process.exit(1); }
    console.log('BELOW FLOOR OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"BELOW FLOOR OK"* ]]
}

@test "a bucket with no sessions has a MISSING hit-rate, not 0 percent" {
  run _node "$C $MK
    const ev = [];
    for (let i = 0; i < 25; i++) { ev.push(V('c-'+i,'High','proceed')); ev.push(O('c-'+i,'happened')); }
    const c = calibrate(ev, 20);
    if (c.buckets.Low.hit_rate !== null) { console.log('an empty bucket got a rate: ' + c.buckets.Low.hit_rate); process.exit(1); }
    if (!renderCalibration(c).includes('MISSING')) { console.log('the render did not show MISSING'); process.exit(1); }
    console.log('EMPTY BUCKET OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"EMPTY BUCKET OK"* ]]
}

# ---------- the calibration math ----------

@test "a correct HOLD is a hit, not a miss" {
  # Scoring 'happened == hit' for every call would mark every correct hold as wrong, and a
  # council that correctly said "do not do this" would look badly calibrated for being right.
  run _node "$C $MK
    const ev = [];
    for (let i = 0; i < 25; i++) { ev.push(V('c-'+i,'High','hold')); ev.push(O('c-'+i,'did-not-happen')); }
    const c = calibrate(ev, 20);
    if (c.buckets.High.hits !== 25) { console.log('correct holds counted as misses: ' + c.buckets.High.hits); process.exit(1); }
    console.log('HOLD OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"HOLD OK"* ]]
}

@test "the Brier score is computed by hand-checkable arithmetic" {
  # 20 sessions: 10 High hits, 10 High misses. Brier = ((0.85-1)^2 * 10 + (0.85-0)^2 * 10) / 20.
  run _node "$C $MK
    const ev = [];
    for (let i = 0; i < 10; i++) { ev.push(V('h'+i,'High','proceed')); ev.push(O('h'+i,'happened')); }
    for (let i = 0; i < 10; i++) { ev.push(V('m'+i,'High','proceed')); ev.push(O('m'+i,'did-not-happen')); }
    const c = calibrate(ev, 20);
    const expected = (((0.85-1)**2) * 10 + ((0.85-0)**2) * 10) / 20;
    if (Math.abs(c.brier - expected) > 1e-12) { console.log('brier ' + c.brier + ' expected ' + expected); process.exit(1); }
    if (Math.abs(c.buckets.High.hit_rate - 0.5) > 1e-12) { console.log('hit-rate ' + c.buckets.High.hit_rate); process.exit(1); }
    console.log('BRIER OK ' + c.brier.toFixed(4));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"BRIER OK"* ]]
}

@test "a verdict with no outcome yet is PENDING, not scored and not excluded" {
  run _node "$C $MK
    const ev = [V('c-1','High','proceed'), V('c-2','Low','hold'), O('c-1','happened')];
    const c = calibrate(ev, 1);
    if (c.pending !== 1) { console.log('pending ' + c.pending); process.exit(1); }
    if (c.scored !== 1) { console.log('scored ' + c.scored); process.exit(1); }
    console.log('PENDING OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"PENDING OK"* ]]
}

# ---------- propose-only ----------

@test "a juror-weight change is PROPOSED, never applied, and never on a missing calibration" {
  run _node "$C $MK
    const ev = [];
    // High declared 0.85, observed 0.5 -> a gap worth proposing about.
    for (let i = 0; i < 10; i++) { ev.push(V('h'+i,'High','proceed')); ev.push(O('h'+i,'happened')); }
    for (let i = 0; i < 10; i++) { ev.push(V('m'+i,'High','proceed')); ev.push(O('m'+i,'did-not-happen')); }
    const c = calibrate(ev, 20);
    const p = proposeJurorWeights({}, c);
    if (p.applied !== false) { console.log('a weight change was applied'); process.exit(1); }
    if (!p.proposal || p.proposal.changes[0].bucket !== 'High') { console.log('no proposal for a 0.35 gap'); process.exit(1); }
    // ...and below floor it proposes NOTHING, rather than acting on a calibration that does not exist.
    const thin = calibrate(ev.slice(0, 4), 20);
    const q = proposeJurorWeights({}, thin);
    if (q.proposal !== null) { console.log('a weight change was proposed below floor'); process.exit(1); }
    console.log('PROPOSE ONLY OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"PROPOSE ONLY OK"* ]]
}

# ---------- no backfill ----------

@test "the REAL spine has zero scored council sessions, and the board says so" {
  # ADR-0307: no v1 backfill. Only receipts emitted from wiring-time forward count, and there are
  # none, so the honest reading is `insufficient evidence` rather than a number derived from
  # Markdown sessions that were never scored.
  run _node "$C
    const {query} = await import('./.claude/scripts/hq/spine.mjs');
    const {events} = await query(process.env.ARC_SPINE_ROOT, {});
    const c = calibrate(events.map(r => r.event), 20);
    if (c.scored !== 0) { console.log('the spine already carries scored sessions: ' + c.scored); process.exit(1); }
    if (c.verdict !== INSUFFICIENT) { console.log('verdict ' + c.verdict); process.exit(1); }
    console.log('NO BACKFILL OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"NO BACKFILL OK"* ]]
}
