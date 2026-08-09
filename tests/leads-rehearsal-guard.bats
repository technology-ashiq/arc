#!/usr/bin/env bats
# leads Phase 03 -- the ADR-0416 rehearsal guard (slices 01 and 02).
#
# ADR-0416 narrowed ADR-0402 in PROSE and nothing enforced the narrowing. product_domains did
# not even name automemory.ai, so the dedicated-domain refusal could not fire for the one
# domain the ADR exists to control, and preflight would have reported the product domain as a
# perfectly good dedicated domain. These tests are that enforcement.
#
# Every refusal case asserts WHICH rule refused and WHY, never merely that something refused.
# A test that asserts only "refused" passes for the wrong reason: the shipped config refuses
# today for an empty sending_domain, and it would have kept passing that assertion after the
# rehearsal unlocked the product domain by accident.
#
# No address literal appears in this file. tests/leads-*.bats is inside the PII tripwire scan
# scope, so addresses are assembled at runtime (ADR-0410).
bats_require_minimum_version 1.5.0
load 'test_helper'

_node() { cd "$ARC_ROOT" && ARC_LEADS_FAKE=1 LEADS_FIXTURE_DIR="$FIXDIR" node --input-type=module -e "$1"; }

setup() {
  FIXDIR="$BATS_TEST_TMPDIR/fix"
  mkdir -p "$FIXDIR"
  cp "$ARC_ROOT/tests/fixtures/leads/dns.json" "$FIXDIR/dns.json"
  cp "$ARC_ROOT/tests/fixtures/leads/authstatus.json" "$FIXDIR/authstatus.json"
}

# AT is assembled, never typed. PROD carries BOTH product domains so the tests prove the
# guard unlocks one named domain rather than the whole list.
RIMPORT='const P = await import("./.claude/scripts/leads/lib/preflight.mjs");
const AT = String.fromCharCode(64);
const addr = (l, d) => l + AT + d;
const rule = async (cfg, env, name) => { const r = await P.preflight({config: cfg, env});
  const f = r.findings.find((x) => x.rule === name);
  return f ? (f.ok ? "PASS " : "REFUSE ") + f.detail : "ABSENT"; };
const PROD = ["lexos.app", "automemory.ai"];
const REH = {sending_domain: "", product_domains: PROD, rehearsal_domain: "automemory.ai",
             dkim_selector: "default", rehearsal_dkim_selector: "resend"};
const LOCK = [addr("one", "example.test"), addr("two", "example.test")].join(",");
const ON = {ARC_LEADS_REHEARSAL: "1", ARC_LEADS_REHEARSAL_ALLOWLIST: LOCK};'

@test "the product domain is refused when rehearsal mode is not declared" {
  run _node "$RIMPORT
    console.log(await rule({...REH, sending_domain: \"automemory.ai\"}, {}, \"dedicated-domain\"));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"REFUSE"* ]]
  [[ "$output" == *"ADR-0402"* ]]
}

@test "the refusal names the product domain rather than a generic message" {
  run _node "$RIMPORT
    console.log(await rule({...REH, sending_domain: \"automemory.ai\"}, {}, \"dedicated-domain\"));"
  [[ "$output" == *"automemory.ai"* ]]
  [[ "$output" == *"IS the product domain"* ]]
}

@test "declared but with rehearsal_domain unset falls through and still refuses" {
  run _node "$RIMPORT
    const cfg = {...REH, sending_domain: \"automemory.ai\"}; delete cfg.rehearsal_domain;
    console.log(await rule(cfg, ON, \"dedicated-domain\"));"
  [[ "$output" == *"REFUSE"* ]]
  [[ "$output" == *"rehearsal_domain is unset"* ]]
}

@test "declared and named but with no allowlist refuses on the missing lock" {
  run _node "$RIMPORT
    console.log(await rule(REH, {ARC_LEADS_REHEARSAL: \"1\"}, \"dedicated-domain\"));"
  [[ "$output" == *"REFUSE"* ]]
  [[ "$output" == *"no address-shaped entry"* ]]
}

@test "an allowlist holding no address shape is not a lock" {
  run _node "$RIMPORT
    console.log(await rule(REH, {ARC_LEADS_REHEARSAL: \"1\", ARC_LEADS_REHEARSAL_ALLOWLIST: \"yes,true,1\"}, \"dedicated-domain\"));"
  [[ "$output" == *"REFUSE"* ]]
  [[ "$output" == *"no address-shaped entry"* ]]
}

@test "a bare at-sign with no local or domain part is not a lock" {
  run _node "$RIMPORT
    console.log(await rule(REH, {ARC_LEADS_REHEARSAL: \"1\", ARC_LEADS_REHEARSAL_ALLOWLIST: AT + \"x.test,\" + \"y.test\" + AT}, \"dedicated-domain\"));"
  [[ "$output" == *"REFUSE"* ]]
  [[ "$output" == *"no address-shaped entry"* ]]
}

@test "declared, named and locked permits the product domain and says why" {
  run _node "$RIMPORT console.log(await rule(REH, ON, \"dedicated-domain\"));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"PASS"* ]]
  [[ "$output" == *"ADR-0416"* ]]
  [[ "$output" == *"locked to 2"* ]]
}

@test "rehearsal mode announces the domain substitution instead of doing it silently" {
  run _node "$RIMPORT console.log(await rule(REH, ON, \"rehearsal-mode\"));"
  [[ "$output" == *"PASS"* ]]
  [[ "$output" == *"automemory.ai"* ]]
  [[ "$output" == *"is not used for this run"* ]]
}

@test "rehearsal mode never unlocks the OTHER product domain" {
  run _node "$RIMPORT
    const r = P.effectiveSendingDomain({...REH, sending_domain: \"lexos.app\"}, ON);
    console.log(r.domain + \" rehearsal=\" + r.rehearsal);"
  [[ "$output" == *"automemory.ai"* ]]
  [[ "$output" != *"lexos.app"* ]]
}

@test "the dkim selector follows the mode because the selector belongs to the provider" {
  run _node "$RIMPORT
    console.log(P.effectiveDkimSelector(REH, true) + \",\" + P.effectiveDkimSelector(REH, false));"
  [[ "$output" == *"resend,default"* ]]
}

@test "the unsubscribe header is built from the same resolver the gate uses" {
  run _node "$RIMPORT
    const S = await import(\"./.claude/scripts/leads/lib/sequencer.mjs\");
    const fs = await import(\"node:fs\"); const os = await import(\"node:os\"); const path = await import(\"node:path\");
    const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), \"reh\")), \"leads.json\");
    fs.writeFileSync(p, JSON.stringify(REH));
    console.log(S.unsubscribeHeader(p, ON));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"automemory.ai>"* ]]
}

@test "the shipped config still refuses out of the box, on the sending-domain row" {
  run _node "$RIMPORT
    const cfg = P.loadConfig();
    const r = await P.preflight({config: cfg, env: {}});
    console.log((r.ok ? \"PASS\" : \"REFUSED\") + \" first=\" + r.findings.filter((f) => !f.ok).map((f) => f.rule)[0]);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"REFUSED"* ]]
  [[ "$output" == *"first=sending-domain"* ]]
}

# The em-dash incident (2026-07-30): two @test NAMES carrying U+2014 were never encoded into
# shell function identifiers under the C locale, so bats skipped them and reported it as a
# comment among the ok lines. Counting what this file DECLARES against what bats EXECUTED
# turns any such silent non-execution into a failure. Test names here are ASCII only.
@test "this suite declares and executes the same number of tests" {
  declared="$(grep -cE '^@test ' "$BATS_TEST_FILENAME")"
  [ "$declared" -eq 13 ] || { echo "declared $declared, expected 13"; false; }
  # Non-ASCII anywhere in a @test NAME is the failure mode itself, so it is checked here
  # rather than trusted. The class is [^ -~] under LC_ALL=C, not a \x escape: grep -P does
  # not exist on the macOS leg, and a check that only runs on Linux is not a check.
  offenders="$(grep -E '^@test ' "$BATS_TEST_FILENAME" | LC_ALL=C grep -c '[^ -~]' || true)"
  [ "$offenders" -eq 0 ] || { echo "$offenders @test name(s) carry non-ASCII bytes"; false; }
}
