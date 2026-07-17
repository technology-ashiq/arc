#!/usr/bin/env bats
# Phase 03 -- the byte-diff gate (arc-bytediff.sh): proves a product move relocated files
# without altering them (LF-normalized SHA-256 content + git mode). Adversarial pass included.
bats_require_minimum_version 1.5.0
load 'test_helper'

BD="$ARC_ROOT/.claude/scripts/arc-bytediff.sh"

# stage a file, git-mv it under core/, return in the moved state (old in HEAD, new in tree)
_seed_move() {  # <content>
  mkdir -p .claude/scripts
  printf '%s' "$1" > .claude/scripts/x.sh
  git add -A && git commit -qm "seed x.sh"
  mkdir -p .claude/scripts/core
  git mv .claude/scripts/x.sh .claude/scripts/core/x.sh
}

@test "verify-move: a clean git-mv (content preserved) passes (exit 0)" {
  _arc_sandbox
  _seed_move $'#!/bin/sh\necho hi\n'
  run bash "$BD" verify-move .claude/scripts/x.sh .claude/scripts/core/x.sh
  [ "$status" -eq 0 ]
  [[ "$output" == *"OK"* ]]
}

@test "verify-move: content altered during the move fails (exit 2, names the file)" {
  _arc_sandbox
  _seed_move $'original\n'
  printf 'TAMPERED\n' >> .claude/scripts/core/x.sh          # content changed while moving
  run bash "$BD" verify-move .claude/scripts/x.sh .claude/scripts/core/x.sh
  [ "$status" -eq 2 ]
  [[ "$output" == *"content altered"* ]]
}

@test "verify-move: a git mode change (exec bit dropped) fails (exit 2)" {
  _arc_sandbox
  mkdir -p .claude/scripts
  printf '#!/bin/sh\n' > .claude/scripts/x.sh
  git add .claude/scripts/x.sh
  git update-index --chmod=+x -- .claude/scripts/x.sh       # 100755 in the index (robust on Windows)
  git commit -qm "seed exec"
  mkdir -p .claude/scripts/core
  git mv .claude/scripts/x.sh .claude/scripts/core/x.sh
  git update-index --chmod=-x -- .claude/scripts/core/x.sh  # drop exec -> 100644
  run bash "$BD" verify-move .claude/scripts/x.sh .claude/scripts/core/x.sh
  [ "$status" -eq 2 ]
  [[ "$output" == *"mode altered"* ]]
}

@test "verify-move: line-ending-only change is normalized away, still passes (LF-norm, adversarial)" {
  _arc_sandbox
  _seed_move $'a\nb\n'
  printf 'a\r\nb\r\n' > .claude/scripts/core/x.sh           # same content, CRLF (a Windows checkout)
  run bash "$BD" verify-move .claude/scripts/x.sh .claude/scripts/core/x.sh
  [ "$status" -eq 0 ]                                       # LF-normalized -> identical
}

@test "verify-move: old path absent in HEAD fails cleanly (exit 2, no crash)" {
  _arc_sandbox
  run bash "$BD" verify-move .claude/scripts/ghost.sh .claude/scripts/core/ghost.sh
  [ "$status" -eq 2 ]
  [[ "$output" == *"not found"* ]]
}

@test "verify-move: new path missing (move forgotten) fails cleanly (exit 2)" {
  _arc_sandbox
  mkdir -p .claude/scripts
  printf 'x\n' > .claude/scripts/x.sh
  git add -A && git commit -qm seed                         # committed at old path, never moved
  run bash "$BD" verify-move .claude/scripts/x.sh .claude/scripts/core/x.sh
  [ "$status" -eq 2 ]
  [[ "$output" == *"missing"* ]]
}

@test "verify-moves: batch passes when all preserved, fails if any altered" {
  _arc_sandbox
  mkdir -p .claude/scripts
  printf 'A\n' > .claude/scripts/a.sh; printf 'B\n' > .claude/scripts/b.sh
  git add -A && git commit -qm seed
  mkdir -p .claude/scripts/core
  git mv .claude/scripts/a.sh .claude/scripts/core/a.sh
  git mv .claude/scripts/b.sh .claude/scripts/core/b.sh
  printf '.claude/scripts/a.sh\t.claude/scripts/core/a.sh\n.claude/scripts/b.sh\t.claude/scripts/core/b.sh\n' > moves.tsv
  run bash "$BD" verify-moves moves.tsv
  [ "$status" -eq 0 ]
  printf 'TAMPER\n' >> .claude/scripts/core/b.sh            # break one
  run bash "$BD" verify-moves moves.tsv
  [ "$status" -eq 2 ]
  [[ "$output" == *"INTEGRITY FAILURE"* ]]
}
