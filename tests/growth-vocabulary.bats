#!/usr/bin/env bats
# Phase 00 -- `content.published`, growth's one receipt (ADR-1001). Vocabulary 44 -> 45.
#
# The idem is the whole point of this file. A first draft of ADR-1001 took the preimage over
# site|slug|content_sha alone, which READS like a total preimage and is not: a metadata-only
# correction (a wrong template_id fixed, body bytes untouched) hashes identically to the original
# and is refused as DUP_IDEM. That is the C2 loss class -- roughly 100 receipts quarantined by a
# partial preimage -- reproduced inside the rule written to prevent it. An adversarial pass caught
# it before any code existed, and the two tests that pin it are `a metadata-only correction is a
# NEW receipt` and `pr_ref is not identity`.
#
# ASCII-only test names; the file asserts the registered count at the bottom.
bats_require_minimum_version 1.5.0
load 'test_helper'

_node() { cd "$ARC_ROOT" && node --input-type=module -e "$1"; }

PRE='const { validateEvent, KINDS } = await import("./.claude/scripts/hq/lib/validate.mjs");
const { CONTENT_KINDS, contentIdem, isContentKind } = await import("./.claude/scripts/hq/lib/validate-content.mjs");
const SHA = "a".repeat(64), SHA2 = "b".repeat(64);
// Built WITHOUT contentIdem when the caller supplies an idem. contentIdem throws on any kind it
// does not own, so a fixture factory that always called it would kill an UNKNOWN_KIND test inside
// the builder -- and the test meant to prove the validator rejects an unknown kind would have been
// reading the scaffolding instead. Assert on the thing under test, never on the way you reached it.
const mk = (kind, payload, over = {}) => {
  const has = Object.prototype.hasOwnProperty.call(over, "idem");
  return { id:"01JQ8XZ9K0ABCDEFGH00000001", v:1, ts:"2026-08-13T10:00:00+05:30",
    idem: has ? over.idem : contentIdem(kind, payload), actor:"human:ashiq",
    process:"growth-fixture@1.0.0", model:null, venture:"arc", run_id:"r-t", kind, payload,
    outcome:"ok", cost:null, evidence:null, supersedes:null, ...over };
};
const OK = { site:"arc-site.example.com", slug:"receipts-driven-os",
  url:"https://arc-site.example.com/blog/receipts-driven-os", title:"Receipts driven OS",
  template_id:"title-a", cluster_id:"c-000", content_sha:SHA, pr_ref:"#12" };
const with_ = (over) => ({ ...OK, ...over });
const refuses = (fn) => { try { fn(); return "ACCEPTED"; } catch (e) { return e.code; } };'

@test "content.published is registered exactly once and the set stays unique" {
  run _node "$PRE
    const missing = CONTENT_KINDS.filter(k => !KINDS.includes(k));
    const once = CONTENT_KINDS.every(k => KINDS.filter(x => x === k).length === 1);
    console.log([CONTENT_KINDS.length, missing.length ? 'MISSING' : 'all-present',
      KINDS.length === new Set(KINDS).size ? 'unique' : 'DUPES', once ? 'once-each' : 'REPEATED'].join(' '));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "1 all-present unique once-each" ]
}

@test "the closed set still closes: a sibling content kind nobody declared is UNKNOWN_KIND" {
  # The negative control for criterion 1. If this ever ACCEPTS, the vocabulary stopped being closed
  # and every future typo lands on the spine as a real fact.
  run _node "$PRE
    const ev = mk('content.retracted', OK, { idem: SHA });
    console.log(refuses(() => validateEvent(ev)));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "UNKNOWN_KIND" ]
}

@test "the UNKNOWN_KIND message derives its count and never hand-types it" {
  # ADR-0107: a hand-written 18 went stale the moment the next kind landed.
  run _node "$PRE
    let msg = '';
    try { validateEvent(mk('content.retracted', OK, { idem: SHA })); } catch (e) { msg = e.message; }
    console.log(msg.includes(String(KINDS.length)) ? 'derived' : 'HARDCODED');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "derived" ]
}

@test "a valid content.published passes" {
  run _node "$PRE
    console.log(refuses(() => validateEvent(mk('content.published', OK))));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "ACCEPTED" ]
}

@test "an unknown payload key is refused, never ignored" {
  run _node "$PRE
    console.log(refuses(() => validateEvent(mk('content.published', { ...OK, campaign:'x' }))));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "BAD_CONTENT" ]
}

@test "each of the eight required keys is refused when omitted" {
  run _node "$PRE
    const keys = Object.keys(OK);
    const out = keys.map(k => { const p = { ...OK }; delete p[k];
      return refuses(() => validateEvent(mk('content.published', p, { idem: SHA }))); });
    const bad = out.filter(x => x !== 'BAD_CONTENT').length;
    console.log(keys.length + ' ' + (bad ? 'LEAKED' : 'all-refused'));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "8 all-refused" ]
}

@test "re-publishing identical bytes is idempotent" {
  run _node "$PRE
    console.log(contentIdem('content.published', OK) === contentIdem('content.published', with_({})) ? 'same' : 'DIFFERENT');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "same" ]
}

@test "changed content is a different receipt, so a correction can supersede rather than collide" {
  run _node "$PRE
    console.log(contentIdem('content.published', OK) !== contentIdem('content.published', with_({ content_sha: SHA2 })) ? 'different' : 'COLLIDED');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "different" ]
}

@test "a metadata-only correction is a NEW receipt and is never dropped as a duplicate" {
  # THE attack-panel finding. Under a site|slug|content_sha preimage every one of these four
  # corrections hashes identically to the original and vanishes as DUP_IDEM, with the body bytes
  # unchanged and nothing to show a correction was ever attempted.
  run _node "$PRE
    const base = contentIdem('content.published', OK);
    const moved = [
      with_({ template_id:'title-b' }),
      with_({ title:'Receipts driven OS, corrected' }),
      with_({ cluster_id:'c-001' }),
      with_({ site:'arc.example.com', url:'https://arc.example.com/blog/receipts-driven-os' }),
    ].map(p => contentIdem('content.published', p));
    const collided = moved.filter(h => h === base).length;
    console.log(moved.length + ' ' + (collided ? 'COLLIDED' : 'all-distinct'));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "4 all-distinct" ]
}

@test "pr_ref is not identity: two PRs publishing identical bytes are one publication" {
  # The other half of the rule, and the opposite error. outreach.replied records what happens when
  # a field stamping OUR process enters the preimage: one fact splits into two receipts on any
  # re-run, and the count that reads them is wrong in the other direction.
  run _node "$PRE
    console.log(contentIdem('content.published', OK) === contentIdem('content.published', with_({ pr_ref:'#99' })) ? 'same' : 'SPLIT');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "same" ]
}

@test "no field may forge the idem delimiter" {
  # site=a|b, slug=c and site=a, slug=b|c would hash identically under a bare join. The grammars
  # already exclude the delimiter; this asserts the preimage builder refuses it too, so a grammar
  # loosened later by someone who never read the module cannot silently make forgery possible.
  run _node "$PRE
    console.log(refuses(() => contentIdem('content.published', with_({ slug:'a|b' }))));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "BAD_CONTENT" ]
}

@test "a carriage return in a payload string is refused by code point, never stripped" {
  run _node "$PRE
    console.log(refuses(() => validateEvent(mk('content.published', with_({ title:'a\\r\\nb' }), { idem: SHA }))));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "BAD_CONTENT" ]
}

@test "a supplied idem that does not match the payload is refused" {
  # Anti-preclaim. Without this a decoy payload can claim a real article's stable key, and the real
  # receipt is then lost to DUP_IDEM -- so the provenance chain lies about which bytes were published.
  run _node "$PRE
    console.log(refuses(() => validateEvent(mk('content.published', OK, { idem: SHA }))));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "BAD_CONTENT" ]
}

@test "url and site must agree, and the url must be https" {
  run _node "$PRE
    const a = refuses(() => validateEvent(mk('content.published', with_({ url:'https://elsewhere.example.com/blog/receipts-driven-os' }), { idem: SHA })));
    const b = refuses(() => validateEvent(mk('content.published', with_({ url:'http://arc-site.example.com/blog/receipts-driven-os' }), { idem: SHA })));
    console.log(a + ' ' + b);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "BAD_CONTENT BAD_CONTENT" ]
}

@test "a url carrying a query string or fragment is refused" {
  # Not style. A query string is where a person-derived parameter would ride onto a public spine.
  run _node "$PRE
    const a = refuses(() => validateEvent(mk('content.published', with_({ url:'https://arc-site.example.com/blog/x?utm_source=mail' }), { idem: SHA })));
    const b = refuses(() => validateEvent(mk('content.published', with_({ url:'https://arc-site.example.com/blog/x#who' }), { idem: SHA })));
    console.log(a + ' ' + b);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "BAD_CONTENT BAD_CONTENT" ]
}

@test "isContentKind owns exactly its own kinds and claims nothing else" {
  run _node "$PRE
    const mine = CONTENT_KINDS.every(isContentKind);
    const others = ['decision.recorded','metric.observed','ship.done','note.logged'].some(isContentKind);
    console.log((mine ? 'owns-mine' : 'MISSES-MINE') + ' ' + (others ? 'CLAIMS-OTHERS' : 'claims-none'));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "owns-mine claims-none" ]
}

@test "the vocabulary is 45 kinds and the count is read from the array" {
  run _node "$PRE
    console.log(KINDS.length + ' ' + (KINDS.includes('content.published') ? 'has-content' : 'MISSING'));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "45 has-content" ]
}
