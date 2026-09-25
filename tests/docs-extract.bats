#!/usr/bin/env bats
# docs Phase 00 -- the extractor (REQ-09, ADR-1501 DOC-A, pre-mortem 5).
#
# wiki-build reads the tree ONLY through face-coverage.mjs's treeWorld. These tests prove it
# three ways: a scan for any directory walker under .claude/scripts/docs/ (with a mutant that
# must turn it red), count parity against counts this file derives in plain shell, and the
# in-process probe that breaks a reader and grows an inventory.
#
# Every test asserts that the thing it checks RAN before asserting what it printed
# (.claude/rules/testing.md, the vacuous pass). Paths go in as argv, never inside program text.
bats_require_minimum_version 1.5.0
load 'test_helper'

WB() { printf '%s' "$ARC_ROOT/.claude/scripts/docs/wiki-build.mjs"; }

@test "docs-extract: wiki-build --json writes one wiki.json over the live tree" {
  local out="$BATS_TEST_TMPDIR/wiki.json"
  run node "$(WB)" --json --root "$ARC_ROOT" --out "$out"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ -s "$out" ] || { echo "no wiki.json written: $output"; false; }
  run node -e 'const w=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); if(w.schema!==1) process.exit(3); console.log(Object.keys(w.entities).join(","))' "$out"
  [ "$status" -eq 0 ] || { echo "schema is not 1: $output"; false; }
  [ "$output" = "products,lanes,processes,adrBands,commands,agents,rules,gates" ] || { echo "entity types/order: $output"; false; }
}

@test "docs-extract: per-type counts equal counts derived in shell from the tree" {
  local out="$BATS_TEST_TMPDIR/wiki.json"
  run node "$(WB)" --json --root "$ARC_ROOT" --out "$out"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local prods lanes procs cmds agents rules bands
  prods=$(ls -d "$ARC_ROOT"/products/*/ 2>/dev/null | wc -l | tr -d " ")
  lanes=$(ls -d "$ARC_ROOT"/initiatives/*/ 2>/dev/null | wc -l | tr -d " ")
  procs=$(ls "$ARC_ROOT"/processes/*.process.yaml 2>/dev/null | wc -l | tr -d " ")
  cmds=$(ls "$ARC_ROOT"/.claude/commands/*.md 2>/dev/null | wc -l | tr -d " ")
  agents=$(ls "$ARC_ROOT"/.claude/agents/*.md 2>/dev/null | wc -l | tr -d " ")
  rules=$(ls "$ARC_ROOT"/.claude/rules/*.md 2>/dev/null | wc -l | tr -d " ")
  bands=$(ls "$ARC_ROOT"/docs/adr/ | grep -E '^[0-9]{4}-.+\.md$' | cut -c1-2 | sort -u | wc -l | tr -d " ")
  run node -e 'const w=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); const e=w.entities; console.log([e.products,e.lanes,e.processes,e.commands,e.agents,e.rules,e.adrBands,e.gates].map(a=>a.length).join(" "))' "$out"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local want="$prods $lanes $procs $cmds $agents $rules $bands"
  [ "${output% *}" = "$want" ] || { echo "wiki.json counts '${output% *}' != shell-derived '$want'"; false; }
  # gates live in arc.gates.yaml and are read through the canonical YAML parser only; a floor
  # here kills the reader-returns-nothing mutant without a second YAML parser in shell.
  [ "${output##* }" -ge 1 ] || { echo "zero gates: $output"; false; }
}

@test "docs-extract: the in-process probe -- parity with treeWorld, unreadable fails closed, unmapped key fails" {
  run node "$ARC_ROOT/tests/docs/extract-probe.mjs" "$ARC_ROOT"
  [[ "$output" == *"extract-probe: ran 7 of 7"* ]] || { echo "probe did not run all 7 checks: $output"; false; }
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" != *"FAIL "* ]] || { echo "$output"; false; }
}

@test "docs-extract: two runs are byte-identical" {
  run node "$(WB)" --json --root "$ARC_ROOT" --out "$BATS_TEST_TMPDIR/a.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run node "$(WB)" --json --root "$ARC_ROOT" --out "$BATS_TEST_TMPDIR/b.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ -s "$BATS_TEST_TMPDIR/a.json" ] || { echo "first run wrote nothing"; false; }
  cmp "$BATS_TEST_TMPDIR/a.json" "$BATS_TEST_TMPDIR/b.json"
  # no CR, no absolute path of this checkout
  ! grep -q $'\r' "$BATS_TEST_TMPDIR/a.json"
  ! grep -qF "$ARC_ROOT" "$BATS_TEST_TMPDIR/a.json"
}

@test "docs-extract: DOC-A -- nothing under .claude/scripts/docs/ walks a directory" {
  run node "$ARC_ROOT/tests/docs/no-walker.mjs" "$ARC_ROOT/.claude/scripts/docs"
  [[ "$output" == "no-walker: scanned "[1-9]* ]] || { echo "the scan did not run over any file: $output"; false; }
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "docs-extract: DOC-A mutant -- one readdirSync in a copy of wiki-build turns the scan RED" {
  local d="$BATS_TEST_TMPDIR/mutant"
  mkdir -p "$d"
  cp "$(WB)" "$d/wiki-build.mjs"
  printf '\nimport { readdirSync as __m } from "node:fs";\nexport const __mutant = () => __m(".");\n' >> "$d/wiki-build.mjs"
  run node "$ARC_ROOT/tests/docs/no-walker.mjs" "$d"
  [[ "$output" == "no-walker: scanned 1 file(s)"* ]] || { echo "mutant scan did not run: $output"; false; }
  [ "$status" -eq 1 ] || { echo "mutant survived (status $status): $output"; false; }
  [[ "$output" == *"WALKER wiki-build.mjs:"*"readdirSync"* ]] || { echo "the walker was not named: $output"; false; }
  # the computed-property spelling is caught too
  cp "$(WB)" "$d/wiki-build.mjs"
  printf '\nimport * as fs from "node:fs";\nexport const __mutant = () => fs["read" + "dirSync"](".");\n' >> "$d/wiki-build.mjs"
  run node "$ARC_ROOT/tests/docs/no-walker.mjs" "$d"
  [ "$status" -eq 1 ] || { echo "computed-property mutant survived: $output"; false; }
}

@test "docs-extract: the CLI refuses unknown flags and missing values with exit 2" {
  run node "$(WB)" --jsn
  [ "$status" -eq 2 ] || { echo "unknown flag: status $status: $output"; false; }
  [[ "$output" == *"--jsn"* ]] || { echo "unknown flag not named: $output"; false; }
  run node "$(WB)" --json --out
  [ "$status" -eq 2 ] || { echo "--out with no value: status $status: $output"; false; }
  run node "$(WB)" --json --out --root
  [ "$status" -eq 2 ] || { echo "--out swallowing a flag: status $status: $output"; false; }
  run node "$(WB)" --json=yes
  [ "$status" -eq 2 ] || { echo "--flag=value form: status $status: $output"; false; }
}
