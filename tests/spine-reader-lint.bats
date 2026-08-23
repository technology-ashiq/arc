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

@test "a path containing /* does not blind the scanner for the rest of the file" {
  # THE BUG, pinned. arc-dash.mjs serves an HTML shell containing
  #   every <code>/api/*</code> read needs ...
  # and the `/*` in `/api/*` opened a phantom block comment. The stripper then blanked the
  # next 99 LINES looking for a `*/`, and two real token-bearing lines lived inside that
  # window. Measured before the fix: 2 hidden. After: 0.
  #
  # Nothing reported it. It surfaced only because an unrelated edit moved where the phantom
  # `*/` landed, which changed WHICH lines were hidden -- so a gate had been reporting clean
  # over a region it never read, which is the exact failure this lint's own loop comment
  # names ("a gate that cannot tell 'I looked and found nothing' from 'I never looked'").
  {
    printf '%s\n' 'const help = "every <code>/api/*</code> read needs a token";'
    printf '%s\n' 'const filler = 1;'
    printf '%s\n' 'const bypass = readFileSync("events/2026-01-01.jsonl", "utf8");'
  } > "$SB/.claude/scripts/hq/arc-slash-star.mjs"
  git -C "$SB" add .claude/scripts/hq/arc-slash-star.mjs
  run _lint
  [ "$status" -eq 1 ] || { echo "the bypass AFTER a /*-bearing path was not seen: $output"; false; }
  [[ "$output" == *"arc-slash-star.mjs:3"* ]] || { echo "the finding did not name the real line: $output"; false; }
}

@test "a genuine block comment is still stripped, so prose does not become a finding" {
  # The other direction of the same rule. Narrowing what counts as a comment opener must not
  # narrow it to nothing: a token that appears only inside a real comment is documentation,
  # and a lint that fails on its own explanatory prose gets muted by the next person.
  {
    printf '%s\n' '/* this module never opens events/2026-01-01.jsonl directly */'
    printf '%s\n' '/**'
    printf '%s\n' ' * nor state.db, nor node:sqlite -- it goes through the reader.'
    printf '%s\n' ' */'
    printf '%s\n' 'const ok = 1; // not events/x.jsonl either'
  } > "$SB/.claude/scripts/hq/arc-prose.mjs"
  git -C "$SB" add .claude/scripts/hq/arc-prose.mjs
  run _lint
  [ "$status" -eq 0 ] || { echo "prose inside real comments was reported as a bypass: $output"; false; }
}

@test "an unterminated block comment is REPORTED, not silently half-scanned" {
  # A file the stripper cannot finish parsing is a file it did not fully read. Saying so is
  # the difference between "clean" and "I stopped looking here", which is the whole subject
  # of this suite.
  {
    printf '%s\n' 'const a = 1;'
    printf '%s\n' '/* opened and never closed'
    printf '%s\n' 'const bypass = readFileSync("events/2026-01-01.jsonl", "utf8");'
  } > "$SB/.claude/scripts/hq/arc-unterminated.mjs"
  git -C "$SB" add .claude/scripts/hq/arc-unterminated.mjs
  run _lint
  [[ "$output" == *"unterminated block comment"* ]] || { echo "a half-scanned file was not announced: $output"; false; }
}

@test "a glob inside a STRING does not blind the scanner either" {
  # The second half of the same root cause, and the one that survived the first fix. Three
  # tracked files carry a glob in a quoted string -- `roots: ["/**"]` in policy/lint.mjs and
  # policy/resources.mjs, `".claude/scripts/**"` in jobs/schema.mjs -- and each `/*` opened a
  # phantom block that ran to end of file.
  #
  # Measured repo-wide after the fix: of the token-bearing lines the stripper blanks, ALL are
  # prose inside real comments and NONE is code. Before it, two live code lines in arc-dash
  # were invisible.
  {
    printf '%s\n' 'const roots = ["/**", ".claude/scripts/**"];'
    printf '%s\n' 'const filler = 1;'
    printf '%s\n' 'const bypass = readFileSync("events/2026-01-01.jsonl", "utf8");'
  } > "$SB/.claude/scripts/hq/arc-glob-string.mjs"
  git -C "$SB" add .claude/scripts/hq/arc-glob-string.mjs
  run _lint
  [ "$status" -eq 1 ] || { echo "a bypass after a quoted glob was not seen: $output"; false; }
  [[ "$output" == *"arc-glob-string.mjs:3"* ]] || { echo "the finding did not name the real line: $output"; false; }
}

@test "a REAL trailing block comment still ends where it ends" {
  # The narrowing must not stop a genuine `code /* comment */` from being stripped, or the
  # lint starts failing on its own explanatory asides and someone mutes it.
  {
    printf '%s\n' 'const a = 1; /* not events/x.jsonl */'
    printf '%s\n' 'const b = 2; /* opens here'
    printf '%s\n' '   still inside: state.db, node:sqlite'
    printf '%s\n' '   closes here */ const c = 3;'
  } > "$SB/.claude/scripts/hq/arc-trailing.mjs"
  git -C "$SB" add .claude/scripts/hq/arc-trailing.mjs
  run _lint
  [ "$status" -eq 0 ] || { echo "a real block comment was treated as code: $output"; false; }
}
