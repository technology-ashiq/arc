#!/usr/bin/env bats
# face v2 Phase 00 -- the browser steel thread (ADR-1335, ADR-1336).
#
# What runs where. The offline lockfile check and the planted-error probe need only Chrome and
# node builtins, so they run on EVERY configuration, Node 18 included. `npm ci`, the build and
# the room smoke need Vite 8's Node floor (^20.19 || >=22.12): on the Node 18 configuration they
# are a counted SKIP, and below the floor on any other configuration they FAIL, so no Node-20
# leg can pass by skipping.
#
# Chrome that cannot be found is a FAILURE naming every place looked, never a skip.
#
# Cheap checks first: the lockfile and Chrome tests leave a marker, and the install refuses to
# spend minutes of network when either cheaper check has already failed.
#
# Every `run node` that starts Chrome, a door or a preview closes fd 3 (`3>&-`): a child that
# inherits bats' fd 3 and outlives its parent keeps bats waiting, which on a runner with no job
# timeout is a six-hour hang (tests/spine-concurrency.bats has the same guard, same reason).
#
# The build runs in a COPY of face/ under $BATS_FILE_TMPDIR, so node_modules never lands in the
# repo tree that other suites walk. Tests in this file run in order and share that copy.
#
# Every program is its own file: this suite runs no inline program text, and the last-but-one
# test asserts that of this very file.
bats_require_minimum_version 1.5.0
load 'test_helper'

FLOOR_SKIP="SKIP: Vite 8 and @tailwindcss/oxide require Node >=20.19"

require_node_floor() {
  local line major
  line="$(node "$ARC_ROOT/face/scripts/node-floor.mjs")"
  case "$line" in *"floor=ok"*) return 0 ;; esac
  major="$(printf '%s\n' "$line" | sed -n 's/.* major=\([0-9][0-9]*\)$/\1/p')"
  if [ "$major" = "18" ]; then
    skip "$FLOOR_SKIP ($line)"
  fi
  echo "below the L3 floor on a configuration that must run the browser suite: $line"
  return 1
}

# The summary verdict, shared by the real run and its mutant controls, so the controls exercise
# exactly the extraction and the ordering the real run relies on -- never a copy of them.
# One call judges ONE mood's line (face v2 Phase 01, ADR-1331); the mood is a required argument.
smoke_summary_verdict() {
  local out="$1" mood="$2" line opened openable errors unsettled expected miss
  case "$mood" in dark|light) ;; *) echo "no mood named (dark|light), got '$mood'"; return 1 ;; esac
  line="$(printf '%s\n' "$out" | grep "^smoke: opened=.* mood=$mood mood-miss=[0-9][0-9]*\$" | tail -1)"
  [ -n "$line" ] || { echo "no smoke summary line for mood=$mood"; return 1; }
  # Anchored extractions: each value is read from its own position in the summary line, so a
  # later `not-opened=` or `excluded-errors=` can never supply the number.
  opened="$(printf '%s\n' "$line" | sed -n 's/^smoke: opened=\([0-9][0-9]*\) .*/\1/p')"
  openable="$(printf '%s\n' "$line" | sed -n 's/^smoke: opened=[0-9]* openable=\([0-9][0-9]*\) .*/\1/p')"
  errors="$(printf '%s\n' "$line" | sed -n 's/^smoke: opened=[0-9]* openable=[0-9]* errors=\([0-9][0-9]*\) .*/\1/p')"
  unsettled="$(printf '%s\n' "$line" | sed -n 's/^smoke: opened=[0-9]* openable=[0-9]* errors=[0-9]* excluded-errors=[0-9]* unsettled=\([0-9][0-9]*\) .*/\1/p')"
  expected="$(printf '%s\n' "$line" | sed -n 's/^smoke: opened=[0-9]* openable=[0-9]* errors=[0-9]* excluded-errors=[0-9]* unsettled=[0-9]* expected=\([0-9][0-9]*\) .*/\1/p')"
  # Anchored to the END of the line, where the mood pair is the last field: the greedy prefix can
  # only stop at the one place the fixed suffix fits.
  miss="$(printf '%s\n' "$line" | sed -n "s/^smoke: .* mood=$mood mood-miss=\\([0-9][0-9]*\\)\$/\\1/p")"
  # Asserted in this order on purpose: that something RAN, that the door served the contract's
  # rooms, that all of them opened and settled, and only then that it was clean. "errors=0" is
  # also what a smoke that opened nothing prints.
  [ -n "$openable" ] && [ "$openable" -gt 0 ] || { echo "openable=$openable: nothing was checked"; return 1; }
  [ "$expected" = "$openable" ] || { echo "the door served $openable openable rooms, the contract expects $expected"; return 1; }
  [ "$opened" = "$openable" ] || { echo "opened $opened of $openable"; return 1; }
  [ "$unsettled" = "0" ] || { echo "unsettled=$unsettled"; return 1; }
  [ "$errors" = "0" ] || { echo "errors=$errors"; return 1; }
  [ -n "$miss" ] || { echo "mood=$mood: no mood-miss count on the line"; return 1; }
  [ "$miss" = "0" ] || { echo "mood=$mood: mood-miss=$miss rooms rendered without the $mood classes on <html>"; return 1; }
  echo "summary verdict: mood=$mood opened=$opened openable=$openable expected=$expected unsettled=0 errors=0 mood-miss=0"
}

@test "face-browser: the node floor is reported, and only Node 18 may skip" {
  run node "$ARC_ROOT/face/scripts/node-floor.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # Printed on every job, the skipping Node 18 job included: `-latest` labels move, and a skip
  # that does not say which image skipped is not evidence of anything.
  printf '# face-browser: %s image=%s%s\n' "$output" "${ImageOS:-local}" "${ImageVersion:+@$ImageVersion}" >&3
  [[ "$output" == "node=v"*" floor="*" major="* ]] || { echo "unexpected floor line: $output"; false; }
  require_node_floor
}

@test "face-browser: the lockfile carries this platform's native packages (offline)" {
  run node "$ARC_ROOT/face/scripts/lockfile-platforms.mjs"
  echo "$output"
  [[ "$output" == "lockfile: families="* ]] || { echo "the check never reported"; false; }
  local n
  n="$(printf '%s\n' "$output" | sed -n 's/^lockfile: families=\([0-9][0-9]*\) .*/\1/p')"
  [ -n "$n" ] && [ "$n" -ge 1 ] || { echo "no platform family was checked"; false; }
  # The families the build's own dependencies need, BY NAME (face v2 Phase 01): a lockfile whose
  # oxide family was stripped whole still reported "families=3 missing=none" to a count floor.
  local names family
  names="$(printf '%s\n' "$output" | sed -n 's/^lockfile: family-names=\(.*\)$/\1/p')"
  for family in "@tailwindcss/oxide" "lightningcss" "rolldown"; do
    [[ ",$names," == *",$family,"* ]] || { echo "the lockfile declares no $family platform family: $names"; false; }
  done
  [ "$status" -eq 0 ]
  touch "$BATS_FILE_TMPDIR/lockfile.ok"
}

@test "face-browser: a planted console error and exception are seen over REAL Chrome" {
  run node "$ARC_ROOT/face/scripts/smoke.mjs" --probe-file "$ARC_ROOT/tests/fixtures/face/planted-error.html" 3>&-
  echo "$output"
  [[ "$output" == *"probe: errors="* ]] || { echo "the probe never reported (exit $status)"; false; }
  [ "$status" -eq 1 ] || { echo "expected exit 1 -- errors seen -- got $status"; false; }
  [[ "$output" == *"planted-face-v2-console-error"* ]] || { echo "the console error was not seen"; false; }
  [[ "$output" == *"planted-face-v2-exception"* ]] || { echo "the exception was not seen"; false; }
  touch "$BATS_FILE_TMPDIR/chrome.ok"
}

@test "face-browser: npm ci and vite build succeed in a copy of face/" {
  require_node_floor
  [ -f "$BATS_FILE_TMPDIR/lockfile.ok" ] || { echo "the lockfile check failed above -- not spending an install on it"; false; }
  [ -f "$BATS_FILE_TMPDIR/chrome.ok" ] || { echo "the Chrome probe failed above -- not spending an install on it"; false; }
  local dst="$BATS_FILE_TMPDIR/face"
  rm -rf "$dst"
  cp -R "$ARC_ROOT/face" "$dst"
  rm -rf "$dst/node_modules" "$dst/dist"
  run npm --prefix "$dst" ci --include=optional --no-audit --no-fund 3>&-
  [ "$status" -eq 0 ] || { printf '%s\n' "$output" | tail -40; false; }
  [ -f "$dst/node_modules/vite/package.json" ] || { echo "npm ci exited 0 but vite is not installed"; false; }
  run node "$dst/node_modules/vite/bin/vite.js" build "$dst" 3>&-
  [ "$status" -eq 0 ] || { printf '%s\n' "$output" | tail -40; false; }
  [ -f "$dst/dist/index.html" ] || { echo "vite build exited 0 but wrote no dist/index.html"; false; }
  # Tailwind compiled (face v2 Phase 01): a utility only the kit uses must be in the emitted
  # stylesheet, and so must the light remap -- `--color-white` is emitted by the @variant hq-light
  # block alone, never by the token copy, so it proves the custom variant compiled. A build that
  # styles nothing logs no error for the smoke to see.
  local css
  css="$(cat "$dst"/dist/assets/*.css 2>/dev/null || true)"
  [ -n "$css" ] || { echo "vite build wrote no stylesheet under dist/assets"; false; }
  [[ "$css" == *'.text-\[22px\]'* ]] || { echo "the built CSS carries none of the kit's utilities -- Tailwind did not compile the kit"; false; }
  [[ "$css" == *'--color-white'* ]] || { echo "the built CSS carries no light remap -- the @variant hq-light block did not compile"; false; }
}

@test "face-browser: door + preview + smoke open every openable room with 0 errors, in BOTH moods" {
  require_node_floor
  local dst="$BATS_FILE_TMPDIR/face"
  [ -f "$dst/dist/index.html" ] || { echo "no build from the previous test"; false; }
  run node "$ARC_ROOT/face/scripts/harness-run.mjs" --face "$dst" 3>&-
  echo "$output"
  [[ "$output" == *"face-browser: RAN leg="* ]] || { echo "the harness never started (exit $status)"; false; }
  # bats prints `$output` only when a test FAILS, so on a green job the evidence Phase 00 lists
  # per job -- which leg RAN, each mood's summary, any SLOW room and what its network held at
  # 10 s -- would never reach the log. fd 3 does.
  printf '%s\n' "$output" | grep -E '^(face-browser: RAN leg=|face-browser: mood=|smoke: opened=|smoke: WARN |smoke: FAIL |face-browser: [0-9]+/[0-9]+ rooms|ok [a-z0-9-]+ settle-ms=[0-9]+ SLOW )' | sed 's/^/# /' >&3 || true
  # Both moods are judged, each from its own line, before the exit status is trusted: a harness
  # that ran only dark must not pass on dark's line (ADR-1331).
  local mood verdicts=0
  for mood in dark light; do
    smoke_summary_verdict "$output" "$mood" || { echo "(harness exit $status)"; false; }
    verdicts=$((verdicts + 1))
  done
  [ "$verdicts" -eq 2 ] || { echo "judged $verdicts of 2 moods"; false; }
  [ "$status" -eq 0 ]
}

@test "face-browser: MUTANT CONTROL -- the summary verdict FAILS a stub smoke that never navigated" {
  # The verification plan's control, at the layer that gates: the stub exits 0 having opened
  # nothing, and the SAME function the real run uses must refuse its numbers. Needs no Chrome,
  # no build and no Vite floor, so it runs on every configuration, Node 18 included.
  run node "$ARC_ROOT/tests/fixtures/face/stub-smoke.mjs"
  [ "$status" -eq 0 ] || { echo "the stub itself did not run: $output"; false; }
  [[ "$output" == *"smoke: opened=0 openable="* ]] || { echo "the stub printed no summary: $output"; false; }
  local stub="$output"
  run smoke_summary_verdict "$stub" dark
  [ "$status" -ne 0 ] || { echo "the summary verdict passed a smoke that opened nothing: $output"; false; }
  [[ "$output" == *"opened 0 of "* ]] || { echo "refused for the wrong reason: $output"; false; }
}

@test "face-browser: MUTANT CONTROL -- the verdict FAILS a mood run in the wrong mood, and a mood that never ran" {
  # A full, clean, settled line whose rooms rendered without the light classes: every count the
  # Phase 00 verdict read is perfect, and only the mood pair can refuse it.
  local line="smoke: opened=33 openable=33 errors=0 excluded-errors=0 unsettled=0 expected=33 not-opened=lane mood=light mood-miss=33"
  run smoke_summary_verdict "$line" light
  [ "$status" -ne 0 ] || { echo "the verdict passed a light run whose rooms were not light: $output"; false; }
  [[ "$output" == *"mood-miss=33"* ]] || { echo "refused for the wrong reason: $output"; false; }
  # The same clean line with mood-miss=0 must pass, or the refusal above proves nothing.
  run smoke_summary_verdict "${line% mood-miss=33} mood-miss=0" light
  [ "$status" -eq 0 ] || { echo "the verdict refused a clean light line: $output"; false; }
  # Only dark ran: light's verdict must not borrow dark's line.
  run smoke_summary_verdict "${line/mood=light mood-miss=33/mood=dark mood-miss=0}" light
  [ "$status" -ne 0 ] || { echo "light passed on a dark line: $output"; false; }
  [[ "$output" == *"no smoke summary line for mood=light"* ]] || { echo "refused for the wrong reason: $output"; false; }
  run smoke_summary_verdict "${line% mood-miss=33} mood-miss=0" ""
  [ "$status" -ne 0 ] && [[ "$output" == *"no mood named"* ]] || { echo "a verdict with no mood named did not refuse: $output"; false; }
}

@test "face-browser: this file runs no inline program text" {
  # The header's claim, checked rather than trusted. Split tokens keep this test from matching
  # its own source line.
  local e="-e" c="-c" hits
  hits="$(grep -nE "(node|bash|sh|python3?) +(${e}|--eval|${c}) " "$BATS_TEST_FILENAME" | grep -v 'local e=' || true)"
  [ -z "$hits" ] || { echo "inline program text found: $hits"; false; }
  local runs
  runs="$(grep -cE '^[[:space:]]+run node ' "$BATS_TEST_FILENAME")"
  [ "$runs" -ge 5 ] || { echo "only $runs run-node lines -- this check proves nothing"; false; }
  # The rule's automated half, tests/embedded-program-probe.mjs, walks only .sh files -- so this
  # suite and the harness scripts are handed to it BY NAME, and the count it scanned must equal
  # the count handed over, or a file was never looked at.
  local files=("$BATS_TEST_FILENAME" "$ARC_ROOT"/face/scripts/*.mjs) scanned
  run node "$ARC_ROOT/tests/embedded-program-probe.mjs" "${files[@]}"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"EMBEDDED_PROGRAMS_INTACT"* ]] || { echo "the probe did not reach its end: $output"; false; }
  scanned="$(printf '%s\n' "$output" | sed -n 's/^scanned=\([0-9][0-9]*\)$/\1/p')"
  [ -n "$scanned" ] && [ "$scanned" = "${#files[@]}" ] && [ "$scanned" -ge 7 ] || { echo "probe scanned=$scanned of ${#files[@]} files handed to it"; false; }
}

@test "face-browser: every test in this file registered (bats drops non-ASCII names silently)" {
  # This suite is the proof of REQ-09's harness; a test that never registered is a test that
  # never failed. The declared count is the number of @test lines in this file.
  local declared
  declared="$(grep -c '^@test ' "$BATS_TEST_FILENAME")"
  [ "${#BATS_TEST_NAMES[@]}" -eq "$declared" ] || { echo "registered ${#BATS_TEST_NAMES[@]} of $declared declared"; false; }
  [ "$declared" -eq 9 ] || { echo "expected 9 @test lines, found $declared -- update this floor with the file"; false; }
}
