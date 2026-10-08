#!/usr/bin/env bats
# distribute Phase 00 -- the lane is born, the matrix is declared, the local lies are resolved
# (ADR-2000, ADR-2003, ADR-2004, ADR-2005, ADR-2014).
#
# Red-first is commit order (this file lands in its own commit ahead of the rows) plus mutant arms:
# tests 2, 4 and 7 re-run their assertion on a temp copy with the change undone and must see it,
# and each mutant first proves it changed something (cmp), so a formatting drift cannot make it a no-op.
# Every probe asserts it RAN (exit 0, empty stderr, the RAN marker) before its output is believed.
# Probes live in tests/distribute/birth-probe.mjs, never in a shell string.

bats_require_minimum_version 1.5.0
load 'test_helper'

probe() { ( cd "$ARC_ROOT" && node tests/distribute/birth-probe.mjs "$@" ); }

# A temp path handed to native node goes through cygpath on Windows (fixed-defects class g).
native() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }

ran_ok() {
  [ "$status" -eq 0 ] && [ -z "$stderr" ] || { echo "probe did not run: status $status, stderr: $stderr"; return 1; }
  printf '%s\n' "$output" | tr -d '\r' | grep -qx "RAN $1" || { echo "probe never reached its end: $output"; return 1; }
}

field() { printf '%s\n' "$output" | tr -d '\r' | sed -n "s/^$1 //p"; }

has_problem() { printf '%s\n' "$output" | tr -d '\r' | grep -E "^PROBLEM $1"; }

# Asks git, not a grep, whether a rendered path is ignored, so `.codex/*`, `**/AGENTS.md`, a nested
# .gitignore and every other spelling of the same rule are caught. The user's global and system git
# config are neutralised, so a machine's own excludesFile or init.templateDir cannot decide the
# answer. Exit 0 = ignored, 1 = not ignored, anything else is COULD NOT SCAN, never "not ignored".
# Prints each path git would ignore, then the RAN marker.
check_paths() {
  local repo="$1" p rc
  for p in .codex/hooks.json .agents/skills/x/SKILL.md AGENTS.md .opencode/commands/x.md; do
    GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 git -C "$repo" check-ignore -q --no-index "$p"
    rc=$?
    case "$rc" in
      0) echo "$p" ;;
      1) ;;
      *) echo "COULD NOT SCAN: check-ignore exit $rc on $p"; return 2 ;;
    esac
  done
  echo "RAN ignored"
}

# The mutant arm: a fresh temp repo carrying a CR-stripped copy of the given .gitignore.
ignored_in_copy() {
  local repo="$BATS_TEST_TMPDIR/ign-$2"
  mkdir -p "$repo" && GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 git -C "$repo" init -q --template= || return 2
  tr -d '\r' < "$1" > "$repo/.gitignore"
  [ -s "$repo/.gitignore" ] || { echo "COULD NOT SCAN: copied .gitignore is empty"; return 2; }
  check_paths "$repo"
}

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

@test "distribute-birth: git ignores no rendered surface, and the check sees a planted rule" {
  [ -s "$ARC_ROOT/.gitignore" ] || { echo ".gitignore missing or empty -- could not scan"; false; }
  run check_paths "$ARC_ROOT"
  [ "$status" -eq 0 ] && [ "${lines[${#lines[@]}-1]}" = "RAN ignored" ] || { echo "check did not run: $output"; false; }
  [ "${#lines[@]}" -eq 1 ] || { echo "git still ignores: $output"; false; }
  # One planted rule per probed surface, each spelled differently from a bare line, so every one of
  # the four probes is shown able to go red.
  { cat "$ARC_ROOT/.gitignore"; printf '.codex/*\n**/.agents/\n/AGENTS.md\n.opencode\n'; } > "$BATS_TEST_TMPDIR/gitignore"
  run ignored_in_copy "$BATS_TEST_TMPDIR/gitignore" mutant
  [ "$status" -eq 0 ] && [ "${lines[${#lines[@]}-1]}" = "RAN ignored" ] || { echo "mutant check did not run: $output"; false; }
  [ "${#lines[@]}" -eq 5 ] || { echo "the check did not see all four planted rules: $output"; false; }
  [ "${lines[0]}" = ".codex/hooks.json" ] && [ "${lines[3]}" = ".opencode/commands/x.md" ] || { echo "planted rules seen out of order: $output"; false; }
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
  if has_problem '.*: (undated|no version|no source)$'; then echo "a row is undated or unsourced"; false; fi
  grep -vE '^[[:space:]]+verified: ' "$ARC_ROOT/engine/harnesses.yaml" > "$BATS_TEST_TMPDIR/undated.yaml"
  [ -s "$BATS_TEST_TMPDIR/undated.yaml" ] || { echo "mutant copy is empty"; false; }
  if cmp -s "$ARC_ROOT/engine/harnesses.yaml" "$BATS_TEST_TMPDIR/undated.yaml"; then echo "the mutant removed nothing"; false; fi
  run --separate-stderr probe matrix "$(native "$BATS_TEST_TMPDIR/undated.yaml")"
  ran_ok matrix
  local undated
  undated=$(has_problem '.*: undated$' | wc -l)
  [ "$undated" -eq "$(field rows)" ] || { echo "every row lost its date, but only $undated of $(field rows) were reported undated: $output"; false; }
}

@test "distribute-birth: every cell is legal and every row carries all 11 cells" {
  run --separate-stderr probe matrix engine/harnesses.yaml
  ran_ok matrix
  local rows cells
  rows=$(field rows); cells=$(field cells)
  [ "$cells" -eq $((rows * 11)) ] || { echo "cells $cells for $rows rows"; false; }
  if has_problem ''; then echo "the matrix has problems"; false; fi
}

@test "distribute-birth: the claude-code golden is the sync golden, and its transform is declared" {
  run --separate-stderr probe matrix engine/harnesses.yaml
  ran_ok matrix
  [ "$(field claude-golden)" = "tests/fixtures/sync-golden/tree-manifest.txt" ] || { echo "claude-code golden: $(field claude-golden)"; false; }
  local n
  n=$(wc -l < "$ARC_ROOT/tests/fixtures/sync-golden/tree-manifest.txt")
  [ "$n" -ge 400 ] || { echo "sync golden has only $n lines"; false; }
  field claude-transform | grep -qF 'carriage-return' || { echo "golden_transform does not name the CR strip"; false; }
  field claude-transform | grep -qF 'arc-registry.json' || { echo "golden_transform does not name the registry exclusion"; false; }
}

@test "distribute-birth: the skills verdict is complete and seeds match FAITHFUL rows; a short copy is caught" {
  local v=initiatives/distribute/evidence/phase-00/agents-skills-verdict.md
  run --separate-stderr probe verdict "$v"
  ran_ok verdict
  printf '%s\n' "$output" | tr -d '\r' | grep -qx 'verdict complete' || { echo "$output"; false; }
  local seeds=0
  if [ -d "$ARC_ROOT/tests/fixtures/distribute/goldens/codex-seed" ]; then
    seeds=$(find "$ARC_ROOT/tests/fixtures/distribute/goldens/codex-seed" -mindepth 1 -maxdepth 1 -type d | wc -l)
  fi
  [ "$seeds" -eq "$(field faithful)" ] || { echo "seed dirs $seeds, FAITHFUL rows $(field faithful)"; false; }
  grep -vE '^[|][[:space:]]*source-command-arc-pr[[:space:]]*[|]' "$ARC_ROOT/$v" > "$BATS_TEST_TMPDIR/short.md"
  [ -s "$BATS_TEST_TMPDIR/short.md" ] || { echo "mutant copy is empty"; false; }
  if cmp -s "$ARC_ROOT/$v" "$BATS_TEST_TMPDIR/short.md"; then echo "the mutant removed nothing"; false; fi
  run --separate-stderr probe verdict "$(native "$BATS_TEST_TMPDIR/short.md")"
  ran_ok verdict
  printf '%s\n' "$output" | tr -d '\r' | grep -qx 'verdict incomplete' || { echo "the check did not see a deleted row: $output"; false; }
  [ "$(field command-rows)" -eq 7 ] || { echo "the mutant should leave exactly 7 command rows: $(field command-rows)"; false; }
}
