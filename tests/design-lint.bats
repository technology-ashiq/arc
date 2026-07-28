#!/usr/bin/env bats
# Cycle 3 Phase 01 -- design-lint v0: the deterministic half of the design contract.
#
# The lint is pure (reads files, computes, exits) so no git sandbox is needed; fixtures are
# committed under tests/fixtures/design-lint/ and every assertion runs against them directly.
# The complete fixture and each broken fixture are BOTH pinned, because a lint proven only on
# the happy path is a suggestion (council v2+v3: 43 holes in code that passed its own tests).
#
# ADR-0048 context: the critic is forbidden from producing numbers, so this lint is the ONLY
# authority for contrast and for the declared floors. It computes contrast from the pairs the
# brief declares and parses the floors from the brief -- never a hardcoded constant. Pixel
# measurement of rendered targets needs a browser and belongs to Phase 2's task-flow
# verification, which must consume `--floors` from here instead of inventing its own numbers.
bats_require_minimum_version 1.5.0
load 'test_helper'

LINT="$ARC_ROOT/.claude/scripts/design/design-lint.mjs"
FIX="$ARC_ROOT/tests/fixtures/design-lint"
TEMPLATE="$ARC_ROOT/docs/templates/design-brief-template.md"

_lint() { run node "$LINT" "$@"; }

# ---------- 1. the red pair from the spec ----------

@test "complete fixture brief lints green (exit 0)" {
  _lint "$FIX/complete/brief.md"
  [ "$status" -eq 0 ]
  [[ "$output" == *"design-lint: all checks passed"* ]]
}

@test "missing content contract fails, naming the missing section" {
  _lint "$FIX/missing-content/brief.md"
  [ "$status" -eq 1 ]
  [[ "$output" == *"Content contract"* ]]
}

# ---------- 2. every other section is load-bearing too ----------

@test "missing interaction model fails, naming the section" {
  _lint "$FIX/missing-interaction/brief.md"
  [ "$status" -eq 1 ]
  [[ "$output" == *"Interaction model"* ]]
}

@test "missing art direction fails, naming the section" {
  _lint "$FIX/missing-art/brief.md"
  [ "$status" -eq 1 ]
  [[ "$output" == *"Art direction"* ]]
}

@test "missing platform contract fails, naming the section" {
  _lint "$FIX/missing-platform/brief.md"
  [ "$status" -eq 1 ]
  [[ "$output" == *"Platform contract"* ]]
}

# ---------- 3. the drift gate: answer count vs the template's LIVE question count ----------

@test "a brief with fewer answers than the template has questions fails" {
  _lint "$FIX/drift-answers/brief.md"
  [ "$status" -eq 1 ]
  [[ "$output" == *"answer"* ]]
}

@test "the question count is read live from the template, never hardcoded" {
  # Same complete brief, but linted against a doctored template carrying an 8th question.
  # If the lint hardcodes 7, this passes and the drift gate is fiction.
  _lint --template "$FIX/template-8q.md" "$FIX/complete/brief.md"
  [ "$status" -eq 1 ]
  [[ "$output" == *"answer"* ]]
}

# ---------- 4. lorem ipsum ----------

@test "lorem ipsum inside a brief fails the lint" {
  _lint "$FIX/lorem-brief/brief.md"
  [ "$status" -eq 1 ]
  [[ "$output" == *"lorem"* ]] || [[ "$output" == *"Lorem"* ]]
}

@test "route scan: the planted-defect fixture route is flagged, the real route is clean" {
  # Reuses Phase 00's committed defect fixture, whose 06:02 event is literal lorem ipsum.
  _lint --route "$ARC_ROOT/tests/fixtures/design/arc-hq-mockup-defect.html"
  [ "$status" -eq 1 ]
  _lint --route "$ARC_ROOT/docs/strategy/arc-hq-mockup.html"
  [ "$status" -eq 0 ]
}

# ---------- 5. contrast pairs + the brief-declared floor (ADR-0048) ----------

@test "a declared pair that fails the declared floor fails the lint, naming the pair" {
  _lint "$FIX/contrast-fail/brief.md"
  [ "$status" -eq 1 ]
  [[ "$output" == *"contrast"* ]]
}

@test "the SAME pair passes under a brief that declares a lower floor -- floor is read from the brief" {
  # contrast-fail and floor-custom declare the same fg/bg values; only the declared floor
  # differs. If this fails, the lint is hardcoding a floor and silently overriding the
  # product's contract (the exact thing ADR-0048 forbids).
  _lint "$FIX/floor-custom/brief.md"
  [ "$status" -eq 0 ]
}

@test "--floors exports the declared floors as JSON (the single authority for later measurement)" {
  _lint --floors "$FIX/floor-custom/brief.md"
  [ "$status" -eq 0 ]
  echo "$output" | node -e '
    const j = JSON.parse(require("fs").readFileSync(0, "utf8"));
    if (j.contrast_ratio !== 3 || j.target_px !== 24) {
      console.error(`floors wrong: ${JSON.stringify(j)} (want contrast_ratio 3, target_px 24)`);
      process.exit(1);
    }'
}

@test "--floors on the default-floor brief reports the declared 4.5:1 and 44px" {
  _lint --floors "$FIX/complete/brief.md"
  [ "$status" -eq 0 ]
  echo "$output" | node -e '
    const j = JSON.parse(require("fs").readFileSync(0, "utf8"));
    if (j.contrast_ratio !== 4.5 || j.target_px !== 44) {
      console.error(`floors wrong: ${JSON.stringify(j)}`);
      process.exit(1);
    }'
}

# ---------- 6. header grammar ----------

@test "an impossible calendar date fails (real-calendar validation, not digit-shape)" {
  _lint "$FIX/bad-date/brief.md"
  [ "$status" -eq 1 ]
  [[ "$output" == *"date"* ]]
}

@test "platform contract left as yes/no boilerplate fails -- an unfilled template is not a brief" {
  _lint "$FIX/platform-boilerplate/brief.md"
  [ "$status" -eq 1 ]
}

# ---------- 7. adversarial pass (non-negotiable) -- every constructed attack, pinned ----------
#
# HOLE = broke the first build, fixed, pinned so it cannot return. HELD = attacked, already
# correct. One fixture minimum per retro-log markdown-contract bug class, plus the attacks
# invented for this grammar specifically.

@test "attack HELD: a case-folded heading is not a section (case-fold-before-compare class)" {
  _lint "$FIX/hostile/case-folded-heading.md"
  [ "$status" -eq 1 ]
  [[ "$output" == *"section-missing"* ]]
}

@test "attack HELD: a level-3 heading is not a section (heading-level cosmetic-variant class)" {
  _lint "$FIX/hostile/heading-level-3.md"
  [ "$status" -eq 1 ]
  [[ "$output" == *"section-missing"* ]]
}

@test "attack HELD: a bold line is not a heading (emphasis cosmetic-variant class)" {
  _lint "$FIX/hostile/heading-bold-line.md"
  [ "$status" -eq 1 ]
  [[ "$output" == *"section-missing"* ]]
}

@test "attack HELD: a repeated section is an error, never last-one-wins (repeated-section class)" {
  _lint "$FIX/hostile/repeated-section.md"
  [ "$status" -eq 1 ]
  [[ "$output" == *"section-repeated"* ]]
}

@test "attack HOLE: a section heading quoted in a code fence does not satisfy the contract" {
  # The worst of the found holes: section D deleted, its heading quoted inside a ```md
  # fence -- the first build passed this outright. Structure is now parsed on
  # fence-stripped text.
  _lint "$FIX/hostile/fenced-heading.md"
  [ "$status" -eq 1 ]
  [[ "$output" == *"section-missing"* ]]
}

@test "attack HELD: a CRLF brief passes -- line endings are transport, not content (anchored-\$ class)" {
  # Held by ECMAScript semantics, not by luck we can leave unpinned: \r is a LineTerminator
  # in JS regex, so ^/\$ under /m and `.` all treat it as a boundary. If the matching
  # approach ever changes (a port, a different engine), this pin is what catches it.
  _lint "$FIX/hostile/crlf.md"
  [ "$status" -eq 0 ]
}

@test "attack HOLE: a heading over an empty body is not a section (doctored-brief pattern)" {
  _lint "$FIX/hostile/empty-section.md"
  [ "$status" -eq 1 ]
  [[ "$output" == *"section-empty"* ]]
}

@test "attack HELD: answer inflation fails the drift gate in the other direction" {
  _lint "$FIX/hostile/eight-answers.md"
  [ "$status" -eq 1 ]
  [[ "$output" == *"answer-count"* ]]
}

@test "attack HOLE: twin a11y-floor lines are an error, never first-match-wins" {
  # Planted a 1:1 floor for the machine above the real 4.5:1 line for the reader; the
  # first build enforced the 1:1 and everything passed. Also refused by --floors.
  _lint "$FIX/hostile/double-floor.md"
  [ "$status" -eq 1 ]
  [[ "$output" == *"floor-repeated"* ]]
  _lint --floors "$FIX/hostile/double-floor.md"
  [ "$status" -eq 1 ]
}

@test "attack HOLE: a malformed pair row is named, not silently dropped" {
  # 3-digit hex used to vanish from the table and read as "no pairs declared" -- fail-closed
  # but pointing the author at the wrong fix.
  _lint "$FIX/hostile/short-hex.md"
  [ "$status" -eq 1 ]
  [[ "$output" == *"pair-malformed"* ]]
}

@test "attack HELD: the real-calendar class rejects 2026-02-30 (not just digit shape)" {
  _lint "$FIX/bad-date/brief.md"
  [ "$status" -eq 1 ]
  [[ "$output" == *"date-invalid"* ]]
}

# ---------- 8. discipline ----------

@test "the lint never exits 2 (warn-gate discipline), even on a nonexistent brief" {
  _lint "$FIX/does-not-exist/brief.md"
  [ "$status" -eq 1 ]
  _lint
  [ "$status" -ne 2 ]
}

@test "the real template and the complete fixture agree on question count (fixture not stale)" {
  # If somebody adds question 8 to the template, the complete fixture must fail until it
  # answers it -- this is the drift gate protecting its own fixtures.
  local tq bq
  tq="$(grep -cE '^[0-9]+\.[[:space:]]' <(sed -n '/^## A\. Interaction model/,/^## B\./p' "$TEMPLATE"))"
  bq="$(grep -cE '^[0-9]+\.[[:space:]]' <(sed -n '/^## A\. Interaction model/,/^## B\./p' "$FIX/complete/brief.md"))"
  [ "$tq" -gt 0 ]
  [ "$tq" -eq "$bq" ]
}
