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

@test "launch-contract: a zones or records answer that is not an array is read as empty, never a crash" {
  dns odd-shapes
  [ "$(j 'o.scaffold.code')" = "NO_ZONE" ] || { echo "$DONE"; false; }
}

# The repo and ci arms share the in-memory GitHub; arm <probe> <scenario> runs one.
arm() {
  run node "$ARC_ROOT/tests/launch/contract-$1.mjs" "$2"
  [ "$status" -eq 0 ] || { echo "$output"; return 1; }
  [[ "$output" == *"RAN $2"* ]] || { echo "the arm never ran: $output"; return 1; }
  DONE=$(printf '%s\n' "$output" | sed -n 's/^DONE //p')
  [ -n "$DONE" ] || { echo "the arm never finished: $output"; return 1; }
}

@test "launch-contract: repo scaffold twice creates one private tagged repo and reports it" {
  arm repo twice
  [ "$(j 'o.first && o.second')" = "true" ] || { echo "$DONE"; false; }
  [ "$(j 'o.creates')" = "1" ] || { echo "$DONE"; false; }
  [ "$(j 'o.repo.private && o.repo.tagged')" = "true" ] || { echo "$DONE"; false; }
  [ "$(j 'o.reported.join(",")')" = "github-repo technology-ashiq/arc-sandbox" ] || { echo "$DONE"; false; }
  [ "$(j 'o.verify.ok + " " + o.verify.answerer')" = "true api.github.com" ] || { echo "$DONE"; false; }
  [ "$(j 'o.teardown.steps.map(s => s.action).join(",")')" = "archive" ] || { echo "$DONE"; false; }
}

@test "launch-contract: repo refuses a same-name repo it did not create, and a public one, creating nothing" {
  arm repo foreign
  [ "$(j 'o.scaffold.code + " " + o.creates')" = "FOREIGN_REPO 0" ] || { echo "$DONE"; false; }
  arm repo public
  [ "$(j 'o.scaffold.code + " " + o.creates')" = "NOT_PRIVATE 0" ] || { echo "$DONE"; false; }
}

@test "launch-contract: repo refuses a slug that is not a repo name before any call" {
  arm repo bad-slug
  [ "$(j 'o.scaffold.code + " " + o.calls')" = "BAD_SLUG 0" ] || { echo "$DONE"; false; }
}

@test "launch-contract: repo verify on a missing repo is not ok and says so" {
  arm repo verify-missing
  [ "$(j 'o.verify.ok')" = "false" ] || { echo "$DONE"; false; }
  [[ "$(j 'o.verify.reason')" == *"does not exist"* ]] || { echo "$DONE"; false; }
}

@test "launch-contract: ci scaffold twice commits the workflow once, tagged, and requires three checks" {
  arm ci twice
  [ "$(j 'o.first && o.second')" = "true" ] || { echo "$DONE"; false; }
  [ "$(j 'o.workflowCommits + " " + o.tagged + " " + o.local')" = "1 true true" ] || { echo "$DONE"; false; }
  [ "$(j 'o.contexts.join(",")')" = "test (ubuntu-latest),test (windows-latest),test (macos-latest)" ] || { echo "$DONE"; false; }
  [ "$(j 'o.reported.join(",") + " " + o.secondKinds.join(",")')" = "github-workflow,branch-protection github-workflow,branch-protection" ] || { echo "$DONE"; false; }
  [ "$(j 'o.verify.ok + " " + o.verify.answerer')" = "true api.github.com" ] || { echo "$DONE"; false; }
}

@test "launch-contract: ci rewrites a hand-edited workflow against its current sha" {
  arm ci owner-edited
  [ "$(j 'o.scaffold.ok + " " + o.restored + " " + o.lastTagged')" = "true true true" ] || { echo "$DONE"; false; }
}

@test "launch-contract: ci verify names the red leg and the missing protection" {
  arm ci red-leg
  [ "$(j 'o.verify.ok')" = "false" ] || { echo "$DONE"; false; }
  [[ "$(j 'o.verify.reason')" == *"test (windows-latest) failure"* ]] || { echo "$DONE"; false; }
  arm ci unprotected
  [[ "$(j 'o.verify.reason')" == *"main does not require test (ubuntu-latest)"* ]] || { echo "$DONE"; false; }
}

@test "launch-contract: a plan that refuses private-repo protection is refused by name (ADR-1726)" {
  arm ci plan-limit
  [ "$(j 'o.scaffold.code')" = "PLAN_LIMIT" ] || { echo "$DONE"; false; }
  [[ "$(j 'o.scaffold.message')" == *"ADR-1726: record it"* ]] || { echo "$DONE"; false; }
}

@test "launch-contract: ci refuses a repo upstream that is not owner/name, before any call" {
  arm ci bad-upstream
  [ "$(j 'o.scaffold.code + " " + o.calls')" = "BAD_UPSTREAM 0" ] || { echo "$DONE"; false; }
  arm ci no-upstream
  [ "$(j 'o.scaffold.code')" = "UPSTREAM_MISSING" ] || { echo "$DONE"; false; }
}

@test "launch-contract: a malformed GitHub token refuses before any call and is never printed" {
  arm repo malformed-token
  [ "$(j 'o.scaffold.code + " " + o.calls + " " + o.leaked')" = "BAD_TOKEN 0 false" ] || { echo "$DONE"; false; }
  arm ci bad-token
  [ "$(j 'o.scaffold.code + " " + o.calls + " " + o.leaked')" = "BAD_TOKEN 0 false" ] || { echo "$DONE"; false; }
  arm repo bad-token
  [[ "$(j 'o.scaffold.message')" == *"-> 401: Bad credentials"* ]] || { echo "$DONE"; false; }
}

@test "launch-contract: ci verify never takes an older head's green run as the answer" {
  arm ci stale-run
  [ "$(j 'o.verify.ok')" = "false" ] || { echo "$DONE"; false; }
  [[ "$(j 'o.verify.reason')" == *"no run of arc-ci for main's head bbbbbbb yet"* ]] || { echo "$DONE"; false; }
  arm ci branch-run
  [ "$(j 'o.verify.ok')" = "false" ] || { echo "$DONE"; false; }
}

@test "launch-contract: ci verify reports a run still going apart from no run at all" {
  arm ci still-running
  [ "$(j 'o.verify.ok')" = "false" ] || { echo "$DONE"; false; }
  [[ "$(j 'o.verify.reason')" == *"is still in_progress"* ]] || { echo "$DONE"; false; }
}

@test "launch-contract: ci extends the owner's protection, keeping their reviews and checks" {
  arm ci owner-protection
  [ "$(j 'o.scaffold.ok')" = "true" ] || { echo "$DONE"; false; }
  [ "$(j 'o.protection.contexts.join(",")')" = "lint,test (ubuntu-latest),test (windows-latest),test (macos-latest)" ] || { echo "$DONE"; false; }
  [ "$(j 'o.protection.strict + " " + o.protection.reviews.required_approving_review_count')" = "true 2" ] || { echo "$DONE"; false; }
  [ "$(j 'o.reported.join(",")')" = "github-workflow,required-checks" ] || { echo "$DONE"; false; }
}

@test "launch-contract: protection without status checks refuses, and the committed workflow is still recorded" {
  arm ci owner-protection-no-checks
  [ "$(j 'o.scaffold.code')" = "PROTECTION_EXISTS" ] || { echo "$DONE"; false; }
  [ "$(j 'o.reported.join(",")')" = "github-workflow" ] || { echo "$DONE"; false; }
  [ "$(j 'o.protection.reviews.required_approving_review_count')" = "2" ] || { echo "$DONE"; false; }
  arm ci plan-limit
  [ "$(j 'o.reported.join(",")')" = "github-workflow" ] || { echo "$DONE"; false; }
}

@test "launch-contract: ci verify answers a plan limit as not ok, never a thrown refusal" {
  arm ci verify-plan-limit
  [ "$(j 'o.verify.ok + " " + o.verify.value.ok')" = "true false" ] || { echo "$DONE"; false; }
  [[ "$(j 'o.verify.value.reason')" == "PLAN_LIMIT: "* ]] || { echo "$DONE"; false; }
}

@test "launch-contract: repo adopts only a description that ENDS with its marker, and refuses an archived repo" {
  arm repo marker-mid-text
  [ "$(j 'o.scaffold.code + " " + o.creates')" = "FOREIGN_REPO 0" ] || { echo "$DONE"; false; }
  arm repo archived
  [ "$(j 'o.scaffold.code + " " + o.creates')" = "REPO_ARCHIVED 0" ] || { echo "$DONE"; false; }
}

@test "launch-contract: verify answers every coded refusal as not ok, never a throw (repo and ci)" {
  arm repo verify-archived
  [ "$(j 'o.verify.ok + " " + o.verify.value.ok')" = "true false" ] || { echo "$DONE"; false; }
  [[ "$(j 'o.verify.value.reason')" == "REPO_ARCHIVED: "* ]] || { echo "$DONE"; false; }
  arm ci verify-refusals
  [ "$(j 'o.badToken.ok + " " + o.badToken.value.ok')" = "true false" ] || { echo "$DONE"; false; }
  [[ "$(j 'o.badToken.value.reason')" == "BAD_TOKEN: "* ]] || { echo "$DONE"; false; }
  [[ "$(j 'o.noUpstream.value.reason')" == "UPSTREAM_MISSING: "* ]] || { echo "$DONE"; false; }
}

@test "launch-contract: ci does not adopt an identical workflow the owner committed" {
  arm ci foreign-workflow
  [ "$(j 'o.scaffold.code')" = "FOREIGN_WORKFLOW" ] || { echo "$DONE"; false; }
  [ "$(j 'o.reported.length')" = "0" ] || { echo "$DONE"; false; }
}

@test "launch-contract: hosting twice makes one linked project, one domain, one held vercel.json, and reports the CNAME" {
  arm hosting twice
  [ "$(j 'o.first && o.second')" = "true" ] || { echo "$DONE"; false; }
  [ "$(j 'o.projects + " " + o.creates + " " + o.domainPosts + " " + o.holdCommits')" = "1 1 1 1" ] || { echo "$DONE"; false; }
  [ "$(j 'o.hold.ignoreCommand')" = '[ "$VERCEL_ENV" = production ]' ] || { echo "$DONE"; false; }
  [[ "$(j 'o.reported.join(",")')" == *"dns-target abc123.vercel-dns-017.com"* ]] || { echo "$DONE"; false; }
  [ "$(j 'o.verify.ok + " " + o.verify.answerer')" = "true api.vercel.com" ] || { echo "$DONE"; false; }
  [ "$(j 'o.teardown.join(",")')" = "remove-domain,delete-project,delete-if-unchanged" ] || { echo "$DONE"; false; }
}

@test "launch-contract: hosting refuses a project linked to another repo, before any commit" {
  arm hosting foreign-project
  [ "$(j 'o.scaffold.code + " " + o.holdCommits')" = "FOREIGN_PROJECT 0" ] || { echo "$DONE"; false; }
}

@test "launch-contract: hosting never places the hold over a vercel.json launch did not write" {
  arm hosting foreign-file
  [ "$(j 'o.scaffold.code')" = "FOREIGN_FILE" ] || { echo "$DONE"; false; }
  [ "$(j 'o.hold.trim()')" = "{}" ] || { echo "$DONE"; false; }
}

@test "launch-contract: a hosting re-run after release never holds production again" {
  arm hosting released
  [ "$(j 'o.scaffold.ok + " " + o.hold.trim()')" = "true {}" ] || { echo "$DONE"; false; }
}

@test "launch-contract: hosting refuses when Vercel recommends no usable CNAME, reporting no target" {
  arm hosting no-cname
  [ "$(j 'o.scaffold.code + " " + o.targets')" = "NO_TARGET 0" ] || { echo "$DONE"; false; }
  arm hosting evil-cname
  [ "$(j 'o.scaffold.code + " " + o.targets')" = "NO_TARGET 0" ] || { echo "$DONE"; false; }
}

@test "launch-contract: hosting verify answers a missing project and every refusal as not ok" {
  arm hosting verify-before
  [[ "$(j 'o.verify.ok + " " + o.verify.reason')" == "false no vercel project arc-sandbox" ]] || { echo "$DONE"; false; }
  arm hosting verify-refusals
  [[ "$(j 'o.badToken.value.reason')" == "BAD_TOKEN: "* ]] || { echo "$DONE"; false; }
  [[ "$(j 'o.noUpstream.value.reason')" == "UPSTREAM_MISSING: "* ]] || { echo "$DONE"; false; }
}

@test "launch-contract: hosting records an owner's project and domain as found and tears neither down" {
  arm hosting adopted
  [ "$(j 'o.scaffold.ok')" = "true" ] || { echo "$DONE"; false; }
  [ "$(j 'o.kinds.join(",")')" = "vercel-project-found,github-file,vercel-domain-found,dns-target" ] || { echo "$DONE"; false; }
  [ "$(j 'o.teardown.join(",")')" = "delete-if-unchanged" ] || { echo "$DONE"; false; }
}

@test "launch-contract: an unlinked project is told apart from one linked elsewhere" {
  arm hosting unlinked
  [ "$(j 'o.scaffold.code')" = "UNLINKED_PROJECT" ] || { echo "$DONE"; false; }
  [[ "$(j 'o.scaffold.message')" == *"install the Vercel GitHub App"* ]] || { echo "$DONE"; false; }
}

@test "launch-contract: a hold lifted by deleting vercel.json is never placed again" {
  arm hosting deleted-hold
  [ "$(j 'o.scaffold.ok + " " + o.hold')" = "true null" ] || { echo "$DONE"; false; }
}

@test "launch-contract: only an exact release trailer owns vercel.json; an owner edit after release still does not lock hosting out" {
  arm hosting forged-trailer
  [ "$(j 'o.scaffold.code')" = "FOREIGN_FILE" ] || { echo "$DONE"; false; }
  arm hosting owner-edit-after-release
  [ "$(j 'o.scaffold.ok')" = "true" ] || { echo "$DONE"; false; }
  [[ "$(j 'o.hold')" == *'"env"'* ]] || { echo "$DONE"; false; }
}

@test "launch-contract: hosting verify needs the hold commit's deployment, and a 500 is an answer" {
  arm hosting preview-only
  [ "$(j 'o.verify.ok')" = "false" ] || { echo "$DONE"; false; }
  [[ "$(j 'o.verify.reason')" == *"the production hold was never placed"* ]] || { echo "$DONE"; false; }
  arm hosting verify-500
  [ "$(j 'o.verify.ok + " " + o.verify.value.ok')" = "true false" ] || { echo "$DONE"; false; }
  [[ "$(j 'o.verify.value.reason')" == "error: vercel GET /v6/deployments -> 500"* ]] || { echo "$DONE"; false; }
}

@test "launch-contract: hosting verify finds the hold deployment by sha however many pushes came after" {
  arm hosting aged-hold
  [ "$(j 'o.verify.ok')" = "true" ] || { echo "$DONE"; false; }
}

@test "launch-contract: environments opens one tagged preview PR, never touches main, and verifies its READY preview" {
  arm environments twice
  [ "$(j 'o.first && o.second')" = "true" ] || { echo "$DONE"; false; }
  [ "$(j 'o.prs + " " + o.branchCommits + " " + o.mainCommits')" = "1 2 1" ] || { echo "$DONE"; false; }
  [ "$(j 'o.reported.join(",")')" = "github-branch technology-ashiq/arc-sandbox:arc/preview-check,github-pr technology-ashiq/arc-sandbox#1" ] || { echo "$DONE"; false; }
  [ "$(j 'o.verify.ok + " " + o.verify.answerer')" = "true api.vercel.com" ] || { echo "$DONE"; false; }
  [[ "$(j 'o.verify.evidence.url')" == "https://"*".vercel.app" ]] || { echo "$DONE"; false; }
  [ "$(j 'o.teardown.join(",")')" = "close-pr-if-ours,delete-branch-if-ours" ] || { echo "$DONE"; false; }
}

@test "launch-contract: environments refuses a preview-check branch it did not make, opening no PR" {
  arm environments foreign-branch
  [ "$(j 'o.scaffold.code + " " + o.prs')" = "FOREIGN_BRANCH 0" ] || { echo "$DONE"; false; }
}

@test "launch-contract: environments refuses a project with previews off, and a failed preview never verifies" {
  arm environments previews-off
  [ "$(j 'o.scaffold.code')" = "PREVIEWS_DISABLED" ] || { echo "$DONE"; false; }
  arm environments preview-error
  [[ "$(j 'o.verify.ok + " " + o.verify.reason')" == "false preview "*" is ERROR" ]] || { echo "$DONE"; false; }
}

@test "launch-contract: environments verify before apply, and a bad upstream id, answer without a throw or a call" {
  arm environments verify-before
  [[ "$(j 'o.verify.ok + " " + o.verify.reason')" == "false "*"has no arc/preview-check branch" ]] || { echo "$DONE"; false; }
  arm environments bad-upstream
  [ "$(j 'o.scaffold.code + " " + o.calls')" = "BAD_UPSTREAM 0" ] || { echo "$DONE"; false; }
}

@test "launch-contract: tls verifies only an A grade with HSTS on every endpoint, answered by SSL Labs" {
  arm tls apply
  [ "$(j 'o.scaffold.ok + " " + o.reported.join(",") + " " + o.teardown')" = "true tls-managed 0" ] || { echo "$DONE"; false; }
  [ "$(j 'o.verify.ok + " " + o.verify.answerer')" = "true api.ssllabs.com" ] || { echo "$DONE"; false; }
  arm tls grade-b
  [[ "$(j 'o.verify.ok + " " + o.verify.reason')" == "false ssllabs: 76.76.21.22 grade B" ]] || { echo "$DONE"; false; }
  arm tls no-hsts
  [[ "$(j 'o.verify.reason')" == *"no HSTS"* ]] || { echo "$DONE"; false; }
  arm tls pending
  [ "$(j 'o.verify.ok + " " + o.ssllabsCalls')" = "true 4" ] || { echo "$DONE"; false; }
}

@test "launch-contract: tls reports a pending, rate-limited or unreachable scanner as UNSCANNED, never verified" {
  for s in pending-forever rate-limited overloaded unreachable; do
    arm tls "$s"
    [ "$(j 'o.verify.ok')" = "false" ] || { echo "$s: $DONE"; false; }
    [[ "$(j 'o.verify.reason')" == "UNSCANNED("* ]] || { echo "$s: $DONE"; false; }
  done
}

@test "launch-contract: tls refuses while Vercel reports the domain misconfigured" {
  arm tls misconfigured
  [ "$(j 'o.scaffold.code')" = "DOMAIN_MISCONFIGURED" ] || { echo "$DONE"; false; }
}

@test "launch-contract: environments verify never takes an owner's preview-check branch as proof" {
  arm environments owner-branch-verify
  [[ "$(j 'o.verify.ok + " " + o.verify.reason')" == "false FOREIGN_BRANCH: "* ]] || { echo "$DONE"; false; }
}

@test "launch-contract: a branch launch recorded but never committed to is finished; one it never recorded is refused" {
  arm environments killed-after-branch
  [ "$(j 'o.scaffold.ok + " " + o.branchCommits + " " + o.verify.ok')" = "true 2 true" ] || { echo "$DONE"; false; }
  arm environments unrecorded-branch-at-main
  [ "$(j 'o.scaffold.code')" = "FOREIGN_BRANCH" ] || { echo "$DONE"; false; }
}

@test "launch-contract: a token that cannot see the repo refuses, never tries to create" {
  arm environments no-access
  [ "$(j 'o.scaffold.code + " " + o.creates')" = "NO_ACCESS 0" ] || { echo "$DONE"; false; }
}

@test "launch-contract: a closed preview PR is reopened, a merged one refuses, an owner's PR is never claimed" {
  arm environments closed-pr
  [ "$(j 'o.scaffold.ok + " " + o.prs + " " + o.state')" = "true 1 open" ] || { echo "$DONE"; false; }
  arm environments merged-pr
  [ "$(j 'o.scaffold.code + " " + o.prs')" = "PR_MERGED 1" ] || { echo "$DONE"; false; }
  arm environments owner-pr
  [ "$(j 'o.scaffold.code + " " + o.prs + " " + o.claimed')" = "FOREIGN_PR 1 false" ] || { echo "$DONE"; false; }
}

@test "launch-contract: release asks for deploy-prod-first before it writes anything" {
  arm release unapproved
  [ "$(j 'o.release.code')" = "APPROVAL_PENDING" ] || { echo "$DONE"; false; }
  [[ "$(j 'o.hold')" == *"ignoreCommand"* ]] || { echo "$DONE"; false; }
  [ "$(j 'o.tags')" = "0" ] || { echo "$DONE"; false; }
}

@test "launch-contract: the steel thread -- release lifts the hold and tags it once, frontend commits the shell once and the live page passes" {
  arm release thread
  [[ "$(j 'o.before.ok + " " + o.before.reason')" == "false https://sandbox.automemory.ai/ answered 404, not 200" ]] || { echo "$DONE"; false; }
  [ "$(j 'o.release.ok + " " + o.releaseAgain.ok')" = "true true" ] || { echo "$DONE"; false; }
  [ "$(j 'o.hold.trim() + " " + o.tags.join(",")')" = "{} launch-release-1" ] || { echo "$DONE"; false; }
  [ "$(j 'o.releaseVerify.ok + " " + o.releaseVerify.evidence.state')" = "true ERROR" ] || { echo "$DONE"; false; }
  [ "$(j 'o.hostingAgain.ok + " " + o.holdAfterHosting.trim()')" = "true {}" ] || { echo "$DONE"; false; }
  [ "$(j 'o.frontend.ok + " " + o.frontendAgain.ok + " " + o.shellCommits')" = "true true 1" ] || { echo "$DONE"; false; }
  [ "$(j 'o.frontendVerify.ok + " " + o.frontendVerify.answerer')" = "true sandbox.automemory.ai + www.googleapis.com" ] || { echo "$DONE"; false; }
  [ "$(j 'Object.values(o.frontendVerify.evidence.scores).every(v => v >= 90)')" = "true" ] || { echo "$DONE"; false; }
  [ "$(j 'o.kinds.release.join(",") + " " + o.kinds.frontend.join(",")')" = "release-commit,github-tag frontend-shell" ] || { echo "$DONE"; false; }
}

@test "launch-contract: a Lighthouse score under 90 fails, and a PageSpeed quota answer is UNSCANNED" {
  arm release low-score
  [ "$(j 'o.frontendVerify.ok + " " + o.frontendVerify.reason')" = "false lighthouse below 90: performance 71" ] || { echo "$DONE"; false; }
  arm release quota
  [ "$(j 'o.frontendVerify.reason')" = "UNSCANNED(pagespeed quota (429))" ] || { echo "$DONE"; false; }
}

@test "launch-contract: frontend never commits over the owner's code, and release never lifts a hold hosting did not place" {
  arm release owner-code
  [ "$(j 'o.frontend.code + " " + o.page.trim()')" = "FOREIGN_FILE mine" ] || { echo "$DONE"; false; }
  arm release foreign-hold
  [ "$(j 'o.release.code')" = "FOREIGN_FILE" ] || { echo "$DONE"; false; }
}

@test "launch-contract: release does not lift a vercel.json the owner rewrote after hosting" {
  arm release owner-rewrote-hold
  [ "$(j 'o.release.code')" = "FOREIGN_FILE" ] || { echo "$DONE"; false; }
}

@test "launch-contract: a failed production build of a commit that holds an app is not a release receipt" {
  arm release broken-app
  [[ "$(j 'o.releaseVerify.ok + " " + o.releaseVerify.reason')" == "false production build of "*" failed (ERROR) and the commit holds an app" ]] || { echo "$DONE"; false; }
}

@test "launch-contract: a typed hosting trailer over the owner's config does not let release lift it" {
  arm release forged-hosting-trailer
  [ "$(j 'o.release.code + " " + o.text')" = 'FOREIGN_FILE {"rewrites":[]}' ] || { echo "$DONE"; false; }
}

@test "launch-contract: secrets writes the names-only template once and claims only the file it wrote" {
  arm secrets fresh
  [ "$(j 'o.first && o.second')" = "true" ] || { echo "$DONE"; false; }
  [ "$(j 'o.commits + " " + o.kinds.join(",")')" = "1 github-file,env-contract" ] || { echo "$DONE"; false; }
  [ "$(j 'o.verify.ok + " " + o.verify.answerer')" = "true api.vercel.com + api.github.com" ] || { echo "$DONE"; false; }
  [ "$(j 'o.teardown.join(",")')" = "delete-if-unchanged" ] || { echo "$DONE"; false; }
}

@test "launch-contract: secrets names what the owner must place, and passes once it is set for production" {
  arm secrets missing
  [ "$(j 'o.kinds.join(",")')" = "env-contract" ] || { echo "$DONE"; false; }
  [ "$(j 'o.verify.ok + " " + o.verify.reason')" = "false owner places for production: DATABASE_URL" ] || { echo "$DONE"; false; }
  arm secrets preview-only
  [ "$(j 'o.verify.ok')" = "false" ] || { echo "$DONE"; false; }
  arm secrets placed
  [ "$(j 'o.verify.ok')" = "true" ] || { echo "$DONE"; false; }
}

@test "launch-contract: secrets never asks Vercel to decrypt and never carries a value" {
  arm secrets placed
  [ "$(j 'o.decryptAsked + " " + o.valueSeen')" = "false false" ] || { echo "$DONE"; false; }
}

@test "launch-contract: a key file in git fails verify; the template variants do not" {
  arm secrets leaked
  [ "$(j 'o.verify.ok + " " + o.verify.reason')" = "false key file in git (main tip tree): apps/web/.env.local" ] || { echo "$DONE"; false; }
}

@test "launch-contract: a template that carries a value or a line that is not NAME= is refused" {
  arm secrets value-in-template
  [ "$(j 'o.scaffold.code')" = "VALUE_IN_GIT" ] || { echo "$DONE"; false; }
  [[ "$(j 'o.scaffold.message')" != *"has-a-value"* ]] || { echo "$DONE"; false; }
  arm secrets bad-line
  [[ "$(j 'o.verify.reason')" == "BAD_CONTRACT: "* ]] || { echo "$DONE"; false; }
  arm secrets truncated
  [[ "$(j 'o.verify.reason')" == *"too large to list"* ]] || { echo "$DONE"; false; }
}

@test "launch-contract: multi-segment and upper-case env files are keys in git; a .x.example is a template" {
  arm secrets leaked-shapes
  [ "$(j 'o.verify.reason')" = "key file in git (main tip tree): apps/web/.env.production.local" ] || { echo "$DONE"; false; }
  [ "$(j 'o.verifyUpper.reason')" = "key file in git (main tip tree): .ENV" ] || { echo "$DONE"; false; }
}

@test "launch-contract: a contract that is a directory or too large to read is refused, never read as empty" {
  arm secrets contract-not-a-file
  [[ "$(j 'o.dir.ok + " " + o.dir.reason')" == "false BAD_CONTRACT: "* ]] || { echo "$DONE"; false; }
  [[ "$(j 'o.big.ok + " " + o.big.reason')" == "false BAD_CONTRACT: "* ]] || { echo "$DONE"; false; }
}

@test "launch-contract: a kill after the template PUT is recovered by its trailer, and the file is pinned to its blob sha" {
  arm secrets killed-after-put
  [ "$(j 'o.kinds.join(",")')" = "github-file,env-contract" ] || { echo "$DONE"; false; }
  [[ "$(j 'o.fileId')" =~ ^technology-ashiq/arc-sandbox:\.env\.example@[0-9a-f]{40}$ ]] || { echo "$DONE"; false; }
}

@test "launch-contract: *.env and .envrc are keys in git too" {
  arm secrets more-shapes
  [ "$(j 'o.suffix.reason')" = "key file in git (main tip tree): config/prod.env" ] || { echo "$DONE"; false; }
  [ "$(j 'o.envrc.reason')" = "key file in git (main tip tree): .envrc" ] || { echo "$DONE"; false; }
}

@test "launch-contract: a path built to backtrack the key-file check answers at once" {
  arm secrets pathological
  [ "$(j 'o.verify.ok + " " + (o.ms < 2000)')" = "true true" ] || { echo "$DONE"; false; }
}
