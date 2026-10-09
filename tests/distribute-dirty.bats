#!/usr/bin/env bats
# distribute Phase 02 -- REQ-05: rendered directories hold nothing the compiler did not write.
#
# Every `arc-compile --check` lists each directory a verified row of engine/harnesses.yaml declares under
# `rendered:` and fails each file it would not write, `[dirty]` by name. One fixture per directory, each a
# temp tree with one planted file; the clean control holds only a harness's own first-run files and must
# see them (files > 0) yet call none dirty. Every run asserts the compile line (it RAN) first.

bats_require_minimum_version 1.5.0
load 'test_helper'

CC() { printf '%s' "$ARC_ROOT/.claude/scripts/engine/arc-compile.mjs"; }
native() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }
count() { printf '%s\n' "$output" | tr -d '\r' | grep -cE "$1" || true; }

ran() {
  local n
  n=$(find "$ARC_ROOT/.claude/commands" -type f | wc -l | tr -d ' ')
  printf '%s\n' "$output" | tr -d '\r' | grep -qx "arc-compile: $n/$n byte-identical for target \`claude-code\` (input commands)" || { echo "arc-compile never reached its compile line: $output $stderr"; return 1; }
}

tree() {
  local t="$BATS_TEST_TMPDIR/tree"
  mkdir -p "$t/engine" "$t/.claude"
  cp "$ARC_ROOT/engine/harnesses.yaml" "$t/engine/"
  cp -R "$ARC_ROOT/.claude/commands" "$t/.claude/"
  [ -s "$t/engine/harnesses.yaml" ] && [ -s "$t/.claude/commands/arc-freeze.md" ] || { echo "tree built an empty fixture"; return 1; }
  printf '%s' "$t"
}

plant() { mkdir -p "$(dirname "$1")" && printf 'planted\n' > "$1" && [ -s "$1" ]; }

check() { run --separate-stderr node "$(CC)" --check --all --input commands --target claude-code --root "$(native "$1")"; }

@test "distribute-dirty: every test in the file is registered" {
  local declared
  declared=$(grep -c '^@test "distribute-dirty: ' "$BATS_TEST_FILENAME")
  [ "$declared" -eq 12 ] || { echo "declared $declared, expected 12"; false; }
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "distribute-dirty: the real tree is clean and every declared directory was scanned" {
  run --separate-stderr node "$ARC_ROOT/tests/distribute/dirty-probe.mjs" "$(native "$ARC_ROOT")"
  [ "$status" -eq 0 ] && printf '%s\n' "$output" | tr -d '\r' | grep -qx 'RAN dirty-probe' || { echo "probe: $output $stderr"; false; }
  local ndirs
  ndirs=$(count '^dir ')
  [ "$ndirs" -ge 3 ] || { echo "only $ndirs rendered directories declared"; false; }
  check "$ARC_ROOT"
  ran || false
  [ "$status" -eq 0 ] || { echo "status $status: $output"; false; }
  [ "$(count "^dirty-scan: $ndirs rendered directories, [0-9]+ present, [0-9]+ files, 0 dirty$")" -eq 1 ] || { echo "$output"; false; }
}

@test "distribute-dirty: a hand-placed file under .codex/ is named" {
  local t; t=$(tree) || false
  plant "$t/.codex/agents/planted.toml" || false
  check "$t"
  ran || false
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  [ "$(count '^\[dirty\] \.codex/agents/planted\.toml ')" -eq 1 ] && [ "$(count ' rendered directories, 1 present, 1 files, 1 dirty$')" -eq 1 ] || { echo "$output"; false; }
}

@test "distribute-dirty: a hand-placed file under .opencode/ is named" {
  local t; t=$(tree) || false
  plant "$t/.opencode/commands/planted.md" || false
  check "$t"
  ran || false
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  [ "$(count '^\[dirty\] \.opencode/commands/planted\.md ')" -eq 1 ] && [ "$(count ' rendered directories, 1 present, 1 files, 1 dirty$')" -eq 1 ] || { echo "$output"; false; }
}

@test "distribute-dirty: a hand-placed file in the skills bundle is named" {
  local t; t=$(tree) || false
  plant "$t/.agents/skills/arc-planted/SKILL.md" || false
  check "$t"
  ran || false
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  [ "$(count '^\[dirty\] \.agents/skills/arc-planted/SKILL\.md ')" -eq 1 ] && [ "$(count ' rendered directories, 1 present, 1 files, 1 dirty$')" -eq 1 ] || { echo "$output"; false; }
}

@test "distribute-dirty: OpenCode's own first-run files are seen and excluded by name" {
  local t; t=$(tree) || false
  plant "$t/.opencode/package.json" || false
  plant "$t/.opencode/node_modules/x/index.js" || false
  mkdir -p "$t/.opencode/node_modules/.bin"
  ln -s ../x/index.js "$t/.opencode/node_modules/.bin/x" 2>/dev/null || plant "$t/.opencode/node_modules/.bin/x" || false
  check "$t"
  ran || false
  [ "$status" -eq 0 ] || { echo "status $status: $output"; false; }
  [ "$(count ' rendered directories, 1 present, 1 files, 0 dirty$')" -eq 1 ] || { echo "$output"; false; }
  plant "$t/.opencode/stray.md" || false
  check "$t"
  ran || false
  [ "$status" -eq 1 ] && [ "$(count '^\[dirty\] \.opencode/stray\.md ')" -eq 1 ] && [ "$(count ' 1 present, 2 files, 1 dirty$')" -eq 1 ] || { echo "control: $output"; false; }
}

@test "distribute-dirty: a symlink is listed, not followed" {
  local t; t=$(tree) || false
  mkdir -p "$t/.opencode" "$BATS_TEST_TMPDIR/elsewhere"
  plant "$BATS_TEST_TMPDIR/elsewhere/a.md" || false
  plant "$BATS_TEST_TMPDIR/elsewhere/b.md" || false
  if ! ln -s "$BATS_TEST_TMPDIR/elsewhere" "$t/.opencode/linked" 2>/dev/null || [ ! -L "$t/.opencode/linked" ]; then
    # Windows without symlink rights copies instead of linking; the copy is two plain files, both dirty.
    check "$t"
    ran || false
    [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
    [ "$(count '^\[dirty\] \.opencode/linked/a\.md ')" -eq 1 ] && [ "$(count '^\[dirty\] \.opencode/linked/b\.md ')" -eq 1 ] || { echo "$output"; false; }
    [ "$(count ' 2 dirty$')" -eq 1 ] || { echo "$output"; false; }
    return 0
  fi
  check "$t"
  ran || false
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  [ "$(count '^\[dirty\] \.opencode/linked ')" -eq 1 ] && [ "$(count ' 1 dirty$')" -eq 1 ] || { echo "$output"; false; }
}

@test "distribute-dirty: no rendered directory is ignored by git" {
  run --separate-stderr node "$ARC_ROOT/tests/distribute/dirty-probe.mjs" "$(native "$ARC_ROOT")"
  [ "$status" -eq 0 ] && printf '%s\n' "$output" | tr -d '\r' | grep -qx 'RAN dirty-probe' || { echo "probe: $output $stderr"; false; }
  local d rc n=0
  for d in $(printf '%s\n' "$output" | tr -d '\r' | sed -n 's/^dir //p'); do
    rc=0
    GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 git -C "$ARC_ROOT" check-ignore -q --no-index "${d}x/probe.md" || rc=$?
    case "$rc" in
      0) echo "$d is ignored"; false ;;
      1) n=$((n + 1)) ;;
      *) echo "COULD NOT SCAN: check-ignore exit $rc on $d"; false ;;
    esac
  done
  [ "$n" -ge 3 ] || { echo "checked only $n directories"; false; }
}

@test "distribute-dirty: a linked parent directory is listed as dirty, never scanned as empty" {
  local t; t=$(tree) || false
  mkdir -p "$BATS_TEST_TMPDIR/away/skills/arc-x"
  plant "$BATS_TEST_TMPDIR/away/skills/arc-x/SKILL.md" || false
  if ! ln -s "$BATS_TEST_TMPDIR/away" "$t/.agents" 2>/dev/null || [ ! -L "$t/.agents" ]; then
    # No symlink rights: a plain file where the .agents directory belongs is the same shape, a parent that is not a directory.
    rm -rf "$t/.agents"; plant "$t/.agents" || false
  fi
  check "$t"
  ran || false
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  [ "$(count '^\[dirty\] \.agents ')" -eq 1 ] && [ "$(count ' 1 dirty$')" -eq 1 ] || { echo "$output"; false; }
}

@test "distribute-dirty: an empty path segment in a rendered entry is refused, not scanned as nothing" {
  local t; t=$(tree) || false
  awk '{ if ($0 ~ /^[[:space:]]+- \.opencode\/$/) print "      - .open//code/"; else print }' "$t/engine/harnesses.yaml" > "$t/h" && mv "$t/h" "$t/engine/harnesses.yaml"
  grep -qF -- '- .open//code/' "$t/engine/harnesses.yaml" || { echo "the mutant changed nothing"; false; }
  check "$t"
  ran || false
  [ "$status" -eq 2 ] || { echo "status $status: $output"; false; }
  [ "$(count '^dirty-scan: COULD NOT SCAN — opencode names a rendered directory ".open//code/"')" -eq 1 ] || { echo "$output"; false; }
}

@test "distribute-dirty: the arc repo without its matrix is COULD NOT SCAN, a consumer root is a named skip" {
  local t; t=$(tree) || false
  rm "$t/engine/harnesses.yaml"
  plant "$t/.codex/planted.toml" || false
  check "$t"
  ran || false
  [ "$status" -eq 0 ] || { echo "consumer root: status $status: $output"; false; }
  [ "$(count '^dirty-scan: skipped — no engine/harnesses\.yaml under the root$')" -eq 1 ] || { echo "$output"; false; }
  mkdir -p "$t/products/engine" && printf '{}\n' > "$t/products/engine/manifest.json"
  check "$t"
  ran || false
  [ "$status" -eq 2 ] || { echo "arc root: status $status: $output"; false; }
  [ "$(count '^dirty-scan: COULD NOT SCAN — engine/harnesses\.yaml is missing from the arc repo$')" -eq 1 ] || { echo "$output"; false; }
}

@test "distribute-dirty: a rendered field that is not a list is COULD NOT SCAN, never an empty list" {
  local t; t=$(tree) || false
  awk '/^  - id: codex$/{c=1} /^  - id: opencode$/{c=0} { if (c && $0 ~ /^    rendered:$/) { print "    rendered: .codex/"; skip=1; next } if (skip && $0 ~ /^      - /) next; skip=0; print }' "$t/engine/harnesses.yaml" > "$t/h" && mv "$t/h" "$t/engine/harnesses.yaml"
  grep -qx '    rendered: .codex/' "$t/engine/harnesses.yaml" || { echo "the mutant changed nothing"; false; }
  plant "$t/.codex/planted.toml" || false
  check "$t"
  ran || false
  [ "$status" -eq 2 ] || { echo "status $status: $output"; false; }
  [ "$(count '^dirty-scan: COULD NOT SCAN — codex\.rendered is not a list$')" -eq 1 ] || { echo "$output"; false; }
}
