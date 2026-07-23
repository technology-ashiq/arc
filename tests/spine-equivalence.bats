#!/usr/bin/env bats
# Phase 00 ckpt B -- the sqlite-vs-scan equivalence gate (ADR-0024).
#
# node:sqlite is an OPTIONAL accelerator and is only allowed to stay optional while it is
# provably indistinguishable from the canonical JSONL scan. This gate runs the same reads
# through both engines and requires byte-identical output; the empty diff is the artifact.
#
# On Node < 22 there is no node:sqlite, so the sqlite half skips VISIBLY rather than
# passing quietly -- a gate that reports success on a runner where it never ran is worse
# than no gate.
bats_require_minimum_version 1.5.0
load 'test_helper'

HQ="$ARC_ROOT/.claude/scripts/hq"
EVENT="$HQ/arc-event.sh"

setup() {
  SPINE="$BATS_TEST_TMPDIR/spine"
  mkdir -p "$SPINE"
  export ARC_SPINE_ROOT="$SPINE"
  export ARC_SPINE_NOW="1784736000000"
  export ARC_SPINE_RAND="equiv-seed"
}

_need_sqlite() {
  node -e 'import("node:sqlite").then(()=>process.exit(0),()=>process.exit(1))' 2>/dev/null \
    || skip "node:sqlite unavailable (Node < 22) -- the scan path is canonical here"
}

@test "equivalence: brief renders identically through both engines (golden spine)" {
  _need_sqlite
  bash "$EVENT" emit note.logged --payload '{"note":"one"}' --strict >/dev/null
  bash "$EVENT" emit commit.done --payload '{"sha":"abc123"}' --strict >/dev/null
  bash "$EVENT" emit revenue.simulated --payload '{"amount":100,"currency":"INR"}' --strict >/dev/null
  node "$HQ/arc-replay.mjs" --quiet

  node "$HQ/arc-brief.mjs" --date 2026-07-22 --engine scan   > "$BATS_TEST_TMPDIR/scan.txt"
  node "$HQ/arc-brief.mjs" --date 2026-07-22 --engine sqlite > "$BATS_TEST_TMPDIR/sqlite.txt"

  run diff "$BATS_TEST_TMPDIR/scan.txt" "$BATS_TEST_TMPDIR/sqlite.txt"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "equivalence: the reader returns identical bytes through both engines, filters included" {
  _need_sqlite
  bash "$EVENT" emit note.logged --payload '{"n":1}' --strict >/dev/null
  bash "$EVENT" emit commit.done --payload '{"n":2}' --strict >/dev/null
  bash "$EVENT" emit note.logged --venture venturemind --payload '{"n":3}' --strict >/dev/null
  node "$HQ/arc-replay.mjs" --quiet

  for filter in "" "--kind note.logged" "--venture venturemind" "--date 2026-07-22"; do
    node "$HQ/spine.mjs" read $filter --engine scan   > "$BATS_TEST_TMPDIR/s.txt"
    node "$HQ/spine.mjs" read $filter --engine sqlite > "$BATS_TEST_TMPDIR/q.txt"
    run diff "$BATS_TEST_TMPDIR/s.txt" "$BATS_TEST_TMPDIR/q.txt"
    [ "$status" -eq 0 ] || { echo "filter [$filter] diverged:"; echo "$output"; false; }
  done
}

@test "equivalence holds at realistic volume (90-day synthetic spine)" {
  _need_sqlite
  # A three-event fixture cannot expose an ordering or paging difference between the two
  # engines. The synthetic spine is deterministic, so this stays a byte comparison.
  node "$ARC_ROOT/tests/fixtures/spine/gen-synthetic.mjs" "$SPINE" 12 25 2026-03-01 >/dev/null
  node "$HQ/arc-replay.mjs" --quiet

  node "$HQ/spine.mjs" read --engine scan   > "$BATS_TEST_TMPDIR/all-scan.txt"
  node "$HQ/spine.mjs" read --engine sqlite > "$BATS_TEST_TMPDIR/all-sqlite.txt"
  run diff "$BATS_TEST_TMPDIR/all-scan.txt" "$BATS_TEST_TMPDIR/all-sqlite.txt"
  [ "$status" -eq 0 ] || { echo "$output"; false; }

  node "$HQ/arc-brief.mjs" --date 2026-03-05 --engine scan   > "$BATS_TEST_TMPDIR/b-scan.txt"
  node "$HQ/arc-brief.mjs" --date 2026-03-05 --engine sqlite > "$BATS_TEST_TMPDIR/b-sqlite.txt"
  run diff "$BATS_TEST_TMPDIR/b-scan.txt" "$BATS_TEST_TMPDIR/b-sqlite.txt"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "requesting sqlite without a state.db fails loudly instead of pretending" {
  _need_sqlite
  bash "$EVENT" emit note.logged --payload '{"n":1}' --strict >/dev/null
  # No replay has run, so there is no index to read. Silently falling back would make the
  # equivalence gate meaningless -- it would be comparing the scan path against itself.
  run env ARC_SPINE_ENGINE=sqlite node "$HQ/spine.mjs" read
  [ "$status" -eq 2 ]
  [[ "$output" == *"NO_STATE_DB"* ]]
}
