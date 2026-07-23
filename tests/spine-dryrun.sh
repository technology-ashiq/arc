#!/usr/bin/env bash
# tests/spine-dryrun.sh — the canned dry-run session: one factory pass, kickoff → ship.
#
# The six factory flows are Claude slash-command markdown a test can't execute, so this
# script stands in for ONE real session: it drops each flow's command-level receipt, in
# order, through the spine's only writer (arc-event.sh, ADR-0031). It emits ONLY the six
# flow receipts — no SessionStart/End lifecycle noise — because REQ-01's golden is the
# command-level chain (hook fragments alone do not produce these kinds).
#
# Determinism: the caller (tests/spine-golden-dryrun.bats) pins the clock and randomness via
# ARC_SPINE_ROOT / ARC_SPINE_NOW / ARC_SPINE_RAND, so this session is a pure function of its
# inputs. Each receipt is stamped one second after the last — distinct, ordered ULIDs within
# the same day — and emitted in --strict mode so a malformed payload aborts loudly here
# rather than silently quarantining and reading downstream as a missing receipt.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EVENT="$here/../.claude/scripts/hq/arc-event.sh"

base="${ARC_SPINE_NOW:-1784736000000}"
step=0
emit() {
  ARC_SPINE_NOW=$(( base + step * 1000 )) bash "$EVENT" emit "$1" --payload "$2" --strict >/dev/null
  step=$(( step + 1 ))
}

emit kickoff.done     '{"goal":"receipt-spine","tier":"M"}'
emit phase.closed     '{"phase":"01","name":"factory-wiring"}'
emit review.completed '{"scope":"branch","findings":0}'
emit qa.completed     '{"flow":"golden-dryrun","pass":true}'
emit commit.done      '{"type":"test","subject":"golden dry-run"}'
emit ship.done        '{"target":"branch"}'
