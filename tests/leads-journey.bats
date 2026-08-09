#!/usr/bin/env bats
# leads Phase 03 slice 06 -- THE JOURNEY, walked as ONE SEQUENCE rather than as parts.
#
# Every earlier leads suite exercises a module. This one drives the CLI the operator actually
# types, in order, against a throwaway store and a throwaway spine, because both defects it
# pins are invisible to a module test: they only exist in what one subcommand leaves behind for
# the next one, and in what happens when a human runs the same command twice.
#
# RUNNING A COMMAND TWICE IS THE ORDINARY CASE. It is the answer to "did that finish?", it is
# how a sixth lead joins five, and it is what an interrupted run needs. Both defects below were
# found by doing it once.
#
#   1. `research` re-run was FATAL. lead.researched has a stable idem, so the emitter refused
#      the first duplicate as DUP_IDEM, and that refusal arrives as a thrown error: exit 2, the
#      loop dead, earlier dossiers rewritten and later ones never reached. Worse, the emitter
#      QUARANTINES before it exits and `report` refuses while any quarantine record exists, so
#      one re-run disabled the ADR-0416 mixing report -- the one number this phase exists to
#      produce -- until a human cleared the spine by hand. ingest.mjs had carried the remedy
#      (skip an emit whose idem is on the spine, deterministically) since Phase 02; research
#      was the adjacent branch that never got it.
#
#   2. `draft` re-run queued a SECOND approval for the same lead and touch, silently. The mail
#      is safe -- the guard refuses the second attempt at `already-sent` -- and that is exactly
#      why every existing fixture passed it. What breaks is the L1 RECORD: two inbox items for
#      one send means "which approval authorised this mail?" has no answer (ADR-0407), and a
#      five-lead run reports five sent and five refused into the phase evidence bundle.
#
# ASSERTIONS ARE COUNTS, never the absence of a word. "the output does not say DUP" passes for
# a mutant that reworded the line and passes for a crash; the number of drafts on disk and the
# number of approval.requested lines on the spine do neither. Every probe checks $status FIRST.
#
# Addresses below are RFC-2606 reserved literals, which is what this path is FOR: pii-tripwire
# treats tests/leads-*.bats as a fixture class and requires reserved domains rather than no
# addresses at all. ASCII-only test names; the file asserts its own declared count at the end.
bats_require_minimum_version 1.5.0
load 'test_helper'

# A TWO-lead corpus, built per test rather than borrowed from tests/fixtures/leads. The tracked
# corpus is 34 rows, and research spawns one arc-event process per accepted lead -- 30 process
# creations on the leg whose process creation cost is what the shard budget is made of.
_fixtures() {
  mkdir -p "$BATS_TEST_TMPDIR/fx"
  cat > "$BATS_TEST_TMPDIR/fx/candidates.json" <<'JSON'
[
  { "name": "Lead One", "email": "one@example.test", "firm": "Firm One",
    "firm_domain": "firm-one.example.test", "geography": "IN", "provenance": "firm-site",
    "source_urls": ["https://firm-one.example.test/about", "https://firm-one.example.test/team"],
    "facts": [
      { "text": "argued a limitation-period matter before the Madras High Court",
        "evidence_url": "https://firm-one.example.test/practice",
        "relevance": "the pilot removes the tracking overhead this matter load creates" },
      { "text": "runs a monthly clinic for first-generation litigants",
        "evidence_url": "https://firm-one.example.test/writing",
        "relevance": "someone who documents their process adopts a process tool without persuasion" }
    ] },
  { "name": "Lead Two", "email": "two@example.test", "firm": "Firm Two",
    "firm_domain": "firm-two.example.test", "geography": "IN", "provenance": "public-directory",
    "source_urls": ["https://firm-two.example.test/about", "https://firm-two.example.test/people"],
    "facts": [
      { "text": "published a note on arbitration seat selection in Chennai",
        "evidence_url": "https://firm-two.example.test/notes",
        "relevance": "a firm that writes about its own procedure will read a procedure tool" },
      { "text": "mentors two junior associates through a structured rota",
        "evidence_url": "https://firm-two.example.test/team",
        "relevance": "a rota is a schedule, and the pilot is where schedules already live" }
    ] }
]
JSON
  cat > "$BATS_TEST_TMPDIR/fx/verify.json" <<'JSON'
{ "one@example.test": "verified", "two@example.test": "verified" }
JSON
  cat > "$BATS_TEST_TMPDIR/icp.json" <<'JSON'
{ "campaign": "walk", "geography": "IN", "segment": "solo advocates",
  "practice_area": "commercial litigation", "why_they_buy": "matter tracking breaks down",
  "disqualifiers": ["in-house teams"] }
JSON
  # A FIXTURE BUILDER ASSERTS ITS OWN FIXTURE. A heredoc that never reached its file produces an
  # empty corpus, and an empty corpus makes every count below trivially correct -- the silent
  # pass generator .claude/rules/testing.md names.
  [ -s "$BATS_TEST_TMPDIR/fx/candidates.json" ] || { echo "candidates fixture is EMPTY"; false; }
  [ -s "$BATS_TEST_TMPDIR/fx/verify.json" ]     || { echo "verify fixture is EMPTY"; false; }
  [ -s "$BATS_TEST_TMPDIR/icp.json" ]           || { echo "icp fixture is EMPTY"; false; }
}

# The drafts file needs the lead ids research minted, and those are keyed HMACs no fixture can
# spell in advance. Written to a FILE and executed rather than passed with -e: an embedded
# program that wants an apostrophe belongs in its own file (CLAUDE.md).
_mkdrafts() {
  cat > "$BATS_TEST_TMPDIR/mkdrafts.mjs" <<'MJS'
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const dir = join(process.env.ARC_LEADS_STORE, "dossiers");
const repeat = process.argv[2] === "repeat";
const bodies = [
  "I read your practice page and wanted to write directly rather than call.\n\nYou FACT0, and you FACT1.\n\nWe build a matter tracker for firms that outgrew a spreadsheet.\n\nWorth fifteen minutes?",
  "A colleague pointed me at your firm page, so this is not a list mail.\n\nYou FACT0, and you FACT1.\n\nOur pilot keeps concurrent matters visible without a full practice suite.\n\nSay no and I will not write again.",
];
const out = [];
readdirSync(dir).filter((f) => f.endsWith(".json")).sort().forEach((f, i) => {
  const d = JSON.parse(readFileSync(join(dir, f), "utf8"));
  const facts = (d.citable_facts || d.facts || []).slice(0, 2);
  const body = bodies[i % bodies.length].replace("FACT0", facts[0].text).replace("FACT1", facts[1].text);
  const rec = { lead_id: d.lead_id, touch_n: 1, body,
    cites: facts.map((x) => ({ fact: x.text, source: x.evidence_url, relevance: x.relevance })) };
  out.push(rec);
  if (repeat && i === 0) out.push(JSON.parse(JSON.stringify(rec)));
});
writeFileSync(process.env.DRAFTS_OUT, JSON.stringify(out, null, 2) + "\n");
console.log("drafts written: " + out.length);
MJS
  [ -s "$BATS_TEST_TMPDIR/mkdrafts.mjs" ] || { echo "mkdrafts helper is EMPTY"; false; }
  DRAFTS_OUT="$BATS_TEST_TMPDIR/drafts.json" run node "$BATS_TEST_TMPDIR/mkdrafts.mjs" "${1:-once}"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ -s "$BATS_TEST_TMPDIR/drafts.json" ] || { echo "drafts.json is EMPTY"; false; }
}

_cli() { node "$ARC_ROOT/.claude/scripts/leads/arc-leads.mjs" "$@"; }

# Counts read off the spine and the store -- the two places the journey actually leaves marks.
#
# `grep -c` PRINTS 0 and EXITS 1 when nothing matches, so the obvious `grep -c ... || echo 0`
# emits TWO lines on an empty set and every `[ "$(...)" -eq 0 ]` downstream dies with "integer
# expected" instead of comparing. Caught by the zero case, which is the case three of these
# assertions are entirely about. The count is captured and the exit status discarded, in that
# order. `cat` first, so a multi-file glob yields one total rather than one line per file.
_spine_count() {
  local n
  n=$(cat "$ARC_SPINE_ROOT/events/"*.jsonl 2>/dev/null | grep -c "\"$1\"") || true
  echo "${n:-0}"
}
_drafts_count() {
  local n
  n=$(ls "$ARC_LEADS_STORE/drafts" 2>/dev/null | grep -c '\.json$') || true
  echo "${n:-0}"
}
_quarantine_count() {
  local n
  n=$(cat "$ARC_SPINE_ROOT/events/_quarantine/"*.jsonl 2>/dev/null | grep -c .) || true
  echo "${n:-0}"
}

setup() {
  export ARC_LEADS_FAKE=1
  export ARC_LEADS_STORE="$BATS_TEST_TMPDIR/store"
  export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine"
  export LEADS_FIXTURE_DIR="$BATS_TEST_TMPDIR/fx"
  export ARC_LEADS_NOW="2026-08-04T10:00:00+05:30"
  cd "$ARC_ROOT" || return 1
  _fixtures
  run _cli store init
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run _cli campaign init walk
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

# The POSITIVE CONTROL for every re-run test below. Without it "0 new" on a second run is
# satisfied by a first run that emitted nothing either, and the whole file measures nothing.
@test "research emits one receipt per accepted lead on a fresh spine" {
  run _cli research "$BATS_TEST_TMPDIR/icp.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"receipts: 2 new · 0 already on the spine"* ]] || { echo "$output"; false; }
  [ "$(_spine_count lead.researched)" -eq 2 ] || { echo "spine holds $(_spine_count lead.researched) receipt(s), expected 2"; false; }
}

@test "research run a second time exits 0 and emits nothing" {
  run _cli research "$BATS_TEST_TMPDIR/icp.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run _cli research "$BATS_TEST_TMPDIR/icp.json"
  # Exit 0 is half the claim. Before the fix this was exit 2 with a raw DUP_IDEM from arc-event.
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"receipts: 0 new · 2 already on the spine"* ]] || { echo "$output"; false; }
  # And the spine did not grow: the skip is a skip, not a second write the emitter deduplicated.
  [ "$(_spine_count lead.researched)" -eq 2 ] || { echo "spine holds $(_spine_count lead.researched) receipt(s), expected 2"; false; }
}

# The second-order half, and the one that actually cost something: the emitter quarantines a
# refused receipt BEFORE it exits, so the crash left a permanent record behind even after the
# operator shrugged and moved on.
@test "research run a second time leaves no quarantine record" {
  run _cli research "$BATS_TEST_TMPDIR/icp.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run _cli research "$BATS_TEST_TMPDIR/icp.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$(_quarantine_count)" -eq 0 ] || { echo "quarantine holds $(_quarantine_count) record(s), expected 0"; false; }
}

# What the quarantine record actually broke. `report` refuses outright while any record exists,
# so the ADR-0416 mixing count -- the claim that makes rehearsal sends legal -- went dark
# because someone ran research twice.
@test "the mixing report still answers after research has been re-run" {
  run _cli research "$BATS_TEST_TMPDIR/icp.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run _cli research "$BATS_TEST_TMPDIR/icp.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run _cli report
  [ "$status" -eq 0 ] || { echo "report refused after a research re-run: $output"; false; }
  [[ "$output" == *"real       0"* ]] || { echo "$output"; false; }
}

# The POSITIVE CONTROL for the duplicate-approval tests.
@test "draft queues exactly one approval per lead on the first run" {
  run _cli research "$BATS_TEST_TMPDIR/icp.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  _mkdrafts
  run _cli draft walk "$BATS_TEST_TMPDIR/drafts.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"2 queued for approval"* ]] || { echo "$output"; false; }
  [ "$(_drafts_count)" -eq 2 ] || { echo "$(_drafts_count) draft file(s), expected 2"; false; }
  [ "$(_spine_count approval.requested)" -eq 2 ] || { echo "$(_spine_count approval.requested) approval(s), expected 2"; false; }
}

@test "draft run a second time queues no second approval for the same touch" {
  run _cli research "$BATS_TEST_TMPDIR/icp.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  _mkdrafts
  run _cli draft walk "$BATS_TEST_TMPDIR/drafts.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run _cli draft walk "$BATS_TEST_TMPDIR/drafts.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"2 duplicate touch(es) refused"* ]] || { echo "$output"; false; }
  # The counts are the claim. Before the fix these were 4 and 4.
  [ "$(_drafts_count)" -eq 2 ] || { echo "$(_drafts_count) draft file(s), expected 2"; false; }
  [ "$(_spine_count approval.requested)" -eq 2 ] || { echo "$(_spine_count approval.requested) approval(s), expected 2"; false; }
}

# A refusal that does not say WHICH draft already holds the touch sends the operator looking
# through a directory of opaque refs. The existing ref is the actionable half.
@test "the duplicate refusal names the draft that already holds that touch" {
  run _cli research "$BATS_TEST_TMPDIR/icp.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  _mkdrafts
  run _cli draft walk "$BATS_TEST_TMPDIR/drafts.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local existing
  existing=$(ls "$ARC_LEADS_STORE/drafts" | head -1 | sed 's/\.json$//')
  [ -n "$existing" ] || { echo "no draft was written, so the refusal has nothing to name"; false; }
  run _cli draft walk "$BATS_TEST_TMPDIR/drafts.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"$existing"* ]] || { echo "refusal never named $existing: $output"; false; }
}

# The within-batch half. A check against on-disk state alone passes a first run that carries the
# same lead and touch twice inside ONE file, which is what a hand-edited drafts file looks like.
@test "two entries for one lead and touch inside one file: the second is refused" {
  run _cli research "$BATS_TEST_TMPDIR/icp.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  _mkdrafts repeat
  run _cli draft walk "$BATS_TEST_TMPDIR/drafts.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"1 duplicate touch(es) refused"* ]] || { echo "$output"; false; }
  [ "$(_drafts_count)" -eq 2 ] || { echo "$(_drafts_count) draft file(s), expected 2"; false; }
  [ "$(_spine_count approval.requested)" -eq 2 ] || { echo "$(_spine_count approval.requested) approval(s), expected 2"; false; }
}

@test "this file registers the 9 tests it declares" {
  declared=$(grep -c '^@test ' "$BATS_TEST_FILENAME")
  registered=${#BATS_TEST_NAMES[@]}
  [ "$declared" -eq 9 ] || { echo "declared $declared, expected 9"; false; }
  [ "$registered" -eq "$declared" ] || { echo "bats registered $registered of $declared -- one was DROPPED"; false; }
}
