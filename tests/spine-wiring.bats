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

# The EVENT.d NN-emit fragments — the AUTOMATIC layer: session lifecycle + tool-use receipts
# dropped through the existing dispatcher (hooks themselves untouched), and REGISTERED in
# products/hq/manifest.json so a selective `--products hq` install carries them (a core-only
# install never sees them). Session lifecycle has no dedicated Appendix-A kind, so these emit
# `note.logged` (phase-01 rabbit-hole: anything outside the 18 is note.logged or waits for an ADR).
_emit_fragments() {
  cat <<'MAP'
.claude/hooks/SessionStart.d/90-emit.sh
.claude/hooks/SessionEnd.d/90-emit.sh
.claude/hooks/PostToolUse.d/90-emit.sh
MAP
}

@test "the EVENT.d emit fragments exist, emit, and are registered in hq's manifest" {
  local fails="" frag manifest="$ARC_ROOT/products/hq/manifest.json"
  while read -r frag; do
    [ -n "$frag" ] || continue
    [ -f "$ARC_ROOT/$frag" ] || { fails="$fails|$frag: fragment missing"; continue; }
    grep -qF "arc-event.sh" "$ARC_ROOT/$frag" || fails="$fails|$frag: does not reference the spine writer (arc-event.sh)"
    grep -qF "emit note.logged" "$ARC_ROOT/$frag" || fails="$fails|$frag: does not emit note.logged (session lifecycle has no dedicated kind)"
    grep -qF "\"$frag\"" "$manifest" || fails="$fails|$frag: not registered in products/hq/manifest.json"
  done < <(_emit_fragments)
  [ -z "$fails" ] || { echo "FRAGMENT WIRING:"; echo "$fails" | tr '|' '\n'; false; }
}

# Redaction is LIVE on the EXACT emission path the wired flows and fragments use -- the flag
# synthesis path (`emit <kind> --payload`), not only the --event-file fixtures Phase 0 pinned.
# A secret in a real emission's payload must never reach the spine, in EITHER mode (ADR-0028:
# fail-safe, stub-only, never fail-open). This is the "redaction live on real emissions" DoD.
@test "redaction is live on the flows'/fragments' emission path (emit <kind> --payload)" {
  local SPINE; SPINE="$BATS_TEST_TMPDIR/redact-spine"; mkdir -p "$SPINE"
  export ARC_SPINE_ROOT="$SPINE" ARC_SPINE_NOW="1784736000000" ARC_SPINE_RAND="00112233445566778899"
  local CANARY="AKIAIOSFODNN7EXAMPLE"
  local EVENT="$ARC_ROOT/.claude/scripts/hq/arc-event.sh"

  # strict mode (CI/ingest): a secret in the synthesized payload is REFUSED, nothing leaks.
  run bash "$EVENT" emit note.logged --payload "{\"note\":\"deploy key $CANARY rotated\"}" --strict
  [ "$status" -eq 2 ] || { echo "strict did not refuse the secret (got $status): $output"; false; }
  run grep -rl "$CANARY" "$SPINE"
  [ "$status" -ne 0 ] || { echo "SECRET LEAKED to disk under the spine root (strict)"; false; }

  # hook mode (a live session): the SAME input never blocks (exit 0) and still never leaks.
  run bash "$EVENT" emit note.logged --payload "{\"note\":\"deploy key $CANARY rotated\"}"
  [ "$status" -eq 0 ] || { echo "hook mode blocked a session on a secret (got $status)"; false; }
  run grep -rl "$CANARY" "$SPINE"
  [ "$status" -ne 0 ] || { echo "SECRET LEAKED to disk under the spine root (hook mode)"; false; }
}
