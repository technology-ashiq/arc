#!/usr/bin/env bats
# distribute Cycle 2, Phase 05 -- receipts from a wrapped session name their harness and their proof (ADR-2020, REQ-12).
#
# arc-event.mjs stamps payload.harness from ARC_HARNESS and evidence from ARC_EVIDENCE. Unset, an emit must be
# byte-identical to the emitter before this change: the golden line below was sealed by origin/main's arc-event.mjs
# (140df0b6) with the same frozen clock and randomness, via --dry-run, which prints the sealed record and writes nothing.
# Each arm asserts the emitter RAN (exit 0 and one sealed line, or its named refusal) before reading fields.

bats_require_minimum_version 1.5.0
load 'test_helper'

native() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }

setup() {
  EMIT="$(native "$ARC_ROOT/.claude/scripts/hq/arc-event.mjs")"
  export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine"
  mkdir -p "$ARC_SPINE_ROOT"
  export ARC_SPINE_NOW="1791800000000" ARC_SPINE_RAND="00112233445566778899"
  unset ARC_HARNESS ARC_EVIDENCE ARC_MODEL ARC_SPINE_ACTOR ARC_RUN_ID ARC_VENTURE ARC_SPINE_PROCESS
  P='{"summary":"one line","files":1}'
}

dry() { run --separate-stderr node "$EMIT" emit commit.done --payload "$1" --dry-run; }
field() { printf '%s' "$output" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s.trim().split("\n").pop());const v=eval(process.argv[1]);process.stdout.write(v===null?"null":typeof v==="object"?JSON.stringify(v):String(v))})' "$1"; }

@test "distribute-harness-stamp: every test in the file is registered" {
  local declared
  declared=$(grep -c '^@test "distribute-harness-stamp: ' "$BATS_TEST_FILENAME")
  [ "$declared" -eq 6 ] || { echo "declared $declared, expected 6"; false; }
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "distribute-harness-stamp: unset, the sealed line is byte-identical to the emitter before ADR-2020" {
  dry "$P"
  [ "$status" -eq 0 ] && [ -n "$output" ] || { echo "status $status: $output $stderr"; false; }
  local golden
  golden="$(tr -d '\r' < "$ARC_ROOT/tests/fixtures/distribute/harness-stamp-unset.golden")"
  [ -n "$golden" ] || { echo "empty golden"; false; }
  [ "$(printf '%s' "$output" | tr -d '\r')" = "$golden" ] || { echo "got:  $output"; echo "want: $golden"; false; }
}

@test "distribute-harness-stamp: ARC_HARNESS and ARC_EVIDENCE stamp a payload that names neither" {
  export ARC_HARNESS=opencode ARC_EVIDENCE=initiatives/distribute/evidence/phase-05/transcripts/s.jsonl
  dry "$P"
  [ "$status" -eq 0 ] && [ -n "$output" ] || { echo "status $status: $output $stderr"; false; }
  [ "$(field 'j.payload.harness')" = "opencode" ] || { echo "$output"; false; }
  [ "$(field 'j.payload.summary')" = "one line" ] || { echo "the payload lost a field: $output"; false; }
  [ "$(field 'j.evidence')" = "initiatives/distribute/evidence/phase-05/transcripts/s.jsonl" ] || { echo "$output"; false; }
}

@test "distribute-harness-stamp: an explicit --evidence wins over ARC_EVIDENCE, and a matching harness passes" {
  export ARC_HARNESS=opencode ARC_EVIDENCE=a/env.jsonl
  run --separate-stderr node "$EMIT" emit commit.done --payload '{"summary":"x","harness":"opencode"}' --evidence b/flag.jsonl --dry-run
  [ "$status" -eq 0 ] && [ -n "$output" ] || { echo "status $status: $output $stderr"; false; }
  [ "$(field 'j.evidence')" = "b/flag.jsonl" ] && [ "$(field 'j.payload.harness')" = "opencode" ] || { echo "$output"; false; }
}

@test "distribute-harness-stamp: a payload naming another harness is refused, never overwritten" {
  export ARC_HARNESS=opencode
  dry '{"summary":"x","harness":"claude-code"}'
  [ "$status" -eq 2 ] || { echo "status $status: $output"; false; }
  printf '%s\n' "$stderr" | grep -q 'HARNESS_MISMATCH' || { echo "$stderr"; false; }
  [ -z "$output" ] || { echo "a refused emit printed a record: $output"; false; }
}

@test "distribute-harness-stamp: a malformed harness or evidence is refused by name" {
  local fails=""
  export ARC_HARNESS='Bad!'
  dry "$P"
  [ "$status" -eq 2 ] && printf '%s\n' "$stderr" | grep -q 'BAD_HARNESS' || fails="$fails|Bad!: status $status [$stderr]"
  export ARC_HARNESS=opencode
  dry '[1,2]'
  [ "$status" -eq 2 ] && printf '%s\n' "$stderr" | grep -q 'BAD_HARNESS' || fails="$fails|array payload: status $status [$stderr]"
  export ARC_EVIDENCE=/abs/path.jsonl
  dry "$P"
  [ "$status" -eq 2 ] && printf '%s\n' "$stderr" | grep -q 'BAD_EVIDENCE' || fails="$fails|absolute evidence: status $status [$stderr]"
  export ARC_EVIDENCE=a/../b.jsonl
  dry "$P"
  [ "$status" -eq 2 ] && printf '%s\n' "$stderr" | grep -q 'BAD_EVIDENCE' || fails="$fails|traversal evidence: status $status [$stderr]"
  [ -z "$fails" ] || { echo "$fails" | tr '|' '\n'; false; }
}
