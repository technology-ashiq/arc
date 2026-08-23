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
  [ -n "$n" ] && [ "$n" -ge 165 ] || { echo "only $n checks ran: $output"; false; }
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
  run bash -c "grep -rl 'face/src' '$ARC_ROOT/.claude/scripts' 2>/dev/null || true"
  # face-tokens.mjs WRITES the copy, so it names the path; nothing may IMPORT from it.
  local importers
  importers=$(printf '%s\n' "$output" | grep -v 'face-tokens.mjs' | grep -v '^$' || true)
  [ -z "$importers" ] || { echo "an arc script depends on face/: $importers"; false; }
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
  for arm in "banner marks the file GENERATED" "copy carries the reserved-hue tokens" \
             "copy carries the product accent" "a hand-edited copy exits 1" \
             "a wrong repo root is refused, not copied"; do
    [[ "$output" == *"$arm"*"PASS"* ]] || { echo "arm did not pass: $arm"; echo "$output"; false; }
  done
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
