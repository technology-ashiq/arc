#!/usr/bin/env bats
# Phase 01 REQ-03 / Phase 02 automatic demotion -- the emitter that turns a denial into an
# authority loss (ADR-0505).
#
# `buildDemotion` decided what a demotion IS from the day Phase 0 shipped and had NO CALLER. The
# reducer folded `policy.demoted` events nobody wrote, its four race fixtures were green against
# hand-built streams, and `arc-run` carried a comment claiming the cap dropped mid-run. Every
# piece was correct and the chain did nothing. This suite tests the seam.
#
# THE RULE: demote only on a `deny` for a pair whose level would otherwise have EXECUTED.
#
# The narrow reading is the whole design. A `propose` must never demote -- every pair is born at
# L1, and demoting on the system working as designed would walk the entire policy to L0 within a
# handful of ordinary tool calls. A deny at L0 must never demote -- there is nothing to take. And
# a deny at L1 must never demote either, even though denies DO land there: the integrity checks
# are hoisted out of the L2 branch, so a pair at its birth cap still gets a hard deny for
# touching the settings file. That is the grant working, not a reach past it, and reading it the
# other way would make the first such attempt in any fresh repo cost the session its ability even
# to propose.
#
# Each test builds its OWN root and its own spine. The suite must never write a receipt into the
# checkout it runs in.
#
# ASCII-only test names; the file asserts its own registered count at the bottom.
bats_require_minimum_version 1.5.0
load 'test_helper'

# A throwaway root that owns the code, the policy AND the spine. policyRoot() pins the governing
# root to the module's own location, so a copied tree is governed by its own copied policy.
_root() {
  D="$BATS_TEST_TMPDIR/root"
  mkdir -p "$D/.claude/state/hq"
  cp -r "$ARC_ROOT/.claude/scripts" "$D/.claude/"
  cp "$ARC_ROOT/hq.policy.yaml" "$D/hq.policy.yaml"
  export ARC_SPINE_ROOT="$D/.claude/state/hq"
  cat > "$D/raise.mjs" <<'MJS'
// Seal a REAL policy.level.changed so the pair actually holds execute authority. Building the
// event by hand would prove nothing: the point is that the reducer folds what the emitter wrote.
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
const [D, capability, to] = process.argv.slice(2);
const P = await import(pathToFileURL(resolve(D, ".claude/scripts/hq/lib/policy/index.mjs")).href);
const policy = P.loadPolicyFromDisk(D);
const payload = { action_kind: "session:interactive", capability,
  correlation: "fixture", decision_ref: "01JQ8XZ9K0ABCDEFGH00000009", from_level: "L1",
  policy_hash: P.policyHash(policy), to_level: to,
  trial_ledger_ref: "docs/trial-ledger.md#fixture" };
execFileSync("bash", [resolve(D, ".claude/scripts/hq/arc-event.sh"), "emit",
  "policy.level.changed", "--payload", JSON.stringify(payload), "--strict"],
  { encoding: "utf8", cwd: D });
const evs = P.loadPolicyEvents(D);
console.log(P.resolveEffectivePolicy("session:interactive", capability, { policy, events: evs }).effective);
MJS
  cat > "$D/level.mjs" <<'MJS'
// The effective level of a pair, folded from whatever is actually on the spine.
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
const [D, capability] = process.argv.slice(2);
const P = await import(pathToFileURL(resolve(D, ".claude/scripts/hq/lib/policy/index.mjs")).href);
const policy = P.loadPolicyFromDisk(D);
console.log(P.resolveEffectivePolicy("session:interactive", capability,
  { policy, events: P.loadPolicyEvents(D) }).effective);
MJS
  for f in raise level; do
    [ -s "$D/$f.mjs" ] || { echo "$f.mjs is empty -- the heredoc never landed"; return 1; }
  done
}

_level() { node "$D/level.mjs" "$D" "$1"; }

# Raise a capability to execute authority, and PROVE it took -- a fixture that silently fails to
# grant would make every "no demotion" assertion below pass for the wrong reason.
_raise() {
  local got; got="$(node "$D/raise.mjs" "$D" "$1" "$2")"
  [ "$got" = "$2" ] || { echo "the fixture did not reach $2 (got $got)"; return 1; }
}

# The payload goes in via a FILE, never interpolated into a shell string (CLAUDE.md).
_ask() {
  printf '%s' "$1" > "$BATS_TEST_TMPDIR/payload.json"
  node "$D/.claude/scripts/hq/policy-hook.mjs" < "$BATS_TEST_TMPDIR/payload.json"
}

# The trailing separator is stripped HERE, not left to the caller. `$( )` strips trailing
# NEWLINES, not spaces -- so `tr '\n' ' '` leaves one behind that survives command substitution,
# and an expected value written without it can never match.
_kinds() { cat "$ARC_SPINE_ROOT/events/"*.jsonl 2>/dev/null | grep -o '"kind":"[^"]*"' | sed 's/.*://' | tr -d '"' | sort | tr '\n' ' ' | sed 's/ *$//'; }
_quarantined() { ls -1 "$ARC_SPINE_ROOT/events/_quarantine" 2>/dev/null | wc -l | tr -d " "; }

@test "AN OVERREACH AT EXECUTE COSTS A LEVEL, and both receipts land sealed" {
  _root; _raise write L2
  run _ask '{"tool_name":"Write","tool_input":{"file_path":"/etc/nope.txt"}}'
  [ "$status" -eq 2 ] || { echo "the overreach was not denied: $output"; false; }
  [[ "$output" == *"outside the declared write roots"* ]] || { echo "$output"; false; }
  [[ "$output" == *"demoted L2 -> L1"* ]] || { echo "no demotion reported: $output"; false; }
  # READ IT BACK. An emitter can exit 0 having quarantined everything it wrote.
  [ "$(_kinds)" = "incident.raised policy.demoted policy.level.changed" ] || {
    echo "spine holds: $(_kinds)"; false; }
  [ "$(_quarantined)" = "0" ] || { echo "receipts were quarantined"; false; }
}

@test "the demotion cites the incident that caused it" {
  # Without the citation the machine-derived kind becomes the cheap path to an authority change
  # with nothing to point at -- which is the reason it is a separate kind at all (ADR-0508).
  _root; _raise write L2
  run _ask '{"tool_name":"Write","tool_input":{"file_path":"/etc/nope.txt"}}'
  [ "$status" -eq 2 ]
  # The id the hook REPORTED and the id sealed inside the demotion payload must be one event.
  local cited; cited="$(cat "$ARC_SPINE_ROOT/events/"*.jsonl | grep -o '"incident_ref":"[^"]*"' | head -1 | sed 's/.*://' | tr -d '"')"
  [[ "$cited" =~ ^[0-9A-HJKMNP-TV-Z]{26}$ ]] || { echo "the demotion cites no ULID: $cited"; false; }
  [[ "$output" == *"citing $cited"* ]] || { echo "the reported citation is not the sealed one: $output / $cited"; false; }
}

@test "THE RATCHET GUARD -- a propose never demotes" {
  # The single most important test here. Every pair is BORN at L1, so if a propose cost a level
  # the engine would walk itself to L0 in a handful of ordinary tool calls and disable the
  # session it exists to protect. No raise: write sits at its birth cap.
  _root
  run _ask '{"tool_name":"Write","tool_input":{"file_path":"docs/x.md"}}'
  [ "$status" -eq 2 ] || { echo "$output"; false; }
  [[ "$output" == *"L1 (propose)"* ]] || { echo "not the propose path: $output"; false; }
  [ "$(_kinds)" = "" ] || { echo "a propose wrote receipts: $(_kinds)"; false; }
}

@test "a deny at L0 writes nothing -- there is nothing to take" {
  # And a receipt per routine deny-by-default would bury the spine in evidence of the system
  # behaving correctly.
  _root
  run _ask '{"tool_name":"mcp__Vercel__deploy_to_vercel","tool_input":{}}'
  [ "$status" -eq 2 ] || { echo "$output"; false; }
  [ "$(_kinds)" = "" ] || { echo "an L0 deny wrote receipts: $(_kinds)"; false; }
}

@test "a HARD DENY at the L1 birth cap still writes nothing" {
  # The case that changed after the first cut of this wiring. Integrity checks are hoisted out of
  # the L2 branch, so an un-grantable resource is refused at ANY level -- this is a deny, not a
  # propose, and it lands while the pair holds only L1. Demoting here would cost a fresh repo its
  # ability to propose on the first attempt to touch the settings file.
  _root
  run _ask '{"tool_name":"Write","tool_input":{"file_path":".claude/settings.json"}}'
  [ "$status" -eq 2 ] || { echo "$output"; false; }
  [[ "$output" == *"un-grantable resource"* ]] || { echo "not the integrity path: $output"; false; }
  [ "$(_kinds)" = "" ] || { echo "an L1 deny wrote receipts: $(_kinds)"; false; }
}

@test "PHASE 01 REQ-03 -- the NEXT authorization sees the demoted level" {
  # The criterion in phase-01-spec, and the one that could not be met while nothing emitted:
  # "the same run's next authorization sees the demoted effective level for that capability".
  # Before the bite this write is executed; after it, the same call is only a proposal.
  _root; _raise write L2
  run _ask '{"tool_name":"Write","tool_input":{"file_path":"docs/x.md"}}'
  [ "$status" -eq 0 ] || { echo "an in-root write at L2 should execute: $output"; false; }

  run _ask '{"tool_name":"Write","tool_input":{"file_path":"/etc/nope.txt"}}'
  [ "$status" -eq 2 ]
  [[ "$output" == *"demoted L2 -> L1"* ]] || { echo "$output"; false; }

  run _ask '{"tool_name":"Write","tool_input":{"file_path":"docs/x.md"}}'
  [ "$status" -eq 2 ] || { echo "the demotion did not reach the next authorization: $output"; false; }
  [[ "$output" == *"L1 (propose)"* ]] || { echo "wrong level after the bite: $output"; false; }
}

@test "cross-capability isolation survives the wiring -- a write incident leaves network alone" {
  # ADR-0505 at the EMITTER, not only in the reducer: authority is keyed per (kind, capability)
  # pair, so the bite must not touch a sibling that did nothing wrong.
  #
  # Asserted through the reducer, not by making a network call: `network` carries a level and no
  # domain allowlist, so at L2 every URL is denied for an unrelated reason -- and THAT deny would
  # itself be an overreach and demote network, making this test assert the opposite of what it
  # reads. The cap is the fact; a second tool call is a second experiment.
  #
  # And the siblings are not raised first, because they cannot be: `network` and `shell` have an
  # L1 CEILING in the shipped policy, so a promotion to L2 is clamped straight back to L1 and the
  # fixture would be measuring a grant it never got. (`_raise` catches that -- it did.) Their
  # levels are captured before the bite and compared after, which is the property either way.
  _root; _raise write L2
  local net_before shell_before; net_before="$(_level network)"; shell_before="$(_level shell)"
  run _ask '{"tool_name":"Write","tool_input":{"file_path":"/etc/nope.txt"}}'
  [ "$status" -eq 2 ]
  [[ "$output" == *"demoted L2 -> L1"* ]] || { echo "$output"; false; }
  [ "$(_level write)" = "L1" ] || { echo "write did not drop: $(_level write)"; false; }
  [ "$(_level network)" = "$net_before" ]   || { echo "network moved: $net_before -> $(_level network)"; false; }
  [ "$(_level shell)" = "$shell_before" ]   || { echo "shell moved: $shell_before -> $(_level shell)"; false; }
  # And the receipt itself names one capability, so no sibling was demoted silently either.
  [ "$(cat "$ARC_SPINE_ROOT/events/"*.jsonl | grep -c '"kind":"policy.demoted"')" = "1" ] || {
    echo "more than one demotion was written"; false; }
  cat "$ARC_SPINE_ROOT/events/"*.jsonl | grep '"kind":"policy.demoted"' | grep -q '"capability":"write"' || {
    echo "the demotion does not name write"; false; }
}

@test "the bite is SELF LIMITING -- repeating the overreach stops costing levels" {
  # Once the pair can no longer execute, the same refused action is no longer evidence of
  # reaching past a grant. Without this the third or fourth repeat of one mistake would take a
  # capability to L0 and keep it there.
  _root; _raise write L2
  run _ask '{"tool_name":"Write","tool_input":{"file_path":"/etc/nope.txt"}}'
  [[ "$output" == *"demoted L2 -> L1"* ]] || { echo "$output"; false; }
  run _ask '{"tool_name":"Write","tool_input":{"file_path":"/etc/nope.txt"}}'
  [ "$status" -eq 2 ]
  [[ "$output" != *"demoted"* ]] || { echo "the second attempt demoted again: $output"; false; }
  # Exactly ONE demotion on the spine, not two.
  [ "$(cat "$ARC_SPINE_ROOT/events/"*.jsonl | grep -c '"kind":"policy.demoted"')" = "1" ] || {
    echo "the ratchet ran twice"; false; }
}

@test "A RECEIPT THAT CANNOT BE WRITTEN STILL DENIES, and says so" {
  # Enforcement must never depend on the ledger. Quarantine is not enforcement success
  # (ADR-0106/0032) and neither is a failed emit -- but a silent one would let an operator read
  # a demotion that never happened.
  _root; _raise write L2
  mv "$D/.claude/scripts/hq/arc-event.sh" "$D/arc-event.parked"
  run _ask '{"tool_name":"Write","tool_input":{"file_path":"/etc/nope.txt"}}'
  [ "$status" -eq 2 ] || { echo "a broken emitter softened the block: $output"; false; }
  [[ "$output" == *"outside the declared write roots"* ]] || { echo "$output"; false; }
  [[ "$output" != *"demoted L"* ]] || { echo "it claimed a demotion it could not write: $output"; false; }
  # LOUD. The first cut printed nothing at all on this path -- both report branches were keyed on
  # an incident id that the failure means we never got -- so a lost authority receipt looked
  # exactly like a routine deny. A disarmed guard must never be silent.
  [[ "$output" == *"WARN the overreach was NOT recorded"* ]] || {
    echo "a lost receipt was silent: $output"; false; }
}

@test "this file registered every test it declares" {
  [ "${#BATS_TEST_NAMES[@]}" -eq 10 ] || {
    echo "registered ${#BATS_TEST_NAMES[@]} tests, expected 10 -- a @test was silently dropped"
    false
  }
}
