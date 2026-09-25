#!/usr/bin/env bats
# docs Phase 03 -- narrative drift (BLOCK), staleness (WARN) and derived counts (REQ-05, REQ-07;
# ADR-1507 DOC-G).
#
# A hand-written narrative that names an ADR, a script, a driver or a command that does not
# exist fails CI, naming it. A narrative written against facts that have since moved WARNs and
# never blocks -- blocking on prose makes people write none. Every number on every generated page
# is re-derived from wiki.json by --audit-counts.
#
# Every test asserts that the thing it checks RAN before asserting what it printed.
bats_require_minimum_version 1.5.0
load 'test_helper'

DRIFT() { printf '%s' "$1/.claude/scripts/docs/wiki-drift.mjs"; }
STALE() { printf '%s' "$1/.claude/scripts/docs/wiki-stale.mjs"; }
WB() { printf '%s' "$1/.claude/scripts/docs/wiki-build.mjs"; }

rendered_tree() {
  local d="$BATS_TEST_TMPDIR/tree-$1"
  node "$ARC_ROOT/tests/docs/fixture-tree.mjs" "$ARC_ROOT" "$d" >/dev/null || return 1
  node "$(WB "$d")" --root "$d" >/dev/null || return 1
  mkdir -p "$d/docs/wiki/_narrative/products"
  printf '%s' "$d"
}

@test "docs-drift: the drift gate's mutant self-test runs every arm and fails closed" {
  run node "$(DRIFT "$ARC_ROOT")" --mutant-selftest
  [[ "$output" == *"mutant-selftest: ran 4 of 4"* ]] || { echo "did not run every arm: $output"; false; }
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  if [[ "$output" == *"FAILED-ARM"* ]]; then echo "$output"; false; fi
}

@test "docs-drift: REQ-05 -- a narrative citing a gone ADR, a ghost driver and a ghost command FAILs naming all three" {
  local t; t=$(rendered_tree req05) || { echo "fixture failed"; false; }
  printf 'Alpha was decided in ADR-9999 and runs through `drivers/ghost.mjs`, started by `/arc-ghost`.\n' > "$t/docs/wiki/_narrative/products/alpha.md"
  run node "$(DRIFT "$t")" --root "$t"
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  [[ "$output" == *"docs/wiki/_narrative/products/alpha.md:1: ADR-9999"* ]] || { echo "ADR not named: $output"; false; }
  [[ "$output" == *"docs/wiki/_narrative/products/alpha.md:1: drivers/ghost.mjs"* ]] || { echo "driver not named: $output"; false; }
  [[ "$output" == *"docs/wiki/_narrative/products/alpha.md:1: /arc-ghost"* ]] || { echo "command not named: $output"; false; }
}

@test "docs-drift: a narrative citing only things that exist passes, and the count says it was read" {
  local t; t=$(rendered_tree clean) || { echo "fixture failed"; false; }
  printf 'Alpha is ADR-0001, runs `/alpha-go` and is declared in `products/alpha/manifest.json`.\n' > "$t/docs/wiki/_narrative/products/alpha.md"
  run node "$(DRIFT "$t")" --root "$t"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"wiki-drift: 1 narrative(s), 3 reference(s) checked -- none dangling"* ]] || { echo "summary: $output"; false; }
}

@test "docs-drift: the drift gate passes on the real tree and says how much it read" {
  run node "$(DRIFT "$ARC_ROOT")"
  [[ "$output" == "wiki-drift: "*" narrative(s), "*" reference(s) checked"* ]] || { echo "did not run: $output"; false; }
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "docs-drift: stale -- no fingerprint and a moved fact each WARN at exit 0; a matching fingerprint is silent" {
  local t; t=$(rendered_tree stale) || { echo "fixture failed"; false; }
  printf 'Alpha exists for the fixture.\n' > "$t/docs/wiki/_narrative/products/alpha.md"
  run node "$(STALE "$t")" --root "$t"
  [ "$status" -eq 0 ] || { echo "WARN must never block: status $status: $output"; false; }
  [[ "$output" == *"WARN [no-fingerprint] products/alpha"* ]] || { echo "missing fingerprint not warned: $output"; false; }
  local fp; fp=$(node "$(STALE "$t")" --root "$t" --print products/alpha)
  [[ "$fp" == "<!-- facts: "*" -->" ]] || { echo "--print gave: $fp"; false; }
  printf '%s\nAlpha exists for the fixture.\n' "$fp" > "$t/docs/wiki/_narrative/products/alpha.md"
  run node "$(STALE "$t")" --root "$t"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  if [[ "$output" == *"WARN"* ]]; then echo "a matching fingerprint warned: $output"; false; fi
  [[ "$output" == *"wiki-stale: 1 narrative(s) checked, 0 stale"* ]] || { echo "summary: $output"; false; }
  node -e 'const fs=require("fs"),p=process.argv[1];const m=JSON.parse(fs.readFileSync(p,"utf8"));m.version="1.2.4";fs.writeFileSync(p,JSON.stringify(m,null,2)+"\n")' "$t/products/alpha/manifest.json"
  run node "$(STALE "$t")" --root "$t"
  [ "$status" -eq 0 ] || { echo "WARN must never block: status $status: $output"; false; }
  [[ "$output" == *"WARN [stale] products/alpha -- its facts changed since the narrative was written: version"* ]] || { echo "moved fact not named: $output"; false; }
}

@test "docs-drift: REQ-07 -- --audit-counts passes on the real tree" {
  run node "$(WB "$ARC_ROOT")" --audit-counts
  [[ "$output" == "wiki-build: audit-counts "* ]] || { echo "did not run: $output"; false; }
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "docs-drift: REQ-07 mutant -- one count changed on a page FAILs naming the page and the number" {
  local t; t=$(rendered_tree counts) || { echo "fixture failed"; false; }
  node -e '
    const fs = require("fs"), p = process.argv[1]; let s = fs.readFileSync(p, "utf8");
    const a = "| [Products](#products) | 1 | 0 |";
    if (s.split(a).length !== 2) { console.error("anchor missing"); process.exit(3); }
    fs.writeFileSync(p, s.replace(a, "| [Products](#products) | 7 | 0 |"));
  ' "$t/docs/wiki/index.md"
  run node "$(WB "$t")" --root "$t" --audit-counts
  [ "$status" -eq 1 ] || { echo "a changed count passed: status $status: $output"; false; }
  [[ "$output" == *"docs/wiki/index.md"*"7"*"1"* ]] || { echo "page and number not named: $output"; false; }
}

@test "docs-drift: the CLIs refuse unknown flags with exit 2" {
  run node "$(DRIFT "$ARC_ROOT")" --selftest
  [ "$status" -eq 2 ] || { echo "drift: $status $output"; false; }
  run node "$(STALE "$ARC_ROOT")" --print
  [ "$status" -eq 2 ] || { echo "stale --print without a value: $status $output"; false; }
  run node "$(WB "$ARC_ROOT")" --audit-counts --check
  [ "$status" -eq 2 ] || { echo "wiki-build --audit-counts --check: $status $output"; false; }
}

@test "docs-drift: this suite registers exactly the tests it declares" {
  [ "${#BATS_TEST_NAMES[@]}" -eq 9 ] || { echo "registered ${#BATS_TEST_NAMES[@]}, declared 9"; false; }
}
