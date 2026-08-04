#!/usr/bin/env bats
# leads Phase 01 -- the SEND ORDERING, asserted directly.
#
# sequencer.mjs:7 calls its ordering "the safety property, and it is not rearrangeable". A
# mutation analysis then showed five ordering mutants passing both existing suites, because
# no test ever called sendOne or runDaily:
#
#   M1  delete acquireLock + release from runDaily
#   M2  move writeIntent to AFTER the provider submit   (reopens the whole ADR-0411 window)
#   M3  move resolveIntent to BEFORE emitReceipt        (a crash loses receipt AND intent)
#   M4  make release() a no-op
#   M5  drop the unresolved-intent halt
#
# A property described in a comment and asserted nowhere is a property the next edit removes.
# Each test below fails on its mutant.
bats_require_minimum_version 1.5.0
load 'test_helper'

_o() { cd "$ARC_ROOT" && ARC_LEADS_FAKE=1 node --input-type=module -e "$1"; }

# The whole send path with an INSTRUMENTED provider and emitter, so the test observes the
# order operations actually happen in rather than the order the source reads in.
ORD='const {sendOne, runDaily} = await import("./.claude/scripts/leads/lib/sequencer.mjs");
const {unresolvedIntents, writeIntent, journalDir} = await import("./.claude/scripts/leads/lib/journal.mjs");
const {initStore, openStore, leadId} = await import("./.claude/scripts/leads/lib/store.mjs");
const {initCampaign, writeDraft} = await import("./.claude/scripts/leads/lib/drafts.mjs");
const fs = await import("node:fs"), os = await import("node:os"), path = await import("node:path");

const NOW = "2026-08-04T10:00:00+05:30";
const CFG = (() => { const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cfg")), "leads.json");
  fs.writeFileSync(p, JSON.stringify({sending_domain:"outreach.example.net", product_domains:["lexos.app"]})); return p; })();

function freshStore() {
  process.env.ARC_LEADS_STORE = fs.mkdtempSync(path.join(os.tmpdir(), "ord"));
  initStore();
  const s = openStore();
  initCampaign(s, "pilot", {createdAt: NOW});
  return s;
}
function draftFor(s) {
  const id = leadId(s, "adv@firm.example.com");
  return writeDraft(s, {campaign:"pilot", lead_id:id, touch_n:1, body:"Hi there, this is the body.", cites:[], lintStatus:"PASS"});
}
function approvalEvents(rec) {
  return [{id:"01APPROVAL", kind:"approval.requested", payload:{gate:"leads-send", draft_ref:rec.draft_ref, draft_sha:rec.draft_sha}},
          {id:"01DECISION", kind:"decision.recorded", payload:{decides:"01APPROVAL", verdict:"approve", reason:"ok"}}];
}
const trace = [];
const countIntents = (s) => fs.readdirSync(journalDir(s)).filter((f) => f.endsWith(".json")).length;'

# M2: the intent must be on disk BEFORE the provider is asked. If it is written after, a crash
# between ack and receipt leaves no trace and the next run sends the same mail again.
@test "the journal intent exists on disk before the provider is asked" {
  run _o "$ORD
    const s = freshStore(); const rec = draftFor(s);
    let intentsAtSubmit = -1;
    const {provider} = await import('./.claude/scripts/leads/lib/deps.mjs');
    const real = provider().submit.bind(provider());
    provider().submit = async (a) => { intentsAtSubmit = countIntents(s); return real(a); };
    await sendOne({store:s, events:approvalEvents(rec), draftRef:rec.draft_ref, now:NOW, config:CFG, emitReceipt: async () => {}});
    console.log('intents visible at submit time: ' + intentsAtSubmit);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"intents visible at submit time: 1"* ]]
}

# M3: the receipt must be emitted BEFORE the intent is resolved. Resolving first means a crash
# in between loses the receipt AND the intent -- the send happened and nothing records it.
@test "the receipt is emitted before the intent is resolved" {
  run _o "$ORD
    const s = freshStore(); const rec = draftFor(s);
    let intentsAtEmit = -1;
    await sendOne({store:s, events:approvalEvents(rec), draftRef:rec.draft_ref, now:NOW, config:CFG,
      emitReceipt: async () => { intentsAtEmit = countIntents(s); }});
    console.log('intents still present at emit: ' + intentsAtEmit + ' after: ' + countIntents(s));"
  [[ "$output" == *"intents still present at emit: 1 after: 0"* ]]
}

# And the inverse, which is the property that actually matters: if the emit fails, the intent
# must SURVIVE so the next reconcile can resolve it against the provider.
@test "a failed emit leaves the intent unresolved" {
  run _o "$ORD
    const s = freshStore(); const rec = draftFor(s);
    try {
      await sendOne({store:s, events:approvalEvents(rec), draftRef:rec.draft_ref, now:NOW, config:CFG,
        emitReceipt: async () => { throw new Error('spine refused'); }});
    } catch (e) { /* the throw is fine; the on-disk state is what is under test */ }
    console.log('intents after a failed emit: ' + countIntents(s));"
  [[ "$output" == *"intents after a failed emit: 1"* ]]
}

# M1/M4: runDaily must hold the lock for the whole window. Asserted by observing that the lock
# file EXISTS while the provider is being called, and is gone afterwards.
@test "runDaily holds the send lock across the provider call and releases it after" {
  run _o "$ORD
    const s = freshStore(); const rec = draftFor(s);
    const lockPath = path.join(s.dir, '.send.lock');
    let lockedAtSubmit = null;
    const {provider} = await import('./.claude/scripts/leads/lib/deps.mjs');
    const real = provider().submit.bind(provider());
    provider().submit = async (a) => { lockedAtSubmit = fs.existsSync(lockPath); return real(a); };
    await runDaily({store:s, readEvents: () => approvalEvents(rec), drafts:[rec.draft_ref], now:NOW, config:CFG, emitReceipt: async () => {}});
    console.log('locked during submit: ' + lockedAtSubmit + ' | lock after: ' + fs.existsSync(lockPath));"
  [[ "$output" == *"locked during submit: true | lock after: false"* ]]
}

# M5: an unresolved intent must halt the run before ANY draft is attempted.
@test "runDaily halts before any send when an intent is unresolved" {
  run _o "$ORD
    const s = freshStore(); const rec = draftFor(s);
    writeIntent(s, {idempotency_key:'stale', lead_hmac:rec.lead_id, campaign:'pilot', touch_n:9, draft_sha:rec.draft_sha, submitted_at:NOW, store_fingerprint:'deadbeef'});
    let submits = 0;
    const {provider} = await import('./.claude/scripts/leads/lib/deps.mjs');
    provider().submit = async () => { submits++; return {ok:true, provider_message_id:'x'}; };
    provider().lookupByMessageId = async () => null;   // indeterminate: the intent must survive
    const out = await runDaily({store:s, readEvents: () => approvalEvents(rec), drafts:[rec.draft_ref], now:NOW, config:CFG, emitReceipt: async () => {}});
    console.log('halted: ' + (out.halted ? 'yes' : 'no') + ' | results: ' + out.results.length + ' | submits: ' + submits);"
  [[ "$output" == *"halted: yes | results: 0 | submits: 0"* ]]
}

# The lock must survive a crash rather than be auto-broken, AND there must be a way out. Both
# halves: an alive holder is never cleared, a dead one is.
@test "a stale lock is cleared only when its holder is dead" {
  run _o "$ORD
    const {acquireLock, clearStaleLock} = await import('./.claude/scripts/leads/lib/guard.mjs');
    const s = freshStore();
    const rel = acquireLock(s);
    const whileAlive = clearStaleLock(s).cleared;
    rel();
    fs.writeFileSync(path.join(s.dir, '.send.lock'), 'pid=999999 started=old');
    const whileDead = clearStaleLock(s).cleared;
    console.log('alive: ' + whileAlive + ' | dead: ' + whileDead);"
  [[ "$output" == *"alive: false | dead: true"* ]]
}

# release() verifies ownership: a stale closure must not destroy a lock someone else now holds.
@test "a stale release does not destroy another holders lock" {
  run _o "$ORD
    const {acquireLock} = await import('./.claude/scripts/leads/lib/guard.mjs');
    const s = freshStore();
    const rel = acquireLock(s);
    fs.writeFileSync(path.join(s.dir, '.send.lock'), 'pid=1 started=someone-else');
    rel();
    console.log('other lock survived: ' + fs.existsSync(path.join(s.dir, '.send.lock')));"
  [[ "$output" == *"other lock survived: true"* ]]
}

# A torn journal file must not wedge the recovery that is supposed to heal it. Reconcile calls
# unresolvedIntents as its FIRST statement, so a throw there made recovery impossible while
# the guard refused every send forever.
@test "a torn intent file blocks sends but does not wedge reconcile" {
  run _o "$ORD
    const {reconcile} = await import('./.claude/scripts/leads/lib/journal.mjs');
    const s = freshStore();
    writeIntent(s, {idempotency_key:'healthy', lead_hmac:'lead_hmac_v1_' + 'a'.repeat(32), campaign:'pilot', touch_n:1, draft_sha:'c'.repeat(64), submitted_at:NOW, store_fingerprint:'deadbeef'});
    fs.writeFileSync(path.join(journalDir(s), 'torn.json'), '{\"idem');
    const blocked = unresolvedIntents(s).length;
    const out = await reconcile(s, {events: [], lookup: async () => ({found:false}), emitReceipt: async () => {}});
    console.log('blocking: ' + blocked + ' | healed: ' + out.voided + ' | corrupt reported: ' + out.corrupt);"
  [[ "$output" == *"blocking: 2 | healed: 1 | corrupt reported: 1"* ]]
}

@test "this file registers the 9 tests it declares" {
  declared=$(grep -c '^@test ' "$BATS_TEST_FILENAME")
  registered=${#BATS_TEST_NAMES[@]}
  [ "$declared" -eq 9 ] || { echo "declared $declared, expected 9"; false; }
  [ "$registered" -eq "$declared" ] || { echo "bats registered $registered of $declared -- one was DROPPED"; false; }
}
