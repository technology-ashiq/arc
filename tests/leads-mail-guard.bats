#!/usr/bin/env bats
# leads Phase 04 -- the notification mail path: allowlist, quota, and credential handling.
#
# The load-bearing test in this file is "a non-allowlisted recipient is refused BEFORE any
# network call". It is asserted by pointing the real mailer at an unreachable endpoint and
# demanding an ALLOWLIST refusal: if the guard ever moved below the transport, that test would
# come back with a transport error instead, which is a different string and a failing test.
# An assertion that merely checked "it refused" would pass either way and prove nothing.
#
# Every embedded node program here is single-quoted in the shell, so it carries no apostrophes
# and no single quotes -- in code OR in comments. One apostrophe closes the shell string and
# the rest of the program is expanded by bash. This has landed in this repo twice.
#
# Test names are ASCII only: bats silently DROPS a test whose name holds a non-ASCII character,
# and the only signal is a falling count -- which is why the last test asserts the count.
bats_require_minimum_version 1.5.0
load 'test_helper'

setup() {
  export ARC_LEADS_STORE="$BATS_TEST_TMPDIR/store"
  export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine"
  MAILDIR="$BATS_TEST_TMPDIR/maildir"
  mkdir -p "$MAILDIR"
}

# Runs a module-level program with the fakes ON. Used for the policy tests, which must not
# reach a network at all.
_m() { cd "$ARC_ROOT" && ARC_LEADS_FAKE=1 LEADS_FIXTURE_DIR="$ARC_ROOT/tests/fixtures/leads" run node --input-type=module -e "$1"; }

# ---------- the code-path test: the real mailer reaches its own code ----------

@test "the real mailer module reaches its own code and exits with its own failure code" {
  cd "$ARC_ROOT"
  run env -u ARC_LEADS_FAKE RESEND_API_KEY="re_test_key_not_real_000000" ARC_LEADS_MAIL_BASE_URL="https://127.0.0.1:1" node --input-type=module -e '
    const {mailer, ProviderError} = await import("./.claude/scripts/leads/lib/deps.mjs");
    try { await mailer().send({to:"a@b.in", from:"c@d.in", subject:"s", text:"t", idem_key:"k"}); console.log("UNEXPECTED-SUCCESS"); }
    catch (e) { console.log(e instanceof ProviderError ? "ProviderError:" + e.kind : "WRONG-ERROR:" + e.constructor.name); }'
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"ProviderError:transport"* ]]
}

@test "the real mailer refuses when RESEND_API_KEY is unset" {
  cd "$ARC_ROOT"
  run env -u ARC_LEADS_FAKE -u RESEND_API_KEY node --input-type=module -e '
    const {mailer} = await import("./.claude/scripts/leads/lib/deps.mjs");
    try { await mailer().send({to:"a@b.in"}); console.log("UNEXPECTED-SUCCESS"); } catch (e) { console.log("KIND:" + e.kind); }'
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"KIND:config"* ]]
}

@test "the unset-key refusal names the variable and never prints a key value" {
  cd "$ARC_ROOT"
  run env -u ARC_LEADS_FAKE -u RESEND_API_KEY node --input-type=module -e '
    const {mailer} = await import("./.claude/scripts/leads/lib/deps.mjs");
    try { await mailer().send({to:"a@b.in"}); console.log("UNEXPECTED-SUCCESS"); } catch (e) { console.log("MSG:" + e.message); }'
  [[ "$output" == *"MSG:"* ]] || { echo "the program did not run: $output"; false; }
  [[ "$output" == *"RESEND_API_KEY is unset"* ]]
  [[ "$output" != *"re_"* ]]
}

# ---------- decodeMailResponse: the status code decides ----------

@test "a 500 with a parseable body is transport-class and not an ack" {
  _m '
    const {decodeMailResponse} = await import("./.claude/scripts/leads/lib/deps.mjs");
    try { decodeMailResponse(500, JSON.stringify({id:"looks-fine"})); console.log("UNEXPECTED-ACK"); }
    catch (e) { console.log("KIND:" + e.kind); }'
  [[ "$output" == *"KIND:transport"* ]]
}

@test "a 400 is refused rather than transport, because retrying only repeats it" {
  _m '
    const {decodeMailResponse} = await import("./.claude/scripts/leads/lib/deps.mjs");
    try { decodeMailResponse(400, JSON.stringify({id:"x"})); console.log("UNEXPECTED-ACK"); }
    catch (e) { console.log("KIND:" + e.kind); }'
  [[ "$output" == *"KIND:refused"* ]]
}

@test "a 429 names the quota so it is not read as transient noise" {
  _m '
    const {decodeMailResponse} = await import("./.claude/scripts/leads/lib/deps.mjs");
    try { decodeMailResponse(429, "{}"); console.log("UNEXPECTED-ACK"); }
    catch (e) { console.log("MSG:" + e.message); }'
  [[ "$output" == *"MSG:"* ]] || { echo "the program did not run: $output"; false; }
  [[ "$output" == *"quota"* ]]
}

@test "a 2xx with no message id is not an ack" {
  _m '
    const {decodeMailResponse} = await import("./.claude/scripts/leads/lib/deps.mjs");
    try { decodeMailResponse(200, JSON.stringify({ok:true})); console.log("UNEXPECTED-ACK"); }
    catch (e) { console.log("KIND:" + e.kind); }'
  [[ "$output" == *"KIND:refused"* ]]
}

@test "a 2xx with an empty message id is not an ack either" {
  _m '
    const {decodeMailResponse} = await import("./.claude/scripts/leads/lib/deps.mjs");
    try { decodeMailResponse(200, JSON.stringify({id:""})); console.log("UNEXPECTED-ACK"); }
    catch (e) { console.log("KIND:" + e.kind); }'
  [[ "$output" == *"KIND:refused"* ]]
}

@test "an unparseable 2xx body is refused" {
  _m '
    const {decodeMailResponse} = await import("./.claude/scripts/leads/lib/deps.mjs");
    try { decodeMailResponse(200, "not json at all"); console.log("UNEXPECTED-ACK"); }
    catch (e) { console.log("KIND:" + e.kind); }'
  [[ "$output" == *"KIND:refused"* ]]
}

@test "the vendor error body is never echoed into the message" {
  _m '
    const {decodeMailResponse} = await import("./.claude/scripts/leads/lib/deps.mjs");
    const body = JSON.stringify({error:"rejected recipient victim@example.in"});
    try { decodeMailResponse(422, body); console.log("UNEXPECTED-ACK"); }
    catch (e) { console.log("MSG:" + e.message); }'
  [[ "$output" == *"MSG:"* ]] || { echo "the program did not run: $output"; false; }
  [[ "$output" != *"victim@example.in"* ]]
}

@test "a 2xx ack returns the vendor message id" {
  _m '
    const {decodeMailResponse} = await import("./.claude/scripts/leads/lib/deps.mjs");
    console.log("ID:" + decodeMailResponse(200, JSON.stringify({id:"abc123"})).id);'
  [[ "$output" == *"ID:abc123"* ]]
}

# ---------- the allowlist ----------

@test "an unset allowlist refuses to send and is not read as everyone" {
  _m '
    const {loadAllowlist} = await import("./.claude/scripts/leads/lib/mail.mjs");
    try { loadAllowlist({}); console.log("UNEXPECTED-PASS"); } catch (e) { console.log("KIND:" + e.kind); }'
  [[ "$output" == *"KIND:config"* ]]
}

@test "an allowlist of only whitespace refuses" {
  _m '
    const {loadAllowlist} = await import("./.claude/scripts/leads/lib/mail.mjs");
    try { loadAllowlist({ARC_LEADS_MAIL_ALLOWLIST:"   "}); console.log("UNEXPECTED-PASS"); } catch (e) { console.log("KIND:" + e.kind); }'
  [[ "$output" == *"KIND:config"* ]]
}

@test "an allowlist of only commas refuses" {
  _m '
    const {loadAllowlist} = await import("./.claude/scripts/leads/lib/mail.mjs");
    try { loadAllowlist({ARC_LEADS_MAIL_ALLOWLIST:",,,"}); console.log("UNEXPECTED-PASS"); } catch (e) { console.log("KIND:" + e.kind); }'
  [[ "$output" == *"KIND:config"* ]]
}

@test "allowlist matching survives case and surrounding whitespace" {
  _m '
    const {loadAllowlist, assertAllowed} = await import("./.claude/scripts/leads/lib/mail.mjs");
    const a = loadAllowlist({ARC_LEADS_MAIL_ALLOWLIST:"  Arc@Automemory.AI , x@y.in "});
    console.log("OK:" + assertAllowed("ARC@automemory.ai", a));'
  [[ "$output" == *"OK:arc@automemory.ai"* ]]
}

@test "a zero-width character inside the recipient still matches the allowlist" {
  _m '
    const {loadAllowlist, assertAllowed} = await import("./.claude/scripts/leads/lib/mail.mjs");
    const a = loadAllowlist({ARC_LEADS_MAIL_ALLOWLIST:"arc@automemory.ai"});
    const sneaky = "arc@auto" + String.fromCodePoint(0x200B) + "memory.ai";
    try { console.log("OK:" + assertAllowed(sneaky, a)); } catch (e) { console.log("REFUSED:" + e.kind); }'
  [[ "$output" == *"OK:arc@automemory.ai"* ]]
}

@test "a non-allowlisted recipient is refused BEFORE any network call" {
  cd "$ARC_ROOT"
  run env -u ARC_LEADS_FAKE \
    RESEND_API_KEY="re_test_key_not_real_000000" \
    ARC_LEADS_MAIL_FROM="arc@automemory.ai" \
    ARC_LEADS_MAIL_ALLOWLIST="arc@automemory.ai" \
    ARC_LEADS_MAIL_BASE_URL="https://127.0.0.1:1" \
    ARC_LEADS_STORE="$BATS_TEST_TMPDIR/store" \
    node --input-type=module -e '
    const {sendNotification} = await import("./.claude/scripts/leads/lib/mail.mjs");
    try {
      await sendNotification({to:"stranger@example.in", subject:"s", text:"t"},
        {storeDir: process.env.ARC_LEADS_STORE, nowTs:"2026-08-08T10:00:00+05:30", argv:[]});
      console.log("UNEXPECTED-SEND");
    } catch (e) { console.log("NAME:" + e.name + " KIND:" + (e.kind || "none")); }'
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # The endpoint is unreachable, so a guard that ran AFTER the transport would report
  # ProviderError:transport here. Demanding the allowlist name is what pins the ordering.
  [[ "$output" == *"NAME:MailRefusal KIND:allowlist"* ]]
}

@test "the refused recipient address is not echoed in the refusal" {
  _m '
    const {loadAllowlist, assertAllowed} = await import("./.claude/scripts/leads/lib/mail.mjs");
    const a = loadAllowlist({ARC_LEADS_MAIL_ALLOWLIST:"arc@automemory.ai"});
    try { assertAllowed("victim@example.in", a); console.log("UNEXPECTED-PASS"); } catch (e) { console.log("MSG:" + e.message); }'
  [[ "$output" == *"MSG:"* ]] || { echo "the program did not run: $output"; false; }
  [[ "$output" != *"victim@example.in"* ]]
}

@test "an empty recipient is refused rather than normalised into a match" {
  _m '
    const {loadAllowlist, assertAllowed} = await import("./.claude/scripts/leads/lib/mail.mjs");
    const a = loadAllowlist({ARC_LEADS_MAIL_ALLOWLIST:"arc@automemory.ai"});
    try { assertAllowed("", a); console.log("UNEXPECTED-PASS"); } catch (e) { console.log("KIND:" + e.kind); }'
  [[ "$output" == *"KIND:allowlist"* ]]
}

# ---------- the quota ----------

@test "the daily cap refuses the send that would cross it" {
  printf "" > "$MAILDIR/mail-log.jsonl"
  for i in $(seq 1 100); do
    printf '%s\n' '{"ts":"2026-08-08T09:00:00+05:30","to":"arc@automemory.ai","id":"x","kind":"notify"}' >> "$MAILDIR/mail-log.jsonl"
  done
  _m "
    const {assertQuota} = await import(\"./.claude/scripts/leads/lib/mail.mjs\");
    try { assertQuota(\"$MAILDIR\", \"2026-08-08T10:00:00+05:30\"); console.log(\"UNEXPECTED-PASS\"); }
    catch (e) { console.log(\"KIND:\" + e.kind); }"
  [[ "$output" == *"KIND:quota"* ]]
}

@test "yesterday sends do not count against today" {
  printf "" > "$MAILDIR/mail-log.jsonl"
  for i in $(seq 1 100); do
    printf '%s\n' '{"ts":"2026-08-07T09:00:00+05:30","to":"arc@automemory.ai","id":"x","kind":"notify"}' >> "$MAILDIR/mail-log.jsonl"
  done
  _m "
    const {readQuota} = await import(\"./.claude/scripts/leads/lib/mail.mjs\");
    const q = readQuota(\"$MAILDIR\", \"2026-08-08T10:00:00+05:30\");
    console.log(\"DAY:\" + q.day + \" MONTH:\" + q.month);"
  [[ "$output" == *"DAY:0 MONTH:100"* ]]
}

@test "a malformed log line consumes quota rather than restoring it" {
  printf '%s\n' 'this is not json' > "$MAILDIR/mail-log.jsonl"
  printf '%s\n' '{"ts":"2026-08-08T09:00:00+05:30","id":"x"}' >> "$MAILDIR/mail-log.jsonl"
  _m "
    const {readQuota} = await import(\"./.claude/scripts/leads/lib/mail.mjs\");
    const q = readQuota(\"$MAILDIR\", \"2026-08-08T10:00:00+05:30\");
    console.log(\"DAY:\" + q.day + \" MALFORMED:\" + q.malformed);"
  [[ "$output" == *"DAY:2 MALFORMED:1"* ]]
}

@test "a log entry with an unusable timestamp counts rather than being skipped" {
  printf '%s\n' '{"ts":"not-a-date","id":"x"}' > "$MAILDIR/mail-log.jsonl"
  _m "
    const {readQuota} = await import(\"./.claude/scripts/leads/lib/mail.mjs\");
    const q = readQuota(\"$MAILDIR\", \"2026-08-08T10:00:00+05:30\");
    console.log(\"DAY:\" + q.day + \" MALFORMED:\" + q.malformed);"
  [[ "$output" == *"DAY:1 MALFORMED:1"* ]]
}

@test "an absent log is zero and not an error" {
  _m "
    const {readQuota} = await import(\"./.claude/scripts/leads/lib/mail.mjs\");
    const q = readQuota(\"$MAILDIR/nowhere\", \"2026-08-08T10:00:00+05:30\");
    console.log(\"DAY:\" + q.day);"
  [[ "$output" == *"DAY:0"* ]]
}

# ---------- the credential must not travel by argv ----------

@test "the actual key passed on the command line is refused" {
  _m '
    const {assertKeyNotInArgv} = await import("./.claude/scripts/leads/lib/mail.mjs");
    try { assertKeyNotInArgv(["node", "x", "re_realkey_abcdefgh"], {RESEND_API_KEY:"re_realkey_abcdefgh"}); console.log("UNEXPECTED-PASS"); }
    catch (e) { console.log("KIND:" + e.kind); }'
  [[ "$output" == *"KIND:config"* ]]
}

@test "a key-shaped token on the command line is refused even when it is not our key" {
  _m '
    const {assertKeyNotInArgv} = await import("./.claude/scripts/leads/lib/mail.mjs");
    try { assertKeyNotInArgv(["node", "--key=re_someoneelseskey_0123456789"], {}); console.log("UNEXPECTED-PASS"); }
    catch (e) { console.log("KIND:" + e.kind); }'
  [[ "$output" == *"KIND:config"* ]]
}

@test "ordinary arguments are not mistaken for a credential" {
  _m '
    const {assertKeyNotInArgv} = await import("./.claude/scripts/leads/lib/mail.mjs");
    assertKeyNotInArgv(["node", "arc-leads.mjs", "mail", "--to", "arc@automemory.ai", "--subject", "hello"], {});
    console.log("OK");'
  [[ "$output" == *"OK"* ]]
}

# ---------- .env.local: the one credential home ----------

@test "an exported environment value wins over the file" {
  printf '%s\n' "SOME_ARC_TEST_VAR=from-file" > "$MAILDIR/.env.local"
  _m "
    const {loadEnvLocal} = await import(\"./.claude/scripts/leads/lib/env.mjs\");
    const env = {SOME_ARC_TEST_VAR: \"from-env\"};
    loadEnvLocal({root: \"$MAILDIR\", env});
    console.log(\"VAL:\" + env.SOME_ARC_TEST_VAR);"
  [[ "$output" == *"VAL:from-env"* ]]
}

@test "a value containing equals signs survives, so base64 padding is not truncated" {
  printf '%s\n' "SOME_ARC_TEST_VAR=abc==" > "$MAILDIR/.env.local"
  _m "
    const {loadEnvLocal} = await import(\"./.claude/scripts/leads/lib/env.mjs\");
    const env = {};
    loadEnvLocal({root: \"$MAILDIR\", env});
    console.log(\"VAL:\" + env.SOME_ARC_TEST_VAR);"
  [[ "$output" == *"VAL:abc=="* ]]
}

@test "an empty assignment is treated as absent, not as a set empty value" {
  printf '%s\n' "SOME_ARC_TEST_VAR=filled" > "$MAILDIR/.env.local"
  _m "
    const {loadEnvLocal} = await import(\"./.claude/scripts/leads/lib/env.mjs\");
    const env = {SOME_ARC_TEST_VAR: \"\"};
    loadEnvLocal({root: \"$MAILDIR\", env});
    console.log(\"VAL:\" + env.SOME_ARC_TEST_VAR);"
  [[ "$output" == *"VAL:filled"* ]]
}

@test "an export prefixed assignment is parsed" {
  printf '%s\n' "export SOME_ARC_TEST_VAR=exported" > "$MAILDIR/.env.local"
  _m "
    const {loadEnvLocal} = await import(\"./.claude/scripts/leads/lib/env.mjs\");
    const env = {};
    loadEnvLocal({root: \"$MAILDIR\", env});
    console.log(\"VAL:\" + env.SOME_ARC_TEST_VAR);"
  [[ "$output" == *"VAL:exported"* ]]
}

@test "an unparseable line is counted and reported rather than passing silently" {
  printf '%s\n' "this line has no equals sign" > "$MAILDIR/.env.local"
  printf '%s\n' "SOME_ARC_TEST_VAR=ok" >> "$MAILDIR/.env.local"
  _m "
    const {loadEnvLocal} = await import(\"./.claude/scripts/leads/lib/env.mjs\");
    const r = loadEnvLocal({root: \"$MAILDIR\", env: {}});
    console.log(\"SKIPPED:\" + r.skipped.join(\",\") + \" LOADED:\" + r.loaded);"
  [[ "$output" == *"SKIPPED:1 LOADED:1"* ]]
}

@test "an absent env file is reported as absent and loads nothing" {
  _m "
    const {loadEnvLocal} = await import(\"./.claude/scripts/leads/lib/env.mjs\");
    const r = loadEnvLocal({root: \"$MAILDIR/nowhere\", env: {}});
    console.log(\"PRESENT:\" + r.present + \" LOADED:\" + r.loaded);"
  [[ "$output" == *"PRESENT:false LOADED:0"* ]]
}

@test "git ignores .env.local, asked of git rather than read from .gitignore" {
  cd "$ARC_ROOT"
  # Asking git is the point. Reading .gitignore for the string ".env" would pass on a file that
  # a later negation rule un-ignores, and the credential home is exactly the wrong place for a
  # check that is almost right.
  run git check-ignore -q .env.local
  [ "$status" -eq 0 ] || { echo ".env.local is NOT ignored by git -- the credential home is committable"; false; }
}

@test "no .env file is tracked except the example" {
  cd "$ARC_ROOT"
  run git ls-files
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  tracked=$(printf '%s\n' "$output" | grep -c "^\.env" || true)
  [ "$tracked" -eq 1 ] || { echo "expected only .env.example tracked, found $tracked"; false; }
}

# ---------- the CLI surface ----------

@test "mail without a recipient is a usage error" {
  cd "$ARC_ROOT" && ARC_LEADS_FAKE=1 run node .claude/scripts/leads/arc-leads.mjs mail --subject "hello"
  [ "$status" -eq 2 ]
}

@test "a flag whose value is missing does not swallow the next flag" {
  cd "$ARC_ROOT" && ARC_LEADS_FAKE=1 run node .claude/scripts/leads/arc-leads.mjs mail --to --subject hello
  [ "$status" -eq 2 ] || { echo "expected a usage error, got $status: $output"; false; }
}

@test "mail appears in the usage listing" {
  cd "$ARC_ROOT" && ARC_LEADS_FAKE=1 run node .claude/scripts/leads/arc-leads.mjs
  [ "$status" -eq 2 ]
  [[ "$output" == *"mail --to"* ]]
}

# ---------- the send path, end to end against the fake ----------

@test "a fake send returns an id and appends exactly one log line" {
  _m "
    const {sendNotification, readQuota} = await import(\"./.claude/scripts/leads/lib/mail.mjs\");
    const env = {ARC_LEADS_MAIL_FROM:\"arc@automemory.ai\", ARC_LEADS_MAIL_ALLOWLIST:\"arc@automemory.ai\"};
    const r = await sendNotification({to:\"arc@automemory.ai\", subject:\"s\", text:\"t\"},
      {storeDir: \"$MAILDIR\", nowTs:\"2026-08-08T10:00:00+05:30\", env, argv:[]});
    const q = readQuota(\"$MAILDIR\", \"2026-08-08T10:00:00+05:30\");
    console.log(\"ID:\" + (r.id ? \"yes\" : \"no\") + \" DAY:\" + q.day);"
  [[ "$output" == *"ID:yes DAY:1"* ]]
}

@test "a send with no subject is refused before the transport" {
  _m "
    const {sendNotification} = await import(\"./.claude/scripts/leads/lib/mail.mjs\");
    const env = {ARC_LEADS_MAIL_FROM:\"arc@automemory.ai\", ARC_LEADS_MAIL_ALLOWLIST:\"arc@automemory.ai\"};
    try {
      await sendNotification({to:\"arc@automemory.ai\", subject:\"  \", text:\"t\"},
        {storeDir: \"$MAILDIR\", nowTs:\"2026-08-08T10:00:00+05:30\", env, argv:[]});
      console.log(\"UNEXPECTED-SEND\");
    } catch (e) { console.log(\"KIND:\" + e.kind); }"
  [[ "$output" == *"KIND:config"* ]]
}

@test "an unset from address is refused before the transport" {
  _m "
    const {sendNotification} = await import(\"./.claude/scripts/leads/lib/mail.mjs\");
    const env = {ARC_LEADS_MAIL_ALLOWLIST:\"arc@automemory.ai\"};
    try {
      await sendNotification({to:\"arc@automemory.ai\", subject:\"s\", text:\"t\"},
        {storeDir: \"$MAILDIR\", nowTs:\"2026-08-08T10:00:00+05:30\", env, argv:[]});
      console.log(\"UNEXPECTED-SEND\");
    } catch (e) { console.log(\"KIND:\" + e.kind); }"
  [[ "$output" == *"KIND:config"* ]]
}

@test "a refused send does not consume quota" {
  _m "
    const {sendNotification, readQuota} = await import(\"./.claude/scripts/leads/lib/mail.mjs\");
    const env = {ARC_LEADS_MAIL_FROM:\"arc@automemory.ai\", ARC_LEADS_MAIL_ALLOWLIST:\"arc@automemory.ai\"};
    try {
      await sendNotification({to:\"stranger@example.in\", subject:\"s\", text:\"t\"},
        {storeDir: \"$MAILDIR\", nowTs:\"2026-08-08T10:00:00+05:30\", env, argv:[]});
    } catch (e) { /* expected */ }
    const q = readQuota(\"$MAILDIR\", \"2026-08-08T10:00:00+05:30\");
    console.log(\"DAY:\" + q.day);"
  [[ "$output" == *"DAY:0"* ]]
}

@test "the same message inside one minute produces the same idempotency key" {
  _m '
    const {mailIdemKey} = await import("./.claude/scripts/leads/lib/mail.mjs");
    const a = mailIdemKey({to:"arc@automemory.ai", subject:"s", text:"t", nowTs:"2026-08-08T10:00:01+05:30"});
    const b = mailIdemKey({to:"arc@automemory.ai", subject:"s", text:"t", nowTs:"2026-08-08T10:00:59+05:30"});
    console.log(a === b ? "SAME" : "DIFFERENT");'
  [[ "$output" == *"SAME"* ]]
}

@test "the same message in the next minute produces a different idempotency key" {
  _m '
    const {mailIdemKey} = await import("./.claude/scripts/leads/lib/mail.mjs");
    const a = mailIdemKey({to:"arc@automemory.ai", subject:"s", text:"t", nowTs:"2026-08-08T10:00:01+05:30"});
    const b = mailIdemKey({to:"arc@automemory.ai", subject:"s", text:"t", nowTs:"2026-08-08T10:01:01+05:30"});
    console.log(a === b ? "SAME" : "DIFFERENT");'
  [[ "$output" == *"DIFFERENT"* ]]
}

@test "no spine event kind was added for mail" {
  # ADR-0415 decided a notification is the postman and not the news. If a mail.* kind ever
  # appears in the vocabulary, that decision was reversed without an ADR.
  run grep -rniE "\"mail\.(sent|delivered|queued)\"|mail_sent" "$ARC_ROOT/.claude/scripts/hq/lib/" "$ARC_ROOT/.claude/scripts/leads/"
  [ "$status" -ne 0 ] || { echo "a mail event kind appeared: $output"; false; }
}

@test "the mailer policy layer is a separate module from the outreach path" {
  # ADR-0402 keeps the outreach path off the product domain. A shared send helper is how that
  # separation dissolves as a convenience nobody reviews.
  run grep -c "sequencer" "$ARC_ROOT/.claude/scripts/leads/lib/mail.mjs"
  [ "$output" -eq 0 ] || { echo "mail.mjs reached into the outreach path"; false; }
}

@test "this file registers the 47 tests it declares" {
  declared=$(grep -c '^@test ' "$BATS_TEST_FILENAME")
  registered=${#BATS_TEST_NAMES[@]}
  [ "$declared" -eq 47 ] || { echo "declared $declared, expected 47"; false; }
  [ "$registered" -eq "$declared" ] || { echo "bats registered $registered of $declared -- one was DROPPED (non-ASCII name?)"; false; }
}
