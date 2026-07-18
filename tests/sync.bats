#!/usr/bin/env bats
# Phase 01 -- cross-platform sync (bash twin of sync-to-project.ps1).
bats_require_minimum_version 1.5.0
load 'test_helper'

setup() {
  TARGET="$(mktemp -d)"
  mkdir -p "$TARGET/.git"          # look like a project root
}
teardown() { [ -n "${TARGET:-}" ] && rm -rf "$TARGET" 2>/dev/null || true; }

@test "sync: copies machinery into target .claude" {
  run bash "$ARC_ROOT/sync-to-project.sh" "$TARGET"
  [ "$status" -eq 0 ]
  [ -f "$TARGET/.claude/settings.json" ]
  [ -f "$TARGET/.claude/scripts/arc-scan/arc-scan.sh" ]
  [ -f "$TARGET/.claude/scripts/core/arc-profile.sh" ]
}

@test "sync: copies the meta docs" {
  bash "$ARC_ROOT/sync-to-project.sh" "$TARGET" >/dev/null
  [ -f "$TARGET/docs/how-it-works.md" ]
  [ -f "$TARGET/docs/usermanual.md" ]
}

@test "sync: never leaks personal settings or working state" {
  bash "$ARC_ROOT/sync-to-project.sh" "$TARGET" >/dev/null
  [ ! -e "$TARGET/.claude/settings.local.json" ]
  [ ! -e "$TARGET/.claude/state" ]
}

@test "sync: never leaks the scheduled_tasks.lock runtime file (REQ-04)" {
  bash "$ARC_ROOT/sync-to-project.sh" "$TARGET" >/dev/null
  [ ! -e "$TARGET/.claude/scheduled_tasks.lock" ]
}

@test "sync: never leaks a .claude/worktrees/ dir into the target (REQ-04 class, pinned)" {
  # a transient git worktree under .claude/ (agent isolation) must never ride into a consumer
  local probe="$ARC_ROOT/.claude/worktrees/leaktest-$$"
  mkdir -p "$probe"; : > "$probe/marker.txt"
  bash "$ARC_ROOT/sync-to-project.sh" "$TARGET" >/dev/null                     # rsync path
  local a=1; [ ! -e "$TARGET/.claude/worktrees" ] && a=0
  ARC_SYNC_NO_RSYNC=1 bash "$ARC_ROOT/sync-to-project.sh" "$TARGET" >/dev/null  # cp-r fallback
  local b=1; [ ! -e "$TARGET/.claude/worktrees" ] && b=0
  rm -rf "$probe"
  [ "$a" -eq 0 ]
  [ "$b" -eq 0 ]
}

@test "sync (ps1): never leaks state/ or scheduled_tasks.lock (REQ-04)" {
  local ps
  command -v cygpath >/dev/null 2>&1 || skip "ps1 is Windows-native (robocopy/cygpath) — only the Windows CI leg runs it"
  ps="$(command -v pwsh 2>/dev/null || command -v powershell 2>/dev/null)" || skip "no PowerShell on this runner"
  "$ps" -NoProfile -File "$(cygpath -w "$ARC_ROOT/sync-to-project.ps1")" -Target "$(cygpath -w "$TARGET")" >/dev/null 2>&1 || true
  [ ! -e "$TARGET/.claude/state" ]
  [ ! -e "$TARGET/.claude/scheduled_tasks.lock" ]
}

@test "sync: never overwrites project-owned files (CLAUDE.md, PLAN.md)" {
  bash "$ARC_ROOT/sync-to-project.sh" "$TARGET" >/dev/null
  [ ! -e "$TARGET/CLAUDE.md" ]
  [ ! -e "$TARGET/CLAUDE.local.md" ]
  [ ! -e "$TARGET/PLAN.md" ]
}

@test "sync: bare install is byte-identical to the golden fixture, rsync path (REQ-02)" {
  bash "$ARC_ROOT/sync-to-project.sh" "$TARGET" >/dev/null
  _arc_tree_manifest "$TARGET" > "$BATS_TEST_TMPDIR/actual.txt"
  run diff "$ARC_ROOT/tests/fixtures/sync-golden/tree-manifest.txt" "$BATS_TEST_TMPDIR/actual.txt"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "sync: bare install is byte-identical to the golden fixture, cp-r fallback path (REQ-02)" {
  ARC_SYNC_NO_RSYNC=1 bash "$ARC_ROOT/sync-to-project.sh" "$TARGET" >/dev/null
  _arc_tree_manifest "$TARGET" > "$BATS_TEST_TMPDIR/actual.txt"
  run diff "$ARC_ROOT/tests/fixtures/sync-golden/tree-manifest.txt" "$BATS_TEST_TMPDIR/actual.txt"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "sync: --list prints product names (no target needed)" {
  run bash "$ARC_ROOT/sync-to-project.sh" --list
  [ "$status" -eq 0 ]
  [[ "$output" == *"council"* ]]
  [[ "$output" == *"core"* ]]
}

@test "sync: --products council installs council + core only (REQ-01)" {
  run bash "$ARC_ROOT/sync-to-project.sh" "$TARGET" --products council
  [ "$status" -eq 0 ]
  [ -f "$TARGET/.claude/commands/arc-council.md" ]
  [ -f "$TARGET/.claude/scripts/council/council-lint.mjs" ]       # re-homed (Phase 03 ckpt 1)
  [ -f "$TARGET/.claude/scripts/council/council-juror.mjs" ]
  [ -f "$TARGET/.claude/scripts/council/council-calibrate.mjs" ]
  [ ! -e "$TARGET/.claude/scripts/council-lint.mjs" ]       # and NOT at the pre-move flat path
  [ -f "$TARGET/.claude/scripts/core/arc-gates.sh" ]             # core rides along
  [ -f "$TARGET/.claude/scripts/core/common.sh" ]  # core-owned (ADR-0018)
  # Exact-path negatives go vacuous the moment ckpt 3/4 relocate these files -- they would
  # then pass unconditionally, including in the exact leak they exist to catch. Assert the
  # product's whole future directory is absent too, so the guard survives its own phase.
  [ ! -e "$TARGET/.claude/scripts/kickoff-lint.mjs" ]      # plan absent
  [ ! -e "$TARGET/.claude/scripts/plan" ]
  [ ! -e "$TARGET/.claude/scripts/arc-scan/arc-scan.sh" ]  # review absent
  [ ! -e "$TARGET/.claude/scripts/review" ]
  [ ! -e "$TARGET/.claude/agents/qa-tester.md" ]           # qa absent
  [ ! -e "$TARGET/.claude/commands/arc-commit.md" ]        # git absent
  [ -d "$TARGET/docs/council/sessions/.juror" ]            # skeleton created
}

@test "sync: --products unknown name fails (exit 2) and prints the valid list" {
  run bash "$ARC_ROOT/sync-to-project.sh" "$TARGET" --products nosuch
  [ "$status" -eq 2 ]
  [[ "$output" == *"council"* ]]
}

@test "sync: an unknown option is rejected (exit 2)" {
  run bash "$ARC_ROOT/sync-to-project.sh" "$TARGET" --frobnicate
  [ "$status" -eq 2 ]
}

@test "sync (ps1): --products council installs council + core, not other products" {
  local ps
  command -v cygpath >/dev/null 2>&1 || skip "ps1 is Windows-native (robocopy/cygpath) — only the Windows CI leg runs it"
  ps="$(command -v pwsh 2>/dev/null || command -v powershell 2>/dev/null)" || skip "no PowerShell on this runner"
  "$ps" -NoProfile -File "$(cygpath -w "$ARC_ROOT/sync-to-project.ps1")" -Target "$(cygpath -w "$TARGET")" -Products council >/dev/null 2>&1 || true
  [ -f "$TARGET/.claude/commands/arc-council.md" ]
  [ -f "$TARGET/.claude/scripts/council/council-lint.mjs" ]  # the twin must re-home identically
  [ -f "$TARGET/.claude/scripts/core/arc-gates.sh" ]
  [ ! -e "$TARGET/.claude/scripts/council-lint.mjs" ]
  [ ! -e "$TARGET/.claude/scripts/kickoff-lint.mjs" ]
  [ ! -e "$TARGET/.claude/scripts/arc-scan/arc-scan.sh" ]
}

@test "sync: missing target dir fails cleanly (exit 1)" {
  run bash "$ARC_ROOT/sync-to-project.sh" "/no/such/target/$$"
  [ "$status" -eq 1 ]
  [[ "$output" == *"not found"* ]]
}

@test "sync: requires a target argument" {
  run bash "$ARC_ROOT/sync-to-project.sh"
  [ "$status" -ne 0 ]
}

# ---------- Phase 02: registry write (REQ-08) + golden exclusion (REQ-02) ----------

@test "sync: --products writes a registry naming exactly core+council (REQ-08)" {
  bash "$ARC_ROOT/sync-to-project.sh" "$TARGET" --products council >/dev/null
  [ -f "$TARGET/.claude/arc-registry.json" ]
  [ "$(_arc_json "$TARGET/.claude/arc-registry.json" 'j.schema')" = "1" ]
  [ "$(_arc_json "$TARGET/.claude/arc-registry.json" 'Object.keys(j.products).sort().join(",")')" = "core,council" ]
}

@test "sync: bare install writes a registry naming all six products (REQ-08)" {
  bash "$ARC_ROOT/sync-to-project.sh" "$TARGET" >/dev/null
  [ -f "$TARGET/.claude/arc-registry.json" ]
  [ "$(_arc_json "$TARGET/.claude/arc-registry.json" 'Object.keys(j.products).sort().join(",")')" = "core,council,git,plan,qa,review" ]
}

@test "sync: re-sync overwrites the registry to the new set, no stale products (REQ-08)" {
  bash "$ARC_ROOT/sync-to-project.sh" "$TARGET" --products council >/dev/null
  bash "$ARC_ROOT/sync-to-project.sh" "$TARGET" --products plan >/dev/null
  [ "$(_arc_json "$TARGET/.claude/arc-registry.json" 'Object.keys(j.products).sort().join(",")')" = "core,plan" ]
}

@test "sync: the registry is present in a bare target but EXCLUDED from the golden manifest (REQ-02)" {
  bash "$ARC_ROOT/sync-to-project.sh" "$TARGET" >/dev/null
  [ -f "$TARGET/.claude/arc-registry.json" ]              # REQ-08: written
  run _arc_tree_manifest "$TARGET"
  [[ "$output" != *"arc-registry.json"* ]]                # REQ-02: outside the byte-identical gate
}

@test "sync (ps1): writes a BOM-free, parseable registry naming core+council (REQ-08)" {
  local ps
  command -v cygpath >/dev/null 2>&1 || skip "ps1 is Windows-native (robocopy/cygpath) — only the Windows CI leg runs it"
  ps="$(command -v pwsh 2>/dev/null || command -v powershell 2>/dev/null)" || skip "no PowerShell on this runner"
  "$ps" -NoProfile -File "$(cygpath -w "$ARC_ROOT/sync-to-project.ps1")" -Target "$(cygpath -w "$TARGET")" -Products council >/dev/null 2>&1 || true
  [ -f "$TARGET/.claude/arc-registry.json" ]
  # _arc_json uses JSON.parse -- a UTF-8 BOM (PowerShell's default utf8) would throw here.
  [ "$(_arc_json "$TARGET/.claude/arc-registry.json" 'j.schema')" = "1" ]
  [ "$(_arc_json "$TARGET/.claude/arc-registry.json" 'Object.keys(j.products).sort().join(",")')" = "core,council" ]
}

# ---------- Phase 02: tree-diff invariant -- manifests can never silently diverge from reality ----------
# Installing every product must reproduce the mold's .claude payload EXACTLY. A file added
# to .claude/ but not mapped in any manifest (or vice-versa) makes this diff non-empty ->
# CI red. Rides the 3-OS selftest matrix. The 3 never-synced paths + the per-install
# registry are excluded (they are intentionally not part of the manifest-mapped payload).
_claude_set() { ( cd "$1/.claude" && find . -type f \
  -not -path './state/*' -not -path './worktrees/*' -not -name 'settings.local.json' \
  -not -name 'scheduled_tasks.lock' -not -name 'arc-registry.json' | LC_ALL=C sort ); }

@test "invariant: installing all products reproduces the mold's .claude payload exactly (manifests vs reality)" {
  local names
  names="$(bash "$ARC_ROOT/sync-to-project.sh" --list | paste -sd, -)"
  bash "$ARC_ROOT/sync-to-project.sh" "$TARGET" --products "$names" >/dev/null
  run diff <(_claude_set "$ARC_ROOT") <(_claude_set "$TARGET")
  [ "$status" -eq 0 ] || { echo "manifest/reality drift:"; echo "$output"; false; }
}
