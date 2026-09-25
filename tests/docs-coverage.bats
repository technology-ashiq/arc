#!/usr/bin/env bats
# docs Phase 01 -- the coverage gate, built and proven before any renderer (REQ-02, REQ-03,
# ADR-1503 DOC-C).
#
# wiki-coverage fails, naming it, on an entity with no page AND on a page (or narrative) with
# no entity. These tests drive it end to end against scratch arc trees whose pages are written
# by hand -- the renderer does not exist yet, on purpose -- and then attack the TEST as well as
# the rule: a copy of the gate with its reverse direction cut, and a copy that always exits 0,
# must each let a mutant through that the real gate stops.
#
# Every test asserts that the thing it checks RAN before asserting what it printed.
bats_require_minimum_version 1.5.0
load 'test_helper'

# a scratch arc tree (one of every entity) with one hand-written page per entity; prints its root
covered_tree() {
  local d="$BATS_TEST_TMPDIR/tree-$1"
  node "$ARC_ROOT/tests/docs/fixture-tree.mjs" "$ARC_ROOT" "$d" >/dev/null || return 1
  local out
  out=$(node "$ARC_ROOT/tests/docs/write-pages.mjs" "$d" "$d/docs/wiki") || return 1
  [[ "$out" == "write-pages: wrote "[1-9]* ]] || return 1
  printf '%s' "$d"
}
GATE() { printf '%s' "$1/.claude/scripts/docs/wiki-coverage.mjs"; }

@test "docs-coverage: the mutant self-test runs every arm and fails closed on each" {
  run node "$ARC_ROOT/.claude/scripts/docs/wiki-coverage.mjs" --mutant-selftest
  [[ "$output" == *"mutant-selftest: ran 6 of 6"* ]] || { echo "the self-test did not run all 6 arms: $output"; false; }
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  for arm in M0 M1 M2 M3 M4 M5; do
    printf '%s\n' "$output" | grep -Eq "^$arm .*: PASS \(exit [0-9]\)$" || { echo "arm $arm's own line is not PASS: $output"; false; }
  done
  if [[ "$output" == *"FAILED-ARM"* ]]; then echo "an arm failed: $output"; false; fi
  # The expected failures are LABELLED expected, so the self-test's own output never reads as a failure.
  [[ "$output" == *"EXPECTED-FAIL"* ]] || { echo "no labelled expected failure: $output"; false; }
  if [[ "$output" == *$'\nFAIL '* ]]; then echo "an unlabelled FAIL line: $output"; false; fi
}

@test "docs-coverage: a fully paged tree is covered, with counts derived from the tree" {
  local t; t=$(covered_tree clean) || { echo "fixture failed"; false; }
  run node "$(GATE "$t")" --root "$t"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"wiki-coverage: 8 entities, 8 pages, 0 narratives -- all covered"* ]] || { echo "summary: $output"; false; }
  [[ "$output" == *"narrative debt: 8 of 8 entities have no narrative"* ]] || { echo "debt line: $output"; false; }
}

@test "docs-coverage: REQ-02 -- an unknown product AND an unknown lane with no pages FAIL naming BOTH" {
  local t; t=$(covered_tree m1) || { echo "fixture failed"; false; }
  mkdir -p "$t/products/zeta" "$t/initiatives/zeta-lane"
  printf '{"name":"zeta","version":"0.0.1"}\n' > "$t/products/zeta/manifest.json"
  printf 'status: LIVE\n' > "$t/initiatives/zeta-lane/PROGRESS.md"
  run node "$(GATE "$t")" --root "$t"
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  [[ "$output" == *"FAIL [entity-no-page] product zeta"* ]] || { echo "product not named: $output"; false; }
  [[ "$output" == *"FAIL [entity-no-page] lane zeta-lane"* ]] || { echo "lane not named: $output"; false; }
  # the fix is on the first line, for the lane whose PR this is (the cross-lane blast radius rule)
  [[ "${lines[0]}" == *"node .claude/scripts/docs/wiki-build.mjs"* ]] || { echo "first line does not name the fix: ${lines[0]}"; false; }
}

@test "docs-coverage: REQ-03 -- a page whose product is gone FAILs naming the orphan page" {
  local t; t=$(covered_tree m2) || { echo "fixture failed"; false; }
  mkdir -p "$t/docs/wiki/products"
  printf '# ghost\n' > "$t/docs/wiki/products/ghost.md"
  run node "$(GATE "$t")" --root "$t"
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  [[ "$output" == *"FAIL [page-no-entity] docs/wiki/products/ghost.md"* ]] || { echo "orphan not named: $output"; false; }
}

@test "docs-coverage: REQ-03 -- a narrative with no entity FAILs naming it" {
  local t; t=$(covered_tree m3) || { echo "fixture failed"; false; }
  mkdir -p "$t/docs/wiki/_narrative/lanes"
  printf 'prose about a lane that is gone\n' > "$t/docs/wiki/_narrative/lanes/gone.md"
  run node "$(GATE "$t")" --root "$t"
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  [[ "$output" == *"FAIL [narrative-no-entity] docs/wiki/_narrative/lanes/gone.md"* ]] || { echo "orphan narrative not named: $output"; false; }
}

@test "docs-coverage: a type directory or a stray page the wiki does not define FAILs naming it" {
  local t; t=$(covered_tree stray) || { echo "fixture failed"; false; }
  mkdir -p "$t/docs/wiki/widgets" "$t/docs/wiki/_narrative/widgets"
  printf '# w\n' > "$t/docs/wiki/widgets/w.md"
  printf '# notes\n' > "$t/docs/wiki/notes.md"
  run node "$(GATE "$t")" --root "$t"
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  [[ "$output" == *"FAIL [page-no-entity] docs/wiki/widgets/"* ]] || { echo "stray type dir not named: $output"; false; }
  [[ "$output" == *"FAIL [page-no-entity] docs/wiki/notes.md"* ]] || { echo "stray root page not named: $output"; false; }
  [[ "$output" == *"FAIL [narrative-no-entity] docs/wiki/_narrative/widgets/"* ]] || { echo "stray narrative dir not named: $output"; false; }
}

@test "docs-coverage: a tree whose inventories are EMPTY is never 'covered'" {
  local t; t=$(covered_tree empty) || { echo "fixture failed"; false; }
  # Empty the inventories but keep their directories, so the tree still EXTRACTS -- the gate must
  # then say "empty", not merely fail to read.
  for d in products initiatives processes .claude/commands .claude/agents .claude/rules; do
    rm -r "${t:?}/$d" && mkdir -p "$t/$d"
  done
  run node "$(GATE "$t")" --root "$t"
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  for k in products lanes processes commands agents rules; do
    [[ "$output" == *"FAIL [empty-inventory] $k"* ]] || { echo "empty $k not named: $output"; false; }
  done
  if [[ "$output" == *"all covered"* ]]; then echo "an empty tree printed covered: $output"; false; fi
}

@test "docs-coverage: attacking the TEST -- a gate with its reverse direction cut lets the orphan through" {
  local t; t=$(covered_tree gm1) || { echo "fixture failed"; false; }
  printf '# ghost\n' > "$t/docs/wiki/products/ghost.md"
  # the real gate stops it...
  run node "$(GATE "$t")" --root "$t"
  [ "$status" -eq 1 ] || { echo "the real gate missed the orphan: $output"; false; }
  # ...and a copy with reverseFindings() returning nothing does not -- so REQ-03's test decides.
  node -e '
    const fs = require("fs"); const p = process.argv[1]; let s = fs.readFileSync(p, "utf8");
    const a = "export function reverseFindings(";
    if (s.split(a).length !== 2) { console.error("marker missing"); process.exit(3); }
    fs.writeFileSync(p, s.replace(a, "export function reverseFindings() { return []; }\nfunction __cut("));
  ' "$(GATE "$t")"
  run node "$(GATE "$t")" --root "$t"
  [ "$status" -eq 0 ] || { echo "the cut gate still failed (status $status) -- the mutant did not cut anything: $output"; false; }
}

@test "docs-coverage: attacking the TEST -- a gate that always exits 0 fails its own self-test" {
  local t; t=$(covered_tree gm2) || { echo "fixture failed"; false; }
  node -e '
    const fs = require("fs"); const p = process.argv[1]; let s = fs.readFileSync(p, "utf8");
    const a = "export function coverageFindings(";
    if (s.split(a).length !== 2) { console.error("marker missing"); process.exit(3); }
    fs.writeFileSync(p, s.replace(a, "export function coverageFindings() { return []; }\nfunction __cut("));
  ' "$(GATE "$t")"
  run node "$(GATE "$t")" --mutant-selftest --root "$t"
  [[ "$output" == *"mutant-selftest: ran 6 of 6"* ]] || { echo "the self-test did not run: $output"; false; }
  [ "$status" -eq 1 ] || { echo "status $status (not the self-test's own verdict): $output"; false; }
  for arm in M1 M2 M3 M4 M5; do
    printf '%s\n' "$output" | grep -Eq "^$arm .*: FAILED-ARM" || { echo "arm $arm did not catch the mutant gate: $output"; false; }
  done
  printf '%s\n' "$output" | grep -Eq "^M0 .*: PASS" || { echo "M0 should still pass: $output"; false; }
}

@test "docs-coverage: the CLI refuses unknown flags, missing values and a non-arc root with exit 2" {
  run node "$ARC_ROOT/.claude/scripts/docs/wiki-coverage.mjs" --selftest
  [ "$status" -eq 2 ] || { echo "unknown flag: status $status: $output"; false; }
  run node "$ARC_ROOT/.claude/scripts/docs/wiki-coverage.mjs" --root
  [ "$status" -eq 2 ] || { echo "--root with no value: status $status: $output"; false; }
  run node "$ARC_ROOT/.claude/scripts/docs/wiki-coverage.mjs" --root --pages
  [ "$status" -eq 2 ] || { echo "--root swallowing a flag: status $status: $output"; false; }
  mkdir -p "$BATS_TEST_TMPDIR/notarc"
  run node "$ARC_ROOT/.claude/scripts/docs/wiki-coverage.mjs" --root "$BATS_TEST_TMPDIR/notarc"
  [ "$status" -eq 2 ] || { echo "non-arc root: status $status: $output"; false; }
}

@test "docs-coverage: page directories named like Object keys are names, not lookups" {
  local t; t=$(covered_tree proto) || { echo "fixture failed"; false; }
  for d in constructor __proto__ toString; do
    mkdir -p "$t/docs/wiki/$d" "$t/docs/wiki/_narrative/$d"
    printf '# x\n' > "$t/docs/wiki/$d/x.md"
  done
  run node "$(GATE "$t")" --root "$t"
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  for d in constructor __proto__ toString; do
    [[ "$output" == *"FAIL [page-no-entity] docs/wiki/$d/"* ]] || { echo "$d not named: $output"; false; }
    [[ "$output" == *"FAIL [narrative-no-entity] docs/wiki/_narrative/$d/"* ]] || { echo "narrative $d not named: $output"; false; }
  done
}

@test "docs-coverage: two ids one case apart are a collision on every OS" {
  local t; t=$(covered_tree collide) || { echo "fixture failed"; false; }
  printf '  - name: Alpha-gate\n    check: true\n    mode: warn\n    tier: ci\n    runtime: native\n    evidence: none\n' >> "$t/arc.gates.yaml"
  run node "$(GATE "$t")" --root "$t"
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  [[ "$output" == *"FAIL [id-collision] gates: Alpha-gate, alpha-gate"* ]] || { echo "collision not named: $output"; false; }
}

@test "docs-coverage: --pages outside the tree, absolute, or with .. is refused with exit 2" {
  for bad in ../x /tmp/x "C:/x" "docs/../docs/wiki" "."; do
    run node "$ARC_ROOT/.claude/scripts/docs/wiki-coverage.mjs" --pages "$bad"
    [ "$status" -eq 2 ] || { echo "--pages $bad: status $status: $output"; false; }
  done
}

@test "docs-coverage: a symlinked page directory is refused, never counted" {
  case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) skip "symlinks need privileges on the Windows runner";; esac
  local t; t=$(covered_tree link) || { echo "fixture failed"; false; }
  mv "$t/docs/wiki/rules" "$BATS_TEST_TMPDIR/rules-elsewhere"
  ln -s "$BATS_TEST_TMPDIR/rules-elsewhere" "$t/docs/wiki/rules"
  run node "$(GATE "$t")" --root "$t"
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  [[ "$output" == *"FAIL [page-no-entity] docs/wiki/rules/ -- a symlink"* ]] || { echo "link not named: $output"; false; }
  [[ "$output" == *"FAIL [entity-no-page] rule alpha"* ]] || { echo "the linked page was counted: $output"; false; }
}

@test "docs-coverage: this suite registers exactly the tests it declares" {
  [ "${#BATS_TEST_NAMES[@]}" -eq 15 ] || { echo "registered ${#BATS_TEST_NAMES[@]}, declared 15"; false; }
}
