#!/usr/bin/env bats
# leads Phase 03 slice 04 -- the ADR-0416 rehearsal SEND: containment and the mark.
#
# Slices 01 and 02 proved the GATE (leads-rehearsal-guard.bats): rehearsal mode is declared,
# named and locked before the product domain is unlocked. That gate deliberately says only
# that a lock EXISTS -- its own row reads "per-recipient enforcement at send time is slice 04
# and is not proven by this row". This file is that enforcement, and the two properties it
# carries are:
#
#   1. a recipient outside the allowlist is refused BEFORE any network call
#   2. every rehearsal send carries its rehearsal mark in its receipt
#
# Two shapes of assertion carry the weight, and both exist because the obvious version proves
# nothing:
#
#   NO SOCKET OPENED is asserted by counting the calls the provider is ASKED for, not by
#   observing that the send failed. A send refused three frames after the provider was reached
#   satisfies "it did not send" and violates the property outright.
#
#   THE MIXING GUARD is asserted as a COUNT. "the report does not say real" passes for a mutant
#   that changes the wording and fails for one that changes the meaning, and the count is the
#   only form of the claim that survives a rename.
#
# The allowlist is compared in ID SPACE across EVERY key version. That is the mirror image of
# the suppression bug guard.mjs records in its own header: one id checked meant a rotation
# un-suppressed everyone who had unsubscribed, and one id checked HERE means a rotation stops
# the allowlisted people from matching -- or, worse, a later variant reads the miss as unknown.
#
# Addresses below are RFC-2606 reserved literals, which is what this path is FOR: pii-tripwire
# treats tests/leads-*.bats as a fixture class and requires reserved domains rather than no
# addresses at all. ASCII-only test names; the file asserts its own declared count at the end.
bats_require_minimum_version 1.5.0
load 'test_helper'

_r() { cd "$ARC_ROOT" && ARC_LEADS_FAKE=1 node --input-type=module -e "$1"; }

RSEND='const {guardSend, GuardRefusal, rehearsalAllowedIds, sendCounts, REHEARSAL_ALLOWLIST_VAR} = await import("./.claude/scripts/leads/lib/guard.mjs");
const {sendOne} = await import("./.claude/scripts/leads/lib/sequencer.mjs");
const {initStore, openStore, rotateSecret, leadId} = await import("./.claude/scripts/leads/lib/store.mjs");
const {initCampaign, writeDraft} = await import("./.claude/scripts/leads/lib/drafts.mjs");
const {writeIntent, reconcile} = await import("./.claude/scripts/leads/lib/journal.mjs");
const {provider} = await import("./.claude/scripts/leads/lib/deps.mjs");
const {leadsIdem} = await import("./.claude/scripts/hq/lib/validate-leads.mjs");
const {validateEvent} = await import("./.claude/scripts/hq/lib/validate.mjs");
const fs = await import("node:fs"), os = await import("node:os"), path = await import("node:path");

const NOW = "2026-08-04T10:00:00+05:30";
const SHA = "c".repeat(64);
// sending_domain is EMPTY on purpose -- that is the honest committed value (no dedicated cold
// domain exists yet), so the only way a send happens at all here is through the ADR-0416
// rehearsal_domain substitution. A fixture that filled it in would be testing a world that
// does not exist and would hide the ADR-0402 door in the undeclared case below.
const CFG = (() => { const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "rcfg")), "leads.json");
  fs.writeFileSync(p, JSON.stringify({sending_domain: "", product_domains: ["lexos.app", "automemory.ai"],
    rehearsal_domain: "automemory.ai", dkim_selector: "default", rehearsal_dkim_selector: "resend"})); return p; })();
const ON = {ARC_LEADS_REHEARSAL: "1", ARC_LEADS_REHEARSAL_ALLOWLIST: "one@example.test,two@example.test"};

function freshStore() {
  process.env.ARC_LEADS_STORE = fs.mkdtempSync(path.join(os.tmpdir(), "reh"));
  initStore();
  const s = openStore();
  initCampaign(s, "pilot", {createdAt: NOW});
  fs.mkdirSync(path.join(s.dir, "dossiers"), {recursive: true});
  return s;
}
function dossier(s, email) {
  const id = leadId(s, email);
  fs.writeFileSync(path.join(s.dir, "dossiers", id + ".json"), JSON.stringify({lead_id: id, email}));
  return id;
}
const draftOf = (s, id) => writeDraft(s, {campaign: "pilot", lead_id: id, touch_n: 1,
  body: "Hi there, this is the body.", cites: [], lintStatus: "PASS"});
const approvals = (r) => [
  {id: "01APPROVAL", kind: "approval.requested", payload: {gate: "leads-send", draft_ref: r.draft_ref, draft_sha: r.draft_sha}},
  {id: "01DECISION", kind: "decision.recorded", payload: {decides: "01APPROVAL", verdict: "approve", reason: "ok"}}];
const step = (s, id, env) => { try {
    guardSend({events: [], store: s, now: NOW, config: CFG, env,
      draft: {campaign: "pilot", lead_id: id, touch_n: 1, draft_sha: SHA, approved_sha: SHA}});
    return "ALLOWED"; } catch (e) { return e instanceof GuardRefusal ? e.step : "ERR:" + e.message; } };
const why = (s, id, env) => { try {
    guardSend({events: [], store: s, now: NOW, config: CFG, env,
      draft: {campaign: "pilot", lead_id: id, touch_n: 1, draft_sha: SHA, approved_sha: SHA}});
    return "ALLOWED"; } catch (e) { return e.message; } };
// Counts the submits the provider is ASKED for. Watching the CALL is the only way to assert
// "no socket opened"; watching the outcome cannot tell a pre-network refusal from a failure.
function countingProvider() {
  const p = provider();
  const real = p.submit.bind(p);
  const seen = {submits: 0};
  p.submit = async (a) => { seen.submits++; return real(a); };
  return seen;
}
const RECEIPT = {lead_id: "lead_hmac_v1_" + "a".repeat(32), campaign: "pilot", touch_n: 1, idem_key: "k1",
  provider_message_id: "m1", submitted_at: NOW, draft_sha: SHA, rehearsal: true};
const mk = (payload) => ({id: "01J000000000000000000000AB", v: 1, ts: NOW, idem: leadsIdem("outreach.sent", payload),
  actor: "arc-leads", process: "leads@1.0.0", model: null, venture: "arc", run_id: "r-t", kind: "outreach.sent",
  payload, outcome: "ok", cost: null, evidence: null, supersedes: null});
const verdict = (payload) => { try { validateEvent(mk(payload)); return "ACCEPTED"; } catch (e) { return e.code; } };
const sent = (mark, at) => ({kind: "outreach.sent", payload: {...RECEIPT, submitted_at: at, rehearsal: mark}});
const WINDOW = {from: "2026-08-04T00:00:00+05:30", to: "2026-08-04T23:59:59+05:30"};'

# ---------- property 1: containment, before any network call ----------

@test "an allowlisted lead sends and the provider is reached exactly once" {
  run -0 _r "$RSEND
    const s = freshStore(); const rec = draftOf(s, dossier(s, \"one@example.test\"));
    const seen = countingProvider();
    const r = await sendOne({store: s, events: approvals(rec), draftRef: rec.draft_ref, now: NOW,
      config: CFG, env: ON, emitReceipt: async () => {}});
    console.log(\"ok=\" + r.ok + \" step=\" + (r.step || \"-\") + \" submits=\" + seen.submits);"
  [[ "$output" == *"ok=true step=- submits=1"* ]]
}

# THE headline refusal. `submits=0` is the property; `step=rehearsal-allowlist` is what stops
# it passing for the wrong reason, since this config refuses several other ways too.
@test "a lead outside the allowlist is refused with no socket opened" {
  run -0 _r "$RSEND
    const s = freshStore(); const rec = draftOf(s, dossier(s, \"stranger@example.test\"));
    const seen = countingProvider();
    const r = await sendOne({store: s, events: approvals(rec), draftRef: rec.draft_ref, now: NOW,
      config: CFG, env: ON, emitReceipt: async () => { throw new Error(\"a refused send must emit nothing\"); }});
    console.log(\"ok=\" + r.ok + \" step=\" + r.step + \" submits=\" + seen.submits);"
  [[ "$output" == *"ok=false step=rehearsal-allowlist submits=0"* ]]
}

# The allowlist refusal is the line most likely to be read out of a CI log by someone who
# should not have the address, and the operator already knows which recipients they listed.
@test "the allowlist refusal names no address" {
  run -0 _r "$RSEND
    const s = freshStore(); dossier(s, \"one@example.test\");
    const msg = why(s, dossier(s, \"stranger@example.test\"), ON);
    console.log(\"echoes=\" + /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}/.test(msg) + \" names-the-var=\" + msg.includes(\"ARC_LEADS_REHEARSAL_ALLOWLIST\"));"
  [[ "$output" == *"echoes=false names-the-var=true"* ]]
}

# ID SPACE, every key version. A single-version check is the mirror of the suppression bug
# guard.mjs names as the single worst thing this system can do: after a rotation the receipts
# and drafts a person already has carry their v1 id while the store mints v2.
@test "an allowlisted lead whose id was minted under a previous key still matches" {
  run -0 _r "$RSEND
    const s0 = freshStore();
    const v1 = dossier(s0, \"one@example.test\");
    const v1out = dossier(s0, \"stranger@example.test\");
    rotateSecret();
    const s = openStore();
    const v2 = dossier(s, \"two@example.test\");
    console.log(\"versions=\" + s.keyring.length + \" rotated=\" + (v1 !== leadId(s, \"one@example.test\")) +
      \" old-allowlisted=\" + step(s, v1, ON) + \" old-stranger=\" + step(s, v1out, ON) +
      \" new-allowlisted=\" + step(s, v2, ON));"
  [[ "$output" == *"versions=2 rotated=true old-allowlisted=ALLOWED old-stranger=rehearsal-allowlist new-allowlisted=ALLOWED"* ]]
}

# The union is over ADDRESSES mapped forward, never over an id resolved backwards -- so the
# set grows with the keyring and holds no raw address at all.
@test "the allowed set is ids across every key version and holds no address" {
  run -0 _r "$RSEND
    const s0 = freshStore(); rotateSecret();
    const s = openStore();
    const ids = [...rehearsalAllowedIds(s, ON)];
    console.log(\"size=\" + ids.length + \" all-keyed=\" + ids.every((i) => /^lead_hmac_v[1-9][0-9]*_[0-9a-f]{32}$/.test(i)) +
      \" var=\" + REHEARSAL_ALLOWLIST_VAR);"
  [[ "$output" == *"size=4 all-keyed=true var=ARC_LEADS_REHEARSAL_ALLOWLIST"* ]]
}

# Declared-but-incomplete must refuse AT THE GUARD. `blocked` leaves eff.rehearsal false, so a
# check keyed off that flag would turn a broken rehearsal config into an unguarded send --
# and unsubscribeHeader refusing the same state is exactly why this must not lean on it.
@test "a declared but incomplete rehearsal is refused by the guard itself" {
  run -0 _r "$RSEND
    const s = freshStore(); const id = dossier(s, \"stranger@example.test\");
    console.log([step(s, id, {ARC_LEADS_REHEARSAL: \"1\"}),
                 step(s, id, {ARC_LEADS_REHEARSAL: \"1\", ARC_LEADS_REHEARSAL_ALLOWLIST: \"yes\"}),
                 step(s, id, {ARC_LEADS_REHEARSAL: \"1\", ARC_LEADS_REHEARSAL_ALLOWLIST: \"\"})].join(\" \"));"
  [[ "$output" == *"rehearsal-mode rehearsal-mode rehearsal-mode"* ]]
}

# The paired NEGATIVE, and it is the one that keeps this honest. With rehearsal undeclared the
# allowlist step does NOT fire -- there is no list in the world to check against, and real cold
# outbound is a Phase-05 question. The door that holds instead is ADR-0402: sending_domain is
# empty, so no List-Unsubscribe can be built and the provider is never reached.
@test "with rehearsal undeclared the allowlist step is silent and ADR-0402 holds the door" {
  run -0 _r "$RSEND
    const s = freshStore(); const rec = draftOf(s, dossier(s, \"stranger@example.test\"));
    const seen = countingProvider();
    const guardVerdict = step(s, rec.lead_id, {});
    const r = await sendOne({store: s, events: approvals(rec), draftRef: rec.draft_ref, now: NOW,
      config: CFG, env: {}, emitReceipt: async () => { throw new Error(\"nothing may be emitted\"); }});
    console.log(\"guard=\" + guardVerdict + \" sent=\" + r.ok + \" submits=\" + seen.submits +
      \" domain-door=\" + r.why.includes(\"no sending_domain configured\"));"
  [[ "$output" == *"guard=ALLOWED sent=false submits=0 domain-door=true"* ]]
}

# ---------- property 2: the mark, in the receipt and in the idem ----------

@test "a rehearsal send emits a receipt carrying the mark" {
  run -0 _r "$RSEND
    const s = freshStore(); const rec = draftOf(s, dossier(s, \"two@example.test\"));
    let p = null;
    const r = await sendOne({store: s, events: approvals(rec), draftRef: rec.draft_ref, now: NOW,
      config: CFG, env: ON, emitReceipt: async (x) => { p = x; }});
    console.log(\"ok=\" + r.ok + \" mark=\" + JSON.stringify(p && p.rehearsal) + \" accepted=\" + verdict(p));"
  [[ "$output" == *"ok=true mark=true accepted=ACCEPTED"* ]]
}

# A send made with rehearsal UNDECLARED marks its receipt false rather than omitting the field.
# The mark is derived from the binding through the same resolver unsubscribeHeader gates on --
# never a caller-passed flag, which is what ADR-0416 rules out by name.
@test "the mark is derived from the binding rather than defaulting to absent" {
  run -0 _r "$RSEND
    const s = freshStore(); const rec = draftOf(s, dossier(s, \"one@example.test\"));
    const CFG2 = (() => { const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), \"rcfg2\")), \"leads.json\");
      fs.writeFileSync(p, JSON.stringify({sending_domain: \"outreach.example.net\", product_domains: [\"lexos.app\"]})); return p; })();
    let p = null;
    const r = await sendOne({store: s, events: approvals(rec), draftRef: rec.draft_ref, now: NOW,
      config: CFG2, env: {}, emitReceipt: async (x) => { p = x; }});
    console.log(\"ok=\" + r.ok + \" mark=\" + JSON.stringify(p && p.rehearsal) + \" accepted=\" + verdict(p));"
  [[ "$output" == *"ok=true mark=false accepted=ACCEPTED"* ]]
}

# REQUIRED, not optional. Optional means absent-equals-real, so a dropped mark would silently
# reclassify a rehearsal send as a real first touch -- the one fail-open ADR-0416 exists to
# prevent. And a boolean, not a truthy value: two spellings of one fact reach the idem preimage
# as two different strings, which is how one send becomes two receipts.
@test "an outreach sent receipt without a boolean mark is refused by the schema" {
  run -0 _r "$RSEND
    const {rehearsal: drop, ...bare} = RECEIPT;
    console.log([verdict(RECEIPT), verdict(bare), verdict({...RECEIPT, rehearsal: \"true\"}),
                 verdict({...RECEIPT, rehearsal: 1}), verdict({...RECEIPT, rehearsal: null})].join(\" \"));"
  [[ "$output" == *"ACCEPTED BAD_LEADS BAD_LEADS BAD_LEADS BAD_LEADS"* ]]
}

# The other half, and the more dangerous one to omit: a field in the payload but NOT in the
# preimage lets a rehearsal receipt and a real receipt that differ ONLY in the mark collide on
# one idem, so the reconcile that exists to prevent a double-send becomes the thing that mixes
# the two classes it must never mix.
@test "a rehearsal receipt and a real receipt do not collide on one idem" {
  run -0 _r "$RSEND
    const a = leadsIdem(\"outreach.sent\", {...RECEIPT, rehearsal: true});
    const b = leadsIdem(\"outreach.sent\", {...RECEIPT, rehearsal: false});
    const c = leadsIdem(\"outreach.sent\", {...RECEIPT, rehearsal: true});
    console.log(\"distinct=\" + (a !== b) + \" stable=\" + (a === c));"
  [[ "$output" == *"distinct=true stable=true"* ]]
}

# The crash path has to carry the mode too. reconcile can run days later from a shell where
# ARC_LEADS_REHEARSAL is set differently, so the mark comes from the journalled INTENT and a
# recovery receipt can never reclassify a send that already happened.
@test "a late receipt from reconcile carries the mode the intent was written with" {
  run -0 _r "$RSEND
    const s = freshStore(); const id = dossier(s, \"one@example.test\");
    writeIntent(s, {idempotency_key: \"k1\", lead_hmac: id, campaign: \"pilot\", touch_n: 1,
      draft_sha: SHA, submitted_at: NOW, store_fingerprint: \"deadbeef\", rehearsal: true});
    let p = null;
    const out = await reconcile(s, {events: [], lookup: async () => ({found: true, provider_message_id: \"pm1\"}),
      emitReceipt: async (x) => { p = x; }});
    console.log(\"emitted=\" + out.emittedLate + \" mark=\" + JSON.stringify(p && p.rehearsal));"
  [[ "$output" == *"emitted=1 mark=true"* ]]
}

# An intent that cannot say which mode its send was made in cannot become a valid receipt.
# Finding that out before the submit costs a refusal; finding it out afterwards costs an intent
# no reconcile can ever resolve, which wedges every future send.
@test "an intent with no mode is refused before the submit rather than at reconcile" {
  run -0 _r "$RSEND
    const s = freshStore();
    const base = {idempotency_key: \"k1\", lead_hmac: dossier(s, \"one@example.test\"), campaign: \"pilot\",
      touch_n: 1, draft_sha: SHA, submitted_at: NOW, store_fingerprint: \"deadbeef\"};
    const say = (o) => { try { writeIntent(s, o); return \"WRITTEN\"; } catch (e) { return e.code; } };
    console.log(say(base) + \" \" + say({...base, rehearsal: false}) + \" \" + say({...base, rehearsal: true}));"
  [[ "$output" == *"BAD_INTENT WRITTEN WRITTEN"* ]]
}

# ---------- the mixing guard, as a COUNT ----------

@test "a report over the rehearsal window asked for real sends returns zero by count" {
  run -0 _r "$RSEND
    const five = [1,2,3,4,5].map(() => sent(true, NOW));
    const c = sendCounts(five, WINDOW);
    console.log(\"real=\" + c.real + \" rehearsal=\" + c.rehearsal + \" unmarked=\" + c.unmarked + \" total=\" + c.total);"
  [[ "$output" == *"real=0 rehearsal=5 unmarked=0 total=5"* ]]
}

# The paired POSITIVE. Without it the test above passes for a counter that returns zero always,
# and an assertion that stays green when the implementation is deleted measures nothing.
@test "one real send in the same window is counted as one, not hidden by the rehearsals" {
  run -0 _r "$RSEND
    const c = sendCounts([...[1,2,3,4,5].map(() => sent(true, NOW)), sent(false, NOW)], WINDOW);
    console.log(\"real=\" + c.real + \" rehearsal=\" + c.rehearsal + \" total=\" + c.total);"
  [[ "$output" == *"real=1 rehearsal=5 total=6"* ]]
}

# An UNMARKED receipt counts as REAL. It can only predate the schema change, and we cannot show
# it was a rehearsal -- which is not the same as showing it was one. Counting it as real is what
# keeps a zero worth reading; it is also reported separately so the operator can tell five cold
# sends from five receipts of unknown vintage.
@test "an unmarked receipt counts as real and never as a rehearsal" {
  run -0 _r "$RSEND
    const {rehearsal: drop, ...bare} = RECEIPT;
    const c = sendCounts([{kind: \"outreach.sent\", payload: bare}], WINDOW);
    console.log(\"real=\" + c.real + \" rehearsal=\" + c.rehearsal + \" unmarked=\" + c.unmarked);"
  [[ "$output" == *"real=1 rehearsal=0 unmarked=1"* ]]
}

# The window and the campaign filter both have to bite, or the count above is a count of
# everything wearing a window as decoration.
@test "the window and campaign filters exclude what falls outside them" {
  run -0 _r "$RSEND
    const inside = sent(true, NOW), before = sent(true, \"2026-08-01T10:00:00+05:30\");
    const other = {kind: \"outreach.sent\", payload: {...RECEIPT, campaign: \"other\"}};
    console.log(\"windowed=\" + sendCounts([inside, before], WINDOW).total +
      \" unwindowed=\" + sendCounts([inside, before]).total +
      \" scoped=\" + sendCounts([inside, other], {campaign: \"pilot\"}).total +
      \" unscoped=\" + sendCounts([inside, other]).total);"
  [[ "$output" == *"windowed=1 unwindowed=2 scoped=1 unscoped=2"* ]]
}

# LAST on purpose: BATS_TEST_NUMBER is then the count bats actually registered AND REACHED, so
# comparing it against what the file declares catches a declared test that never ran. The
# declaration grep is bats OWN pattern (leading blanks allowed, blank after @test), because the
# narrower `^@test ` anchor misses three forms bats executes.
@test "this suite declares as many tests as bats reached" {
  declared="$(grep -cE '^[[:blank:]]*@test[[:blank:]]' "$BATS_TEST_FILENAME")"
  [ "$declared" -eq 18 ] || { echo "file declares $declared test(s); expected 18"; false; }
  [ "$BATS_TEST_NUMBER" -eq "$declared" ] || {
    echo "file declares $declared test(s); bats reached $BATS_TEST_NUMBER"; false; }
  offenders="$(grep -E '^[[:blank:]]*@test[[:blank:]]' "$BATS_TEST_FILENAME" | LC_ALL=C grep -c '[^ -~]' || true)"
  [ "$offenders" -eq 0 ] || { echo "$offenders @test name(s) carry non-ASCII bytes"; false; }
}
