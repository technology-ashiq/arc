#!/usr/bin/env bats
# distribute Cycle 2, Phase 05 -- the capped OpenCode wrapper (ADR-2019, REQ-11).
#
# Every arm drives .claude/scripts/engine/opencode-session.mjs against tests/fixtures/distribute/fake-opencode.mjs,
# named by ARC_OPENCODE_BIN through a shim: a .cmd file on Windows (the shape npm installs, and the one a shell
# string would mangle), a sh script elsewhere. Each arm asserts the wrapper RAN (its final `opencode-session:` line,
# or the fake's marker file) before what it printed. Refusal arms assert the fake was NEVER invoked.

bats_require_minimum_version 1.5.0
load 'test_helper'

native() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }
is_windows() { case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) return 0 ;; *) return 1 ;; esac; }
lines() { printf '%s\n' "$output" | tr -d '\r'; }

setup() {
  T="$(cd "$BATS_TEST_TMPDIR" && pwd -P)"
  WRAP="$(native "$ARC_ROOT/.claude/scripts/engine/opencode-session.mjs")"
  FAKE="$ARC_ROOT/tests/fixtures/distribute/fake-opencode.mjs"
  mkdir -p "$T/repo" "$T/ledger"
  git -C "$T/repo" init -q
  if is_windows; then
    printf '@echo off\r\n"%s" "%s" %%*\r\n' "$(cygpath -w "$(command -v node)")" "$(cygpath -w "$FAKE")" > "$T/opencode.cmd"
    export ARC_OPENCODE_BIN="$(native "$T/opencode.cmd")"
  else
    printf '#!/bin/sh\nexec "%s" "%s" "$@"\n' "$(command -v node)" "$FAKE" > "$T/opencode"
    chmod +x "$T/opencode"
    export ARC_OPENCODE_BIN="$T/opencode"
  fi
  export FAKE_OC_MARKER="$(native "$T/invoked")" FAKE_OC_ARGV="$(native "$T/argv.json")" FAKE_OC_ENV="$(native "$T/env.json")"
  unset FAKE_OC_MODE FAKE_OC_COST FAKE_OC_GRANDCHILD FAKE_OC_GRANDCHILD_MS
}

# wrap CAP TIMEOUT TRANSCRIPT-NAME [extra flags...] -- runs the wrapper with the owner model and the ledger in $T.
wrap() {
  local cap="$1" to="$2" name="$3"; shift 3
  run --separate-stderr node "$WRAP" --cap-usd "$cap" --timeout-s "$to" --model openrouter/deepseek/deepseek-v4-flash-0731 \
    --command arc-commit --cwd "$(native "$T/repo")" --transcript "$(native "$T/repo/$name")" \
    --ledger-dir "$(native "$T/ledger")" "$@" -- "${MSG:-commit it}"
}

@test "distribute-opencode-session: every test in the file is registered" {
  local declared
  declared=$(grep -c '^@test "distribute-opencode-session: ' "$BATS_TEST_FILENAME")
  [ "$declared" -eq 10 ] || { echo "declared $declared, expected 10"; false; }
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "distribute-opencode-session: a clean run writes the proof header, every event verbatim, and spent last" {
  MSG='a b "q" $X `bt` 100%'
  wrap 0.10 30 ok.jsonl
  [ -s "$T/invoked" ] || { echo "the fake never ran: $output $stderr"; false; }
  [ "$status" -eq 0 ] || { echo "status $status: $output $stderr"; false; }
  [ "$(lines | grep -cE '^opencode-session: ok spent=0\.03 session=ses_fake0001TestSession transcript=')" -eq 1 ] || { echo "$output"; false; }
  local tx="$T/repo/ok.jsonl"
  head -1 "$tx" | grep -qE '^harness-proof: opencode 1\.17\.18 session=ses_fake0001TestSession model=openrouter/deepseek/deepseek-v4-flash-0731 cap_usd=0\.1 command=arc-commit cwd=\S+ spine=\S+/\.claude/state/hq date=' || { head -1 "$tx"; false; }
  [ "$(tail -1 "$tx" | tr -d '\r')" = "spent=0.03" ] || { tail -2 "$tx"; false; }
  [ "$(sed -n '2,$p' "$tx" | grep -c '^{"timestamp":[0-9]*,"sessionID":"ses_fake0001TestSession","type":"')" -eq 7 ] || { cat "$tx"; false; }
  [ "$(wc -l < "$tx" | tr -d ' ')" -eq 9 ] || { echo "expected header + 7 events + spent"; cat "$tx"; false; }
}

@test "distribute-opencode-session: the child gets the exact argv, no shell, and the message byte-identical" {
  MSG='a b "q" $X `bt` 100%'
  wrap 0.10 30 argv.jsonl
  [ -s "$T/argv.json" ] && [ "$status" -eq 0 ] || { echo "status $status: $output $stderr"; false; }
  run node -e 'const a=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));process.stdout.write(a.slice(0,-1).join(" ")+"\n"+a[a.length-1])' "$(native "$T/argv.json")"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$(printf '%s\n' "$output" | sed -n 1p)" = "run --pure --auto --command arc-commit -m openrouter/deepseek/deepseek-v4-flash-0731 --format json --" ] || { echo "$output"; false; }
  [ "$(printf '%s\n' "$output" | sed -n '2,$p')" = 'a b "q" $X `bt` 100%' ] || { echo "message mangled: $output"; false; }
}

@test "distribute-opencode-session: the child is told its harness, model, transcript and the canonical spine" {
  git -C "$T/repo" -c user.email=t@example.invalid -c user.name=t commit -q --allow-empty -m init
  git -C "$T/repo" worktree add -q "$T/wt" -b feat/x
  mkdir -p "$T/wt/evidence"
  run --separate-stderr node "$WRAP" --cap-usd 0.10 --model openrouter/x/y --command arc-commit --cwd "$(native "$T/wt")" \
    --transcript "$(native "$T/wt/evidence/t.jsonl")" --ledger-dir "$(native "$T/ledger")" -- hi
  [ -s "$T/env.json" ] || { echo "the fake never ran: $output $stderr"; false; }
  [ "$(_arc_json "$T/env.json" 'j.ARC_HARNESS')" = "opencode" ] || { cat "$T/env.json"; false; }
  [ "$(_arc_json "$T/env.json" 'j.ARC_MODEL')" = "openrouter/x/y" ] || { cat "$T/env.json"; false; }
  local want got
  # Lower-cased: Windows git may spell the drive letter in either case.
  want="$(printf '%s' "$(native "$T/repo")/.claude/state/hq" | tr 'A-Z' 'a-z')"
  got="$(_arc_json "$T/env.json" 'j.ARC_SPINE_ROOT.split(String.fromCharCode(92)).join("/").toLowerCase()')"
  [ "$got" = "$want" ] || { echo "spine $got, want the main checkout $want"; false; }
}

@test "distribute-opencode-session: a transcript inside a repo is stamped as that repo-relative evidence path" {
  mkdir -p "$T/repo/initiatives/distribute/evidence/phase-05/transcripts"
  wrap 0.10 30 initiatives/distribute/evidence/phase-05/transcripts/s.jsonl
  [ -s "$T/env.json" ] && [ "$status" -eq 0 ] || { echo "status $status: $output $stderr"; false; }
  [ "$(_arc_json "$T/env.json" 'j.ARC_EVIDENCE')" = "initiatives/distribute/evidence/phase-05/transcripts/s.jsonl" ] || { cat "$T/env.json"; false; }
}

@test "distribute-opencode-session: spend reaching the cap kills the whole tree and exits 3" {
  # Exported, not prefixed: a prefix on a function call does not reach the process `run` starts.
  export FAKE_OC_MODE=overspend FAKE_OC_COST=0.05 FAKE_OC_GRANDCHILD="$(native "$T/grandchild")" FAKE_OC_GRANDCHILD_MS=4000
  wrap 0.12 60 breach.jsonl
  [ -s "$T/invoked" ] || { echo "the fake never ran: $output $stderr"; false; }
  [ "$status" -eq 3 ] || { echo "status $status: $output $stderr"; false; }
  [ "$(printf '%s\n' "$stderr" | tr -d '\r' | grep -cE '^opencode-session: CAP-BREACH spent=')" -eq 1 ] || { echo "$stderr"; false; }
  grep -qE '^cap-breach: spent=[0-9.]+ cap=0\.12$' "$T/repo/breach.jsonl" || { tail -3 "$T/repo/breach.jsonl"; false; }
  tail -1 "$T/repo/breach.jsonl" | tr -d '\r' | grep -qE '^spent=[0-9.]+$' || { tail -1 "$T/repo/breach.jsonl"; false; }
  sleep 6
  [ ! -e "$T/grandchild" ] || { echo "a grandchild outlived the kill and could keep spending"; false; }
}

@test "distribute-opencode-session: a stall is killed at the wall clock, tree and all, and exits 5" {
  export FAKE_OC_MODE=stall FAKE_OC_GRANDCHILD="$(native "$T/grandchild")" FAKE_OC_GRANDCHILD_MS=5000
  wrap 0.10 2 stall.jsonl
  [ -s "$T/invoked" ] || { echo "the fake never ran: $output $stderr"; false; }
  [ "$status" -eq 5 ] && grep -qx 'timeout: after 2s' "$T/repo/stall.jsonl" || { echo "status $status: $stderr"; cat "$T/repo/stall.jsonl"; false; }
  [ "$(tail -1 "$T/repo/stall.jsonl" | tr -d '\r')" = "spent=0" ] || { tail -1 "$T/repo/stall.jsonl"; false; }
  sleep 6
  [ ! -e "$T/grandchild" ] || { echo "a grandchild outlived the timeout kill"; false; }
}

@test "distribute-opencode-session: steps with no cost are COST-UNREADABLE (exit 4), never a capped pass" {
  export FAKE_OC_MODE=nocost
  wrap 0.10 30 nocost.jsonl
  [ -s "$T/invoked" ] || { echo "the fake never ran: $output $stderr"; false; }
  [ "$status" -eq 4 ] || { echo "status $status: $output $stderr"; false; }
  grep -q '^COST-UNREADABLE: ' "$T/repo/nocost.jsonl" && [ "$(tail -1 "$T/repo/nocost.jsonl" | tr -d '\r')" = "spent=0" ] || { cat "$T/repo/nocost.jsonl"; false; }
}

@test "distribute-opencode-session: refusals happen before spend, invoke nothing and write no transcript" {
  local fails=""
  check() {
    local want="$1" name="$2"; shift 2
    rm -f "$T/invoked"
    run --separate-stderr node "$WRAP" "$@"
    [ "$status" -eq 2 ] || fails="$fails|$name: status $status"
    printf '%s\n' "$stderr" | grep -q "REFUSED $want:" || fails="$fails|$name: no REFUSED $want [$stderr]"
    [ ! -e "$T/invoked" ] || fails="$fails|$name: the fake was invoked"
    [ ! -e "$T/repo/r.jsonl" ] || fails="$fails|$name: a transcript was written"
  }
  local base=(--command arc-commit --cwd "$(native "$T/repo")" --transcript "$(native "$T/repo/r.jsonl")" --ledger-dir "$(native "$T/ledger")")
  check CAP no-cap --model openrouter/x/y "${base[@]}" -- hi
  check CAP cap-typo --cap-usd 1.5 --model openrouter/x/y "${base[@]}" -- hi
  check CAP cap-zero --cap-usd 0 --model openrouter/x/y "${base[@]}" -- hi
  check MODEL anthropic --cap-usd 0.1 --model anthropic/claude-x "${base[@]}" -- hi
  check MODEL routed-anthropic --cap-usd 0.1 --model openrouter/anthropic/claude-x "${base[@]}" -- hi
  check USAGE no-message --cap-usd 0.1 --model openrouter/x/y "${base[@]}"
  local keep="$ARC_OPENCODE_BIN"
  export ARC_OPENCODE_BIN="$(native "$T/nope.cmd")"
  check BINARY no-binary --cap-usd 0.1 --model openrouter/x/y "${base[@]}" -- hi
  export ARC_OPENCODE_BIN="$keep"
  mkdir -p "$T/ledger/phase-05/transcripts"
  printf 'harness-proof: x\nspent=0.45\n' > "$T/ledger/phase-05/transcripts/old.jsonl"
  check CYCLE-CAP cycle --cap-usd 0.1 --model openrouter/x/y "${base[@]}" -- hi
  rm -f "$T/ledger/phase-05/transcripts/old.jsonl"
  check CYCLE-CAP prior-flag --cap-usd 0.1 --prior-spent-usd 0.45 --model openrouter/x/y "${base[@]}" -- hi
  printf 'x\n' > "$T/repo/r.jsonl"
  rm -f "$T/invoked"
  run --separate-stderr node "$WRAP" --cap-usd 0.1 --model openrouter/x/y "${base[@]}" -- hi
  [ "$status" -eq 2 ] && printf '%s\n' "$stderr" | grep -q 'REFUSED TRANSCRIPT:' && [ ! -e "$T/invoked" ] || fails="$fails|existing transcript: status $status [$stderr]"
  [ "$(cat "$T/repo/r.jsonl")" = "x" ] || fails="$fails|existing transcript was overwritten"
  [ -z "$fails" ] || { echo "$fails" | tr '|' '\n'; false; }
}

@test "distribute-opencode-session: OpenCode exiting non-zero is CHILD-FAILED (exit 1) with its spend kept" {
  export FAKE_OC_MODE=fail
  wrap 0.10 30 fail.jsonl
  [ -s "$T/invoked" ] || { echo "the fake never ran: $output $stderr"; false; }
  [ "$status" -eq 1 ] && grep -qx 'child-failed: exit 7' "$T/repo/fail.jsonl" || { echo "status $status"; cat "$T/repo/fail.jsonl"; false; }
  [ "$(tail -1 "$T/repo/fail.jsonl" | tr -d '\r')" = "spent=0.01" ] || { tail -1 "$T/repo/fail.jsonl"; false; }
}
