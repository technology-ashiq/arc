#!/usr/bin/env bats
# launch Phase 00 -- the contract gate (REQ-01; ADR-1701..1705, 1709, 1715, 1717, 1719).
#
# launch-lint passes on the real slot catalog and provider registry, and its mutant self-test proves every rule it
# claims refuses a broken copy -- against a baseline it first proves clean, so no mutant can pass vacuously.
# launch-coverage derives the counts; the numbers in the plan are seeds this suite pins.
bats_require_minimum_version 1.5.0
load 'test_helper'

LINT() { printf '%s' "$ARC_ROOT/.claude/scripts/launch/launch-lint.mjs"; }
COV() { printf '%s' "$ARC_ROOT/.claude/scripts/launch/launch-coverage.mjs"; }

@test "launch-lint: every test in this file is registered (none dropped by name)" {
  local declared; declared=$(grep -c '^@test ' "$BATS_TEST_FILENAME")
  [ "$declared" -gt 0 ]
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "launch-lint: the real catalog and registry pass, and the pass names what it read" {
  run node "$(LINT)"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"launch-lint: ok -- 85 slots, "*" provider rows, "*" candidate-unbuilt"* ]] || { echo "$output"; false; }
}

@test "launch-lint: mutant self-test refuses all 13 mutants after a clean baseline" {
  run node "$(LINT)" --mutant-selftest
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"RAN baseline clean"* ]] || { echo "$output"; false; }
  local m
  for m in row-without-adapter adapter-without-row unknown-slot slot-names-provider vetted-by approved-by yaml \
           dag-cycle core-to-noncore edge-unresolved default-word zero-dep-leg verify-is-probe; do
    [[ "$output" == *"RAN mutant $m"* ]] || { echo "mutant $m never ran"; echo "$output"; false; }
    [[ "$output" == *"REFUSED $m"* ]] || { echo "mutant $m was not refused"; echo "$output"; false; }
  done
  [[ "$output" == *"13/13 mutants refused"* ]] || { echo "$output"; false; }
}

@test "launch-lint: a missing registry is a named refusal, never a clean pass" {
  run node "$(LINT)" --registry "$BATS_TEST_TMPDIR/absent.yaml"
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$output" == *"FAIL [missing] registry"* ]] || { echo "$output"; false; }
}

@test "launch-lint: an empty provider list fails from birth" {
  printf 'providers:\n' > "$BATS_TEST_TMPDIR/empty.yaml"
  run node "$(LINT)" --registry "$BATS_TEST_TMPDIR/empty.yaml"
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$output" == *"FAIL [shape]"* || "$output" == *"FAIL [empty]"* ]] || { echo "$output"; false; }
}

@test "launch-lint: a provider row that redefines a slot's exit criteria is refused" {
  cp "$ARC_ROOT/products/launch/launch.providers.yaml" "$BATS_TEST_TMPDIR/r.yaml"
  printf '  - id: rogue\n    slot: dns\n    status: candidate\n    exit_criteria:\n      - "whatever I say"\n    hosts:\n      - api.cloudflare.com\n    adapter: providers/dns/rogue.mjs\n    approved_by: ashiq\n' >> "$BATS_TEST_TMPDIR/r.yaml"
  run node "$(LINT)" --registry "$BATS_TEST_TMPDIR/r.yaml"
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$output" == *"FAIL [row-redefines-exit] rogue"* ]] || { echo "$output"; false; }
}

@test "launch-lint: a predicate outside the grammar is refused, not read as true or false" {
  # CR stripped first: on an autocrlf checkout a sed `$` anchor sits after the CR and the edit silently misses.
  tr -d '\r' < "$ARC_ROOT/products/launch/launch.slots.yaml" | sed 's/required_when: "tenancy == multi"/required_when: "tenancy is multi"/' > "$BATS_TEST_TMPDIR/s.yaml"
  grep -q 'required_when: "tenancy is multi"' "$BATS_TEST_TMPDIR/s.yaml" || { echo "fixture edit did not land"; false; }
  run node "$(LINT)" --catalog "$BATS_TEST_TMPDIR/s.yaml"
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$output" == *"FAIL [predicate] tenancy"* ]] || { echo "$output"; false; }
}

@test "launch-coverage: derives 85 slots as 33 core, 35 required, 17 optional" {
  run node "$(COV)"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"85 slots (33 core · 35 required · 17 optional)"* ]] || { echo "$output"; false; }
  [[ "$output" == *"core slots with a row 33/33"* ]] || { echo "$output"; false; }
}

@test "launch-coverage: --require-core-vetted fails while any core slot has zero vetted providers" {
  run node "$(COV)" --require-core-vetted
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$output" == *"FAIL -- core slots with zero vetted providers: "*"dns"* ]] || { echo "$output"; false; }
}

@test "launch-lint: the adapter scanner refuses minified imports, world-reaching built-ins and ambient globals (B2, B3)" {
  run node "$ARC_ROOT/tests/launch/scan-probe.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"SCAN_PROBE_DONE"* ]] || { echo "probe never finished: $output"; false; }
  local want
  for want in "minified: zero-dep-leg" "bare: zero-dep-leg" "reexport: zero-dep-leg" "commented: clean" "crypto: clean" \
              "fs: zero-dep-leg" "child: zero-dep-leg" "env: ambient-capability" "template: ambient-capability" \
              "prose: clean" "barefetch: ambient-capability" "ctxfetch: clean" "relative: import-boundary" \
              "prosefrom: clean" "dynlit: zero-dep-leg" "dyncomputed: zero-dep-leg" "templatespec: zero-dep-leg"; do
    [[ "$output" == *"$want"* ]] || { echo "missing: $want"; echo "$output"; false; }
  done
}

@test "launch-lint: a host entry that is a bare suffix is refused (B15)" {
  tr -d '\r' < "$ARC_ROOT/products/launch/launch.providers.yaml" | sed 's/^      - api\.cloudflare\.com$/      - com/' > "$BATS_TEST_TMPDIR/h.yaml"
  grep -q '^      - com$' "$BATS_TEST_TMPDIR/h.yaml" || { echo "fixture edit did not land"; false; }
  run node "$(LINT)" --registry "$BATS_TEST_TMPDIR/h.yaml"
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$output" == *'FAIL [hosts]'*'host "com" is not a bare hostname'* ]] || { echo "$output"; false; }
}

@test "launch-lint: a quoted exit criterion holding a colon stays a sentence; an unquoted one is refused" {
  run node --input-type=module -e 'const { loadCatalog } = await import(process.argv[1]); const h = loadCatalog().find((s) => s.id === "hosting"); console.log("HOSTING " + JSON.stringify(h.exit_criteria));' "$ARC_ROOT/.claude/scripts/launch/lib/catalog.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *'HOSTING ["git-triggered deploy with githubDeployment: 1"]'* ]] || { echo "$output"; false; }
  node -e 'const fs=require("fs");const s=fs.readFileSync(process.argv[1],"utf8");const t=s.replace("- \"git-triggered deploy with githubDeployment: 1\"","- git-triggered deploy with githubDeployment: 1");if(t===s)process.exit(3);fs.writeFileSync(process.argv[2],t)' "$ARC_ROOT/products/launch/launch.slots.yaml" "$BATS_TEST_TMPDIR/c.yaml" || { echo "fixture edit did not land"; false; }
  run node "$(LINT)" --catalog "$BATS_TEST_TMPDIR/c.yaml"
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$output" == *"FAIL [exit-criteria] hosting"* ]] || { echo "$output"; false; }
}

@test "launch-lint: a quoted mapping key in a list is a parse error, not a silent string (attack fb3a494 B5)" {
  run node --input-type=module -e 'const { parseYamlSubset } = await import(process.argv[1]); for (const t of ["xs:\n  - \"a\": 1\n", "xs:\n  - \"a\" b\n", "xs:\n  - \"a: b\"\n"]) { const r = parseYamlSubset(t); console.log("CASE " + (r.ok ? "ok " + JSON.stringify(r.value.xs) : "err " + r.error.what)); }' "$ARC_ROOT/.claude/scripts/engine/yaml-subset.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$(printf '%s\n' "$output" | grep -c '^CASE ')" -eq 3 ] || { echo "$output"; false; }
  [ "$(printf '%s\n' "$output" | grep -c '^CASE err a sequence item that opens a quote')" -eq 2 ] || { echo "$output"; false; }
  [[ "$output" == *'CASE ok ["a: b"]'* ]] || { echo "$output"; false; }
}

@test "launch-lint: depends_on entries that are not plain names are refused (attack fb3a494 B6)" {
  node -e 'const fs=require("fs");const s=fs.readFileSync(process.argv[1],"utf8");const t=s.replace("    depends_on:\n      - domain\n      - hosting\n","    depends_on:\n      - domain\n      - 123\n");if(t===s)process.exit(3);fs.writeFileSync(process.argv[2],t)' "$ARC_ROOT/products/launch/launch.slots.yaml" "$BATS_TEST_TMPDIR/c.yaml" || { echo "fixture edit did not land"; false; }
  run node "$(LINT)" --catalog "$BATS_TEST_TMPDIR/c.yaml"
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$output" == *"FAIL [list-shape] dns"* ]] || { echo "$output"; false; }
}
