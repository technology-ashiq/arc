#!/usr/bin/env bats
# Phase 03 #2 -- trufflehog verified-secrets adapter (alongside gitleaks).
# trufflehog emits JSON-lines (not SARIF), so the adapter converts to the
# minimal SARIF shape and reports ONLY verified secrets (live, provider-checked
# => near-zero false positives). Same contract as the other adapters. Verified
# mode needs network, so tests use a deterministic offline FAKE trufflehog.
bats_require_minimum_version 1.5.0
load 'test_helper'

setup()    { _arc_load_libs; }
teardown() { _arc_teardown; }

# Fake `trufflehog` -> JSONL on stdout: one VERIFIED AWS key + one UNVERIFIED
# Slack token (must be dropped). Ignores args; echoes its bin dir.
_fake_trufflehog() {
  local d; d="$(mktemp -d)"
  cat > "$d/trufflehog" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' '{"DetectorName":"AWS","Verified":true,"SourceMetadata":{"Data":{"Filesystem":{"file":"config.env","line":3}}}}'
printf '%s\n' '{"DetectorName":"Slack","Verified":false,"SourceMetadata":{"Data":{"Filesystem":{"file":"config.env","line":9}}}}'
EOF
  chmod +x "$d/trufflehog"; echo "$d"
}

# Fake `docker` that emits trufflehog JSONL (one verified finding) to stdout.
_fake_docker_th() {
  local d; d="$(mktemp -d)"
  cat > "$d/docker" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' '{"DetectorName":"GCP","Verified":true,"SourceMetadata":{"Data":{"Filesystem":{"file":"key.json","line":1}}}}'
EOF
  chmod +x "$d/docker"; echo "$d"
}

# ---------------------------------------------------------------------------
# 1. Adapter degrade
# ---------------------------------------------------------------------------

@test "trufflehog adapter: missing tool degrades to SKIPPED (exit 0, empty runs)" {
  local d; d="$(mktemp -d)"; echo "config.env" > "$d/scope.txt"
  ARC_TRUFFLEHOG_BIN="arc-no-such-bin" ARC_DOCKER_IMAGE= \
    run bash "$ARC_SCAN_SRC/adapters/trufflehog.sh" "$d/scope.txt" "$d/out.sarif"
  [ "$status" -eq 0 ]
  [[ "$output" == *"SKIPPED trufflehog"* ]]
  run jq '[.runs[].results[]?] | length' "$d/out.sarif"
  [ "$output" -eq 0 ]
  rm -rf "$d"
}

@test "trufflehog adapter: empty scope => empty SARIF, exit 0" {
  local d; d="$(mktemp -d)"; : > "$d/scope.txt"
  local ft; ft="$(_fake_trufflehog)"
  ARC_TRUFFLEHOG_BIN="$ft/trufflehog" run bash "$ARC_SCAN_SRC/adapters/trufflehog.sh" "$d/scope.txt" "$d/out.sarif"
  [ "$status" -eq 0 ]
  run jq '[.runs[].results[]?] | length' "$d/out.sarif"
  [ "$output" -eq 0 ]
  rm -rf "$d" "$ft"
}

# ---------------------------------------------------------------------------
# 2. Verified-secrets behaviour
# ---------------------------------------------------------------------------

@test "trufflehog adapter: verified secret in scope => error finding, repo-relative path" {
  local ft; ft="$(_fake_trufflehog)"
  _arc_sandbox
  printf 'AWS_KEY=AKIAIOSFODNN7EXAMPLE\n' > config.env
  printf 'config.env\n' > scope.txt
  ARC_TRUFFLEHOG_BIN="$ft/trufflehog" run bash "$ARC_SCAN_SRC/adapters/trufflehog.sh" scope.txt out.sarif
  [ "$status" -eq 0 ]
  run jq -r '.runs[].results[].ruleId' out.sarif
  [ "$output" = "AWS" ]
  run jq -r '.runs[].results[].locations[].physicalLocation.artifactLocation.uri' out.sarif
  [ "$output" = "config.env" ]
  rm -rf "$ft"
}

@test "trufflehog adapter: UNVERIFIED secrets are dropped (verified-only mode)" {
  local ft; ft="$(_fake_trufflehog)"        # fake emits 1 verified + 1 unverified
  _arc_sandbox
  printf 'x\n' > config.env
  printf 'config.env\n' > scope.txt
  ARC_TRUFFLEHOG_BIN="$ft/trufflehog" bash "$ARC_SCAN_SRC/adapters/trufflehog.sh" scope.txt out.sarif
  run jq '[.runs[].results[]] | length' out.sarif
  [ "$output" -eq 1 ]                        # only the verified AWS finding survives
  run jq -r '.runs[].results[].ruleId' out.sarif
  [ "$output" = "AWS" ]
  rm -rf "$ft"
}

@test "trufflehog adapter: message does not leak the raw secret" {
  local ft; ft="$(_fake_trufflehog)"
  _arc_sandbox
  printf 'x\n' > config.env; printf 'config.env\n' > scope.txt
  ARC_TRUFFLEHOG_BIN="$ft/trufflehog" bash "$ARC_SCAN_SRC/adapters/trufflehog.sh" scope.txt out.sarif
  run jq -r '.runs[].results[].message.text' out.sarif
  [[ "$output" != *"AKIA"* ]]                # only the detector name, never the secret
  rm -rf "$ft"
}

@test "normalize: trufflehog verified finding resolves to error severity" {
  local ft; ft="$(_fake_trufflehog)"
  _arc_sandbox
  printf 'x\n' > config.env; printf 'config.env\n' > scope.txt
  ARC_TRUFFLEHOG_BIN="$ft/trufflehog" bash "$ARC_SCAN_SRC/adapters/trufflehog.sh" scope.txt t.sarif
  run bash -c ". '$ARC_SCAN_SRC/lib/common.sh'; . '$ARC_SCAN_SRC/lib/sarif.sh'; arc_sarif_normalize trufflehog t.sarif | jq -r '.level' | head -1"
  [ "$status" -eq 0 ]
  [ "$output" = "error" ]
  rm -rf "$ft"
}

# ---------------------------------------------------------------------------
# 3. Runtime rungs
# ---------------------------------------------------------------------------

@test "trufflehog adapter: skip rung => SKIPPED, empty SARIF, exit 0" {
  _arc_sandbox
  printf 'x\n' > config.env; printf 'config.env\n' > scope.txt
  run env ARC_FORCE_RUNTIME=skip bash "$ARC_SCAN_SRC/adapters/trufflehog.sh" scope.txt o.sarif
  [ "$status" -eq 0 ]
  [[ "$output" == *"SKIPPED trufflehog"* ]]
  run jq '[.runs[].results[]?]|length' o.sarif
  [ "$output" -eq 0 ]
}

@test "trufflehog adapter: docker rung runs via the image (fake docker, JSONL->SARIF)" {
  local fb; fb="$(_fake_docker_th)"
  _arc_sandbox
  printf 'x\n' > config.env; printf 'config.env\n' > scope.txt
  run env PATH="$fb:$PATH" ARC_FORCE_RUNTIME=docker ARC_DOCKER_IMAGE=arc-tools:test \
    bash "$ARC_SCAN_SRC/adapters/trufflehog.sh" scope.txt o.sarif
  [ "$status" -eq 0 ]
  [[ "$output" == *"via docker"* ]]
  run jq '[.runs[].results[]?]|length' o.sarif
  [ "$output" -eq 1 ]
  run jq -r '.runs[].results[].ruleId' o.sarif
  [ "$output" = "GCP" ]
  rm -rf "$fb"
}

# ---------------------------------------------------------------------------
# 4. End-to-end -- a verified secret BLOCKS the scan
# ---------------------------------------------------------------------------

@test "e2e: a verified secret BLOCKS via trufflehog and does not stamp scan" {
  local ft; ft="$(_fake_trufflehog)"
  _arc_sandbox
  printf 'AWS_KEY=AKIAIOSFODNN7EXAMPLE\n' > config.env
  printf 'config.env\n' > scope.txt
  ARC_TRUFFLEHOG_BIN="$ft/trufflehog" run bash "$(_arc_scan)" --scope scope.txt --stamp
  [ "$status" -eq 2 ]
  run jq -r '.verdict' .claude/state/scan/verdict.json
  [ "$output" = "block" ]
  [ ! -f "$(_arc_ledger_file)" ] || ! grep -qx scan "$(_arc_ledger_file)"
  rm -rf "$ft"
}
