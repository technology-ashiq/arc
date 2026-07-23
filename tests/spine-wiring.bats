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
# Council is deferred (skipped below, not silently dropped): arc-council.md carries an
# "additive-only — never modify any pre-existing file" non-negotiable and has NO Bash in its
# allowed-tools, so wiring council.verdict changes both its contract and its tool surface.
# It is also excluded from the REQ-01 golden chain (kickoff -> ship). Awaiting an explicit call.
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

@test "council flow is wired to emit its verdict" {
  skip "deferred for an explicit call: arc-council.md is 'additive-only, never modify a pre-existing file' and has no Bash in allowed-tools — wiring council.verdict changes its contract + tool surface"
  grep -qF "$WRITER council.verdict" "$CMDS/arc-council.md"
}
