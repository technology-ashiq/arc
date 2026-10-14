#!/usr/bin/env bats
# distribute Phase 10 -- REQ-15 (`arc init` renders every harness, registers the project), REQ-18 (`arc uninstall`
# removes exactly what the manifest lists), REQ-19 (the radar reads and never writes), ADR-2024 / ADR-2026.
#
# Every test points ARC_PRIVATE_DIR at its own temp dir (no write under $HOME) and ARC_SPINE_ROOT at a temp spine
# (no receipt on the real one). Each arm asserts its command RAN before what it printed.

bats_require_minimum_version 1.5.0
load 'test_helper'

ARC() { printf '%s' "$ARC_ROOT/bin/arc.mjs"; }
native() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }
count() { printf '%s\n' "$output" | tr -d '\r' | grep -cE "$1" || true; }
tree_sha() { (cd "$1" && find . -type f ! -path './.git/*' -exec sha1sum {} + | sort | sha1sum | cut -d' ' -f1); }

setup() {
  export ARC_PRIVATE_DIR="$BATS_TEST_TMPDIR/priv" ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine" ARC_RADAR_STATE_DIR="$BATS_TEST_TMPDIR/rstate"
  mkdir -p "$ARC_PRIVATE_DIR" "$ARC_SPINE_ROOT"
  D=$(mkdir -p "$BATS_TEST_TMPDIR/proj" && cd "$BATS_TEST_TMPDIR/proj" && pwd -P)
  git -C "$D" init -q && git -C "$D" config user.email t@example.invalid && git -C "$D" config user.name t
  HOME_BEFORE=$(ls -A "$HOME" 2>/dev/null | sort | sha1sum)
}

init_all() { run --separate-stderr node "$(ARC)" init --dir "$(native "$D")" "$@"; }

@test "distribute-p10: every test in the file is registered" {
  local declared
  declared=$(grep -c '^@test "distribute-p10: ' "$BATS_TEST_FILENAME")
  [ "$declared" -eq 7 ] || { echo "declared $declared, expected 7"; false; }
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "distribute-p10: init with no --target places every harness under one version-2 manifest and registers the project" {
  init_all
  [ "$(count '^plan: claude-code\+codex\+opencode\+skills-only — [0-9]+ file')" -eq 1 ] || { echo "never planned: $output $stderr"; false; }
  [ "$status" -eq 0 ] || { echo "status $status: $output $stderr"; false; }
  local d
  for d in .claude .codex .opencode .agents/skills; do [ -d "$D/$d" ] || { echo "no $d at birth"; false; }; done
  [ "$(_arc_json "$D/.arc-install.json" 'j.version')" = "2" ] && [ "$(_arc_json "$D/.arc-install.json" 'j.targets.join(",")')" = "claude-code,codex,opencode,skills-only" ] || { echo "manifest: $(head -c 300 "$D/.arc-install.json")"; false; }
  # skills-only owns the shared skills root (ADR-2023): the file on disk keeps allowed-tools.
  grep -q '^allowed-tools:' "$D/.agents/skills/arc-resume/SKILL.md" || { echo "codex bytes won the shared root"; false; }
  [ "$(_arc_json "$D/.arc-install.json" 'j.files[".agents/skills/arc-resume/SKILL.md"].target')" = "skills-only" ] || { echo "owner not recorded"; false; }
  [ "$(count '^registry: registered ')" -eq 1 ] || { echo "no registry line: $output"; false; }
  run node -e 'const f=require("fs"),j=JSON.parse(f.readFileSync(process.argv[1],"utf8")),n=(p)=>f.realpathSync.native(p).toLowerCase();process.stdout.write(String(j.consumers.length===1&&n(j.consumers[0].path)===n(process.argv[2])))' "$(native "$ARC_PRIVATE_DIR/consumers.json")" "$(native "$D")"
  [ "$output" = "true" ] || { echo "not registered as this project: $(cat "$ARC_PRIVATE_DIR/consumers.json")"; false; }
  [ "$(ls -A "$HOME" 2>/dev/null | sort | sha1sum)" = "$HOME_BEFORE" ] || { echo "init wrote under HOME although ARC_PRIVATE_DIR was set"; false; }
}

@test "distribute-p10: a second init writes only the record, and a dry run or a refusal never registers" {
  init_all
  [ "$status" -eq 0 ] || { echo "first: $output"; false; }
  init_all
  [ "$status" -eq 0 ] && [ "$(count '^apply: wrote 1 file\(s\) ')" -eq 1 ] || { echo "second init rewrote files: $output"; false; }
  [ "$(_arc_json "$ARC_PRIVATE_DIR/consumers.json" 'j.consumers.length')" = "1" ] || { echo "registered twice"; false; }
  local e; e=$(mkdir -p "$BATS_TEST_TMPDIR/dry" && cd "$BATS_TEST_TMPDIR/dry" && pwd -P)
  run --separate-stderr node "$(ARC)" init --dir "$(native "$e")" --dry-run
  [ "$status" -eq 0 ] && [ "$(count '^dry-run: ')" -eq 1 ] && [ ! -e "$e/.arc-install.json" ] || { echo "dry: $output"; false; }
  printf 'mine\n' > "$e/CONSTITUTION.md"
  run --separate-stderr node "$(ARC)" init --dir "$(native "$e")"
  [ "$status" -eq 1 ] && [ "$(count '^unmanaged-conflict CONSTITUTION\.md ')" -eq 1 ] || { echo "conflict: $status $output"; false; }
  [ "$(_arc_json "$ARC_PRIVATE_DIR/consumers.json" 'j.consumers.length')" = "1" ] || { echo "a dry run or a refusal registered"; false; }
}

@test "distribute-p10: uninstall removes the managed files, keeps the owner's, and unsets the hooks init set" {
  init_all
  [ "$status" -eq 0 ] || { echo "init: $output"; false; }
  [ "$(git -C "$D" config --get core.hooksPath)" = ".claude/templates/githooks" ] || { echo "init set no hooks"; false; }
  printf 'venture\n' > "$D/.claude/venture.md"
  printf 'own\n' > "$D/README.md"
  local own0; own0=$(sha1sum < "$D/.claude/venture.md")
  run --separate-stderr node "$(ARC)" uninstall --dir "$(native "$D")"
  [ "$(count '^RAN arc-uninstall$')" -eq 1 ] || { echo "never ran: $output $stderr"; false; }
  [ "$status" -eq 0 ] && [ "$(count '^uninstall: [0-9]+ removed, 0 kept, record \.arc-install\.json removed$')" -eq 1 ] || { echo "status $status: $output"; false; }
  [ ! -e "$D/.arc-install.json" ] && [ ! -e "$D/.codex" ] && [ ! -e "$D/.opencode" ] && [ ! -e "$D/.agents" ] || { echo "managed paths left: $(ls -A "$D")"; false; }
  [ "$(sha1sum < "$D/.claude/venture.md")" = "$own0" ] && [ -s "$D/README.md" ] || { echo "an unmanaged file changed"; false; }
  run git -C "$D" config --get core.hooksPath
  [ "$status" -ne 0 ] || { echo "hooks still set: $output"; false; }
  [ "$(_arc_json "$ARC_PRIVATE_DIR/consumers.json" 'j.consumers.length')" = "0" ] || { echo "still registered"; false; }
}

@test "distribute-p10: a modified managed file is kept and the record stays; hooks the owner set are left alone" {
  init_all
  [ "$status" -eq 0 ] || { echo "init: $output"; false; }
  git -C "$D" config core.hooksPath my-hooks
  printf 'edit\n' >> "$D/.agents/skills/arc-resume/SKILL.md"
  run --separate-stderr node "$(ARC)" uninstall --dir "$(native "$D")"
  [ "$status" -eq 1 ] && [ "$(count '^kept \(modified\) \.agents/skills/arc-resume/SKILL\.md$')" -eq 1 ] && [ -e "$D/.arc-install.json" ] || { echo "status $status: $output"; false; }
  grep -q edit "$D/.agents/skills/arc-resume/SKILL.md" || { echo "the edit was lost"; false; }
  run --separate-stderr node "$(ARC)" uninstall --dir "$(native "$D")" --force
  [ "$status" -eq 0 ] && [ ! -e "$D/.arc-install.json" ] && [ "$(count '^hooks: core\.hooksPath left as my-hooks')" -eq 1 ] || { echo "force: $status $output"; false; }
  [ "$(git -C "$D" config --get core.hooksPath)" = "my-hooks" ] || { echo "the owner's hooks path was unset"; false; }
}

@test "distribute-p10: a manifest naming a path outside the project is refused by name and nothing is removed" {
  init_all
  [ "$status" -eq 0 ] || { echo "init: $output"; false; }
  printf 'keep\n' > "$BATS_TEST_TMPDIR/sentinel.txt"
  mkdir -p "$BATS_TEST_TMPDIR/outside" && printf 'keep\n' > "$BATS_TEST_TMPDIR/outside/x.md"
  local link="$D/escape" built=0
  # node builds it: a junction on Windows needs no privilege (MSYS ln -s silently copies), a symlink elsewhere.
  node -e 'require("fs").symlinkSync(process.argv[1], process.argv[2], "junction")' "$(native "$BATS_TEST_TMPDIR/outside")" "$(native "$link")"     && node -e 'const f=require("fs");process.exit(f.lstatSync(process.argv[1]).isSymbolicLink() && f.realpathSync(process.argv[1]) !== process.argv[1] ? 0 : 1)' "$(native "$link")" && built=1
  [ "$built" -eq 1 ] && [ -e "$link/x.md" ] || { echo "the escape link was never built: a skip here would be a vacuous pass"; false; }
  # The mutant loop rewrites the record compactly; normalise it once so the baseline holds the same bytes.
  node -e 'const f=process.argv[1],fs=require("fs");fs.writeFileSync(f,JSON.stringify(JSON.parse(fs.readFileSync(f,"utf8"))))' "$(native "$D/.arc-install.json")"
  local before; before=$(tree_sha "$D")
  local m n=0
  for m in '../sentinel.txt' '/etc/hosts' 'C:/x' 'escape/x.md' 'a/../x'; do
    node -e 'const f=process.argv[1],j=JSON.parse(require("fs").readFileSync(f,"utf8"));j.files[process.argv[2]]={sha:"0",target:"codex"};require("fs").writeFileSync(f,JSON.stringify(j))' "$(native "$D/.arc-install.json")" "$m"
    run --separate-stderr node "$(ARC)" uninstall --dir "$(native "$D")" --force
    [ "$status" -eq 2 ] && [ "$(count '^refused \[manifest-path\] ')" -eq 1 ] || { echo "$m: status $status: $output"; false; }
    node -e 'const f=process.argv[1],j=JSON.parse(require("fs").readFileSync(f,"utf8"));delete j.files[process.argv[2]];require("fs").writeFileSync(f,JSON.stringify(j))' "$(native "$D/.arc-install.json")" "$m"
    n=$((n + 1))
  done
  [ "$n" -eq 5 ] || { echo "ran $n of 5 mutants"; false; }
  [ -s "$BATS_TEST_TMPDIR/sentinel.txt" ] && [ -s "$BATS_TEST_TMPDIR/outside/x.md" ] || { echo "a file outside the project was removed"; false; }
  [ "$(tree_sha "$D")" = "$before" ] || { echo "a refused uninstall removed something"; false; }
}

@test "distribute-p10: the radar reports drift as one path-free receipt and leaves every consumer byte-identical" {
  init_all
  [ "$status" -eq 0 ] || { echo "init: $output"; false; }
  local E; E=$(mkdir -p "$BATS_TEST_TMPDIR/proj2" && cd "$BATS_TEST_TMPDIR/proj2" && pwd -P)
  run --separate-stderr node "$(ARC)" init --target codex --dir "$(native "$E")"
  [ "$status" -eq 0 ] || { echo "init 2: $output"; false; }
  local a0 b0; a0=$(tree_sha "$D"); b0=$(tree_sha "$E")
  run --separate-stderr env ARC_RADAR_FORCE=1 node "$ARC_ROOT/.claude/scripts/hq/jobs/distribute-radar.mjs"
  [ "$(count '^distribute-radar: metric\.observed [0-9A-Z]{26} · ')" -eq 1 ] || { echo "radar never emitted: $status $output $stderr"; false; }
  [ "$status" -eq 0 ] && [ "$(count '^outdated --all: 2 project\(s\) ')" -eq 1 ] || { echo "status $status: $output"; false; }
  [ "$(tree_sha "$D")" = "$a0" ] && [ "$(tree_sha "$E")" = "$b0" ] || { echo "the radar wrote inside a consumer"; false; }
  local line; line=$(cat "$ARC_SPINE_ROOT"/events/*.jsonl | grep '"kind":"metric.observed"' | tail -1)
  [ -n "$line" ] || { echo "no receipt on the test spine: $(ls -R "$ARC_SPINE_ROOT")"; false; }
  printf '%s' "$line" | grep -q '"unit_count":2' || { echo "receipt: $line"; false; }
  if printf '%s' "$line" | grep -qiE 'proj2|tmp|users|home'; then echo "a consumer path reached the spine: $line"; false; fi
  run --separate-stderr node "$ARC_ROOT/.claude/scripts/hq/jobs/distribute-radar.mjs"
  [ "$status" -eq 0 ] && [ "$(count '^distribute-radar: not due ')" -eq 1 ] || { echo "second run acted again: $output"; false; }
  rm -f "$ARC_PRIVATE_DIR/consumers.json"
  run --separate-stderr env ARC_RADAR_FORCE=1 node "$ARC_ROOT/.claude/scripts/hq/jobs/distribute-radar.mjs"
  [ "$status" -eq 1 ] && [ "$(count '^registry: none ')" -eq 1 ] || { echo "missing registry: $status $output"; false; }
}
