#!/usr/bin/env bats
# Cycle 4 portfolio — Phase 01 (REQ-02): the self-hosting move.
#
# This phase physically relocates arc's own tracker into initiatives/portfolio/. The
# risk it carries is A5, which FIRED on 2026-07-31 for a mechanism (locale collation)
# that is NOT the one this phase depends on — `git mv` casing was A5's original
# subject and went untested. So the casing half is pinned here, first, before the
# mover exists.
#
# The failure being guarded is the SILENT one. On a case-folding filesystem
# (Windows, default macOS) `mkdir initiatives/design` succeeds when
# `initiatives/Design` is already on disk — and lands inside `Design`. The mover then
# reports a successful migration into a directory the RESOLVER cannot see, because
# lane membership is decided by exact comparison against readdir and `Design` fails
# the grammar. Tracker gone, lane invisible, exit code 0.
#
# Two rules follow, and every test below exists to hold one of them:
#   1. IDENTICAL ON THREE LEGS. A case-only collision is refused everywhere — never
#      "works on Linux, refuses on Windows". A deterministic refusal is identical by
#      construction; a success would depend on the filesystem underneath.
#   2. ASK GIT, NOT THE PATH STRING. What moved is read out of git's index (paths
#      compared byte-for-byte, blob oids compared before/after). A path-string compare
#      is exactly what a case-folding filesystem defeats.
bats_require_minimum_version 1.5.0
load 'test_helper'

teardown() { _arc_teardown; }

# ---------- A5: the casing half, pinned ----------

@test "migrate: refuses a target lane whose directory exists under a different case (A5)" {
  _arc_migrate_sandbox
  mkdir -p initiatives/Design
  printf 'placeholder\n' > initiatives/Design/NOTES.md
  git add -A && git commit -qm "lane dir with a capital"

  run _arc_migrate --lane design
  [ "$status" -eq 6 ]
  [[ "$output" == *"STOP"* ]]
  # Both byte-strings are named, so the operator can see WHY it folded.
  [[ "$output" == *"Design"* ]]
  [[ "$output" == *"design"* ]]
}

@test "migrate: the case-fold refusal leaves git's record completely untouched" {
  _arc_migrate_sandbox
  mkdir -p initiatives/Design
  printf 'placeholder\n' > initiatives/Design/NOTES.md
  git add -A && git commit -qm "lane dir with a capital"
  before="$(_arc_oid PLAN.md)"

  run _arc_migrate --lane design
  [ "$status" -eq 6 ]
  # Nothing half-moved: the tracker is still at the root, byte-identical blob.
  _arc_in_index "PLAN.md"
  [ "$(_arc_oid PLAN.md)" = "$before" ]
  ! _arc_in_index "initiatives/design/PLAN.md"
  ! _arc_in_index "initiatives/Design/PLAN.md"
  # And the working tree is clean — a refusal that stages something is not a refusal.
  [ -z "$(git -C "$SANDBOX" status --porcelain)" ]
}

@test "migrate: --dry-run refuses the same case-fold (the guard is not real-run-only)" {
  _arc_migrate_sandbox
  mkdir -p initiatives/Design
  printf 'placeholder\n' > initiatives/Design/NOTES.md
  git add -A && git commit -qm "lane dir with a capital"

  run _arc_migrate --lane design --dry-run
  [ "$status" -eq 6 ]
  [[ "$output" == *"STOP"* ]]
}

@test "migrate: a lane colliding only in case with a VALID lane is refused as already-existing" {
  _arc_migrate_sandbox
  _arc_make_lane portfolio LIVE
  git add -A && git commit -qm "existing lane"

  run _arc_migrate --lane portfolio
  [ "$status" -eq 2 ]
  [[ "$output" == *"already"* ]]
}

# ---------- ask git, not the path string ----------

@test "migrate: the new paths are in git's index, byte-exact, carrying the same blob oids" {
  _arc_migrate_sandbox
  oid_plan="$(_arc_oid PLAN.md)"
  oid_p00="$(_arc_oid phases/phase-00-spec.md)"
  oid_p01="$(_arc_oid phases/phase-01-spec.md)"

  run _arc_migrate --lane portfolio
  [ "$status" -eq 0 ]

  _arc_in_index "initiatives/portfolio/PLAN.md"
  _arc_in_index "initiatives/portfolio/PROGRESS.md"
  _arc_in_index "initiatives/portfolio/phases/phase-00-spec.md"
  _arc_in_index "initiatives/portfolio/phases/phase-01-spec.md"
  # Same content moved, not a copy-and-rewrite: git's own oid says so. PROGRESS.md is
  # excluded on purpose — it is moved AND amended with the ADR-0051 machine header in
  # this same commit, so an unchanged oid there would mean the header never landed.
  [ "$(_arc_oid initiatives/portfolio/PLAN.md)" = "$oid_plan" ]
  [ "$(_arc_oid initiatives/portfolio/phases/phase-00-spec.md)" = "$oid_p00" ]
  [ "$(_arc_oid initiatives/portfolio/phases/phase-01-spec.md)" = "$oid_p01" ]
}

@test "migrate: PROGRESS.md is amended, never rewritten — the original body survives" {
  _arc_migrate_sandbox
  run _arc_migrate --lane portfolio
  [ "$status" -eq 0 ]
  grep -q "^# PROGRESS.md fixture"   "$SANDBOX/initiatives/portfolio/PROGRESS.md"
  grep -q "^## Now"                  "$SANDBOX/initiatives/portfolio/PROGRESS.md"
  grep -q "fixture\."                "$SANDBOX/initiatives/portfolio/PROGRESS.md"
}

@test "migrate: refuses to invent machine-header values it was not given" {
  _arc_migrate_sandbox
  run _arc_migrate_raw --lane portfolio
  [ "$status" -eq 2 ]
  [[ "$output" == *"--cycle"* ]]
  [ ! -d "$SANDBOX/initiatives" ]
}

@test "migrate: refuses a status outside the ADR-0051 vocabulary" {
  _arc_migrate_sandbox
  run _arc_migrate --lane portfolio --status ACTIVE
  [ "$status" -eq 2 ]
  [[ "$output" == *"LIVE"* ]]
  [ ! -d "$SANDBOX/initiatives" ]
}

@test "migrate: reports what it moved from git's record, not from its own intentions" {
  _arc_migrate_sandbox
  run _arc_migrate --lane portfolio
  [ "$status" -eq 0 ]
  # The transcript is evidence for the phase, so it must name every path pair.
  [[ "$output" == *"PLAN.md -> initiatives/portfolio/PLAN.md"* ]]
  [[ "$output" == *"PROGRESS.md -> initiatives/portfolio/PROGRESS.md"* ]]
  [[ "$output" == *"phases/phase-00-spec.md -> initiatives/portfolio/phases/phase-00-spec.md"* ]]
  [[ "$output" == *"verified against git index"* ]]
}

@test "migrate: the old tracker paths are gone from the index (only stubs remain)" {
  _arc_migrate_sandbox
  run _arc_migrate --lane portfolio
  [ "$status" -eq 0 ]
  ! _arc_in_index "phases/phase-00-spec.md"
  ! _arc_in_index "phases/phase-01-spec.md"
}

# ---------- dry run ----------

@test "migrate: --dry-run prints the whole plan and changes absolutely nothing" {
  _arc_migrate_sandbox
  before="$(git -C "$SANDBOX" ls-files | LC_ALL=C sort)"

  run _arc_migrate --lane portfolio --dry-run
  [ "$status" -eq 0 ]
  [[ "$output" == *"DRY RUN"* ]]
  [[ "$output" == *"PLAN.md -> initiatives/portfolio/PLAN.md"* ]]
  [[ "$output" == *"phases/phase-01-spec.md -> initiatives/portfolio/phases/phase-01-spec.md"* ]]

  [ "$(git -C "$SANDBOX" ls-files | LC_ALL=C sort)" = "$before" ]
  [ -z "$(git -C "$SANDBOX" status --porcelain)" ]
  [ ! -d "$SANDBOX/initiatives" ]
}

# ---------- preconditions ----------

@test "migrate: refuses a dirty working tree (the move must be one reviewable commit)" {
  _arc_migrate_sandbox
  printf 'uncommitted\n' >> PLAN.md

  run _arc_migrate --lane portfolio
  [ "$status" -eq 2 ]
  [[ "$output" == *"uncommitted"* ]]
  [ ! -d "$SANDBOX/initiatives" ]
}

@test "migrate: refuses an invalid lane name using the resolver's own grammar" {
  _arc_migrate_sandbox
  run _arc_migrate --lane Portfolio
  [ "$status" -eq 5 ]
  [[ "$output" == *"invalid lane name"* ]]
  [ ! -d "$SANDBOX/initiatives" ]
}

@test "migrate: refuses a reserved device name on every OS, not just Windows" {
  _arc_migrate_sandbox
  run _arc_migrate --lane con
  [ "$status" -eq 5 ]
  [ ! -d "$SANDBOX/initiatives" ]
}

@test "migrate: refuses when the root tracker is not there to move" {
  _arc_migrate_sandbox
  git rm -q PLAN.md && git commit -qm "no plan"

  run _arc_migrate --lane portfolio
  [ "$status" -eq 2 ]
  [[ "$output" == *"PLAN.md"* ]]
}

# ---------- holes found by the adversarial pass, each pinned by the input that found it ----------
#
# All three were live in the first green version of the mover. None was found by
# reading it; each was found by building the input that breaks it.

@test "migrate: two --lane flags with different values is an operator error, not last-wins" {
  # Found by: --lane design --lane portfolio. The mover collapsed them to the last one
  # and forwarded only that to the resolver, so the resolver's own duplicate rule
  # (.claude/rules/lanes.md, exit 5) never saw a duplicate — and a whole tracker would
  # have moved into a lane the operator named only by accident.
  _arc_migrate_sandbox
  run _arc_migrate --lane design --lane portfolio --dry-run
  [ "$status" -eq 5 ]
  [[ "$output" == *"more than once"* ]]
  [ ! -d "$SANDBOX/initiatives" ]
}

@test "migrate: the same --lane value twice is not an error (nothing is ambiguous)" {
  _arc_migrate_sandbox
  run _arc_migrate --lane portfolio --lane portfolio --dry-run
  [ "$status" -eq 0 ]
}

@test "migrate: a root outside a git work tree STOPs instead of passing every check" {
  # Found by: --root <plain directory>. `git status --porcelain` wrote its error to
  # stderr and an EMPTY stdout, which reads exactly like a clean tree — so the
  # dirty-tree guard could not fail, and the run got as far as git mv. A check that
  # cannot fail is Phase 00's lesson repeating.
  NOTREPO="$(mktemp -d)"
  mkdir -p "$NOTREPO/phases"
  printf 'plan\n'     > "$NOTREPO/PLAN.md"
  printf 'progress\n' > "$NOTREPO/PROGRESS.md"
  printf 'spec\n'     > "$NOTREPO/phases/phase-00-spec.md"

  run bash "$ARC_ROOT/.claude/scripts/plan/tracker-migrate.sh" --root "$NOTREPO" \
      --lane portfolio --cycle c --phase p --appetite 1d --burn 0d
  [ "$status" -eq 2 ]
  [[ "$output" == *"not inside a git work tree"* ]]
  [ ! -d "$NOTREPO/initiatives" ]
  rm -r "$NOTREPO"
}

@test "migrate: tracker presence is read from git's index, not from a folding filesystem" {
  # Found by: an index that says `Phases/` on a case-folding checkout. `[ -e phases ]`
  # answers TRUE on Windows/macOS and false on Linux for the identical repo — a
  # one-OS surprise in the exact shape A5 named. Deciding from `git ls-files` gives
  # the same answer on all three legs: this tracker is not the one we were asked for.
  _arc_migrate_sandbox
  git mv phases Phases-tmp && git mv Phases-tmp Phases
  git commit -qm "phases dir with a capital"

  run _arc_migrate --lane portfolio
  [ "$status" -eq 2 ]
  [[ "$output" == *"phases/"* ]]
  [[ "$output" == *"index"* ]]
  [ ! -d "$SANDBOX/initiatives" ]
}

# ---------- what must NOT move ----------

@test "migrate: frozen docs/archive and docs/evidence are not touched (ADR-0058)" {
  _arc_migrate_sandbox
  oid_arch="$(_arc_oid docs/archive/old-cycle.md)"
  oid_ev="$(_arc_oid docs/evidence/phase-00/proof.txt)"

  run _arc_migrate --lane portfolio
  [ "$status" -eq 0 ]
  _arc_in_index "docs/archive/old-cycle.md"
  _arc_in_index "docs/evidence/phase-00/proof.txt"
  [ "$(_arc_oid docs/archive/old-cycle.md)" = "$oid_arch" ]
  [ "$(_arc_oid docs/evidence/phase-00/proof.txt)" = "$oid_ev" ]
  ! _arc_in_index "initiatives/portfolio/evidence/phase-00/proof.txt"
}

# ---------- pointer stubs + the resolver's verdict afterwards ----------

@test "migrate: pointer stubs stay at the old root paths and name the new home" {
  _arc_migrate_sandbox
  run _arc_migrate --lane portfolio
  [ "$status" -eq 0 ]
  _arc_in_index "PLAN.md"
  _arc_in_index "PROGRESS.md"
  grep -q "initiatives/portfolio/PLAN.md"     "$SANDBOX/PLAN.md"
  grep -q "initiatives/portfolio/PROGRESS.md" "$SANDBOX/PROGRESS.md"
  # A stub must not read as a tracker: no ## Now section for a hook to scrape.
  ! grep -q "^## Now" "$SANDBOX/PROGRESS.md"
}

@test "migrate: after the move the resolver auto-resolves the new lane" {
  _arc_migrate_sandbox
  run _arc_migrate --lane portfolio
  [ "$status" -eq 0 ]

  run bash "$SANDBOX/.claude/scripts/core/lane-resolve.sh" --root "$SANDBOX" --for resume
  [ "$status" -eq 0 ]
  [ "$(_arc_field mode)" = "lane" ]
  [ "$(_arc_field lane)" = "portfolio" ]
  [ "$(_arc_field via)" = "auto" ]
  [ "$(_arc_field tracker)" = "initiatives/portfolio" ]
}

@test "migrate: the moved PROGRESS.md opens with the ADR-0051 machine header" {
  _arc_migrate_sandbox
  run _arc_migrate --lane portfolio
  [ "$status" -eq 0 ]
  head -n 12 "$SANDBOX/initiatives/portfolio/PROGRESS.md" | grep -q "^status: LIVE"
  head -n 12 "$SANDBOX/initiatives/portfolio/PROGRESS.md" | grep -q "^cycle: "
  head -n 12 "$SANDBOX/initiatives/portfolio/PROGRESS.md" | grep -q "^phase: "
  head -n 12 "$SANDBOX/initiatives/portfolio/PROGRESS.md" | grep -q "^appetite: "
  head -n 12 "$SANDBOX/initiatives/portfolio/PROGRESS.md" | grep -q "^burn: "
  head -n 12 "$SANDBOX/initiatives/portfolio/PROGRESS.md" | grep -q "^blocked-on: "
  head -n 12 "$SANDBOX/initiatives/portfolio/PROGRESS.md" | grep -q "^depends-on: "
}

@test "migrate: refuses to run twice — the second run finds a lane, not a root tracker" {
  _arc_migrate_sandbox
  run _arc_migrate --lane portfolio
  [ "$status" -eq 0 ]
  git -C "$SANDBOX" commit -qm "the move"

  run _arc_migrate --lane portfolio
  [ "$status" -eq 2 ]
  [[ "$output" == *"already"* ]]
}
