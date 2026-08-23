#!/usr/bin/env bats
# Phase 02 -- the engine. arc-run + three drivers behind ONE interface.
#
# THE SHAPE THAT MAKES "one interface" A FACT: the contract block runs the IDENTICAL
# assertions against every driver. A driver either satisfies them or is visibly not a driver.
# Nothing here needs a network -- ARC_DRIVER_FAKE puts a recorded response through the same
# code path the real call takes, so the fake cannot drift into a different shape from the
# thing it stands in for.
#
# Every green assertion is paired with a negative control. Especially the secret scrub: a
# scrubber that has never been seen to catch anything is a scrubber nobody has tested.
bats_require_minimum_version 1.5.0
load 'test_helper'

RUN()   { echo "$ARC_ROOT/.claude/scripts/engine/arc-run.mjs"; }
LINT()  { echo "$ARC_ROOT/.claude/scripts/engine/process-lint.mjs"; }
FAKE()  { echo "$ARC_ROOT/tests/fixtures/engine/driver-fakes/$1"; }
DRIVERS="claude-code codex generic-api"

# arc-run writes receipts to the spine. Point it at a throwaway spine so a test run never
# appends to the real event log -- a suite that pollutes production state is a suite people
# stop running.
setup() { export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine"; mkdir -p "$ARC_SPINE_ROOT"; }

# ---------------------------------------------------------------------------
# REQ-04 -- any process, any driver, one interface
# ---------------------------------------------------------------------------

@test "REQ-04: every driver satisfies the same contract on the same process" {
  for d in $DRIVERS; do
    # `--separate-stderr`, so `$output` is STDOUT ALONE. bats merges the streams by default, and
    # arc-run writes operator lines to stderr -- the REQ-03 absence warning among them -- so
    # `head -1` was parsing a warning as the receipt. arc-run stdout IS the JSON document; that is
    # the property this test exists to state, and it could only be stated on the split stream.
    ARC_DRIVER_FAKE="$(FAKE good)" run --separate-stderr node "$(RUN)" --process commit-msg-draft --driver "$d" --root "$ARC_ROOT"
    [ "$status" -eq 0 ] || { echo "driver $d failed: $output $stderr"; false; }
    # the output is the process's JSON document and nothing else
    echo "$output" | head -1 | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);if(!Array.isArray(o.commits))process.exit(1)})'
  done
}

@test "REQ-04: every driver honours the exit-code contract identically" {
  for d in $DRIVERS; do
    ARC_DRIVER_FAKE="$(FAKE declined)"   run node "$(RUN)" --process commit-msg-draft --driver "$d" --root "$ARC_ROOT"
    [ "$status" -eq 1 ]
    [[ "$output" == *"declined"* ]]
    ARC_DRIVER_FAKE="$(FAKE driverfail)" run node "$(RUN)" --process commit-msg-draft --driver "$d" --root "$ARC_ROOT"
    [ "$status" -eq 1 ]
  done
}

@test "REQ-04: a driver shell wrapper is a thin wrapper over a Node core (ADR-0203)" {
  for d in $DRIVERS; do
    [ -f "$ARC_ROOT/.claude/scripts/engine/drivers/$d.sh" ]
    [ -f "$ARC_ROOT/.claude/scripts/engine/drivers/$d.mjs" ]
    run grep -c "exec .*node.*$d.mjs" "$ARC_ROOT/.claude/scripts/engine/drivers/$d.sh"
    [ "$output" = "1" ]
  done
}

@test "REQ-04: the escalation ladder ends in a PROPOSAL and never changes a tier" {
  ARC_DRIVER_FAKE="$(FAKE badschema)" run node "$(RUN)" --process commit-msg-draft --driver claude-code --root "$ARC_ROOT"
  [ "$status" -eq 1 ]
  [[ "$output" == *"retrying once on the same tier"* ]]   # rung 1
  [[ "$output" == *"PROPOSAL was recorded"* ]]            # rung 2
  [[ "$output" == *"nothing was escalated"* ]]
  # ADR-0069 b1: the router is the only place a tier changes, and only a human edits it.
  run grep -c "tier:" "$ARC_ROOT/engine/router.yaml"
  [ "$output" -ge 1 ]
  # the proposal is an approval.requested receipt, not an action
  run grep -rl "engine-escalation" "$ARC_SPINE_ROOT/events"
  [ "$status" -eq 0 ]
}

@test "REQ-04: fault_hint separates a driver fault from a process fault" {
  # The process is self-consistent (its eval fixture satisfies its own schema), so a bad
  # driver answer must be blamed on the DRIVER.
  ARC_DRIVER_FAKE="$(FAKE badschema)" run node "$(RUN)" --process commit-msg-draft --driver claude-code --root "$ARC_ROOT"
  [ "$status" -eq 1 ]
  run grep -rh "engine-escalation" "$ARC_SPINE_ROOT/events"
  [[ "$output" == *'"fault_hint":"driver"'* ]]
}

@test "REQ-04: a process whose own fixture fails its own schema is blamed, not the driver" {
  local d; d="$(mktemp -d)"
  mkdir -p "$d/processes" "$d/tests/fixtures/engine/evals/commit-msg-draft" "$d/.claude"
  cp -r "$ARC_ROOT/.claude/scripts" "$d/.claude/"
  cp "$ARC_ROOT/processes/commit-msg-draft.process.yaml" "$d/processes/"
  # a fixture that does NOT satisfy the process's own output schema
  printf '{"input":{},"expected":{"commits":[{"sha":"NOPE","subject":""}]}}' \
    > "$d/tests/fixtures/engine/evals/commit-msg-draft/basic.json"
  ARC_DRIVER_FAKE="$(FAKE badschema)" run node "$(RUN)" --process commit-msg-draft --driver claude-code --root "$d"
  [ "$status" -eq 1 ]
  # KEEP arc-run's OWN OUTPUT. `run` overwrites $output on the next call, and this test used to
  # throw it away immediately -- so when the receipt did not land, the failure message was "the
  # grep found nothing" and nothing else. This test is a RECORDED FLAKE (PROGRESS.md, 2026-08-13:
  # PASS and FAIL observed on byte-identical trees, PASS again on rerun), and the tracker's
  # instruction is explicit: do not re-run it green, INSTRUMENT it. Everything below exists so the
  # next red carries its own diagnosis instead of costing another observation.
  local runout="$output"

  run grep -rh "engine-escalation" "$ARC_SPINE_ROOT/events"
  if [[ "$output" != *'"fault_hint":"process"'* ]]; then
    echo "=== FLAKE DIAGNOSIS (engine-driver-contract REQ-04) ==="
    echo "--- arc-run said: ---"
    echo "$runout"
    echo "--- did the emitter report a problem? ---"
    echo "$runout" | grep -iE "could not emit|not recorded|timed out|EMIT_TIMEOUT|lock" || echo "(no emit diagnostic in arc-run output)"
    echo "--- events dir: ---"
    ls -la "$ARC_SPINE_ROOT/events" 2>&1 | tail -5
    echo "--- QUARANTINE (a receipt that was written and REJECTED looks identical to one never written): ---"
    ls -la "$ARC_SPINE_ROOT/events/_quarantine" 2>&1 | tail -5
    grep -rh "engine-escalation" "$ARC_SPINE_ROOT/events/_quarantine" 2>/dev/null | tail -2 || echo "(nothing quarantined)"
    echo "--- every kind that DID land, so 'no receipt' and 'the wrong receipt' are distinguishable: ---"
    grep -roh '"kind":"[a-z._]*"' "$ARC_SPINE_ROOT/events" 2>/dev/null | sort | uniq -c || echo "(no events at all)"
    echo "======================================================"
    false
  fi
  [[ "$output" == *"no driver is being blamed"* ]]
}

# ---------------------------------------------------------------------------
# REQ-05 -- budgets are hard
# ---------------------------------------------------------------------------

@test "REQ-05: a budget that leaves nothing to spend stops BEFORE any driver runs" {
  ARC_DRIVER_FAKE="$(FAKE good)" run node "$(RUN)" --process commit-msg-draft --driver claude-code --budget inr=0 --root "$ARC_ROOT"
  [ "$status" -eq 1 ]
  [[ "$output" == *"stopped before invoking any driver"* ]]
  run grep -rh '"reason":"budget"' "$ARC_SPINE_ROOT/events"
  [ "$status" -eq 0 ]
}

@test "REQ-05: a driver declining for budget is reported as a budget outcome, never as success" {
  ARC_DRIVER_FAKE="$(FAKE declined)" run node "$(RUN)" --process commit-msg-draft --driver claude-code --budget inr=5 --root "$ARC_ROOT"
  [ "$status" -eq 1 ]
  run grep -rh '"reason":"budget"' "$ARC_SPINE_ROOT/events"
  [ "$status" -eq 0 ]
}

@test "REQ-05 fixture 10: a budget decline STOPS -- the fallback chain is never walked" {
  # THE ARM FIXTURE 10 OWED. `initiatives/engine/evidence/phase-06/fixture-10-capped-key.md` said it
  # in as many words: the provider's HTTP 403 was measured, `cert 10` proves the hermes driver maps
  # that message to exit 2 with a negative control -- and NOTHING proved the third link, that
  # arc-run then stops. REQ-05 says "with zero silent continuation", and the two existing REQ-05
  # tests assert the receipt reason and nothing about what happened next.
  #
  # It matters because `commit-msg-draft` HAS a chain (codex, generic-api). Walking it against a
  # spent credential cannot succeed and spends the run budget again per hop -- a loop that cannot
  # win and does not stop. arc-run guards it with `while (a.verdict === "driver" ...)`, and until
  # now deleting that one word from the condition left every suite green.
  # `--driver auto`, NOT an explicit driver, and CI is what taught this. arc-run reads `fallback:`
  # off the routed row only on the auto path, so with an explicit `--driver` the chain is EMPTY --
  # "the chain was not walked" was true of a run that had no chain, which is a vacuous pass, and
  # the negative control below could not walk one either. Under auto, commit-msg-draft carries a
  # real chain: claude-code -> codex -> generic-api.
  ARC_DRIVER_FAKE="$(FAKE declined)" run node "$(RUN)" --process commit-msg-draft --driver auto --root "$ARC_ROOT"
  [ "$status" -eq 1 ] || { echo "a budget decline did not fail the run: $output"; false; }

  # POSITIVE ASSERTIONS FIRST. An absent "falling back" line is satisfied by a crash, by a typo in
  # the process name, or by a run that never reached the driver at all -- so what proves the chain
  # was not walked is the receipt naming the FIRST driver and exactly ONE attempt.
  run grep -rh '"reason":"budget"' "$ARC_SPINE_ROOT/events"
  [ "$status" -eq 0 ] || { echo "no budget receipt landed"; false; }
  run grep -rh '"driver":"claude-code"' "$ARC_SPINE_ROOT/events"
  [ "$status" -eq 0 ] || { echo "the receipt does not name the first driver"; false; }
  # And the receipt must not name a driver further down the chain, which is the same fact read
  # from the other side.
  run grep -rh '"driver":"codex"' "$ARC_SPINE_ROOT/events"
  [ "$status" -ne 0 ] || { echo "the fallback driver reached the spine -- the chain was walked"; false; }
}

@test "REQ-05 fixture 10 NEGATIVE CONTROL: a DRIVER fault on the same class DOES walk the chain" {
  # Without this, the test above passes on a tree where the fallback loop was deleted outright,
  # and "zero silent continuation" would be indistinguishable from "no continuation ever". The two
  # runs differ only in what the fake reports, which is exactly the discrimination being tested.
  ARC_DRIVER_FAKE="$(FAKE driverfail)" run node "$(RUN)" --process commit-msg-draft --driver auto --root "$ARC_ROOT"
  [[ "$output" == *"falling back to codex"* ]] || { echo "a driver fault did not walk the chain: $output"; false; }
  # Walked to the END of the chain, and the receipt names where it stopped -- so this control fails
  # if the loop is deleted AND if it stops after one hop.
  run grep -rh '"driver":"generic-api"' "$ARC_SPINE_ROOT/events"
  [ "$status" -eq 0 ] || { echo "the chain did not reach the last driver"; false; }
}

@test "REQ-05: an unavailable cost stays ABSENT - never zero, never estimated" {
  ARC_DRIVER_FAKE="$(FAKE good)" run node "$(RUN)" --process commit-msg-draft --driver claude-code --root "$ARC_ROOT"
  [ "$status" -eq 0 ]
  # No driver returns a rupee figure, so the spine's cost block (which REQUIRES inr_estimate)
  # is declined entirely and the measured tokens ride in the payload instead. The one thing
  # that must never appear is a fabricated money number.
  run grep -rh '"kind":"run.completed"' "$ARC_SPINE_ROOT/events"
  [[ "$output" == *'"cost":null'* ]]
  [[ "$output" == *'"tokens":'* ]]
  [[ "$output" != *'"inr_estimate":0'* ]]
}

@test "REQ-05: an unparseable budget is rejected rather than ignored" {
  run node "$(RUN)" --process commit-msg-draft --driver claude-code --budget "inr=lots" --root "$ARC_ROOT"
  [ "$status" -eq 2 ]
}

# ---------------------------------------------------------------------------
# REQ-06 -- routing is explicit, not magic
# ---------------------------------------------------------------------------

@test "REQ-06: --driver auto resolves through engine/router.yaml" {
  run node "$(RUN)" --process commit-msg-draft --driver auto --dry-run --root "$ARC_ROOT"
  [ "$status" -eq 0 ]
  [[ "$output" == *"claude-code"* ]]
  [[ "$output" == *"balanced-workhorse"* ]]
}

@test "REQ-06: an unknown task class is a LOUD error naming the file to edit" {
  local d; d="$(mktemp -d)"
  mkdir -p "$d/processes" "$d/engine" "$d/.claude"
  cp -r "$ARC_ROOT/.claude/scripts" "$d/.claude/"
  cp "$ARC_ROOT/processes/commit-msg-draft.process.yaml" "$d/processes/"
  printf 'version: 1\ntiers:\n  - balanced-workhorse\nclasses:\n  something-else:\n    tier: balanced-workhorse\n    driver: claude-code\n' > "$d/engine/router.yaml"
  run node "$(RUN)" --process commit-msg-draft --driver auto --dry-run --root "$d"
  [ "$status" -eq 1 ]
  [[ "$output" == *"no route for task class"* ]]
  [[ "$output" == *"engine/router.yaml"* ]]
}

@test "REQ-06: process-lint FAILs on a router tier ADR-0069 does not name" {
  local d; d="$(mktemp -d)"
  mkdir -p "$d/processes" "$d/engine" "$d/docs/adr" "$d/tests/fixtures/engine/evals/commit-msg-draft" "$d/.claude/commands"
  cp "$ARC_ROOT/processes/commit-msg-draft.process.yaml" "$d/processes/"
  cp "$ARC_ROOT/docs/adr/0069-balanced-model-policy.md" "$d/docs/adr/"
  # Copy the WHOLE eval directory, never one named fixture. process-lint checks that every path
  # in `evals:` exists, so a sandbox that mirrors the process file but only one of its fixtures
  # fails the clean-first assertion below for the wrong reason. That is not hypothetical: the
  # bench lane armed this class to five fixtures on 2026-08-12 and this test went red on all
  # three OS legs, because the sandbox still copied only basic.json. Copying the directory means
  # adding a fixture never breaks it again.
  cp -r "$ARC_ROOT/tests/fixtures/engine/evals/commit-msg-draft/." "$d/tests/fixtures/engine/evals/commit-msg-draft/"
  cp "$ARC_ROOT/.claude/commands/arc-commit.md" "$d/.claude/commands/"
  # clean first, so the failure below is attributable to the tier and nothing else
  cp "$ARC_ROOT/engine/router.yaml" "$d/engine/"
  run node "$(LINT)" --all --root "$d"
  [ "$status" -eq 0 ]
  sed 's/  - high-judgment/  - high-judgment\n  - invented-tier/' "$ARC_ROOT/engine/router.yaml" > "$d/engine/router.yaml"
  run node "$(LINT)" --all --root "$d"
  [ "$status" -eq 1 ]
  [[ "$output" == *"[router-tier]"* ]]
  [[ "$output" == *"ADR-0069"* ]]
}

# ---------------------------------------------------------------------------
# REQ-07 -- no secrets leak through drivers
# ---------------------------------------------------------------------------

@test "REQ-07: a secret in driver output stops the run and is never written onward" {
  ARC_DRIVER_FAKE="$(FAKE secret)" run node "$(RUN)" --process commit-msg-draft --driver claude-code --root "$ARC_ROOT"
  [ "$status" -eq 1 ]
  [[ "$output" == *"aws-access-key-id"* ]]
  [[ "$output" == *"was NOT written"* ]]
  # negative control on the SCRUBBER itself: the planted key must not reach the spine
  run grep -rh "AKIA" "$ARC_SPINE_ROOT/events"
  [ "$status" -ne 0 ]
}

@test "REQ-07: the scrubber is the spine's own, not a second copy that can drift" {
  run grep -c 'from "../hq/lib/redact.mjs"' "$(RUN)"
  [ "$output" = "1" ]
  run grep -cE "DENY_RULES *= *\[" "$(RUN)"
  [ "$output" = "0" ]
}

@test "REQ-07: a clean run passes the scrub - the check is not simply always-on" {
  ARC_DRIVER_FAKE="$(FAKE good)" run node "$(RUN)" --process commit-msg-draft --driver claude-code --root "$ARC_ROOT"
  [ "$status" -eq 0 ]
  [[ "$output" != *"secret"* ]]
}

# ---------------------------------------------------------------------------
# Receipts
# ---------------------------------------------------------------------------

@test "every run leaves a run.completed receipt, and its landing is VERIFIED" {
  ARC_DRIVER_FAKE="$(FAKE good)" run node "$(RUN)" --process commit-msg-draft --driver claude-code --root "$ARC_ROOT"
  [ "$status" -eq 0 ]
  run grep -rh '"kind":"run.completed"' "$ARC_SPINE_ROOT/events"
  [ "$status" -eq 0 ]
  [[ "$output" == *'"process":"commit-msg-draft@1.0.0"'* ]]
  # and nothing was quarantined: exit 0 from a fire-and-forget writer is not evidence
  [ ! -d "$ARC_SPINE_ROOT/events/_quarantine" ] || [ -z "$(ls -A "$ARC_SPINE_ROOT/events/_quarantine")" ]
}

@test "arc-run is headless only and rejects an unknown option" {
  run node "$(RUN)" --process commit-msg-draft --interactive
  [ "$status" -eq 2 ]
  run node "$(RUN)"
  [ "$status" -eq 2 ]
}

@test "REQ-04: the contract suite also exercises each driver's REAL code path" {
  # ARC_DRIVER_FAKE returns BEFORE produce() runs, so every other test in this file proves
  # interface conformance and nothing about a driver's own logic. Found while timing the
  # 4th driver: a fixture pass via the fake path is not evidence the driver works.
  #
  # So: run each driver with NO fake and a deliberately unreachable endpoint/binary. Each
  # must reach its own code, fail, and report the DRIVER-FAILURE exit code -- not crash,
  # not exit 0, not hang.
  for d in $DRIVERS; do
    ARC_LLM_ENDPOINT="http://127.0.0.1:59999/nope" \
    ARC_LLM_API_KEY="not-a-real-key" \
    ARC_LLM_MODEL="none" \
    ARC_CLAUDE_CLI="definitely-not-a-real-binary" \
    ARC_CODEX_CLI="definitely-not-a-real-binary" \
    run bash "$ARC_ROOT/.claude/scripts/engine/drivers/$d.sh" run commit-msg-draft '{}' 'inr=10'
    [ "$status" -eq 1 ] || { echo "driver $d exited $status on its real path (want 1)"; echo "$output"; false; }
    [ -n "$output" ]
  done
}

@test "REQ-04: a driver with no recording fails loudly rather than passing silently" {
  local empty; empty="$(mktemp -d)"
  ARC_DRIVER_FAKE="$empty" run bash "$ARC_ROOT/.claude/scripts/engine/drivers/claude-code.sh" run commit-msg-draft '{}' 'inr=10'
  [ "$status" -eq 1 ]
  [[ "$output" == *"not a fake, it is a silent pass"* ]]
}
