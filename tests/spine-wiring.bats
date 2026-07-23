#!/usr/bin/env bats
# Phase 01 — REQ-01 wiring: every core factory flow command is wired to leave its receipt.
#
# spine-golden-dryrun.bats proves a session PRODUCES the right sequence via a canned
# stand-in. THIS file proves the REAL flow commands are wired: each
# .claude/commands/arc-<flow>.md carries an explicit emit of its Appendix-A kind through the
# spine's only writer (arc-event.sh, ADR-0031). Presence of the emit line — not Claude
# actually running it (that is the golden dry-run's job). Grep-level, matching the WARN-first
# grep-lint culture this cycle inherits.
#
# Council is wired too, but deep runs ONLY (a quick run writes nothing). It stays OUT of the
# REQ-01 golden chain (kickoff -> ship) yet must still leave its verdict receipt. Its
# "additive-only, never modify a pre-existing file" non-negotiable now reads an append to the
# append-only spine as additive (clarified in arc-council.md), and a scoped arc-event Bash
# permission was added to its allowed-tools.
#
# RED-first: no command wires arc-event yet, so every core row below is missing — the
# command-level half of assumptions-ledger row 1 (hook fragments alone vs command emission).
bats_require_minimum_version 1.5.0
load 'test_helper'

CMDS="$ARC_ROOT/.claude/commands"
WRITER="arc-event.sh emit"

# core flow command file -> the kind it must emit (PLAN Appendix A; the REQ-01 golden chain).
_core_wiring() {
  cat <<'MAP'
arc-kickoff.md kickoff.done
arc-phase-done.md phase.closed
arc-review.md review.completed
arc-qa.md qa.completed
arc-commit.md commit.done
arc-ship.md ship.done
MAP
}

@test "every core factory flow (kickoff -> ship) is wired to emit its receipt" {
  local fails="" file kind f
  while read -r file kind; do
    [ -n "$file" ] || continue
    f="$CMDS/$file"
    [ -f "$f" ] || { fails="$fails|$file: command file missing"; continue; }
    grep -qF "$WRITER $kind" "$f" \
      || fails="$fails|$file: no '$WRITER $kind' line — flow not wired to leave its receipt"
  done < <(_core_wiring)
  [ -z "$fails" ] || { echo "UNWIRED FLOWS:"; echo "$fails" | tr '|' '\n'; false; }
}

@test "council flow is wired to emit its verdict (deep runs)" {
  grep -qF "$WRITER council.verdict" "$CMDS/arc-council.md" \
    || { echo "arc-council.md: no '$WRITER council.verdict' line — council not wired to leave its verdict receipt"; false; }
}
