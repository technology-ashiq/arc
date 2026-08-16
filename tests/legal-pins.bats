#!/usr/bin/env bats
# legal Phase 02 -- per-venture template pins, and the bump that voids an approval.
#
# The template set used to be a module constant, which meant every venture moved the instant the
# set moved. That is precisely what pinning exists to prevent, and ADR-1205 makes facts, pages,
# pins and receipts venture-local so one venture can adopt a new set while another stays put.
#
# The forcing function for re-approval is ARITHMETIC, not a flag. Moving a pin changes
# `template_set_sha`; publish re-derives that hash and refuses on TEMPLATES_CHANGED. There is no
# separate "needs re-approval" state that could drift out of step with the hashes -- which is the
# only reason it can be trusted.
bats_require_minimum_version 1.5.0
load 'test_helper'

REQ="01TESTREQUEST00000000000000"

teardown() { _arc_legal_teardown; }

@test "legal pins: two ventures on DIFFERENT template sets both render in one run" {
  # The exit criterion, near enough verbatim. The sets must also be visibly different -- two
  # ventures rendering identically would pass a containment check while proving nothing about
  # pinning.
  run node "$ARC_ROOT/.claude/scripts/legal/arc-legal.mjs" render --venture "fixture-gateway-gst" --out "$BATS_TEST_TMPDIR/a"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" field "$BATS_TEST_TMPDIR/a/_run.json" template_set
  [ "$status" -eq 0 ]
  local set_a="$output"

  run node "$ARC_ROOT/.claude/scripts/legal/arc-legal.mjs" render --venture "fixture-mor-gst" --out "$BATS_TEST_TMPDIR/b"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" field "$BATS_TEST_TMPDIR/b/_run.json" template_set
  [ "$status" -eq 0 ]
  local set_b="$output"

  [ "$set_a" != "$set_b" ]

  # And their SET HASHES differ, so the two sets are genuinely different bytes and not two names
  # for one directory.
  # The status checks matter here: `run` folds stderr into $output, and two probe FAILURES would
  # produce two different error strings -- different because the PATHS differ -- so the
  # inequality would hold and this test would pass having compared two error messages. It is the
  # assertion carrying "the two sets are genuinely different bytes".
  run node "$ARC_ROOT/tests/legal-probe.mjs" field "$BATS_TEST_TMPDIR/a/_run.json" template_set_sha
  [ "$status" -eq 0 ]
  [ "${#output}" -eq 64 ]
  local sha_a="$output"
  run node "$ARC_ROOT/tests/legal-probe.mjs" field "$BATS_TEST_TMPDIR/b/_run.json" template_set_sha
  [ "$status" -eq 0 ]
  [ "${#output}" -eq 64 ]
  [ "$sha_a" != "$output" ]

  # Both render CLEANLY. "Renders correctly" is the criterion, not "renders".
  for d in a b; do
    run node "$ARC_ROOT/tests/legal-probe.mjs" findings "$BATS_TEST_TMPDIR/$d/_run.json" any FAIL
    [ "$status" -eq 0 ]
    [ "$output" = "0" ]
  done
}

@test "legal pins: a venture with NO pin is REFUSED, not floated onto the newest set" {
  # The whole mechanism turns on this. A default here would put a venture on a set nobody chose
  # for it, silently, and would look identical to a deliberate upgrade.
  _arc_legal_sandbox
  run node "$ARC_ROOT/tests/legal-probe.mjs" pin "$SANDBOX" "fixture-gateway-gst" --delete
  [ "$status" -eq 0 ]
  MUTANT_STATUS=0
  node "$ARC_LEGAL_CLI" render --venture "fixture-gateway-gst" --out "$SANDBOX/out" >/dev/null 2>"$SANDBOX/err.txt" || MUTANT_STATUS=$?
  [ "$MUTANT_STATUS" -eq 3 ]
  run cat "$SANDBOX/err.txt"
  [[ "$output" == *"pins.yaml"* ]]
}

@test "legal pins: a pin naming a set that does not exist is refused" {
  _arc_legal_sandbox
  run node "$ARC_ROOT/tests/legal-probe.mjs" pin "$SANDBOX" "fixture-gateway-gst" v99
  [ "$status" -eq 0 ]
  MUTANT_STATUS=0
  node "$ARC_LEGAL_CLI" render --venture "fixture-gateway-gst" --out "$SANDBOX/out" >/dev/null 2>"$SANDBOX/err.txt" || MUTANT_STATUS=$?
  [ "$MUTANT_STATUS" -eq 3 ]
  run cat "$SANDBOX/err.txt"
  [[ "$output" == *"v99"* ]]
}

@test "legal pins: a pin value that is not a set name is refused before it becomes a path" {
  # The pin is joined into a directory path, so it goes through the same confinement the venture
  # name does. `factsPathFor` carries a comment saying "one confinement function, every path
  # through it"; this is that function's second path.
  _arc_legal_sandbox
  run node "$ARC_ROOT/tests/legal-probe.mjs" pin "$SANDBOX" "fixture-gateway-gst" "../../etc"
  [ "$status" -eq 0 ]
  MUTANT_STATUS=0
  node "$ARC_LEGAL_CLI" render --venture "fixture-gateway-gst" --out "$SANDBOX/out" >/dev/null 2>"$SANDBOX/err.txt" || MUTANT_STATUS=$?
  [ "$MUTANT_STATUS" -eq 2 ]
}

@test "legal pins: bump moves ONE venture and leaves the others where they were" {
  # A bump that moved everything would be the module constant this replaced, wearing a command's
  # clothes -- so the control is the venture that must NOT move.
  _arc_legal_sandbox
  run node "$ARC_LEGAL_CLI" render --venture "fixture-gateway-nogst" --out "$SANDBOX/before-other"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" field "$SANDBOX/before-other/_run.json" template_set
  local other_before="$output"

  run node "$ARC_LEGAL_CLI" bump-templates --venture "fixture-gateway-gst" --to v2 --no-guard
  [ "$status" -eq 0 ]
  [[ "$output" == *"v1 -> v2"* ]]

  run node "$ARC_LEGAL_CLI" render --venture "fixture-gateway-gst" --out "$SANDBOX/after-self"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" field "$SANDBOX/after-self/_run.json" template_set
  [ "$output" = "v2" ]

  run node "$ARC_LEGAL_CLI" render --venture "fixture-gateway-nogst" --out "$SANDBOX/after-other"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" field "$SANDBOX/after-other/_run.json" template_set
  [ "$output" = "$other_before" ]
}

@test "legal pins: a bump VOIDS an existing approval, and publish refuses until re-approval" {
  # The criterion, end to end, with the positive control first: publish must SUCCEED before the
  # bump, or the refusal afterwards proves only that publishing is broken.
  _arc_legal_sandbox
  run node "$ARC_LEGAL_CLI" propose --venture "fixture-gateway-gst" --out "$SANDBOX/out"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" decision "$SANDBOX/out/_approval.json" "$SANDBOX/d.json" approve "2026-08-13T00:00:00Z"
  [ "$status" -eq 0 ]

  BEFORE=0
  node "$ARC_LEGAL_CLI" publish --venture "fixture-gateway-gst" --dir "$SANDBOX/out" \
    --decision "$SANDBOX/d.json" --request "$REQ" >/dev/null 2>&1 || BEFORE=$?
  [ "$BEFORE" -eq 0 ]

  run node "$ARC_LEGAL_CLI" bump-templates --venture "fixture-gateway-gst" --to v2 --no-guard
  [ "$status" -eq 0 ]
  [[ "$output" == *"VOID"* ]]

  AFTER=0
  node "$ARC_LEGAL_CLI" publish --venture "fixture-gateway-gst" --dir "$SANDBOX/out" \
    --decision "$SANDBOX/d.json" --request "$REQ" >"$SANDBOX/pub.txt" 2>&1 || AFTER=$?
  [ "$AFTER" -eq 2 ]
  run cat "$SANDBOX/pub.txt"
  [[ "$output" == *"TEMPLATES_CHANGED"* ]]
}

@test "legal pins: bumping to the set already pinned is refused" {
  # A no-op bump would still print the re-approval warning, and a warning nobody needs is a
  # warning people learn to skip past.
  _arc_legal_sandbox
  MUTANT_STATUS=0
  node "$ARC_LEGAL_CLI" bump-templates --venture "fixture-gateway-gst" --to v1 >"$SANDBOX/o.txt" 2>&1 || MUTANT_STATUS=$?
  [ "$MUTANT_STATUS" -eq 2 ]
  run cat "$SANDBOX/o.txt"
  [[ "$output" == *"already pinned"* ]]
}

@test "legal guard: the generated snippet carries no comparison logic of its own" {
  # The requirement is not "ship a snippet", it is "ship a snippet that cannot drift". A
  # hand-copied comparison would strand a future canonicaliser fix in a repo no twin-fix sweep of
  # THIS one can reach. So the guard must INVOKE verify, not reimplement it.
  run node "$ARC_ROOT/.claude/scripts/legal/arc-legal.mjs" ci-guard --venture "fixture-gateway-gst"
  [ "$status" -eq 0 ]
  [[ "$output" == *"arc-legal.mjs verify"* ]]
  [[ "$output" == *"arc-legal-guard-version:"* ]]
  # It must not carry its own hashing. If these ever appear, someone has inlined the comparison.
  [[ "$output" != *"sha256"* ]]
  [[ "$output" != *"output_sha256"* ]]
}

@test "legal guard: the generated snippet goes RED on a one-byte page edit" {
  # End to end, in the layout a venture actually uses, with the clean run first -- a guard that
  # failed on everything would pass the red half and be useless.
  _arc_legal_sandbox
  run node "$ARC_LEGAL_CLI" propose --venture "fixture-gateway-gst" --out "$SANDBOX/legal/rendered"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" decision "$SANDBOX/legal/rendered/_approval.json" "$SANDBOX/d.json" approve "2026-08-13T00:00:00Z"
  [ "$status" -eq 0 ]
  run node "$ARC_LEGAL_CLI" publish --venture "fixture-gateway-gst" --dir "$SANDBOX/legal/rendered" \
    --decision "$SANDBOX/d.json" --request "$REQ"
  [ "$status" -eq 0 ]

  run node "$ARC_LEGAL_CLI" ci-guard --venture "fixture-gateway-gst" --out "$SANDBOX/ci-guard.sh"
  [ "$status" -eq 0 ]

  CLEAN=0
  ( cd "$SANDBOX" && bash ci-guard.sh ) >"$SANDBOX/g1.txt" 2>&1 || CLEAN=$?
  [ "$CLEAN" -eq 0 ]

  printf 'x' >> "$SANDBOX/legal/rendered/terms.mdx"

  DIRTY=0
  ( cd "$SANDBOX" && bash ci-guard.sh ) >"$SANDBOX/g2.txt" 2>&1 || DIRTY=$?
  [ "$DIRTY" -eq 2 ]
  run cat "$SANDBOX/g2.txt"
  [[ "$output" == *"TAMPERED"* ]]
}

@test "legal guard: a STALE guard version refuses the bump and leaves the pin alone" {
  # The check is a PRECONDITION. It sat after the pin was rewritten, so a refused bump left the
  # venture on the new set anyway -- the state the render-failure rollback exists to prevent,
  # reintroduced by a check placed one block too late. The pin assertion is the half that catches
  # that; the exit code alone would have passed even while it was broken.
  _arc_legal_sandbox
  run node "$ARC_LEGAL_CLI" ci-guard --venture "fixture-gateway-gst" --out "$SANDBOX/g.sh"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" json-set-line "$SANDBOX/g.sh" "# arc-legal-guard-version:" "# arc-legal-guard-version: arc-legal/0.0.9"
  [ "$status" -eq 0 ]

  MUTANT_STATUS=0
  node "$ARC_LEGAL_CLI" bump-templates --venture "fixture-gateway-gst" --to v2 --guard "$SANDBOX/g.sh" \
    >"$SANDBOX/o.txt" 2>&1 || MUTANT_STATUS=$?
  [ "$MUTANT_STATUS" -eq 2 ]
  run cat "$SANDBOX/o.txt"
  [[ "$output" == *"staying GREEN"* ]]

  run node "$ARC_LEGAL_CLI" render --venture "fixture-gateway-gst" --out "$SANDBOX/after"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" field "$SANDBOX/after/_run.json" template_set
  [ "$output" = "v1" ]
}

@test "legal guard: a MISSING guard exits 3 and leaves the pin alone" {
  _arc_legal_sandbox
  MUTANT_STATUS=0
  node "$ARC_LEGAL_CLI" bump-templates --venture "fixture-gateway-gst" --to v2 --guard "$SANDBOX/nope.sh" \
    >/dev/null 2>&1 || MUTANT_STATUS=$?
  [ "$MUTANT_STATUS" -eq 3 ]

  run node "$ARC_LEGAL_CLI" render --venture "fixture-gateway-gst" --out "$SANDBOX/after"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" field "$SANDBOX/after/_run.json" template_set
  [ "$output" = "v1" ]
}

@test "legal templates: an EDITED set blocks publish even with a fresh venture approval" {
  # REQ-07, and the reason it is a separate decision. The per-venture approval covers that
  # venture's FACTS and the pages they produce; it does not approve the WORDING, because the
  # person approving a venture is not reviewing the clause library every venture shares. Without
  # this, editing a clause and committing it would put new words in front of customers on the
  # next publish with every receipt in the chain looking clean.
  #
  # The venture approval here is minted AFTER the edit, so it matches perfectly. Only the set
  # approval can refuse.
  _arc_legal_sandbox
  run node "$ARC_ROOT/tests/legal-probe.mjs" data-edit "$SANDBOX" grievance-windows.json '"ack_hours": 48' '"ack_hours": 47'
  [ "$status" -eq 0 ]
  run node "$ARC_LEGAL_CLI" propose --venture "fixture-gateway-gst" --out "$SANDBOX/out"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" decision "$SANDBOX/out/_approval.json" "$SANDBOX/d.json" approve "2026-08-13T00:00:00Z"
  [ "$status" -eq 0 ]

  MUTANT_STATUS=0
  node "$ARC_LEGAL_CLI" publish --venture "fixture-gateway-gst" --dir "$SANDBOX/out" \
    --decision "$SANDBOX/d.json" --request "$REQ" >"$SANDBOX/pub.txt" 2>&1 || MUTANT_STATUS=$?
  [ "$MUTANT_STATUS" -eq 2 ]
  run cat "$SANDBOX/pub.txt"
  [[ "$output" == *"SET_EDITED_SINCE_APPROVAL"* ]]
}

@test "legal templates: an UNedited set publishes, so the refusal above means something" {
  # The positive control for the test above. Same flow, nothing edited.
  _arc_legal_sandbox
  run node "$ARC_LEGAL_CLI" propose --venture "fixture-gateway-gst" --out "$SANDBOX/out"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" decision "$SANDBOX/out/_approval.json" "$SANDBOX/d.json" approve "2026-08-13T00:00:00Z"
  [ "$status" -eq 0 ]
  run node "$ARC_LEGAL_CLI" publish --venture "fixture-gateway-gst" --dir "$SANDBOX/out" \
    --decision "$SANDBOX/d.json" --request "$REQ"
  [ "$status" -eq 0 ]
}

@test "legal templates: a set MISSING FROM the record is refused -- absence is not consent" {
  # This is SET_NOT_APPROVED, and it had no coverage at all. The test that claimed to cover it
  # deleted the whole `sets` map, which exercises SET_RECORD_UNREADABLE -- a different branch.
  # An attacker's mutant (`approvedSets.sets[templateSet] ?? sha`) passed all three approved-set
  # tests AND published a set with no approval whatsoever. So this deletes ONE key and leaves the
  # record otherwise intact, which is the state that was unreachable.
  _arc_legal_sandbox
  run node "$ARC_ROOT/tests/legal-probe.mjs" drop-set-approval "$SANDBOX/products/legal/approved-sets.json" v1
  [ "$status" -eq 0 ]
  run node "$ARC_LEGAL_CLI" propose --venture "fixture-gateway-gst" --out "$SANDBOX/out"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" decision "$SANDBOX/out/_approval.json" "$SANDBOX/d.json" approve "2026-08-13T00:00:00Z"
  [ "$status" -eq 0 ]
  MUTANT_STATUS=0
  node "$ARC_LEGAL_CLI" publish --venture "fixture-gateway-gst" --dir "$SANDBOX/out" \
    --decision "$SANDBOX/d.json" --request "$REQ" >"$SANDBOX/pub.txt" 2>&1 || MUTANT_STATUS=$?
  [ "$MUTANT_STATUS" -eq 2 ]
  run cat "$SANDBOX/pub.txt"
  [[ "$output" == *"SET_NOT_APPROVED"* ]]
}

@test "legal templates: an UNREADABLE approved-sets record is refused as its own class" {
  _arc_legal_sandbox
  run node "$ARC_ROOT/tests/legal-probe.mjs" json-del "$SANDBOX/products/legal/approved-sets.json" sets
  [ "$status" -eq 0 ]
  run node "$ARC_LEGAL_CLI" propose --venture "fixture-gateway-gst" --out "$SANDBOX/out"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" decision "$SANDBOX/out/_approval.json" "$SANDBOX/d.json" approve "2026-08-13T00:00:00Z"
  [ "$status" -eq 0 ]
  MUTANT_STATUS=0
  node "$ARC_LEGAL_CLI" publish --venture "fixture-gateway-gst" --dir "$SANDBOX/out" \
    --decision "$SANDBOX/d.json" --request "$REQ" >"$SANDBOX/pub.txt" 2>&1 || MUTANT_STATUS=$?
  [ "$MUTANT_STATUS" -eq 2 ]
  run cat "$SANDBOX/pub.txt"
  [[ "$output" == *"SET_RECORD_UNREADABLE"* ]]
}

@test "legal templates: propose-templates refuses a set already approved at these bytes" {
  # Nothing to decide. A request that asks a human to re-approve what they already approved is
  # how approval becomes a reflex.
  _arc_legal_sandbox
  MUTANT_STATUS=0
  node "$ARC_LEGAL_CLI" propose-templates --set v1 >"$SANDBOX/o.txt" 2>&1 || MUTANT_STATUS=$?
  [ "$MUTANT_STATUS" -eq 2 ]
  run cat "$SANDBOX/o.txt"
  [[ "$output" == *"already approved"* ]]
}

@test "legal templates: propose-templates on an edited set names the files and both hashes" {
  # "The set hash changed" is not reviewable. The person being asked has to know what they are
  # reading, so the request carries the file list and the sha it is moving FROM.
  _arc_legal_sandbox
  run node "$ARC_ROOT/tests/legal-probe.mjs" data-edit "$SANDBOX" grievance-windows.json '"ack_hours": 48' '"ack_hours": 47'
  [ "$status" -eq 0 ]
  run node "$ARC_LEGAL_CLI" propose-templates --set v1 --out "$SANDBOX/req.json"
  [ "$status" -eq 0 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" field "$SANDBOX/req.json" subject
  [ "$output" = "legal.templates" ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" field "$SANDBOX/req.json" previously_approved_sha
  [ "${#output}" -eq 64 ]
  run node "$ARC_ROOT/tests/legal-probe.mjs" field "$SANDBOX/req.json" template_set_sha
  [ "${#output}" -eq 64 ]
}

@test "legal pins: this suite registers every test it declares" {
  command -v bats >/dev/null 2>&1 || { echo "bats is not on PATH" >&2; return 1; }
  run node "$ARC_ROOT/tests/legal-probe.mjs" count-tests "$BATS_TEST_FILENAME"
  [ "$status" -eq 0 ]
  local declared="$output"
  run bats --count "$BATS_TEST_FILENAME"
  [ "$status" -eq 0 ]
  [ "$declared" -eq "$output" ]
}

@test "legal pins: every test name in this suite is 7-bit ASCII" {
  run _arc_ascii_test_names "$BATS_TEST_FILENAME"
  [ "$status" -eq 0 ]
}
