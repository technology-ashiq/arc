#!/usr/bin/env bats
# Phase 00 ckpt A -- the emitter's dual-mode contract (REQ-02) + canonical form (REQ-04).
#
# The corpus in tests/fixtures/spine/hostile/ is PINNED: every fixture is asserted in BOTH
# modes, because the pair of behaviours IS the contract (ADR-0031) -- strict mode exits 2,
# hook mode never blocks. A fixture that only proves one half proves nothing.
bats_require_minimum_version 1.5.0
load 'test_helper'

HOSTILE="$ARC_ROOT/tests/fixtures/spine/hostile"
EVENT="$ARC_ROOT/.claude/scripts/hq/arc-event.sh"

# A secret that must NEVER appear anywhere under the spine root, in any mode.
CANARY="AKIAIOSFODNN7EXAMPLE"

setup() {
  SPINE="$BATS_TEST_TMPDIR/spine"
  mkdir -p "$SPINE"
  export ARC_SPINE_ROOT="$SPINE"
  # Frozen clock + frozen randomness: golden comparisons need the emitter to be a pure
  # function of its input. Both are test-only env doors, documented in arc-event.mjs.
  # The clock is pinned to the fixtures' own day (2026-07-22T16:00:00Z) because ts is now
  # bounded against the spine's clock -- a clock a year behind the corpus would reject it.
  export ARC_SPINE_NOW="1784736000000"
  export ARC_SPINE_RAND="00112233445566778899"
}

# A throwaway spine per fixture -- one fixture's quarantine must not read as another's.
_fresh_spine() {
  SPINE="$BATS_TEST_TMPDIR/spine-$1"
  mkdir -p "$SPINE"
  export ARC_SPINE_ROOT="$SPINE"
}

_event_lines() { cat "$SPINE"/events/*.jsonl 2>/dev/null | sed '/^$/d' | wc -l | tr -d ' '; }
_quarantine_lines() { cat "$SPINE"/events/_quarantine/*.jsonl 2>/dev/null | sed '/^$/d' | wc -l | tr -d ' '; }

# ---------- the corpus, both modes ----------

@test "strict mode: every hostile fixture exits 2 with its own reject code" {
  local fails="" file code note
  while IFS="$(printf '\t')" read -r file code note; do
    [ -n "$file" ] || continue
    [ "$code" = "ACCEPT" ] && continue
    _fresh_spine "strict-$file"
    run bash "$EVENT" emit --event-file "$HOSTILE/$file" --strict
    if [ "$status" -ne 2 ]; then
      fails="$fails|$file: expected exit 2, got $status"
      continue
    fi
    case "$output" in
      *"$code"*) ;;
      *) fails="$fails|$file: expected code $code, got [$output]" ;;
    esac
  done < "$HOSTILE/INDEX"
  [ -z "$fails" ] || { echo "STRICT FAILURES:"; echo "$fails" | tr '|' '\n'; false; }
}

@test "hook mode: every hostile fixture exits 0, appends nothing, and quarantines" {
  local fails="" file code note
  while IFS="$(printf '\t')" read -r file code note; do
    [ -n "$file" ] || continue
    [ "$code" = "ACCEPT" ] && continue
    _fresh_spine "hook-$file"
    run bash "$EVENT" emit --event-file "$HOSTILE/$file"
    [ "$status" -eq 0 ] || fails="$fails|$file: hook mode must never block, got exit $status"
    case "$output" in
      *SKIP*) ;;
      *) fails="$fails|$file: hook mode must print a loud SKIP, got [$output]" ;;
    esac
    [ "$(_event_lines)" = "0" ] || fails="$fails|$file: invalid input reached the spine"
    [ "$(_quarantine_lines)" != "0" ] || fails="$fails|$file: nothing was quarantined"
  done < "$HOSTILE/INDEX"
  [ -z "$fails" ] || { echo "HOOK FAILURES:"; echo "$fails" | tr '|' '\n'; false; }
}

@test "both modes: ACCEPT fixtures are accepted and round-trip byte-stable" {
  local fails="" file code note
  while IFS="$(printf '\t')" read -r file code note; do
    [ "$code" = "ACCEPT" ] || continue
    _fresh_spine "accept-$file"
    run bash "$EVENT" emit --event-file "$HOSTILE/$file" --strict
    [ "$status" -eq 0 ] || { fails="$fails|$file: expected accept, got exit $status [$output]"; continue; }
    [ "$(_event_lines)" = "1" ] || fails="$fails|$file: expected exactly one appended line"
    # payload survives the canonical round-trip unchanged
    run node -e '
      const fs=require("fs"), path=require("path");
      const dir=path.join(process.env.ARC_SPINE_ROOT,"events");
      const f=fs.readdirSync(dir).filter(n=>n.endsWith(".jsonl"))[0];
      const line=fs.readFileSync(path.join(dir,f),"utf8").trim();
      const stored=JSON.parse(line), src=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
      if (JSON.stringify(stored.payload)!==JSON.stringify(src.payload)) { console.log("PAYLOAD DRIFT"); process.exit(1); }
    ' "$HOSTILE/$file"
    [ "$status" -eq 0 ] || fails="$fails|$file: payload did not round-trip"
  done < "$HOSTILE/INDEX"
  [ -z "$fails" ] || { echo "ACCEPT FAILURES:"; echo "$fails" | tr '|' '\n'; false; }
}

# ---------- secrets: refused, and never written anywhere (ADR-0028) ----------

@test "secret fixture: the secret never appears anywhere under the spine root (hook mode)" {
  run bash "$EVENT" emit --event-file "$HOSTILE/06-secret-plain.json"
  [ "$status" -eq 0 ]
  run grep -rl "$CANARY" "$SPINE"
  [ "$status" -ne 0 ]   # grep found nothing -- stub-only quarantine, no secret bytes on disk
}

@test "secret fixture: the secret never appears anywhere under the spine root (strict mode)" {
  run bash "$EVENT" emit --event-file "$HOSTILE/06-secret-plain.json" --strict
  [ "$status" -eq 2 ]
  run grep -rl "$CANARY" "$SPINE"
  [ "$status" -ne 0 ]
}

@test "secret quarantine record is stub-only: no payload field names or values" {
  run bash "$EVENT" emit --event-file "$HOSTILE/07-secret-spaced.json"
  [ "$status" -eq 0 ]
  run cat "$SPINE/events/_quarantine/"*.jsonl
  [ "$status" -eq 0 ]
  [[ "$output" == *"SECRET"* ]]
  [[ "$output" != *"api_key"* ]]
  [[ "$output" != *"zS3cr3t"* ]]
}

@test "non-secret quarantine keeps the raw input for debugging" {
  run bash "$EVENT" emit --event-file "$HOSTILE/16-unknown-kind.json"
  [ "$status" -eq 0 ]
  run cat "$SPINE/events/_quarantine/"*.jsonl
  [[ "$output" == *"revenue.imagined"* ]]
}

# ---------- the happy path ----------

@test "valid event: appends exactly one canonical line and prints its id" {
  run bash "$EVENT" emit --event-file "$HOSTILE/30-valid.json" --strict
  [ "$status" -eq 0 ]
  [ "$(_event_lines)" = "1" ]
  [[ "$output" == *"01JQ8XZ9K0ABCDEFGH01234567"* ]]
}

@test "canonical form: keys sorted, no insignificant whitespace, LF-terminated" {
  run bash "$EVENT" emit --event-file "$HOSTILE/30-valid.json" --strict
  [ "$status" -eq 0 ]
  local f; f="$(ls "$SPINE/events/"*.jsonl)"
  run node -e '
    const fs=require("fs");
    const buf=fs.readFileSync(process.argv[1]);
    if (buf.includes(0x0d)) { console.log("CR BYTE"); process.exit(1); }
    if (buf[buf.length-1]!==0x0a) { console.log("NO TRAILING LF"); process.exit(1); }
    const line=buf.toString("utf8").trim();
    const keys=Object.keys(JSON.parse(line));
    if (JSON.stringify(keys)!==JSON.stringify([...keys].sort())) { console.log("KEYS UNSORTED"); process.exit(1); }
    if (/[:,]\s/.test(line)) { console.log("INSIGNIFICANT WHITESPACE"); process.exit(1); }
  ' "$f"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "sha: recomputing the canonical form of a stored event reproduces its sha" {
  run bash "$EVENT" emit --event-file "$HOSTILE/37-unicode.json" --strict
  [ "$status" -eq 0 ]
  run node -e '
    const fs=require("fs"), crypto=require("crypto"), path=require("path");
    const dir=path.join(process.env.ARC_SPINE_ROOT,"events");
    const f=fs.readdirSync(dir).filter(n=>n.endsWith(".jsonl"))[0];
    const ev=JSON.parse(fs.readFileSync(path.join(dir,f),"utf8").trim());
    const {sha, ...rest}=ev;
    const canon=(v)=>{
      if (v===null) return "null";
      if (Array.isArray(v)) return "["+v.map(canon).join(",")+"]";
      if (typeof v==="object") return "{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+canon(v[k])).join(",")+"}";
      return JSON.stringify(v);
    };
    const want=crypto.createHash("sha256").update(Buffer.from(canon(rest),"utf8")).digest("hex");
    if (want!==sha) { console.log("SHA MISMATCH want="+want+" got="+sha); process.exit(1); }
  '
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

# ---------- idempotency (REQ-03's mechanism, proven here at ckpt A) ----------

@test "dup idem: the same event twice yields ONE event (strict rejects the second)" {
  run bash "$EVENT" emit --event-file "$HOSTILE/30-valid.json" --strict
  [ "$status" -eq 0 ]
  run bash "$EVENT" emit --event-file "$HOSTILE/30-valid.json" --strict
  [ "$status" -eq 2 ]
  [[ "$output" == *"DUP_IDEM"* ]]
  [ "$(_event_lines)" = "1" ]
}

@test "dup idem holds ACROSS DAYS (the cross-day dedupe REQ-03 depends on)" {
  run bash "$EVENT" emit --event-file "$HOSTILE/30-valid.json" --strict
  [ "$status" -eq 0 ]
  # same idem, a different day and a different id -- must still be refused
  node -e '
    const fs=require("fs");
    const ev=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
    // A different DAY, but inside the future bound the validator now enforces -- the point
    // of this test is the day boundary, not how far ahead it sits.
    ev.ts="2026-07-23T10:00:00+05:30";
    ev.id="01JQ8XZ9K1ABCDEFGH01234567";
    delete ev.sha;
    fs.writeFileSync(process.env.BATS_TEST_TMPDIR+"/nextday.json", JSON.stringify(ev,null,2)+"\n");
  ' "$HOSTILE/30-valid.json"
  run bash "$EVENT" emit --event-file "$BATS_TEST_TMPDIR/nextday.json" --strict
  [ "$status" -eq 2 ]
  [[ "$output" == *"DUP_IDEM"* ]]
  [ "$(_event_lines)" = "1" ]
}

@test "dup idem in hook mode never blocks: exit 0, still ONE event" {
  run bash "$EVENT" emit --event-file "$HOSTILE/30-valid.json"
  [ "$status" -eq 0 ]
  run bash "$EVENT" emit --event-file "$HOSTILE/30-valid.json"
  [ "$status" -eq 0 ]
  [[ "$output" == *"SKIP"* ]]
  [ "$(_event_lines)" = "1" ]
}

# ---------- immutability windows (ADR-0029) ----------

@test "closed day: appending to a closed day is refused, and the close pins a file sha" {
  run bash "$EVENT" emit --event-file "$HOSTILE/30-valid.json" --strict
  [ "$status" -eq 0 ]
  run bash "$EVENT" close-day --date 2026-07-22 --strict
  [ "$status" -eq 0 ]
  [ -f "$SPINE/events/2026-07-22.closed" ]
  # a day.closed event carrying the file sha is itself on the spine
  run grep -c "day.closed" "$SPINE/events/2026-07-22.jsonl"
  [ "$status" -eq 0 ]
  # a second event dated into that closed day must now be refused
  node -e '
    const fs=require("fs");
    const ev=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
    ev.id="01JQ8XZ9K2ABCDEFGH01234567"; ev.idem="f".repeat(64); delete ev.sha;
    fs.writeFileSync(process.env.BATS_TEST_TMPDIR+"/late.json", JSON.stringify(ev,null,2)+"\n");
  ' "$HOSTILE/30-valid.json"
  run bash "$EVENT" emit --event-file "$BATS_TEST_TMPDIR/late.json" --strict
  [ "$status" -eq 2 ]
  [[ "$output" == *"DAY_CLOSED"* ]]
}

# ---------- durability / atomicity (PLAN non-negotiable, pre-mortem #4) ----------

@test "concurrent emitters: every line is whole, none interleave, none are lost" {
  local i
  for i in 1 2 3 4 5 6 7 8; do
    node -e '
      const fs=require("fs");
      const ev=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
      const n=process.argv[2];
      ev.id="01JQ8XZ9K"+n+"ABCDEFGH01234567";
      ev.idem=String(n).repeat(64).slice(0,64).replace(/[^0-9a-f]/g,"a");
      ev.payload={note:"concurrent-"+n};
      delete ev.sha;
      fs.writeFileSync(process.env.BATS_TEST_TMPDIR+"/conc-"+n+".json", JSON.stringify(ev,null,2)+"\n");
    ' "$HOSTILE/30-valid.json" "$i"
  done
  for i in 1 2 3 4 5 6 7 8; do
    bash "$EVENT" emit --event-file "$BATS_TEST_TMPDIR/conc-$i.json" --strict &
  done
  wait
  [ "$(_event_lines)" = "8" ]
  # every line must be independently parseable -- a torn or interleaved write fails here
  run node -e '
    const fs=require("fs"), path=require("path");
    const dir=path.join(process.env.ARC_SPINE_ROOT,"events");
    for (const f of fs.readdirSync(dir).filter(n=>n.endsWith(".jsonl"))) {
      const txt=fs.readFileSync(path.join(dir,f),"utf8");
      if (!txt.endsWith("\n")) { console.log("TORN TAIL in "+f); process.exit(1); }
      for (const [i,line] of txt.trim().split("\n").entries()) {
        try { JSON.parse(line); } catch (e) { console.log("TORN LINE "+f+":"+(i+1)); process.exit(1); }
      }
    }
  '
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "a killed emitter leaves no torn line behind" {
  run bash "$EVENT" emit --event-file "$HOSTILE/30-valid.json" --strict
  [ "$status" -eq 0 ]
  # simulate the crash window: a stale lock left by a killed process must not wedge the spine
  echo "999999" > "$SPINE/events/.lock"
  node -e '
    const fs=require("fs");
    const ev=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
    ev.id="01JQ8XZ9K3ABCDEFGH01234567"; ev.idem="b".repeat(64); delete ev.sha;
    fs.writeFileSync(process.env.BATS_TEST_TMPDIR+"/after-crash.json", JSON.stringify(ev,null,2)+"\n");
  ' "$HOSTILE/30-valid.json"
  ARC_SPINE_LOCK_STALE_MS=1 run bash "$EVENT" emit --event-file "$BATS_TEST_TMPDIR/after-crash.json" --strict
  [ "$status" -eq 0 ]
  [ "$(_event_lines)" = "2" ]
}

# ---------- hook mode can never be blocked by its own tooling ----------

@test "hook mode survives a missing node: SKIP, exit 0" {
  # ARC_NODE only -- emptying PATH would break `bash` itself and test nothing about arc-event.
  run env ARC_NODE="definitely-not-node-xyz" bash "$EVENT" emit --event-file "$HOSTILE/30-valid.json"
  [ "$status" -eq 0 ]
  [[ "$output" == *"SKIP"* ]]
  [[ "$output" == *"NO_NODE"* ]]
}

@test "strict mode refuses to pretend when node is missing" {
  run env ARC_NODE="definitely-not-node-xyz" bash "$EVENT" emit --event-file "$HOSTILE/30-valid.json" --strict
  [ "$status" -eq 2 ]
  [[ "$output" == *"NO_NODE"* ]]
}

@test "unreadable event file: strict exits 2, hook skips" {
  run bash "$EVENT" emit --event-file "$BATS_TEST_TMPDIR/nope.json" --strict
  [ "$status" -eq 2 ]
  run bash "$EVENT" emit --event-file "$BATS_TEST_TMPDIR/nope.json"
  [ "$status" -eq 0 ]
}

# ---------- synthesis path (what the hooks and flows will actually call) ----------

@test "emit <kind>: synthesizes a complete, valid event from flags alone" {
  run bash "$EVENT" emit note.logged --payload '{"note":"from flags"}' --strict
  [ "$status" -eq 0 ]
  [ "$(_event_lines)" = "1" ]
  run cat "$SPINE/events/"*.jsonl
  [[ "$output" == *'"kind":"note.logged"'* ]]
  [[ "$output" == *'"venture":"arc"'* ]]
}

@test "emit <kind>: identical input twice dedupes by derived idem" {
  run bash "$EVENT" emit note.logged --payload '{"note":"same"}' --strict
  [ "$status" -eq 0 ]
  run bash "$EVENT" emit note.logged --payload '{"note":"same"}' --strict
  [ "$status" -eq 2 ]
  [[ "$output" == *"DUP_IDEM"* ]]
}

@test "emit <kind>: an unknown kind is refused before anything is written" {
  run bash "$EVENT" emit not.a.kind --payload '{}' --strict
  [ "$status" -eq 2 ]
  [[ "$output" == *"UNKNOWN_KIND"* ]]
  [ "$(_event_lines)" = "0" ]
}

# ---------- regressions pinned by the Phase-0 adversarial pass ----------
# Each test below is a hole that was CONFIRMED against the first implementation. Fixtures
# cover the input-shaped ones; these cover the ones that only exist as behaviour.

@test "quarantine never persists a secret when a NON-secret error fires first (ADR-0028)" {
  # The rejection here is UNKNOWN_KIND -- it fires long before the secret scanner would
  # normally run. The raw input still carries a live-shaped credential, and writing it to
  # the append-only quarantine log would be exactly the leak ADR-0028 exists to prevent.
  cat > "$BATS_TEST_TMPDIR/leak.json" <<'JSON'
{"note":"deploy key AKIAIOSFODNN7EXAMPLE rotated"}
JSON
  run bash "$EVENT" emit not.a.kind --payload-file "$BATS_TEST_TMPDIR/leak.json"
  [ "$status" -eq 0 ]
  run grep -rl "$CANARY" "$SPINE"
  [ "$status" -ne 0 ]
}

@test "a torn tail is healed, never welded onto the next event" {
  run bash "$EVENT" emit --event-file "$HOSTILE/30-valid.json" --strict
  [ "$status" -eq 0 ]
  # Simulate a truncated previous write: no trailing newline.
  printf '{"partial":true' >> "$SPINE/events/2026-07-22.jsonl"
  run bash "$EVENT" emit note.logged --payload '{"note":"after the tear"}' --strict
  [ "$status" -eq 0 ]
  # The new event must be its own parseable line, not glued to the torn remains.
  run node -e '
    const fs=require("fs"), path=require("path");
    const dir=path.join(process.env.ARC_SPINE_ROOT,"events");
    let good=0, torn=0;
    for (const f of fs.readdirSync(dir).filter(n=>n.endsWith(".jsonl"))) {
      for (const line of fs.readFileSync(path.join(dir,f),"utf8").split("\n")) {
        if (!line) continue;
        try { JSON.parse(line); good++; } catch { torn++; }
      }
    }
    if (good < 2) { console.log("lost an event: only "+good+" parseable"); process.exit(1); }
    if (torn !== 1) { console.log("expected exactly the one pre-existing torn line, got "+torn); process.exit(1); }
  '
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "releasing the lock never deletes a lock this process does not own" {
  run bash "$EVENT" emit --event-file "$HOSTILE/30-valid.json" --strict
  [ "$status" -eq 0 ]
  # A foreign holder's token sits in the lock. Our emitter must wait it out and then break
  # it as stale -- and must not delete it while believing it is its own.
  printf 'someone-else:deadbeef\n' > "$SPINE/events/.lock"
  ARC_SPINE_LOCK_STALE_MS=1 run bash "$EVENT" emit note.logged --payload '{"note":"after stale"}' --strict
  [ "$status" -eq 0 ]
  [ "$(_event_lines)" = "2" ]
}

@test "hook mode absorbs a broken emitter library instead of dumping a stack trace" {
  # A truncated lib/*.mjs fails at import time, BELOW the emitter's own error handler.
  # Only the wrapper can catch that, and in hook mode it must still exit 0.
  cp -r "$ARC_ROOT/.claude/scripts/hq" "$BATS_TEST_TMPDIR/hq"
  printf 'this is not valid javascript {{{\n' > "$BATS_TEST_TMPDIR/hq/lib/validate.mjs"
  run bash "$BATS_TEST_TMPDIR/hq/arc-event.sh" emit note.logged --payload '{"note":"x"}'
  [ "$status" -eq 0 ]
  [[ "$output" == *"SKIP"* ]]
}

@test "a flag VALUE never flips the mode: --actor ingest stays hook mode" {
  run bash "$EVENT" emit not.a.kind --actor ingest --payload '{"n":"x"}'
  [ "$status" -eq 0 ]   # hook mode: refused, but never blocking
  run bash "$EVENT" emit not.a.kind --actor --strict --payload '{"n":"x"}'
  [ "$status" -eq 0 ]
}

@test "ingest derives its own idem, ignoring a caller-supplied one" {
  echo '{"txn":"T-1","amount":100}' > "$BATS_TEST_TMPDIR/p.json"
  # Pre-claiming an idem must not let anyone suppress the genuine receipt that follows.
  run bash "$EVENT" emit revenue.received --payload '{"unrelated":true}' --idem "$(printf 'a%.0s' $(seq 64))" --strict
  [ "$status" -eq 0 ]
  run bash "$EVENT" ingest revenue.received --json "$BATS_TEST_TMPDIR/p.json" --idem "$(printf 'a%.0s' $(seq 64))"
  [ "$status" -eq 0 ]
  [ "$(_event_lines)" = "2" ]
}

@test "the spine refuses to guess a location when there is no repo above cwd" {
  mkdir -p "$BATS_TEST_TMPDIR/orphan"
  # No .git/.claude pair anywhere above: the emitter must say so, not silently adopt the
  # user's global ~/.claude and write one project's receipts into it.
  run env -u ARC_SPINE_ROOT bash -c "cd '$BATS_TEST_TMPDIR/orphan' && bash '$EVENT' emit note.logged --payload '{\"n\":\"x\"}' --strict"
  [ "$status" -eq 2 ]
  [[ "$output" == *"NO_ROOT"* ]]
}
