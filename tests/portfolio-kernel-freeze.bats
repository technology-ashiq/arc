#!/usr/bin/env bats
# Kernel freeze in kickoff-lint — portfolio Cycle 5, Phase 04, REQ-06 (ADR-0076, ADR-0077).
#
# A new cycle (the lane is LIVE and its PROGRESS `cycle:` identity differs from the base ref's) on a
# lane the owner's `kernel freeze:` ruling does not exempt is refused, printing the ruling's ULID. The
# exempt list is read from the ruling's own words, so every case writes its own ruling into a fixture
# spine (ARC_SPINE_ROOT) and nothing here depends on the live spine or on today's lanes.
#
# Every case asserts the lint RAN (the lane echo is its first line) before asserting what it decided,
# and every case where the gate stays silent carries a positive control in the same fixture: silence
# is only evidence once the same gate has been seen to speak.
bats_require_minimum_version 1.5.0
load 'test_helper'

LINT="$ARC_ROOT/.claude/scripts/plan/kickoff-lint.mjs"
FIXTURE="$ARC_ROOT/tests/fixtures/kickoff-lint/good"
RULING_ID="01M4VP8AMYJPMT1MZNQRB0FYY6"
STD_WHAT='kernel freeze: no /arc-kickoff on a kernel lane until revenue.received >= 1 on the canonical spine; launch, leads, growth, portfolio, engine (metered runs only) and distribute Cycle 3 are exempt; ventures are out of scope.'

teardown() { _arc_teardown; }

# _lane NAME STATUS CYCLE — a lane holding the good fixture's plan under a machine header.
_lane() {
  local d="$SANDBOX/initiatives/$1"
  mkdir -p "$d"
  cp "$FIXTURE/PLAN.md" "$d/"
  cp -r "$FIXTURE/phases" "$d/"
  printf 'status: %s\ncycle: %s\nphase: 00\nappetite: 3d\nburn: 0d\n\n%s\n' "$2" "$3" "$(cat "$FIXTURE/PROGRESS.md")" > "$d/PROGRESS.md"
}

# _set_cycle NAME CYCLE — rewrite the lane's header `cycle:` line in place (portable: no sed -i).
_set_cycle() {
  local f="$SANDBOX/initiatives/$1/PROGRESS.md"
  awk -v c="$2" 'BEGIN{done=0} !done && /^cycle:/ {print "cycle: " c; done=1; next} {print}' "$f" > "$f.tmp" && mv "$f.tmp" "$f"
}

# A repo whose base branch holds every lane at Cycle 1; the working tree is where a test opens a cycle.
_repo() {
  _arc_lane_sandbox
  cp -r "$FIXTURE/docs" "$SANDBOX/docs"
  local l
  for l in "$@"; do _lane "$l" LIVE "arc-$l (Cycle 1, opened 2026-10-01)"; done
  git add -A && git commit -qm base && git branch -q base
  SPINE="$BATS_TEST_TMPDIR/spine"
  mkdir -p "$SPINE/events"
  export ARC_SPINE_ROOT="$SPINE"
}

# _ev JSON — append one receipt to the fixture spine's day file.
_ev() { printf '%s\n' "$1" >> "$SPINE/events/2026-10-14.jsonl"; }

_ruling() { # _ruling ID WHAT [SUPERSEDES]
  local sup="null"; [ -n "${3:-}" ] && sup="\"$3\""
  _ev "{\"id\":\"$1\",\"kind\":\"approval.requested\",\"ts\":\"2026-10-14T04:01:13+05:30\",\"supersedes\":$sup,\"payload\":{\"gate\":\"owner-ruling\",\"what\":\"$2\"}}"
}
_decide() { _ev "{\"id\":\"$1\",\"kind\":\"decision.recorded\",\"ts\":\"2026-10-14T04:11:00+05:30\",\"supersedes\":null,\"payload\":{\"decides\":\"$2\",\"verdict\":\"$3\",\"reason\":\"r\"}}"; }

_lint() { run node "$LINT" "$SANDBOX" --lane "$1" --base base; }
_ran() { [ "$(printf '%s\n' "$output" | head -n1)" = "Selected lane: $1 (via arg)" ]; }

# ---------- refusal ----------

@test "freeze: a new cycle on a non-exempt lane is refused and the ruling's ULID is printed" {
  _repo memory
  _ruling "$RULING_ID" "$STD_WHAT"
  _set_cycle memory "arc-memory (Cycle 2, opened 2026-10-14)"
  _lint memory
  _ran memory
  [ "$status" -eq 1 ]
  [[ "$output" == *"FAIL  [kernel-freeze] lane memory is frozen by owner ruling $RULING_ID"* ]]
  [[ "$output" == *"revenue.received >= 1 (now 0)"* ]]
}

@test "freeze: an approved ruling still stands (only a decision AGAINST it lifts it)" {
  _repo memory
  _ruling "$RULING_ID" "$STD_WHAT"
  _decide 01M4VPVKGNX9DMNWFEEZ57ZGJX "$RULING_ID" approve
  _set_cycle memory "arc-memory (Cycle 2)"
  _lint memory
  _ran memory
  [ "$status" -eq 1 ]
  [[ "$output" == *"[kernel-freeze] lane memory is frozen by owner ruling $RULING_ID"* ]]
}

# ---------- exemptions come from the ruling, never from code ----------

@test "freeze: an exempt lane passes, and the same fixture refuses a lane the ruling does not name" {
  _repo portfolio memory
  _ruling "$RULING_ID" "$STD_WHAT"
  _set_cycle portfolio "arc-portfolio (Cycle 2)"
  _set_cycle memory "arc-memory (Cycle 2)"
  _lint portfolio
  _ran portfolio
  [ "$status" -eq 0 ]
  [[ "$output" != *"[kernel-freeze]"* ]]
  _lint memory
  _ran memory
  [ "$status" -eq 1 ]
  [[ "$output" == *"[kernel-freeze] lane memory"* ]]
}

@test "freeze: drop portfolio from the ruling's list and portfolio is refused -- nothing is hardcoded" {
  _repo portfolio
  _ruling "$RULING_ID" 'kernel freeze: no /arc-kickoff on a kernel lane until revenue.received >= 1; launch, leads and growth are exempt'
  _set_cycle portfolio "arc-portfolio (Cycle 2)"
  _lint portfolio
  _ran portfolio
  [ "$status" -eq 1 ]
  [[ "$output" == *"[kernel-freeze] lane portfolio is frozen by owner ruling $RULING_ID"* ]]
}

@test "freeze: 'distribute Cycle 3' exempts Cycle 3 and refuses Cycle 4" {
  _repo distribute
  _ruling "$RULING_ID" "$STD_WHAT"
  _set_cycle distribute "arc-distribute (Cycle 3, opened 2026-10-14)"
  _lint distribute
  _ran distribute
  [ "$status" -eq 0 ]
  [[ "$output" != *"[kernel-freeze]"* ]]
  _set_cycle distribute "arc-distribute (Cycle 4, opened 2026-10-20)"
  _lint distribute
  _ran distribute
  [ "$status" -eq 1 ]
  [[ "$output" == *"exempt only for Cycle 3; this is cycle 4"* ]]
}

@test "freeze: 'engine (metered runs only)' exempts and prints the condition for a human" {
  _repo engine
  _ruling "$RULING_ID" "$STD_WHAT"
  _set_cycle engine "arc-engine (Cycle 2)"
  _lint engine
  _ran engine
  [ "$status" -eq 0 ]
  [[ "$output" == *"WARN  [kernel-freeze] lane engine is exempt from owner ruling $RULING_ID only for: metered runs only"* ]]
}

# ---------- what lifts it ----------

@test "freeze: a reject decision lifts it (positive control: the same ruling refuses before the decision)" {
  _repo memory
  _ruling "$RULING_ID" "$STD_WHAT"
  _set_cycle memory "arc-memory (Cycle 2)"
  _lint memory
  [ "$status" -eq 1 ]
  _decide 01M4VPVKGNX9DMNWFEEZ57ZGJX "$RULING_ID" reject
  _lint memory
  _ran memory
  [ "$status" -eq 0 ]
  [[ "$output" != *"[kernel-freeze]"* ]]
}

@test "freeze: a later owner-ruling whose supersedes names it lifts it" {
  _repo memory
  _ruling "$RULING_ID" "$STD_WHAT"
  _set_cycle memory "arc-memory (Cycle 2)"
  _lint memory
  [ "$status" -eq 1 ]
  _ruling 01M4VQ0000000000000000000A 'lift the kernel freeze' "$RULING_ID"
  _lint memory
  _ran memory
  [ "$status" -eq 0 ]
  [[ "$output" != *"[kernel-freeze]"* ]]
}

@test "freeze: a superseding ruling that is itself a freeze replaces the old exempt list" {
  _repo memory
  _ruling "$RULING_ID" "$STD_WHAT"
  _ruling 01M4VQ0000000000000000000B 'kernel freeze: no kickoff on a kernel lane; memory and launch are exempt' "$RULING_ID"
  _set_cycle memory "arc-memory (Cycle 2)"
  _lint memory
  _ran memory
  [ "$status" -eq 0 ]
  [[ "$output" != *"[kernel-freeze]"* ]]
}

@test "freeze: one real revenue.received lifts it; revenue.simulated and a rehearsal receipt do not" {
  _repo memory
  _ruling "$RULING_ID" "$STD_WHAT"
  _set_cycle memory "arc-memory (Cycle 2)"
  _ev '{"id":"01M4VQ0000000000000000000C","kind":"revenue.simulated","ts":"2026-10-14T05:00:00+05:30","supersedes":null,"payload":{"amount":49900,"currency":"INR"}}'
  _ev '{"id":"01M4VQ0000000000000000000D","kind":"revenue.received","ts":"2026-10-14T05:00:00+05:30","supersedes":null,"payload":{"amount":49900,"currency":"INR","rehearsal":true}}'
  _ev '{"id":"01M4VQ0000000000000000000E","kind":"revenue.received","ts":"2026-10-14T05:00:00+05:30","supersedes":null,"payload":{"amount":49900,"currency":"INR","livemode":false}}'
  _lint memory
  _ran memory
  [ "$status" -eq 1 ]
  [[ "$output" == *"revenue.received >= 1 (now 0)"* ]]
  _ev '{"id":"01M4VQ0000000000000000000F","kind":"revenue.received","ts":"2026-10-14T06:00:00+05:30","supersedes":null,"payload":{"amount":49900,"currency":"INR"}}'
  _lint memory
  _ran memory
  [ "$status" -eq 0 ]
  [[ "$output" != *"[kernel-freeze]"* ]]
}

# ---------- fail closed ----------

@test "freeze: an exempt clause the grammar cannot read refuses EVERY lane, naming the ULID" {
  _repo launch
  _ruling "$RULING_ID" 'kernel freeze: no kickoff on a kernel lane; launch, and maybe growth are exempt'
  _set_cycle launch "arc-launch (Cycle 2)"
  _lint launch
  _ran launch
  [ "$status" -eq 1 ]
  [[ "$output" == *"[kernel-freeze] owner ruling $RULING_ID stands but cannot be read"* ]]
}

@test "freeze: a freeze with no exempt clause at all refuses rather than exempting nobody silently" {
  _repo launch
  _ruling "$RULING_ID" 'kernel freeze: no kickoff on any lane'
  _set_cycle launch "arc-launch (Cycle 2)"
  _lint launch
  _ran launch
  [ "$status" -eq 1 ]
  [[ "$output" == *"cannot be read (no \`<list> are exempt\` clause)"* ]]
}

@test "freeze: grammar variants (case, Oxford comma, trailing period, 'is exempt') read the same" {
  _repo memory launch
  _ruling "$RULING_ID" 'Kernel Freeze: no kickoff on a kernel lane until revenue.received >= 1;  Launch,  growth, and memory Are exempt.'
  _set_cycle memory "arc-memory (Cycle 2)"
  _lint memory
  _ran memory
  [ "$status" -eq 0 ]
  [[ "$output" != *"[kernel-freeze]"* ]]
  : > "$SPINE/events/2026-10-14.jsonl"
  _ruling "$RULING_ID" 'kernel freeze: no kickoff on a kernel lane; growth is exempt'
  _lint memory
  _ran memory
  [ "$status" -eq 1 ]
  [[ "$output" == *"[kernel-freeze] lane memory is frozen"* ]]
}

# ---------- only a NEW cycle is judged (ADR-0076) ----------

@test "freeze: a lane mid-cycle (cycle identity unchanged against the base) is never refused" {
  _repo memory launch
  _ruling "$RULING_ID" "$STD_WHAT"
  _set_cycle memory "arc-memory (Cycle 1, opened 2026-10-01, amended typo)"
  _lint memory
  _ran memory
  [ "$status" -eq 0 ]
  [[ "$output" != *"[kernel-freeze]"* ]]
  _set_cycle memory "arc-memory (Cycle 2, opened 2026-10-14)"
  _lint memory
  [ "$status" -eq 1 ]
  [[ "$output" == *"[kernel-freeze] lane memory"* ]]
}

@test "freeze: a lane that is not LIVE is never judged, whatever its cycle line says" {
  _repo memory
  _ruling "$RULING_ID" "$STD_WHAT"
  _set_cycle memory "arc-memory (Cycle 2)"
  local f="$SANDBOX/initiatives/memory/PROGRESS.md"
  awk '!d && /^status:/ {print "status: IDLE"; d=1; next} {print}' "$f" > "$f.tmp" && mv "$f.tmp" "$f"
  _lint memory
  _ran memory
  [[ "$output" != *"[kernel-freeze]"* ]]
}

@test "freeze: a lane born on this branch (absent at the base) is a new cycle" {
  _repo launch
  _ruling "$RULING_ID" "$STD_WHAT"
  _lane memory LIVE "arc-memory (Cycle 1)"
  _lint memory
  _ran memory
  [ "$status" -eq 1 ]
  [[ "$output" == *"[kernel-freeze] lane memory"* ]]
}

# ---------- what the gate cannot see, it says ----------

@test "freeze: an unresolvable base ref is a named WARN and the gate does not run" {
  _repo memory
  _ruling "$RULING_ID" "$STD_WHAT"
  _set_cycle memory "arc-memory (Cycle 2)"
  run node "$LINT" "$SANDBOX" --lane memory --base no-such-ref
  _ran memory
  [[ "$output" == *"WARN  [new-cycle-unknown] base ref \`no-such-ref\` does not resolve"* ]]
  [[ "$output" != *"FAIL  [kernel-freeze]"* ]]
}

@test "freeze: no spine is a named WARN, never a silent pass" {
  _repo memory
  rm -rf "$SPINE"
  _set_cycle memory "arc-memory (Cycle 2)"
  _lint memory
  _ran memory
  [ "$status" -eq 0 ]
  [[ "$output" == *"WARN  [kernel-freeze-unread] no spine at"* ]]
}

@test "freeze: from a linked worktree the main clone's spine is read" {
  _repo memory
  unset ARC_SPINE_ROOT
  mkdir -p "$SANDBOX/.claude/state/hq/events"
  SPINE="$SANDBOX/.claude/state/hq"
  _ruling "$RULING_ID" "$STD_WHAT"
  local wt="$BATS_TEST_TMPDIR/wt"
  git -C "$SANDBOX" worktree add -q "$wt" -b feat/x base
  awk '!d && /^cycle:/ {print "cycle: arc-memory (Cycle 2)"; d=1; next} {print}' "$wt/initiatives/memory/PROGRESS.md" > "$wt/p.tmp" && mv "$wt/p.tmp" "$wt/initiatives/memory/PROGRESS.md"
  [ ! -d "$wt/.claude/state/hq/events" ]
  run node "$LINT" "$wt" --lane memory --base base
  _ran memory
  [ "$status" -eq 1 ]
  [[ "$output" == *"[kernel-freeze] lane memory is frozen by owner ruling $RULING_ID"* ]]
}

@test "freeze: --base is consumed as a flag and never read as the repo root" {
  _repo memory
  _ruling "$RULING_ID" "$STD_WHAT"
  _set_cycle memory "arc-memory (Cycle 2)"
  cd "$SANDBOX"
  run node "$LINT" --base base --lane memory
  _ran memory
  [ "$status" -eq 1 ]
  [[ "$output" == *"[kernel-freeze] lane memory"* ]]
}

@test "freeze: this suite registers every case it declares (bats drops non-ASCII titles silently)" {
  n=$(grep -c '^@test ' "$BATS_TEST_FILENAME")
  [ "$n" -eq 21 ]
  [ "$BATS_TEST_NUMBER" -eq 21 ]
}
