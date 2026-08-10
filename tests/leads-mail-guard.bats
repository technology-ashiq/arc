#!/usr/bin/env bats
# leads Phase 04 -- the notification mail path: allowlist, quota, timestamps, credentials.
#
# The load-bearing test in this file is "a non-allowlisted recipient is refused BEFORE any
# network call". It is asserted by pointing the real mailer at an unreachable endpoint and
# demanding an ALLOWLIST refusal: if the guard ever moved below the transport, that test would
# come back with a transport error instead, which is a different string and a failing test.
# An assertion that merely checked "it refused" would pass either way and prove nothing. The
# same technique now covers the from-address and subject guards, which previously asserted only
# a refusal KIND that a mutant moved below the send still produces.
#
# Every embedded node program here is single-quoted in the shell, so it carries no apostrophes
# and no single quotes -- in code OR in comments. One apostrophe closes the shell string and
# the rest of the program is expanded by bash. This has landed in this repo twice.
#
# NO SHELL PATH IS EVER INTERPOLATED INTO AN EMBEDDED PROGRAM. A path bats hands out is a path
# Git Bash resolves and node does not, which is why eight tests in this file passed on Linux and
# macOS and failed on the Windows leg. Every temp directory is made BY node, inside the program
# that uses it, or by _tmpdir which prints a native path.
#
# Addresses are RFC 2606 reserved only -- example.com/.net/.org, .test, .invalid. The PII
# tripwire refuses any other domain in a test path, and it refused an earlier draft of this file
# thirty times over.
#
# Test names are ASCII only: bats silently DROPS a test whose name holds a non-ASCII character,
# and the only signal is a falling count -- which is why the last test asserts the count.
bats_require_minimum_version 1.5.0
load 'test_helper'

MAIL='./.claude/scripts/leads/lib/mail.mjs'
DEPS='./.claude/scripts/leads/lib/deps.mjs'
ENVM='./.claude/scripts/leads/lib/env.mjs'

# Runs a module-level program with the fakes ON. Used for the policy tests, which must not
# reach a network at all.
_m() { cd "$ARC_ROOT" && ARC_LEADS_FAKE=1 LEADS_FIXTURE_DIR="$ARC_ROOT/tests/fixtures/leads" run node --input-type=module -e "$1"; }

# A native temp directory, made by node so the path is one node can resolve on every leg.
_tmpdir() { cd "$ARC_ROOT" && node -e 'const fs=require("node:fs"),os=require("node:os"),p=require("node:path");process.stdout.write(fs.mkdtempSync(p.join(os.tmpdir(),"mail")))'; }

# A native path to an EMPTY file. `/dev/null` is not that path: Git Bash rewrites it to `nul`
# on the way into argv and node then resolves it against the working directory, so the Windows
# leg failed with ENOENT while asserting a refusal about emptiness -- red for the right reason
# and the wrong cause, in a file whose own header forbids handing shell paths to node.
_emptyfile() { cd "$ARC_ROOT" && node -e 'const fs=require("node:fs"),os=require("node:os"),p=require("node:path");const d=fs.mkdtempSync(p.join(os.tmpdir(),"mail"));const f=p.join(d,"empty.txt");fs.writeFileSync(f,"");process.stdout.write(f)'; }

_cli() { cd "$ARC_ROOT" && node .claude/scripts/leads/arc-leads.mjs "$@"; }

# ---------- the code-path test: the real mailer reaches its own code ----------

@test "the real mailer module reaches its own code and exits with its own failure code" {
  cd "$ARC_ROOT"
  run env -u ARC_LEADS_FAKE RESEND_API_KEY="re_test_key_not_real_000000" ARC_LEADS_MAIL_BASE_URL="https://127.0.0.1:1" node --input-type=module -e '
    const {mailer, ProviderError} = await import("./.claude/scripts/leads/lib/deps.mjs");
    try { await mailer().send({to:"a@b.example.com", from:"c@d.example.com", subject:"s", text:"t", idem_key:"k"}); console.log("UNEXPECTED-SUCCESS"); }
    catch (e) { console.log(e instanceof ProviderError ? "ProviderError:" + e.kind : "WRONG-ERROR:" + e.constructor.name); }'
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"ProviderError:transport"* ]]
}

@test "the real mailer refuses when RESEND_API_KEY is unset" {
  cd "$ARC_ROOT"
  run env -u ARC_LEADS_FAKE -u RESEND_API_KEY node --input-type=module -e '
    const {mailer} = await import("./.claude/scripts/leads/lib/deps.mjs");
    try { await mailer().send({to:"a@b.example.com"}); console.log("UNEXPECTED-SUCCESS"); } catch (e) { console.log("KIND:" + e.kind); }'
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"KIND:config"* ]]
}

@test "no refusal message leaks the key WHILE a key is actually set" {
  # The earlier version of this test ran with RESEND_API_KEY unset, so its "output does not
  # contain re_" assertion could not fail: there was no key value in the process to leak. The
  # key is set here, and refusals from three different guards are inspected, so the negative
  # assertion has something to catch.
  cd "$ARC_ROOT"
  run env -u ARC_LEADS_FAKE RESEND_API_KEY="re_livekeyshapedvalue_00000000" ARC_LEADS_MAIL_BASE_URL="https://127.0.0.1:1" node --input-type=module -e '
    const M = await import("./.claude/scripts/leads/lib/mail.mjs");
    const {mailer} = await import("./.claude/scripts/leads/lib/deps.mjs");
    const seen = [];
    try { M.loadAllowlist({}); } catch (e) { seen.push(e.message); }
    try { M.assertAllowed("nobody@example.org", new Set(["owner@example.com"])); } catch (e) { seen.push(e.message); }
    try { M.assertTimestamp("2026-08-08"); } catch (e) { seen.push(e.message); }
    try { await mailer().send({to:"a@b.example.com", from:"c@d.example.com", subject:"s", text:"t", idem_key:"k"}); } catch (e) { seen.push(e.message); }
    console.log("COUNT:" + seen.length);
    console.log("JOINED:" + seen.join(" | "));'
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"COUNT:4"* ]] || { echo "not every guard refused: $output"; false; }
  [[ "$output" != *"re_livekeyshapedvalue"* ]]
}

# ---------- decodeMailResponse ----------

@test "a 5xx from the mail vendor is a transport failure and not a refusal" {
  _m '
    const {decodeMailResponse} = await import("./.claude/scripts/leads/lib/deps.mjs");
    try { decodeMailResponse(500, "{}"); console.log("UNEXPECTED-ACK"); }
    catch (e) { console.log("KIND:" + e.kind); }'
  [ "$status" -eq 0 ]
  [[ "$output" == *"KIND:transport"* ]]
}

@test "a 429 is a transport failure AND names the quota" {
  # Both halves are asserted. The first version checked only that the message said "quota",
  # and the hint is computed from its own separate test of the status code -- so dropping
  # `code === 429` from the KIND expression left the message byte-identical and the test green.
  _m '
    const {decodeMailResponse} = await import("./.claude/scripts/leads/lib/deps.mjs");
    try { decodeMailResponse(429, "{}"); console.log("UNEXPECTED-ACK"); }
    catch (e) { console.log("KIND:" + e.kind + " MSG:" + e.message); }'
  [ "$status" -eq 0 ]
  [[ "$output" == *"KIND:transport"* ]]
  [[ "$output" == *"quota"* ]]
}

@test "a 4xx from the mail vendor is a refusal" {
  _m '
    const {decodeMailResponse} = await import("./.claude/scripts/leads/lib/deps.mjs");
    try { decodeMailResponse(400, "{}"); console.log("UNEXPECTED-ACK"); }
    catch (e) { console.log("KIND:" + e.kind); }'
  [ "$status" -eq 0 ]
  [[ "$output" == *"KIND:refused"* ]]
}

@test "an unparseable 2xx body is refused" {
  _m '
    const {decodeMailResponse} = await import("./.claude/scripts/leads/lib/deps.mjs");
    try { decodeMailResponse(200, "not json at all"); console.log("UNEXPECTED-ACK"); }
    catch (e) { console.log("KIND:" + e.kind); }'
  [ "$status" -eq 0 ]
  [[ "$output" == *"KIND:refused"* ]]
}

@test "a 2xx with an empty or whitespace-only message id is not an ack" {
  # `!parsed.id` measures LENGTH; the property wanted is content. A single space is exactly as
  # unmatchable against the vendor dashboard as the empty string, and would have been written
  # into the delivery log and printed to the CI log as a blank id.
  _m '
    const {decodeMailResponse} = await import("./.claude/scripts/leads/lib/deps.mjs");
    const cases = [JSON.stringify({id:""}), JSON.stringify({id:" "}), JSON.stringify({id:"\n"}), JSON.stringify({id:"\t "})];
    let refused = 0;
    for (const c of cases) { try { decodeMailResponse(200, c); } catch (e) { if (e.kind === "refused") refused++; } }
    console.log("REFUSED:" + refused + "/" + cases.length);'
  [ "$status" -eq 0 ]
  [[ "$output" == *"REFUSED:4/4"* ]]
}

@test "the vendor error body is never echoed into the message" {
  _m '
    const {decodeMailResponse} = await import("./.claude/scripts/leads/lib/deps.mjs");
    const body = JSON.stringify({error:"rejected recipient victim@example.net"});
    try { decodeMailResponse(422, body); console.log("UNEXPECTED-ACK"); }
    catch (e) { console.log("MSG:" + e.message); }'
  [ "$status" -eq 0 ]
  [[ "$output" == *"MSG:"* ]] || { echo "the program did not run: $output"; false; }
  [[ "$output" != *"victim@example.net"* ]]
}

@test "a 2xx ack returns the vendor message id" {
  _m '
    const {decodeMailResponse} = await import("./.claude/scripts/leads/lib/deps.mjs");
    console.log("ID:" + decodeMailResponse(200, JSON.stringify({id:"abc123"})).id);'
  [ "$status" -eq 0 ]
  [[ "$output" == *"ID:abc123"* ]]
}

# ---------- the allowlist ----------

@test "an unset allowlist refuses to send and is not read as everyone" {
  _m '
    const {loadAllowlist} = await import("./.claude/scripts/leads/lib/mail.mjs");
    try { loadAllowlist({}); console.log("UNEXPECTED-PASS"); } catch (e) { console.log("KIND:" + e.kind); }'
  [ "$status" -eq 0 ]
  [[ "$output" == *"KIND:config"* ]]
}

@test "an allowlist of only whitespace or only commas refuses" {
  _m '
    const {loadAllowlist} = await import("./.claude/scripts/leads/lib/mail.mjs");
    const cases = ["   ", ",,,", "", " , , "];
    let refused = 0;
    for (const c of cases) { try { loadAllowlist({ARC_LEADS_MAIL_ALLOWLIST:c}); } catch (e) { if (e.kind === "config") refused++; } }
    console.log("REFUSED:" + refused + "/" + cases.length);'
  [ "$status" -eq 0 ]
  [[ "$output" == *"REFUSED:4/4"* ]]
}

@test "allowlist matching survives case and surrounding whitespace" {
  _m '
    const {loadAllowlist, assertAllowed} = await import("./.claude/scripts/leads/lib/mail.mjs");
    const a = loadAllowlist({ARC_LEADS_MAIL_ALLOWLIST:"  Owner@Example.COM , other@example.org "});
    console.log("OK:" + assertAllowed("OWNER@example.com", a));'
  [ "$status" -eq 0 ]
  [[ "$output" == *"OK:owner@example.com"* ]]
}

@test "a zero-width character inside the recipient still matches the allowlist" {
  _m '
    const {loadAllowlist, assertAllowed} = await import("./.claude/scripts/leads/lib/mail.mjs");
    const a = loadAllowlist({ARC_LEADS_MAIL_ALLOWLIST:"owner@example.com"});
    const sneaky = "owner@exam" + String.fromCodePoint(0x200B) + "ple.com";
    try { console.log("OK:" + assertAllowed(sneaky, a)); } catch (e) { console.log("REFUSED:" + e.kind); }'
  [ "$status" -eq 0 ]
  [[ "$output" == *"OK:owner@example.com"* ]]
}

@test "a non-allowlisted recipient is refused BEFORE any network call" {
  cd "$ARC_ROOT"
  local dir; dir="$(_tmpdir)"
  [ -n "$dir" ] || { echo "the temp dir was not created"; false; }
  run env -u ARC_LEADS_FAKE \
    RESEND_API_KEY="re_test_key_not_real_000000" \
    ARC_LEADS_MAIL_FROM="arc@example.com" \
    ARC_LEADS_MAIL_ALLOWLIST="owner@example.com" \
    ARC_LEADS_MAIL_BASE_URL="https://127.0.0.1:1" \
    MAILSTORE="$dir" \
    node --input-type=module -e '
    const {sendNotification} = await import("./.claude/scripts/leads/lib/mail.mjs");
    try {
      await sendNotification({to:"stranger@example.org", subject:"s", text:"t"},
        {storeDir: process.env.MAILSTORE, nowTs:"2026-08-08T10:00:00+05:30", argv:[]});
      console.log("UNEXPECTED-SEND");
    } catch (e) { console.log("NAME:" + e.name + " KIND:" + (e.kind || "none")); }'
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # The endpoint is unreachable, so a guard that ran AFTER the transport would report
  # ProviderError:transport here. Demanding the allowlist name is what pins the ordering.
  [[ "$output" == *"NAME:MailRefusal KIND:allowlist"* ]]
}

@test "an unset from address is refused before the transport" {
  # Same unreachable-endpoint technique as the allowlist case. Asserting only KIND:config would
  # be satisfied by a mutant that moved this guard BELOW the send -- which against a real vendor
  # is a delivered mail reported to the operator as a configuration refusal.
  cd "$ARC_ROOT"
  local dir; dir="$(_tmpdir)"
  [ -n "$dir" ] || { echo "the temp dir was not created"; false; }
  run env -u ARC_LEADS_FAKE -u ARC_LEADS_MAIL_FROM \
    RESEND_API_KEY="re_test_key_not_real_000000" \
    ARC_LEADS_MAIL_ALLOWLIST="owner@example.com" \
    ARC_LEADS_MAIL_BASE_URL="https://127.0.0.1:1" \
    MAILSTORE="$dir" \
    node --input-type=module -e '
    const {sendNotification} = await import("./.claude/scripts/leads/lib/mail.mjs");
    try {
      await sendNotification({to:"owner@example.com", subject:"s", text:"t"},
        {storeDir: process.env.MAILSTORE, nowTs:"2026-08-08T10:00:00+05:30", argv:[]});
      console.log("UNEXPECTED-SEND");
    } catch (e) { console.log("NAME:" + e.name + " KIND:" + (e.kind || "none")); }'
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"NAME:MailRefusal KIND:config"* ]]
}

@test "a send with no subject is refused before the transport" {
  cd "$ARC_ROOT"
  local dir; dir="$(_tmpdir)"
  [ -n "$dir" ] || { echo "the temp dir was not created"; false; }
  run env -u ARC_LEADS_FAKE \
    RESEND_API_KEY="re_test_key_not_real_000000" \
    ARC_LEADS_MAIL_FROM="arc@example.com" \
    ARC_LEADS_MAIL_ALLOWLIST="owner@example.com" \
    ARC_LEADS_MAIL_BASE_URL="https://127.0.0.1:1" \
    MAILSTORE="$dir" \
    node --input-type=module -e '
    const {sendNotification} = await import("./.claude/scripts/leads/lib/mail.mjs");
    try {
      await sendNotification({to:"owner@example.com", subject:"", text:"t"},
        {storeDir: process.env.MAILSTORE, nowTs:"2026-08-08T10:00:00+05:30", argv:[]});
      console.log("UNEXPECTED-SEND");
    } catch (e) { console.log("NAME:" + e.name + " KIND:" + (e.kind || "none")); }'
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"NAME:MailRefusal KIND:config"* ]]
}

@test "the refused recipient address is not echoed in the refusal" {
  _m '
    const {loadAllowlist, assertAllowed} = await import("./.claude/scripts/leads/lib/mail.mjs");
    const a = loadAllowlist({ARC_LEADS_MAIL_ALLOWLIST:"owner@example.com"});
    try { assertAllowed("victim@example.net", a); console.log("UNEXPECTED-PASS"); } catch (e) { console.log("MSG:" + e.message); }'
  [ "$status" -eq 0 ]
  [[ "$output" == *"MSG:"* ]] || { echo "the program did not run: $output"; false; }
  [[ "$output" != *"victim@example.net"* ]]
}

@test "an empty recipient is refused rather than normalised into a match" {
  _m '
    const {loadAllowlist, assertAllowed} = await import("./.claude/scripts/leads/lib/mail.mjs");
    const a = loadAllowlist({ARC_LEADS_MAIL_ALLOWLIST:"owner@example.com"});
    let refused = 0;
    for (const v of ["", "   ", null, undefined]) { try { assertAllowed(v, a); } catch (e) { if (e.kind === "allowlist") refused++; } }
    console.log("REFUSED:" + refused + "/4");'
  [ "$status" -eq 0 ]
  [[ "$output" == *"REFUSED:4/4"* ]]
}

# ---------- the quota ----------
#
# Every fixture below is built BY NODE inside its own program, and each asserts its own fixture
# is the size it meant to be before asserting anything about the reading of it. A fixture
# builder that silently produced nothing is a pass generator.

@test "the daily cap refuses the send that would cross it" {
  _m '
    const fs = await import("node:fs"), os = await import("node:os"), path = await import("node:path");
    const {assertQuota} = await import("./.claude/scripts/leads/lib/mail.mjs");
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "mailq"));
    const line = JSON.stringify({ts:"2026-08-08T09:00:00+05:30", to:"owner@example.com", id:"x", kind:"notify"}) + "\n";
    fs.writeFileSync(path.join(d, "mail-log.jsonl"), line.repeat(100));
    const built = fs.readFileSync(path.join(d, "mail-log.jsonl"), "utf8").split("\n").filter(Boolean).length;
    console.log("FIXTURE:" + built);
    try { assertQuota(d, "2026-08-08T10:00:00+05:30"); console.log("UNEXPECTED-PASS"); }
    catch (e) { console.log("KIND:" + e.kind); }'
  [ "$status" -eq 0 ]
  [[ "$output" == *"FIXTURE:100"* ]] || { echo "the fixture was not built: $output"; false; }
  [[ "$output" == *"KIND:quota"* ]]
}

@test "the monthly cap refuses the send that would cross it" {
  # There was no test for the monthly rule at all: deleting the second half of assertQuota left
  # every test in this file green while the 3001st send of a month went to the vendor and 429ed.
  _m '
    const fs = await import("node:fs"), os = await import("node:os"), path = await import("node:path");
    const {assertQuota} = await import("./.claude/scripts/leads/lib/mail.mjs");
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "mailq"));
    const line = JSON.stringify({ts:"2026-08-01T09:00:00+05:30", to:"owner@example.com", id:"x", kind:"notify"}) + "\n";
    fs.writeFileSync(path.join(d, "mail-log.jsonl"), line.repeat(3000));
    const built = fs.readFileSync(path.join(d, "mail-log.jsonl"), "utf8").split("\n").filter(Boolean).length;
    console.log("FIXTURE:" + built);
    const q = (await import("./.claude/scripts/leads/lib/mail.mjs")).readQuota(d, "2026-08-08T10:00:00+05:30");
    console.log("DAY:" + q.day + " MONTH:" + q.month);
    try { assertQuota(d, "2026-08-08T10:00:00+05:30"); console.log("UNEXPECTED-PASS"); }
    catch (e) { console.log("KIND:" + e.kind + " MSG:" + e.message); }'
  [ "$status" -eq 0 ]
  [[ "$output" == *"FIXTURE:3000"* ]] || { echo "the fixture was not built: $output"; false; }
  # Day zero proves the DAILY rule is not the one firing -- otherwise this test would pass
  # against a monthly cap that had been deleted.
  [[ "$output" == *"DAY:0 MONTH:3000"* ]]
  [[ "$output" == *"KIND:quota"* ]]
  [[ "$output" == *"monthly"* ]]
}

@test "yesterday sends do not count against today" {
  _m '
    const fs = await import("node:fs"), os = await import("node:os"), path = await import("node:path");
    const {readQuota} = await import("./.claude/scripts/leads/lib/mail.mjs");
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "mailq"));
    const line = JSON.stringify({ts:"2026-08-07T09:00:00+05:30", to:"owner@example.com", id:"x", kind:"notify"}) + "\n";
    fs.writeFileSync(path.join(d, "mail-log.jsonl"), line.repeat(100));
    console.log("FIXTURE:" + fs.readFileSync(path.join(d, "mail-log.jsonl"), "utf8").split("\n").filter(Boolean).length);
    const q = readQuota(d, "2026-08-08T10:00:00+05:30");
    console.log("DAY:" + q.day + " MONTH:" + q.month);'
  [ "$status" -eq 0 ]
  [[ "$output" == *"FIXTURE:100"* ]] || { echo "the fixture was not built: $output"; false; }
  [[ "$output" == *"DAY:0 MONTH:100"* ]]
}

@test "a malformed log line consumes quota rather than restoring it" {
  _m '
    const fs = await import("node:fs"), os = await import("node:os"), path = await import("node:path");
    const {readQuota} = await import("./.claude/scripts/leads/lib/mail.mjs");
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "mailq"));
    fs.writeFileSync(path.join(d, "mail-log.jsonl"), "this is not json\n7\n[1,2]\n{\"ts\":null}\n");
    const q = readQuota(d, "2026-08-08T10:00:00+05:30");
    console.log("DAY:" + q.day + " MONTH:" + q.month + " MALFORMED:" + q.malformed);'
  [ "$status" -eq 0 ]
  [[ "$output" == *"DAY:4 MONTH:4 MALFORMED:4"* ]]
}

@test "a whitespace-only log line consumes quota rather than being skipped" {
  # `line.trim() === ""` exempted spaces, tabs and NBSP from the consumed-a-send rule, so a log
  # corrupted to blanks silently restored the whole day. Only a truly empty line is the trailing
  # newline every append leaves.
  _m '
    const fs = await import("node:fs"), os = await import("node:os"), path = await import("node:path");
    const {readQuota} = await import("./.claude/scripts/leads/lib/mail.mjs");
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "mailq"));
    fs.writeFileSync(path.join(d, "mail-log.jsonl"), "   \n\t\n" + String.fromCodePoint(0x00a0) + "\n");
    const q = readQuota(d, "2026-08-08T10:00:00+05:30");
    console.log("DAY:" + q.day + " MALFORMED:" + q.malformed);'
  [ "$status" -eq 0 ]
  [[ "$output" == *"DAY:3 MALFORMED:3"* ]]
}

@test "a log entry with an unusable timestamp counts rather than being skipped" {
  _m '
    const fs = await import("node:fs"), os = await import("node:os"), path = await import("node:path");
    const {readQuota} = await import("./.claude/scripts/leads/lib/mail.mjs");
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "mailq"));
    fs.writeFileSync(path.join(d, "mail-log.jsonl"), JSON.stringify({ts:"not-a-date", id:"x"}) + "\n");
    const q = readQuota(d, "2026-08-08T10:00:00+05:30");
    console.log("DAY:" + q.day + " MALFORMED:" + q.malformed);'
  [ "$status" -eq 0 ]
  [[ "$output" == *"DAY:1 MALFORMED:1"* ]]
}

@test "an absent log is zero and not an error" {
  _m '
    const fs = await import("node:fs"), os = await import("node:os"), path = await import("node:path");
    const {readQuota} = await import("./.claude/scripts/leads/lib/mail.mjs");
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "mailq"));
    const q = readQuota(d, "2026-08-08T10:00:00+05:30");
    console.log("DAY:" + q.day + " MONTH:" + q.month);'
  [ "$status" -eq 0 ]
  [[ "$output" == *"DAY:0 MONTH:0"* ]]
}

@test "a log that cannot be read fails CLOSED and is not read as an empty day" {
  # `existsSync` answered false for EVERY error, not only for absent, so a broken store path,
  # EACCES, ELOOP and a dangling symlink were all met with the full daily allowance -- the exact
  # fail-open the unreadable-file branch was written to prevent, reintroduced one line above it.
  #
  # A regular file where the store directory should be is the shape used here, and it is also
  # the one that exposed the second bug: Linux and macOS report ENOTDIR for that path while
  # Windows reports ENOENT, so a fix that trusted the error code alone failed closed on two legs
  # and open on the third. The ENOENT branch now confirms the store is a directory.
  _m '
    const fs = await import("node:fs"), os = await import("node:os"), path = await import("node:path");
    const {readQuota} = await import("./.claude/scripts/leads/lib/mail.mjs");
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "mailq"));
    const notADir = path.join(d, "notadir");
    fs.writeFileSync(notADir, "x");
    console.log("FIXTURE:" + fs.statSync(notADir).isFile());
    try { const q = readQuota(notADir, "2026-08-08T10:00:00+05:30"); console.log("FAILED-OPEN day=" + q.day); }
    catch (e) { console.log("KIND:" + e.kind); }'
  [ "$status" -eq 0 ]
  [[ "$output" == *"FIXTURE:true"* ]] || { echo "the fixture was not built: $output"; false; }
  [[ "$output" == *"KIND:log"* ]]
}

@test "a refused send does not consume quota" {
  _m '
    const fs = await import("node:fs"), os = await import("node:os"), path = await import("node:path");
    const {sendNotification, readQuota} = await import("./.claude/scripts/leads/lib/mail.mjs");
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "mailq"));
    const env = {ARC_LEADS_MAIL_FROM:"arc@example.com", ARC_LEADS_MAIL_ALLOWLIST:"owner@example.com"};
    try { await sendNotification({to:"stranger@example.org", subject:"s", text:"t"}, {storeDir:d, nowTs:"2026-08-08T10:00:00+05:30", env, argv:[]}); console.log("UNEXPECTED-SEND"); }
    catch (e) { console.log("KIND:" + e.kind); }
    console.log("DAY:" + readQuota(d, "2026-08-08T10:00:00+05:30").day);'
  [ "$status" -eq 0 ]
  [[ "$output" == *"KIND:allowlist"* ]]
  [[ "$output" == *"DAY:0"* ]]
}

# ---------- the house timestamp grammar ----------

@test "a date-only timestamp is refused rather than collapsing the day onto one key" {
  _m '
    const {assertTimestamp} = await import("./.claude/scripts/leads/lib/mail.mjs");
    try { assertTimestamp("2026-08-08"); console.log("UNEXPECTED-PASS"); } catch (e) { console.log("KIND:" + e.kind); }'
  [ "$status" -eq 0 ]
  [[ "$output" == *"KIND:config"* ]]
}

@test "a timestamp in a non-IST offset is refused rather than bucketed to the wrong day" {
  _m '
    const {assertTimestamp} = await import("./.claude/scripts/leads/lib/mail.mjs");
    const cases = ["2026-08-08T19:00:00Z", "2026-08-08T19:00:00+00:00", "2026-08-08T19:00:00", "2026-08-08T19:00:00+05:30extra", ""];
    let refused = 0;
    for (const c of cases) { try { assertTimestamp(c); } catch (e) { if (e.kind === "config") refused++; } }
    console.log("REFUSED:" + refused + "/" + cases.length);'
  [ "$status" -eq 0 ]
  [[ "$output" == *"REFUSED:5/5"* ]]
}

@test "the house timestamp grammar is accepted" {
  _m '
    const {assertTimestamp} = await import("./.claude/scripts/leads/lib/mail.mjs");
    console.log("OK:" + assertTimestamp("2026-08-08T10:00:00+05:30"));'
  [ "$status" -eq 0 ]
  [[ "$output" == *"OK:2026-08-08T10:00:00+05:30"* ]]
}

@test "sendNotification refuses a malformed timestamp before it reaches the transport" {
  _m '
    const fs = await import("node:fs"), os = await import("node:os"), path = await import("node:path");
    const {sendNotification} = await import("./.claude/scripts/leads/lib/mail.mjs");
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "mailq"));
    const env = {ARC_LEADS_MAIL_FROM:"arc@example.com", ARC_LEADS_MAIL_ALLOWLIST:"owner@example.com"};
    try { await sendNotification({to:"owner@example.com", subject:"s", text:"t"}, {storeDir:d, nowTs:"2026-08-08", env, argv:[]}); console.log("UNEXPECTED-SEND"); }
    catch (e) { console.log("KIND:" + e.kind); }'
  [ "$status" -eq 0 ]
  [[ "$output" == *"KIND:config"* ]]
}

# ---------- the idempotency key ----------

@test "the same message inside one minute produces the same idempotency key" {
  _m '
    const {mailIdemKey} = await import("./.claude/scripts/leads/lib/mail.mjs");
    const a = mailIdemKey({to:"owner@example.com", subject:"s", text:"t", nowTs:"2026-08-08T10:00:01+05:30"});
    const b = mailIdemKey({to:"owner@example.com", subject:"s", text:"t", nowTs:"2026-08-08T10:00:59+05:30"});
    console.log("SAME:" + (a === b));'
  [ "$status" -eq 0 ]
  [[ "$output" == *"SAME:true"* ]]
}

@test "the same message in the next minute produces a different idempotency key" {
  _m '
    const {mailIdemKey} = await import("./.claude/scripts/leads/lib/mail.mjs");
    const a = mailIdemKey({to:"owner@example.com", subject:"s", text:"t", nowTs:"2026-08-08T10:00:59+05:30"});
    const b = mailIdemKey({to:"owner@example.com", subject:"s", text:"t", nowTs:"2026-08-08T10:01:00+05:30"});
    console.log("SAME:" + (a === b));'
  [ "$status" -eq 0 ]
  [[ "$output" == *"SAME:false"* ]]
}

@test "two DIFFERENT notifications in the same minute produce different keys" {
  # The property the field separator exists for, and the one nothing tested: both key tests
  # varied only the timestamp. With a naive separator, subject "canary failed" + body "phase 04"
  # and subject "canary" + body "failed phase 04" hash identically, the vendor dedups them
  # inside its 24h window, and the second incident is silently never delivered.
  _m '
    const {mailIdemKey} = await import("./.claude/scripts/leads/lib/mail.mjs");
    const t = "2026-08-08T10:00:00+05:30";
    const keys = new Set([
      mailIdemKey({to:"owner@example.com", subject:"canary failed", text:"phase 04", nowTs:t}),
      mailIdemKey({to:"owner@example.com", subject:"canary", text:"failed phase 04", nowTs:t}),
      mailIdemKey({to:"owner@example.com", subject:"canary faile", text:"dphase 04", nowTs:t}),
      mailIdemKey({to:"other@example.org", subject:"canary failed", text:"phase 04", nowTs:t}),
      mailIdemKey({to:"owner@example.com", subject:"canary failed", text:"phase 04", nowTs:t, kind:"brief"}),
    ]);
    console.log("DISTINCT:" + keys.size + "/5");'
  [ "$status" -eq 0 ]
  [[ "$output" == *"DISTINCT:5/5"* ]]
}

@test "the mail modules carry no literal control byte in their source" {
  # The first separator was a raw NUL typed into the source: invisible in every editor, in the
  # diff and in the file-reading tools, and enough to make ripgrep classify the module as binary
  # and stop printing its lines to review tooling. store.mjs already states the rule -- control
  # characters are written as escapes, never as literal bytes -- and it had not been checked.
  _m '
    const fs = await import("node:fs");
    const files = [
      ".claude/scripts/leads/lib/mail.mjs",
      ".claude/scripts/leads/lib/env.mjs",
      ".claude/scripts/leads/lib/deps.mjs",
      ".claude/scripts/leads/arc-leads.mjs",
    ];
    let bad = 0;
    for (const f of files) {
      const b = fs.readFileSync(f);
      for (const byte of b) if (byte < 9 || (byte > 13 && byte < 32) || byte === 127) bad++;
    }
    console.log("SCANNED:" + files.length + " CONTROL:" + bad);'
  [ "$status" -eq 0 ]
  [[ "$output" == *"SCANNED:4 CONTROL:0"* ]]
}

# ---------- the credential must not travel by argv ----------

@test "the actual key anywhere in argv is refused" {
  _m '
    const {assertKeyNotInArgv} = await import("./.claude/scripts/leads/lib/mail.mjs");
    const env = {RESEND_API_KEY:"re_realkeyvalue_0123456789"};
    try { assertKeyNotInArgv(["node", "x", "--k=re_realkeyvalue_0123456789"], env); console.log("UNEXPECTED-PASS"); }
    catch (e) { console.log("KIND:" + e.kind + " MSG:" + e.message); }'
  [ "$status" -eq 0 ]
  [[ "$output" == *"KIND:config"* ]]
  [[ "$output" != *"re_realkeyvalue_0123456789"* ]]
}

@test "a key-shaped token is refused in every delimiter shape, not only after an equals sign" {
  # The anchored form caught `--key=re_...` -- the one shape its own test used -- and let five
  # of ten realistic shapes through. A key is a leak wherever in the argument it sits.
  _m '
    const {assertKeyNotInArgv} = await import("./.claude/scripts/leads/lib/mail.mjs");
    const K = "re_abcdefghijklmnopqrst";
    const shapes = [
      "--key=" + K,
      "{\"RESEND_API_KEY\":\"" + K + "\"}",
      "--key:" + K,
      "-H" + K,
      "[" + K + "]",
      "x," + K,
      "Bearer " + K,
      K,
    ];
    let refused = 0;
    for (const s of shapes) { try { assertKeyNotInArgv([s], {}); } catch (e) { if (e.kind === "config") refused++; } }
    console.log("REFUSED:" + refused + "/" + shapes.length);'
  [ "$status" -eq 0 ]
  [[ "$output" == *"REFUSED:8/8"* ]]
}

@test "ordinary arguments are not mistaken for a credential" {
  _m '
    const {assertKeyNotInArgv} = await import("./.claude/scripts/leads/lib/mail.mjs");
    assertKeyNotInArgv(["node", "arc-leads.mjs", "mail", "--to", "owner@example.com", "--subject", "re_short", "--text", "re-read the log"], {});
    console.log("ACCEPTED");'
  [ "$status" -eq 0 ]
  [[ "$output" == *"ACCEPTED"* ]]
}

# ---------- exit codes ----------

@test "a pre-send log refusal and a delivered-but-unlogged failure map to different exit codes" {
  # Both are logging failures and they mean opposite things: one is safe to retry, the other
  # means the mail is already in the inbox. Sharing exit 5 made "retry" and "never retry"
  # indistinguishable to a caller obeying the documented contract.
  _m '
    const {MAIL_EXIT} = await import("./.claude/scripts/leads/lib/mail.mjs");
    console.log("LOG:" + MAIL_EXIT.log + " SENT:" + MAIL_EXIT["sent-unlogged"] + " CONFIG:" + MAIL_EXIT.config + " QUOTA:" + MAIL_EXIT.quota);
    console.log("DISTINCT:" + (MAIL_EXIT.log !== MAIL_EXIT["sent-unlogged"]));'
  [ "$status" -eq 0 ]
  [[ "$output" == *"LOG:3 SENT:5 CONFIG:2 QUOTA:3"* ]]
  [[ "$output" == *"DISTINCT:true"* ]]
}

@test "a delivery-log write failure reports that the mail WAS sent" {
  _m '
    const fs = await import("node:fs"), os = await import("node:os"), path = await import("node:path");
    const {appendMailLog} = await import("./.claude/scripts/leads/lib/mail.mjs");
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "mailq"));
    fs.mkdirSync(path.join(d, "mail-log.jsonl"));
    console.log("FIXTURE:" + fs.statSync(path.join(d, "mail-log.jsonl")).isDirectory());
    try { appendMailLog(d, {ts:"2026-08-08T10:00:00+05:30", to:"owner@example.com", id:"vendor-1", kind:"notify"}); console.log("UNEXPECTED-PASS"); }
    catch (e) { console.log("KIND:" + e.kind + " MSG:" + e.message); }'
  [ "$status" -eq 0 ]
  [[ "$output" == *"FIXTURE:true"* ]] || { echo "the fixture was not built: $output"; false; }
  [[ "$output" == *"KIND:sent-unlogged"* ]]
  [[ "$output" == *"WAS SENT"* ]]
}

# ---------- .env.local ----------

@test "an export prefixed assignment is parsed" {
  _m '
    const {parseEnvFile} = await import("./.claude/scripts/leads/lib/env.mjs");
    const {values} = parseEnvFile("export SOME_ARC_TEST_VAR=exported\n");
    console.log("VAL:" + values.get("SOME_ARC_TEST_VAR"));'
  [ "$status" -eq 0 ]
  [[ "$output" == *"VAL:exported"* ]]
}

@test "a value containing equals signs survives, so base64 padding is not truncated" {
  _m '
    const {parseEnvFile} = await import("./.claude/scripts/leads/lib/env.mjs");
    const {values} = parseEnvFile("K=YWJjZA==\n");
    console.log("VAL:" + values.get("K"));'
  [ "$status" -eq 0 ]
  [[ "$output" == *"VAL:YWJjZA=="* ]]
}

@test "one matched quote pair is stripped and a lone quote is left alone" {
  _m '
    const {parseEnvFile} = await import("./.claude/scripts/leads/lib/env.mjs");
    const {values} = parseEnvFile("A=\"quoted\"\nB=\"lonely\nC=plain\n");
    console.log("A:" + values.get("A") + " B:" + values.get("B") + " C:" + values.get("C"));'
  [ "$status" -eq 0 ]
  [[ "$output" == *"A:quoted"* ]]
  [[ "$output" == *"B:\"lonely"* ]]
  [[ "$output" == *"C:plain"* ]]
}

@test "an unparseable line is counted and reported rather than passing silently" {
  _m '
    const {parseEnvFile} = await import("./.claude/scripts/leads/lib/env.mjs");
    const {skipped} = parseEnvFile("GOOD=1\nthis line has no equals\n=novalue\n");
    console.log("SKIPPED:" + skipped.join(","));'
  [ "$status" -eq 0 ]
  [[ "$output" == *"SKIPPED:2,3"* ]]
}

@test "an empty assignment in the FILE is reported as blank and never loaded" {
  # `RESEND_API_KEY=` is the literal result of copying .env.example. The first version assigned
  # its empty string, counted it as loaded, listed it in no warning, and the operator learned
  # about it as an auth failure at the vendor instead of a named blank here.
  _m '
    const {loadEnvLocal} = await import("./.claude/scripts/leads/lib/env.mjs");
    const fs = await import("node:fs"), os = await import("node:os"), path = await import("node:path");
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "mailenv"));
    fs.writeFileSync(path.join(d, ".env.local"), "SOME_ARC_TEST_VAR=\nOTHER_ARC_TEST_VAR=filled\n");
    const env = {};
    const r = loadEnvLocal({root:d, env});
    console.log("LOADED:" + r.loaded + " BLANK:" + r.blank.join(",") + " APPLIED:" + r.applied.join(","));
    console.log("NAMES:" + r.names.join(","));
    console.log("SET:" + JSON.stringify(env.SOME_ARC_TEST_VAR));'
  [ "$status" -eq 0 ]
  # `loaded`/`applied` are about EFFECT and still exclude the blank; `names` is about what the
  # file DECLARES and includes it, because the guard downstream refuses a forbidden name for
  # being mentioned in a credential file at all. Asserted separately so a future collapse of the
  # two lists back into one cannot pass this test.
  [[ "$output" == *"LOADED:1 BLANK:SOME_ARC_TEST_VAR APPLIED:OTHER_ARC_TEST_VAR"* ]]
  [[ "$output" == *"NAMES:SOME_ARC_TEST_VAR,OTHER_ARC_TEST_VAR"* ]]
  [[ "$output" == *"SET:undefined"* ]]
}

@test "the file guard still sees a forbidden name when the environment already holds it" {
  # THE F1 CRITICAL, as its own test. `names` used to be pushed only where the value was
  # APPLIED, and step 1 of the Phase 03 runbook is `set -a; . ./.env.local; set +a`
  # -- which sets every one of them first, so every name failed the applied test and `names`
  # came back EMPTY. The guard then saw an empty file whatever the file held, and a run with
  # ARC_LEADS_FAKE=1 in it printed "mail sent ... EXIT=0" having delivered nothing.
  #
  # The two assertions are deliberately separate. NAMES-HAS-FAKE is the policy fact; APPLIED
  # empty is the effect fact; and a mutant that collapses them back into one list makes exactly
  # one of the two fail. A single combined assertion would let the collapse through.
  _m '
    const {loadEnvLocal} = await import("./.claude/scripts/leads/lib/env.mjs");
    const {assertEnvLocalNames} = await import("./.claude/scripts/leads/lib/mail.mjs");
    const fs = await import("node:fs"), os = await import("node:os"), path = await import("node:path");
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "mailenv"));
    fs.writeFileSync(path.join(d, ".env.local"), "RESEND_API_KEY=re_x\nARC_LEADS_FAKE=1\n");
    const env = {RESEND_API_KEY:"re_x", ARC_LEADS_FAKE:"1"};
    const r = loadEnvLocal({root:d, env});
    console.log("NAMES-HAS-FAKE:" + r.names.includes("ARC_LEADS_FAKE"));
    console.log("APPLIED:" + JSON.stringify(r.applied) + " LOADED:" + r.loaded);
    try { assertEnvLocalNames(r.names); console.log("NOT-REFUSED"); }
    catch (e) { console.log("REFUSED:" + e.kind); }'
  [ "$status" -eq 0 ]
  [[ "$output" == *"NAMES-HAS-FAKE:true"* ]]
  [[ "$output" == *"APPLIED:[] LOADED:0"* ]]
  [[ "$output" == *"REFUSED:config"* ]]
  [[ "$output" != *"NOT-REFUSED"* ]]
}

@test "a forbidden name declared with an empty value is still refused" {
  # `set -a` exports ARC_LEADS_FAKE= as an empty string just as readily, and every reader that
  # today treats "" as absent is one edit away from treating it as present. The guard refuses a
  # MENTION, so it cannot be re-opened by an unrelated change to how another reader tests
  # truthiness -- a guard that has to be re-checked every time a caller changes is not a guard.
  _m '
    const {loadEnvLocal} = await import("./.claude/scripts/leads/lib/env.mjs");
    const {assertEnvLocalNames} = await import("./.claude/scripts/leads/lib/mail.mjs");
    const fs = await import("node:fs"), os = await import("node:os"), path = await import("node:path");
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "mailenv"));
    fs.writeFileSync(path.join(d, ".env.local"), "RESEND_API_KEY=re_x\nARC_LEADS_FAKE=\n");
    const r = loadEnvLocal({root:d, env:{}});
    console.log("BLANK:" + r.blank.join(",") + " NAMES:" + r.names.join(","));
    try { assertEnvLocalNames(r.names); console.log("NOT-REFUSED"); }
    catch (e) { console.log("REFUSED:" + e.kind); }'
  [ "$status" -eq 0 ]
  [[ "$output" == *"BLANK:ARC_LEADS_FAKE"* ]]
  [[ "$output" == *"REFUSED:config"* ]]
  [[ "$output" != *"NOT-REFUSED"* ]]
}

@test "positive control: an ordinary credential file loads and passes the guard" {
  # The counterpart the two tests above need. Without it, a mutant that makes `names` return
  # every name in the universe -- or makes assertEnvLocalNames throw unconditionally -- is green
  # on both of them. This one fails the moment the guard stops distinguishing.
  _m '
    const {loadEnvLocal} = await import("./.claude/scripts/leads/lib/env.mjs");
    const {assertEnvLocalNames} = await import("./.claude/scripts/leads/lib/mail.mjs");
    const fs = await import("node:fs"), os = await import("node:os"), path = await import("node:path");
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "mailenv"));
    fs.writeFileSync(path.join(d, ".env.local"), "RESEND_API_KEY=re_x\nARC_LEADS_MAIL_FROM=arc@example.com\n");
    const env = {};
    const r = loadEnvLocal({root:d, env});
    console.log("NAMES:" + r.names.join(",") + " APPLIED:" + r.applied.join(",") + " LOADED:" + r.loaded);
    assertEnvLocalNames(r.names);
    console.log("ACCEPTED-AND-APPLIED:" + (env.RESEND_API_KEY === "re_x"));'
  [ "$status" -eq 0 ]
  [[ "$output" == *"NAMES:RESEND_API_KEY,ARC_LEADS_MAIL_FROM APPLIED:RESEND_API_KEY,ARC_LEADS_MAIL_FROM LOADED:2"* ]]
  [[ "$output" == *"ACCEPTED-AND-APPLIED:true"* ]]
}

@test "the real environment wins over the file" {
  _m '
    const {loadEnvLocal} = await import("./.claude/scripts/leads/lib/env.mjs");
    const fs = await import("node:fs"), os = await import("node:os"), path = await import("node:path");
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "mailenv"));
    fs.writeFileSync(path.join(d, ".env.local"), "SOME_ARC_TEST_VAR=fromfile\n");
    const env = {SOME_ARC_TEST_VAR:"fromenv"};
    loadEnvLocal({root:d, env});
    console.log("VAL:" + env.SOME_ARC_TEST_VAR);'
  [ "$status" -eq 0 ]
  [[ "$output" == *"VAL:fromenv"* ]]
}

@test "an absent env file is not an error but an unreadable one is" {
  # Same fail-open shape as the quota log, in the sibling module: asking existsSync first meant
  # EACCES, ENOTDIR and a dangling symlink were all reported as "no credentials here", which is
  # exactly the go-looking-in-the-wrong-place outcome the throw exists to prevent.
  _m '
    const {loadEnvLocal, EnvError} = await import("./.claude/scripts/leads/lib/env.mjs");
    const fs = await import("node:fs"), os = await import("node:os"), path = await import("node:path");
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "mailenv"));
    console.log("ABSENT:" + loadEnvLocal({root:d, env:{}}).present);
    const notADir = path.join(d, "notadir");
    fs.writeFileSync(notADir, "x");
    try { loadEnvLocal({root:notADir, env:{}}); console.log("FAILED-OPEN"); }
    catch (e) { console.log("THROWN:" + (e instanceof EnvError) + " KIND:" + e.kind); }'
  [ "$status" -eq 0 ]
  [[ "$output" == *"ABSENT:false"* ]]
  [[ "$output" == *"THROWN:true KIND:unreadable"* ]]
}

@test "a credential file may not set the test doors or redirect the vendor host" {
  # The startup guard runs at module evaluation, BEFORE .env.local is read, so a file setting
  # ARC_LEADS_FAKE=1 would otherwise walk past it and switch the notification path to the fake:
  # mail sent, exit 0, nothing delivered. ARC_LEADS_MAIL_BASE_URL redirects the Bearer header.
  # THE NAMES ARE WRITTEN OUT HERE, not read out of the module under test. `N/N` derived from
  # `ENV_LOCAL_FORBIDDEN.length` on both sides can never see a name that is MISSING from the
  # list -- which is exactly how five separate steering variables were absent across four
  # adversarial rounds -- and a substring assertion for `ARC_LEADS_REHEARSAL` is satisfied by
  # `ARC_LEADS_REHEARSAL_ALLOWLIST`, so a mutant swapping the two passed every check while
  # re-opening the product-domain unlock AND refusing the allowlist the runbook requires.
  #
  # The guard is now an ALLOWLIST over three families, so the meaningful assertion is that a
  # name nobody has thought of is refused BY DEFAULT. That is the property that stops round six.
  _m '
    const {assertEnvLocalNames, ENV_LOCAL_ALLOWED} = await import("./.claude/scripts/leads/lib/mail.mjs");
    const mustRefuse = ["ARC_LEADS_FAKE","ARC_LEADS_NOW","ARC_LEADS_STORE","ARC_LEADS_MAIL_BASE_URL",
      "LEADS_FIXTURE_DIR","LEADS_PROVIDER_BASE_URL","LEADS_CONFIG","LEADS_WARMUP_APPROVED",
      "ARC_LEADS_REHEARSAL","ARC_SPINE_ROOT","ARC_SPINE_NOW","ARC_SPINE_RAND",
      "LEADS_A_VARIABLE_NOBODY_HAS_INVENTED_YET","arc_leads_fake"];
    let refused = 0;
    const escaped = [];
    for (const n of mustRefuse) {
      try { assertEnvLocalNames(["RESEND_API_KEY", n]); escaped.push(n); }
      catch (e) { if (e.kind === "config") refused++; else escaped.push(n); }
    }
    console.log("REFUSED:" + refused + "/" + mustRefuse.length);
    console.log("ESCAPED:" + (escaped.length ? escaped.join(",") : "none"));
    console.log("ALLOWED:" + ENV_LOCAL_ALLOWED.join(","));
    assertEnvLocalNames(["RESEND_API_KEY", ...ENV_LOCAL_ALLOWED, "SUPABASE_URL", "STRIPE_SECRET_KEY"]);
    console.log("CREDENTIALS-ACCEPTED");'
  [ "$status" -eq 0 ]
  [[ "$output" == *"REFUSED:14/14"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ESCAPED:none"* ]] || { echo "$output"; false; }
  # The allowlist must hold the recipient-policy names and NOTHING that steers a send. Asserted
  # positively, so shrinking it (which would refuse the runbook's own required variables) fails
  # here rather than at the operator.
  [[ "$output" == *"ALLOWED:ARC_LEADS_MAIL_FROM,ARC_LEADS_MAIL_ALLOWLIST,ARC_LEADS_REHEARSAL_ALLOWLIST,ARC_LEADS_OUTREACH_FROM"* ]] || { echo "$output"; false; }
  [[ "$output" == *"CREDENTIALS-ACCEPTED"* ]]
}

@test "every command that reads the credential file calls the guard on it" {
  # The guard is worth nothing if a caller that reads .env.local forgets to call it, and the
  # guard cannot detect that itself.
  #
  # THE OLD VERSION OF THIS TEST WAS `grep -c assertEnvLocalNames &gt;= 2`. That name appears four
  # times in the file (an import, two comments, one call), so deleting the `loadCredentials()`
  # call from BOTH `cmdPreflight` and `deliverNotification` left the count at four and the whole
  # suite green -- and one of those deletions is exactly the regression that made
  # `arc-leads preflight: PASS` reachable from a credential file. A test named after a guard,
  # measuring a substring frequency (D7).
  #
  # This walks the actual function bodies instead: brace-matched from each declaration, so a
  # call that moves out of a function is caught even if it stays in the file. A behavioural test
  # (write a .env.local, run preflight, expect a refusal) is not possible while
  # `loadCredentials` anchors on the real REPO_ROOT -- that is recorded as H-06 in
  # phases/phase-03-known-holes.md rather than left as a silent gap.
  cd "$ARC_ROOT"
  cat > "$BATS_TEST_TMPDIR/callsites.mjs" <<'MJS'
import { readFileSync } from "node:fs";
const src = readFileSync(".claude/scripts/leads/arc-leads.mjs", "utf8");
const want = ["cmdDaily", "cmdPreflight", "deliverNotification"];
const missing = [];
// A plain string search, NOT a constructed RegExp. Building one here means backslashes have to
// survive a heredoc, a shell and a JS string literal intact, and the first version of this
// probe lost them and died on "Unterminated group" -- a test that fails to parse is a test that
// proves nothing, which is the whole subject of this file.
for (const fn of want) {
  const at = src.indexOf("function " + fn + "(");
  if (at === -1) { missing.push(fn + " (not found at all)"); continue; }
  // THE PARAMETER LIST IS SKIPPED FIRST. Taking the next "{" after the declaration finds the
  // DESTRUCTURING brace of `function deliverNotification({ to, subject, ... })`, so the
  // brace-matcher closed on the parameter list and handed back an empty body -- and the first
  // run of this probe duly reported that function as missing the call it plainly contains.
  // Paren depth is walked back to zero, and only then is the body brace taken.
  let p = src.indexOf("(", at), pd = 0, afterParams = -1;
  for (let j = p; j < src.length; j++) {
    if (src[j] === "(") pd++;
    else if (src[j] === ")") { pd--; if (pd === 0) { afterParams = j; break; } }
  }
  if (afterParams === -1) { missing.push(fn + " (unparseable parameter list)"); continue; }
  let i = src.indexOf("{", afterParams), depth = 0, end = -1;
  for (let j = i; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") { depth--; if (depth === 0) { end = j; break; } }
  }
  const body = src.slice(i, end);
  if (!body.includes("loadCredentials()")) missing.push(fn);
}
console.log("CHECKED:" + want.length);
console.log("MISSING:" + (missing.length ? missing.join(",") : "none"));
MJS
  [ -s "$BATS_TEST_TMPDIR/callsites.mjs" ] || { echo "the probe is EMPTY"; false; }
  run node "$BATS_TEST_TMPDIR/callsites.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # Assert it RAN before asserting what it found: CHECKED proves all three declarations were
  # located, so "MISSING:none" cannot be satisfied by a probe that examined nothing.
  [[ "$output" == *"CHECKED:3"* ]] || { echo "$output"; false; }
  [[ "$output" == *"MISSING:none"* ]] || { echo "a command that reads .env.local does not call the guard: $output"; false; }
}

@test "the env file is ignored by git, asked OF git rather than read from gitignore" {
  cd "$ARC_ROOT"
  run git check-ignore -q .env.local
  [ "$status" -eq 0 ]
  # Positive control: a path that must NOT be ignored, so this test fails if check-ignore ever
  # starts answering 0 for everything.
  run git check-ignore -q .env.example
  [ "$status" -ne 0 ]
}

@test "no env file is tracked anywhere in the tree except the example" {
  # Anchoring at the start of the path meant a tracked products/leads/.env.local was invisible.
  # The check is now over every path segment, at any depth.
  cd "$ARC_ROOT"
  run git ls-files
  [ "$status" -eq 0 ]
  [ -n "$output" ] || { echo "git ls-files returned nothing -- this test measured nothing"; false; }
  local offenders
  offenders="$(printf '%s\n' "$output" | grep -E '(^|/)\.env' | grep -v -E '(^|/)\.env\.example$' || true)"
  [ -z "$offenders" ] || { echo "tracked env file(s): $offenders"; false; }
}

# ---------- the CLI ----------

@test "the mail subcommand prints usage when a required flag is missing" {
  # --subject is the only REQUIRED flag now; --to is inferred from a one-entry allowlist. The
  # earlier version of this test omitted --to and stopped measuring usage the moment that became
  # optional -- it then passed on an allowlist refusal instead, which is a different guard.
  run _cli mail --text hello
  [ "$status" -eq 2 ]
  [[ "$output" == *"usage: arc-leads mail"* ]]
}

@test "a flag whose value is missing does not swallow the next flag" {
  # Asserting only the exit code was not enough: four different paths in this CLI exit 2, and a
  # mutant with the guard deleted produced exit 2 from a later guard instead. The message is
  # what distinguishes them.
  run _cli mail --to --subject hello
  [ "$status" -eq 2 ]
  [[ "$output" == *"--to needs a value"* ]]
}

@test "an unknown flag is refused rather than silently ignored" {
  # `--body "connection refused on :8443"` used to be dropped in silence and the mail delivered
  # with an empty body, exit 0 -- a notification whose entire content is the detail it lost.
  run _cli mail --to owner@example.com --subject s --body "the detail"
  [ "$status" -eq 2 ]
  [[ "$output" == *"unknown flag --body"* ]]
}

@test "a repeated flag is refused rather than resolved by position" {
  run _cli mail --to owner@example.com --subject s --to victim@example.net
  [ "$status" -eq 2 ]
  [[ "$output" == *"--to given twice"* ]]
}

@test "a bare positional is refused" {
  run _cli mail --to owner@example.com --subject s "some pasted body"
  [ "$status" -eq 2 ]
  [[ "$output" == *"no positional argument"* ]]
}

@test "a body that begins with two dashes is reachable through the equals form" {
  # The separated form cannot tell "the next token is a flag" from "the value starts with two
  # dashes", so --text with a dashed value silently became an EMPTY body with exit 0. The
  # equals form is unambiguous and is the documented door for it. An end-of-options `--` marker
  # was tried first and is worse: it makes every later token positional, which deletes the
  # swallow-the-next-flag guard rather than relaxing it.
  cd "$ARC_ROOT"
  local dir; dir="$(_tmpdir)"
  [ -n "$dir" ] || { echo "the temp dir was not created"; false; }
  # An UNINITIALISED store, deliberately: parsing happens before the store is opened, so getting
  # past the parser and dying on the store is the proof that the value beginning with two dashes
  # was accepted as a value rather than rejected as a flag. Pointing at a throwaway directory
  # also keeps this test off the real store, which the default path would otherwise write to.
  run env ARC_LEADS_FAKE=1 ARC_LEADS_STORE="$dir" node .claude/scripts/leads/arc-leads.mjs mail --to=owner@example.com --subject=s "--text=--- canary log ---"
  [ -n "$output" ] || { echo "the CLI produced no output at all"; false; }
  [[ "$output" == *"store not initialised"* ]] || { echo "the parser did not accept the value: $output"; false; }
  [ "$status" -eq 5 ]
  [[ "$output" != *"unknown flag"* ]]
  [[ "$output" != *"needs a value"* ]]
  [[ "$output" != *"no positional argument"* ]]
}

@test "the recipient is inferred when the owner allowlist holds exactly one address" {
  # Owner-directed mail goes to an address that is already declared in .env.local. Making every
  # caller repeat it in argv would put it in a process listing, in shell history and verbatim in
  # CI logs -- the three exposures this module refuses everywhere else. Getting past the parser
  # and dying on the uninitialised store is the proof the recipient was resolved.
  cd "$ARC_ROOT"
  local dir; dir="$(_tmpdir)"
  [ -n "$dir" ] || { echo "the temp dir was not created"; false; }
  run env ARC_LEADS_FAKE=1 ARC_LEADS_STORE="$dir" ARC_LEADS_MAIL_ALLOWLIST="owner@example.com" \
    node .claude/scripts/leads/arc-leads.mjs mail --subject s --text t
  [[ "$output" == *"store not initialised"* ]] || { echo "the recipient was not inferred: $output"; false; }
  [ "$status" -eq 5 ]
}

@test "the recipient is NOT inferred when the allowlist holds more than one address" {
  # Picking one of several recipients is a choice, and a default that makes a choice silently is
  # how the wrong person gets mailed.
  cd "$ARC_ROOT"
  local dir; dir="$(_tmpdir)"
  [ -n "$dir" ] || { echo "the temp dir was not created"; false; }
  run env ARC_LEADS_FAKE=1 ARC_LEADS_STORE="$dir" ARC_LEADS_MAIL_ALLOWLIST="owner@example.com,other@example.org" \
    node .claude/scripts/leads/arc-leads.mjs mail --subject s --text t
  [ "$status" -eq 2 ]
  [[ "$output" == *"holds 2 addresses"* ]]
  [[ "$output" != *"owner@example.com"* ]] || { echo "the refusal echoed an address: $output"; false; }
}

@test "an empty allowlist refuses the inferred recipient rather than sending to nobody" {
  cd "$ARC_ROOT"
  local dir; dir="$(_tmpdir)"
  [ -n "$dir" ] || { echo "the temp dir was not created"; false; }
  # `-u` is an OPTION and must precede the NAME=value operands; after them, env treats it as the
  # command to run and dies with "env: -u: No such file or directory".
  run env -u ARC_LEADS_MAIL_ALLOWLIST ARC_LEADS_FAKE=1 ARC_LEADS_STORE="$dir" \
    node .claude/scripts/leads/arc-leads.mjs mail --subject s --text t
  [ "$status" -eq 2 ]
  [[ "$output" == *"ARC_LEADS_MAIL_ALLOWLIST is unset"* ]]
}

@test "two body sources at once are refused" {
  run _cli mail --to owner@example.com --subject s --text a --stdin
  [ "$status" -eq 2 ]
  [[ "$output" == *"ONE way"* ]]
}

@test "the delivery path takes the send lock" {
  # The cap is a check-then-act across a read, a network call and an append. Two notification
  # hooks firing together both read 99 and both send. cmdReconcile already takes this lock; the
  # guard was applied in one branch and omitted in the adjacent one.
  #
  # The lock lives in deliverNotification, the ONE function that sends. This test used to read
  # cmdMail and went green-to-red the moment the lock moved there with the send -- correctly:
  # a test anchored to the wrong function measures nothing once the code moves.
  cd "$ARC_ROOT"
  run node -e 'const s=require("node:fs").readFileSync(".claude/scripts/leads/arc-leads.mjs","utf8");const i=s.indexOf("async function deliverNotification");const body=s.slice(i, s.indexOf("\n}\n", i));process.stdout.write("FOUND:"+(i>=0)+" LOCK:"+body.includes("acquireLock")+" RELEASE:"+body.includes("release()")+" SEND:"+body.includes("sendNotification("))'
  [ "$status" -eq 0 ]
  [[ "$output" == *"FOUND:true"* ]] || { echo "deliverNotification was not found: $output"; false; }
  # The send and the lock in the SAME function body, which is the property that matters.
  [[ "$output" == *"LOCK:true RELEASE:true SEND:true"* ]]
}

# ---------- the three triggers ----------

@test "notify approvals sends NOTHING when nothing is waiting" {
  # The design, not an omission. A channel that mails "0 waiting" every day is a channel the
  # owner learns to ignore, and an ignored alert channel is the same as no alert channel -- the
  # exact failure ADR-0415 exists to prevent. Asserted by the absence of a send AND the presence
  # of the explanation, so a crash cannot satisfy it.
  cd "$ARC_ROOT"
  local dir; dir="$(_tmpdir)"
  [ -n "$dir" ] || { echo "the temp dir was not created"; false; }
  run env ARC_LEADS_FAKE=1 ARC_LEADS_STORE="$dir" ARC_SPINE_ROOT="$dir/spine" \
    ARC_LEADS_MAIL_ALLOWLIST="owner@example.com" ARC_LEADS_MAIL_FROM="arc@example.com" \
    node .claude/scripts/leads/arc-leads.mjs notify approvals
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"nothing waiting"* ]]
  # The confirmation line is `arc-leads: mail sent id=...`. A bare "mail sent" substring is the
  # wrong assertion: the explanation this test WANTS to see contains the words "no mail sent",
  # so the naive form failed on the very output that proves the behaviour is correct.
  #
  # AND IT NO LONGER STANDS ALONE. This whole file runs under ARC_LEADS_FAKE=1, and a successful
  # send on the fake now prints the NOT-SENT sentence instead of the confirmation -- so BOTH
  # branches satisfy the line below and it can no longer fail. The delivery is pinned by its
  # absence from the store journal, which a crash does not satisfy either way.
  # Under ARC_LEADS_FAKE=1 a delivery that DID happen prints the NOT-SENT sentence, so this pair
  # covers both spellings of "a send was attempted" and neither is satisfied by the other.
  [[ "$output" != *"arc-leads: mail sent id="* ]]
  [[ "$output" != *"NOT SENT"* ]] || { echo "a delivery was attempted for an empty inbox: $output"; false; }
}

@test "notify canary refuses a detail that is empty" {
  # An alert that says nothing is worse than no alert: it consumes the channel and teaches the
  # reader that arc pages for nothing.
  cd "$ARC_ROOT"
  local dir; dir="$(_tmpdir)"
  local empty; empty="$(_emptyfile)"
  [ -n "$dir" ] || { echo "the temp dir was not created"; false; }
  [ -f "$empty" ] || { echo "the empty fixture file was not created"; false; }
  [ ! -s "$empty" ] || { echo "the fixture file is not empty, so this test would not measure emptiness"; false; }
  run env ARC_LEADS_FAKE=1 ARC_LEADS_STORE="$dir" node .claude/scripts/leads/arc-leads.mjs notify canary --text-file "$empty"
  [ "$status" -eq 2 ]
  [[ "$output" == *"detail is empty"* ]]
}

@test "notify canary names a missing detail file instead of leaking a raw errno" {
  # An alert path that dies with `ENOENT: no such file or directory` at 3am is telling the
  # operator about node, not about the alert. It is also the shape the emptiness test hit on the
  # Windows leg, which is how a wrong-cause failure hid behind a right-looking assertion.
  cd "$ARC_ROOT"
  local dir; dir="$(_tmpdir)"
  [ -n "$dir" ] || { echo "the temp dir was not created"; false; }
  run env ARC_LEADS_FAKE=1 ARC_LEADS_STORE="$dir" node .claude/scripts/leads/arc-leads.mjs notify canary --text-file "$dir/does-not-exist.txt"
  [ "$status" -eq 2 ]
  [[ "$output" == *"could not be read"* ]]
  [[ "$output" != *"ENOENT:"* ]]
}

@test "notify canary has no argv door for the failure detail" {
  # A canary tail is exactly the content that ends up quoted into a process listing and a CI
  # log. There are two doors and both hand over BYTES; --text is not one of them.
  cd "$ARC_ROOT"
  local dir; dir="$(_tmpdir)"
  [ -n "$dir" ] || { echo "the temp dir was not created"; false; }
  run env ARC_LEADS_FAKE=1 ARC_LEADS_STORE="$dir" node .claude/scripts/leads/arc-leads.mjs notify canary --text "connection refused on :8443"
  [ "$status" -eq 2 ]
  [[ "$output" == *"--text-file"* ]]
  [[ "$output" == *"never in argv"* ]]
}

@test "an unknown notify trigger prints the three that exist" {
  run _cli notify nope
  [ "$status" -eq 2 ]
  [[ "$output" == *"canary"* ]]
  [[ "$output" == *"approvals"* ]]
  [[ "$output" == *"brief"* ]]
}

@test "mail and notify share one delivery path" {
  # Two copies would be two places for the env guard, the lock and the recipient rule to drift
  # apart, and the ones that drift are the ones nobody looks at again.
  cd "$ARC_ROOT"
  run node -e 'const s=require("node:fs").readFileSync(".claude/scripts/leads/arc-leads.mjs","utf8");const calls=(s.match(/deliverNotification\(/g)||[]).length;const sends=(s.match(/await sendNotification\(/g)||[]).length;process.stdout.write("DELIVER:"+calls+" SEND:"+sends)'
  [ "$status" -eq 0 ]
  # One definition plus its callers; exactly ONE place calls sendNotification.
  [[ "$output" == *"SEND:1"* ]] || { echo "sendNotification is called from more than one place: $output"; false; }
  [[ "$output" == *"DELIVER:5"* ]] || { echo "unexpected number of deliverNotification references: $output"; false; }
}

# ---------- the fake, and the boundary it must not cross ----------

@test "a fake send returns an id and appends exactly one log line" {
  _m '
    const fs = await import("node:fs"), os = await import("node:os"), path = await import("node:path");
    const {sendNotification} = await import("./.claude/scripts/leads/lib/mail.mjs");
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "mailq"));
    const env = {ARC_LEADS_MAIL_FROM:"arc@example.com", ARC_LEADS_MAIL_ALLOWLIST:"owner@example.com"};
    const res = await sendNotification({to:"owner@example.com", subject:"s", text:"t"}, {storeDir:d, nowTs:"2026-08-08T10:00:00+05:30", env, argv:[]});
    const lines = fs.readFileSync(path.join(d, "mail-log.jsonl"), "utf8").split("\n").filter(Boolean);
    console.log("ID:" + (res.id ? "yes" : "no") + " LINES:" + lines.length);
    console.log("ENTRY_HAS_TS:" + (JSON.parse(lines[0]).ts === "2026-08-08T10:00:00+05:30"));'
  [ "$status" -eq 0 ]
  [[ "$output" == *"ID:yes LINES:1"* ]]
  [[ "$output" == *"ENTRY_HAS_TS:true"* ]]
}

@test "the fake refuses to run without its fixture rather than accepting by default" {
  cd "$ARC_ROOT"
  run env ARC_LEADS_FAKE=1 LEADS_FIXTURE_DIR="$ARC_ROOT/tests/fixtures/does-not-exist" node --input-type=module -e '
    const {mailer} = await import("./.claude/scripts/leads/lib/deps.mjs");
    try { await mailer().send({to:"owner@example.com", idem_key:"k"}); console.log("ACCEPTED-BY-DEFAULT"); }
    catch (e) { console.log("REFUSED:" + (e.code || e.constructor.name)); }'
  [ "$status" -eq 0 ]
  [[ "$output" == *"REFUSED:"* ]]
  [[ "$output" != *"ACCEPTED-BY-DEFAULT"* ]]
}

@test "the mailer policy layer imports no module of the outreach path" {
  # The first version of this test grepped for one filename token, so importing any of the other
  # seven outreach modules passed. It also named lib/provider.mjs, which does not exist. The
  # check is now over the IMPORT STATEMENTS, and it carries a positive control so a broken
  # extractor cannot pass as a clean module.
  _m '
    const fs = await import("node:fs");
    const src = fs.readFileSync(".claude/scripts/leads/lib/mail.mjs", "utf8");
    const imports = [...src.matchAll(/^\s*import[^;]*?from\s+"([^"]+)"/gm)].map((m) => m[1]);
    console.log("IMPORTS:" + imports.join(","));
    const outreach = ["sequencer", "guard", "journal", "drafts", "personalization", "replies", "preflight", "ingest", "spine-read", "research-lint"];
    const bad = imports.filter((p) => outreach.some((o) => p === "./" + o + ".mjs"));
    console.log("OUTREACH:" + bad.length);'
  [ "$status" -eq 0 ]
  # Positive control: the extractor found the imports that ARE there, so OUTREACH:0 means
  # "none of them", not "the regex matched nothing".
  [[ "$output" == *"./store.mjs"* ]]
  [[ "$output" == *"./caps.mjs"* ]]
  [[ "$output" == *"./deps.mjs"* ]]
  [[ "$output" == *"OUTREACH:0"* ]]
}

@test "no spine event kind was added for mail" {
  # ADR-0415 decided a notification is the postman, not the news. The first version of this test
  # was a grep over two directories asserting a non-zero exit -- and grep exits 2 on a missing
  # path, so it passed both when nothing was scanned AND when a real match existed. The
  # vocabulary is imported instead, and a known-present kind is the positive control.
  _m '
    const {KINDS} = await import("./.claude/scripts/hq/lib/validate.mjs");
    const {LEADS_KINDS} = await import("./.claude/scripts/hq/lib/validate-leads.mjs");
    const all = [...KINDS, ...LEADS_KINDS];
    console.log("TOTAL:" + all.length);
    console.log("CONTROL:" + all.includes("outreach.sent"));
    console.log("MAILKINDS:" + all.filter((k) => k.startsWith("mail.")).join(","));'
  [ "$status" -eq 0 ]
  [[ "$output" == *"CONTROL:true"* ]] || { echo "the kind vocabulary was not read: $output"; false; }
  [[ "$output" == *"MAILKINDS:"* ]]
  [[ "$output" != *"MAILKINDS:mail."* ]]
}

# ---------- the count ----------

@test "this suite registers as many tests as it declares" {
  # bats silently DROPS a @test whose name holds a non-ASCII character and reports green having
  # never run it. The only signal is a falling count, so the count is asserted here.
  local declared registered
  # The grammar is the one CI counts with (`_declared` in ci.yml), not a narrower spelling of
  # it: `^@test ` misses a tab-indented declaration and misses `@test` followed by a tab, so a
  # test could be dropped by bats AND uncounted here -- the count that exists to catch a silent
  # drop, blind to two of the three forms it has to see.
  declared="$(grep -cE '^[[:blank:]]*@test[[:blank:]]' "$BATS_TEST_FILENAME")"
  registered="${#BATS_TEST_NAMES[@]}"
  [ "$declared" -eq "$registered" ] || { echo "declared $declared, registered $registered"; false; }
  [ "$declared" -eq 77 ] || { echo "expected 77 tests, found $declared -- update this number deliberately"; false; }
}
