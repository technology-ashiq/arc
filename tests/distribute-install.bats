#!/usr/bin/env bats
# distribute Phase 03 -- REQ-07: `doctor` reports the truth of an install, not the intent.
#
# `arc-install --doctor DIR` prints one line per managed path, `placed`, `missing` or `unmanaged-conflict`,
# then the degraded cells, then the counts. Deleting one installed file flips exactly one row to `missing`;
# a hand-placed file at a managed path flips it to `unmanaged-conflict`, and a re-install refuses that path
# by name unless --force, which the record lists. Every run asserts its plan or doctor line (it RAN) first.
# The source is a small real slice of the tree, so each test installs in well under a second.

bats_require_minimum_version 1.5.0
load 'test_helper'

I() { printf '%s' "$ARC_ROOT/.claude/scripts/engine/arc-install.mjs"; }
native() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }
count() { printf '%s\n' "$output" | tr -d '\r' | grep -cE "$1" || true; }

src() {
  local s="$BATS_TEST_TMPDIR/src"
  mkdir -p "$s/engine" "$s/.claude"
  cp "$ARC_ROOT/engine/harnesses.yaml" "$ARC_ROOT/engine/frontmatter-keys.yaml" "$s/engine/"
  cp -R "$ARC_ROOT/.claude/commands" "$ARC_ROOT/.claude/agents" "$ARC_ROOT/.claude/skills" "$ARC_ROOT/.claude/rules" "$s/.claude/"
  [ -s "$s/.claude/commands/arc-commit.md" ] && [ -s "$s/.claude/rules/lanes.md" ] || { echo "src built an empty fixture"; return 1; }
  printf '%s' "$s"
}
# The project directory, through the realpath guard (macOS /var is /private/var).
proj() { local d="$BATS_TEST_TMPDIR/$1"; mkdir -p "$d" && (cd "$d" && pwd -P); }

install_() { run --separate-stderr node "$(I)" --target "$1" --dir "$(native "$2")" --source "$(native "$3")" ${4:+"$4"}; }
doctor_() { run --separate-stderr node "$(I)" --doctor "$(native "$1")"; }
planned() { [ "$(count "^plan: $1 — [0-9]+ file\(s\), ")" -eq 1 ] || { echo "the installer never planned: $output $stderr"; return 1; }; }
doctored() { [ "$(count '^doctor: [0-9]+ placed, [0-9]+ degraded, [0-9]+ missing, [0-9]+ unmanaged-conflict$')" -eq 1 ] || { echo "doctor never reached its count line: $output $stderr"; return 1; }; }

@test "distribute-install: every test in the file is registered" {
  local declared
  declared=$(grep -c '^@test "distribute-install: ' "$BATS_TEST_FILENAME")
  [ "$declared" -eq 7 ] || { echo "declared $declared, expected 7"; false; }
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "distribute-install: a clean install doctors as every path placed" {
  local s d n; s=$(src) || false; d=$(proj p)
  install_ skills-only "$d" "$s"
  planned skills-only || false
  [ "$status" -eq 0 ] && [ "$(count '^apply: wrote [0-9]+ file\(s\) ')" -eq 1 ] || { echo "status $status: $output"; false; }
  [ -s "$d/.arc-install.json" ] && [ -s "$d/.agents/skills/arc-commit/SKILL.md" ] && [ -s "$d/.claude/rules/lanes.md" ] || { echo "the install placed nothing"; false; }
  n=$(_arc_json "$d/.arc-install.json" 'Object.keys(j.files).length')
  doctor_ "$d"
  doctored || false
  [ "$status" -eq 0 ] || { echo "status $status: $output"; false; }
  [ "$(count '^placed ')" -eq "$n" ] && [ "$(count "^doctor: $n placed, [0-9]+ degraded, 0 missing, 0 unmanaged-conflict$")" -eq 1 ] || { echo "n $n: $output"; false; }
  [ "$(count '^degraded ')" -gt 0 ] || { echo "skills-only reported no degraded cell: $output"; false; }
}

@test "distribute-install: deleting one installed file flips exactly one row to missing" {
  local s d; s=$(src) || false; d=$(proj p)
  install_ codex "$d" "$s"
  planned codex || false
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  rm "$d/.codex/agents/plan-attacker.toml"
  doctor_ "$d"
  doctored || false
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  [ "$(count '^missing ')" -eq 1 ] && [ "$(count '^missing \.codex/agents/plan-attacker\.toml$')" -eq 1 ] && [ "$(count '^unmanaged-conflict ')" -eq 0 ] || { echo "$output"; false; }
}

@test "distribute-install: a hand-placed file at a managed path is unmanaged-conflict, and a re-install refuses it" {
  local s d f; s=$(src) || false; d=$(proj p)
  install_ opencode "$d" "$s"
  planned opencode || false
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  f="$d/.opencode/commands/arc-commit.md"
  printf 'hand-written\n' > "$f"
  doctor_ "$d"
  doctored || false
  [ "$status" -eq 1 ] && [ "$(count '^unmanaged-conflict ')" -eq 1 ] && [ "$(count '^unmanaged-conflict \.opencode/commands/arc-commit\.md$')" -eq 1 ] || { echo "status $status: $output"; false; }
  install_ opencode "$d" "$s"
  planned opencode || false
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  [ "$(count '^unmanaged-conflict \.opencode/commands/arc-commit\.md — a file this install did not write; refusing')" -eq 1 ] && [ "$(count '^apply: refused, 1 unmanaged-conflict\(s\); nothing written$')" -eq 1 ] || { echo "$output"; false; }
  [ "$(cat "$f")" = "hand-written" ] || { echo "the refused run touched the file"; false; }
}

@test "distribute-install: --force overwrites the conflict and the record lists it" {
  local s d f; s=$(src) || false; d=$(proj p)
  mkdir -p "$d/.agents/skills/arc-commit"
  f="$d/.agents/skills/arc-commit/SKILL.md"
  printf 'theirs\n' > "$f"
  install_ skills-only "$d" "$s" --force
  planned skills-only || false
  [ "$status" -eq 0 ] && [ "$(count '^apply: wrote [0-9]+ file\(s\) .*, 1 forced; ')" -eq 1 ] || { echo "status $status: $output"; false; }
  [ "$(_arc_json "$d/.arc-install.json" 'j.forced.join(",")')" = ".agents/skills/arc-commit/SKILL.md" ] || { echo "the record does not list the forced path"; false; }
  grep -qx 'name: arc-commit' "$f" || { echo "the file was not overwritten"; false; }
  # The overwritten original is kept, so --force can be undone by hand (attack 74bcf43 B9).
  [ "$(find "$d/.arc-install-backup" -type f -path '*/.agents/skills/arc-commit/SKILL.md' -exec cat {} \; )" = "theirs" ] || { echo "no backup of the forced file"; find "$d/.arc-install-backup" 2>&1; false; }
}

@test "distribute-install: a directory with no install record doctors as not-installed, exit 2" {
  local d; d=$(proj empty)
  printf 'x\n' > "$d/own.txt"
  doctor_ "$d"
  [ "$status" -eq 2 ] && [ "$(count '^doctor: not-installed: no \.arc-install\.json and no install record in \.claude/arc-registry\.json$')" -eq 1 ] || { echo "status $status: $output"; false; }
}

@test "distribute-install: a dry-run plans every op and writes nothing" {
  local s d; s=$(src) || false; d=$(proj p)
  printf 'x\n' > "$d/own.txt"
  run --separate-stderr node "$(I)" --target codex --dir "$(native "$d")" --source "$(native "$s")" --dry-run
  planned codex || false
  [ "$status" -eq 0 ] && [ "$(count '^dry-run: nothing written$')" -eq 1 ] && [ "$(count '^write \.codex/agents/plan-attacker\.toml$')" -eq 1 ] || { echo "status $status: $output"; false; }
  [ "$(find "$d" -type f | wc -l | tr -d ' ')" -eq 1 ] || { echo "a dry-run wrote into the project"; find "$d"; false; }
}
