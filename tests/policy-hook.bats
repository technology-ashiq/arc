#!/usr/bin/env bats
# Phase 02 -- the interactive surface (REQ-05, ADR-0501).
#
# TWO LAYERS, and the whole point is that they fail differently.
#
#   layer 1  the PreToolUse fragment. Expressive: it knows kinds, capabilities, levels and
#            resources, and it asks the ONE shared library. It exits 2 on its own internal
#            error, because exit 2 is the only fail-closed path a hook has.
#   layer 2  static `permissions.deny` rules. Dumb by design, evaluated BEFORE hooks, merged
#            across settings scopes, and still in force under bypassPermissions. It is what
#            holds when the fragment does not run AT ALL -- deleted, renamed, or never reached.
#
# THE FRAGMENT IS FLAG-GATED, and that is a decision rather than a "hook later" (POL-H).
# `session:interactive` holds shell and write at L1, so with it armed every Bash and every Write
# in a live session is `propose` -- correct by the model, unusable as a session. Making it usable
# means RAISING A CEILING, and POL-A says a ceiling change is a human edit in a reviewed diff,
# never something a build session grants itself in passing. These tests set ARC_POLICY_HOOK=1,
# so the enforcement path runs on every CI leg rather than sitting unproven behind a flag.
#
# We found that out the honest way: installing it live blocked the session that wrote it, on its
# own chaining rule, inside one command.
#
# ASCII-only test names; the file asserts its own registered count at the bottom.
bats_require_minimum_version 1.5.0
load 'test_helper'

HOOK=".claude/scripts/hq/policy-hook.mjs"

# The payload goes in via a FILE, never interpolated into a shell string: a file path with an
# apostrophe would close the program, which CLAUDE.md names and this repo has hit three times.
_ask() { # $1 = json payload
  local f="$BATS_TEST_TMPDIR/payload.json"
  printf '%s' "$1" > "$f"
  cd "$ARC_ROOT" && node "$HOOK" < "$f"
}

@test "a write to an un-grantable resource is denied" {
  run _ask '{"tool_name":"Write","tool_input":{"file_path":".claude/settings.json","content":"x"}}'
  [ "$status" -eq 2 ]
  [[ "$output" == *"un-grantable resource"* ]]
}

@test "a write to the policy file itself is denied" {
  run _ask '{"tool_name":"Write","tool_input":{"file_path":"hq.policy.yaml","content":"x"}}'
  [ "$status" -eq 2 ]
}

@test "a write inside an allowed root is PROPOSE, not execute, and says why" {
  # The born-at-L1 rule reaching the interactive surface. It is not a denial of the path, it is
  # a denial of performing it -- and the message has to make that difference legible or every
  # operator reads it as a bug.
  run _ask '{"tool_name":"Write","tool_input":{"file_path":"docs/x.md","content":"x"}}'
  [ "$status" -eq 2 ]
  [[ "$output" == *"L1 (propose)"* ]]
  [[ "$output" == *"human decision"* ]]
}

@test "a read is not gated" {
  run _ask '{"tool_name":"Read","tool_input":{"file_path":"README.md"}}'
  [ "$status" -eq 0 ]
}

@test "a tool absent from the capability matrix is denied" {
  # Deny-by-default applied to CLASSIFICATION, the same rule argv0_classes and the MCP matrix
  # follow. An unclassified tool is not an allowed one.
  run _ask '{"tool_name":"TotallyNewToolNobodyClassified","tool_input":{}}'
  [ "$status" -eq 2 ]
}

@test "an MCP spend tool is denied -- stripe is real money" {
  run _ask '{"tool_name":"mcp__stripe__create_payment","tool_input":{}}'
  [ "$status" -eq 2 ]
  [[ "$output" == *"spend"* ]]
}

@test "an MCP tool from an unclassified server gets the worst its class could be" {
  run _ask '{"tool_name":"mcp__mystery__do_something","tool_input":{}}'
  [ "$status" -eq 2 ]
}

@test "an unparseable payload is DENIED, not waved through" {
  # This is the one fragment whose job is authority. "Unreadable, therefore allowed" is exactly
  # the fail-open being closed.
  run _ask 'not json at all'
  [ "$status" -eq 2 ]
  [[ "$output" == *"could not be parsed"* ]]
}

@test "an empty payload is not an error" {
  run _ask ''
  [ "$status" -eq 0 ]
}

@test "the fragment exits 2 on its own internal error, never 0" {
  # ADR-0501: exit 2 is the ONLY fail-closed path a PreToolUse hook has. Every error branch in
  # the fragment must end there -- the opposite of its neighbours, which degrade permissively
  # because they guard conveniences rather than authority.
  #
  # ASSERTED BEHAVIOURALLY, not by grepping the file. The first version grepped the fragment for
  # the string "exit 2", and when the body moved to the shared policy-decide.sh the fragment
  # became a three-line wrapper -- the grep went red while the behaviour was unchanged and
  # correct. A grep over source is a test of prose; drive the thing and break it instead.
  cd "$ARC_ROOT"
  local payload="$BATS_TEST_TMPDIR/p.json"
  printf '%s' '{"tool_name":"Bash","tool_input":{"command":"echo hi"}}' > "$payload"
  # A node that cannot decide. The fragment must DENY rather than shrug.
  run bash -c "cd '$ARC_ROOT' && ARC_POLICY_HOOK=1 CLAUDE_PROJECT_DIR='$ARC_ROOT' ARC_NODE=/nonexistent/node bash .claude/hooks/PreToolUse.d/40-policy.sh < '$payload'"
  [ "$status" -eq 2 ] || { echo "a broken decider did not deny: status=$status"; false; }
  [[ "$output" == *"did not complete"* ]] || { echo "the denial does not say why: $output"; false; }
  # Both matchers share one body, so the Edit/Write fragment must fail closed identically.
  printf '%s' '{"tool_name":"Write","tool_input":{"file_path":"docs/x.md"}}' > "$payload"
  run bash -c "cd '$ARC_ROOT' && ARC_POLICY_HOOK=1 CLAUDE_PROJECT_DIR='$ARC_ROOT' ARC_NODE=/nonexistent/node bash .claude/hooks/PreToolUse-edit.d/40-policy.sh < '$payload'"
  [ "$status" -eq 2 ] || { echo "the Edit/Write fragment did not fail closed: status=$status"; false; }
}

@test "the Edit and Write tools reach the policy engine at all" {
  # THE REGRESSION TEST FOR THIS CYCLE'S WORST HOLE. settings.json wired the policy fragment
  # under the `Bash` matcher only; `Edit|Write` ran PreToolUse-edit.d/, which held a freeze guard
  # and a design critic and no policy check. A Write could therefore replace authorize.mjs
  # itself, after which the armed Bash gate permitted an edit it had refused one command before.
  cd "$ARC_ROOT"
  [ -f ".claude/hooks/PreToolUse-edit.d/40-policy.sh" ] || {
    echo "the Edit/Write matcher has no policy fragment -- the write path is unpoliced"; false; }
  local payload="$BATS_TEST_TMPDIR/w.json"
  printf '%s' '{"tool_name":"Write","tool_input":{"file_path":".claude/hooks/PreToolUse.d/40-policy.sh"}}' > "$payload"
  run bash -c "cd '$ARC_ROOT' && ARC_POLICY_HOOK=1 CLAUDE_PROJECT_DIR='$ARC_ROOT' bash .claude/hooks/PreToolUse-edit.d/40-policy.sh < '$payload'"
  [ "$status" -eq 2 ] || { echo "a Write to the enforcement fragment was permitted: status=$status"; false; }
  [[ "$output" == *"un-grantable"* ]] || { echo "denied, but not as an ADR-0502 target: $output"; false; }
}

@test "both policy fragments share ONE body, never a second copy" {
  # POL-D. Two fragments each holding their own translation of a policy answer is guaranteed
  # drift, and it is silent: both keep exiting 0 while they stop agreeing on what a denial is.
  cd "$ARC_ROOT"
  # COMMENTS ARE STRIPPED FIRST. The first version grepped the whole file for "policy-hook.mjs"
  # and went red on the Edit/Write fragment's own comment -- the paragraph explaining why the
  # fragment exists names the module it must not call. A grep over source cannot tell code from
  # prose, which is the same mistake that made the sibling test above go red one commit ago.
  for f in .claude/hooks/PreToolUse.d/40-policy.sh .claude/hooks/PreToolUse-edit.d/40-policy.sh; do
    grep -q "policy-decide.sh" "$f" || { echo "$f does not delegate to the shared body"; false; }
    if grep -v '^[[:space:]]*#' "$f" | grep -q "policy-hook.mjs"; then
      echo "$f holds its own copy of the decision"; false
    fi
  done
  [ -x ".claude/hooks/policy-decide.sh" ] || { echo "the shared body is not executable"; false; }
}

@test "the fragment is armed by ARC_POLICY_HOOK and inert without it" {
  cd "$ARC_ROOT"
  local payload="$BATS_TEST_TMPDIR/p.json"
  printf '%s' '{"tool_name":"Write","tool_input":{"file_path":"hq.policy.yaml"}}' > "$payload"
  # Unarmed: the dispatcher chain returns 0.
  run bash -c "cd '$ARC_ROOT' && bash .claude/hooks/PreToolUse.d/40-policy.sh < '$payload'"
  [ "$status" -eq 0 ]
  # Armed: it blocks.
  run bash -c "cd '$ARC_ROOT' && ARC_POLICY_HOOK=1 CLAUDE_PROJECT_DIR='$ARC_ROOT' bash .claude/hooks/PreToolUse.d/40-policy.sh < '$payload'"
  [ "$status" -eq 2 ]
}

@test "LAYER 2 -- the static deny floor covers spend, deploy and the un-grantable targets" {
  # What holds when the fragment does not run at all. Deny rules are evaluated before hooks and
  # survive bypassPermissions, so this is the only genuinely fail-closed surface.
  cd "$ARC_ROOT"
  run node --input-type=module -e "
    const fs = await import('node:fs');
    const deny = JSON.parse(fs.readFileSync('.claude/settings.json','utf8')).permissions.deny;
    const need = ['mcp__stripe__*','mcp__supabase__deploy_edge_function',
      'Edit(./.claude/settings.json)','Write(./.claude/settings.json)',
      'Edit(./hq.policy.yaml)','Write(./hq.policy.yaml)'];
    const missing = need.filter(r => !deny.includes(r));
    console.log(missing.length ? 'MISSING:' + missing.join(',') : 'floor-present');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "floor-present" ]
}

@test "LAYER 2 never contradicts LAYER 1" {
  # The cross-check POL-D demands once one rule has two representations: anything the static
  # floor denies must also be denied or proposed by the library, never executed. A floor that
  # forbids what the engine permits is two policies.
  cd "$ARC_ROOT"
  run node --input-type=module -e "
    const P = await import('./.claude/scripts/hq/lib/policy/index.mjs');
    const fs = await import('node:fs');
    const policy = P.parsePolicyYaml(fs.readFileSync('hq.policy.yaml','utf8'));
    const targets = ['.claude/settings.json','.claude/settings.local.json','hq.policy.yaml'];
    const bad = [];
    for (const t of targets) {
      const v = P.authorizeAction({ kind:'session:interactive', capability:'write', resource:t },
        { policy, events: [] });
      if (v.decision === 'execute') bad.push(t + '=>' + v.decision);
    }
    console.log(bad.length ? 'CONTRADICTS:' + bad.join(',') : 'consistent');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "consistent" ]
}

@test "this file registered every test it declares" {
  [ "${#BATS_TEST_NAMES[@]}" -eq 16 ] || {
    echo "registered ${#BATS_TEST_NAMES[@]} tests, expected 16 -- a @test was silently dropped"
    false
  }
}
