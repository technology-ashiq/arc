# Shared by tests/distribute-compile-{codex,opencode,skills-only}.bats (distribute P03, REQ-04).
#
# Each suite sets T (the target) before loading this. `tree` builds a temp root holding only what the
# source render reads, plus that target's golden, and asserts the fixture is not empty; `check` runs the
# real compiler against it; `ran` asserts the compile line was printed before anything else is judged.

CC() { printf '%s' "$ARC_ROOT/.claude/scripts/engine/arc-compile.mjs"; }
native() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }
count() { printf '%s\n' "$output" | tr -d '\r' | grep -cE "$1" || true; }
G() { printf '%s' "tests/fixtures/distribute/goldens/$T"; }

tree() {
  local t="$BATS_TEST_TMPDIR/tree"
  mkdir -p "$t/engine" "$t/.claude" "$t/$(G)"
  cp "$ARC_ROOT/engine/harnesses.yaml" "$ARC_ROOT/engine/frontmatter-keys.yaml" "$t/engine/"
  cp -R "$ARC_ROOT/.claude/commands" "$ARC_ROOT/.claude/agents" "$ARC_ROOT/.claude/skills" "$t/.claude/"
  cp -R "$ARC_ROOT/$(G)/." "$t/$(G)/"
  [ -s "$t/.claude/commands/arc-commit.md" ] && [ "$(find "$t/$(G)" -type f | wc -l | tr -d ' ')" -gt 0 ] || { echo "tree built an empty fixture"; return 1; }
  printf '%s' "$t"
}

check() { run --separate-stderr node "$(CC)" --check --all --input source --target "$T" --root "$(native "$1")"; }

# The compile line, with the total equal to the golden's own file count, so a render that silently
# produced fewer files cannot read as complete.
ran() {
  local root="$1" n="${2:-}"
  [ -n "$n" ] || n=$(find "$root/$(G)" -type f | wc -l | tr -d ' ')
  printf '%s\n' "$output" | tr -d '\r' | grep -qE "^arc-compile: [0-9]+/$n byte-identical for target \`$T\` \(input source: " || { echo "arc-compile never reached its compile line over $n files: $output $stderr"; return 1; }
}

# The three checks every target suite runs, so they cannot drift apart between the suites.
compile_real_tree_identical() {
  check "$ARC_ROOT"
  ran "$ARC_ROOT" || return 1
  [ "$status" -eq 0 ] || { echo "status $status: $output"; return 1; }
  local n; n=$(find "$ARC_ROOT/$(G)" -type f | wc -l | tr -d ' ')
  [ "$(count "^arc-compile: $n/$n byte-identical ")" -eq 1 ] || { echo "$output"; return 1; }
  [ "$(count '^\[(byte-diff|missing|dirty|lf-only)\] ')" -eq 0 ] || { echo "$output"; return 1; }
}

compile_source_edit_is_byte_diff() {
  local t; t=$(tree) || return 1
  printf '\nA line the golden has never seen.\n' >> "$t/.claude/commands/arc-commit.md"
  check "$t"
  ran "$t" || return 1
  [ "$status" -eq 1 ] || { echo "status $status: $output"; return 1; }
  [ "$(count "^\[byte-diff\] $(G)/$1 ")" -eq 1 ] || { echo "$output"; return 1; }
}

compile_stale_golden_is_dirty() {
  local t n; t=$(tree) || return 1
  n=$(find "$t/$(G)" -type f | wc -l | tr -d ' ')
  mkdir -p "$t/$(G)/.stale" && printf 'stale\n' > "$t/$(G)/.stale/left-behind.md"
  check "$t"
  ran "$t" "$n" || return 1
  [ "$status" -eq 1 ] || { echo "status $status: $output"; return 1; }
  [ "$(count "^\[dirty\] $(G)/\.stale/left-behind\.md — a golden file the render does not produce$")" -eq 1 ] || { echo "$output"; return 1; }
}
