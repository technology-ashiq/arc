#!/usr/bin/env bats
# distribute Phase 04 -- the `arc` command (bin/arc.mjs) and the package that carries it (ADR-2008, REQ-08).
#
# `arc` dispatches to the scripts that already exist. `arc doctor` checks the package itself (Node, its own
# files, a plan for every target), `arc init` installs through arc-install.mjs and points a git repo's
# core.hooksPath at the consumer hooks, and package.json can install but never publish. Each run asserts
# its own marker line (it RAN) before what it printed.

bats_require_minimum_version 1.5.0
load 'test_helper'

ARC() { printf '%s' "$ARC_ROOT/bin/arc.mjs"; }
native() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }
count() { printf '%s\n' "$output" | tr -d '\r' | grep -cE "$1" || true; }
proj() { local d="$BATS_TEST_TMPDIR/$1"; mkdir -p "$d" && (cd "$d" && pwd -P); }
gitrepo() {
  local d; d=$(proj "$1") || return 1
  git -C "$d" init -q && git -C "$d" config user.email t@example.invalid && git -C "$d" config user.name t && git -C "$d" checkout -q -b feat/x
  printf '%s' "$d"
}

@test "distribute-cli: every test in the file is registered" {
  local declared
  declared=$(grep -c '^@test "distribute-cli: ' "$BATS_TEST_FILENAME")
  [ "$declared" -eq 8 ] || { echo "declared $declared, expected 8"; false; }
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "distribute-cli: package.json installs a bin, carries no dependency and cannot publish" {
  local p="$ARC_ROOT/package.json"
  [ -s "$p" ] || { echo "no package.json"; false; }
  [ "$(_arc_json "$p" 'j.bin && j.bin.arc')" = "bin/arc.mjs" ] || { echo "no arc bin"; false; }
  [ "$(_arc_json "$p" 'JSON.stringify(j.dependencies)')" = "{}" ] || { echo "dependencies is not {}"; false; }
  [ "$(_arc_json "$p" 'j.private === true')" = "true" ] || { echo "not private, so npm would publish it"; false; }
  [ "$(_arc_json "$p" 'Array.isArray(j.files) && j.files.length > 0')" = "true" ] || { echo "no files allowlist"; false; }
  [ "$(_arc_json "$p" 'Object.keys(j.scripts || {}).filter((k) => /publish|prepare|install|pack/.test(k)).join(",")')" = "" ] || { echo "a lifecycle script would run on install or publish"; false; }
}

@test "distribute-cli: arc doctor checks the package and plans every target" {
  run --separate-stderr node "$(ARC)" doctor
  printf '%s\n' "$output" | tr -d '\r' | grep -qx 'RAN arc-doctor' || { echo "doctor never finished: $output $stderr"; false; }
  [ "$status" -eq 0 ] && [ "$(count '^FAIL ')" -eq 0 ] || { echo "status $status: $output"; false; }
  local t
  for t in claude-code codex opencode skills-only; do
    [ "$(count "^ok target $t: plan: $t — [0-9]+ file\(s\), ")" -eq 1 ] || { echo "no plan for $t: $output"; false; }
  done
  [ "$(count '^arc [0-9]+\.[0-9]+\.[0-9]+ at .*: ready to install$')" -eq 1 ] || { echo "$output"; false; }
}

@test "distribute-cli: arc init installs, sets the consumer hooks path, and arc doctor --dir reads it clean" {
  local d; d=$(gitrepo p) || false
  run --separate-stderr node "$(ARC)" init --target claude-code --dir "$(native "$d")"
  [ "$(count '^plan: claude-code — ')" -eq 1 ] || { echo "init never planned: $output $stderr"; false; }
  [ "$status" -eq 0 ] && [ "$(count '^hooks: core\.hooksPath=\.claude/templates/githooks ')" -eq 1 ] || { echo "status $status: $output"; false; }
  [ "$(git -C "$d" config --get core.hooksPath)" = ".claude/templates/githooks" ] || { echo "hooksPath not set"; false; }
  [ -s "$d/.claude/templates/githooks/pre-commit" ] && [ -s "$d/.claude/commands/arc-commit.md" ] || { echo "the install placed nothing"; false; }
  run --separate-stderr node "$(ARC)" doctor --dir "$(native "$d")"
  [ "$status" -eq 0 ] && [ "$(count '^doctor: [0-9]+ placed, 0 degraded, 0 missing, 0 unmanaged-conflict$')" -eq 1 ] || { echo "status $status: $output"; false; }
}

# The hook is real: on a fresh clone of the project, a commit on main is refused at commit time.
@test "distribute-cli: the installed pre-commit hook refuses a commit on main" {
  local d; d=$(gitrepo p) || false
  run --separate-stderr node "$(ARC)" init --target claude-code --dir "$(native "$d")"
  [ "$status" -eq 0 ] || { echo "init: $output $stderr"; false; }
  printf 'x\n' > "$d/x.txt" && git -C "$d" add x.txt
  run git -C "$d" commit -q -m "on a branch"
  [ "$status" -eq 0 ] && [[ "$output" == *"branch-guard: branch feat/x ok"* ]] || { echo "the hook did not run, or refused a branch commit: $status $output"; false; }
  git -C "$d" checkout -q -b main
  printf 'y\n' > "$d/y.txt" && git -C "$d" add y.txt
  run git -C "$d" commit -q -m "on main"
  [ "$status" -ne 0 ] && [[ "$output" == *"branch-guard: refuses commit on main"* ]] || { echo "status $status: $output"; false; }
}

@test "distribute-cli: a project's own hooks path is left alone and named" {
  local d; d=$(gitrepo p) || false
  git -C "$d" config core.hooksPath .husky
  run --separate-stderr node "$(ARC)" init --target skills-only --dir "$(native "$d")"
  [ "$(count '^plan: skills-only — ')" -eq 1 ] || { echo "$output $stderr"; false; }
  [ "$status" -eq 0 ] && [ "$(git -C "$d" config --get core.hooksPath)" = ".husky" ] || { echo "status $status, hooksPath changed: $output"; false; }
  [ "$(count '^hooks: left as core\.hooksPath=\.husky; the project chose its own')" -eq 1 ] || { echo "$output"; false; }
}

@test "distribute-cli: a bad verb or a missing target is a usage error, exit 2" {
  run --separate-stderr node "$(ARC)" frobnicate
  [ "$status" -eq 2 ] && [[ "$stderr" == *"unknown command frobnicate"* ]] || { echo "verb: $status $stderr"; false; }
  run --separate-stderr node "$(ARC)" init --dir "$BATS_TEST_TMPDIR"
  [ "$status" -eq 2 ] && [[ "$stderr" == *"--target must be one of claude-code, codex, opencode, skills-only"* ]] || { echo "target: $status $stderr"; false; }
  run --separate-stderr node "$(ARC)" init --target --dir x
  [ "$status" -eq 2 ] && [[ "$stderr" == *"--target needs a value"* ]] || { echo "value: $status $stderr"; false; }
  run --separate-stderr node "$(ARC)" doctor --dir --repo
  [ "$status" -eq 2 ] && [[ "$stderr" == *"usage: arc init"* ]] || { echo "doctor flag-shaped dir: $status $stderr"; false; }
  run --separate-stderr node "$(ARC)" init --target codex --target opencode --dir "$BATS_TEST_TMPDIR"
  [ "$status" -eq 2 ] && [[ "$stderr" == *"--target given twice with different values"* ]] || { echo "twice: $status $stderr"; false; }
}

# Hooks are wired only where they take nothing away (attack 188f724 B1, B2).
@test "distribute-cli: hooks are not wired in a subdirectory of a repo, nor over hooks the project already runs" {
  local r sub; r=$(gitrepo outer) || false
  mkdir -p "$r/packages/app"; sub=$(cd "$r/packages/app" && pwd -P)
  run --separate-stderr node "$(ARC)" init --target claude-code --dir "$(native "$sub")"
  [ "$(count '^plan: claude-code — ')" -eq 1 ] || { echo "$output $stderr"; false; }
  [ "$status" -eq 0 ] && [ "$(count '^hooks: not set -- .* is inside the repo at .*, not its root')" -eq 1 ] || { echo "subdir: $status $output"; false; }
  [ -z "$(git -C "$r" config --get core.hooksPath)" ] || { echo "the outer repo's hooks path was changed"; false; }
  local h; h=$(gitrepo hooked) || false
  printf '#!/bin/sh\nexit 0\n' > "$h/.git/hooks/pre-commit"
  run --separate-stderr node "$(ARC)" init --target claude-code --dir "$(native "$h")"
  [ "$status" -eq 0 ] && [ "$(count '^hooks: not set -- the project runs pre-commit from .*, which core\.hooksPath would disable')" -eq 1 ] || { echo "hooked: $status $output"; false; }
  [ -z "$(git -C "$h" config --get core.hooksPath)" ] || { echo "the project's own hooks were disabled"; false; }
}
