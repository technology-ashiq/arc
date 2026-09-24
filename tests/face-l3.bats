#!/usr/bin/env bats
# face L3 -- the app layer (ADR-1316).
#
# L3 lives in-repo at face/ because a new repo could not be given CI from here, and an
# ungated layer is not a layer that ships. These tests are what makes that decision honest:
# every one of them runs in the SAME three-OS matrix as the rest of the suite, with no
# npm install and no build step, because face/src/lib/*.mjs is dependency-free ESM.
#
# The "RAN: <n> checks" line is asserted on every probe. A node script that dies half-way
# prints its oks and exits non-zero, and a wrapper that only checked $status would read the
# first failure as the whole story -- three of those shipped in Cycle 6.
bats_require_minimum_version 1.5.0
load 'test_helper'

@test "L3 logic runs with no install and no build, and every check passes" {
  run node "$ARC_ROOT/tests/face/l3-logic.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"RAN: "*" checks, 0 failed"* ]] || { echo "$output"; false; }
  # Floor the count. "0 failed" is also what a suite that asserted nothing prints.
  local n; n=$(printf '%s\n' "$output" | sed -n 's/^RAN: \([0-9]\{1,\}\) checks.*/\1/p')
  [ -n "$n" ] && [ "$n" -ge 215 ] || { echo "only $n checks ran: $output"; false; }
}

@test "face v2: the ops dock's decisions run with no install, and every check passes" {
  run node "$ARC_ROOT/tests/face/ops-logic.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"RAN: "* ]] || { echo "no RAN line -- the suite did not finish: $output"; false; }
  [[ "$output" != *"FAIL"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok runVerdict: exit 0 with no receipt is said as that, never as success"* ]] || { echo "$output"; false; }
}

@test "face v2: the session dock's decisions run with no install, and a session starts only from its Start click" {
  run node "$ARC_ROOT/tests/face/session-dock.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"RAN: "* ]] || { echo "no RAN line -- the suite did not finish: $output"; false; }
  ! grep -q '^FAIL ' <<< "$output" || { echo "$output"; false; }
  [[ "$output" == *"ok THE REAL TREE HOLDS: one sessionStart call, inside onStart, bound to onClick"* ]] || { echo "$output"; false; }
  # The mutant count is DERIVED: the suite prints MUTANTS: n, and exactly n mutants must read REFUSED -- a mutant
  # dropped from the list, or one the gate passed, moves one number and not the other.
  local declared refused
  declared=$(printf '%s\n' "$output" | sed -n 's/^MUTANTS: \([0-9]\{1,\}\)$/\1/p')
  refused=$(printf '%s\n' "$output" | grep -c '^ok MUTANT REFUSED by the click-only gate: ' || true)
  [ -n "$declared" ] && [ "$declared" -ge 20 ] && [ "$refused" -eq "$declared" ] || { echo "MUTANTS: $declared declared, $refused refused"; false; }
  [[ "$output" == *"ok MUTANT REFUSED by the click-only gate: an auto-start on mount"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok MUTANT REFUSED by the click-only gate: a start from Ask"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok MUTANT REFUSED by the click-only gate: a start that skips the click token"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok MUTANT REFUSED by the click-only gate: a start through door.call on the start route"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok MUTANT REFUSED by the click-only gate: a start by bracket access"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok MUTANT REFUSED by the click-only gate: an auto-start on mount, no braces"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok MUTANT REFUSED by the click-only gate: a start from a new .jsx file"* ]] || { echo "$output"; false; }
}

@test "no L3 test or source file carries a byte that makes grep call it binary" {
  # A literal NUL in a source file makes grep treat the whole file as binary, and a
  # binary-flagged file is SKIPPED silently by every grep-driven gate -- including CI's own
  # test-count floor. That is the "test that was never there" failure in .claude/rules/
  # testing.md, arriving through a byte rather than through a character in a @test name.
  # It happened here: a control-character assertion was written with the character embedded
  # instead of built with String.fromCharCode.
  run node -e "
    const fs = require('fs'), path = require('path');
    const roots = [path.join(process.argv[1], 'tests', 'face'), path.join(process.argv[1], 'face', 'src')];
    let scanned = 0; const bad = [];
    const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(f); continue; }
      if (!/[.](mjs|js|ts|tsx|css)$/.test(e.name)) continue;
      scanned++;
      if (fs.readFileSync(f).includes(0)) bad.push(f);
    } };
    for (const r of roots) if (fs.existsSync(r)) walk(r);
    if (bad.length) { console.log('BINARY-FLAGGED:', bad.join(', ')); process.exit(1); }
    console.log('RAN: scanned', scanned, 'files, none carries a NUL');
  " "$ARC_ROOT"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"RAN: scanned"* ]] || { echo "$output"; false; }
  # Vacuous-pass guard: the walk must actually have found files. Captured with a bash
  # regex rather than sed: this line has been mangled twice by escaping, and a gate whose
  # own extraction is fragile is a gate that will one day extract nothing and pass.
  local n=""
  [[ "$output" =~ RAN:\ scanned\ ([0-9]+)\ files ]] && n="${BASH_REMATCH[1]}"
  [ -n "$n" ] && [ "$n" -ge 15 ] || { echo "only '$n' files scanned: $output"; false; }
}

@test "the L3 logic layer imports NOTHING that needs an install" {
  # The rule this suite depends on, asserted mechanically rather than trusted. A lib file
  # that grows `import React` silently makes itself untestable on CI -- and the symptom is
  # not a red test, it is a test that quietly stops covering the branch.
  run bash -c "grep -rhoE \"^import[^\\\"']*[\\\"'][^./][^\\\"']*[\\\"']\" '$ARC_ROOT/face/src/lib/' 2>/dev/null || true"
  [ "$status" -eq 0 ]
  # Only node: builtins are allowed. Anything else is a package.
  local bad
  bad=$(printf '%s\n' "$output" | grep -v 'node:' | grep -v '^$' || true)
  [ -z "$bad" ] || { echo "face/src/lib imports a package, which CI cannot install: $bad"; false; }
  # Vacuous-pass guard: prove the directory was actually scanned.
  local files; files=$(ls "$ARC_ROOT"/face/src/lib/*.mjs 2>/dev/null | wc -l | tr -d " ")
  [ "$files" -ge 2 ] || { echo "expected the lib dir to hold modules; found $files"; false; }
}

@test "face/ imports nothing from .claude, so the repo split stays a directory move" {
  # ADR-1316 keeps FACE-A's Option 1 reachable, and this is the tax that keeps it cheap.
  # The dependency points ONE way: arc knows nothing about face/, face/ knows only HTTP.
  #
  # The check is on IMPORTS, not on mentions. The first cut grepped for the string ".claude/"
  # anywhere under face/src and went red on two innocent things: the generated banner in
  # tokens.css naming the generator that wrote it, and App.tsx's error message telling the
  # owner which command starts the door. Both are prose. A test that cannot tell an import
  # from a sentence forces you to stop writing useful sentences, which is a worse outcome
  # than the coupling it was guarding against.
  run bash -c "grep -rnE \"(^|[^[:alnum:]])(import|require)[^;]*[\\\"'][^\\\"']*\\.claude/\" '$ARC_ROOT/face/src' 2>/dev/null || true"
  [ -z "$output" ] || { echo "face/src IMPORTS from .claude: $output"; false; }
  # Vacuous-pass guard: the grep must actually have files to scan.
  local scanned; scanned=$(find "$ARC_ROOT/face/src" -type f \( -name '*.mjs' -o -name '*.tsx' -o -name '*.ts' \) | wc -l | tr -d " ")
  [ "$scanned" -ge 5 ] || { echo "only $scanned source files under face/src; the grep above proves nothing"; false; }
  # The OTHER direction, with its own vacuous-pass guard. The first version of this half had
  # none: run it against a directory that does not exist and grep returns nothing, status is
  # 0, and the assertion passes. "No matches" and "nowhere to look" print identically.
  [ -d "$ARC_ROOT/.claude/scripts" ] || { echo ".claude/scripts is not there; this half proves nothing"; false; }
  local arcScripts; arcScripts=$(find "$ARC_ROOT/.claude/scripts" -name '*.mjs' | wc -l | tr -d " ")
  [ "$arcScripts" -ge 20 ] || { echo "only $arcScripts scripts to scan; too few for this to mean anything"; false; }
  run bash -c "grep -rlE '(^|[^[:alnum:]_-])face/src' '$ARC_ROOT/.claude/scripts' 2>/dev/null || true"
  # face-tokens.mjs WRITES the copy and face-colour-literal.mjs READS face/src/ui and
  # face/src/modules to lint them (face v2 Phase 01), so both name the path; nothing may IMPORT
  # from it. face v2 Phase 02 adds three more readers of the module tree: face-pure.mjs lints it,
  # face-coverage.mjs reconciles its folders with the served registry, and face-module.mjs writes a
  # new module into it. face v2 Phase 03 adds face-facts.mjs, which walks face/src for a facts bundle.
  # Each exclusion is one named file with its reason, never a prefix.
  # The exclusion is the FULL path of each file, so a same-named file elsewhere is not excused.
  local importers
  importers=$(printf '%s\n' "$output" | grep -v '/\.claude/scripts/core/face-tokens\.mjs$' | grep -v '/\.claude/scripts/core/face-colour-literal\.mjs$' \
    | grep -v '/\.claude/scripts/core/face-pure\.mjs$' | grep -v '/\.claude/scripts/core/face-coverage\.mjs$' | grep -v '/\.claude/scripts/hq/face-module\.mjs$' \
    | grep -v '/\.claude/scripts/core/face-facts\.mjs$' | grep -v '^$' || true)
  [ -z "$importers" ] || { echo "an arc script depends on face/: $importers"; false; }
  # And an excused file is excused for NAMING the path, never for importing from it.
  local excused=("$ARC_ROOT/.claude/scripts/core/face-tokens.mjs" "$ARC_ROOT/.claude/scripts/core/face-colour-literal.mjs"
    "$ARC_ROOT/.claude/scripts/core/face-pure.mjs" "$ARC_ROOT/.claude/scripts/core/face-coverage.mjs" "$ARC_ROOT/.claude/scripts/hq/face-module.mjs"
    "$ARC_ROOT/.claude/scripts/core/face-facts.mjs")
  local f
  for f in "${excused[@]}"; do [ -f "$f" ] || { echo "an excused file is missing: $f"; false; }; done
  run grep -nE "(^|[^[:alnum:]])(import|require)[^;]*[\"'][^\"']*face/src" "${excused[@]}"
  [ "$status" -eq 1 ] || { echo "an excused file IMPORTS from face/src (grep exit $status): $output"; false; }
}

@test "the L3 token copy is in sync with the canonical design tokens" {
  run node "$ARC_ROOT/.claude/scripts/core/face-tokens.mjs" "$ARC_ROOT" --check
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"matches docs/design/system/tokens.css"* ]] || { echo "$output"; false; }
  # The copy must carry the reserved hues, not merely exist. A truncated copy also "exists".
  local copy="$ARC_ROOT/face/src/tokens.css"
  [ -f "$copy" ] || { echo "no token copy at $copy"; false; }
  grep -q -- "--amber" "$copy" || { echo "copy has no reserved hues"; false; }
  grep -q -- "--accent" "$copy" || { echo "copy has no product accent"; false; }
  grep -q "GENERATED FILE" "$copy" || { echo "copy is not marked generated"; false; }
}

@test "face-tokens REFUSES a hand-edited copy and a wrong source (mutant arms)" {
  run node "$ARC_ROOT/.claude/scripts/core/face-tokens.mjs" "$ARC_ROOT" --selftest
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # Every arm BY NAME, including the three added after an adversarial pass showed the old
  # "wrong repo root" arm exercised file-ABSENCE and never the content check -- a mutant that
  # deleted that check passed the arm while replacing the app's stylesheet with 60 bytes of
  # junk. A length-preserving hand-edit and a missing copy are the other two it could not see.
  for arm in "banner marks the file GENERATED" "copy carries the reserved-hue tokens" \
             "copy carries the product accent" "a hand-edited copy exits 1" \
             "a length-preserving hand-edit exits 1" "a missing copy exits 1" \
             "a source that EXISTS but is not the token file is refused" \
             "an absent source is refused, not copied" \
             "a copy linked onto the source is refused, source untouched"; do
    [[ "$output" == *"$arm"*"PASS"* ]] || { echo "arm did not pass: $arm"; echo "$output"; false; }
  done
}

@test "face v2: both moods' contrast ratios are computed, above their floors, and match the header" {
  # REQ-02 / ADR-1331. The numbers in tokens.css's header are this script's output; a typed or
  # stale one FAILs here, and so does any text pair under 4.5:1 or UI pair under 3:1.
  run node "$ARC_ROOT/tests/face/tokens-contrast.mjs"
  [[ "$output" == *"tokens-contrast: moods=2 pairs="* ]] || { echo "the check never reported (exit $status): $output"; false; }
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # Floor the count: "findings=0" is also what a check that measured nothing prints.
  local n
  n="$(printf '%s\n' "$output" | sed -n 's/^tokens-contrast: moods=2 pairs=\([0-9][0-9]*\) findings=0$/\1/p')"
  [ -n "$n" ] && [ "$n" -ge 150 ] || { echo "only '$n' pairs measured: $output"; false; }
}

@test "face v2: tokens-contrast REFUSES a typed header, a low pair and a broken reserved meaning (mutant arms)" {
  run node "$ARC_ROOT/tests/face/tokens-contrast.mjs" --selftest
  [[ "$output" == *"tokens-contrast selftest:"* ]] || { echo "the selftest never reported (exit $status): $output"; false; }
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  for arm in "the freshly written file checks clean" "a hand-typed number in the block FAILS" \
             "a missing block FAILS" "a missing light mood FAILS by name" "a light --text-3 under 4.5:1 FAILS" \
             "a -rgb triple that disagrees with its hex FAILS" "council repointed at violet FAILS the law" \
             "live repointed at green FAILS the law" "a missing --blue FAILS by name" \
             "an unbalanced file is refused, not half-read"; do
    [[ "$output" == *"$arm"*"PASS"* ]] || { echo "arm did not pass: $arm"; echo "$output"; false; }
  done
}

@test "face v2: the colour-literal lint finds 0 literals in ui/** and modules/**, and FAILs planted ones" {
  run node "$ARC_ROOT/tests/face/colour-literal.mjs"
  [[ "$output" == *"RAN: "*" checks, "*" failed"* ]] || { echo "the suite never reached its end (exit $status): $output"; false; }
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local n
  n="$(printf '%s\n' "$output" | sed -n 's/^RAN: \([0-9][0-9]*\) checks, 0 failed$/\1/p')"
  [ -n "$n" ] && [ "$n" -ge 35 ] || { echo "only '$n' checks ran: $output"; false; }
  # The lint on the real tree, directly, the way a reader of this file would run it.
  run node "$ARC_ROOT/.claude/scripts/core/face-colour-literal.mjs"
  [[ "$output" == *"colour-literal: scanned="*" files findings=0"* ]] || { echo "$output"; false; }
  [ "$status" -eq 0 ]
}

@test "the L3 tree carries no build output and no vendored dependencies" {
  # node_modules and dist are gitignored; this asserts the ignore actually holds, because a
  # 197 MB directory arriving in the arc repo is the failure mode ADR-1316 was argued past.
  [ ! -d "$ARC_ROOT/face/node_modules" ] || {
    run bash -c "cd '$ARC_ROOT' && git ls-files face/node_modules | head -1"
    [ -z "$output" ] || { echo "node_modules is TRACKED: $output"; false; }
  }
  run bash -c "cd '$ARC_ROOT' && git ls-files face/ | grep -cE 'node_modules|/dist/' || true"
  [[ "$output" == "0" ]] || { echo "tracked build output under face/: $output"; false; }
  # Vacuous-pass guard: face/ must actually be tracked, or the check above proves nothing.
  run bash -c "cd '$ARC_ROOT' && git ls-files face/ | wc -l | tr -d ' '"
  [ "$output" -ge 5 ] || { echo "face/ is barely tracked ($output files); the check above is vacuous"; false; }
}

@test "REQ-10's dogfood evidence can be FAILED, by every route it can be failed by" {
  # The requirement is not "the owner used the face" -- it is that for five real days EVERY
  # decision went THROUGH it, and both sides leave a record: L2's journal writes the receipt
  # ULID it emitted, and the spine holds every decision.recorded there has ever been.
  #
  # The arm that matters is `spine-only`: a decision.recorded with no journal line is a
  # decision made OUTSIDE the face, which is the one thing REQ-10 asks not to happen -- and
  # it has to fail even while every other number still looks healthy.
  run node "$ARC_ROOT/.claude/scripts/core/face-dogfood.mjs" --selftest
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  for arm in "five clean days meet the requirement" \
             "a decision made OUTSIDE the face fails the requirement" \
             "a journal line with no receipt fails the requirement" \
             "four days does not pass as five" \
             "nine decisions in one day is still one day" \
             "an empty journal is NOT met, and does not throw" \
             "a torn journal line makes the count a floor"; do
    [[ "$output" == *"$arm"*"PASS"* ]] || { echo "arm did not pass: $arm"; echo "$output"; false; }
  done
}

@test "face-dogfood fails CLOSED when it cannot find its inputs, and says which" {
  # "0 decisions, requirement not met" and "I could not find the journal" are different facts,
  # and the second must not wear the first's clothes -- reporting NOT MET because the wrong
  # directory was read would send someone hunting a behaviour problem that does not exist.
  run node "$ARC_ROOT/.claude/scripts/core/face-dogfood.mjs" --journal "$BATS_TEST_TMPDIR/nope" --spine "$BATS_TEST_TMPDIR/nope"
  [ "$status" -eq 2 ] || { echo "expected exit 2 for an unreadable input; got $status: $output"; false; }
  [[ "$output" == *"about this READ"* ]] || { echo "$output"; false; }
}

@test "arc-face's startup decisions hold, including the two that shipped broken" {
  # The launcher spans L2 and L3, so it lives with the L3 suite: what it is FOR is making the
  # app openable in one command, which is the difference between a five-day dogfood happening
  # and not happening.
  #
  # Two of these arms are regressions, both found by running the thing rather than reading it:
  #   - spawning npm's .cmd shim without a shell, which Node has refused since the
  #     CVE-2024-27980 fix and refuses with a bare EINVAL, on exactly one of the three legs;
  #   - declaring the app ready because the PORT answered, when the thing answering was a dev
  #     server left over from an earlier session and the launcher's own child was busy dying.
  run node "$ARC_ROOT/.claude/scripts/hq/arc-face.mjs" --selftest
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  for arm in "the app is started by running NODE, not a shim" \
             "and never a .cmd/.bat target" \
             "with no shell, so nothing is re-parsed as a command" \
             "and refuses to drift to another port" \
             "the token rides in the FRAGMENT, not the query" \
             "an empty token is refused" \
             "the token is NOT in the door's argv" \
             "401 means UP-but-token-mismatch" \
             "a DEAD child is reported, never waited out" \
             "and a dead child does not pass because the port answers" \
             "a worktree refusal is named as such"; do
    [[ "$output" == *"$arm"*"PASS"* ]] || { echo "arm did not pass: $arm"; echo "$output"; false; }
  done
  # Floor the arm count: a selftest that silently stopped registering arms also exits 0.
  local arms; arms=$(printf '%s\n' "$output" | grep -c "PASS")
  [ "$arms" -ge 24 ] || { echo "only $arms arms ran: $output"; false; }
}

@test "arc-face refuses a bad spine BEFORE it installs anything, and exits 1" {
  # Ordering is the point of this test, not just the exit code. The door's refusals are the
  # common ones and all of them are instant; paying a network dependency install first to
  # reach a failure that was knowable in a second is precisely the friction this file removes.
  # It is also what makes this test runnable on a clean CI box, where face/node_modules does
  # not exist and must not be created.
  mkdir -p "$BATS_TEST_TMPDIR/nospine"
  run node "$ARC_ROOT/.claude/scripts/hq/arc-face.mjs" --spine "$BATS_TEST_TMPDIR/nospine" --port 8422 --app-port 5422 --no-open
  [ "$status" -eq 1 ] || { echo "expected exit 1; got $status"; echo "$output"; false; }
  # The launcher's own sentence, not the door's. It deliberately does not name the spine's
  # directory layout -- that is the door's business, and `spine-reader-lint` greps every
  # tracked hq module for those tokens outside a comment. CI caught exactly that on the first
  # push of this file, in a string literal inside an error message.
  [[ "$output" == *"not a spine the door will accept"* ]] || { echo "the refusal did not name the cause: $output"; false; }
  # But the DOOR's reason must still reach the terminal, or the launcher has swallowed the
  # only sentence that says what was actually wrong with the path.
  [[ "$output" == *"BAD_SPINE"* ]] || { echo "the door's own refusal was swallowed: $output"; false; }
  # It must NOT have run an install to get here.
  [[ "$output" != *"npm install"* ]] || { echo "it installed dependencies before discovering the door could not start: $output"; false; }
  # And it must exit cleanly, not abort. Killing children and calling process.exit in the same
  # tick raced libuv's teardown on Windows and produced exit 127 with an assertion, turning a
  # correct refusal into what looked like a crash.
  [[ "$output" != *"Assertion failed"* ]] || { echo "the launcher aborted instead of exiting: $output"; false; }
}

@test "arc-face refuses an unknown flag rather than guessing a behaviour" {
  # --no_open, --noopen and --No-Open would each have silently taken the OTHER branch and
  # opened a browser the caller asked it not to.
  run node "$ARC_ROOT/.claude/scripts/hq/arc-face.mjs" --no_open
  [ "$status" -eq 2 ] || { echo "expected exit 2; got $status: $output"; false; }
  [[ "$output" == *"unknown flag"* ]] || { echo "$output"; false; }
}

# face v2 Phase 00: initiatives/face/contracts/modules-v2.json is DERIVED, never typed. The two
# tests below are the pair the vacuous-pass rule asks for: one proves the committed contract
# matches its sources, the other proves the derivation can fail -- for a hand edit and for a
# v0.7 room that is neither served, aliased to a served id, nor marked extra (ADR-1321).
@test "face v2: the modules contract is generated from its sources and in sync" {
  run node "$ARC_ROOT/.claude/scripts/hq/face-modules-contract.mjs" --root "$ARC_ROOT" --check
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"in sync -- "*" modules = "*" same-id + "*" renamed + "*" extra"* ]] || { echo "$output"; false; }
  local n; n=$(printf '%s\n' "$output" | sed -n 's/.*in sync -- \([0-9]\{1,\}\) modules.*/\1/p')
  [ -n "$n" ] && [ "$n" -gt 0 ] || { echo "no module count in: $output"; false; }
}

@test "face v2: the modules contract derivation FAILs a hand-edited contract and an orphan room" {
  local src="$ARC_ROOT" dst="$BATS_TEST_TMPDIR/mc"
  local reg="docs/design/reference/face-hq/assets/arcface/src/hq/roomRegistry.js"
  local served="initiatives/face/contracts/rooms.generated.json"
  local plan="docs/strategy/plans/PLAN-face-v2.md"
  local contract="initiatives/face/contracts/modules-v2.json"
  local f
  for f in "$reg" "$served" "$plan" "$contract"; do
    mkdir -p "$dst/$(dirname "$f")"
    cp "$src/$f" "$dst/$f"
  done

  # Control first: an untouched copy is in sync, so each mutant below fails for its own reason.
  run node "$ARC_ROOT/.claude/scripts/hq/face-modules-contract.mjs" --root "$dst" --check
  [ "$status" -eq 0 ] || { echo "control copy not in sync: $output"; false; }

  # Mutant 1: a hand edit to the contract.
  awk '!done && /"ring": "command"/ { sub(/"command"/, "\"money\""); done = 1 } { print }' \
    "$src/$contract" > "$dst/$contract"
  run node "$ARC_ROOT/.claude/scripts/hq/face-modules-contract.mjs" --root "$dst" --check
  [ "$status" -eq 1 ] || { echo "hand-edited contract: expected exit 1, got $status: $output"; false; }
  [[ "$output" == *"DRIFT"* ]] || { echo "$output"; false; }
  cp "$src/$contract" "$dst/$contract"

  # Mutant 2: a v0.7 room with no served id, no alias and no extra flag.
  local at; at=$(grep -n "^export const ROOM_META" "$src/$reg" | cut -d: -f1)
  [ -n "$at" ] || { echo "ROOM_META not found in the registry"; false; }
  { head -n "$at" "$src/$reg"; printf "  { id: 'ghost-room', name: 'ghost', ring: 'money' },\n"; tail -n +"$((at + 1))" "$src/$reg"; } > "$dst/$reg"
  run node "$ARC_ROOT/.claude/scripts/hq/face-modules-contract.mjs" --root "$dst" --check
  [ "$status" -eq 1 ] || { echo "orphan room: expected exit 1, got $status: $output"; false; }
  [[ "$output" == *"ORPHAN"*"ghost-room"* ]] || { echo "$output"; false; }

  # Near-miss flags are refused by name, never read as a write or as the current directory.
  run node "$ARC_ROOT/.claude/scripts/hq/face-modules-contract.mjs" --chek
  [ "$status" -eq 2 ] && [[ "$output" == *"unknown argument"* ]] || { echo "--chek: $status $output"; false; }
  run node "$ARC_ROOT/.claude/scripts/hq/face-modules-contract.mjs" "--root=$dst" --check
  [ "$status" -eq 2 ] && [[ "$output" == *"unknown argument"* ]] || { echo "--root=: $status $output"; false; }
}

# face v2 Phase 02 -- the module frame (REQ-03, ADR-1320, ADR-1321). Three suites, each asserting it
# RAN before what it printed, and the lint run on the real tree directly, the way a reader would.
@test "face v2: face-pure FAILs a planted branch in a View and a planted React import in a fold, and the tree is pure" {
  run node "$ARC_ROOT/tests/face/face-pure.mjs"
  [[ "$output" == *"RAN: "*" checks, "*" failed"* ]] || { echo "the suite never reached its end (exit $status): $output"; false; }
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local n
  n="$(printf '%s\n' "$output" | sed -n 's/^RAN: \([0-9][0-9]*\) checks, 0 failed$/\1/p')"
  [ -n "$n" ] && [ "$n" -ge 100 ] || { echo "only '$n' checks ran: $output"; false; }
  # The spec's two mutants and the assumptions ledger's three hidden branches, BY NAME: a count
  # would still pass the day one of them stopped firing.
  local arm
  for arm in "PLANTED: a branch in a View.tsx exits 1" "PLANTED: a React import in a fold.mjs exits 1" \
             "View FAILs: a comparison hidden in a JSX condition (view-operator)" \
             "View FAILs: a ternary on raw payload data (view-condition)" \
             "View FAILs: a template literal holding a comparison (view-operator)" \
             "View passes: a condition on a boolean field fold() returns" \
             "every module folder imported (none skipped by a throw)" \
             "LINE TERMINATOR: a // comment ends at U+2028, so the import after it in a fold FAILs" \
             "UNICODE SPACE: import, an em space, then React is an import of react, not one name" \
             "PERCENT: a percent-encoded relative specifier is refused (path.resolve and node's loader read it differently)"; do
    [[ "$output" == *"ok $arm"* ]] || { echo "arm missing or failed: $arm"; echo "$output"; false; }
  done
  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*) ;;
    *) [[ "$output" == *"forged-line-arm=ran"* ]] || { echo "the forged-line arm did not run on $(uname -s): $output"; false; } ;;
  esac
  run node "$ARC_ROOT/.claude/scripts/core/face-pure.mjs"
  [[ "$output" == *"face-pure: modules="* ]] || { echo "the lint never reported (exit $status): $output"; false; }
  local line modules files
  line="$(printf '%s\n' "$output" | grep '^face-pure: modules=' | tail -1)"
  modules="$(printf '%s\n' "$line" | sed -n 's/^face-pure: modules=\([0-9][0-9]*\) folds=[0-9]* views=[0-9]* files=[0-9]* findings=0$/\1/p')"
  files="$(printf '%s\n' "$line" | sed -n 's/^face-pure: modules=[0-9]* folds=[0-9]* views=[0-9]* files=\([0-9][0-9]*\) findings=0$/\1/p')"
  [ -n "$modules" ] && [ "$modules" -gt 0 ] || { echo "no module scanned, or findings on the real tree: $output"; false; }
  [ "$files" -eq $((modules * 4)) ] || { echo "files=$files for modules=$modules -- a module is four files: $output"; false; }
  [ "$status" -eq 0 ]
}

# face v2 Phase 03 -- the facts-bundle lint (REQ-05, ADR-1324): structural arms FAIL from birth,
# heuristic arms WARN-first, and the real tree carries no bundle. Asserted RAN before what it printed.
@test "face v2: face-facts FAILs a planted facts bundle under face/src, WARNs its heuristics, and the tree is clean" {
  run node "$ARC_ROOT/tests/face/face-facts.mjs"
  [[ "$output" == *"RAN: "*" checks, "*" failed"* ]] || { echo "the suite never reached its end (exit $status): $output"; false; }
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local n
  n="$(printf '%s\n' "$output" | sed -n 's/^RAN: \([0-9][0-9]*\) checks, 0 failed$/\1/p')"
  [ -n "$n" ] && [ "$n" -ge 60 ] || { echo "only '$n' checks ran: $output"; false; }
  local arm
  for arm in "PLANTED: v0.7's arcFacts shape under face/src/lib FAILs (data-mass)" \
             "PLANTED: v0.7's arcFacts shape -- the CLI exits 1 naming the file and the kind" \
             "PLANTED: a JSON file under face/src FAILs (data-file)" \
             "PLANTED: a ?raw import FAILs (asset-import)" \
             "PLANTED: an import leaving face/src FAILs (import-outside)" \
             "PLANTED: a glob asking for raw text FAILs (glob)" \
             "PLANTED: a fetch of a static file FAILs (fetch-static)" \
             "PLANTED: a 2048-character string FAILs (blob)" \
             "PLANTED: a stylesheet literal carrying JSON members FAILs (blob)" \
             "WARN: a count claim in a module warns and does not FAIL (fact-literal)" \
             "passes: a fetch through the door's /api/ and a computed template" \
             "lex: without the text tokens, the stream is the same one face-pure reads" \
             "the real face/src carries no facts bundle: zero FAIL"; do
    [[ "$output" == *"ok $arm"* ]] || { echo "arm missing or failed: $arm"; echo "$output"; false; }
  done
  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*) ;;
    *) [[ "$output" == *"face-facts: link-arm=ran"* ]] || { echo "the link arm did not run on $(uname -s): $output"; false; } ;;
  esac
  run node "$ARC_ROOT/.claude/scripts/core/face-facts.mjs"
  [[ "$output" == *"face-facts: files="* ]] || { echo "the lint never reported (exit $status): $output"; false; }
  local code
  code="$(printf '%s\n' "$output" | grep '^face-facts: files=' | tail -1 | sed -n 's/^face-facts: files=[0-9]* code=\([0-9][0-9]*\) styles=[0-9]* leaves=[0-9]* fail=0 warn=[0-9]*$/\1/p')"
  [ -n "$code" ] && [ "$code" -ge 30 ] || { echo "too few code files scanned, or a FAIL on the real tree: $output"; false; }
  [ "$status" -eq 0 ]
}

@test "face v2: the module frame attaches both ways, agrees with face-coverage, and no shell file names a room" {
  run node "$ARC_ROOT/tests/face/module-frame.mjs"
  [[ "$output" == *"RAN: "*" checks, "*" failed"* ]] || { echo "the suite never reached its end (exit $status): $output"; false; }
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local n
  n="$(printf '%s\n' "$output" | sed -n 's/^RAN: \([0-9][0-9]*\) checks, 0 failed$/\1/p')"
  [ -n "$n" ] && [ "$n" -ge 60 ] || { echo "only '$n' checks ran: $output"; false; }
  local arm
  for arm in "ORPHAN: a folder whose id is not served is named, and never attached" \
             "MISPLACED: a folder in a ring the served room is not in is named -- the served ring wins" \
             "the generic rooms the gate REPORTS are exactly the ones the browser renders generic" \
             "the rail follows the served ring order, not a constant" \
             "MUTANT: a planted onOpen('money') is found" \
             "no served room is named in face/src/App.tsx" \
             "DOOR_ROUTES names exactly the routes arc-dash serves, method for method" \
             "UNDECLARED: a payload for a route the manifest does not declare FAILs the fold (REQ-05)" \
             "a manifest declaring a route the door does not serve does not attach (a NOT SERVED panel, never a route)" \
             "SHIPPED RING command: its module folders are modules-v2.json's ids for the ring" \
             "SHIPPED RING kernel: its module folders are modules-v2.json's ids for the ring" \
             "SHIPPED RING factory: its module folders are modules-v2.json's ids for the ring" \
             "SHIPPED RING money: its module folders are modules-v2.json's ids for the ring" \
             "REHEARSAL LIST rehearsal-money.md: the list names exactly what the folds render, both ways" \
             "F3: MUTANT -- a fold that returns a LIVE pill anywhere in its output is caught" \
             "F3: trader with every read it asks for answered wears no LIVE pill anywhere in what it returns" \
             "F3: trader's View marks the room data-planned and draws no live tone" \
             "F3: chat-mcp's rail and head badge says planned, never live, whatever its kinds did" \
             "F3: MUTANT -- a built room whose kinds fired still reads live, so the planned badge is not a blanket" \
             "F2: the scheduler fold, handed its manifest, asks the door for its trail (vacuous-pass guard)" \
             "F2: NEXT FIRE -- served by /api/jobs, and no longer named NOT SERVED" \
             "F2: HEARTBEAT -- served by /api/jobs, and the trail's last fire is still drawn as a fire, not as a beat" \
             "F2: a body answering another route is WRONG_ROUTE, never a table" \
             "NOT SERVED LIST residue.md: the list names exactly what the folds render, both ways" \
             "NOT SERVED LIST residue.md: every row grep counts parses here too" \
             "SERVED LIST served.md: the list names exactly what the folds render, both ways" \
             "SERVED: every route a served panel names is a door route" \
             "PHASE 04 INPUT: every panel Phase 03 named NOT SERVED is now served or in the residue, none dropped" \
             "VERBS PENDING LIST verbs-pending.md: the list names exactly what the folds render, both ways" \
             "PHASE 05: the pending cards are Phase 03's minus exactly the cards an op retired" \
             "PHASE 05: every retirement names a card Phase 03 drew" \
             "PHASE 05: an op retires a card only in its own room"; do
    [[ "$output" == *"ok $arm"* ]] || { echo "arm missing or failed: $arm"; echo "$output"; false; }
  done
}

@test "face v2: the shared lane-room fold answers every loaded-page branch, and its seven toolbelt mutants FAIL" {
  # The factory ring's debt row, paid in the money ring: module-frame folds with nothing loaded, so what a
  # fold ANSWERS over a served page had no negative control until this suite (face v2 Phase 03).
  run node "$ARC_ROOT/tests/face/lane-room.mjs"
  [[ "$output" == *"RAN: "*" checks, "*" failed"* ]] || { echo "the suite never reached its end (exit $status): $output"; false; }
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local n
  n="$(printf '%s\n' "$output" | sed -n 's/^RAN: \([0-9][0-9]*\) checks, 0 failed$/\1/p')"
  [ -n "$n" ] && [ "$n" -ge 50 ] || { echo "only '$n' checks ran: $output"; false; }
  local arm i
  for arm in "LANE WRONG_LANE: the strip asks isRefused FIRST and never draws the other lane's status" \
             "TRAIL WRONG_KINDS: a page carrying a kind this room never asked for is not its trail" \
             "TRAIL PARTIAL: a count larger than the page it came with is partial even when more is false" \
             "RUNS: a timestamp this shell cannot read says so rather than being sliced into a clock" \
             "FILE WRONG_FILE: another file's body under this id is refused by name" \
             "MANIFEST: a trail the manifest cannot read is REFUSED by the shared fold, with the host's own rule" \
             "MANIFEST: a fold handed NO manifest fails closed -- every read refused, none planned" \
             "CATALOGUE: every section is built from one pass -- each room's holds read ONCE, not once per section" \
             "KIT: a phase's spec and its Build Brief are ONE row, the spec's title, the brief named beside it" \
             "TOOLBELT: the real fold passes every catalogue check" \
             "all seven mutants were built and run"; do
    [[ "$output" == *"ok $arm"* ]] || { echo "arm missing or failed: $arm"; echo "$output"; false; }
  done
  for i in 1 2 3 4 5 6 7; do
    [[ "$output" == *"ok MUTANT $i ("*") is FAILED by the catalogue checks"* ]] || { echo "mutant $i survived or never ran"; echo "$output"; false; }
  done
}

@test "face v2: the money ring's shared folds answer every loaded branch -- substance, gate, kill panel, planned row" {
  # The money ring attacker's seventeen surviving mutants, each pinned by a check that fails when its decision is
  # removed: WRONG_SUBSTANCE, green without the gate or on a simulated door, an unread health body, the
  # unreceipted kill panel, the planned row guessed, the seal word printed, a LIVE pill in any case (face v2 Phase 03).
  run node "$ARC_ROOT/tests/face/money-ring.mjs"
  [[ "$output" == *"RAN: "*" checks, "*" failed"* ]] || { echo "the suite never reached its end (exit $status): $output"; false; }
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local n
  n="$(printf '%s\n' "$output" | sed -n 's/^RAN: \([0-9][0-9]*\) checks, 0 failed$/\1/p')"
  [ -n "$n" ] && [ "$n" -ge 45 ] || { echo "only '$n' checks ran: $output"; false; }
  local arm
  for arm in "READS: a fold handed no manifest reads nothing, and says so in every panel" \
             "SUBSTANCE: the real read answered with model.mode \"SIMULATED\" is refused WRONG_SUBSTANCE, never drawn as real" \
             "GATE: a door reading a SIMULATED spine never spends green, whatever kinds its spine holds" \
             "HEALTH: a health body with no kinds LIST is refused, and the gate says health did not answer -- never 'has never fired'" \
             "VENTURES: an unreceipted criteria file measures nothing -- no roster, every count unread, never 0" \
             "PLANNED: two rows for one room are refused -- choosing one would be a guess" \
             "PLANNED: the file's text is un-escaped ONCE -- a literal entity in it stays literal" \
             "F3: trader with its file read returns no LIVE pill in any case"              "MONEY: a day read answered with the month model is refused, never drawn"              "MONEY: fourteen days per substance, each in its own table -- real, simulated, and cost lines counted, never summed"; do
    [[ "$output" == *"ok $arm"* ]] || { echo "arm missing or failed: $arm"; echo "$output"; false; }
  done
}

@test "face v2: Phase 04 served panels answer every loaded branch, and the door refuses a hostile tree by name" {
  # The Phase 04 attackers' surviving mutants, each pinned by a check that fails when its decision is removed: an
  # empty table for a body with no list, a sum across substances or currencies, the overdue flag ignored, a seal drawn
  # as quoted, a Definition of Done blind to refused slices -- and at the door, a wrong-shaped file read as empty, a
  # junction off the tree, an address where a lead id belongs, a null spine line, an env var swapping a file.
  run node "$ARC_ROOT/tests/face/phase04-folds.mjs"
  [[ "$output" == *"RAN: "*" checks, "*" failed"* ]] || { echo "the suite never reached its end (exit $status): $output"; false; }
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local n
  n="$(printf '%s\n' "$output" | sed -n 's/^RAN: \([0-9][0-9]*\) checks, 0 failed$/\1/p')"
  [ -n "$n" ] && [ "$n" -ge 141 ] || { echo "only '$n' checks ran: $output"; false; }
  local arm
  for arm in "SERVED: a body with no list where the rows live is BAD_BODY -- never an empty table" \
             "SERVED: unreadable, blank and repeated entries are COUNTED in the note, and never drawn" \
             "MONEY DAY: the real cell holds the real amount alone -- never real + simulated" \
             "MONEY DAY: cost lines counted per currency and never totalled, the unmeasurable one counted on its day" \
             "SCHEDULER: a job whose overdue flag is set reads overdue, whatever its state string says" \
             "LEGAL: a seal the policy file does not quote is drawn as drifted, never as quoted" \
             "DEVELOP: a task file with a heading the parser refused does NOT prove its close" \
             "DAILY: the day's cash-in equals the month model's rows recorded that day" \
             "DOOR: a directory that resolves off the tree is SOURCE_OUTSIDE -- no off-tree ADR is served" \
             "DOOR: a lead_id that is not an HMAC id never reaches the wire, and is counted as withheld" \
             "DOOR: a null line on the spine is torn -- counted, never a 500" \
             "SERIALIZER: a payload nested past the cap is served as a sentence, never a stack overflow" \
             "PNL DOOR: ARC_VENTURES_FILE in the door's env withholds the kill panel by name" \
             "GATES DOOR: a resolver echoing anything but warn or block leaves the gate unresolved -- an address never reaches the wire" \
             "SLICES DOOR: a lane whose directory resolves off the tree is NAMED in the table, not read and not dropped" \
             "LEARN DOOR: a row dated 2026-09-31 is a rule and never this week's; the malformed row is counted" \
             "PNL DOOR: a directory where ventures.yaml belongs withholds the kill panel by name and keeps the P&L -- no 500, no path" \
             "FILE DOOR: an allow-listed id whose path resolves off the tree is SOURCE_OUTSIDE, never another tree's bytes" \
             "SPINE: a day file the reader cannot open is reported, and the door counts it under the table" \
             "EVOLVE: a closed experiment reads closed with its outcome, whatever verdict came before -- as the lane's board renders it" \
             "DAILY: a receipt on 2026-06-31 is unplaceable -- counted, never a silent gap in fourteen days" \
             "SPINE ROOM: a door that does not say whether every day file opened is unknown, never zero"; do
    [[ "$output" == *"ok $arm"* ]] || { echo "arm missing or failed: $arm"; echo "$output"; false; }
  done
}

@test "face v2: the company ring reads its files -- F1 names lanes, the constitution and logbook are read, the extras drawn" {
  # The company ring and the four extra rooms the owner's section 13 item 5 ruling unblocked (ADR-1337): the folds
  # answer over the door's real bodies and over mutants of them; F1's arm FAILs Cycle 15's band -> room map.
  run node "$ARC_ROOT/tests/face/company-ring.mjs"
  [[ "$output" == *"RAN: "*" checks, "*" failed"* ]] || { echo "the suite never reached its end (exit $status): $output"; false; }
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local n
  n="$(printf '%s\n' "$output" | sed -n 's/^RAN: \([0-9][0-9]*\) checks, 0 failed$/\1/p')"
  [ -n "$n" ] && [ "$n" -ge 40 ] || { echo "only '$n' checks ran: $output"; false; }
  local arm
  for arm in "F1: the face band 1300-1399 names the lane face, not the room toolbelt" \
             "F1: MUTANT -- the Cycle 15 band map (bands homed to ROOMS) fails the same lane check" \
             "ORG FOLD: the band map it draws names lanes (F1 in the module that renders it)" \
             "LAW: a file whose eternal section is renamed reads that section as UNREAD, never as zero articles" \
             "STORY: a logbook with no Entries section reads as UNREAD, never as a company with no history" \
             "EXTRAS: a row that cites no ADR-1327 is refused, and draws nothing"; do
    [[ "$output" == *"ok $arm"* ]] || { echo "arm missing or failed: $arm"; echo "$output"; false; }
  done
}

@test "face v2: /arc-face-module scaffolds a module green on face-pure + face-coverage, and refuses what it must" {
  run node "$ARC_ROOT/tests/face/face-module.mjs"
  [[ "$output" == *"RAN: "*" checks, "*" failed"* ]] || { echo "the suite never reached its end (exit $status): $output"; false; }
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local n
  n="$(printf '%s\n' "$output" | sed -n 's/^RAN: \([0-9][0-9]*\) checks, 0 failed$/\1/p')"
  [ -n "$n" ] && [ "$n" -ge 45 ] || { echo "only '$n' checks ran: $output"; false; }
  [[ "$output" == *"ends on the GREEN verdict line"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ok and removes the module folder it wrote"* ]] || { echo "$output"; false; }
  # The symlinked main guard is a counted skip only where the OS cannot make a symlink. On the
  # POSIX legs it MUST have run: a skip there would hide the one mutant the spec names.
  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*) [[ "$output" == *"symlink-arm="* ]] || { echo "the symlink arm reported nothing: $output"; false; } ;;
    *) [[ "$output" == *"symlink-arm=ran"* ]] || { echo "the symlink arm did not run on $(uname -s): $output"; false; }
       # The permission-bit arms (a module folder that cannot be read mid-proof, a rollback that cannot
       # remove what it wrote) bite only where permission bits do.
       [[ "$output" == *"posix-arms=ran"* ]] || { echo "the POSIX arms did not run on $(uname -s): $output"; false; } ;;
  esac
  # A junction needs no privilege on Windows and a symlink none elsewhere: the link arm runs everywhere.
  [[ "$output" == *"link-arm=ran"* ]] || { echo "the link arm did not run: $output"; false; }
  printf '# face-module: %s\n' "$(printf '%s\n' "$output" | grep -E '^(symlink-arm|link-arm|posix-arms)=' | tr '\n' ' ')" >&3
}

@test "face v2: the browser harness client logic runs with no install and no Chrome" {
  # face/scripts/cdp.mjs, node-floor, lockfile-platforms and the pure half of smoke/harness-run,
  # exercised against a scripted fake on every configuration, Node 18 included.
  run node "$ARC_ROOT/tests/face/cdp-client.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"RAN: "*" checks, 0 failed"* ]] || { echo "$output"; false; }
  local n; n=$(printf '%s\n' "$output" | sed -n 's/^RAN: \([0-9]\{1,\}\) checks.*/\1/p')
  [ -n "$n" ] && [ "$n" -ge 60 ] || { echo "only $n checks ran: $output"; false; }
}

@test "face v2: the modules contract derivation refuses every confirmed breaking input" {
  # Multi-line rows, strings that look like keys, duplicates, alias fan-in and malformed 5.2
  # rows each used to derive a contract that still read "in sync" (attack 2026-09-17).
  run node "$ARC_ROOT/tests/face/modules-contract.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"RAN: "*" checks, 0 failed"* ]] || { echo "$output"; false; }
  local n; n=$(printf '%s\n' "$output" | sed -n 's/^RAN: \([0-9]\{1,\}\) checks.*/\1/p')
  [ -n "$n" ] && [ "$n" -ge 18 ] || { echo "only $n checks ran: $output"; false; }
}
