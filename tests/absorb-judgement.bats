#!/usr/bin/env bats
# Phase 03 -- the sealed blind A/B and its receipt chain (REQ-06, REQ-07 / ADR-0603).
#
# TWO PROPERTIES, and the ORDER between them is the whole thing:
#   1. the label-to-variant mapping is committed by HASH before the owner sees anything, and the
#      plaintext is not in the bundle and not in git until a decision.recorded exists
#   2. the payload is strict IN BOTH DIRECTIONS at the SPINE boundary -- unknown keys refused, and
#      every required key's absence refused BY NAME
#
# WHY THE COMMITMENT EXISTS AT ALL. The first design was an honour system: the plaintext mapping sat
# on disk from the start and the only control was one code path declining to display it. The owner
# doing the judging has a filesystem. A commit-and-reveal hash makes "sealed" true regardless of
# which door is used to look, and it is stdlib so A2 holds.
#
# ASCII-only test names -- bats silently DROPS a non-ASCII @test name, so this file asserts its own
# registered count at the bottom.
bats_require_minimum_version 1.5.0
load 'test_helper'

J=".claude/scripts/absorb/judgement.mjs"
EVENT=".claude/scripts/hq/arc-event.sh"

_j() { cd "$ARC_ROOT" && node "$J" "$@"; }

# A payload built from parts so each test mutates exactly one thing.
_payload() { # $1 = a jq-free JSON body override applied by sed on the base
  printf '%s' "$1"
}

_seal_hash() { node -e 'process.stdout.write(require("crypto").createHash("sha256").update(process.argv[1]).digest("hex"))' "$1"; }

# BOTH state doors are redirected into the test tmpdir. Without ARC_SPINE_ROOT these tests would
# append real events to the repo's own spine on every CI run of every leg, and without
# ARC_ABSORB_SEAL_DIR they would write seals into the shared repo state where two parallel shards
# could collide. Test-only env doors, the same convention spine-emit.bats already uses.
setup() {
  CORR="bats-${BATS_TEST_NUMBER}"
  BUNDLE="$BATS_TEST_TMPDIR/bundle"
  export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine"
  export ARC_ABSORB_SEAL_DIR="$BATS_TEST_TMPDIR/seals"
  mkdir -p "$ARC_SPINE_ROOT" "$ARC_ABSORB_SEAL_DIR"
  SEAL_FILE="$ARC_ABSORB_SEAL_DIR/$CORR.json"
}

# ---------- the seal ----------

@test "seal randomizes labels and puts NO mapping in the bundle" {
  run _j seal --candidate T-01 --variants "absorbedvariant,oldvariant" --fixtures "f1,f2,f3" --evidence "$BUNDLE" --correlation "$CORR"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # the payload came back and carries a commitment
  [[ "$output" == *'"subject":"absorb.ab-judgement"'* ]] || { echo "$output"; false; }
  [[ "$output" == *'"commitment":"'* ]] || { echo "$output"; false; }
  # and the BUNDLE reveals nothing: no variant path, no variant name
  [ -f "$BUNDLE/commitment.txt" ]
  [ ! -f "$BUNDLE/mapping.json" ]
  run grep -c -E "absorbedvariant|oldvariant" "$BUNDLE/commitment.txt"
  [ "$output" -eq 0 ] || { echo "the bundle leaks the mapping:"; cat "$BUNDLE/commitment.txt"; false; }
}

# A label that names its variant is not blind, so none is ever generated.
# THE BLINDING TEST THAT ACTUALLY FAILS WHEN BLINDING IS DELETED. The v1 version grepped for a list
# of leaky words; a mutant that set `labels = variants.slice()` emitted "absorbed=a.mjs" and "old=b.mjs"
# -- the variant names shown straight to the owner -- and BOTH v1 assertions PASSED, because the
# substring `"old"` with quotes never appears in `"old=b.mjs"`. A denylist in the test repeated the
# denylist mistake in the code.
@test "generated labels are pool members and share no substring with any variant" {
  run _j seal --candidate T-01 --variants "absorbedvariant,oldvariant" --fixtures "f1,f2,f3" --evidence "$BUNDLE" --correlation "$CORR"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local labels
  labels="$(node -e 'const p=JSON.parse(process.argv[1]); process.stdout.write(p.labels.join(" "))' "$(printf '%s' "$output" | head -1)")"
  [ -n "$labels" ] || { echo "no labels in the payload"; echo "$output"; false; }
  # 1. every label is a POOL member -- the only form of this check a mutant cannot talk around
  for l in $labels; do
    grep -q "\"$l\"" "$ARC_ROOT/.claude/scripts/hq/lib/validate-absorb.mjs"       || { echo "label $l is not in LABEL_POOL, so blinding was bypassed"; false; }
  done
  # 2. and no label shares a substring with either supplied variant
  for l in $labels; do
    case "absorbedvariant" in *"$l"*) echo "label $l is a substring of a variant name"; false ;; esac
    case "oldvariant" in *"$l"*) echo "label $l is a substring of a variant name"; false ;; esac
  done
}

@test "fewer than three fixtures is refused because REQ-03 requires three" {
  run _j seal --candidate T-01 --variants "alpha,bravo" --fixtures "f1,f2" --evidence "$BUNDLE" --correlation "$CORR"
  [ "$status" -eq 2 ]
  [[ "$output" == *"at least 3"* ]] || { echo "$output"; false; }
}

@test "resealing the same correlation is refused" {
  _j seal --candidate T-01 --variants "alpha,bravo" --fixtures "f1,f2,f3" --evidence "$BUNDLE" --correlation "$CORR" >/dev/null
  run _j seal --candidate T-01 --variants "alpha,bravo" --fixtures "f1,f2,f3" --evidence "$BUNDLE" --correlation "$CORR"
  [ "$status" -eq 2 ]
  [[ "$output" == *"already exists"* ]] || { echo "$output"; false; }
}

@test "verify confirms the seal hashes to its own commitment" {
  _j seal --candidate T-01 --variants "alpha,bravo" --fixtures "f1,f2,f3" --evidence "$BUNDLE" --correlation "$CORR" >/dev/null
  run _j verify --correlation "$CORR"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"OK"* ]]
}

# The negative control for `verify`: it must FAIL on a tampered seal, or it proves nothing.
@test "verify FAILS when the mapping is edited after sealing" {
  _j seal --candidate T-01 --variants "alpha,bravo" --fixtures "f1,f2,f3" --evidence "$BUNDLE" --correlation "$CORR" >/dev/null
  node -e '
const fs = require("fs"); const p = process.argv[1];
const s = JSON.parse(fs.readFileSync(p, "utf8"));
const k = Object.keys(s.mapping)[0];
s.mapping[k] = "swapped-after-sealing.mjs";
fs.writeFileSync(p, JSON.stringify(s));
' "$SEAL_FILE"
  run _j verify --correlation "$CORR"
  [ "$status" -eq 3 ] || { echo "verify did not notice a tampered mapping; the commitment proves nothing"; echo "$output"; false; }
  [[ "$output" == *"MISMATCH"* ]]
}

# ---------- the reveal, and its ordering ----------

@test "reveal without a decision is refused" {
  _j seal --candidate T-01 --variants "alpha,bravo" --fixtures "f1,f2,f3" --evidence "$BUNDLE" --correlation "$CORR" >/dev/null
  run _j reveal --correlation "$CORR" --evidence "$BUNDLE"
  [ "$status" -eq 3 ]
  [[ "$output" == *"ONLY after a decision"* ]] || { echo "$output"; false; }
  [ ! -f "$BUNDLE/mapping.json" ] || { echo "the mapping was written despite the refusal"; false; }
}

# DELETED and replaced by "a real decision naming a real pick reveals the mapping" further down.
# This test handed reveal a hardcoded ULID that exists on no spine, and it PASSED -- which is
# precisely blocker 1: the decision was believed rather than looked up. Once the lookup landed, the
# test correctly went red. A test that only passes while the defect is present is a test FOR the
# defect, so it goes rather than gets patched.

# The bundle's published commitment is what the owner judged against. If it does not match the seal,
# the judgement was made against a different mapping and is worthless.
@test "reveal refuses when the bundle's commitment is not the seal's" {
  _j seal --candidate T-01 --variants "alpha,bravo" --fixtures "f1,f2,f3" --evidence "$BUNDLE" --correlation "$CORR" >/dev/null
  printf '%s\n' "0000000000000000000000000000000000000000000000000000000000000000" > "$BUNDLE/commitment.txt"
  run _j reveal --correlation "$CORR" --evidence "$BUNDLE" --decision 01ARZ3NDEKTSV4RRFFQ69G5FAV
  [ "$status" -eq 3 ]
  [[ "$output" == *"judged against a different mapping"* ]] || { echo "$output"; false; }
}

# ---------- the decision is LOOKED UP, never believed (Phase 03 blockers) ----------
# v1 accepted ANY non-empty string as --decision, so the ordering property was a self-declaration:
# `--decision "I made it up"` revealed the mapping. And ADR-0603 Amendment 1 said "absorb's chain
# validates the pick= prefix" while nothing did -- the full chain ran green with the reason
# "looks nicer" and no label ever named. One lookup closes both.

# Emits a sealed judgement and returns its approval ULID on stdout.
_emit_seal() { # $1 = correlation, $2 = evidence dir
  local pl
  pl="$(node -e 'const j=require(process.argv[1]);process.stdout.write(JSON.stringify({subject:"absorb.ab-judgement",candidate:j.candidate,fixtures:["f1","f2","f3"],labels:Object.keys(j.mapping),commitment:j.commitment,evidence_path:"scratch/b",correlation:j.correlation}))' "$ARC_ABSORB_SEAL_DIR/$1.json")"
  cd "$ARC_ROOT" && bash "$EVENT" emit approval.requested --strict --payload "$pl" 2>&1 | tail -1
}
_last_decision() {
  cd "$ARC_ROOT" && node --input-type=module -e 'const {query}=await import("./.claude/scripts/hq/spine.mjs");const {spineRoot}=await import("./.claude/scripts/hq/lib/spine-io.mjs");const e=(await query(spineRoot(),{kind:"decision.recorded"})).events;process.stdout.write(e.length?e[e.length-1].event.id:"NONE");'
}
_first_label() { node -e 'const j=require(process.argv[1]);process.stdout.write(Object.keys(j.mapping)[0])' "$ARC_ABSORB_SEAL_DIR/$1.json"; }

@test "a non-ULID decision is refused" {
  _j seal --candidate T-01 --variants "alpha,bravo" --fixtures "f1,f2,f3" --evidence "$BUNDLE" --correlation "$CORR" >/dev/null
  run _j reveal --correlation "$CORR" --evidence "$BUNDLE" --decision "I made it up"
  [ "$status" -eq 3 ]
  [[ "$output" == *"is not a ULID"* ]] || { echo "$output"; false; }
  [ ! -f "$BUNDLE/mapping.json" ]
}

@test "a well-formed ULID that exists on no spine is refused" {
  _j seal --candidate T-01 --variants "alpha,bravo" --fixtures "f1,f2,f3" --evidence "$BUNDLE" --correlation "$CORR" >/dev/null
  run _j reveal --correlation "$CORR" --evidence "$BUNDLE" --decision 01ARZ3NDEKTSV4RRFFQ69G5FAV
  [ "$status" -eq 3 ]
  [[ "$output" == *"does not exist on the spine"* ]] || { echo "$output"; false; }
  [ ! -f "$BUNDLE/mapping.json" ]
}

@test "a real decision whose reason names no pick is refused" {
  _j seal --candidate T-01 --variants "alpha,bravo" --fixtures "f1,f2,f3" --evidence "$BUNDLE" --correlation "$CORR" >/dev/null
  local aid did
  aid="$(_emit_seal "$CORR" "$BUNDLE")"
  cd "$ARC_ROOT" && node .claude/scripts/hq/arc-inbox.mjs approve "$aid" --reason "looks nicer" >/dev/null 2>&1
  did="$(_last_decision)"
  [ "$did" != "NONE" ] || { echo "no decision was recorded, so this test proves nothing"; false; }
  run _j reveal --correlation "$CORR" --evidence "$BUNDLE" --decision "$did"
  [ "$status" -eq 3 ]
  [[ "$output" == *'does not start with "pick='* ]] || { echo "$output"; false; }
  [ ! -f "$BUNDLE/mapping.json" ]
}

@test "a decision naming a label that is not this judgement's is refused" {
  _j seal --candidate T-01 --variants "alpha,bravo" --fixtures "f1,f2,f3" --evidence "$BUNDLE" --correlation "$CORR" >/dev/null
  local aid did
  aid="$(_emit_seal "$CORR" "$BUNDLE")"
  cd "$ARC_ROOT" && node .claude/scripts/hq/arc-inbox.mjs approve "$aid" --reason "pick=notalabel; because" >/dev/null 2>&1
  did="$(_last_decision)"
  run _j reveal --correlation "$CORR" --evidence "$BUNDLE" --decision "$did"
  [ "$status" -eq 3 ]
  [[ "$output" == *"not one of this judgement"* ]] || { echo "$output"; false; }
}

# THE HAPPY PATH, which is what makes every refusal above meaningful: if this cannot pass, the
# refusals are just a broken tool saying no to everything.
@test "a real decision naming a real pick reveals the mapping and records the winner" {
  _j seal --candidate T-01 --variants "absorbedvariant,oldvariant" --fixtures "f1,f2,f3" --evidence "$BUNDLE" --correlation "$CORR" >/dev/null
  local aid did lab
  lab="$(_first_label "$CORR")"
  aid="$(_emit_seal "$CORR" "$BUNDLE")"
  cd "$ARC_ROOT" && node .claude/scripts/hq/arc-inbox.mjs approve "$aid" --reason "pick=$lab; it caught the case the other missed" >/dev/null 2>&1
  did="$(_last_decision)"
  run _j reveal --correlation "$CORR" --evidence "$BUNDLE" --decision "$did"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ -f "$BUNDLE/mapping.json" ]
  grep -q "\"picked_label\": \"$lab\"" "$BUNDLE/mapping.json" || { cat "$BUNDLE/mapping.json"; false; }
  grep -q '"decides_approval"' "$BUNDLE/mapping.json" || { echo "the reveal does not record which approval was decided"; false; }
}

# Nothing bound the pieces together before: a reveal succeeded against ANY bundle whose
# commitment.txt happened to match, and against a decision on a different judgement entirely.
@test "a decision on a DIFFERENT judgement cannot reveal this one" {
  _j seal --candidate T-01 --variants "alpha,bravo" --fixtures "f1,f2,f3" --evidence "$BUNDLE" --correlation "${CORR}a" >/dev/null
  _j seal --candidate T-02 --variants "charlie,delta" --fixtures "f1,f2,f3" --evidence "$BATS_TEST_TMPDIR/b2" --correlation "${CORR}b" >/dev/null
  local aid did lab
  lab="$(_first_label "${CORR}b")"
  aid="$(_emit_seal "${CORR}b" "$BATS_TEST_TMPDIR/b2")"
  cd "$ARC_ROOT" && node .claude/scripts/hq/arc-inbox.mjs approve "$aid" --reason "pick=$lab; fine" >/dev/null 2>&1
  did="$(_last_decision)"
  # that decision belongs to judgement B; try to use it to reveal judgement A
  run _j reveal --correlation "${CORR}a" --evidence "$BUNDLE" --decision "$did"
  [ "$status" -eq 3 ]
  [[ "$output" == *"DIFFERENT mapping"* || "$output" == *"decides correlation"* ]] || { echo "$output"; false; }
}

# ---------- the payload profile, enforced at the SPINE boundary ----------
# These go through the real emitter, so they prove the profile is enforced where it cannot be
# bypassed -- not merely inside absorb's own code.

# --strict is LOAD-BEARING. Without it arc-event.sh exits 0 on a refusal (hook mode quarantines the
# event instead of failing), so every `status -eq 0` assertion here could not fail and the accept-cases
# were vacuous: the adversarial pass emitted a payload that was quarantined with ZERO events written
# and both assertions still passed.
_emit() { cd "$ARC_ROOT" && bash "$EVENT" emit approval.requested --strict --payload "$1" 2>&1; }

@test "a well-formed ab-judgement payload is accepted by the spine" {
  local h; h="$(_seal_hash well-formed)"
  run _emit "{\"subject\":\"absorb.ab-judgement\",\"candidate\":\"T-01\",\"fixtures\":[\"f1\",\"f2\",\"f3\"],\"labels\":[\"crimson\",\"harbor\"],\"commitment\":\"$h\",\"evidence_path\":\"p\",\"correlation\":\"$CORR\"}"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" != *"BAD_AB_JUDGEMENT"* ]] || { echo "$output"; false; }
}

@test "an unknown key in the profile is refused by name" {
  local h; h="$(_seal_hash unknown-key)"
  run _emit "{\"subject\":\"absorb.ab-judgement\",\"candidate\":\"T-01\",\"fixtures\":[\"f1\",\"f2\",\"f3\"],\"labels\":[\"crimson\",\"harbor\"],\"commitment\":\"$h\",\"evidence_path\":\"p\",\"correlation\":\"c\",\"sneaky\":\"x\"}"
  [[ "$output" == *"BAD_AB_JUDGEMENT"* ]] || { echo "$output"; false; }
  [[ "$output" == *"sneaky"* ]] || { echo "the refusal did not name the unknown key"; echo "$output"; false; }
}

# The likelier real slip, and the direction v1 of the spec did not promise: a payload assembled
# programmatically that dropped a field.
@test "every required key's absence is refused by name" {
  local h; h="$(_seal_hash missing)"
  for missing in candidate fixtures labels commitment evidence_path correlation; do
    run node -e '
const keys = { subject: "absorb.ab-judgement", candidate: "T-01", fixtures: ["f1","f2","f3"],
               labels: ["crimson","harbor"], commitment: process.argv[2], evidence_path: "p", correlation: "c" };
delete keys[process.argv[1]];
process.stdout.write(JSON.stringify(keys));
' "$missing" "$h"
    local pl="$output"
    run _emit "$pl"
    [[ "$output" == *"BAD_AB_JUDGEMENT"* ]] || { echo "dropping $missing was accepted"; echo "$output"; false; }
    [[ "$output" == *"$missing"* ]] || { echo "the refusal did not name the missing key $missing"; echo "$output"; false; }
  done
}

@test "a leaky label is refused at the spine even if something else generated it" {
  local h; h="$(_seal_hash leaky)"
  run _emit "{\"subject\":\"absorb.ab-judgement\",\"candidate\":\"T-01\",\"fixtures\":[\"f1\",\"f2\",\"f3\"],\"labels\":[\"old\",\"new\"],\"commitment\":\"$h\",\"evidence_path\":\"p\",\"correlation\":\"c\"}"
  [[ "$output" == *"BAD_AB_JUDGEMENT"* ]] || { echo "$output"; false; }
  # the message changed with the fix: a denylist said "not blind", the allowlist says what it is not
  # a member OF. Asserting the old wording would have kept passing only while the denylist existed.
  [[ "$output" == *"not one of the"* ]] || { echo "$output"; false; }
}

@test "duplicate labels are refused because one variant shown twice is not a comparison" {
  local h; h="$(_seal_hash dup)"
  run _emit "{\"subject\":\"absorb.ab-judgement\",\"candidate\":\"T-01\",\"fixtures\":[\"f1\",\"f2\",\"f3\"],\"labels\":[\"crimson\",\"crimson\"],\"commitment\":\"$h\",\"evidence_path\":\"p\",\"correlation\":\"c\"}"
  [[ "$output" == *"distinct"* ]] || { echo "$output"; false; }
}

@test "a commitment that is not a sha256 hex is refused" {
  run _emit "{\"subject\":\"absorb.ab-judgement\",\"candidate\":\"T-01\",\"fixtures\":[\"f1\",\"f2\",\"f3\"],\"labels\":[\"crimson\",\"harbor\"],\"commitment\":\"not-a-hash\",\"evidence_path\":\"p\",\"correlation\":\"c\"}"
  [[ "$output" == *"BAD_AB_JUDGEMENT"* ]] || { echo "$output"; false; }
  [[ "$output" == *"commitment"* ]] || { echo "$output"; false; }
}

@test "fewer than three fixtures is refused at the spine as well as at the seal" {
  local h; h="$(_seal_hash twofix)"
  run _emit "{\"subject\":\"absorb.ab-judgement\",\"candidate\":\"T-01\",\"fixtures\":[\"f1\",\"f2\"],\"labels\":[\"crimson\",\"harbor\"],\"commitment\":\"$h\",\"evidence_path\":\"p\",\"correlation\":\"c\"}"
  [[ "$output" == *"at least 3"* ]] || { echo "$output"; false; }
}

# A generic approval.requested must stay generic: the profile applies ONLY to payloads declaring the
# subject, or absorb would have broken every other gate in the repo.
@test "an approval.requested without the subject is untouched by the profile" {
  run _emit '{"what":"an ordinary gate","gate":"something-else"}'
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" != *"BAD_AB_JUDGEMENT"* ]] || { echo "the profile leaked onto a generic approval"; echo "$output"; false; }
}

# ---------- REQ-07: nothing adopts itself, in either direction ----------

# Matches ASSIGNMENT syntax, which is what the rule is actually about. The first version excluded
# `status ===` but not `status !==`, so a pure READ of a status tripped its own guard and this test
# was RED on the tree it shipped with -- the adversarial pass found it before CI did. And the
# exclusion list itself was the bug: filtering out any line containing `// ` meant
# `row.status = "adopted"; // absorb promotes its own candidate` was invisible to it. Matching what a
# WRITE looks like needs no exclusion list at all.
@test "no absorb script assigns an adopted or retired status" {
  cd "$ARC_ROOT"
  run bash -c "grep -nE '(status|\\.status)\\s*=\\s*[\"'\\'']?(adopted|retired)' .claude/scripts/absorb/*.mjs || true"
  [ -z "$output" ] || { echo "an absorb script assigns a terminal status directly:"; echo "$output"; false; }
}

# The guard's own negative control: it must FIRE on a line that does assign, or it proves nothing --
# including the commented form that defeated the first version.
@test "the terminal-status guard fires on an assignment, comment or not" {
  local m="$BATS_TEST_TMPDIR/mutant.mjs"
  printf 'row.status = "adopted";\n' > "$m"
  run bash -c "grep -nE '(status|\\.status)\\s*=\\s*[\"'\\'']?(adopted|retired)' '$m' || true"
  [ -n "$output" ] || { echo "the guard does not fire on a bare assignment"; false; }
  printf 'row.status = "adopted"; // absorb promotes its own candidate\n' > "$m"
  run bash -c "grep -nE '(status|\\.status)\\s*=\\s*[\"'\\'']?(adopted|retired)' '$m' || true"
  [ -n "$output" ] || { echo "a trailing comment hid the assignment, which is how v1 was defeated"; false; }
}

@test "judgement.mjs never touches the registry" {
  cd "$ARC_ROOT"
  run grep -c "registry.json" "$J"
  [ "$output" -eq 0 ] || { echo "judgement.mjs references the registry; it is propose-only"; false; }
}

# --- ADR-0605's adoption-proposal profile (added Phase 04) ------------------------------------------
# ADR-0605 line 41 said "the results table travels WITH the adoption proposal -- a proposal without its
# table is lint-invalid" and NOTHING implemented it. A guard with no caller, in the ADR's own
# requirement, found while raising the very proposal it governs. The table now rides IN the payload
# rather than as a path to it: a path can be checked for shape but not for content without filesystem
# I/O, and a spine validator must have no side effects.
#
# Every refusal below is a distinct way to have a "results" field and carry no result. That is the
# whole class the ADR's sentence was aimed at, and the reason an existence check would not have been
# enough.

VA="./.claude/scripts/hq/lib/validate-absorb.mjs"

_adoption() { # $1 = a JS statement mutating `p`; prints ACCEPTED or "REFUSED <message>"
  cd "$ARC_ROOT" && node -e '
    import(process.argv[1]).then((m) => {
      const p = {
        subject: "absorb.adoption", candidate: "T-01", direction: "retire",
        ab_decision: "01KZN380GP5EDF58H6VRTT0S0T", results: { primary: "3 -> 0" },
        recommendation: "do not adopt", evidence_path: "initiatives/absorb/evidence/x",
      };
      if (process.argv[2]) eval(process.argv[2]);
      try {
        m.assertAdoptionProposal({ kind: "approval.requested", payload: p });
        process.stdout.write("ACCEPTED");
      } catch (e) { process.stdout.write("REFUSED " + e.message); }
    });
  ' "$VA" "$1"
}

@test "adoption: a complete proposal is accepted" {
  run _adoption ""
  [ "$output" = "ACCEPTED" ] || { echo "$output"; false; }
}

@test "adoption: a proposal with NO results table is refused" {
  run _adoption "delete p.results"
  [[ "$output" == REFUSED* ]] || { echo "$output"; false; }
  [[ "$output" == *"missing required key"* ]]
}

@test "adoption: an EMPTY results table is refused, having the field is not having the table" {
  run _adoption "p.results = {}"
  [[ "$output" == *"results is empty"* ]] || { echo "$output"; false; }
}

@test "adoption: a results table that is a string rather than a table is refused" {
  run _adoption 'p.results = "3 -> 0"'
  [[ "$output" == *"object of metric"* ]] || { echo "$output"; false; }
}

@test "adoption: a nested value inside the results table is refused" {
  run _adoption "p.results = { m: { a: 1 } }"
  [[ "$output" == *"must be a string or number"* ]] || { echo "$output"; false; }
}

# REQ-07 routes BOTH directions through the inbox, so the direction is part of the receipt and a
# proposal that does not say which way it goes is not a proposal.
@test "adoption: a direction outside adopt or retire is refused" {
  run _adoption 'p.direction = "maybe"'
  [[ "$output" == *"not adopt or retire"* ]] || { echo "$output"; false; }
}

@test "adoption: an ab_decision that is not a ULID is refused" {
  run _adoption 'p.ab_decision = "yesterday"'
  [[ "$output" == *"not a ULID"* ]] || { echo "$output"; false; }
}

@test "adoption: a blank recommendation is refused, the owner overrules a position not a blank" {
  run _adoption 'p.recommendation = "   "'
  [[ "$output" == *"non-empty text"* ]] || { echo "$output"; false; }
}

@test "adoption: an unknown key is refused, the shape is closed" {
  run _adoption "p.extra = 1"
  [[ "$output" == *"unknown key"* ]] || { echo "$output"; false; }
}

@test "adoption: a traversing evidence_path is refused" {
  run _adoption 'p.evidence_path = "../../etc"'
  [[ "$output" == *"traversal"* ]] || { echo "$output"; false; }
}

# CONTAINMENT CONTROL. A plain approval.requested must NOT be held to this profile, or every generic
# approval in the repo starts failing. Same containment the ab-judgement profile carries, and the
# reason both profiles key on an explicit subject rather than on shape.
@test "adoption: a plain approval.requested is not held to the adoption profile (control)" {
  run bash -c "cd \"\$ARC_ROOT\" && node -e 'import(process.argv[1]).then(m=>process.stdout.write(String(m.isAdoptionProposal({kind:\"approval.requested\",payload:{what:\"x\",gate:\"y\"}}))))' \"\$VA\""
  [ "$output" = "false" ] || { echo "$output"; false; }
}

@test "absorb-judgement suite registers every test it defines" {
  registered=${#BATS_TEST_NAMES[@]}
  [ "$registered" -eq 37 ] || { echo "registered $registered tests, expected 37"; false; }
}
