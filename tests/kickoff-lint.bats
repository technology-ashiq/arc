#!/usr/bin/env bats
# kickoff-lint v3 — [tier] [adr] [spike] [phase-deps] check groups + grandfather behavior.
# Fixture: tests/fixtures/kickoff-lint/good (complete v3 plan; mutations applied per test).

LINT_CMD="node .claude/scripts/kickoff-lint.mjs"
FIXTURE="tests/fixtures/kickoff-lint/good"

setup() {
  TMP="$BATS_TEST_TMPDIR/fix"
  cp -r "$FIXTURE" "$TMP"
}

@test "good v3 fixture passes" {
  run $LINT_CMD "$TMP"
  [ "$status" -eq 0 ]
}

@test "[tier] S tier with 6 active REQs fails cap" {
  sed -i 's/^\*\*Tier:\*\* M$/**Tier:** S/' "$TMP/PLAN.md"
  for i in 3 4 5 6; do
    sed -i "/| REQ-02 /a | REQ-0$i | outcome $i | check $i returns 200 in < 300ms | 1 | active |" "$TMP/PLAN.md"
  done
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]
  [[ "$output" == *"[tier]"* ]]
}

@test "[tier] placeholder 'S | M | L' fails" {
  sed -i 's/^\*\*Tier:\*\* M$/**Tier:** S | M | L/' "$TMP/PLAN.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]
  [[ "$output" == *"[tier]"* ]]
}

@test "[adr] missing Reversibility fails on v3 plan" {
  sed -i '/^\*\*Reversibility:\*\*/d' "$TMP/docs/adr/0001-postgres-over-sqlite.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]
  [[ "$output" == *"[adr]"* ]]
}

@test "[adr] one-way without real Revisit trigger fails" {
  sed -i 's/^\*\*Revisit trigger:\*\*.*/**Revisit trigger:** <condition>/' "$TMP/docs/adr/0001-postgres-over-sqlite.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]
  [[ "$output" == *"[adr]"* ]]
}

@test "[phase-deps] self-cycle fails" {
  sed -i 's/^\*\*Depends on:\*\* phase-00$/**Depends on:** phase-01/' "$TMP/phases/phase-01-spec.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]
  [[ "$output" == *"[phase-deps]"* ]]
  [[ "$output" == *"cycle"* ]]
}

@test "[phase-deps] dependency on nonexistent phase fails" {
  sed -i 's/^\*\*Depends on:\*\* phase-00$/**Depends on:** phase-07/' "$TMP/phases/phase-01-spec.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]
  [[ "$output" == *"[phase-deps]"* ]]
}

@test "[spike] DEFERRED ADR without spike task in phase-00 fails" {
  sed -i 's/^\*\*Status:\*\*.*/**Status:** DEFERRED — spike scheduled/' "$TMP/docs/adr/0001-postgres-over-sqlite.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]
  [[ "$output" == *"[spike]"* ]]
}

@test "[spike] DEFERRED ADR with referenced spike task passes" {
  sed -i 's/^\*\*Status:\*\*.*/**Status:** DEFERRED — spike scheduled/' "$TMP/docs/adr/0001-postgres-over-sqlite.md"
  sed -i '/^## Exit criteria/i **Spike (ADR 0001):** is Postgres free tier enough — timebox ½ day, evidence: p95 latency numbers. Spike code quarantined in spike/.\n' "$TMP/phases/phase-00-spec.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 0 ]
}

@test "grandfather: pre-v3 plan (no Tier line) warns but passes" {
  sed -i '/^\*\*Tier:\*\* M$/d' "$TMP/PLAN.md"
  sed -i '/^\*\*Depends on:\*\*/d' "$TMP/phases/phase-00-spec.md" "$TMP/phases/phase-01-spec.md"
  sed -i '/^\*\*Reversibility:\*\*/d;/^\*\*Revisit trigger:\*\*/d' "$TMP/docs/adr/0001-postgres-over-sqlite.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 0 ]
  [[ "$output" == *"WARN"* ]]
  [[ "$output" == *"pre-dates kickoff v3"* ]]
}
