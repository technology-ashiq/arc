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

@test "launch-contract: under the owner's absent-plan ruling a plan limit records protection ABSENT and three green legs verify (ADR-1735)" {
  arm ci absent-ruling
  [ "$(j 'o.scaffold.ok + " " + o.again.ok + " " + o.workflowCommits')" = "true true 1" ] || { echo "$DONE"; false; }
  [ "$(j 'o.reported.join(",")')" = "github-workflow technology-ashiq/arc-sandbox:.github/workflows/arc-ci.yml,protection-absent technology-ashiq/arc-sandbox@main" ] || { echo "$DONE"; false; }
  [ "$(j 'o.notes.join(",")')" = "required checks ABSENT(plan: private-repo protection) (ADR-1735)" ] || { echo "$DONE"; false; }
  [ "$(j 'o.verify.ok + " " + o.verify.evidence.required')" = "true ABSENT(plan: private-repo protection)" ] || { echo "$DONE"; false; }
  [ "$(j 'o.teardown.steps.map(s => s.action).join(",")')" = "delete" ] || { echo "$DONE"; false; }
  arm ci absent-ruling-red
  [ "$(j 'o.verify.ok')" = "false" ] || { echo "$DONE"; false; }
  [[ "$(j 'o.verify.reason')" == *"test (windows-latest) failure"* ]] || { echo "$DONE"; false; }
}

@test "launch-contract: the absent-plan ruling never skips protection GitHub would grant (ADR-1735)" {
  arm ci absent-ruling-no-limit
  [ "$(j 'o.scaffold.ok + " " + o.reported.join(",")')" = "true github-workflow,branch-protection" ] || { echo "$DONE"; false; }
  [ "$(j 'o.contexts.join(",")')" = "test (ubuntu-latest),test (windows-latest),test (macos-latest)" ] || { echo "$DONE"; false; }
  [ "$(j 'o.verify.ok + " " + o.verify.evidence.required.length')" = "true 3" ] || { echo "$DONE"; false; }
  [ "$(j 'o.unprotected.ok')" = "false" ] || { echo "$DONE"; false; }
  [[ "$(j 'o.unprotected.reason')" == *"main does not require test (ubuntu-latest)"* ]] || { echo "$DONE"; false; }
}

@test "launch-contract: a ci_protection value that is not required or absent-plan refuses before any call (ADR-1735)" {
  arm ci bad-ruling
  [ "$(j 'o.scaffold.code + " " + o.calls')" = "BAD_RULING 0" ] || { echo "$DONE"; false; }
  [ "$(j 'o.verify.ok + " " + o.verify.value.ok')" = "true false" ] || { echo "$DONE"; false; }
  [[ "$(j 'o.verify.value.reason')" == "BAD_RULING: "* ]] || { echo "$DONE"; false; }
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

@test "launch-contract: database creates one project in the venture's region and proves RLS as anon" {
  arm database fresh
  [ "$(j 'o.first && o.second')" = "true" ] || { echo "$DONE"; false; }
  [ "$(j 'o.projects + " " + o.region + " " + o.kinds.join(",")')" = "1 ap-south-1 supabase-project,db-probe-table" ] || { echo "$DONE"; false; }
  [ "$(j 'o.verify.ok + " " + o.verify.evidence.ownerRows + " " + o.verify.evidence.anonRows')" = "true 1 0" ] || { echo "$DONE"; false; }
  [ "$(j 'o.teardown.join(",")')" = "drop-table (down migration),pause-then-delete-project" ] || { echo "$DONE"; false; }
}

@test "launch-contract: the generated database password is long and goes nowhere but Supabase" {
  arm database fresh
  [ "$(j 'o.passLen + " " + o.passLeaked')" = "64 false" ] || { echo "$DONE"; false; }
}

@test "launch-contract: RLS that lets anon read, or a policy on the probe, never verifies" {
  arm database rls-off
  [ "$(j 'o.verify.ok + " " + o.verify.reason')" = "false anon reads 1 probe row(s): RLS is not denying" ] || { echo "$DONE"; false; }
  arm database policy
  [ "$(j 'o.scaffold.code')" = "PROBE_HAS_POLICY" ] || { echo "$DONE"; false; }
  [ "$(j 'o.verify.ok')" = "false" ] || { echo "$DONE"; false; }
}

@test "launch-contract: database refuses two organizations and an unknown region, creating nothing" {
  arm database two-orgs
  [ "$(j 'o.scaffold.code')" = "ORG_AMBIGUOUS" ] || { echo "$DONE"; false; }
  arm database bad-region
  [ "$(j 'o.scaffold.code + " " + o.creates')" = "BAD_REGION 0" ] || { echo "$DONE"; false; }
}

@test "launch-contract: an owner's project is found, not owned, and a paused one is PAUSED" {
  arm database found
  [ "$(j 'o.kinds[0] + " " + o.teardown.join(",")')" = "supabase-project-found drop-table (down migration)" ] || { echo "$DONE"; false; }
  arm database paused
  [[ "$(j 'o.verify.reason')" == "PAUSED("* ]] || { echo "$DONE"; false; }
}

@test "launch-contract: a query answer that is not a rows array is a not-ok answer" {
  arm database object-shape
  # The first query of scaffold already meets the bad shape, so the refusal is scaffold's, and verify is still not ok.
  [ "$(j 'o.scaffold.ok + " " + o.scaffold.message')" = "false supabase database/query answered without a rows array" ] || { echo "$DONE"; false; }
  [ "$(j 'o.verify.ok')" = "false" ] || { echo "$DONE"; false; }
}

@test "launch-contract: email writes Resend's records plus DMARC quarantine once, grey cloud, and verifies" {
  arm email fresh
  [ "$(j 'o.first && o.second')" = "true" ] || { echo "$DONE"; false; }
  [ "$(j 'o.domains + " " + o.records.length + " " + o.status')" = "1 4 verified" ] || { echo "$DONE"; false; }
  [ "$(j 'o.records.every(r => r.endsWith(" false"))')" = "true" ] || { echo "$DONE"; false; }
  [[ "$(j 'o.dmarc')" == "v=DMARC1; p=quarantine;"* ]] || { echo "$DONE"; false; }
  [ "$(j 'o.verify.ok + " " + o.verify.answerer')" = "true api.resend.com + dns.google + cloudflare-dns.com" ] || { echo "$DONE"; false; }
  [ "$(j 'o.records.join(",")')" = "MX send.sandbox.automemory.ai false,TXT _dmarc.sandbox.automemory.ai false,TXT resend._domainkey.sandbox.automemory.ai false,TXT send.sandbox.automemory.ai false" ] || { echo "$DONE"; false; }
  [ "$(j 'o.teardown.filter(s => s === "delete-if-tagged").length + " " + o.teardown.slice(-1)[0]')" = "4 delete-domain" ] || { echo "$DONE"; false; }
}

@test "launch-contract: email never writes over the owner's DMARC, and refuses records outside the domain or of other types" {
  arm email owner-dmarc
  [ "$(j 'o.scaffold.code + " " + o.written')" = "FOREIGN_RECORD 0" ] || { echo "$DONE"; false; }
  arm email outside-zone
  [ "$(j 'o.scaffold.code + " " + o.written')" = "BAD_RECORD 0" ] || { echo "$DONE"; false; }
  arm email bad-type
  [ "$(j 'o.scaffold.code + " " + o.written')" = "BAD_RECORD 0" ] || { echo "$DONE"; false; }
  arm email owner-other-txt
  [ "$(j 'o.scaffold.ok')" = "true" ] || { echo "$DONE"; false; }
}

@test "launch-contract: email verify is not ok when Resend has not verified" {
  arm email unverified
  [[ "$(j 'o.verify.ok + " " + o.verify.reason')" == "false resend failed;"* ]] || { echo "$DONE"; false; }
}

@test "launch-contract: an owner's launch_probe table is never altered, and a refusal after UP still records the table" {
  arm database owner-probe-table
  [ "$(j 'o.scaffold.code + " " + o.rls')" = "PROBE_TABLE_FOREIGN false" ] || { echo "$DONE"; false; }
  arm database policy-recorded
  [ "$(j 'o.scaffold.code + " " + o.kinds.join(",")')" = "PROBE_HAS_POLICY supabase-project,db-probe-table" ] || { echo "$DONE"; false; }
}

@test "launch-contract: a slow Supabase start is a resumable refusal inside the lock window" {
  arm database slow-start
  [ "$(j 'o.scaffold.code + " " + o.kinds.join(",")')" = "PROJECT_NOT_READY supabase-project" ] || { echo "$DONE"; false; }
  [[ "$(j 'o.scaffold.message')" == *"apply again to resume"* ]] || { echo "$DONE"; false; }
}

@test "launch-contract: email finds its domain past the first page instead of creating a second" {
  arm email paged
  [ "$(j 'o.scaffold.ok + " " + o.domains + " " + o.kind')" = "true 151 resend-domain-found" ] || { echo "$DONE"; false; }
}

@test "launch-contract: database verify reads as anon through PostgREST, and a probe table killed before recording is resumed" {
  arm database fresh
  [ "$(j 'o.verify.answerer')" = "api.supabase.com + fixtureref0000000001.supabase.co" ] || { echo "$DONE"; false; }
  arm database killed-before-record
  [ "$(j 'o.scaffold.ok + " " + o.kinds.join(",")')" = "true supabase-project,db-probe-table" ] || { echo "$DONE"; false; }
}

@test "launch-contract: an owner CNAME at a name email needs refuses before any record is written" {
  arm email owner-cname
  [ "$(j 'o.scaffold.code + " " + o.written')" = "FOREIGN_RECORD 0" ] || { echo "$DONE"; false; }
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

@test "launch-contract: a no-op frontend reports launch's own commit, not the owner's later head, and identical owner bytes are refused (attack b1844e0 B1)" {
  arm release owner-later-commits
  [ "$(j 'o.firstId === o.againId')" = "true" ] || { echo "$DONE"; false; }
  [ "$(j 'o.headIsOwner + " " + o.adopted.ok + " " + o.adopted.code')" = "false false FOREIGN_FILE" ] || { echo "$DONE"; false; }
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

@test "launch-contract: the shell's manifest carries Phase 01's dependencies and backend/orm never edit it" {
  arm app thread
  [ "$(j 'Object.keys(o.pkg.dependencies).sort().join(",")')" = "@supabase/ssr,@supabase/supabase-js,drizzle-orm,next,react,react-dom,zod" ] || { echo "$DONE"; false; }
  [ "$(j 'o.pkg.scripts.test')" = "node --test" ] || { echo "$DONE"; false; }
  [ "$(j 'o.pkgUnchanged + " " + o.frontendAgain.ok')" = "true true" ] || { echo "$DONE"; false; }
}

@test "launch-contract: backend commits the health contract once and the live route answers exactly it" {
  arm app thread
  [ "$(j 'o.backend.ok + " " + o.backendAgain.ok + " " + o.commits.backend')" = "true true 1" ] || { echo "$DONE"; false; }
  [ "$(j 'o.backendVerify.ok + " " + o.backendVerify.answerer')" = "true sandbox.automemory.ai" ] || { echo "$DONE"; false; }
}

@test "launch-contract: orm commits the typed schema once and is verified by arc-ci green on main's head" {
  arm app thread
  [ "$(j 'o.orm.ok + " " + o.ormAgain.ok + " " + o.commits.orm')" = "true true 1" ] || { echo "$DONE"; false; }
  [ "$(j 'o.ormVerify.ok + " " + o.ormVerify.answerer')" = "true api.github.com" ] || { echo "$DONE"; false; }
  [ "$(j 'o.kinds.backend.join(",") + " " + o.kinds.orm.join(",")')" = "backend-route orm-schema" ] || { echo "$DONE"; false; }
}

@test "launch-contract: backend never commits over the owner's route, and an answer outside the contract fails" {
  arm app owner-route
  [ "$(j 'o.backend.code')" = "FOREIGN_FILE" ] || { echo "$DONE"; false; }
  arm app bad-health
  [[ "$(j 'o.backendVerify.ok + " " + o.backendVerify.reason')" == "false "*"answers outside the contract (keys: debug,ok,service,version)" ]] || { echo "$DONE"; false; }
  arm app before-backend
  # Before backend has run, its files are not on main: verify says so before it ever asks the live site.
  [[ "$(j 'o.backendVerify.ok + " " + o.backendVerify.reason')" == "false "*"lib/contract.js is not launch's file" ]] || { echo "$DONE"; false; }
}

@test "launch-contract: orm verify names a red leg, and orm refuses without the database's probe table" {
  arm app red-ci
  [[ "$(j 'o.ormVerify.ok + " " + o.ormVerify.reason')" == "false run "*"test (windows-latest) failure" ]] || { echo "$DONE"; false; }
  arm app no-probe
  [ "$(j 'o.orm.code')" = "UPSTREAM_MISSING" ] || { echo "$DONE"; false; }
}

@test "launch-contract: once the owner rewrites the schema or route, green CI and a live 200 are no longer launch's proof" {
  arm app owner-edits-after
  [[ "$(j 'o.ormVerify.ok + " " + o.ormVerify.reason')" == "false "*"db/schema.js is not launch's schema file" ]] || { echo "$DONE"; false; }
  [[ "$(j 'o.backendVerify.ok + " " + o.backendVerify.reason')" == "false "*"is not launch's file" ]] || { echo "$DONE"; false; }
}

@test "launch-contract: identical bytes the owner committed are not launch's without its trailer" {
  arm app owner-copy
  [ "$(j 'o.backend.code')" = "FOREIGN_FILE" ] || { echo "$DONE"; false; }
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

@test "launch-contract: payment-test makes one tagged INR 1 test order, finds it again, and verify fetches it back (ADR-1736)" {
  arm payment twice
  [ "$(j 'o.first + " " + o.second + " " + o.creates + " " + o.orders')" = "true true 1 1" ] || { echo "$DONE"; false; }
  [ "$(j 'o.order.amount + " " + o.order.currency + " " + o.order.receipt + " " + o.order.tagged')" = "100 INR arc-launch-arc-sandbox true" ] || { echo "$DONE"; false; }
  [ "$(j 'o.reported.join(",")')" = "razorpay-test-order" ] || { echo "$DONE"; false; }
  [[ "$(j 'o.notes[0]')" == *"checkout-portal -> webhooks-ledger -> refunds"* ]] || { echo "$DONE"; false; }
  [ "$(j 'o.verify.ok + " " + o.verify.answerer + " " + o.verify.evidence.mode')" = "true api.razorpay.com test" ] || { echo "$DONE"; false; }
  [ "$(j 'o.teardown.join(",")')" = "none (test-mode order, Razorpay keeps it)" ] || { echo "$DONE"; false; }
}

@test "launch-contract: a live Razorpay key refuses before any call, in scaffold and in verify (gate 3 never crossed)" {
  arm payment live-key
  [ "$(j 'o.scaffold.code + " " + o.calls')" = "LIVE_KEY 0" ] || { echo "$DONE"; false; }
  [ "$(j 'o.verify.ok + " " + o.verify.value.ok')" = "true false" ] || { echo "$DONE"; false; }
  [[ "$(j 'o.verify.value.reason')" == "LIVE_KEY: "* ]] || { echo "$DONE"; false; }
}

@test "launch-contract: malformed Razorpay keys refuse before any call and are never printed" {
  arm payment bad-key
  [ "$(j 'o.scaffold.code + " " + o.calls + " " + o.leaked')" = "BAD_TOKEN 0 false" ] || { echo "$DONE"; false; }
  [ "$(j 'o.badId.code')" = "BAD_TOKEN" ] || { echo "$DONE"; false; }
  arm payment wrong-pair
  [[ "$(j 'o.scaffold.message')" == *"-> 401: The api key provided is invalid"* ]] || { echo "$DONE"; false; }
  [ "$(j 'o.creates')" = "0" ] || { echo "$DONE"; false; }
}

@test "launch-contract: an order with launch's receipt but not its tag is never adopted; launch's own is found, not doubled" {
  arm payment foreign-order
  [ "$(j 'o.scaffold.code + " " + o.creates + " " + o.reported')" = "FOREIGN_ORDER 0 0" ] || { echo "$DONE"; false; }
  arm payment found-mine
  [ "$(j 'o.scaffold.ok + " " + o.creates + " " + o.reported.join(",")')" = "true 0 order_Mine00000000001" ] || { echo "$DONE"; false; }
}

@test "launch-contract: payment-test verify is not ok for a changed amount, a lost tag, a missing order, or no record" {
  arm payment verify-tampered
  [[ "$(j 'o.amount.ok + " " + o.amount.reason')" == "false order "*" is 50000 INR, not 100 INR" ]] || { echo "$DONE"; false; }
  [[ "$(j 'o.untagged.ok + " " + o.untagged.reason')" == "false order "*" does not carry this slot's tag" ]] || { echo "$DONE"; false; }
  [[ "$(j 'o.missing.ok + " " + o.missing.reason')" == "false razorpay has no order "* ]] || { echo "$DONE"; false; }
  arm payment verify-no-record
  [ "$(j 'o.verify.ok + " " + o.calls')" = "false 0" ] || { echo "$DONE"; false; }
  [[ "$(j 'o.verify.reason')" == *"verify needs exactly one"* ]] || { echo "$DONE"; false; }
}

@test "launch-contract: payment-test reads an order list without items as unreadable, never as absent (attack 1cb6b9a B1)" {
  arm payment list-no-items
  [ "$(j 'o.scaffold.ok + " " + o.creates')" = "false 0" ] || { echo "$DONE"; false; }
  [[ "$(j 'o.scaffold.message')" == *"without an items array; nothing was created"* ]] || { echo "$DONE"; false; }
}

@test "launch-contract: two long slugs sharing a prefix get different receipts, both 40 characters or fewer (attack 1cb6b9a B2)" {
  arm payment long-slugs
  [ "$(j 'o.second.ok + " " + o.creates + " " + (o.receipts[0] !== o.receipts[1])')" = "true 2 true" ] || { echo "$DONE"; false; }
  [ "$(j 'o.receipts.every(r => r.length <= 40)')" = "true" ] || { echo "$DONE"; false; }
}

@test "launch-contract: an empty tag never adopts an untagged order, and a 400 that is not absence is reported as itself (attack 1cb6b9a B3, B6)" {
  arm payment empty-tag
  [ "$(j 'o.scaffold.code + " " + o.creates')" = "FOREIGN_ORDER 0" ] || { echo "$DONE"; false; }
  arm payment verify-400-other
  [ "$(j 'o.verify.ok')" = "false" ] || { echo "$DONE"; false; }
  [[ "$(j 'o.verify.reason')" == *"-> 400: Bad request: the server is busy"* ]] || { echo "$DONE"; false; }
}

@test "launch-contract: payment-test finds its order past the first page when the list ignores the receipt filter (attack da7f2e0 B1)" {
  arm payment ignored-filter
  [ "$(j 'o.scaffold.ok + " " + o.creates + " " + o.lists + " " + o.reported.join(",")')" = "true 0 2 order_Mine00000000001" ] || { echo "$DONE"; false; }
}

@test "launch-contract: webhooks-ledger commits its route once, makes its table with RLS and the marker, adds two env names, and a re-scaffold creates nothing (ADR-1739)" {
  arm webhooks thread
  [ "$(j 'o.first + " " + o.second + " " + o.commits')" = "true true 1" ] || { echo "$DONE"; false; }
  [ "$(j 'o.kinds.join(",")')" = "db-tables,webhook-route,venture-repo,supabase-ref" ] || { echo "$DONE"; false; }
  [ "$(j 'o.table.rls + " " + o.table.comment')" = "true arc-launch webhooks" ] || { echo "$DONE"; false; }
  [ "$(j 'o.env.split("\n").filter(Boolean).join(",")')" = "RAZORPAY_WEBHOOK_SECRET=,SUPABASE_SERVICE_ROLE_KEY=" ] || { echo "$DONE"; false; }
  [ "$(j 'o.teardown.join(",")')" = "drop razorpay_webhook_events if it still carries the arc-launch webhooks marker (down migration)" ] || { echo "$DONE"; false; }
}

@test "launch-contract: webhooks-ledger verify delivers one signed event twice and reads back exactly one row, on every verify (ADR-1739)" {
  arm webhooks thread
  [ "$(j 'o.verify.ok + " " + o.verify.answerer')" = "true sandbox.automemory.ai + api.supabase.com" ] || { echo "$DONE"; false; }
  [ "$(j 'o.verify.evidence.stored + " " + o.verify.evidence.replays + " " + o.verify.evidence.reserialised + " " + o.verify.evidence.no_event_id')" = "1 2 401 400" ] || { echo "$DONE"; false; }
  [ "$(j 'o.rowsAfterVerify + " " + o.verifyAgain + " " + o.rowsAfterSecondVerify')" = "1 true 1" ] || { echo "$DONE"; false; }
  [ "$(j 'o.queued.length + " " + o.queued[0].kind + " " + o.queued[0].payload.amount + " " + o.queued[0].payload.currency')" = "1 revenue.simulated 100 INR" ] || { echo "$DONE"; false; }
  [[ "$(j 'o.queued[0].payload.payment_id')" == pay_ArcProbe0* ]] || { echo "$DONE"; false; }
}

@test "launch-contract: the probe payment is booked once as revenue.simulated, a replay adds zero events, and the P&L labels the line simulated (ADR-1739)" {
  arm webhooks thread
  [ "$(j 'o.book.state + " " + o.bookAgain.state')" = "landed recorded" ] || { echo "$DONE"; false; }
  [ "$(j 'o.spine.simulated + " " + o.spine.received')" = "1 0" ] || { echo "$DONE"; false; }
  [[ "$(j 'o.simulatedLines[0]')" == *"SIMULATED"* ]] || { echo "$DONE"; false; }
  [ "$(j 'o.simulatedLines.slice(1).every((l) => l.startsWith("SIMULATED"))')" = "true" ] || { echo "$DONE"; false; }
  [ "$(j 'o.simulatedLines.some((l) => l.includes("arc-sandbox")) && o.simulatedLines.some((l) => l.includes("razorpay:pay_ArcProbe0") && l.includes("1.00"))')" = "true" ] || { echo "$DONE"; false; }
  [ "$(j 'o.realVentures')" = "0" ] || { echo "$DONE"; false; }
}

@test "launch-contract: the committed webhook route stores a valid signed event once, and a replay of it adds no row (ADR-1739)" {
  arm webhooks route
  [ "$(j 'o.valid.status + " " + o.valid.body.stored')" = "200 true" ] || { echo "$DONE"; false; }
  [ "$(j 'o.replay.status + " " + o.replay.body.stored + " " + o.rowsAfterReplay')" = "200 false 1" ] || { echo "$DONE"; false; }
  [ "$(j 'o.stored.length + " " + o.stored[0].event_id + " " + o.stored[0].payment_id + " " + o.stored[0].amount + " " + o.stored[0].fee + " " + o.stored[0].raw')" = "1 evtRoute000001 pay_RouteFixture01 100 2 true" ] || { echo "$DONE"; false; }
}

@test "launch-contract: the committed webhook route answers a bad signature 401 and stores nothing (ADR-1739)" {
  arm webhooks route
  [ "$(j 'o.badSig.status + " " + o.rowsAtEnd')" = "401 1" ] || { echo "$DONE"; false; }
  [ "$(j 'o.stored.map((r) => r.event_id).join(",")')" = "evtRoute000001" ] || { echo "$DONE"; false; }
}

@test "launch-contract: the committed webhook route refuses a signature over a re-serialised body, and an event with no event id (ADR-1739)" {
  arm webhooks route
  [ "$(j 'o.reserialised.status + " " + o.noId.status')" = "401 400" ] || { echo "$DONE"; false; }
  [ "$(j 'o.rowsAtEnd')" = "1" ] || { echo "$DONE"; false; }
}

@test "launch-contract: a missing RAZORPAY_WEBHOOK_SECRET fails the slot as env:RAZORPAY_WEBHOOK_SECRET, and an unset venture secret stores nothing (ADR-1739)" {
  arm webhooks env-missing
  [ "$(j 'o.exit + " " + o.state + " " + o.reason')" = "1 failed env:RAZORPAY_WEBHOOK_SECRET" ] || { echo "$DONE"; false; }
  arm webhooks secret-unset
  [ "$(j 'o.post.status + " " + o.rows')" = "500 0" ] || { echo "$DONE"; false; }
}

@test "launch-contract: a venture domain outside the row's hosts[] is refused before any delivery (ADR-1739)" {
  arm webhooks host-refused
  [ "$(j 'o.verify.ok + " " + o.queued + " " + o.routeCalls')" = "false 0 0" ] || { echo "$DONE"; false; }
  [[ "$(j 'o.verify.reason')" == "HOST_REFUSED: pay.evil-example.com is not in this provider"* ]] || { echo "$DONE"; false; }
}

@test "launch-contract: webhooks-ledger verify is not ok and books nothing when the served route skips or re-serialises the signature, the secret differs, or a policy opens the table (ADR-1739)" {
  arm webhooks served-accepts-any
  [ "$(j 'o.mutated + " " + o.verify.ok + " " + o.queued')" = "true false 0" ] || { echo "$DONE"; false; }
  [ "$(j 'o.verify.reason')" = "a signature over a re-serialised body was answered 200, not 401" ] || { echo "$DONE"; false; }
  arm webhooks served-reserialises
  [ "$(j 'o.mutated + " " + o.verify.ok + " " + o.queued + " " + o.rows')" = "true false 0 0" ] || { echo "$DONE"; false; }
  [[ "$(j 'o.verify.reason')" == "the route refused launch"*"signature over the raw body (401)"* ]] || { echo "$DONE"; false; }
  arm webhooks other-hook-key
  [ "$(j 'o.verify.ok + " " + o.queued + " " + o.rows')" = "false 0 0" ] || { echo "$DONE"; false; }
  arm webhooks policy
  [ "$(j 'o.verify.ok + " " + o.queued')" = "false 0" ] || { echo "$DONE"; false; }
  [[ "$(j 'o.verify.reason')" == "razorpay_webhook_events carries 1 policies"* ]] || { echo "$DONE"; false; }
}

@test "launch-contract: an owner's razorpay_webhook_events table is never altered, and no plans upstream refuses before any call (ADR-1739)" {
  arm webhooks foreign-table
  [ "$(j 'o.scaffold.code + " " + o.commits + " " + o.reported')" = "TABLES_FOREIGN 0 0" ] || { echo "$DONE"; false; }
  arm webhooks no-upstream
  [ "$(j 'o.scaffold.code + " " + o.calls')" = "UPSTREAM_MISSING 0" ] || { echo "$DONE"; false; }
}

@test "launch-contract: the simulated path refuses a payment it cannot book as INR money and writes nothing (ADR-1739)" {
  arm webhooks ledger-refuses
  [ "$(j 'o.usd.state + " " + o.noId.state + " " + o.feeOver.state')" = "refused refused refused" ] || { echo "$DONE"; false; }
  [[ "$(j 'o.usd.why')" == *"INR only"* ]] || { echo "$DONE"; false; }
  [ "$(j 'o.spine.simulated + " " + o.spine.received')" = "0 0" ] || { echo "$DONE"; false; }
}

@test "launch-contract: auth -- a minted link signs in, /api/me knows the user, logout clears it, then 401" {
  arm login thread
  [[ "$(j 'o.authBefore.ok + " " + o.authBefore.reason')" == "false "*"is not launch's file" ]] || { echo "$DONE"; false; }
  [ "$(j 'o.auth.ok + " " + o.authAgain.ok + " " + o.siteUrl')" = "true true https://sandbox.automemory.ai" ] || { echo "$DONE"; false; }
  [[ "$(j 'o.env')" == *"NEXT_PUBLIC_SUPABASE_URL="*"NEXT_PUBLIC_SUPABASE_ANON_KEY="* ]] || { echo "$DONE"; false; }
  [ "$(j 'o.authVerify.ok + " " + JSON.stringify(o.authVerify.evidence)')" = 'true {"user":"launch-probe-a@sandbox.automemory.ai","login":303,"me":200,"logout":200,"after":401}' ] || { echo "$DONE"; false; }
  [ "$(j 'o.kinds.auth.join(",")')" = "auth-config,auth-routes,venture-repo,supabase-ref" ] || { echo "$DONE"; false; }
  [ "$(j 'o.authTeardown.join(",")')" = "delete-probe-users (launch-probe-a/b/c),restore-site-url-if-unchanged" ] || { echo "$DONE"; false; }
}

@test "launch-contract: authz -- A reads its own org and gets 403 on B's; orgs are created once" {
  arm login thread
  [ "$(j 'o.authz.ok + " " + o.authzVerify.ok + " " + o.authzVerifyAgain.ok + " " + o.orgs')" = "true true true 2" ] || { echo "$DONE"; false; }
  [ "$(j 'JSON.stringify(o.authzVerify.evidence)')" = '{"own":200,"crossTenant":403}' ] || { echo "$DONE"; false; }
  [ "$(j 'o.teardown.join(",")')" = "drop memberships, orgs cascade (down migration; after tenancy drops invites)" ] || { echo "$DONE"; false; }
}

@test "launch-contract: tenancy -- a stranger cannot invite, A invites C, C joins and is scoped to A's org" {
  arm login thread
  [ "$(j 'o.tenancy.ok + " " + o.tenancyVerify.ok')" = "true true" ] || { echo "$DONE"; false; }
  [ "$(j 'JSON.stringify(o.tenancyVerify.evidence)')" = '{"strangerInvite":403,"invite":201,"join":200,"scopedIn":200,"scopedOut":403}' ] || { echo "$DONE"; false; }
  [ "$(j 'o.commits.join(",")')" = "1,1,1" ] || { echo "$DONE"; false; }
}

@test "launch-contract: a leak across tenants fails authz, and tables without RLS refuse the migration" {
  arm login leak
  [ "$(j 'o.authzVerify.ok + " " + o.authzVerify.reason')" = "false A reading B's org answered 200, not 403" ] || { echo "$DONE"; false; }
  arm login rls-off-authz
  [ "$(j 'o.authz.code')" = "RLS_OFF" ] || { echo "$DONE"; false; }
}

@test "launch-contract: auth never repoints the owner's site URL, and authz never adopts the owner's orgs table" {
  arm login site-url-foreign
  [ "$(j 'o.auth.code + " " + o.routes')" = "SITE_URL_FOREIGN false" ] || { echo "$DONE"; false; }
  arm login owner-orgs-table
  [ "$(j 'o.authz.code + " " + o.rls')" = "TABLES_FOREIGN false" ] || { echo "$DONE"; false; }
}

@test "launch-contract: auth adds its env names to the owner's .env.example and keeps every line" {
  arm login owner-env
  [ "$(j 'o.auth.ok')" = "true" ] || { echo "$DONE"; false; }
  [ "$(j 'o.env')" = "$(printf '# mine\nSTRIPE_KEY=\nNEXT_PUBLIC_SUPABASE_URL=\nNEXT_PUBLIC_SUPABASE_ANON_KEY=\n')" ] || { echo "$DONE"; false; }
}

@test "launch-contract: tenancy verify before authz has made the probe orgs says so" {
  arm login tenancy-before-authz-verify
  [[ "$(j 'o.tenancyVerify.ok + " " + o.tenancyVerify.reason')" == "false UPSTREAM_MISSING: the probe org launch-probe-a does not exist"* ]] || { echo "$DONE"; false; }
}

@test "launch-contract: auth keeps the owner's redirect URLs and template, and refuses a template that lands elsewhere" {
  arm login owner-auth-config
  [ "$(j 'o.auth.ok + " " + o.allow + " " + o.kept')" = "true https://staging.example.com/**,https://sandbox.automemory.ai/** true" ] || { echo "$DONE"; false; }
  arm login owner-template-elsewhere
  [ "$(j 'o.auth.code')" = "TEMPLATE_FOREIGN" ] || { echo "$DONE"; false; }
}

@test "launch-contract: the login half never alters a Supabase project database only found" {
  arm login found-project
  [ "$(j 'o.auth.code')" = "UPSTREAM_FOREIGN_PROJECT" ] || { echo "$DONE"; false; }
}

@test "launch-contract: a kill after the authz migration is resumed by the tables' launch marker" {
  arm login killed-after-migration
  [ "$(j 'o.authz.ok')" = "true" ] || { echo "$DONE"; false; }
}

@test "launch-contract: an owner template built on ConfirmationURL is the owner's, and refuses" {
  arm login owner-template-confirmation-url
  [ "$(j 'o.auth.code')" = "TEMPLATE_FOREIGN" ] || { echo "$DONE"; false; }
}

@test "launch-contract: a .env.example whose base64 spans lines is extended, every line kept" {
  arm login long-env
  [ "$(j 'o.auth.ok')" = "true" ] || { echo "$DONE"; false; }
  [[ "$(j 'o.env')" == "# mine, kept as is"*"SERVICE_SECRET_NAME_11="*"NEXT_PUBLIC_SUPABASE_ANON_KEY="* ]] || { echo "$DONE"; false; }
}

@test "launch-contract: plans commits once, and verify proves pro opens /api/reports and a downgrade closes it (ADR-1737)" {
  arm login plans
  [ "$(j 'o.before.ok')" = "false" ] || { echo "$DONE"; false; }
  [ "$(j 'o.plans.ok + " " + o.plansAgain.ok + " " + o.commits + " " + o.files.join(",") + " " + o.rls')" = "true true 1 true,true,true true" ] || { echo "$DONE"; false; }
  [ "$(j 'o.verify.ok + " " + o.verify.evidence.pro + " " + o.verify.evidence.downgraded')" = "true 200 403" ] || { echo "$DONE"; false; }
  [ "$(j 'o.verifyAgain.ok + " " + o.finalPlans.join(",")')" = "true free" ] || { echo "$DONE"; false; }
  [ "$(j 'o.kinds.join(",")')" = "db-tables,plans-routes,venture-repo,supabase-ref" ] || { echo "$DONE"; false; }
  [ "$(j 'o.teardown.join(",")')" = "drop org_plans if it still carries the arc-launch plans marker (down migration; before authz drops orgs)" ] || { echo "$DONE"; false; }
}

@test "launch-contract: a gated route that ignores the plan never verifies (ADR-1737)" {
  arm login plans-ignored
  [ "$(j 'o.verify.ok + " " + o.verify.reason')" = "false the probe org downgraded to free read /api/reports with 200, not 403" ] || { echo "$DONE"; false; }
}

@test "launch-contract: plans never alters an org_plans table it did not create, and resumes its own" {
  arm login plans-foreign-table
  [ "$(j 'o.plans.code + " " + o.rows.join(",")')" = "TABLES_FOREIGN enterprise" ] || { echo "$DONE"; false; }
  arm login plans-killed-after-migration
  [ "$(j 'o.plans.ok')" = "true" ] || { echo "$DONE"; false; }
}

@test "launch-contract: plans verify names an owner's rewrite of the route and changes no plan; no upstream refuses" {
  arm login plans-owner-edited
  [[ "$(j 'o.verify.ok + " " + o.verify.reason')" == "false app/api/reports/route.js at "* ]] || { echo "$DONE"; false; }
  [ "$(j 'o.planRows')" = "0" ] || { echo "$DONE"; false; }
  arm login plans-no-upstream
  [ "$(j 'o.plans.code')" = "UPSTREAM_MISSING" ] || { echo "$DONE"; false; }
}

@test "launch-contract: a failed pro read still leaves the probe org on free (attack d1dc8eb B2)" {
  arm login plans-reports-fail
  [ "$(j 'o.verify.ok + " " + o.verify.reason')" = "false the probe org on pro read /api/reports with 500, not 200" ] || { echo "$DONE"; false; }
  [ "$(j 'o.finalPlans.join(",")')" = "free" ] || { echo "$DONE"; false; }
}

@test "launch-contract: a table the owner swapped in after launch recorded its own is never adopted, in plans and authz (attack d1dc8eb B3)" {
  arm login replaced-tables
  [ "$(j 'o.plans.code + " " + o.planRls')" = "TABLES_FOREIGN false" ] || { echo "$DONE"; false; }
  [ "$(j 'o.authz.code + " " + o.orgRls')" = "TABLES_FOREIGN false" ] || { echo "$DONE"; false; }
}

@test "launch-contract: checkout-portal commits once with no Razorpay call, and verify proves the page, a 201 on the slot's key and the 49900 INR order (ADR-1738)" {
  arm login checkout
  [ "$(j 'o.before.ok')" = "false" ] || { echo "$DONE"; false; }
  [ "$(j 'o.first.ok + " " + o.second.ok + " " + o.commits + " " + o.scaffoldCalls + " " + o.files.join(",")')" = "true true 1 0 true,true,true" ] || { echo "$DONE"; false; }
  [[ "$(j 'o.env')" == *"NEXT_PUBLIC_SUPABASE_ANON_KEY="*"RAZORPAY_KEY_ID="*"RAZORPAY_KEY_SECRET="* ]] || { echo "$DONE"; false; }
  [ "$(j 'o.envIds')" = "1" ] || { echo "$DONE"; false; }
  [ "$(j 'o.verify.ok + " " + o.verify.answerer + " " + o.verify.evidence.page + " " + o.verify.evidence.checkout + " " + o.verify.evidence.amount')" = "true sandbox.automemory.ai + api.razorpay.com 200 201 49900" ] || { echo "$DONE"; false; }
  [ "$(j 'o.verify.evidence.order === o.order.id')" = "true" ] || { echo "$DONE"; false; }
  [ "$(j 'o.order.amount + " " + o.order.currency + " " + o.order.forProbeOrg + " " + o.order.plan + " " + o.order.receipt')" = "49900 INR true pro true" ] || { echo "$DONE"; false; }
  [ "$(j 'o.verifyAgain.ok + " " + o.creates')" = "true 2" ] || { echo "$DONE"; false; }
  [ "$(j 'o.kinds.join(",")')" = "checkout-routes,venture-repo,supabase-ref" ] || { echo "$DONE"; false; }
  [ "$(j 'o.teardown.join(",")')" = "none (the checkout files stay with the venture; Razorpay keeps its test orders)" ] || { echo "$DONE"; false; }
}

@test "launch-contract: the committed checkout route answers 401 signed out, 400 for a non-uuid, 403 for another tenant's org, and orders nothing for any (ADR-1738)" {
  arm login checkout-refusals
  [ "$(j 'o.orgs + " " + o.cookie')" = "2 true" ] || { echo "$DONE"; false; }
  [ "$(j 'o.signedOut + " " + o.notUuid + " " + o.notMember + " " + o.refusedCreates')" = "401 400 403 0" ] || { echo "$DONE"; false; }
  [ "$(j 'o.member.status + " " + o.member.test + " " + o.member.slotKey + " " + o.member.amount + " " + o.member.currency + " " + o.member.leaksSecret + " " + o.creates')" = "201 true true 49900 INR false 1" ] || { echo "$DONE"; false; }
}

@test "launch-contract: a live key refuses in checkout-portal before any call, and in the venture's server env the route answers 503 with no order (gate 3 never crossed)" {
  arm login checkout-live-server
  [ "$(j 'o.slotLive.code + " " + o.slotLiveCommits + " " + o.slotLiveCalls')" = "LIVE_KEY 0 0" ] || { echo "$DONE"; false; }
  [[ "$(j 'o.slotLiveVerify.ok + " " + o.slotLiveVerify.reason')" == "false LIVE_KEY: "* ]] || { echo "$DONE"; false; }
  [ "$(j 'o.verify.ok + " " + o.verify.reason + " " + o.creates')" = "false POST /api/checkout answered 503, not 201 0" ] || { echo "$DONE"; false; }
}

@test "launch-contract: a venture deployed with another account's test key never verifies checkout-portal (ADR-1738)" {
  arm login checkout-key-mismatch
  [ "$(j 'o.verify.ok + " " + o.verify.reason')" = "false the key id /api/checkout gave is not this slot's RAZORPAY_KEY_ID, so the site does not run the keys launch proved" ] || { echo "$DONE"; false; }
  [ "$(j 'o.creates')" = "1" ] || { echo "$DONE"; false; }
}

@test "launch-contract: checkout-portal verify refuses an order whose amount, currency or org is not the plan's (ADR-1738)" {
  arm login checkout-amount
  [[ "$(j 'o.verify.ok + " " + o.verify.reason')" == "false order order_"*" is 100 INR, not 49900 INR" ]] || { echo "$DONE"; false; }
  arm login checkout-currency
  [[ "$(j 'o.verify.ok + " " + o.verify.reason')" == "false order order_"*" is 49900 USD, not 49900 INR" ]] || { echo "$DONE"; false; }
  arm login checkout-org
  [[ "$(j 'o.verify.ok + " " + o.verify.reason')" == "false order order_"*" is not for the probe org launch-probe-a" ]] || { echo "$DONE"; false; }
}

@test "launch-contract: a missing Razorpay key fails checkout-portal as env:RAZORPAY_KEY_ID in the real worker" {
  arm login checkout-env-missing
  [ "$(j 'o.exit + " " + o.state + " " + o.reason')" = "1 failed env:RAZORPAY_KEY_ID" ] || { echo "$DONE"; false; }
}

@test "launch-contract: checkout-portal verify on a venture domain outside hosts[] is refused by ctx.fetch, and no order is made" {
  arm login checkout-host
  [[ "$(j 'o.verify.ok + " " + o.verify.reason')" == "false HOST_REFUSED: evil.example.com is not in this provider's hosts[]"* ]] || { echo "$DONE"; false; }
  [ "$(j 'o.creates')" = "0" ] || { echo "$DONE"; false; }
}

@test "launch-contract: checkout-portal verify names an owner's repricing before any order, a re-run never commits over it; no upstream refuses" {
  arm login checkout-owner-prices
  [[ "$(j 'o.verify.ok + " " + o.verify.reason')" == "false lib/prices.js at "*" is not launch's file" ]] || { echo "$DONE"; false; }
  [ "$(j 'o.creates + " " + o.again.code')" = "0 FOREIGN_FILE" ] || { echo "$DONE"; false; }
  arm login checkout-no-upstream
  [ "$(j 'o.scaffold.code')" = "UPSTREAM_MISSING" ] || { echo "$DONE"; false; }
}
