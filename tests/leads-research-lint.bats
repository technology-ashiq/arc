#!/usr/bin/env bats
# leads Phase 00 -- research lint, provenance, jurisdiction, and the ICP-generic predicate
# (ADR-0406, ADR-0409, ADR-0404 / contract C6b).
#
# The four-way outcome matters: accepted and sendable are different things. HELD is a real
# lead with a doubtful address that can never be sent to; BELOW-BAR is a real dossier that
# cannot support a personalized first touch. Neither is a rejection.
#
# MOST OF THIS FILE IS ADVERSARIAL REGRESSION. A fresh-context attacker with no sight of the
# implementation produced 22 confirmed breaking inputs against these modules while CI was
# green. Each one below is pinned so it cannot come back.
#
# The single most important lesson is in the two provenance tests: their first version matched
# /purchased/ and /login-wall/ against the REJECTION MESSAGE, and those words are constants in
# the message template -- so one row with a typo satisfied both, and the two rows they exist to
# protect could be deleted with the suite still green. They now assert on the INPUT.
bats_require_minimum_version 1.5.0
load 'test_helper'

_node() { cd "$ARC_ROOT" && node --input-type=module -e "$1"; }

LIMPORT='const {lintCandidates, markGenericFacts, similarity, PROVENANCE_ALLOWLIST, JURISDICTION_ALLOWLIST, GENERIC_RULE_MIN_CORPUS} = await import("./.claude/scripts/leads/lib/research-lint.mjs");
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

@test "the purchased list row specifically is rejected" {
  run _node "$LIMPORT
    const row = C.find(x => x.provenance === 'purchased-list');
    console.log(!row ? 'CORPUS-MISSING-ROW' : (R.accepted.some(a => a.firm === row.firm) ? 'LEAKED' : 'rejected'));"
  [[ "$output" == *"rejected"* ]]
}

@test "the login wall row specifically is rejected" {
  run _node "$LIMPORT
    const row = C.find(x => x.provenance === 'login-wall-scrape');
    console.log(!row ? 'CORPUS-MISSING-ROW' : (R.accepted.some(a => a.firm === row.firm) ? 'LEAKED' : 'rejected'));"
  [[ "$output" == *"rejected"* ]]
}

# The negative control the original pair lacked: a provenance that is merely UNKNOWN must also
# be refused, and must not be confused with the two named rows.
@test "an unknown provenance value is rejected too" {
  run _node "$LIMPORT
    const mutant = {...C[0], firm: 'Mutant Co', provenance: 'firm_site'};
    const M = lintCandidates([...C, mutant], V);
    console.log(M.accepted.some(a => a.firm === 'Mutant Co') ? 'LEAKED' : 'rejected');"
  [[ "$output" == *"rejected"* ]]
}

# Provenance was a self-declared LABEL corroborated by nothing, so a purchased CSV row wearing
# a sanctioned label was accepted. The label must now match the evidence actually supplied.
@test "a public directory label over a login walled source is rejected" {
  run _node "$LIMPORT
    const smuggler = {...C[0], firm: 'Smuggler LLP', provenance: 'public-directory',
      source_urls: ['https://www.linkedin.com/in/x', 'https://www.linkedin.com/in/y']};
    const M = lintCandidates([...C, smuggler], V);
    console.log(M.accepted.some(a => a.firm === 'Smuggler LLP') ? 'LEAKED' : 'rejected');"
  [[ "$output" == *"rejected"* ]]
}

@test "a firm site label with no link on the firm domain is rejected" {
  run _node "$LIMPORT
    const bogus = {...C[0], firm: 'Bogus LLP', provenance: 'firm-site',
      source_urls: ['https://directory.example.org/a', 'https://directory.example.org/b']};
    const M = lintCandidates([...C, bogus], V);
    console.log(M.accepted.some(a => a.firm === 'Bogus LLP') ? 'LEAKED' : 'rejected');"
  [[ "$output" == *"rejected"* ]]
}

@test "missing geography is rejected" {
  run _node "$LIMPORT console.log(R.rejected.some(r => /no geography/.test(r.exclusion_reason)) ? 'rejected' : 'LEAKED');"
  [[ "$output" == *"rejected"* ]]
}

@test "out of allowlist geography is rejected" {
  run _node "$LIMPORT
    const row = C.find(x => x.geography === 'DE');
    console.log(!row ? 'CORPUS-MISSING-ROW' : (R.accepted.some(a => a.firm === row.firm) ? 'LEAKED' : 'rejected'));"
  [[ "$output" == *"rejected"* ]]
}

@test "fewer than two valid distinct source links is rejected" {
  run _node "$LIMPORT
    const dupe = {...C[0], firm: 'Dupe LLP',
      source_urls: ['https://dupe.example.com/a', 'https://dupe.example.com/a']};
    const M = lintCandidates([...C, dupe], V);
    console.log(M.accepted.some(a => a.firm === 'Dupe LLP') ? 'LEAKED' : 'rejected');"
  [[ "$output" == *"rejected"* ]]
}

@test "every rejection carries an exclusion reason" {
  run _node "$LIMPORT console.log(R.rejected.every(r => r.exclusion_reason && r.exclusion_reason.length > 10) ? 'all-reasoned' : 'BARE');"
  [[ "$output" == *"all-reasoned"* ]]
}

# ---------- fail-closed verification ----------
#
# The original read `=== "unverifiable" ? held : verified`, so a lookup MISS and every verdict
# a real provider might return all mapped to VERIFIED, i.e. sendable. "invalid" means the
# provider says the mailbox does not exist -- a guaranteed hard bounce on a domain that took
# 2-4 weeks to warm.
@test "any verdict that is not verified is HELD" {
  run _node "$LIMPORT
    const out = ['invalid','risky','catch-all','unknown','UNVERIFIED',null,undefined].map(v => {
      const m = new Map(V); m.set(C[0].email.toLowerCase(), v);
      const r = lintCandidates(C, m).accepted.find(a => a.firm === C[0].firm);
      return r ? r.email_status : 'rejected';
    });
    console.log(out.every(s => s === 'held') ? 'all-held' : 'SENDABLE:' + out.join(','));"
  [[ "$output" == *"all-held"* ]]
}

@test "an email absent from the verifier map is HELD not verified" {
  run _node "$LIMPORT
    const r = lintCandidates(C, new Map()).accepted.find(a => a.firm === C[0].firm);
    console.log(r.email_status === 'held' ? 'held' : 'FAIL-OPEN:' + r.email_status);"
  [[ "$output" == *"held"* ]]
}

@test "the corpus unverifiable row is HELD and not rejected" {
  run _node "$LIMPORT console.log(held.length === 1 && R.rejected.every(r => !/held@/.test(JSON.stringify(r))) ? 'held-not-rejected' : 'WRONG');"
  [[ "$output" == *"held-not-rejected"* ]]
}

# ---------- the ICP-generic predicate ----------

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

# The repetition rule is COMPARATIVE: with <=3 candidates there is nothing to compare against,
# so it cannot fire and a template-blast batch passes 100%. That is not a threshold to tune --
# it is a limit to declare, and a run below the floor must say so rather than pass silently.
@test "a corpus too small for the repetition rule says so instead of passing silently" {
  run _node "$LIMPORT
    const M = lintCandidates(C.slice(0, 3), V);
    console.log(M.genericRuleApplied === false && /NOT checked/.test(M.corpusWarning || '') ? 'declared' : 'SILENT-PASS');"
  [[ "$output" == *"declared"* ]]
}

@test "the full corpus is above the repetition rule floor" {
  run _node "$LIMPORT console.log(R.genericRuleApplied === true ? 'applied' : 'NOT-APPLIED');"
  [[ "$output" == *"applied"* ]]
}

# One query parameter defeated rule 2 entirely: the counter was keyed on the RAW url while the
# comparison went through hostOf. Ten of ten caught became zero of ten. This is the
# validate-one-read-compare-another class, in one function.
@test "a shared directory URL is still detected when a query parameter differs" {
  run _node "$LIMPORT
    const shared = 'https://directory.example.org/listing';
    const rows = [0,1,2,3,4].map(i => ({firm: 'Q' + i, email: 'q' + i + '@q' + i + '.example.com',
      firm_domain: 'q' + i + '.example.com',
      facts: [{text: 'this firm appears in the state bar directory listing for the district',
               evidence_url: shared + '?ref=' + i, relevance: 'r'}]}));
    const M = markGenericFacts(rows);
    const gen = M.flatMap(x => x.facts).filter(f => f.generic).length;
    console.log(gen === 5 ? 'all-detected' : 'ESCAPED:' + gen + '/5');"
  [[ "$output" == *"all-detected"* ]]
}

@test "a shared directory URL is still detected when a fragment differs" {
  run _node "$LIMPORT
    const shared = 'https://directory.example.org/listing';
    const rows = [0,1,2,3,4].map(i => ({firm: 'H' + i, email: 'h' + i + '@h' + i + '.example.com',
      firm_domain: 'h' + i + '.example.com',
      facts: [{text: 'this firm appears in the state bar directory listing for the district',
               evidence_url: shared + '#' + i, relevance: 'r'}]}));
    const M = markGenericFacts(rows);
    console.log(M.flatMap(x => x.facts).filter(f => f.generic).length === 5 ? 'all-detected' : 'ESCAPED');"
  [[ "$output" == *"all-detected"* ]]
}

# firm_domain was caller-supplied and validated against nothing, so declaring it to BE the
# shared directory host turned every generic citation into a lead-specific one.
@test "declaring firm domain as the shared source host does not evade rule two" {
  run _node "$LIMPORT
    const shared = 'https://directory.example.org/listing';
    const rows = [0,1,2,3,4].map(i => ({firm: 'F' + i, email: 'f' + i + '@f' + i + '.example.com',
      firm_domain: 'directory.example.org',
      facts: [{text: 'this firm appears in the state bar directory listing for the district',
               evidence_url: shared, relevance: 'r'}]}));
    const M = markGenericFacts(rows);
    console.log(M.flatMap(x => x.facts).filter(f => f.generic).length === 5 ? 'all-detected' : 'ESCAPED');"
  [[ "$output" == *"all-detected"* ]]
}

# Self-exclusion was applied in rule 1 and omitted in the adjacent rule 2, in the same
# function: one candidate citing one URL three times marked its own facts generic.
@test "a lone candidate citing one URL three times is not self marked generic" {
  run _node "$LIMPORT
    const lone = [{firm: 'Lone LLP', email: 'l@lone.example.com', firm_domain: 'lone.example.com',
      facts: [0,1,2].map(i => ({text: 'a distinct claim number ' + i + ' about this particular firm and its own work',
        evidence_url: 'https://third.example.org/page', relevance: 'r'}))}];
    const M = markGenericFacts(lone);
    console.log(M[0].facts.some(f => f.generic) ? 'SELF-MARKED' : 'not-self-marked');"
  [[ "$output" == *"not-self-marked"* ]]
}

# KEEP is ASCII, so any fact in Devanagari or Tamil normalizes to "" -- and returning 1 for two
# empty normalizations marked every non-Latin fact generic, in an INDIA-ONLY campaign. A false
# positive that silently kills good drafts is what ADR-0404 WARN-first exists to avoid.
@test "two facts that normalize to nothing are not treated as identical" {
  run _node "$LIMPORT console.log(similarity('!!', 'x') === 1 || similarity('!!', '!!') === 1 ? 'STILL-IDENTICAL' : 'not-identical');"
  [[ "$output" == *"not-identical"* ]]
}

# isCitable never looked at f.text and source_urls was length-checked only, so two zero-content
# facts and two empty-string links passed as a clean 2-fact PASS.
@test "empty facts and empty source links do not make a PASS" {
  run _node "$LIMPORT
    const hollow = {...C[0], firm: 'Hollow LLP', source_urls: ['',''],
      facts: [{text:'',evidence_url:'x',relevance:'y'},{text:'',evidence_url:'z',relevance:'w'}]};
    const M = lintCandidates([...C, hollow], V);
    const a = M.accepted.find(x => x.firm === 'Hollow LLP');
    console.log(!a ? 'rejected' : (a.below_bar ? 'below-bar' : 'PASSED-HOLLOW'));"
  [[ "$output" != *"PASSED-HOLLOW"* ]]
}

@test "similarity is symmetric" {
  run _node "$LIMPORT console.log(Math.abs(similarity('alpha beta gamma','beta alpha gamma') - similarity('beta alpha gamma','alpha beta gamma')) < 1e-12 ? 'sane' : 'BROKEN');"
  [[ "$output" == *"sane"* ]]
}

@test "the allowlists are closed and hold no escape hatch" {
  run _node "$LIMPORT console.log(PROVENANCE_ALLOWLIST.length + ' ' + JURISDICTION_ALLOWLIST.length + ' ' + (PROVENANCE_ALLOWLIST.includes('other') ? 'HATCH' : 'closed'));"
  [[ "$output" == *"4 1 closed"* ]]
}

@test "this file registers the 30 tests it declares" {
  # BATS_TEST_NAMES is what bats REGISTERED. The previous version grepped `^@test ` in
  # this same file and compared it to a literal in this same file -- a tautology that
  # cannot see a test bats dropped, which is the only thing it was there to catch.
  declared=$(grep -c '^@test ' "$BATS_TEST_FILENAME")
  registered=${#BATS_TEST_NAMES[@]}
  [ "$declared" -eq 30 ] || { echo "declared $declared, expected 30"; false; }
  [ "$registered" -eq "$declared" ] || { echo "bats registered $registered of $declared declared tests -- one was DROPPED (non-ASCII name?)"; false; }
}
