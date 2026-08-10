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

@test "the MX verifier answers all four states, and never resolves a bad address" {
  # ADR-0418. The resolver is INJECTED, and that is the only reason this test can exist:
  # verifier() returns the FAKE whenever ARC_LEADS_FAKE=1, so verifyReal is unreachable on CI
  # (which fakes DNS) and needs live network anywhere else. Without the seam the `verified`
  # branch is unprovable in both places at once. Measured, not assumed: the box this was written
  # on answers every DNS query with ECONNREFUSED and returned `unverifiable` for gmail.com.
  run _node 'const {verifyAddress} = await import("./.claude/scripts/leads/lib/deps.mjs");
    const has  = async () => [{exchange:"mx.example.net", priority:10}];
    const none = async () => [];
    const boom = async () => { const e = new Error("queryMx ENOTFOUND"); e.code = "ENOTFOUND"; throw e; };
    console.log("MXPRESENT:" + await verifyAddress("a@example.com", has));
    console.log("MXEMPTY:"   + await verifyAddress("a@example.com", none));
    console.log("MXTHROWS:"  + await verifyAddress("a@example.com", boom));
    console.log("BADSHAPE:"  + await verifyAddress("not-an-address", has));
    // The resolver EXPLODES if consulted. A syntax reject that still hits the network is a
    // lookup for a string that cannot be an address, and it would make BADSHAPE pass for the
    // wrong reason -- the resolver would throw and the catch would return unverifiable.
    const explode = async () => { throw new Error("resolver consulted for a non-address"); };
    console.log("NOLOOKUP:"  + await verifyAddress("nope", explode));'
  [ "$status" -eq 0 ] || { echo "the probe did not run: $output"; false; }
  [[ "$output" == *"MXPRESENT:verified"* ]]     || { echo "an MX record did not verify: $output"; false; }
  [[ "$output" == *"MXEMPTY:unverifiable"* ]]   || { echo "an empty MX list was not held: $output"; false; }
  [[ "$output" == *"MXTHROWS:unverifiable"* ]]  || { echo "a throwing resolver was not held: $output"; false; }
  # invalid, NOT unverifiable -- the two land in different lint outcomes (REJECTED vs HELD).
  [[ "$output" == *"BADSHAPE:invalid"* ]]       || { echo "a malformed address was not invalid: $output"; false; }
  [[ "$output" == *"NOLOOKUP:invalid"* ]]       || { echo "the resolver was consulted for a non-address: $output"; false; }
}

@test "the corpus source refuses every way a hand-written file goes wrong" {
  # ADR-0417. sourceReal is only reachable with ARC_LEADS_FAKE unset, so this drives the CLI
  # without it -- which is also what proves the fake is not silently substituted.
  cd "$ARC_ROOT"
  local dir; dir="$(_tmpdir)"
  [ -n "$dir" ] || { echo "the temp dir was not created"; false; }
  printf '{"campaign":"corpustest","classes":["firm-site"],"jurisdictions":["IN"],"min_facts":2}\n' > "$dir/icp.json"
  [ -s "$dir/icp.json" ] || { echo "the icp fixture is EMPTY"; false; }

  # 1. no --corpus at all: the refusal must NAME the flag, since the whole defect it replaces
  #    was a refusal naming no reachable remedy.
  run env ARC_LEADS_STORE="$dir/store" node .claude/scripts/leads/arc-leads.mjs research "$dir/icp.json"
  [ "$status" -eq 4 ] || { echo "expected the provider exit code, got $status: $output"; false; }
  [[ "$output" == *"--corpus"* ]] || { echo "the refusal named no flag: $output"; false; }

  # 2. inside the repo: refused, because this is the file most likely to be dropped in the repo
  #    root and the tripwire treats every tracked leads path as a violation on sight.
  printf '[]\n' > "$ARC_ROOT/corpus-under-test.json"
  run env ARC_LEADS_STORE="$dir/store" node .claude/scripts/leads/arc-leads.mjs research "$dir/icp.json" --corpus "$ARC_ROOT/corpus-under-test.json"
  rm -f "$ARC_ROOT/corpus-under-test.json"
  [ "$status" -eq 4 ]
  [[ "$output" == *"inside the repository"* ]] || { echo "a corpus inside the repo was accepted: $output"; false; }

  # 3. not JSON · 4. not an array · 5. empty array -- three DIFFERENT messages, because "0 PASS"
  #    out of a silent empty file reads exactly like a corpus whose every candidate was rejected.
  printf 'not json at all\n' > "$dir/bad.json"
  run env ARC_LEADS_STORE="$dir/store" node .claude/scripts/leads/arc-leads.mjs research "$dir/icp.json" --corpus "$dir/bad.json"
  [ "$status" -eq 4 ]
  [[ "$output" == *"not valid JSON"* ]] || { echo "unparseable corpus: $output"; false; }
  printf '{"a":1}\n' > "$dir/obj.json"
  run env ARC_LEADS_STORE="$dir/store" node .claude/scripts/leads/arc-leads.mjs research "$dir/icp.json" --corpus "$dir/obj.json"
  [ "$status" -eq 4 ]
  [[ "$output" == *"must be a JSON array"* ]] || { echo "object corpus: $output"; false; }
  printf '[]\n' > "$dir/empty.json"
  run env ARC_LEADS_STORE="$dir/store" node .claude/scripts/leads/arc-leads.mjs research "$dir/icp.json" --corpus "$dir/empty.json"
  [ "$status" -eq 4 ]
  [[ "$output" == *"empty array"* ]] || { echo "empty corpus: $output"; false; }

  # 6. operator errors on the flag itself.
  run env ARC_LEADS_STORE="$dir/store" node .claude/scripts/leads/arc-leads.mjs research "$dir/icp.json" --corpus a --corpus b
  [ "$status" -eq 2 ]
  [[ "$output" == *"given twice"* ]] || { echo "a repeated --corpus was accepted: $output"; false; }
  run env ARC_LEADS_STORE="$dir/store" node .claude/scripts/leads/arc-leads.mjs research "$dir/icp.json" --bogus=secret-value
  [ "$status" -eq 2 ]
  [[ "$output" == *"--bogus"* ]] || { echo "an unknown flag was accepted: $output"; false; }
  [[ "$output" != *"secret-value"* ]] || { echo "the refusal echoed an attached value: $output"; false; }

  # POSITIVE CONTROL. Without this every assertion above passes for a `research` that refuses
  # unconditionally -- which is precisely the state this ADR was written to end.
  run env ARC_LEADS_FAKE=1 ARC_LEADS_STORE="$dir/store" node .claude/scripts/leads/arc-leads.mjs store init
  [ "$status" -eq 0 ] || { echo "store init failed, so the control proves nothing: $output"; false; }
  cat > "$dir/corpus.json" <<'JSON'
[{"name":"Adv One","email":"one@firmone.example.com","firm":"Firm One","firm_domain":"firmone.example.com",
  "geography":"IN","provenance":"firm-site",
  "source_urls":["https://firmone.example.com/about","https://firmone.example.com/team"],
  "facts":[{"text":"argued a limitation-period matter before the Madras High Court","evidence_url":"https://firmone.example.com/practice","relevance":"the pilot removes the tracking overhead this matter load creates"},
           {"text":"runs a monthly clinic for first-generation litigants","evidence_url":"https://firmone.example.com/writing","relevance":"someone who documents their process adopts a process tool without persuasion"}]}]
JSON
  [ -s "$dir/corpus.json" ] || { echo "the corpus fixture is EMPTY"; false; }
  run env ARC_LEADS_STORE="$dir/store" ARC_SPINE_ROOT="$dir/spine" \
    node .claude/scripts/leads/arc-leads.mjs research "$dir/icp.json" --corpus "$dir/corpus.json"
  [ "$status" -eq 0 ] || { echo "a valid corpus did not reach the store: $output"; false; }
  # A DOSSIER ON DISK is the assertion, not a line of stdout: the whole defect ADR-0417 closes
  # was that no path existed by which a researched person entered the store. A summary line can
  # be printed by a function that wrote nothing.
  [ -d "$dir/store/dossiers" ] || { echo "no dossiers directory: $output"; false; }
  local n; n=$(ls "$dir/store/dossiers" | wc -l)
  [ "$n" -eq 1 ] || { echo "expected 1 dossier written from the corpus, found $n. Output: $output"; false; }
}

@test "this file registers the 32 tests it declares" {
  # BATS_TEST_NAMES is what bats REGISTERED. The previous version grepped `^@test ` in
  # this same file and compared it to a literal in this same file -- a tautology that
  # cannot see a test bats dropped, which is the only thing it was there to catch.
  declared=$(grep -c '^@test ' "$BATS_TEST_FILENAME")
  registered=${#BATS_TEST_NAMES[@]}
  [ "$declared" -eq 32 ] || { echo "declared $declared, expected 32"; false; }
  [ "$registered" -eq "$declared" ] || { echo "bats registered $registered of $declared declared tests -- one was DROPPED (non-ASCII name?)"; false; }
}
