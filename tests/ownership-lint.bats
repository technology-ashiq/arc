#!/usr/bin/env bats
#
# ownership-lint.sh -- Cycle 4 portfolio, Phase 02 / REQ-04, spec section D.
#
# ADR-0057: ownership is DERIVED from the existing `products/*/manifest.json`, never a
# second registry. ADR-0053: the company organs -- ADRs, HISTORY, the retro log, the trial
# ledger and tests/ -- are shared and belong to no lane, so editing one from any lane is
# silent. WARN-first throughout: exit 0 in every case below.
#
# The manifest-derived claim is the one that cannot be checked by reading the output alone:
# a hardcoded map and a derived one look identical from outside. So the fixture that proves
# it ADDS a path to a manifest mid-test and asserts the verdict follows -- and the WARN
# cites the manifest LINE it read, which a literal in the lint's own source could not do.
#
# Every @test name on this page is ASCII-only.

bats_require_minimum_version 1.5.0

load 'test_helper'

setup() {
  _arc_lane_sandbox
  cp "$ARC_CORE_SRC/ownership-lint.sh" "$SANDBOX/.claude/scripts/core/"
  OL="$SANDBOX/.claude/scripts/core/ownership-lint.sh"
  DASH="$_ARC_WARN_DASH"

  # Two lanes, committed clean: portfolio LIVE (so it auto-resolves) and design IDLE.
  # Committing them first matters -- the subject of this lint is an EDIT to a clean tree,
  # not a tree that never had the files.
  _arc_make_lane portfolio LIVE "arc-portfolio"
  _arc_make_lane design    IDLE "arc-design"
  git -C "$SANDBOX" add -A
  git -C "$SANDBOX" commit -qm "seed two lanes"
}

teardown() { _arc_teardown; }

_ol() { _arc_run_lint "$OL" --root "$SANDBOX"; }

# ---------- the cross-lane edit this exists to catch ----------

@test "ownership-cross-lane: lane portfolio editing initiatives/design WARNs" {
  printf '\nedited from the wrong lane\n' >> "$SANDBOX/initiatives/design/PROGRESS.md"
  _ol
  [ "$ARC_LINT_STATUS" -eq 0 ]
  _arc_warn_shape ownership-cross-lane "$ARC_LINT_STATUS" "$ARC_LINT_OUTPUT"
}

@test "ownership-cross-lane: the head location is a bare path and names both lanes" {
  printf '\nedited from the wrong lane\n' >> "$SANDBOX/initiatives/design/PROGRESS.md"
  _ol
  # loc-kind `file`: a bare repo-relative path, no line suffix on the WARN head.
  [[ "$ARC_LINT_OUTPUT" == *"WARN [ownership-cross-lane] initiatives/design/PROGRESS.md "* ]]
  [[ "$ARC_LINT_OUTPUT" == *'lane `portfolio` is selected'* ]]
  [[ "$ARC_LINT_OUTPUT" == *'belongs to lane `design`'* ]]
  [[ "$ARC_LINT_OUTPUT" == *'/arc-change --lane design'* ]]
}

@test "ownership-cross-lane: a NEW file dropped into another lane is caught too" {
  # git diff alone cannot see an untracked file, and a new file in another lane is exactly
  # the cross-lane edit worth catching.
  printf 'notes\n' > "$SANDBOX/initiatives/design/NOTES.md"
  _ol
  [ "$ARC_LINT_STATUS" -eq 0 ]
  _arc_warn_shape ownership-cross-lane "$ARC_LINT_STATUS" "$ARC_LINT_OUTPUT"
  [[ "$ARC_LINT_OUTPUT" == *"initiatives/design/NOTES.md"* ]]
}

@test "ownership-cross-lane: editing the lane's OWN tracker is silent" {
  printf '\nordinary work\n' >> "$SANDBOX/initiatives/portfolio/PROGRESS.md"
  _ol
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ -z "$ARC_LINT_OUTPUT" ]
}

@test "ownership-cross-lane: two offending paths produce two blocks" {
  printf '\nx\n' >> "$SANDBOX/initiatives/design/PROGRESS.md"
  printf 'notes\n' > "$SANDBOX/initiatives/design/NOTES.md"
  _ol
  [ "$ARC_LINT_STATUS" -eq 0 ]
  _arc_warn_shape ownership-cross-lane "$ARC_LINT_STATUS" "$ARC_LINT_OUTPUT" 2
}

@test "ownership-cross-lane: a directory under initiatives that is not a lane is ignored" {
  # lane-resolve.sh decides what a lane is; a name that fails its grammar is not one, and
  # this lint must not invent an owner for it.
  #
  # The invalid name must not COLLIDE BY CASE with a real lane. `initiatives/Design` was the
  # obvious choice and it is wrong on two of three legs: macOS and Windows fold case, so
  # mkdir resolves it to the existing `initiatives/design` and the file lands in a real
  # lane, which the lint then correctly reports. Only case-sensitive Linux made a separate
  # directory. A leading digit fails the grammar without involving the filesystem at all,
  # so this fixture means the same thing on all three legs (assumption A5, again).
  mkdir -p "$SANDBOX/initiatives/2fast"
  printf 'x\n' > "$SANDBOX/initiatives/2fast/NOTES.md"
  _ol
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ -z "$ARC_LINT_OUTPUT" ]
}

# ---------- manifest-derived, not hardcoded (ADR-0057) ----------

@test "ownership-manifest: a file in no manifest is silent" {
  mkdir -p "$SANDBOX/.claude/agents"
  printf 'agent\n' > "$SANDBOX/.claude/agents/design-critic.md"
  _ol
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ -z "$ARC_LINT_OUTPUT" ]
}

@test "ownership-manifest: adding that same path to another lane's manifest makes it WARN" {
  # THE test for the ADR-0057 claim. Same file, same lane, same edit -- the ONLY difference
  # is a line in a manifest. A lint whose map is a literal in its own source cannot change
  # its verdict here, so only this fixture can tell the two apart.
  mkdir -p "$SANDBOX/.claude/agents" "$SANDBOX/products/design"
  printf 'agent\n' > "$SANDBOX/.claude/agents/design-critic.md"
  cat > "$SANDBOX/products/design/manifest.json" <<'EOF'
{
  "name": "design",
  "version": "1.0.0",
  "agents": [
    ".claude/agents/design-critic.md"
  ]
}
EOF
  _ol
  [ "$ARC_LINT_STATUS" -eq 0 ]
  _arc_warn_shape ownership-cross-lane "$ARC_LINT_STATUS" "$ARC_LINT_OUTPUT"
  [[ "$ARC_LINT_OUTPUT" == *"WARN [ownership-cross-lane] .claude/agents/design-critic.md "* ]]
}

@test "ownership-manifest: the WARN cites the manifest LINE it actually read" {
  # The citation is what proves derivation: a hardcoded map has no line to point at, and
  # the line moves when the manifest does.
  mkdir -p "$SANDBOX/.claude/agents" "$SANDBOX/products/design"
  printf 'agent\n' > "$SANDBOX/.claude/agents/design-critic.md"
  cat > "$SANDBOX/products/design/manifest.json" <<'EOF'
{
  "name": "design",
  "version": "1.0.0",
  "scripts": [],
  "agents": [
    ".claude/agents/design-critic.md"
  ]
}
EOF
  _ol
  # `.claude/agents/design-critic.md` is on line 6 of the manifest above.
  [[ "$ARC_LINT_OUTPUT" == *"$_ARC_WARN_ARROW products/design/manifest.json:6"* ]]
}

@test "ownership-manifest: a product that is not a lane never triggers the class" {
  # products/core exists in the real repo and has no lane. Ownership conflicts BETWEEN
  # LANES; without this rule the lint would flag its own PR.
  mkdir -p "$SANDBOX/.claude/scripts/core" "$SANDBOX/products/core"
  printf 'x\n' > "$SANDBOX/.claude/scripts/core/some-tool.sh"
  cat > "$SANDBOX/products/core/manifest.json" <<'EOF'
{
  "name": "core",
  "version": "1.0.0",
  "scripts": [
    ".claude/scripts/core/some-tool.sh"
  ]
}
EOF
  _ol
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ -z "$ARC_LINT_OUTPUT" ]
}

@test "ownership-manifest: a path is matched as a whole quoted entry, not as a substring" {
  mkdir -p "$SANDBOX/.claude/agents" "$SANDBOX/products/design"
  printf 'agent\n' > "$SANDBOX/.claude/agents/critic.md"
  cat > "$SANDBOX/products/design/manifest.json" <<'EOF'
{
  "name": "design",
  "version": "1.0.0",
  "agents": [
    ".claude/agents/design-critic.md"
  ]
}
EOF
  _ol
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ -z "$ARC_LINT_OUTPUT" ]
}

# ---------- the company organs are never flagged (ADR-0053) ----------

@test "organs: docs/adr is shared and never flagged" {
  mkdir -p "$SANDBOX/docs/adr"
  printf '# ADR\n' > "$SANDBOX/docs/adr/0099-something.md"
  _ol
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ -z "$ARC_LINT_OUTPUT" ]
}

@test "organs: docs/HISTORY.md is shared and never flagged" {
  mkdir -p "$SANDBOX/docs"
  printf 'history\n' > "$SANDBOX/docs/HISTORY.md"
  _ol
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ -z "$ARC_LINT_OUTPUT" ]
}

@test "organs: docs/retro-log.md is shared and never flagged" {
  mkdir -p "$SANDBOX/docs"
  printf 'retro\n' > "$SANDBOX/docs/retro-log.md"
  _ol
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ -z "$ARC_LINT_OUTPUT" ]
}

@test "organs: docs/trial-ledger.md is shared and never flagged" {
  mkdir -p "$SANDBOX/docs"
  printf 'ledger\n' > "$SANDBOX/docs/trial-ledger.md"
  _ol
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ -z "$ARC_LINT_OUTPUT" ]
}

@test "organs: tests are shared and never flagged" {
  mkdir -p "$SANDBOX/tests"
  printf 'x\n' > "$SANDBOX/tests/design-something.bats"
  _ol
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ -z "$ARC_LINT_OUTPUT" ]
}

@test "organs: an organ edited alongside a real violation does not mask it" {
  # The organ exemption is per-path, never per-diff: one shared file in the changeset must
  # not buy silence for the cross-lane edit sitting next to it.
  mkdir -p "$SANDBOX/docs/adr"
  printf '# ADR\n' > "$SANDBOX/docs/adr/0099-something.md"
  printf '\nx\n' >> "$SANDBOX/initiatives/design/PROGRESS.md"
  _ol
  [ "$ARC_LINT_STATUS" -eq 0 ]
  _arc_warn_shape ownership-cross-lane "$ARC_LINT_STATUS" "$ARC_LINT_OUTPUT"
}

@test "organs: a docs path that is NOT an organ is not exempted by the docs prefix" {
  # `docs/` also holds owned per-product documentation, so a prefix match over docs/ would
  # mute a real cross-lane edit.
  mkdir -p "$SANDBOX/docs/design" "$SANDBOX/products/design"
  printf 'x\n' > "$SANDBOX/docs/design/notes.md"
  cat > "$SANDBOX/products/design/manifest.json" <<'EOF'
{
  "name": "design",
  "version": "1.0.0",
  "files": [
    "docs/design/notes.md"
  ]
}
EOF
  _ol
  [ "$ARC_LINT_STATUS" -eq 0 ]
  _arc_warn_shape ownership-cross-lane "$ARC_LINT_STATUS" "$ARC_LINT_OUTPUT"
}

# ---------- never guess a lane (ADR-0054) ----------

@test "resolution: root-mode with no initiatives dir is silent" {
  rm -rf "$SANDBOX/initiatives"
  printf 'x\n' > "$SANDBOX/anything.md"
  _ol
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ -z "$ARC_LINT_OUTPUT" ]
  [ -z "$ARC_LINT_STDERR" ]
}

@test "resolution: two eligible lanes are ambiguous, so the lint says nothing" {
  # Ambiguity resolves to ASK, never to a guess. A lint that picks a lane in order to have
  # something to say would report on its own guess.
  sed -i.bak 's/^status: IDLE$/status: LIVE/' "$SANDBOX/initiatives/design/PROGRESS.md"
  rm -f "$SANDBOX/initiatives/design/PROGRESS.md.bak"
  printf '\nx\n' >> "$SANDBOX/initiatives/design/PROGRESS.md"
  _ol
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ -z "$ARC_LINT_OUTPUT" ]
}

@test "resolution: an explicit --lane is honoured over auto-resolution" {
  printf '\nx\n' >> "$SANDBOX/initiatives/portfolio/PROGRESS.md"
  _arc_run_lint "$OL" --root "$SANDBOX" --lane design
  [ "$ARC_LINT_STATUS" -eq 0 ]
  _arc_warn_shape ownership-cross-lane "$ARC_LINT_STATUS" "$ARC_LINT_OUTPUT"
  [[ "$ARC_LINT_OUTPUT" == *"initiatives/portfolio/PROGRESS.md"* ]]
}

@test "resolution: an unknown lane STOPs at the resolver, so the lint stays silent" {
  printf '\nx\n' >> "$SANDBOX/initiatives/design/PROGRESS.md"
  _arc_run_lint "$OL" --root "$SANDBOX" --lane nosuchlane
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ -z "$ARC_LINT_OUTPUT" ]
}

@test "resolution: a clean tree produces nothing at all" {
  _ol
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ -z "$ARC_LINT_OUTPUT" ]
  [ -z "$ARC_LINT_STDERR" ]
}

# ---------- the five findings the Phase 02 adversarial pass left in shipped code ----------
#
# `evidence/phase-02/adversarial-report.md`, verified-by-hand items 1, 5, 6, 7 and 8. Each
# was reproduced against the SHIPPED script before the fix, so each @test below is a red
# that the fix turns green -- not a description of code that already worked. Cycle 4 closed
# with these known and unfixed; they are Cycle 5's first work because a gate that answers
# confidently and wrongly is worse than no gate at all.
#
# Two of the five (5 and 6) are failures `.claude/rules/lanes.md` describes BY NAME as past
# incidents, re-committed in a new script one phase later. That is the reason they are
# pinned here rather than fixed quietly: the rule existed, was written down, and did not
# stop the code.

@test "finding-5: --lane given twice with different values NEVER picks one" {
  # `lanes.md`: "silently picking one of two named lanes is precisely the 'never guess'
  # failure." The resolver answers status=invalid reason=duplicate-lane (exit 5); the lint
  # used to collapse the duplicate in its OWN parser before the resolver ever saw it.
  printf '\nx\n' >> "$SANDBOX/initiatives/design/PROGRESS.md"
  _arc_run_lint "$OL" --root "$SANDBOX" --lane portfolio --lane design
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ -z "$ARC_LINT_OUTPUT" ]
}

@test "finding-5: the verdict does not invert when the two --lane flags swap order" {
  # The sharper half of the same defect: last-wins made the OUTPUT depend on flag order, so
  # the same command reported a violation one way round and silence the other.
  printf '\nx\n' >> "$SANDBOX/initiatives/design/PROGRESS.md"
  _arc_run_lint "$OL" --root "$SANDBOX" --lane design --lane portfolio
  local a_out="$ARC_LINT_OUTPUT"
  _arc_run_lint "$OL" --root "$SANDBOX" --lane portfolio --lane design
  [ "$a_out" = "$ARC_LINT_OUTPUT" ]
  [ -z "$a_out" ]
}

@test "finding-5: --lane repeated with the SAME value is not a duplicate" {
  # The rule is "two lanes named", not "the flag appeared twice". Over-rejecting here would
  # silence the lint for a caller that merely built its argv clumsily.
  printf '\nx\n' >> "$SANDBOX/initiatives/design/PROGRESS.md"
  _arc_run_lint "$OL" --root "$SANDBOX" --lane portfolio --lane portfolio
  [ "$ARC_LINT_STATUS" -eq 0 ]
  _arc_warn_shape ownership-cross-lane "$ARC_LINT_STATUS" "$ARC_LINT_OUTPUT"
}

@test "finding-6: a trailing valueless --lane never auto-resolves into a verdict" {
  # `lanes.md`: "an unquoted empty value silently eats the next flag." A bare trailing
  # `--lane` was DROPPED by the lint's parser, so it fell through to auto-resolution and
  # delivered a confident verdict about a lane the operator never named.
  printf '\nx\n' >> "$SANDBOX/initiatives/design/PROGRESS.md"
  _arc_run_lint "$OL" --root "$SANDBOX" --lane
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ -z "$ARC_LINT_OUTPUT" ]
}

@test "finding-6: an explicitly EMPTY --lane value is silence, not auto-resolution" {
  printf '\nx\n' >> "$SANDBOX/initiatives/design/PROGRESS.md"
  _arc_run_lint "$OL" --root "$SANDBOX" --lane "" --for change
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ -z "$ARC_LINT_OUTPUT" ]
}

@test "finding-6: forwarding --lane never consumes the flag that follows it" {
  # The forwarding fix must not re-create the accident it prevents: a bare `--lane` handed
  # to the resolver as the LAST element would eat the `--for` after it. Forwarded as
  # `--lane=VALUE` there is no adjacency to exploit -- proven positively, because silence
  # cannot prove it: a swallowed flag also ends in silence. Here `--root` comes AFTER
  # `--lane` and the WARN only appears if it survived to be read.
  printf '\nx\n' >> "$SANDBOX/initiatives/design/PROGRESS.md"
  _arc_run_lint "$OL" --lane=portfolio --root "$SANDBOX"
  [ "$ARC_LINT_STATUS" -eq 0 ]
  _arc_warn_shape ownership-cross-lane "$ARC_LINT_STATUS" "$ARC_LINT_OUTPUT"
}

@test "finding-1: a --base that does not resolve says so instead of passing clean" {
  # `git diff --name-only BAD...HEAD` failed into an EMPTY subject set, which the next line
  # read as "nothing changed" and exited 0. A real cross-lane edit went unreported and the
  # caller saw a clean pass. `--base origin/main` on a shallow clone reaches this.
  # Same bug class as Phase 01's `git status` empty-stdout finding, one phase later.
  printf '\nx\n' >> "$SANDBOX/initiatives/design/PROGRESS.md"
  _arc_run_lint "$OL" --root "$SANDBOX" --base no/such/ref
  [ "$ARC_LINT_STATUS" -eq 0 ]           # WARN-first is still a contract
  [ -z "$ARC_LINT_OUTPUT" ]              # and this is NOT a tenth WARN class (registry is pinned at nine)
  [[ "$ARC_LINT_STDERR" == *"did NOT run"* ]]
  [[ "$ARC_LINT_STDERR" == *"no/such/ref"* ]]
}

@test "finding-1: a --base that DOES resolve still reports normally" {
  # The guard must not turn every --base run into a refusal. The base branch is READ rather
  # than spelled `main` or `master`: init.defaultBranch differs across the three CI legs,
  # and a hardcoded name would make this pass or fail on the runner's config, not the code.
  local base_branch
  base_branch="$(git -C "$SANDBOX" rev-parse --abbrev-ref HEAD)"
  git -C "$SANDBOX" checkout -qb probe
  printf '\nx\n' >> "$SANDBOX/initiatives/design/PROGRESS.md"
  git -C "$SANDBOX" add -A
  git -C "$SANDBOX" commit -qm "cross-lane edit"
  _arc_run_lint "$OL" --root "$SANDBOX" --base "$base_branch"
  [ "$ARC_LINT_STATUS" -eq 0 ]
  [ -z "$ARC_LINT_STDERR" ]
  _arc_warn_shape ownership-cross-lane "$ARC_LINT_STATUS" "$ARC_LINT_OUTPUT"
}

@test "finding-7: git mv OUT of another lane is caught, not just an edit in place" {
  # Rename detection is git's default, and `--name-only` then prints ONLY the destination.
  # So a plain `rm` of another lane's file was caught while STEALING it was invisible --
  # and the theft is the stronger violation.
  git -C "$SANDBOX" mv initiatives/design/PROGRESS.md initiatives/portfolio/STOLEN.md
  _ol
  [ "$ARC_LINT_STATUS" -eq 0 ]
  _arc_warn_shape ownership-cross-lane "$ARC_LINT_STATUS" "$ARC_LINT_OUTPUT"
  [[ "$ARC_LINT_OUTPUT" == *"initiatives/design/PROGRESS.md"* ]]   # the SOURCE path
}

@test "finding-8: a non-ASCII filename in another lane is visible" {
  # core.quotePath defaults to true, so git returns `"initiatives/design/na\303\257ve.md"`
  # -- quotes as real characters -- which matches neither `case initiatives/*` nor any
  # manifest entry. Renaming a file to something accented hid it from the lint completely.
  printf 'content\n' > "$SANDBOX/initiatives/design/$(printf 'na\303\257ve.md')"
  _ol
  [ "$ARC_LINT_STATUS" -eq 0 ]
  _arc_warn_shape ownership-cross-lane "$ARC_LINT_STATUS" "$ARC_LINT_OUTPUT"
  [[ "$ARC_LINT_OUTPUT" != *'\303\257'* ]]        # not the escaped form
  [[ "$ARC_LINT_OUTPUT" != *'"initiatives/'* ]]   # and not wrapped in git's quotes
}
