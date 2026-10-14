#!/usr/bin/env bats
# distribute Cycle 2, Phase 06 -- `arc-ship` runs in a repo with no deploy target, and in arc itself (ADR-2021, REQ-13).
#
# arc's package.json gains lint and test (no build: see the package.json test), where `test` is `ci-digest --wait`: it reads CI for the pushed head and
# runs nothing locally. The wait logic is driven by tests/distribute/ci-wait-probe.mjs with a scripted digest and a
# fake clock; each arm asserts the probe RAN before reading its case lines.

bats_require_minimum_version 1.5.0
load 'test_helper'

native() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }
count() { printf '%s\n' "$output" | tr -d '\r' | grep -cE "$1" || true; }
DIGEST() { native "$ARC_ROOT/.claude/scripts/review/ci-digest.mjs"; }

probe() {
  run --separate-stderr node "$(native "$ARC_ROOT/tests/distribute/ci-wait-probe.mjs")"
  [ "$status" -eq 0 ] && [ "$(count '^RAN ci-wait-probe$')" -eq 1 ] || { echo "the probe never finished: $status $output $stderr"; return 1; }
}

@test "distribute-ship-nodeploy: every test in the file is registered" {
  local declared
  declared=$(grep -c '^@test "distribute-ship-nodeploy: ' "$BATS_TEST_FILENAME")
  [ "$declared" -eq 9 ] || { echo "declared $declared, expected 8"; false; }
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "distribute-ship-nodeploy: package.json carries lint and test, and no script that makes npm prepare a git install" {
  local p="$ARC_ROOT/package.json"
  [ "$(_arc_json "$p" 'j.scripts.lint')" = "node .claude/scripts/core/gate-parity.mjs && node .claude/scripts/core/brain-drift.mjs && node .claude/scripts/engine/arc-compile.mjs --check --all --input source --target opencode" ] || { echo "lint: $(_arc_json "$p" 'j.scripts')"; false; }
  [ "$(_arc_json "$p" 'j.scripts.test')" = "node .claude/scripts/review/ci-digest.mjs --wait --timeout-min 9" ] || { echo "test"; false; }
  # No `build`: npm runs a full install inside a git dependency that declares build, install, prepare or prepack, and
  # that broke `npm install -g <git URL>` (distribute-install-clean). arc-ship runs `npm run build --if-present`.
  [ "$(_arc_json "$p" 'Object.keys(j.scripts).sort().join(",")')" = "lint,test" ] || { echo "an extra script: $(_arc_json "$p" 'Object.keys(j.scripts)')"; false; }
}

@test "distribute-ship-nodeploy: --wait returns the first settled verdict after re-reading a pending one" {
  probe || false
  [ "$(count '^case settles-green code=0 reads=3 sleeps=2 prviews=0 last=GREEN: ')" -eq 1 ] || { echo "$output"; false; }
  [ "$(count '^case settles-red code=1 reads=2 sleeps=1 prviews=0 last=RED: ')" -eq 1 ] || { echo "$output"; false; }
  [ "$(count '^case run-appears-in-time code=0 reads=3 sleeps=2 prviews=0 last=GREEN: ')" -eq 1 ] || { echo "$output"; false; }
}

@test "distribute-ship-nodeploy: a SHA mismatch returns at once, never retried" {
  probe || false
  [ "$(count '^case mismatch-at-once code=4 reads=1 sleeps=0 prviews=0 last=SHA MISMATCH: ')" -eq 1 ] || { echo "$output"; false; }
}

@test "distribute-ship-nodeploy: no run for the head is NO-RUN (exit 6) with the PR state, and a run that never settles is TIMEOUT (exit 3)" {
  probe || false
  # 5 minutes at one read a minute: reads 1..6, then NO-RUN on the read that finds 300 s gone.
  [ "$(count '^case no-run code=6 reads=6 sleeps=5 prviews=1 last=NO-RUN: no CI run for this commit after 300s; PR: \{"isDraft":false,"mergeable":"CONFLICTING","state":"OPEN"\}$')" -eq 1 ] || { echo "$output"; false; }
  [ "$(count '^case never-settles code=3 reads=4 sleeps=3 prviews=0 last=TIMEOUT: still pending after 180s$')" -eq 1 ] || { echo "$output"; false; }
  # A timeout shorter than the no-run window still ends as NO-RUN, never as a plain TIMEOUT.
  [ "$(count '^case no-run-short-timeout code=6 reads=3 sleeps=2 prviews=1 last=NO-RUN: no CI run for this commit after 120s; ')" -eq 1 ] || { echo "$output"; false; }
}

@test "distribute-ship-nodeploy: a gh failure mid-wait is retried, and three in a row end the wait" {
  probe || false
  [ "$(count '^case gh-blips-then-green code=0 reads=3 sleeps=2 prviews=0 last=GREEN: ')" -eq 1 ] || { echo "$output"; false; }
  [ "$(count '^case gh-down code=threw reads=3 sleeps=2 prviews=0 last=gh: HTTP 502$')" -eq 1 ] || { echo "$output"; false; }
}

@test "distribute-ship-nodeploy: the CLI refuses --timeout-min without --wait, out of range, and a repeated flag" {
  local fails=""
  run --separate-stderr node "$(DIGEST)" --timeout-min 5
  [ "$status" -eq 2 ] && printf '%s\n' "$stderr" | grep -q -- '--timeout-min only means something with --wait' || fails="$fails|no --wait: $status $stderr"
  run --separate-stderr node "$(DIGEST)" --wait --timeout-min 999
  [ "$status" -eq 2 ] && printf '%s\n' "$stderr" | grep -q -- '--timeout-min must be 1-180' || fails="$fails|range: $status $stderr"
  run --separate-stderr node "$(DIGEST)" --wait --wait
  [ "$status" -eq 2 ] && printf '%s\n' "$stderr" | grep -q -- '--wait given twice' || fails="$fails|twice: $status $stderr"
  run --separate-stderr node "$(DIGEST)" --timeout-min 20
  [ "$status" -eq 2 ] && printf '%s\n' "$stderr" | grep -q -- '--timeout-min only means something with --wait' || fails="$fails|default value without --wait: $status $stderr"
  # A branch with no upstream: --wait refuses rather than reading a not-yet-picked-up push as a mismatch.
  local r="$BATS_TEST_TMPDIR/noup"
  git init -q "$r" && git -C "$r" -c user.email=t@example.invalid -c user.name=t commit -q --allow-empty -m x
  run --separate-stderr bash -c 'cd "$1" && node "$2" --wait' _ "$r" "$(DIGEST)"
  [ "$status" -eq 2 ] && printf '%s\n' "$stderr" | grep -q -- '--wait needs a branch that tracks its push' || fails="$fails|no upstream: $status $stderr"
  # A branch cut from origin/main tracks origin/main: --wait refuses it rather than read a lagging run as a mismatch.
  local bare="$BATS_TEST_TMPDIR/bare.git" w="$BATS_TEST_TMPDIR/cut"
  git init -q --bare "$bare" && git -C "$r" push -q "$bare" HEAD:refs/heads/main
  git clone -q "$bare" "$w" && git -C "$w" checkout -q -b feat/x origin/main
  run --separate-stderr bash -c 'cd "$1" && node "$2" --wait' _ "$w" "$(DIGEST)"
  [ "$status" -eq 2 ] && printf '%s\n' "$stderr" | grep -qF 'needs feat/x to track its own pushed ref; its upstream is `origin/main`' || fails="$fails|foreign upstream: $status $stderr"
  [ -z "$fails" ] || { echo "$fails" | tr '|' '\n'; false; }
}

@test "distribute-ship-nodeploy: arc-ship deploys only to a declared target, ships to a PR otherwise, and nothing else calls npm test" {
  local f="$ARC_ROOT/.claude/commands/arc-ship.md"
  [ -s "$f" ] || { echo "no arc-ship.md"; false; }
  grep -qF 'Bash(gh pr view --json url,state), Bash(gh pr create --fill)' "$f" || { echo "the fence lacks the two exact gh pr commands"; false; }
  if grep -qE 'Bash\(gh pr (view|create):\*\)' "$f"; then echo "a wildcard gh pr fence is back"; false; fi
  grep -qF 'Bash(git rev-parse --abbrev-ref @{u})' "$f" && grep -qF 'or its upstream is not `origin/<that branch>`, STOP' "$f" || { echo "no stop on an unpushed or foreign-tracking branch"; false; }
  grep -qF 'When it exits 3 (CI still running: each call waits at most 9 minutes), run it again, up to' "$f" || { echo "no bounded re-run of npm run test"; false; }
  grep -qF '2. `npm run build --if-present`' "$f" && grep -qF 'Bash(npm run build --if-present)' "$f" || { echo "build is not optional"; false; }
  grep -qF 'Deploy only if the repo declares a deploy target: a `vercel.json` or `.vercel/project.json` that git tracks' "$f" || { echo "no declared-target branch"; false; }
  grep -qF '`vercel --prod`' "$f" || { echo "the deploy line for a declared target is gone"; false; }
  grep -qF 'deploy: none declared — the PR is the ship' "$f" || { echo "no named no-deploy line"; false; }
  grep -qF 'gh pr create --fill' "$f" || { echo "no PR-create step"; false; }
  # npm test waits on CI in arc, so a caller inside CI, a hook or a test would wait on itself. The pre-deploy guard
  # is the one named exception: it runs only on a deploy command, and a deploy should wait for CI.
  local callers
  callers=$(cd "$ARC_ROOT" && git grep -lE 'npm (run )?test([^A-Za-z0-9_]|$)' -- .github .githooks .claude/hooks tests ':!tests/fixtures' ':!tests/kickoff-lint.bats' ':!tests/distribute-ship-nodeploy.bats' | tr -d '\r' | sort | tr '\n' ' ')
  [ "$callers" = ".claude/hooks/PreToolUse.d/50-deploy.sh " ] || { echo "npm test callers: [$callers]"; false; }
}

@test "distribute-ship-nodeploy: the deploy fence grants vercel --prod only and a target counts only when git tracks it" {
  local f="$ARC_ROOT/.claude/commands/arc-ship.md" g="$ARC_ROOT/.opencode/agents/arc-ship-fence.md"
  [ -s "$f" ] && [ -s "$g" ] || { echo "no arc-ship.md or its rendered fence"; false; }
  local tools; tools=$(sed -n 's/^allowed-tools: //p' "$f")
  [ -n "$tools" ] || { echo "no allowed-tools line"; false; }
  if printf '%s' "$tools" | grep -qF 'Bash(vercel:*)'; then echo "the whole vercel CLI is granted again (debt row 23)"; false; fi
  printf '%s' "$tools" | grep -qF 'Bash(vercel --prod), Bash(git ls-files --error-unmatch:*)' || { echo "fence: $tools"; false; }
  grep -qF 'that git tracks' "$f" && grep -qF 'git ls-files --error-unmatch .vercel/project.json' "$f" || { echo "no tracked-target check"; false; }
  grep -qF 'deploy: <file> exists but is not tracked by git — not a declared target' "$f" || { echo "no named untracked-target line"; false; }
  # The rendered fence is what binds an OpenCode session: it allows exactly the two deploy forms and no other vercel.
  # --yes is never granted: it is what lets vercel create a project from an untracked, unlinked tree (attack 8707a5c B3).
  if printf '%s' "$tools" | grep -qF -- '--yes'; then echo "the fence grants --yes"; false; fi
  grep -qxF '    "vercel --prod": allow' "$g" || { echo "rendered fence: $(cat "$g")"; false; }
  [ "$(grep -c '"vercel' "$g")" -eq 1 ] || { echo "rendered fence grants another vercel form: $(grep '"vercel' "$g")"; false; }
  grep -qxF 'mode: all' "$g" || { echo "the fence is not launchable as the session's own agent (debt row 22)"; false; }
}
