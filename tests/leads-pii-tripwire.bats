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

# Assembled at runtime, never written as a literal email shape. This file is itself inside the
# tripwire's scan scope, so a hardcoded non-reserved address here would be a real violation --
# the gate would be failing on its own test data, which is the honest outcome and not a
# workaround. Building it from parts keeps the file clean while still exercising the branch.
NONRESERVED_DOMAIN="realfirm.$(printf 'co').in"

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
  echo 'const owner = "advocate@${NONRESERVED_DOMAIN}";' > .claude/scripts/leads/leak.mjs
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
  echo '{"email":"real.person@${NONRESERVED_DOMAIN}"}' > tests/fixtures/leads/bad.json
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
  echo 'const owner = "advocate@${NONRESERVED_DOMAIN}";' > .claude/scripts/leads/scratch.mjs
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
# ---------------------------------------------------------------------------------------
# THE WIRE. Until this test existed, `pii-tripwire.sh` had NO CALLER anywhere in the repo --
# not in ci.yml, not in a hook, not in any /arc-* command. It only ever ran against its own
# sandbox. An alarm that is not connected to anything is not a control, and the phase-00 DoD
# claims it is green "on every CI leg". This test is what makes that sentence true.
@test "the tripwire runs clean against the REAL repository" {
  run bash "$ARC_ROOT/$TRIPWIRE" "$ARC_ROOT"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

# And it must have actually looked at something. "clean (0 files scanned)" is the failure this
# whole file exists to prevent, in the one place it would matter most.
@test "the real repository scan covers a non zero number of files" {
  run bash "$ARC_ROOT/$TRIPWIRE" "$ARC_ROOT"
  [ "$status" -eq 0 ]
  count=$(printf '%s' "$output" | sed -n 's/.*clean (\([0-9]*\) tracked.*//p')
  [ -n "$count" ] && [ "$count" -ge 10 ] || { echo "scanned only '$count' files: $output"; false; }
}

# Mutant mA passed the original suite by cutting scope to two of the six declared paths. Each
# declared path now carries its own violation case, so dropping any one of them turns red.
@test "scope covers the config file" {
  mkdir -p .claude/config
  echo '{"owner":"advocate@${NONRESERVED_DOMAIN}"}' > .claude/config/leads.json
  git add -A && git commit -qm cfg
  _run_tripwire
  [ "$status" -eq 2 ]
}

@test "scope covers the products directory" {
  mkdir -p products/leads
  echo '{"contact":"advocate@${NONRESERVED_DOMAIN}"}' > products/leads/manifest.json
  git add -A && git commit -qm prod
  _run_tripwire
  [ "$status" -eq 2 ]
}

@test "scope covers the initiatives directory" {
  mkdir -p initiatives/leads
  echo 'owner advocate@${NONRESERVED_DOMAIN}' > initiatives/leads/PROGRESS.md
  git add -A && git commit -qm init
  _run_tripwire
  [ "$status" -eq 2 ]
}

@test "scope covers the leads bats files" {
  echo 'advocate@${NONRESERVED_DOMAIN}' > tests/leads-example.bats
  git add -A && git commit -qm bats
  _run_tripwire
  [ "$status" -eq 2 ]
}

# Mutant mB passed by exiting 0 when not in a git work tree. Reporting clean on a scan that
# could not happen is the worst possible failure mode for an alarm.
@test "a directory that is not a git work tree refuses rather than reporting clean" {
  local plain="$BATS_TEST_TMPDIR/plain"
  mkdir -p "$plain"
  run bash "$ARC_ROOT/$TRIPWIRE" "$plain"
  [ "$status" -eq 3 ]
  [[ "$output" == *"not a git work tree"* ]]
}

# Mutant mD passed because every store test exported ARC_LEADS_STORE, so the DEFAULT-store
# branch -- the one an operator actually hits, and the one that was broken on the Windows leg
# because it derived the path from $HOME while store.mjs uses os.homedir() -- never ran.
@test "the default store path branch is exercised with ARC_LEADS_STORE unset" {
  local store
  store=$(cd "$ARC_ROOT" && node --input-type=module -e     'const {storePath} = await import("./.claude/scripts/leads/lib/store.mjs"); process.stdout.write(storePath());')
  [ -n "$store" ] || { echo "storePath() returned nothing"; false; }
  printf 'const p = "%s";
' "$store" > .claude/scripts/leads/cfg.mjs
  git add -A && git commit -qm defaultstore
  cd "$SANDBOX" && run env -u ARC_LEADS_STORE bash .claude/scripts/leads/pii-tripwire.sh "$SANDBOX"
  [ "$status" -eq 2 ]
  [[ "$output" == *"resolved store path"* ]]
}

# A tracked path with a space was silently skipped by unquoted $files, and the footer still
# counted it. Same class: newlines and glob characters in paths.
@test "a tracked path containing a space is scanned" {
  printf '{"email":"real.person@${NONRESERVED_DOMAIN}"}
' > "tests/fixtures/leads/two words.json"
  git add -A && git commit -qm space
  _run_tripwire
  [ "$status" -eq 2 ]
}

# git quotes non-ASCII paths by default (core.quotePath), so the file arrived as an
# octal-escaped quoted string, failed the -f test, and was skipped.
@test "a tracked path with a non ASCII name is scanned" {
  printf '{"email":"real.person@${NONRESERVED_DOMAIN}"}
' > "tests/fixtures/leads/josÃ©.json"
  git add -A && git commit -qm nonascii
  _run_tripwire
  [ "$status" -eq 2 ]
}

# grep answered "Binary file ... matches" on a NUL-bearing file: rule 1 read that as no-match
# and failed OPEN, while rule 2 pasted the banner into its line-number field.
@test "a file containing a NUL byte is still scanned for addresses" {
  # The NUL is an ESCAPE that printf expands at runtime, never a literal byte in this tracked
  # file: a raw NUL in source is invisible in every diff and makes the file read as binary to
  # grep and to git, which is the same class of hazard as a raw zero-width character.
  printf 'real.person@%s\x00tail\n' "$NONRESERVED_DOMAIN" > tests/fixtures/leads/blob.bin
  git add -A && git commit -qm nul
  _run_tripwire
  [ "$status" -eq 2 ]
  [[ "$output" == *"Binary file"* ]] && { echo "grep banner leaked into the report"; false; }
  [[ "$output" == *"non-reserved address"* ]]
}

@test "this file registers the 21 tests it declares" {
  # BATS_TEST_NAMES is what bats REGISTERED. The previous version grepped `^@test ` in
  # this same file and compared it to a literal in this same file -- a tautology that
  # cannot see a test bats dropped, which is the only thing it was there to catch.
  declared=$(grep -c '^@test ' "$BATS_TEST_FILENAME")
  registered=${#BATS_TEST_NAMES[@]}
  [ "$declared" -eq 21 ] || { echo "declared $declared, expected 21"; false; }
  [ "$registered" -eq "$declared" ] || { echo "bats registered $registered of $declared declared tests -- one was DROPPED (non-ASCII name?)"; false; }
}
