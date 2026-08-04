#!/usr/bin/env bats
# leads Phase 01 -- ADVERSARIAL REGRESSION.
#
# Every test here exists because something walked past the suite that came before it. A fresh
# agent with no sight of the implementation found 18 holes in the Phase-01 modules and, worse,
# showed that 7 of 12 MUTANT guards passed tests/leads-sequencer.bats -- including one that
# deletes the entire unresolved-intent breaker.
#
# The structural reason those mutants survived: that file imported only guard.mjs and caps.mjs.
# sequencer.mjs and journal.mjs had ZERO coverage, so every mutant in them passed. This file
# covers them.
bats_require_minimum_version 1.5.0
load 'test_helper'

_g() { cd "$ARC_ROOT" && ARC_LEADS_FAKE=1 node --input-type=module -e "$1"; }

PRELUDE='const {guardSend, GuardRefusal, deriveState, breakerState, incidentIdFor} = await import("./.claude/scripts/leads/lib/guard.mjs");
const {loadCaps} = await import("./.claude/scripts/leads/lib/caps.mjs");
const {approvedShaFor} = await import("./.claude/scripts/leads/lib/sequencer.mjs");
const {reconcile, writeIntent} = await import("./.claude/scripts/leads/lib/journal.mjs");
const fsx = await import("node:fs"), osx = await import("node:os"), pathx = await import("node:path");
const ID = "lead_hmac_v1_" + "a".repeat(32);
const OTHER = "lead_hmac_v1_" + "b".repeat(32);
const SHA = "c".repeat(64);
const NOW = "2026-08-04T10:00:00+05:30";
const mkstore = () => ({dir: fsx.mkdtempSync(pathx.join(osx.tmpdir(), "j"))});
const store = mkstore();
const base = {campaign:"pilot", lead_id:ID, touch_n:1, draft_sha:SHA, approved_sha:SHA};
const sent = (n, at, lead=ID) => ({kind:"outreach.sent", payload:{lead_id:lead, campaign:"pilot", touch_n:n, submitted_at:at, idem_key:"k", provider_message_id:"m", draft_sha:SHA}});
const bounce = (camp="pilot") => ({kind:"outreach.replied", payload:{lead_id:OTHER, campaign:camp, triage_class:"bounce", ingested_at:NOW}});
const intent = (s) => writeIntent(s, {idempotency_key:"k1", lead_hmac:ID, campaign:"pilot", touch_n:1, draft_sha:SHA, submitted_at:NOW, store_fingerprint:"deadbeef"});
const cfg = (o) => { const p = pathx.join(fsx.mkdtempSync(pathx.join(osx.tmpdir(),"cfg")), "leads.json"); fsx.writeFileSync(p, JSON.stringify(o)); return p; };
const refuse = (events, draft=base, now=NOW, st=store) => { try { guardSend({events, store: st, draft, now}); return "ALLOWED"; } catch (e) { return e instanceof GuardRefusal ? e.step : "ERR:" + e.message; } };'

# ---------- the breaker clearance was a free-text regex over the whole spine ----------

@test "an approve decision from another lane does not clear a breaker" {
  run _g "$PRELUDE
    console.log(refuse([bounce(), {id:'01D', kind:'decision.recorded', payload:{decides:'01ELSE', verdict:'approve', reason:'approve: hold the pilot rollout until Monday'}}]));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"campaign-state"* ]]
}

@test "the word HOLD inside another word does not clear a HOLD" {
  run _g "$PRELUDE
    console.log(refuse([bounce(), {id:'01D', kind:'decision.recorded', payload:{decides:'01X', verdict:'approve', reason:'raise the pilot bounce threshold to 5'}}]));"
  [[ "$output" == *"campaign-state"* ]]
}

# `campaign` reached a RegExp raw: "a|b" made any reason containing b a clearance.
@test "a campaign name with regex metacharacters cannot forge a clearance" {
  run _g "$PRELUDE
    console.log(refuse([bounce('a|b'), {id:'01D', kind:'decision.recorded', payload:{decides:'01X', verdict:'approve', reason:'b'}}], {...base, campaign:'a|b'}));"
  [[ "$output" == *"campaign-state"* ]]
}

# And "(" threw a bare SyntaxError out of the guard rather than a GuardRefusal.
@test "a campaign name with an open paren does not throw out of the guard" {
  run _g "$PRELUDE
    const r = refuse([bounce('a(')], {...base, campaign:'a('});
    console.log(r.startsWith('ERR:') ? 'THREW ' + r : 'refused-cleanly ' + r);"
  [[ "$output" == *"refused-cleanly"* ]]
}

@test "a correctly bound breaker clearance does clear it" {
  run _g "$PRELUDE
    const ev = [bounce()];
    const st = deriveState(ev, {campaign:'pilot'});
    const inc = incidentIdFor('pilot', breakerState(st, 0), st);
    ev.push({id:'01REQ', kind:'approval.requested', payload:{gate:'leads-breaker', campaign:'pilot', level:'HOLD', incident_id:inc}});
    ev.push({id:'01DEC', kind:'decision.recorded', payload:{decides:'01REQ', verdict:'approve', reason:'typo in the address, resuming'}});
    console.log(refuse(ev));"
  [[ "$output" == *"ALLOWED"* ]]
}

# ---------- touch_n type mismatch (D5) ----------
#
# The idem interpolates touch_n, so 1 and "1" produce the SAME key, while === called them
# different touches. The guard let a second submit through and the reconciler voided an intent
# whose receipt was sitting on the spine.

@test "a string touch_n still matches an existing receipt" {
  run _g "$PRELUDE console.log(refuse([sent(1,'2026-08-04T09:00:00+05:30')], {...base, touch_n:'1'}));"
  [[ "$output" == *"already-sent"* ]]
}

@test "a non integer touch_n is refused outright" {
  run _g "$PRELUDE console.log(refuse([], {...base, touch_n:'abc'}));"
  [[ "$output" == *"bad-touch"* ]]
}

# A backdated clock emptied the rolling window: every real touch sat AFTER now.
@test "touches stamped after the send time are refused as clock skew" {
  run _g "$PRELUDE console.log(refuse([sent(1,'2026-08-06T10:00:00+05:30'), sent(2,'2026-08-07T10:00:00+05:30')], {...base, touch_n:3}, '2026-08-05T10:00:00+05:30'));"
  [[ "$output" == *"clock-skew"* ]]
}

# ---------- config floors and the window ceiling ----------
#
# "Config can lower a value and never raise it" is the WRONG invariant for a window: lowering
# rolling_window_days weakens the touch cap, and 0 removes it entirely.

@test "a rolling window below its floor is refused" {
  run _g "$PRELUDE
    try { loadCaps(cfg({caps:{rolling_window_days:0}})); console.log('ACCEPTED'); } catch (e) { console.log(e.code); }"
  [[ "$output" == *"CAP_BELOW_FLOOR"* ]]
}

# One config edit bought 24/7/365 cold outbound, the fastest way to burn the domain.
@test "a send window wider than the ceiling is refused" {
  run _g "$PRELUDE
    try { loadCaps(cfg({caps:{send_window_ist:{days:[0,1,2,3,4,5,6], start:'00:00', end:'23:59'}}})); console.log('ACCEPTED'); } catch (e) { console.log(e.code); }"
  [[ "$output" == *"WINDOW_ABOVE_CEILING"* ]]
}

@test "a narrower send window is still honoured" {
  run _g "$PRELUDE console.log(loadCaps(cfg({caps:{send_window_ist:{days:[1,2,3], start:'10:00', end:'17:00'}}})).send_window_ist.end);"
  [[ "$output" == *"17:00"* ]]
}

# ---------- complaint detection was an unscoped stringify+regex ----------

@test "an unrelated incident does not freeze a leads campaign" {
  run _g "$PRELUDE console.log(refuse([{kind:'incident.raised', payload:{module:'evolve', note:'no complaints so far this cycle'}}]));"
  [[ "$output" == *"ALLOWED"* ]]
}

@test "a scoped leads spam complaint does freeze the campaign" {
  run _g "$PRELUDE console.log(refuse([{kind:'incident.raised', payload:{module:'leads', campaign:'pilot', kind:'spam-complaint'}}]));"
  [[ "$output" == *"campaign-state"* ]]
}

# ---------- sequencer.mjs: zero coverage before this file ----------

# An approval missing an id and a decision missing a decides paired on undefined === undefined,
# so a decision approving something else entirely authorised this draft.
@test "an approval with no id is never paired with a decision" {
  run _g "$PRELUDE
    const ev = [{kind:'approval.requested', payload:{gate:'leads-send', draft_ref:'draft_0000000000000001', draft_sha:'AAA'}},
                {kind:'decision.recorded', payload:{verdict:'approve', reason:'approving something else entirely'}}];
    console.log(JSON.stringify(approvedShaFor(ev, 'draft_0000000000000001')));"
  [[ "$output" == *"null"* ]]
}

# `reject` was read NOWHERE in the send path, so a human who caught a mistake and rejected in
# the inbox could not stop the send.
@test "a reject after an approve revokes the approval" {
  run _g "$PRELUDE
    const ev = [{id:'01A', kind:'approval.requested', payload:{gate:'leads-send', draft_ref:'draft_0000000000000002', draft_sha:'BBB'}},
                {id:'01B', kind:'decision.recorded', payload:{decides:'01A', verdict:'approve', reason:'ok'}},
                {id:'01C', kind:'decision.recorded', payload:{decides:'01A', verdict:'reject', reason:'STOP wrong person'}}];
    console.log(JSON.stringify(approvedShaFor(ev, 'draft_0000000000000002')));"
  [[ "$output" == *"null"* ]]
}

@test "a plain approve still authorises the draft" {
  run _g "$PRELUDE
    const ev = [{id:'01A', kind:'approval.requested', payload:{gate:'leads-send', draft_ref:'draft_0000000000000003', draft_sha:'CCC'}},
                {id:'01B', kind:'decision.recorded', payload:{decides:'01A', verdict:'approve', reason:'ok'}}];
    console.log(approvedShaFor(ev, 'draft_0000000000000003').approvedSha);"
  [[ "$output" == *"CCC"* ]]
}

# ---------- journal.mjs: zero coverage before this file ----------

# An indeterminate lookup was treated as "definitely not sent" and VOIDED, deleting the only
# trace of a send the provider may have accepted -- so the next run submitted the same mail.
# Provider lookups are eventually consistent: a 404 on a just-accepted message is normal.
@test "an indeterminate provider lookup does not void the intent" {
  run _g "$PRELUDE
    for (const bad of [null, undefined, {}, 'yes', 0]) {
      const s = mkstore(); intent(s);
      const out = await reconcile(s, {events: [], lookup: async () => bad, emitReceipt: async () => {}});
      if (out.voided !== 0) { console.log('VOIDED on ' + JSON.stringify(bad)); process.exit(0); }
    }
    console.log('never-voided');"
  [[ "$output" == *"never-voided"* ]]
}

@test "a definite not found does void the intent" {
  run _g "$PRELUDE
    const s = mkstore(); intent(s);
    const out = await reconcile(s, {events: [], lookup: async () => ({found:false}), emitReceipt: async () => {}});
    console.log(out.voided === 1 ? 'voided' : 'NOT-VOIDED');"
  [[ "$output" == *"voided"* ]]
}

@test "an accepted lookup with no message id does not fabricate a receipt" {
  run _g "$PRELUDE
    const s = mkstore(); intent(s);
    let emitted = 0;
    const out = await reconcile(s, {events: [], lookup: async () => ({found:true}), emitReceipt: async () => { emitted++; }});
    console.log(emitted === 0 && out.voided === 0 ? 'held' : 'EMITTED:' + emitted);"
  [[ "$output" == *"held"* ]]
}

# An emit failure after a confirmed ack threw out of reconcile with the intent unresolved,
# wedging every future send AND every future reconcile with no way out.
@test "an emit failure does not wedge the reconciler" {
  run _g "$PRELUDE
    const s = mkstore(); intent(s);
    try {
      const out = await reconcile(s, {events: [], lookup: async () => ({found:true, provider_message_id:'pm1'}), emitReceipt: async () => { throw new Error('spine refused'); }});
      console.log(out.emitFailed === 1 ? 'recorded-not-thrown' : 'UNEXPECTED');
    } catch (e) { console.log('THREW ' + e.message); }"
  [[ "$output" == *"recorded-not-thrown"* ]]
}

# The spine-first property, asserted directly rather than assumed from the ordering.
@test "an existing receipt resolves the intent with zero provider calls" {
  run _g "$PRELUDE
    const s = mkstore(); intent(s);
    let calls = 0;
    const out = await reconcile(s, {events: [sent(1, NOW)], lookup: async () => { calls++; return {found:true}; }, emitReceipt: async () => {}});
    console.log(out.resolvedFromSpine + ' ' + calls);"
  [[ "$output" == *"1 0"* ]]
}

# M1, the headline surviving mutant: every test in the sibling file built an EMPTY journal, so
# chain step 2 never executed once in 33 tests and could be deleted with the suite green.
@test "an unresolved intent blocks every send" {
  run _g "$PRELUDE
    const s = mkstore(); intent(s);
    console.log(refuse([], base, NOW, s));"
  [[ "$output" == *"unresolved-intent"* ]]
}

# ---------- the FAIL class ----------

# It was one `if` in the CLI draft command; nothing in the send path re-read lint_status, so a
# draft record written by any other route sent regardless of it.
@test "the send path reads lint status at the send moment" {
  run grep -c "lint_status" "$ARC_ROOT/.claude/scripts/leads/lib/sequencer.mjs"
  [ "$output" -ge 1 ] || { echo "the send path never reads lint_status"; false; }
}

# FAIL-2 was bidirectional: `cf.includes(t)` means "my invented claim CONTAINS a real fact",
# which is exactly the fabrication case. Appending to a true fact was BELOW-BAR, not FAIL.
@test "a cited fact that merely contains a real fact is a FAIL" {
  run _g "const {lintDraft} = await import('./.claude/scripts/leads/lib/personalization.mjs');
    const dossier = {citable_facts: [{text: 'the firm is SEBI registered', evidence_url: 'https://x.example.com/a', relevance: 'r'}]};
    const invented = 'the firm is SEBI registered and manages 4200 crore of client AUM with a 38 percent CAGR since 2019';
    const r = lintDraft({body: 'Hi. ' + invented, cites: [{fact: invented, source: 'https://x.example.com/a', relevance: 'r'}]}, dossier);
    console.log(r.verdict);"
  [[ "$output" == *"FAIL"* ]]
}

# ARC_LEADS_NOW was a cap override wearing a test door's clothes, refused by nothing: one
# value sent 20 more on the same real day, another emptied the rolling touch window.
# This test asserted a message the command never reached: it died at openStore, three frames
# and four checks BEFORE nowIst() ran, so it passed on the wrong error. D4, in the very file
# written to pin D4 -- which is the point about a fix not being applied until it has been
# attacked somewhere it was never made. The store and campaign are now real, so control
# actually reaches the clock door.
@test "the test clock door is refused without fake mode" {
  cd "$ARC_ROOT"
  export ARC_LEADS_STORE="$BATS_TEST_TMPDIR/store" ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine"
  ARC_LEADS_FAKE=1 run node .claude/scripts/leads/arc-leads.mjs store init
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  ARC_LEADS_FAKE=1 run node .claude/scripts/leads/arc-leads.mjs campaign init pilot
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run env -u ARC_LEADS_FAKE ARC_LEADS_NOW="2026-08-05T10:00:00+05:30" node .claude/scripts/leads/arc-leads.mjs daily pilot
  [ "$status" -ne 0 ]
  [[ "$output" == *"test-only clock door"* ]] || { echo "reached the wrong error: $output"; false; }
}

# ---------- key rotation vs the suppression ledger ----------
#
# The guard checked ONE lead_id against the suppression set while `leadIdsAllVersions` sat
# unused -- called nowhere in src, only by a test that asserted the KEYRING retained v1 and
# never that the guard consulted it. So after a rotation, everyone who unsubscribed under the
# previous key became contactable again: the single worst thing this system can do, and
# verbatim the outcome store.mjs says additive rotation exists to prevent.
#
# The resolution now happens INSIDE the guard, from the store, because a caller-supplied list
# is a list that can be short -- and a short list is the same hole wearing a fix.
@test "a lead suppressed under an old key is still refused after a rotation" {
  run _g "$PRELUDE
    const {initStore, openStore, leadId, rotateSecret} = await import('./.claude/scripts/leads/lib/store.mjs');
    process.env.ARC_LEADS_STORE = fsx.mkdtempSync(pathx.join(osx.tmpdir(), 'rot'));
    initStore(); let st = openStore();
    const EMAIL = 'adv@firm.example.com';
    const v1 = leadId(st, EMAIL);
    const ev = [{kind:'lead.suppressed', payload:{lead_id:v1, reason:'unsubscribe', suppressed_at:NOW}}];
    rotateSecret(); st = openStore();
    const v2 = leadId(st, EMAIL);
    fsx.mkdirSync(pathx.join(st.dir,'dossiers'), {recursive:true});
    fsx.writeFileSync(pathx.join(st.dir,'dossiers', v2 + '.json'), JSON.stringify({lead_id:v2, email:EMAIL}));
    const d = {campaign:'pilot', lead_id:v2, touch_n:1, draft_sha:SHA, approved_sha:SHA};
    console.log((v1 === v2 ? 'IDS-DID-NOT-ROTATE ' : '') + refuse(ev, d, NOW, st));"
  [[ "$output" == *"suppression"* ]]
  [[ "$output" != *"IDS-DID-NOT-ROTATE"* ]]
}

@test "a caller supplied short id list cannot weaken the suppression check" {
  run _g "$PRELUDE
    const {initStore, openStore, leadId, rotateSecret} = await import('./.claude/scripts/leads/lib/store.mjs');
    process.env.ARC_LEADS_STORE = fsx.mkdtempSync(pathx.join(osx.tmpdir(), 'rot2'));
    initStore(); let st = openStore();
    const EMAIL = 'adv@firm.example.com';
    const v1 = leadId(st, EMAIL);
    const ev = [{kind:'lead.suppressed', payload:{lead_id:v1, reason:'unsubscribe', suppressed_at:NOW}}];
    rotateSecret(); st = openStore();
    const v2 = leadId(st, EMAIL);
    fsx.mkdirSync(pathx.join(st.dir,'dossiers'), {recursive:true});
    fsx.writeFileSync(pathx.join(st.dir,'dossiers', v2 + '.json'), JSON.stringify({lead_id:v2, email:EMAIL}));
    const d = {campaign:'pilot', lead_id:v2, touch_n:1, draft_sha:SHA, approved_sha:SHA, lead_ids_all_versions:[v2]};
    console.log(refuse(ev, d, NOW, st));"
  [[ "$output" == *"suppression"* ]]
}

# A lead the guard cannot resolve against the keyring is REFUSED, never waved through: an
# unresolvable id means the suppression check could not run, and "could not check" must never
# read as "found nothing".
@test "a lead with no dossier is refused rather than checked against one id" {
  run _g "$PRELUDE
    const {initStore, openStore, leadId} = await import('./.claude/scripts/leads/lib/store.mjs');
    process.env.ARC_LEADS_STORE = fsx.mkdtempSync(pathx.join(osx.tmpdir(), 'rot3'));
    initStore(); const st = openStore();
    const id = leadId(st, 'nobody@firm.example.com');
    console.log(refuse([], {campaign:'pilot', lead_id:id, touch_n:1, draft_sha:SHA, approved_sha:SHA}, NOW, st));"
  [[ "$output" == *"suppression"* ]]
}

# store.mjs exports the modes precisely so the CLI cannot forget them -- and its own comment
# named the dossier and rejected.jsonl writes as having forgotten them. They still had.
@test "the dossier directory and its files carry the store modes" {
  run grep -c "STORE_DIR_MODE\|STORE_FILE_MODE" "$ARC_ROOT/.claude/scripts/leads/arc-leads.mjs"
  [ "$output" -ge 3 ] || { echo "the CLI writes store files without the exported modes: $output"; false; }
}

@test "this file registers the 30 tests it declares" {
  declared=$(grep -c '^@test ' "$BATS_TEST_FILENAME")
  registered=${#BATS_TEST_NAMES[@]}
  [ "$declared" -eq 30 ] || { echo "declared $declared, expected 30"; false; }
  [ "$registered" -eq "$declared" ] || { echo "bats registered $registered of $declared -- one was DROPPED"; false; }
}
