#!/usr/bin/env bats
# kickoff-lint suite — Rounds 1–4 checks (G1 backfill), v3 groups, v3.5 substance groups.
# Fixture: tests/fixtures/kickoff-lint/good (complete v3 plan; per-test mutations).
# v3.5 substance groups run WARN-first ([trial]) — their tests assert WARN + exit 0.
# PORTABILITY: macOS CI leg = BSD userland (ci.yml/ADR-0007). No GNU-only sed here:
# in-place edits go through sedi() (-i.bak works on GNU *and* BSD), row inserts go
# through addrow() (POSIX awk; BSD sed's a\/i\ syntax differs from GNU's inline form).

LINT_CMD="node .claude/scripts/kickoff-lint.mjs"
FIXTURE="tests/fixtures/kickoff-lint/good"

setup() {
  TMP="$BATS_TEST_TMPDIR/fix"
  cp -r "$FIXTURE" "$TMP"
}

# Portable in-place sed: BSD needs a suffix after -i; `-i.bak` (no space) satisfies both.
sedi() {
  local f="${!#}"
  sed -i.bak "$@" && rm -f "${f}.bak"
}

# Insert ROW after the first line containing PAT (plain substring, no regex traps).
addrow() {
  local pat="$1" row="$2" f="$3"
  awk -v pat="$pat" -v row="$row" '{ print } !done && index($0, pat) { print row; done=1 }' \
    "$f" > "$f.tmp" && mv "$f.tmp" "$f"
}

# ---------- baseline ----------

@test "good v3 fixture passes with zero trial warnings" {
  run $LINT_CMD "$TMP"
  [ "$status" -eq 0 ]
  [[ "$output" != *"[trial]"* ]]
}

# ---------- v3 groups (Round 5) ----------

@test "[tier] S tier with 6 active REQs fails cap" {
  sedi 's/^\*\*Tier:\*\* M$/**Tier:** S/' "$TMP/PLAN.md"
  for i in 3 4 5 6; do
    addrow "| REQ-02 " "| REQ-0$i | outcome $i | check $i returns 200 in < 300ms | 1 | active |" "$TMP/PLAN.md"
  done
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"[tier]"* ]]
}

@test "[tier] placeholder 'S | M | L' fails" {
  sedi 's/^\*\*Tier:\*\* M$/**Tier:** S | M | L/' "$TMP/PLAN.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"[tier]"* ]]
}

@test "[adr] missing Reversibility fails on v3 plan" {
  sedi '/^\*\*Reversibility:\*\*/d' "$TMP/docs/adr/0001-postgres-over-sqlite.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"[adr]"* ]]
}

@test "[adr] one-way without real Revisit trigger fails" {
  sedi 's/^\*\*Revisit trigger:\*\*.*/**Revisit trigger:** <condition>/' "$TMP/docs/adr/0001-postgres-over-sqlite.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"[adr]"* ]]
}

@test "[phase-deps] self-cycle fails" {
  sedi 's/^\*\*Depends on:\*\* phase-00$/**Depends on:** phase-01/' "$TMP/phases/phase-01-spec.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"cycle"* ]]
}

@test "[phase-deps] dependency on nonexistent phase fails" {
  sedi 's/^\*\*Depends on:\*\* phase-00$/**Depends on:** phase-07/' "$TMP/phases/phase-01-spec.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"[phase-deps]"* ]]
}

@test "[spike] DEFERRED ADR without spike task fails" {
  sedi 's/^\*\*Status:\*\*.*/**Status:** DEFERRED — spike scheduled/' "$TMP/docs/adr/0001-postgres-over-sqlite.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"[spike]"* ]]
}

@test "[spike] DEFERRED ADR with referenced spike task passes" {
  sedi 's/^\*\*Status:\*\*.*/**Status:** DEFERRED — spike scheduled/' "$TMP/docs/adr/0001-postgres-over-sqlite.md"
  printf '\n**Spike (ADR 0001):** is Postgres free tier enough — timebox half day, evidence: p95 numbers. Code quarantined in spike/.\n' >> "$TMP/phases/phase-00-spec.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 0 ]
}

@test "grandfather: pre-v3 plan warns but passes" {
  sedi '/^\*\*Tier:\*\* M$/d' "$TMP/PLAN.md"
  sedi '/^\*\*Depends on:\*\*/d' "$TMP/phases/phase-00-spec.md"
  sedi '/^\*\*Depends on:\*\*/d' "$TMP/phases/phase-01-spec.md"
  sedi '/^\*\*Reversibility:\*\*/d' "$TMP/docs/adr/0001-postgres-over-sqlite.md"
  sedi '/^\*\*Revisit trigger:\*\*/d' "$TMP/docs/adr/0001-postgres-over-sqlite.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 0 ]
  [[ "$output" == *"pre-dates kickoff v3"* ]]
}

# ---------- Rounds 1–4 checks (v3.5 G1 backfill) ----------

@test "[vague] vague acceptance without verifiable token fails" {
  sedi 's#^| REQ-01 |.*#| REQ-01 | Visitor sees the page | works properly and fast | 1 | active |#' "$TMP/PLAN.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"[vague]"* ]]
}

@test "[vague] vague word next to verifiable token passes with warn" {
  sedi 's#^| REQ-01 |.*#| REQ-01 | Visitor sees the page | seamless UX with `GET /` under 200ms | 1 | active |#' "$TMP/PLAN.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 0 ]; [[ "$output" == *"WARN"*"[vague]"* ]]
}

@test "[tier] 11 active REQs on tier M fails cap" {
  for i in 03 04 05 06 07 08 09 10 11; do
    addrow "| REQ-02 " "| REQ-$i | outcome $i | check $i returns 200 in < 300ms | 1 | active |" "$TMP/PLAN.md"
  done
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"cap for tier M is 10"* ]]
}

@test "[reqs] REQ mapped to nonexistent phase fails" {
  sedi 's#^| REQ-01 |\(.*\)| 1 | active |#| REQ-01 |\1| 9 | active |#' "$TMP/PLAN.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"phase 9 which doesn't exist"* ]]
}

@test "[reqs] bad status enum fails" {
  sedi 's#^| REQ-01 |\(.*\)| active |#| REQ-01 |\1| pending |#' "$TMP/PLAN.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"must be active | validated | dropped"* ]]
}

@test "[reqs] G4: REQ mapped to two phases fails" {
  sedi 's#^| REQ-01 |\(.*\)| 1 | active |#| REQ-01 |\1| 1, 3 | active |#' "$TMP/PLAN.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"exactly one phase"* ]]
}

@test "[assumptions] row without falsification trigger fails" {
  sedi 's#| p95 query > 200ms or storage > 500MB |#| tbd |#' "$TMP/PLAN.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"[assumptions]"* ]]
}

@test "[assumptions] 8 entries breaks cap 7" {
  for i in 2 3 4 5 6 7 8; do
    addrow "| Free tier DB is enough " "| Assumption $i | metric $i exceeds ${i}00ms threshold | 1 |" "$TMP/PLAN.md"
  done
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"hard cap is 7"* ]]
}

@test "[pre-mortem] 4 rows fails (need 5)" {
  sedi '/^| 5 | Contract tests drift/d' "$TMP/PLAN.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"[pre-mortem]"*"need top 5"* ]]
}

@test "[pre-mortem] row without mitigation fails" {
  sedi 's#| Real-impl pass required before phase 1 closes |#|  |#' "$TMP/PLAN.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"no mitigation"* ]]
}

@test "[deps] empty column in external dependencies fails" {
  sedi 's#| lib/db.fake.ts |#|  |#' "$TMP/PLAN.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"[deps]"*"fake impl"* ]]
}

@test "[kill-criteria] missing tripwire line fails" {
  sedi 's/blown appetite means cut or kill/blown appetite means stop/' "$TMP/PLAN.md"
  sedi '/^\*\*Kill criteria:\*\*/d' "$TMP/PLAN.md"
  sedi '/^conversation\. At 100%/d' "$TMP/PLAN.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"[kill-criteria]"* ]]
}

@test "[progress] missing '## Now' fails" {
  sedi 's/^## Now$/## Later/' "$TMP/PROGRESS.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"[progress]"* ]]
}

@test "[adr] index row without file fails" {
  rm "$TMP/docs/adr/0001-postgres-over-sqlite.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"not found"* ]]
}

@test "[phases] missing phase spec file fails" {
  rm "$TMP/phases/phase-01-spec.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"phase-01-spec.md missing"* ]]
}

@test "[phase0] no phase zero fails" {
  sedi '/^| 0 | Steel thread/d' "$TMP/PLAN.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"[phase0]"* ]]
}

# ---------- v3.5 substance groups (WARN-first trial) ----------

@test "[pre-mortem-cite] generic pre-mortem warns (trial), still exits 0" {
  sedi 's#^| 4 | Appetite blown silently |.*#| 4 | Team gets busy | Watch it carefully |#' "$TMP/PLAN.md"
  sedi 's#^| 5 | Contract tests drift from real impl |.*#| 5 | Things break | Be careful |#' "$TMP/PLAN.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 0 ]; [[ "$output" == *"[pre-mortem-cite]"*"[trial]"* ]]
}

@test "[appetite-sum] phase appetites over total warns (trial)" {
  sedi 's/^\*\*Appetite:\*\* 3 days$/**Appetite:** 3 weeks/' "$TMP/phases/phase-01-spec.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 0 ]; [[ "$output" == *"[appetite-sum]"*"over-commits"* ]]
}

@test "[appetite-sum] unparseable PLAN appetite warns, never fails" {
  sedi 's/^2 weeks part-time\..*/Two sprints, part-time — a constraint, not an estimate./' "$TMP/PLAN.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 0 ]; [[ "$output" == *"arithmetic skipped"* ]]
}

@test "[architecture] C4Context syntax warns (trial)" {
  sedi 's/flowchart TB/C4Context/' "$TMP/PLAN.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 0 ]; [[ "$output" == *"[architecture]"* ]]
}

@test "[adr-wired] orphan ADR warns (trial)" {
  sedi 's/ (ADR 0001)//' "$TMP/phases/phase-01-spec.md"
  sedi 's/ADR 0001 names the fallback/the fallback is named/' "$TMP/PLAN.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 0 ]; [[ "$output" == *"[adr-wired]"*"never consumed"* ]]
}

@test "[adr-confidence] low-confidence ADR without assumption row warns (trial)" {
  printf '\n**Evidence:** registry + docs checked\n**Confidence:** low\n' >> "$TMP/docs/adr/0001-postgres-over-sqlite.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 0 ]; [[ "$output" == *"[adr-confidence]"* ]]
}

@test "[current-state-structure] unstructured Current state warns (trial)" {
  printf '\n## Current state\n\nSome legacy notes about an old express app that needs love and care here.\n' >> "$TMP/PLAN.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 0 ]; [[ "$output" == *"[current-state-structure]"* ]]
}

@test "[nonneg-drift] drifted verbatim block warns (trial)" {
  sedi 's/^- CI green before merge$/- CI green before merging/' "$TMP/phases/phase-01-spec.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 0 ]; [[ "$output" == *"[nonneg-drift]"*"drifted"* ]]
}

@test "[nonneg-drift] missing verbatim block warns (trial)" {
  sedi '/## Non-negotiables (verbatim from PLAN)/,$d' "$TMP/phases/phase-00-spec.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 0 ]; [[ "$output" == *"[nonneg-drift]"*"missing"* ]]
}

@test "[verify-red] phase-0 without expected-fail-first warns (trial)" {
  sedi '/^- \*\*Expected failure first:\*\*/d' "$TMP/phases/phase-00-spec.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 0 ]; [[ "$output" == *"[verify-red]"*"[trial]"* ]]
}

@test "[verify-red] detailed phase-1 without red-first warns (trial)" {
  sedi 's#^One coarse line.*#- **Test command:** `npm test -- health`#' "$TMP/phases/phase-01-spec.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 0 ]; [[ "$output" == *"[verify-red]"*"[trial]"* ]]
}
