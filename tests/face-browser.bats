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

# The render verdict (face v2 Phase 02, ADR-1321): every room the smoke opened says whether a
# MODULE or the GENERIC module drew it, and the browser's answer must EQUAL the gate's. The third
# argument is face-coverage's own module-half line: the rooms it attaches (served - generic) must be
# exactly the rooms that drew through a module, and its generic rooms, by name and in order, exactly
# the ones that drew generic. A shell that attached nothing cannot pass, an exempted ADR-1327 folder
# the door never serves is not miscounted as a module the browser should have drawn, and an unmarked
# room is a room nobody can account for.
render_verdict() {
  local out="$1" mood="$2" half="$3" line modules generic unmarked openable rooms served gateGeneric gateRooms attached
  case "$mood" in dark|light) ;; *) echo "no mood named (dark|light), got '$mood'"; return 1 ;; esac
  served="$(printf '%s\n' "$half" | sed -n 's/^face-coverage: module half folders=[0-9]* served=\([0-9][0-9]*\) generic=[0-9]* orphans=[0-9]* exemptions=[0-9]* generic-rooms=.*/\1/p')"
  gateGeneric="$(printf '%s\n' "$half" | sed -n 's/^face-coverage: module half folders=[0-9]* served=[0-9]* generic=\([0-9][0-9]*\) orphans=[0-9]* exemptions=[0-9]* generic-rooms=.*/\1/p')"
  gateRooms="$(printf '%s\n' "$half" | sed -n 's/^face-coverage: module half folders=[0-9]* served=[0-9]* generic=[0-9]* orphans=[0-9]* exemptions=[0-9]* generic-rooms=\([^ ]*\) -- .*/\1/p')"
  [ -n "$served" ] && [ -n "$gateGeneric" ] && [ -n "$gateRooms" ] || { echo "no module-half line from face-coverage to judge against: '$half'"; return 1; }
  attached=$((served - gateGeneric))
  [ "$attached" -gt 0 ] || { echo "face-coverage attaches $attached modules: nothing to judge the browser against"; return 1; }
  line="$(printf '%s\n' "$out" | grep "^smoke: render mood=$mood module=[0-9]* generic=[0-9]* unmarked=[0-9]* generic-rooms=" | tail -1)"
  [ -n "$line" ] || { echo "no render line for mood=$mood"; return 1; }
  modules="$(printf '%s\n' "$line" | sed -n "s/^smoke: render mood=$mood module=\([0-9][0-9]*\) generic=[0-9]* unmarked=[0-9]* generic-rooms=.*/\1/p")"
  generic="$(printf '%s\n' "$line" | sed -n "s/^smoke: render mood=$mood module=[0-9]* generic=\([0-9][0-9]*\) unmarked=[0-9]* generic-rooms=.*/\1/p")"
  unmarked="$(printf '%s\n' "$line" | sed -n "s/^smoke: render mood=$mood module=[0-9]* generic=[0-9]* unmarked=\([0-9][0-9]*\) generic-rooms=.*/\1/p")"
  rooms="$(printf '%s\n' "$line" | sed -n "s/^smoke: render mood=$mood module=[0-9]* generic=[0-9]* unmarked=[0-9]* generic-rooms=\([^ ]*\)\$/\1/p")"
  openable="$(printf '%s\n' "$out" | grep "^smoke: opened=.* mood=$mood mood-miss=" | tail -1 | sed -n 's/^smoke: opened=[0-9]* openable=\([0-9][0-9]*\) .*/\1/p')"
  [ "$unmarked" = "0" ] || { echo "mood=$mood: unmarked=$unmarked rooms rendered with no data-render"; return 1; }
  [ "$modules" = "$attached" ] || { echo "mood=$mood: module=$modules rooms drew through a module, face-coverage attaches $attached"; return 1; }
  [ -n "$openable" ] && [ "$((modules + generic))" -eq "$openable" ] || { echo "mood=$mood: module=$modules + generic=$generic != openable=$openable"; return 1; }
  [ "$rooms" = "$gateRooms" ] || { echo "mood=$mood: the browser drew generic '$rooms', face-coverage reports generic '$gateRooms'"; return 1; }
  echo "render verdict: mood=$mood module=$modules generic=$generic unmarked=0, equal to face-coverage's module half"
}

# The rows a derived evidence list names, as a total and as a room:count distribution in the order the
# browser prints it (byte order, which is what a JS sort of the same strings gives). Two lines: the
# total, then the distribution. Used by the NOT SERVED and verb-pending verdicts (face v2 Phase 03).
list_distribution() {
  local dir="$1" glob="$2" rows total dist
  rows="$(cat "$dir"/$glob 2>/dev/null | grep '^| `' || true)"
  total="$(printf '%s' "$rows" | grep -c '^| `' || true)"
  dist="$(printf '%s\n' "$rows" | grep '^| `' | sed -E 's/^\| `([a-z0-9-]+)`.*/\1/' | sort | uniq -c \
    | awk '{ printf "%s:%s\n", $2, $1 }' | LC_ALL=C sort | tr '\n' ',' | sed 's/,$//')"
  printf '%s\n%s\n' "$total" "${dist:-none}"
}

# The flows (face v2 Phase 05, REQ-09, REQ-11): every op the registry holds was driven through its room's dock, its
# receipt read back through the door, and the live flow saw a receipt appended behind the page within 5 s. Judged from
# the ONE line flows.mjs prints, against the registry's own op count -- a run that drove fewer ops cannot pass.
flows_verdict() {
  local out="$1" ops="$2" line
  line="$(printf '%s\n' "$out" | grep '^flows: ' | tail -1)"
  [ -n "$line" ] || { echo "no flows line"; return 1; }
  [[ "$line" =~ ^flows:\ ops=([0-9]+)\ ok=([0-9]+)\ fail=0\ live=ok\ live-ms=([0-9]+)\ page-errors=0$ ]] || { echo "the flows line is not clean: $line"; return 1; }
  [ "$ops" -gt 0 ] && [ "${BASH_REMATCH[1]}" -eq "$ops" ] && [ "${BASH_REMATCH[2]}" -eq "$ops" ] \
    || { echo "flows ran ${BASH_REMATCH[1]} ops with ${BASH_REMATCH[2]} ok, and the registry holds $ops: $line"; return 1; }
  [ "${BASH_REMATCH[3]}" -le 5000 ] || { echo "the live flow saw the change after ${BASH_REMATCH[3]} ms, past 5000: $line"; return 1; }
}

# The session flow (face v2 Phase 06, REQ-08): every served room with a session verb opened and reloaded, a running
# session attached -- and the door journalled 0 start requests; then ONE click made exactly 1. A counter that cannot
# move proves nothing, so the control is part of the line.
sessions_verdict() {
  local out="$1" line
  line="$(printf '%s\n' "$out" | grep '^sessions: ' | tail -1)"
  [ -n "$line" ] || { echo "no sessions line"; return 1; }
  [[ "$line" =~ ^sessions:\ ok\ rooms=([0-9]+)\ reloads=([0-9]+)\ attach=ok\ starts=0\ control=1$ ]] || { echo "the sessions line is not clean: $line"; return 1; }
  [ "${BASH_REMATCH[1]}" -ge 5 ] && [ "${BASH_REMATCH[2]}" -eq "${BASH_REMATCH[1]}" ] \
    || { echo "the session flow opened ${BASH_REMATCH[1]} rooms and reloaded ${BASH_REMATCH[2]}: $line"; return 1; }
}

# The planned rooms' REHEARSAL cards (ADR-1328): what the browser drew EQUALS the derived lists, per room,
# exactly as the work-door cards -- a planned room's flows are rehearsed, never sent to the door (money ring).
rehearsal_verdict() {
  local out="$1" mood="$2" dir="$3" line cards rooms expected roomsExpected dist
  case "$mood" in dark|light) ;; *) echo "no mood named (dark|light), got '$mood'"; return 1 ;; esac
  dist="$(list_distribution "$dir" "rehearsal-*.md")"
  expected="$(printf '%s\n' "$dist" | head -1)"
  roomsExpected="$(printf '%s\n' "$dist" | tail -1)"
  line="$(printf '%s\n' "$out" | grep "^smoke: rehearsal mood=$mood cards=" | tail -1)"
  cards="$(printf '%s\n' "$line" | sed -n "s/^smoke: rehearsal mood=$mood cards=\([0-9][0-9]*\) rooms=.*/\1/p")"
  rooms="$(printf '%s\n' "$line" | sed -n "s/^smoke: rehearsal mood=$mood cards=[0-9]* rooms=\(.*\)\$/\1/p")"
  [ -n "$cards" ] && [ "$expected" -gt 0 ] && [ "$cards" = "$expected" ] \
    || { echo "mood=$mood: the browser drew '$cards' rehearsal cards, the lists name $expected"; return 1; }
  [ "$rooms" = "$roomsExpected" ] \
    || { echo "mood=$mood: rehearsal cards per room read '$rooms', the lists name '$roomsExpected'"; return 1; }
  echo "rehearsal verdict: mood=$mood cards=$cards rooms=$rooms"
}

# F3 where the owner sees it (Cycle 15 room sweep, ADR-1328): every planned room the CONTRACT names opened marked
# data-planned, and not one of them drew a LIVE pill. The smoke reads the expected rooms from the contract file,
# never from the door it judges, and its own verdict compares them by id; this holds the printed counts.
planned_verdict() {
  local out="$1" mood="$2" line rooms expected live
  case "$mood" in dark|light) ;; *) echo "no mood named (dark|light), got '$mood'"; return 1 ;; esac
  line="$(printf '%s\n' "$out" | grep "^smoke: planned mood=$mood rooms=" | tail -1)"
  rooms="$(printf '%s\n' "$line" | sed -n "s/^smoke: planned mood=$mood rooms=\([0-9][0-9]*\) expected=[0-9]* live=[0-9]* planned-rooms=.*/\1/p")"
  expected="$(printf '%s\n' "$line" | sed -n "s/^smoke: planned mood=$mood rooms=[0-9]* expected=\([0-9][0-9]*\) live=[0-9]* planned-rooms=.*/\1/p")"
  live="$(printf '%s\n' "$line" | sed -n "s/^smoke: planned mood=$mood rooms=[0-9]* expected=[0-9]* live=\([0-9][0-9]*\) planned-rooms=.*/\1/p")"
  [ -n "$expected" ] && [ "$expected" -ge 3 ] && [ "$rooms" = "$expected" ] \
    || { echo "mood=$mood: planned rooms drawn '$rooms', the contract names '$expected': $line"; return 1; }
  [ "$live" = "0" ] || { echo "mood=$mood: a planned room drew LIVE: $line"; return 1; }
  echo "planned verdict: mood=$mood rooms=$rooms live=0"
}

# The one error class the windows runner raises on its own is COUNTED on its own line, never folded into a clean
# zero: it may be non-zero on the windows leg alone, and even there at most two -- one failed resource in one
# room (debt-ledger, money ring). The OS is an argument, so the mutant control below can hold both branches.
runner_verdict() {
  local out="$1" mood="$2" os="$3" line count
  case "$mood" in dark|light) ;; *) echo "no mood named (dark|light), got '$mood'"; return 1 ;; esac
  line="$(printf '%s\n' "$out" | grep "^smoke: runner-errors mood=$mood count=" | tail -1)"
  count="$(printf '%s\n' "$line" | sed -n "s/^smoke: runner-errors mood=$mood count=\([0-9][0-9]*\) rooms=.*/\1/p")"
  [ -n "$count" ] || { echo "mood=$mood: no runner-errors count on the line: '$line'"; return 1; }
  case "$os" in
    MINGW*|MSYS*|CYGWIN*) [ "$count" -le 2 ] || { echo "mood=$mood: $count runner-class errors -- more than one failed resource is not the runner's"; return 1; } ;;
    *) [ "$count" = "0" ] || { echo "mood=$mood: $count runner-class errors on $os, where the class does not apply"; return 1; } ;;
  esac
  echo "runner verdict: mood=$mood count=$count os=$os"
}

# The rooms arc does not serve but the face keeps (ADR-1327): the smoke reads them from the exemption file, never
# from the door it judges, opens each, and prints what it opened against what the file lists. Every one opened with
# no error, and at least the two the owner's ruling left exempt (ADR-1337: executor, agents) -- in both moods.
extras_verdict() {
  local out="$1" mood="$2" line expected opened errors rooms named
  case "$mood" in dark|light) ;; *) echo "no mood named (dark|light), got '$mood'"; return 1 ;; esac
  line="$(printf '%s\n' "$out" | grep "^smoke: extras mood=$mood expected=" | tail -1)"
  # Counts carry no leading zero, and the rooms field names exactly as many rooms as were opened (company ring attack).
  expected="$(printf '%s\n' "$line" | sed -n "s/^smoke: extras mood=$mood expected=\([1-9][0-9]*\) opened=[0-9]* errors=[0-9]* rooms=.*/\1/p")"
  opened="$(printf '%s\n' "$line" | sed -n "s/^smoke: extras mood=$mood expected=[0-9]* opened=\([1-9][0-9]*\) errors=[0-9]* rooms=.*/\1/p")"
  errors="$(printf '%s\n' "$line" | sed -n "s/^smoke: extras mood=$mood expected=[0-9]* opened=[0-9]* errors=\([0-9][0-9]*\) rooms=.*/\1/p")"
  rooms="$(printf '%s\n' "$line" | sed -n "s/^smoke: extras mood=$mood expected=[0-9]* opened=[0-9]* errors=[0-9]* rooms=\([a-z][a-z0-9,-]*\)$/\1/p")"
  named="$(printf '%s\n' "$rooms" | tr ',' '\n' | grep -c '^[a-z][a-z0-9-]*$')"
  [ -n "$expected" ] && [ "$expected" -ge 2 ] && [ "$opened" = "$expected" ] \
    || { echo "mood=$mood: extras opened '$opened', the exemption file lists '$expected': $line"; return 1; }
  [ "$errors" = "0" ] || { echo "mood=$mood: an extra room logged errors: $line"; return 1; }
  [ -n "$rooms" ] && [ "$rooms" != "none" ] && [ "$named" = "$opened" ] || { echo "mood=$mood: the rooms field names '$rooms', not the $opened rooms opened: $line"; return 1; }
  echo "extras verdict: mood=$mood opened=$opened errors=0 rooms=$rooms"
}

# The heading verdict: the LAST heading line for the mood decides, as every other verdict's last line does, and every
# ring's module rooms were checked with none missed -- thirty-six and up (29 served, 3 renamed, 2 extras given
# registry rows and 2 exempt, ADR-1337). A line carrying a carriage return is refused on every OS: Git Bash's grep
# accepted one that Linux grep rejected (company ring attack).
heading_verdict() {
  # Pure bash, no grep and no command substitution: Git Bash strips a carriage return in both, Linux keeps it, and
  # the same forged line must fail on every leg (company ring attack).
  local out="$1" mood="$2" l line="" re
  case "$mood" in dark|light) ;; *) echo "no mood named (dark|light), got '$mood'"; return 1 ;; esac
  while IFS= read -r l || [ -n "$l" ]; do
    case "$l" in "smoke: heading mood=$mood "*) line="$l" ;; esac
  done <<< "$out"
  case "$line" in *$'\r'*) echo "mood=$mood: the heading line carries a carriage return"; return 1 ;; esac
  re="^smoke: heading mood=$mood rings=command,kernel,factory,money,company checked=(3[6-9]|[4-9][0-9]|[1-9][0-9][0-9]+) miss=0\$"
  [[ "$line" =~ $re ]] || { echo "mood=$mood: heading check missing, too few checked, or a miss: '$line'"; return 1; }
  echo "heading verdict: mood=$mood"
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
  # The typecheck joins the build before any module is written (face v2 Phase 02, debt-ledger):
  # `vite build` strips types without checking them, so a type error in face/src never failed CI.
  [ -f "$dst/node_modules/typescript/bin/tsc" ] || { echo "npm ci exited 0 but typescript is not installed"; false; }
  run node "$dst/node_modules/typescript/bin/tsc" -p "$dst" --noEmit 3>&-
  [ "$status" -eq 0 ] || { echo "tsc --noEmit failed (exit $status):"; printf '%s\n' "$output" | tail -60; false; }
  printf '# face-browser: tsc --noEmit exit 0 over %s\n' "$dst/src" >&3
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
  # The gate's own answer first: which rooms face-coverage attaches to a module and which it reports
  # generic. The browser's render line is judged EQUAL to it below (ADR-1321). Read before the harness
  # runs, because `run` replaces $output.
  local half
  run node "$ARC_ROOT/.claude/scripts/core/face-coverage.mjs" "$ARC_ROOT"
  half="$(printf '%s\n' "$output" | grep '^face-coverage: module half ' | tail -1)"
  [ -n "$half" ] || { echo "face-coverage printed no module-half line (exit $status): $output"; false; }
  # How many ops the work door's registry holds -- what the flows line is judged against (REQ-09).
  local opsCount
  opsCount="$(node "$ARC_ROOT/.claude/scripts/hq/face-ops.mjs" --list | grep -c '^    "id": ' || true)"
  [ "$opsCount" -gt 0 ] || { echo "the registry listed no op"; false; }
  run node "$ARC_ROOT/face/scripts/harness-run.mjs" --face "$dst" 3>&-
  echo "$output"
  [[ "$output" == *"face-browser: RAN leg="* ]] || { echo "the harness never started (exit $status)"; false; }
  # bats prints `$output` only when a test FAILS, so on a green job the evidence Phase 00 lists
  # per job -- which leg RAN, each mood's summary, any SLOW room and what its network held at
  # 10 s -- would never reach the log. fd 3 does.
  printf '%s\n' "$output" | grep -E '^(face-browser: RAN leg=|face-browser: mood=|smoke: opened=|smoke: render |smoke: not-served |smoke: served |smoke: verbs-pending|smoke: rehearsal |smoke: planned |smoke: extras |smoke: runner-errors |smoke: largest-body |smoke: heading |smoke: WARN |smoke: FAIL |face-browser: [0-9]+/[0-9]+ rooms|ok [a-z0-9-]+ settle-ms=[0-9]+ SLOW |flows: |flow: |sessions: )' | sed 's/^/# /' >&3 || true
  # Both moods are judged, each from its own line, before the exit status is trusted: a harness
  # that ran only dark must not pass on dark's line (ADR-1331).
  local mood verdicts=0
  for mood in dark light; do
    smoke_summary_verdict "$output" "$mood" || { echo "(harness exit $status)"; false; }
    render_verdict "$output" "$mood" "$half" || { echo "(harness exit $status)"; false; }
    # REQ-05: the browser counts the NOT SERVED panels it drew, per mood -- the gap Phase 04 closes is
    # measured where the owner sees it, not only in the fold's output.
    printf '%s\n' "$output" | grep -qE "^smoke: not-served mood=$mood panels=[0-9]+ rooms=[a-z0-9:,-]+\$" \
      || { echo "no not-served line for mood=$mood (harness exit $status)"; false; }
    printf '%s\n' "$output" | grep -qE "^smoke: verbs-pending mood=$mood cards=[0-9]+ rooms=[a-z0-9:,-]+\$" \
      || { echo "no verbs-pending line for mood=$mood (harness exit $status)"; false; }
    # ... and what the browser drew EQUALS the shipped rings' derived lists, PER ROOM. The total alone
    # cannot see a panel deleted in one room and duplicated in another -- the Phase 03 attacker shipped
    # exactly that mutant past a sum -- so the room:count distribution is what is compared, in both
    # directions, against the lists module-frame holds equal to the folds.
    # Phase 04 (REQ-06): the NOT SERVED panels are the RESIDUE -- which may be empty -- and the panels a door route
    # now fills are a list of their own; both are held equal to the folds by module-frame, and to the page here.
    list_distribution "$ARC_ROOT/initiatives/face/evidence/phase-04" "residue.md" > "$BATS_TEST_TMPDIR/ns-expected"
    list_distribution "$ARC_ROOT/initiatives/face/evidence/phase-04" "served.md" > "$BATS_TEST_TMPDIR/sv-expected"
    # Phase 05 (ADR-1339): Phase 03's cards minus the ones a work-door op retired -- the one list module-frame holds
    # equal to the folds AND to Phase 03's rows minus the registry's retirements.
    list_distribution "$ARC_ROOT/initiatives/face/evidence/phase-05" "verbs-pending.md" > "$BATS_TEST_TMPDIR/vp-expected"
    local nsPanels nsRooms nsExpected nsRoomsExpected vpCards vpRooms vpExpected vpRoomsExpected
    nsPanels="$(printf '%s\n' "$output" | grep "^smoke: not-served mood=$mood panels=" | tail -1 | sed -n "s/^smoke: not-served mood=$mood panels=\([0-9][0-9]*\) rooms=.*/\1/p")"
    nsRooms="$(printf '%s\n' "$output" | grep "^smoke: not-served mood=$mood panels=" | tail -1 | sed -n "s/^smoke: not-served mood=$mood panels=[0-9]* rooms=\(.*\)\$/\1/p")"
    nsExpected="$(head -1 "$BATS_TEST_TMPDIR/ns-expected")"
    nsRoomsExpected="$(tail -1 "$BATS_TEST_TMPDIR/ns-expected")"
    # The residue may be 0, so its floor is gone -- the served count below carries the vacuous-pass guard instead.
    [ -n "$nsPanels" ] && [ -n "$nsExpected" ] && [ "$nsPanels" = "$nsExpected" ] \
      || { echo "mood=$mood: the browser drew '$nsPanels' NOT SERVED panels, the residue list names $nsExpected"; false; }
    [ "$nsRooms" = "$nsRoomsExpected" ] \
      || { echo "mood=$mood: NOT SERVED panels per room read '$nsRooms', the residue list names '$nsRoomsExpected'"; false; }
    printf '%s\n' "$output" | grep -qE "^smoke: served mood=$mood panels=[0-9]+ rooms=[a-z0-9:,-]+\$" \
      || { echo "no served line for mood=$mood (harness exit $status)"; false; }
    local svPanels svRooms svExpected svRoomsExpected
    svPanels="$(printf '%s\n' "$output" | grep "^smoke: served mood=$mood panels=" | tail -1 | sed -n "s/^smoke: served mood=$mood panels=\([0-9][0-9]*\) rooms=.*/\1/p")"
    svRooms="$(printf '%s\n' "$output" | grep "^smoke: served mood=$mood panels=" | tail -1 | sed -n "s/^smoke: served mood=$mood panels=[0-9]* rooms=\(.*\)\$/\1/p")"
    svExpected="$(head -1 "$BATS_TEST_TMPDIR/sv-expected")"
    svRoomsExpected="$(tail -1 "$BATS_TEST_TMPDIR/sv-expected")"
    [ -n "$svPanels" ] && [ "$svExpected" -gt 0 ] && [ "$svPanels" = "$svExpected" ] \
      || { echo "mood=$mood: the browser drew '$svPanels' served panels, the served list names $svExpected"; false; }
    [ "$svRooms" = "$svRoomsExpected" ] \
      || { echo "mood=$mood: served panels per room read '$svRooms', the served list names '$svRoomsExpected'"; false; }
    vpCards="$(printf '%s\n' "$output" | grep "^smoke: verbs-pending mood=$mood cards=" | tail -1 | sed -n "s/^smoke: verbs-pending mood=$mood cards=\([0-9][0-9]*\) rooms=.*/\1/p")"
    vpRooms="$(printf '%s\n' "$output" | grep "^smoke: verbs-pending mood=$mood cards=" | tail -1 | sed -n "s/^smoke: verbs-pending mood=$mood cards=[0-9]* rooms=\(.*\)\$/\1/p")"
    vpExpected="$(head -1 "$BATS_TEST_TMPDIR/vp-expected")"
    vpRoomsExpected="$(tail -1 "$BATS_TEST_TMPDIR/vp-expected")"
    [ -n "$vpCards" ] && [ "$vpExpected" -gt 0 ] && [ "$vpCards" = "$vpExpected" ] \
      || { echo "mood=$mood: the browser drew '$vpCards' verb-pending cards, the shipped rings' lists name $vpExpected"; false; }
    [ "$vpRooms" = "$vpRoomsExpected" ] \
      || { echo "mood=$mood: verb-pending cards per room read '$vpRooms', the lists name '$vpRoomsExpected'"; false; }
    rehearsal_verdict "$output" "$mood" "$ARC_ROOT/initiatives/face/evidence/phase-03" || { echo "(harness exit $status)"; false; }
    planned_verdict "$output" "$mood" || { echo "(harness exit $status)"; false; }
    runner_verdict "$output" "$mood" "$(uname -s)" || { echo "(harness exit $status)"; false; }
    extras_verdict "$output" "$mood" || { echo "(harness exit $status)"; false; }
    # Every ring has shipped, so every module room opens with the contract's frozen sentence as its heading -- an
    # exempted extra with its exemption row's -- and none missed (a blank room is not an opened one).
    heading_verdict "$output" "$mood" || { echo "(harness exit $status)"; false; }
    verdicts=$((verdicts + 1))
  done
  [ "$verdicts" -eq 2 ] || { echo "judged $verdicts of 2 moods"; false; }
  flows_verdict "$output" "$opsCount" || { echo "(harness exit $status)"; false; }
  sessions_verdict "$output" || { echo "(harness exit $status)"; false; }
  [ "$status" -eq 0 ]
}

@test "face-browser: MUTANT CONTROL -- the sessions verdict refuses a start with no click, a dead counter and a short run" {
  run sessions_verdict "sessions: ok rooms=8 reloads=8 attach=ok starts=0 control=1"
  [ "$status" -eq 0 ] || { echo "the sessions verdict refused the clean line: $output"; false; }
  run sessions_verdict "sessions: ok rooms=8 reloads=8 attach=ok starts=1 control=1"
  [ "$status" -ne 0 ] || { echo "a start with no click passed: $output"; false; }
  run sessions_verdict "sessions: ok rooms=8 reloads=8 attach=ok starts=0 control=0"
  [ "$status" -ne 0 ] || { echo "a counter one click could not move passed: $output"; false; }
  run sessions_verdict "sessions: ok rooms=8 reloads=7 attach=ok starts=0 control=1"
  [ "$status" -ne 0 ] || { echo "a room left unreloaded passed: $output"; false; }
  run sessions_verdict "sessions: ok rooms=3 reloads=3 attach=ok starts=0 control=1"
  [ "$status" -ne 0 ] || { echo "a run over too few rooms passed: $output"; false; }
  run sessions_verdict "sessions: FAIL rooms=8 reloads=8 attach=FAIL starts=-1 control=-1"
  [ "$status" -ne 0 ] || { echo "a failed flow passed: $output"; false; }
  run sessions_verdict ""
  [ "$status" -ne 0 ] || { echo "no line at all passed: $output"; false; }
}

@test "face-browser: MUTANT CONTROL -- the flows verdict refuses a short, failed, slow or erroring run" {
  run flows_verdict "flows: ops=6 ok=6 fail=0 live=ok live-ms=2300 page-errors=0" 6
  [ "$status" -eq 0 ] || { echo "the flows verdict refused the clean line: $output"; false; }
  run flows_verdict "flows: ops=5 ok=5 fail=0 live=ok live-ms=2300 page-errors=0" 6
  [ "$status" -ne 0 ] || { echo "a run that drove fewer ops than the registry holds passed: $output"; false; }
  run flows_verdict "flows: ops=6 ok=5 fail=1 live=ok live-ms=2300 page-errors=0" 6
  [ "$status" -ne 0 ] || { echo "a failed op passed: $output"; false; }
  run flows_verdict "flows: ops=6 ok=6 fail=0 live=FAIL live-ms=none page-errors=0" 6
  [ "$status" -ne 0 ] || { echo "a live flow that never saw the change passed: $output"; false; }
  run flows_verdict "flows: ops=6 ok=6 fail=0 live=ok live-ms=7200 page-errors=0" 6
  [ "$status" -ne 0 ] || { echo "a live change seen past 5 s passed: $output"; false; }
  run flows_verdict "flows: ops=6 ok=6 fail=0 live=ok live-ms=2300 page-errors=2" 6
  [ "$status" -ne 0 ] || { echo "a run with page errors passed: $output"; false; }
  run flows_verdict "" 6
  [ "$status" -ne 0 ] || { echo "no line at all passed: $output"; false; }
  run flows_verdict "flows: ops=0 ok=0 fail=0 live=ok live-ms=2300 page-errors=0" 0
  [ "$status" -ne 0 ] || { echo "a registry with no op passed: $output"; false; }
}

@test "face-browser: MUTANT CONTROL -- the rehearsal, planned and runner verdicts refuse what they must" {
  # Each verdict fed forged smoke lines, with no Chrome and no build: the line the real run would print passes, and
  # every mutant of it the money ring's attacker named fails (face v2 Phase 03).
  local dir="$BATS_TEST_TMPDIR/lists"
  mkdir -p "$dir"
  printf '%s\n' '| `ops` | a | b |' '| `ops` | c | d |' '| `trader` | e | f |' > "$dir/rehearsal-money.md"
  run rehearsal_verdict "smoke: rehearsal mood=dark cards=3 rooms=ops:2,trader:1" dark "$dir"
  [ "$status" -eq 0 ] || { echo "the rehearsal verdict refused the clean line: $output"; false; }
  run rehearsal_verdict "smoke: rehearsal mood=dark cards=3 rooms=ops:1,trader:2" dark "$dir"
  [ "$status" -ne 0 ] || { echo "a card moved between rooms passed: $output"; false; }
  run rehearsal_verdict "smoke: rehearsal mood=dark cards=unread rooms=none" dark "$dir"
  [ "$status" -ne 0 ] || { echo "an unread count passed: $output"; false; }
  run rehearsal_verdict "" dark "$dir"
  [ "$status" -ne 0 ] || { echo "no line at all passed: $output"; false; }
  run planned_verdict "smoke: planned mood=dark rooms=4 expected=4 live=0 planned-rooms=chat-mcp,discover,ops,trader" dark
  [ "$status" -eq 0 ] || { echo "the planned verdict refused the clean line: $output"; false; }
  run planned_verdict "smoke: planned mood=dark rooms=3 expected=4 live=0 planned-rooms=discover,ops,trader" dark
  [ "$status" -ne 0 ] || { echo "a planned room that lost its mark passed: $output"; false; }
  run planned_verdict "smoke: planned mood=dark rooms=4 expected=4 live=1 planned-rooms=chat-mcp,discover,ops,trader" dark
  [ "$status" -ne 0 ] || { echo "a LIVE pill on a planned room passed: $output"; false; }
  run planned_verdict "smoke: planned mood=dark rooms=unread expected=4 live=0 planned-rooms=none" dark
  [ "$status" -ne 0 ] || { echo "an unread planned count passed: $output"; false; }
  run planned_verdict "smoke: planned mood=dark rooms=2 expected=2 live=0 planned-rooms=ops,trader" dark
  [ "$status" -ne 0 ] || { echo "a contract naming fewer than three planned rooms passed: $output"; false; }
  run runner_verdict "smoke: runner-errors mood=dark count=0 rooms=none" dark Linux
  [ "$status" -eq 0 ] || { echo "the runner verdict refused a clean linux line: $output"; false; }
  run runner_verdict "smoke: runner-errors mood=dark count=1 rooms=engine-room:1" dark Linux
  [ "$status" -ne 0 ] || { echo "a runner-class error on linux passed: $output"; false; }
  run runner_verdict "smoke: runner-errors mood=dark count=2 rooms=engine-room:2" dark MINGW64_NT-10.0
  [ "$status" -eq 0 ] || { echo "the runner verdict refused two on windows: $output"; false; }
  run runner_verdict "smoke: runner-errors mood=dark count=3 rooms=engine-room:3" dark MINGW64_NT-10.0
  [ "$status" -ne 0 ] || { echo "three runner-class errors on windows passed: $output"; false; }
  run runner_verdict "smoke: runner-errors mood=dark count=unread rooms=none" dark Linux
  [ "$status" -ne 0 ] || { echo "an unread runner count passed: $output"; false; }
  run runner_verdict "" dark Linux
  [ "$status" -ne 0 ] || { echo "no runner line at all passed: $output"; false; }
  run extras_verdict "smoke: extras mood=dark expected=2 opened=2 errors=0 rooms=agents,executor" dark
  [ "$status" -eq 0 ] || { echo "the real extras line failed: $output"; false; }
  run extras_verdict "smoke: extras mood=dark expected=2 opened=1 errors=0 rooms=agents" dark
  [ "$status" -ne 0 ] || { echo "an extra left unopened passed: $output"; false; }
  run extras_verdict "smoke: extras mood=dark expected=2 opened=2 errors=1 rooms=agents,executor" dark
  [ "$status" -ne 0 ] || { echo "an extra that logged an error passed: $output"; false; }
  run extras_verdict "smoke: extras mood=dark expected=0 opened=0 errors=0 rooms=none" dark
  [ "$status" -ne 0 ] || { echo "an exemption file listing nothing passed: $output"; false; }
  run extras_verdict "smoke: extras mood=light expected=2 opened=2 errors=0 rooms=agents,executor" dark
  [ "$status" -ne 0 ] || { echo "the other mood's line passed: $output"; false; }
  run extras_verdict "smoke: extras mood=dark expected=2 opened=2 errors=0 rooms=none" dark
  [ "$status" -ne 0 ] || { echo "a rooms field naming none passed: $output"; false; }
  run extras_verdict "smoke: extras mood=dark expected=02 opened=02 errors=0 rooms=agents,executor" dark
  [ "$status" -ne 0 ] || { echo "zero-padded counts passed: $output"; false; }
  local head="smoke: heading mood=dark rings=command,kernel,factory,money,company checked=36 miss=0"
  run heading_verdict "$head" dark
  [ "$status" -eq 0 ] || { echo "the real heading line failed: $output"; false; }
  run heading_verdict "${head/checked=36/checked=35}" dark
  [ "$status" -ne 0 ] || { echo "35 headings checked passed a floor of 36: $output"; false; }
  run heading_verdict "${head/miss=0/miss=1}" dark
  [ "$status" -ne 0 ] || { echo "a heading miss passed: $output"; false; }
  run heading_verdict "$(printf '%s\n%s' "$head" "${head/miss=0/miss=1}")" dark
  [ "$status" -ne 0 ] || { echo "a clean line followed by a miss passed: the last line must decide: $output"; false; }
  run heading_verdict "$head"$'\r' dark
  [ "$status" -ne 0 ] || { echo "a heading line carrying a carriage return passed: $output"; false; }
  run heading_verdict "${head/mood=dark/mood=light}" dark
  [ "$status" -ne 0 ] || { echo "the other mood's heading line passed: $output"; false; }
  run heading_verdict "${head/,company/}" dark
  [ "$status" -ne 0 ] || { echo "a heading line naming four rings passed: $output"; false; }
}

@test "face-browser: MUTANT CONTROL -- the render verdict FAILS a shell that drew every room generic" {
  # A clean smoke line whose render line says no room drew through a module: every Phase 01 number
  # is perfect, and only the render verdict can refuse it. Needs no Chrome and no build.
  local smokeLine="smoke: opened=33 openable=33 errors=0 excluded-errors=0 unsettled=0 expected=33 not-opened=lane mood=dark mood-miss=0"
  local half="face-coverage: module half folders=10 served=33 generic=24 orphans=0 exemptions=1 generic-rooms=inbox,bench -- a served room with no module renders through the generic module (ADR-1321)"
  local allGeneric="smoke: render mood=dark module=0 generic=33 unmarked=0 generic-rooms=inbox,bench"
  run render_verdict "$smokeLine"$'\n'"$allGeneric" dark "$half"
  [ "$status" -ne 0 ] || { echo "the render verdict passed a shell that attached no module: $output"; false; }
  [[ "$output" == *"module=0 rooms drew through a module, face-coverage attaches 9"* ]] || { echo "refused for the wrong reason: $output"; false; }
  # The same run with the modules attached must pass, or the refusal above proves nothing. The gate
  # counts 10 folders with one ADR-1327 exemption: 9 attach, and 9 is the number the browser owes.
  run render_verdict "$smokeLine"$'\n'"smoke: render mood=dark module=9 generic=24 unmarked=0 generic-rooms=inbox,bench" dark "$half"
  [ "$status" -eq 0 ] || { echo "the render verdict refused a clean render line: $output"; false; }
  # An unmarked room, a count that does not add up, other generic rooms, no render line and no gate
  # line are each refused.
  run render_verdict "$smokeLine"$'\n'"smoke: render mood=dark module=9 generic=23 unmarked=1 generic-rooms=inbox,bench" dark "$half"
  [ "$status" -ne 0 ] && [[ "$output" == *"unmarked=1"* ]] || { echo "an unmarked room passed: $output"; false; }
  run render_verdict "$smokeLine"$'\n'"smoke: render mood=dark module=9 generic=20 unmarked=0 generic-rooms=inbox,bench" dark "$half"
  [ "$status" -ne 0 ] && [[ "$output" == *"!= openable=33"* ]] || { echo "a render count short of openable passed: $output"; false; }
  run render_verdict "$smokeLine"$'\n'"smoke: render mood=dark module=9 generic=24 unmarked=0 generic-rooms=bench,inbox" dark "$half"
  [ "$status" -ne 0 ] && [[ "$output" == *"face-coverage reports generic 'inbox,bench'"* ]] || { echo "generic rooms that differ from the gate's passed: $output"; false; }
  run render_verdict "$smokeLine" dark "$half"
  [ "$status" -ne 0 ] && [[ "$output" == *"no render line for mood=dark"* ]] || { echo "a smoke with no render line passed: $output"; false; }
  run render_verdict "$smokeLine"$'\n'"smoke: render mood=dark module=9 generic=24 unmarked=0 generic-rooms=inbox,bench" dark ""
  [ "$status" -ne 0 ] && [[ "$output" == *"no module-half line from face-coverage"* ]] || { echo "a verdict with no gate line passed: $output"; false; }
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
  [ "$declared" -eq 13 ] || { echo "expected 13 @test lines, found $declared -- update this floor with the file"; false; }
}
