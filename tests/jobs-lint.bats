#!/usr/bin/env bats
# Phase 00 -- REQ-01: hq.jobs.yaml has a closed schema and a HOSTILE lint. jobs-lint is a
# validator, not an advisory lint: it exits 2 from birth, because a schedule file that parses
# when it should not is a job nobody authorised running unattended on a timer.
#
# The corpus drives lib/jobs/schema.mjs through tests/fixtures/jobs/lint-harness.mjs, because
# the rules take their world by injection and the corpus needs policies the live file does not
# and should not contain (one that grants spend, one whose write root reaches the code).
# The CLI path -- real YAML subset, real hq.policy.yaml -- is asserted end to end at the bottom.
#
# Every case asserts the HARNESS-DONE marker, which is printed only after the linter ran to
# completion. Asserting a finding code alone would be satisfied by a crash that never linted.
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
    }
  },
  "ungrantable_resources": [".claude/settings.json"],
  "__processNames": ["ok-job", "kickoff-plan"]
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

@test "jobs-lint: hostile 06 rejects a job with no budget minutes" {
  _valid_job_body | sed '/^      min: 2$/d' | _write_jobs
  _run_harness
  _assert_code budget-min
}

@test "jobs-lint: hostile 07 rejects a rupee budget on a script job" {
  _valid_job_body | sed 's|      min: 2|      min: 2\n      inr: 5|' | _write_jobs
  _run_harness
  _assert_code budget-inr-forbidden
}

@test "jobs-lint: hostile 08 rejects a process job with no rupee budget" {
  _valid_job_body | sed 's|type: script|type: process|; s|entry: .*|entry: kickoff-plan|' | _write_jobs
  _run_harness
  _assert_code budget-inr-required
}

@test "jobs-lint: hostile 09 rejects two jobs sharing one name" {
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

@test "jobs-lint: hostile 10 rejects a name outside the grammar" {
  _valid_job_body | sed 's|name: ok-job|name: Ok_Job|' | _write_jobs
  _run_harness
  _assert_code name
}

@test "jobs-lint: hostile 11 rejects a policy_kind absent from the live subject set" {
  _valid_job_body | sed 's|policy_kind: process:ok-job|policy_kind: report.compile|' | _write_jobs
  _run_harness
  _assert_code policy-kind
}

@test "jobs-lint: hostile 12 rejects a policy_kind that grants spend above L0" {
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

@test "jobs-lint: hostile 13 rejects a job granted write access to the code" {
  _write_policy <<'EOF'
{
  "kinds": {
    "process:ok-job": {
      "read":  { "level": "L3" },
      "write": { "level": "L2", "roots": [".claude/scripts/**"] },
      "spend": { "level": "L0" }
    }
  },
  "ungrantable_resources": [],
  "__processNames": ["ok-job"]
}
EOF
  _valid_job_body | _write_jobs
  _run_harness
  _assert_code self-mod
}

@test "jobs-lint: hostile 14 rejects a write root whose PARENT reaches the code" {
  _write_policy <<'EOF'
{
  "kinds": {
    "process:ok-job": {
      "read":  { "level": "L3" },
      "write": { "level": "L2", "roots": [".claude/**"] },
      "spend": { "level": "L0" }
    }
  },
  "ungrantable_resources": [],
  "__processNames": ["ok-job"]
}
EOF
  _valid_job_body | _write_jobs
  _run_harness
  _assert_code self-mod
}

@test "jobs-lint: hostile 15 rejects a job granted write access to the schedule itself" {
  _write_policy <<'EOF'
{
  "kinds": {
    "process:ok-job": {
      "read":  { "level": "L3" },
      "write": { "level": "L2", "roots": ["hq.jobs.yaml"] },
      "spend": { "level": "L0" }
    }
  },
  "ungrantable_resources": [],
  "__processNames": ["ok-job"]
}
EOF
  _valid_job_body | _write_jobs
  _run_harness
  _assert_code self-mod
}

@test "jobs-lint: hostile 16 rejects a credential looking value anywhere in the file" {
  _valid_job_body | sed 's|monthly_ceiling_inr: 0|monthly_ceiling_inr: 0\nnote: "token: ghp_abcdefghijklmnopqrstuvwxyz0123"|' | _write_jobs
  _run_harness
  _assert_code credential
}

@test "jobs-lint: hostile 17 rejects a schedule whose worst case month breaches the ceiling" {
  cat > "$JOBS" <<'EOF'
version: 1
monthly_ceiling_inr: 100
defaults:
  catchup: skip
jobs:
  - name: pricey
    type: process
    entry: kickoff-plan
    budget:
      min: 2
      inr: 50
    policy_kind: process:ok-job
    cadence: daily@09:00
    enabled: true
EOF
  [ -s "$JOBS" ] || { echo "empty fixture"; false; }
  _run_harness
  _assert_code ceiling-breach
}

@test "jobs-lint: hostile 18 rejects a non empty flow collection the frozen subset excludes" {
  _valid_job_body | sed 's|    budget:|    budget: { min: 2 }|; /^      min: 2$/d' | _write_jobs
  _run_harness
  _assert_code parse
}

@test "jobs-lint: hostile 19 rejects a schema version that is not 1" {
  _valid_job_body | sed 's|^version: 1$|version: 2|' | _write_jobs
  _run_harness
  _assert_code version
}

@test "jobs-lint: hostile 20 rejects a non boolean enabled" {
  _valid_job_body | sed 's|enabled: true|enabled: "yes"|' | _write_jobs
  _run_harness
  _assert_code enabled
}

@test "jobs-lint: hostile 21 rejects an unknown catchup value" {
  _valid_job_body | sed 's|    enabled: true|    enabled: true\n    catchup: maybe|' | _write_jobs
  _run_harness
  _assert_code catchup
}

@test "jobs-lint: hostile 22 rejects a type outside script and process" {
  _valid_job_body | sed 's|type: script|type: daemon|' | _write_jobs
  _run_harness
  _assert_code type
}

# --- the ceiling arithmetic is the ceiling, not an average -------------------------------
@test "jobs-lint: bill charges a daily job for 31 slots and a weekdays job for 23" {
  cat > "$JOBS" <<'EOF'
version: 1
monthly_ceiling_inr: 100000
defaults:
  catchup: skip
jobs:
  - name: every-day
    type: process
    entry: kickoff-plan
    budget:
      min: 2
      inr: 100
    policy_kind: process:ok-job
    cadence: daily@09:00
    enabled: true
  - name: work-days
    type: process
    entry: kickoff-plan
    budget:
      min: 2
      inr: 100
    policy_kind: process:ok-job
    cadence: weekdays@09:00
    enabled: true
EOF
  [ -s "$JOBS" ] || { echo "empty fixture"; false; }
  _run_harness
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  echo "$output" | grep -q "HARNESS-DONE" || { echo "harness never finished"; false; }
  # 100 x 31 + 100 x 23 = 5400. Asserting the NUMBER, not merely that a bill was printed:
  # a bill that silently charged an average would still print a line.
  echo "$output" | grep -q "^BILL:5400\$" || { echo "wanted BILL:5400, got:"; echo "$output"; false; }
}

# --- the disabled job still has to be legal ----------------------------------------------
@test "jobs-lint: a disabled job is still linted, because it can be re-enabled by one edit" {
  _valid_job_body | sed 's|enabled: true|enabled: false|; s|cadence: daily@00:15|cadence: hourly@00:15|' | _write_jobs
  _run_harness
  _assert_code cadence
}

# --- CLI end to end, against the REAL yaml subset and the REAL policy file ----------------
@test "jobs-lint CLI: the committed hq.jobs.yaml parses under the frozen subset" {
  run node "$LINT" --json
  # Exit 2 is expected until the owner applies the policy rows; what this asserts is that the
  # file PARSES and that no finding is a parse or schema-shape failure. A parse failure would
  # short-circuit the linter and return exactly one finding.
  [ "$status" -eq 0 ] || [ "$status" -eq 2 ] || { echo "unexpected exit $status"; echo "$output"; false; }
  echo "$output" | grep -q '"findings"' || { echo "no json findings block:"; echo "$output"; false; }
  echo "$output" | grep -q '"code": "parse"' && { echo "hq.jobs.yaml does not parse:"; echo "$output"; false; }
  echo "$output" | grep -q '"code": "version"' && { echo "hq.jobs.yaml has a bad version:"; echo "$output"; false; }
  true
}

@test "jobs-lint CLI: refuses to run at all when there is no schedule file" {
  run node "$LINT" --file "$BATS_TEST_TMPDIR/absent.yaml"
  # Exit 1, not 2. "This schedule is illegal" and "I could not tell" are different answers, and
  # collapsing them lets a broken checkout read as a clean one.
  [ "$status" -eq 1 ] || { echo "wanted exit 1, got $status"; echo "$output"; false; }
}

# --- the suite asserts its own size ------------------------------------------------------
# A suite running fewer tests than it declares is indistinguishable from a suite that passes:
# bats silently DROPS a @test whose name carries a non-ASCII character, and Cycle 7 lost five
# tests that way with a green file. This fails when the registered total moves unnoticed.
@test "jobs-lint: this suite registers exactly 28 tests" {
  run bash -c "grep -c '^@test ' '$BATS_TEST_FILENAME'"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" -eq 28 ] || { echo "test count moved: declared 28, found $output"; false; }
}
