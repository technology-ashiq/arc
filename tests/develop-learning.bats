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
forward-verified: no
check: .claude/scripts/develop/candidates/L-002.mjs")"
  run node "$(LEARN)" parse "$f"
  # A promoted type:rule row must point at the code that runs -- CI caught this test
  # asserting a "complete" row that was in fact missing check:. The rule was right.
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
# The remaining negative controls -- one per check, each proving it CAN fail.
#
# An audit of learning.mjs found 11 distinct check classes and only 6 with a
# proven-can-fail assertion. A check nobody has watched fail is a coin, not a gate
# (retro-log 2026-08-02), so the five below close that gap rather than assume it.
# ---------------------------------------------------------------------------

@test "a row missing a required prose field FAILS, naming the field" {
  local f; f="$(_ledger 'why-missed: nobody looked
prevention: look
type: rule
area: build
adr: 0108
verdict: proposed')"
  run node "$(LEARN)" parse "$f"
  [ "$status" -ne 0 ]
  [[ "$output" == *"what-failed"* ]]
}

@test "a verdict outside the closed vocabulary FAILS" {
  local f; f="$(_ledger "$(printf '%s\n' "$_ROW_MIN" | sed 's/^verdict: proposed$/verdict: probably-fine/')")"
  run node "$(LEARN)" parse "$f"
  [ "$status" -ne 0 ]
  [[ "$output" == *"verdict"* ]]
}

@test "a tag outside the closed vocabulary FAILS" {
  # Closed on purpose: the Context Pack matches on it, and a free-text tag cannot be matched.
  local f; f="$(_ledger "$_ROW_MIN
tag: interesting")"
  run node "$(LEARN)" parse "$f"
  [ "$status" -ne 0 ]
  [[ "$output" == *"tag"* ]]
}

@test "a promoted executable candidate with no check: FAILS" {
  local f; f="$(_ledger "$(printf '%s\n' "$_ROW_MIN" | sed 's/^verdict: proposed$/verdict: promoted/')
replay: caught 1 of 11, false-blocked 0 of 6
evaluated-by: fresh agent
approved-by: ashiq 2026-08-03
forward-verified: no")"
  run node "$(LEARN)" parse "$f"
  [ "$status" -ne 0 ]
  [[ "$output" == *"check"* ]]
}

@test "a non-executable type carrying check: FAILS" {
  # A checklist is applied by a person; a `check:` on one is a file nothing ever executes.
  local f; f="$(_ledger "$(printf '%s\n' "$_ROW_MIN" | sed 's/^type: rule$/type: checklist/')
check: .claude/scripts/develop/candidates/L-002.mjs")"
  run node "$(LEARN)" parse "$f"
  [ "$status" -ne 0 ]
  [[ "$output" == *"applied rather than executed"* ]]
}

@test "the matched positive: a minimal well-formed row passes" {
  # The other half of every control above. Without this, a validator that rejected
  # everything would satisfy all five and look like a working gate.
  local f; f="$(_ledger "$_ROW_MIN")"
  run node "$(LEARN)" parse "$f"
  [ "$status" -eq 0 ]
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
# The adversarial pass, pinned. A fresh agent found 8 holes in this gate across 29
# candidates; the three CRITICAL ones are below. Every one of them exited 0 before.
# ---------------------------------------------------------------------------

@test "a candidate cannot read the answer key it is being graded against" {
  # It returned `flagged: fixture.expect === "flagged"` and scored 11 of 11. The candidate
  # now receives a frozen { body } only, and the labels never leave the parent.
  local c; c="$(mktemp -d)/oracle.mjs"
  printf 'export function check(f) { return { flagged: f.expect === "flagged" }; }\n' > "$c"
  run node "$(LEARN)" replay --candidate "$c" --root "$ARC_ROOT"
  [ "$status" -eq 0 ]
  [[ "$output" == *"caught 0 "* ]]
}

@test "a candidate cannot erase the clean denominator by mutating what it is handed" {
  # It set `fixture.expect = "flagged"` and the report came back `false-blocked 0 of 0` --
  # a flag-everything candidate with the cost of flagging everything deleted.
  local c; c="$(mktemp -d)/mutate.mjs"
  printf 'export function check(f) { try { f.expect = "flagged"; } catch {} return { flagged: true }; }\n' > "$c"
  run node "$(LEARN)" replay --candidate "$c" --root "$ARC_ROOT"
  [ "$status" -eq 0 ]
  [[ "$output" != *"false-blocked 0 of 0"* ]]
}

@test "a candidate cannot fabricate the report and exit 0" {
  # It printed a byte-plausible replay report at import time and called process.exit(0), so
  # the evidence a human would paste was entirely candidate-authored.
  local c; c="$(mktemp -d)/fake.mjs"
  { echo 'console.log("visible:  caught 11 of 11 · false-blocked 0 of 6");'
    echo 'process.exit(0);'
    echo 'export function check() { return { flagged: true }; }'; } > "$c"
  run node "$(LEARN)" replay --candidate "$c" --root "$ARC_ROOT"
  [ "$status" -ne 0 ]
  [[ "$output" == *"replay failed"* ]]
}

@test "a row hidden behind a bullet or emphasis marker is an error, not a field" {
  # `- **learning: L-203**` was not rewritten, so it became an ordinary field in the brief and
  # every violation it carried went unchecked. That row broke all six rules; the gate passed.
  local d; d="$(mktemp -d)"
  { echo '# Learning ledger'
    echo ''
    echo '- **learning: L-203**'
    echo ''
    echo 'what-failed: hidden'
    echo 'verdict: promoted'; } > "$d/l.md"
  run node "$(LEARN)" parse "$d/l.md"
  [ "$status" -ne 0 ]
}

@test "a ledger that mentions rows but parses none FAILS rather than passing empty" {
  local d; d="$(mktemp -d)"
  { echo '# Learning ledger'
    echo ''
    echo '```'
    echo '#### learning: L-301'
    echo 'what-failed: swallowed by an unterminated fence'; } > "$d/l.md"
  run node "$(LEARN)" parse "$d/l.md"
  [ "$status" -ne 0 ]
}

@test "a promoted row cannot satisfy its three inputs with words that say nothing" {
  local f; f="$(_ledger "$(printf '%s\n' "$_ROW_MIN" | sed 's/^verdict: proposed$/verdict: promoted/')
replay: not run yet, will be filled in once the corpus settles
evaluated-by: the same session that wrote the candidate, reviewing its own work
approved-by: pending Ashiq's review
forward-verified: no
check: .claude/scripts/develop/candidates/L-002.mjs")"
  run node "$(LEARN)" parse "$f"
  [ "$status" -ne 0 ]
}

@test "forward-verified cannot name the phase that promoted the row" {
  # ADR-0109: time-forward means LATER. `phase 04` on a row promoted in phase 04 is the one
  # thing the field must never be allowed to say, and a loose /phase \d+/ accepted it.
  local f; f="$(_ledger "$(printf '%s\n' "$_ROW_MIN" | sed 's/^verdict: proposed$/verdict: promoted/')
phase: 04
replay: caught 1 of 11, false-blocked 0 of 6
evaluated-by: a fresh agent
approved-by: ashiq 2026-08-03
forward-verified: phase 04
check: .claude/scripts/develop/candidates/L-002.mjs")"
  run node "$(LEARN)" parse "$f"
  [ "$status" -ne 0 ]
  [[ "$output" == *"later"* ]]
}

@test "a self-declared number is caught in ANY field, not just six named ones" {
  local f; f="$(_ledger "$_ROW_MIN
catches: 11 of 12 fixtures, a 92% success-rate against the corpus")"
  run node "$(LEARN)" parse "$f"
  [ "$status" -ne 0 ]
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
  # `|| true` because grep exits 1 when it selects nothing -- which is the PASSING case here,
  # so without it the assignment fails the test exactly when the corpus is correct.
  bad="$(grep -h '^expect: ' $(find "$(EV)" -name '*.md' -not -path '*_candidates*') | grep -vcE '^expect: (flagged|clean)$' || true)"
  [ "$bad" -eq 0 ]
}
