#!/usr/bin/env bats
# Phase 04 -- the Learning System: a record that compounds, and a promotion no machine
# can complete alone.
#
# Red-first: every @test here fails before .claude/scripts/develop/learning.mjs exists.
# The load-bearing red is the promotion PAIR -- "a promoted row missing replay FAILS" and
# "a complete promoted row PASSES" must both be red first, because a validator that rejects
# everything would satisfy the first alone and look like a working gate.
bats_require_minimum_version 1.5.0
load 'test_helper'

LEARN() { echo "$ARC_ROOT/.claude/scripts/develop/learning.mjs"; }
LINT()  { echo "$ARC_ROOT/.claude/scripts/develop/develop-lint.mjs"; }
EV()    { echo "$ARC_ROOT/tests/fixtures/develop-evals"; }

# A throwaway ledger file carrying one row built from key/value lines.
_ledger() {
  local d; d="$(mktemp -d)"
  printf '# Learning ledger — fixture\n\n#### learning: L-001\n\n%s\n' "$1" > "$d/learning-ledger.md"
  echo "$d/learning-ledger.md"
}

_ROW_MIN='what-failed: the parser accepted a doctored artifact
why-missed: every breaking input was written by the parser author
prevention: run the adversarial pass with a fresh agent
type: rule
area: build
adr: 0108
verdict: proposed'

# ---------------------------------------------------------------------------
# The row shape (REQ-01)
# ---------------------------------------------------------------------------

@test "the learning ledger parses into rows" {
  local f; f="$(_ledger "$_ROW_MIN")"
  run node "$(LEARN)" parse "$f"
  [ "$status" -eq 0 ]
  [[ "$output" == *"L-001"* ]]
}

@test "an unparseable row FAILS and names its id and line" {
  local f; f="$(_ledger "$_ROW_MIN")"
  printf 'type: rule\ntype: fixture\n' >> "$f"      # a repeated key inside one row
  run node "$(LEARN)" parse "$f"
  [ "$status" -ne 0 ]
  [[ "$output" == *"L-001"* ]]
  [[ "$output" =~ [0-9] ]]                          # carries a line number
}

@test "a row with zero typed links WARNs but does not fail" {
  local f; f="$(_ledger 'what-failed: something broke
why-missed: nobody looked
prevention: look
type: rule
area: build
verdict: proposed')"
  run node "$(LEARN)" parse "$f"
  [ "$status" -eq 0 ]
  [[ "$output" == *"WARN"* ]]
  # A note is not a link in a chain -- but it is still a legal note.
}

@test "an area outside the closed vocabulary FAILS" {
  local f; f="$(_ledger "$(printf '%s\n' "$_ROW_MIN" | sed 's/^area: build$/area: whatever/')")"
  run node "$(LEARN)" parse "$f"
  [ "$status" -ne 0 ]
  [[ "$output" == *"area"* ]]
}

@test "a type outside the closed vocabulary FAILS" {
  local f; f="$(_ledger "$(printf '%s\n' "$_ROW_MIN" | sed 's/^type: rule$/type: vibes/')")"
  run node "$(LEARN)" parse "$f"
  [ "$status" -ne 0 ]
}

# ---------------------------------------------------------------------------
# The promotion pair (REQ-03) -- both halves red first, deliberately
# ---------------------------------------------------------------------------

@test "a promoted row missing replay FAILS" {
  local f; f="$(_ledger "$(printf '%s\n' "$_ROW_MIN" | sed 's/^verdict: proposed$/verdict: promoted/')
evaluated-by: fresh agent, verdict real
approved-by: ashiq 2026-08-02
forward-verified: no")"
  run node "$(LEARN)" parse "$f"
  [ "$status" -ne 0 ]
  [[ "$output" == *"replay"* ]]
}

@test "a promoted row missing evaluated-by FAILS" {
  local f; f="$(_ledger "$(printf '%s\n' "$_ROW_MIN" | sed 's/^verdict: proposed$/verdict: promoted/')
replay: caught 3 of 8, false-blocked 0 of 4
approved-by: ashiq 2026-08-02
forward-verified: no")"
  run node "$(LEARN)" parse "$f"
  [ "$status" -ne 0 ]
  [[ "$output" == *"evaluated-by"* ]]
}

@test "a promoted row missing approved-by FAILS" {
  local f; f="$(_ledger "$(printf '%s\n' "$_ROW_MIN" | sed 's/^verdict: proposed$/verdict: promoted/')
replay: caught 3 of 8, false-blocked 0 of 4
evaluated-by: fresh agent, verdict real
forward-verified: no")"
  run node "$(LEARN)" parse "$f"
  [ "$status" -ne 0 ]
  [[ "$output" == *"approved-by"* ]]
}

@test "a COMPLETE promoted row passes -- the other half of the control" {
  local f; f="$(_ledger "$(printf '%s\n' "$_ROW_MIN" | sed 's/^verdict: proposed$/verdict: promoted/')
replay: caught 3 of 8, false-blocked 0 of 4
evaluated-by: fresh agent, verdict real
approved-by: ashiq 2026-08-02
forward-verified: no")"
  run node "$(LEARN)" parse "$f"
  [ "$status" -eq 0 ]
}

@test "a promoted row claiming forward-verified yes without a later phase FAILS" {
  # ADR-0109: mechanism 3 pays out in a LATER cycle, so a row cannot claim it on the day
  # it is promoted. Without this the row reads identical to one that survived a real test.
  local f; f="$(_ledger "$(printf '%s\n' "$_ROW_MIN" | sed 's/^verdict: proposed$/verdict: promoted/')
replay: caught 3 of 8, false-blocked 0 of 4
evaluated-by: fresh agent, verdict real
approved-by: ashiq 2026-08-02
forward-verified: yes")"
  run node "$(LEARN)" parse "$f"
  [ "$status" -ne 0 ]
  [[ "$output" == *"forward-verified"* ]]
}

@test "a self-declared number in a learning row FAILS" {
  local f; f="$(_ledger "$(printf '%s\n' "$_ROW_MIN" | sed 's/^prevention: look$/prevention: x/')
cost: 95% confidence this is cheap")"
  run node "$(LEARN)" parse "$f"
  [ "$status" -ne 0 ]
}

# ---------------------------------------------------------------------------
# Replay (REQ-02) -- both numbers computed, never asserted
# ---------------------------------------------------------------------------

@test "replay computes catch-count against expect:flagged fixtures" {
  run node "$(LEARN)" replay --candidate "$ARC_ROOT/tests/fixtures/develop-evals/_candidates/always-flag.mjs" --root "$ARC_ROOT"
  [ "$status" -eq 0 ]
  [[ "$output" == *"caught"* ]]
}

@test "a candidate that flags EVERYTHING scores a full false-block count" {
  # This is why clean/ exists. Without control fixtures such a candidate would score a
  # perfect catch-count and zero false blocks, which is the shape of a gate that cannot fail.
  run node "$(LEARN)" replay --candidate "$ARC_ROOT/tests/fixtures/develop-evals/_candidates/always-flag.mjs" --root "$ARC_ROOT"
  [ "$status" -eq 0 ]
  [[ "$output" != *"false-blocked 0 "* ]]
}

@test "a candidate that flags NOTHING scores zero of both" {
  run node "$(LEARN)" replay --candidate "$ARC_ROOT/tests/fixtures/develop-evals/_candidates/never-flag.mjs" --root "$ARC_ROOT"
  [ "$status" -eq 0 ]
  [[ "$output" == *"caught 0 "* ]]
  [[ "$output" == *"false-blocked 0 "* ]]
}

@test "replay reports the two numbers separately, never a single score" {
  run node "$(LEARN)" replay --candidate "$ARC_ROOT/tests/fixtures/develop-evals/_candidates/never-flag.mjs" --root "$ARC_ROOT"
  [[ "$output" == *"caught"* ]]
  [[ "$output" == *"false-blocked"* ]]
  [[ "$output" != *"score"* ]]
}

# ---------------------------------------------------------------------------
# The holdout (REQ-04, ADR-0109) -- process-enforced, and honest about it
# ---------------------------------------------------------------------------

@test "list --visible omits the withheld set entirely" {
  run node "$(LEARN)" list --visible --root "$ARC_ROOT"
  [ "$status" -eq 0 ]
  [[ "$output" != *"withheld"* ]]
}

@test "no command prints a withheld fixture's id or body" {
  run node "$(LEARN)" replay --candidate "$ARC_ROOT/tests/fixtures/develop-evals/_candidates/never-flag.mjs" --root "$ARC_ROOT"
  # The withheld ids live in withheld/ and are never echoed -- only two totals may appear.
  local id
  for id in $(ls "$(EV)/withheld" | sed 's/\.md$//'); do
    [[ "$output" != *"$id"* ]] || { echo "withheld id $id leaked into replay output"; false; }
  done
}

@test "a candidate row citing a withheld fixture id FAILS" {
  local wid; wid="$(ls "$(EV)/withheld" | head -1 | sed 's/\.md$//')"
  local f; f="$(_ledger "$_ROW_MIN
fixture: tests/fixtures/develop-evals/withheld/${wid}.md")"
  run node "$(LEARN)" parse "$f"
  [ "$status" -ne 0 ]
  [[ "$output" == *"withheld"* ]]
}

@test "the withheld set is committed, spans 2+ categories, and includes a clean control" {
  # Chosen BEFORE any candidate was authored -- a fixture already seen cannot be withheld
  # afterwards with integrity, so the ordering is the whole claim.
  [ "$(ls "$(EV)/withheld"/*.md | wc -l)" -ge 3 ]
  [ "$(grep -h '^category: ' "$(EV)/withheld"/*.md | sort -u | wc -l)" -ge 2 ]
  grep -q '^expect: clean' "$(EV)/withheld"/*.md
}

# ---------------------------------------------------------------------------
# The fixture corpus (REQ-02)
# ---------------------------------------------------------------------------

@test "the corpus holds >=12 fixtures across six categories, >=4 of them clean" {
  [ "$(find "$(EV)" -name '*.md' -not -path '*_candidates*' | wc -l)" -ge 12 ]
  local cats; cats="$(grep -h '^category: ' "$(EV)"/*/*.md | sort -u | wc -l)"
  [ "$cats" -ge 6 ]
  [ "$(grep -l '^expect: clean' "$(EV)"/*/*.md | wc -l)" -ge 4 ]
}

@test "every fixture carries the full header contract" {
  local f
  for f in $(find "$(EV)" -name '*.md' -not -path '*_candidates*'); do
    grep -q '^id: '       "$f" || { echo "$f missing id";       false; }
    grep -q '^category: ' "$f" || { echo "$f missing category"; false; }
    grep -q '^expect: '   "$f" || { echo "$f missing expect";   false; }
  done
}

@test "every fixture's expect: is one of the two legal values" {
  local bad
  bad="$(grep -h '^expect: ' $(find "$(EV)" -name '*.md' -not -path '*_candidates*') | grep -vcE '^expect: (flagged|clean)$')"
  [ "$bad" -eq 0 ]
}
