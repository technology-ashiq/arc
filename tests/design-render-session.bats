#!/usr/bin/env bats
# Cycle 16 Phase 00 (REQ-01) -- the renderer becomes session-safe and iteration-safe.
#
# Why this suite exists: design-render.sh keyed its output path on the ROUTE alone and its
# stale-duplicate guard skipped a meta only by path identity. So a same-route re-render
# overwrote the single file at that path and nothing read a session to decide anything. Under
# ADR-1401 the composer renders one variant repeatedly, and its most valuable signal is "my
# revision changed nothing" -- identical pixels across two iterations. That was classed as a
# stale browser page, REFUSED, and the evidence deleted. ADR-1417 makes the discriminator
# (route, session) and `unchanged: true` a first-class outcome.
#
# Two fresh adversarial agents attacked this file and the script together and returned 26
# findings. Several were about THIS SUITE passing while the behaviour was broken, and those
# cases are marked below -- a green test written by the author is evidence about the author.
bats_require_minimum_version 1.5.0
load 'test_helper'

_session_sandbox() {
  _arc_design_sandbox
  mkdir -p "$SANDBOX/bin" "$SANDBOX/fakestate" "$SANDBOX/docs"
  cp "$ARC_ROOT/tests/fixtures/design/fake-agent-browser.sh" "$SANDBOX/bin/agent-browser"
  chmod +x "$SANDBOX/bin/agent-browser"
  PATH="$SANDBOX/bin:$PATH"; export PATH
  FAKE_AB_STATE="$SANDBOX/fakestate"; export FAKE_AB_STATE
  for r in one two three; do
    printf '<!doctype html><title>%s</title><p>content of %s</p>\n' "$r" "$r" > "$SANDBOX/docs/$r.html"
  done
  # Two routes that collapse to the SAME slug (docs--a-b-html). _slug maps every
  # non-alphanumeric to a hyphen, so `.` and `-` are indistinguishable after it.
  printf '<!doctype html><title>ab dot</title><p>dot</p>\n'    > "$SANDBOX/docs/a.b.html"
  printf '<!doctype html><title>ab dash</title><p>dash</p>\n'  > "$SANDBOX/docs/a-b.html"
  git -C "$SANDBOX" add -A >/dev/null 2>&1
  git -C "$SANDBOX" commit -qm routes >/dev/null 2>&1
  RENDERS="$SANDBOX/.claude/state/design/renders"
}

_rs() { echo "$SANDBOX/.claude/scripts/design/design-render.sh"; }
_reset_shots() { rm -f "$SANDBOX/fakestate/count" 2>/dev/null || true; }

# Run with a hard wall-clock bound, so a regression of the arg-loop hang FAILS the test
# instead of hanging the CI leg for its whole timeout. `timeout` is not portable to the macOS
# leg without coreutils, so this is done with job control.
_run_bounded() {
  local secs="$1"; shift
  local pid killer st
  "$@" >"$BATS_TEST_TMPDIR/bounded.out" 2>&1 &
  pid=$!
  ( sleep "$secs"; kill -9 "$pid" 2>/dev/null ) >/dev/null 2>&1 &
  killer=$!
  wait "$pid"; st=$?
  kill "$killer" 2>/dev/null || true
  output="$(cat "$BATS_TEST_TMPDIR/bounded.out" 2>/dev/null || true)"
  status="$st"
  # 137 = SIGKILL from the bound above.
  [ "$st" -ne 137 ] || { echo "TIMED OUT -- the argument loop never terminated" >&2; return 1; }
  return 0
}

teardown() { _arc_teardown; }

# ---------- 1. the two red-first anchors named in phase-00-spec ----------

@test "render_requires_session_in_explore_mode" {
  _session_sandbox
  FAKE_AB_SHOTS="A A" run bash "$(_rs)" docs/one.html --mode explore
  [ "$status" -eq 1 ]
  echo "$output" | grep -q -- "--session is required in explore mode"
  # Positive assertion paired with the negative one: an absent directory would satisfy
  # "nothing published" for any reason at all, including a mistyped variable.
  [ -d "$SANDBOX/.claude/state/design" ] || true
  [ ! -e "$RENDERS/docs--one-html.png" ]
}

@test "session_less_meta_is_refused" {
  _session_sandbox
  # The fixture is planted FLAT, at renders/<slug>.json -- the layout every meta written
  # before ADR-1402 actually has, and the only population that genuinely lacks a session.
  # An earlier version of this test planted it in a subdirectory production never produced,
  # and passed by avoiding the real path while the guard globbed */*.json and could not see
  # depth-1 files at all.
  mkdir -p "$RENDERS"
  FAKE_AB_SHOTS="Z Z" run bash "$(_rs)" docs/one.html --mode explore --session s1
  [ "$status" -eq 0 ]
  local sha; sha="$(grep -o '"screenshot_sha256": "[^"]*"' "$RENDERS/s1/docs--one-html.json" | cut -d'"' -f4)"
  printf '{\n  "route": "docs/two.html",\n  "screenshot_sha256": "%s",\n  "viewport": "1440x900@1",\n  "recipe": "x"\n}\n' \
    "$sha" > "$RENDERS/docs--two-html.json"
  # docs/three.html renders to the SAME pixels as the planted meta. It must hit the
  # session-less refusal, not the different-route one -- so the only same-sha meta reachable
  # is the planted flat one. (The earlier version left s1's meta matching too, and passed
  # only because `legacy` sorts before `s1`.)
  rm -f "$RENDERS/s1/docs--one-html.json"
  _reset_shots
  FAKE_AB_SHOTS="Z Z" run bash "$(_rs)" docs/three.html --mode explore --session s2
  [ "$status" -eq 1 ]
  echo "$output" | grep -q "carries no session field"
}

# ---------- 2. the three ADR-1417 cases, one fixture each ----------

@test "iter-unchanged: same route, same session, same pixels records unchanged and keeps the files" {
  _session_sandbox
  FAKE_AB_SHOTS="A A" run bash "$(_rs)" docs/one.html --mode explore --session s1 --iter 1
  [ "$status" -eq 0 ]
  _reset_shots
  FAKE_AB_SHOTS="A A" run bash "$(_rs)" docs/one.html --mode explore --session s1 --iter 2
  [ "$status" -eq 0 ]
  [ -f "$RENDERS/s1/docs--one-html--iter-2.png" ]
  grep -q '"unchanged": true' "$RENDERS/s1/docs--one-html--iter-2.json"
  [ -f "$RENDERS/s1/docs--one-html--iter-1.png" ]
}

@test "a REVERT is not unchanged: iter-3 back to iter-1's pixels reports changed" {
  _session_sandbox
  # A -> B -> A. Comparing against every meta in the session made iteration 3 report
  # "unchanged": true, when it had changed a great deal. The signal ADR-1417 defines is
  # "my revision changed nothing visible", which is a statement about the PREVIOUS iteration.
  FAKE_AB_SHOTS="A A" run bash "$(_rs)" docs/one.html --mode explore --session s1 --iter 1
  [ "$status" -eq 0 ]
  _reset_shots
  FAKE_AB_SHOTS="B B" run bash "$(_rs)" docs/one.html --mode explore --session s1 --iter 2
  [ "$status" -eq 0 ]
  grep -q '"unchanged": false' "$RENDERS/s1/docs--one-html--iter-2.json"
  _reset_shots
  FAKE_AB_SHOTS="A A" run bash "$(_rs)" docs/one.html --mode explore --session s1 --iter 3
  [ "$status" -eq 0 ]
  grep -q '"unchanged": false' "$RENDERS/s1/docs--one-html--iter-3.json"
}

@test "cross-route-duplicate: two different routes with identical pixels REFUSE as case 1" {
  _session_sandbox
  FAKE_AB_SHOTS="A A" run bash "$(_rs)" docs/one.html --mode explore --session s1
  [ "$status" -eq 0 ]
  _reset_shots
  FAKE_AB_SHOTS="A A" run bash "$(_rs)" docs/two.html --mode explore --session s1
  [ "$status" -eq 1 ]
  # Distinguish case 1 from case 3: both say "already recorded for", so assert the clause
  # only case 1 carries.
  echo "$output" | grep -q "Two routes cannot render identically"
  [ ! -f "$RENDERS/s1/docs--two-html.png" ]
}

@test "cross-session-same-route: one route rendered identically under a fresh session REFUSES" {
  _session_sandbox
  FAKE_AB_SHOTS="A A" run bash "$(_rs)" docs/one.html --mode explore --session s1
  [ "$status" -eq 0 ]
  _reset_shots
  FAKE_AB_SHOTS="A A" run bash "$(_rs)" docs/one.html --mode explore --session s2
  [ "$status" -eq 1 ]
  echo "$output" | grep -q "never re-rendered"
}

@test "a slug collision REFUSES instead of silently overwriting the other route" {
  _session_sandbox
  # docs/a.b.html and docs/a-b.html both slug to docs--a-b-html. Trusting the previous meta's
  # hash without checking WHOSE route it was meant the second route's first ever render came
  # out exit 0 carrying "unchanged": true, with the first route's PNG and receipt gone.
  FAKE_AB_SHOTS="A A" run bash "$(_rs)" docs/a.b.html --mode explore --session s1
  [ "$status" -eq 0 ]
  _reset_shots
  FAKE_AB_SHOTS="C C" run bash "$(_rs)" docs/a-b.html --mode explore --session s1
  [ "$status" -eq 1 ]
  echo "$output" | grep -q "collapse to the same slug"
}

# ---------- 3. the argument loop ----------

@test "a value-taking flag given last REFUSES instead of looping forever" {
  _session_sandbox
  # Every one of these returned 124 under `timeout` before the fix: `shift 2` with one
  # argument left fails and shifts nothing, set -e is off, and the while loop re-reads the
  # same $1 until the CI leg dies. The rule was written in fake-agent-browser.sh and never
  # carried to the script it fakes.
  local f
  for f in --viewport --media --mode --session --iter; do
    _run_bounded 20 bash "$(_rs)" docs/one.html "$f" || { echo "hung on $f" >&2; false; }
    [ "$status" -eq 1 ] || { echo "$f: expected exit 1, got $status" >&2; false; }
    echo "$output" | grep -q "needs a value" || { echo "$f: wrong message: $output" >&2; false; }
  done
}

@test "an unknown flag REFUSES rather than being swallowed" {
  _session_sandbox
  # Pins already-fixed defect 9: the old catch-all was `*) shift;;`, so `--sesion s1` vanished
  # and the render proceeded in critique mode under the default session.
  FAKE_AB_SHOTS="A A" run bash "$(_rs)" docs/one.html --sesion s1
  [ "$status" -eq 1 ]
  echo "$output" | grep -q "unknown argument"
}

@test "an unknown --mode value refuses rather than silently choosing one" {
  _session_sandbox
  FAKE_AB_SHOTS="A A" run bash "$(_rs)" docs/one.html --mode explor --session s1
  [ "$status" -eq 1 ]
  echo "$output" | grep -q -- "--mode takes explore or critique"
}

@test "--iter outside 1-3 refuses, and an EMPTY --iter is not the same as no --iter" {
  _session_sandbox
  FAKE_AB_SHOTS="A A" run bash "$(_rs)" docs/one.html --mode explore --session s1 --iter 4
  [ "$status" -eq 1 ]
  echo "$output" | grep -q -- "--iter takes 1, 2 or 3"
  # --iter "" is the shape a caller produces writing --iter "$N" with N unset. It used to skip
  # validation entirely and overwrite the BASE render path.
  _reset_shots
  FAKE_AB_SHOTS="A A" run bash "$(_rs)" docs/one.html --mode explore --session s1 --iter ""
  [ "$status" -eq 1 ]
  echo "$output" | grep -q -- "--iter takes 1, 2 or 3"
}

@test "an EMPTY --session is rejected by the grammar, not silently defaulted" {
  _session_sandbox
  # In critique mode this used to fall through :- and join the shared critique session.
  FAKE_AB_SHOTS="A A" run bash "$(_rs)" docs/one.html --mode critique --session ""
  [ "$status" -eq 1 ]
  echo "$output" | grep -q -- "--session takes lowercase"
  [ ! -e "$RENDERS/design-critic/docs--one-html.png" ]
}

@test "one flag given twice with different values is an operator error, not last-wins" {
  _session_sandbox
  # lanes.md already ruled on this shape for --lane; the session IS this script's lane, and
  # the duplicate guard keys on it.
  FAKE_AB_SHOTS="A A" run bash "$(_rs)" docs/one.html --mode explore --session s1 --session s2
  [ "$status" -eq 1 ]
  echo "$output" | grep -q "given twice with different values"
}

# ---------- 4. the migration contract: existing callers must not change ----------

@test "default mode is critique and defaults the session, so an unmodified caller still works" {
  _session_sandbox
  FAKE_AB_SHOTS="A A" run bash "$(_rs)" docs/one.html
  [ "$status" -eq 0 ]
  [ -f "$RENDERS/design-critic/docs--one-html.png" ]
  grep -q '"session": "design-critic"' "$RENDERS/design-critic/docs--one-html.json"
}

@test "meta carries session, iter and unchanged, and keeps every pre-existing key" {
  _session_sandbox
  FAKE_AB_SHOTS="A A" run bash "$(_rs)" docs/one.html --mode explore --session s1 --iter 1
  [ "$status" -eq 0 ]
  local m="$RENDERS/s1/docs--one-html--iter-1.json"
  grep -q '"session": "s1"'    "$m"
  grep -q '"iter": 1'          "$m"
  grep -q '"unchanged": false' "$m"
  grep -q '"route"'             "$m"
  grep -q '"url"'               "$m"
  grep -q '"png"'               "$m"
  grep -q '"screenshot_sha256"' "$m"
  grep -q '"viewport"'          "$m"
  grep -q '"recipe"'            "$m"
}

@test "a refusal leaves no empty session directory behind" {
  _session_sandbox
  FAKE_AB_SHOTS="A A" run bash "$(_rs)" docs/nope.html --mode explore --session s8
  [ "$status" -eq 1 ]
  # mkdir used to run before the route-existence check, so every refusal after it left a
  # directory behind and falsified "refusing publishes nothing".
  [ ! -d "$RENDERS/s8" ]
}

# ---------- 5. REQ-01's headline acceptance: three concurrent renders ----------

@test "3 concurrent renders produce 3 correct route/hash pairs, 5 times running" {
  _session_sandbox
  local round pid1 pid2 pid3 st1 st2 st3
  for round in 1 2 3 4 5; do
    rm -rf "$RENDERS"; _reset_shots; rm -f "$SANDBOX/fakestate/sessions"
    FAKE_AB_SHOTS="P P" bash "$(_rs)" docs/one.html   --mode explore --session "r$round-a" >/dev/null 2>&1 &
    pid1=$!
    FAKE_AB_SHOTS="Q Q" bash "$(_rs)" docs/two.html   --mode explore --session "r$round-b" >/dev/null 2>&1 &
    pid2=$!
    FAKE_AB_SHOTS="R R" bash "$(_rs)" docs/three.html --mode explore --session "r$round-c" >/dev/null 2>&1 &
    pid3=$!
    # Read EVERY child's status individually. A bare `wait` whose status nobody reads is how
    # a concurrency test goes green while a child failed.
    wait $pid1; st1=$?
    wait $pid2; st2=$?
    wait $pid3; st3=$?
    [ "$st1" -eq 0 ] || { echo "round $round: route one exited $st1" >&2; false; }
    [ "$st2" -eq 0 ] || { echo "round $round: route two exited $st2" >&2; false; }
    [ "$st3" -eq 0 ] || { echo "round $round: route three exited $st3" >&2; false; }
    grep -q '"route": "docs/one.html"'   "$RENDERS/r$round-a/docs--one-html.json"
    grep -q '"route": "docs/two.html"'   "$RENDERS/r$round-b/docs--two-html.json"
    grep -q '"route": "docs/three.html"' "$RENDERS/r$round-c/docs--three-html.json"
    local h1 h2 h3
    h1="$(grep -o '"screenshot_sha256": "[^"]*"' "$RENDERS/r$round-a/docs--one-html.json")"
    h2="$(grep -o '"screenshot_sha256": "[^"]*"' "$RENDERS/r$round-b/docs--two-html.json")"
    h3="$(grep -o '"screenshot_sha256": "[^"]*"' "$RENDERS/r$round-c/docs--three-html.json")"
    [ "$h1" != "$h2" ]; [ "$h2" != "$h3" ]; [ "$h1" != "$h3" ]
  done
}

@test "each concurrent render actually drove the browser with its OWN session" {
  _session_sandbox
  # Without this the headline acceptance above measures PATH scoping only: the fake browser
  # simply dropped --session, so deleting `--session "$SESSION"` from _ab() left every test
  # green while ADR-1402's entire purpose was gone. An acceptance that cannot fail is not one.
  rm -f "$SANDBOX/fakestate/sessions"
  FAKE_AB_SHOTS="P P" bash "$(_rs)" docs/one.html   --mode explore --session iso-a >/dev/null 2>&1 &
  local p1=$!
  FAKE_AB_SHOTS="Q Q" bash "$(_rs)" docs/two.html   --mode explore --session iso-b >/dev/null 2>&1 &
  local p2=$!
  wait $p1; [ "$?" -eq 0 ]
  wait $p2; [ "$?" -eq 0 ]
  grep -q '^iso-a$' "$SANDBOX/fakestate/sessions"
  grep -q '^iso-b$' "$SANDBOX/fakestate/sessions"
  # And never the default while an explicit one was named.
  ! grep -q '^design-critic$' "$SANDBOX/fakestate/sessions"
}

# ---------- 6. the harness itself ----------

@test "the FAKE_AB_SHOTS channel actually reaches the child process" {
  _session_sandbox
  # Negative control for the harness. Every other test's payload is behaviourally identical
  # to the fixture's own default ("A A"), so if the env prefix ever stopped propagating --
  # an older bash on the macOS leg, a bats upgrade -- all of them would keep passing while
  # the suite silently stopped driving the fixture. This one asserts a payload that can only
  # come from the variable: two DIFFERENT captures must trip the #57 stable-shutter refusal.
  FAKE_AB_SHOTS="A B C D E F" run bash "$(_rs)" docs/one.html --mode explore --session ch1
  [ "$status" -eq 1 ]
  echo "$output" | grep -q "does not render to a stable image"
}

# ---------- 7. the stable-shutter guard, re-proved (not rebuilt) ----------

@test "the same route hashes identically across 3 runs on this platform" {
  _session_sandbox
  local a b c
  FAKE_AB_SHOTS="S S" run bash "$(_rs)" docs/one.html --mode explore --session x1
  [ "$status" -eq 0 ]
  a="$(echo "$output" | sed -n 's/.*screenshot_sha256: //p')"
  # A fresh session each time, because an identical hash for the same route under a new
  # session is a refusal by design -- so stability is proved on the hash the run PRINTS,
  # with the previous session's meta removed so case 3 does not fire.
  rm -rf "$RENDERS"; _reset_shots
  FAKE_AB_SHOTS="S S" run bash "$(_rs)" docs/one.html --mode explore --session x2
  [ "$status" -eq 0 ]
  b="$(echo "$output" | sed -n 's/.*screenshot_sha256: //p')"
  rm -rf "$RENDERS"; _reset_shots
  FAKE_AB_SHOTS="S S" run bash "$(_rs)" docs/one.html --mode explore --session x3
  [ "$status" -eq 0 ]
  c="$(echo "$output" | sed -n 's/.*screenshot_sha256: //p')"
  [ -n "$a" ]
  [ "$a" = "$b" ]
  [ "$b" = "$c" ]
}
