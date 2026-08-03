#!/usr/bin/env bats
# evolve Phase 03 -- the four-hop SHA chain and the propose-only boundary.
#
# EVERY HOP HAS A NEGATIVE CONTROL. A chain whose links have only ever been observed succeeding
# has not been shown to be a chain, and this lane has now twice shipped a gate that could not
# fail. Each `mayX` test asserts both that it passes when it should AND that it refuses when it
# should, with the refusal naming the two digests.
bats_require_minimum_version 1.5.0
load 'test_helper'

_node() { cd "$ARC_ROOT" && node --input-type=module -e "$1"; }

L='const {mayPropose, buildProposal, mayRecordPromotion, mayWatch, onPostPromotionDrift, onDegradation, evidenceTable, EVIDENCE_FIELDS} = await import("./.claude/scripts/evolve/lineage.mjs");'
BASE="'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'"
CAND="'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'"
PATCHS="'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'"
OTHER="'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'"

# ---------- THE non-negotiable ----------

@test "the lineage module CANNOT write a canonical file - no filesystem import exists" {
  # A propose-only rule that depends on nobody adding an fs call later is not a rule. This greps
  # the source, so the constraint survives a future edit by someone who never read ADR-0305.
  cd "$ARC_ROOT"
  run grep -nE "node:fs|require\(.fs.\)|writeFile|appendFile|createWriteStream|execSync|spawnSync" .claude/scripts/evolve/lineage.mjs
  [ "$status" -ne 0 ] || { echo "lineage.mjs can touch the filesystem:"; echo "$output"; false; }
}

# ---------- hop 1 -> 2 ----------

@test "HOP 1-2: a proposal is generated against an intact seal, on an allowlisted target" {
  run _node "$L
    const x = {experiment_id:'x-1', target_path:'app/home/hero.tsx', base_sha:$BASE};
    const r = mayPropose({experiment:x, currentSha:$BASE, promoteVia:['app/home/hero.tsx']});
    if (!r.ok) { console.log('a clean proposal was refused: ' + r.reason); process.exit(1); }
    console.log('PROPOSE OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"PROPOSE OK"* ]]
}

@test "HOP 1-2 NEGATIVE: a moved seal makes a proposal IMPOSSIBLE" {
  run _node "$L
    const x = {experiment_id:'x-1', target_path:'app/home/hero.tsx', base_sha:$BASE};
    const r = mayPropose({experiment:x, currentSha:$OTHER, promoteVia:['app/home/hero.tsx']});
    if (r.ok) { console.log('a proposal was generated against a moved seal'); process.exit(1); }
    if (!r.reason.includes('canonical-drift')) { console.log('wrong reason: ' + r.reason); process.exit(1); }
    console.log('SEAL NEGATIVE OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"SEAL NEGATIVE OK"* ]]
}

@test "HOP 1-2 NEGATIVE: an arbitrary target off the allowlist is refused" {
  run _node "$L
    const bad = [];
    const mk = (tp, av) => mayPropose({experiment:{experiment_id:'x-1', target_path:tp, base_sha:$BASE}, currentSha:$BASE, promoteVia:av});
    if (mk('app/other.tsx', ['app/home/hero.tsx']).ok) bad.push('off-allowlist target accepted');
    // A non-array allowlist must REFUSE, not be treated as permitting everything.
    for (const av of [undefined, null, 'app/home/hero.tsx', {includes:()=>true}])
      if (mk('app/home/hero.tsx', av).ok) bad.push('non-array allowlist accepted: ' + JSON.stringify(av));
    if (bad.length) { console.log(bad.join('\n')); process.exit(1); }
    console.log('ALLOWLIST OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"ALLOWLIST OK"* ]]
}

@test "TWO experiments sealed against the SAME base_sha on the same target: the second REFUSES" {
  # REQ-03's concurrency cap is not scoped to distinct files. Whichever proposal reaches hop 3
  # second, after the first has merged, must refuse on candidate_sha rather than landing against
  # bytes the first already changed.
  run _node "$L
    const x1 = {experiment_id:'x-1', target_path:'app/home/hero.tsx', base_sha:$BASE};
    const x2 = {experiment_id:'x-2', target_path:'app/home/hero.tsx', base_sha:$BASE};
    // Both may propose while the seal holds.
    if (!mayPropose({experiment:x1, currentSha:$BASE, promoteVia:['app/home/hero.tsx']}).ok) { console.log('x1 refused'); process.exit(1); }
    if (!mayPropose({experiment:x2, currentSha:$BASE, promoteVia:['app/home/hero.tsx']}).ok) { console.log('x2 refused'); process.exit(1); }
    const p1 = buildProposal({experiment:x1, candidateSha:$CAND, patchSha:$PATCHS});
    // x1 merges. The file is now CAND.
    if (!mayRecordPromotion({proposal:p1, observedSha:$CAND}).ok) { console.log('x1 promotion refused'); process.exit(1); }
    // x2 now tries to promote its own candidate. The observed file is x1's candidate, not x2's.
    const p2 = buildProposal({experiment:x2, candidateSha:$OTHER, patchSha:$PATCHS});
    const r = mayRecordPromotion({proposal:p2, observedSha:$CAND});
    if (r.ok) { console.log('the second proposal landed against bytes the first already changed'); process.exit(1); }
    if (!r.reason.includes('do not match')) { console.log('wrong reason: ' + r.reason); process.exit(1); }
    // ...and x2 can no longer even PROPOSE again, because its seal has moved.
    if (mayPropose({experiment:x2, currentSha:$CAND, promoteVia:['app/home/hero.tsx']}).ok) { console.log('x2 could still propose after the file moved'); process.exit(1); }
    console.log('CONCURRENT SEAL OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"CONCURRENT SEAL OK"* ]]
}

@test "a proposal whose candidate equals its base is refused: it changes nothing" {
  run _node "$L
    let threw = false;
    try { buildProposal({experiment:{experiment_id:'x-1', base_sha:$BASE}, candidateSha:$BASE, patchSha:$PATCHS}); }
    catch { threw = true; }
    if (!threw) { console.log('a no-op proposal was built'); process.exit(1); }
    console.log('NOOP OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"NOOP OK"* ]]
}

# ---------- hop 3 ----------

@test "HOP 3: a promotion receipt is allowed only when the merged bytes match the proposal" {
  run _node "$L
    const p = buildProposal({experiment:{experiment_id:'x-1', base_sha:$BASE}, candidateSha:$CAND, patchSha:$PATCHS});
    if (!mayRecordPromotion({proposal:p, observedSha:$CAND}).ok) { console.log('an exact match was refused'); process.exit(1); }
    const r = mayRecordPromotion({proposal:p, observedSha:$OTHER});
    if (r.ok) { console.log('a mismatched merge was recorded as a promotion'); process.exit(1); }
    if (!r.reason.includes($CAND.slice(0,12)) || !r.reason.includes($OTHER.slice(0,12))) { console.log('the refusal does not name both digests: ' + r.reason); process.exit(1); }
    console.log('HOP3 OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"HOP3 OK"* ]]
}

# ---------- hop 4 ----------

@test "HOP 4: the watch runs only while the SERVED bytes still match the promotion" {
  run _node "$L
    const p = buildProposal({experiment:{experiment_id:'x-1', base_sha:$BASE}, candidateSha:$CAND, patchSha:$PATCHS});
    if (!mayWatch({proposal:p, servedSha:$CAND}).ok) { console.log('a healthy watch was refused'); process.exit(1); }
    const r = mayWatch({proposal:p, servedSha:$OTHER});
    if (r.ok) { console.log('the watch ran over drifted bytes'); process.exit(1); }
    if (!r.reason.includes('post-promotion drift')) { console.log('wrong reason: ' + r.reason); process.exit(1); }
    console.log('HOP4 OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"HOP4 OK"* ]]
}

@test "HOP 4 NEGATIVE: a deploy-gated target does NOT start the watch on a working-tree match" {
  # Otherwise the watch passes while watching bytes nobody is running - a green light derived
  # from a file that never reached a user.
  run _node "$L
    const p = buildProposal({experiment:{experiment_id:'x-1', base_sha:$BASE}, candidateSha:$CAND, patchSha:$PATCHS});
    const noReceipt = mayWatch({proposal:p, servedSha:$CAND, requiresDeploy:true, deployReceipt:null});
    if (noReceipt.ok) { console.log('the watch started with no deploy receipt'); process.exit(1); }
    const stale = mayWatch({proposal:p, servedSha:$CAND, requiresDeploy:true, deployReceipt:{served_sha:$OTHER}});
    if (stale.ok) { console.log('the watch started against a disagreeing deploy receipt'); process.exit(1); }
    const good = mayWatch({proposal:p, servedSha:$CAND, requiresDeploy:true, deployReceipt:{served_sha:$CAND}});
    if (!good.ok) { console.log('a confirmed deploy was refused: ' + good.reason); process.exit(1); }
    console.log('DEPLOY GATE OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"DEPLOY GATE OK"* ]]
}

# ---------- drift and degradation: propose-only in BOTH directions ----------

@test "post-promotion drift raises, freezes, and generates NO machine revert" {
  run _node "$L
    const p = buildProposal({experiment:{experiment_id:'x-1', base_sha:$BASE}, candidateSha:$CAND, patchSha:$PATCHS});
    const r = onPostPromotionDrift({proposal:p, observedSha:$OTHER, championBaseSha:$BASE});
    if (r.machine_generated_revert !== false) { console.log('a machine revert was generated on unexplained drift'); process.exit(1); }
    if (r.surface !== 'FROZEN') { console.log('the surface was not frozen'); process.exit(1); }
    if (r.action !== 'manual intervention required') { console.log('wrong action: ' + r.action); process.exit(1); }
    if (r.incident.expected_sha !== $CAND || r.incident.observed_sha !== $OTHER) { console.log('the incident does not carry both digests'); process.exit(1); }
    if (r.incident.archived_champion !== $BASE) { console.log('the archived champion reference is missing'); process.exit(1); }
    console.log('DRIFT OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"DRIFT OK"* ]]
}

@test "a confirmed degradation proposes a SHA-bound revert and still never merges" {
  run _node "$L
    const p = buildProposal({experiment:{experiment_id:'x-1', base_sha:$BASE}, candidateSha:$CAND, patchSha:$PATCHS});
    const r = onDegradation({proposal:p, championBaseSha:$BASE, ownObservationMeetsFloor:true});
    if (r.merged_by_machine !== false) { console.log('the urgent path merged'); process.exit(1); }
    if (r.class_demoted_to !== 'L1') { console.log('the class was not demoted'); process.exit(1); }
    const rp = r.revert_proposal;
    if (rp.kind !== 'revert') { console.log('not a revert proposal'); process.exit(1); }
    if (rp.applies_to !== $CAND) { console.log('applies_to is not the promoted candidate'); process.exit(1); }
    if (rp.restores !== $BASE) { console.log('restores is not the champion base'); process.exit(1); }
    console.log('DEGRADATION OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"DEGRADATION OK"* ]]
}

@test "a degradation BELOW this engine's own floor freezes and proposes NOTHING" {
  # Freezing on an unmeasured suspicion is honest; proposing a revert on it would not be.
  run _node "$L
    const p = buildProposal({experiment:{experiment_id:'x-1', base_sha:$BASE}, candidateSha:$CAND, patchSha:$PATCHS});
    const r = onDegradation({proposal:p, championBaseSha:$BASE, ownObservationMeetsFloor:false});
    if (r.revert_proposal !== null) { console.log('a revert was proposed below the observation floor'); process.exit(1); }
    if (r.surface !== 'FROZEN') { console.log('the surface was not frozen'); process.exit(1); }
    console.log('BELOW FLOOR OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"BELOW FLOOR OK"* ]]
}

# ---------- the frozen evidence table ----------

@test "the evidence table is field-frozen, carries no commentary field, and renders MISSING" {
  run _node "$L
    const rows = evidenceTable({proposal_id:'p-1', bound:0.01});
    const names = rows.map(r => r.field);
    if (names.length !== EVIDENCE_FIELDS.length) { console.log('field count drifted'); process.exit(1); }
    for (const forbidden of ['note','notes','comment','commentary','summary','rationale'])
      if (names.includes(forbidden)) { console.log('a free-form field appeared: ' + forbidden); process.exit(1); }
    // An absent field is rendered MISSING, never omitted - an omitted row reads as nothing to report.
    const bound = rows.find(r => r.field === 'bound');
    const nper = rows.find(r => r.field === 'n_per_arm');
    if (bound.value !== 0.01) { console.log('a present value was not carried'); process.exit(1); }
    if (nper.value !== 'MISSING') { console.log('an absent field was not MISSING: ' + JSON.stringify(nper)); process.exit(1); }
    // The frozen list must include every SHA in the chain.
    for (const f of ['base_sha','patch_sha','candidate_sha','config_hash'])
      if (!names.includes(f)) { console.log('the table does not carry ' + f); process.exit(1); }
    console.log('EVIDENCE TABLE OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"EVIDENCE TABLE OK"* ]]
}

@test "a human-rejected proposal leaves the champion intact: nothing here mutates" {
  run _node "$L
    const x = {experiment_id:'x-1', target_path:'app/home/hero.tsx', base_sha:$BASE};
    const before = JSON.stringify(x);
    const p = buildProposal({experiment:x, candidateSha:$CAND, patchSha:$PATCHS});
    mayRecordPromotion({proposal:p, observedSha:$OTHER});
    mayWatch({proposal:p, servedSha:$OTHER});
    onPostPromotionDrift({proposal:p, observedSha:$OTHER, championBaseSha:$BASE});
    if (JSON.stringify(x) !== before) { console.log('the experiment was mutated'); process.exit(1); }
    console.log('CHAMPION INTACT');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"CHAMPION INTACT"* ]]
}
