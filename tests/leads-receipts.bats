#!/usr/bin/env bats
# leads Phase 00 -- the pipeline vocabulary (ADR-0400) and metric.observed (ADR-0408).
#
# Two properties carry the weight here, and both exist because the repo is headed public:
#
#   no PII reaches a payload -- asserted on the shapes that actually carry it
#   the idem is TOTAL-PREIMAGE -- a partial preimage silently quarantined ~100 receipts in C2,
#   and a cap derived from receipts that were never written counts zero and never trips
#
# ASCII-only test names; the file asserts its own declared count at the bottom.
bats_require_minimum_version 1.5.0
load 'test_helper'

_node() { cd "$ARC_ROOT" && node --input-type=module -e "$1"; }

VIMPORT='const {validateEvent} = await import("./.claude/scripts/hq/lib/validate.mjs");
const {leadsIdem} = await import("./.claude/scripts/hq/lib/validate-leads.mjs");
const ID = "lead_hmac_v1_" + "a".repeat(32);
const mk = (kind, payload, over={}) => ({id:"01J000000000000000000000AB", v:1, ts:"2026-08-04T10:00:00+05:30",
  idem: leadsIdem(kind, payload), actor:"arc-leads", process:"leads@1.0.0", model:null, venture:"arc",
  run_id:"r-t", kind, payload, outcome:"ok", cost:null, evidence:null, supersedes:null, ...over});
const RESEARCHED = {lead_id:ID, campaign:"pilot", provenance:"firm-site", geography:"IN",
  email_status:"verified", fact_count:2, store_id:"0123456789abcdef", store_fingerprint:"deadbeef"};
const refuses = (fn) => { try { fn(); return "ACCEPTED"; } catch (e) { return e.code; } };'

@test "KINDS is 39 and holds all eight leads kinds" {
  run _node 'const {KINDS} = await import("./.claude/scripts/hq/lib/validate.mjs");
    const want = ["lead.researched","outreach.sent","outreach.replied","meeting.booked","lead.suppressed","deal.won","deal.lost","metric.observed"];
    const missing = want.filter(k => !KINDS.includes(k));
    console.log(KINDS.length + " " + (missing.length ? "MISSING:" + missing.join(",") : "all-present"));'
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"39 all-present"* ]]
}

@test "a well formed lead researched receipt is accepted" {
  run _node "$VIMPORT validateEvent(mk('lead.researched', RESEARCHED)); console.log('ok');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"ok"* ]]
}

# The headline PII assertion. A raw address in ANY payload string dies here, not on a
# permanent public spine.
@test "a raw email anywhere in a payload is rejected" {
  run _node "$VIMPORT console.log(refuses(() => validateEvent(mk('lead.researched', {...RESEARCHED, store_id:'adv@firm.example.com'}))));"
  [[ "$output" == *"BAD_LEADS_PII"* ]]
}

@test "a URL anywhere in a payload is rejected" {
  run _node "$VIMPORT console.log(refuses(() => validateEvent(mk('lead.researched', {...RESEARCHED, store_id:'https://firm.example.com'}))));"
  [[ "$output" == *"BAD_LEADS_PII"* ]]
}

# evolve's h-<hex16> grammar is fine for a URL-derived source id and fatal for a person:
# emails are low-entropy, so a bare hash is dictionary-attackable by anyone holding a public
# directory. The keyed form is the whole point of ADR-0400.
@test "a bare unkeyed h hex16 lead id is rejected" {
  run _node "$VIMPORT console.log(refuses(() => validateEvent(mk('lead.researched', {...RESEARCHED, lead_id:'h-0123456789abcdef'}))));"
  [[ "$output" == *"BAD_LEADS"* ]]
}

@test "a rotated v2 lead id is accepted" {
  run _node "$VIMPORT console.log(refuses(() => validateEvent(mk('lead.researched', {...RESEARCHED, lead_id:'lead_hmac_v2_' + 'b'.repeat(32)}))));"
  [[ "$output" == *"ACCEPTED"* ]]
}

@test "provenance outside the closed allowlist is rejected" {
  run _node "$VIMPORT console.log(refuses(() => validateEvent(mk('lead.researched', {...RESEARCHED, provenance:'purchased-list'}))));"
  [[ "$output" == *"BAD_LEADS"* ]]
}

@test "an unknown payload key is rejected" {
  run _node "$VIMPORT console.log(refuses(() => validateEvent(mk('lead.researched', {...RESEARCHED, note:'hello'}))));"
  [[ "$output" == *"BAD_LEADS"* ]]
}

# "|" is the idem preimage delimiter. A campaign that could carry one could forge a collision
# with another campaign's receipt.
@test "a campaign name containing a pipe is rejected" {
  run _node "$VIMPORT console.log(refuses(() => validateEvent(mk('lead.researched', {...RESEARCHED, campaign:'a|b'}))));"
  [[ "$output" == *"BAD_LEADS"* ]]
}

@test "a payload timestamp in UTC Z form is rejected" {
  run _node "$VIMPORT console.log(refuses(() => validateEvent(mk('meeting.booked', {lead_id:ID, campaign:'pilot', booked_at:'2026-08-04T10:00:00Z'}))));"
  [[ "$output" == *"BAD_LEADS_TS"* ]]
}

# Anti-preclaim: the emit path honours a caller-supplied --idem for most kinds, so without
# this binding an attacker could pre-claim a real receipt's stable key with a decoy payload.
# The real receipt then collides on DUP_IDEM and is silently lost.
@test "an idem that is not the total preimage is rejected" {
  run _node "$VIMPORT console.log(refuses(() => validateEvent(mk('lead.researched', RESEARCHED, {idem:'f'.repeat(64)}))));"
  [[ "$output" == *"BAD_LEADS"* ]]
}

@test "two touches to one lead produce different idems" {
  run _node "$VIMPORT
    const base = {lead_id:ID, campaign:'pilot', idem_key:'k1', provider_message_id:'m1', submitted_at:'2026-08-04T10:00:00+05:30', draft_sha:'a'.repeat(64)};
    const a = leadsIdem('outreach.sent', {...base, touch_n:1});
    const b = leadsIdem('outreach.sent', {...base, touch_n:2});
    console.log(a === b ? 'COLLIDE' : 'distinct');"
  [[ "$output" == *"distinct"* ]]
}

# C20: metric.observed's stream contract, scoped to what Phase 00 owns -- the validator.
# Phase 00 builds no aggregator, so asserting "never summed" against a reader that does not
# exist would be an assertion with no code path under it.
@test "metric observed accepts both source id grammars" {
  run _node "$VIMPORT
    const m = (sid) => ({module:'leads', surface:'campaign', metric:'reply_rate', value:0.12, unit_count:25,
      window_start:'2026-08-01T00:00:00+05:30', window_end:'2026-08-08T00:00:00+05:30', source_id:sid});
    console.log([refuses(() => validateEvent(mk('metric.observed', m('h-0123456789abcdef')))),
                 refuses(() => validateEvent(mk('metric.observed', m('lead_hmac_v1_' + 'c'.repeat(32)))))].join(' '));"
  [[ "$output" == *"ACCEPTED ACCEPTED"* ]]
}

@test "metric observed rejects an experiment key" {
  run _node "$VIMPORT console.log(refuses(() => validateEvent(mk('metric.observed', {module:'leads', surface:'campaign', metric:'reply_rate', value:0.1, unit_count:25, window_start:'2026-08-01T00:00:00+05:30', window_end:'2026-08-08T00:00:00+05:30', source_id:'s1', trial_id:'t1'}))));"
  [[ "$output" == *"BAD_LEADS"* ]]
}

@test "metric observed variants in one window get different idems" {
  run _node "$VIMPORT
    const m = {module:'leads', surface:'campaign', metric:'reply_rate', value:0.1, unit_count:25,
      window_start:'2026-08-01T00:00:00+05:30', window_end:'2026-08-08T00:00:00+05:30', source_id:'s1'};
    const none = leadsIdem('metric.observed', m);
    const a = leadsIdem('metric.observed', {...m, variant:'a'});
    console.log(new Set([none, a]).size === 2 ? 'distinct' : 'COLLIDE');"
  [[ "$output" == *"distinct"* ]]
}

@test "this file registers the 16 tests it declares" {
  # BATS_TEST_NAMES is what bats REGISTERED. The previous version grepped `^@test ` in
  # this same file and compared it to a literal in this same file -- a tautology that
  # cannot see a test bats dropped, which is the only thing it was there to catch.
  declared=$(grep -c '^@test ' "$BATS_TEST_FILENAME")
  registered=${#BATS_TEST_NAMES[@]}
  [ "$declared" -eq 16 ] || { echo "declared $declared, expected 16"; false; }
  [ "$registered" -eq "$declared" ] || { echo "bats registered $registered of $declared declared tests -- one was DROPPED (non-ASCII name?)"; false; }
}
