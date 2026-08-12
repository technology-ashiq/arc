#!/usr/bin/env bats
# Phase 00 -- REQ-01: hq.jobs.yaml has a closed schema and a HOSTILE lint. jobs-lint is a
# validator, not an advisory lint: it exits 2 from birth, because a schedule file that parses
# when it should not is a job nobody authorised running unattended on a timer.
#
# The corpus drives lib/jobs/schema.mjs through tests/fixtures/jobs/lint-harness.mjs, because
# the rules take their world by injection and the corpus needs policies the live file does not
# and should not contain (one that grants spend, one whose write root reaches the code).
# The CLI path -- real YAML subset, real hq.policy.yaml, real EXIT CODES -- is asserted at the
# bottom, because the harness never exercises an exit code and a mutant jobs-lint that returns
# 0 unconditionally survived the entire first version of this file.
#
# Every case asserts the HARNESS-DONE marker, which is printed only after the linter ran to
# completion. Asserting a finding code alone would be satisfied by a crash that never linted.
#
# NO GNU-ONLY sed. A `\n` in a sed replacement is a literal `n` on the BSD sed the macOS legs
# run, and the first version of this file had three -- two silently asserting the wrong finding
# and one passing while testing a different construct entirely. Fixtures that need extra lines
# are built with heredocs.
bats_require_minimum_version 1.5.0
load 'test_helper'

HARNESS="$ARC_ROOT/tests/fixtures/jobs/lint-harness.mjs"
LINT="$ARC_ROOT/.claude/scripts/hq/jobs-lint.mjs"

setup() {
  JOBS="$BATS_TEST_TMPDIR/hq.jobs.yaml"
  POLICY="$BATS_TEST_TMPDIR/policy.json"
  _good_policy
}

# A fixture builder asserts its own fixture is non-empty. An empty fixture is a silent pass
# generator and looks identical to a clean run.
_write_jobs() {
  cat > "$JOBS"
  [ -s "$JOBS" ] || { echo "fixture builder wrote an EMPTY jobs file"; false; }
}
_write_policy() {
  cat > "$POLICY"
  [ -s "$POLICY" ] || { echo "fixture builder wrote an EMPTY policy file"; false; }
}

_good_policy() {
  _write_policy <<'EOF'
{
  "kinds": {
    "process:ok-job": {
      "read":  { "level": "L3" },
      "write": { "level": "L2", "roots": [".claude/state/hq/**"] },
      "shell": { "level": "L1" },
      "spend": { "level": "L0" }
    },
    "process:other-job": {
      "read":  { "level": "L3" },
      "write": { "level": "L2", "roots": [".claude/state/hq/**"] },
      "spend": { "level": "L0" }
    },
    "session:interactive": {
      "read":  { "level": "L3" },
      "write": { "level": "L2", "roots": ["initiatives/**", "docs/**", "tests/**"] },
      "spend": { "level": "L0" }
    }
  },
  "ungrantable_resources": [".claude/settings.json"],
  "__processNames": ["ok-job", "kickoff-plan"]
}
EOF
}

# A policy whose single subject carries the given write roots, as raw JSON.
_policy_with_roots() {
  _write_policy <<EOF
{
  "kinds": {
    "process:ok-job": {
      "read":  { "level": "L3" },
      "write": { "level": "L2", "roots": $1 },
      "spend": { "level": "L0" }
    }
  },
  "ungrantable_resources": [],
  "__processNames": ["ok-job"]
}
EOF
}

_run_harness() { run node "$HARNESS" "$JOBS" "$POLICY" --root "$ARC_ROOT"; }

# Asserts the harness RAN, then that the named code is among its findings.
_assert_code() {
  local want="$1"
  [ "$status" -eq 0 ] || { echo "harness exited $status"; echo "$output"; false; }
  echo "$output" | grep -q "HARNESS-DONE" || { echo "harness never finished:"; echo "$output"; false; }
  echo "$output" | grep -q "^CODE:$want\$" || { echo "wanted CODE:$want, got:"; echo "$output"; false; }
}

_assert_clean() {
  [ "$status" -eq 0 ] || { echo "harness exited $status"; echo "$output"; false; }
  echo "$output" | grep -q "HARNESS-DONE 0" || { echo "expected zero findings, got:"; echo "$output"; false; }
}

_valid_job_body() {
  cat <<'EOF'
version: 1
monthly_ceiling_inr: 0
defaults:
  catchup: skip
jobs:
  - name: ok-job
    type: script
    entry: .claude/scripts/hq/jobs/day-close-roll.mjs
    budget:
      min: 2
    policy_kind: process:ok-job
    cadence: daily@00:15
    enabled: true
EOF
}

@test "jobs-lint: a well formed schedule produces no findings at all" {
  _valid_job_body | _write_jobs
  _run_harness
  _assert_clean
}

@test "jobs-lint: hostile 01 rejects a cadence outside the closed grammar" {
  _valid_job_body | sed 's|cadence: daily@00:15|cadence: "*/5 * * * *"|' | _write_jobs
  _run_harness
  _assert_code cadence
}

@test "jobs-lint: hostile 02 rejects an out of range hour that matches the shape" {
  _valid_job_body | sed 's|cadence: daily@00:15|cadence: daily@25:00|' | _write_jobs
  _run_harness
  _assert_code cadence
}

@test "jobs-lint: hostile 03 rejects a script entry that does not exist" {
  _valid_job_body | sed 's|entry: .*|entry: .claude/scripts/hq/jobs/no-such-job.mjs|' | _write_jobs
  _run_harness
  _assert_code entry-missing
}

@test "jobs-lint: hostile 04 rejects a script entry outside the allowed directory" {
  _valid_job_body | sed 's|entry: .*|entry: .claude/scripts/hq/arc-event.mjs|' | _write_jobs
  _run_harness
  _assert_code entry-dir
}

@test "jobs-lint: hostile 05 rejects a traversal that climbs out of the allowed directory" {
  _valid_job_body | sed 's|entry: .*|entry: .claude/scripts/hq/jobs/../arc-event.mjs|' | _write_jobs
  _run_harness
  _assert_code entry-dir
}

@test "jobs-lint: hostile 06 rejects the jobs DIRECTORY itself as an entry" {
  # node runs a directory by resolving its index.js, so this is executable without ever having
  # been reviewed as a script. existsSync is true for a directory, which is what let it pass.
  _valid_job_body | sed 's|entry: .*|entry: .claude/scripts/hq/jobs|' | _write_jobs
  _run_harness
  _assert_code entry-not-a-file
}

@test "jobs-lint: hostile 07 rejects a job with no budget minutes" {
  _valid_job_body | sed '/^      min: 2$/d' | _write_jobs
  _run_harness
  _assert_code budget-min
}

@test "jobs-lint: hostile 08 rejects a rupee budget on a script job" {
  _write_jobs <<'EOF'
version: 1
monthly_ceiling_inr: 0
jobs:
  - name: ok-job
    type: script
    entry: .claude/scripts/hq/jobs/day-close-roll.mjs
    budget:
      min: 2
      inr: 5
    policy_kind: process:ok-job
    cadence: daily@00:15
    enabled: true
EOF
  _run_harness
  _assert_code budget-inr-forbidden
}

@test "jobs-lint: hostile 09 rejects a process job with no rupee budget" {
  _write_jobs <<'EOF'
version: 1
monthly_ceiling_inr: 0
jobs:
  - name: ok-job
    type: process
    entry: kickoff-plan
    budget:
      min: 2
    policy_kind: process:ok-job
    cadence: daily@00:15
    enabled: true
EOF
  _run_harness
  _assert_code budget-inr-required
}

@test "jobs-lint: hostile 10 rejects a null rupee budget that coerces to zero" {
  # Number(null) === 0, so `inr: null` satisfied "inr is mandatory" AND billed zero -- an
  # unbudgeted LLM job walking straight through the ceiling check.
  _write_jobs <<'EOF'
version: 1
monthly_ceiling_inr: 0
jobs:
  - name: ok-job
    type: process
    entry: kickoff-plan
    budget:
      min: 2
      inr: null
    policy_kind: process:ok-job
    cadence: daily@00:15
    enabled: true
EOF
  _run_harness
  _assert_code budget-inr
}

@test "jobs-lint: hostile 11 rejects two jobs sharing one name" {
  { _valid_job_body; cat <<'EOF'
  - name: ok-job
    type: script
    entry: .claude/scripts/hq/jobs/brief-materialize.mjs
    budget:
      min: 2
    policy_kind: process:ok-job
    cadence: daily@06:00
    enabled: true
EOF
  } | _write_jobs
  _run_harness
  _assert_code duplicate
}

@test "jobs-lint: hostile 12 rejects a name outside the grammar" {
  _valid_job_body | sed 's|name: ok-job|name: Ok_Job|' | _write_jobs
  _run_harness
  _assert_code name
}

@test "jobs-lint: hostile 13 rejects a policy_kind absent from the live subject set" {
  _valid_job_body | sed 's|name: ok-job|name: ghost|; s|policy_kind: process:ok-job|policy_kind: process:ghost|' | _write_jobs
  _run_harness
  _assert_code policy-kind
}

@test "jobs-lint: hostile 14 rejects a job wearing the interactive session subject" {
  # session:interactive grants write to tests/** -- the hostile corpus that proves the schedule
  # safe. Membership in the subject set was never enough; it must be THIS job's own subject.
  _valid_job_body | sed 's|policy_kind: process:ok-job|policy_kind: session:interactive|' | _write_jobs
  _run_harness
  _assert_code policy-kind
}

@test "jobs-lint: hostile 15 rejects a job wearing a SIBLING job subject" {
  _valid_job_body | sed 's|policy_kind: process:ok-job|policy_kind: process:other-job|' | _write_jobs
  _run_harness
  _assert_code policy-kind
}

@test "jobs-lint: hostile 16 rejects a policy_kind that grants spend above L0" {
  _write_policy <<'EOF'
{
  "kinds": {
    "process:ok-job": {
      "read":  { "level": "L3" },
      "write": { "level": "L2", "roots": [".claude/state/hq/**"] },
      "spend": { "level": "L2", "cap_inr": 100 }
    }
  },
  "ungrantable_resources": [],
  "__processNames": ["ok-job"]
}
EOF
  _valid_job_body | _write_jobs
  _run_harness
  _assert_code spend-kind
}

@test "jobs-lint: hostile 17 rejects a job granted write access to the code" {
  _policy_with_roots '[".claude/scripts/**"]'
  _valid_job_body | _write_jobs
  _run_harness
  _assert_code self-mod
}

@test "jobs-lint: hostile 18 rejects a write root whose PARENT reaches the code" {
  _policy_with_roots '[".claude/**"]'
  _valid_job_body | _write_jobs
  _run_harness
  _assert_code self-mod
}

@test "jobs-lint: hostile 19 rejects a job granted write access to the schedule itself" {
  _policy_with_roots '["hq.jobs.yaml"]'
  _valid_job_body | _write_jobs
  _run_harness
  _assert_code self-mod
}

@test "jobs-lint: hostile 20 rejects the BARE universal glob as a write root" {
  # The first version stripped only a TRAILING /** so a bare ** matched neither branch, resolved
  # a path whose last segment is literally **, matched nothing and passed clean. withinRoots
  # treats ** as grant-everything, so this is the MAXIMUM grant, not an exotic one.
  _policy_with_roots '["**"]'
  _valid_job_body | _write_jobs
  _run_harness
  _assert_code self-mod
}

@test "jobs-lint: hostile 21 rejects write roots that are not a sequence" {
  # roots as a bare string failed Array.isArray and skipped the whole self-modification ban.
  _policy_with_roots '"**"'
  _valid_job_body | _write_jobs
  _run_harness
  _assert_code self-mod
}

@test "jobs-lint: hostile 22 rejects a job granted write access to its own tests" {
  _policy_with_roots '["tests/**"]'
  _valid_job_body | _write_jobs
  _run_harness
  _assert_code self-mod
}

@test "jobs-lint: hostile 23 rejects a credential looking value" {
  _write_jobs <<'EOF'
version: 1
monthly_ceiling_inr: 0
jobs:
  - name: ok-job
    type: script
    entry: .claude/scripts/hq/jobs/day-close-roll.mjs
    budget:
      min: 2
    policy_kind: ghp_abcdefghijklmnopqrstuvwxyz0123
    cadence: daily@00:15
    enabled: true
EOF
  _run_harness
  _assert_code credential
}

@test "jobs-lint: hostile 24 rejects a credential hiding in a COMMENT" {
  # Comments are stripped by the lexer before the parsed doc exists, so a value-only scan cannot
  # see them -- and a committed comment leaks exactly as much as a committed value.
  { _valid_job_body; echo '# AKIAIOSFODNN7EXAMPLE'; } | _write_jobs
  _run_harness
  _assert_code credential
}

@test "jobs-lint: hostile 25 rejects a schedule whose worst case month breaches the ceiling" {
  _write_jobs <<'EOF'
version: 1
monthly_ceiling_inr: 100
jobs:
  - name: ok-job
    type: process
    entry: kickoff-plan
    budget:
      min: 2
      inr: 50
    policy_kind: process:ok-job
    cadence: daily@09:00
    enabled: true
EOF
  _run_harness
  _assert_code ceiling-breach
}

@test "jobs-lint: hostile 26 rejects a non empty flow collection the frozen subset excludes" {
  _valid_job_body | sed 's|    budget:|    budget: { min: 2 }|; /^      min: 2$/d' | _write_jobs
  _run_harness
  _assert_code parse
}

@test "jobs-lint: hostile 27 rejects a schema version that is not the integer 1" {
  _valid_job_body | sed 's|^version: 1$|version: "1"|' | _write_jobs
  _run_harness
  _assert_code version
}

@test "jobs-lint: hostile 28 rejects a non boolean enabled" {
  _valid_job_body | sed 's|enabled: true|enabled: "yes"|' | _write_jobs
  _run_harness
  _assert_code enabled
}

@test "jobs-lint: hostile 29 rejects an unknown catchup value" {
  _write_jobs <<'EOF'
version: 1
monthly_ceiling_inr: 0
jobs:
  - name: ok-job
    type: script
    entry: .claude/scripts/hq/jobs/day-close-roll.mjs
    budget:
      min: 2
    policy_kind: process:ok-job
    cadence: daily@00:15
    enabled: true
    catchup: maybe
EOF
  _run_harness
  _assert_code catchup
}

@test "jobs-lint: hostile 30 rejects a misspelled key that silently disarms catchup" {
  # `catch_up: run` was accepted and ignored, so the one guarantee that matters on a
  # Modern-Standby-only machine vanished with a clean lint and no diff signal.
  _write_jobs <<'EOF'
version: 1
monthly_ceiling_inr: 0
jobs:
  - name: ok-job
    type: script
    entry: .claude/scripts/hq/jobs/day-close-roll.mjs
    budget:
      min: 2
    policy_kind: process:ok-job
    cadence: daily@00:15
    enabled: true
    catch_up: run
EOF
  _run_harness
  _assert_code unknown-key
}

@test "jobs-lint: hostile 31 rejects a type outside script and process" {
  _valid_job_body | sed 's|type: script|type: daemon|' | _write_jobs
  _run_harness
  _assert_code type
}

@test "jobs-lint: hostile 32 rejects a null monthly ceiling that coerces to zero" {
  _valid_job_body | sed 's|^monthly_ceiling_inr: 0$|monthly_ceiling_inr: null|' | _write_jobs
  _run_harness
  _assert_code ceiling
}

@test "jobs-lint: hostile 33 refuses when the process subject set cannot be read" {
  # null from processNames() means "cannot check" and is NOT the empty list. subjects.mjs states
  # that contract in its own header; conflating them reports a missing directory as clean.
  _write_policy <<'EOF'
{
  "kinds": {
    "process:ok-job": {
      "read":  { "level": "L3" },
      "write": { "level": "L2", "roots": [".claude/state/hq/**"] },
      "spend": { "level": "L0" }
    }
  },
  "ungrantable_resources": []
}
EOF
  _write_jobs <<'EOF'
version: 1
monthly_ceiling_inr: 0
jobs:
  - name: ok-job
    type: process
    entry: totally-invented
    budget:
      min: 2
      inr: 0
    policy_kind: process:ok-job
    cadence: daily@00:15
    enabled: true
EOF
  _run_harness
  _assert_code entry-unverifiable
}

@test "jobs-lint: hostile 34 refuses when no policy is available at all" {
  _valid_job_body | _write_jobs
  run node "$HARNESS" "$JOBS" NONE --root "$ARC_ROOT"
  [ "$status" -eq 0 ] || { echo "harness exited $status"; echo "$output"; false; }
  echo "$output" | grep -q "HARNESS-DONE" || { echo "harness never finished"; false; }
  echo "$output" | grep -q "^CODE:policy-unavailable\$" || { echo "$output"; false; }
}

# --- the ceiling arithmetic is the ceiling, not an average -------------------------------
@test "jobs-lint: bill charges a daily job for 31 slots and a weekdays job for 23" {
  _write_jobs <<'EOF'
version: 1
monthly_ceiling_inr: 100000
jobs:
  - name: ok-job
    type: process
    entry: kickoff-plan
    budget:
      min: 2
      inr: 100
    policy_kind: process:ok-job
    cadence: daily@09:00
    enabled: true
  - name: other-job
    type: process
    entry: kickoff-plan
    budget:
      min: 2
      inr: 100
    policy_kind: process:other-job
    cadence: weekdays@09:00
    enabled: true
EOF
  _run_harness
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  echo "$output" | grep -q "HARNESS-DONE" || { echo "harness never finished"; false; }
  # 100 x 31 + 100 x 23 = 5400. Asserting the NUMBER, not merely that a bill was printed:
  # a bill that silently charged an average would still print a line.
  echo "$output" | grep -q "^BILL:5400\$" || { echo "wanted BILL:5400, got:"; echo "$output"; false; }
}

@test "jobs-lint: a disabled job is still linted, because it can be re-enabled by one edit" {
  _valid_job_body | sed 's|enabled: true|enabled: false|; s|cadence: daily@00:15|cadence: hourly@00:15|' | _write_jobs
  _run_harness
  _assert_code cadence
}

# --- CLI end to end: the EXIT CODE is the contract, and nothing was binding it -------------
@test "jobs-lint CLI: exits 2 on an illegal schedule and names the rule" {
  _valid_job_body | sed 's|cadence: daily@00:15|cadence: hourly@00:15|' > "$JOBS"
  [ -s "$JOBS" ] || { echo "empty fixture"; false; }
  run node "$LINT" --file "$JOBS"
  # This is the negative control for the mutant the phase spec names: a jobs-lint that returns
  # exit 0 unconditionally passed every other test in this file, because the harness never
  # exercises an exit code and the only CLI status assertion accepted 0 or 2.
  [ "$status" -eq 2 ] || { echo "wanted exit 2, got $status"; echo "$output"; false; }
  echo "$output" | grep -q 'FAIL  \[cadence\]' || { echo "no cadence FAIL line:"; echo "$output"; false; }
}

@test "jobs-lint CLI: exits 0 and says clean on a legal schedule" {
  _valid_job_body | sed 's|policy_kind: process:ok-job|policy_kind: process:kickoff-plan|; s|name: ok-job|name: kickoff-plan|' > "$JOBS"
  [ -s "$JOBS" ] || { echo "empty fixture"; false; }
  run node "$LINT" --file "$JOBS"
  [ "$status" -eq 0 ] || { echo "wanted exit 0, got $status"; echo "$output"; false; }
  echo "$output" | grep -q "jobs-lint: clean" || { echo "$output"; false; }
}

@test "jobs-lint CLI: the committed hq.jobs.yaml parses under the frozen subset" {
  run node "$LINT" --json
  [ "$status" -eq 0 ] || [ "$status" -eq 2 ] || { echo "unexpected exit $status"; echo "$output"; false; }
  echo "$output" | grep -q '"findings"' || { echo "no json findings block:"; echo "$output"; false; }
  ! echo "$output" | grep -q '"code": "parse"' || { echo "hq.jobs.yaml does not parse:"; echo "$output"; false; }
  ! echo "$output" | grep -q '"code": "version"' || { echo "hq.jobs.yaml has a bad version:"; echo "$output"; false; }
}

@test "jobs-lint CLI: refuses to run at all when there is no schedule file" {
  run node "$LINT" --file "$BATS_TEST_TMPDIR/absent.yaml"
  # Exit 1, not 2. "This schedule is illegal" and "I could not tell" are different answers, and
  # collapsing them lets a broken checkout read as a clean one.
  [ "$status" -eq 1 ] || { echo "wanted exit 1, got $status"; echo "$output"; false; }
}

@test "jobs-lint CLI: bill refuses to report a measured zero for a file it could not parse" {
  printf 'version: 1\njobs: { a: 1 }\n' > "$JOBS"
  [ -s "$JOBS" ] || { echo "empty fixture"; false; }
  run node "$LINT" --file "$JOBS" --bill
  [ "$status" -eq 2 ] || { echo "wanted exit 2, got $status"; echo "$output"; false; }
  echo "$output" | grep -q "UNKNOWN" || { echo "bill claimed a number for an unparsed file:"; echo "$output"; false; }
}

# --- the suite asserts its own REGISTERED size, not its line count ------------------------
# bats silently DROPS a @test whose name carries a non-ASCII character, and Cycle 7 lost five
# tests that way with a green file. Counting `^@test ` lines cannot catch that -- the line is
# still in the file. Asking bats how many it registered can.
@test "jobs-lint: bats registers every test this file declares" {
  run bats --count "$BATS_TEST_FILENAME"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local declared
  declared="$(grep -c '^@test ' "$BATS_TEST_FILENAME")"
  [ "$output" -eq "$declared" ] || {
    echo "bats registered $output tests but the file declares $declared -- a non-ASCII test name silently drops one"; false; }
  [ "$output" -eq 43 ] || { echo "test count moved: expected 43, bats registered $output"; false; }
}
