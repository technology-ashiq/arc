#!/usr/bin/env bats
# leads Phase 03 -- the ADR-0416 rehearsal guard (slices 01 and 02).
#
# ADR-0416 narrowed ADR-0402 in PROSE and nothing enforced the narrowing. product_domains did
# not even name automemory.ai, so the dedicated-domain refusal could not fire for the one
# domain the ADR exists to control. These tests are that enforcement, plus a regression test
# for every hole the two adversarial passes found in the first version of it:
#
#   C1  ARC_LEADS_REHEARSAL=1 alone was the whole unlock. The three-signal check lived in
#       preflight(), and the SEND path never calls preflight() -- it calls unsubscribeHeader().
#       Tests 15 and 16 pin the send-path chokepoint, not the gate.
#   C2  LEADS_CONFIG replaces the config file, so a config with "product_domains": [] passed
#       lexos.app clean through ADR-0402. The list is now pinned in code. Test 18.
#   H3  domainConflict normalised one side and not the other, so ONE leading space on an entry
#       disabled it. Test 19.
#   H4  a missing or wrong-typed product_domains was a silent PASS. Tests 20 and 21.
#   M6  three mutants survived because no test supplied ARC_LEADS_REHEARSAL="0" or a
#       case/whitespace variant of a domain. Tests 8 and 22.
#
# Every refusal case asserts WHICH rule refused and WHY, never merely that something refused.
# A test that asserts only "refused" passes for the wrong reason: the shipped config refuses
# today for an empty sending_domain, and it would keep passing after an accidental unlock.
#
# Addresses below are RFC-2606 reserved literals, which is what this path is FOR: pii-tripwire
# treats tests/leads-*.bats as a fixture class and requires reserved domains rather than no
# addresses at all -- its own comment says pushing sample addresses into runtime assembly buys
# no safety. An earlier draft assembled them from String.fromCharCode(64), which was both
# unnecessary here and a working evasion of the no-address rule if copied outside this class.
bats_require_minimum_version 1.5.0
load 'test_helper'

_node() { cd "$ARC_ROOT" && ARC_LEADS_FAKE=1 LEADS_FIXTURE_DIR="$FIXDIR" node --input-type=module -e "$1"; }
_dns() { printf '%s\n' "$1" > "$FIXDIR/dns.json"; }

setup() {
  FIXDIR="$BATS_TEST_TMPDIR/fix"
  mkdir -p "$FIXDIR"
  cp "$ARC_ROOT/tests/fixtures/leads/dns.json" "$FIXDIR/dns.json"
  cp "$ARC_ROOT/tests/fixtures/leads/authstatus.json" "$FIXDIR/authstatus.json"
}

RIMPORT='const P = await import("./.claude/scripts/leads/lib/preflight.mjs");
const S = await import("./.claude/scripts/leads/lib/sequencer.mjs");
const fs = await import("node:fs"); const os = await import("node:os"); const path = await import("node:path");
const rule = async (cfg, env, name) => { const r = await P.preflight({config: cfg, env});
  const f = r.findings.find((x) => x.rule === name);
  return f ? (f.ok ? "PASS " : "REFUSE ") + f.detail : "ABSENT"; };
const firstBad = async (cfg, env) => { const r = await P.preflight({config: cfg, env});
  const f = r.findings.filter((x) => !x.ok)[0];
  return f ? f.rule + " :: " + f.detail : "NONE"; };
const hdr = (cfg, env) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), "reh"));
  const p = path.join(d, "leads.json"); fs.writeFileSync(p, JSON.stringify(cfg));
  try { return "BOUND " + S.unsubscribeHeader(p, env); } catch (e) { return "THREW " + e.message; } };
const REH = {sending_domain: "", product_domains: ["lexos.app", "automemory.ai"],
             rehearsal_domain: "automemory.ai", dkim_selector: "default", rehearsal_dkim_selector: "resend"};
const ON = {ARC_LEADS_REHEARSAL: "1",
            ARC_LEADS_REHEARSAL_ALLOWLIST: "one@example.test,two@example.test"};'

# Every `run` uses `run -0`, the expected-status form unlocked by bats_require_minimum_version
# above. Without it a test asserting only on $output passes while node exits non-zero -- and
# this file had exactly that shape in six tests, with two of them running the IDENTICAL command
# one line apart, one checking status and one not.

@test "the product domain is refused when rehearsal mode is not declared" {
  run -0 _node "$RIMPORT console.log(await rule({...REH, sending_domain: \"automemory.ai\"}, {}, \"dedicated-domain\"));"
  [[ "$output" == *"REFUSE"* ]]
  [[ "$output" == *"ADR-0402"* ]]
}

@test "the refusal names the product domain rather than a generic message" {
  run -0 _node "$RIMPORT console.log(await rule({...REH, sending_domain: \"automemory.ai\"}, {}, \"dedicated-domain\"));"
  [[ "$output" == *"automemory.ai"* ]]
  [[ "$output" == *"IS the product domain"* ]]
}

@test "declared with rehearsal_domain unset is refused, not quietly fallen back from" {
  run -0 _node "$RIMPORT
    const cfg = {...REH}; delete cfg.rehearsal_domain;
    console.log(await rule(cfg, ON, \"rehearsal-mode\"));"
  [[ "$output" == *"REFUSE"* ]]
  [[ "$output" == *"rehearsal_domain is unset"* ]]
}

@test "declared and named but with no allowlist refuses on the missing lock" {
  run -0 _node "$RIMPORT console.log(await rule(REH, {ARC_LEADS_REHEARSAL: \"1\"}, \"rehearsal-mode\"));"
  [[ "$output" == *"REFUSE"* ]]
  [[ "$output" == *"no address-shaped entry"* ]]
}

@test "an allowlist holding no address shape is not a lock" {
  run -0 _node "$RIMPORT console.log(await rule(REH, {ARC_LEADS_REHEARSAL: \"1\", ARC_LEADS_REHEARSAL_ALLOWLIST: \"yes,true,1\"}, \"rehearsal-mode\"));"
  [[ "$output" == *"REFUSE"* ]]
  [[ "$output" == *"no address-shaped entry"* ]]
}

@test "a bare at-sign with no local or domain part is not a lock" {
  run -0 _node "$RIMPORT console.log(await rule(REH, {ARC_LEADS_REHEARSAL: \"1\", ARC_LEADS_REHEARSAL_ALLOWLIST: \"@example.test,example.test@\"}, \"rehearsal-mode\"));"
  [[ "$output" == *"REFUSE"* ]]
  [[ "$output" == *"no address-shaped entry"* ]]
}

# The config field is not self-certifying. Pointing rehearsal_domain at a lexos.app subdomain
# used to unlock it with the full declared-named-and-locked blessing.
@test "a rehearsal_domain outside the code-pinned list is refused" {
  run -0 _node "$RIMPORT
    console.log(await rule({...REH, rehearsal_domain: \"mail.lexos.app\"}, ON, \"rehearsal-mode\"));
    console.log(await rule({...REH, rehearsal_domain: \"attacker.test\"}, ON, \"rehearsal-mode\"));"
  [[ "$output" == *"not one of the code-pinned product domains"* ]]
  run -0 _node "$RIMPORT console.log((await firstBad({...REH, rehearsal_domain: \"attacker.test\"}, ON)).split(\" :: \")[0]);"
  [[ "$output" == "rehearsal-mode" ]]
}

# A mutant reading `declared` as any non-empty value survived the first suite, because no test
# ever supplied a FALSY value for the variable.
@test "ARC_LEADS_REHEARSAL declares only on exactly 1" {
  run -0 _node "$RIMPORT
    for (const v of [\"0\", \"false\", \"\", \"01\", \"true\"])
      console.log(v + \"=\" + JSON.stringify(P.effectiveSendingDomain(REH, {ARC_LEADS_REHEARSAL: v}).domain));"
  [[ "$output" != *"automemory.ai"* ]]
}

@test "declared, named and locked permits the product domain" {
  run -0 _node "$RIMPORT console.log(await rule(REH, ON, \"dedicated-domain\"));"
  [[ "$output" == *"PASS"* ]]
  [[ "$output" == *"ADR-0416"* ]]
}

# The first version said "locked to 2 allowlisted recipient(s)" -- a containment claim no code
# performs, since nothing on the send path reads the list yet. A gate that describes work it
# does not do teaches the reader to trust the wrong thing.
@test "the gate does not claim per-recipient containment it does not enforce" {
  run -0 _node "$RIMPORT console.log(await rule(REH, ON, \"dedicated-domain\"));"
  [[ "$output" == *"per-recipient enforcement at send time is slice 04"* ]]
  [[ "$output" != *"locked to 2 allowlisted recipient"* ]]
}

@test "rehearsal mode announces the domain substitution instead of doing it silently" {
  run -0 _node "$RIMPORT console.log(await rule(REH, ON, \"rehearsal-mode\"));"
  [[ "$output" == *"PASS"* ]]
  [[ "$output" == *"is not used for this run"* ]]
}

# The paired NEGATIVE. Without it a mutant that emits the announcement on EVERY run survives:
# the wording is pinned, the absence is not.
@test "the announcement is ABSENT when rehearsal mode is off" {
  run -0 _node "$RIMPORT console.log(await rule(REH, {}, \"rehearsal-mode\"));"
  [ "$output" = "ABSENT" ]
}

@test "rehearsal mode never unlocks the OTHER product domain" {
  run -0 _node "$RIMPORT
    const r = P.effectiveSendingDomain({...REH, sending_domain: \"lexos.app\"}, ON);
    console.log(r.domain + \" rehearsal=\" + r.rehearsal);"
  [[ "$output" == *"automemory.ai"* ]]
  [[ "$output" != *"lexos.app"* ]]
}

@test "the dkim selector follows the mode because the selector belongs to the provider" {
  run -0 _node "$RIMPORT console.log(P.effectiveDkimSelector(REH, true) + \",\" + P.effectiveDkimSelector(REH, false));"
  [[ "$output" == *"resend,default"* ]]
}

# ---- the SEND path, which is a different code path from the gate ----
#
# cmdDaily calls unsubscribeHeader() before its send loop and never calls preflight(). So the
# refusal has to hold HERE, or one env var binds the product domain into every List-Unsubscribe
# while preflight refuses correctly in a subcommand nobody ran.

@test "the send-path chokepoint refuses the product domain when rehearsal is off" {
  run -0 _node "$RIMPORT console.log(hdr({...REH, sending_domain: \"automemory.ai\"}, {}));"
  [[ "$output" == *"THREW"* ]]
  [[ "$output" == *"ADR-0402"* ]]
}

@test "the send-path chokepoint refuses a declared but incomplete rehearsal" {
  run -0 _node "$RIMPORT
    console.log(hdr(REH, {ARC_LEADS_REHEARSAL: \"1\"}));
    console.log(hdr(REH, {ARC_LEADS_REHEARSAL: \"1\", ARC_LEADS_REHEARSAL_ALLOWLIST: \"yes\"}));"
  [[ "$output" != *"BOUND"* ]]
  [[ "$output" == *"declared but incomplete"* ]]
}

@test "the unsubscribe header binds the rehearsal domain only when fully unlocked" {
  run -0 _node "$RIMPORT console.log(hdr(REH, ON));"
  [[ "$output" == *"BOUND"* ]]
  [[ "$output" == *"automemory.ai>"* ]]
}

# ---- config cannot weaken the rule it is configured by ----

@test "a config that empties product_domains cannot disable ADR-0402" {
  run -0 _node "$RIMPORT
    const hostile = {sending_domain: \"lexos.app\", product_domains: []};
    console.log(await rule(hostile, {}, \"dedicated-domain\"));
    console.log(hdr(hostile, {}));"
  [[ "$output" == *"REFUSE"* ]]
  [[ "$output" == *"ADR-0402"* ]]
  [[ "$output" != *"BOUND"* ]]
}

@test "a product_domains entry carrying stray whitespace still refuses" {
  run -0 _node "$RIMPORT
    for (const e of [\" automemory.ai\", \"automemory.ai \", \"automemory.ai. \", \"\tautomemory.ai\"])
      console.log(await rule({sending_domain: \"automemory.ai\", product_domains: [e]}, {}, \"dedicated-domain\"));"
  [[ "$output" != *"PASS"* ]]
  [[ "$output" == *"ADR-0402"* ]]
}

@test "product_domains missing entirely still refuses, because the list is pinned in code" {
  run -0 _node "$RIMPORT console.log(await rule({sending_domain: \"automemory.ai\"}, {}, \"dedicated-domain\"));"
  [[ "$output" == *"REFUSE"* ]]
  [[ "$output" == *"ADR-0402"* ]]
}

@test "a product_domains of the wrong type refuses rather than reading as an empty list" {
  run -0 _node "$RIMPORT console.log((await firstBad({sending_domain: \"automemory.ai\", product_domains: \"lexos.app\"}, {})));"
  [[ "$output" == *"product-domains"* ]]
  [[ "$output" == *"must be an array"* ]]
}

@test "a case or trailing-dot variant of the sending domain still refuses" {
  run -0 _node "$RIMPORT
    for (const d of [\"AUTOMEMORY.AI\", \"  automemory.ai\", \"automemory.ai.\", \"Mail.Lexos.App\"])
      console.log(await rule({sending_domain: d, product_domains: []}, {}, \"dedicated-domain\"));"
  [[ "$output" != *"PASS"* ]]
  [[ "$output" == *"ADR-0402"* ]]
}

@test "the shipped config still refuses out of the box, on the sending-domain row" {
  run -0 _node "$RIMPORT console.log((await firstBad(P.loadConfig(), {})).split(\" :: \")[0]);"
  [[ "$output" == "sending-domain" ]]
}

# The gate whose principle is never to report on something it did not check used to answer a
# caller error with a confident "sending_domain is empty".
@test "preflight refuses a path where a config object belongs" {
  run -0 _node "$RIMPORT
    try { await P.preflight({config: \"/some/path.json\", env: {}}); console.log(\"NO THROW\"); }
    catch (e) { console.log(\"THREW \" + e.message); }"
  [[ "$output" == *"THREW"* ]]
  [[ "$output" == *"parsed config OBJECT"* ]]
}

# Makes the injected fixture LOAD-BEARING. Without this every assertion above is decided before
# the first DNS call, so the whole suite passed with no fixture files at all and a broken
# LEADS_FIXTURE_DIR would have been invisible -- the shape behind this repo's
# eight-tests-passed-on-Linux-and-macOS Windows failure.
@test "the run reaches the live DNS rows and reads them from the injected fixture" {
  _dns '{"automemory.ai": ["v=spf1 include:zoho.in ~all"]}'
  run -0 _node "$RIMPORT console.log(await rule(REH, ON, \"spf\"));"
  [[ "$output" == *"PASS"* ]]
  [[ "$output" == *"include:zoho.in"* ]]
}

# LAST on purpose: BATS_TEST_NUMBER is then the count bats actually registered AND REACHED, so
# comparing it against what the file declares catches a declared test that never ran. The
# previous version compared a grep against a literal and called that "declares and executes" --
# it printed ok on a file where bats itself warned "Executed 13 instead of expected 14".
#
# The declaration grep is bats OWN pattern (leading blanks allowed, blank after @test), not
# `^@test `. The narrower anchor missed three forms bats executes, so a test could be added
# without the count noticing and a non-ASCII name on such a line slipped past the check below.
@test "this suite declares as many tests as bats reached" {
  declared="$(grep -cE '^[[:blank:]]*@test[[:blank:]]' "$BATS_TEST_FILENAME")"
  [ "$BATS_TEST_NUMBER" -eq "$declared" ] || {
    echo "file declares $declared test(s); bats reached $BATS_TEST_NUMBER"; false; }
  offenders="$(grep -E '^[[:blank:]]*@test[[:blank:]]' "$BATS_TEST_FILENAME" | LC_ALL=C grep -c '[^ -~]' || true)"
  [ "$offenders" -eq 0 ] || { echo "$offenders @test name(s) carry non-ASCII bytes"; false; }
}
