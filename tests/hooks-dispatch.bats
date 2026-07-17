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
