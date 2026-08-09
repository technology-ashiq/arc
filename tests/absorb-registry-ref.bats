#!/usr/bin/env bats
# Phase 00 -- registry-ref, the ONE thing absorb asserts about develop's lock (ADR-0600 / A5).
#
# A registry row references a lock entry by name + version and asserts only that the pair resolves
# to exactly one row in capabilities[]. It never copies the hash, publisher-auth, class or
# provenance -- those live in the lock alone.
#
# WHY THE ASSERTION IS THIS WEAK, on purpose: Phase 00's DEV-B/C audit found capability-lock.json
# has NO declared schema (initiatives/absorb/evidence/phase-00/dev-bc-audit.md FINDING 1.1), so a
# stronger check would be validating against a contract that does not exist.
#
# TWO SOURCES, and the reason is not redundancy: the fixture lock carries edge rows the real lock
# cannot be made to carry (a deliberate duplicate name+version), and the real lock is the only
# thing that notices develop reshaping the file under us. A fixture-only test is blind to drift; a
# real-file-only test cannot construct the edges.
#
# ASCII-only test names -- bats silently DROPS a non-ASCII @test name, so this file asserts its
# own registered count at the bottom.
bats_require_minimum_version 1.5.0
load 'test_helper'

REF=".claude/scripts/absorb/registry-ref.mjs"
FIXTURE_LOCK="tests/fixtures/absorb/lock-fixture.json"
REAL_LOCK=".claude/scripts/develop/capability-lock.json"
REAL_REGISTRY="products/absorb/registry.json"

_ref() { cd "$ARC_ROOT" && node "$REF" "$1" "$2"; }

# A registry holding one row, whose lock_ref is supplied by the caller.
_write_registry() { # $1 = target, $2 = the lock_ref JSON value
  cat > "$1" <<REG
{
  "\$comment": "test registry",
  "techniques": [
    { "id": "T-01", "name": "t", "status": "candidate", "lane": "absorb", "lock_ref": $2 }
  ]
}
REG
}

setup() {
  REG="$BATS_TEST_TMPDIR/registry.json"
}

# ---------- the committed registry, as shipped ----------

@test "the committed registry carries its schema in a comment key" {
  cd "$ARC_ROOT"
  run grep -c '"\$comment"' "$REAL_REGISTRY"
  [ "$status" -eq 0 ] || { echo "registry has no \$comment schema key"; false; }
}

# ADR-0606 seeded the registry EMPTY, and Phase 04's real study wrote its first row -- so "zero rows"
# was true at Phase 00 and is now false by design. The assertion moved from a COUNT to the INVARIANT
# the count was standing in for: every committed row resolves clean, and nothing is `adopted` without
# an owner decision (REQ-07). A count would have to be edited on every future study; the invariant
# holds forever.
@test "every committed registry row resolves clean and none is adopted without a decision" {
  run _ref "$REAL_REGISTRY" "$REAL_LOCK"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"0 warnings"* ]] || { echo "$output"; false; }
  # the loop RAN: a row count of zero would make "0 warnings" vacuous, which is what the old
  # zero-rows assertion had quietly become once a real row existed.
  [[ "$output" == *"row checked"* || "$output" == *"rows checked"* ]] || { echo "$output"; false; }
  cd "$ARC_ROOT"
  run node -e 'const r=JSON.parse(require("fs").readFileSync("products/absorb/registry.json","utf8"));const bad=r.techniques.filter(t=>(t.status==="adopted"||t.status==="retired")&&!(t.decision_refs&&(t.decision_refs.adopt||t.decision_refs.retire)));process.stdout.write(bad.length?("UNDECIDED: "+bad.map(t=>t.id).join(",")):"ok")'
  [[ "$output" == "ok" ]] || { echo "$output"; false; }
}

# Structural validity is asserted THROUGH the real implementation rather than a second JSON reader:
# registry-ref exits 2 on unparseable JSON and on a missing techniques array (both proven below), so
# a clean exit 0 here IS the structural assertion. Two readers of one contract drift.
@test "the committed registry resolves clean against the real lock" {
  run _ref "$REAL_REGISTRY" "$REAL_LOCK"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"0 warnings"* ]] || { echo "$output"; false; }
}

# The committed registry ships zero rows by design, so every assertion about it is an assertion over
# ZERO loop iterations -- it would keep passing if the resolver were deleted. This test puts a real
# row against the REAL lock so the resolution path is actually exercised against the file absorb
# depends on, not only against the fixture.
@test "a row referencing the real lock entry resolves clean against the real lock" {
  _write_registry "$REG" '{ "name": "madge", "version": "8.0.0" }'
  run _ref "$REG" "$REAL_LOCK"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"0 warnings"* ]] || { echo "$output"; false; }
  [[ "$output" == *"1 row checked"* ]] || { echo "the row was not checked: $output"; false; }
}

@test "a row referencing a name absent from the REAL lock is reported" {
  _write_registry "$REG" '{ "name": "not-in-the-real-lock", "version": "1.0.0" }'
  run _ref "$REG" "$REAL_LOCK"
  [ "$status" -eq 0 ]
  [[ "$output" == *"not-in-the-real-lock@1.0.0"* ]] || { echo "$output"; false; }
}

# ---------- resolution against the fixture lock ----------

@test "a lock_ref naming a fixture row resolves clean" {
  _write_registry "$REG" '{ "name": "fixture-tool", "version": "1.0.0" }'
  run _ref "$REG" "$FIXTURE_LOCK"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"0 warnings"* ]] || { echo "$output"; false; }
}

# The non-vacuous sibling: the warning must NAME the unresolvable reference, because a check that
# skipped the lookup could not name it.
@test "a lock_ref absent from the lock is reported and names the reference" {
  _write_registry "$REG" '{ "name": "not-in-lock", "version": "9.9.9" }'
  run _ref "$REG" "$FIXTURE_LOCK"
  [ "$status" -eq 0 ]
  [[ "$output" == *"not-in-lock@9.9.9"* ]] || { echo "$output"; false; }
  [[ "$output" == *"T-01"* ]] || { echo "$output"; false; }
}

# A right name at a wrong version is the mistake a name-only check would wave through, so it gets
# its own case rather than being assumed covered by the one above.
@test "a lock_ref with the right name at a wrong version is reported" {
  _write_registry "$REG" '{ "name": "fixture-tool", "version": "2.0.0" }'
  run _ref "$REG" "$FIXTURE_LOCK"
  [ "$status" -eq 0 ]
  [[ "$output" == *"fixture-tool@2.0.0"* ]] || { echo "$output"; false; }
}

# Only the fixture lock can exercise this: the real lock has one row and cannot be made ambiguous.
@test "a lock_ref resolving to two lock rows is reported as ambiguous" {
  _write_registry "$REG" '{ "name": "twin-tool", "version": "1.0.0" }'
  run _ref "$REG" "$FIXTURE_LOCK"
  [ "$status" -eq 0 ]
  [[ "$output" == *"2 rows"* ]] || { echo "$output"; false; }
}

@test "a null lock_ref is legal because a technique need not be executable" {
  _write_registry "$REG" 'null'
  run _ref "$REG" "$FIXTURE_LOCK"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"0 warnings"* ]] || { echo "$output"; false; }
}

@test "a lock_ref missing its version is reported" {
  _write_registry "$REG" '{ "name": "fixture-tool" }'
  run _ref "$REG" "$FIXTURE_LOCK"
  [ "$status" -eq 0 ]
  [[ "$output" == *"needs both name and version"* ]] || { echo "$output"; false; }
}

# ---------- A5: a row must reference the lock, never copy it ----------

# The nesting bypass the adversarial pass found: every lock-owned fact copied one level deeper,
# inside lock_ref -- the one object the v1 checker never looked into. It passed completely clean.
@test "lock_ref carrying anything beyond name and version is reported as duplication" {
  cat > "$REG" <<'REG'
{
  "$comment": "test registry",
  "techniques": [
    { "id": "T-01", "name": "t", "status": "candidate", "lane": "absorb",
      "lock_ref": { "name": "fixture-tool", "version": "1.0.0",
                    "hash": "sha512-copied", "publisher-auth": "copied", "class": "read-only" } }
  ]
}
REG
  run _ref "$REG" "$FIXTURE_LOCK"
  [ "$status" -eq 0 ]
  [[ "$output" == *"lock_ref carries \"hash\""* ]] || { echo "$output"; false; }
  [[ "$output" == *"lock_ref carries \"publisher-auth\""* ]] || { echo "$output"; false; }
  [[ "$output" == *"lock_ref carries \"class\""* ]] || { echo "$output"; false; }
}

# A denylist of exact lowercase spellings is a denylist of the spellings its author thought of.
@test "case variants and synonyms of lock-owned fields are reported" {
  cat > "$REG" <<'REG'
{
  "$comment": "test registry",
  "techniques": [
    { "id": "T-01", "name": "t", "status": "candidate", "lane": "absorb", "lock_ref": null,
      "Hash": "x", "sha256": "y", "integrity": "z", "registry": "npm", "checked": "2026-08-09" }
  ]
}
REG
  run _ref "$REG" "$FIXTURE_LOCK"
  [ "$status" -eq 0 ]
  for k in Hash sha256 integrity registry checked; do
    [[ "$output" == *"carries \"$k\""* ]] || { echo "did not report $k"; echo "$output"; false; }
  done
}

# A techniques array of the wrong element type was counted as "checked" and never judged, and
# reported as a clean verdict -- the silent pass this tool's own header says it prevents.
@test "non-object rows are reported rather than counted as checked" {
  printf '{ "techniques": ["T-01", 42, null, false, [{"hash":"copied"}]] }\n' > "$REG"
  run _ref "$REG" "$FIXTURE_LOCK"
  [ "$status" -eq 0 ]
  [[ "$output" == *"[shape]"* ]] || { echo "$output"; false; }
  [[ "$output" == *"not an object"* ]] || { echo "$output"; false; }
  [[ "$output" != *"0 warnings"* ]] || { echo "five bad rows reported as clean"; false; }
}

@test "a registry row carrying its own hash is reported as duplication" {
  cat > "$REG" <<'REG'
{
  "$comment": "test registry",
  "techniques": [
    { "id": "T-01", "name": "t", "status": "candidate", "lane": "absorb",
      "lock_ref": { "name": "fixture-tool", "version": "1.0.0" },
      "hash": "sha512-copied-from-the-lock" }
  ]
}
REG
  run _ref "$REG" "$FIXTURE_LOCK"
  [ "$status" -eq 0 ]
  [[ "$output" == *"[duplication]"* ]] || { echo "$output"; false; }
  [[ "$output" == *"hash"* ]] || { echo "$output"; false; }
}

@test "a registry row copying class or publisher-auth is reported as duplication" {
  cat > "$REG" <<'REG'
{
  "$comment": "test registry",
  "techniques": [
    { "id": "T-01", "name": "t", "status": "candidate", "lane": "absorb", "lock_ref": null,
      "class": "write-capable", "publisher-auth": "copied prose" }
  ]
}
REG
  run _ref "$REG" "$FIXTURE_LOCK"
  [ "$status" -eq 0 ]
  [[ "$output" == *"class"* ]] || { echo "$output"; false; }
  [[ "$output" == *"publisher-auth"* ]] || { echo "$output"; false; }
}

# ---------- the mutant control ----------
# registry-ref is WARN-first: every judged run exits 0, so status distinguishes nothing and a stub
# that prints a clean line satisfies any absence-only assertion. This proves the payload
# assertions above can actually fail.
@test "a registry-ref that returns a fixed clean verdict fails this suite" {
  local mutant="$BATS_TEST_TMPDIR/mutant.mjs"
  cat > "$mutant" <<'MUTANT'
console.log("registry-ref: 0 warnings (1 row checked against 3 lock entries)");
process.exit(0);
MUTANT
  _write_registry "$REG" '{ "name": "not-in-lock", "version": "9.9.9" }'
  run bash -c "cd '$ARC_ROOT' && node '$mutant' '$REG' '$FIXTURE_LOCK'"
  [ "$status" -eq 0 ]
  # POSITIVE first: prove the mutant ran and printed its line, or the absences below are satisfied
  # by a crash and this control proves nothing.
  [[ "$output" == *"0 warnings"* ]] || { echo "the mutant did not run: $output"; false; }
  [[ "$output" != *"not-in-lock@9.9.9"* ]] || { echo "mutant named the reference; the assertion is not discriminating"; false; }
  [[ "$output" != *"[lock-ref]"* ]] || { echo "mutant emitted a lock-ref warning; the assertion is not discriminating"; false; }
}

# ---------- Phase 02: status lifecycle, the cap, and its displacement rule ----------

_write_rows() { cat > "$1"; }   # stdin = a whole registry JSON

@test "a status outside the closed four is reported" {
  _write_rows "$REG" <<'REG'
{ "$comment": "x", "techniques": [ { "id": "T-01", "name": "t", "status": "maybe", "lane": "absorb" } ] }
REG
  run _ref "$REG" "$FIXTURE_LOCK"
  [ "$status" -eq 0 ]
  [[ "$output" == *"[status]"* ]] || { echo "$output"; false; }
  [[ "$output" == *"candidate | trial | adopted | retired"* ]] || { echo "$output"; false; }
}

# REQ-07, both directions. Nothing adopts itself and nothing retires itself.
@test "adopted without a decision ref is reported, and so is retired" {
  _write_rows "$REG" <<'REG'
{ "$comment": "x", "techniques": [
  { "id": "T-01", "name": "a", "status": "adopted", "lane": "absorb", "classification_ref": "r.md", "evidence": ["e"] },
  { "id": "T-02", "name": "b", "status": "retired", "lane": "absorb", "classification_ref": "r.md", "evidence": ["e"] } ] }
REG
  run _ref "$REG" "$FIXTURE_LOCK"
  [ "$status" -eq 0 ]
  [[ "$output" == *"T-01: status adopted with no decision_refs.adopt"* ]] || { echo "$output"; false; }
  [[ "$output" == *"T-02: status retired with no decision_refs.retire"* ]] || { echo "$output"; false; }
}

@test "an adopted row with its decision ref, classification and evidence is clean" {
  _write_rows "$REG" <<'REG'
{ "$comment": "x", "techniques": [
  { "id": "T-01", "name": "a", "status": "adopted", "lane": "absorb",
    "classification_ref": "initiatives/absorb/evidence/phase-04/report.md",
    "evidence": ["initiatives/absorb/evidence/planoff/PLANOFF-A/RESULTS.md"],
    "decision_refs": { "adopt": "01KZJT81XTQMTX90WSZ7SAY3FH" }, "review_by": "2026-11-09" } ] }
REG
  run _ref "$REG" "$FIXTURE_LOCK"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"0 warnings"* ]] || { echo "$output"; false; }
}

@test "adoption without the A/B evidence that must travel with it is reported" {
  _write_rows "$REG" <<'REG'
{ "$comment": "x", "techniques": [
  { "id": "T-01", "name": "a", "status": "adopted", "lane": "absorb", "classification_ref": "r.md",
    "evidence": [], "decision_refs": { "adopt": "01ABC" } } ] }
REG
  run _ref "$REG" "$FIXTURE_LOCK"
  [ "$status" -eq 0 ]
  [[ "$output" == *"[evidence]"* ]] || { echo "$output"; false; }
}

# The cap is countable ONLY because the registry is one file with a lane on every row. A row with no
# lane is uncountable, which would make the anti-hoarding control unenforceable rather than merely
# inaccurate -- so it is reported.
@test "a row with no lane is reported because the cap is counted per lane" {
  _write_rows "$REG" <<'REG'
{ "$comment": "x", "techniques": [ { "id": "T-01", "name": "t", "status": "candidate" } ] }
REG
  run _ref "$REG" "$FIXTURE_LOCK"
  [ "$status" -eq 0 ]
  [[ "$output" == *"no lane"* ]] || { echo "$output"; false; }
}

@test "exceeding the cap of 12 adopted in one lane is reported" {
  cd "$ARC_ROOT"
  node -e '
const rows = [];
for (let i = 1; i <= 13; i++) {
  rows.push({ id: "T-" + String(i).padStart(2, "0"), name: "t" + i, status: "adopted", lane: "absorb",
              classification_ref: "r.md", evidence: ["e"], decision_refs: { adopt: "01ABC" } });
}
require("fs").writeFileSync(process.argv[1], JSON.stringify({ $comment: "x", techniques: rows }));
' "$REG"
  run _ref "$REG" "$FIXTURE_LOCK"
  [ "$status" -eq 0 ]
  [[ "$output" == *"[cap]"* ]] || { echo "$output"; false; }
  [[ "$output" == *"over the cap of 12"* ]] || { echo "$output"; false; }
}

# A displacement that retires nothing does not free a slot -- the cap satisfied on paper only.
@test "a displacement naming a row that is not retired is reported" {
  _write_rows "$REG" <<'REG'
{ "$comment": "x", "techniques": [
  { "id": "T-01", "name": "old", "status": "adopted", "lane": "absorb", "classification_ref": "r.md",
    "evidence": ["e"], "decision_refs": { "adopt": "01A" } },
  { "id": "T-02", "name": "new", "status": "adopted", "lane": "absorb", "classification_ref": "r.md",
    "evidence": ["e"], "decision_refs": { "adopt": "01B" }, "displaces": "T-01" } ] }
REG
  run _ref "$REG" "$FIXTURE_LOCK"
  [ "$status" -eq 0 ]
  [[ "$output" == *"rather than retired"* ]] || { echo "$output"; false; }
}

@test "a displacement naming a row that does not exist is reported" {
  _write_rows "$REG" <<'REG'
{ "$comment": "x", "techniques": [
  { "id": "T-02", "name": "new", "status": "candidate", "lane": "absorb", "displaces": "T-99" } ] }
REG
  run _ref "$REG" "$FIXTURE_LOCK"
  [ "$status" -eq 0 ]
  [[ "$output" == *"not a row in this registry"* ]] || { echo "$output"; false; }
}

@test "a duplicate registry id is reported" {
  _write_rows "$REG" <<'REG'
{ "$comment": "x", "techniques": [
  { "id": "T-01", "name": "a", "status": "candidate", "lane": "absorb" },
  { "id": "T-01", "name": "b", "status": "candidate", "lane": "absorb" } ] }
REG
  run _ref "$REG" "$FIXTURE_LOCK"
  [ "$status" -eq 0 ]
  [[ "$output" == *"duplicate id"* ]] || { echo "$output"; false; }
}

# ---------- usage errors are not verdicts ----------

@test "a missing registry file exits 2 rather than reporting zero warnings" {
  run _ref "$BATS_TEST_TMPDIR/nope.json" "$FIXTURE_LOCK"
  [ "$status" -eq 2 ]
  [[ "$output" == *"cannot read"* ]] || { echo "$output"; false; }
}

@test "a registry with no techniques array exits 2 rather than passing silently" {
  printf '{ "techniques": "not-an-array" }\n' > "$REG"
  run _ref "$REG" "$FIXTURE_LOCK"
  [ "$status" -eq 2 ]
  [[ "$output" == *"techniques"* ]] || { echo "$output"; false; }
}

@test "unparseable JSON exits 2 and says so" {
  printf '{ not json\n' > "$REG"
  run _ref "$REG" "$FIXTURE_LOCK"
  [ "$status" -eq 2 ]
  [[ "$output" == *"not valid JSON"* ]] || { echo "$output"; false; }
}

@test "no arguments exits 2 with usage" {
  run bash -c "cd '$ARC_ROOT' && node '$REF'"
  [ "$status" -eq 2 ]
  [[ "$output" == *"usage"* ]] || { echo "$output"; false; }
}

@test "absorb-registry-ref suite registers every test it defines" {
  registered=${#BATS_TEST_NAMES[@]}
  [ "$registered" -eq 31 ] || { echo "registered $registered tests, expected 31"; false; }
}
