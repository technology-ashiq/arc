#!/usr/bin/env bats
# leads Phase 00 -- the provider contract, the store, and the state fold.
#
# THE test in this file is "the real provider module reaches its own code". A prior cycle
# shipped three drivers that all satisfied "the same contract" while none of their real code
# ever executed, because the fake returned before the real function was reached -- a green
# suite proving only that the test never got there. So one test here runs with ARC_LEADS_FAKE
# UNSET, points the real module at an unreachable endpoint, and asserts it exits with its OWN
# failure code rather than a module-not-found or a fake's success.
#
# The state fold is asserted for determinism, order-independence and fold-completeness rather
# than "wipe derived state and replay". There IS no derived state -- REQ-03 forbids a cache --
# so a wipe-and-replay test would delete nothing and assert nothing.
bats_require_minimum_version 1.5.0
load 'test_helper'

_fake() { cd "$ARC_ROOT" && ARC_LEADS_FAKE=1 LEADS_FIXTURE_DIR="$ARC_ROOT/tests/fixtures/leads" node --input-type=module -e "$1"; }

setup() {
  export ARC_LEADS_STORE="$BATS_TEST_TMPDIR/store"
  export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine"
}

_cli() { cd "$ARC_ROOT" && ARC_LEADS_FAKE=1 run node .claude/scripts/leads/arc-leads.mjs "$@"; }

# ---------- the code-path test ----------

# The negative control, and it now has to be given the config the bound provider requires --
# a key, a sender, and a RESOLVED recipient -- or it stops at the first config refusal and
# never reaches the socket. Reaching `transport` is the whole assertion: it proves the real
# module ran its own code rather than the fake being silently substituted.
# The key is a placeholder that never leaves the process: 127.0.0.1:1 refuses the connection
# before any bytes are written.
@test "the real provider module reaches its own code and exits with its own failure code" {
  cd "$ARC_ROOT"
  run env -u ARC_LEADS_FAKE LEADS_PROVIDER_BASE_URL="https://127.0.0.1:1" \
      RESEND_API_KEY="placeholder-not-a-key" ARC_LEADS_OUTREACH_FROM="arc@example.test" \
      node --input-type=module -e '
    const {provider, ProviderError} = await import("./.claude/scripts/leads/lib/deps.mjs");
    try { await provider().submit({idem_key:"k", to:"one@example.test", subject:"s", body:"b", headers:{}}); console.log("UNEXPECTED-SUCCESS"); }
    catch (e) { console.log(e instanceof ProviderError ? "ProviderError:" + e.kind : "WRONG-ERROR:" + e.constructor.name); }'
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"ProviderError:transport"* ]]
}

# Replaces "refuses when no base URL is bound": the base URL now DEFAULTS to Resend, so that
# assertion would pass for the wrong reason forever. The credential is the binding now, and
# each refusal is asserted by NAME so a test cannot pass on whichever config check happens to
# fire first.
@test "the real provider refuses, by name, for each piece of binding it is missing" {
  cd "$ARC_ROOT"
  run env -u ARC_LEADS_FAKE -u RESEND_API_KEY -u ARC_LEADS_OUTREACH_FROM node --input-type=module -e '
    const {provider} = await import("./.claude/scripts/leads/lib/deps.mjs");
    const say = async (env, label) => { Object.assign(process.env, env);
      try { await provider().submit({idem_key:"k", to:"one@example.test", subject:"s", body:"b"}); console.log(label + "=UNEXPECTED-SUCCESS"); }
      catch (e) { console.log(label + "=" + e.kind + ":" + (e.message.match(/^[A-Z_]+/) || [e.message.slice(0,24)])[0]); } };
    await say({}, "nokey");
    await say({RESEND_API_KEY: "placeholder-not-a-key"}, "nofrom");'
  [[ "$output" == *"nokey=config:RESEND_API_KEY"* ]]
  [[ "$output" == *"nofrom=config:ARC_LEADS_OUTREACH_FROM"* ]]
}

# sendOne passes the keyed lead id (ADR-0400), not an address. Handing that to the vendor
# would surface as a 400 that reads like a transport problem, so it is refused before any
# network call -- resolving the id against the private store, and the rehearsal allowlist
# refusal that belongs with it, are slice 04.
@test "the real provider refuses a recipient that is a lead id rather than an address" {
  cd "$ARC_ROOT"
  run env -u ARC_LEADS_FAKE RESEND_API_KEY="placeholder-not-a-key" \
      ARC_LEADS_OUTREACH_FROM="arc@example.test" LEADS_PROVIDER_BASE_URL="https://127.0.0.1:1" \
      node --input-type=module -e '
    const {provider} = await import("./.claude/scripts/leads/lib/deps.mjs");
    for (const to of ["lead_9f3a2b", "", null, "@example.test", "example.test@"]) {
      try { await provider().submit({idem_key:"k", to, subject:"s", body:"b"}); console.log("UNEXPECTED-SUCCESS"); }
      catch (e) { console.log(e.kind + (e.message.includes("not an address") ? ":not-an-address" : ":other")); } }'
  [[ "$output" != *"UNEXPECTED-SUCCESS"* ]]
  [[ "$output" != *":other"* ]]
}

# Resend names its ack field `id`; this repo's canonical field is provider_message_id. The
# mapping is a parameter on the ONE decoder rather than a second decoder, so the status-code
# rule has a single definition -- a drifted copy of it would be D5 in the function whose only
# job is deciding what counts as an ack.
@test "the Resend ack field is mapped to the canonical provider_message_id" {
  cd "$ARC_ROOT"
  run env -u ARC_LEADS_FAKE node --input-type=module -e '
    const {decodeProviderResponse} = await import("./.claude/scripts/leads/lib/deps.mjs");
    console.log("mapped=" + decodeProviderResponse(200, JSON.stringify({id: "re_abc123"}), "id").provider_message_id);
    try { decodeProviderResponse(200, JSON.stringify({id: "re_abc123"})); console.log("UNMAPPED-ACCEPTED"); }
    catch (e) { console.log("unmapped=" + e.kind); }
    try { decodeProviderResponse(500, JSON.stringify({id: "re_abc123"}), "id"); console.log("5XX-ACCEPTED"); }
    catch (e) { console.log("5xx=" + e.kind); }'
  [[ "$output" == *"mapped=re_abc123"* ]]
  [[ "$output" == *"unmapped=refused"* ]]
  [[ "$output" == *"5xx=transport"* ]]
}

# Returning [] would read as "nobody is suppressed" -- the fail-open this repo refuses.
@test "the suppression list refuses rather than returning an empty list" {
  cd "$ARC_ROOT"
  run env -u ARC_LEADS_FAKE RESEND_API_KEY="placeholder-not-a-key" node --input-type=module -e '
    const {provider} = await import("./.claude/scripts/leads/lib/deps.mjs");
    try { const r = await provider().suppressionList(); console.log("RETURNED:" + JSON.stringify(r)); }
    catch (e) { console.log(e.kind + ":" + (e.message.includes("no general suppression list") ? "named" : "vague")); }'
  [[ "$output" == *"config:named"* ]]
  [[ "$output" != *"RETURNED"* ]]
}

# ---------- the ack decision (Phase 02) ----------
#
# `submit` resolved on ANY parseable JSON body, ignoring the status code, so a 500 whose body
# was `{"error":"overloaded"}` came back as an ACK -- and sendOne writes the receipt on an ack.
# A cap slot and a journal resolution spent on a mail that was never accepted, with the spine
# recording it as sent. The rule was extracted from the HTTPS callback so it is tested rather
# than mocked around: testing it in place needs a TLS server and a client willing to trust a
# self-signed cert, i.e. a test that proves something about a weakened client.

@test "a non 2xx response is never an ack, whatever its body says" {
  run _fake 'const {decodeProviderResponse, ProviderError} = await import("./.claude/scripts/leads/lib/deps.mjs");
    const verdict = (code, body) => { try { decodeProviderResponse(code, body); return "ACK"; }
      catch (e) { return e instanceof ProviderError ? e.kind : "WRONG:" + e.name; } };
    console.log([[500, "{\"provider_message_id\":\"m1\"}"], [503, "{\"error\":\"overloaded\"}"],
                 [429, "{\"provider_message_id\":\"m1\"}"], [400, "{\"provider_message_id\":\"m1\"}"],
                 [403, "{}"], [0, "{\"provider_message_id\":\"m1\"}"]]
      .map(([c, b]) => c + "=" + verdict(c, b)).join(" "));'
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # Retryable classes are transport (reconcile decides); 4xx is a refusal (a retry repeats it).
  # A status of 0 -- no status at all -- is `refused`, not `transport`: calling it retryable
  # would be claiming evidence of a retryable condition that we do not have. Either way the
  # intent stays unresolved and reconcile settles it, so the class is operator information.
  [[ "$output" == *"500=transport 503=transport 429=transport 400=refused 403=refused 0=refused"* ]]
}

@test "a 2xx with no provider message id is not an ack either" {
  run _fake 'const {decodeProviderResponse, ProviderError} = await import("./.claude/scripts/leads/lib/deps.mjs");
    const verdict = (code, body) => { try { return "ACK:" + decodeProviderResponse(code, body).provider_message_id; }
      catch (e) { return e instanceof ProviderError ? e.kind : "WRONG:" + e.name; } };
    console.log([verdict(200, "{}"), verdict(200, "{\"provider_message_id\":\"\"}"),
                 verdict(200, "not json"), verdict(202, "{\"provider_message_id\":\"m9\"}")].join(" "));'
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # The positive case is asserted alongside the refusals: a decoder that refused EVERYTHING
  # would satisfy the three negatives on its own.
  [[ "$output" == *"refused refused refused ACK:m9"* ]]
}

@test "a provider error body is never echoed into the refusal" {
  run _fake 'const {decodeProviderResponse} = await import("./.claude/scripts/leads/lib/deps.mjs");
    const marker = "ZZRECIPIENTZZ";
    let msg = "";
    try { decodeProviderResponse(400, "{\"error\":\"rejected message for " + marker + "\"}"); }
    catch (e) { msg = e.message; }
    console.log((msg ? "refused" : "NO-REFUSAL") + " " + (msg.indexOf(marker) === -1 ? "clean" : "LEAKED"));'
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"refused clean"* ]]
}

@test "the fake provider is idempotent on a repeated idem key" {
  run _fake 'const {provider} = await import("./.claude/scripts/leads/lib/deps.mjs");
    const a = await provider().submit({idem_key:"same"});
    const b = await provider().submit({idem_key:"same"});
    console.log(a.provider_message_id === b.provider_message_id ? "idempotent" : "DOUBLE-SENT");'
  [[ "$output" == *"idempotent"* ]]
}

# ---------- the store ----------

@test "an uninitialised store refuses and creates nothing" {
  _cli research tests/fixtures/leads/icp-fake.json
  [ "$status" -eq 5 ]
  [[ "$output" == *"store not initialised"* ]]
  [ ! -d "$ARC_LEADS_STORE/dossiers" ]
}

@test "store init refuses to clobber an existing secret" {
  _cli store init
  [ "$status" -eq 0 ]
  _cli store init
  [ "$status" -eq 5 ]
  [[ "$output" == *"already"* ]]
}

@test "two different stores give the same address different lead ids" {
  run _fake 'const {initStore, openStore, leadId} = await import("./.claude/scripts/leads/lib/store.mjs");
    const os = await import("node:os"), fs = await import("node:fs"), path = await import("node:path");
    const ids = ["a","b"].map(n => { const d = fs.mkdtempSync(path.join(os.tmpdir(), "s" + n));
      process.env.ARC_LEADS_STORE = d; initStore(); return leadId(openStore(), "x@example.com"); });
    console.log(ids[0] === ids[1] ? "COLLIDE" : "distinct");'
  [[ "$output" == *"distinct"* ]]
}

# Rotation is ADDITIVE. Retiring a key would silently un-suppress exactly the people who
# exercised delete-on-request, because ADR-0410 purges their dossier and the retained hmac is
# the only surviving trace.
@test "rotation keeps the old key so an old id still resolves" {
  run _fake 'const {initStore, openStore, rotateSecret, leadIdsAllVersions} = await import("./.claude/scripts/leads/lib/store.mjs");
    const os = await import("node:os"), fs = await import("node:fs"), path = await import("node:path");
    process.env.ARC_LEADS_STORE = fs.mkdtempSync(path.join(os.tmpdir(), "rot"));
    initStore(); const before = leadIdsAllVersions(openStore(), "x@example.com");
    rotateSecret(); const after = leadIdsAllVersions(openStore(), "x@example.com");
    console.log(after.length === 2 && after.includes(before[0]) ? "keyring-retained" : "LOST:" + after.length);'
  [[ "$output" == *"keyring-retained"* ]]
}

@test "a store resolving inside the repo is refused" {
  run _fake 'const {assertOutsideRepo} = await import("./.claude/scripts/leads/lib/store.mjs");
    try { assertOutsideRepo(process.cwd(), process.cwd() + "/leads-store"); console.log("ACCEPTED"); }
    catch (e) { console.log(e.code); }'
  [[ "$output" == *"STORE_INSIDE_REPO"* ]]
}

@test "email normalization is case and whitespace insensitive" {
  run _fake 'const {initStore, openStore, leadId} = await import("./.claude/scripts/leads/lib/store.mjs");
    const os = await import("node:os"), fs = await import("node:fs"), path = await import("node:path");
    process.env.ARC_LEADS_STORE = fs.mkdtempSync(path.join(os.tmpdir(), "nrm"));
    initStore(); const s = openStore();
    console.log(leadId(s, "  Adv@Example.COM ") === leadId(s, "adv@example.com") ? "normalized" : "DIVERGED");'
  [[ "$output" == *"normalized"* ]]
}

# ---------- research end to end ----------

@test "research writes 29 dossiers and 5 rejections with reasons" {
  _cli store init
  _cli research tests/fixtures/leads/icp-fake.json
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"25 PASS"* ]]
  [ "$(ls "$ARC_LEADS_STORE/dossiers" | wc -l)" -eq 29 ]
  [ "$(grep -c . "$ARC_LEADS_STORE/rejected.jsonl")" -eq 5 ]
}

# Exit 0 from an emitter is not evidence anything was written. This class has cost three
# cycles: receipts landed in _quarantine while the caller saw success, and a cap derived from
# receipts that were never written counts zero and never trips.
@test "research receipts land in events and not in quarantine" {
  _cli store init
  _cli research tests/fixtures/leads/icp-fake.json
  [ "$status" -eq 0 ]
  local q=0
  [ -d "$ARC_SPINE_ROOT/events/_quarantine" ] && q=$(find "$ARC_SPINE_ROOT/events/_quarantine" -type f | wc -l)
  [ "$q" -eq 0 ] || { echo "quarantined: $q"; false; }
  [ "$(cat "$ARC_SPINE_ROOT"/events/*.jsonl | grep -c 'lead.researched')" -eq 29 ]
}

@test "no dossier content reaches any receipt" {
  _cli store init
  _cli research tests/fixtures/leads/icp-fake.json
  run grep -E '@(firm|example)|https?://' "$ARC_SPINE_ROOT"/events/*.jsonl
  [ "$status" -ne 0 ] || { echo "PII leaked to the spine: $output"; false; }
}

@test "an ICP campaign name containing a pipe is refused" {
  _cli store init
  printf '{"campaign":"a|b"}\n' > "$BATS_TEST_TMPDIR/bad-icp.json"
  _cli research "$BATS_TEST_TMPDIR/bad-icp.json"
  [ "$status" -eq 2 ]
}

# ---------- the state fold ----------

@test "state json is deterministic across two independent processes" {
  _cli store init
  _cli research tests/fixtures/leads/icp-fake.json
  cd "$ARC_ROOT"
  a=$(ARC_LEADS_FAKE=1 node .claude/scripts/leads/arc-leads.mjs state --json)
  b=$(ARC_LEADS_FAKE=1 node .claude/scripts/leads/arc-leads.mjs state --json)
  [ "$a" = "$b" ]
}

# The real replay property, and the one that can actually fail: the fold must not depend on
# the order lines happen to sit in on disk.
@test "state json is identical after the spine line order is shuffled" {
  _cli store init
  _cli research tests/fixtures/leads/icp-fake.json
  cd "$ARC_ROOT"
  a=$(ARC_LEADS_FAKE=1 node .claude/scripts/leads/arc-leads.mjs state --json)
  for f in "$ARC_SPINE_ROOT"/events/*.jsonl; do
    awk 'BEGIN{srand(7)} {printf "%.9f\t%s\n", rand(), $0}' "$f" | sort -k1,1 | cut -f2- > "$f.shuf"
    mv "$f.shuf" "$f"
  done
  b=$(ARC_LEADS_FAKE=1 node .claude/scripts/leads/arc-leads.mjs state --json)
  [ "$a" = "$b" ] || { echo "fold depends on disk order"; false; }
}

@test "state json grows by exactly one lead when one receipt is appended" {
  _cli store init
  _cli research tests/fixtures/leads/icp-fake.json
  cd "$ARC_ROOT"
  before=$(ARC_LEADS_FAKE=1 node .claude/scripts/leads/arc-leads.mjs state --json | grep -c 'lead_hmac_v1_')
  ARC_LEADS_FAKE=1 bash .claude/scripts/hq/arc-event.sh emit lead.researched --strict --actor arc-leads \
    --payload '{"lead_id":"lead_hmac_v1_ffffffffffffffffffffffffffffffff","campaign":"pilot-fake","provenance":"firm-site","geography":"IN","email_status":"verified","fact_count":2,"store_id":"0123456789abcdef","store_fingerprint":"deadbeef"}' >/dev/null
  after=$(ARC_LEADS_FAKE=1 node .claude/scripts/leads/arc-leads.mjs state --json | grep -c 'lead_hmac_v1_')
  [ "$after" -eq "$((before + 1))" ] || { echo "before=$before after=$after"; false; }
}

# An unreadable day counted as an empty one under-reports every cap. Fail closed.
@test "an unreadable spine day refuses rather than folding to zero" {
  _cli store init
  _cli research tests/fixtures/leads/icp-fake.json
  printf 'not json at all\n' >> "$ARC_SPINE_ROOT"/events/*.jsonl
  cd "$ARC_ROOT"
  run env ARC_LEADS_FAKE=1 node .claude/scripts/leads/arc-leads.mjs state --json
  [ "$status" -ne 0 ]
  [[ "$output" == *"refusing to fold"* ]]
}

# INBOUND_MAX_BYTES is a copy of MAX_REPLY_BYTES, kept so deps.mjs needs no parser dependency.
# A constant copied without an assertion is a constant that drifts, and the drift would be
# silent: the inbound door would accept what the parser then refuses, after the allocation.
@test "the inbound size ceiling equals the parser size limit" {
  run _fake 'const {INBOUND_MAX_BYTES} = await import("./.claude/scripts/leads/lib/deps.mjs");
    const {MAX_REPLY_BYTES} = await import("./.claude/scripts/leads/lib/replies.mjs");
    console.log(INBOUND_MAX_BYTES === MAX_REPLY_BYTES ? "in-step " + INBOUND_MAX_BYTES : "DRIFTED " + INBOUND_MAX_BYTES + " vs " + MAX_REPLY_BYTES);'
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"in-step 1048576"* ]]
}

@test "this file registers the 25 tests it declares" {
  # BATS_TEST_NAMES is what bats REGISTERED. The previous version grepped `^@test ` in
  # this same file and compared it to a literal in this same file -- a tautology that
  # cannot see a test bats dropped, which is the only thing it was there to catch.
  declared=$(grep -c '^@test ' "$BATS_TEST_FILENAME")
  registered=${#BATS_TEST_NAMES[@]}
  [ "$declared" -eq 25 ] || { echo "declared $declared, expected 25"; false; }
  [ "$registered" -eq "$declared" ] || { echo "bats registered $registered of $declared declared tests -- one was DROPPED (non-ASCII name?)"; false; }
}
