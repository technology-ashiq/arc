#!/usr/bin/env bats
# Cycle 16 Phase 00 (REQ-01) -- the renderer becomes session-safe and iteration-safe.
#
# Why this suite exists: design-render.sh keys its output path on the ROUTE alone
# (`$OUT_DIR/$SLUG.png`) and its stale-duplicate guard skips a meta only by path identity.
# So a same-route re-render overwrites the single file at that path, and nothing reads a
# session to decide anything. Under ADR-1401 the composer renders one variant repeatedly,
# and its most valuable signal is "my revision changed nothing" -- identical pixels across
# two iterations. Today that is classed as a stale browser page, REFUSED, and the evidence
# is deleted. ADR-1417 makes the discriminator (route, session) and `unchanged: true` a
# first-class outcome.
#
# These cases drive the fake agent-browser for the same reason design-steel-thread.bats does:
# CI installs no browser, so a test needing one would skip on every leg and guard nothing.
bats_require_minimum_version 1.5.0
load 'test_helper'

# Sandbox with design-render.sh, three real routes, and the fake browser first on PATH.
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
  git -C "$SANDBOX" add -A >/dev/null 2>&1
  git -C "$SANDBOX" commit -qm routes >/dev/null 2>&1
  RENDERS="$SANDBOX/.claude/state/design/renders"
}

_rs() { echo "$SANDBOX/.claude/scripts/design/design-render.sh"; }

# Reset the fake's shot counter so the next render starts at the head of FAKE_AB_SHOTS.
_reset_shots() { rm -f "$SANDBOX/fakestate/count" 2>/dev/null || true; }

teardown() { _arc_teardown; }

# ---------- 1. the two red-first anchors named in phase-00-spec ----------

@test "render_requires_session_in_explore_mode" {
  _session_sandbox
  # Explore mode with no --session must REFUSE. There is no default here on purpose: a
  # shared session is exactly what races three parallel composers, and a silent fallback
  # would reintroduce the race while looking like it worked.
  FAKE_AB_SHOTS="A A" run bash "$(_rs)" docs/one.html --mode explore
  [ "$status" -eq 1 ]
  echo "$output" | grep -q -- "--session is required in explore mode"
  # Refusing means publishing nothing.
  [ -z "$(ls -A "$RENDERS" 2>/dev/null || true)" ]
}

@test "session_less_meta_is_refused" {
  _session_sandbox
  # A meta written without a session field must REFUSE rather than fall through to the old
  # route-only comparison. If it fell through, ADR-1417 would silently revert in code while
  # every line of the spec still read as correct.
  mkdir -p "$RENDERS/legacy"
  FAKE_AB_SHOTS="Z Z" run bash "$(_rs)" docs/one.html --mode explore --session s1
  [ "$status" -eq 0 ]
  local sha; sha="$(grep -o '"screenshot_sha256": "[^"]*"' "$RENDERS/s1/docs--one-html.json" | cut -d'"' -f4)"
  # Plant a session-less meta carrying that same hash.
  printf '{\n  "route": "docs/two.html",\n  "screenshot_sha256": "%s"\n}\n' "$sha" \
    > "$RENDERS/legacy/docs--two-html.json"
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
  # The whole point: a revision that changed nothing is a RESULT, not a fault.
  [ "$status" -eq 0 ]
  [ -f "$RENDERS/s1/docs--one-html--iter-2.png" ]
  grep -q '"unchanged": true' "$RENDERS/s1/docs--one-html--iter-2.json"
  # And iteration 1 is still on disk -- immutable, per ADR-1401.
  [ -f "$RENDERS/s1/docs--one-html--iter-1.png" ]
}

@test "cross-route-duplicate: two different routes with identical pixels still REFUSE" {
  _session_sandbox
  FAKE_AB_SHOTS="A A" run bash "$(_rs)" docs/one.html --mode explore --session s1
  [ "$status" -eq 0 ]
  _reset_shots
  # Same pixels under a different route name is the stale-page symptom the guard was built
  # for. Session-scoping must not weaken it.
  FAKE_AB_SHOTS="A A" run bash "$(_rs)" docs/two.html --mode explore --session s1
  [ "$status" -eq 1 ]
  echo "$output" | grep -q "already recorded for"
  [ ! -f "$RENDERS/s1/docs--two-html.png" ]
}

@test "cross-session-same-route: one route rendered identically under a fresh session REFUSES" {
  _session_sandbox
  FAKE_AB_SHOTS="A A" run bash "$(_rs)" docs/one.html --mode explore --session s1
  [ "$status" -eq 0 ]
  _reset_shots
  # A crash-retry that minted a new session id and produced byte-identical pixels never
  # re-rendered. ADR-1417 left this case unspecified; the simulation gate caught it.
  FAKE_AB_SHOTS="A A" run bash "$(_rs)" docs/one.html --mode explore --session s2
  [ "$status" -eq 1 ]
  echo "$output" | grep -q "never re-rendered"
}

# ---------- 3. the migration contract: existing callers must not change ----------

@test "default mode is critique and defaults the session, so an unmodified caller still works" {
  _session_sandbox
  # No --mode, no --session: exactly how design-critique.sh calls it today.
  FAKE_AB_SHOTS="A A" run bash "$(_rs)" docs/one.html
  [ "$status" -eq 0 ]
  # The literal preserved from L62, so critique renders keep their isolation from a QA session.
  [ -f "$RENDERS/design-critic/docs--one-html.png" ]
  grep -q '"session": "design-critic"' "$RENDERS/design-critic/docs--one-html.json"
}

@test "critique mode does not require --session but explore mode does" {
  _session_sandbox
  FAKE_AB_SHOTS="A A" run bash "$(_rs)" docs/one.html --mode critique
  [ "$status" -eq 0 ]
}

@test "an unknown --mode value refuses rather than silently choosing one" {
  _session_sandbox
  FAKE_AB_SHOTS="A A" run bash "$(_rs)" docs/one.html --mode explor --session s1
  [ "$status" -eq 1 ]
  echo "$output" | grep -q -- "--mode takes explore or critique"
}

# ---------- 4. the iteration flag ----------

@test "--iter outside 1-3 refuses (ADR-1401 caps the loop at three)" {
  _session_sandbox
  FAKE_AB_SHOTS="A A" run bash "$(_rs)" docs/one.html --mode explore --session s1 --iter 4
  [ "$status" -eq 1 ]
  echo "$output" | grep -q -- "--iter takes 1, 2 or 3"
}

@test "meta carries session, iter and unchanged on every render" {
  _session_sandbox
  FAKE_AB_SHOTS="A A" run bash "$(_rs)" docs/one.html --mode explore --session s1 --iter 1
  [ "$status" -eq 0 ]
  local m="$RENDERS/s1/docs--one-html--iter-1.json"
  grep -q '"session": "s1"'   "$m"
  grep -q '"iter": 1'         "$m"
  grep -q '"unchanged": false' "$m"
  # The pre-existing keys are untouched -- this is an extension, not a rewrite.
  grep -q '"route"'             "$m"
  grep -q '"screenshot_sha256"' "$m"
  grep -q '"viewport"'          "$m"
  grep -q '"recipe"'            "$m"
}

# ---------- 5. REQ-01's headline acceptance: three concurrent renders ----------

@test "3 concurrent renders produce 3 correct route/hash pairs, 5 times running" {
  _session_sandbox
  # Repeated because the guard walks the renders tree with no lock while sibling processes
  # are still writing. One green run is a coin, not a gate -- this repo has already shipped
  # a control that passed six CI legs by luck.
  local round pid1 pid2 pid3 st1 st2 st3
  for round in 1 2 3 4 5; do
    rm -rf "$RENDERS"; _reset_shots
    # Three DIFFERENT routes, three DIFFERENT sessions, all at once. Distinct payloads, so
    # identical pixels never legitimately arise here.
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
    # Each session holds exactly its own route, with its own hash.
    grep -q '"route": "docs/one.html"'   "$RENDERS/r$round-a/docs--one-html.json"
    grep -q '"route": "docs/two.html"'   "$RENDERS/r$round-b/docs--two-html.json"
    grep -q '"route": "docs/three.html"' "$RENDERS/r$round-c/docs--three-html.json"
    # No cross-contamination: three distinct hashes.
    local h1 h2 h3
    h1="$(grep -o '"screenshot_sha256": "[^"]*"' "$RENDERS/r$round-a/docs--one-html.json")"
    h2="$(grep -o '"screenshot_sha256": "[^"]*"' "$RENDERS/r$round-b/docs--two-html.json")"
    h3="$(grep -o '"screenshot_sha256": "[^"]*"' "$RENDERS/r$round-c/docs--three-html.json")"
    [ "$h1" != "$h2" ]; [ "$h2" != "$h3" ]; [ "$h1" != "$h3" ]
  done
}

# ---------- 6. the stable-shutter guard, re-proved (not rebuilt) ----------

@test "the same route hashes identically across 3 runs on this platform" {
  _session_sandbox
  local a b c
  FAKE_AB_SHOTS="S S" run bash "$(_rs)" docs/one.html --mode explore --session x1
  [ "$status" -eq 0 ]
  a="$(grep -o '"screenshot_sha256": "[^"]*"' "$RENDERS/x1/docs--one-html.json")"
  # A fresh session each time, because an identical hash for the same route under a new
  # session is a refusal by design -- so stability is proved on the hash the run PRINTS.
  _reset_shots
  FAKE_AB_SHOTS="S S" run bash "$(_rs)" docs/one.html --mode explore --session x2
  b="$(echo "$output" | grep -o 'screenshot_sha256: .*' | awk '{print $2}')"
  _reset_shots
  FAKE_AB_SHOTS="S S" run bash "$(_rs)" docs/one.html --mode explore --session x3
  c="$(echo "$output" | grep -o 'screenshot_sha256: .*' | awk '{print $2}')"
  a="${a##*\": \"}"; a="${a%\"}"
  [ -n "$a" ] && [ "$a" = "$b" ] && [ "$b" = "$c" ]
}
