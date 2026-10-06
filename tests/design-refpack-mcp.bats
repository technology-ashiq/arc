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

# A fixture answering initialize and a search that returns TWO components, in the LIVE shape read
# off 21st.dev on 2026-10-06: structuredContent.results, with a prose rendering of the same list
# beside it that must not be counted a second time.
_fixture() {
  cat > "$SANDBOX/fx.json" <<'EOF'
{"initialize":{"status":200,"session":"s1","body":{"jsonrpc":"2.0","id":1,"result":{}}},
 "notifications/initialized":{"status":202,"body":""},
 "tools/call":{"status":200,"body":{"jsonrpc":"2.0","id":2,"result":{"structuredContent":{"results":[{"type":"component","id":1,"name":"Case header","preview":"https://cdn.21st.dev/a.png"},{"type":"component","id":2,"name":"Timeline"}]},"content":[{"type":"text","text":"2 result(s) across 21st.dev (metadata only). ### [component] Case header ### [component] Timeline"}]}}}}
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
  # 21st-dev answered only from a fixture, so it is NOT a live answer (attack ce85db5 B8).
  [[ "$output" == *"summary: 0 of 3 active pack source(s) answered live since"*"(1 more answered from a fixture only)"* ]] || { echo "$output"; false; }
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

@test "attack ce85db5: header grammar, recorder, preview token, tool error, credential pin, zoned --since and torn lines each hold" {
  _mcp_sandbox
  # A session id carrying CR LF is refused, not echoed into the next request.
  printf '{"initialize":{"status":200,"session":"a\\r\\nX-Evil: 1","body":{"jsonrpc":"2.0","id":1,"result":{}}}}\n' > "$SANDBOX/fxsess.json"
  run env API_KEY_21ST=k-test-0001 node "$(_refpack)" --query "x" --brief lexos --source 21st-dev --want 3 --mcp-fixture "$SANDBOX/fxsess.json"
  [ "$status" -eq 4 ] || { echo "$output"; false; }
  [[ "$output" == *"session id outside the header grammar"* ]] || { echo "$output"; false; }
  # A recorder that already exists is refused before any request.
  printf 'keep\n' > "$SANDBOX/old.jsonl"
  run env API_KEY_21ST=k-test-0001 node "$(_refpack)" --query "x" --brief lexos --source 21st-dev --want 3 --mcp-fixture "$SANDBOX/fx.json" --record-request "$SANDBOX/old.jsonl"
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [ "$(cat "$SANDBOX/old.jsonl")" = "keep" ] || { echo "an existing file was appended to"; false; }
  # A preview URL loses its query: a signed token never reaches output.
  printf '{"initialize":{"status":200,"body":{"jsonrpc":"2.0","id":1,"result":{}}},"tools/call":{"status":200,"body":{"jsonrpc":"2.0","id":2,"result":{"content":[{"type":"text","text":"[{\\"name\\":\\"Card\\",\\"preview\\":\\"https://cdn.21st.dev/c.png?token=SIGNED\\"}]"}]}}}}\n' > "$SANDBOX/fxtok.json"
  run env API_KEY_21ST=k-test-0001 node "$(_refpack)" --query "x" --brief lexos --source 21st-dev --want 1 --mcp-fixture "$SANDBOX/fxtok.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"preview https://cdn.21st.dev/c.png"* ]] || { echo "$output"; false; }
  [[ "$output" != *"SIGNED"* ]] || { echo "the token was printed: $output"; false; }
  # A tool-level error (isError) is COULD-NOT-SCAN, not zero results.
  printf '{"initialize":{"status":200,"body":{"jsonrpc":"2.0","id":1,"result":{}}},"tools/call":{"status":200,"body":{"jsonrpc":"2.0","id":2,"result":{"isError":true,"content":[{"type":"text","text":"rate limited"}]}}}}\n' > "$SANDBOX/fxerr2.json"
  run env API_KEY_21ST=k-test-0001 node "$(_refpack)" --query "x" --brief lexos --source 21st-dev --want 3 --mcp-fixture "$SANDBOX/fxerr2.json"
  [ "$status" -eq 4 ] || { echo "$output"; false; }
  [[ "$output" == *"the tool reported an error: rate limited"* ]] || { echo "$output"; false; }
  # A registry row pointing the key at another secret is refused.
  sed 's/credential_ref: API_KEY_21ST/credential_ref: GITHUB_TOKEN/' "$SANDBOX/design.sources.yaml" > "$SANDBOX/swap.yaml"
  run env GITHUB_TOKEN=k-test-0001 node "$(_refpack)" --query "x" --brief lexos --source 21st-dev --want 3 --mcp-fixture "$SANDBOX/fx.json" --registry "$SANDBOX/swap.yaml"
  [ "$status" -eq 2 ] || { echo "$output"; false; }
  [[ "$output" == *"this adapter sends only API_KEY_21ST"* ]] || { echo "$output"; false; }
  # --since without a zone is refused; a torn availability line is counted, not dropped.
  run node "$(_refpack)" --summary --brief lexos --since 2026-10-05T09:00:00
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  printf 'torn-line-without-tabs\n' >> "$(_avail)"
  run node "$(_refpack)" --summary --brief lexos --since 2026-01-01T00:00:00Z
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"1 malformed availability line(s) were not read"* ]] || { echo "$output"; false; }
}

@test "live contract: the search calls the read-only search tool with query, type and limit, and counts structuredContent once" {
  _mcp_sandbox
  run env API_KEY_21ST=k-test-0001 node "$(_refpack)" --query "case header" --brief lexos --source 21st-dev --want 4 --mcp-fixture "$SANDBOX/fx.json" --record-request "$SANDBOX/req2.jsonl"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # Two results, not two plus the prose rendering beside them.
  [[ "$output" == *"answered 2 of 4; SHORT -- asked for 4, got 2"* ]] || { echo "$output"; false; }
  grep -q '"name":"search","arguments":{"query":"case header","type":"component","limit":4}' "$SANDBOX/req2.jsonl" || { echo "not the live contract: $(grep tools/call "$SANDBOX/req2.jsonl")"; false; }
  ! grep -q '21st_magic' "$SANDBOX/req2.jsonl" || { echo "the deprecated tool name was called"; false; }
}

@test "pack: an mcp source's preview image is added under its own hosts, and refused off them" {
  _mcp_sandbox
  printf 'PNG-FIXTURE-21ST\n' > "$SANDBOX/shot.bin"
  printf 'User-agent: *\nAllow: /\n' > "$SANDBOX/robots.txt"
  run node "$(_refpack)" --brief lexos --source 21st-dev --url https://cdn.21st.dev/u/status-bar/preview.png --principle "the state of each day is one coloured cell, so a week reads at a glance" --avoid "the uptime vocabulary" --robots-file "$SANDBOX/robots.txt" --fixture "$SANDBOX/shot.bin"
  [ "$status" -eq 0 ] || { echo "an mcp source image on its host was refused: $output"; false; }
  grep -q '| 21st-dev (fixture) |' "$SANDBOX/docs/design/refpacks/lexos/sources.md" || { cat "$SANDBOX/docs/design/refpacks/lexos/sources.md"; false; }
  # Same principle and avoid text as the passing call, so only the host binding can refuse (attack 22567d9 B1).
  run node "$(_refpack)" --brief lexos --source 21st-dev --url https://evil.example/preview.png --principle "the state of each day is one coloured cell, so a week reads at a glance" --avoid "the uptime vocabulary" --robots-file "$SANDBOX/robots.txt" --fixture "$SANDBOX/shot.bin"
  [ "$status" -eq 2 ] || { echo "an image off the row's hosts was accepted: $output"; false; }
  [[ "$output" == *"evil.example is not one of source '21st-dev' hosts"* ]] || { echo "refused, but not by the host binding: $output"; false; }
  # An mcp row with empty hosts is refused with its reason, before any host check (attack af751d5 B1).
  sed 's/^    hosts:$/    hosts: none/; /^      - 21st.dev$/d' "$SANDBOX/design.sources.yaml" > "$SANDBOX/nohosts.yaml"
  run node "$(_refpack)" --brief lexos --source 21st-dev --url https://cdn.21st.dev/u/p.png --principle "the state of each day is one coloured cell, so a week reads at a glance" --avoid "the uptime vocabulary" --robots-file "$SANDBOX/robots.txt" --fixture "$SANDBOX/shot.bin" --registry "$SANDBOX/nohosts.yaml"
  [ "$status" -eq 2 ] || { echo "$output"; false; }
  [[ "$output" == *"needs a non-empty hosts list and a search adapter"* ]] || { echo "$output"; false; }
  # Empty objects in structuredContent are not hits (attack 22567d9 B2).
  printf '{"initialize":{"status":200,"body":{"jsonrpc":"2.0","id":1,"result":{}}},"tools/call":{"status":200,"body":{"jsonrpc":"2.0","id":2,"result":{"structuredContent":{"results":[{},{},{"name":"Real"}]}}}}}\n' > "$SANDBOX/fxempty.json"
  run env API_KEY_21ST=k-test-0001 node "$(_refpack)" --query "x" --brief lexos --source 21st-dev --want 3 --mcp-fixture "$SANDBOX/fxempty.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"answered 1 of 3"* ]] || { echo "empty objects were counted: $output"; false; }
}

@test "shadcn: the prose list is parsed into items, a keyed stdio row is refused, and a later empty answer does not erase an earlier hit" {
  _mcp_sandbox
  printf 'sources:\n  - id: shadcn\n    kind:\n      - components\n    access: mcp\n    allowed_use:\n      - reference-pack\n    auth: none\n    cost: free\n    status: active\n    availability: unknown\n    approved_by: ashiq\n    added: 2026-10-05\n' > "$SANDBOX/sh.yaml"
  # The LIVE shape read off shadcn 4.21.2 on 2026-10-06: prose only, one item per list line.
  printf '{"initialize":{"status":200,"body":{"jsonrpc":"2.0","id":1,"result":{}}},"tools/call":{"status":200,"body":{"jsonrpc":"2.0","id":2,"result":{"content":[{"type":"text","text":"Found 60 items matching card in registries @shadcn: Showing items 1-3 of 60:\\n- card (registry:ui) [@shadcn]\\n- card-demo (registry:example) [@shadcn]\\n- hover-card (registry:ui) [@shadcn]\\nMore items available."}]}}}}\n' > "$SANDBOX/fxsh.json"
  t0="$(date -u +%Y-%m-%dT%H:%M:%SZ)"; sleep 1
  run node "$(_refpack)" --query "card" --brief lexos --source shadcn --want 3 --mcp-fixture "$SANDBOX/fxsh.json" --registry "$SANDBOX/sh.yaml" --record-request "$SANDBOX/reqsh.jsonl"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"hover-card"* ]] || { echo "$output"; false; }
  [[ "$output" == *"shadcn answered 3 of 3"* ]] || { echo "the prose list was not parsed: $output"; false; }
  grep -q '"name":"search_items_in_registries","arguments":{"registries":\["@shadcn"\],"query":"card","limit":3}' "$SANDBOX/reqsh.jsonl" || { cat "$SANDBOX/reqsh.jsonl"; false; }
  ! grep -qi 'x-api-key' "$SANDBOX/reqsh.jsonl" || { echo "a keyless source sent a key header"; false; }
  # A later query that finds nothing must not erase the earlier hit in the run summary.
  printf '{"initialize":{"status":200,"body":{"jsonrpc":"2.0","id":1,"result":{}}},"tools/call":{"status":200,"body":{"jsonrpc":"2.0","id":2,"result":{"content":[{"type":"text","text":"No items found matching timeline in registries @shadcn"}]}}}}\n' > "$SANDBOX/fxsh0.json"
  run node "$(_refpack)" --query "timeline" --brief lexos --source shadcn --want 3 --mcp-fixture "$SANDBOX/fxsh0.json" --registry "$SANDBOX/sh.yaml"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"answered 0 of 3"* ]] || { echo "$output"; false; }
  run node "$(_refpack)" --summary --brief lexos --since "$t0" --registry "$SANDBOX/sh.yaml"
  [[ "$output" == *"availability shadcn [fixture]: ANSWERED results 3 of 3 | results 0 of 3"* ]] || { echo "$output"; false; }
  [[ "$output" == *"(1 more answered from a fixture only)"* ]] || { echo "the earlier hit was erased: $output"; false; }
  # A stdio source is keyless: a row giving it a credential is refused before anything starts.
  sed 's/^    auth: none$/    auth: env\n    credential_ref: API_KEY_21ST/' "$SANDBOX/sh.yaml" > "$SANDBOX/shkey.yaml"
  run env API_KEY_21ST=k-test-0001 node "$(_refpack)" --query "card" --brief lexos --source shadcn --want 3 --mcp-fixture "$SANDBOX/fxsh.json" --registry "$SANDBOX/shkey.yaml"
  [ "$status" -eq 2 ] || { echo "$output"; false; }
  [[ "$output" == *"a stdio MCP source is keyless"* ]] || { echo "$output"; false; }
}

@test "attack fc97161: the REAL stdio transport -- answers, an exiting, silent, doubling or noisy server is COULD-NOT-SCAN, and no owner key reaches it" {
  _mcp_sandbox
  printf 'sources:\n  - id: shadcn\n    kind:\n      - components\n    access: mcp\n    allowed_use:\n      - reference-pack\n    auth: none\n    cost: free\n    status: active\n    availability: unknown\n    approved_by: ashiq\n    added: 2026-10-05\n' > "$SANDBOX/sh.yaml"
  fake="$ARC_ROOT/tests/fixtures/design/fake-mcp-stdio.mjs"
  [ -s "$fake" ] || { echo "fixture: no fake server"; false; }
  export ARC_DESIGN_MCP_BUDGET_MS=8000
  # The control: the spawn path answers and the prose list is parsed.
  run env FAKE_MCP_MODE=answer FAKE_MCP_ENV_OUT="$SANDBOX/env.txt" STITCH_API_KEY=owner-secret-1 API_KEY_21ST=owner-secret-2 node "$(_refpack)" --query "card" --brief lexos --source shadcn --want 3 --registry "$SANDBOX/sh.yaml" --mcp-stdio-server "$fake"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"shadcn answered 2 of 3; SHORT"* ]] || { echo "$output"; false; }
  [ -s "$SANDBOX/env.txt" ] || { echo "the fake server never ran -- the spawn path was not driven"; false; }
  ! grep -q 'STITCH_API_KEY\|API_KEY_21ST\|NODE_OPTIONS' "$SANDBOX/env.txt" || { echo "an owner key reached the local server: $(cat "$SANDBOX/env.txt")"; false; }
  grep -qx 'npm_config_ignore_scripts' "$SANDBOX/env.txt" || { echo "the pinned npm settings did not reach it"; false; }
  local m want
  for m in exit:"exited (code 3) before answering" silent:"no answer within the 8 s budget" double:"answered one request twice" junk:"lines that are not JSON-RPC"; do
    want="${m#*:}"
    run env FAKE_MCP_MODE="${m%%:*}" node "$(_refpack)" --query "card" --brief lexos --source shadcn --want 3 --registry "$SANDBOX/sh.yaml" --mcp-stdio-server "$fake"
    [ "$status" -eq 4 ] || { echo "${m%%:*}: exited $status: $output"; false; }
    [[ "$output" == *"COULD-NOT-SCAN shadcn"*"$want"* ]] || { echo "${m%%:*}: $output"; false; }
  done
  # The fake-server seam never stands in for an https source.
  run env API_KEY_21ST=k-test-0001 node "$(_refpack)" --query "x" --brief lexos --source 21st-dev --want 3 --mcp-stdio-server "$fake"
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$output" == *"stands in for a local stdio source only"* ]] || { echo "$output"; false; }
}

@test "this file registers the 13 tests it declares" {
  [ "${#BATS_TEST_NAMES[@]}" -eq 13 ] || { echo "registered ${#BATS_TEST_NAMES[@]} tests, expected 13 -- a @test was silently dropped"; false; }
}
