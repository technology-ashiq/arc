#!/usr/bin/env bats
# Phase 01 -- the composable-hook dispatcher (_dispatch.sh).
bats_require_minimum_version 1.5.0
load 'test_helper'

DISPATCH="$ARC_ROOT/.claude/hooks/_dispatch.sh"

setup() {
  CPD="$(mktemp -d)"
  mkdir -p "$CPD/.claude/hooks"
  export CLAUDE_PROJECT_DIR="$CPD"
}
teardown() { [ -n "${CPD:-}" ] && rm -rf "$CPD" 2>/dev/null || true; }

# _frag <event> <nn-name> <body...> -- write an executable fragment.
_frag() {
  local ev="$1" name="$2"; shift 2
  mkdir -p "$CPD/.claude/hooks/${ev}.d"
  printf '#!/usr/bin/env bash\n%s\n' "$*" > "$CPD/.claude/hooks/${ev}.d/${name}.sh"
}
_run_dispatch() { run bash -c ". '$DISPATCH'; arc_dispatch $*"; }

@test "dispatch: runs .d fragments in NN order (advisory)" {
  _frag adv 10-b 'echo B'
  _frag adv 00-a 'echo A'
  _run_dispatch adv advisory </dev/null
  [ "$status" -eq 0 ]
  [ "${lines[0]}" = "A" ]
  [ "${lines[1]}" = "B" ]
}

@test "dispatch: missing .d dir is a clean no-op (exit 0)" {
  _run_dispatch noevent advisory </dev/null
  [ "$status" -eq 0 ]
}

@test "dispatch: advisory event survives a failing fragment (exit 0)" {
  _frag adv 00-boom 'echo before; exit 1'
  _frag adv 10-after 'echo after'
  _run_dispatch adv advisory </dev/null
  [ "$status" -eq 0 ]
  [[ "$output" == *"before"* ]]
  [[ "$output" == *"after"* ]]   # a failing fragment must not stop the chain
}

@test "dispatch: blocking event propagates a fragment's exit 2 and stops" {
  _frag pre 00-block 'echo blocking >&2; exit 2'
  _frag pre 10-never 'echo SHOULD-NOT-RUN'
  _run_dispatch pre blocking </dev/null
  [ "$status" -eq 2 ]
  [[ "$output" != *"SHOULD-NOT-RUN"* ]]   # first block wins, chain stops
}

@test "dispatch: blocking event allows (exit 0) when no fragment blocks" {
  _frag pre 00-ok 'exit 0'
  _frag pre 10-ok 'exit 0'
  _run_dispatch pre blocking </dev/null
  [ "$status" -eq 0 ]
}

@test "dispatch: --payload feeds the captured stdin to each fragment" {
  _frag post 00-read 'cat'                       # echoes whatever stdin it got
  _run_dispatch post advisory --payload <<< 'HELLO-PAYLOAD'   # here-string: no pipe/subshell
  [ "$status" -eq 0 ]
  [[ "$output" == *"HELLO-PAYLOAD"* ]]
}

@test "dispatch: non-payload event never blocks on stdin (fragments get /dev/null)" {
  _frag adv 00-noread 'echo done'
  # no stdin provided at all -- must not hang; run with a closed stdin
  _run_dispatch adv advisory </dev/null
  [ "$status" -eq 0 ]
  [[ "$output" == *"done"* ]]
}

# ---- the real PreToolUse guard fragments (regression: the MS-Store python stub bug) ----

@test "guard: a destructive command is blocked (exit 2)" {
  export CLAUDE_PROJECT_DIR="$ARC_ROOT"
  run bash -c ". '$DISPATCH'; arc_dispatch PreToolUse blocking --payload" <<< '{"tool_input":{"command":"rm -rf /"}}'
  [ "$status" -eq 2 ]
  [[ "$output" == *"destructive-guard"* ]]
}

@test "guard: a normal command is allowed (exit 0)" {
  export CLAUDE_PROJECT_DIR="$ARC_ROOT"
  run bash -c ". '$DISPATCH'; arc_dispatch PreToolUse blocking --payload" <<< '{"tool_input":{"command":"ls -la"}}'
  [ "$status" -eq 0 ]
}

@test "guard: destructive is blocked even when extraction fails / payload isn't JSON (raw fail-safe)" {
  export CLAUDE_PROJECT_DIR="$ARC_ROOT"
  # jq + python both fail to parse -> the guard must scan the raw payload, never fail open
  run bash -c ". '$DISPATCH'; arc_dispatch PreToolUse blocking --payload" <<< 'noise rm -rf / noise'
  [ "$status" -eq 2 ]
}

@test "dispatcher: a missing _dispatch.sh fails open LOUDLY (exit 0 + warning, review W1)" {
  # $CPD (setup) has .claude/hooks but no _dispatch.sh -> a broken install must not brick
  # every Bash command, but the disarmed guard must be visible, never silent.
  run env CLAUDE_PROJECT_DIR="$CPD" bash "$ARC_ROOT/.claude/hooks/PreToolUse.sh" <<< '{"tool_input":{"command":"ls"}}'
  [ "$status" -eq 0 ]
  [[ "$output" == *"disarmed"* ]]
}

# ---- BS-4 (design lane, fifth attack pass): the payload must not depend on a writable TMPDIR ----
# The installed dispatcher kept the payload only in a mktemp file. With TMPDIR missing or
# unwritable every fragment's `< "$input"` redirect failed with exit 1, which blocking mode reads as
# ALLOW, so one bad environment variable disarmed every PreToolUse guard. .claude/hooks/** is
# edit-denied to agent sessions, so the fix is the canonical fixture below and the owner installs
# it; these cases drive the fixture, and the last one holds the installed copy to it.
DISPATCH_FIX="$ARC_ROOT/tests/fixtures/hooks/_dispatch.sh"
_payload_file() { printf '%s' "$1" > "$BATS_TEST_TMPDIR/payload.in"; }
# TMPDIR is broken INSIDE the dispatcher's shell only; the payload arrives from a file made before.
_run_fix() { run bash -c "set -uo pipefail; $1 . '$DISPATCH_FIX'; arc_dispatch $2" < "$BATS_TEST_TMPDIR/payload.in"; }
NO_TMP='TMPDIR=/nonexistent-arc-tmp/x; export TMPDIR;'

@test "dispatch fixture: an unwritable TMPDIR does not disarm a blocking fragment (BS-4)" {
  _frag pre 00-guard 'p="$(cat)"; case "$p" in *BLOCK-ME*) echo blocked >&2; exit 2;; esac; exit 0'
  _payload_file '{"tool_input":{"command":"BLOCK-ME"}}'
  _run_fix "$NO_TMP" "pre blocking --payload"
  [ "$status" -eq 2 ] || { echo "the guard never saw the payload: $output"; false; }
  _payload_file '{"tool_input":{"command":"ls"}}'
  _run_fix "$NO_TMP" "pre blocking --payload"
  [ "$status" -eq 0 ] || { echo "an ordinary payload was blocked: $output"; false; }
}

@test "dispatch fixture: ARC_HOOK_PAYLOAD is a copy when TMPDIR works, and unset when it does not" {
  _frag post 00-show 'if [ -n "${ARC_HOOK_PAYLOAD:-}" ]; then echo "copy=$(cat "$ARC_HOOK_PAYLOAD")"; else echo "copy=unset"; fi'
  _payload_file 'HELLO-COPY'
  _run_fix "" "post advisory --payload"
  [[ "$output" == *"copy=HELLO-COPY"* ]] || { echo "$output"; false; }
  _run_fix "$NO_TMP" "post advisory --payload"
  [[ "$output" == *"copy=unset"* ]] || { echo "ARC_HOOK_PAYLOAD pointed at a file that could not be written: $output"; false; }
}

@test "dispatch fixture: every fragment gets the whole payload, in order" {
  _frag post 00-a 'echo "A:$(cat)"'
  _frag post 10-b 'echo "B:$(cat)"'
  _payload_file 'SAME-PAYLOAD'
  _run_fix "" "post advisory --payload"
  [ "${lines[0]}" = "A:SAME-PAYLOAD" ] || { echo "$output"; false; }
  [ "${lines[1]}" = "B:SAME-PAYLOAD" ] || { echo "$output"; false; }
}

@test "dispatch fixture: a fragment's own exit counts, even when it never reads a large payload" {
  # Piping means a fragment that exits without reading can kill the writer with SIGPIPE; under
  # pipefail that status would have replaced the fragment's. Both directions are pinned.
  _payload_file "$(printf '%0200000d' 0)"
  _frag pre 00-noread 'exit 2'
  _run_fix "" "pre blocking --payload"
  [ "$status" -eq 2 ] || { echo "an exit 2 that ignored stdin was not a block: $output"; false; }
  rm -f "$CPD/.claude/hooks/pre.d/00-noread.sh"
  _frag pre 00-noread 'exit 0'
  _run_fix "" "pre blocking --payload"
  [ "$status" -eq 0 ] || { echo "an exit 0 that ignored stdin became status $status: $output"; false; }
  [[ "$output" != *"Broken pipe"* ]]
}

@test "dispatch: the installed dispatcher, once replaced, is the canonical fixture" {
  if grep -q 'cat > "$pf"' "$ARC_ROOT/.claude/hooks/_dispatch.sh"; then
    skip "OWNER ACTION PENDING: cp tests/fixtures/hooks/_dispatch.sh .claude/hooks/_dispatch.sh (BS-4)"
  fi
  cmp -s "$ARC_ROOT/.claude/hooks/_dispatch.sh" "$DISPATCH_FIX" \
    || { echo "the installed _dispatch.sh has the fix's shape but differs from the canonical fixture"; false; }
}
