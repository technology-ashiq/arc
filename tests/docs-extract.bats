#!/usr/bin/env bats
# docs Phase 00 -- the extractor (REQ-09, ADR-1501 DOC-A, pre-mortem 5).
#
# wiki-build reads the tree ONLY through face-coverage.mjs's treeWorld. These tests prove it
# three ways: a recursive scan for any directory walker under .claude/scripts/docs/ (with a
# mutant per spelling that must turn it red), count parity against counts this file derives in
# plain shell, and the in-process probe that breaks each reader and grows an inventory.
#
# Every test asserts that the thing it checks RAN before asserting what it printed
# (.claude/rules/testing.md, the vacuous pass). A negated command is only an assertion as the
# LAST line of a bats test, so every "must not" below is written as `if ...; then false; fi`.
# Paths go in as argv, never inside program text.
bats_require_minimum_version 1.5.0
load 'test_helper'

WB() { printf '%s' "$ARC_ROOT/.claude/scripts/docs/wiki-build.mjs"; }
SCAN() { printf '%s' "$ARC_ROOT/tests/docs/no-walker.mjs"; }

# a scratch arc tree with one of every entity; prints its path
fixture() {
  local d="$BATS_TEST_TMPDIR/tree-$1"
  node "$ARC_ROOT/tests/docs/fixture-tree.mjs" "$ARC_ROOT" "$d" >/dev/null || return 1
  printf '%s' "$d"
}

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
  [ "$prods" -gt 0 ] && [ "$lanes" -gt 0 ] && [ "$bands" -gt 0 ] || { echo "shell derivation found nothing: $prods $lanes $bands"; false; }
  run node -e 'const w=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); const e=w.entities; console.log([e.products,e.lanes,e.processes,e.commands,e.agents,e.rules,e.adrBands,e.gates].map(a=>a.length).join(" "))' "$out"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local want="$prods $lanes $procs $cmds $agents $rules $bands"
  [ "${output% *}" = "$want" ] || { echo "wiki.json counts '${output% *}' != shell-derived '$want'"; false; }
  # gates are read through the canonical YAML parser only; a floor kills the reader-returns-
  # nothing mutant without a second YAML parser in shell. The probe checks exact parity.
  [ "${output##* }" -ge 1 ] || { echo "zero gates: $output"; false; }
}

@test "docs-extract: the in-process probe -- parity with treeWorld, every fail-closed branch, unmapped key" {
  run node "$ARC_ROOT/tests/docs/extract-probe.mjs" "$ARC_ROOT"
  [[ "$output" == *"extract-probe: ran 10 of 10"* ]] || { echo "probe did not run all 10 checks: $output"; false; }
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  if [[ "$output" == *"FAIL "* ]]; then echo "$output"; false; fi
}

@test "docs-extract: two runs are byte-identical, LF-only, and carry no path of this checkout" {
  run node "$(WB)" --json --root "$ARC_ROOT" --out "$BATS_TEST_TMPDIR/a.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run node "$(WB)" --json --root "$ARC_ROOT" --out "$BATS_TEST_TMPDIR/b.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ -s "$BATS_TEST_TMPDIR/a.json" ] || { echo "first run wrote nothing"; false; }
  cmp "$BATS_TEST_TMPDIR/a.json" "$BATS_TEST_TMPDIR/b.json"
  run node "$ARC_ROOT/tests/docs/json-hygiene.mjs" "$BATS_TEST_TMPDIR/a.json" "$ARC_ROOT"
  [[ "$output" == "json-hygiene: checked "* ]] || { echo "hygiene check did not run: $output"; false; }
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "docs-extract: the hygiene check itself goes red on a CR and on a checkout path" {
  printf '{"a":"x"}\r\n' > "$BATS_TEST_TMPDIR/cr.json"
  run node "$ARC_ROOT/tests/docs/json-hygiene.mjs" "$BATS_TEST_TMPDIR/cr.json" "$ARC_ROOT"
  [ "$status" -eq 1 ] || { echo "a CR survived: $output"; false; }
  node -e 'require("fs").writeFileSync(process.argv[1], JSON.stringify({p: process.argv[2]}) + "\n")' "$BATS_TEST_TMPDIR/path.json" "$ARC_ROOT"
  run node "$ARC_ROOT/tests/docs/json-hygiene.mjs" "$BATS_TEST_TMPDIR/path.json" "$ARC_ROOT"
  [ "$status" -eq 1 ] || { echo "a checkout path survived: $output"; false; }
}

@test "docs-extract: DOC-A -- nothing under .claude/scripts/docs/ walks a directory (every file scanned)" {
  local n
  n=$(git -C "$ARC_ROOT" ls-files .claude/scripts/docs | wc -l | tr -d " ")
  [ "$n" -ge 1 ] || { echo "git lists no docs scripts"; false; }
  run node "$(SCAN)" "$ARC_ROOT/.claude/scripts/docs" --expect "$n"
  [[ "$output" == "no-walker: scanned $n file(s)"* ]] || { echo "the scan did not cover all $n tracked files: $output"; false; }
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

# One mutant per spelling. Each copies the real wiki-build into a scratch dir, adds ONE walker,
# and must turn the scan red naming it.
mutant_scan() {
  local name="$1" rel="$2" body="$3"
  local d="$BATS_TEST_TMPDIR/m-$name"
  mkdir -p "$d/$(dirname "$rel")"
  cp "$(WB)" "$d/wiki-build.mjs"
  printf '%s\n' "$body" >> "$d/$rel"
  run node "$(SCAN)" "$d"
  [[ "$output" == "no-walker: scanned "[1-9]* ]] || { echo "[$name] scan did not run: $output"; return 1; }
  [ "$status" -eq 1 ] || { echo "[$name] mutant survived (status $status): $output"; return 1; }
  [[ "$output" == *"WALKER $rel:"* ]] || { echo "[$name] walker not named at $rel: $output"; return 1; }
}

@test "docs-extract: DOC-A mutants -- every walker spelling turns the scan RED, naming the file" {
  mutant_scan direct   wiki-build.mjs   'import { readdirSync as __m } from "node:fs"; export const __x = () => __m(".");'
  mutant_scan computed wiki-build.mjs   'import * as fs from "node:fs"; export const __x = () => fs["read" + "dirSync"](".");'
  mutant_scan alias    wiki-build.mjs   'import * as nodeFs from "node:fs"; export const __x = () => nodeFs["read" + "dirSync"](".");'
  mutant_scan require  wiki-build.mjs   'export const __x = () => require("fs")["read" + "dirSync"](".");'
  mutant_scan subdir   lib/walk.mjs     'import { readdirSync } from "node:fs"; export const all = (d) => readdirSync(d);'
  mutant_scan noext    tool             'const { readdirSync } = require("fs"); readdirSync(".");'
  mutant_scan spawn    wiki-build.mjs   'import { execFileSync } from "node:child_process"; export const __x = () => execFileSync("git", ["ls-files"]);'
  mutant_scan facecov  wiki-build.mjs   'export const __x = (fc, repo) => fc.dirNames(repo);'
  mutant_scan launder  wiki-build.mjs   'export const __x = (fc, repo, join) => fc.dirNames(repo); // fc.mdStems(join(repo, "docs", "adr"))'
  mutant_scan template wiki-build.mjs   'import { readdirSync } from "node:fs"; export const __x = (d) => `${readdirSync(d)}`;'
}

@test "docs-extract: the CLI refuses unknown flags, missing values and the --flag=value form with exit 2" {
  run node "$(WB)" --jsn
  [ "$status" -eq 2 ] || { echo "unknown flag: status $status: $output"; false; }
  [[ "$output" == *"--jsn"* ]] || { echo "unknown flag not named: $output"; false; }
  run node "$(WB)" --json --out
  [ "$status" -eq 2 ] || { echo "--out with no value: status $status: $output"; false; }
  run node "$(WB)" --json --out --root
  [ "$status" -eq 2 ] || { echo "--out swallowing a flag: status $status: $output"; false; }
  run node "$(WB)" --json=yes
  [ "$status" -eq 2 ] || { echo "--flag=value form: status $status: $output"; false; }
  run node "$(WB)" --json --json
  [ "$status" -eq 2 ] || { echo "a repeated flag: status $status: $output"; false; }
  run node "$(WB)"
  [ "$status" -eq 2 ] || { echo "no --json: status $status: $output"; false; }
}

@test "docs-extract: the writer refuses a directory, a path inside the tree, and a non-arc root" {
  mkdir -p "$BATS_TEST_TMPDIR/adir"
  run node "$(WB)" --json --root "$ARC_ROOT" --out "$BATS_TEST_TMPDIR/adir"
  [ "$status" -eq 2 ] || { echo "--out a directory: status $status: $output"; false; }
  local t; t=$(fixture intree) || { echo "fixture failed"; false; }
  local before; before=$(cksum < "$t/products/alpha/manifest.json")
  run node "$t/.claude/scripts/docs/wiki-build.mjs" --json --root "$t" --out "$t/products/alpha/manifest.json"
  [ "$status" -eq 2 ] || { echo "--out onto a source file: status $status: $output"; false; }
  [[ "$output" == *"inside the tree"* ]] || { echo "refusal not named: $output"; false; }
  [ "$(cksum < "$t/products/alpha/manifest.json")" = "$before" ] || { echo "the source file was overwritten"; false; }
  mkdir -p "$BATS_TEST_TMPDIR/notarc"
  run node "$(WB)" --json --root "$BATS_TEST_TMPDIR/notarc"
  [ "$status" -eq 2 ] || { echo "non-arc root: status $status: $output"; false; }
  [[ "$output" == *"not an arc tree"* ]] || { echo "non-arc root not named: $output"; false; }
}

@test "docs-extract: a face-coverage without treeWorld is exit 2 naming the export" {
  local t; t=$(fixture noexport) || { echo "fixture failed"; false; }
  printf 'export const nothing = 1;\n' > "$t/.claude/scripts/core/face-coverage.mjs"
  run node "$t/.claude/scripts/docs/wiki-build.mjs" --json --root "$t"
  [ "$status" -eq 2 ] || { echo "status $status: $output"; false; }
  [[ "$output" == *"treeWorld"* ]] || { echo "the missing export was not named: $output"; false; }
}

@test "docs-extract: the fixture tree extracts its declared facts exactly" {
  local t; t=$(fixture facts) || { echo "fixture failed"; false; }
  run node "$t/.claude/scripts/docs/wiki-build.mjs" --json --root "$t" --out "$BATS_TEST_TMPDIR/f.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run node -e '
    const e = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).entities;
    const p = e.products[0], l = e.lanes[0], a = e.adrBands[0].facts.adrs[0], g = e.gates[0], c = e.commands[0], ag = e.agents[0], r = e.rules[0], pr = e.processes[0];
    console.log([p.id, p.facts.version, p.facts.requires.join("+"), l.facts.status, l.facts.phase, l.facts.hasPlan, a.number, a.title, a.product, g.id, g.facts.mode, c.facts.argumentHint, ag.facts.model, ag.facts.tools.join("+"), r.facts.title, pr.facts.permissions, pr.facts.inputs.join("+")].join("|"));
  ' "$BATS_TEST_TMPDIR/f.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "alpha|1.2.3|core|LIVE|00|true|0001|The first decision|alpha|alpha-gate|warn|<target>|sonnet|Read+Grep|Alpha rules|read-only|goal" ] || { echo "facts: $output"; false; }
}

@test "docs-extract: a CRLF + BOM checkout extracts the same bytes as an LF one" {
  local t; t=$(fixture eol) || { echo "fixture failed"; false; }
  run node "$t/.claude/scripts/docs/wiki-build.mjs" --json --root "$t" --out "$BATS_TEST_TMPDIR/lf.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  node -e '
    const fs = require("fs");
    for (const f of process.argv.slice(1)) fs.writeFileSync(f, "﻿" + fs.readFileSync(f, "utf8").replace(/\n/g, "\r\n"));
  ' "$t/products/alpha/manifest.json" "$t/initiatives/alpha/PROGRESS.md" "$t/docs/adr/0001-first-decision.md" "$t/.claude/agents/alpha-helper.md"
  run node "$t/.claude/scripts/docs/wiki-build.mjs" --json --root "$t" --out "$BATS_TEST_TMPDIR/crlf.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  cmp "$BATS_TEST_TMPDIR/lf.json" "$BATS_TEST_TMPDIR/crlf.json"
}

@test "docs-extract: a symlinked entity file is exit 2, never read through" {
  case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) skip "symlinks need privileges on the Windows runner";; esac
  local t; t=$(fixture link) || { echo "fixture failed"; false; }
  printf 'outside\n' > "$BATS_TEST_TMPDIR/outside.md"
  rm "$t/.claude/rules/alpha.md"
  ln -s "$BATS_TEST_TMPDIR/outside.md" "$t/.claude/rules/alpha.md"
  [ -L "$t/.claude/rules/alpha.md" ] || { echo "could not create the symlink"; false; }
  run node "$t/.claude/scripts/docs/wiki-build.mjs" --json --root "$t"
  [ "$status" -eq 2 ] || { echo "status $status: $output"; false; }
  [[ "$output" == *"alpha.md is a symlink"* ]] || { echo "not named: $output"; false; }
}

@test "docs-extract: a file present only under another case is absent on every OS" {
  local t; t=$(fixture case) || { echo "fixture failed"; false; }
  mv "$t/initiatives/alpha/PLAN.md" "$t/initiatives/alpha/plan.tmp" && mv "$t/initiatives/alpha/plan.tmp" "$t/initiatives/alpha/plan.md"
  run node "$t/.claude/scripts/docs/wiki-build.mjs" --json --root "$t" --out "$BATS_TEST_TMPDIR/c.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).entities.lanes[0].facts.hasPlan)' "$BATS_TEST_TMPDIR/c.json"
  [ "$output" = "false" ] || { echo "plan.md was read as PLAN.md: hasPlan=$output"; false; }
}

@test "docs-extract: this suite registers exactly the tests it declares" {
  # bats silently drops a @test it cannot register; a suite that IS the proof of DOC-A counts itself.
  [ "${#BATS_TEST_NAMES[@]}" -eq 18 ] || { echo "registered ${#BATS_TEST_NAMES[@]}, declared 18"; false; }
}

@test "docs-extract: --out never overwrites a narrative; inside the tree only docs/wiki/wiki.json is writable" {
  local t; t=$(fixture narr) || { echo "fixture failed"; false; }
  mkdir -p "$t/docs/wiki/_narrative/products"
  printf 'hand-written prose\n' > "$t/docs/wiki/_narrative/products/alpha.md"
  local before; before=$(cksum < "$t/docs/wiki/_narrative/products/alpha.md")
  run node "$t/.claude/scripts/docs/wiki-build.mjs" --json --root "$t" --out "$t/docs/wiki/_narrative/products/alpha.md"
  [ "$status" -eq 2 ] || { echo "status $status: $output"; false; }
  [[ "$output" == *"docs/wiki/wiki.json"* ]] || { echo "refusal did not name the one writable path: $output"; false; }
  [ "$(cksum < "$t/docs/wiki/_narrative/products/alpha.md")" = "$before" ] || { echo "the narrative was overwritten"; false; }
  run node "$t/.claude/scripts/docs/wiki-build.mjs" --json --root "$t" --out "$t/docs/wiki/wiki.json"
  [ "$status" -eq 0 ] || { echo "the sanctioned path was refused: $output"; false; }
  [ -s "$t/docs/wiki/wiki.json" ] || { echo "nothing written at docs/wiki/wiki.json"; false; }
  run ls "$t/docs/wiki"
  if [[ "$output" == *".tmp-"* ]]; then echo "a temp file was left behind: $output"; false; fi
}

@test "docs-extract: an entity file that is a directory is exit 2, not an absent file" {
  local t; t=$(fixture nonfile) || { echo "fixture failed"; false; }
  rm "$t/.claude/agents/alpha-helper.md"
  mkdir -p "$t/.claude/agents/alpha-helper.md.d"
  mkdir -p "$t/products/alpha/manifest.json.tmp" && rm "$t/products/alpha/manifest.json" && mv "$t/products/alpha/manifest.json.tmp" "$t/products/alpha/manifest.json"
  run node "$t/.claude/scripts/docs/wiki-build.mjs" --json --root "$t"
  [ "$status" -eq 2 ] || { echo "status $status: $output"; false; }
  [[ "$output" == *"manifest.json exists but is not a regular file"* ]] || { echo "not named: $output"; false; }
}

@test "docs-extract: a lane reached through a linked directory inside the tree is exit 2" {
  case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) skip "symlinks need privileges on the Windows runner";; esac
  local t; t=$(fixture dirlink) || { echo "fixture failed"; false; }
  ln -s alpha "$t/initiatives/beta"
  [ -L "$t/initiatives/beta" ] || { echo "could not create the link"; false; }
  run node "$t/.claude/scripts/docs/wiki-build.mjs" --json --root "$t"
  [ "$status" -eq 2 ] || { echo "status $status: $output"; false; }
  [[ "$output" == *"initiatives/beta/PROGRESS.md is reached through a linked directory"* ]] || { echo "not named: $output"; false; }
}
