#!/usr/bin/env bats
# distribute Phase 00 -- the lane is born, the matrix is declared, the local lies are resolved
# (ADR-2000, ADR-2003, ADR-2004, ADR-2005, ADR-2014).
#
# Red-first is commit order (this file lands in its own commit ahead of the rows) plus mutant arms:
# tests 2, 4 and 7 re-run their assertion on a temp copy with the change undone and must see it.
# Every probe asserts it RAN (exit 0, empty stderr, the RAN marker) before its output is believed.
# Probes live in tests/distribute/birth-probe.mjs, never in a shell string.

bats_require_minimum_version 1.5.0
load 'test_helper'

probe() { ( cd "$ARC_ROOT" && node tests/distribute/birth-probe.mjs "$@" ); }

ran_ok() {
  [ "$status" -eq 0 ] && [ -z "$stderr" ] || { echo "probe did not run: status $status, stderr: $stderr"; return 1; }
  printf '%s\n' "$output" | grep -qx "RAN $1" || { echo "probe never reached its end: $output"; return 1; }
}

field() { printf '%s\n' "$output" | sed -n "s/^$1 //p"; }

@test "distribute-birth: every test in the file is registered" {
  local declared
  declared=$(grep -c '^@test "distribute-birth: ' "$BATS_TEST_FILENAME")
  [ "$declared" -eq 8 ] || { echo "declared $declared, expected 8"; false; }
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "distribute-birth: band 2000 is distribute's" {
  run grep -c '^| 2000–2099 | `distribute`' "$ARC_ROOT/PORTFOLIO.md"
  [ "$output" = "1" ] || { echo "band 2000 row does not name distribute"; false; }
}

@test "distribute-birth: no rendered surface is gitignored, and the check sees a planted line" {
  [ -s "$ARC_ROOT/.gitignore" ] || { echo ".gitignore missing or empty -- could not scan"; false; }
  run grep -cxE '/?(\.codex|\.agents|AGENTS\.md)/?' "$ARC_ROOT/.gitignore"
  [ "$status" -le 1 ] || { echo "grep could not read .gitignore"; false; }
  [ "$output" = "0" ] || { echo ".gitignore still ignores .codex, .agents or AGENTS.md ($output lines)"; false; }
  { cat "$ARC_ROOT/.gitignore"; printf '.codex\n'; } > "$BATS_TEST_TMPDIR/gitignore"
  run grep -cxE '/?(\.codex|\.agents|AGENTS\.md)/?' "$BATS_TEST_TMPDIR/gitignore"
  [ "$output" = "1" ] || { echo "the check did not see a planted .codex line: $output"; false; }
}

@test "distribute-birth: the matrix parses with at least 8 rows" {
  [ -s "$ARC_ROOT/engine/harnesses.yaml" ] || { echo "engine/harnesses.yaml missing"; false; }
  run --separate-stderr probe matrix engine/harnesses.yaml
  ran_ok matrix
  [ "$(field rows)" -ge 8 ] || { echo "rows: $(field rows)"; false; }
}

@test "distribute-birth: exactly 4 verified rows, each dated and sourced; an undated copy is caught" {
  run --separate-stderr probe matrix engine/harnesses.yaml
  ran_ok matrix
  [ "$(field verified)" -eq 4 ] || { echo "verified rows: $(field verified)"; false; }
  if printf '%s\n' "$output" | grep -E '^PROBLEM .*: (undated|no version|no source)$'; then echo "a row is undated or unsourced"; false; fi
  grep -v '^    verified: ' "$ARC_ROOT/engine/harnesses.yaml" > "$BATS_TEST_TMPDIR/undated.yaml"
  [ -s "$BATS_TEST_TMPDIR/undated.yaml" ] || { echo "mutant copy is empty"; false; }
  run --separate-stderr probe matrix "$BATS_TEST_TMPDIR/undated.yaml"
  ran_ok matrix
  printf '%s\n' "$output" | grep -qE '^PROBLEM .*: undated$' || { echo "the check did not see a row with its date removed: $output"; false; }
}

@test "distribute-birth: every cell is legal and every row carries all 9 cells" {
  run --separate-stderr probe matrix engine/harnesses.yaml
  ran_ok matrix
  local rows cells
  rows=$(field rows); cells=$(field cells)
  [ "$cells" -eq $((rows * 9)) ] || { echo "cells $cells for $rows rows"; false; }
  if printf '%s\n' "$output" | grep -E '^PROBLEM '; then echo "the matrix has problems"; false; fi
}

@test "distribute-birth: the claude-code golden is the sync golden, and its transform is declared" {
  run --separate-stderr probe matrix engine/harnesses.yaml
  ran_ok matrix
  [ "$(field claude-golden)" = "tests/fixtures/sync-golden/tree-manifest.txt" ] || { echo "claude-code golden: $(field claude-golden)"; false; }
  local n
  n=$(wc -l < "$ARC_ROOT/tests/fixtures/sync-golden/tree-manifest.txt")
  [ "$n" -ge 400 ] || { echo "sync golden has only $n lines"; false; }
  field claude-transform | grep -qF '\r' || { echo "golden_transform does not name the CR strip"; false; }
  field claude-transform | grep -qF 'arc-registry.json' || { echo "golden_transform does not name the registry exclusion"; false; }
}

@test "distribute-birth: the skills verdict is complete and seeds match FAITHFUL rows; a short copy is caught" {
  local v=initiatives/distribute/evidence/phase-00/agents-skills-verdict.md
  run --separate-stderr probe verdict "$v"
  ran_ok verdict
  printf '%s\n' "$output" | grep -qx 'verdict complete' || { echo "$output"; false; }
  local seeds=0
  if [ -d "$ARC_ROOT/tests/fixtures/distribute/goldens/codex-seed" ]; then
    seeds=$(find "$ARC_ROOT/tests/fixtures/distribute/goldens/codex-seed" -mindepth 1 -maxdepth 1 -type d | wc -l)
  fi
  [ "$seeds" -eq "$(field faithful)" ] || { echo "seed dirs $seeds, FAITHFUL rows $(field faithful)"; false; }
  grep -v 'source-command-arc-pr ' "$ARC_ROOT/$v" > "$BATS_TEST_TMPDIR/short.md"
  [ -s "$BATS_TEST_TMPDIR/short.md" ] || { echo "mutant copy is empty"; false; }
  run --separate-stderr probe verdict "$BATS_TEST_TMPDIR/short.md"
  ran_ok verdict
  printf '%s\n' "$output" | grep -qx 'verdict incomplete' || { echo "the check did not see a deleted row: $output"; false; }
}
