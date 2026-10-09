#!/usr/bin/env bats
# distribute Phase 04 -- REQ-08: the package installs and runs on a clean machine with zero runtime
# dependencies, and is NOT published (ADR-2008, ADR-2016).
#
# Two arms on every CI leg. The tarball arm: `npm pack` the checkout, `npm i -g --prefix TMP` the .tgz, run
# the installed `arc doctor`, then `arc init` a project from that installed copy and doctor it, which proves
# the `files` allowlist carries everything an install reads. The git-URL arm: `npx --yes
# github:technology-ashiq/arc#SHA doctor`, where SHA is the PR head (a pull request's merge ref is not
# fetchable by npx). Off CI the git-URL arm skips, by name. Every run asserts `RAN arc-doctor` first.

bats_require_minimum_version 1.5.0
load 'test_helper'

native() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }
count() { printf '%s\n' "$output" | tr -d '\r' | grep -cE "$1" || true; }
ran_doctor() { printf '%s\n' "$output" | tr -d '\r' | grep -qx 'RAN arc-doctor' || { echo "arc doctor never finished: $output ${stderr:-}"; return 1; }; }

# A private npm cache and prefix per test, so nothing a previous run left on the machine is reused.
setup() {
  export npm_config_cache="$BATS_TEST_TMPDIR/npm-cache" npm_config_update_notifier=false npm_config_fund=false npm_config_audit=false
}

@test "distribute-install-clean: every test in the file is registered" {
  local declared
  declared=$(grep -c '^@test "distribute-install-clean: ' "$BATS_TEST_FILENAME")
  [ "$declared" -eq 4 ] || { echo "declared $declared, expected 4"; false; }
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "distribute-install-clean: the tarball installs globally, doctors clean, and installs a project from itself" {
  command -v npm >/dev/null 2>&1 || { echo "npm is not on this leg"; false; }
  local d="$BATS_TEST_TMPDIR" tgz prefix bin proj
  mkdir -p "$d/pack" "$d/prefix" "$d/proj"
  run npm pack "$(native "$ARC_ROOT")" --pack-destination "$(native "$d/pack")" --silent
  [ "$status" -eq 0 ] || { echo "npm pack: $output"; false; }
  tgz=$(find "$d/pack" -maxdepth 1 -name 'arc-*.tgz' | head -1)
  [ -s "$tgz" ] || { echo "npm pack produced no tarball: $output"; false; }
  run npm install --global --prefix "$(native "$d/prefix")" "$(native "$tgz")"
  [ "$status" -eq 0 ] || { echo "npm install: $output"; false; }
  # npm puts the shim in PREFIX/bin on POSIX and in PREFIX itself on Windows.
  bin="$d/prefix/bin/arc"; [ -e "$bin" ] || bin="$d/prefix/arc"
  [ -e "$bin" ] || { echo "no arc shim under the prefix:"; find "$d/prefix" -maxdepth 2 -name 'arc*'; false; }
  [ ! -e "$d/prefix/lib/node_modules/arc/node_modules" ] && [ ! -e "$d/prefix/node_modules/arc/node_modules" ] || { echo "the install pulled in dependencies"; false; }
  run --separate-stderr "$bin" doctor
  ran_doctor || false
  [ "$status" -eq 0 ] && [ "$(count '^FAIL ')" -eq 0 ] && [ "$(count ': ready to install$')" -eq 1 ] || { echo "status $status: $output"; false; }
  [ "$(count '^arc [0-9.]+ at .*node_modules.arc: ready to install$')" -eq 1 ] || { echo "doctor did not run from the installed copy: $output"; false; }
  proj=$(cd "$d/proj" && pwd -P)
  run --separate-stderr "$bin" init --target opencode --dir "$(native "$proj")"
  [ "$status" -eq 0 ] && [ "$(count '^apply: wrote [0-9]+ file\(s\) ')" -eq 1 ] || { echo "init from the installed copy: $status $output $stderr"; false; }
  run --separate-stderr "$bin" doctor --dir "$(native "$proj")"
  [ "$status" -eq 0 ] && [ "$(count '^doctor: [0-9]+ placed, [0-9]+ degraded, 0 missing, 0 unmanaged-conflict$')" -eq 1 ] || { echo "status $status: $output"; false; }
  # The strongest target: claude-code from the INSTALLED copy must place exactly the sync golden, so a path
  # the files allowlist leaves out fails here rather than on a user's machine (attack 188f724 B5).
  local cc; mkdir -p "$d/cc"; cc=$(cd "$d/cc" && pwd -P)
  run --separate-stderr "$bin" init --target claude-code --dir "$(native "$cc")"
  [ "$status" -eq 0 ] && [ "$(count '^apply: wrote [0-9]+ file\(s\) ')" -eq 1 ] || { echo "claude-code from the installed copy: $status $output $stderr"; false; }
  _arc_tree_manifest "$cc" > "$d/cc.manifest"
  [ -s "$d/cc.manifest" ] || { echo "the claude-code install placed nothing"; false; }
  # `.env.example` is the one row the sync adds beyond the install (its council JUROR_* block is bash's
  # _arc_env_block), so it alone is set aside, and the golden must still hold it.
  [ "$(grep -c "^\.env\.example$(printf '\t')" "$ARC_ROOT/tests/fixtures/sync-golden/tree-manifest.txt")" -eq 1 ] || { echo "the golden has no .env.example row to set aside"; false; }
  grep -v "^\.env\.example$(printf '\t')" "$ARC_ROOT/tests/fixtures/sync-golden/tree-manifest.txt" > "$d/golden.manifest"
  diff "$d/golden.manifest" "$d/cc.manifest" || { echo "the packed claude-code install differs from the sync golden"; false; }
}

@test "distribute-install-clean: the git URL at the PR head runs arc doctor through npx" {
  [ -n "${GITHUB_ACTIONS:-}" ] || skip "the git-URL arm needs CI: it installs the pushed PR head from GitHub"
  local sha
  sha=$(node -e 'const fs=require("fs");const p=process.env.GITHUB_EVENT_PATH;let s="";try{const e=JSON.parse(fs.readFileSync(p,"utf8"));s=(e.pull_request&&e.pull_request.head&&e.pull_request.head.sha)||""}catch{};process.stdout.write(s||process.env.GITHUB_SHA||"")')
  [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "no head SHA from the event or GITHUB_SHA: $sha"; false; }
  run --separate-stderr npx --yes "github:technology-ashiq/arc#$sha" doctor
  ran_doctor || false
  [ "$status" -eq 0 ] && [ "$(count ': ready to install$')" -eq 1 ] || { echo "status $status: $output $stderr"; false; }
}

# REQ-08's other half: nothing anywhere publishes, and the package's arrival changed no synced file.
@test "distribute-install-clean: no script, workflow or doc outside this lane names npm publish, and the sync golden has no package row" {
  local hits
  hits=$(cd "$ARC_ROOT" && git grep -l 'npm publish' -- . ':!initiatives/distribute' ':!docs/adr/20[0-9][0-9]-*' ':!docs/strategy/plans/PLAN-distribute.md' ':!docs/strategy/plans/README.md' ':!docs/wiki' ':!tests/distribute-install-clean.bats' || true)
  [ -z "$hits" ] || { echo "npm publish named in: $hits"; false; }
  # The control: the same grep with no exclusion does find the lane's own "no npm publish" lines.
  [ "$(cd "$ARC_ROOT" && git grep -l 'npm publish' -- docs/adr | wc -l | tr -d ' ')" -gt 0 ] || { echo "the grep finds nothing at all, so its silence proves nothing"; false; }
  [ -s "$ARC_ROOT/tests/fixtures/sync-golden/tree-manifest.txt" ] || false
  [ "$(cut -f1 "$ARC_ROOT/tests/fixtures/sync-golden/tree-manifest.txt" | grep -cE '^(package\.json|bin/)' || true)" -eq 0 ] || { echo "the sync ships the package's own files"; false; }
}
