#!/usr/bin/env bats
# launch Phase 01 -- each real adapter driven through its real code path against an in-memory provider (PLAN
# test-surface table). Only the transport is fake; the row, ctx and its host guard are the ones the runner uses.
# Every probe prints `RAN <scenario>` first and `DONE <json>` last, and both are asserted before anything else.
bats_require_minimum_version 1.5.0
load 'test_helper'

dns() {
  run node "$ARC_ROOT/tests/launch/contract-dns.mjs" "$1"
  [ "$status" -eq 0 ] || { echo "$output"; return 1; }
  [[ "$output" == *"RAN $1"* ]] || { echo "the arm never ran: $output"; return 1; }
  DONE=$(printf '%s\n' "$output" | sed -n 's/^DONE //p')
  [ -n "$DONE" ] || { echo "the arm never finished: $output"; return 1; }
}
# Reads one JS expression over the arm's result object, e.g. j 'o.records.length'.
j() { node -e 'const o=JSON.parse(process.argv[1]);console.log(String(eval(process.argv[2])))' "$DONE" "$1"; }

@test "launch-contract: every test in this file is registered (none dropped by name)" {
  local declared; declared=$(grep -c '^@test ' "$BATS_TEST_FILENAME")
  [ "$declared" -gt 0 ]
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "launch-contract: dns scaffold twice leaves exactly one grey-cloud CNAME to the hosting target" {
  dns twice
  [ "$(j 'o.first && o.second')" = "true" ] || { echo "$DONE"; false; }
  [ "$(j 'o.records.length')" = "1" ] || { echo "$DONE"; false; }
  [ "$(j 'o.posts')" = "1" ] || { echo "$DONE"; false; }
  [ "$(j 'o.records[0].type + " " + o.records[0].content + " " + o.records[0].proxied')" = "CNAME abc123.vercel-dns-017.com false" ] || { echo "$DONE"; false; }
  [ "$(j 'o.records[0].comment')" = "arc-sandbox@dns@cloudflare-dns" ] || { echo "$DONE"; false; }
  [ "$(j 'o.reported.join(",")')" = "dns-record" ] || { echo "$DONE"; false; }
}

@test "launch-contract: dns verify is answered by both public resolvers and names them" {
  dns twice
  [ "$(j 'o.verify.ok')" = "true" ] || { echo "$DONE"; false; }
  [ "$(j 'o.verify.answerer')" = "dns.google + cloudflare-dns.com" ] || { echo "$DONE"; false; }
  [ "$(j 'o.teardown.steps.map(s => s.action).join(",")')" = "delete" ] || { echo "$DONE"; false; }
}

@test "launch-contract: dns refuses to touch a record with the same name it did not create" {
  dns foreign
  [ "$(j 'o.scaffold.ok')" = "false" ] || { echo "$DONE"; false; }
  [ "$(j 'o.scaffold.code')" = "FOREIGN_RECORD" ] || { echo "$DONE"; false; }
  [ "$(j 'o.records.length + " " + o.records[0].content')" = "1 192.0.2.1" ] || { echo "$DONE"; false; }
}

@test "launch-contract: dns corrects its own drifted record (wrong target, orange cloud) in place" {
  dns drifted
  [ "$(j 'o.scaffold.ok')" = "true" ] || { echo "$DONE"; false; }
  [ "$(j 'o.records.length + " " + o.records[0].content + " " + o.records[0].proxied')" = "1 abc123.vercel-dns-017.com false" ] || { echo "$DONE"; false; }
}

@test "launch-contract: a proxied record never verifies (the CNAME is hidden behind the edge)" {
  dns proxied-verify
  [ "$(j 'o.verify.ok')" = "false" ] || { echo "$DONE"; false; }
  [[ "$(j 'o.verify.reason')" == *"not abc123.vercel-dns-017.com at both resolvers"* ]] || { echo "$DONE"; false; }
}

@test "launch-contract: dns refuses an upstream target that is not a plain hostname, before any create" {
  dns bad-target
  [ "$(j 'o.scaffold.code')" = "BAD_TARGET" ] || { echo "$DONE"; false; }
  [ "$(j 'o.posts')" = "0" ] || { echo "$DONE"; false; }
}

@test "launch-contract: dns refuses with no dns-target upstream, and with two" {
  dns no-upstream
  [ "$(j 'o.scaffold.code')" = "UPSTREAM_MISSING" ] || { echo "$DONE"; false; }
  dns two-targets
  [ "$(j 'o.scaffold.code')" = "UPSTREAM_MISSING" ] || { echo "$DONE"; false; }
}

@test "launch-contract: a rejected token surfaces Cloudflare's status, never a silent pass" {
  dns bad-token
  [ "$(j 'o.scaffold.ok')" = "false" ] || { echo "$DONE"; false; }
  [[ "$(j 'o.scaffold.message')" == *"-> 401 (10000: Authentication error)"* ]] || { echo "$DONE"; false; }
}

@test "launch-contract: ctx.upstream is frozen all the way down" {
  dns upstream-frozen
  [ "$(j 'o.frozen')" = "true" ] || { echo "$DONE"; false; }
}

@test "launch-contract: dns flips its own orange-cloud record to grey in place" {
  dns proxied
  [ "$(j 'o.scaffold.ok')" = "true" ] || { echo "$DONE"; false; }
  [ "$(j 'o.records.length + " " + o.records[0].proxied')" = "1 false" ] || { echo "$DONE"; false; }
}

@test "launch-contract: a TXT record at the name also refuses (a CNAME shares its name with nothing)" {
  dns foreign-txt
  [ "$(j 'o.scaffold.code')" = "FOREIGN_RECORD" ] || { echo "$DONE"; false; }
  [ "$(j 'o.records.length + " " + o.records[0].type')" = "1 TXT" ] || { echo "$DONE"; false; }
}

@test "launch-contract: malformed upstream entries are dropped, never coerced to a hostname" {
  dns malformed-upstream
  [ "$(j 'o.scaffold.ok')" = "true" ] || { echo "$DONE"; false; }
  [ "$(j 'o.records.join(",")')" = "abc123.vercel-dns-017.com" ] || { echo "$DONE"; false; }
}

@test "launch-contract: an already-aborted slot timeout stops the verify poll at once" {
  dns aborted-verify
  [ "$(j 'o.verify.ok')" = "false" ] || { echo "$DONE"; false; }
  [ "$(j 'o.verify.code')" = "ABORTED" ] || { echo "$DONE"; false; }
  [ "$(j 'o.ms < 5000')" = "true" ] || { echo "$DONE"; false; }
}

@test "launch-contract: a hostile provider error is stripped of line breaks and bidi and capped" {
  dns hostile-error
  [ "$(j 'o.scaffold.ok')" = "false" ] || { echo "$DONE"; false; }
  [[ "$(j 'o.scaffold.message')" == *"-> 403 (1: evilFAKE LINE xxx"* ]] || { echo "$DONE"; false; }
  [ "$(j '[...o.scaffold.message].some((c) => c === String.fromCharCode(10) || c === String.fromCharCode(0x202e))')" = "false" ] || { echo "$DONE"; false; }
  [ "$(j 'o.scaffold.message.length < 260')" = "true" ] || { echo "$DONE"; false; }
}

@test "launch-contract: a token with a trailing CR (a CRLF env file) is trimmed and works" {
  dns crlf-token
  [ "$(j 'o.scaffold.ok')" = "true" ] || { echo "$DONE"; false; }
}

@test "launch-contract: a token that is not a token shape refuses without printing it" {
  dns broken-token
  [ "$(j 'o.scaffold.code')" = "BAD_TOKEN" ] || { echo "$DONE"; false; }
  [ "$(j 'o.leaked')" = "false" ] || { echo "$DONE"; false; }
}

@test "launch-contract: a malformed errors list still surfaces the HTTP status" {
  dns null-errors
  [ "$(j 'o.scaffold.ok')" = "false" ] || { echo "$DONE"; false; }
  [[ "$(j 'o.scaffold.message')" == *"cloudflare GET /zones -> 403"* ]] || { echo "$DONE"; false; }
}

@test "launch-contract: zero-width and bidi marks are stripped and the cap never splits a surrogate pair" {
  dns invisible-error
  [[ "$(j 'o.scaffold.message')" == *"-> 403 (9: aby"* ]] || { echo "$DONE"; false; }
  [ "$(j 'o.invisible')" = "false" ] || { echo "$DONE"; false; }
  [ "$(j 'o.loneSurrogate')" = "false" ] || { echo "$DONE"; false; }
}
