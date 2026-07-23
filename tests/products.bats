#!/usr/bin/env bats
# Phase 00 -- product manifests: resolver (arc-products.mjs) + linter (product-lint.mjs).
bats_require_minimum_version 1.5.0
load 'test_helper'

FIX="$ARC_ROOT/tests/fixtures/products"
RESOLVE="$ARC_ROOT/.claude/scripts/core/arc-products.mjs"
LINT="$ARC_ROOT/.claude/scripts/core/product-lint.mjs"

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
  # arc-gates.sh belongs to core, not council -- it must still appear.
  # Flat path on purpose: this asserts on the FIXTURE's output, and the fixture is a
  # self-contained mini-repo whose own stub lives at .claude/scripts/. It does not
  # mirror the real repo's Phase-03 layout and must not be rewritten to match it.
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

# ---------- resolver: --status (/arc dashboard backend) ----------

@test "status: reports each product's install state (good fixture)" {
  run node "$RESOLVE" --status --root "$FIX/good"
  [ "$status" -eq 0 ]
  [[ "$output" == *"INSTALLED"* ]]
  [[ "$output" == *"core"* ]]
  [[ "$output" == *"council"* ]]
}

@test "status: degrades gracefully (exit 0) where no products/ dir exists" {
  run node "$RESOLVE" --status --root "$BATS_TEST_TMPDIR"
  [ "$status" -eq 0 ]
  [[ "$output" == *"no product registry"* ]]
}

@test "status: reads INSTALLED from the registry, no products/ dir needed (REQ-05)" {
  mkdir -p "$BATS_TEST_TMPDIR/consumer/.claude"
  printf '{"schema":1,"source":{"commit":"abc1234"},"products":{"core":{"version":"1.0.0","files":[]},"council":{"version":"1.0.0","files":[]}}}' \
    > "$BATS_TEST_TMPDIR/consumer/.claude/arc-registry.json"
  run node "$RESOLVE" --status --root "$BATS_TEST_TMPDIR/consumer"
  [ "$status" -eq 0 ]
  [[ "$output" == *"registry @ abc1234"* ]]                 # registry-sourced, not file-presence
  [[ "$output" == *"core"* ]] && [[ "$output" == *"council"* ]]
  [[ "$output" == *"install missing"* ]]                    # absent products get an install hint
  # Derived, not frozen: this also pins the invariant that arc-products.mjs's CATALOG matches
  # products/ on disk. A new product whose manifest lands but whose CATALOG entry is
  # forgotten is invisible to --status and to this hint -- that gap is what fails here.
  absent="$(ls "$ARC_ROOT/products" | LC_ALL=C sort | grep -vE '^(core|council)$' | tr '\n' ',' | sed 's/,$//')"
  [[ "$output" == *"--products $absent"* ]]
}

@test "status: a malformed registry degrades gracefully, never crashes (adversarial)" {
  mkdir -p "$BATS_TEST_TMPDIR/broken/.claude"
  printf '{ this is not json ' > "$BATS_TEST_TMPDIR/broken/.claude/arc-registry.json"
  run node "$RESOLVE" --status --root "$BATS_TEST_TMPDIR/broken"
  [ "$status" -eq 0 ]
  [[ "$output" == *"unreadable"* ]]
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

@test "lint: backslash traversal in a path is rejected (C1 review)" {
  run node "$LINT" --root "$FIX/hostile/traversal-backslash"
  [ "$status" -eq 2 ]
  [[ "$output" == *"backslash"* ]]
}

@test "lint: an envSentinel carrying a control char / injection is rejected (C2 review)" {
  run node "$LINT" --root "$FIX/hostile/envblock-injection"
  [ "$status" -eq 2 ]
  [[ "$output" == *"envSentinel"* ]]
}

# ---------- resolver must ALSO reject (single consumer-side guard, defense in depth) ----------

@test "resolver: backslash traversal is rejected, never emitted (C1 review)" {
  run node "$RESOLVE" --products core --root "$FIX/hostile/traversal-backslash"
  [ "$status" -eq 2 ]
}

@test "resolver: envSentinel injection is rejected, never emitted (C2 review)" {
  run node "$RESOLVE" --products core --root "$FIX/hostile/envblock-injection"
  [ "$status" -eq 2 ]
}

@test "lint: a trailing-dot/space '.. ' path segment is rejected (W4 review)" {
  run node "$LINT" --root "$FIX/hostile/traversal-dotspace"
  [ "$status" -eq 2 ]
}

@test "resolver: a trailing-dot/space '.. ' segment is rejected, never emitted (W4 review)" {
  run node "$RESOLVE" --products core --root "$FIX/hostile/traversal-dotspace"
  [ "$status" -eq 2 ]
}

@test "lint: envBlock without envSentinel is rejected (W3 review: lints-clean must resolve-clean)" {
  run node "$LINT" --root "$FIX/hostile/envblock-no-sentinel"
  [ "$status" -eq 2 ]
  [[ "$output" == *"envSentinel"* ]]
}

# ---------- product-lint: spaces in paths are LEGAL (TAB protocol, ADR-0015) ----------

@test "lint: a space in a path is accepted (TAB delimiter transports it safely)" {
  run node "$LINT" --root "$FIX/good-space"
  [ "$status" -eq 0 ]
}

# ---------- resolver: --registry mode (Phase 02, REQ-08) ----------

@test "resolver --registry: schema is 1, products are exactly core+council (deps resolved)" {
  node "$RESOLVE" --registry --products council --root "$FIX/good" > "$BATS_TEST_TMPDIR/reg.json"
  [ "$(_arc_json "$BATS_TEST_TMPDIR/reg.json" 'j.schema')" = "1" ]
  [ "$(_arc_json "$BATS_TEST_TMPDIR/reg.json" 'Object.keys(j.products).sort().join(",")')" = "core,council" ]
}

@test "resolver --registry: each product carries a version and a non-empty files[]" {
  node "$RESOLVE" --registry --products council --root "$FIX/good" > "$BATS_TEST_TMPDIR/reg.json"
  [ "$(_arc_json "$BATS_TEST_TMPDIR/reg.json" 'j.products.core.version')" = "1.0.0" ]
  [ "$(_arc_json "$BATS_TEST_TMPDIR/reg.json" 'j.products.council.files.length > 0')" = "true" ]
}

@test "resolver --registry: files[] carry the dest paths the resolver installs" {
  node "$RESOLVE" --registry --products council --root "$FIX/good" > "$BATS_TEST_TMPDIR/reg.json"
  [ "$(_arc_json "$BATS_TEST_TMPDIR/reg.json" 'j.products.council.files.includes(".claude/commands/arc-council.md")')" = "true" ]
}

@test "resolver --registry: no --products means every product (bare/full install)" {
  node "$RESOLVE" --registry --root "$FIX/good" > "$BATS_TEST_TMPDIR/reg.json"
  [ "$(_arc_json "$BATS_TEST_TMPDIR/reg.json" 'Object.keys(j.products).sort().join(",")')" = "core,council" ]
}

@test "resolver --registry: source.commit honors ARC_SOURCE_COMMIT (deterministic tests)" {
  ARC_SOURCE_COMMIT=deadbee node "$RESOLVE" --registry --products core --root "$FIX/good" > "$BATS_TEST_TMPDIR/reg.json"
  [ "$(_arc_json "$BATS_TEST_TMPDIR/reg.json" 'j.source.commit')" = "deadbee" ]
}

@test "resolver --registry: a malformed version is rejected, never emitted (adversarial, pinned)" {
  run node "$RESOLVE" --registry --products core --root "$FIX/hostile/registry-bad-version"
  [ "$status" -eq 2 ]
  [[ "$output" == *"version"* ]]
}

@test "resolver --registry: a non-hex ARC_SOURCE_COMMIT is ignored, not written verbatim (adversarial)" {
  ARC_SOURCE_COMMIT='not-a-hex-sha' node "$RESOLVE" --registry --products core --root "$FIX/good" > "$BATS_TEST_TMPDIR/reg.json"
  # non-hex override must fall through to git/unknown, never land verbatim in the file
  [ "$(_arc_json "$BATS_TEST_TMPDIR/reg.json" 'j.source.commit === "not-a-hex-sha"')" = "false" ]
}
