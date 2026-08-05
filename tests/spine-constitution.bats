#!/usr/bin/env bats
# ADR-0073 -- constitution.adopted, the receipt that makes the Constitution law.
#
# One property carries the weight: the receipt must say WHICH BYTES became law. policy-lint will
# quote Constitution E2 verbatim and has to prove its quote against this hash, so every test here
# is ultimately about the receipt being unable to name a document vaguely.
#
# The hostile corpus (tests/fixtures/spine/hostile/51..56) proves the same rules through the
# EMITTER in both modes. This file proves them at the validator, where a rule can be pinned to its
# own message rather than to a shared exit code.
#
# ASCII-only test names -- bats silently DROPS a @test whose name carries a non-ASCII character,
# and the file asserts its own registered count at the bottom.
bats_require_minimum_version 1.5.0
load 'test_helper'

_node() { cd "$ARC_ROOT" && node --input-type=module -e "$1"; }

# DOC_SHA is sha256("fixture-constitution-v1"); IDEM is its weld,
# sha256("constitution.adopted|" + DOC_SHA). Both are PINNED literals rather than recomputed here,
# so a change to the welding rule turns this suite red instead of silently agreeing with itself.
# The same two values back fixture 51, which is why that fixture is an ACCEPT.
PRE='const {validateEvent} = await import("./.claude/scripts/hq/lib/validate.mjs");
const DOC_SHA = "827d6f84fb1444ae40b64d8378e6985e5d1e133ec3580efe8a15766d1b7f4c79";
const IDEM = "38003cd9c17c0a16912e19749e2b85ab795dda4e28dc8b197a4761991ff5bd96";
const P = (over={}) => ({document:"docs/strategy/arc-CONSTITUTION.md", version:"1.0", sha256:DOC_SHA, ...over});
const mk = (payload=P(), over={}) => ({id:"01JQ8XZ9K0ABCDEFGH00000051", v:1, ts:"2026-07-22T21:30:00+05:30",
  idem: IDEM, actor:"human:ashiq", process:"spine-fixture@1.0.0", model:null, venture:"arc",
  run_id:"r-t", kind:"constitution.adopted", payload, outcome:"ok", cost:null, evidence:null,
  supersedes:null, ...over});
const refuses = (fn) => { try { fn(); return "ACCEPTED"; } catch (e) { return e.code + ":" + e.message; } };'

@test "the closed vocabulary carries constitution adopted, exactly once" {
  run _node 'const {KINDS} = await import("./.claude/scripts/hq/lib/validate.mjs");
    const n = KINDS.filter(k => k === "constitution.adopted").length;
    console.log(n === 1 && KINDS.length === new Set(KINDS).size ? "present-once" : "BROKEN:count=" + n);'
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"present-once"* ]]
}

@test "a well formed adoption receipt is accepted" {
  run _node "$PRE validateEvent(mk()); console.log('accepted');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"accepted"* ]]
}

@test "an unknown payload key is refused" {
  # The specific key matters: a status field is the one a future reader is most tempted to add,
  # and a mutable status on an append-only receipt is a field that learns to lie.
  run _node "$PRE console.log(refuses(() => validateEvent(mk(P({status: 'current'})))));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"BAD_CONSTITUTION"* ]]
  [[ "$output" == *"unknown key"* ]]
}

@test "every required payload key is refused when absent" {
  run _node "$PRE
    const out = ['document', 'version', 'sha256'].map(k => {
      const p = P(); delete p[k];
      return k + '=' + refuses(() => validateEvent(mk(p))).split(':')[0];
    });
    console.log(out.join(' '));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"document=BAD_CONSTITUTION version=BAD_CONSTITUTION sha256=BAD_CONSTITUTION"* ]]
}

@test "a hash that is not lowercase sha256 hex is refused" {
  # Uppercase is first because it is the one that looks harmless: a case-normalizing validator
  # would accept it and then hash-compare unequal against every real digest forever.
  run _node "$PRE
    const bad = [DOC_SHA.toUpperCase(), DOC_SHA.slice(0, 63), DOC_SHA.slice(0, 63) + 'g', DOC_SHA + '0', '', 123, null];
    console.log(bad.map(v => refuses(() => validateEvent(mk(P({sha256: v})))).split(':')[0]).join(' '));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" != *"ACCEPTED"* ]]
  [[ "$output" == *"BAD_CONSTITUTION BAD_CONSTITUTION BAD_CONSTITUTION BAD_CONSTITUTION BAD_CONSTITUTION BAD_CONSTITUTION BAD_CONSTITUTION"* ]]
}

@test "a document path that escapes the repo is refused" {
  # policy-lint dereferences this path later, so a traversal stored today is a file read somewhere
  # else tomorrow. The backslash case is built with fromCharCode so no shell quoting layer can
  # quietly eat it.
  run _node "$PRE
    const bs = String.fromCharCode(92);
    const bad = ['docs/../../etc/passwd', '/etc/passwd', 'C:/Windows/win.ini', 'docs' + bs + 'c.md', '~/c.md', './c.md', '', 7];
    console.log(bad.map(v => refuses(() => validateEvent(mk(P({document: v})))).split(':')[0]).join(' '));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" != *"ACCEPTED"* ]]
  [[ "$output" == *"BAD_CONSTITUTION BAD_CONSTITUTION BAD_CONSTITUTION BAD_CONSTITUTION BAD_CONSTITUTION BAD_CONSTITUTION BAD_CONSTITUTION BAD_CONSTITUTION"* ]]
}

@test "a version that is not dotted numeric is refused" {
  run _node "$PRE
    const bad = ['v1.0', '1', '1.0.0-rc.1', 'one.zero', '1.', '', 1.0];
    console.log(bad.map(v => refuses(() => validateEvent(mk(P({version: v})))).split(':')[0]).join(' '));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" != *"ACCEPTED"* ]]
  [[ "$output" == *"BAD_CONSTITUTION BAD_CONSTITUTION BAD_CONSTITUTION BAD_CONSTITUTION BAD_CONSTITUTION BAD_CONSTITUTION BAD_CONSTITUTION"* ]]
}

@test "an idem not welded to the adopted hash is refused" {
  run _node "$PRE console.log(refuses(() => validateEvent(mk(P(), {idem: '8690f21ee782b1e0a39d0fafddef7a57c147365bc9b359e0a23dfbd789175be7'}))));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"BAD_CONSTITUTION"* ]]
  [[ "$output" == *"bound to the text it adopts"* ]]
}

@test "the welded idem is derived from the adopted text, not a constant" {
  # Two halves, and both have to hold. An amendment carrying its OWN correctly derived weld is
  # accepted -- otherwise the Constitution could never be amended. The original idem against that
  # amended text is refused -- otherwise a stale key could ride new law onto the spine. A
  # hardcoded weld would fail the first half; a missing weld check would fail the second.
  run _node "$PRE
    const {createHash} = await import('node:crypto');
    const sha = s => createHash('sha256').update(s, 'utf8').digest('hex');
    const other = sha('amended-constitution-v2');
    validateEvent(mk(P({sha256: other}), {idem: sha('constitution.adopted|' + other)}));
    const stale = refuses(() => validateEvent(mk(P({sha256: other}), {idem: IDEM}))).split(':')[0];
    console.log('amended-accepted ' + stale);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"amended-accepted BAD_CONSTITUTION"* ]]
}

@test "this file registers the 10 tests it declares" {
  # BATS_TEST_NAMES is what bats REGISTERED, which is the only thing that can see a test bats
  # dropped. Comparing a grep of this file against a literal in this file is a tautology.
  declared=$(grep -c '^@test ' "$BATS_TEST_FILENAME")
  registered=${#BATS_TEST_NAMES[@]}
  [ "$declared" -eq 10 ] || { echo "declared $declared, expected 10"; false; }
  [ "$registered" -eq "$declared" ] || { echo "bats registered $registered of $declared declared tests -- one was DROPPED (non-ASCII name?)"; false; }
}
