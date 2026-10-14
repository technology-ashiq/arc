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
  mkdir -p "$T/repo/ev/transcripts"
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
  unset FAKE_OC_MODE FAKE_OC_COST FAKE_OC_GRANDCHILD FAKE_OC_GRANDCHILD_DETACH FAKE_OC_GRANDCHILD_MS FAKE_OC_CHILD_COST FAKE_OC_EXPORT
}

# wrap CAP TIMEOUT TRANSCRIPT-NAME [extra flags...] -- runs the wrapper with the owner model and the ledger in $T.
wrap() {
  local cap="$1" to="$2" name="$3"; shift 3
  run --separate-stderr node "$WRAP" --cap-usd "$cap" --timeout-s "$to" --model openrouter/deepseek/deepseek-v4-flash-0731 \
    --command arc-commit --cwd "$(native "$T/repo")" --transcript "$(native "$T/repo/ev/transcripts/$name")" \
    --ledger-dir "$(native "$T/repo/ev")" "$@" -- "${MSG:-commit it}"
}

@test "distribute-opencode-session: every test in the file is registered" {
  local declared
  declared=$(grep -c '^@test "distribute-opencode-session: ' "$BATS_TEST_FILENAME")
  [ "$declared" -eq 18 ] || { echo "declared $declared, expected 18"; false; }
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared"; false; }
}

@test "distribute-opencode-session: a clean run writes the proof header, every event verbatim, and spent last" {
  MSG='a b "q" $X `bt` (a&b)'
  wrap 0.10 30 ok.jsonl
  [ -s "$T/invoked" ] || { echo "the fake never ran: $output $stderr"; false; }
  [ "$status" -eq 0 ] || { echo "status $status: $output $stderr"; false; }
  [ "$(lines | grep -cE '^opencode-session: ok spent=0\.03 session=ses_fake0001TestSession transcript=')" -eq 1 ] || { echo "$output"; false; }
  local tx="$T/repo/ev/transcripts/ok.jsonl"
  head -1 "$tx" | grep -qE '^harness-proof: opencode 1\.17\.18 session=ses_fake0001TestSession model=openrouter/deepseek/deepseek-v4-flash-0731 cap_usd=0\.1 command=arc-commit cwd=\S+ spine=\S+/\.claude/state/hq evidence=ev/transcripts/ok.jsonl date=' || { head -1 "$tx"; false; }
  [ "$(tail -1 "$tx" | tr -d '\r')" = "spent=0.03" ] || { tail -2 "$tx"; false; }
  [ "$(sed -n '2,$p' "$tx" | grep -c '^{"timestamp":[0-9]*,"sessionID":"ses_fake0001TestSession","type":"')" -eq 7 ] || { cat "$tx"; false; }
  [ "$(wc -l < "$tx" | tr -d ' ')" -eq 9 ] || { echo "expected header + 7 events + spent"; cat "$tx"; false; }
}

@test "distribute-opencode-session: the child gets the exact argv, no shell, and the message byte-identical" {
  MSG='a b "q" $X `bt` (a&b)'
  wrap 0.10 30 argv.jsonl
  [ -s "$T/argv.json" ] && [ "$status" -eq 0 ] || { echo "status $status: $output $stderr"; false; }
  run node -e 'const a=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));process.stdout.write(a.slice(0,-1).join(" ")+"\n"+a[a.length-1])' "$(native "$T/argv.json")"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  printf '%s\n' "$output" | sed -n 1p | grep -qxE 'run --pure --title arc-argv-[0-9a-z]+ --command arc-commit -m openrouter/deepseek/deepseek-v4-flash-0731 --format json --' || { echo "$output"; false; }
  if printf '%s\n' "$output" | sed -n 1p | grep -q -- '--auto'; then echo "--auto is back: it hangs a subagent fence (ADR-2022)"; false; fi
  [ "$(printf '%s\n' "$output" | sed -n '2,$p')" = 'a b "q" $X `bt` (a&b)' ] || { echo "message mangled: $output"; false; }
}

@test "distribute-opencode-session: the child is told its harness, model, transcript and the canonical spine" {
  git -C "$T/repo" -c user.email=t@example.invalid -c user.name=t commit -q --allow-empty -m init
  git -C "$T/repo" worktree add -q "$T/wt" -b feat/x
  mkdir -p "$T/wt/evidence/transcripts"
  run --separate-stderr node "$WRAP" --cap-usd 0.10 --model openrouter/x/y --command arc-commit --cwd "$(native "$T/wt")" \
    --transcript "$(native "$T/wt/evidence/transcripts/t.jsonl")" --ledger-dir "$(native "$T/wt/evidence")" -- hi
  [ -s "$T/env.json" ] || { echo "the fake never ran: $output $stderr"; false; }
  [ "$(_arc_json "$T/env.json" 'j.ARC_HARNESS')" = "opencode" ] || { cat "$T/env.json"; false; }
  [ "$(_arc_json "$T/env.json" 'j.ARC_MODEL')" = "openrouter/x/y" ] || { cat "$T/env.json"; false; }
  # OpenCode reads its project directory from PWD before the spawn cwd (the first live smoke ran in the wrong checkout).
  # Both sides through realpath: a Windows runner spells the temp dir as an 8.3 short name on one side only.
  run node -e 'const f=require("fs"),n=(p)=>f.realpathSync.native(p).toLowerCase();process.stdout.write(String(n(JSON.parse(f.readFileSync(process.argv[1],"utf8")).PWD)===n(process.argv[2])))' "$(native "$T/env.json")" "$(native "$T/wt")"
  [ "$status" -eq 0 ] && [ "$output" = "true" ] || { echo "PWD not the session cwd: $output"; cat "$T/env.json"; false; }
  # The spine is the MAIN checkout's .claude/state/hq: its three parents realpath to the repo. No slash in the program:
  # MSYS rewrites an argument holding one into a Windows path.
  run node -e 'const f=require("fs"),p=require("path"),n=(x)=>f.realpathSync.native(x).toLowerCase(),s=JSON.parse(f.readFileSync(process.argv[1],"utf8")).ARC_SPINE_ROOT;process.stdout.write(String(p.join(".claude","state","hq")===p.relative(p.dirname(p.dirname(p.dirname(s))),s)&&n(p.dirname(p.dirname(p.dirname(s))))===n(process.argv[2])))' "$(native "$T/env.json")" "$(native "$T/repo")"
  [ "$status" -eq 0 ] && [ "$output" = "true" ] || { echo "spine not the main checkout: $output"; cat "$T/env.json"; false; }
}

@test "distribute-opencode-session: a transcript inside a repo is stamped as that repo-relative evidence path" {
  mkdir -p "$T/repo/initiatives/distribute/evidence/phase-05/transcripts"
  run --separate-stderr node "$WRAP" --cap-usd 0.10 --model openrouter/x/y --command arc-commit --cwd "$(native "$T/repo")" \
    --transcript "$(native "$T/repo/initiatives/distribute/evidence/phase-05/transcripts/s.jsonl")" \
    --ledger-dir "$(native "$T/repo/initiatives/distribute/evidence")" -- hi
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
  grep -qE '^cap-breach: spent=[0-9.]+ cap=0\.12$' "$T/repo/ev/transcripts/breach.jsonl" || { tail -3 "$T/repo/ev/transcripts/breach.jsonl"; false; }
  tail -1 "$T/repo/ev/transcripts/breach.jsonl" | tr -d '\r' | grep -qE '^spent=[0-9.]+$' || { tail -1 "$T/repo/ev/transcripts/breach.jsonl"; false; }
  sleep 6
  [ ! -e "$T/grandchild" ] || { echo "a grandchild outlived the kill and could keep spending"; false; }
}

@test "distribute-opencode-session: a stall is killed at the wall clock, tree and all, and exits 5" {
  export FAKE_OC_MODE=stall FAKE_OC_GRANDCHILD="$(native "$T/grandchild")" FAKE_OC_GRANDCHILD_MS=5000
  wrap 0.10 2 stall.jsonl
  [ -s "$T/invoked" ] || { echo "the fake never ran: $output $stderr"; false; }
  [ "$status" -eq 5 ] && grep -qx 'timeout: after 2s' "$T/repo/ev/transcripts/stall.jsonl" || { echo "status $status: $stderr"; cat "$T/repo/ev/transcripts/stall.jsonl"; false; }
  [ "$(tail -1 "$T/repo/ev/transcripts/stall.jsonl" | tr -d '\r')" = "spent=0" ] || { tail -1 "$T/repo/ev/transcripts/stall.jsonl"; false; }
  sleep 6
  [ ! -e "$T/grandchild" ] || { echo "a grandchild outlived the timeout kill"; false; }
}

@test "distribute-opencode-session: steps with no cost are COST-UNREADABLE (exit 4), never a capped pass" {
  export FAKE_OC_MODE=nocost
  wrap 0.10 30 nocost.jsonl
  [ -s "$T/invoked" ] || { echo "the fake never ran: $output $stderr"; false; }
  [ "$status" -eq 4 ] || { echo "status $status: $output $stderr"; false; }
  grep -q '^COST-UNREADABLE: ' "$T/repo/ev/transcripts/nocost.jsonl" && [ "$(tail -1 "$T/repo/ev/transcripts/nocost.jsonl" | tr -d '\r')" = "spent=0" ] || { cat "$T/repo/ev/transcripts/nocost.jsonl"; false; }
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
    [ ! -e "$T/repo/ev/transcripts/r.jsonl" ] || fails="$fails|$name: a transcript was written"
  }
  local base=(--command arc-commit --cwd "$(native "$T/repo")" --transcript "$(native "$T/repo/ev/transcripts/r.jsonl")" --ledger-dir "$(native "$T/repo/ev")")
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
  mkdir -p "$T/repo/ev/phase-05/transcripts"
  printf 'harness-proof: x\nspent=0.45\n' > "$T/repo/ev/phase-05/transcripts/old.jsonl"
  check CYCLE-CAP cycle --cap-usd 0.1 --model openrouter/x/y "${base[@]}" -- hi
  rm -f "$T/repo/ev/phase-05/transcripts/old.jsonl"
  check CYCLE-CAP prior-flag --cap-usd 0.1 --prior-spent-usd 0.45 --model openrouter/x/y "${base[@]}" -- hi
  # A transcript cut off before its spent= line is charged its whole cap; one with neither cannot be read.
  printf 'harness-proof: opencode 1.17.18 session=none model=m cap_usd=0.45 command=c\n{"type":"x"}\n' > "$T/repo/ev/phase-05/transcripts/cut.jsonl"
  check CYCLE-CAP cut-short --cap-usd 0.1 --model openrouter/x/y "${base[@]}" -- hi
  printf '{"type":"x"}\n' > "$T/repo/ev/phase-05/transcripts/cut.jsonl"
  check CYCLE-CAP unreadable-ledger --cap-usd 0.1 --model openrouter/x/y "${base[@]}" -- hi
  rm -f "$T/repo/ev/phase-05/transcripts/cut.jsonl"
  local fileledger=(--command arc-commit --cwd "$(native "$T/repo")" --transcript "$(native "$T/repo/ev/transcripts/r.jsonl")" --ledger-dir "$(native "$T/argv-none.txt")")
  printf 'x\n' > "$T/argv-none.txt"
  check CYCLE-CAP ledger-is-a-file --cap-usd 0.1 --model openrouter/x/y "${fileledger[@]}" -- hi
  check USAGE blank-message --cap-usd 0.1 --model openrouter/x/y "${base[@]}" -- "   "
  check USAGE dash-value --cap-usd 0.1 --model openrouter/x/y --command arc-commit --cwd "$(native "$T/repo")" --transcript -x --ledger-dir "$(native "$T/repo/ev")" -- hi
  check MODEL dot-segment --cap-usd 0.1 --model openrouter/../x "${base[@]}" -- hi
  # A transcript the ledger walk would never read is refused, so the cycle cap cannot miss a run.
  local stray=(--command arc-commit --cwd "$(native "$T/repo")" --transcript "$(native "$T/repo/stray.jsonl")" --ledger-dir "$(native "$T/repo/ev")")
  check TRANSCRIPT outside-the-ledger --cap-usd 0.1 --model openrouter/x/y "${stray[@]}" -- hi
  [ ! -e "$T/repo/stray.jsonl" ] || fails="$fails|outside-the-ledger: a transcript was written"
  mkdir -p "$T/out/transcripts"
  local outside=(--command arc-commit --cwd "$(native "$T/repo")" --transcript "$(native "$T/out/transcripts/o.jsonl")" --ledger-dir "$(native "$T/out")")
  check EVIDENCE outside-any-repo --cap-usd 0.1 --model openrouter/x/y "${outside[@]}" -- hi
  [ ! -e "$T/out/transcripts/o.jsonl" ] || fails="$fails|outside-any-repo: a transcript was written"
  mkdir -p "$T/other/ev/transcripts" && git -C "$T/other" init -q
  local otherrepo=(--command arc-commit --cwd "$(native "$T/repo")" --transcript "$(native "$T/other/ev/transcripts/o.jsonl")" --ledger-dir "$(native "$T/other/ev")")
  check EVIDENCE another-repository --cap-usd 0.1 --model openrouter/x/y "${otherrepo[@]}" -- hi
  [ ! -e "$T/other/ev/transcripts/o.jsonl" ] || fails="$fails|another-repository: a transcript was written"
  if is_windows; then check USAGE percent-through-cmd --cap-usd 0.1 --model openrouter/x/y "${base[@]}" -- "100% sure"; fi
  printf 'x\n' > "$T/repo/ev/transcripts/r.jsonl.stderr"
  check TRANSCRIPT stderr-exists --cap-usd 0.1 --model openrouter/x/y "${base[@]}" -- hi
  [ "$(cat "$T/repo/ev/transcripts/r.jsonl.stderr")" = "x" ] || fails="$fails|stderr record was overwritten"
  rm -f "$T/repo/ev/transcripts/r.jsonl.stderr"
  printf 'x\n' > "$T/repo/ev/transcripts/r.jsonl"
  rm -f "$T/invoked"
  run --separate-stderr node "$WRAP" --cap-usd 0.1 --model openrouter/x/y "${base[@]}" -- hi
  [ "$status" -eq 2 ] && printf '%s\n' "$stderr" | grep -q 'REFUSED TRANSCRIPT:' && [ ! -e "$T/invoked" ] || fails="$fails|existing transcript: status $status [$stderr]"
  [ "$(cat "$T/repo/ev/transcripts/r.jsonl")" = "x" ] || fails="$fails|existing transcript was overwritten"
  [ -z "$fails" ] || { echo "$fails" | tr '|' '\n'; false; }
}

@test "distribute-opencode-session: only step-finish cost is spend, and a numeric string is read as its number" {
  export FAKE_OC_MODE=mixed
  wrap 0.10 30 mixed.jsonl
  [ -s "$T/invoked" ] || { echo "the fake never ran: $output $stderr"; false; }
  [ "$status" -eq 0 ] || { echo "status $status: $output $stderr"; false; }
  grep -q '"type":"text"' "$T/repo/ev/transcripts/mixed.jsonl" || { echo "the priced text event never reached the transcript"; cat "$T/repo/ev/transcripts/mixed.jsonl"; false; }
  [ "$(tail -1 "$T/repo/ev/transcripts/mixed.jsonl" | tr -d '\r')" = "spent=0.02" ] || { tail -2 "$T/repo/ev/transcripts/mixed.jsonl"; false; }
}

@test "distribute-opencode-session: OpenCode exiting non-zero is CHILD-FAILED (exit 1) with its spend kept" {
  export FAKE_OC_MODE=fail
  wrap 0.10 30 fail.jsonl
  [ -s "$T/invoked" ] || { echo "the fake never ran: $output $stderr"; false; }
  [ "$status" -eq 1 ] && grep -qx 'child-failed: exit 7' "$T/repo/ev/transcripts/fail.jsonl" || { echo "status $status"; cat "$T/repo/ev/transcripts/fail.jsonl"; false; }
  [ "$(tail -1 "$T/repo/ev/transcripts/fail.jsonl" | tr -d '\r')" = "spent=0.01" ] || { tail -1 "$T/repo/ev/transcripts/fail.jsonl"; false; }
}

@test "distribute-opencode-session: a subagent's spend is read from its export, nested tasks included, and counts toward the cap" {
  # ADR-2022: the JSON stream carries the parent session only, so a command run through its fence spends unseen.
  export FAKE_OC_MODE=task FAKE_OC_COST=0.01 FAKE_OC_CHILD_COST=0.04
  wrap 0.30 30 task.jsonl
  [ -s "$T/invoked" ] || { echo "the fake never ran: $output $stderr"; false; }
  [ "$status" -eq 0 ] || { echo "status $status: $output $stderr"; false; }
  local tx="$T/repo/ev/transcripts/task.jsonl"
  grep -qx 'subagent: ses_fakeChild1 spent=0.08 steps=2' "$tx" && grep -qx 'subagent: ses_fakeGrandchild1 spent=0.04 steps=1' "$tx" || { cat "$tx"; false; }
  [ "$(tail -1 "$tx" | tr -d '\r')" = "spent=0.13" ] || { tail -3 "$tx"; false; }
  export FAKE_OC_CHILD_COST=0.2
  wrap 0.30 30 task-breach.jsonl
  [ "$status" -eq 3 ] && grep -qE '^cap-breach: spent=0\.61 cap=0\.3$' "$T/repo/ev/transcripts/task-breach.jsonl" || { echo "status $status"; cat "$T/repo/ev/transcripts/task-breach.jsonl"; false; }
}

@test "distribute-opencode-session: a subagent export that fails makes the run COST-UNREADABLE, never a pass" {
  export FAKE_OC_MODE=task FAKE_OC_EXPORT=fail
  wrap 0.30 30 task-noexport.jsonl
  [ -s "$T/invoked" ] || { echo "the fake never ran: $output $stderr"; false; }
  [ "$status" -eq 4 ] || { echo "status $status: $output $stderr"; false; }
  grep -q '^subagent: ses_fakeChild1 COST-UNREADABLE ' "$T/repo/ev/transcripts/task-noexport.jsonl" || { cat "$T/repo/ev/transcripts/task-noexport.jsonl"; false; }
}

@test "distribute-opencode-session: a killed run finds its session by title and charges the subagents it never streamed" {
  # The live smokes that hung streamed no event at all; their subagent spend is read from the parent's export.
  export FAKE_OC_MODE=stalltask FAKE_OC_CHILD_COST=0.04
  wrap 0.30 2 stalltask.jsonl
  [ -s "$T/invoked" ] || { echo "the fake never ran: $output $stderr"; false; }
  [ "$status" -eq 5 ] || { echo "status $status: $output $stderr"; false; }
  local tx="$T/repo/ev/transcripts/stalltask.jsonl"
  grep -qx 'sweep: ses_fake0001TestSession 1 subagent session(s)' "$tx" && grep -qx 'subagent: ses_fakeChild1 spent=0.08 steps=2' "$tx" || { cat "$tx"; false; }
  [ "$(tail -1 "$tx" | tr -d '\r')" = "spent=0.12" ] || { tail -3 "$tx"; false; }
  head -1 "$tx" | grep -q ' session=ses_fake0001TestSession ' || { head -1 "$tx"; false; }
}

@test "distribute-opencode-session: a subagent export with no step-finish is COST-UNREADABLE, never a free run" {
  export FAKE_OC_MODE=emptytask
  wrap 0.30 30 emptytask.jsonl
  [ -s "$T/invoked" ] || { echo "the fake never ran: $output $stderr"; false; }
  [ "$status" -eq 4 ] && grep -q '^subagent: ses_fakeEmpty COST-UNREADABLE .*holds no step-finish$' "$T/repo/ev/transcripts/emptytask.jsonl" || { echo "status $status"; cat "$T/repo/ev/transcripts/emptytask.jsonl"; false; }
}

# A rendered command and, unless told otherwise, its fence agent, in the session repo (ADR-2027, debt row 22).
fence_files() {
  mkdir -p "$T/repo/.opencode/commands" "$T/repo/.opencode/agents"
  printf -- '---\ndescription: "c"\nagent: arc-commit-fence\n---\n\nbody\n' > "$T/repo/.opencode/commands/arc-commit.md"
  [ "${1:-}" = "no-agent" ] || printf -- '---\ndescription: "f"\nmode: %s\nhidden: true\npermission:\n  "*": deny\n---\n\nfence\n' "${2:-all}" > "$T/repo/.opencode/agents/arc-commit-fence.md"
  [ -s "$T/repo/.opencode/commands/arc-commit.md" ] || { echo "fence fixture empty"; return 1; }
}

@test "distribute-opencode-session: a command with a rendered fence runs the whole session as that fence" {
  fence_files || false
  wrap 0.10 30 fenced.jsonl
  [ -s "$T/invoked" ] && [ -s "$T/argv.json" ] || { echo "the fake never ran: $output $stderr"; false; }
  [ "$status" -eq 0 ] || { echo "status $status: $output $stderr"; false; }
  run node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).join(" "))' "$(native "$T/argv.json")"
  printf '%s' "$output" | grep -qE -- '--command arc-commit --agent arc-commit-fence -m ' || { echo "argv: $output"; false; }
  head -1 "$T/repo/ev/transcripts/fenced.jsonl" | tr -d '\r' | grep -qE ' fence=arc-commit-fence$' || { head -1 "$T/repo/ev/transcripts/fenced.jsonl"; false; }
  [ ! -e "$T/repo/ev/transcripts/fenced.jsonl.pid" ] || { echo "a clean run left its pidfile"; false; }
}

@test "distribute-opencode-session: a command naming a missing fence is refused NO-FENCE before spend" {
  fence_files no-agent || false
  wrap 0.10 30 nofence.jsonl
  [ "$status" -eq 2 ] || { echo "status $status: $output $stderr"; false; }
  printf '%s\n' "$stderr" | tr -d '\r' | grep -qE '^opencode-session: REFUSED NO-FENCE: .*arc-commit-fence.*missing' || { echo "$stderr"; false; }
  [ ! -e "$T/invoked" ] || { echo "the fake ran although the fence was missing"; false; }
  # A stale render (a subagent-only fence) is refused too: it would bind a task, never the session (attack 8707a5c B4).
  fence_files agent subagent || false
  wrap 0.10 30 stale.jsonl
  [ "$status" -eq 2 ] && printf '%s
' "$stderr" | tr -d '
' | grep -qE '^opencode-session: REFUSED NO-FENCE: .*not a session fence' || { echo "stale: status $status: $stderr"; false; }
  [ ! -e "$T/invoked" ] || { echo "the fake ran under a stale fence"; false; }
  # A command whose source has allowed-tools and whose render is gone is refused, never run unfenced (L1).
  mkdir -p "$T/repo/.claude/commands" && printf -- '---
description: c
allowed-tools: Bash(git status)
---
body
' > "$T/repo/.claude/commands/arc-commit.md"
  rm -f "$T/repo/.opencode/commands/arc-commit.md" "$T/repo/.opencode/agents/arc-commit-fence.md"
  wrap 0.10 30 norender.jsonl
  [ "$status" -eq 2 ] && printf '%s
' "$stderr" | tr -d '
' | grep -qE '^opencode-session: REFUSED NO-FENCE: .*missing while the command has a fence' || { echo "no render: status $status: $stderr"; false; }
  [ ! -e "$T/invoked" ] || { echo "the fake ran with no render"; false; }
  rm -rf "$T/repo/.claude"
  # Positive control in the same repo: with the fence in place the same command runs.
  fence_files || false
  wrap 0.10 30 nofence-control.jsonl
  [ "$status" -eq 0 ] && [ -s "$T/invoked" ] || { echo "control: status $status: $stderr"; false; }
}

@test "distribute-opencode-session: a wrapper killed mid-run leaves its pidfile, and the next run reaps the orphan before spending" {
  # Detached on every OS (its own session on POSIX), so neither the job nor a group kill can reach it: only the
  # recorded tree can (attack 8707a5c L5, L12).
  export FAKE_OC_MODE=stall FAKE_OC_GRANDCHILD="$(native "$T/grandchild")" FAKE_OC_GRANDCHILD_MS=60000 FAKE_OC_GRANDCHILD_DETACH=1
  node "$WRAP" --cap-usd 0.10 --timeout-s 120 --model openrouter/deepseek/deepseek-v4-flash-0731 --command arc-commit \
    --cwd "$(native "$T/repo")" --transcript "$(native "$T/repo/ev/transcripts/orphan.jsonl")" --ledger-dir "$(native "$T/repo/ev")" \
    -- "commit it" > "$T/w1.out" 2>&1 &
  local wpid=$! i
  # Windows records the tree as it grows (the wrapper's death takes only its direct children); wait for all three.
  local want='writeFileSync'
  for i in $(seq 1 100); do [ -s "$T/invoked" ] && grep -qE "$want" "$T/repo/ev/transcripts/orphan.jsonl.pid" 2>/dev/null && break; sleep 0.2; done
  [ -s "$T/invoked" ] && [ -s "$T/repo/ev/transcripts/orphan.jsonl.pid" ] || { kill -9 "$wpid" 2>/dev/null; echo "the first run never spawned: $(cat "$T/w1.out")"; false; }
  # The wrapper dies the way P07 run 5b's did: no signal handler runs, so killTree never runs.
  kill -9 "$wpid"; wait "$wpid" 2>/dev/null || true
  [ -s "$T/repo/ev/transcripts/orphan.jsonl.pid" ] || { echo "the pidfile went with the wrapper"; false; }
  local gpid
  gpid=$(node -e 'const t=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).tree.find((x)=>x.cmd.includes("writeFileSync"));process.stdout.write(t?String(t.pid):"")' "$(native "$T/repo/ev/transcripts/orphan.jsonl.pid")")
  [ -n "$gpid" ] || { echo "the record never named the grandchild"; false; }
  node -e 'process.kill(Number(process.argv[1]),0)' "$gpid" || { echo "the grandchild was already gone before the reap: the control proves nothing"; false; }
  rm -f "$T/invoked"
  unset FAKE_OC_GRANDCHILD FAKE_OC_GRANDCHILD_DETACH
  export FAKE_OC_MODE=ok
  wrap 0.10 30 after.jsonl
  [ -s "$T/invoked" ] || { echo "the second run never spawned: $output $stderr"; false; }
  [ "$status" -eq 0 ] || { echo "status $status: $output $stderr"; false; }
  printf '%s\n' "$stderr" | tr -d '\r' | grep -qE '^opencode-session: reaped: pid=[0-9]+ tree=[0-9]+ from .*orphan\.jsonl\.pid$' || { echo "no reap line: $stderr"; false; }
  [ ! -e "$T/repo/ev/transcripts/orphan.jsonl.pid" ] || { echo "the stale pidfile was not cleared"; false; }
  run node -e 'try{process.kill(Number(process.argv[1]),0);process.stdout.write("alive")}catch(e){process.stdout.write(e.code)}' "$gpid"
  [ "$output" = "ESRCH" ] || { echo "the orphaned grandchild $gpid outlived the reap ($output) and could keep spending"; node -e 'try{process.kill(Number(process.argv[1]),9)}catch{}' "$gpid"; false; }
  [ ! -e "$T/grandchild" ] || { echo "the grandchild wrote its marker"; false; }
}
