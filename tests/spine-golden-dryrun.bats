#!/usr/bin/env bats
# Phase 01 — REQ-01: every factory action leaves a receipt.
#
# The six factory flows (kickoff → phase-done → review → qa → commit → ship) are Claude
# slash-command markdown — a bats runner can't execute them. So a canned session script,
# tests/spine-dryrun.sh, stands in for ONE real session: it drops each flow's receipt in
# order, under the frozen clock, through the same emitter a live session calls. This test
# runs that session and asserts the ordered kind-sequence matches the golden.
#
# Golden rule (PLAN REQ-01): a "step" = one flow command's own emissions — order-insensitive
# WITHIN a command, strict ACROSS commands. Every flow emits exactly one kind today, so the
# sequence is a flat ordered list and exact-match is correct; the day a command emits two
# kinds, the golden gains a per-command block and this comparison relaxes ordering inside it.
#
# RED-FIRST (this commit): tests/spine-dryrun.sh does not exist and no flow is wired, so the
# session drops nothing — the missing-kind diff below names every gap. GREEN arrives when the
# canned session + the flow emissions are wired (the next Phase-01 step). This is the test
# whose failure the spec predicts: "the missing-kind diff names the gap" (phase-01-spec.md).
bats_require_minimum_version 1.5.0
load 'test_helper'

DRYRUN="$ARC_ROOT/tests/spine-dryrun.sh"
GOLDEN="$ARC_ROOT/tests/fixtures/spine-golden/dryrun-kinds.golden"

setup() {
  SPINE="$BATS_TEST_TMPDIR/spine"
  mkdir -p "$SPINE"
  export ARC_SPINE_ROOT="$SPINE"
  # Frozen clock + randomness: the golden is a pure function of the session's inputs. Pinned
  # to the Phase-0 corpus day so the emitter's ts bound accepts the events.
  export ARC_SPINE_NOW="1784736000000"
  export ARC_SPINE_RAND="00112233445566778899"
}

# The golden's kinds, in order, comments and blank lines stripped.
_golden_kinds() { grep -v '^[[:space:]]*#' "$GOLDEN" | sed '/^[[:space:]]*$/d'; }

# Every event kind actually on the spine, in append (emit) order.
_emitted_kinds() {
  node -e '
    const fs=require("fs"), path=require("path");
    const dir=path.join(process.env.ARC_SPINE_ROOT,"events");
    const out=[];
    let files=[];
    try { files=fs.readdirSync(dir).filter(n=>/^\d{4}-\d{2}-\d{2}\.jsonl$/.test(n)).sort(); } catch {}
    for (const f of files) {
      for (const line of fs.readFileSync(path.join(dir,f),"utf8").split("\n")) {
        if (!line.trim()) continue;
        try { out.push(JSON.parse(line).kind); } catch {}
      }
    }
    process.stdout.write(out.join("\n"));
  '
}

@test "golden dry-run: a scripted session emits the flow receipts in golden order" {
  # Play the canned session. Tolerate its absence: a missing/unwired session simply drops
  # nothing, and the missing-kind diff below is exactly the RED the phase spec predicts.
  # Not `run` — we assert on the events it leaves on disk, not its exit code, and a 127 from
  # the not-yet-written script would only add a bats warning.
  bash "$DRYRUN" >/dev/null 2>&1 || true

  local golden actual missing=""
  golden="$(_golden_kinds)"
  actual="$(_emitted_kinds)"

  # Missing-kind diff: every golden kind the session did NOT emit.
  while IFS= read -r k; do
    [ -n "$k" ] || continue
    printf '%s\n' "$actual" | grep -qxF "$k" || missing="$missing  - $k"$'\n'
  done <<< "$golden"

  if [ -n "$missing" ]; then
    echo "MISSING KINDS — these factory flows are not wired to emit yet:"
    printf '%s' "$missing"
    echo "GOLDEN (expected, in session order):"; printf '%s\n' "$golden" | sed 's/^/  /'
    echo "ACTUAL (on the spine):"; printf '%s\n' "${actual:-<none>}" | sed 's/^/  /'
    false
  fi

  # No kind missing → the order across commands must match the golden exactly (strict across;
  # each command is one kind today, so no within-command reordering can arise).
  [ "$actual" = "$golden" ] || {
    echo "ORDER MISMATCH"
    echo "want:"; printf '%s\n' "$golden" | sed 's/^/  /'
    echo "got:";  printf '%s\n' "$actual" | sed 's/^/  /'
    false
  }
}

@test "golden dry-run: every emitted receipt is canonical on disk (sorted keys, LF, no CR)" {
  bash "$DRYRUN" >/dev/null 2>&1 || true
  local n; n="$(_emitted_kinds | sed '/^$/d' | wc -l | tr -d ' ')"
  [ "$n" -gt 0 ] || skip "session wrote no events yet (unwired) — nothing to validate"

  run node -e '
    const fs=require("fs"), path=require("path");
    const dir=path.join(process.env.ARC_SPINE_ROOT,"events");
    for (const f of fs.readdirSync(dir).filter(n=>/^\d{4}-\d{2}-\d{2}\.jsonl$/.test(n))) {
      const buf=fs.readFileSync(path.join(dir,f));
      if (buf.includes(0x0d)) { console.log("CR BYTE in "+f); process.exit(1); }
      if (buf.length && buf[buf.length-1]!==0x0a) { console.log("NO TRAILING LF in "+f); process.exit(1); }
      for (const line of buf.toString("utf8").split("\n")) {
        if (!line.trim()) continue;
        const keys=Object.keys(JSON.parse(line));
        if (JSON.stringify(keys)!==JSON.stringify([...keys].sort())) { console.log("KEYS UNSORTED: "+line); process.exit(1); }
        if (/[:,]\s/.test(line)) { console.log("INSIGNIFICANT WHITESPACE: "+line); process.exit(1); }
      }
    }
  '
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}
