#!/usr/bin/env bats
# Cycle 16 Phase 01 -- the ui-composer's BASH boundary (found by the lexos-p02 live demo).
#
# `ui-composer.md` declares `Bash(bash .claude/scripts/design/design-render.sh:*)`, meaning ONE
# entry point. On the live demo all three composers ran node, sed -i, python3, PowerShell and cmd
# through it, because a subagent's `tools:` field takes tool NAMES: the specifier granted all of
# Bash. Bash walks past both boundaries -- `cat` reads a sibling, `sed -i` writes anywhere, and
# `composer-scope-check.sh --end` releases the read boundary. Isolation held on that run only
# because no composer looked, which is compliance, not refusal.
#
# The documented per-subagent control is a PreToolUse hook, and a subagent's tool-call payload
# carries `agent_type` (measured 2026-09-17 with an owner-approved probe: present for a subagent,
# absent for the main session). So composer-bash-check.sh refuses, for `ui-composer` only, every
# Bash command except the renderer rendering the composer's OWN variant into its OWN session.
#
# The hook FRAGMENT lives under .claude/hooks/, which governance keeps edit-denied to this session,
# so its canonical content is tests/fixtures/hooks/PreToolUse.d/10-design-composer.sh. The sandbox
# installs that copy, and one case below stays RED until the owner installs it for real.
bats_require_minimum_version 1.5.0
load 'test_helper'

_bash_sandbox() {
  _arc_design_sandbox
  mkdir -p "$SANDBOX/docs/design/explore/lexos-v1/variant-a" "$SANDBOX/docs/design/explore/lexos-v1/variant-b" \
           "$SANDBOX/.claude/hooks/PreToolUse.d"
  printf 'page a\n' > "$SANDBOX/docs/design/explore/lexos-v1/variant-a/index.html"
  printf 'page b\n' > "$SANDBOX/docs/design/explore/lexos-v1/variant-b/index.html"
  cp "$ARC_ROOT/.claude/hooks/PreToolUse.sh" "$SANDBOX/.claude/hooks/"
  cp "$ARC_ROOT/tests/fixtures/hooks/PreToolUse.d/10-design-composer.sh" "$SANDBOX/.claude/hooks/PreToolUse.d/"
  [ -s "$SANDBOX/.claude/hooks/PreToolUse.d/10-design-composer.sh" ] || { echo "fixture fragment missing"; false; }
}
_arm_a() { bash "$SANDBOX/.claude/scripts/design/composer-scope-check.sh" --begin lexos-v1 variant-a >/dev/null; }

# A PreToolUse payload. $1 = agent_type ("" for the main session), $2 = tool, $3 = command.
_bp() {
  local c="$3"
  c="${c//\\/\\\\}"; c="${c//\"/\\\"}"; c="${c//$'\n'/\\n}"; c="${c//$'\r'/\\r}"
  if [ -n "$1" ]; then
    printf '{"session_id":"s","agent_id":"a1","agent_type":"%s","hook_event_name":"PreToolUse","tool_name":"%s","tool_input":{"command":"%s"}}' "$1" "$2" "$c"
  else
    printf '{"session_id":"s","hook_event_name":"PreToolUse","tool_name":"%s","tool_input":{"command":"%s"}}' "$2" "$c"
  fi
}
# Through the real dispatcher, with the payload on stdin -- the path production takes.
_hook() { run --separate-stderr bash -c 'bash "$0" <<< "$1"' "$SANDBOX/.claude/hooks/PreToolUse.sh" "$(_bp "$1" "$2" "$3")"; }

RENDER_A="bash .claude/scripts/design/design-render.sh docs/design/explore/lexos-v1/variant-a/index.html --mode explore --session lexos-v1--variant-a --iter 1 --viewport 1440x900"

teardown() { _arc_teardown; }

# ---------- who it applies to ----------

@test "composer bash: the MAIN session is untouched, even reading a sibling" {
  _bash_sandbox; _arm_a
  _hook "" Bash "cat docs/design/explore/lexos-v1/variant-b/index.html"
  [ "$status" -eq 0 ] || { echo "the operator was scoped like a composer: $stderr"; false; }
}

@test "composer bash: another subagent type is untouched" {
  _bash_sandbox; _arm_a
  _hook Explore Bash "node -e 1"
  [ "$status" -eq 0 ] || { echo "a non-composer subagent was scoped: $stderr"; false; }
}

@test "composer bash: a composer's non-Bash tool call is not this boundary's business" {
  _bash_sandbox; _arm_a
  run --separate-stderr bash -c 'bash "$0" <<< "$1"' "$SANDBOX/.claude/hooks/PreToolUse.sh" \
    '{"agent_type":"ui-composer","tool_name":"WebFetch","tool_input":{"url":"https://example.com"}}'
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
}

# ---------- the one entry point ----------

@test "composer bash: rendering its OWN variant into its OWN session is allowed" {
  _bash_sandbox; _arm_a
  _hook ui-composer Bash "$RENDER_A"
  [ "$status" -eq 0 ] || { echo "the one permitted command was refused: $stderr"; false; }
  _hook ui-composer Bash "bash .claude/scripts/design/design-render.sh docs/design/explore/lexos-v1/variant-a/index.html --mode explore --session lexos-v1--variant-a --iter 2 --viewport 390x844"
  [ "$status" -eq 0 ] || { echo "the mobile render was refused: $stderr"; false; }
}

# ---------- what it refuses (the composers' real commands, and the escapes) ----------

@test "composer bash: the commands the live-demo composers actually ran are refused" {
  _bash_sandbox; _arm_a
  local c
  for c in 'node -e "console.log(process.version)"' \
           "sed -i 's/a/b/' docs/design/explore/lexos-v1/variant-a/index.html" \
           "python3 -c 'print(1)'" \
           'powershell -NoProfile -Command "Get-ChildItem C:\Windows\Fonts"' \
           "ls .claude/state/design/renders/" \
           "head -50 .claude/scripts/design/design-render.sh"; do
    _hook ui-composer Bash "$c"
    [ "$status" -eq 2 ] || { echo "allowed: $c"; false; }
  done
  printf '%s\n' "$stderr" | grep -q "ui-composer" || { echo "refused without saying why: $stderr"; false; }
}

@test "composer bash: reading a sibling and releasing the boundary through Bash are refused" {
  _bash_sandbox; _arm_a
  _hook ui-composer Bash "cat docs/design/explore/lexos-v1/variant-b/index.html"
  [ "$status" -eq 2 ] || { echo "a composer read a sibling through Bash: $stderr"; false; }
  _hook ui-composer Bash "bash .claude/scripts/design/composer-scope-check.sh --end"
  [ "$status" -eq 2 ] || { echo "a composer released its own boundary: $stderr"; false; }
  [ -f "$SANDBOX/.claude/state/design/composer-session--lexos-v1--variant-a" ] || { echo "the marker is gone"; false; }
}

@test "composer bash: the render command cannot carry a second command" {
  _bash_sandbox; _arm_a
  local c
  for c in "$RENDER_A; cat docs/design/explore/lexos-v1/variant-b/index.html" \
           "$RENDER_A && cat docs/design/explore/lexos-v1/variant-b/index.html" \
           "$RENDER_A | tee x" \
           "$RENDER_A > docs/x" \
           "$RENDER_A \$(cat docs/design/explore/lexos-v1/variant-b/index.html)" \
           "$RENDER_A \`id\`" \
           "$RENDER_A"$'\n'"cat docs/design/explore/lexos-v1/variant-b/index.html" \
           "cd . && $RENDER_A"; do
    _hook ui-composer Bash "$c"
    [ "$status" -eq 2 ] || { echo "allowed a compound command: $c"; false; }
  done
}

@test "composer bash: the renderer cannot be pointed at a sibling or another session" {
  _bash_sandbox; _arm_a
  # Rendering variant-b into variant-a's own session would put a sibling's pixels where the
  # composer is ALLOWED to read -- a leak through the one permitted entry point.
  _hook ui-composer Bash "bash .claude/scripts/design/design-render.sh docs/design/explore/lexos-v1/variant-b/index.html --mode explore --session lexos-v1--variant-a --iter 1"
  [ "$status" -eq 2 ] || { echo "rendered a sibling into its own session: $stderr"; false; }
  _hook ui-composer Bash "bash .claude/scripts/design/design-render.sh docs/design/explore/lexos-v1/variant-a/index.html --mode explore --session lexos-v1--variant-b --iter 1"
  [ "$status" -eq 2 ] || { echo "rendered into a sibling's session: $stderr"; false; }
  _hook ui-composer Bash "bash .claude/scripts/design/design-render.sh docs/design/explore/lexos-v1/variant-a/../variant-b/index.html --mode explore --session lexos-v1--variant-a --iter 1"
  [ "$status" -eq 2 ] || { echo "a traversal route was allowed: $stderr"; false; }
  _hook ui-composer Bash "bash .claude/scripts/design/design-render.sh docs/design/explore/lexos-v1/variant-a/index.html --mode critique --session lexos-v1--variant-a"
  [ "$status" -eq 2 ] || { echo "a non-explore mode was allowed: $stderr"; false; }
  _hook ui-composer Bash "bash .claude/scripts/design/design-render.sh docs/design/explore/lexos-v1/variant-a/index.html --mode explore --session lexos-v1--variant-a --out /tmp/x"
  [ "$status" -eq 2 ] || { echo "an unknown flag was allowed: $stderr"; false; }
}

@test "composer bash: with NO composer boundary armed, a composer runs nothing" {
  _bash_sandbox
  # The renderer route is judged against the armed marker. No marker means no variant to own,
  # and a composer outside an explore has nothing to render.
  _hook ui-composer Bash "$RENDER_A"
  [ "$status" -eq 2 ] || { echo "a composer ran Bash with no boundary armed: $stderr"; false; }
}

@test "composer bash: an unparseable composer command fails CLOSED" {
  _bash_sandbox; _arm_a
  run --separate-stderr bash -c 'bash "$0" <<< "$1"' "$SANDBOX/.claude/hooks/PreToolUse.sh" \
    '{"agent_type":"ui-composer","tool_name":"Bash","tool_input":{}}'
  [ "$status" -eq 2 ] || { echo "a composer Bash call with no readable command was allowed: $stderr"; false; }
}

@test "composer bash: a main-session command that merely MENTIONS ui-composer is untouched" {
  _bash_sandbox; _arm_a
  _hook "" Bash 'grep -n "\"agent_type\":\"ui-composer\"" x.json'
  [ "$status" -eq 0 ] || { echo "text inside a command was read as identity: $stderr"; false; }
}

# ---------- the owner's half ----------

@test "composer bash: the real hook fragment is installed and matches the canonical fixture" {
  # RED ON PURPOSE until the owner installs it. .claude/hooks/** is edit-denied to this session by
  # governance, so the fragment cannot be written from here. One command closes this:
  #   cp tests/fixtures/hooks/PreToolUse.d/10-design-composer.sh .claude/hooks/PreToolUse.d/10-design-composer.sh
  [ -f "$ARC_ROOT/.claude/hooks/PreToolUse.d/10-design-composer.sh" ] || {
    echo "not installed: the composer Bash boundary is unwired in production until the owner runs the cp above"; false; }
  cmp -s "$ARC_ROOT/.claude/hooks/PreToolUse.d/10-design-composer.sh" \
         "$ARC_ROOT/tests/fixtures/hooks/PreToolUse.d/10-design-composer.sh" || {
    echo "installed, but it differs from the canonical fixture"; false; }
}
