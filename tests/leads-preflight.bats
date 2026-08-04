#!/usr/bin/env bats
# leads Phase 00 -- the deliverability gate (REQ-00, ADR-0402).
#
# The property under test is that the gate is CODE, not a checklist: an evidence file saying
# "DMARC is green" is a file, and a file can be stale, copied, or simply wrong. So the live
# check overrides the file in every direction, and the one clause that cannot be checked live
# (warm-up, where the provider exposes no history) REFUSES rather than printing PASS.
#
# A gate that reports success for a clause it could not verify is worse than no gate: it
# teaches everyone downstream to trust the wrong thing.
bats_require_minimum_version 1.5.0
load 'test_helper'

_node() { cd "$ARC_ROOT" && ARC_LEADS_FAKE=1 LEADS_FIXTURE_DIR="$FIXDIR" node --input-type=module -e "$1"; }

setup() {
  FIXDIR="$BATS_TEST_TMPDIR/fix"
  mkdir -p "$FIXDIR"
  cp "$ARC_ROOT/tests/fixtures/leads/dns.json" "$FIXDIR/dns.json"
  cp "$ARC_ROOT/tests/fixtures/leads/authstatus.json" "$FIXDIR/authstatus.json"
}

_dns() { printf '%s\n' "$1" > "$FIXDIR/dns.json"; }
_auth() { printf '%s\n' "$1" > "$FIXDIR/authstatus.json"; }

PIMPORT='const {preflight, domainConflict} = await import("./.claude/scripts/leads/lib/preflight.mjs");
const run = async (cfg, opts={}) => { const r = await preflight({config: cfg, ...opts});
  return r.ok ? "PASS" : r.findings.filter(f => !f.ok).map(f => f.rule).join(","); };
const GOOD = {sending_domain:"outreach.example.net", product_domains:["lexos.app"], dkim_selector:"default"};'

# The committed config carries an empty sending_domain, because no domain exists (ADR-0413).
# That is the honest value and it must refuse, not pass vacuously.
@test "an empty sending domain refuses" {
  run _node "$PIMPORT console.log(await run({sending_domain:'', product_domains:['lexos.app']}));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"sending-domain"* ]]
}

@test "the committed config refuses out of the box" {
  cd "$ARC_ROOT" && run env ARC_LEADS_FAKE=1 LEADS_FIXTURE_DIR="$FIXDIR" node .claude/scripts/leads/arc-leads.mjs preflight
  [ "$status" -eq 3 ]
  [[ "$output" == *"REFUSED"* ]]
}

@test "the product domain itself is refused as a sender" {
  run _node "$PIMPORT console.log(await run({...GOOD, sending_domain:'lexos.app'}));"
  [[ "$output" == *"dedicated-domain"* ]]
}

# Subdomain isolation is a myth: spam filters aggregate reputation to the organizational
# domain, so burning mail.lexos.app burns lexos.app with it.
@test "a subdomain of the product domain is refused as a sender" {
  run _node "$PIMPORT console.log(await run({...GOOD, sending_domain:'mail.lexos.app'}));"
  [[ "$output" == *"dedicated-domain"* ]]
}

@test "domainConflict is not fooled by a lookalike suffix" {
  run _node "$PIMPORT console.log(domainConflict('notlexos.app', ['lexos.app']) === null ? 'no-conflict' : 'FALSE-POSITIVE');"
  [[ "$output" == *"no-conflict"* ]]
}

@test "a missing SPF record refuses" {
  _dns '{"_dmarc.outreach.example.net":["v=DMARC1; p=reject"],"default._domainkey.outreach.example.net":["v=DKIM1; k=rsa; p=x"]}'
  run _node "$PIMPORT console.log(await run(GOOD));"
  [[ "$output" == *"spf"* ]]
}

@test "a missing DMARC record refuses" {
  _dns '{"outreach.example.net":["v=spf1 include:x -all"],"default._domainkey.outreach.example.net":["v=DKIM1; k=rsa; p=x"]}'
  run _node "$PIMPORT console.log(await run(GOOD));"
  [[ "$output" == *"dmarc"* ]]
}

# Published is not enforcing. p=none collects reports and stops nothing.
@test "a DMARC policy of p none refuses" {
  _dns '{"outreach.example.net":["v=spf1 include:x -all"],"_dmarc.outreach.example.net":["v=DMARC1; p=none"],"default._domainkey.outreach.example.net":["v=DKIM1; k=rsa; p=x"]}'
  run _node "$PIMPORT console.log(await run(GOOD));"
  [[ "$output" == *"dmarc"* ]]
}

@test "a missing DKIM record refuses" {
  _dns '{"outreach.example.net":["v=spf1 include:x -all"],"_dmarc.outreach.example.net":["v=DMARC1; p=reject"]}'
  run _node "$PIMPORT console.log(await run(GOOD));"
  [[ "$output" == *"dkim"* ]]
}

# The spoof this gate exists to close: the evidence file is not an input to PASS.
@test "a warm-up log claiming more days than provider history refuses" {
  _dns '{"outreach.example.net":["v=spf1 include:x -all"],"_dmarc.outreach.example.net":["v=DMARC1; p=reject"],"default._domainkey.outreach.example.net":["v=DKIM1; k=rsa; p=x"]}'
  _auth '{"spf":true,"dkim":true,"dmarc":true,"warmup_days":3}'
  printf '{"days":21}\n' > "$BATS_TEST_TMPDIR/warm.json"
  run _node "$PIMPORT console.log(await run({...GOOD, warmup_log_path:'$BATS_TEST_TMPDIR/warm.json'}));"
  [[ "$output" == *"warmup"* ]]
}

@test "provider reporting an unauthenticated domain refuses despite live DNS" {
  _dns '{"outreach.example.net":["v=spf1 include:x -all"],"_dmarc.outreach.example.net":["v=DMARC1; p=reject"],"default._domainkey.outreach.example.net":["v=DKIM1; k=rsa; p=x"]}'
  _auth '{"spf":true,"dkim":false,"dmarc":true,"warmup_days":30}'
  run _node "$PIMPORT console.log(await run(GOOD));"
  [[ "$output" == *"provider-dkim"* ]]
}

# The honest exception, handled honestly.
@test "an unverifiable warm-up refuses rather than printing PASS" {
  _dns '{"outreach.example.net":["v=spf1 include:x -all"],"_dmarc.outreach.example.net":["v=DMARC1; p=reject"],"default._domainkey.outreach.example.net":["v=DKIM1; k=rsa; p=x"]}'
  _auth '{"spf":true,"dkim":true,"dmarc":true,"warmup_days":null}'
  run _node "$PIMPORT console.log(await run(GOOD));"
  [[ "$output" == *"warmup"* ]]
}

@test "an approved attestation lets an otherwise clean domain pass" {
  _dns '{"outreach.example.net":["v=spf1 include:x -all"],"_dmarc.outreach.example.net":["v=DMARC1; p=reject"],"default._domainkey.outreach.example.net":["v=DKIM1; k=rsa; p=x"]}'
  _auth '{"spf":true,"dkim":true,"dmarc":true,"warmup_days":null}'
  run _node "$PIMPORT console.log(await run(GOOD, {warmupApproved:true}));"
  [[ "$output" == *"PASS"* ]]
}

@test "sufficient provider warm-up history passes without an attestation" {
  _dns '{"outreach.example.net":["v=spf1 include:x -all"],"_dmarc.outreach.example.net":["v=DMARC1; p=reject"],"default._domainkey.outreach.example.net":["v=DKIM1; k=rsa; p=x"]}'
  _auth '{"spf":true,"dkim":true,"dmarc":true,"warmup_days":30}'
  run _node "$PIMPORT console.log(await run(GOOD));"
  [[ "$output" == *"PASS"* ]]
}

@test "warm-up below fourteen days refuses" {
  _dns '{"outreach.example.net":["v=spf1 include:x -all"],"_dmarc.outreach.example.net":["v=DMARC1; p=reject"],"default._domainkey.outreach.example.net":["v=DKIM1; k=rsa; p=x"]}'
  _auth '{"spf":true,"dkim":true,"dmarc":true,"warmup_days":13}'
  run _node "$PIMPORT console.log(await run(GOOD));"
  [[ "$output" == *"warmup"* ]]
}

@test "this file declares and runs 16 tests" {
  declared=$(grep -c '^@test ' "$BATS_TEST_FILENAME")
  [ "$declared" -eq 16 ] || { echo "declared $declared, expected 16"; false; }
}
