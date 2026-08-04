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

@test "the real provider module reaches its own code and exits with its own failure code" {
  cd "$ARC_ROOT"
  run env -u ARC_LEADS_FAKE LEADS_PROVIDER_BASE_URL="https://127.0.0.1:1" node --input-type=module -e '
    const {provider, ProviderError} = await import("./.claude/scripts/leads/lib/deps.mjs");
    try { await provider().submit({idem_key:"k", to:"x", subject:"s", body:"b", headers:{}}); console.log("UNEXPECTED-SUCCESS"); }
    catch (e) { console.log(e instanceof ProviderError ? "ProviderError:" + e.kind : "WRONG-ERROR:" + e.constructor.name); }'
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"ProviderError:transport"* ]]
}

@test "the real provider refuses when no base URL is bound" {
  cd "$ARC_ROOT"
  run env -u ARC_LEADS_FAKE -u LEADS_PROVIDER_BASE_URL node --input-type=module -e '
    const {provider} = await import("./.claude/scripts/leads/lib/deps.mjs");
    try { await provider().submit({}); console.log("UNEXPECTED-SUCCESS"); } catch (e) { console.log(e.kind); }'
  [[ "$output" == *"config"* ]]
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

@test "this file registers the 18 tests it declares" {
  # BATS_TEST_NAMES is what bats REGISTERED. The previous version grepped `^@test ` in
  # this same file and compared it to a literal in this same file -- a tautology that
  # cannot see a test bats dropped, which is the only thing it was there to catch.
  declared=$(grep -c '^@test ' "$BATS_TEST_FILENAME")
  registered=${#BATS_TEST_NAMES[@]}
  [ "$declared" -eq 18 ] || { echo "declared $declared, expected 18"; false; }
  [ "$registered" -eq "$declared" ] || { echo "bats registered $registered of $declared declared tests -- one was DROPPED (non-ASCII name?)"; false; }
}
