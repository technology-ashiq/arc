#!/usr/bin/env bats
# The spine refuses to resolve inside a LINKED GIT WORKTREE.
#
# WHY THIS GUARD EXISTS, measured rather than argued. `.claude/state/` is gitignored, so every
# worktree gets its own empty spine, and spineRoot() used to hand one back without comment. The emit
# then SUCCEEDED -- valid event, correct canonical form, real ULID -- into a spine no reader consults.
# On 2026-08-10 the checkouts on one machine held: main clone 967 events, arc-policy 613, arc-absorb
# 199. A `phase.closed` receipt cited in an already-merged tracker was unresolvable from the canonical
# spine because it had been written in a worktree.
#
# It cost three failures in one session before the guard existed: an owner `arc-inbox approve` that
# recorded nothing and had to be handed over twice, and a `judgement.mjs reveal` that refused a real
# decision as if it were forged, because the seal and the decision sat on different spines.
#
# A WARNING WOULD NOT HAVE DONE. arc-inbox folds its OPEN set over the spine with no state stored
# elsewhere (ADR-0030), so a worktree spine prints "no open approvals" and exits 0 -- a silent false
# negative on the one surface built to stop a decision going unrecorded. And a failed emit leaves no
# trace, so "it ran" and "it landed" are different facts that a warning on stdout does not separate.
bats_require_minimum_version 1.5.0
load 'test_helper'

EVENT="$ARC_ROOT/.claude/scripts/hq/arc-event.sh"

# Build a REAL repo with a REAL linked worktree. Nothing here fakes git's answer: the guard keys on
# `--absolute-git-dir` differing from `--git-common-dir`, which only a genuine linked worktree produces,
# so a hand-made `.git` file would test the wrong thing.
#
# Identity is set repo-LOCAL, not through GIT_AUTHOR_* env vars: a clean CI runner has no global
# identity and `git commit` exits 128, which is green locally and red on every leg.
_make_repo_with_worktree() {
  MAIN="$BATS_TEST_TMPDIR/main"
  WT="$BATS_TEST_TMPDIR/wt"
  mkdir -p "$MAIN"
  git -C "$MAIN" init -q
  git -C "$MAIN" config user.email "spine-guard@test.invalid"
  git -C "$MAIN" config user.name "spine guard test"
  mkdir -p "$MAIN/.claude/state/hq/events"
  printf 'seed\n' > "$MAIN/seed.txt"
  git -C "$MAIN" add seed.txt
  git -C "$MAIN" commit -q -m "seed"
  git -C "$MAIN" worktree add -q "$WT" -b wtbranch
  mkdir -p "$WT/.claude/state/hq/events"

  # The premise of every assertion below. If git does not actually report a linked worktree here, the
  # refusals would pass for the wrong reason and the positive control would be the only real test.
  local gd cd_
  gd="$(git -C "$WT" rev-parse --absolute-git-dir)"
  cd_="$(git -C "$WT" rev-parse --path-format=absolute --git-common-dir)"
  [ "$gd" != "$cd_" ] || skip "this git does not report a distinct git-dir for a linked worktree"
}

@test "worktree guard: an emit from a linked worktree is REFUSED, exit 2" {
  _make_repo_with_worktree
  run env -u ARC_SPINE_ROOT bash -c "cd '$WT' && bash '$EVENT' emit note.logged --payload '{\"n\":\"x\"}' --strict"
  [ "$status" -eq 2 ]
  [[ "$output" == *"WORKTREE_SPINE"* ]] || { echo "$output"; false; }
}

# ...AND NOTHING WAS WRITTEN. The refusal is only worth having if the event did not land anyway; a
# guard that complains after appending is worse than none, because the operator now believes it failed.
@test "worktree guard: the refused emit writes NO event into the worktree spine" {
  _make_repo_with_worktree
  run env -u ARC_SPINE_ROOT bash -c "cd '$WT' && bash '$EVENT' emit note.logged --payload '{\"n\":\"x\"}' --strict"
  [ "$status" -eq 2 ]
  [ "$(find "$WT/.claude/state/hq/events" -name '*.jsonl' | wc -l | tr -d ' ')" = "0" ]
}

# THE DISCRIMINATION CONTROL, and the reason the two tests above mean anything: the identical command
# from the MAIN clone of the same repo must succeed. Without this, a guard that refused every emit
# everywhere would pass both refusal tests.
@test "worktree guard: the SAME emit from the main clone succeeds (control)" {
  _make_repo_with_worktree
  run env -u ARC_SPINE_ROOT bash -c "cd '$MAIN' && bash '$EVENT' emit note.logged --payload '{\"n\":\"x\"}' --strict"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$(find "$MAIN/.claude/state/hq/events" -name '*.jsonl' | wc -l | tr -d ' ')" -ge 1 ]
}

# The message has to carry the fix, not just the diagnosis. A guard that refuses without naming the
# directory produces the exact double-paste this guard was written after.
@test "worktree guard: the refusal names the main clone and the cd command" {
  _make_repo_with_worktree
  run env -u ARC_SPINE_ROOT bash -c "cd '$WT' && bash '$EVENT' emit note.logged --payload '{\"n\":\"x\"}' --strict"
  [[ "$output" == *"canonical spine is in the main clone"* ]] || { echo "$output"; false; }
  [[ "$output" == *"cd "* ]]
  [[ "$output" == *"$(basename "$MAIN")"* ]]
  # and it must say arc-inbox would lie, because that is the consequence an operator cannot see
  [[ "$output" == *"no open approvals"* ]]
}

# THE TEST DOOR MUST STILL WORK, or this guard breaks all ~2200 tests that run from a worktree with
# ARC_SPINE_ROOT pointed at a temp dir. It is checked BEFORE the guard by design.
@test "worktree guard: ARC_SPINE_ROOT bypasses the guard, from inside a worktree" {
  _make_repo_with_worktree
  local s="$BATS_TEST_TMPDIR/explicit"
  mkdir -p "$s"
  run bash -c "cd '$WT' && ARC_SPINE_ROOT='$s' ARC_SPINE_NOW=1784736000000 bash '$EVENT' emit note.logged --payload '{\"n\":\"x\"}' --strict"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$(find "$s/events" -name '*.jsonl' | wc -l | tr -d ' ')" -ge 1 ]
}

# HOOK MODE STILL NEVER BLOCKS (ADR-0031). The guard raises a SpineError like any other refusal, so it
# must not turn a hook into a failing command -- that would make an armed hook break every session run
# from a worktree, which is a far worse failure than a misfiled receipt.
@test "worktree guard: hook mode refuses without blocking, exit 0, and is NOT silent" {
  _make_repo_with_worktree
  run env -u ARC_SPINE_ROOT bash -c "cd '$WT' && bash '$EVENT' emit note.logged --payload '{\"n\":\"x\"}'"
  [ "$status" -eq 0 ] || { echo "hook mode must not block: $output"; false; }
  [ "$(find "$WT/.claude/state/hq/events" -name '*.jsonl' | wc -l | tr -d ' ')" = "0" ]
  # NOT SILENT is the load-bearing half. This refusal happens while RESOLVING the spine, so there is no
  # spine to quarantine into -- the event is dropped. Dropped-and-announced is acceptable; dropped in
  # silence would be the same invisibility this guard exists to end, just relocated. So the reason must
  # reach stderr, where a hook's own log carries it.
  [[ "$output" == *"SKIP WORKTREE_SPINE"* ]] || { echo "hook mode dropped the event silently: $output"; false; }
  [[ "$output" == *"canonical spine is in the main clone"* ]]
}

@test "spine-worktree-guard suite registers every test it defines" {
  registered=${#BATS_TEST_NAMES[@]}
  [ "$registered" -eq 7 ] || { echo "registered $registered tests, expected 7"; false; }
}
