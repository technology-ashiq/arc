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
# A payload written by hand, for the shapes _bp cannot build (duplicate keys, escapes).
_hook_raw() { run --separate-stderr bash -c 'bash "$0" <<< "$1"' "$SANDBOX/.claude/hooks/PreToolUse.sh" "$1"; }

RENDER_A="bash .claude/scripts/design/design-render.sh docs/design/explore/lexos-v1/variant-a/index.html --mode explore --session lexos-v1--variant-a --iter 1 --viewport 1440x900"
RENDER_A_BARE="bash .claude/scripts/design/design-render.sh docs/design/explore/lexos-v1/variant-a/index.html --mode explore --session lexos-v1--variant-a"
RENDER_B_INTO_B="bash .claude/scripts/design/design-render.sh docs/design/explore/lexos-v1/variant-b/index.html --mode explore --session lexos-v1--variant-b"
CAT_B="cat docs/design/explore/lexos-v1/variant-b/index.html"

# Proves the boundary is LIVE in this sandbox: a composer reading a sibling is refused. Every case
# whose own assertion is "allowed" calls this too, because an allow is also what a deleted or
# unreachable check produces (fifth attack pass, BS-8).
_live() {
  _hook ui-composer Bash "$CAT_B"
  [ "$status" -eq 2 ] || { echo "the boundary is not live in this sandbox, so an allow here proves nothing: $stderr"; false; }
}
_scope() { bash "$SANDBOX/.claude/scripts/design/composer-scope-check.sh" "$@" >/dev/null; }

teardown() { _arc_teardown; }

# ---------- who it applies to ----------

@test "composer bash: the MAIN session is untouched, even reading a sibling" {
  _bash_sandbox; _arm_a
  _hook "" Bash "cat docs/design/explore/lexos-v1/variant-b/index.html"
  [ "$status" -eq 0 ] || { echo "the operator was scoped like a composer: $stderr"; false; }
  _live
}

@test "composer bash: another subagent type is untouched" {
  _bash_sandbox; _arm_a
  _hook Explore Bash "node -e 1"
  [ "$status" -eq 0 ] || { echo "a non-composer subagent was scoped: $stderr"; false; }
  _live
}

@test "composer bash: a composer's non-Bash tool call is not this boundary's business" {
  _bash_sandbox; _arm_a
  run --separate-stderr bash -c 'bash "$0" <<< "$1"' "$SANDBOX/.claude/hooks/PreToolUse.sh" \
    '{"agent_type":"ui-composer","tool_name":"WebFetch","tool_input":{"url":"https://example.com"}}'
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  _live
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
  _live
}

# ---------- the fifth attack pass (2026-09-17): each case below is a mutant or a hole it found ----------

@test "composer bash: shell syntax riding INSIDE the page word is refused" {
  # Every compound case above put its injection after the flags, where a different check refused
  # it first -- so deleting the alphabet check left the suite green (mutant M1).
  _bash_sandbox; _arm_a
  local c
  for c in 'bash .claude/scripts/design/design-render.sh docs/design/explore/lexos-v1/variant-a/index.html;cat${IFS}docs/design/explore/lexos-v1/variant-b/index.html --mode explore --session lexos-v1--variant-a' \
           'bash .claude/scripts/design/design-render.sh docs/design/explore/lexos-v1/variant-a/index.html&&id --mode explore --session lexos-v1--variant-a' \
           'bash .claude/scripts/design/design-render.sh docs/design/explore/lexos-v1/variant-a/index.html>x --mode explore --session lexos-v1--variant-a' \
           'bash .claude/scripts/design/design-render.sh docs/design/explore/lexos-v1/variant-a/$(id).html --mode explore --session lexos-v1--variant-a'; do
    _hook ui-composer Bash "$c"
    [ "$status" -eq 2 ] || { echo "allowed: $c"; false; }
    printf '%s' "$stderr" | grep -q 'outside the renderer' || { echo "refused for another reason, so the alphabet is unpinned: $stderr"; false; }
  done
}

@test "composer bash: a trailing flag with no value refuses by name" {
  # Mutant M2: without the arity check, `shift 2` on one argument never advances.
  _bash_sandbox; _arm_a
  _hook ui-composer Bash "$RENDER_A_BARE --iter"
  [ "$status" -eq 2 ]
  printf '%s' "$stderr" | grep -q "the flag '--iter' has no value"
}

@test "composer bash: two armed boundaries refuse, even when the last one names the target" {
  # Mutant M3: loosened to "at least one", the last marker in glob order (variant-b) won.
  _bash_sandbox
  _scope --begin lexos-v1 variant-b
  cp "$SANDBOX/.claude/state/design/composer-session--lexos-v1--variant-b" "$BATS_TEST_TMPDIR/marker-b"
  _scope --end lexos-v1 variant-b
  _arm_a
  cp "$BATS_TEST_TMPDIR/marker-b" "$SANDBOX/.claude/state/design/composer-session--lexos-v1--variant-b"
  _hook ui-composer Bash "$RENDER_B_INTO_B"
  [ "$status" -eq 2 ] || { echo "rendered variant-b with two boundaries armed: $stderr"; false; }
  printf '%s' "$stderr" | grep -q 'more than one composer boundary is armed'
}

@test "composer bash: a marker whose filename disagrees with its content is not a boundary" {
  # Mutant M4: a plain read of the marker's fields accepted a .bak copy naming variant-b.
  _bash_sandbox
  _scope --begin lexos-v1 variant-b
  mv "$SANDBOX/.claude/state/design/composer-session--lexos-v1--variant-b" \
     "$SANDBOX/.claude/state/design/composer-session--lexos-v1--variant-b.bak"
  _hook ui-composer Bash "$RENDER_B_INTO_B"
  [ "$status" -eq 2 ] || { echo "a .bak marker armed a boundary: $stderr"; false; }
  printf '%s' "$stderr" | grep -q 'malformed'
}

@test "composer bash: with core/common.sh gone, a composer's render refuses" {
  # Mutant M7: that refusal turned into `exit 0` and the suite stayed green.
  _bash_sandbox; _arm_a
  rm -f "$SANDBOX/.claude/scripts/core/common.sh"
  _hook ui-composer Bash "$RENDER_A"
  [ "$status" -eq 2 ]
  printf '%s' "$stderr" | grep -q 'common.sh cannot be loaded'
}

@test "composer bash: a broken jq is not a working one -- the grep reader decides, and still refuses" {
  # BL-3: the parser was chosen by `command -v jq`, so a jq that exits 127 read the identity as
  # empty and let a composer through. Driving the grep reader here also pins it (mutant M9, which
  # only showed while jq was absent).
  _bash_sandbox; _arm_a
  mkdir -p "$SANDBOX/badbin"
  printf '#!/bin/sh\nexit 127\n' > "$SANDBOX/badbin/jq"
  chmod +x "$SANDBOX/badbin/jq"
  PATH="$SANDBOX/badbin:$PATH"; export PATH
  command -v jq | grep -q badbin || { echo "the broken jq is not the one found first"; false; }
  _hook ui-composer Bash "$CAT_B"
  [ "$status" -eq 2 ] || { echo "a broken jq let a composer read a sibling: $stderr"; false; }
  # The grep reader's own refusals, which only this case drives: a value it cannot read exactly
  # comes back empty, and empty must refuse (seventh attack pass, surviving mutant SM1).
  _hook_raw '{"agent_type":["ui-composer"],"tool_name":"Bash","tool_input":{"command":"'"$CAT_B"'"}}'
  [ "$status" -eq 2 ] || { echo "grep reader: a non-string identity was allowed: $stderr"; false; }
  _hook_raw '{"agent_type":"ui-composer\r","tool_name":"Bash","tool_input":{"command":"'"$CAT_B"'"}}'
  [ "$status" -eq 2 ] || { echo "grep reader: an escaped identity was allowed: $stderr"; false; }
  _hook ui-composer Bash "$RENDER_A"
  [ "$status" -eq 0 ] || { echo "the grep reader could not read an ordinary composer render: $stderr"; false; }
  _hook "" Bash "$CAT_B"
  [ "$status" -eq 0 ] || { echo "the main session was scoped under a broken jq: $stderr"; false; }
  # Eighth attack pass, all without jq. A main-session command that NAMES the composer still runs
  # (mutant MU4); a duplicate identity refuses in both orders (MU1); an escaped key or a key split
  # from its colon cannot be read by grep, and refuses (MU3, B).
  _hook "" Bash "grep -rn ui-composer .claude/agents"
  [ "$status" -eq 0 ] || { echo "no jq: a main-session mention was scoped: $stderr"; false; }
  _hook_raw '{"agent_type":"Explore","agent_type":"ui-composer","tool_name":"Bash","tool_input":{"command":"'"$CAT_B"'"}}'
  [ "$status" -eq 2 ] || { echo "no jq: duplicate identity, composer last: $stderr"; false; }
  _hook_raw '{"agent_type":"ui-composer","agent_type":"Explore","tool_name":"Bash","tool_input":{"command":"'"$CAT_B"'"}}'
  [ "$status" -eq 2 ] || { echo "no jq: duplicate identity, composer first: $stderr"; false; }
  local bs='\' nl='
'
  _hook_raw '{"agent'"${bs}"'u005ftype":"ui-composer","tool_name":"Bash","tool_input":{"command":"'"$CAT_B"'"}}'
  [ "$status" -eq 2 ] || { echo "no jq: an escaped key hid the composer: $stderr"; false; }
  _hook_raw '{"agent_type"'"$nl"':"ui-composer","tool_name":"Bash","tool_input":{"command":"'"$CAT_B"'"}}'
  [ "$status" -eq 2 ] || { echo "no jq: a key split from its colon hid the composer: $stderr"; false; }
  # Ninth attack pass, without jq: a re-cased identity must still count as naming the composer
  # (mutant M28), and the grep reader caps the command itself (M13) -- this 33 KB call is under
  # the payload cap, so only the reader's own cap can refuse it by length.
  _hook_raw '{"agent_type":"UI-Composer","tool_name":"Bash","tool_input":{"command":"'"$CAT_B"'"}}'
  [ "$status" -eq 2 ] || { echo "no jq: a re-cased composer read a sibling: $stderr"; false; }
  local pad="" i=0
  while [ "$i" -lt 3000 ]; do pad="$pad --pin-font"; i=$((i + 1)); done
  _hook ui-composer Bash "$RENDER_A_BARE$pad"
  [ "$status" -eq 2 ]
  printf '%s' "$stderr" | grep -q 'longer than any render' || { echo "no jq: refused, but not by the reader's cap: $stderr"; false; }
}

@test "composer bash: an identity jq can decode but a filter cannot see is still the composer" {
  # Eighth attack pass. F: a second identity spelled with an escape dodged the duplicate count, so
  # it is counted from jq's stream. G: an identity spelled with an escape never showed the word the
  # prefilter looks for. D: a control character inside the identity read as "someone else". MU5:
  # extra CRs around the identity.
  _bash_sandbox; _arm_a
  local bs='\'
  _hook_raw '{"agent'"${bs}"'u005ftype":"ui-composer","agent_type":"Explore","tool_name":"Bash","tool_input":{"command":"'"$CAT_B"'"}}'
  [ "$status" -eq 2 ] || { echo "an escaped duplicate identity was allowed: $stderr"; false; }
  _hook_raw '{"agent_type":"ui-compos'"${bs}"'u0065r","tool_name":"Bash","tool_input":{"command":"'"$CAT_B"'"}}'
  [ "$status" -eq 2 ] || { echo "an escaped identity skipped the prefilter: $stderr"; false; }
  _hook_raw '{"agent_type":"ui-composer'"${bs}"'u000b","tool_name":"Bash","tool_input":{"command":"'"$CAT_B"'"}}'
  [ "$status" -eq 2 ] || { echo "a control character in the identity was read as someone else: $stderr"; false; }
  _hook_raw '{"agent_type":"ui-composer","tool_name":"Bash'"${bs}"'u000b","tool_input":{"command":"'"$CAT_B"'"}}'
  [ "$status" -eq 2 ] || { echo "a control character in the tool name was read as another tool: $stderr"; false; }
  _hook_raw '{"agent_type":"ui-composer\r\r","tool_name":"Bash\r","tool_input":{"command":"'"$CAT_B"'"}}'
  [ "$status" -eq 2 ] || { echo "CRs around the identity hid the composer: $stderr"; false; }
  # And an ordinary escape in someone else's payload is still not scoped.
  _hook_raw '{"agent_type":"Explore","tool_name":"Bash","tool_input":{"command":"echo caf'"${bs}"'u00e9"}}'
  [ "$status" -eq 0 ] || { echo "an escape in another agent's command was scoped: $stderr"; false; }
}

@test "composer bash: a key the grep reader cannot see is still read, and a duplicate tool refuses" {
  # Seventh attack pass. F4: a key spelled with a JSON escape, or split from its colon by a line
  # break, was invisible to the raw count and read as ABSENT, so a composer went through. SM5: a
  # tool_name given twice was never tested.
  _bash_sandbox; _arm_a
  local bs='\' nl='
'
  _hook_raw '{"agent'"${bs}"'u005ftype":"ui-composer","tool_name":"Bash","tool_input":{"command":"'"$CAT_B"'"}}'
  [ "$status" -eq 2 ] || { echo "an escaped key name hid the composer: $stderr"; false; }
  _hook_raw '{"agent_type"'"$nl"':"ui-composer","tool_name":"Bash","tool_input":{"command":"'"$CAT_B"'"}}'
  [ "$status" -eq 2 ] || { echo "a line break before the colon hid the composer: $stderr"; false; }
  _hook_raw '{"agent_type":"ui-composer","tool_name":"Bash","tool_name":"Read","tool_input":{"command":"'"$CAT_B"'"}}'
  [ "$status" -eq 2 ] || { echo "a duplicate tool_name was allowed: $stderr"; false; }
}

@test "composer bash: a duplicate identity is a duplicate whatever shape its copies take" {
  # Ninth attack pass: a copy holding an array was invisible to the leaf count, and a null copy
  # was read as absent (mutant M3). Every leaf under the key is counted now.
  _bash_sandbox; _arm_a
  _hook_raw '{"agent_type":["ui-composer"],"agent_type":"Explore","tool_name":"Bash","tool_input":{"command":"'"$CAT_B"'"}}'
  [ "$status" -eq 2 ] || { echo "an array copy of the identity was not counted: $stderr"; false; }
  _hook_raw '{"agent_type":"ui-composer","agent_type":null,"tool_name":"Bash","tool_input":{"command":"'"$CAT_B"'"}}'
  [ "$status" -eq 2 ] || { echo "a null copy made the composer absent: $stderr"; false; }
}

@test "composer bash: an escape jq rejects, or an odd agent name, does not scope someone else's call" {
  # Ninth attack pass, both attackers (REALISTIC): parsing every payload that carries an escape
  # made a lone surrogate in the MAIN session's command, or an agent name outside the plain
  # alphabet, refuse -- running defects #19 and #26 again. Only a call that could be the
  # composer's refuses when its identity cannot be read.
  _bash_sandbox; _arm_a
  local bs='\'
  _hook_raw '{"session_id":"s","tool_name":"Bash","tool_input":{"command":"printf x'"${bs}"'ud800y"}}'
  [ "$status" -eq 0 ] || { echo "a lone surrogate blocked the main session: $stderr"; false; }
  _hook_raw '{"agent_type":"Explore","tool_name":"Bash","tool_input":{"command":"printf x'"${bs}"'ud800y"}}'
  [ "$status" -eq 0 ] || { echo "a lone surrogate blocked another agent: $stderr"; false; }
  _hook_raw '{"agent_type":"tools@market:helper","tool_name":"Bash","tool_input":{"command":"printf '"${bs}"'u001b"}}'
  [ "$status" -eq 0 ] || { echo "an agent name outside the plain alphabet was scoped: $stderr"; false; }
  _live
}

@test "composer bash: a jq definitions file in HOME cannot change what the check measures" {
  # Ninth attack pass: jq loads $HOME/.jq on its own, and a `length` redefined there waved a long
  # command under the cap. The check runs jq with HOME pointed nowhere.
  _bash_sandbox; _arm_a
  mkdir -p "$BATS_TEST_TMPDIR/jqhome"
  printf 'def length: 1;\n' > "$BATS_TEST_TMPDIR/jqhome/.jq"
  HOME="$BATS_TEST_TMPDIR/jqhome"; export HOME
  local pad="" i=0
  while [ "$i" -lt 100 ]; do pad="$pad --pin-font"; i=$((i + 1)); done
  _hook ui-composer Bash "$RENDER_A_BARE$pad"
  [ "$status" -eq 2 ]
  printf '%s' "$stderr" | grep -q 'longer than any render' || { echo "a HOME .jq changed the length the cap read: $stderr"; false; }
}

@test "composer bash: a control-character escape scopes a composer only, never the main session" {
  # F1, running defect #19: the escape check ran before the identity was known, so the MAIN
  # session's own probe of this hook -- mentioning UI-Composer beside an escaped NUL -- was blocked.
  _bash_sandbox; _arm_a
  local bs='\'
  _hook_raw '{"session_id":"s","tool_name":"Bash","tool_input":{"command":"bash .claude/hooks/PreToolUse.sh","description":"Probe the UI-Composer hook with an escaped NUL ('"${bs}"'u0000)"}}'
  [ "$status" -eq 0 ] || { echo "the main session was blocked: $stderr"; false; }
  _hook_raw '{"agent_type":"Explore","tool_name":"Bash","tool_input":{"command":"grep -rn ui-composer '"${bs}${bs}"'u001b tests"}}'
  [ "$status" -eq 0 ] || { echo "another agent was blocked: $stderr"; false; }
  _live
}

@test "composer bash: a carriage return inside a composer's command is refused, not stripped" {
  # F5: every CR was stripped from the command, so the command checked was not the command run.
  _bash_sandbox; _arm_a
  _hook_raw '{"agent_type":"ui-composer","tool_name":"Bash","tool_input":{"command":"ba\rsh .claude/scripts/design/design-render.sh docs/design/explore/lexos-v1/variant-a/index.html --mode explore --session lexos-v1--variant-a"}}'
  [ "$status" -eq 2 ] || { echo "a CR inside the command was stripped and allowed: $stderr"; false; }
  printf '%s' "$stderr" | grep -qE 'outside the renderer|could not be read'
}

@test "composer bash: an identity or command that cannot be read exactly refuses" {
  _bash_sandbox; _arm_a
  local bs='\'
  # A duplicated key: jq read the last copy and grep the first, so the two readers disagreed (BL-7).
  _hook_raw '{"agent_type":"Explore","agent_id":"x","agent_type":"ui-composer","tool_name":"Bash","tool_input":{"command":"'"$CAT_B"'"}}'
  [ "$status" -eq 2 ] || { echo "duplicate agent_type, composer last: $stderr"; false; }
  _hook_raw '{"agent_type":"ui-composer","agent_id":"x","agent_type":"Explore","tool_name":"Bash","tool_input":{"command":"'"$CAT_B"'"}}'
  [ "$status" -eq 2 ] || { echo "duplicate agent_type, composer first: $stderr"; false; }
  # An escaped control character: jq decodes it and bash drops a NUL silently (BL-7).
  _hook_raw '{"agent_type":"ui-composer","tool_name":"Bash","tool_input":{"command":"bash .claude/scripts/design/design-render.sh docs/design/explore/lexos-v1/variant-a/index.html'"${bs}"'u0000 --mode explore --session lexos-v1--variant-a"}}'
  [ "$status" -eq 2 ] || { echo "an escaped NUL in the command was allowed: $stderr"; false; }
  # An identity that is not a string.
  _hook_raw '{"agent_type":["ui-composer"],"tool_name":"Bash","tool_input":{"command":"'"$CAT_B"'"}}'
  [ "$status" -eq 2 ] || { echo "a non-string identity was allowed: $stderr"; false; }
}

@test "composer bash: a re-cased, namespaced or CR-trailed ui-composer is still the composer" {
  # BL-9 and BS-11: an exact match let `arc:ui-composer` or `ui-composer<CR>` walk past silently.
  _bash_sandbox; _arm_a
  local a
  for a in 'UI-Composer' 'arc:ui-composer' 'ui-composer ' 'ui-composer\r'; do
    _hook_raw '{"agent_type":"'"$a"'","tool_name":"Bash","tool_input":{"command":"'"$CAT_B"'"}}'
    [ "$status" -eq 2 ] || { echo "agent_type '$a' read a sibling: $stderr"; false; }
  done
  _hook_raw '{"agent_type":"arc:ui-composer","tool_name":"Bash","tool_input":{"command":"'"$RENDER_A"'"}}'
  [ "$status" -eq 0 ] || { echo "a namespaced composer could not render its own variant: $stderr"; false; }
}

@test "composer bash: the marker is read from the project the harness names, not from the hook's cwd" {
  # BL-4: ROOT came from the cwd's git repo while the fragment found the script through
  # CLAUDE_PROJECT_DIR, so a checkout with variant-b armed allowed variant-b.
  _bash_sandbox
  local other="$BATS_TEST_TMPDIR/other"
  mkdir -p "$other/.claude/state/design" "$other/.claude/scripts/core"
  git -C "$other" init -q
  cp "$SANDBOX/.claude/scripts/core/common.sh" "$other/.claude/scripts/core/"
  _scope --begin lexos-v1 variant-b
  cp "$SANDBOX/.claude/state/design/composer-session--lexos-v1--variant-b" "$other/.claude/state/design/"
  _scope --end lexos-v1 variant-b
  _arm_a
  cd "$other"
  CLAUDE_PROJECT_DIR="$SANDBOX"; export CLAUDE_PROJECT_DIR
  _hook ui-composer Bash "$RENDER_B_INTO_B"
  [ "$status" -eq 2 ] || { echo "the other checkout's boundary allowed variant-b: $stderr"; false; }
  _hook ui-composer Bash "$RENDER_A"
  [ "$status" -eq 0 ] || { echo "the project's own boundary was not the one read: $stderr"; false; }
}

@test "composer bash: a flag given twice refuses, whichever value comes last" {
  # BL-5, lane defect #13: last-wins let the check and the renderer read different values.
  _bash_sandbox; _arm_a
  local c
  for c in "$RENDER_A_BARE --session lexos-v1--variant-a" \
           "bash .claude/scripts/design/design-render.sh docs/design/explore/lexos-v1/variant-a/index.html --session lexos-v1--variant-b --mode explore --session lexos-v1--variant-a" \
           "bash .claude/scripts/design/design-render.sh docs/design/explore/lexos-v1/variant-a/index.html --mode critique --session lexos-v1--variant-a --mode explore" \
           "$RENDER_A --viewport 390x844"; do
    _hook ui-composer Bash "$c"
    [ "$status" -eq 2 ] || { echo "allowed: $c"; false; }
    printf '%s' "$stderr" | grep -q 'is given twice' || { echo "refused for another reason: $stderr"; false; }
  done
}

@test "composer bash: a viewport outside 200..4096, or with a leading zero, refuses" {
  # BL-6: `0x0` hung the renderer for 32 s, and `01440x0900` never matches a declared viewport.
  _bash_sandbox; _arm_a
  local v
  for v in 0x0 01440x900 1440x0900 0900x900 99999999999999999999x800 199x900 1440x199 4097x900 1440x4097 1440x900x2 x900 1440x; do
    _hook ui-composer Bash "$RENDER_A_BARE --viewport $v"
    [ "$status" -eq 2 ] || { echo "allowed viewport $v"; false; }
  done
  _hook ui-composer Bash "$RENDER_A_BARE --viewport 200x4096"
  [ "$status" -eq 0 ] || { echo "the bounds themselves were refused: $stderr"; false; }
}

@test "composer bash: an --iter outside 1..3 refuses here, not only in the renderer" {
  # Mutant M5 survived because the renderer re-checks. Two checks that must agree are both pinned.
  _bash_sandbox; _arm_a
  local i
  for i in 0 4 01 1x -1; do
    _hook ui-composer Bash "$RENDER_A_BARE --iter $i"
    [ "$status" -eq 2 ] || { echo "allowed --iter $i"; false; }
    printf '%s' "$stderr" | grep -q -- '--iter takes 1, 2 or 3' || { echo "refused for another reason: $stderr"; false; }
  done
}

@test "composer bash: a half-megabyte command is refused within seconds, not after the hook timeout" {
  # Eighth attack pass, A: the seventh pass capped the command AFTER its reader had already run a
  # strip whose cost grew faster than the value -- 600 KB held the check 69 s, and a timed-out hook
  # reads as allow. Only a time bound pins "the cap comes first"; a message does not. The payload
  # goes through a file because one argv string over 128 KB is refused by Linux itself. 250k words
  # also pin the seventh pass's own S1 (the cap before the split, mutant MU7).
  _bash_sandbox; _arm_a
  local words
  words="$(yes ' a' 2>/dev/null | head -n 250000 | tr -d '\n')"
  [ "${#words}" -ge 500000 ] || { echo "the padding was not built (${#words} bytes), so this case proves nothing"; false; }
  printf '{"agent_type":"ui-composer","tool_name":"Bash","tool_input":{"command":"%s%s"}}' "$RENDER_A_BARE" "$words" \
    > "$BATS_TEST_TMPDIR/big.json"
  SECONDS=0
  run --separate-stderr bash -c 'bash "$0" < "$1"' "$SANDBOX/.claude/hooks/PreToolUse.sh" "$BATS_TEST_TMPDIR/big.json"
  local took="$SECONDS"
  [ "$status" -eq 2 ] || { echo "a 500 KB command was not refused: $stderr"; false; }
  printf '%s' "$stderr" | grep -q 'longer than any render' || { echo "refused, but not by the length cap: $stderr"; false; }
  [ "$took" -lt 20 ] || { echo "the refusal took ${took}s; the hook budget is 60s and the cap must come before the work"; false; }
}

@test "composer bash: a command longer than any render is refused by its length, before it is split" {
  # Seventh attack pass, S1: the words were split and core/common.sh sourced with all of them in
  # `$@`; 240k words took 129 s, past the hook timeout, which reads as ALLOW. The refusal must be
  # the LENGTH cap -- a later refusal would come only after the expensive part.
  _bash_sandbox; _arm_a
  local pad="" i=0
  while [ "$i" -lt 3000 ]; do pad="$pad --pin-font"; i=$((i + 1)); done
  _hook ui-composer Bash "$RENDER_A_BARE$pad"
  [ "$status" -eq 2 ] || { echo "a 33 KB command was not refused: $stderr"; false; }
  printf '%s' "$stderr" | grep -q 'longer than any render' || { echo "refused, but not by the length cap: $stderr"; false; }
  # The cap is above every real render.
  _hook ui-composer Bash "$RENDER_A"
  [ "$status" -eq 0 ] || { echo "$stderr"; false; }
  # And it sits exactly at 400 bytes: 400 runs, 401 does not (ninth attack pass, boundary mutant M5).
  local pre="bash .claude/scripts/design/design-render.sh docs/design/explore/lexos-v1/variant-a/"
  local post=".html --mode explore --session lexos-v1--variant-a" name=""
  while [ $(( ${#pre} + ${#name} + ${#post} )) -lt 400 ]; do name="${name}a"; done
  [ $(( ${#pre} + ${#name} + ${#post} )) -eq 400 ] || { echo "could not build a 400-byte command"; false; }
  _hook ui-composer Bash "$pre$name$post"
  [ "$status" -eq 0 ] || { echo "a 400-byte render was refused: $stderr"; false; }
  _hook ui-composer Bash "${pre}${name}a${post}"
  [ "$status" -eq 2 ] || { echo "a 401-byte render was allowed"; false; }
  printf '%s' "$stderr" | grep -q 'longer than any render'
}

@test "composer bash: a refusal echoes a capped route, not the whole of a huge one" {
  # BS-10, lane defect #14: a 20 KB route came back as 20 KB of stderr. The length cap now refuses
  # a 20 KB command before the route is looked at, so the route here stays under that cap and the
  # assertion is on the echo itself: no more than 120 of its characters come back.
  _bash_sandbox; _arm_a
  _hook ui-composer Bash "bash .claude/scripts/design/design-render.sh docs/$(printf '%0250d' 0) --mode explore --session lexos-v1--variant-a"
  [ "$status" -eq 2 ]
  printf '%s' "$stderr" | grep -q 'is not inside your own variant' || { echo "refused for another reason: $stderr"; false; }
  case "$stderr" in *"$(printf '%0200d' 0)"*) echo "the route was echoed uncapped"; false;; esac
}

@test "composer bash: with the check script missing, a composer's Bash is blocked and nobody else's is" {
  # The fragment used to fail OPEN on a missing script: one deleted file removed the whole
  # composer boundary. Everyone else still runs, so a broken install does not brick the session.
  _bash_sandbox; _arm_a
  rm -f "$SANDBOX/.claude/scripts/design/composer-bash-check.sh"
  _hook ui-composer Bash "$RENDER_A"
  [ "$status" -eq 2 ] || { echo "a composer ran Bash with its check script gone: $stderr"; false; }
  printf '%s' "$stderr" | grep -q 'composer-bash-check.sh is missing'
  _hook "" Bash "$CAT_B"
  [ "$status" -eq 0 ] || { echo "the main session was blocked by a missing composer script: $stderr"; false; }
  _hook Explore Bash "node -e 1"
  [ "$status" -eq 0 ] || { echo "another subagent was blocked by a missing composer script: $stderr"; false; }
  # The fallback reads the agent_type VALUE: a re-cased composer is still blocked (SM6), and an
  # agent that only MENTIONS ui-composer is not (seventh attack pass, F3).
  _hook UI-Composer Bash "$RENDER_A"
  [ "$status" -eq 2 ] || { echo "a re-cased composer ran with the script gone: $stderr"; false; }
  _hook Explore Bash "grep -rn ui-composer .claude/agents"
  [ "$status" -eq 0 ] || { echo "an agent that mentions ui-composer was blocked: $stderr"; false; }
}

@test "composer bash: an empty, truncated or failing check script does not let a composer through" {
  # F2: the fragment only blocked a MISSING script. An empty or truncated one ran to its end and
  # exited 0, and any exit but 2 reads as allow. The script ends in a sentinel line; without it,
  # or with an exit other than 0 or 2, a composer is blocked and nobody else is.
  _bash_sandbox; _arm_a
  local sc="$SANDBOX/.claude/scripts/design/composer-bash-check.sh"
  tail -n 1 "$sc" | grep -qx '# composer-bash-check: end' || { echo "the real script has no sentinel, so this case proves nothing"; false; }
  cp "$sc" "$BATS_TEST_TMPDIR/whole.sh"
  : > "$sc"
  _hook ui-composer Bash "$CAT_B"
  [ "$status" -eq 2 ] || { echo "an EMPTY check script let a composer through: $stderr"; false; }
  head -n 60 "$BATS_TEST_TMPDIR/whole.sh" > "$sc"
  _hook ui-composer Bash "$CAT_B"
  [ "$status" -eq 2 ] || { echo "a TRUNCATED check script let a composer through: $stderr"; false; }
  printf 'exit 1\n# composer-bash-check: end\n' > "$sc"
  _hook ui-composer Bash "$CAT_B"
  [ "$status" -eq 2 ] || { echo "a check script exiting 1 let a composer through: $stderr"; false; }
  _hook "" Bash "$CAT_B"
  [ "$status" -eq 0 ] || { echo "the main session was blocked by a broken composer script: $stderr"; false; }
  # The fallback leans closed, matching what the script itself normalises (eighth attack pass: E,
  # and the namespace and whitespace mutants MU9 and MU10).
  local bs='\' a
  for a in 'arc:ui-composer' 'arc: ui-composer' 'ui-composer ' ' ui-composer' 'ui-composer\t' 'ui-composer\r'; do
    _hook_raw '{"agent_type":"'"$a"'","tool_name":"Bash","tool_input":{"command":"'"$CAT_B"'"}}'
    [ "$status" -eq 2 ] || { echo "a failing script let agent_type '$a' through: $stderr"; false; }
  done
  _hook_raw '{"agent'"${bs}"'u005ftype":"ui-composer","tool_name":"Bash","tool_input":{"command":"'"$CAT_B"'"}}'
  [ "$status" -eq 2 ] || { echo "a failing script let an escaped key through: $stderr"; false; }
  local nl='
'
  _hook_raw '{"agent_type"'"$nl"':"ui-composer","tool_name":"Bash","tool_input":{"command":"'"$CAT_B"'"}}'
  [ "$status" -eq 2 ] || { echo "a failing script let a key split from its colon through (mutant M12): $stderr"; false; }
  _hook Explore Bash "grep -rn ui-composer .claude/agents"
  [ "$status" -eq 0 ] || { echo "a failing script blocked an agent that only mentions the composer: $stderr"; false; }
  cp "$BATS_TEST_TMPDIR/whole.sh" "$sc"
  _hook ui-composer Bash "$RENDER_A"
  [ "$status" -eq 0 ] || { echo "the restored script did not allow the composer's own render: $stderr"; false; }
}

@test "composer bash: an unwritable TMPDIR does not disarm the boundary (the fixture dispatcher)" {
  # BS-4: the installed dispatcher kept the payload only in a temp file, so with TMPDIR unwritable
  # the fragment read nothing and a composer's `cat` of a sibling ran. The canonical dispatcher
  # pipes the payload instead; until the owner installs it, this case drives the fixture copy.
  _bash_sandbox; _arm_a
  cp "$ARC_ROOT/tests/fixtures/hooks/_dispatch.sh" "$SANDBOX/.claude/hooks/_dispatch.sh"
  # TMPDIR broken AND a mktemp that fails: macOS mktemp ignores TMPDIR, so TMPDIR alone left that
  # leg on the temp-file path and proved nothing there.
  mkdir -p "$BATS_TEST_TMPDIR/nomktemp"
  printf '#!/bin/sh\nexit 1\n' > "$BATS_TEST_TMPDIR/nomktemp/mktemp"
  chmod +x "$BATS_TEST_TMPDIR/nomktemp/mktemp"
  _bp ui-composer Bash "$CAT_B" > "$BATS_TEST_TMPDIR/p.json"
  run --separate-stderr bash -c 'TMPDIR=/nonexistent-arc-tmp/x; export TMPDIR; PATH="$2:$PATH"; export PATH; bash "$0" < "$1"' \
    "$SANDBOX/.claude/hooks/PreToolUse.sh" "$BATS_TEST_TMPDIR/p.json" "$BATS_TEST_TMPDIR/nomktemp"
  [ "$status" -eq 2 ] || { echo "with TMPDIR unwritable a composer read a sibling: $stderr"; false; }
  _bp ui-composer Bash "$RENDER_A" > "$BATS_TEST_TMPDIR/p.json"
  run --separate-stderr bash -c 'TMPDIR=/nonexistent-arc-tmp/x; export TMPDIR; PATH="$2:$PATH"; export PATH; bash "$0" < "$1"' \
    "$SANDBOX/.claude/hooks/PreToolUse.sh" "$BATS_TEST_TMPDIR/p.json" "$BATS_TEST_TMPDIR/nomktemp"
  [ "$status" -eq 0 ] || { echo "with TMPDIR unwritable the composer's own render was refused: $stderr"; false; }
}

# ---------- the owner's half ----------

@test "composer bash: the real hook fragment, once installed, matches the canonical fixture and ships" {
  # .claude/hooks/** is edit-denied to this session by governance, so the owner installs it:
  #   cp tests/fixtures/hooks/PreToolUse.d/10-design-composer.sh .claude/hooks/PreToolUse.d/10-design-composer.sh
  # Until then this SKIPS, with the owner action as its reason. It used to be red on purpose, which
  # kept its CI job red and hid any new failure behind the known one (fifth attack pass, BS-9).
  # Phase 01 cannot close while it skips: the DoD requires the fragment installed.
  [ -f "$ARC_ROOT/.claude/hooks/PreToolUse.d/10-design-composer.sh" ] \
    || skip "OWNER ACTION PENDING: the composer Bash fragment is not installed; run the cp above"
  cmp -s "$ARC_ROOT/.claude/hooks/PreToolUse.d/10-design-composer.sh" \
         "$ARC_ROOT/tests/fixtures/hooks/PreToolUse.d/10-design-composer.sh" || {
    echo "installed, but it differs from the canonical fixture"; false; }
  # Installed and unshipped is the same hole one install later: a selective sync would copy the
  # check with nothing calling it (BS-5).
  grep -q '".claude/hooks/PreToolUse.d/10-design-composer.sh"' "$ARC_ROOT/products/design/manifest.json" || {
    echo "installed, but products/design/manifest.json does not ship it; add the row and regenerate the sync golden"; false; }
}

# ---------- ADR-1420: the design-curator's Bash and WebFetch ----------
#
# The scaffold takes tool NAMES, so the curator holds plain Bash and WebFetch; this boundary is
# what scopes them. Bash runs only design-refpack.mjs with its own five flags. WebFetch runs only
# on an active, fetchable registry row's host whose robots.txt answers ALLOW. robots.txt is served
# by the offline seam: ARC_DESIGN_OFFLINE=1 plus ARC_DESIGN_ROBOTS_FILE, read by the hook's check.

_curator_sandbox() {
  _bash_sandbox
  cp "$ARC_ROOT/design.sources.yaml" "$SANDBOX/design.sources.yaml"
  printf 'User-agent: *\nDisallow: /private/\n' > "$SANDBOX/robots.txt"
  export ARC_DESIGN_OFFLINE=1 ARC_DESIGN_ROBOTS_FILE="$SANDBOX/robots.txt"
}
# A WebFetch payload. $1 = agent_type ("" for the main session), $2 = url.
_wp() {
  if [ -n "$1" ]; then
    printf '{"session_id":"s","agent_id":"k1","agent_type":"%s","hook_event_name":"PreToolUse","tool_name":"WebFetch","tool_input":{"url":"%s","prompt":"list the screens"}}' "$1" "$2"
  else
    printf '{"session_id":"s","hook_event_name":"PreToolUse","tool_name":"WebFetch","tool_input":{"url":"%s","prompt":"list the screens"}}' "$2"
  fi
}
_fetch() { run --separate-stderr bash -c 'bash "$0" <<< "$1"' "$SANDBOX/.claude/hooks/PreToolUse.sh" "$(_wp "$1" "$2")"; }

REFPACK_OK='node .claude/scripts/design/design-refpack.mjs --brief lexos-p02 --source lapa-ninja --url "https://lapa.ninja/assets/shot-1.png" --principle "Dense tables earn trust: one row, one fact, and the totals line up." --avoid "Do not copy the green palette; it is their brand, not a principle."'

@test "ADR-1420: a curator's Bash runs design-refpack.mjs with its own flags and nothing else" {
  _curator_sandbox
  _hook design-curator Bash "$REFPACK_OK"
  [ "$status" -eq 0 ] || { echo "a well-formed refpack call was refused: $stderr"; false; }
  # Paired: the same boundary refuses everything else the curator could try.
  _hook design-curator Bash "cat docs/design/explore/lexos-v1/variant-b/index.html"
  [ "$status" -eq 2 ] || { echo "a curator cat ran: $status"; false; }
  _hook design-curator Bash "$REFPACK_OK ; rm -rf docs"
  [ "$status" -eq 2 ] || { echo "a second command rode along a refpack call: $status"; false; }
  _hook design-curator Bash "${REFPACK_OK} --registry /tmp/r.yaml"
  [ "$status" -eq 2 ] || { echo "a curator used a test seam: $status"; false; }
  _hook design-curator Bash 'node .claude/scripts/design/design-refpack.mjs --brief b --source lapa-ninja --url "https://lapa.ninja/$(id)" --principle "p" --avoid "a"'
  [ "$status" -eq 2 ] || { echo "a substitution inside a quoted value ran: $status"; false; }
  _hook design-curator Bash 'node .claude/scripts/design/design-refpack.mjs --brief b --source lapa-ninja --url "https://lapa.ninja/x.png" --principle "p" --avoid "unterminated'
  [ "$status" -eq 2 ] || { echo "an unterminated quote was allowed: $status"; false; }
  _hook arc:Design-Curator Bash "cat README.md"
  [ "$status" -eq 2 ] || { echo "a namespaced curator ran cat: $status"; false; }
}

@test "ADR-1420: a curator's WebFetch needs an active registry host and a robots ALLOW" {
  _curator_sandbox
  _fetch design-curator "https://www.lapa.ninja/category/saas"
  [ "$status" -eq 0 ] || { echo "an allowed gallery page was refused: $stderr"; false; }
  _fetch design-curator "https://example.com/anything"
  [ "$status" -eq 2 ] || { echo "an off-registry host was fetched: $status"; false; }
  printf '%s' "$stderr" | grep -qi "registry" || { echo "refused, but not by the host binding: $stderr"; false; }
  _fetch design-curator "https://lapa.ninja/private/drafts"
  [ "$status" -eq 2 ] || { echo "a robots DISALLOW path was fetched: $status"; false; }
  printf '%s' "$stderr" | grep -q "DISALLOW" || { echo "refused, but not by robots: $stderr"; false; }
  _fetch design-curator "http://lapa.ninja/category/saas"
  [ "$status" -eq 2 ] || { echo "a plain-http fetch was allowed: $status"; false; }
  # awwwards is active and fetchable but link-only: it may be linked, not browsed for a pack.
  _fetch design-curator "https://www.awwwards.com/websites/"
  [ "$status" -eq 2 ] || { echo "a link-only source was browsed: $status"; false; }
  # godly is off: no fetch at all.
  _fetch design-curator "https://godly.website/"
  [ "$status" -eq 2 ] || { echo "an off source was browsed: $status"; false; }
}

@test "ADR-1420: an unreadable robots.txt refuses a curator fetch, and says UNREADABLE" {
  _curator_sandbox
  unset ARC_DESIGN_ROBOTS_FILE; export ARC_DESIGN_ROBOTS_STATUS=403
  _fetch design-curator "https://saasframe.io/examples"
  [ "$status" -eq 2 ] || { echo "a 403 robots.txt was read as permission: $status"; false; }
  printf '%s' "$stderr" | grep -q "UNREADABLE" || { echo "refused, but not as UNREADABLE: $stderr"; false; }
}

@test "ADR-1420: the main session and ui-composer are unchanged by the curator rules" {
  _curator_sandbox
  _fetch "" "https://example.com/anything"
  [ "$status" -eq 0 ] || { echo "the main session's WebFetch was scoped: $stderr"; false; }
  _hook "" Bash "cat README.md"
  [ "$status" -eq 0 ] || { echo "the main session's Bash was scoped: $stderr"; false; }
  _fetch ui-composer "https://example.com/anything"
  [ "$status" -eq 0 ] || { echo "a composer WebFetch changed behaviour: $stderr"; false; }
  # Paired: the composer boundary is still live.
  _live
}
