#!/usr/bin/env bats
# absorb Cycle 10 Phase 04 -- T-01's rebuild: pre-emit finding verification.
#
# The rebuild is two files on the ADR-0602 allowlist: docs/playbooks/finding-verification.md is the
# technique, and .claude/commands/arc-audit.md is its caller. ADR-0602 Amendment 1 named route 2's
# failure mode as "a playbook nothing references is a guard with no caller" -- this suite is what
# makes that a checked condition rather than an intention, and it fails if either half goes missing.
bats_require_minimum_version 1.5.0
load 'test_helper'

PLAYBOOK="docs/playbooks/finding-verification.md"
CALLER=".claude/commands/arc-audit.md"

@test "t01: both halves of the rebuild exist" {
  [ -f "$ARC_ROOT/$PLAYBOOK" ]
  [ -f "$ARC_ROOT/$CALLER" ]
}

# THE GUARD-WITH-NO-CALLER CHECK. Amendment 1 predicted exactly this failure for route 2, and this
# cycle already shipped one guard with no caller (rebuild-lint, Phase 02) and had to fix it.
@test "t01: the caller references the playbook by path (route 2's named failure mode)" {
  grep -qF "$PLAYBOOK" "$ARC_ROOT/$CALLER"
}

# ...and the reverse direction, because a reference buried in a "see also" list is not a requirement.
# The caller must say the playbook is mandatory, in words a reader cannot read as optional.
@test "t01: the caller states the playbook is a requirement, not a suggestion" {
  grep -qiE "requirement of this command, not a suggestion" "$ARC_ROOT/$CALLER"
}

# The generated-file trap Amendment 1 left as a standing instruction for any future rebuild aimed at
# .claude/commands/**. arc-review.md, arc-kickoff.md and arc-commit.md are compiled from
# processes/*.process.yaml; a rebuild landing in one survives until the next arc-compile and then
# vanishes with the registry still claiming it shipped. This asserts the caller we picked is not one
# of them -- and asserts it by reading the file, not by remembering that we checked.
@test "t01: the caller is NOT a generated file (Amendment 1's standing check)" {
  run grep -qi "GENERATED FILE" "$ARC_ROOT/$CALLER"
  [ "$status" -ne 0 ]
}

# NEGATIVE CONTROL for the test above: prove the check can actually detect a generated caller.
# Without this, "arc-audit.md is not generated" and "the grep pattern never matches anything" are
# the same result, and the trap Amendment 1 warned about would pass this suite unnoticed.
@test "t01: the generated-file check FIRES on a file that is generated (control)" {
  run grep -qi "GENERATED FILE" "$ARC_ROOT/.claude/commands/arc-review.md"
  [ "$status" -eq 0 ]
}

# The three fields are the whole mechanism. A playbook that names the rule but not the record shape
# is unimplementable, and an implementer would invent their own shape -- which is how two surfaces
# end up with two incompatible "verified" formats.
@test "t01: the playbook defines all three finding fields" {
  for field in claim cite quote; do
    grep -qE "\`$field\`" "$ARC_ROOT/$PLAYBOOK"
  done
}

# THE RISK THE EXTRACTION REPORT NAMED. Without a mandatory appendix, this gate converts false
# positives into false negatives the moment a true finding is hard to quote. The extraction report
# wrote that down as T-01's cost; a rebuild that dropped it would be strictly worse than no rebuild,
# and would still pass every other test in this file.
@test "t01: the playbook mandates an appendix rather than deletion" {
  grep -qF "Appendix -- unverified" "$ARC_ROOT/$PLAYBOOK"
  grep -qiE "never deleted" "$ARC_ROOT/$PLAYBOOK"
  # and the caller carries the same routing, or the requirement lives only where nobody executes it
  grep -qF "Appendix -- unverified" "$ARC_ROOT/$CALLER"
}

# The appendix has its own failure mode -- a drawer nobody opens -- so the playbook requires a count
# in the summary. Checking for it stops the appendix from being a place findings go to die quietly.
@test "t01: the playbook requires the appendix count in the summary" {
  grep -qiE "how many entries" "$ARC_ROOT/$PLAYBOOK"
  grep -qiE "how many entries" "$ARC_ROOT/$CALLER"
}

# The anti-workaround clause. The natural next move for anything optimising to look thorough is to
# raise a severity instead of quoting the line, and the output of that is indistinguishable from a
# verified finding. The source practice carried this clause; dropping it in re-expression would keep
# the shape and lose the enforcement.
@test "t01: both halves carry the anti-workaround clause" {
  grep -qiE "defeats (this rule|this)" "$ARC_ROOT/$PLAYBOOK"
  grep -qiE "worse than the finding it protects" "$ARC_ROOT/$PLAYBOOK"
  grep -qiE "worse than the finding it protects" "$ARC_ROOT/$CALLER"
}

# ATTRIBUTION AND LICENSE. The studied source had NO license file, so the only lawful outcome is
# re-expression with nothing copied -- and the playbook has to say so, because a reader who cannot
# tell re-expression from copying has to assume the worse one.
@test "t01: the playbook records provenance and that nothing was copied" {
  grep -qiE "license NOT FOUND" "$ARC_ROOT/$PLAYBOOK"
  grep -qiE "nothing is copied" "$ARC_ROOT/$PLAYBOOK"
  grep -qF "extraction-report.md" "$ARC_ROOT/$PLAYBOOK"
}

# HONESTY ABOUT SCOPE. T-01 removes findings whose motivating line does not exist or does not say
# what was claimed. It does not improve accuracy in general. A playbook that overclaimed would earn
# a surface fewer reviewers, which is the opposite of what the measurement supports.
@test "t01: the playbook refuses the general-accuracy claim" {
  grep -qiE "does not claim.*general accuracy|general accuracy" "$ARC_ROOT/$PLAYBOOK"
  grep -qiE "not a substitute for the adversarial pass" "$ARC_ROOT/$PLAYBOOK"
}

# The playbook must say where it is NOT wired, or a reader assumes /arc-review enforces it too.
# code-reviewer.md is off the ADR-0602 allowlist and the owner ruled DO NOT WIDEN on 2026-08-09.
@test "t01: the playbook states which surface it does NOT yet cover" {
  grep -qF "code-reviewer.md" "$ARC_ROOT/$PLAYBOOK"
  grep -qiE "not on the ADR-0602 allowlist" "$ARC_ROOT/$PLAYBOOK"
}

# The rebuild must survive its own gate. rebuild-lint is the deterministic check that both paths are
# allowlisted; running it here means a later allowlist edit that orphaned this rebuild would fail CI
# rather than be discovered by reading. --license none because the source had no license file.
@test "t01: rebuild-lint passes on both rebuild paths with zero warnings" {
  local paths="$BATS_TEST_TMPDIR/paths.txt"
  printf '%s\n%s\n' "$PLAYBOOK" "$CALLER" > "$paths"
  run node "$ARC_ROOT/.claude/scripts/absorb/rebuild-lint.mjs" \
    --paths "$paths" --allowlist "$ARC_ROOT/products/absorb/allowlist.txt" --license none
  [ "$status" -eq 0 ]
  [[ "$output" == *"0 warnings"* ]]
  # rebuild-lint is WARN-first and exits 0 by design, so "$status -eq 0" proves nothing on its own.
  # Assert it PARSED both paths -- a typo'd path would be silently absent from the count.
  [[ "$output" == *"2 of 2 paths parsed"* ]]
}

# NEGATIVE CONTROL for the gate above: an off-allowlist path must warn. Without this, "0 warnings"
# and "the lint never examines its input" are the same output.
@test "t01: rebuild-lint WARNS on an off-allowlist path (control)" {
  local paths="$BATS_TEST_TMPDIR/bad.txt"
  printf '%s\n' ".claude/agents/code-reviewer.md" > "$paths"
  run node "$ARC_ROOT/.claude/scripts/absorb/rebuild-lint.mjs" \
    --paths "$paths" --allowlist "$ARC_ROOT/products/absorb/allowlist.txt" --license none
  [[ "$output" == *"[allowlist]"* ]]
  [[ "$output" == *"code-reviewer.md"* ]]
}

# The playbook ships to consumer repos or the caller references a file that is not there. Full-mode
# coverage lives in sync.bats; this asserts the --products path, which is what a selective install
# uses and which reads products/review/manifest.json rather than either twin's copy block.
@test "t01: the --products resolver emits the playbook for the review product" {
  run node "$ARC_ROOT/.claude/scripts/core/arc-products.mjs" --products review --root "$ARC_ROOT"
  [ "$status" -eq 0 ]
  [[ "$output" == *"COPY	$PLAYBOOK	$PLAYBOOK"* ]]
}

# The byte-identity gate hash-pins every synced path, so a playbook that ships without a manifest row
# is a red CI leg on three OSes -- but only if the row is actually there. Assert it directly, because
# the golden manifest is regenerated by hand and a forgotten regeneration looks like a passing tree
# right up until CI.
@test "t01: the playbook is pinned in the sync-golden manifest" {
  grep -qF "$PLAYBOOK" "$ARC_ROOT/tests/fixtures/sync-golden/tree-manifest.txt"
}
