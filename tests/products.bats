#!/usr/bin/env bats
# Phase 00 -- product manifests: resolver (arc-products.mjs) + linter (product-lint.mjs).
bats_require_minimum_version 1.5.0
load 'test_helper'

FIX="$ARC_ROOT/tests/fixtures/products"
RESOLVE="$ARC_ROOT/.claude/scripts/arc-products.mjs"
LINT="$ARC_ROOT/.claude/scripts/product-lint.mjs"

# ---------- resolver: plan emission ----------

@test "resolver: first line is the PROTO 1 header" {
  run node "$RESOLVE" --products council --root "$FIX/good"
  [ "$status" -eq 0 ]
  [ "${lines[0]}" = "$(printf 'PROTO\t1')" ]
}

@test "resolver: emits a COPY line for the requested product's command" {
  run node "$RESOLVE" --products council --root "$FIX/good"
  [ "$status" -eq 0 ]
  [[ "$output" == *"$(printf 'COPY\t.claude/commands/arc-council.md\t.claude/commands/arc-council.md')"* ]]
}

@test "resolver: emits a COPY line for a files[] catch-all entry" {
  run node "$RESOLVE" --products core --root "$FIX/good"
  [ "$status" -eq 0 ]
  [[ "$output" == *"$(printf 'COPY\t.claude/rules/example.md\t.claude/rules/example.md')"* ]]
}

@test "resolver: core is always included implicitly (even when only council asked)" {
  run node "$RESOLVE" --products council --root "$FIX/good"
  [ "$status" -eq 0 ]
  # arc-gates.sh belongs to core, not council -- it must still appear
  [[ "$output" == *".claude/scripts/arc-gates.sh"* ]]
}

@test "resolver: emits ENVBLOCK/skeleton MKDIR for council's skeleton dir" {
  run node "$RESOLVE" --products council --root "$FIX/good"
  [ "$status" -eq 0 ]
  [[ "$output" == *"$(printf 'MKDIR\tdocs/council/sessions/.juror')"* ]]
}

@test "resolver: --list prints product names one per line, exit 0" {
  run node "$RESOLVE" --list --root "$FIX/good"
  [ "$status" -eq 0 ]
  [[ "$output" == *"council"* ]]
  [[ "$output" == *"core"* ]]
}

@test "resolver: unknown product name exits 2 and prints the valid list" {
  run node "$RESOLVE" --products nosuch --root "$FIX/good"
  [ "$status" -eq 2 ]
  [[ "$output" == *"council"* ]]
}

# ---------- product-lint: happy path ----------

@test "lint: valid manifests pass (exit 0)" {
  run node "$LINT" --root "$FIX/good"
  [ "$status" -eq 0 ]
}

# ---------- product-lint: hostile corpus (every case MUST exit 2) ----------

@test "lint: path traversal is rejected" {
  run node "$LINT" --root "$FIX/hostile/traversal"
  [ "$status" -eq 2 ]
  [[ "$output" == *"traversal"* ]]
}

@test "lint: duplicate/mismatched product name is rejected" {
  run node "$LINT" --root "$FIX/hostile/dup-name"
  [ "$status" -eq 2 ]
}

@test "lint: a file mapped by two products is rejected" {
  run node "$LINT" --root "$FIX/hostile/double-map"
  [ "$status" -eq 2 ]
  [[ "$output" == *"shared.sh"* ]]
}

@test "lint: BOM/CRLF manifest bytes are rejected" {
  run node "$LINT" --root "$FIX/hostile/crlf-bom"
  [ "$status" -eq 2 ]
}

@test "lint: case-colliding path entries are rejected" {
  run node "$LINT" --root "$FIX/hostile/case-collide-json"
  [ "$status" -eq 2 ]
  [[ "$output" == *"case"* ]]
}

@test "lint: a control char (TAB) in a path is rejected (real protocol break)" {
  run node "$LINT" --root "$FIX/hostile/control-char-path"
  [ "$status" -eq 2 ]
}

@test "lint: an empty required field is rejected" {
  run node "$LINT" --root "$FIX/hostile/empty-field"
  [ "$status" -eq 2 ]
  [[ "$output" == *"empty"* ]]
}

# ---------- product-lint: spaces in paths are LEGAL (TAB protocol, ADR-0015) ----------

@test "lint: a space in a path is accepted (TAB delimiter transports it safely)" {
  run node "$LINT" --root "$FIX/good-space"
  [ "$status" -eq 0 ]
}
