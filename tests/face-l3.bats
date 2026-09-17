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
  # from it. Each exclusion is one named file with its reason, never a prefix.
  # The exclusion is the FULL path of each file, so a same-named file elsewhere is not excused.
  local importers
  importers=$(printf '%s\n' "$output" | grep -v '/\.claude/scripts/core/face-tokens\.mjs$' | grep -v '/\.claude/scripts/core/face-colour-literal\.mjs$' | grep -v '^$' || true)
  [ -z "$importers" ] || { echo "an arc script depends on face/: $importers"; false; }
  # And an excused file is excused for NAMING the path, never for importing from it.
  local excused=("$ARC_ROOT/.claude/scripts/core/face-tokens.mjs" "$ARC_ROOT/.claude/scripts/core/face-colour-literal.mjs")
  [ -f "${excused[0]}" ] && [ -f "${excused[1]}" ] || { echo "an excused file is missing: ${excused[*]}"; false; }
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
