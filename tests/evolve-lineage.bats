#!/usr/bin/env bats
# evolve Phase 03 -- the four-hop SHA chain and the propose-only boundary.
#
# EVERY HOP HAS A NEGATIVE CONTROL. A chain whose links have only ever been observed succeeding
# has not been shown to be a chain.
#
# The BREAK tests below are the 13 a fresh unanchored agent found in the first version. The
# sharpest was #11: the test that was supposed to guarantee "the machine never writes a canonical
# file" was a grep, and it missed `from "fs"`, `fs/promises`, `child_process` and the async
# exec/spawn -- so a mutant that overwrote the canonical file, deleted the archived champion,
# committed and spawned a deploy passed it clean. A guard that can be walked past is not a guard,
# and this one guarded the lane's single most important rule.
bats_require_minimum_version 1.5.0
load 'test_helper'

_node() { cd "$ARC_ROOT" && node --input-type=module -e "$1"; }

L='const {mayPropose, buildProposal, verifyProposalId, proposalIdFor, mayRecordPromotion, mayWatch, onPostPromotionDrift, onDegradation, evidenceTable, EVIDENCE_FIELDS} = await import("./.claude/scripts/evolve/lineage.mjs");'
BASE="'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'"
CAND="'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'"
PATCHS="'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'"
OTHER="'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'"
# A verified hop-1 ticket, which buildProposal now requires.
TICKET="{experiment_id:'x-1', base_sha:$BASE, target_path:'app/home/hero.tsx'}"

# ---------- THE non-negotiable ----------

@test "BREAK 11: lineage.mjs imports NOTHING that could write, spawn or exec" {
  # PARSED, not grepped. The previous grep missed `from "fs"`, `fs/promises`, `child_process` and
  # async exec/spawn. This asserts the module's entire static import specifier set, so any new
  # import at all -- however spelled -- fails until someone justifies it here.
  cd "$ARC_ROOT"
  run node --input-type=module -e '
    const src = (await import("node:fs")).readFileSync(".claude/scripts/evolve/lineage.mjs", "utf8");
    const specs = [...src.matchAll(/^\s*(?:import|export)[^;]*?from\s*["\x27]([^"\x27]+)["\x27]/gm)].map(m => m[1]);
    const dyn = [...src.matchAll(/\bimport\s*\(\s*["\x27]([^"\x27]+)["\x27]/g)].map(m => m[1]);
    const req = [...src.matchAll(/\brequire\s*\(\s*["\x27]([^"\x27]+)["\x27]/g)].map(m => m[1]);
    const all = [...new Set([...specs, ...dyn, ...req])].sort();
    const ALLOWED = ["./canon.mjs"];
    if (JSON.stringify(all) !== JSON.stringify(ALLOWED)) {
      console.log("import set is " + JSON.stringify(all) + ", allowed " + JSON.stringify(ALLOWED));
      process.exit(1);
    }
    console.log("IMPORTS SEALED");'
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"IMPORTS SEALED"* ]]
}

@test "BREAK 11b: the import-set check would CATCH a module that writes canonical files" {
  # The negative control for the guard itself. The old grep returned exit 1 (pass) on exactly
  # this source; the parser must reject it.
  cat > "$BATS_TEST_TMPDIR/mutant.mjs" <<'MUT'
import { rmSync, cpSync, renameSync } from "fs";
import { exec, spawn } from "child_process";
import { open } from "fs/promises";
export function promote(target, champion) {
  cpSync(champion, target); renameSync(target + ".tmp", target); rmSync(champion);
  exec("git commit -am promoted"); spawn("bash", ["-c", "deploy.sh"]);
}
MUT
  cd "$ARC_ROOT"
  run node --input-type=module -e '
    const src = (await import("node:fs")).readFileSync(process.argv[1], "utf8");
    const specs = [...src.matchAll(/^\s*(?:import|export)[^;]*?from\s*["\x27]([^"\x27]+)["\x27]/gm)].map(m => m[1]);
    const all = [...new Set(specs)].sort();
    if (JSON.stringify(all) === JSON.stringify(["./canon.mjs"])) { console.log("THE GUARD MISSED IT"); process.exit(1); }
    console.log("MUTANT CAUGHT: " + JSON.stringify(all));' "$BATS_TEST_TMPDIR/mutant.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"MUTANT CAUGHT"* ]]
}

# ---------- hop 1 -> 2 ----------

@test "HOP 1-2: an intact seal on an allowlisted target returns a TICKET" {
  run _node "$L
    const r = mayPropose({experiment:$TICKET, currentSha:$BASE, promoteVia:['app/home/hero.tsx']});
    if (!r.ok) { console.log('a clean proposal was refused: ' + r.reason); process.exit(1); }
    if (!r.ticket || r.ticket.base_sha !== $BASE || r.ticket.target_path !== 'app/home/hero.tsx') { console.log('no ticket echoed'); process.exit(1); }
    console.log('PROPOSE OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"PROPOSE OK"* ]]
}

@test "HOP 1-2 NEGATIVE: a moved seal makes a proposal IMPOSSIBLE" {
  run _node "$L
    const r = mayPropose({experiment:$TICKET, currentSha:$OTHER, promoteVia:['app/home/hero.tsx']});
    if (r.ok) { console.log('a proposal was generated against a moved seal'); process.exit(1); }
    if (!r.reason.includes('canonical-drift')) { console.log('wrong reason: ' + r.reason); process.exit(1); }
    console.log('SEAL NEGATIVE OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"SEAL NEGATIVE OK"* ]]
}

@test "BREAK 3: a lying allowlist cannot admit an off-list target" {
  # `includes` is a PROTOTYPE METHOD. A Proxy, an Array subclass and a polluted
  # Array.prototype.includes all made it return true for `secrets/prod.env`.
  run _node "$L
    const target = 'secrets/prod.env';
    const exp = {experiment_id:'x-1', base_sha:$BASE, target_path:target};
    const bad = [];
    const proxy = new Proxy(['app/home/hero.tsx'], {get(t,k){ return k === 'includes' ? () => true : Reflect.get(t,k); }});
    if (mayPropose({experiment:exp, currentSha:$BASE, promoteVia:proxy}).ok) bad.push('proxy allowlist');
    class Lying extends Array { includes() { return true; } }
    const sub = Lying.from(['app/home/hero.tsx']);
    if (mayPropose({experiment:exp, currentSha:$BASE, promoteVia:sub}).ok) bad.push('array subclass');
    const orig = Array.prototype.includes;
    Array.prototype.includes = () => true;
    const polluted = mayPropose({experiment:exp, currentSha:$BASE, promoteVia:['app/home/hero.tsx']}).ok;
    Array.prototype.includes = orig;
    if (polluted) bad.push('polluted Array.prototype.includes');
    if (bad.length) { console.log('admitted via: ' + bad.join(', ')); process.exit(1); }
    console.log('ALLOWLIST SEALED');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"ALLOWLIST SEALED"* ]]
}

@test "BREAK 2: an accessor cannot show one SHA to the validator and another to the comparator" {
  # The composite attack walked hops 1, 3 and 4 with every premise false.
  run _node "$L
    let n = 0;
    const exp = {experiment_id:'x-1', target_path:'app/home/hero.tsx', get base_sha() { return ++n === 1 ? $BASE : $OTHER; }};
    const r = mayPropose({experiment:exp, currentSha:$BASE, promoteVia:['app/home/hero.tsx']});
    // Whatever it decided, it must have decided from ONE read.
    if (n !== 1) { console.log('base_sha was read ' + n + ' times'); process.exit(1); }
    console.log('READ ONCE OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"READ ONCE OK"* ]]
}

@test "BREAK 8: buildProposal REQUIRES a hop-1 ticket, so a refused seal cannot be bypassed" {
  run _node "$L
    const drifted = mayPropose({experiment:$TICKET, currentSha:$OTHER, promoteVia:['app/home/hero.tsx']});
    if (drifted.ok) { console.log('the drift was not caught'); process.exit(1); }
    // The old code let buildProposal be called anyway, because nothing consulted hop 1.
    const r = buildProposal({ticket: drifted.ticket, candidateSha:$CAND, patchSha:$PATCHS});
    if (r.ok) { console.log('a proposal was minted after hop 1 refused'); process.exit(1); }
    console.log('TICKET REQUIRED');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"TICKET REQUIRED"* ]]
}

@test "BREAK 7: two different reverts get DIFFERENT ids, and a post-mint edit breaks the id" {
  run _node "$L
    const t = {experiment_id:'x-1', base_sha:$CAND, target_path:'app/home/hero.tsx'};
    const r1 = buildProposal({ticket:t, candidateSha:$BASE, patchSha:$PATCHS, kind:'revert', appliesTo:$CAND, restores:$BASE});
    const r2 = buildProposal({ticket:t, candidateSha:$OTHER, patchSha:$PATCHS, kind:'revert', appliesTo:$OTHER, restores:$PATCHS});
    if (!r1.ok || !r2.ok) { console.log('a revert failed to build'); process.exit(1); }
    if (r1.proposal.proposal_id === r2.proposal.proposal_id) { console.log('two different reverts share an id'); process.exit(1); }
    // A field added after minting must break the binding.
    const tampered = {...r1.proposal, applies_to:$OTHER};
    if (verifyProposalId(tampered).ok) { console.log('a tampered proposal still verified'); process.exit(1); }
    if (!verifyProposalId(r1.proposal).ok) { console.log('an untampered proposal failed to verify'); process.exit(1); }
    console.log('ID BINDS PAYLOAD');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"ID BINDS PAYLOAD"* ]]
}

@test "TWO experiments sealed against the SAME base_sha on one target: the second REFUSES" {
  run _node "$L
    const av = ['app/home/hero.tsx'];
    const t1 = mayPropose({experiment:{experiment_id:'x-1', base_sha:$BASE, target_path:'app/home/hero.tsx'}, currentSha:$BASE, promoteVia:av});
    const t2 = mayPropose({experiment:{experiment_id:'x-2', base_sha:$BASE, target_path:'app/home/hero.tsx'}, currentSha:$BASE, promoteVia:av});
    if (!t1.ok || !t2.ok) { console.log('a proposal was refused while the seal held'); process.exit(1); }
    const p1 = buildProposal({ticket:t1.ticket, candidateSha:$CAND, patchSha:$PATCHS});
    if (!mayRecordPromotion({proposal:p1.proposal, observedSha:$CAND}).ok) { console.log('x1 promotion refused'); process.exit(1); }
    // x2 now tries to promote its own candidate. The file holds x1's candidate.
    const p2 = buildProposal({ticket:t2.ticket, candidateSha:$OTHER, patchSha:$PATCHS});
    const r = mayRecordPromotion({proposal:p2.proposal, observedSha:$CAND});
    if (r.ok) { console.log('the second landed against bytes the first already changed'); process.exit(1); }
    // ...and x2 can no longer even propose, because its seal has moved.
    if (mayPropose({experiment:{experiment_id:'x-2', base_sha:$BASE, target_path:'app/home/hero.tsx'}, currentSha:$CAND, promoteVia:av}).ok) { console.log('x2 could still propose'); process.exit(1); }
    console.log('CONCURRENT SEAL OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"CONCURRENT SEAL OK"* ]]
}

@test "a proposal whose candidate equals its base is refused: it changes nothing" {
  run _node "$L
    const r = buildProposal({ticket:$TICKET, candidateSha:$BASE, patchSha:$PATCHS});
    if (r.ok) { console.log('a no-op proposal was built'); process.exit(1); }
    console.log('NOOP OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"NOOP OK"* ]]
}

# ---------- hop 3 ----------

@test "HOP 3: a promotion is allowed only when the merged bytes match the proposal" {
  run _node "$L
    const p = buildProposal({ticket:$TICKET, candidateSha:$CAND, patchSha:$PATCHS}).proposal;
    if (!mayRecordPromotion({proposal:p, observedSha:$CAND}).ok) { console.log('an exact match was refused'); process.exit(1); }
    const r = mayRecordPromotion({proposal:p, observedSha:$OTHER});
    if (r.ok) { console.log('a mismatched merge was recorded'); process.exit(1); }
    if (!r.reason.includes($CAND.slice(0,12)) || !r.reason.includes($OTHER.slice(0,12))) { console.log('the refusal does not name both digests'); process.exit(1); }
    console.log('HOP3 OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"HOP3 OK"* ]]
}

@test "BREAK 4: a hand-built or prototype-polluted proposal is not a proposal" {
  run _node "$L
    const bad = [];
    if (mayRecordPromotion({proposal:{candidate_sha:$CAND}, observedSha:$CAND}).ok) bad.push('hand-built object');
    Object.prototype.candidate_sha = $CAND;
    Object.prototype.proposal_id = 'p-whatever';
    if (mayRecordPromotion({proposal:{}, observedSha:$CAND}).ok) bad.push('prototype pollution');
    if (mayWatch({proposal:{}, servedSha:$CAND, targetPath:'x', requiresDeploy:false}).ok) bad.push('prototype pollution (watch)');
    delete Object.prototype.candidate_sha; delete Object.prototype.proposal_id;
    if (mayRecordPromotion({proposal:[$CAND], observedSha:$CAND}).ok) bad.push('array as proposal');
    if (bad.length) { console.log('accepted: ' + bad.join(', ')); process.exit(1); }
    console.log('PROPOSAL IDENTITY OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"PROPOSAL IDENTITY OK"* ]]
}

# ---------- hop 4 ----------

@test "HOP 4: the watch runs only while the SERVED bytes still match the promotion" {
  run _node "$L
    const p = buildProposal({ticket:$TICKET, candidateSha:$CAND, patchSha:$PATCHS}).proposal;
    if (!mayWatch({proposal:p, servedSha:$CAND, targetPath:'app/home/hero.tsx', requiresDeploy:false}).ok) { console.log('a healthy watch was refused'); process.exit(1); }
    const r = mayWatch({proposal:p, servedSha:$OTHER, targetPath:'app/home/hero.tsx', requiresDeploy:false});
    if (r.ok) { console.log('the watch ran over drifted bytes'); process.exit(1); }
    if (!r.reason.includes('post-promotion drift')) { console.log('wrong reason: ' + r.reason); process.exit(1); }
    console.log('HOP4 OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"HOP4 OK"* ]]
}

@test "BREAK 5: deploy-gating is REQUIRED, so omitting it cannot open the gate" {
  # It used to default to false, and lineage.mjs has no production caller yet -- so the
  # fail-open default is exactly what the first caller would have silently inherited.
  run _node "$L
    const p = buildProposal({ticket:$TICKET, candidateSha:$CAND, patchSha:$PATCHS}).proposal;
    const bad = [];
    for (const v of [undefined, null, 0, '', 'false', 1, {}]) {
      const r = mayWatch({proposal:p, servedSha:$CAND, targetPath:'app/home/hero.tsx', requiresDeploy:v});
      if (r.ok) bad.push(JSON.stringify(v) + ' opened the gate');
    }
    if (bad.length) { console.log(bad.join('\n')); process.exit(1); }
    console.log('DEPLOY FLAG REQUIRED');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"DEPLOY FLAG REQUIRED"* ]]
}

@test "BREAK 8b: a deploy receipt must name THIS proposal and THIS target, not just a digest" {
  # Two targets holding identical bytes is not hypothetical for stubs and empty files, so a
  # digest match alone let a receipt for another file authorise this watch.
  run _node "$L
    const p = buildProposal({ticket:$TICKET, candidateSha:$CAND, patchSha:$PATCHS}).proposal;
    const base = {proposal:p, servedSha:$CAND, targetPath:'app/home/hero.tsx', requiresDeploy:true};
    if (mayWatch({...base, deployReceipt:null}).ok) { console.log('no receipt opened the watch'); process.exit(1); }
    if (mayWatch({...base, deployReceipt:{served_sha:$CAND}}).ok) { console.log('a receipt with only a digest opened the watch'); process.exit(1); }
    if (mayWatch({...base, deployReceipt:{served_sha:$CAND, proposal_id:'p-other', target_path:'app/home/hero.tsx'}}).ok) { console.log('another proposal\'s receipt opened the watch'); process.exit(1); }
    if (mayWatch({...base, deployReceipt:{served_sha:$CAND, proposal_id:p.proposal_id, target_path:'docs/README.md'}}).ok) { console.log('another target\'s receipt opened the watch'); process.exit(1); }
    const good = mayWatch({...base, deployReceipt:{served_sha:$CAND, proposal_id:p.proposal_id, target_path:'app/home/hero.tsx'}});
    if (!good.ok) { console.log('a fully matching receipt was refused: ' + good.reason); process.exit(1); }
    console.log('DEPLOY RECEIPT BOUND');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"DEPLOY RECEIPT BOUND"* ]]
}

# ---------- drift and degradation ----------

@test "post-promotion drift raises, freezes, and generates NO machine revert" {
  run _node "$L
    const p = buildProposal({ticket:$TICKET, candidateSha:$CAND, patchSha:$PATCHS}).proposal;
    const r = onPostPromotionDrift({proposal:p, observedSha:$OTHER, championBaseSha:$BASE});
    if (r.machine_generated_revert !== false) { console.log('a machine revert was generated'); process.exit(1); }
    if (r.surface !== 'FROZEN' || r.action !== 'manual intervention required') { console.log('not frozen'); process.exit(1); }
    if (r.incident.expected_sha !== $CAND || r.incident.observed_sha !== $OTHER || r.incident.archived_champion !== $BASE) { console.log('the incident is missing a digest'); process.exit(1); }
    console.log('DRIFT OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"DRIFT OK"* ]]
}

@test "BREAK 6: onDegradation FREEZES rather than throwing, on every degenerate input" {
  # The module header names 'no throwing instead of refusing' as a class it checks for -- and the
  # first version threw on four ordinary states, so a CONFIRMED degradation produced an exception
  # instead of a frozen surface and a caller looping inside try/catch skipped the incident.
  run _node "$L
    const p = buildProposal({ticket:$TICKET, candidateSha:$CAND, patchSha:$PATCHS}).proposal;
    const cases = [
      {proposal:null, championBaseSha:$BASE, ownObservationMeetsFloor:true, revertPatchSha:$PATCHS},
      {proposal:p, championBaseSha:$CAND, ownObservationMeetsFloor:true, revertPatchSha:$PATCHS},
      {proposal:p, championBaseSha:'nope', ownObservationMeetsFloor:true, revertPatchSha:$PATCHS},
      {proposal:p, championBaseSha:undefined, ownObservationMeetsFloor:true, revertPatchSha:$PATCHS},
      {proposal:p, championBaseSha:$BASE, ownObservationMeetsFloor:true, revertPatchSha:null},
      {proposal:undefined, championBaseSha:undefined, ownObservationMeetsFloor:true},
    ];
    const bad = [];
    for (const c of cases) {
      let r; try { r = onDegradation(c); } catch (e) { bad.push('THREW: ' + e.message); continue; }
      if (r.surface !== 'FROZEN') bad.push('not frozen: ' + JSON.stringify(r).slice(0,80));
      if (r.merged_by_machine !== false) bad.push('merged_by_machine was not false');
    }
    if (bad.length) { console.log(bad.join('\n')); process.exit(1); }
    console.log('DEGRADATION NEVER THROWS');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"DEGRADATION NEVER THROWS"* ]]
}

@test "BREAK 10: only the literal true confirms a degradation" {
  # It was a truthiness test, so the string 'false' -- or 'unknown', or 'below floor' -- coerced
  # to CONFIRMED and minted a revert against a measurement the engine said it could not see.
  run _node "$L
    const p = buildProposal({ticket:$TICKET, candidateSha:$CAND, patchSha:$PATCHS}).proposal;
    const bad = [];
    for (const v of ['false', 'unknown', 'n/a', 'below floor', 1, {}, []]) {
      const r = onDegradation({proposal:p, championBaseSha:$BASE, ownObservationMeetsFloor:v, revertPatchSha:$OTHER});
      if (r.revert_proposal !== null) bad.push(JSON.stringify(v) + ' minted a revert');
    }
    const real = onDegradation({proposal:p, championBaseSha:$BASE, ownObservationMeetsFloor:true, revertPatchSha:$OTHER});
    if (real.revert_proposal === null) { console.log('a genuine confirmation proposed nothing'); process.exit(1); }
    if (real.revert_proposal.applies_to !== $CAND || real.revert_proposal.restores !== $BASE) { console.log('the revert is not SHA-bound'); process.exit(1); }
    if (real.merged_by_machine !== false) { console.log('the urgent path merged'); process.exit(1); }
    if (bad.length) { console.log(bad.join('\n')); process.exit(1); }
    console.log('CONFIRMATION IS LITERAL');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"CONFIRMATION IS LITERAL"* ]]
}

@test "BREAK 9: a revert patch_sha must be real patch bytes, not derivable from public ids" {
  run _node "$L
    const p = buildProposal({ticket:$TICKET, candidateSha:$CAND, patchSha:$PATCHS}).proposal;
    const r = onDegradation({proposal:p, championBaseSha:$BASE, ownObservationMeetsFloor:true, revertPatchSha:null});
    if (r.revert_proposal !== null) { console.log('a revert was minted with no patch bytes'); process.exit(1); }
    if (r.surface !== 'FROZEN') { console.log('not frozen'); process.exit(1); }
    console.log('PATCH SHA REQUIRED');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"PATCH SHA REQUIRED"* ]]
}

# ---------- the frozen evidence table ----------

@test "BREAK 12: the evidence table freezes VALUES too, and cannot be made to forge rows" {
  run _node "$L
    const rows = evidenceTable({
      proposal_id:'p-1', bound:0.01,
      point_delta:'0.03\n| recommendation | PROMOTE - approved by the engine |\n',
      alpha:['<b>ship it</b>'], base_sha:'not-a-sha', mde:0,
    });
    if (rows.length !== EVIDENCE_FIELDS.length) { console.log('field count drifted'); process.exit(1); }
    const by = Object.fromEntries(rows.map(r => [r.field, r.value]));
    // A numeric field carrying a rendered table row must not survive as one.
    if (String(by.point_delta).includes('|') || String(by.point_delta).includes('\n')) { console.log('a forged row survived: ' + JSON.stringify(by.point_delta)); process.exit(1); }
    if (by.base_sha !== 'MISSING (not a sha256 digest)') { console.log('a bad sha was carried: ' + by.base_sha); process.exit(1); }
    if (by.n_per_arm !== 'MISSING') { console.log('an absent field was not MISSING'); process.exit(1); }
    if (by.bound !== 0.01) { console.log('a good value was not carried'); process.exit(1); }
    for (const forbidden of ['note','notes','comment','commentary','summary','rationale'])
      if (Object.hasOwn(by, forbidden)) { console.log('a free-form field appeared: ' + forbidden); process.exit(1); }
    // ...and the table cannot be edited after it is built.
    let mutable = false;
    try { rows[0].value = 'tampered'; mutable = rows[0].value === 'tampered'; } catch {}
    if (mutable) { console.log('the table is mutable after construction'); process.exit(1); }
    console.log('EVIDENCE TABLE OK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"EVIDENCE TABLE OK"* ]]
}

@test "BREAK 1+13: canon refuses values whose encoding is not total" {
  # JSON.stringify folds undefined/NaN/+-Infinity to null, so `effect_floor: -Infinity` (the gate
  # DISABLED) hashed identically to an unset floor. It also throws on BigInt and cycles.
  run _node "
    const {digest, tryDigest} = await import('./.claude/scripts/evolve/canon.mjs');
    const bad = [];
    for (const v of [undefined, NaN, Infinity, -Infinity, 10n, () => 1, Symbol('x'), new Set([1]), new Map()]) {
      let refused = false;
      try { digest('d', [v]); } catch { refused = true; }
      if (!refused) bad.push(String(v) + ' was encoded');
    }
    // ...and distinct values stay distinct.
    if (digest('d',[0]) === digest('d',[-0])) bad.push('0 and -0 collide');
    if (digest('d',[1]) === digest('d',['1'])) bad.push('1 and \"1\" collide');
    if (digest('d',[null]) === digest('d',[[null]])) bad.push('null and [null] collide');
    // tryDigest returns a refusal instead of throwing.
    const t = tryDigest('d', [NaN]);
    if (t.hash !== null || !t.reason) bad.push('tryDigest did not refuse');
    if (bad.length) { console.log(bad.join('\n')); process.exit(1); }
    console.log('CANON TOTAL');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"CANON TOTAL"* ]]
}

@test "a human-rejected proposal leaves the champion intact: nothing here mutates" {
  run _node "$L
    const exp = Object.freeze({experiment_id:'x-1', base_sha:$BASE, target_path:'app/home/hero.tsx'});
    const before = JSON.stringify(exp);
    const t = mayPropose({experiment:exp, currentSha:$BASE, promoteVia:Object.freeze(['app/home/hero.tsx'])});
    const p = buildProposal({ticket:t.ticket, candidateSha:$CAND, patchSha:$PATCHS}).proposal;
    mayRecordPromotion({proposal:p, observedSha:$OTHER});
    mayWatch({proposal:p, servedSha:$OTHER, targetPath:'app/home/hero.tsx', requiresDeploy:false});
    onPostPromotionDrift({proposal:p, observedSha:$OTHER, championBaseSha:$BASE});
    if (JSON.stringify(exp) !== before) { console.log('the experiment was mutated'); process.exit(1); }
    console.log('CHAMPION INTACT');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"CHAMPION INTACT"* ]]
}
