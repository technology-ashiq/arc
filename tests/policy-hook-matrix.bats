#!/usr/bin/env bats
# Phase 00 -- the hook-interception feasibility matrix and ADR-0501's four fail-open modes.
#
# This is the file that talks to the REAL dispatcher. `.claude/hooks/_dispatch.sh` documents its
# own contract -- "blocking -- a fragment exiting 2 blocks the event (first block wins, chain
# stops); any other exit is ignored, FAIL-OPEN" -- and ADR-0501 was written from the platform
# docs before anyone read that comment. These tests confirm the repo agrees with the docs rather
# than assuming it does, which is the whole point of the feasibility matrix.
#
# Isolation is by CLAUDE_PROJECT_DIR: arc_dispatch resolves its fragment directory from that
# variable, so a test points it at a temp tree and installs whatever fragments it likes without
# touching the repo hooks.
#
# ASCII-only test names; the file asserts its own registered count at the bottom.
bats_require_minimum_version 1.5.0
load 'test_helper'

setup() {
  SANDBOX="$BATS_TEST_TMPDIR/proj"
  mkdir -p "$SANDBOX/.claude/hooks/PreToolUse.d"
  cp "$ARC_ROOT/.claude/hooks/_dispatch.sh" "$SANDBOX/.claude/hooks/"
  cp "$ARC_ROOT/.claude/hooks/PreToolUse.sh" "$SANDBOX/.claude/hooks/"
  PAYLOAD='{"tool_name":"Bash","tool_input":{"command":"rm -rf /"}}'
}

_fire() { printf '%s' "$PAYLOAD" | CLAUDE_PROJECT_DIR="$SANDBOX" bash "$SANDBOX/.claude/hooks/PreToolUse.sh"; }

_frag() { # $1 = NN-name.sh, stdin = body
  cat > "$SANDBOX/.claude/hooks/PreToolUse.d/$1"
  chmod +x "$SANDBOX/.claude/hooks/PreToolUse.d/$1" 2>/dev/null || true
}

@test "a fragment exiting 2 blocks the tool call" {
  printf '#!/usr/bin/env bash\nexit 2\n' | _frag "10-block.sh"
  run _fire
  [ "$status" -eq 2 ]
}

@test "with no fragments at all the dispatcher allows" {
  run _fire
  [ "$status" -eq 0 ]
}

@test "FAIL-OPEN mode 1 -- a fragment that crashes with exit 1 lets the tool through" {
  printf '#!/usr/bin/env bash\nexit 1\n' | _frag "10-crash.sh"
  run _fire
  [ "$status" -eq 0 ]
}

@test "FAIL-OPEN mode 2 -- an arbitrary non-2 exit lets the tool through" {
  printf '#!/usr/bin/env bash\nexit 7\n' | _frag "10-seven.sh"
  run _fire
  [ "$status" -eq 0 ]
}

@test "FAIL-OPEN mode 3 -- a fragment whose interpreter is missing lets the tool through" {
  printf '#!/usr/bin/env no-such-interpreter-anywhere\nexit 2\n' | _frag "10-nointerp.sh"
  run _fire
  [ "$status" -eq 0 ]
}

@test "FAIL-OPEN mode 4 -- malformed JSON on stdin does not by itself block" {
  printf '#!/usr/bin/env bash\ncat >/dev/null\nexit 0\n' | _frag "10-passthru.sh"
  run bash -c "printf 'not json at all' | CLAUDE_PROJECT_DIR='$SANDBOX' bash '$SANDBOX/.claude/hooks/PreToolUse.sh'"
  [ "$status" -eq 0 ]
}

@test "FAIL-OPEN mode 5 -- a missing dispatcher disarms the guards and says so loudly" {
  printf '#!/usr/bin/env bash\nexit 2\n' | _frag "10-block.sh"
  rm -f "$SANDBOX/.claude/hooks/_dispatch.sh"
  run _fire
  [ "$status" -eq 0 ]
  [[ "$output" == *"disarmed"* ]]
}

@test "the first blocking fragment wins and the chain stops" {
  printf '#!/usr/bin/env bash\nexit 2\n' | _frag "10-block.sh"
  printf '#!/usr/bin/env bash\necho SECOND-RAN >&2\nexit 0\n' | _frag "20-after.sh"
  run _fire
  [ "$status" -eq 2 ]
  [[ "$output" != *"SECOND-RAN"* ]]
}

@test "a fragment that throws internally must exit 2, not leak its error as fail-open" {
  # The policy fragment contract: its own failure denies. This is the shape Phase 2 must ship.
  printf '#!/usr/bin/env bash\nset -e\nfalse || exit 2\n' | _frag "10-selferror.sh"
  run _fire
  [ "$status" -eq 2 ]
}

@test "the matrix generator refuses a server it cannot classify" {
  cd "$ARC_ROOT"
  local mcp="$BATS_TEST_TMPDIR/mcp.json"
  printf '{"mcpServers":{"mystery-server":{"command":"x"}}}' > "$mcp"
  run node .claude/scripts/hq/policy-matrix.mjs --from "$mcp"
  [ "$status" -eq 2 ]
}

@test "the matrix covers every server declared in the repo mcp config" {
  cd "$ARC_ROOT"
  run node .claude/scripts/hq/policy-matrix.mjs --from .mcp.json --out "$BATS_TEST_TMPDIR/m.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run node --input-type=module -e "
    const fs = await import('node:fs');
    const rows = JSON.parse(fs.readFileSync('$BATS_TEST_TMPDIR/m.json','utf8'));
    const declared = Object.keys(JSON.parse(fs.readFileSync('.mcp.json','utf8')).mcpServers);
    const covered = new Set(rows.filter(r => r.surface === 'mcp').map(r => r.server));
    const missing = declared.filter(s => !covered.has(s));
    if (missing.length) throw new Error('servers with no matrix row: ' + missing.join(','));
    const unverdicted = rows.filter(r => !r.verdict || !r.capability || r.capability.length === 0);
    if (unverdicted.length) throw new Error(unverdicted.length + ' rows without a verdict or capability');
    console.log('matrix rows=' + rows.length + ' servers=' + declared.length);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"matrix rows="* ]]
}

@test "every built-in side-effect tool class has a matrix row" {
  cd "$ARC_ROOT"
  run node .claude/scripts/hq/policy-matrix.mjs --from .mcp.json --out "$BATS_TEST_TMPDIR/m2.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run node --input-type=module -e "
    const fs = await import('node:fs');
    const rows = JSON.parse(fs.readFileSync('$BATS_TEST_TMPDIR/m2.json','utf8'));
    const builtin = new Set(rows.filter(r => r.surface === 'builtin').map(r => r.tool));
    for (const t of ['Bash','Write','Edit'])
      if (!builtin.has(t)) throw new Error('no matrix row for built-in tool ' + t);
    console.log('builtin rows ok');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"builtin rows ok"* ]]
}

@test "this file registered every test it declares" {
  [ "${#BATS_TEST_NAMES[@]}" -eq 13 ] || {
    echo "registered ${#BATS_TEST_NAMES[@]} tests, expected 13 -- a @test was silently dropped"
    false
  }
}
