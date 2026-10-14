#!/usr/bin/env bats
# distribute Phase 09 -- REQ-16 (`arc outdated`) and REQ-17 (`arc upgrade`), ADR-2024 / ADR-2025.
#
# A fixture arc repo (a real slice of the tree, its own history and an annotated tag v0.2.0) stands in for arc; a
# project gets a codex install from it, then the fixture moves on. Each arm asserts the probe RAN before what it
# printed. Every repo sets its git identity locally (clean CI runners have none).

bats_require_minimum_version 1.5.0
load 'test_helper'

I() { printf '%s' "$ARC_ROOT/.claude/scripts/engine/arc-install.mjs"; }
P() { printf '%s' "$ARC_ROOT/tests/distribute/lifecycle-probe.mjs"; }
native() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }
count() { printf '%s\n' "$output" | tr -d '\r' | grep -cE "$1" || true; }
ran() { [ "$(count "^RAN lifecycle-probe $1$")" -eq 1 ] || { echo "probe never finished with $1: $output $stderr"; return 1; }; }
sha_of() { node -e 'const c=require("crypto");process.stdout.write(c.createHash("sha256").update(require("fs").readFileSync(process.argv[1])).digest("hex"))' "$(native "$1")"; }
g() { git -C "$1" "${@:2}"; }

setup() {
  S="$BATS_TEST_TMPDIR/arc"
  mkdir -p "$S/engine" "$S/.claude"
  cp "$ARC_ROOT/engine/harnesses.yaml" "$ARC_ROOT/engine/frontmatter-keys.yaml" "$S/engine/"
  cp -R "$ARC_ROOT/.claude/commands" "$ARC_ROOT/.claude/agents" "$ARC_ROOT/.claude/skills" "$ARC_ROOT/.claude/rules" "$S/.claude/"
  printf '0.2.0\n' > "$S/VERSION"
  printf '# Changelog\n\n## [Unreleased]\n\n## [0.2.0] - 2026-10-14\n\n### Added\n- the baseline\n' > "$S/CHANGELOG.md"
  [ -s "$S/.claude/commands/arc-commit.md" ] || { echo "fixture arc tree is empty"; return 1; }
  g "$S" init -q && g "$S" config user.email t@example.invalid && g "$S" config user.name t && g "$S" config commit.gpgsign false && g "$S" config tag.gpgsign false
  g "$S" add -A && g "$S" commit -qm base && g "$S" tag -a v0.2.0 -m v0.2.0
  C1=$(g "$S" rev-parse HEAD)
  D=$(mkdir -p "$BATS_TEST_TMPDIR/proj" && cd "$BATS_TEST_TMPDIR/proj" && pwd -P)
  run --separate-stderr node "$(I)" --target codex --dir "$(native "$D")" --source "$(native "$S")"
  [ "$status" -eq 0 ] && [ -s "$D/.arc-install.json" ] || { echo "fixture install failed: $output $stderr"; return 1; }
}

# Three more commits on the fixture arc: the third changes a rendered skill, and the changelog gains an entry.
advance() {
  printf '\nlater line\n' >> "$S/.claude/commands/arc-commit.md"
  printf '# Changelog\n\n## [Unreleased]\n\n### Changed\n- %s\n\n## [0.2.0] - 2026-10-14\n\n### Added\n- the baseline\n' "${1:-arc-commit gains a line}" > "$S/CHANGELOG.md"
  g "$S" add -A && g "$S" commit -qm one
  printf 'x\n' > "$S/note.txt" && g "$S" add -A && g "$S" commit -qm two
  printf 'y\n' >> "$S/note.txt" && g "$S" add -A && g "$S" commit -qm three
}

probe() { run --separate-stderr node "$(P)" "$1" "$(native "$D")" "$(native "$S")" "${@:2}"; }

@test "distribute-lifecycle: every test in the file is registered" {
  local declared
  declared=$(grep -c '^@test "distribute-lifecycle: ' "$BATS_TEST_FILENAME")
  [ "$declared" -eq 11 ] || { echo "declared $declared, expected 11"; false; }
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "distribute-lifecycle: the install records tag and commit in a version-2 manifest" {
  [ "$(_arc_json "$D/.arc-install.json" 'j.version')" = "2" ] || { cat "$D/.arc-install.json" | head -5; false; }
  [ "$(_arc_json "$D/.arc-install.json" 'j.tag')" = "v0.2.0" ] && [ "$(_arc_json "$D/.arc-install.json" 'j.commit')" = "$C1" ] || { echo "tag/commit: $(_arc_json "$D/.arc-install.json" 'j.tag') $(_arc_json "$D/.arc-install.json" 'j.commit')"; false; }
  [ "$(_arc_json "$D/.arc-install.json" 'j.targets.join(",")')" = "codex" ] || { echo "targets"; false; }
}

@test "distribute-lifecycle: outdated at the fixture HEAD is up to date, exit 0" {
  probe outdated
  ran 0 || false
  [ "$status" -eq 0 ] && [ "$(count "^up to date: installed v0\.2\.0@${C1:0:8} · arc v0\.2\.0@${C1:0:8}$")" -eq 1 ] || { echo "status $status: $output"; false; }
}

@test "distribute-lifecycle: outdated three commits behind names both sides and the changelog range, exit 1" {
  advance "arc-commit gains a line"
  local c4; c4=$(g "$S" rev-parse HEAD)
  probe outdated
  ran 1 || false
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  [ "$(count "^installed v0\.2\.0@${C1:0:8} · arc untagged@${c4:0:8} · 3 commits behind$")" -eq 1 ] || { echo "$output"; false; }
  [ "$(count '^changelog \[Unreleased\]$')" -eq 1 ] && [ "$(count '^  - arc-commit gains a line$')" -eq 1 ] || { echo "$output"; false; }
  [ "$(count '^changelog \[0\.2\.0\]')" -eq 0 ] || { echo "the installed section was listed as new: $output"; false; }
}

@test "distribute-lifecycle: no manifest is not-installed (3), an unknown commit and a diverged one are exit 4, never a count" {
  local empty; empty=$(mkdir -p "$BATS_TEST_TMPDIR/empty" && cd "$BATS_TEST_TMPDIR/empty" && pwd -P)
  run --separate-stderr node "$(P)" outdated "$(native "$empty")" "$(native "$S")"
  ran 3 || false
  [ "$status" -eq 3 ] && [ "$(count '^not-installed: ')" -eq 1 ] || { echo "status $status: $output"; false; }
  node -e 'const f=process.argv[1],j=JSON.parse(require("fs").readFileSync(f,"utf8"));j.commit="0123456789abcdef0123456789abcdef01234567";j.tag=null;require("fs").writeFileSync(f,JSON.stringify(j))' "$(native "$D/.arc-install.json")"
  probe outdated
  ran 4 || false
  [ "$status" -eq 4 ] && [ "$(count '^unknown commit 0123456789abcdef0123456789abcdef01234567 ')" -eq 1 ] && [ "$(count 'commits behind')" -eq 0 ] || { echo "unknown: $output"; false; }
  g "$S" checkout -qb side && printf 's\n' > "$S/side.txt" && g "$S" add -A && g "$S" commit -qm side
  local side; side=$(g "$S" rev-parse HEAD); g "$S" checkout -q -
  node -e 'const f=process.argv[1],j=JSON.parse(require("fs").readFileSync(f,"utf8"));j.commit=process.argv[2];require("fs").writeFileSync(f,JSON.stringify(j))' "$(native "$D/.arc-install.json")" "$side"
  advance
  probe outdated
  ran 4 || false
  [ "$status" -eq 4 ] && [ "$(count "^diverged $side \(not an ancestor of HEAD")" -eq 1 ] && [ "$(count 'commits behind')" -eq 0 ] || { echo "diverged: $output"; false; }
}

@test "distribute-lifecycle: a Cycle 1 version-1 manifest is read by outdated and rewritten as version 2 by upgrade" {
  node -e 'const f=process.argv[1],j=JSON.parse(require("fs").readFileSync(f,"utf8"));const files={};for(const[k,v] of Object.entries(j.files))files[k]=v.sha;require("fs").writeFileSync(f,JSON.stringify({version:1,target:"codex",source:j.commit,files,degraded:j.degraded,forced:[]}))' "$(native "$D/.arc-install.json")"
  [ "$(_arc_json "$D/.arc-install.json" 'j.version')" = "1" ] || { echo "the v1 fixture was not written"; false; }
  advance
  probe outdated
  ran 1 || false
  [ "$(count "^installed untagged@${C1:0:8} · arc untagged@")" -eq 1 ] && [ "$(count '^changelog \[Unreleased\]$')" -eq 1 ] || { echo "$output"; false; }
  probe upgrade
  ran 0 || false
  [ "$status" -eq 0 ] && [ "$(count 'record rewritten as version 2$')" -eq 1 ] || { echo "status $status: $output"; false; }
  [ "$(_arc_json "$D/.arc-install.json" 'j.version')" = "2" ] && [ "$(_arc_json "$D/.arc-install.json" 'j.commit')" = "$(g "$S" rev-parse HEAD)" ] || { echo "not rewritten"; false; }
}

@test "distribute-lifecycle: upgrade replaces what changed, backs up a local edit, and leaves an unmanaged file byte-identical" {
  local edited=.agents/skills/arc-resume/SKILL.md changed=.agents/skills/arc-commit/SKILL.md
  [ -s "$D/$edited" ] && [ -s "$D/$changed" ] || { echo "fixture lacks the managed files"; false; }
  printf 'my local note\n' >> "$D/$edited"
  printf 'venture code\n' > "$D/.agents/skills/arc-commit/venture.md"
  local before; before=$(sha_of "$D/.agents/skills/arc-commit/venture.md")
  advance
  probe upgrade
  ran 0 || false
  [ "$status" -eq 0 ] || { echo "status $status: $output"; false; }
  [ "$(count "^replaced \.agents/skills/arc-commit/SKILL\.md$")" -eq 1 ] && [ "$(count "^backed-up \.agents/skills/arc-resume/SKILL\.md$")" -eq 1 ] || { echo "$output"; false; }
  grep -q 'later line' "$D/$changed" || { echo "the changed skill was not replaced"; false; }
  [ "$(find "$D/.arc-install-backup" -path '*arc-resume/SKILL.md' | wc -l | tr -d ' ')" -eq 1 ] || { echo "no backup of the local edit"; false; }
  grep -q 'my local note' "$(find "$D/.arc-install-backup" -path '*arc-resume/SKILL.md')" || { echo "the backup does not hold the edit"; false; }
  [ "$(sha_of "$D/.agents/skills/arc-commit/venture.md")" = "$before" ] || { echo "an unmanaged file changed"; false; }
  probe outdated
  ran 0 || false
}

@test "distribute-lifecycle: a BREAKING entry in the range refuses without --confirm and writes nothing" {
  advance "**BREAKING** arc-commit renames a flag"
  grep -q '^- \*\*BREAKING\*\*' "$S/CHANGELOG.md" || { echo "fixture changelog has no BREAKING line"; false; }
  local m0; m0=$(sha_of "$D/.arc-install.json")
  probe upgrade
  ran 5 || false
  [ "$status" -eq 5 ] && [ "$(count '^BREAKING \[Unreleased\] - \*\*BREAKING\*\* arc-commit renames a flag$')" -eq 1 ] && [ "$(count '^refused \[breaking\] ')" -eq 1 ] || { echo "status $status: $output"; false; }
  [ "$(sha_of "$D/.arc-install.json")" = "$m0" ] || { echo "the refused upgrade wrote the manifest"; false; }
  probe upgrade --confirm
  ran 0 || false
  [ "$status" -eq 0 ] && [ "$(count '(confirmed)$')" -eq 1 ] || { echo "confirm: status $status: $output"; false; }
}

@test "distribute-lifecycle: --to a tag renders that tag and records it; a tag not fetched is exit 6" {
  advance
  probe upgrade
  ran 0 || false
  grep -q 'later line' "$D/.agents/skills/arc-commit/SKILL.md" || { echo "the forward upgrade did not land"; false; }
  probe upgrade --to v0.2.0
  ran 0 || false
  [ "$status" -eq 0 ] || { echo "status $status: $output"; false; }
  [ "$(_arc_json "$D/.arc-install.json" 'j.tag')" = "v0.2.0" ] && [ "$(_arc_json "$D/.arc-install.json" 'j.commit')" = "$C1" ] || { echo "the downgrade did not record the tag"; false; }
  if grep -q 'later line' "$D/.agents/skills/arc-commit/SKILL.md"; then echo "the downgrade kept the newer render"; false; fi
  [ -z "$(g "$S" status --porcelain)" ] && [ "$(g "$S" worktree list | wc -l | tr -d ' ')" -eq 1 ] || { echo "the extract touched the arc checkout"; false; }
  probe upgrade --to v9.9.9
  ran 6 || false
  [ "$status" -eq 6 ] && [ "$(count '^tags: not fetched -- v9\.9\.9 ')" -eq 1 ] || { echo "status $status: $output"; false; }
}

@test "distribute-lifecycle: a manifest naming a path outside the project is refused by name and nothing is written" {
  local outside="$BATS_TEST_TMPDIR/sentinel.txt"
  printf 'keep\n' > "$outside"
  local s0; s0=$(sha_of "$outside")
  local m
  for m in '../sentinel.txt' '/etc/passwd' 'C:/x' 'a/./b' '.agents//x'; do
    node -e 'const f=process.argv[1],j=JSON.parse(require("fs").readFileSync(f,"utf8"));j.files[process.argv[2]]={sha:"0",target:"codex"};require("fs").writeFileSync(f,JSON.stringify(j))' "$(native "$D/.arc-install.json")" "$m"
    advance
    probe upgrade
    ran 2 || false
    [ "$(count '^refused \[manifest-path\] ')" -eq 1 ] || { echo "$m: $output"; false; }
    node -e 'const f=process.argv[1],j=JSON.parse(require("fs").readFileSync(f,"utf8"));delete j.files[process.argv[2]];require("fs").writeFileSync(f,JSON.stringify(j))' "$(native "$D/.arc-install.json")" "$m"
  done
  [ "$(sha_of "$outside")" = "$s0" ] || { echo "a file outside the project changed"; false; }
  if grep -q 'later line' "$D/.agents/skills/arc-commit/SKILL.md"; then echo "a refused upgrade wrote anyway"; false; fi
}

@test "distribute-lifecycle: version-lint passes the committed tree and fails each drift" {
  run --separate-stderr node "$ARC_ROOT/.claude/scripts/core/version-lint.mjs"
  [ "$(count '^RAN version-lint$')" -eq 1 ] || { echo "lint never finished: $output $stderr"; false; }
  [ "$status" -eq 0 ] || { echo "the committed tree fails: $output"; false; }
  local t="$BATS_TEST_TMPDIR/vl"
  mkdir -p "$t" && printf '{"name":"x","version":"0.2.0"}\n' > "$t/package.json"
  printf '0.3.0\n' > "$t/VERSION"
  printf '# Changelog\n\n## [Unreleased]\n\n## [0.2.0] - 2026-10-14\n' > "$t/CHANGELOG.md"
  run --separate-stderr node "$ARC_ROOT/.claude/scripts/core/version-lint.mjs" --root "$(native "$t")"
  [ "$status" -eq 1 ] && [ "$(count '^FAIL .*package\.json version 0\.2\.0 is not VERSION 0\.3\.0')" -eq 1 ] || { echo "pkg drift: $status $output"; false; }
  printf '0.2.0\n' > "$t/VERSION"
  printf '# Changelog\n\n## [0.1.0] - 2026-01-01\n\n## [0.2.0] - 2026-10-14\n' > "$t/CHANGELOG.md"
  run --separate-stderr node "$ARC_ROOT/.claude/scripts/core/version-lint.mjs" --root "$(native "$t")"
  [ "$status" -eq 1 ] && [ "$(count '^FAIL .*\[Unreleased\] is not the first section')" -eq 1 ] && [ "$(count '^FAIL .*do not descend')" -eq 1 ] || { echo "order drift: $status $output"; false; }
  printf '# Changelog\n\n## [Unreleased]\n\n## [0.3.0] - 2026-10-15\n\n## [0.2.0] - 2026-10-14\n' > "$t/CHANGELOG.md"
  run --separate-stderr node "$ARC_ROOT/.claude/scripts/core/version-lint.mjs" --root "$(native "$t")"
  [ "$status" -eq 1 ] && [ "$(count '^FAIL .*\[0\.3\.0\] is newer than VERSION 0\.2\.0')" -eq 1 ] || { echo "ahead drift: $status $output"; false; }
}
