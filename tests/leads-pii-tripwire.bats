#!/usr/bin/env bats
# leads Phase 00 -- the PII tripwire (ADR-0410).
#
# This is the ALARM, not the wall. The wall is location isolation: lead data lives outside the
# repository directory, so it cannot be committed by accident. These tests assert the alarm
# fires on the accidents it CAN see, and they do not pretend it sees more.
#
# ASCII-only test names, deliberately. A U+2014 in two @test names once made bats fail to
# encode them into shell function identifiers under the C locale, so those tests never
# executed while the run still reported ok -- the vacuous-pass class this repo has shipped
# four times. The count assertion at the bottom is the mechanical guard against a repeat.
bats_require_minimum_version 1.5.0
load 'test_helper'

TRIPWIRE=".claude/scripts/leads/pii-tripwire.sh"

# Every case runs in a throwaway git repo, because the tripwire reads `git ls-files`: an
# untracked scratch file is not a leak, and scanning the real worktree would make these
# tests depend on whatever else happens to be checked out.
setup() {
  SANDBOX="$BATS_TEST_TMPDIR/repo"
  mkdir -p "$SANDBOX/.claude/scripts/leads" "$SANDBOX/tests/fixtures/leads"
  cp "$ARC_ROOT/$TRIPWIRE" "$SANDBOX/.claude/scripts/leads/pii-tripwire.sh"
  cd "$SANDBOX"
  git init -q .
  # Repo-local identity, never subshell-scoped env: a clean CI runner with no global git
  # identity exits 128 on the first commit, which is green locally and red in CI.
  git config user.email "test@example.invalid"
  git config user.name "leads test"
  git add -A >/dev/null
  git commit -qm base
}

_run_tripwire() {
  cd "$SANDBOX" && run bash .claude/scripts/leads/pii-tripwire.sh "$SANDBOX"
}

@test "clean tree exits 0" {
  _run_tripwire
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "email shaped string in a tracked non fixture file is rejected" {
  echo 'const owner = "advocate@realfirm.co.in";' > .claude/scripts/leads/leak.mjs
  git add -A && git commit -qm leak
  _run_tripwire
  [ "$status" -eq 2 ]
  [[ "$output" == *"email-shaped string in a tracked file"* ]]
  [[ "$output" == *"leak.mjs"* ]]
}

@test "reserved domain address inside a fixture path is allowed" {
  echo '{"email":"adv1@firm1.example.com"}' > tests/fixtures/leads/ok.json
  git add -A && git commit -qm fixture
  _run_tripwire
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "non reserved domain address inside a fixture path is rejected" {
  echo '{"email":"real.person@actualfirm.co.in"}' > tests/fixtures/leads/bad.json
  git add -A && git commit -qm fixture
  _run_tripwire
  [ "$status" -eq 2 ]
  [[ "$output" == *"non-reserved address in a fixture path"* ]]
}

@test "store path in POSIX form is rejected" {
  export ARC_LEADS_STORE="/c/Users/someone/.arc/leads"
  echo 'const p = "/c/Users/someone/.arc/leads";' > .claude/scripts/leads/cfg.mjs
  git add -A && git commit -qm path
  _run_tripwire
  [ "$status" -eq 2 ]
  [[ "$output" == *"resolved store path"* ]]
}

# The backslash case is the one a prior cycle lost an entire capability scan to. The Windows
# leg writes C:\Users\...\.arc\leads; a check that knows only the POSIX spelling passes while
# scanning nothing, which is worse than no check because it reports success.
@test "store path in Windows backslash form is rejected" {
  export ARC_LEADS_STORE="C:/Users/someone/.arc/leads"
  # A quoted heredoc, not printf: printf eats backslash escapes, so the first version of this
  # test wrote DOUBLE backslashes into the file while the script searched for single ones --
  # the test failed for its own escaping rather than for the behaviour under test.
  cat > .claude/scripts/leads/cfg.mjs <<'EOF'
const p = "C:\Users\someone\.arc\leads";
EOF
  git add -A && git commit -qm path
  _run_tripwire
  [ "$status" -eq 2 ]
  [[ "$output" == *"resolved store path"* ]]
}

@test "store path match is case insensitive" {
  export ARC_LEADS_STORE="/c/Users/Someone/.arc/leads"
  echo 'const p = "/C/USERS/SOMEONE/.ARC/LEADS";' > .claude/scripts/leads/cfg.mjs
  git add -A && git commit -qm path
  _run_tripwire
  [ "$status" -eq 2 ]
}

@test "untracked file holding an address does not fire" {
  echo 'const owner = "advocate@realfirm.co.in";' > .claude/scripts/leads/scratch.mjs
  _run_tripwire
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "usage error outside a git repo exits 3" {
  run bash "$ARC_ROOT/$TRIPWIRE" "$BATS_TEST_TMPDIR/definitely-not-a-dir"
  [ "$status" -eq 3 ]
}

# Executed-vs-declared reconciliation. If bats silently drops a test -- a mangled name, an
# unparseable @test, a file that fails to load -- this assertion is the only thing that
# notices, because a dropped test cannot fail.
@test "this file declares and runs 10 tests" {
  declared=$(grep -c '^@test ' "$BATS_TEST_FILENAME")
  [ "$declared" -eq 10 ] || { echo "declared $declared, expected 10"; false; }
}
