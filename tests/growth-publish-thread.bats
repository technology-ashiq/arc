#!/usr/bin/env bats
# Phase 00 -- the steel thread through the EMITTER, not through the modules.
#
# This file exists because of one comment in arc-event.mjs. The policy cycle shipped four new
# kinds with validators, payload builders and a full test suite, and NOTHING could write one to
# the spine: the idem derivation branch was missing from the emitter, so every policy receipt was
# rejected and quarantined. It was invisible for a cycle because every test drove the modules
# directly and none drove the emitter. `content.published` gets the same branch and therefore the
# same risk, so it gets a test that shells out to arc-event.sh and then LOOKS on disk.
#
# The second rule this file enforces is the 2026-08-02 retro entry: exit 0 from a fire-and-forget
# writer is not evidence that anything was written. Every assertion below reads the spine
# directory, and checks _quarantine/ as well as events/ -- because the failure being guarded
# against exits 0 and writes to the wrong place.
bats_require_minimum_version 1.5.0
load 'test_helper'

EVENT() { echo "$ARC_ROOT/.claude/scripts/hq/arc-event.sh"; }

# A payload whose idem the emitter must derive for itself.
PAYLOAD='{"site":"arc-site.example.com","slug":"receipts-driven-os","url":"https://arc-site.example.com/blog/receipts-driven-os","title":"Receipts driven OS","template_id":"title-a","cluster_id":"c-000","content_sha":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","pr_ref":"#12"}'

_spine() {
  SPINE="$BATS_TEST_TMPDIR/spine-$1"
  mkdir -p "$SPINE"
  export ARC_SPINE_ROOT="$SPINE"
}

# Count receipts of a kind that actually landed in the canonical log.
_landed() { grep -rho '"kind":"content.published"' "$SPINE/events" 2>/dev/null | wc -l | tr -d ' '; }
# Anything at all in quarantine. A receipt here is the silent-failure case, not a pass.
_quarantined() { find "$SPINE" -path "*_quarantine*" -name "*.jsonl" -exec cat {} + 2>/dev/null | grep -c . || true; }

@test "content.published can actually be emitted, and lands in events not quarantine" {
  _spine emit
  run bash "$(EVENT)" emit content.published --payload "$PAYLOAD"
  [ "$status" -eq 0 ] || { echo "emit failed: $output"; false; }
  # Exit 0 proves the command returned. It does not prove a receipt exists.
  [ "$(_landed)" = "1" ] || { echo "no content.published in events/: $(find "$SPINE" -type f)"; false; }
  [ "$(_quarantined)" = "0" ] || { echo "receipt was QUARANTINED, which is the failure this test exists for"; false; }
}

@test "the emitter derives the idem itself and refuses a supplied one" {
  _spine noidem
  run bash "$(EVENT)" emit content.published --payload "$PAYLOAD" --idem "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  [ "$status" -ne 0 ] || { echo "a caller-supplied idem was accepted -- a decoy can now pre-claim a real article's key"; false; }
  [ "$(_landed)" = "0" ] || { echo "the refused emit still wrote a receipt"; false; }
}

@test "re-emitting identical bytes is idempotent on the spine itself" {
  _spine dup
  run bash "$(EVENT)" emit content.published --payload "$PAYLOAD"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run bash "$(EVENT)" emit content.published --payload "$PAYLOAD"
  # Whether the second emit exits 0 or reports a duplicate, exactly one receipt may exist.
  [ "$(_landed)" = "1" ] || { echo "re-publish wrote $(_landed) receipts, expected 1"; false; }
}

@test "a metadata-only correction lands as a SECOND receipt and the first is untouched" {
  # The attack-panel finding, proven end to end rather than at the hash. Under the first draft of
  # the idem this second emit collided and vanished, leaving the spine claiming template_id title-a
  # forever with no record that anyone tried to correct it.
  _spine correction
  run bash "$(EVENT)" emit content.published --payload "$PAYLOAD"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local FIXED; FIXED="${PAYLOAD/\"template_id\":\"title-a\"/\"template_id\":\"title-b\"}"
  run bash "$(EVENT)" emit content.published --payload "$FIXED"
  [ "$status" -eq 0 ] || { echo "correction refused: $output"; false; }
  [ "$(_landed)" = "2" ] || { echo "correction did not land as its own receipt (found $(_landed))"; false; }
  # The original bytes must still be there: append-only, corrections supersede, never overwrite.
  run grep -rq '"template_id":"title-a"' "$SPINE/events"
  [ "$status" -eq 0 ] || { echo "the original receipt was overwritten"; false; }
}

@test "an unknown payload field is refused by the emitter in strict mode and never reaches disk" {
  _spine unknownfield
  local BAD; BAD="${PAYLOAD/\"pr_ref\":\"#12\"/\"pr_ref\":\"#12\",\"campaign\":\"x\"}"
  run bash "$(EVENT)" emit content.published --payload "$BAD" --strict
  [ "$status" -eq 2 ] || { echo "expected exit 2 on an unknown payload key, got $status: $output"; false; }
  [ "$(_landed)" = "0" ] || { echo "a payload with an unknown key reached the canonical log"; false; }
}

@test "an unregistered content kind does not reach the canonical log" {
  # In hook mode the emitter must not block a session, so exit 0 is allowed here -- which is exactly
  # why the assertion is on the DISK and not on the status. This is the 2026-08-02 retro verbatim.
  _spine unknownkind
  run bash "$(EVENT)" emit content.retracted --payload "$PAYLOAD"
  [ "$(_landed)" = "0" ] || { echo "an undeclared kind landed in the canonical log"; false; }
}
