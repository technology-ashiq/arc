#!/usr/bin/env bats
# absorb Cycle 10 Phase 04 -- T-01's rebuild: pre-emit finding verification.
#
# The rebuild is two files on the ADR-0602 allowlist: docs/playbooks/finding-verification.md is the
# technique, .claude/commands/arc-audit.md is its caller. ADR-0602 Amendment 1 named route 2's failure
# mode as "a playbook nothing references is a guard with no caller" -- this suite makes that a checked
# condition rather than an intention.
#
# REWRITTEN after two adversarial passes. The first version was a set of substring greps over prose,
# and both passes broke it the same way: a substring grep is satisfied by the phrase appearing inside a
# fenced EXAMPLE, and by a phrase that means the opposite of what is asserted. Every prose assertion
# here therefore runs against a fence-STRIPPED copy -- the class .claude/scripts/absorb/report-lint.mjs
# already handles in its own parser ("a line inside a fenced code block is CONTENT, never structure")
# and this suite did not. Where a claim is machine-readable, it is DERIVED rather than pinned.
bats_require_minimum_version 1.5.0
load 'test_helper'

PLAYBOOK="docs/playbooks/finding-verification.md"
CALLER=".claude/commands/arc-audit.md"

# TWO derived views, because a prose gate and a structure gate need opposite transforms, and using one
# for both is how the first version of this suite got broken twice.
#
# `_nofence` STRIPS ``` blocks and nothing else. Prose gates must not be satisfiable from inside an
# example -- the playbook deliberately CONTAINS a worked example of the very evasion it forbids, so an
# unstripped grep for that evasion's text would pass on a file that only demonstrated it.
_nofence() { awk '/^```/ { inf = !inf; next } !inf' "$1"; }

# `_prose` additionally JOINS each paragraph onto one line. grep is line-based and these files wrap at
# ~100 columns, so a sentence crossing a wrap is unmatchable -- four assertions failed exactly that way.
# The wrong fix is un-wrapping the prose to suit the test: the prose is for readers, and joining here
# lets an editor re-wrap freely without silently gutting a gate. Paragraphs are never joined to each
# other, or a gate would match across unrelated text.
#
# STRUCTURE gates -- table rows, heading levels -- must use `_nofence`, NOT `_prose`: the join collapses
# a table into one line and `^| \`claim\` |` stops matching. That is the content-versus-structure split
# report-lint.mjs already makes in its own parser.
_prose() {
  _nofence "$1" \
    | awk 'BEGIN{ buf="" }
           /^[[:space:]]*$/ { if (buf != "") { print buf; buf="" } print ""; next }
           { line=$0; sub(/^[[:space:]]+/,"",line)
             buf = (buf == "" ? line : buf " " line) }
           END{ if (buf != "") print buf }'
}

setup() {
  PB="$BATS_TEST_TMPDIR/pb.txt";   CL="$BATS_TEST_TMPDIR/cl.txt"
  PBS="$BATS_TEST_TMPDIR/pbs.txt"                 # structure view: fences gone, wraps intact
  _prose   "$ARC_ROOT/$PLAYBOOK" > "$PB"
  _prose   "$ARC_ROOT/$CALLER"   > "$CL"
  _nofence "$ARC_ROOT/$PLAYBOOK" > "$PBS"
}

@test "t01: both halves of the rebuild exist" {
  [ -f "$ARC_ROOT/$PLAYBOOK" ]
  [ -f "$ARC_ROOT/$CALLER" ]
}

# The fence stripper is itself a mechanism, so prove it works before every test below trusts it.
# Without this, a broken stripper that emitted nothing would make all of them vacuously pass.
@test "t01: the two derived views strip, join, and keep structure intact (control)" {
  local f="$BATS_TEST_TMPDIR/fixture.md"
  printf 'a wrapped\nsentence here\n\n```\nFENCED-DROPPED\n```\n\n| `x` | y |\n\nPROSE-KEPT-2\n' > "$f"

  run _prose "$f"
  [[ "$output" == *"a wrapped sentence here"* ]]   # the JOIN happened
  [[ "$output" == *"PROSE-KEPT-2"* ]]              # prose after a fence survives
  [[ "$output" != *"FENCED-DROPPED"* ]]            # the STRIP happened
  # ...and paragraphs are NOT joined to each other, or a gate would match across unrelated text.
  [[ "$output" != *"sentence here PROSE-KEPT-2"* ]]

  # The STRUCTURE view keeps a table row matchable at line start. This is not decoration: the join
  # collapses a table onto one line, which silently broke the three-fields assertion on the first run.
  run _nofence "$f"
  [[ "$output" != *"FENCED-DROPPED"* ]]
  [[ "$output" != *"a wrapped sentence here"* ]]   # the join did NOT happen in this view
  _nofence "$f" | grep -qE '^\| `x` \|'
}

# THE RULE ITSELF. The first version of this suite asserted the fields, the appendix, the count and the
# provenance -- and never the sentence the whole file exists to state. Both passes found that deleting
# it left every test green.
@test "t01: the playbook states the rule" {
  grep -qF "A finding is UNVERIFIED until you can quote the source line that motivated it" "$PB"
}

# THE CALLER'S LOAD-BEARING CLAUSE, likewise unasserted in the first version: delete it and an
# appendix entry becomes an issue source with CI still green.
@test "t01: the caller forbids an appendix entry from becoming a tracked issue" {
  grep -qF "never becomes a tracked issue" "$CL"
}

# THE GUARD-WITH-NO-CALLER CHECK. Amendment 1 predicted exactly this for route 2, and this cycle
# already shipped one guard with no caller (rebuild-lint, Phase 02) and had to fix it.
@test "t01: the caller references the playbook by path (route 2's named failure mode)" {
  grep -qF "$PLAYBOOK" "$CL"
}

@test "t01: the caller states the playbook is a requirement, not a suggestion" {
  grep -qF "requirement of this command, not a suggestion" "$CL"
}

# ENFORCEMENT REACHES THE EMITTER, OR IT REACHES NOBODY. The findings are written by the
# security-auditor subagent, whose definition is off the ADR-0602 allowlist -- so the caller forwarding
# the requirement into the Task prompt is the only enforcement available, and an adversarial pass found
# the first version had no such instruction at all: the rule bound a party that never sees it.
@test "t01: the caller instructs forwarding the requirement into the subagent Task prompt" {
  grep -qiE "Task prompt MUST carry" "$CL"
  grep -qF "security-auditor" "$CL"
}

# ...and the two DELETIONS in that subagent's own definition are re-routed rather than left to
# contradict the playbook. Both files ship in the same product, so the contradiction would ship too.
@test "t01: the caller re-routes the subagent's drop rules as appendix entries" {
  grep -qiE "are DELETIONS" "$CL"
  grep -qiE "8/10" "$CL"
  grep -qiE "never drops" "$CL"
}

# The generated-file trap Amendment 1 left standing for any rebuild aimed at .claude/commands/**.
@test "t01: the caller is NOT a generated file (Amendment 1's standing check)" {
  run grep -qi "GENERATED FILE" "$ARC_ROOT/$CALLER"
  [ "$status" -eq 1 ]   # 1 = ran and found nothing; 2 would mean the file is missing
}

# NEGATIVE CONTROL for the check above, against a file this test WRITES. The first version grepped
# .claude/commands/arc-review.md -- ambient repo state the test does not create, pinned to another
# file's current wording, in a file the engine regenerates. It tested arc-review's header, not the check.
@test "t01: the generated-file check FIRES on a file that is generated (control)" {
  local gen="$BATS_TEST_TMPDIR/gen.md"
  printf '<!-- GENERATED FILE -- DO NOT EDIT -->\nbody\n' > "$gen"
  run grep -qi "GENERATED FILE" "$gen"
  [ "$status" -eq 0 ]
}

# The three fields are the whole mechanism. Asserted as TABLE ROWS, not as backticked words: the first
# version matched one backticked occurrence, so rewording the record-shape table to bold passed the
# test with the mechanism gone.
@test "t01: the playbook defines all three finding fields as table rows" {
  for field in claim cite quote; do
    grep -qE "^\| \`$field\` \|" "$PBS"   # STRUCTURE view -- _prose collapses the table onto one line
  done
}

# THE RISK THE EXTRACTION REPORT NAMED: without a mandatory appendix this gate converts false positives
# into false negatives the moment a true finding is hard to quote.
@test "t01: the playbook mandates an appendix rather than deletion" {
  grep -qF "Appendix -- unverified" "$PB"
  grep -qiE "never deleted" "$PB"
  grep -qF "Appendix -- unverified" "$CL"
}

# The appendix heading must be TOP-LEVEL and LAST. A compliant emitter that nests it under `## HIGH`
# re-attaches the severity the section exists to withhold, and every text search for the heading walks
# straight past the nesting.
@test "t01: the playbook pins the appendix heading depth and position" {
  grep -qiE 'top-level .{1,2}##.{1,2} section, last in the report' "$PB"
  grep -qiE "never nested" "$PB"
  grep -qiE "never nested inside a severity group" "$CL"
}

# THE LAUNDERING CHANNEL, and the worst finding of either pass: a severity-less appendix entry is not a
# CRITICAL, so an unquotable critical defect satisfies "zero CRITICAL findings remain open", stamps the
# security ledger and greens the ship gate -- the rule strictly worse than no rule on the one path that
# gates shipping. Closed by a provisional severity plus a gate that reads BOTH sections.
@test "t01: the appendix carries a provisional severity and the ledger gate reads both sections" {
  grep -qiE "provisional severity" "$PB"
  grep -qiE "gates and never opens an issue" "$PB"
  grep -qF "zero CRITICAL findings remain open in EITHER section" "$CL"
}

# Absence-shaped defects are most of a security audit. A naive reading routes every missing control to
# the appendix, which would make the whole class unreportable; two readers would also route the same
# finding oppositely. Pinned: absence is quotable by anchor.
@test "t01: the playbook rules that absence is quotable by anchor" {
  grep -qiE "Absence is quotable, by anchor" "$PB"
  grep -qiE "line where the control must appear" "$PB"
  grep -qiE "quotable by anchor" "$CL"
}

# One quote per finding is how a verified-looking finding smuggles an unchecked clause into a tracked
# issue. The playbook demonstrates the evasion inside a fence -- which is exactly why this assertion
# runs on the STRIPPED copy: an unstripped grep would be satisfied by the demonstration alone.
@test "t01: the playbook requires one cite+quote PER ASSERTED CLAUSE" {
  grep -qiE "per asserted clause" "$PB"
  grep -qiE "relationship between two locations needs both quoted" "$PB"
  grep -qiE "per asserted clause" "$CL"
}

# The appendix count must be UNCONDITIONAL. A conditional count is invisible in the one case that
# matters: a reviewer who drops three unquotable findings emits a report indistinguishable from clean.
@test "t01: the appendix count is required even when zero" {
  grep -qF "Appendix -- unverified: 0 entries" "$PB"
  grep -qF "Appendix -- unverified: 0 entries" "$CL"
}

@test "t01: both halves carry the anti-workaround clause" {
  grep -qiE "defeats this" "$PB"
  grep -qiE "worse than the finding it protects" "$PB"
  grep -qiE "worse than the finding it protects" "$CL"
}

@test "t01: the playbook records provenance and that nothing was copied" {
  grep -qiE "license NOT FOUND" "$PB"
  grep -qiE "Nothing is copied" "$PB"
  grep -qF "extraction-report.md" "$PB"
}

# HONESTY ABOUT SCOPE. Asserted as the exact bolded phrase: the first version's regex had
# `|general accuracy` as an alternative, which a pass demonstrated passes on an OVERCLAIMING line
# ("Claims: general accuracy and much more").
@test "t01: the playbook refuses the general-accuracy claim" {
  grep -qF '**Does not claim:** general accuracy' "$PB"
  grep -qiE "not a substitute for the adversarial pass" "$PB"
}

# NOT YET MEASURED. The first version of the playbook told the reader to "read the RESULTS" at a path
# where no RESULTS file exists, while the ledger there records 3 fixtures named and 0 executed -- an
# overclaim inside the document about not overclaiming. This asserts the correction and asserts the
# path it points at, so the citation cannot rot into a coordinate again.
@test "t01: the playbook says NOT YET MEASURED and its cited evidence path exists" {
  grep -qiE "NOT YET MEASURED" "$PB"
  grep -qiE "three fixtures named and zero executed" "$PB"
  [ -f "$ARC_ROOT/initiatives/absorb/evidence/planoff/LEDGER.md" ]
}

# The calibration loop the source paired with the appendix is NOT rebuilt. Keeping the container and
# dropping the feedback, while claiming the container prevents the regression, is the overclaim the
# extraction report's own risk note warned about.
@test "t01: the playbook admits the calibration loop was not rebuilt" {
  grep -qiE "loop is not rebuilt" "$PB"
  grep -qiE "record, not a mechanism" "$PB"
}

# WIRING HONESTY. The first version wrote "today that is /arc-audit and the two-surface adversarial
# pass" -- attesting a caller that does not exist. DERIVED, not pinned: count the real callers.
@test "t01: the playbook claims exactly as many callers as the repo has" {
  local callers
  callers="$(grep -rl --include='*.md' -F "$PLAYBOOK" "$ARC_ROOT/.claude/commands" | wc -l | tr -d ' ')"
  [ "$callers" -eq 1 ]
  grep -qiE "exactly one surface" "$PB"
  grep -qF "$PLAYBOOK" "$ARC_ROOT/$CALLER"
}

# The playbook must say where it is NOT wired, or a reader assumes /arc-review enforces it too.
@test "t01: the playbook states which surface it does NOT yet cover" {
  grep -qF "code-reviewer.md" "$PB"
  grep -qiE "off the ADR-0602 allowlist" "$PB"
}

# DERIVED from the registry, not pinned to a word. The first version's playbook said "trial" while the
# committed row said "candidate" -- a cite with an unresolved quote inside the document whose rule is
# that an unresolved citation is not evidence, and 16 greps missed it.
@test "t01: the playbook's stated registry status matches the registry" {
  local status
  status="$(node -e 'const r=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const rows=r.techniques||r.rows||[];const row=rows.find(x=>x.id==="T-01");process.stdout.write(String(row&&row.status))' "$ARC_ROOT/products/absorb/registry.json")"
  [ -n "$status" ]
  [ "$status" != "undefined" ]
  grep -qF "records T-01 as **\`$status\`**" "$PB"
}

# The rebuild must survive its own gate. --root is explicit: without it rebuild-lint defaults to "."
# and the relative paths resolve against whatever directory bats was launched from.
@test "t01: rebuild-lint passes on both rebuild paths with zero warnings" {
  local paths="$BATS_TEST_TMPDIR/paths.txt"
  printf '%s\n%s\n' "$PLAYBOOK" "$CALLER" > "$paths"
  run node "$ARC_ROOT/.claude/scripts/absorb/rebuild-lint.mjs" \
    --paths "$paths" --allowlist "$ARC_ROOT/products/absorb/allowlist.txt" \
    --root "$ARC_ROOT" --license none
  [ "$status" -eq 0 ]
  [[ "$output" == *"0 warnings"* ]]
  # rebuild-lint is WARN-first and exits 0 by design, so exit 0 proves nothing. Assert it PARSED both
  # paths: a typo'd or unresolvable path is silently absent from this count, and .md files never raise
  # a missing-path warning because only CODE_EXT files do.
  [[ "$output" == *"2 of 2 paths parsed"* ]]
}

@test "t01: rebuild-lint WARNS on an off-allowlist path (control)" {
  local paths="$BATS_TEST_TMPDIR/bad.txt"
  printf '%s\n' ".claude/agents/code-reviewer.md" > "$paths"
  run node "$ARC_ROOT/.claude/scripts/absorb/rebuild-lint.mjs" \
    --paths "$paths" --allowlist "$ARC_ROOT/products/absorb/allowlist.txt" \
    --root "$ARC_ROOT" --license none
  [[ "$output" == *"[allowlist]"* ]]
  [[ "$output" == *"code-reviewer.md"* ]]
}

@test "t01: the --products resolver emits the playbook for the review product" {
  run node "$ARC_ROOT/.claude/scripts/core/arc-products.mjs" --products review --root "$ARC_ROOT"
  [ "$status" -eq 0 ]
  [[ "$output" == *"COPY	$PLAYBOOK	$PLAYBOOK"* ]]
}

@test "t01: the playbook is pinned in the sync-golden manifest with its CURRENT hash" {
  local want got
  want="$(tr -d '\r' < "$ARC_ROOT/$PLAYBOOK" | sha256sum | cut -d' ' -f1)"
  got="$(awk -F'\t' -v p="$PLAYBOOK" '$1==p {print $2}' "$ARC_ROOT/tests/fixtures/sync-golden/tree-manifest.txt")"
  [ -n "$got" ]
  [ "$want" = "$got" ]
}

# Same reason as above: this suite is the proof that route 2 was taken correctly, so it must fail when
# a test silently stops existing rather than when one of them fails.
@test "absorb-rebuild-t01 suite registers every test it defines" {
  registered=${#BATS_TEST_NAMES[@]}
  [ "$registered" -eq 30 ] || { echo "registered $registered tests, expected 30"; false; }
}
