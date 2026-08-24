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

@test "PHASE 04 -- an MCP server named after a prototype key gets the WORST case" {
  # matrix.servers[server] is a bare index, so `constructor`, `toString`, `valueOf` and
  # `hasOwnProperty` resolve up the prototype chain to a truthy value. The unclassified-server
  # branch was therefore skipped for exactly those names and they fell through to the ["write"]
  # default instead of ["spend","write","deploy","publish"]. run-gate.mjs carries this fix with
  # this comment; the builtin branch below it has it; the MCP branch did not. Fourth recurrence
  # of a prototype-chain read in this lane.
  cd "$ARC_ROOT"
  local payload="$BATS_TEST_TMPDIR/m.json"
  # A genuinely unknown server is the reference: it must be denied on SPEND, the worst it could be.
  printf '%s' '{"tool_name":"mcp__totally_unknown_server__x","tool_input":{}}' > "$payload"
  run bash -c "cd '$ARC_ROOT' && ARC_POLICY_HOOK=1 CLAUDE_PROJECT_DIR='$ARC_ROOT' bash .claude/hooks/PreToolUse.d/40-policy.sh < '$payload'"
  [ "$status" -eq 2 ] || { echo "unknown server not denied: $output"; false; }
  [[ "$output" == *"spend"* ]] || { echo "unknown server not treated as worst-case: $output"; false; }
  # Every prototype-key name must reach the SAME verdict as the unknown server above.
  for name in constructor toString valueOf hasOwnProperty; do
    printf '%s' "{\"tool_name\":\"mcp__${name}__x\",\"tool_input\":{}}" > "$payload"
    run bash -c "cd '$ARC_ROOT' && ARC_POLICY_HOOK=1 CLAUDE_PROJECT_DIR='$ARC_ROOT' bash .claude/hooks/PreToolUse.d/40-policy.sh < '$payload'"
    [ "$status" -eq 2 ] || { echo "mcp__${name}__ not denied: $output"; false; }
    [[ "$output" == *"spend"* ]] || {
      echo "mcp__${name}__ was downgraded below worst-case: $output"; false; }
  done
}

@test "PHASE 04 -- the fragment sources nothing, and both wrappers are the same body" {
  # THE SOURCED DISPATCHER WAS A BYPASS. policy-decide.sh sourced _dispatch.sh and used NEITHER
  # function from it -- pure liability: arbitrary shell executed INSIDE the authority path, where
  # a single `exit 0` in that file allows everything. A day-two attacker replaced _dispatch.sh
  # with `exit 0` and a Write to hq.policy.yaml came back permitted.
  #
  # Pinned as a text rule because that is the shape of the defect: not a wrong decision, an
  # untrusted file given the right to make one. The authority path sources nothing at all.
  cd "$ARC_ROOT"
  ! grep -qE '^[[:space:]]*(\.|source)[[:space:]]' .claude/hooks/policy-decide.sh || {
    echo "policy-decide.sh sources a file -- the authority path must source nothing:"
    grep -nE '^[[:space:]]*(\.|source)[[:space:]]' .claude/hooks/policy-decide.sh
    false
  }
  # POL-D, checked rather than asserted in a comment: two consumers, ONE body. A wrapper that
  # grew its own copy of the logic is the drift this file exists to prevent, and it is silent --
  # both keep exiting 0 while they stop agreeing on what a denial looks like.
  for w in .claude/hooks/PreToolUse.d/40-policy.sh .claude/hooks/PreToolUse-edit.d/40-policy.sh; do
    [ -f "$w" ] || { echo "$w is missing -- a matcher routes to nothing"; false; }
    grep -q "policy-decide.sh" "$w" || { echo "$w does not reach the shared body"; false; }
    # Small enough that it cannot be holding a second implementation.
    [ "$(grep -cv '^[[:space:]]*\(#.*\)\?$' "$w")" -le 5 ] || {
      echo "$w has grown its own logic:"; cat "$w"; false; }
  done
}

@test "PHASE 04 -- not-in-force is decided by the absent LAW, never the absent library" {
  # The fragment tested for run-gate.mjs, so `mv run-gate.mjs run-gate.mjs.bak` turned enforcement
  # off SILENTLY and exited 0 -- a day-two attacker did exactly that. In a tree that HAS
  # hq.policy.yaml an absent library is tampering; in a consumer repo with no policy file there is
  # genuinely nothing to enforce, and refusing to run would brick every venture repo. Gating on
  # the law gets both right, and the tampering case now exits 2 instead of 0.
  local D="$BATS_TEST_TMPDIR/froot"
  mkdir -p "$D/.claude"
  cp -r "$ARC_ROOT/.claude/scripts" "$D/.claude/"
  cp -r "$ARC_ROOT/.claude/hooks" "$D/.claude/"
  local pay="$BATS_TEST_TMPDIR/w.json"
  printf '%s' '{"tool_name":"Write","tool_input":{"file_path":"hq.policy.yaml","content":"x"}}' > "$pay"
  local frag="$D/.claude/hooks/policy-decide.sh"

  # 1. NO LAW. A consumer repo that never adopted policy: allowed, quietly.
  run bash -c "ARC_POLICY_HOOK=1 CLAUDE_PROJECT_DIR='$D' bash '$frag' < '$pay'"
  [ "$status" -eq 0 ] || { echo "a repo with no policy file was blocked: $output"; false; }

  # 2. LAW PRESENT, LIBRARY MOVED. This is the attack, and it must be LOUD.
  cp "$ARC_ROOT/hq.policy.yaml" "$D/hq.policy.yaml"
  mv "$D/.claude/scripts/hq/lib/policy/run-gate.mjs" "$D/.claude/scripts/hq/lib/policy/run-gate.bak"
  run bash -c "ARC_POLICY_HOOK=1 CLAUDE_PROJECT_DIR='$D' bash '$frag' < '$pay'"
  [ "$status" -eq 2 ] || { echo "moving one library file turned enforcement off: $output"; false; }
  [[ "$output" == *"tampering"* ]] || { echo "the refusal does not name what happened: $output"; false; }

  # 3. THE CONTROL. Law and library both present: the fragment must reach a REAL decision and
  #    deny this write on the un-grantable list. Without this row, rows 1 and 2 would both pass
  #    against a fragment that had simply stopped working.
  mv "$D/.claude/scripts/hq/lib/policy/run-gate.bak" "$D/.claude/scripts/hq/lib/policy/run-gate.mjs"
  run bash -c "ARC_POLICY_HOOK=1 CLAUDE_PROJECT_DIR='$D' bash '$frag' < '$pay'"
  [ "$status" -eq 2 ] || { echo "an intact tree did not deny a write to the policy file: $output"; false; }
  [[ "$output" == *"un-grantable"* ]] || { echo "denied, but not by the policy library: $output"; false; }

  # 4. AND THE FLAG STILL GOVERNS. Disarmed, the same call is allowed -- otherwise this suite
  #    would be proving enforcement that the shipped default does not actually have (POL-H).
  run bash -c "CLAUDE_PROJECT_DIR='$D' bash '$frag' < '$pay'"
  [ "$status" -eq 0 ] || { echo "the disarmed fragment still blocked: $output"; false; }
}

@test "PHASE 04 -- settings.json actually ROUTES the policed tools to the fragment" {
  # THE WIRING WAS NEVER ASSERTED ANYWHERE. A day-two attacker deleted the entire
  # hooks.PreToolUse block from settings.json and all seventeen tests in this file stayed green:
  # every one of them invokes policy-hook.mjs or a .d fragment DIRECTLY, so the suite proved the
  # decision logic and never that anything calls it. That is layer 1 being unreachable while its
  # tests pass -- the same shape as the MCP branch below, which is live code no matcher reaches.
  #
  # The mutant IS the negative control: the identical predicate run against a settings object
  # with the block removed must report nothing routed.
  cd "$ARC_ROOT"
  run node --input-type=module -e '
    const fs = await import("node:fs");
    const s = JSON.parse(fs.readFileSync(".claude/settings.json", "utf8"));
    // Anchored, which is the strict reading -- if the harness anchors matchers then this is what
    // is really routed, and if it does not, anchored is a subset and still true.
    const routed = (cfg, tool) => (cfg.hooks && cfg.hooks.PreToolUse || []).some((b) =>
      typeof b.matcher === "string" && new RegExp("^(" + b.matcher + ")$").test(tool) &&
      (b.hooks || []).some((h) => typeof h.command === "string"
        && h.command.includes(".claude/hooks/PreToolUse")));
    const mutant = JSON.parse(JSON.stringify(s));
    delete mutant.hooks.PreToolUse;
    const row = (cfg, tag) => ["Bash","Edit","Write","Read","Grep","Glob"]
      .map((t) => tag + ":" + t + "=" + routed(cfg, t)).join(" ");
    console.log(row(s, "live") + " " + row(mutant, "mutant"));'
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # Read/Grep/Glob joined the list on 2026-08-24. ADR-1415 added a READ boundary and wired
  # only `Read`, while the agent it governs declares `Read, Glob, Grep` -- so deleting the
  # new matcher, or shipping it narrow, left this test green exactly the way deleting the
  # whole block once did. The list is the tools that must be routed, so it grows with them.
  for t in Bash Edit Write Read Grep Glob; do
    [[ "$output" == *"live:$t=true"* ]] || {
      echo "$t reaches no policy hook at all -- layer 1 is unreachable for it: $output"; false; }
    # THE MUTANT. If this says true, the predicate is not reading the wiring and the row above
    # proves nothing.
    [[ "$output" == *"mutant:$t=false"* ]] || {
      echo "the predicate passes with the PreToolUse block deleted -- it measures nothing: $output"; false; }
  done
}

@test "this file registered every test it declares" {
  [ "${#BATS_TEST_NAMES[@]}" -eq 20 ] || {
    echo "registered ${#BATS_TEST_NAMES[@]} tests, expected 20 -- a @test was silently dropped"
    false
  }
}
