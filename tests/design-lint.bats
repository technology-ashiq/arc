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

# The library gate-mode case has to write into the REAL tracked docs/design/library/, because
# that is the only path gate mode reads. Cleanup lives here, not inline after `run`: an inline
# rm is skipped by any interruption, and a leftover stray file fails the design gate for
# everyone with a file nobody wrote. STRAY is unset for every other test, so this is a no-op.
teardown() { [ -n "${STRAY:-}" ] && rm -f "$STRAY" 2>/dev/null; return 0; }

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

# ---------- 4. the intelligence library (PLAN-design 2.8, Phase 03) ----------
#
# "Untagged observations don't enter" is the whole gate, so the adversarial pass here is not
# optional polish -- it IS the feature. Two real holes came out of it and both are pinned
# below as HOLE cases; the HELD cases are attacks the grammar already turned away, kept so a
# later refactor cannot quietly re-open them.

LIB="$ARC_ROOT/tests/fixtures/design-lint/library"

@test "library: the good fixture entry lints green" {
  _lint --library "$LIB/2026-07-29-good.md"
  [ "$status" -eq 0 ]
  [[ "$output" == *"design-lint: all checks passed"* ]]
}

@test "library: the committed entries all lint green (the real ones, not fixtures)" {
  local n=0
  for f in "$ARC_ROOT"/docs/design/library/*.md; do
    [ -f "$f" ] || continue
    case "$(basename "$f")" in README.md) continue;; esac
    n=$((n + 1))
    _lint --library "$f"
    [ "$status" -eq 0 ] || { echo "$f: $output"; false; }
  done
  # A green loop over zero entries is not evidence of anything.
  [ "$n" -ge 1 ]
}

@test "attack HOLE: sections that exist only inside an HTML comment do not satisfy the contract" {
  # The twin of the brief lint's fenced-heading hole. Tags real and visible, both required
  # headings inside <!-- -->: the reader saw an entry with no principle, the machine saw two
  # satisfied contracts. Fixed by parsing structure on ONE text with fences AND comments
  # stripped -- two structural views is two checkers disagreeing about the document.
  _lint --library "$LIB/hole-heading-in-comment.md"
  [ "$status" -eq 1 ]
  [[ "$output" == *"library-section-missing"* ]]
}

@test "attack HOLE: a stray file in the library dir is linted, not skipped by its name" {
  # Gate mode used to discover only <YYYY-MM-DD>-<slug>.md, so an untagged notes.md sat in the
  # library and passed in silence -- a filename was deciding whether the rule applied at all.
  #
  # This writes into the REAL tracked library dir because gate mode reads that path and nothing
  # else. Cleanup is registered in STRAY before the write and removed by teardown, never inline
  # after `run`: an inline rm is skipped by any interruption or by a future assertion inserted
  # above it, and the leftover would fail the design gate for everyone with a file nobody wrote.
  STRAY="$ARC_ROOT/docs/design/library/zz-bats-stray.md"
  printf '# stray\n\nno tags, no sections, should not survive a gate run\n' > "$STRAY"
  run node "$LINT"
  [ "$status" -eq 1 ]
  [[ "$output" == *"library-filename"* ]]
  [[ "$output" == *"library-tag-missing"* ]]
}

@test "attack HOLE: an UNTERMINATED html comment still hides its contents" {
  # The first fix required a closing --> , so deleting three characters restored the hole it
  # closed. CommonMark runs an unterminated HTML block to end of document.
  _lint --library "$LIB/hole-unterminated-comment.md"
  [ "$status" -eq 1 ]
  [[ "$output" == *"library-section-missing"* ]]
}

@test "attack HOLE: an UNTERMINATED code fence still hides its contents" {
  _lint --library "$LIB/hole-unterminated-fence.md"
  [ "$status" -eq 1 ]
  [[ "$output" == *"library-tag-missing"* ]]
  [[ "$output" == *"library-section-missing"* ]]
}

@test "attack HOLE: the shipped template, copied and given prose, is not an entry" {
  # Defeated by copy-paste rather than by attack: the template ships four tags pre-filled with
  # VALID values, so writing only the prose passed every other check. It is a synced doc, so
  # copy-paste is the consumer's default path.
  _lint --library "$LIB/hole-template-boilerplate.md"
  [ "$status" -eq 1 ]
  [[ "$output" == *"library-tag-boilerplate"* ]]
}

@test "attack HOLE: a closing fence the READER rejects does not close it for the lint either" {
  # Getting the opener grammar right and the closer grammar wrong reopens the quoted-contract
  # hole from the other end. CommonMark forbids an info string on a closing fence.
  _lint --library "$LIB/hole-lax-fence-closer.md"
  [ "$status" -eq 1 ]
  [[ "$output" == *"library-section-missing"* ]]
}

@test "attack HOLE: a closer SHORTER than its opener does not close the block" {
  # ````md closed by ``` -- CommonMark requires same-or-longer, so the block runs to EOF.
  local f="$BATS_TEST_TMPDIR/short-closer.md"
  {
    printf '# t\n\n'
    printf -- '- type: Pattern\n- domain: legal\n- user: lawyer\n- platform: desktop\n'
    printf -- '- problem: a closer shorter than its opener\n- confidence: medium\n'
    printf -- '- outcome: unknown\n- source: fixture built in-test\n\n'
    printf '````md\nquoted example text\n```\n\n'
    printf '## Principle\n\nProse that would clear the floor if this block had actually closed here.\n\n'
    printf '## Do not copy\n\nMore prose that would clear the floor if this block had closed here.\n'
  } > "$f"
  _lint --library "$f"
  [ "$status" -eq 1 ]
  [[ "$output" == *"library-section-missing"* ]]
}

@test "legal fence closers still close: equal length, longer, and tilde" {
  # The mirror of the two cases above. A stripper that never closes anything would pass them
  # and fail this one, so this is what stops the fix from over-correcting.
  local f="$BATS_TEST_TMPDIR/legal-closers.md"
  {
    printf '# t\n\n'
    printf -- '- type: Pattern\n- domain: legal\n- user: lawyer\n- platform: desktop\n'
    printf -- '- problem: legal closers must still close\n- confidence: medium\n'
    printf -- '- outcome: unknown\n- source: fixture built in-test\n\n'
    printf '```md\nquoted\n```\n\n'
    printf '````md\nquoted\n`````\n\n'
    printf '~~~md\nquoted\n~~~\n\n'
    printf '## Principle\n\nProse past the floor, visible because every block above closed properly.\n\n'
    printf '## Do not copy\n\nMore prose past the floor, visible for the same reason as above.\n'
  } > "$f"
  _lint --library "$f"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "the SHIPPED template, filled in correctly, lints green (the consumer's actual path)" {
  # This reads the REAL template rather than a hand-built twin, and that distinction is the
  # whole point of the case. `hole-template-boilerplate.md` reproduced the template's tag block
  # but not its guidance comment -- so the fixture stayed green while the real path returned TEN
  # errors, for tags and headings plainly visible on the page. Cause: the template mentions ```
  # once mid-sentence, and an unanchored strip-to-EOF fence rule blanked everything after it.
  # docs/design/library/README.md tells every author, and every consumer project, to walk this
  # path. A fixture that does not represent the path proves nothing about it.
  local f="$BATS_TEST_TMPDIR/filled.md"
  node -e '
    const fs = require("fs");
    let t = fs.readFileSync(process.argv[1], "utf8");
    const subs = [
      [/<product domain[^>]*>/, "legal case management"],
      [/<user type[^>]*>/, "solo-practitioner lawyer"],
      [/<the interaction problem[^>]*>/, "finding the active case without navigating away"],
      [/<where this was observed[^>]*>/, "arc explore run hq-dashboard-v1"],
      [/<Why it works[\s\S]*?yet and the lint rejects it\.>/, "Real prose explaining why this works, comfortably past the minimum word count."],
      [/<What specifically must NOT[\s\S]*?it is right\.>/, "Real prose saying what must not be lifted, also past the minimum word count."],
    ];
    for (const [re, val] of subs) {
      if (!re.test(t)) { console.error("template shape changed, no match for " + re); process.exit(1); }
      t = t.replace(re, val);
    }
    fs.writeFileSync(process.argv[2], t);
  ' "$ARC_ROOT/docs/templates/design-library-entry-template.md" "$f" || false
  # `|| false` matters: without it a template shape change leaves $f unwritten, the grep guard
  # below passes on a missing file, and the case fails as "library-unreadable" instead of the
  # explicit "template shape changed" the node step prints.
  # The substitutions must have actually happened -- a green lint on an unfilled file would be
  # the boilerplate hole passing itself off as this test.
  ! grep -q "<product domain" "$f"
  _lint --library "$f"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "attack HOLE: reference-style links do not clear the thin-section floor" {
  _lint --library "$LIB/hole-principle-reference-links.md"
  [ "$status" -eq 1 ]
  [[ "$output" == *"library-section-thin"* ]]
}

@test "the thin floor counts WORDS, not tokens -- bare digits are not a principle" {
  # Built literally rather than sed-patched from the green fixture: the first cut replaced only
  # the first of the fixture's two prose lines, left the second standing, and the section was
  # never thin. A test that mutates a fixture must prove it mutated the whole thing.
  local f="$BATS_TEST_TMPDIR/digits.md"
  cat > "$f" <<'ENTRY'
# digits are not a principle

- type: Pattern
- domain: legal case management
- user: solo-practitioner lawyer
- platform: desktop
- problem: a row of numbers standing in for a reason
- confidence: medium
- outcome: unknown
- source: fixture built in-test

## Principle

1 2 3 4 5 6 7 8 9 10 11 12 13 14

## Do not copy

Real prose past the minimum word count, so the only thin section in this entry is the one above.
ENTRY
  _lint --library "$f"
  [ "$status" -eq 1 ]
  [[ "$output" == *"library-section-thin"* ]]
  # and the failure must be the PRINCIPLE, not the do-not-copy section
  [[ "$output" == *"Principle"* ]]
}

@test "false-positive HELD: arithmetic in prose is prose, not markup" {
  # A gate that rejects correct work trains authors to pad, which is the failure the floor
  # exists to prevent. `runway < twelve months` is a sentence, not an HTML tag.
  _lint --library "$LIB/held-prose-with-angle-brackets.md"
  [ "$status" -eq 0 ]
}

@test "attack HOLE: a brief section hidden in an html comment is not a section" {
  # The brief lint carried the identical hole and nobody had looked, because the brief's own
  # adversarial pass had only attacked FENCES. A whole section could be commented out and the
  # lint called the brief complete.
  local f="$BATS_TEST_TMPDIR/commented-section.md"
  node -e '
    const fs = require("fs");
    const t = fs.readFileSync(process.argv[1], "utf8");
    const i = t.indexOf("## D. Content contract");
    if (i < 0) { console.error("fixture shape changed: no section D"); process.exit(1); }
    fs.writeFileSync(process.argv[2], t.slice(0, i) + "<!--\n" + t.slice(i) + "\n-->\n");
  ' "$FIX/complete/brief.md" "$f"
  _lint --template "$TEMPLATE" "$f"
  [ "$status" -eq 1 ]
  # Name the section, not the letter: *"D"* is satisfied by "Desktop" in an unrelated
  # platform-row error, so it would stay green while this case stopped testing anything.
  [[ "$output" == *"Content contract"* ]]
}

@test "attack HELD: a tag block quoted in a code fence is not a tag block" {
  _lint --library "$LIB/held-tags-in-fence.md"
  [ "$status" -eq 1 ]
  [[ "$output" == *"library-tag-missing"* ]]
}

@test "attack HELD: a repeated tag is an error, never last-one-wins" {
  _lint --library "$LIB/held-repeated-tag.md"
  [ "$status" -eq 1 ]
  [[ "$output" == *"library-tag-repeated"* ]]
}

@test "attack HELD: a present key with an empty value is still untagged" {
  _lint --library "$LIB/held-empty-value.md"
  [ "$status" -eq 1 ]
  [[ "$output" == *"library-tag-empty"* ]]
}

@test "attack HELD: a case-folded type is not a type (closed vocabulary)" {
  _lint --library "$LIB/held-case-folded-type.md"
  [ "$status" -eq 1 ]
  [[ "$output" == *"library-type"* ]]
}

@test "attack HELD: a principle that is only a link, an image and a product name is rejected" {
  # PLAN-design 2.8: the PRINCIPLE recorded, never just the screenshot. This is the mechanical
  # half of that rule -- whether a principle is any GOOD stays an agent's call (ADR-0048).
  _lint --library "$LIB/held-principle-is-only-a-link.md"
  [ "$status" -eq 1 ]
  [[ "$output" == *"library-section-thin"* ]]
}

@test "attack HELD: a repeated section is an error, never last-one-wins" {
  _lint --library "$LIB/held-repeated-section.md"
  [ "$status" -eq 1 ]
  [[ "$output" == *"library-section-repeated"* ]]
}

@test "library: an unknown platform surface is rejected (shared vocabulary with the brief)" {
  local f="$BATS_TEST_TMPDIR/bad-platform.md"
  sed 's/^- platform: desktop, keyboard-first$/- platform: smartwatch/' "$LIB/2026-07-29-good.md" > "$f"
  grep -q "smartwatch" "$f"
  _lint --library "$f"
  [ "$status" -eq 1 ]
  [[ "$output" == *"library-platform"* ]]
}

@test "library: the lint never exits 2, whatever it is fed (warn-tier gate)" {
  # Each case asserts the EXPECTED status as well as "not 2". A bare `-ne 2` is satisfied by 0,
  # so a lint that regressed to passing everything would keep this test green.
  _lint --library "$LIB/hole-heading-in-comment.md"; [ "$status" -eq 1 ]; [ "$status" -ne 2 ]
  _lint --library "$ARC_ROOT/does-not-exist.md";     [ "$status" -eq 1 ]; [ "$status" -ne 2 ]
  _lint --library "$ARC_ROOT/docs";                  [ "$status" -eq 1 ]; [ "$status" -ne 2 ]
}
