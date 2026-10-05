#!/usr/bin/env bats
# org Cycle 20 Phase 00 -- a process names a role; arc-run seats an agent (REQ-01, REQ-02, ADR-1626).
#
# Every arc-run assertion observes the CHILD (the prompt the fake CLI received) as well as the receipt:
# receipts are written by the code under test, so a suite reading only receipts asks the accused to testify.
bats_require_minimum_version 1.5.0
load 'test_helper'

RUN()  { echo "$ARC_ROOT/.claude/scripts/engine/arc-run.mjs"; }
LINT() { echo "$ARC_ROOT/.claude/scripts/engine/process-lint.mjs"; }
CLI()  { echo "$ARC_ROOT/tests/fixtures/org/fake-claude-seat.mjs"; }
READ() { node "$ARC_ROOT/tests/fixtures/engine/read-receipt.mjs" "$ARC_SPINE_ROOT" "$@"; }
CARD() { echo "$ARC_ROOT/org/roles/e-engineering/devops-release.role.yaml"; }

setup() {
  export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine"
  mkdir -p "$ARC_SPINE_ROOT"
  export FAKE_CLAUDE_PROMPT_FILE="$BATS_TEST_TMPDIR/prompt.txt"
}

@test "role-seat: the resolver fixture runs every check clean" {
  run node "$ARC_ROOT/tests/org/role-seat.mjs"
  [[ "$output" == *"RAN role-seat "* ]] || { echo "the fixture never ran: $output"; false; }
  [[ "$output" == *", 0 failed"* ]] || { echo "$output"; false; }
  [ "$status" -eq 0 ]
}

@test "role-seat: lint passes the real processes, which now name their roles" {
  run grep -c '^role: ' "$ARC_ROOT/processes/commit-msg-draft.process.yaml"
  [ "$output" = "1" ] || { echo "commit-msg-draft names no role"; false; }
  run node "$(LINT)" --all --root "$ARC_ROOT"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "role-seat: lint FAILs a role with no card, and a card that binds another process" {
  local f="$BATS_TEST_TMPDIR/commit-msg-draft.process.yaml"
  sed 's/^role: .*/role: no-such-role/' "$ARC_ROOT/processes/commit-msg-draft.process.yaml" > "$f"
  grep -q '^role: no-such-role$' "$f" || { echo "the mutant was not written"; false; }
  run node "$(LINT)" --root "$ARC_ROOT" "$f"
  [ "$status" -ne 0 ]
  [[ "$output" == *"[role-card]"*"no role card has id"* ]] || { echo "$output"; false; }

  sed 's/^role: .*/role: code-reviewer/' "$ARC_ROOT/processes/commit-msg-draft.process.yaml" > "$f"
  run node "$(LINT)" --root "$ARC_ROOT" "$f"
  [ "$status" -ne 0 ]
  [[ "$output" == *"[role-card]"*"binds process"* ]] || { echo "$output"; false; }
}

@test "role-seat: a default run receipts the role and keeps the prompt unseated" {
  ARC_CLAUDE_CLI="$(CLI)" run node "$(RUN)" --process commit-msg-draft --driver claude-code --root "$ARC_ROOT"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ -s "$FAKE_CLAUDE_PROMPT_FILE" ] || { echo "the fake CLI never ran"; false; }
  [ "$(READ payload role)" = "devops-release" ] || { echo "role=$(READ payload role)"; false; }
  # devops-release binds no agent: nobody sits it, and the receipt says so rather than inventing one.
  [ "$(READ payload role_agent_source)" = "none" ] || { echo "source=$(READ payload role_agent_source)"; false; }
  ! grep -q '^SEAT: ' "$FAKE_CLAUDE_PROMPT_FILE" || { echo "a default run carried a persona"; false; }
}

@test "role-seat: --trial-seat puts the agent in front of the process, receipts trial, and leaves the card alone" {
  local before; before="$(sha256sum "$(CARD)" | cut -d' ' -f1)"
  ARC_CLAUDE_CLI="$(CLI)" run node "$(RUN)" --process commit-msg-draft --driver claude-code --trial-seat code-reviewer --root "$ARC_ROOT"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ -s "$FAKE_CLAUDE_PROMPT_FILE" ] || { echo "the fake CLI never ran"; false; }
  grep -q '^SEAT: code-reviewer (trial for role devops-release)$' "$FAKE_CLAUDE_PROMPT_FILE" || { echo "the persona never reached the CLI: $(head -5 "$FAKE_CLAUDE_PROMPT_FILE")"; false; }
  [ "$(READ payload role_agent)" = "code-reviewer" ] || { echo "agent=$(READ payload role_agent)"; false; }
  [ "$(READ payload role_agent_source)" = "trial" ]
  [ "$(READ payload trial_role)" = "devops-release" ]
  # A trial earns the seat no scorecard credit: no payload.role at all.
  [ "$(READ payload role)" = "ABSENT" ] || { echo "a trial carried payload.role=$(READ payload role)"; false; }
  [ "$(sha256sum "$(CARD)" | cut -d' ' -f1)" = "$before" ] || { echo "the run changed the card"; false; }
}

@test "role-seat: --trial-seat refuses twice, empty, unknown, and on a process with no role -- exit 2, no receipt" {
  run node "$(RUN)" --process commit-msg-draft --driver claude-code --trial-seat code-reviewer --trial-seat developer --root "$ARC_ROOT"
  [ "$status" -eq 2 ] && [[ "$output" == *"given twice"* ]] || { echo "twice: $status $output"; false; }
  run node "$(RUN)" --process commit-msg-draft --driver claude-code --trial-seat "" --root "$ARC_ROOT"
  [ "$status" -eq 2 ] || { echo "empty: $status $output"; false; }
  run node "$(RUN)" --process commit-msg-draft --driver claude-code --trial-seat no-such-agent --root "$ARC_ROOT"
  [ "$status" -eq 2 ] && [[ "$output" == *"not an agent in .claude/agents/"* ]] || { echo "unknown: $status $output"; false; }
  run node "$(RUN)" --process develop-proof --driver claude-code --trial-seat code-reviewer --root "$ARC_ROOT"
  [ "$status" -eq 2 ] && [[ "$output" == *"names none"* ]] || { echo "no role: $status $output"; false; }
  [ "$(READ kindcount run.completed)" = "0" ] || { echo "a refusal left a receipt"; false; }
}

@test "role-seat: --dry-run names the seat and why" {
  run node "$(RUN)" --process review-diff --driver claude-code --dry-run --root "$ARC_ROOT"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"role code-reviewer -> code-reviewer (card: "* ]] || { echo "$output"; false; }
}

@test "role-seat: a role process that emits a closed-payload kind still completes, role fields on run.completed only" {
  ARC_CLAUDE_CLI="$ARC_ROOT/tests/fixtures/engine/fake-claude-stream.mjs" FAKE_CLAUDE_RECEIPT="fresh:council.verdict" FAKE_CLAUDE_PAUSE_MS=0 \
    run node "$(RUN)" --process council-convene --driver claude-code --input '{"question":"a probe"}' --root "$ARC_ROOT"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$(READ payload role)" = "board-advisors" ] || { echo "role=$(READ payload role)"; false; }
  [ "$(READ payload role_agent)" = "council-advocate" ] || { echo "agent=$(READ payload role_agent)"; false; }
  [ "$(READ payload role_agent_source)" = "card" ]
}
