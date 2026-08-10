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
  [ -f "$TARGET/.claude/scripts/review/arc-scan/arc-scan.sh" ]
  [ -f "$TARGET/.claude/scripts/core/arc-profile.sh" ]
}

@test "sync: copies the meta docs" {
  bash "$ARC_ROOT/sync-to-project.sh" "$TARGET" >/dev/null
  [ -f "$TARGET/docs/how-it-works.md" ]
  [ -f "$TARGET/docs/usermanual.md" ]
}

# docs/playbooks/ is a DIRECTORY sync on both copy paths, unlike the meta docs, which are a flat
# hardcoded list. That difference is the point: a playbook added later ships with no twin edit.
# Every file in the source directory must arrive, so this counts rather than naming one -- naming
# one is how the second playbook ships nowhere while the test stays green.
@test "sync: docs/playbooks/ is a directory sync on BOTH copy paths (rsync and cp fallback)" {
  local want
  want="$(find "$ARC_ROOT/docs/playbooks" -type f | wc -l | tr -d ' ')"
  [ "$want" -gt 0 ]   # a source dir with no files would make every assertion below vacuous

  bash "$ARC_ROOT/sync-to-project.sh" "$TARGET" >/dev/null
  [ "$(find "$TARGET/docs/playbooks" -type f | wc -l | tr -d ' ')" -eq "$want" ]

  rm -rf "${TARGET:?}/docs/playbooks"
  ARC_SYNC_NO_RSYNC=1 bash "$ARC_ROOT/sync-to-project.sh" "$TARGET" >/dev/null
  [ "$(find "$TARGET/docs/playbooks" -type f | wc -l | tr -d ' ')" -eq "$want" ]
}

# The sync must not abort when docs/playbooks/ is absent. git does not track empty directories, so a
# tree whose last playbook was moved has no such directory -- and an unguarded `rsync` on a missing
# source exits 23, which under `set -euo pipefail` kills the sync after .claude/ and before the meta
# docs, CONSTITUTION.md and the registry. Half-installed consumer repo, ubuntu and macOS only. The
# probe asserts a LATER artifact, because "the playbook is absent" is also true of a sync that died.
@test "sync: a source tree with NO docs/playbooks/ still completes the install" {
  local fake="$TARGET/fake-src"
  cp -r "$ARC_ROOT/." "$fake" 2>/dev/null || true
  rm -rf "${fake:?}/docs/playbooks" "${fake:?}/.git"
  [ ! -d "$fake/docs/playbooks" ]

  local out="$TARGET/no-pb-out"
  mkdir -p "$out/.git"
  run bash "$fake/sync-to-project.sh" "$out"
  [ "$status" -eq 0 ]
  [ -f "$out/docs/how-it-works.md" ]   # a LATER step than the playbook copy -- proves no early abort
  [ -f "$out/CONSTITUTION.md" ]        # later still
}

# NEGATIVE CONTROL, rewritten. The first version was vacuous in the exact way the rule it protects
# forbids, and an adversarial pass reproduced it: the mutant is written into $TARGET, sync-to-project.sh
# derives SRC from `dirname "${BASH_SOURCE[0]}"`, so the mutant's SRC became an empty mktemp dir. It
# copied NOTHING, and "no playbook present" passed on total failure. The old paired half ran the REAL
# script from a different SRC, so it could never have detected that. Two fixes:
#   * pin SRC back to the real tree, so the mutant is the original minus the mechanism;
#   * assert the mutant RAN, by a later artifact, before asserting what it did not do.
# And the deletion is `SRC/docs/playbooks`, not `docs/playbooks`: the broad pattern also matched the
# `mkdir -p` line, so the mutant lost every parent directory and died on the cp path -- failing on the
# Windows leg for a reason unrelated to the mechanism under test.
@test "sync: a mutant with the docs/playbooks COPY lines deleted ships NO playbook (control)" {
  [ "$(grep -c 'SRC/docs/playbooks' "$ARC_ROOT/sync-to-project.sh")" -eq 2 ]

  local mutant="$TARGET/mutant-sync.sh"
  grep -v 'SRC/docs/playbooks' "$ARC_ROOT/sync-to-project.sh" \
    | sed "s|^SRC=.*|SRC=\"$ARC_ROOT\"|" > "$mutant"
  [ "$(grep -c 'SRC/docs/playbooks' "$mutant")" -eq 0 ]
  grep -q "^SRC=\"$ARC_ROOT\"$" "$mutant"

  local mtarget="$TARGET/mutant-out"
  mkdir -p "$mtarget/.git"
  run bash "$mutant" "$mtarget"
  [ "$status" -eq 0 ]                                        # the mutant RAN...
  [ -f "$mtarget/docs/how-it-works.md" ]                     # ...and got past the playbook step...
  [ ! -f "$mtarget/docs/playbooks/finding-verification.md" ] # ...and shipped no playbook.

  # The real script, same shape, does ship it. Both halves, or the assertion above is satisfied by a
  # mutant that merely differs from the original in some other way.
  local rtarget="$TARGET/real-out"
  mkdir -p "$rtarget/.git"
  bash "$ARC_ROOT/sync-to-project.sh" "$rtarget" >/dev/null
  [ -f "$rtarget/docs/playbooks/finding-verification.md" ]
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
  # docs/playbooks/ was mirrored into BOTH twins and tested in only one of them -- the twin-fix class
  # inverted, code mirrored and test not. The ps1 uses `robocopy … | Out-Null` and no robocopy call in
  # that file checks $LASTEXITCODE, so a failed playbook copy on the Windows-native path is silent as
  # well as untested. Asserting the artifact is the only thing that catches it.
  [ -f "$TARGET/docs/playbooks/finding-verification.md" ]
  # ...and a later step, so a ps1 that died on the playbook copy cannot pass the line above by accident.
  [ -f "$TARGET/CONSTITUTION.md" ]
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
  [ ! -e "$TARGET/.claude/scripts/plan/kickoff-lint.mjs" ]      # plan absent
  [ ! -e "$TARGET/.claude/scripts/plan" ]
  [ ! -e "$TARGET/.claude/scripts/review/arc-scan/arc-scan.sh" ]  # review absent
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
  [ ! -e "$TARGET/.claude/scripts/plan/kickoff-lint.mjs" ]
  [ ! -e "$TARGET/.claude/scripts/review/arc-scan/arc-scan.sh" ]
}

@test "sync: an UPGRADE preserves the consumer's settings.json customisations (Phase 04 dogfood)" {
  # Every other case in this file mktemps a FRESH target, so upgrade-over-an-existing-install
  # had zero coverage -- the blind spot ADR-0020 recorded. Dogfooding into a real consumer
  # then found the bug it was hiding: the copy deleted their per-gate overrides and their
  # gates went warn -> block, silently, for keys arc's own //profile doc tells them to add.
  bash "$ARC_ROOT/sync-to-project.sh" "$TARGET" --products council >/dev/null
  cd "$TARGET"                                  # relative paths: node resolves from cwd
  node -e 'const fs=require("fs"),p=".claude/settings.json";
    const j=JSON.parse(fs.readFileSync(p,"utf8"));
    j.arc=j.arc||{}; j.arc.coverageMode="warn";  // exactly what the shipped doc string invites
    j.permissions=j.permissions||{}; j.permissions.allow=(j.permissions.allow||[]).concat("Bash(their-tool:*)");
    fs.writeFileSync(p,JSON.stringify(j,null,2));'
  bash "$ARC_ROOT/sync-to-project.sh" "$TARGET" --products council >/dev/null   # re-sync == upgrade
  grep -q '"coverageMode": "warn"' .claude/settings.json                        # their override lived
  grep -q 'their-tool' .claude/settings.json                                    # their allowlist entry lived
  grep -q '"hooks"' .claude/settings.json                                       # arc's machinery still there
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

@test "sync: bare install writes a registry naming every product in products/ (REQ-08)" {
  bash "$ARC_ROOT/sync-to-project.sh" "$TARGET" >/dev/null
  [ -f "$TARGET/.claude/arc-registry.json" ]
  # Derived from products/, not a hardcoded list: this repo's recurring failure is a count
  # frozen into a test or a doc that silently disagrees with reality one cycle later
  # (docs/retro-log.md). Cycle 2 adding `hq` is exactly the event that would have broken it.
  expected="$(ls "$ARC_ROOT/products" | LC_ALL=C sort | tr '\n' ',' | sed 's/,$//')"
  [ "$(_arc_json "$TARGET/.claude/arc-registry.json" 'Object.keys(j.products).sort().join(",")')" = "$expected" ]
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
