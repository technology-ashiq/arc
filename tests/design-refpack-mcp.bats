#!/usr/bin/env bats
# Cycle 16 Phase 05 S2+S3 (REQ-07) -- MCP search sources and the per-run availability summary.
#
# S3: a source reached over MCP gets its credential from the env var the registry row names, and
# sends it in the UPSTREAM header. A missing key is COULD-NOT-SCAN, recorded, never a crash and
# never a silent skip. An off source makes no request at all.
# S2: every run ends with one availability line per active pack source, read from what the run
# RECORDED. Unreachable, robots-refused, short and never-asked are each named; the pack still
# builds from what answered.
#
# OFFLINE-FIRST: every case drives the fake transport (--mcp-fixture / --record-request /
# --robots-file). The fake records the key as its sha256 prefix, so a test proves which header
# carried it without the key being written anywhere.
bats_require_minimum_version 1.5.0
load 'test_helper'

_refpack() { echo "$SANDBOX/.claude/scripts/design/design-refpack.mjs"; }
_avail() { echo "$SANDBOX/.claude/state/design/refpacks/lexos/availability.log"; }
_attempts() { echo "$SANDBOX/.claude/state/design/refpacks/lexos/attempts.log"; }
# sha256 prefix by node: macOS has no sha256sum.
_sha16() { node -e 'process.stdout.write(require("crypto").createHash("sha256").update(process.argv[1]).digest("hex").slice(0,16))' "$1"; }

_registry() {
  cat > "$SANDBOX/design.sources.yaml" <<'EOF'
sources:
  - id: 21st-dev
    kind:
      - components
    access: mcp
    hosts:
      - 21st.dev
    allowed_use:
      - reference-pack
      - provenance
    auth: env
    credential_ref: API_KEY_21ST
    cost: free
    status: active
    availability: unknown
    approved_by: ashiq
    added: 2026-10-05

  - id: lapa-ninja
    kind:
      - inspiration
    access: fetch
    allowed_use:
      - reference-pack
      - provenance
    auth: none
    cost: free
    status: active
    availability: unknown
    approved_by: ashiq
    added: 2026-08-23

  - id: nicelydone
    kind:
      - inspiration
    access: fetch
    allowed_use:
      - reference-pack
      - provenance
    auth: none
    cost: free
    status: active
    availability: unknown
    approved_by: ashiq
    added: 2026-09-27

  - id: mobbin
    kind:
      - inspiration
    access: mcp
    hosts:
      - 21st.dev
    allowed_use:
      - reference-pack
    auth: none
    cost: paid
    status: off
    availability: unknown
    approved_by: ashiq
    added: 2026-10-05
EOF
}

# A fixture answering initialize and a search that returns TWO components.
_fixture() {
  cat > "$SANDBOX/fx.json" <<'EOF'
{"initialize":{"status":200,"session":"s1","body":{"jsonrpc":"2.0","id":1,"result":{}}},
 "notifications/initialized":{"status":202,"body":""},
 "tools/call":{"status":200,"body":{"jsonrpc":"2.0","id":2,"result":{"content":[{"type":"text","text":"[{\"name\":\"Case header\",\"preview\":\"https://cdn.21st.dev/a.png\"},{\"name\":\"Timeline\"}]"}]}}}}
EOF
  [ -s "$SANDBOX/fx.json" ] || { echo "fixture: not written"; return 1; }
}

_mcp_sandbox() {
  _arc_design_sandbox
  _registry
  _fixture
  export ARC_DESIGN_OFFLINE=1
}

teardown() { _arc_teardown 2>/dev/null || true; }

@test "query: the key travels in x-api-key, arc's secret name never leaves, and a short answer is counted" {
  _mcp_sandbox
  run env API_KEY_21ST=k-test-0001 node "$(_refpack)" --query "case header" --brief lexos --source 21st-dev --want 3 --mcp-fixture "$SANDBOX/fx.json" --record-request "$SANDBOX/req.jsonl"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"answered 2 of 3; SHORT -- asked for 3, got 2"* ]] || { echo "$output"; false; }
  want="sha256:$(_sha16 k-test-0001)"
  grep -q "\"x-api-key\":\"$want\"" "$SANDBOX/req.jsonl" || { echo "the key was not in x-api-key: $(cat "$SANDBOX/req.jsonl")"; false; }
  # The control on the hash: a different key would not match, so the line above is about THIS key.
  ! grep -q "sha256:$(_sha16 k-test-0002)" "$SANDBOX/req.jsonl"
  ! grep -q 'API_KEY_21ST\|k-test-0001\|credential_ref' "$SANDBOX/req.jsonl" || { echo "arc's name or the raw key crossed: $(cat "$SANDBOX/req.jsonl")"; false; }
  grep -q $'\t21st-dev\tfixture\t.*\tANSWERED\tresults 2 of 3; SHORT' "$(_avail)" || { cat "$(_avail)"; false; }
}

@test "query: a missing key is COULD-NOT-SCAN, recorded, with zero requests made" {
  _mcp_sandbox
  run env -u API_KEY_21ST node "$(_refpack)" --query "case header" --brief lexos --source 21st-dev --want 3 --mcp-fixture "$SANDBOX/fx.json"
  [ "$status" -eq 4 ] || { echo "a missing key exited $status: $output"; false; }
  [[ "$output" == *"COULD-NOT-SCAN 21st-dev -- credential API_KEY_21ST is not set"* ]] || { echo "$output"; false; }
  grep -q $'\tCOULD-NOT-SCAN\tcredential API_KEY_21ST is not set' "$(_avail)" || { echo "not recorded"; false; }
  [ ! -s "$(_attempts)" ] || { echo "a request was attempted without a key: $(cat "$(_attempts)")"; false; }
}

@test "query: a refused key (401) is COULD-NOT-SCAN, never a crash" {
  _mcp_sandbox
  printf '{"initialize":{"status":401,"body":""}}\n' > "$SANDBOX/fx401.json"
  run env API_KEY_21ST=k-bad node "$(_refpack)" --query "x" --brief lexos --source 21st-dev --want 3 --mcp-fixture "$SANDBOX/fx401.json"
  [ "$status" -eq 4 ] || { echo "$output"; false; }
  [[ "$output" == *"the key was refused (HTTP 401)"* ]] || { echo "$output"; false; }
}

@test "query: an off source and a fetch source are refused before any request or state" {
  _mcp_sandbox
  run env API_KEY_21ST=k node "$(_refpack)" --query "x" --brief lexos --source mobbin --want 3 --mcp-fixture "$SANDBOX/fx.json"
  [ "$status" -eq 2 ] || { echo "$output"; false; }
  [[ "$output" == *"status: off"* ]] || { echo "$output"; false; }
  [ ! -e "$(_attempts)" ] || { echo "an off source left state behind"; false; }
  run node "$(_refpack)" --query "x" --brief lexos --source lapa-ninja --want 3 --mcp-fixture "$SANDBOX/fx.json"
  [ "$status" -eq 2 ] || { echo "$output"; false; }
  [[ "$output" == *"--query is for an mcp source"* ]] || { echo "$output"; false; }
}

@test "summary: unreachable, robots-refused, short and never-asked are each named, and the count is honest" {
  _mcp_sandbox
  t0="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  sleep 1
  # 21st-dev answers short (2 of 3), then fails once with no key.
  run env API_KEY_21ST=k node "$(_refpack)" --query "case" --brief lexos --source 21st-dev --want 3 --mcp-fixture "$SANDBOX/fx.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run env -u API_KEY_21ST node "$(_refpack)" --query "case" --brief lexos --source 21st-dev --want 3 --mcp-fixture "$SANDBOX/fx.json"
  [ "$status" -eq 4 ] || { echo "$output"; false; }
  # lapa-ninja: robots says no.
  printf 'User-agent: *\nDisallow: /\n' > "$SANDBOX/robots.txt"
  run node "$(_refpack)" --brief lexos --source lapa-ninja --url https://lapa.ninja/x --principle p --avoid a --robots-file "$SANDBOX/robots.txt" --fixture "$SANDBOX/fx.json"
  [ "$status" -eq 3 ] || { echo "$output"; false; }
  # nicelydone: never asked.
  run node "$(_refpack)" --summary --brief lexos --since "$t0"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"availability 21st-dev [fixture]: ANSWERED results 2 of 3; SHORT -- asked for 3, got 2; COULD-NOT-SCAN 1 (credential API_KEY_21ST is not set"* ]] || { echo "$output"; false; }
  [[ "$output" == *"availability lapa-ninja [fixture]: ANSWERED 0/1 screen(s) added/asked; REFUSED (robots) 1"* ]] || { echo "$output"; false; }
  [[ "$output" == *"availability nicelydone: NOT-ASKED"* ]] || { echo "$output"; false; }
  [[ "$output" != *"mobbin"* ]] || { echo "an off source was reported as a pack source: $output"; false; }
  [[ "$output" == *"summary: 1 of 3 active pack source(s) answered"* ]] || { echo "$output"; false; }
}

@test "summary: no --since is refused, and an empty active set is not a pass" {
  _mcp_sandbox
  run node "$(_refpack)" --summary --brief lexos
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  printf 'sources:\n  - id: godly\n    kind:\n      - inspiration\n    access: fetch\n    allowed_use:\n      - provenance\n    auth: none\n    cost: free\n    status: off\n    availability: unknown\n    approved_by: ashiq\n    added: 2026-08-23\n' > "$SANDBOX/none.yaml"
  run node "$(_refpack)" --summary --brief lexos --since 2026-01-01T00:00:00Z --registry "$SANDBOX/none.yaml"
  [ "$status" -eq 1 ] || { echo "an empty active set passed: $output"; false; }
  [[ "$output" == *"not a pass"* ]] || { echo "$output"; false; }
}

@test "attack fc30f54: a seam never reaches the network, an echoed key is scrubbed, free text is not a hit, a doubled reply is refused" {
  _mcp_sandbox
  run env API_KEY_21ST=k node "$(_refpack)" --query "x" --brief lexos --source 21st-dev --want 3 --registry "$SANDBOX/design.sources.yaml"
  [ "$status" -eq 1 ] || { echo "a scratch registry drove a real request: $output"; false; }
  [[ "$output" == *"needs --mcp-fixture"* ]] || { echo "$output"; false; }
  printf '{"initialize":{"status":200,"body":{"jsonrpc":"2.0","id":1,"result":{}}},"tools/call":{"status":200,"body":{"jsonrpc":"2.0","id":2,"error":{"message":"bad key k-secret-77 rejected"}}}}
' > "$SANDBOX/fxerr.json"
  run env API_KEY_21ST=k-secret-77 node "$(_refpack)" --query "x" --brief lexos --source 21st-dev --want 3 --mcp-fixture "$SANDBOX/fxerr.json"
  [ "$status" -eq 4 ] || { echo "$output"; false; }
  [[ "$output" == *"bad key <key> rejected"* ]] || { echo "$output"; false; }
  ! grep -q 'k-secret-77' "$(_avail)" || { echo "the echoed key reached the log"; false; }
  printf '{"initialize":{"status":200,"body":{"jsonrpc":"2.0","id":1,"result":{}}},"tools/call":{"status":200,"body":{"jsonrpc":"2.0","id":2,"result":{"content":[{"type":"text","text":"No components found"}]}}}}
' > "$SANDBOX/fxtext.json"
  run env API_KEY_21ST=k node "$(_refpack)" --query "x" --brief lexos --source 21st-dev --want 3 --mcp-fixture "$SANDBOX/fxtext.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"answered 0 of 3; SHORT -- asked for 3, got 0"* ]] || { echo "free text was counted as a hit: $output"; false; }
  printf '{"initialize":{"status":200,"body":{"jsonrpc":"2.0","id":1,"result":{}}},"tools/call":{"status":200,"body":[{"jsonrpc":"2.0","id":2,"result":{}},{"jsonrpc":"2.0","id":2,"result":{}}]}}
' > "$SANDBOX/fxdup.json"
  run env API_KEY_21ST=k node "$(_refpack)" --query "x" --brief lexos --source 21st-dev --want 3 --mcp-fixture "$SANDBOX/fxdup.json"
  [ "$status" -eq 4 ] || { echo "a doubled reply was chosen between: $output"; false; }
}

@test "this file registers the 8 tests it declares" {
  [ "${#BATS_TEST_NAMES[@]}" -eq 8 ] || { echo "registered ${#BATS_TEST_NAMES[@]} tests, expected 8 -- a @test was silently dropped"; false; }
}
