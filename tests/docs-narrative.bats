#!/usr/bin/env bats
# face Phase 07 (ADR-1347, ADR-1348) / docs (ADR-1514, DOC-N, amending ADR-1513) -- a narrative ships drift-checked
# (every ADR, command and path it names exists) and accepted by the owner against its hash; the verifier is advisory.
#
# narrative-anchors is a gate, so every arm FAILs from birth with its mutant (its --selftest), the gate runs clean on
# the real tree, and the TEST is attacked too: a copy of the gate with one rule cut must fail its own self-test.
# Every test asserts that the thing it checks RAN before asserting what it printed.
bats_require_minimum_version 1.5.0
load 'test_helper'

GATE="$ARC_ROOT/.claude/scripts/docs/narrative-anchors.mjs"
VERIFY="$ARC_ROOT/.claude/scripts/engine/narrative-verify.mjs"

@test "narrative-anchors: the self-test runs all 27 arms and every mutant FAILs" {
  run node "$GATE" --selftest
  [[ "$output" == *"RAN: "*" checks, "*" failed"* ]] || { echo "the self-test never reached its end (exit $status): $output"; false; }
  [[ "$output" == *"RAN: 27 checks, 0 failed"* ]] || { echo "$output"; false; }
  [ "$status" -eq 0 ]
  local arm
  for arm in "MUTANT drift: an ADR" "MUTANT drift: a command" "MUTANT drift: a path" "MUTANT drift: a name inside a page-shape block" \
             "MUTANT anchor: a src marker" "MUTANT empty" "MUTANT edited-after-accept" "MUTANT orphan" "accept: records the owner"; do
    [[ "$output" == *"ok $arm"* ]] || { echo "arm did not pass: $arm"; echo "$output"; false; }
  done
}

@test "narrative-anchors: the real tree passes, and the counts line names narratives and the explanation debt" {
  run node "$GATE" --root "$ARC_ROOT"
  [[ "$output" == *"narrative-anchors: narratives="* ]] || { echo "the gate never reported (exit $status): $output"; false; }
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local line total narr
  line="$(printf '%s\n' "$output" | grep '^narrative-anchors: ' | tail -1)"
  narr="$(printf '%s' "$line" | sed -n 's/^narrative-anchors: narratives=\([0-9][0-9]*\) .*/\1/p')"
  total="$(printf '%s' "$line" | sed -n 's/.*explanation debt: [0-9][0-9]* of \([0-9][0-9]*\) .*/\1/p')"
  [ -n "$narr" ] && [ "$narr" -ge 3 ] || { echo "too few narratives read: $line"; false; }
  # Vacuous-pass guard: the debt is counted over every product, lane and feature the extract holds.
  [ -n "$total" ] && [ "$total" -ge 100 ] || { echo "the debt was counted over too little: $line"; false; }
}

@test "narrative-anchors: the TEST is attacked -- a gate with the ADR drift rule cut fails its own self-test" {
  local copy="$BATS_TEST_TMPDIR/gate-cut.mjs"
  sed 's/for (const n of names.adrs) if (!tree.adrs.has(n)) fails.push/for (const n of names.adrs) if (false) fails.push/' "$GATE" > "$copy"
  ! cmp -s "$GATE" "$copy" || { echo "the mutation did not apply -- the anchor text moved"; false; }
  run node "$copy" --selftest
  [[ "$output" == *"RAN: 27 checks"* ]] || { echo "the mutant self-test never ran: $output"; false; }
  [[ "$output" == *"FAIL MUTANT drift: an ADR"* ]] || { echo "the cut rule was not noticed: $output"; false; }
  [ "$status" -ne 0 ]
}

@test "narrative-verify: the verifier numbers the page exactly as the gate does, and refuses to run without a model" {
  run node --input-type=module -e "
    import { pathToFileURL } from 'node:url';
    const g = await import(pathToFileURL(process.argv[1]).href);
    const v = await import(pathToFileURL(process.argv[2]).href);
    const text = 'A plain opening. <!-- plain -->\n\nIt reads a file. <!-- src: ADR-1513 -->\n\n| a | b |\n|---|---|\n| x | y <!-- src: ADR-1513 --> |\n';
    const t = { wiki: { entities: {} }, tree: { read: () => '' } };
    const { blocks, input } = v.inputFor('products/demo', text, t);
    const same = blocks.length === g.blocksOf(text).length && blocks.length === 3;
    const numbered = input.blocks.includes('[1] para') && input.blocks.includes('[3] row') && input.classification === 'external-ok';
    console.log('numbering ' + (same && numbered ? 'agrees' : 'DISAGREES') + ' blocks=' + blocks.length);
  " "$GATE" "$VERIFY"
  [[ "$output" == *"numbering "* ]] || { echo "the probe never ran (exit $status): $output"; false; }
  [[ "$output" == *"numbering agrees blocks=3"* ]] || { echo "$output"; false; }
  run env ARC_VERIFY_MODEL= node "$VERIFY" products/engine
  [[ "$output" == *"ARC_VERIFY_MODEL"* ]] || { echo "the refusal did not name the missing model (exit $status): $output"; false; }
  [ "$status" -eq 2 ]
}

@test "narrative-verify: --accept refuses a page with no passing receipt and writes nothing" {
  run node "$VERIFY" --accept products/zz-no-such-page
  [[ "$output" == *"REFUSED products/zz-no-such-page"* ]] || { echo "the refusal never printed (exit $status): $output"; false; }
  [ "$status" -eq 1 ]
  [ ! -e "$ARC_ROOT/docs/narrative-verify/products/zz-no-such-page.json" ] || { echo "a receipt appeared"; false; }
}

@test "narrative-anchors and narrative-verify: a flag with no value is refused, and arc-run gets only ARC_ and OS variables" {
  run node "$GATE" --root
  [[ "$output" == *"--root needs a directory"* ]] || { echo "no refusal (exit $status): $output"; false; }
  [ "$status" -eq 2 ]
  run node --input-type=module -e "
    import { pathToFileURL } from 'node:url';
    const v = await import(pathToFileURL(process.argv[1]).href);
    const e = v.childEnv({ PATH: 'p', ARC_VERIFY_MODEL: 'm', GITHUB_TOKEN: 'secret', AWS_SECRET_ACCESS_KEY: 'k' });
    console.log('env ' + Object.keys(e).sort().join(','));
  " "$VERIFY"
  [[ "$output" == *"env "* ]] || { echo "the probe never ran (exit $status): $output"; false; }
  [[ "$output" == *"env ARC_VERIFY_MODEL,PATH"* ]] || { echo "$output"; false; }
}

@test "narrative-verify: a carried block is never re-sent, and a long source goes as each block's own windows, not its first page" {
  run node --input-type=module -e "
    import { pathToFileURL } from 'node:url';
    const v = await import(pathToFileURL(process.argv[1]).href);
    const filler = Array.from({ length: 400 }, (_, i) => 'filler line ' + i + ' about nothing in particular at all').join('\n');
    const src = filler + '\nThe gate refuses a symlinked narrative by name.\n' + filler;
    const t = { wiki: { entities: {} }, tree: { read: () => src } };
    const text = 'First claim. <!-- src: a/long.md -->\n\nThe gate refuses a symlinked narrative. <!-- src: a/long.md -->\n';
    const all = v.inputFor('products/demo', text, t);
    const skip = v.inputFor('products/demo', text, t, new Set([1]));
    const sent = skip.chunks.flatMap((c) => c.numbers);
    const ex = v.excerptFor('a/long.md', ['The gate refuses a symlinked narrative.'], t);
    console.log('carry ' + (JSON.stringify(sent) === '[2]' && all.chunks.flatMap((c) => c.numbers).length === 2 ? 'skips' : 'RESENDS')
      + ' window ' + (ex.includes('refuses a symlinked narrative by name') && ex.length < src.length ? 'found' : 'MISSED'));
  " "$VERIFY"
  [[ "$output" == *"carry "* ]] || { echo "the probe never ran (exit $status): $output"; false; }
  [[ "$output" == *"carry skips window found"* ]] || { echo "$output"; false; }
}

@test "narrative-anchors: --accept refuses a page that does not exist and leaves the acceptance file as it was" {
  local f="$ARC_ROOT/docs/narrative-verify/accepted.json" before="none" after="none"
  if [ -e "$f" ]; then before="$(cksum < "$f")"; fi
  run node "$GATE" --root "$ARC_ROOT" --accept products/zz-no-such-page
  [[ "$output" == *"REFUSED products/zz-no-such-page"* ]] || { echo "the refusal never printed (exit $status): $output"; false; }
  [ "$status" -eq 1 ]
  if [ -e "$f" ]; then after="$(cksum < "$f")"; fi
  [ "$before" = "$after" ] || { echo "the acceptance file changed on a refusal"; false; }
  run node "$GATE" --accept
  [[ "$output" == *"--accept needs"* ]] || { echo "no refusal for a bare --accept (exit $status): $output"; false; }
  [ "$status" -eq 2 ]
}

@test "docs-narrative: this suite registers all 9 of its tests" {
  local n
  n="$(grep -c '^@test ' "$ARC_ROOT/tests/docs-narrative.bats")"
  [ "$n" -eq 9 ] || { echo "registered $n tests, expected 9"; false; }
}
