#!/usr/bin/env bats
# leads Phase 00 -- research lint, provenance, jurisdiction, and the ICP-generic predicate
# (ADR-0406, ADR-0409, ADR-0404 / contract C6b).
#
# The four-way outcome matters: accepted and sendable are different things. HELD is a real
# lead with a doubtful address that can never be sent to; BELOW-BAR is a real dossier that
# cannot support a personalized first touch. Neither is a rejection.
#
# The ICP-generic rule is asserted MECHANICALLY, never against a self-labelling fixture flag.
# When this corpus was first written its "lead-specific" facts were templated (same sentence,
# different year) and the rule correctly flagged all 25 as generic -- the fixture was
# template-blast in disguise. That is the strongest evidence the predicate works, and it is
# why the corpus now carries 25 hand-written distinct fact pairs.
bats_require_minimum_version 1.5.0
load 'test_helper'

_node() { cd "$ARC_ROOT" && node --input-type=module -e "$1"; }

LIMPORT='const {lintCandidates, markGenericFacts, similarity, PROVENANCE_ALLOWLIST, JURISDICTION_ALLOWLIST} = await import("./.claude/scripts/leads/lib/research-lint.mjs");
const fs = await import("node:fs");
const C = JSON.parse(fs.readFileSync("tests/fixtures/leads/candidates.json","utf8"));
const V = new Map(Object.entries(JSON.parse(fs.readFileSync("tests/fixtures/leads/verify.json","utf8"))));
const R = lintCandidates(C, V);
const pass = R.accepted.filter(a => !a.below_bar && a.email_status === "verified");
const held = R.accepted.filter(a => a.email_status === "held");
const below = R.accepted.filter(a => a.below_bar);'

@test "the corpus splits 25 PASS 1 HELD 3 BELOW-BAR 5 REJECTED" {
  run _node "$LIMPORT console.log([pass.length, held.length, below.length, R.rejected.length].join(' '));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"25 1 3 5"* ]]
}

@test "the corpus totals 34 candidates" {
  run _node "$LIMPORT console.log(C.length + ' ' + (R.accepted.length + R.rejected.length));"
  [[ "$output" == *"34 34"* ]]
}

@test "purchased provenance is rejected" {
  run _node "$LIMPORT console.log(R.rejected.some(r => /purchased/.test(r.exclusion_reason)) ? 'rejected' : 'LEAKED');"
  [[ "$output" == *"rejected"* ]]
}

@test "login wall provenance is rejected" {
  run _node "$LIMPORT console.log(R.rejected.some(r => /login-wall/.test(r.exclusion_reason)) ? 'rejected' : 'LEAKED');"
  [[ "$output" == *"rejected"* ]]
}

@test "missing geography is rejected" {
  run _node "$LIMPORT console.log(R.rejected.some(r => /no geography/.test(r.exclusion_reason)) ? 'rejected' : 'LEAKED');"
  [[ "$output" == *"rejected"* ]]
}

@test "out of allowlist geography is rejected" {
  run _node "$LIMPORT console.log(R.rejected.some(r => /outside the v1 allowlist/.test(r.exclusion_reason)) ? 'rejected' : 'LEAKED');"
  [[ "$output" == *"rejected"* ]]
}

@test "fewer than two source links is rejected" {
  run _node "$LIMPORT console.log(R.rejected.some(r => /source link/.test(r.exclusion_reason)) ? 'rejected' : 'LEAKED');"
  [[ "$output" == *"rejected"* ]]
}

@test "every rejection carries an exclusion reason" {
  run _node "$LIMPORT console.log(R.rejected.every(r => r.exclusion_reason && r.exclusion_reason.length > 10) ? 'all-reasoned' : 'BARE');"
  [[ "$output" == *"all-reasoned"* ]]
}

@test "an unverifiable email is HELD and not rejected" {
  run _node "$LIMPORT console.log(held.length === 1 && R.rejected.every(r => !/held@/.test(JSON.stringify(r))) ? 'held-not-rejected' : 'WRONG');"
  [[ "$output" == *"held-not-rejected"* ]]
}

# The predicate, asserted on facts rather than on candidates. Three PASS rows carry the same
# generic fact and STAY PASS because each still has two lead-specific ones -- which is what
# makes the fourth row's fall to BELOW-BAR a property of the rule, not of the fixture.
@test "a fact carried by three other candidates is marked generic" {
  run _node "$LIMPORT
    const m = markGenericFacts(C);
    const gen = m.flatMap(c => c.facts).filter(f => f.generic);
    console.log(gen.length >= 4 && gen.every(f => /website and lists a phone/.test(f.text)) ? 'marked' : 'MISSED:' + gen.length);"
  [[ "$output" == *"marked"* ]]
}

@test "candidates carrying a generic fact plus two specific ones stay PASS" {
  run _node "$LIMPORT
    const m = markGenericFacts(C);
    const withGeneric = m.filter(c => c.facts.some(f => f.generic) && c.facts.length === 3).map(c => c.firm);
    const stillPass = withGeneric.filter(f => pass.some(p => p.firm === f));
    console.log(withGeneric.length + ' ' + stillPass.length);"
  [[ "$output" == *"3 3"* ]]
}

@test "a candidate whose only fact is generic falls to BELOW-BAR" {
  run _node "$LIMPORT console.log(below.some(b => b.firm === 'Firm 28') ? 'below-bar' : 'MISSED');"
  [[ "$output" == *"below-bar"* ]]
}

@test "a candidate with zero facts falls to BELOW-BAR" {
  run _node "$LIMPORT console.log(below.some(b => b.firm === 'Firm 27') ? 'below-bar' : 'MISSED');"
  [[ "$output" == *"below-bar"* ]]
}

@test "facts missing a relevance line are not citable" {
  run _node "$LIMPORT console.log(below.some(b => b.firm === 'Firm 29' && b.fact_count === 0) ? 'below-bar' : 'MISSED');"
  [[ "$output" == *"below-bar"* ]]
}

@test "similarity is symmetric and identical text scores one" {
  run _node "$LIMPORT console.log(similarity('the firm has a website','the firm has a website') === 1 && Math.abs(similarity('alpha beta','beta alpha') - similarity('beta alpha','alpha beta')) < 1e-12 ? 'sane' : 'BROKEN');"
  [[ "$output" == *"sane"* ]]
}

@test "the allowlists are closed and hold no escape hatch" {
  run _node "$LIMPORT console.log(PROVENANCE_ALLOWLIST.length + ' ' + JURISDICTION_ALLOWLIST.length + ' ' + (PROVENANCE_ALLOWLIST.includes('other') ? 'HATCH' : 'closed'));"
  [[ "$output" == *"4 1 closed"* ]]
}

@test "this file declares and runs 17 tests" {
  declared=$(grep -c '^@test ' "$BATS_TEST_FILENAME")
  [ "$declared" -eq 17 ] || { echo "declared $declared, expected 17"; false; }
}
