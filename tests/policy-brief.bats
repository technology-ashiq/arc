#!/usr/bin/env bats
# Phase 02 -- the brief and the inbox render the four authority receipts (ADR-0508).
#
# THIS SUITE EXISTS BECAUSE THE CHAIN HAD A MISSING LINK NOBODY WALKED. The vocabulary was
# extended 40 -> 44, the payload validators were written, the promotion module built the events,
# and every test drove those modules DIRECTLY. Not one drove the sanctioned emitter -- and
# `arc-event` had no idem branch for the new kinds, so it derived `sha256(contentPre|ms)` while
# `validateEvent` re-derived `policyIdem` and refused the mismatch. All four kinds REJECTED and
# quarantined. A vocabulary nothing can write to is a vocabulary in name only.
#
# So the emitter test here reads the receipt back OFF THE SPINE rather than trusting an exit
# code, which is what phase-02-spec's verification plan asked for.
#
# The second half is the render. `arc-brief` mapped kinds to groups with `if (group) push`, so a
# kind it did not know was skipped in silence -- four new kinds, four silent omissions, and a
# brief that reads exactly like a quiet day. The catch-all group is the fix and the mutation
# test below is its proof: an untested safety net is a decoration.
#
# The catch-all then needed a budget of its own, which is the third half of this suite. It landed
# in the never-collapse tier beside needs-you and money, and 50 develop/slice receipts on one day
# rendered a 53-line brief against a 40-line screen. Trading a silent omission for a loud one is
# not a fix, so the BUDGET / COLLAPSED / FULL tests pin the collapse and the CONTROL test pins the
# tier boundary from the other side -- a rule that swallowed needs-you instead would pass all three.
#
# ASCII-only test names; the file asserts its own registered count at the bottom.
bats_require_minimum_version 1.5.0
load 'test_helper'

EVENT="$ARC_ROOT/.claude/scripts/hq/arc-event.sh"
BRIEF="$ARC_ROOT/.claude/scripts/hq/arc-brief.mjs"
INBOX="$ARC_ROOT/.claude/scripts/hq/arc-inbox.mjs"

H=0000000000000000000000000000000000000000000000000000000000000000
U=01JQ8XZ9K0ABCDEFGH00000009

setup() {
  # Byte-exact brief output is the CONSUMER configuration: no ventures.yaml, so no kill panel
  # and no unreceipted notice. See arc_leave_the_repo in test_helper.bash.
  arc_leave_the_repo || return 1
  SPINE="$BATS_TEST_TMPDIR/spine"; mkdir -p "$SPINE"
  export ARC_SPINE_ROOT="$SPINE"
  export ARC_SPINE_NOW="1784736000000"          # 2026-07-22
  export ARC_SPINE_RAND="00112233445566778899"
}

_emit()  { bash "$EVENT" emit "$@" --strict; }
_brief() { node "$BRIEF" --date 2026-07-22 "$@"; }

_reserved() { _emit spend.reserved --payload "{\"action_kind\":\"process:payer\",\"amount\":40,\"correlation\":\"r\",\"currency\":\"INR\",\"idempotency_key\":\"k1\",\"policy_hash\":\"$H\",\"window\":\"daily\"}"; }
_released() { _emit spend.released --payload "{\"correlation\":\"r\",\"policy_hash\":\"$H\",\"reason\":\"declined\",\"released_on\":\"provider_attested_no_charge\",\"reservation_ref\":\"$U\"}"; }
_raised()   { _emit policy.level.changed --payload "{\"action_kind\":\"session:interactive\",\"capability\":\"write\",\"correlation\":\"r\",\"decision_ref\":\"$U\",\"from_level\":\"L1\",\"policy_hash\":\"$H\",\"to_level\":\"L2\",\"trial_ledger_ref\":\"docs/trial-ledger.md#t\"}"; }
_dropped()  { _emit policy.demoted --payload "{\"action_kind\":\"session:interactive\",\"capability\":\"write\",\"correlation\":\"r\",\"from_level\":\"L2\",\"incident_ref\":\"$U\",\"policy_hash\":\"$H\",\"to_level\":\"L1\"}"; }

_all_four() { _reserved >/dev/null; _released >/dev/null; _raised >/dev/null; _dropped >/dev/null; }

@test "THE MISSING LINK -- the sanctioned emitter can write all four authority kinds" {
  run _all_four
  [ "$status" -eq 0 ] || { echo "the emitter refused an ADR-0508 kind: $output"; false; }
  # READ IT BACK OFF THE SPINE. An emitter exiting 0 while every receipt it wrote was
  # quarantined is the exact shape .claude/rules/testing.md warns about, and it is how this
  # defect stayed invisible for a whole phase.
  local day="$SPINE/events/2026-07-22.jsonl"
  [ -f "$day" ] || { echo "no day file was written at all"; ls -R "$SPINE"; false; }
  local n; n=$(grep -c '"kind":"' "$day")
  [ "$n" -eq 4 ] || { echo "expected 4 sealed receipts, found $n"; cat "$day"; false; }
  [ ! -s "$SPINE/events/_quarantine/2026-07-22.jsonl" ] || {
    echo "a receipt was quarantined:"; cat "$SPINE/events/_quarantine/2026-07-22.jsonl"; false; }
}

@test "a caller supplied idem is REFUSED on a policy kind" {
  # Anti-preclaim, the same rule the leads and experiment kinds keep. The emit path otherwise
  # honours --idem, so an attacker who can emit could claim a real receipt's stable key with a
  # decoy payload; the genuine receipt then collides on DUP_IDEM and is silently lost. A
  # demotion that vanishes is a cap that never drops.
  run _emit policy.demoted --idem "$H" --payload "{\"action_kind\":\"session:interactive\",\"capability\":\"write\",\"correlation\":\"r\",\"from_level\":\"L2\",\"incident_ref\":\"$U\",\"policy_hash\":\"$H\",\"to_level\":\"L1\"}"
  [ "$status" -ne 0 ] || { echo "a supplied idem was accepted on a policy kind: $output"; false; }
  [[ "$output" == *"--idem is refused"* ]] || { echo "wrong refusal: $output"; false; }
}

@test "a malformed policy payload reports its FIELD error, not a hashing stack trace" {
  # safePolicyIdem returns null rather than throwing, so validateEvent gets to speak first.
  run _emit policy.demoted --payload '{"action_kind":"session:interactive"}'
  [ "$status" -ne 0 ]
  [[ "$output" != *"at policyIdem"* ]] || { echo "a stack trace leaked instead of a field error: $output"; false; }
  [[ "$output" == *"BAD_POLICY"* ]] || { echo "expected a payload rejection: $output"; false; }
}

# THE GATE. Reports every kind in the derived closed vocabulary that has no section, and names
# the lane that owns each one -- because the honest answer to "who fixes the catch-all" used to be
# nobody, which is how it ran 22 kinds deep. Takes the file to inspect as $1 so the mutation test
# below can point it at a deliberately broken copy; a gate nothing has ever attacked is a
# decoration.
_coverage() {
  cd "$ARC_ROOT"
  BRIEF_SRC="$1" node --input-type=module -e "
    const fs = await import('node:fs');
    const v = await import('./.claude/scripts/hq/lib/validate.mjs');
    const e = await import('./.claude/scripts/hq/lib/validate-experiment.mjs');
    const l = await import('./.claude/scripts/hq/lib/validate-leads.mjs');
    const p = await import('./.claude/scripts/hq/lib/validate-policy.mjs');
    const owner = (k) => e.EXPERIMENT_KINDS.includes(k) ? 'evolve'
                       : l.LEADS_KINDS.includes(k)      ? 'leads'
                       : p.POLICY_KINDS.includes(k)     ? 'policy' : 'core';
    const src = fs.readFileSync(process.env.BRIEF_SRC, 'utf8');
    const start = src.indexOf('const GROUPS = [');
    const end = src.indexOf('];', start);
    if (start < 0 || end < 0) throw new Error('no GROUPS table in ' + process.env.BRIEF_SRC);
    // STRIP COMMENTS FIRST. The table is commented heavily and those comments name kinds in
    // prose -- outreach.replied, deal.won, experiment.assigned all appear in sentences
    // explaining why they sit where they do. A raw text search would count a kind mentioned
    // only in a comment as grouped, so removing a kind from the array while leaving the
    // sentence about it would pass. That is the vacuous shape this whole suite exists for.
    const table = src.slice(start, end).split('\n').filter((x) => !x.trim().startsWith('//')).join('\n');
    const missing = v.KINDS.filter((k) => !table.includes(JSON.stringify(k)));
    console.log(missing.length
      ? 'UNGROUPED:' + missing.map((k) => k + '(' + owner(k) + ')').join(',')
      : 'all-' + v.KINDS.length + '-grouped');"
}

@test "every kind in the closed vocabulary is grouped by the brief" {
  # DERIVED from KINDS, never typed (ADR-0107) -- so a kind added by ANY lane fails here on the
  # day it is added rather than disappearing from the brief.
  #
  # This was scoped to POLICY_KINDS when it was written, deliberately: the table was then 22 kinds
  # behind the vocabulary, and asserting the whole of it would have put a red test on four other
  # lanes' desks for a grouping decision that was theirs to make. That reason expired when the
  # owner routed the question to each lane and every kind got a section. The scope widens with it,
  # and widening it is the entire point -- a line in a brief saying "no group assigned" named a
  # file but never named an owner, so nobody ever fixed it. This names an owner and blocks a merge.
  run _coverage "$ARC_ROOT/.claude/scripts/hq/arc-brief.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == all-*-grouped ]] || { echo "$output"; false; }
}

@test "MUTATION -- the coverage gate fails when a kind is dropped from the table" {
  # The gate's own negative control. Two mutations, because they fail differently:
  #
  #   1. delete the kind outright        -> must be reported missing
  #   2. delete it but KEEP a comment naming it -> must STILL be reported missing
  #
  # The second is the one that matters. Every kind in that table is discussed in a nearby comment,
  # so a text-matching gate that did not strip comments would pass mutation 2 and this suite would
  # be asserting nothing about the kinds it talks about most.
  local d; d="$BATS_TEST_TMPDIR/gate"
  mkdir -p "$d"

  # 1 -- a clean deletion. `promotion.proposed` is evolve-owned, so the owner label is checked too.
  sed 's/"promotion.proposed", //' "$ARC_ROOT/.claude/scripts/hq/arc-brief.mjs" > "$d/dropped.mjs"
  ! grep -q '"promotion.proposed", ' "$d/dropped.mjs" || {
    echo "mutation 1 did not apply -- this test would measure nothing"; false; }
  run _coverage "$d/dropped.mjs"
  [ "$status" -eq 0 ] || { echo "the gate crashed instead of reporting: $output"; false; }
  [[ "$output" == *"promotion.proposed(evolve)"* ]] || {
    echo "the gate missed a dropped kind, or misnamed its owner: $output"; false; }

  # 2 -- deleted from the array, still named in a comment one line above it.
  sed 's/"meeting.booked"\]\]/]]/; s|// `policy.demoted` sits|// meeting.booked is named here on purpose -- `policy.demoted` sits|' \
    "$ARC_ROOT/.claude/scripts/hq/arc-brief.mjs" > "$d/comment-only.mjs"
  grep -q '// meeting.booked is named here on purpose' "$d/comment-only.mjs" || {
    echo "mutation 2 did not plant the comment -- this test would measure nothing"; false; }
  run _coverage "$d/comment-only.mjs"
  [ "$status" -eq 0 ] || { echo "the gate crashed instead of reporting: $output"; false; }
  [[ "$output" == *"meeting.booked(leads)"* ]] || {
    echo "a kind named only in a COMMENT was counted as grouped: $output"; false; }
}

@test "the brief puts each authority receipt in its own group" {
  _all_four
  run _brief
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"needs-you (1)"*     ]] || { echo "$output"; false; }
  [[ "$output" == *"money (2)"*         ]] || { echo "$output"; false; }
  [[ "$output" == *"progress (1)"*      ]] || { echo "$output"; false; }
  # And nothing fell through to the catch-all.
  [[ "$output" != *"ungrouped"*         ]] || { echo "a known kind landed in ungrouped: $output"; false; }
}

@test "a demotion says WHICH grant was lost, not just that one was" {
  # The incident it cites is already on the needs-you list. What the incident cannot say is the
  # pair and the direction, which is the only part that tells a human what they can no longer do.
  _dropped
  run _brief
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"policy.demoted  session:interactive/write  L2 -> L1"* ]] || { echo "$output"; false; }
}

@test "a promotion receipt carries the same pair and direction under progress" {
  _raised
  run _brief
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"policy.level.changed  session:interactive/write  L1 -> L2"* ]] || { echo "$output"; false; }
}

@test "a reservation renders as money in major.minor from minor units" {
  _reserved
  run _brief
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"spend.reserved  INR 0.40"* ]] || { echo "$output"; false; }
}

@test "a release names WHO decided nothing was charged" {
  # `policy` and `provider_attested_no_charge` are different claims and the second rests on a
  # provider's word -- the money model's one unverifiable delegation. An auditor has to be able
  # to tell them apart without a second query.
  _released
  run _brief
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"spend.released  released_on=provider_attested_no_charge"* ]] || { echo "$output"; false; }
}

@test "MUTATION -- a kind the brief does not know lands in ungrouped, never on the floor" {
  # The catch-all's only proof. Delete one kind from the group table of a COPY and the event must
  # still appear, under a heading that says the brief is behind the vocabulary. Before the
  # catch-all existed this mutation produced a brief with no money section at all -- and no error.
  _reserved >/dev/null
  local d; d="$BATS_TEST_TMPDIR/copy"
  mkdir -p "$d/.claude"
  cp -r "$ARC_ROOT/.claude/scripts" "$d/.claude/"
  # A plain substitution: no address range, no empty regex, portable on BSD and GNU alike.
  sed 's/"spend.reserved", //' "$ARC_ROOT/.claude/scripts/hq/arc-brief.mjs" > "$d/.claude/scripts/hq/arc-brief.mjs"
  # THE MUTATION ASSERTS ITSELF. A sed that quietly matched nothing would leave this test
  # measuring the unmutated file and passing for no reason -- which is the entire lesson of the
  # CI run that produced this suite.
  # `cmd && { fail; }` would ALSO fail the test when cmd exits 1, because bats runs test bodies
  # under set -e and the compound's status is grep's. Negate, then use ||.
  ! grep -q '"spend.reserved"' "$d/.claude/scripts/hq/arc-brief.mjs" || {
    echo "the mutation did not apply -- this test would measure nothing"; false; }

  run node "$d/.claude/scripts/hq/arc-brief.mjs" --date 2026-07-22
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"ungrouped: 1 (spend.reserved 1)"* ]] || { echo "an unknown kind was dropped: $output"; false; }
  [[ "$output" == *"no group assigned in arc-brief.mjs"* ]] || { echo "the heading does not say where to fix it: $output"; false; }
  # The count proves it was seen; only --full proves the EVENT survived rather than a tally of it.
  run node "$d/.claude/scripts/hq/arc-brief.mjs" --date 2026-07-22 --full
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"spend.reserved"* ]] || { echo "the event itself vanished: $output"; false; }
}

# Builds a sandbox tree whose brief does NOT know `develop.started`, and echoes the path to it.
#
# Needed because the catch-all is now unreachable by design: every one of the closed 44 has a
# section and the gate above keeps it that way, so no real kind falls through any more. The
# behaviour still has to be provable, and the honest way to prove it is to manufacture the only
# condition that can produce it -- a table behind its vocabulary, which is exactly the state the
# whole table sat in for months. The whole `scripts` dir is copied, not the one file: arc-brief
# imports siblings by relative path, and a lone copy dies on module resolution. That failure mode
# is not hypothetical -- a first attempt at this crashed, printed nothing, and the line-budget
# assertion PASSED on the crash.
_tree_without_develop_started() {
  local d="$BATS_TEST_TMPDIR/$1"
  mkdir -p "$d/.claude"
  cp -r "$ARC_ROOT/.claude/scripts" "$d/.claude/"
  sed 's/"develop.started", //' "$ARC_ROOT/.claude/scripts/hq/arc-brief.mjs" > "$d/.claude/scripts/hq/arc-brief.mjs"
  # THE MUTATION ASSERTS ITSELF. A sed that matched nothing leaves every test below measuring the
  # real table and passing for no reason.
  ! grep -q '"develop.started"' "$d/.claude/scripts/hq/arc-brief.mjs" || {
    echo "the mutation did not apply -- this test would measure nothing"; return 1; }
  echo "$d/.claude/scripts/hq/arc-brief.mjs"
}

@test "BUDGET -- an ordinary day of catch-all receipts cannot bury the brief" {
  # The regression this collapse exists for, measured before it was written: 50 develop/slice
  # receipts on one day rendered a 53-line brief against the 40-line one-screen budget, 50 of
  # those lines identical and individually empty. The catch-all had been placed in the
  # never-collapse tier beside needs-you and money, whose exemption does not transfer -- every one
  # of THEIR lines needs human eyes, and an ungrouped line is a kind whose lane has not claimed it.
  # 12 receipts is enough to prove the tier: uncollapsed that is 13 lines, collapsed it is 1.
  local brief; brief="$(_tree_without_develop_started budget)" || { echo "$brief"; false; }
  local i
  for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
    _emit develop.started --payload "{\"lane\":\"probe$i\"}" >/dev/null
  done
  # THE FIXTURE ASSERTS ITSELF. Twelve quarantined receipts render an empty brief that satisfies
  # every line-count assertion below for exactly the wrong reason -- and this suite exists because
  # that is not hypothetical here.
  local sealed; sealed=$(grep -c '"kind":"' "$SPINE/events/2026-07-22.jsonl")
  [ "$sealed" -eq 12 ] || { echo "built $sealed sealed receipts, not 12 -- this test would measure nothing"; false; }

  run node "$brief" --date 2026-07-22
  # Exit first, always. A crashing renderer prints nothing, and nothing is under budget.
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"ungrouped: 12 (develop.started 12)"* ]] || { echo "the catch-all did not collapse: $output"; false; }
  local lines; lines=$(printf '%s\n' "$output" | wc -l)
  [ "$lines" -le 5 ] || { echo "12 catch-all receipts rendered $lines lines: $output"; false; }
}

@test "COLLAPSED -- the catch-all still says where to fix it, and that --full exists" {
  # Collapsing is a LAYOUT change, never a compression of the instruction. The sentence naming
  # arc-brief.mjs is the only way another lane learns it owes its kinds a group, and the generic
  # hint in the renderer matches `background` and `progress` by name, so it never reaches this
  # group. A count under a name nobody recognises is a puzzle; both clauses make it an instruction.
  local brief; brief="$(_tree_without_develop_started collapsed)" || { echo "$brief"; false; }
  _emit develop.started --payload '{"lane":"probe"}' >/dev/null
  run node "$brief" --date 2026-07-22
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"no group assigned in arc-brief.mjs"* ]] || { echo "the instruction was lost in the collapse: $output"; false; }
  [[ "$output" == *"--full to expand"* ]] || { echo "the collapsed group does not advertise its detail: $output"; false; }
}

@test "FULL -- --full expands the catch-all back to one line per receipt" {
  # The collapse hides the detail; it must never destroy it. A group that reads identically
  # collapsed and expanded is a group whose --full does nothing.
  local brief; brief="$(_tree_without_develop_started full)" || { echo "$brief"; false; }
  _emit develop.started --payload '{"lane":"a"}' >/dev/null
  _emit develop.started --payload '{"lane":"b"}' >/dev/null
  run node "$brief" --date 2026-07-22 --full
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"ungrouped (2)"* ]] || { echo "--full did not expand the catch-all: $output"; false; }
  local n; n=$(printf '%s\n' "$output" | grep -c '^  develop.started$')
  [ "$n" -eq 2 ] || { echo "expected 2 expanded receipt lines, found $n: $output"; false; }
}

@test "EMPTY -- the catch-all is unreachable on the real table" {
  # The positive control for the gate, from the render side rather than the source side. Every one
  # of the closed 44 has a section, so no real day can produce an ungrouped line -- and a suite
  # whose only catch-all tests run against MUTATED trees would never notice if the real table
  # regressed. Drive the same kinds through the real renderer and the word must not appear.
  _emit develop.started --payload '{"lane":"a"}' >/dev/null
  _emit slice.done --payload '{"lane":"a"}' >/dev/null
  _all_four
  local sealed; sealed=$(grep -c '"kind":"' "$SPINE/events/2026-07-22.jsonl")
  [ "$sealed" -eq 6 ] || { echo "built $sealed sealed receipts, not 6 -- this test would measure nothing"; false; }
  run _brief --full
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # Never bare "output does not contain X" -- a crash satisfies that. Pair it with proof of render.
  [[ "$output" == *"brief 2026-07-22"* ]] || { echo "the renderer produced no brief at all: $output"; false; }
  [[ "$output" != *"ungrouped"* ]] || { echo "a real kind fell through on the shipped table: $output"; false; }
}

@test "CONTROL -- needs-you never collapses, however noisy the day gets" {
  # The tier boundary this change moves the catch-all ACROSS, asserted from the other side. If the
  # always-collapse rule ever widened to needs-you, a day would render `needs-you: 9 (...)` and
  # every approval and incident a human owes a decision to would arrive as a number. Without this
  # control, a collapse rule that swallowed the wrong group would still pass every test above.
  local i
  for i in 1 2 3 4 5 6 7 8 9; do
    _emit incident.raised --payload "{\"what\":\"probe$i\"}" >/dev/null
  done
  local sealed; sealed=$(grep -c '"kind":"' "$SPINE/events/2026-07-22.jsonl")
  [ "$sealed" -eq 9 ] || { echo "built $sealed sealed incidents, not 9 -- this test would measure nothing"; false; }

  run _brief
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"needs-you (9)"* ]] || { echo "needs-you was collapsed: $output"; false; }
  local n; n=$(printf '%s\n' "$output" | grep -c '^  incident.raised$')
  [ "$n" -eq 9 ] || { echo "expected 9 expanded needs-you lines, found $n: $output"; false; }
}

@test "the inbox prints the authority delta and its citation for a promotion" {
  _emit approval.requested --payload "{\"action_kind\":\"session:interactive\",\"capability\":\"write\",\"correlation\":\"r-t\",\"from_level\":\"L1\",\"gate\":\"policy\",\"policy_hash\":\"$H\",\"subject\":\"policy.promotion\",\"to_level\":\"L2\",\"trial_ledger_ref\":\"docs/trial-ledger.md#t9\",\"what\":\"raise session write to execute\"}" >/dev/null
  run node "$INBOX" inbox
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"raise session write to execute"* ]] || { echo "$output"; false; }
  [[ "$output" == *"policy  session:interactive/write  L1 -> L2"* ]] || { echo "no authority delta: $output"; false; }
  [[ "$output" == *"evidence docs/trial-ledger.md#t9"* ]] || { echo "no citation: $output"; false; }
}

@test "an ordinary approval gets no policy line -- the detail is not decoration" {
  # The positive control's opposite. If every approval grew a policy line, the line would carry
  # no information at all.
  _emit approval.requested --payload '{"what":"deploy prod","gate":"ship"}' >/dev/null
  run node "$INBOX" inbox
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"deploy prod"* ]] || { echo "$output"; false; }
  [[ "$output" != *"evidence "* ]] || { echo "a non-promotion grew a policy line: $output"; false; }
}

@test "this file registered every test it declares" {
  [ "${#BATS_TEST_NAMES[@]}" -eq 19 ] || {
    echo "registered ${#BATS_TEST_NAMES[@]} tests, expected 19 -- a @test was silently dropped"
    false
  }
}
