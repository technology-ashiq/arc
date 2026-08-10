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
// `repeat` reads its OWN argv slot. Both it and `mode` were reading argv[2], so the comment
// claiming they compose was false in the code directly under it: passing "repeat" made the mode
// "repeat", and passing any mode turned repeat off. Two settings sharing one slot is exactly
// the "one fact derived two ways" shape this suite exists to catch.
const repeat = process.argv.slice(3).includes("repeat");
const bodies = [
  "I read your practice page and wanted to write directly rather than call.\n\nYou FACT0, and you FACT1.\n\nWe build a matter tracker for firms that outgrew a spreadsheet.\n\nWorth fifteen minutes?",
  "A colleague pointed me at your firm page, so this is not a list mail.\n\nYou FACT0, and you FACT1.\n\nOur pilot keeps concurrent matters visible without a full practice suite.\n\nSay no and I will not write again.",
];
const mode = process.argv[2] || "once";
const out = [];
readdirSync(dir).filter((f) => f.endsWith(".json")).sort().forEach((f, i) => {
  const d = JSON.parse(readFileSync(join(dir, f), "utf8"));
  const facts = (d.citable_facts || d.facts || []).slice(0, 2);
  let body = bodies[i % bodies.length].replace("FACT0", facts[0].text).replace("FACT1", facts[1].text);
  // "rebody" keeps the lead and the touch and changes the TEXT. It is the positive control that
  // kills the surviving mutant which adds the body to both dedup keys: with the body in the key
  // this run queues a second approval for one touch, which is the state the rule forbids.
  if (mode === "rebody") body = body.replace("Worth fifteen minutes?", "Worth twenty minutes?").replace("Say no and I will not write again.", "Say no and that is the end of it.");
  // "touch2" keeps the lead and the body and moves to the NEXT touch. It is the positive control
  // that kills the mutant which drops touch_n from both keys: without touch_n in the key, a
  // legitimate follow-up is refused as a duplicate forever, and every absence-of-new-work
  // assertion in this file stays green while the product silently stops working.
  const touch = mode === "touch2" ? 2 : 1;
  // "touchstr" spells the SAME touch as a string with padding. `1`, `"1"` and `" 1"` are one
  // touch to the idem formula and were three different keys to the dedup map.
  const rec = { lead_id: d.lead_id, touch_n: mode === "touchstr" ? " 1" : touch, body,
    cites: facts.map((x) => ({ fact: x.text, source: x.evidence_url, relevance: x.relevance })) };
  out.push(rec);
  if (repeat && i === 0) out.push(JSON.parse(JSON.stringify(rec)));
});
writeFileSync(process.env.DRAFTS_OUT, JSON.stringify(out, null, 2) + "\n");
console.log("drafts written: " + out.length);
MJS
  [ -s "$BATS_TEST_TMPDIR/mkdrafts.mjs" ] || { echo "mkdrafts helper is EMPTY"; false; }
  DRAFTS_OUT="$BATS_TEST_TMPDIR/drafts.json" run node "$BATS_TEST_TMPDIR/mkdrafts.mjs" "${1:-once}" "${2:-}"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ -s "$BATS_TEST_TMPDIR/drafts.json" ] || { echo "drafts.json is EMPTY"; false; }
}

_cli() { node "$ARC_ROOT/.claude/scripts/leads/arc-leads.mjs" "$@"; }

# Records a `reject` decision against EVERY `approval.requested` on the spine, through the real
# emitter, so the events the CLI folds are the events the emitter actually writes rather than a
# hand-built shape a fold might disagree with.
_decide_all_approvals() {
  cat > "$BATS_TEST_TMPDIR/reject.mjs" <<'MJS'
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { join } from "node:path";
const root = process.env.ARC_SPINE_ROOT;
const dir = join(root, "events");
const ids = [];
for (const f of readdirSync(dir).filter((n) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(n)))
  for (const line of readFileSync(join(dir, f), "utf8").split("\n")) {
    if (!line.trim()) continue;
    const ev = JSON.parse(line);
    if (ev.kind === "approval.requested") ids.push(ev.id);
  }
// The repo root arrives as an ARGUMENT, not through the environment: `test_helper.bash` sets
// ARC_ROOT without exporting it, so `process.env.ARC_ROOT` is undefined in every child process.
const sh = join(process.argv[2], ".claude/scripts/hq/arc-event.sh");
for (const id of ids) {
  const pf = join(process.env.BATS_TEST_TMPDIR, "decision-" + id + ".json");
  writeFileSync(pf, JSON.stringify({ decides: id, verdict: process.argv[3] || "reject", reason: "a decision was taken" }));
  // `--idem` IS REQUIRED for this kind and only this kind. `validate.mjs` binds a decision idem
  // to sha256("decision.recorded|" + decides) -- that binding is what makes one approval
  // decidable exactly once -- while arc-event derives a non-leads idem from a millisecond. So
  // the derived value never matches and the emit is refused BAD_DECISION. The first version of
  // this helper omitted it, `execFileSync` threw, and the two tests that depend on it were red
  // without ever reaching their own assertions. tests/policy-demotion.bats does it correctly.
  const idem = createHash("sha256").update("decision.recorded|" + id, "utf8").digest("hex");
  execFileSync("bash", [sh, "emit", "decision.recorded", "--payload-file", pf, "--actor", "test", "--strict", "--idem", idem], { encoding: "utf8" });
}
console.log("decided: " + ids.length);
MJS
  [ -s "$BATS_TEST_TMPDIR/reject.mjs" ] || { echo "reject helper is EMPTY"; false; }
  run node "$BATS_TEST_TMPDIR/reject.mjs" "$ARC_ROOT" "${1:-reject}"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # SELF-ASSERTING FIXTURE. "decided: 0" would make every assertion downstream trivially true.
  [[ "$output" == *"decided: ${2:-2}"* ]] || { echo "expected to decide ${2:-2} approvals, got: $output"; false; }
}
_reject_all_approvals() { _decide_all_approvals reject "$@"; }

# Puts the store into the state an INTERRUPTED `draft` leaves behind: the draft files exist and
# no approval receipt was ever written. Both halves are removed -- the day-file lines AND the
# idem index entries -- because that is what "the emit never happened" actually means, and
# removing only the day file would instead simulate the different failure where the index
# outlives its events (which `research` reports as an anomaly and this is not).
#
# In its own FILE, executed by path: an embedded program that wants an apostrophe belongs in a
# file (CLAUDE.md), and this one wants several.
_unannounce() {
  cat > "$BATS_TEST_TMPDIR/unannounce.mjs" <<'MJS'
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const root = process.env.ARC_SPINE_ROOT;
const evDir = join(root, "events");
const dropped = new Set();
let removed = 0;
for (const f of readdirSync(evDir).filter((n) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(n))) {
  const p = join(evDir, f);
  const keep = [];
  for (const line of readFileSync(p, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const ev = JSON.parse(line);
    if (ev.kind === "approval.requested") { dropped.add(ev.idem); removed++; continue; }
    keep.push(line);
  }
  writeFileSync(p, keep.length ? keep.join("\n") + "\n" : "");
}
const idx = join(root, "derived", "idem.index");
if (existsSync(idx)) {
  const keep = readFileSync(idx, "utf8").split("\n").filter((l) => l && !dropped.has(l.slice(0, l.indexOf("\t"))));
  writeFileSync(idx, keep.length ? keep.join("\n") + "\n" : "");
}
console.log("unannounced: " + removed);
MJS
  [ -s "$BATS_TEST_TMPDIR/unannounce.mjs" ] || { echo "unannounce helper is EMPTY"; false; }
  run node "$BATS_TEST_TMPDIR/unannounce.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # THE FIXTURE ASSERTS ITSELF. "unannounced: 0" would make every assertion below trivially true
  # against a store nothing had happened to.
  [[ "$output" == *"unannounced: 2"* ]] || { echo "expected to strip 2 approvals, got: $output"; false; }
}

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
# ASSERTS ITS OWN PATH BEFORE IT REPORTS A ZERO. Every use of this helper compares it to 0, and
# `cat` on a wrong path fails to /dev/null while `grep -c` prints 0 and `|| true` eats the
# status — so a typo in the directory name made three tests pass by reading nothing. That is an
# absence wearing a count, which is the thing this file's header refuses. The events directory
# must exist (it does the moment anything takes the write lock); the quarantine directory
# legitimately may not, and only THAT absence is allowed to mean zero.
_quarantine_count() {
  [ -d "$ARC_SPINE_ROOT/events" ] || { echo "SPINE-ROOT-WRONG: $ARC_SPINE_ROOT/events does not exist, so a quarantine count of 0 would mean nothing" >&2; return 1; }
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
  # THE ASSERTION IS THE PAIRING, not the presence of a ref. The first version captured one
  # arbitrary draft ref and asked whether it appeared ANYWHERE in the output -- but a full
  # re-run prints every ref, so any of them satisfied it. A mutant making each DUP line name a
  # DIFFERENT lead's draft passed 9 times out of 9, and the runbook then tells the operator to
  # "edit that draft", i.e. to edit another person's mail. The control that proves this test is
  # live is the old one it replaces: naming NO draft at all was already caught.
  run _cli research "$BATS_TEST_TMPDIR/icp.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  _mkdrafts
  run _cli draft walk "$BATS_TEST_TMPDIR/drafts.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$(_drafts_count)" -eq 2 ] || { echo "setup wrote $(_drafts_count) draft(s), expected 2"; false; }

  run _cli draft walk "$BATS_TEST_TMPDIR/drafts.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local out="$output"

  # Each stored draft knows its own lead and its own ref. Every DUP line must join THAT pair.
  local checked=0 f lead ref
  for f in "$ARC_LEADS_STORE/drafts/"*.json; do
    lead=$(node -e 'const d=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));process.stdout.write(d.lead_id)' "$f")
    ref=$(node -e 'const d=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));process.stdout.write(d.draft_ref)' "$f")
    [ -n "$lead" ] || { echo "could not read a lead_id out of $f"; false; }
    [ -n "$ref" ] || { echo "could not read a draft_ref out of $f"; false; }
    # ONE line must carry both. Two separate "output contains" checks would pass on the mutant.
    echo "$out" | grep -F "$lead" | grep -qF "$ref" \
      || { echo "the DUP line for $lead does not name its own draft $ref"; echo "$out"; false; }
    # AND ONLY its own. Co-location alone is satisfied by a mutant that prints every ref on
    # every DUP line, which is the same "some known ref appeared" weakness one step up.
    local others
    others=$(echo "$out" | grep -F "$lead" | grep -oE 'draft_[0-9a-f]{16}' | grep -vF "$ref" | sort -u)
    [ -z "$others" ] || { echo "the DUP line for $lead also names $others"; echo "$out"; false; }
    checked=$((checked + 1))
  done
  # A loop over an empty glob checks nothing and passes, which is the vacuous pass this file
  # opens by refusing.
  [ "$checked" -eq 2 ] || { echo "checked $checked pairing(s), expected 2"; false; }
}

# The within-batch half. A check against on-disk state alone passes a first run that carries the
# same lead and touch twice inside ONE file, which is what a hand-edited drafts file looks like.
@test "two entries for one lead and touch inside one file: the second is refused" {
  run _cli research "$BATS_TEST_TMPDIR/icp.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  _mkdrafts once repeat
  # The fixture must actually hold three rows, or "1 duplicate refused" is measuring nothing.
  run node -e 'process.stdout.write(String(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).length))' "$BATS_TEST_TMPDIR/drafts.json"
  [ "$output" = "3" ] || { echo "the repeat fixture holds $output row(s), expected 3"; false; }
  run _cli draft walk "$BATS_TEST_TMPDIR/drafts.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"1 duplicate touch(es) refused"* ]] || { echo "$output"; false; }
  [ "$(_drafts_count)" -eq 2 ] || { echo "$(_drafts_count) draft file(s), expected 2"; false; }
  [ "$(_spine_count approval.requested)" -eq 2 ] || { echo "$(_spine_count approval.requested) approval(s), expected 2"; false; }
}

# --- the slice 06 fixes: what PR #145 got wrong, each with the control that proves it ---

@test "a corpus holding one lead twice emits once and leaves no quarantine record" {
  # C1 case (a), and it needs no re-run at all: the skip set was read once before the loop and
  # never grown, so the second row for one lead passed the check and the emitter refused it --
  # leaving a quarantine record, which is what makes `report` refuse.
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
  { "name": "Lead One", "email": "ONE@example.test", "firm": "Firm One",
    "firm_domain": "firm-one.example.test", "geography": "IN", "provenance": "firm-site",
    "source_urls": ["https://firm-one.example.test/about", "https://firm-one.example.test/team"],
    "facts": [
      { "text": "argued a limitation-period matter before the Madras High Court",
        "evidence_url": "https://firm-one.example.test/practice",
        "relevance": "the pilot removes the tracking overhead this matter load creates" },
      { "text": "runs a monthly clinic for first-generation litigants",
        "evidence_url": "https://firm-one.example.test/writing",
        "relevance": "someone who documents their process adopts a process tool without persuasion" }
    ] }
]
JSON
  cat > "$BATS_TEST_TMPDIR/fx/verify.json" <<'JSON'
{ "one@example.test": "verified", "ONE@example.test": "verified" }
JSON
  [ -s "$BATS_TEST_TMPDIR/fx/candidates.json" ] || { echo "corpus fixture is EMPTY"; false; }
  run _cli research "$BATS_TEST_TMPDIR/icp.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # One receipt, one skip -- the case variant is the same person to normalizeEmail, so it is the
  # same lead id and the same idem.
  [[ "$output" == *"receipts: 1 new · 1 already on the spine"* ]] || { echo "$output"; false; }
  [ "$(_spine_count lead.researched)" -eq 1 ] || { echo "spine holds $(_spine_count lead.researched), expected 1"; false; }
  [ "$(_quarantine_count)" -eq 0 ] || { echo "$(_quarantine_count) quarantine record(s) -- report will refuse"; false; }
  # The consequence, asserted rather than inferred: the number this phase exists to produce.
  run _cli report --json
  [ "$status" -eq 0 ] || { echo "report refused after a duplicate corpus row: $output"; false; }
}

@test "draft resumes a draft that was written but never announced" {
  # C2. writeDraft (disk) runs before emit (spine) with no rollback, so an interruption in that
  # window left a draft nobody had been shown -- and the next run called it a duplicate and said
  # "edit that draft", forever, at exit 0.
  run _cli research "$BATS_TEST_TMPDIR/icp.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  _mkdrafts
  run _cli draft walk "$BATS_TEST_TMPDIR/drafts.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$(_spine_count approval.requested)" -eq 2 ] || { echo "setup did not queue 2"; false; }
  _unannounce
  [ "$(_spine_count approval.requested)" -eq 0 ] || { echo "the fixture did not strip the approvals"; false; }
  [ "$(_drafts_count)" -eq 2 ] || { echo "the fixture removed the drafts too, which is not the state under test"; false; }

  run _cli draft walk "$BATS_TEST_TMPDIR/drafts.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"2 resumed from an interrupted run"* ]] || { echo "$output"; false; }
  [[ "$output" == *"0 duplicate touch(es) refused"* ]] || { echo "the orphan was still read as a duplicate: $output"; false; }
  # The counts are the claim: the approvals came back and NO second draft was minted.
  [ "$(_spine_count approval.requested)" -eq 2 ] || { echo "$(_spine_count approval.requested) approval(s), expected 2"; false; }
  [ "$(_drafts_count)" -eq 2 ] || { echo "$(_drafts_count) draft file(s), expected 2 -- a second was minted"; false; }
}

@test "a legitimate second touch to the same lead is queued, not refused" {
  # POSITIVE CONTROL, and the one that kills the surviving mutant. Dropping touch_n from both
  # dedup keys survived every existing test 9 times out of 9, because every one of them asserts
  # that no NEW work appeared. Under that mutant this test fails: the follow-up is refused.
  run _cli research "$BATS_TEST_TMPDIR/icp.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  _mkdrafts
  run _cli draft walk "$BATS_TEST_TMPDIR/drafts.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  _mkdrafts touch2
  run _cli draft walk "$BATS_TEST_TMPDIR/drafts.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"2 queued for approval"* ]] || { echo "the second touch was not queued: $output"; false; }
  [ "$(_spine_count approval.requested)" -eq 4 ] || { echo "$(_spine_count approval.requested) approval(s), expected 4"; false; }
  [ "$(_drafts_count)" -eq 4 ] || { echo "$(_drafts_count) draft file(s), expected 4"; false; }
}

@test "the same touch with an edited body is still one approval" {
  # The other surviving mutant: adding the body to both keys survived 9/9. Under it this run
  # queues a second approval for one touch, which is the two-live-approvals state ADR-0407
  # exists to forbid -- and no absence-of-new-work assertion can see it.
  run _cli research "$BATS_TEST_TMPDIR/icp.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  _mkdrafts
  run _cli draft walk "$BATS_TEST_TMPDIR/drafts.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  _mkdrafts rebody
  run _cli draft walk "$BATS_TEST_TMPDIR/drafts.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"2 duplicate touch(es) refused"* ]] || { echo "an edited body queued a second approval: $output"; false; }
  [ "$(_spine_count approval.requested)" -eq 2 ] || { echo "$(_spine_count approval.requested) approval(s), expected 2"; false; }
  [ "$(_drafts_count)" -eq 2 ] || { echo "$(_drafts_count) draft file(s), expected 2"; false; }
}

@test "a padded string touch_n is the same touch as the number" {
  # ` 1`, `1.0`, `+1`, `1e0` and `01` each got their own dedup key, so one touch could hold five
  # live approvals -- from the rule whose entire purpose is that it holds exactly one. The
  # normaliser existed one file away in guard.mjs and had simply never been called from here.
  run _cli research "$BATS_TEST_TMPDIR/icp.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  _mkdrafts
  run _cli draft walk "$BATS_TEST_TMPDIR/drafts.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  _mkdrafts touchstr
  run _cli draft walk "$BATS_TEST_TMPDIR/drafts.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"2 duplicate touch(es) refused"* ]] || { echo "a padded touch_n minted a second approval: $output"; false; }
  [ "$(_spine_count approval.requested)" -eq 2 ] || { echo "$(_spine_count approval.requested) approval(s), expected 2"; false; }
}

@test "draft refuses a campaign name that is not the pinned grammar" {
  # `Walk` opened the `walk` directory on a case-insensitive filesystem and wrote into it under
  # a name the spine treats as a different campaign -- two approvals for one touch, from one
  # keystroke. `research` validated the name it read; `draft` validated nothing.
  run _cli research "$BATS_TEST_TMPDIR/icp.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  _mkdrafts
  run _cli draft Walk "$BATS_TEST_TMPDIR/drafts.json"
  [ "$status" -eq 2 ] || { echo "expected exit 2, got $status: $output"; false; }
  [[ "$output" == *"[a-z0-9-]{1,64}"* ]] || { echo "$output"; false; }
  [ "$(_drafts_count)" -eq 0 ] || { echo "$(_drafts_count) draft(s) were written under a refused campaign name"; false; }
  # POSITIVE CONTROL: the same file under the correct name still works, so the refusal above is
  # about the NAME and not about the drafts being unusable.
  run _cli draft walk "$BATS_TEST_TMPDIR/drafts.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"2 queued for approval"* ]] || { echo "$output"; false; }
}

# --- what the FIRST round of fixes shipped with no coverage at all ---

@test "research exits 2 and names the anomaly when one corpus holds two disagreeing rows" {
  # The headline safety behaviour of that commit -- exit non-zero when a receipt did not reach the
  # spine cleanly -- had ZERO tests. A mutant deleting all four anomaly loops and the die() was
  # green on every one of them. Two rows for one firm that disagree on `provenance` is ordinary
  # scraper output (found via its own site AND a directory).
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
  { "name": "Lead One", "email": "one@example.test", "firm": "Firm One",
    "firm_domain": "firm-one.example.test", "geography": "IN", "provenance": "public-directory",
    "source_urls": ["https://firm-one.example.test/about", "https://firm-one.example.test/team"],
    "facts": [
      { "text": "argued a limitation-period matter before the Madras High Court",
        "evidence_url": "https://firm-one.example.test/practice",
        "relevance": "the pilot removes the tracking overhead this matter load creates" },
      { "text": "runs a monthly clinic for first-generation litigants",
        "evidence_url": "https://firm-one.example.test/writing",
        "relevance": "someone who documents their process adopts a process tool without persuasion" }
    ] }
]
JSON
  cat > "$BATS_TEST_TMPDIR/fx/verify.json" <<'JSON'
{ "one@example.test": "verified" }
JSON
  [ -s "$BATS_TEST_TMPDIR/fx/candidates.json" ] || { echo "corpus fixture is EMPTY"; false; }
  run _cli research "$BATS_TEST_TMPDIR/icp.json"
  [ "$status" -eq 2 ] || { echo "expected exit 2, got $status: $output"; false; }
  [[ "$output" == *"ANOMALY"* ]] || { echo "$output"; false; }
  [[ "$output" == *"provenance"* ]] || { echo "the anomaly did not name the differing field: $output"; false; }
  # THE REMEDY IT NAMES IS THE PAIR OF ASSERTIONS, not one substring. The collision here is with
  # a row THIS run emitted, so the spine was never wrong and the file on disk is: the anomaly
  # must point at the corpus and must NOT send the operator to write a correction receipt, which
  # is the other branch and the wrong action. Asserted as a pair because either alone is weak --
  # the positive is satisfied by any message mentioning the corpus, and the negative alone is
  # satisfied by a crash. (The first version of this test asserted a lowercase substring that the
  # message never contained in any branch, and the branch it was written for did not exist.)
  [[ "$output" == *"corpus"* ]] || { echo "the anomaly did not point at the corpus: $output"; false; }
  [[ "$output" != *"correction receipt"* ]] || { echo "the anomaly sent the operator to fix the spine for a defect in their input file: $output"; false; }
  # And the counts are over PEOPLE. Two rows, one person, one dossier.
  [[ "$output" == *"dossiers: 1 "* ]] || { echo "the dossier count is over rows, not people: $output"; false; }
}

@test "a rejected approval can be revised, and the same body cannot" {
  # `approvalState` treats undecided as live and only a trailing reject as retired -- and no
  # test in this repository ran `draft` with a decision.recorded on the spine, so a mutant
  # reading `if (requests.length) return "live"` survived the entire suite. Before the fix a
  # rejection was terminal and the only escape was a different touch_n, i.e. two live approvals
  # for one send.
  run _cli research "$BATS_TEST_TMPDIR/icp.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  _mkdrafts
  run _cli draft walk "$BATS_TEST_TMPDIR/drafts.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  _reject_all_approvals
  # Same body: refused, and it says why.
  run _cli draft walk "$BATS_TEST_TMPDIR/drafts.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"was REJECTED as draft"* ]] || { echo "$output"; false; }
  [ "$(_spine_count approval.requested)" -eq 2 ] || { echo "an identical body was re-announced"; false; }
  # Revised body: announced as a new approval. This is the half that was impossible before.
  _mkdrafts rebody
  run _cli draft walk "$BATS_TEST_TMPDIR/drafts.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"2 queued for approval"* ]] || { echo "a revision after a rejection was refused: $output"; false; }
  [ "$(_spine_count approval.requested)" -eq 4 ] || { echo "$(_spine_count approval.requested) approval(s), expected 4"; false; }
}

@test "an orphan draft whose body has changed is left alone, not announced" {
  # The STALE branch stops an approval binding text the operator has since edited -- and nothing
  # exercised it, so deleting it was free. The approval binds draft_sha precisely so this cannot
  # happen quietly; the check is what makes that guarantee hold at the resume door too.
  run _cli research "$BATS_TEST_TMPDIR/icp.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  _mkdrafts
  run _cli draft walk "$BATS_TEST_TMPDIR/drafts.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  _unannounce
  _mkdrafts rebody
  run _cli draft walk "$BATS_TEST_TMPDIR/drafts.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"2 stale draft(s) left alone"* ]] || { echo "$output"; false; }
  [ "$(_spine_count approval.requested)" -eq 0 ] || { echo "a stale body was announced anyway"; false; }
  [ "$(_drafts_count)" -eq 2 ] || { echo "$(_drafts_count) draft file(s) -- a second was minted for a stale touch"; false; }
  # POSITIVE CONTROL: the UNCHANGED body still resumes, so the STALE branch is discriminating
  # rather than a blanket refusal.
  _mkdrafts
  run _cli draft walk "$BATS_TEST_TMPDIR/drafts.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"2 resumed from an interrupted run"* ]] || { echo "$output"; false; }
}

@test "a resumed approval carries the sha of the draft it names" {
  # A mutant emitting the resume approval with any other draft_sha kept every count correct:
  # nothing read the approval payload back. The sha is what the send-moment guard compares
  # against, so an approval carrying the wrong one authorises a body nobody approved.
  run _cli research "$BATS_TEST_TMPDIR/icp.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  _mkdrafts
  run _cli draft walk "$BATS_TEST_TMPDIR/drafts.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  _unannounce
  run _cli draft walk "$BATS_TEST_TMPDIR/drafts.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"2 resumed"* ]] || { echo "$output"; false; }

  local checked=0 f ref sha found
  for f in "$ARC_LEADS_STORE/drafts/"*.json; do
    ref=$(node -e 'const d=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));process.stdout.write(d.draft_ref)' "$f")
    sha=$(node -e 'const d=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));process.stdout.write(d.draft_sha)' "$f")
    [ -n "$ref" ] && [ -n "$sha" ] || { echo "could not read ref/sha out of $f"; false; }
    found=$(cat "$ARC_SPINE_ROOT/events/"*.jsonl | grep -F "$ref" | grep -cF "$sha") || true
    [ "${found:-0}" -ge 1 ] || { echo "the approval naming $ref does not carry its sha $sha"; false; }
    checked=$((checked + 1))
  done
  [ "$checked" -eq 2 ] || { echo "checked $checked draft(s), expected 2"; false; }
}

@test "a live approval naming a draft this store does not hold refuses the run" {
  # The mirror of the resume case, and it had no test at all: an approval on the spine whose
  # draft file is gone was invisible to a seed built from the disk half, so the same input
  # queued a SECOND live approval for that touch. Deleting the refusal, or flipping its
  # `=== "live"` filter, was free.
  run _cli research "$BATS_TEST_TMPDIR/icp.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  _mkdrafts
  run _cli draft walk "$BATS_TEST_TMPDIR/drafts.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local gone
  gone=$(ls "$ARC_LEADS_STORE/drafts" | head -1)
  [ -n "$gone" ] || { echo "no draft to remove"; false; }
  rm "$ARC_LEADS_STORE/drafts/$gone"
  [ "$(_drafts_count)" -eq 1 ] || { echo "the fixture did not remove exactly one draft"; false; }

  run _cli draft walk "$BATS_TEST_TMPDIR/drafts.json"
  [ "$status" -eq 2 ] || { echo "expected exit 2, got $status: $output"; false; }
  [[ "$output" == *"${gone%.json}"* ]] || { echo "the refusal did not name the missing draft: $output"; false; }
  # And it refused BEFORE queueing anything: the spine must not have grown.
  [ "$(_spine_count approval.requested)" -eq 2 ] || { echo "$(_spine_count approval.requested) approval(s) -- the run queued despite refusing"; false; }
}

@test "an APPROVED touch is still one approval, and the spine allows only one decision" {
  # `approvalState` was exercised only with rejections, so a mutant reading ANY decision as
  # "rejected" survived -- it lets a revision queue a second approval for a touch the human has
  # already approved. That half is asserted first.
  #
  # The other half is asserted as what it IS rather than what an earlier version of this test
  # wished it were. That version ended by rejecting an already-approved approval and expecting
  # the touch to reopen, which the spine cannot do: `validate.mjs` binds a decision idem to
  # sha256("decision.recorded|"+decides), so a second decision on one approval is DUP_IDEM. So
  # "latest decision wins" is a property of a set that can never hold more than one element,
  # and a human CANNOT revoke an approval they have already given. That is a real product gap,
  # recorded in phases/phase-03-known-holes.md rather than papered over with a green test.
  run _cli research "$BATS_TEST_TMPDIR/icp.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  _mkdrafts
  run _cli draft walk "$BATS_TEST_TMPDIR/drafts.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  _decide_all_approvals approve

  # APPROVED is live. A changed body must NOT mint a second approval for that touch.
  _mkdrafts rebody
  run _cli draft walk "$BATS_TEST_TMPDIR/drafts.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"2 duplicate touch(es) refused"* ]] || { echo "a revision queued over a live APPROVED approval: $output"; false; }
  [ "$(_spine_count approval.requested)" -eq 2 ] || { echo "$(_spine_count approval.requested) approval(s), expected 2"; false; }

  # And the spine refuses the second decision, which is WHY the paragraph above is the whole
  # story. Asserted here rather than assumed, because the reject-then-revise path in test 19
  # only makes sense if a rejection is the one and only decision that approval can carry.
  # The helper script is already on disk from the approve call above; it is run DIRECTLY rather
  # than through the wrapper, because the wrapper asserts its own success and a nested `run`
  # inside a `run` is a trap this suite does not need.
  run node "$BATS_TEST_TMPDIR/reject.mjs" "$ARC_ROOT" reject
  [ "$status" -ne 0 ] || { echo "the spine accepted a SECOND decision on one approval: $output"; false; }
  [[ "$output" == *"DUP_IDEM"* ]] || { echo "expected DUP_IDEM, got: $output"; false; }
  [ "$(_spine_count decision.recorded)" -eq 2 ] || { echo "$(_spine_count decision.recorded) decision(s), expected 2"; false; }
}

@test "a spine the fold cannot fully read stops the resume rather than re-announcing" {
  # THE ONE TEST THAT MAKES `unfoldable` NON-ZERO, and without it both of the fixes that read it
  # were free to delete: `cmdDraft`s UNSURE branch and the sibling refusal in `ingestReply`.
  # `_unannounce` deliberately strips the index entries too, so no other test in this file can
  # ever reach this branch.
  #
  # The state is a restored or archived day: the idem index still holds keys whose events are no
  # longer foldable. "I found no approval for this draft" is then not evidence that none exists,
  # and re-announcing would put a second live approval in the inbox -- which the emitter cannot
  # deduplicate, because an approval idem is millisecond-salted.
  run _cli research "$BATS_TEST_TMPDIR/icp.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  _mkdrafts
  run _cli draft walk "$BATS_TEST_TMPDIR/drafts.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$(_spine_count approval.requested)" -eq 2 ] || { echo "setup did not queue 2"; false; }

  # Strip the day-file lines ONLY, leaving derived/idem.index intact -- that asymmetry IS the
  # condition under test, and it is the one thing `_unannounce` deliberately does not produce.
  cat > "$BATS_TEST_TMPDIR/archive.mjs" <<'MJS'
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const dir = join(process.env.ARC_SPINE_ROOT, "events");
let removed = 0;
for (const f of readdirSync(dir).filter((n) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(n))) {
  const p = join(dir, f);
  const keep = [];
  for (const line of readFileSync(p, "utf8").split("\n")) {
    if (!line.trim()) continue;
    if (JSON.parse(line).kind === "approval.requested") { removed++; continue; }
    keep.push(line);
  }
  writeFileSync(p, keep.length ? keep.join("\n") + "\n" : "");
}
console.log("archived: " + removed);
MJS
  # And its inverse: rebuild derived/idem.index from the day files that remain, which is what
  # `arc-replay` does and what the POSITIVE CONTROL below needs in order to prove the refusal is
  # about the INCONSISTENCY and not about the command being broken.
  cat > "$BATS_TEST_TMPDIR/reindex.mjs" <<'MJS'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const root = process.env.ARC_SPINE_ROOT;
const dir = join(root, "events");
const lines = [];
for (const f of readdirSync(dir).filter((n) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(n)))
  for (const line of readFileSync(join(dir, f), "utf8").split("\n")) {
    if (!line.trim()) continue;
    const ev = JSON.parse(line);
    if (ev.idem && ev.id) lines.push(ev.idem + "\t" + ev.id);
  }
const d = join(root, "derived");
if (!existsSync(d)) mkdirSync(d, { recursive: true });
writeFileSync(join(d, "idem.index"), lines.length ? lines.join("\n") + "\n" : "");
console.log("index rebuilt: " + lines.length);
MJS
  [ -s "$BATS_TEST_TMPDIR/reindex.mjs" ] || { echo "the reindex helper is EMPTY"; false; }
  [ -s "$BATS_TEST_TMPDIR/archive.mjs" ] || { echo "the archive helper is EMPTY"; false; }
  run node "$BATS_TEST_TMPDIR/archive.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"archived: 2"* ]] || { echo "the fixture stripped $output, expected 2"; false; }
  [ "$(_spine_count approval.requested)" -eq 0 ] || { echo "the day files still hold approvals"; false; }

  # THE WHOLE RUN REFUSES, not just the resume. An earlier version withheld only the resume and
  # left the `dangling` check reading the same incomplete fold — so a touch whose approval sat in
  # the archived day looked untouched, a new draft was written, a SECOND approval was emitted, and
  # restoring the day made both live. Refusing the command is the only answer that holds for
  # every inference in it.
  run _cli draft walk "$BATS_TEST_TMPDIR/drafts.json"
  [ "$status" -eq 2 ] || { echo "expected exit 2, got $status: $output"; false; }
  [[ "$output" == *"derived/idem.index"* ]] || { echo "$output"; false; }
  # THE REMEDY ORDER IS PART OF THE CLAIM. arc-replay rebuilds the index from the days that are
  # PRESENT, so running it first drives this count to zero by forgetting the receipts rather than
  # by finding them -- and the refusal disappears without the state being repaired.
  [[ "$output" == *"FIRST"* ]] || { echo "the refusal did not order the remedy: $output"; false; }
  # THE COUNTS ARE THE CLAIM: nothing announced, no second draft minted.
  [ "$(_spine_count approval.requested)" -eq 0 ] || { echo "$(_spine_count approval.requested) approval(s) re-announced against an unreadable spine"; false; }
  [ "$(_drafts_count)" -eq 2 ] || { echo "$(_drafts_count) draft file(s), expected 2"; false; }

  # POSITIVE CONTROL: the same command on a spine whose index matches its days runs normally.
  # Without this, a mutant that refuses `draft` unconditionally passes everything above.
  run node "$BATS_TEST_TMPDIR/reindex.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"index rebuilt"* ]] || { echo "$output"; false; }
  run _cli draft walk "$BATS_TEST_TMPDIR/drafts.json"
  [ "$status" -eq 0 ] || { echo "the command refuses even on a consistent spine: $output"; false; }
  [[ "$output" == *"2 resumed from an interrupted run"* ]] || { echo "$output"; false; }
}

@test "this file registers the 22 tests it declares" {
  # THE GRAMMAR IS THE ONE CI USES, not a narrower spelling of it. `grep -c "^@test "` misses a
  # tab-indented declaration and misses `@test` followed by anything but a single space, so a
  # test could be dropped by bats AND uncounted here -- the count that exists to catch a silent
  # drop, blind to two of the three forms it has to see. This is the `_declared` regex in ci.yml.
  declared=$(grep -cE '^[[:blank:]]*@test[[:blank:]]' "$BATS_TEST_FILENAME")
  registered=${#BATS_TEST_NAMES[@]}
  [ "$declared" -eq 22 ] || { echo "declared $declared, expected 22"; false; }
  [ "$registered" -eq "$declared" ] || { echo "bats registered $registered of $declared -- one was DROPPED"; false; }
}
