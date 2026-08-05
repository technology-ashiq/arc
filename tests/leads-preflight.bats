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

# ---------- REQ-07: the seed-inbox smoke, its own gate (Phase 02) ----------
#
# `seed_evidence_path` sat in the committed config with NO reader anywhere. These tests are
# the reader's contract. REQ-07 is deliberately NOT folded into preflight() — a gate that
# fails for reasons outside the question it asks has been given two jobs, and folding it in
# made two REQ-00 tests above fail for a REQ-07 reason. `arc-leads preflight` composes both.
SIMPORT='const {seedSmokeFinding, SEED_EVIDENCE_MAX_AGE_DAYS} = await import("./.claude/scripts/leads/lib/preflight.mjs");
const fs = await import("node:fs"), os = await import("node:os"), path = await import("node:path");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "seed"));
const at = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString();
const FULL = {mailboxes: ["gmail-seed", "outlook-seed"], inbox_placement: true, auth_headers: true,
  unsubscribe: true, reply_ingested: true, bounce_ingested: true};
const write = (obj) => { const p = path.join(dir, "seed.json"); fs.writeFileSync(p, JSON.stringify(obj)); return p; };
const verdict = (p) => { const f = seedSmokeFinding(p); return (f.ok ? "PASS " : "REFUSED ") + f.rule; };'

@test "REQ-07 refuses when no seed evidence path is configured" {
  run _node "$SIMPORT console.log(verdict(''));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"REFUSED seed-smoke"* ]]
}

@test "REQ-07 accepts dated fresh evidence across two mailboxes" {
  run _node "$SIMPORT console.log(verdict(write({...FULL, dated: at(2)})));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"PASS seed-smoke"* ]]
}

@test "REQ-07 refuses evidence older than the limit" {
  run _node "$SIMPORT console.log(verdict(write({...FULL, dated: at(SEED_EVIDENCE_MAX_AGE_DAYS + 1)})));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"REFUSED"* ]]
}

# Undated is the spoof this clause exists to close: a file that cannot be shown to be fresh is
# indistinguishable from evidence produced before the last DNS change.
@test "REQ-07 refuses undated evidence rather than trusting it" {
  run _node "$SIMPORT console.log(verdict(write({...FULL})));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"REFUSED"* ]]
}

@test "REQ-07 refuses forward dated evidence" {
  run _node "$SIMPORT console.log(verdict(write({...FULL, dated: at(-3)})));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"REFUSED"* ]]
}

@test "REQ-07 refuses a single mailbox and unreadable evidence" {
  run _node "$SIMPORT const one = verdict(write({...FULL, dated: at(1), mailboxes: ['only-gmail']}));
    const p = path.join(dir, 'broken.json'); fs.writeFileSync(p, 'not json at all');
    console.log(one + ' | ' + verdict(p));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"REFUSED seed-smoke | REFUSED seed-smoke"* ]]
}

# An ABSENT clause is a FAILED clause. Asserted one clause at a time, so a rule that checks
# only the first key in the list cannot pass this.
@test "REQ-07 refuses when any single clause is absent" {
  run _node "$SIMPORT const keys = ['inbox_placement', 'auth_headers', 'unsubscribe', 'reply_ingested', 'bounce_ingested'];
    const results = keys.map((k) => { const ev = {...FULL, dated: at(1)}; delete ev[k]; return verdict(write(ev)); });
    const passed = results.filter((r) => r.startsWith('PASS'));
    console.log(results.length + ' clauses dropped, ' + passed.length + ' still passed');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"5 clauses dropped, 0 still passed"* ]]
}


# `Array.isArray` plus `length >= 2` accepted the same mailbox listed twice, and even
# `[null, 0]`. This is REQ-07, the gate that decides whether a real campaign may start, and
# "two mailboxes" is the clause's entire content -- the point is provider diversity.
@test "REQ-07 refuses duplicate or empty mailbox entries" {
  run _node "$SIMPORT const dup   = verdict(write({...FULL, dated: at(1), mailboxes: ['seed@a.example.net', 'seed@a.example.net']}));
    const nulls = verdict(write({...FULL, dated: at(1), mailboxes: [null, 0]}));
    const blank = verdict(write({...FULL, dated: at(1), mailboxes: ['  ', 'seed@a.example.net']}));
    const good  = verdict(write({...FULL, dated: at(1)}));
    console.log([dup, nulls, blank, good].join(' | '));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # Three refusals AND the positive control -- a clause that refused everything would satisfy
  # the negatives on its own.
  [[ "$output" == *"REFUSED seed-smoke | REFUSED seed-smoke | REFUSED seed-smoke | PASS seed-smoke"* ]]
}

@test "this file registers the 24 tests it declares" {
  # BATS_TEST_NAMES is what bats REGISTERED. The previous version grepped `^@test ` in
  # this same file and compared it to a literal in this same file -- a tautology that
  # cannot see a test bats dropped, which is the only thing it was there to catch.
  declared=$(grep -c '^@test ' "$BATS_TEST_FILENAME")
  registered=${#BATS_TEST_NAMES[@]}
  [ "$declared" -eq 24 ] || { echo "declared $declared, expected 24"; false; }
  [ "$registered" -eq "$declared" ] || { echo "bats registered $registered of $declared declared tests -- one was DROPPED (non-ASCII name?)"; false; }
}
