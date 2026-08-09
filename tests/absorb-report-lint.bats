#!/usr/bin/env bats
# Phase 00 -- report-lint, the gate that makes an extraction report trustable without reading
# the source (ADR-0601 / ABS-B).
#
# THE UNUSUAL THING ABOUT THIS SUITE, and why it carries a mutant control.
# report-lint is WARN-FIRST in TRIAL: it exits 0 on a clean report AND on a report with nine
# defects. So `status` carries no verdict, and every real assertion here is on the WARNING
# PAYLOAD. A lint whose every output is exit 0 is trivially satisfied by a stub that prints
# nothing -- which means an absence-only assertion ("no crash", "status 0") would pass just as
# well against a deleted implementation. The mutant control below is the only thing that makes
# the payload assertions falsifiable, and this repo has shipped the vacuous version of exactly
# this three times (docs/retro-log.md).
#
# ASCII-only test names -- bats silently DROPS a @test whose name carries a non-ASCII character
# (five tests once vanished behind a green file, visible only as a shrinking CI count), so this
# file asserts its own registered count at the bottom.
bats_require_minimum_version 1.5.0
load 'test_helper'

LINT=".claude/scripts/absorb/report-lint.mjs"

_lint() { cd "$ARC_ROOT" && node "$LINT" "$1"; }

# In-place sed that works on GNU, BSD (macOS) and Git Bash alike -- `-i` alone takes an argument
# on BSD and does not on GNU, so `-i.bak` plus a delete is the only spelling all three legs agree
# on. Defined HERE, per file, exactly as kickoff-lint.bats:18 and policy-lint.bats:88 do: it is
# NOT in test_helper.bash, and assuming it was cost this suite its first CI run.
sedi() {
  local f="${!#}"
  sed -i.bak "$@" && rm -f "${f}.bak"
}

# A VALID report: five required headings in order, one complete inventory row. Each test mutates
# exactly one thing, so a warning can only come from the thing that was changed. Written by
# heredoc into a temp file, never interpolated into a shell string.
_write_report() {
  cat > "$1" <<'REPORT'
# Extraction report -- test source

## Source

- **Identity:** test-source
- **Pin:** abc1234, 2026-08-09
- **License:** MIT, LICENSE file at repo root

## Study scope

- **Read:** README.md
- **Not read:** everything else, deliberately
- **Archaeology budget spent:** 0.1 hours

## Technique inventory

| id | name | what it does | why it wins | citation | verdict | reason | license note | risk note |
|---|---|---|---|---|---|---|---|---|
| T-01 | probe-unspecified-inputs | probes inputs no spec named | caught the only real defect | README.md:12 | ABSORB | re-expressible as a playbook step | MIT, re-expressed not copied | none |

## Verdict summary

| verdict | count |
|---|---|
| ABSORB | 1 |
| INTEGRATE | 0 |
| ROUTE | 0 |
| SKIP | 0 |

## SKIP and refusal log

- none
REPORT
}

setup() {
  REP="$BATS_TEST_TMPDIR/report.md"
  _write_report "$REP"
}

@test "a complete report lints clean with zero warnings" {
  run _lint "$REP"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"report-lint: 0 warnings"* ]] || { echo "$output"; false; }
}

@test "report-lint names every missing required heading" {
  sedi 's/^## Verdict summary$/## Totals/' "$REP"
  run _lint "$REP"
  [ "$status" -eq 0 ]
  [[ "$output" == *"## Verdict summary"* ]] || { echo "$output"; false; }
  [[ "$output" == *"[heading]"* ]] || { echo "$output"; false; }
}

# The case that matters most: it can only pass if the field loop actually visited the row, because
# a lint that skipped the row could not name it.
@test "report-lint warns on an inventory row with no license note and names the field and the row id" {
  sedi 's/MIT, re-expressed not copied//' "$REP"
  run _lint "$REP"
  [ "$status" -eq 0 ]
  [[ "$output" == *"license note"* ]] || { echo "$output"; false; }
  [[ "$output" == *"T-01"* ]] || { echo "$output"; false; }
}

# THE NEGATIVE CONTROL. A mutant report-lint that hardcodes a clean verdict is run against the
# same malformed report the test above asserts on. If this suite could not tell the mutant from
# the real thing, every payload assertion in this file would be decoration. WARN-first means the
# mutant exits 0 exactly like the real lint, so exit code is no defence -- only the payload is.
@test "a report-lint that returns a fixed empty warning list fails this suite" {
  local mutant="$BATS_TEST_TMPDIR/mutant.mjs"
  cat > "$mutant" <<'MUTANT'
console.log("report-lint: 0 warnings");
process.exit(0);
MUTANT
  sedi 's/MIT, re-expressed not copied//' "$REP"
  run bash -c "cd '$ARC_ROOT' && node '$mutant' '$REP'"
  [ "$status" -eq 0 ]
  # The mutant is indistinguishable by status, and distinguishable by payload. That asymmetry is
  # the thing being proven.
  [[ "$output" != *"license note"* ]] || { echo "mutant named the field; the payload assertion is not discriminating"; false; }
  [[ "$output" != *"T-01"* ]] || { echo "mutant named the row id; the payload assertion is not discriminating"; false; }
}

@test "a verdict outside the four buckets is reported with the offending value" {
  sedi 's/ ABSORB | re-expressible/ MAYBE | re-expressible/' "$REP"
  run _lint "$REP"
  [ "$status" -eq 0 ]
  [[ "$output" == *"MAYBE"* ]] || { echo "$output"; false; }
  [[ "$output" == *"[row-field]"* ]] || { echo "$output"; false; }
}

@test "a duplicate inventory id is reported" {
  sedi '/^| T-01 | probe-unspecified-inputs/p' "$REP"
  run _lint "$REP"
  [ "$status" -eq 0 ]
  [[ "$output" == *"duplicate id"* ]] || { echo "$output"; false; }
}

@test "an id that is not T-NN form is reported" {
  sedi 's/^| T-01 |/| 1 |/' "$REP"
  run _lint "$REP"
  [ "$status" -eq 0 ]
  [[ "$output" == *"[id]"* ]] || { echo "$output"; false; }
}

@test "a renamed id column is reported rather than silently checking the wrong cell" {
  sedi 's/^| id | name |/| ident | name |/' "$REP"
  run _lint "$REP"
  [ "$status" -eq 0 ]
  [[ "$output" == *"no \"id\" column"* ]] || { echo "$output"; false; }
}

@test "required headings out of order are reported" {
  local swapped="$BATS_TEST_TMPDIR/swapped.md"
  cat > "$swapped" <<'SWAPPED'
# Extraction report -- order test

## Source

- **Identity:** s

## Verdict summary

| verdict | count |
|---|---|
| SKIP | 1 |

## Study scope

- **Read:** nothing

## Technique inventory

| id | name | what it does | why it wins | citation | verdict | reason | license note | risk note |
|---|---|---|---|---|---|---|---|---|
| T-01 | t | d | w | f:1 | SKIP | r | MIT | none |

## SKIP and refusal log

- none
SWAPPED
  run _lint "$swapped"
  [ "$status" -eq 0 ]
  [[ "$output" == *"out of order"* ]] || { echo "$output"; false; }
}

# A heading is only a heading at the start of a line. Study input is hostile input, so a report
# quoting a README that contains "## Source" must not thereby satisfy the heading check.
@test "a required heading quoted inside studied content does not satisfy the check" {
  local injected="$BATS_TEST_TMPDIR/injected.md"
  cat > "$injected" <<'INJECTED'
# Extraction report -- injection test

The studied README contained the text `## Source` and `## Study scope` inline, quoted here as
content: "## Verdict summary".

## Technique inventory

| id | name | what it does | why it wins | citation | verdict | reason | license note | risk note |
|---|---|---|---|---|---|---|---|---|
| T-01 | t | d | w | f:1 | SKIP | r | MIT | none |

## SKIP and refusal log

- none
INJECTED
  run _lint "$injected"
  [ "$status" -eq 0 ]
  [[ "$output" == *"## Source"* ]] || { echo "$output"; false; }
  [[ "$output" == *"## Study scope"* ]] || { echo "$output"; false; }
  [[ "$output" == *"## Verdict summary"* ]] || { echo "$output"; false; }
}

# WARN-first is a contract, not an accident: a lint that exits non-zero is a BLOCK wearing a
# WARN's label, and promotion is /arc-retro's call against docs/trial-ledger.md.
@test "report-lint exits 0 even on a report with warnings" {
  sedi 's/MIT, re-expressed not copied//' "$REP"
  sedi 's/^## Verdict summary$/## Totals/' "$REP"
  run _lint "$REP"
  [ "$status" -eq 0 ] || { echo "expected exit 0 from a WARN-first lint, got $status"; false; }
  [[ "$output" == *"[trial]"* ]] || { echo "$output"; false; }
}

# An unreadable path is a usage error, NOT a verdict about a report. Exit 2 keeps the two apart.
@test "an unreadable report path exits 2 and is not a lint verdict" {
  run _lint "$BATS_TEST_TMPDIR/does-not-exist.md"
  [ "$status" -eq 2 ]
  [[ "$output" == *"cannot read"* ]] || { echo "$output"; false; }
}

@test "no argument exits 2 with usage" {
  run bash -c "cd '$ARC_ROOT' && node '$LINT'"
  [ "$status" -eq 2 ]
  [[ "$output" == *"usage"* ]] || { echo "$output"; false; }
}

@test "absorb-report-lint suite registers every test it defines" {
  registered=${#BATS_TEST_NAMES[@]}
  [ "$registered" -eq 14 ] || { echo "registered $registered tests, expected 14"; false; }
}
