#!/usr/bin/env bats
# leads Phase 02 -- the ingestion contract, end to end (ADR-0405, ADR-0412, ADR-0414).
#
# The phase's expected-failure-first line lives here: an INTERESTED reply must produce its
# calendar draft in the SAME run as the ingestion that classified it. The test asserts the
# receipt was emitted BEFORE it asserts the draft count, so it cannot pass by the command
# having failed to run at all -- the vacuous pass this repo has shipped three times.
#
# The rest is idempotency (ADR-0414) and the boundary (ADR-0412): a reply ingested twice is
# one receipt and one draft; two different replies in one second are two receipts; and no
# emitted payload carries the address or a byte of the body.
#
# ASCII-only test names; the file asserts that bats REGISTERED what it declares.
bats_require_minimum_version 1.5.0
load 'test_helper'

_c() { cd "$ARC_ROOT" && ARC_LEADS_FAKE=1 node --input-type=module -e "$1"; }
_cli() { cd "$ARC_ROOT" && ARC_LEADS_FAKE=1 node .claude/scripts/leads/arc-leads.mjs "$@"; }

# The store dir is minted by NODE, not by `mktemp -d`. Git Bash hands out `/tmp/...`, which
# node on the Windows leg resolves to `C:\tmp\...` -- a different directory from the one the
# shell created. The two sides then disagree about where the store is, and the test passes or
# fails for reasons that have nothing to do with the code under test.
_tmpstore() { cd "$ARC_ROOT" && node -e 'const fs=require("node:fs"),os=require("node:os"),p=require("node:path");process.stdout.write(fs.mkdtempSync(p.join(os.tmpdir(),"cli")))'; }

CIMPORT='const I = await import("./.claude/scripts/leads/lib/ingest.mjs");
const {initStore, openStore, leadId} = await import("./.claude/scripts/leads/lib/store.mjs");
const {initCampaign, listDrafts, readDraft, listMeetingDrafts} = await import("./.claude/scripts/leads/lib/drafts.mjs");
const {guardSend, GuardRefusal} = await import("./.claude/scripts/leads/lib/guard.mjs");
const {validateEvent} = await import("./.claude/scripts/hq/lib/validate.mjs");
const {leadsIdem} = await import("./.claude/scripts/hq/lib/validate-leads.mjs");
const fs = await import("node:fs"), os = await import("node:os"), path = await import("node:path");

const NOW = "2026-08-05T11:00:00+05:30";
const CFG = {calendar_url: "https://cal.example.net/book"};
const EMAIL = "adv1@firm1.example.com";

function freshStore(email = EMAIL, campaign = "pilot") {
  process.env.ARC_LEADS_STORE = fs.mkdtempSync(path.join(os.tmpdir(), "rp"));
  initStore();
  const s = openStore();
  initCampaign(s, campaign, {createdAt: NOW});
  const id = leadId(s, email);
  fs.mkdirSync(path.join(s.dir, "dossiers"), {recursive: true});
  fs.writeFileSync(path.join(s.dir, "dossiers", id + ".json"),
    JSON.stringify({lead_id: id, email, campaign}));
  return {s, id};
}
// A recording emitter. Injected rather than imported, so nothing here touches the real spine.
function recorder() {
  const seen = [];
  return {seen, emit: async (kind, payload) => { seen.push({kind, payload}); }};
}
const fx = (n) => fs.readFileSync("tests/fixtures/leads/replies/" + n);
const hostile = (n) => fs.readFileSync("tests/fixtures/leads/replies-hostile/" + n);
const mail = (from, body) => Buffer.from("From: " + from + "\nSubject: Re: x\nContent-Type: text/plain\n\n" + body + "\n", "utf8");
const run1 = (s, bytes, over = {}) => { const r = recorder();
  return I.ingestReply({store: s, bytes, events: [], now: NOW, emit: r.emit, config: CFG, sourceLabel: "t", ...over})
    .then((out) => ({out, seen: r.seen})); };'

# ---------- the phase headline ----------

@test "an interested reply produces its calendar draft in the same run as the ingestion" {
  run _c "$CIMPORT const {s} = freshStore();
    const {out, seen} = await run1(s, fx(\"01-interested.eml\"));
    // ORDER MATTERS. Assert the receipt was emitted FIRST -- otherwise a run that never
    // executed reports zero drafts and this test passes for the wrong reason.
    const replied = seen.filter((e) => e.kind === \"outreach.replied\");
    const drafts = listMeetingDrafts(s);
    console.log([replied.length, out.triage_class, drafts.length, out.meeting_created].join(\" \"));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"1 interested 1 true"* ]]
}

@test "the calendar draft carries the configured link and an inbox item on its own gate" {
  run _c "$CIMPORT const {s} = freshStore();
    const {seen} = await run1(s, fx(\"01-interested.eml\"));
    const appr = seen.filter((e) => e.kind === \"approval.requested\");
    const d = listMeetingDrafts(s)[0];
    console.log([appr.length, appr[0].payload.gate, d.body.indexOf(\"cal.example.net\") !== -1].join(\" \"));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"1 leads-meeting true"* ]]
}

@test "a meeting draft is not reachable from the send path" {
  run _c "$CIMPORT const {s} = freshStore();
    await run1(s, fx(\"01-interested.eml\"));
    const ref = listMeetingDrafts(s)[0].meeting_ref;
    let refused = \"ACCEPTED\";
    try { readDraft(s, ref); } catch (e) { refused = e.code; }
    console.log([listDrafts(s).length, refused].join(\" \"));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # Zero outreach drafts, and the send path refuses the meeting ref outright.
  [[ "$output" == *"0 BAD_REF"* ]]
}

# ---------- idempotency (ADR-0414) ----------

@test "the same reply ingested twice yields exactly one draft and one inbox item" {
  run _c "$CIMPORT const {s} = freshStore();
    const a = await run1(s, fx(\"01-interested.eml\"));
    const b = await run1(s, fx(\"01-interested.eml\"));
    const appr = a.seen.concat(b.seen).filter((e) => e.kind === \"approval.requested\");
    console.log([listMeetingDrafts(s).length, appr.length, a.out.meeting_created, b.out.meeting_created, b.out.fresh].join(\" \"));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"1 1 true false false"* ]]
}

@test "the same reply ingested at a different second keeps the same receipt idem" {
  run _c "$CIMPORT const {s} = freshStore();
    const a = await run1(s, fx(\"01-interested.eml\"));
    const b = await run1(s, fx(\"01-interested.eml\"), {now: \"2026-08-05T14:22:09+05:30\"});
    const pa = a.seen.find((e) => e.kind === \"outreach.replied\").payload;
    const pb = b.seen.find((e) => e.kind === \"outreach.replied\").payload;
    console.log([leadsIdem(\"outreach.replied\", pa) === leadsIdem(\"outreach.replied\", pb),
                 pa.ingested_at !== pb.ingested_at].join(\" \"));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # Same identity despite a different arrival time -- that is the whole of ADR-0414.
  [[ "$output" == *"true true"* ]]
}

@test "two different replies from one lead in one second are two distinct receipts" {
  run _c "$CIMPORT const {s} = freshStore();
    const a = await run1(s, mail(\"Adv 1 <\" + EMAIL + \">\", \"Not interested, thanks.\"));
    const b = await run1(s, mail(\"Adv 1 <\" + EMAIL + \">\", \"Actually please remove me from this list.\"));
    const pa = a.seen.find((e) => e.kind === \"outreach.replied\").payload;
    const pb = b.seen.find((e) => e.kind === \"outreach.replied\").payload;
    console.log([pa.triage_class, pb.triage_class, pa.ingested_at === pb.ingested_at,
                 leadsIdem(\"outreach.replied\", pa) !== leadsIdem(\"outreach.replied\", pb)].join(\" \"));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # Same lead, same campaign, same second -- and the unsubscribe is NOT dropped as a duplicate.
  [[ "$output" == *"no unsubscribe true true"* ]]
}

# ---------- consequences, same run ----------

@test "an unsubscribe in a reply suppresses the lead in the same run" {
  run _c "$CIMPORT const {s} = freshStore(\"adv2@firm2.example.com\");
    const {out, seen} = await run1(s, fx(\"02-unsubscribe.eml\"));
    const sup = seen.filter((e) => e.kind === \"lead.suppressed\");
    console.log([out.triage_class, sup.length, sup[0] ? sup[0].payload.reason : \"none\"].join(\" \"));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"unsubscribe 1 unsubscribe"* ]]
}

@test "a bounce suppresses the FAILED recipient, not the mail system" {
  run _c "$CIMPORT const {s, id} = freshStore(\"adv4@firm4.example.com\");
    const {out, seen} = await run1(s, fx(\"04-bounce-dsn.eml\"));
    const sup = seen.find((e) => e.kind === \"lead.suppressed\");
    console.log([out.triage_class, sup.payload.reason, sup.payload.lead_id === id].join(\" \"));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"bounce bounce true"* ]]
}

@test "an interested reply with no calendar link refuses loudly AFTER writing the receipt" {
  run _c "$CIMPORT const {s} = freshStore();
    const r = recorder();
    let step = \"NONE\";
    try { await I.ingestReply({store: s, bytes: fx(\"01-interested.eml\"), events: [], now: NOW, emit: r.emit, config: {}, sourceLabel: \"t\"}); }
    catch (e) { step = e.step; }
    console.log([step, r.seen.filter((e) => e.kind === \"outreach.replied\").length, listMeetingDrafts(s).length].join(\" \"));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # The sequence is already stopped by the receipt; only the draft is missing, and loudly.
  [[ "$output" == *"no-calendar 1 0"* ]]
}

# ---------- auto stop, wired to the pre send check ----------

@test "after a reply is ingested the next send is refused at reply stop" {
  run _c "$CIMPORT const {s, id} = freshStore();
    const {seen} = await run1(s, fx(\"01-interested.eml\"));
    const events = seen.map((e, i) => ({id: \"E\" + i, kind: e.kind, payload: e.payload}));
    const SHA = \"c\".repeat(64);
    let step = \"ALLOWED\";
    try { guardSend({events, store: s, now: NOW, draft: {campaign: \"pilot\", lead_id: id, touch_n: 2, draft_sha: SHA, approved_sha: SHA}}); }
    catch (e) { step = e instanceof GuardRefusal ? e.step : \"ERR:\" + e.message; }
    console.log(step);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"reply-stop"* ]]
}

@test "after an unsubscribe is ingested the next send is refused at suppression" {
  run _c "$CIMPORT const {s, id} = freshStore(\"adv2@firm2.example.com\");
    const {seen} = await run1(s, fx(\"02-unsubscribe.eml\"));
    const events = seen.filter((e) => e.kind === \"lead.suppressed\").map((e, i) => ({id: \"S\" + i, kind: e.kind, payload: e.payload}));
    const SHA = \"c\".repeat(64);
    let step = \"ALLOWED\";
    try { guardSend({events, store: s, now: NOW, draft: {campaign: \"pilot\", lead_id: id, touch_n: 1, draft_sha: SHA, approved_sha: SHA}}); }
    catch (e) { step = e instanceof GuardRefusal ? e.step : \"ERR:\" + e.message; }
    console.log(step);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"suppression"* ]]
}

# ---------- the two plane boundary (ADR-0412) ----------

@test "no emitted payload carries the address or a byte of the reply body" {
  run _c "$CIMPORT const {s} = freshStore();
    const marker = \"ZZBODYMARKERZZ\";
    const {seen} = await run1(s, mail(\"Adv 1 <\" + EMAIL + \">\", marker + \" sounds good, send a link.\"));
    const blob = JSON.stringify(seen);
    console.log([seen.length, blob.indexOf(marker) === -1, blob.indexOf(EMAIL) === -1].join(\" \"));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"2 true true"* ]]
}

@test "the reply body and address DO land in the private store" {
  run _c "$CIMPORT const {s} = freshStore();
    const {out} = await run1(s, fx(\"01-interested.eml\"));
    const rec = JSON.parse(fs.readFileSync(path.join(s.dir, \"replies\", out.reply_ref + \".json\"), \"utf8\"));
    console.log([rec.address === EMAIL, rec.body_text.length > 0, rec.reply_ref === out.reply_ref].join(\" \"));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"true true true"* ]]
}

@test "every emitted receipt validates against the spine validator" {
  run _c "$CIMPORT const {s} = freshStore(\"adv2@firm2.example.com\");
    const {seen} = await run1(s, fx(\"02-unsubscribe.eml\"));
    const mk = (e) => ({id: \"01J000000000000000000000AB\", v: 1, ts: \"2026-08-05T11:00:00+05:30\",
      idem: leadsIdem(e.kind, e.payload), actor: \"arc-leads\", process: \"leads@1.0.0\", model: null,
      venture: \"arc\", run_id: \"r-t\", kind: e.kind, payload: e.payload, outcome: \"ok\",
      cost: null, evidence: null, supersedes: null});
    const bad = seen.filter((e) => e.kind !== \"approval.requested\")
      .map((e) => { try { validateEvent(mk(e)); return null; } catch (err) { return e.kind + \":\" + err.code; } })
      .filter(Boolean);
    console.log(seen.length + \" emitted, \" + (bad.length ? bad.join(\",\") : \"all-valid\"));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"2 emitted, all-valid"* ]]
}

@test "a receipt whose reply ref is not the pinned shape is refused" {
  run _c "$CIMPORT const p = {lead_id: \"lead_hmac_v1_\" + \"a\".repeat(32), campaign: \"pilot\",
      triage_class: \"no\", ingested_at: NOW, reply_ref: \"reply_short\"};
    const mk = () => ({id: \"01J000000000000000000000AB\", v: 1, ts: \"2026-08-05T11:00:00+05:30\",
      idem: leadsIdem(\"outreach.replied\", p), actor: \"arc-leads\", process: \"leads@1.0.0\", model: null,
      venture: \"arc\", run_id: \"r-t\", kind: \"outreach.replied\", payload: p, outcome: \"ok\",
      cost: null, evidence: null, supersedes: null});
    try { validateEvent(mk()); console.log(\"ACCEPTED\"); } catch (e) { console.log(e.code); }"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"BAD_LEADS"* ]]
}

@test "in reply to touch is derived from receipts, never from a reply header" {
  run _c "$CIMPORT const {s, id} = freshStore();
    const sent = (n) => ({kind: \"outreach.sent\", payload: {lead_id: id, campaign: \"pilot\", touch_n: n,
      submitted_at: NOW, idem_key: \"k\" + n, provider_message_id: \"m\" + n, draft_sha: \"c\".repeat(64)}});
    const {seen} = await run1(s, fx(\"01-interested.eml\"), {events: [sent(1), sent(2)]});
    console.log(seen.find((e) => e.kind === \"outreach.replied\").payload.in_reply_to_touch);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"2"* ]]
}

# ---------- refusals ----------

@test "a reply from an address with no dossier is refused without printing the address" {
  run _c "$CIMPORT const {s} = freshStore();
    const r = recorder();
    let step = \"NONE\", msg = \"\";
    try { await I.ingestReply({store: s, bytes: hostile(\"unknown-lead.eml\"), events: [], now: NOW, emit: r.emit, config: CFG, sourceLabel: \"t\"}); }
    catch (e) { step = e.step; msg = e.message; }
    console.log([step, r.seen.length, msg.indexOf(\"nobody@unresearched.example.org\") === -1].join(\" \"));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"unknown-lead 0 true"* ]]
}

@test "a lead researched under an older key is still identified after a rotation" {
  run _c "$CIMPORT const {rotateSecret} = await import(\"./.claude/scripts/leads/lib/store.mjs\");
    const {s} = freshStore();
    rotateSecret();
    const s2 = openStore();
    const {out} = await run1(s2, fx(\"01-interested.eml\"));
    // The dossier was written under v1; the current key is v2. A single version lookup would
    // fail to identify the reply, and failing to identify a reply is failing to stop the
    // sequence -- the same person gets touch 2 after they answered.
    console.log([out.triage_class, /_v1_/.test(out.lead_id)].join(\" \"));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"interested true"* ]]
}

# The whole command, against a REAL spine in a temp root. Everything above this line injects a
# recording emitter, which is what let a real bug through: the receipt layer was idempotent and
# the COMMAND was not. A re-ingest hit DUP_IDEM from the emitter, that refusal was an exception
# to its caller, and the ordinary "did that run finish?" re-run crashed on its second line
# without ever reaching the calendar draft. Only an end-to-end run can see that.
_sandbox() {
  cd "$ARC_ROOT" && ARC_LEADS_FAKE=1 node --input-type=module -e '
    const fs = await import("node:fs"), os = await import("node:os"), path = await import("node:path");
    const {initStore, openStore, leadId} = await import("./.claude/scripts/leads/lib/store.mjs");
    const {initCampaign} = await import("./.claude/scripts/leads/lib/drafts.mjs");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "e2e"));
    process.env.ARC_LEADS_STORE = dir;
    initStore();
    const s = openStore();
    initCampaign(s, "pilot", {createdAt: "2026-08-05T11:00:00+05:30"});
    const id = leadId(s, "adv1@firm1.example.com");
    fs.mkdirSync(path.join(s.dir, "dossiers"), {recursive: true});
    fs.writeFileSync(path.join(s.dir, "dossiers", id + ".json"),
      JSON.stringify({lead_id: id, email: "adv1@firm1.example.com", campaign: "pilot"}));
    const cfg = path.join(dir, "leads.json");
    fs.writeFileSync(cfg, JSON.stringify({sending_domain: "", product_domains: [], calendar_url: "https://cal.example.net/book",
      caps: {per_ist_day: 20, touches_per_lead: 2, rolling_window_days: 7, send_window_ist: {days: [1,2,3,4,5], start: "09:30", end: "18:00"}}}));
    // A SEPARATE temp tree, so no test writes a receipt into the real repo ledger.
    // ARC_SPINE_ROOT is used VERBATIM as the spine root -- the .claude/ and .git/ markers are
    // only consulted on the walk-up branch, which this never reaches. Receipts land in
    // <root>/events/<day>.jsonl.
    const spine = fs.mkdtempSync(path.join(os.tmpdir(), "spn"));
    fs.copyFileSync("tests/fixtures/leads/replies/01-interested.eml", path.join(dir, "reply.eml"));
    process.stdout.write(dir + "|" + cfg + "|" + spine);'
}

@test "the whole command is idempotent: three runs, one receipt, one draft" {
  local box; box="$(_sandbox)"
  export ARC_LEADS_STORE="${box%%|*}"
  export LEADS_CONFIG="$(echo "$box" | cut -d'|' -f2)"
  export ARC_SPINE_ROOT="$(echo "$box" | cut -d'|' -f3)"
  # Assert the sandbox is REAL before asserting anything about a run inside it. An empty
  # box would make every count below zero and this test would pass on nothing at all.
  [ -n "$ARC_LEADS_STORE" ] && [ -f "$ARC_LEADS_STORE/reply.eml" ] || { echo "sandbox not built: $box"; false; }

  run _cli ingest-reply --file "$ARC_LEADS_STORE/reply.eml"
  [ "$status" -eq 0 ] || { echo "first run: $output"; false; }
  [[ "$output" == *"INTERESTED"* ]]
  [[ "$output" == *"meeting draft meet_"* ]]

  run _cli ingest-reply --file "$ARC_LEADS_STORE/reply.eml"
  [ "$status" -eq 0 ] || { echo "second run: $output"; false; }
  [[ "$output" == *"already ingested"* ]]
  [[ "$output" == *"receipt already on the spine"* ]]

  run _cli ingest-reply --file "$ARC_LEADS_STORE/reply.eml"
  [ "$status" -eq 0 ] || { echo "third run: $output"; false; }

  local meetings receipts
  meetings=$(ls "$ARC_LEADS_STORE/meetings" | wc -l | tr -d ' ')
  # `$ARC_SPINE_ROOT/events/`, NOT `$ARC_SPINE_ROOT/.claude/state/hq/events/`: spine-io.mjs
  # returns ARC_SPINE_ROOT verbatim and only appends `.claude/state/hq` on its walk-up branch.
  # The wrong path made `cat` fail, `|| true` swallowed it, `grep -c` printed 0, and the
  # assertion was measuring nothing. tests/leads-provider-contract.bats already had it right
  # one phase earlier -- grep the pattern, not the file.
  receipts=$(cat "$ARC_SPINE_ROOT"/events/*.jsonl | grep -c 'outreach.replied' || true)
  [ "$meetings" -eq 1 ] || { echo "meetings=$meetings, want 1"; false; }
  [ "$receipts" -eq 1 ] || { echo "outreach.replied receipts=$receipts, want 1"; false; }
}

# A batch that halts on one bad reply never ingests the ones behind it, and the one most
# likely to be behind it is the unsubscribe. The `--inbound` fake reads the whole shipped
# corpus, which includes a lead with no dossier in this store.
@test "a batch keeps going past a refusal and still exits non zero" {
  local box; box="$(_sandbox)"
  export ARC_LEADS_STORE="${box%%|*}"
  export LEADS_CONFIG="$(echo "$box" | cut -d'|' -f2)"
  export ARC_SPINE_ROOT="$(echo "$box" | cut -d'|' -f3)"
  [ -n "$ARC_LEADS_STORE" ] && [ -f "$ARC_LEADS_STORE/reply.eml" ] || { echo "sandbox not built: $box"; false; }

  # Only adv1 has a dossier here, so the other corpus replies refuse as unknown leads.
  run _cli ingest-reply --inbound
  [ "$status" -eq 3 ]
  # The run reached the END despite refusals -- the summary line only prints after the loop.
  [[ "$output" == *"ingested,"* ]]
  [[ "$output" == *"refused"* ]]
  # And the one reply it COULD place was actually placed, rather than the whole batch dying.
  [[ "$output" == *"INTERESTED"* ]]
  [ "$(ls "$ARC_LEADS_STORE/meetings" | wc -l | tr -d ' ')" -eq 1 ]
}

@test "the CLI refuses a file path that resolves inside the repository" {
  export ARC_LEADS_STORE="$(_tmpstore)"
  _cli store init >/dev/null
  run _cli ingest-reply --file tests/fixtures/leads/replies/01-interested.eml
  [ "$status" -eq 3 ]
  [[ "$output" == *"inside the repository"* ]]
}

@test "the CLI refuses reply content pasted as an argument and points at --file" {
  export ARC_LEADS_STORE="$(_tmpstore)"
  _cli store init >/dev/null
  run _cli ingest-reply "From: a <adv1@firm1.example.com>"
  [ "$status" -eq 2 ]
  [[ "$output" == *"--file"* ]]
  [[ "$output" == *"argv"* ]]
}

@test "the CLI refuses more than one input source" {
  export ARC_LEADS_STORE="$(_tmpstore)"
  _cli store init >/dev/null
  run _cli ingest-reply --stdin --inbound
  [ "$status" -eq 2 ]
  [[ "$output" == *"exactly one source"* ]]
}


# ---------- found by the two Phase-02 adversarial passes ----------

# The dedup key was the REPLY, so a lead who answers "sounds good, send a link" and then, an
# hour later, "great, what times work?" is ONE person wanting ONE meeting -- and got two
# byte-identical drafts and two approval items. drafts.mjs says in as many words that two
# approvals for one thing is how the wrong one gets approved.
@test "two interested replies from one lead produce one meeting draft" {
  run _c "$CIMPORT const {s} = freshStore();
    const a = await run1(s, mail(\"Adv 1 <\" + EMAIL + \">\", \"Sounds good, send a link.\"));
    const b = await run1(s, mail(\"Adv 1 <\" + EMAIL + \">\", \"Great - what times work for you?\"));
    const appr = a.seen.concat(b.seen).filter((e) => e.kind === \"approval.requested\");
    console.log([listMeetingDrafts(s).length, appr.length, a.out.meeting_ref === b.out.meeting_ref].join(\" \"));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"1 1 true"* ]]
}

# Every unit call site passed `events: []`, so the spine-side dedup never ran in any of them --
# and the e2e test could not see it either, because the CLI swallows the emitter DUP_IDEM. Only
# a fold that actually CONTAINS the idem exercises the check.
@test "an emit whose idem is already on the spine is skipped, not re-sent" {
  run _c "$CIMPORT const {s} = freshStore();
    const first = await run1(s, fx(\"01-interested.eml\"));
    // Feed the first run back in as a real fold, idem and all.
    const asEvents = first.seen.filter((e) => e.kind !== \"approval.requested\")
      .map((e, i) => ({id: \"E\" + i, kind: e.kind, payload: e.payload, idem: leadsIdem(e.kind, e.payload)}));
    const second = await run1(s, fx(\"01-interested.eml\"), {events: asEvents});
    console.log([first.seen.filter((e) => e.kind === \"outreach.replied\").length,
                 second.seen.filter((e) => e.kind === \"outreach.replied\").length,
                 second.out.receipt_duplicate].join(\" \"));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # Emitted once, skipped the second time, and the caller is TOLD it was a duplicate.
  [[ "$output" == *"1 0 true"* ]]
}

# ingest.mjs documents a crash window between the receipt and its consequences. Land in it on
# a bounce and, before this, a confirmed-dead address stayed sendable while the campaign
# counted the bounce against itself -- `unsubscribe` self-suppressed from the reply receipt and
# `bounce` did not, in adjacent lines.
@test "a bounce receipt alone suppresses the lead, exactly as an unsubscribe does" {
  run _c "$CIMPORT const {deriveState} = await import(\"./.claude/scripts/leads/lib/guard.mjs\");
    const ID = \"lead_hmac_v1_\" + \"a\".repeat(32);
    const st = (cls) => deriveState([{kind: \"outreach.replied\", payload: {lead_id: ID, campaign: \"pilot\", triage_class: cls, ingested_at: NOW, reply_ref: \"reply_\" + \"b\".repeat(32)}}], {campaign: \"pilot\"});
    console.log([st(\"unsubscribe\").suppressed.size, st(\"bounce\").suppressed.size, st(\"no\").suppressed.size].join(\" \"));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # Both terminal classes suppress; a plain `no` does not.
  [[ "$output" == *"1 1 0"* ]]
}

# The campaign binding compared only the CURRENT key, so the first rotation bricked the send
# path of every existing campaign permanently -- nothing in the repo rewrites a campaign record.
# Meanwhile the ingest path carried on accepting: two derivations of one question, disagreeing.
@test "a key rotation does not brick an existing campaign binding" {
  run _c "$CIMPORT const {rotateSecret} = await import(\"./.claude/scripts/leads/lib/store.mjs\");
    const {assertCampaignStore} = await import(\"./.claude/scripts/leads/lib/drafts.mjs\");
    const {s} = freshStore();
    rotateSecret();
    const s2 = openStore();
    let send = \"OK\";
    try { assertCampaignStore(s2, \"pilot\"); } catch (e) { send = e.code; }
    const ingest = await run1(s2, fx(\"01-interested.eml\"));
    console.log(send + \" \" + ingest.out.triage_class);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"OK interested"* ]]
}

# Suppression was keyring-wide and reply-stop was not, in adjacent lines. So after a rotation a
# `no` or `later` reply did not stop the sequence: the receipt carries the v1 id and a fresh
# draft carries v2. Only unsubscribe and bounce were protected, and only because they land in
# the keyring-wide suppression set.
@test "reply stop survives a key rotation" {
  run _c "$CIMPORT const {rotateSecret} = await import(\"./.claude/scripts/leads/lib/store.mjs\");
    const {s, id} = freshStore();
    const {seen} = await run1(s, mail(\"Adv 1 <\" + EMAIL + \">\", \"Thanks, but not interested.\"));
    rotateSecret();
    const s2 = openStore();
    const v2 = leadId(s2, EMAIL);
    // The dossier the guard resolves from must exist under the new key too, as a re-research
    // would write it.
    fs.writeFileSync(path.join(s2.dir, \"dossiers\", v2 + \".json\"), JSON.stringify({lead_id: v2, email: EMAIL, campaign: \"pilot\"}));
    const events = seen.map((e, i) => ({id: \"E\" + i, kind: e.kind, payload: e.payload}));
    const SHA = \"c\".repeat(64);
    let step = \"ALLOWED\";
    try { guardSend({events, store: s2, now: NOW, draft: {campaign: \"pilot\", lead_id: v2, touch_n: 2, draft_sha: SHA, approved_sha: SHA}}); }
    catch (e) { step = e instanceof GuardRefusal ? e.step : \"ERR:\" + e.message; }
    console.log([id !== v2, step].join(\" \"));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # Different ids for one human, and the sequence still stops.
  [[ "$output" == *"true reply-stop"* ]]
}

# `--file` read the whole file and refused afterwards, so a 200 MiB file was fully resident
# before the 1 MiB limit fired. replies.mjs claims "limits before work" as an invariant; both
# doors into it broke it.
@test "an oversized reply file is refused before it is read" {
  run _c "$CIMPORT const I2 = await import(\"./.claude/scripts/leads/lib/ingest.mjs\");
    const {MAX_REPLY_BYTES} = await import(\"./.claude/scripts/leads/lib/replies.mjs\");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), \"big\"));
    const big = path.join(dir, \"big.eml\");
    fs.writeFileSync(big, Buffer.alloc(MAX_REPLY_BYTES + 1024, 97));
    const before = process.memoryUsage().rss;
    let step = \"ACCEPTED\";
    try { I2.readReplyFile(\"$ARC_ROOT\", big); } catch (e) { step = e.step; }
    const grewMiB = Math.round((process.memoryUsage().rss - before) / 1048576);
    console.log(step + \" grew=\" + (grewMiB < 1 ? \"under-1MiB\" : grewMiB + \"MiB\"));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"path grew=under-1MiB"* ]]
}

# `--stdin` had NO happy-path test at all -- only the mutual-exclusion refusal -- so readStdin
# was entirely unexercised. And with no pipe attached the command hung forever, which under a
# same-day SLA is the worst failure mode there is.
@test "the stdin door ingests a piped reply and refuses a terminal" {
  local box; box="$(_sandbox)"
  export ARC_LEADS_STORE="${box%%|*}"
  export LEADS_CONFIG="$(echo "$box" | cut -d'|' -f2)"
  export ARC_SPINE_ROOT="$(echo "$box" | cut -d'|' -f3)"
  [ -f "$ARC_LEADS_STORE/reply.eml" ] || { echo "sandbox not built: $box"; false; }

  run bash -c "cd '$ARC_ROOT' && ARC_LEADS_FAKE=1 node .claude/scripts/leads/arc-leads.mjs ingest-reply --stdin < '$ARC_LEADS_STORE/reply.eml'"
  [ "$status" -eq 0 ] || { echo "stdin run: $output"; false; }
  [[ "$output" == *"INTERESTED"* ]]
  [ "$(ls "$ARC_LEADS_STORE/meetings" | wc -l | tr -d ' ')" -eq 1 ]

  # An empty pipe is a refusal, not a hang, and not a silent success.
  run bash -c "cd '$ARC_ROOT' && ARC_LEADS_FAKE=1 node .claude/scripts/leads/arc-leads.mjs ingest-reply --stdin < /dev/null"
  [ "$status" -eq 3 ]
  [[ "$output" == *"EMPTY_INPUT"* ]]
}

# `wx` keeps the store record immutable while the idem includes triage_class, so re-ingesting
# the same bytes under a parser that returns a DIFFERENT class would leave the store holding one
# class and the spine holding a receipt for the other. On a bounce reclassification that is
# bounces 1 -> 2, i.e. FROZEN. Refused, and the refusal names both classes.
@test "re-ingesting a reply under a different class is refused rather than half applied" {
  run _c "$CIMPORT const {s} = freshStore();
    const bytes = mail(\"Adv 1 <\" + EMAIL + \">\", \"Thanks, but not interested.\");
    const first = await run1(s, bytes);
    // Rewrite the stored class, as an improved parser would have produced.
    const p = path.join(s.dir, \"replies\", first.out.reply_ref + \".json\");
    const recd = JSON.parse(fs.readFileSync(p, \"utf8\"));
    fs.writeFileSync(p, JSON.stringify({...recd, triage_class: \"bounce\"}));
    const r = recorder();
    let step = \"ACCEPTED\";
    try { await I.ingestReply({store: s, bytes, events: [], now: NOW, emit: r.emit, config: CFG, sourceLabel: \"t\"}); }
    catch (e) { step = e.step; }
    console.log([first.out.triage_class, step, r.seen.length].join(\" \"));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # Nothing is emitted on the refusing run -- the divergence is caught before the receipt.
  [[ "$output" == *"no reclassified 0"* ]]
}

# The negative control: the SAME bytes with the same class must still be a boring no-op, or the
# refusal above would have broken idempotency, which is the whole of ADR-0414.
@test "re-ingesting a reply under the same class is still a no op" {
  run _c "$CIMPORT const {s} = freshStore();
    const bytes = mail(\"Adv 1 <\" + EMAIL + \">\", \"Thanks, but not interested.\");
    await run1(s, bytes);
    const again = await run1(s, bytes);
    console.log([again.out.triage_class, again.out.fresh].join(\" \"));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"no false"* ]]
}

@test "this file registers the 33 tests it declares" {
  declared=$(grep -c '^@test ' "$BATS_TEST_FILENAME")
  registered=${#BATS_TEST_NAMES[@]}
  [ "$declared" -eq 33 ] || { echo "declared $declared, expected 33"; false; }
  [ "$registered" -eq "$declared" ] || { echo "bats registered $registered of $declared declared tests -- one was DROPPED (non-ASCII name?)"; false; }
}
