#!/usr/bin/env bats
# legal Phase 01 -- the approval chain (LEG-D, REQ-06).
#
# The law under test, in one sentence: a decision approves specific BYTES, not a venture. An
# approval that survives an edit to the facts file is not an approval, it is a rubber stamp with
# a delay.
#
# Every test here is a REFUSAL except the two that must succeed, and that ratio is the point --
# a publish gate is defined by what it declines. The happy-path tests exist so the refusals
# cannot be passing because publishing is broken outright.
#
# The decision receipts come from `legal-probe.mjs decision`, the offline FAKE for the spine: the
# real receipt is written by `arc-inbox approve` on the canonical clone, which no test can reach,
# because the spine is gitignored and CI has none at all. The fake takes overrides on purpose --
# one that could only mint VALID receipts could not test a gate whose whole job is refusing
# invalid ones.
bats_require_minimum_version 1.5.0
load 'test_helper'

REQ="01TESTREQUEST00000000000000"

teardown() { _arc_legal_teardown; }

# Render + propose inside the sandbox, leaving $SANDBOX/out ready to publish from.
_proposed() {
  _arc_legal_sandbox || return 1
  node "$ARC_LEGAL_CLI" propose --venture "fixture-gateway-gst" --out "$SANDBOX/out" >/dev/null 2>&1 || return 1
  [ -f "$SANDBOX/out/_approval.json" ] || { echo "propose wrote no approval request" >&2; return 1; }
  return 0
}

# Publish, capturing the exit code without errexit aborting the function first.
_publish() {
  PUBLISH_STATUS=0
  node "$ARC_LEGAL_CLI" publish --venture "fixture-gateway-gst" --dir "$SANDBOX/out" \
    --decision "$1" --request "${2:-$REQ}" >"$SANDBOX/pub.txt" 2>&1 || PUBLISH_STATUS=$?
  return 0
}

@test "legal receipts: propose writes a strict, closed approval payload" {
  _proposed
  run node "$ARC_ROOT/tests/legal-probe.mjs" field "$SANDBOX/out/_approval.json" subject
  [ "$status" -eq 0 ]
  [ "$output" = "legal.publish" ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" field "$SANDBOX/out/_approval.json" facts_sha256
  [ "$status" -eq 0 ]
  [ "${#output}" -eq 64 ]
}

@test "legal receipts: propose emits nothing to the spine and publishes nothing" {
  # REQ-06 makes the human gate permanent. A verb that both requests approval and could record it
  # is one refactor away from doing both, so propose must leave no published artefact at all.
  _proposed
  [ ! -f "$SANDBOX/out/_published.json" ]
  run cat "$SANDBOX/out/../out/_approval.json"
  [ "$status" -eq 0 ]
}

@test "legal receipts: an approved decision bound to these bytes publishes" {
  # The positive control. Without it, every refusal below could be passing because publish is
  # broken rather than because the gate refused.
  _proposed
  run node "$ARC_ROOT/tests/legal-probe.mjs" decision "$SANDBOX/out/_approval.json" "$SANDBOX/d.json" approve "2026-08-13T00:00:00Z"
  [ "$status" -eq 0 ]
  _publish "$SANDBOX/d.json"
  [ "$PUBLISH_STATUS" -eq 0 ]
  [ -f "$SANDBOX/out/_published.json" ]
  run cat "$SANDBOX/pub.txt"
  [[ "$output" == *"published "*" page(s)"* ]]
}

@test "legal receipts: TOCTOU -- approve, edit the facts, publish is REFUSED" {
  # The red that matters most. The approval and a fresh render would agree with each other
  # perfectly after the edit; what they no longer agree with is what the human decided.
  _proposed
  run node "$ARC_ROOT/tests/legal-probe.mjs" decision "$SANDBOX/out/_approval.json" "$SANDBOX/d.json" approve "2026-08-13T00:00:00Z"
  [ "$status" -eq 0 ]

  run node "$ARC_ROOT/tests/legal-probe.mjs" mutate-facts "$SANDBOX" "fixture-gateway-gst" refund_window_days 7
  [ "$status" -eq 0 ]

  _publish "$SANDBOX/d.json"
  [ "$PUBLISH_STATUS" -eq 2 ]
  run cat "$SANDBOX/pub.txt"
  [[ "$output" == *"FACTS_CHANGED"* ]]
  [ ! -f "$SANDBOX/out/_published.json" ]
}

@test "legal receipts: TOCTOU -- the page BYTES on disk changed after approval, REFUSED" {
  # The case a re-render alone cannot catch: the run record and the approval agree, and the file
  # that would actually be published is a different file. Hashing the record's copy of the text
  # instead of the bytes on disk passes this.
  _proposed
  run node "$ARC_ROOT/tests/legal-probe.mjs" decision "$SANDBOX/out/_approval.json" "$SANDBOX/d.json" approve "2026-08-13T00:00:00Z"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" tamper-page "$SANDBOX/out" terms
  [ "$status" -eq 0 ]

  _publish "$SANDBOX/d.json"
  [ "$PUBLISH_STATUS" -eq 2 ]
  run cat "$SANDBOX/pub.txt"
  [[ "$output" == *"PAGE_BYTES_CHANGED"* ]]
}

@test "legal receipts: a REJECTED decision with a perfect hash chain is still refused" {
  # The chain and the verdict are checked separately on purpose. Folding them together is how an
  # intact chain starts standing in for consent.
  _proposed
  run node "$ARC_ROOT/tests/legal-probe.mjs" decision "$SANDBOX/out/_approval.json" "$SANDBOX/d.json" reject "2026-08-13T00:00:00Z"
  [ "$status" -eq 0 ]
  _publish "$SANDBOX/d.json"
  [ "$PUBLISH_STATUS" -eq 2 ]
  run cat "$SANDBOX/pub.txt"
  [[ "$output" == *"VERDICT_NOT_APPROVE"* ]]
}

@test "legal receipts: a decision about a DIFFERENT request is refused" {
  # The first cut of this check passed `decision.decides` in as the expected value, comparing the
  # field against itself -- it could never fire, and any recorded approval anywhere would have
  # published. The expected value now comes from the caller, so this test can fail.
  _proposed
  run node "$ARC_ROOT/tests/legal-probe.mjs" decision "$SANDBOX/out/_approval.json" "$SANDBOX/d.json" approve "2026-08-13T00:00:00Z"
  [ "$status" -eq 0 ]
  _publish "$SANDBOX/d.json" "01SOMEOTHERREQUEST000000000"
  [ "$PUBLISH_STATUS" -eq 2 ]
  run cat "$SANDBOX/pub.txt"
  [[ "$output" == *"DECIDES_MISMATCH"* ]]
}

@test "legal receipts: publish without a decision is refused, not defaulted" {
  _proposed
  PUBLISH_STATUS=0
  node "$ARC_LEGAL_CLI" publish --venture "fixture-gateway-gst" --dir "$SANDBOX/out" \
    >"$SANDBOX/pub.txt" 2>&1 || PUBLISH_STATUS=$?
  [ "$PUBLISH_STATUS" -eq 2 ]
  run cat "$SANDBOX/pub.txt"
  [[ "$output" == *"REQ-06"* ]]
}

@test "legal receipts: publish without --request is refused" {
  # Without it there is nothing to bind the decision TO, and any recorded approval would do.
  _proposed
  run node "$ARC_ROOT/tests/legal-probe.mjs" decision "$SANDBOX/out/_approval.json" "$SANDBOX/d.json" approve "2026-08-13T00:00:00Z"
  [ "$status" -eq 0 ]
  PUBLISH_STATUS=0
  node "$ARC_LEGAL_CLI" publish --venture "fixture-gateway-gst" --dir "$SANDBOX/out" \
    --decision "$SANDBOX/d.json" >"$SANDBOX/pub.txt" 2>&1 || PUBLISH_STATUS=$?
  [ "$PUBLISH_STATUS" -eq 2 ]
  # Asserting the exit code ALONE was a hole: any unexpected crash maps to 2, so a TypeError
  # satisfied this test. The message pins which refusal it was.
  run cat "$SANDBOX/pub.txt"
  [[ "$output" == *"--request ULID"* ]]
}

@test "legal receipts: BACKDATING -- an effective date before the decision is refused" {
  _proposed
  run node "$ARC_ROOT/tests/legal-probe.mjs" decision "$SANDBOX/out/_approval.json" "$SANDBOX/d.json" approve "2027-01-01T00:00:00Z"
  [ "$status" -eq 0 ]
  _publish "$SANDBOX/d.json"
  [ "$PUBLISH_STATUS" -eq 2 ]
  run cat "$SANDBOX/pub.txt"
  [[ "$output" == *"BACKDATED"* ]]
}

@test "legal receipts: an unknown key in the approval payload is REJECTED, not ignored" {
  # ADR-1203's closed profile. An emitter that ignores unknown keys carries whatever somebody
  # adds later -- a `force: true` would ride along and the receipt would look clean.
  _proposed
  run node "$ARC_ROOT/tests/legal-probe.mjs" approval-unknown-key "$SANDBOX/out/_approval.json"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" decision "$SANDBOX/out/_approval.json" "$SANDBOX/d.json" approve "2026-08-13T00:00:00Z"
  [ "$status" -eq 0 ]
  _publish "$SANDBOX/d.json"
  [ "$PUBLISH_STATUS" -eq 2 ]
  run cat "$SANDBOX/pub.txt"
  [[ "$output" == *"unknown key"* ]]
}

@test "legal receipts: publish is refused when nothing was ever proposed" {
  # "Could not check" gets its own exit code: 3, never 0 and never 2.
  _arc_legal_sandbox
  mkdir -p "$SANDBOX/empty"
  PUBLISH_STATUS=0
  node "$ARC_LEGAL_CLI" publish --venture "fixture-gateway-gst" --dir "$SANDBOX/empty" \
    --decision "$SANDBOX/nope.json" --request "$REQ" >"$SANDBOX/pub.txt" 2>&1 || PUBLISH_STATUS=$?
  [ "$PUBLISH_STATUS" -eq 3 ]
}

# ---------------------------------------------------------------------------------------------
# The five CRITICALs a fresh decision-logic attacker reproduced end to end. Every one of them
# PUBLISHED at exit 0 before the fix. Each is pinned here, because a fix without a fixture is a
# fix that comes back.
# ---------------------------------------------------------------------------------------------

@test "legal receipts: editing a pinned DATA file after approval is refused" {
  # The worst of the five. `grievance-windows.json` is interpolated into the rendered prose but
  # was outside the pinned hash, so editing it rewrote a grievance commitment from 48 hours and
  # 30 days to 720 hours and 90 days -- published under a decision taken about the other number,
  # at exit 0, with facts_sha256 and the set hash both IDENTICAL and no error printed.
  _proposed
  run node "$ARC_ROOT/tests/legal-probe.mjs" decision "$SANDBOX/out/_approval.json" "$SANDBOX/d.json" approve "2026-08-13T00:00:00Z"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" data-edit "$SANDBOX" grievance-windows.json '"ack_hours": 48' '"ack_hours": 720'
  [ "$status" -eq 0 ]
  _publish "$SANDBOX/d.json"
  [ "$PUBLISH_STATUS" -eq 2 ]
  run cat "$SANDBOX/pub.txt"
  [[ "$output" == *"TEMPLATES_CHANGED"* ]]
}

@test "legal receipts: a decision with no recorded_at is refused, not waved through" {
  # The same receipt refused when dated 2099 and PUBLISHED when the key was deleted -- and the
  # CLI printed "recorded (no timestamp)" as it went. Naming the missing evidence and proceeding
  # anyway is the worst available behaviour.
  _proposed
  run node "$ARC_ROOT/tests/legal-probe.mjs" decision "$SANDBOX/out/_approval.json" "$SANDBOX/d.json" approve "2026-08-13T00:00:00Z"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" json-del "$SANDBOX/d.json" recorded_at
  [ "$status" -eq 0 ]
  _publish "$SANDBOX/d.json"
  [ "$PUBLISH_STATUS" -eq 2 ]
  run cat "$SANDBOX/pub.txt"
  [[ "$output" == *"DECISION_UNDATED"* ]]
}

@test "legal receipts: a forged effective_date in the approval file is refused" {
  # The one recorded value the chain trusted, in a module whose header says it trusts none.
  # Editing it alone -- facts hash untouched -- published a record claiming a date the rendered
  # page never carried, and it was the forged value both backdating guards then evaluated.
  _proposed
  run node "$ARC_ROOT/tests/legal-probe.mjs" json-set "$SANDBOX/out/_approval.json" effective_date "2099-12-31"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" decision "$SANDBOX/out/_approval.json" "$SANDBOX/d.json" approve "2026-08-13T00:00:00Z"
  [ "$status" -eq 0 ]
  _publish "$SANDBOX/d.json"
  [ "$PUBLISH_STATUS" -eq 2 ]
  run cat "$SANDBOX/pub.txt"
  [[ "$output" == *"EFFECTIVE_DATE_CHANGED"* ]]
}

@test "legal receipts: an unapproved page FILE in the publish directory is refused" {
  # The existing PAGE_EXTRA check walked the RUN's page list while its own message said
  # "publishing it would put an unapproved page on the site" -- and the thing published is the
  # DIRECTORY. A hand-written page carrying a false certification claim and a refund denial sat
  # there, in no receipt, and the gate reported success.
  _proposed
  run node "$ARC_ROOT/tests/legal-probe.mjs" decision "$SANDBOX/out/_approval.json" "$SANDBOX/d.json" approve "2026-08-13T00:00:00Z"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" stray-page "$SANDBOX/out" terms-v2
  [ "$status" -eq 0 ]
  _publish "$SANDBOX/d.json"
  [ "$PUBLISH_STATUS" -eq 2 ]
  run cat "$SANDBOX/pub.txt"
  [[ "$output" == *"PAGE_UNAPPROVED_FILE"* ]]
}

@test "legal receipts: a decision whose facts hash is not the published one is refused" {
  # The probe's `decision` fake grew --facts and --set overrides so a wrong-hash receipt COULD be
  # minted, and no test ever passed either flag. Deleting the two comparisons in verifyDecision
  # left the whole suite green: the TOCTOU test mutates the facts AFTER minting, so the receipt
  # agreed with the payload there and only verifyChain fired.
  _proposed
  run node "$ARC_ROOT/tests/legal-probe.mjs" decision "$SANDBOX/out/_approval.json" "$SANDBOX/d.json" approve "2026-08-13T00:00:00Z" --facts "0000000000000000000000000000000000000000000000000000000000000000"
  [ "$status" -eq 0 ]
  _publish "$SANDBOX/d.json"
  [ "$PUBLISH_STATUS" -eq 2 ]
  run cat "$SANDBOX/pub.txt"
  [[ "$output" == *"facts_sha256 is not the one being published"* ]]
}

_published() {
  _proposed || return 1
  node "$ARC_ROOT/tests/legal-probe.mjs" decision "$SANDBOX/out/_approval.json" "$SANDBOX/d.json" approve "2026-08-13T00:00:00Z" >/dev/null || return 1
  node "$ARC_LEGAL_CLI" publish --venture "fixture-gateway-gst" --dir "$SANDBOX/out" \
    --decision "$SANDBOX/d.json" --request "$REQ" >/dev/null 2>&1 || return 1
  [ -f "$SANDBOX/out/_published.json" ] || { echo "publish wrote no _published.json" >&2; return 1; }
  return 0
}

_verify() {
  VERIFY_STATUS=0
  node "$ARC_LEGAL_CLI" verify --venture "fixture-gateway-gst" --dir "$SANDBOX/out" \
    >"$SANDBOX/vfy.txt" 2>&1 || VERIFY_STATUS=$?
  return 0
}

@test "legal receipts: verify says INTACT on an untouched published directory" {
  _published
  _verify
  [ "$VERIFY_STATUS" -eq 0 ]
  run cat "$SANDBOX/vfy.txt"
  [[ "$output" == *"verdict: INTACT"* ]]
}

@test "legal receipts: verify says TAMPERED when a published page is edited" {
  _published
  run node "$ARC_ROOT/tests/legal-probe.mjs" tamper-page "$SANDBOX/out" terms
  [ "$status" -eq 0 ]
  _verify
  [ "$VERIFY_STATUS" -eq 2 ]
  run cat "$SANDBOX/vfy.txt"
  [[ "$output" == *"verdict: TAMPERED"* ]]
  [[ "$output" == *"page:terms"* ]]
}

@test "legal receipts: a record with NO preimage label is UNVERIFIABLE, never INTACT" {
  # The distinction the verb exists for, tested honestly.
  #
  # The previous version of this test used a fixture that relabelled the record AND zeroed the
  # facts hash in one step -- so the "stale format" fixture WAS an attack, and the suite asserted
  # its outcome was correct. There was no case where the format moved and the bytes did not, and
  # an attacker pointed out the test could therefore not tell the two apart.
  #
  # `arc-legal-canon/1` is the only format this engine has ever written, so there is no genuinely
  # OLDER label available -- and inventing one would mean adding a version to the known list that
  # was never shipped, which is a lie told to make a test pass. A record with NO label is the
  # honest form of the same question: nothing says which algorithm produced these hashes.
  _published
  run node "$ARC_ROOT/tests/legal-probe.mjs" strip-preimage "$SANDBOX/out"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" mutate-facts "$SANDBOX" "fixture-gateway-gst" refund_window_days 7
  [ "$status" -eq 0 ]
  _verify
  [ "$VERIFY_STATUS" -eq 3 ]
  run cat "$SANDBOX/vfy.txt"
  [[ "$output" == *"verdict: UNVERIFIABLE"* ]]
  # Unknown is its own answer. It must not read as fine, and it must not read as tampering.
  [[ "$output" != *"verdict: INTACT"* ]]
  [[ "$output" != *"verdict: TAMPERED"* ]]
}

@test "legal receipts: an unlabelled record does NOT excuse edited page bytes" {
  # The attack on the classifier. Whoever can edit a record can also strip its label, so if the
  # verdict came from the label, a tamperer would downgrade TAMPERED to UNVERIFIABLE by deleting
  # one string. Page bytes are hashed directly and the preimage version does not govern them, so
  # they stay TAMPERED whatever the record says about its own format.
  _published
  run node "$ARC_ROOT/tests/legal-probe.mjs" tamper-page "$SANDBOX/out" terms
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" strip-preimage "$SANDBOX/out"
  [ "$status" -eq 0 ]
  _verify
  [ "$VERIFY_STATUS" -eq 2 ]
  run cat "$SANDBOX/vfy.txt"
  [[ "$output" == *"verdict: TAMPERED"* ]]
}

@test "legal receipts: verify REFUSES when the record's page list is deleted" {
  # The work-list used to come from the record being audited, so removing one key emptied the
  # loop and the verdict collapsed to INTACT -- with every page on disk defaced. An audit that
  # asks the suspect which questions to answer is not an audit.
  _published
  printf '# Terms\n\nWe are ISO 27001 certified and refunds are NEVER given.\n' > "$SANDBOX/out/terms.mdx"
  run node "$ARC_ROOT/tests/legal-probe.mjs" json-del "$SANDBOX/out/_published.json" pages
  [ "$status" -eq 0 ]
  _verify
  [ "$VERIFY_STATUS" -ne 0 ]
  run cat "$SANDBOX/vfy.txt"
  [[ "$output" != *"verdict: INTACT"* ]]
}

@test "legal receipts: verify catches an unapproved page FILE, not just an edited one" {
  # verifyChain gained this check and verifyPublished -- twelve lines below it in the same file --
  # did not. Verify is the half the generated guard runs in the VENTURE's repo, which is the one
  # place no twin-fix sweep of this repo can reach. Both Phase-02 attackers found it separately.
  _published
  run node "$ARC_ROOT/tests/legal-probe.mjs" stray-page "$SANDBOX/out" terms-v2
  [ "$status" -eq 0 ]
  _verify
  [ "$VERIFY_STATUS" -eq 2 ]
  run cat "$SANDBOX/vfy.txt"
  [[ "$output" == *"verdict: TAMPERED"* ]]
  [[ "$output" == *"terms-v2"* ]]
}

@test "legal receipts: an unapproved page ONE DIRECTORY DOWN is refused too" {
  # The listing was not recursive, so `out/en/terms.mdx` published at exit 0 while the identical
  # bytes at `out/terms-v2.mdx` were refused -- and a static host serves /en/terms exactly as it
  # serves /terms-v2.
  _proposed
  run node "$ARC_ROOT/tests/legal-probe.mjs" decision "$SANDBOX/out/_approval.json" "$SANDBOX/d.json" approve "2026-08-13T00:00:00Z"
  [ "$status" -eq 0 ]
  mkdir -p "$SANDBOX/out/en"
  run node "$ARC_ROOT/tests/legal-probe.mjs" stray-page "$SANDBOX/out/en" terms
  [ "$status" -eq 0 ]
  _publish "$SANDBOX/d.json"
  [ "$PUBLISH_STATUS" -eq 2 ]
  run cat "$SANDBOX/pub.txt"
  [[ "$output" == *"PAGE_UNAPPROVED_FILE"* ]]
}

@test "legal receipts: a page id that escapes the publish directory is not followed" {
  # `validateApprovalPayload` says "one confinement function, every path through it" -- and the
  # id read back OUT of the published record went through no such function, so a record naming
  # `../decoy/terms` had verify hash an untouched copy outside the directory and call the defaced
  # one inside it INTACT.
  _published
  mkdir -p "$SANDBOX/decoy"
  cp "$SANDBOX/out/terms.mdx" "$SANDBOX/decoy/terms.mdx"
  printf '# Terms\n\nDEFACED.\n' > "$SANDBOX/out/terms.mdx"
  run node "$ARC_ROOT/tests/legal-probe.mjs" repoint-page "$SANDBOX/out/_published.json" terms "../decoy/terms"
  [ "$status" -eq 0 ]
  _verify
  [ "$VERIFY_STATUS" -ne 0 ]
  run cat "$SANDBOX/vfy.txt"
  [[ "$output" != *"verdict: INTACT"* ]]
}

@test "legal receipts: a FORGED preimage label is TAMPERED, not excused as stale" {
  # `canRederive` was a string compare against a field the record declares, so ANY unrecognised
  # label -- not just a genuinely older format -- bought an excuse. A tamperer who could edit the
  # record could relabel it and read back "re-publish under the current format", an instruction to
  # launder the edit. A label this engine has never written means forged, not old.
  _published
  run node "$ARC_ROOT/tests/legal-probe.mjs" mutate-facts "$SANDBOX" "fixture-gateway-gst" refund_window_days 7
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" relabel-preimage "$SANDBOX/out" "arc-legal-canon/99"
  [ "$status" -eq 0 ]
  _verify
  [ "$VERIFY_STATUS" -eq 2 ]
  run cat "$SANDBOX/vfy.txt"
  [[ "$output" == *"verdict: TAMPERED"* ]]
}

@test "legal receipts: a CRLF checkout of untouched pages is INTACT, not TAMPERED" {
  # The engine normalised every INPUT it read and not the OUTPUT it hashed. arc's own repo hides
  # that behind .gitattributes; the venture repo the guard ships into has none, so on a Windows
  # checkout every .mdx arrives as CRLF and every page verified as TAMPERED on an untouched tree.
  # A guard that cries wolf on a clean checkout is one people switch off.
  _published
  run node "$ARC_ROOT/tests/legal-probe.mjs" crlf-pages "$SANDBOX/out"
  [ "$status" -eq 0 ]
  _verify
  [ "$VERIFY_STATUS" -eq 0 ]
  run cat "$SANDBOX/vfy.txt"
  [[ "$output" == *"verdict: INTACT"* ]]
}

@test "legal receipts: verify on a directory with nothing published exits 3" {
  _arc_legal_sandbox
  mkdir -p "$SANDBOX/out"
  VERIFY_STATUS=0
  node "$ARC_LEGAL_CLI" verify --venture "fixture-gateway-gst" --dir "$SANDBOX/out" \
    >"$SANDBOX/vfy.txt" 2>&1 || VERIFY_STATUS=$?
  [ "$VERIFY_STATUS" -eq 3 ]
}

@test "legal receipts: this suite registers every test it declares" {
  command -v bats >/dev/null 2>&1 || { echo "bats is not on PATH" >&2; return 1; }
  run node "$ARC_ROOT/tests/legal-probe.mjs" count-tests "$BATS_TEST_FILENAME"
  [ "$status" -eq 0 ]
  local declared="$output"
  run bats --count "$BATS_TEST_FILENAME"
  [ "$status" -eq 0 ]
  [ "$declared" -eq "$output" ]
}

@test "legal receipts: every test name in this suite is 7-bit ASCII" {
  run _arc_ascii_test_names "$BATS_TEST_FILENAME"
  [ "$status" -eq 0 ]
}
