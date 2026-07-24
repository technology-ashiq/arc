#!/usr/bin/env bats
# Phase 03 — REQ-09 / ADR-0030: the reader-only grep-lint (the spine-api gate, TRIAL WARN).
#
# Proves the lint flags a consumer that bypasses the spine reader (opens events/*.jsonl or
# state.db, or imports node:sqlite) while EXEMPTING the implementation layer (spine.mjs,
# arc-replay.mjs, lib/**), IGNORING comments, and scanning only TRACKED source. WARN-first: it
# exits 1 on a violation so arc.gates.yaml (mode: warn) reports without blocking a session.
bats_require_minimum_version 1.5.0
load 'test_helper'

LINT_SRC="$ARC_ROOT/.claude/scripts/review/spine-reader-lint.sh"

setup() {
  SB="$BATS_TEST_TMPDIR/repo"
  mkdir -p "$SB/.claude/scripts/hq/lib" "$SB/.claude/scripts/review"
  cp "$LINT_SRC" "$SB/.claude/scripts/review/spine-reader-lint.sh"

  # the exempt implementation layer -- ALLOWED to touch raw files + sqlite
  printf '%s\n' 'const STATE_DB = (r) => r + "/derived/state.db";' 'import { DatabaseSync } from "node:sqlite";' > "$SB/.claude/scripts/hq/spine.mjs"
  printf '%s\n' 'export const dayFile = (r,d) => r + "/events/" + d + ".jsonl";' > "$SB/.claude/scripts/hq/lib/spine-io.mjs"

  # a clean consumer -- reader-only, plus a COMMENT naming the tokens (must be ignored)
  printf '%s\n' '// this consumer never opens events/*.jsonl or state.db -- it uses the reader' 'import { query } from "./spine.mjs";' 'export const rows = 1;' > "$SB/.claude/scripts/hq/arc-brief.mjs"

  # Repo-LOCAL identity (in $SB/.git/config), so the per-test `git commit`s below inherit it on
  # a clean runner too -- exporting it only inside this subshell scoped it to the seed commit and
  # left the CI Ubuntu legs (no global identity) failing the later commits with status 128.
  ( cd "$SB" && git init -q \
      && git config user.email arc-test@arc.local && git config user.name arc-test \
      && git add -A && git commit -qm seed )
}

_lint() { ( cd "$SB" && bash .claude/scripts/review/spine-reader-lint.sh ); }

@test "clean consumers pass; exempt layer with real tokens is not flagged; comment tokens ignored" {
  run _lint
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "a consumer that opens events/*.jsonl directly is flagged (WARN exit 1), naming the file" {
  printf '%s\n' 'import { readFileSync } from "node:fs";' 'const raw = readFileSync(root + "/events/" + day + ".jsonl");' > "$SB/.claude/scripts/hq/arc-inbox.mjs"
  ( cd "$SB" && git add -A && git commit -qm inbox )
  run _lint
  [ "$status" -eq 1 ]
  [[ "$output" == *"arc-inbox.mjs"* ]]
  [[ "$output" == *"WARN"* ]]
}

@test "a consumer reaching state.db or node:sqlite directly is flagged" {
  printf '%s\n' 'import { DatabaseSync } from "node:sqlite";' 'const db = new DatabaseSync(root + "/derived/state.db");' > "$SB/.claude/scripts/hq/arc-dash.mjs"
  ( cd "$SB" && git add -A && git commit -qm dash )
  run _lint
  [ "$status" -eq 1 ]
  [[ "$output" == *"arc-dash.mjs"* ]]
}

@test "a token only inside a comment (line or /* */ block) does NOT trip the lint" {
  printf '%s\n' '/* historical: we used to read events/2026.jsonl and state.db directly */' '// events/*.jsonl -- never do this' 'export const ok = 1;' > "$SB/.claude/scripts/hq/arc-note.mjs"
  ( cd "$SB" && git add -A && git commit -qm note )
  run _lint
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "an UNTRACKED violating file is not scanned (only tracked source is covered)" {
  printf '%s\n' 'const raw = "events/x.jsonl";' > "$SB/.claude/scripts/hq/arc-untracked.mjs"
  # deliberately NOT git add-ed
  run _lint
  [ "$status" -eq 0 ] || { echo "untracked file was scanned: $output"; false; }
}
