#!/usr/bin/env bats
# policy cycle 2, Phase 02 -- the owner paste (POL-L; REQ-05; ADR-0509..0511).
#
# The deny-listed half of POL-L ships as WHOLE FILES generated from the live ones into
# initiatives/policy/evidence/phase-02/paste/ (the Phase 04 STEP1/STEP2 pattern). An agent never writes the targets.
# Every test here overlays that paste on a sandbox copy of the tree, so the paste is proven on CI BEFORE the owner
# applies it -- and once applied, the same bytes are the live files (verify-paste.mjs checks sha256 equality).
#
# ASCII-only test names; the file asserts its own registered count at the bottom.
bats_require_minimum_version 1.5.0
load 'test_helper'

FX="$BATS_TEST_DIRNAME/fixtures/policy-evidence"
# The paste is WHOLE FILES under initiatives/policy/evidence/phase-02/paste/ (deny-listed targets: an agent never
# writes them). These tests overlay the paste on a sandbox copy of the tree, so the paste is proven on CI before the
# owner applies it -- and after, the same files are the live ones.
PASTE="$BATS_TEST_DIRNAME/../initiatives/policy/evidence/phase-02/paste"

_paste_root() { # $1 dir: the tree with every pasted file laid over it, and its own spine
  local d="$1"
  mkdir -p "$d/.claude/state/hq/events" "$d/processes"
  cp -r "$ARC_ROOT/.claude/scripts" "$d/.claude/"
  cp "$ARC_ROOT/CONSTITUTION.md" "$d/"
  cp "$ARC_ROOT/processes/"*.process.yaml "$d/processes/"
  cp -r "$PASTE/." "$d/"
  grep -q 'evidence_days: 35' "$d/hq.policy.yaml" || { echo "the paste did not land in the sandbox"; return 1; }
  export ARC_SPINE_ROOT="$d/.claude/state/hq"
}

@test "paste: the pasted policy is law under the pasted lint, with N on every in-scope L1 grant" {
  local d="$BATS_TEST_TMPDIR/p-law"; _paste_root "$d" || return 1
  cd "$d"
  run node "$d/.claude/scripts/hq/policy-lint.mjs" hq.policy.yaml
  [ "$status" -eq 0 ] && [[ "$output" == *"is law -- 0 violations"* ]] || { echo "$status $output"; false; }
  ! grep -qE '^    (shell|network): \{ level: L1 \}$' "$d/hq.policy.yaml" || { echo "an in-scope L1 grant has no N"; false; }
  [ "$(grep -c 'evidence_days: 35' "$d/hq.policy.yaml")" -gt 0 ] || { echo "no N declared"; false; }
}

@test "paste: the pasted lint refuses an unusable N -- 0, negative, fractional, a string" {
  local d="$BATS_TEST_TMPDIR/p-lint"; _paste_root "$d" || return 1
  local lit
  for lit in 0 -1 1.5 '"35"' 3651; do
    run node "$FX/paste-lint-probe.mjs" "$d/.claude/scripts/hq/lib/policy/lint.mjs" "$d/hq.policy.yaml" "$d" "$lit"
    [[ "$output" == *"evidence_days"* && "$output" != "VIOLATIONS 0"* ]] || { echo "evidence_days $lit was accepted: $output"; false; }
  done
  run node "$FX/paste-lint-probe.mjs" "$d/.claude/scripts/hq/lib/policy/lint.mjs" "$d/hq.policy.yaml" "$d" keep
  [ "$output" = "VIOLATIONS 0" ] || { echo "the positive control failed: $output"; false; }
}

@test "paste: policy-lint --evidence delegates to check and exits 3 on BELOW-BAR" {
  local d="$BATS_TEST_TMPDIR/p-ev"; _paste_root "$d" || return 1
  cd "$d"
  run node "$d/.claude/scripts/hq/policy-lint.mjs" hq.policy.yaml --evidence
  [ "$status" -eq 3 ] && [[ "$output" == *"is law"* && "$output" == *"BELOW-BAR"* ]] || { echo "$status $output"; false; }
}

_hook() { # run the sandbox hook on a Bash tool call; stdin is the PreToolUse payload
  printf '%s' '{"tool_name":"Bash","tool_input":{"command":"ls"}}' | node "$1/.claude/scripts/hq/policy-hook.mjs"
}

@test "paste: the armed hook's propose is one refusal a day, and it turns the cell fresh" {
  local d="$BATS_TEST_TMPDIR/p-hook"; _paste_root "$d" || return 1
  export ARC_POLICY_REFUSAL_TIMEOUT_MS=30000
  run node "$d/.claude/scripts/hq/policy-evidence.mjs" report --json
  printf '%s' "$output" > "$BATS_TEST_TMPDIR/before.json"
  run node "$FX/spine-probe.mjs" cell "$BATS_TEST_TMPDIR/before.json" session:interactive shell
  [[ "$output" == "null absent true" ]] || { echo "before: $output"; false; }
  run _hook "$d"
  [ "$status" -eq 2 ] && [[ "$output" == *"BLOCKED by policy"* && "$output" == *"L1 (propose)"* ]] || { echo "first: $status $output"; false; }
  local first="$output"
  run _hook "$d"
  [ "$status" -eq 2 ] && [ "$output" = "$first" ] || { echo "the second block differs: $output"; false; }
  run node "$FX/spine-probe.mjs" refusals "$d/.claude/state/hq/events"
  [[ "$output" =~ ^REFUSALS\ 1\  ]] || { echo "expected one refusal for the day: $output"; false; }
  run node "$d/.claude/scripts/hq/policy-evidence.mjs" report --json
  printf '%s' "$output" > "$BATS_TEST_TMPDIR/after.json"
  run node "$FX/spine-probe.mjs" cell "$BATS_TEST_TMPDIR/after.json" session:interactive shell
  [[ "$output" =~ ^[0-9A-Z]{26}\ fresh\ true$ ]] || { echo "the refusal did not clear the bar: $output"; false; }
}

@test "paste: with the emitter missing, the hook still blocks with the same words" {
  local d="$BATS_TEST_TMPDIR/p-noemit"; _paste_root "$d" || return 1
  mv "$d/.claude/scripts/hq/arc-event.sh" "$d/arc-event.parked"
  run _hook "$d"
  [ "$status" -eq 2 ] && [[ "$output" == *"BLOCKED by policy"* && "$output" == *"refusal evidence not recorded"* ]] || { echo "$status $output"; false; }
}

@test "paste: the deny floor and the un-grantable list both name every evidence file" {
  local f
  for f in '.claude/scripts/hq/lib/policy-evidence/**' .claude/scripts/hq/policy-evidence.mjs .claude/scripts/hq/lib/validate-policy-refusal.mjs; do
    grep -qF "Edit(./$f)" "$PASTE/.claude/settings.json" && grep -qF "Write(./$f)" "$PASTE/.claude/settings.json" || { echo "deny floor misses $f"; false; }
    grep -qF "  - \"$f\"" "$PASTE/hq.policy.yaml" || { echo "ungrantable_resources misses $f"; false; }
  done
}

_verify_root() { # $1 dir: the six LIVE files, the manifest and the verifier, at their repo-relative paths
  local d="$1" rel
  mkdir -p "$d/initiatives/policy/evidence/phase-02"
  cp "$ARC_ROOT/initiatives/policy/evidence/phase-02/paste-manifest.json" "$ARC_ROOT/initiatives/policy/evidence/phase-02/verify-paste.mjs" "$d/initiatives/policy/evidence/phase-02/"
  for rel in hq.policy.yaml .claude/scripts/hq/lib/policy/lint.mjs .claude/scripts/hq/policy-lint.mjs .claude/scripts/hq/policy-hook.mjs \
             .claude/scripts/hq/lib/policy-evidence/fold.mjs .claude/settings.json; do
    mkdir -p "$d/$(dirname "$rel")"; cp "$ARC_ROOT/$rel" "$d/$rel"
  done
}

@test "verify --pre: a live file that drifted since generation refuses the copy, by name" {
  local d="$BATS_TEST_TMPDIR/v-pre"; _verify_root "$d"
  cd "$d"
  run node initiatives/policy/evidence/phase-02/verify-paste.mjs --pre
  [ "$status" -eq 0 ] && [[ "$output" != *"DIFFERS"* ]] || { echo "the untouched tree was refused: $output"; false; }
  printf "# drift\n" >> "$d/.claude/scripts/hq/policy-hook.mjs"
  run node initiatives/policy/evidence/phase-02/verify-paste.mjs --pre
  [ "$status" -eq 1 ] && [[ "$output" == *"DIFFERS  .claude/scripts/hq/policy-hook.mjs"* && "$output" == *"DO NOT copy"* ]] || { echo "drift not refused: $status $output"; false; }
}

@test "verify: a CRLF checkout of the same text reads the same, never DIFFERS" {
  local d="$BATS_TEST_TMPDIR/v-crlf"; _verify_root "$d"
  cd "$d"
  local f; f="$d/hq.policy.yaml"
  awk '{ printf "%s\r\n", $0 }' "$f" > "$f.crlf" && mv "$f.crlf" "$f"
  grep -q $'\r' "$f" || { echo "fixture is not CRLF"; false; }
  run node initiatives/policy/evidence/phase-02/verify-paste.mjs --pre
  [ "$status" -eq 0 ] && [[ "$output" != *"DIFFERS  hq.policy.yaml"* ]] || { echo "CRLF read as drift: $output"; false; }
}

@test "paste: policy-lint --evidence refuses a policy that is not the governing one" {
  local d="$BATS_TEST_TMPDIR/p-foreign"; _paste_root "$d" || return 1
  cp "$d/hq.policy.yaml" "$d/candidate.yaml"
  cd "$d"
  run node "$d/.claude/scripts/hq/policy-lint.mjs" candidate.yaml --evidence
  [ "$status" -eq 1 ] && [[ "$output" == *"judges the governing"* ]] || { echo "$status $output"; false; }
}

@test "paste: a decoy ARC_ROOT cannot redirect the refusal; it lands in the spine that was checked" {
  local d="$BATS_TEST_TMPDIR/p-decoy"; _paste_root "$d" || return 1
  mkdir -p "$BATS_TEST_TMPDIR/decoy/.claude/state/hq/events"
  export ARC_ROOT="$BATS_TEST_TMPDIR/decoy" CLAUDE_PROJECT_DIR="$BATS_TEST_TMPDIR/decoy"
  export ARC_POLICY_REFUSAL_TIMEOUT_MS=30000
  run _hook "$d"
  [ "$status" -eq 2 ] || { echo "$status $output"; false; }
  run node "$FX/spine-probe.mjs" refusals "$d/.claude/state/hq/events"
  [[ "$output" =~ ^REFUSALS\ 1\  ]] || { echo "the refusal did not land in the checked spine: $output"; false; }
  ! grep -rqs '"policy.refusal"' "$BATS_TEST_TMPDIR/decoy/.claude/state/hq/events/" || { echo "the refusal went to the decoy"; false; }
}

_hook_no_stderr() { _hook "$1" 2>&-; }

@test "paste: with stderr closed and the emitter gone, the block is unchanged (exit 2, same words)" {
  local d="$BATS_TEST_TMPDIR/p-closed"; _paste_root "$d" || return 1
  mv "$d/.claude/scripts/hq/arc-event.sh" "$d/arc-event.parked"
  run _hook_no_stderr "$d"
  [ "$status" -eq 2 ] && [[ "$output" == *"BLOCKED by policy"* && "$output" != *"policy-hook threw"* ]] || { echo "$status $output"; false; }
}

@test "suite count: every paste test registered (ASCII names)" {
  [ "${#BATS_TEST_NAMES[@]}" -eq 12 ] || { echo "registered ${#BATS_TEST_NAMES[@]}, expected 12"; false; }
}
