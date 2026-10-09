#!/usr/bin/env bats
# distribute Phase 03 -- REQ-10: `apply` is transactional and refuses boundary cases by name.
#
# Writes go temp -> rename, journaled. An injected failure on the Nth rename undoes every rename already
# made, so the run leaves 0 of its files; a pre-existing file it had overwritten comes back byte-for-byte.
# A target that is a file, a symlink or a drive-letter path off Windows is refused with a named reason; a
# path with spaces and a Windows drive-letter path are handled; a parent that is a file or a link is
# refused before anything is written. Every fixture is pre-seeded (non-empty) and asserts the installer's
# `plan:` line (it RAN) before its outcome. Fixture paths go through the realpath guard (macOS /var).

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
# A pre-seeded project directory, through the realpath guard.
proj() { local d="$BATS_TEST_TMPDIR/$1"; mkdir -p "$d" && printf 'mine\n' > "$d/own.txt" && (cd "$d" && pwd -P); }
files_in() { find "$1" -type f | wc -l | tr -d ' '; }

install_() { run --separate-stderr node "$(I)" --target "$1" --dir "$2" --source "$(native "$3")" ${4:+"$4"}; }
planned() { [ "$(count "^plan: $1 — [0-9]+ file\(s\), ")" -eq 1 ] || { echo "the installer never planned: $output $stderr"; return 1; }; }
real_link() { ln -s "$1" "$2" 2>/dev/null && [ -L "$2" ]; }

@test "distribute-apply-boundary: every test in the file is registered" {
  local declared
  declared=$(grep -c '^@test "distribute-apply-boundary: ' "$BATS_TEST_FILENAME")
  [ "$declared" -eq 9 ] || { echo "declared $declared, expected 9"; false; }
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "distribute-apply-boundary: a target that is a file is refused as not-a-directory" {
  local s d; s=$(src) || false; d=$(proj p)
  [ -s "$d/own.txt" ] || false
  install_ codex "$(native "$d/own.txt")" "$s"
  planned codex || false
  [ "$status" -eq 2 ] && [ "$(count '^refused \[not-a-directory\] .* is a file, not a directory$')" -eq 1 ] || { echo "status $status: $output"; false; }
  [ "$(cat "$d/own.txt")" = "mine" ] && [ "$(files_in "$d")" -eq 1 ] || { echo "the refusal touched the project"; false; }
}

@test "distribute-apply-boundary: a target that is a symlink is refused by name" {
  local s d; s=$(src) || false; d=$(proj p)
  real_link "$d" "$BATS_TEST_TMPDIR/link" || skip "this filesystem made no real symlink (Git for Windows without developer mode copies instead)"
  install_ codex "$(native "$BATS_TEST_TMPDIR/link")" "$s"
  planned codex || false
  [ "$status" -eq 2 ] && [ "$(count '^refused \[symlink\] .* is a symlink; name the directory it points at$')" -eq 1 ] || { echo "status $status: $output"; false; }
  [ "$(files_in "$d")" -eq 1 ] || { echo "the refusal wrote through the link"; false; }
}

@test "distribute-apply-boundary: a path with spaces is handled and doctors clean" {
  local s d; s=$(src) || false; d=$(proj "with spaces/in it")
  install_ skills-only "$(native "$d")" "$s"
  planned skills-only || false
  [ "$status" -eq 0 ] && [ -s "$d/.agents/skills/arc-commit/SKILL.md" ] || { echo "status $status: $output"; false; }
  run --separate-stderr node "$(I)" --doctor "$(native "$d")"
  [ "$status" -eq 0 ] && [ "$(count '^doctor: [0-9]+ placed, [0-9]+ degraded, 0 missing, 0 unmanaged-conflict$')" -eq 1 ] || { echo "status $status: $output"; false; }
}

@test "distribute-apply-boundary: a drive-letter path is handled on Windows and refused by name elsewhere" {
  local s d; s=$(src) || false; d=$(proj p)
  if command -v cygpath >/dev/null 2>&1; then
    local w; w=$(cygpath -m "$d")
    [[ "$w" =~ ^[A-Za-z]: ]] || { echo "cygpath gave no drive letter: $w"; false; }
    install_ codex "$w" "$s"
    planned codex || false
    [ "$status" -eq 0 ] && [ -s "$d/.arc-install.json" ] || { echo "status $status: $output"; false; }
  else
    install_ codex "C:/arc-drive-letter-$$" "$s"
    planned codex || false
    [ "$status" -eq 2 ] && [ "$(count '^refused \[drive-letter\] C:/arc-drive-letter-[0-9]+ is a drive-letter path, which names nothing on this system$')" -eq 1 ] || { echo "status $status: $output"; false; }
    [ ! -e "C:" ] || { echo "a directory named C: was created"; false; }
  fi
}

@test "distribute-apply-boundary: an injected failure on the 5th file leaves 0 files and restores what it overwrote" {
  local s d first; s=$(src) || false; d=$(proj p)
  first=$(ls "$s/.claude/rules" | LC_ALL=C sort | head -1)
  mkdir -p "$d/.claude/rules" && printf 'their own rule\n' > "$d/.claude/rules/$first"
  export ARC_INSTALL_INJECT_FAIL_AT=5
  install_ codex "$(native "$d")" "$s" --force
  unset ARC_INSTALL_INJECT_FAIL_AT
  planned codex || false
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  [ "$(count '^apply: FAILED — injected failure at file 5 ')" -eq 1 ] || { echo "the failure never fired: $output"; false; }
  [ "$(count '^rollback: 1 restored, 3 removed; this run left 0 files$')" -eq 1 ] || { echo "the rollback did not run as journaled: $output"; false; }
  [ "$(files_in "$d")" -eq 2 ] && [ "$(cat "$d/.claude/rules/$first")" = "their own rule" ] || { echo "the run left files behind:"; find "$d" -type f; false; }
  [ ! -e "$d/.arc-install.json" ] && [ ! -e "$d/.codex" ] || { echo "the rollback left the record or a directory"; false; }
}

@test "distribute-apply-boundary: a failure on the record itself rolls back the whole run" {
  local s d n; s=$(src) || false; d=$(proj p)
  run --separate-stderr node "$(I)" --target skills-only --dry-run --quiet --source "$(native "$s")"
  n=$(printf '%s\n' "$output" | tr -d '\r' | sed -n 's/^plan: skills-only — \([0-9]*\) file(s), .*/\1/p')
  [ -n "$n" ] && [ "$n" -gt 0 ] || { echo "no plan count: $output"; false; }
  export ARC_INSTALL_INJECT_FAIL_AT=$((n + 1))
  install_ skills-only "$(native "$d")" "$s"
  unset ARC_INSTALL_INJECT_FAIL_AT
  planned skills-only || false
  [ "$status" -eq 1 ] && [ "$(count "^apply: FAILED — injected failure at file $((n + 1)) \(\.arc-install\.json\)$")" -eq 1 ] || { echo "status $status: $output"; false; }
  [ "$(count "^rollback: 0 restored, $n removed; this run left 0 files$")" -eq 1 ] && [ "$(files_in "$d")" -eq 1 ] || { echo "$output"; find "$d" -type f | head; false; }
}

@test "distribute-apply-boundary: a parent that is a file is refused as file-as-dir before any write" {
  local s d; s=$(src) || false; d=$(proj p)
  printf 'a file, not a directory\n' > "$d/.agents"
  install_ skills-only "$(native "$d")" "$s"
  planned skills-only || false
  [ "$status" -eq 1 ] && [ "$(count '^refused \[file-as-dir\] \.agents is a file where \.agents/skills/')" -eq 1 ] || { echo "status $status: $output"; false; }
  [ "$(files_in "$d")" -eq 2 ] || { echo "the refusal wrote:"; find "$d" -type f; false; }
}

@test "distribute-apply-boundary: a parent that is a symlink is refused as linked-parent" {
  local s d elsewhere; s=$(src) || false; d=$(proj p); elsewhere=$(proj elsewhere)
  real_link "$elsewhere" "$d/.agents" || skip "this filesystem made no real symlink (Git for Windows without developer mode copies instead)"
  install_ skills-only "$(native "$d")" "$s"
  planned skills-only || false
  [ "$status" -eq 1 ] && [ "$(count '^refused \[linked-parent\] \.agents is a symlink, and \.agents/skills/')" -eq 1 ] || { echo "status $status: $output"; false; }
  [ "$(files_in "$elsewhere")" -eq 1 ] || { echo "the install wrote through the link"; false; }
}
