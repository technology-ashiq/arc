#!/usr/bin/env bats
# Phase 01 -- the hostile corpus DRIVER, and nothing else.
#
# It walks tests/fixtures/absorb/hostile/INDEX, routes each row to study.mjs by its declared
# family, and asserts the recorded outcome. That is the whole design: adding an attack means adding
# a fixture and ONE row in INDEX -- never new test code here. The policy lane's
# tests/fixtures/policy/hostile/INDEX is the precedent this copies.
#
# STUDY INPUT IS HOSTILE INPUT. These fixtures are real attack shapes -- an imperative addressed to
# the reading agent, a fake SYSTEM block claiming to supersede the study boundary, frontmatter
# forging a tool grant (the shape engine's own adversarial pass found), content emitting envelope
# terminators to escape the data region, traversal strings, a NUL byte where text is expected.
#
# QUOTE-INERT IS NOT A WEAKER REFUSE. The hostile text IS returned, because a study that cannot read
# a hostile README cannot study anything. What the boundary guarantees is that it comes back as
# attributed data inside a nonce-sealed envelope the content cannot close, and that nothing in it is
# ever executed. The no-execution half is proven in absorb-study-boundary.bats; this file proves the
# outcome recorded for every row is the outcome that actually happens.
#
# ASCII-only test names -- bats silently DROPS a non-ASCII @test name, so this file asserts its own
# registered count at the bottom.
bats_require_minimum_version 1.5.0
load 'test_helper'

STUDY=".claude/scripts/absorb/study.mjs"
CORPUS="tests/fixtures/absorb/hostile"
INDEX="$CORPUS/INDEX"

# Non-comment, non-blank rows only.
_rows() { grep -vE '^[[:space:]]*(#|$)' "$ARC_ROOT/$INDEX"; }

@test "the corpus INDEX exists and carries rows" {
  [ -f "$ARC_ROOT/$INDEX" ] || { echo "no INDEX at $INDEX"; false; }
  local n
  n="$(_rows | wc -l | tr -d ' ')"
  [ "$n" -ge 6 ] || { echo "INDEX has only $n rows; the spec names six attack families as the floor"; false; }
}

# The driver. One test, every row, and it reports EVERY failure rather than dying on the first --
# a corpus run that stops at row 2 hides rows 3 through 12.
@test "every INDEX row produces exactly the outcome it declares" {
  cd "$ARC_ROOT"
  local failures=0 checked=0
  while IFS=$'\t' read -r subject family expected marker _desc; do
    [ -n "$subject" ] || continue
    checked=$((checked + 1))
    local out status
    set +e
    out="$(node "$STUDY" --read "$subject" --root "$CORPUS" 2>&1)"
    status=$?
    set -e

    case "$expected" in
      QUOTE-INERT)
        # exit 0, and the bytes come back sealed in an envelope carrying a nonce.
        if [ "$status" -ne 0 ]; then
          echo "FAIL $subject: expected QUOTE-INERT (exit 0), got exit $status: $out"; failures=$((failures + 1)); continue
        fi
        if ! printf '%s' "$out" | grep -qE '=== STUDIED CONTENT BEGIN [0-9a-f]{24} ==='; then
          echo "FAIL $subject: QUOTE-INERT but no nonce-sealed envelope"; failures=$((failures + 1)); continue
        fi
        # and the envelope's own terminator is the LAST line, so content that emitted a fake one
        # did not truncate the region.
        if ! printf '%s' "$out" | tail -1 | grep -qE '=== STUDIED CONTENT END [0-9a-f]{24} ==='; then
          echo "FAIL $subject: envelope does not end with its own terminator"; failures=$((failures + 1)); continue
        fi
        # THE MARKER. Without this the whole driver was vacuous: a stub that opened no file and
        # printed only BEGIN and END passed all twelve rows, because shape was all that was
        # checked. The marker is real content from the real fixture, and it must appear INSIDE the
        # region -- so the assertion fails if nothing was read, and fails if the content escaped.
        if [ -z "$marker" ] || [ "$marker" = "-" ]; then
          echo "FAIL $subject: a QUOTE-INERT row needs a marker in column 4"; failures=$((failures + 1)); continue
        fi
        if ! printf '%s' "$out" | grep -qF -- "$marker"; then
          echo "FAIL $subject: the fixture's content never came back (marker '$marker' absent) -- the study read nothing"; failures=$((failures + 1)); continue
        fi
        # and it is inside the region, not before the BEGIN or after the END
        local b_line e_line m_line
        b_line="$(printf '%s\n' "$out" | grep -nE '=== STUDIED CONTENT BEGIN ' | head -1 | cut -d: -f1)"
        e_line="$(printf '%s\n' "$out" | grep -nE '=== STUDIED CONTENT END ' | tail -1 | cut -d: -f1)"
        m_line="$(printf '%s\n' "$out" | grep -nF -- "$marker" | head -1 | cut -d: -f1)"
        if [ -z "$m_line" ] || [ "$m_line" -le "$b_line" ] || [ "$m_line" -ge "$e_line" ]; then
          echo "FAIL $subject: marker is outside the sealed region (begin=$b_line marker=$m_line end=$e_line)"; failures=$((failures + 1)); continue
        fi
        ;;
      QUARANTINE)
        if [ "$status" -ne 3 ] || ! printf '%s' "$out" | grep -q "QUARANTINE"; then
          echo "FAIL $subject: expected QUARANTINE (exit 3), got exit $status: $out"; failures=$((failures + 1)); continue
        fi
        ;;
      REFUSE)
        if [ "$status" -ne 3 ] || ! printf '%s' "$out" | grep -q "REFUSE"; then
          echo "FAIL $subject: expected REFUSE (exit 3), got exit $status: $out"; failures=$((failures + 1)); continue
        fi
        ;;
      *)
        echo "FAIL $subject: unknown expected outcome '$expected' -- the closed set is QUOTE-INERT | QUARANTINE | REFUSE"
        failures=$((failures + 1)); continue
        ;;
    esac
  done < <(_rows)

  # Assert the loop RAN before asserting what it found. A `while read` over an empty stream
  # produces zero failures and looks identical to a clean corpus -- that is the vacuous pass this
  # repo has shipped three times.
  [ "$checked" -ge 6 ] || { echo "the driver only checked $checked row(s); the loop did not run over the corpus"; false; }
  [ "$failures" -eq 0 ] || { echo "$failures row(s) did not produce their declared outcome"; false; }
}

# A fixture that exists but is not indexed is invisible to the driver, and invisible is
# indistinguishable from passing.
@test "every committed fixture file has an INDEX row" {
  cd "$ARC_ROOT"
  local missing=0
  for f in "$CORPUS"/*; do
    local base
    base="$(basename "$f")"
    [ "$base" = "INDEX" ] && continue
    if ! _rows | cut -f1 | grep -qxF "$base"; then
      echo "fixture $base has no INDEX row -- the driver will never route it"
      missing=$((missing + 1))
    fi
  done
  [ "$missing" -eq 0 ]
}

# And the converse: a `read` row naming a file that does not exist would be routed, refused, and
# read as a passing REFUSE if anyone mistyped its expected outcome.
@test "every read-family INDEX row names a file that exists" {
  cd "$ARC_ROOT"
  local missing=0
  while IFS=$'\t' read -r subject family _expected _marker _desc; do
    [ "$family" = "read" ] || continue
    [ -f "$CORPUS/$subject" ] || { echo "read-family row names a missing file: $subject"; missing=$((missing + 1)); }
  done < <(_rows)
  [ "$missing" -eq 0 ]
}

# Every row must carry exactly five tab-separated fields. A row with four looks fine to `read`,
# which just leaves the last variable empty -- so a missing marker would silently become "no marker"
# rather than a visible error.
@test "every INDEX row has exactly five tab-separated fields" {
  cd "$ARC_ROOT"
  run awk -F'\t' '!/^#/ && NF != 5 { print "row has " NF " fields: " $0; bad=1 } END { exit bad?1:0 }' "$INDEX"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

# The two families the INDEX says are constructed at run time must actually be covered somewhere,
# or the corpus reads as complete while two named attacks go untested.
@test "the symlink and oversized families are covered by the boundary suite" {
  cd "$ARC_ROOT"
  grep -q "symlink whose target is outside the study root" tests/absorb-study-boundary.bats \
    || { echo "INDEX defers the symlink family but the boundary suite does not cover it"; false; }
  grep -q "above the 1 MiB text cap" tests/absorb-study-boundary.bats \
    || { echo "INDEX defers the oversized family but the boundary suite does not cover it"; false; }
}

@test "reading any hostile fixture leaves no trace in the corpus directory" {
  cd "$ARC_ROOT"
  local before after reads=0
  # RECURSIVE and content-sensitive. The v1 version used a non-recursive `ls` of names only, so an
  # in-place modification of a fixture, or a write into a subdirectory, both passed. It also piped
  # every read to /dev/null with `|| true`, so a study that failed on every single row -- or a
  # missing node -- passed too. That is running-list defect 4 (absence-only assertion) recurring in
  # a file whose sibling suite had already fixed it.
  before="$(find "$CORPUS" -type f | LC_ALL=C sort | while IFS= read -r f; do printf '%s:%s\n' "${f#"$CORPUS"/}" "$(sha256sum < "$f" | cut -d' ' -f1)"; done)"
  while IFS=$'\t' read -r subject family expected _marker _desc; do
    [ "$family" = "read" ] || continue
    set +e
    node "$STUDY" --read "$subject" --root "$CORPUS" >/dev/null 2>&1
    local st=$?
    set -e
    # assert the read RAN and returned its declared code, rather than swallowing every failure
    case "$expected" in
      QUOTE-INERT) [ "$st" -eq 0 ] || { echo "read of $subject exited $st, expected 0"; false; } ;;
      QUARANTINE)  [ "$st" -eq 3 ] || { echo "read of $subject exited $st, expected 3"; false; } ;;
    esac
    reads=$((reads + 1))
  done < <(_rows)
  [ "$reads" -ge 6 ] || { echo "only $reads read(s) happened; the loop did not run"; false; }
  after="$(find "$CORPUS" -type f | LC_ALL=C sort | while IFS= read -r f; do printf '%s:%s\n' "${f#"$CORPUS"/}" "$(sha256sum < "$f" | cut -d' ' -f1)"; done)"
  [ "$before" = "$after" ] || { echo "the corpus changed during study:"; diff <(printf '%s\n' "$before") <(printf '%s\n' "$after"); false; }
}

@test "absorb-hostile suite registers every test it defines" {
  registered=${#BATS_TEST_NAMES[@]}
  [ "$registered" -eq 8 ] || { echo "registered $registered tests, expected 8"; false; }
}
