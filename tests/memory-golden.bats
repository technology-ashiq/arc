#!/usr/bin/env bats
# Phase 02, REQ-06 -- recall quality is a number CI can fail on (ADR-0706).
#
# THE NEGATIVE CONTROL COMES FIRST, and it is the reason this file exists. A gate nobody has seen
# go red is a gate nobody has tested: the phase spec requires it "demonstrated failing once before
# being trusted". Every red path below is driven by a real planted defect, not by asserting that
# an error message exists.
#
# The gate reads exactly three things -- the golden TSV, the index, and the alias file -- so a
# corrupted-fixture tree is assembled from the REAL index plus a doctored TSV. That keeps the
# ranking real (the repo's own 278-record corpus) while the graded expectations are ours to break.
#
# @test names are ASCII-only: bats silently DROPS a test whose name carries a non-ASCII character.
bats_require_minimum_version 1.5.0
load 'test_helper'

MEM="$ARC_ROOT/.claude/scripts/memory/memory-index.mjs"
RECALL="$ARC_ROOT/.claude/scripts/memory/arc-recall.mjs"
GOLDEN="$ARC_ROOT/.claude/scripts/memory/golden-check.mjs"
TSV="tests/fixtures/memory/golden-queries.tsv"
OBSERVE=".claude/state/memory/surfaced-cited.jsonl"

# A tree the gate can read: the REAL index (so ranking is real) plus our own copy of the golden
# TSV, which each test is free to doctor.
_gate_tree() {
  run node "$MEM" --root "$ARC_ROOT" --rebuild --allow-missing-spine
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local t="$BATS_TEST_TMPDIR/gt"
  mkdir -p "$t/.claude/state/memory" "$t/tests/fixtures/memory" "$t/docs/memory"
  cp "$ARC_ROOT/.claude/state/memory/index.json" "$t/.claude/state/memory/index.json"
  cp "$ARC_ROOT/$TSV" "$t/$TSV"
  [ -f "$ARC_ROOT/docs/memory/aliases.md" ] && cp "$ARC_ROOT/docs/memory/aliases.md" "$t/docs/memory/aliases.md"
  # A fixture builder asserts its own fixture. An empty index or a truncated TSV would make every
  # "gate failed" test below pass for the wrong reason.
  [ -s "$t/.claude/state/memory/index.json" ] || return 1
  [ "$(grep -cv '^#' "$t/$TSV")" -eq 12 ] || return 1
  echo "$t"
}

# Rewrite the @baseline-grep-top3 directive in place. Node, not sed: `sed -i` needs a mandatory
# backup suffix on BSD and `\t` in a sed regex is GNU-only, so a sed version of this passes on two
# of the three legs and fails on macOS.
_set_baseline() {
  node -e "
    const fs=require('node:fs'); const [p,v]=process.argv.slice(1);
    const out=fs.readFileSync(p,'utf8').split('\n')
      .map((l)=>l.startsWith('# @baseline-grep-top3\t') ? '# @baseline-grep-top3\t'+v : l)
      .join('\n');
    fs.writeFileSync(p,out);" "$1" "$2"
}

@test "golden gate: NEGATIVE CONTROL -- one planted miss turns the gate red" {
  # The gate is demonstrated FAILING before it is trusted. G01 asks about the closed event
  # vocabulary; replacing its query with a token the corpus does not contain makes exactly one
  # row miss, and 11/12 must be a build failure.
  t="$(_gate_tree)"
  [ -n "$t" ] || { echo "the gate tree was not built"; false; }
  # Sanity: it is GREEN before the plant, or the red below proves nothing.
  run node "$GOLDEN" --root "$t" --gate
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"GATE PASSED"* ]]
  # ...now plant the miss.
  node -e "
    const fs=require('node:fs'); const p=process.argv[1];
    const out=fs.readFileSync(p,'utf8').split('\n').map((l)=>{
      if (!l.startsWith('G01\t')) return l;
      const c=l.split('\t'); c[1]='zzzqqq unmatchable token'; return c.join('\t');
    }).join('\n');
    fs.writeFileSync(p,out);" "$t/$TSV"
  grep -q "zzzqqq unmatchable token" "$t/$TSV" || { echo "the plant did not land in the fixture"; false; }
  run node "$GOLDEN" --root "$t" --gate
  [ "$status" -eq 1 ] || { echo "expected exit 1, got $status"; echo "$output"; false; }
  [[ "$output" == *"GATE FAILED"* ]]
  [[ "$output" == *"1 of 12 golden queries do not hit"* ]]
}

@test "golden gate: a module that only EQUALS grep is red, isolated from the miss condition" {
  # ADR-0706's second red, and it means something different from the first: 12/12 is a perfect
  # score and still a failure if grep already found them, because then the module was not needed.
  # Isolated by moving the recorded baseline rather than by breaking a query, so this test cannot
  # pass on the miss condition instead.
  t="$(_gate_tree)"
  [ -n "$t" ] || { echo "the gate tree was not built"; false; }
  # Rewritten by node, not by sed: `sed -i` takes a mandatory backup suffix on the BSD leg and
  # `\t` in a sed regex is GNU-only, so the sed form of this line passed on ubuntu and windows
  # and failed on macOS alone -- the exact BSD-vs-GNU class .claude/rules/testing.md names.
  _set_baseline "$t/$TSV" 12
  grep -q "@baseline-grep-top3	12" "$t/$TSV" || { echo "the baseline edit did not land"; false; }
  run node "$GOLDEN" --root "$t" --gate
  [ "$status" -eq 1 ] || { echo "expected exit 1, got $status"; echo "$output"; false; }
  [[ "$output" == *"did not BEAT grep"* ]]
  # ...and NOT for the other reason: all twelve still hit.
  [[ "$output" != *"golden queries do not hit"* ]]
}

@test "golden gate: green on the live corpus, with the comparison table beside the verdict" {
  t="$(_gate_tree)"
  [ -n "$t" ] || { echo "the gate tree was not built"; false; }
  run node "$GOLDEN" --root "$t" --gate
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"12/12 anchors resolve"* ]]
  [[ "$output" == *"12/12 queries hit an expected id in the top 3"* ]]
  # The comparison table: both numbers labelled, the delta derived rather than retyped.
  [[ "$output" == *"grep baseline"* ]]
  [[ "$output" == *"arc-recall (js)"* ]]
  [[ "$output" == *"delta"* ]]
  [[ "$output" == *"GATE PASSED"* ]]
  [[ "$output" == *"beating the grep baseline of 5 by 7"* ]]
}

@test "golden gate: all THREE embeddings conditions are printed with their live values" {
  # ADR-0706 settled the embeddings trigger as three conditions TOGETHER. Printing one of them,
  # or printing a verdict with no values, is how a settled number decays back into folklore.
  t="$(_gate_tree)"
  [ -n "$t" ] || { echo "the gate tree was not built"; false; }
  run node "$GOLDEN" --root "$t" --gate
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"needs ALL THREE"* ]]
  [[ "$output" == *"top-3 precision < 10/12"* ]]
  [[ "$output" == *"alias-iteration fixes"* ]]
  [[ "$output" == *"corpus >= 2x the recorded size"* ]]
  [[ "$output" == *"NOT discussable"* ]]
  # Live values, not just labels: the alias table is empty today and the bar is twice 278.
  [[ "$output" == *"(live 12/12)"* ]]
  [[ "$output" == *"recorded 278, bar 556"* ]]
}

@test "golden gate: --rank without --gate still only reports, and never fails the build" {
  # The reporting surface Phase 01 shipped must keep its contract: turning --rank itself into a
  # gate would have made every phase-01 caller start failing without being asked.
  t="$(_gate_tree)"
  [ -n "$t" ] || { echo "the gate tree was not built"; false; }
  node -e "
    const fs=require('node:fs'); const p=process.argv[1];
    const out=fs.readFileSync(p,'utf8').split('\n').map((l)=>{
      if (!l.startsWith('G01\t')) return l;
      const c=l.split('\t'); c[1]='zzzqqq unmatchable token'; return c.join('\t');
    }).join('\n');
    fs.writeFileSync(p,out);" "$t/$TSV"
  run node "$GOLDEN" --root "$t" --rank
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"11/12 queries hit an expected id in the top 3"* ]]
  [[ "$output" != *"GATE"* ]]
}

@test "golden gate: the bar lives in the fixture, and a missing or broken one is refused" {
  # A gate that silently defaults its own bar is grading nothing.
  t="$(_gate_tree)"
  [ -n "$t" ] || { echo "the gate tree was not built"; false; }
  cp "$t/$TSV" "$t/keep.tsv"
  # missing
  grep -v '@baseline-grep-top3' "$t/keep.tsv" > "$t/$TSV"
  run node "$GOLDEN" --root "$t" --gate; [ "$status" -eq 2 ]
  [[ "$output" == *"declares no @baseline-grep-top3"* ]]
  # non-numeric (node again, for the BSD `\t` reason above)
  cp "$t/keep.tsv" "$t/$TSV"; _set_baseline "$t/$TSV" five
  run node "$GOLDEN" --root "$t" --gate; [ "$status" -eq 2 ]
  [[ "$output" == *"not a non-negative integer"* ]]
  # declared twice -- an operator error, never last-wins
  { cat "$t/keep.tsv"; printf '# @baseline-grep-top3\t9\n'; } > "$t/$TSV"
  run node "$GOLDEN" --root "$t" --gate; [ "$status" -eq 2 ]
  [[ "$output" == *"twice"* ]]
  # an unknown directive is a typo in a real one, not a comment to ignore
  { cat "$t/keep.tsv"; printf '# @baseline-grep-top4\t5\n'; } > "$t/$TSV"
  run node "$GOLDEN" --root "$t" --gate; [ "$status" -eq 2 ]
  [[ "$output" == *"which is not one of"* ]]
  # ...and the untouched fixture is still green, so the four reds above are the directives and
  # not the copying.
  cp "$t/keep.tsv" "$t/$TSV"
  run node "$GOLDEN" --root "$t" --gate
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "golden gate: a ranked recall records one surfaced row, and cannot be broken by it" {
  # ADR-0706: observational, best effort. The row is written...
  tree="$BATS_TEST_TMPDIR/obs"
  cp -r "$ARC_ROOT/tests/fixtures/memory/organs-good" "$tree"
  run node "$MEM" --root "$tree" --rebuild --allow-missing-spine
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run node "$RECALL" --root "$tree" "unanchored heading regex prose"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ -s "$tree/$OBSERVE" ] || { echo "no observational row was written"; false; }
  run node -e "
    const fs=require('node:fs');
    const lines=fs.readFileSync(process.argv[1],'utf8').trim().split('\n');
    if (lines.length!==1) throw new Error('expected 1 row, got '+lines.length);
    const r=JSON.parse(lines[0]);
    if (r.surface!=='arc-recall') throw new Error('surface '+r.surface);
    if (r.cited!==null) throw new Error('cited must start null, got '+JSON.stringify(r.cited));
    if (!Array.isArray(r.surfaced) || r.surfaced.length===0) throw new Error('surfaced empty');
    console.log('OBSERVE OK '+r.surfaced.length);" "$tree/$OBSERVE"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"OBSERVE OK"* ]]
  # ...and when it CANNOT be written, recall still answers. A file where the directory belongs
  # makes mkdir fail on every OS, without relying on chmod semantics that differ on windows.
  tree2="$BATS_TEST_TMPDIR/obs2"
  cp -r "$ARC_ROOT/tests/fixtures/memory/organs-good" "$tree2"
  run node "$MEM" --root "$tree2" --rebuild --allow-missing-spine
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  rm -rf "$tree2/.claude/state/memory"
  printf 'not a directory\n' > "$tree2/.claude/state/memory"
  run node "$RECALL" --root "$tree2" "unanchored heading regex prose"
  [ "$status" -eq 0 ] || { echo "an unwritable observational log broke recall"; echo "$output"; false; }
  [[ "$output" == *"docs/retro-log.md:"* ]]
}

@test "golden gate: no gate path reads the observational log" {
  # ADR-0706 disqualifies this log from ever gating or promoting anything. That is a property of
  # the code, so it is checked against the code rather than trusted to the ADR.
  # POSITIVE CONTROL FIRST: prove the grep is reading a file that exists and mentions the gate.
  run grep -c -- "--gate" "$GOLDEN"
  [ "$status" -eq 0 ] || { echo "the gate flag is absent from golden-check.mjs"; false; }
  [ "$output" -gt 0 ]
  run grep -nE "surfaced-cited|observe\.mjs|recordSurfaced" "$GOLDEN"
  [ "$status" -ne 0 ] || { echo "golden-check reads the observational log: $output"; false; }
}

@test "golden gate: the reader-lint sanctions the observational log at the TOKEN, not the line" {
  # observe.mjs must carry the literal `.jsonl` -- that IS the filename ADR-0706 names -- while
  # spine-reader-lint bans that token as a proxy for raw spine access. The sanction has to be
  # narrow enough that a genuine bypass mentioning the same filename still trips, so BOTH halves
  # are driven here against a throwaway repo rather than trusted to the comment in the lint.
  local r="$BATS_TEST_TMPDIR/lintrepo"
  mkdir -p "$r/.claude/scripts/memory"
  cd "$r"
  git init -q .
  # Repo-local identity, never subshell-scoped env: a clean CI runner has no global git identity
  # and commits there fail 128 -- green locally, red on CI.
  git config user.email "test@example.invalid"
  git config user.name "arc test"
  # (a) the sanctioned shape: memory's own instance state.
  printf 'export const P = ".claude/state/memory/surfaced-cited.jsonl";\n' \
    > "$r/.claude/scripts/memory/ok.mjs"
  git add -A && git commit -qm seed
  # The lint reads TRACKED files, so assert the staging actually moved before trusting a pass.
  [ "$(git ls-files .claude/scripts/memory | grep -c '\.mjs$')" -eq 1 ]
  run bash "$ARC_ROOT/.claude/scripts/review/spine-reader-lint.sh"
  [ "$status" -eq 0 ] || { echo "the sanctioned log tripped the lint:"; echo "$output"; false; }
  # (b) a genuine bypass that MENTIONS the sanctioned name on the same line must still trip. A
  # grep -v on the filename would have swallowed this whole line.
  printf 'export const Q = "events/surfaced-cited.jsonl";\n' \
    > "$r/.claude/scripts/memory/bad.mjs"
  git add -A && git commit -qm bypass
  [ "$(git ls-files .claude/scripts/memory | grep -c '\.mjs$')" -eq 2 ]
  run bash "$ARC_ROOT/.claude/scripts/review/spine-reader-lint.sh"
  [ "$status" -eq 1 ] || { echo "a real bypass passed the lint: $output"; false; }
  [[ "$output" == *"bad.mjs"* ]]
  [[ "$output" != *"ok.mjs"* ]]
}

@test "equivalence: with one engine it says NOTHING WAS COMPARED, and proves determinism instead" {
  # REQ-07's engine is CUT; the contract and harness ship. The danger with one engine is a green
  # that reads as "two engines agree", so the harness has to say what it did and did not do.
  t="$(_gate_tree)"
  [ -n "$t" ] || { echo "the gate tree was not built"; false; }
  run node "$GOLDEN" --root "$t" --equivalence
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"NOTHING WAS COMPARED"* ]]
  [[ "$output" == *"proves DETERMINISM"* ]]
  [[ "$output" == *"does not and cannot show that two engines agree"* ]]
  # The tie-break is printed as the contract it is, not left as a footnote in an ADR.
  [[ "$output" == *"id-ascending on equal bm25"* ]]
  [[ "$output" == *"engine(s) available: js"* ]]
  [[ "$output" == *"as determinism only"* ]]
}

@test "equivalence: a second engine that differs on ORDER ALONE is caught" {
  # The whole reason the contract names ordered ids. Two engines returning the same SET of ids in
  # a different sequence rank differently, and a harness comparing sets would pass them. Driven
  # against the pure function with a planted registry, since no second engine exists to ship.
  run node -e "
    const u=process.argv[1];
    import(u).then(async (m) => {
      const canonical = m.ENGINES[0];
      const reversed = { name: 'reversed', available: () => true,
        run: (i, r, t, o) => canonical.run(i, r, t, o).slice().reverse() };
      const agreeing = { name: 'twin', available: () => true, run: canonical.run };
      const index = { postings: { terms: {}, lengths: [], avgdl: 0 } };
      const records = [];
      const queries = [{ id: 'Q1', tokens: ['alpha'] }];
      // A planted disagreement must be CAUGHT...
      const bad = m.checkEquivalence({ index, records, queries, registry: [canonical, reversed] });
      // ...on a corpus where the two actually differ, or this proves nothing. Build one.
      const recs = [{ id: 'a', title: 'alpha', body: 'alpha' }, { id: 'b', title: 'alpha', body: 'alpha' }];
      const idx2 = { postings: { terms: { alpha: [[0,1],[1,1]] }, lengths: [1,1], avgdl: 1 } };
      const bad2 = m.checkEquivalence({ index: idx2, records: recs, queries, registry: [canonical, reversed] });
      const good = m.checkEquivalence({ index: idx2, records: recs, queries, registry: [canonical, agreeing] });
      if (!bad2.compared) throw new Error('two engines must count as compared');
      if (bad2.mismatches.length === 0) throw new Error('an order-only disagreement was NOT caught');
      // PRESENT, not first. The tie-break probe now runs ahead of the per-query comparison, and an
      // engine that reverses every result also breaks the tie-break -- correctly -- so it reports
      // BOTH kinds and this used to index [0] blindly. Asserting the kind is present keeps what
      // this test is actually for: that an order-only disagreement is caught as a disagreement.
      //
      // NO BACKTICKS ANYWHERE IN THIS PROGRAM, in code OR in comments. It is embedded in a
      // DOUBLE-quoted shell string, where a backtick is command substitution: naming the probe
      // function in backticks here made bash try to RUN it, and the run reached its assertion
      // through a shell error. The CLAUDE.md rule is written about apostrophes in single-quoted
      // strings; this is the same rule, the other quote.
      const disagreements = bad2.mismatches.filter((x) => x.kind === 'disagreement');
      if (disagreements.length === 0) throw new Error('no disagreement reported, kinds: ' + bad2.mismatches.map((x) => x.kind).join(','));
      if (good.mismatches.length !== 0) throw new Error('an AGREEING pair was falsely flagged: the harness refuses everything');
      if (!good.compared) throw new Error('agreeing pair not marked compared');
      console.log('EQUIV OK caught=' + disagreements.length + ' falsePositives=' + good.mismatches.length);
    }).catch((e) => { console.error(e.message); process.exit(1); });" \
    "$(cd "$ARC_ROOT" && node -e 'const {pathToFileURL}=require("node:url");const {resolve}=require("node:path");process.stdout.write(pathToFileURL(resolve(".claude/scripts/memory/lib/engines.mjs")).href)')"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"EQUIV OK caught=1 falsePositives=0"* ]]
}

@test "equivalence: the CLI engine names come from the registry, not a second list" {
  # Two hand-kept lists of engine names drift, and the one that drifts is the one the operator
  # types against. An unknown engine must be refused, and the refusal must enumerate the registry.
  tree="$BATS_TEST_TMPDIR/eng"
  cp -r "$ARC_ROOT/tests/fixtures/memory/organs-good" "$tree"
  run node "$MEM" --root "$tree" --rebuild --allow-missing-spine
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run node "$RECALL" --root "$tree" --engine sqlite "prevention"
  [ "$status" -eq 2 ]
  [[ "$output" == *"is not one of: js, auto"* ]]
  # ...and the accepted ones resolve THROUGH the registry and report which actually ran.
  run node "$RECALL" --root "$tree" --engine auto "unanchored heading regex prose"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"engine js, requested auto"* ]]
  run node "$RECALL" --root "$tree" --engine js "unanchored heading regex prose"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"engine js, requested js"* ]]
}

@test "equivalence: NEGATIVE CONTROL -- the tie-break is ASSERTED, and an engine that inverts it is caught" {
  # For one commit `TIE_BREAK` was a string the harness PRINTED and nothing compared against.
  # Inverting bm25's comparator to id-DESCENDING left `--equivalence` AND `--gate` green at exit 0,
  # because with one engine determinism holds under any total order and the only assertion in this
  # file was that the sentence appeared. A contract nothing tests is a comment.
  run node -e "
    const u=process.argv[1];
    import(u).then(async (m) => {
      const canonical = m.ENGINES[0];
      // Same ids, wrong ORDER: the probe corpus is all-ties by construction, so order is the
      // only thing this engine gets wrong -- exactly the mutant that used to pass.
      const inverted = { name: 'inverted', available: () => true,
        run: (i, r, t, o) => canonical.run(i, r, t, o).slice().reverse() };
      const clean = m.checkTieBreak([canonical]);
      const broken = m.checkTieBreak([inverted]);
      if (clean.length !== 1 || !clean[0].ok) throw new Error('the canonical engine FAILED its own tie-break probe: ' + JSON.stringify(clean));
      if (broken.length !== 1 || broken[0].ok) throw new Error('an inverted tie-break was NOT caught');
      // ...and it reaches the verdict object the CLI branches on, not just the helper.
      const idx = { postings: { terms: {}, lengths: [], avgdl: 0 } };
      const v = m.checkEquivalence({ index: idx, records: [], queries: [], registry: [inverted] });
      const ok = m.checkEquivalence({ index: idx, records: [], queries: [], registry: [canonical] });
      if (v.tieBreakHeld !== false) throw new Error('tieBreakHeld should be false');
      if (!v.mismatches.some((x) => x.kind === 'tie-break')) throw new Error('no tie-break mismatch was reported: ' + JSON.stringify(v.mismatches));
      if (ok.tieBreakHeld !== true || ok.mismatches.length !== 0) throw new Error('the clean engine was falsely flagged: ' + JSON.stringify(ok.mismatches));
      // The probe really is all-ties: three ids returned, and sorted order is NOT build order.
      const p = m.tieBreakProbe();
      if (p.expected.length !== 3) throw new Error('the probe corpus is not 3 records');
      if (JSON.stringify(p.expected) === JSON.stringify(m.TIE_BREAK_PROBE_IDS)) throw new Error('the probe cannot tell id-order from build-order: they are the same list');
      console.log('TIEBREAK OK caught=1 falsePositives=0');
    }).catch((e) => { console.error(e.message); process.exit(1); });" \
    "$(cd "$ARC_ROOT" && node -e 'const {pathToFileURL}=require("node:url");const {resolve}=require("node:path");process.stdout.write(pathToFileURL(resolve(".claude/scripts/memory/lib/engines.mjs")).href)')"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"TIEBREAK OK caught=1 falsePositives=0"* ]]
  # ...and the CLI prints the assertion's RESULT beside the claim, not the claim alone.
  t="$(_gate_tree)"
  [ -n "$t" ] || { echo "the gate tree was not built"; false; }
  run node "$GOLDEN" --root "$t" --equivalence
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"tie-break probe on js: HELD"* ]]
  [[ "$output" == *"the tie-break probe HELD on 1 engine(s)"* ]]
}

@test "equivalence: auto resolves to the CANONICAL engine, never to whatever was registered last" {
  # `auto` returned `avail[avail.length - 1]` under the words "prefers the fastest available",
  # which encoded SPEED AS REGISTRATION ORDER: appending an engine would have made it the default
  # for every auto caller before any measurement said it was faster. ADR-0701's whole point is that
  # the accelerator earns its place on a number.
  run node -e "
    const u=process.argv[1];
    import(u).then(async (m) => {
      const js = m.ENGINES[0];
      const slow = { name: 'slow', available: () => true, run: js.run };
      const measured = { name: 'measured', available: () => true, fasterThanCanonical: true, run: js.run };
      const a = m.resolveEngine('auto', [js, slow]);
      const b = m.resolveEngine('auto', [slow, js]);
      if (a.name !== 'js' || b.name !== 'js') throw new Error('auto followed registration order: ' + a.name + '/' + b.name);
      // A MEASURED claim, and only a measured one, may take the default.
      const c = m.resolveEngine('auto', [js, measured]);
      if (c.name !== 'measured') throw new Error('a declared fasterThanCanonical engine was ignored');
      // An unavailable engine is never chosen, and auto still cannot resolve to nothing.
      const gone = { name: 'gone', available: () => { throw new Error('no module'); }, run: js.run };
      const d = m.resolveEngine('auto', [js, gone]);
      if (d.name !== 'js') throw new Error('auto chose an unavailable engine: ' + d.name);
      console.log('AUTO OK canonical-first');
    }).catch((e) => { console.error(e.message); process.exit(1); });" \
    "$(cd "$ARC_ROOT" && node -e 'const {pathToFileURL}=require("node:url");const {resolve}=require("node:path");process.stdout.write(pathToFileURL(resolve(".claude/scripts/memory/lib/engines.mjs")).href)')"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"AUTO OK canonical-first"* ]]
}

@test "golden gate: a flag-shaped --root is refused, so --gate cannot be eaten as its value" {
  # `golden-check --root --gate` consumed `--gate` as the root value, so THE GATE SILENTLY DID NOT
  # RUN and the failure named the wrong problem. It was loud by luck, never by rule. The three
  # sibling CLIs all carried this guard and this one did not -- twin-fix, again.
  run node "$GOLDEN" --root --gate
  [ "$status" -eq 2 ] || { echo "expected exit 2, got $status"; echo "$output"; false; }
  [[ "$output" == *"which is a flag, not a value"* ]]
  [[ "$output" == *"ate the next argument"* ]]
  # ...and the same shape with a flag that is not --gate, so the fix is the RULE and not one case.
  run node "$GOLDEN" --root --rank
  [ "$status" -eq 2 ]
  [[ "$output" == *"which is a flag, not a value"* ]]
}

@test "golden gate: an unusable alias file is operator error, not a raw node stack at the gate's own exit code" {
  # A DIRECTORY where docs/memory/aliases.md goes produced `errno: -4068, code: EISDIR` and a v24
  # banner at exit 1 -- and exit 1 is the code a REAL gate failure uses, so CI could not tell a
  # crash from a verdict. `parseAliases`, `checkAnchors` and `rank` all sat outside every try.
  t="$(_gate_tree)"
  [ -n "$t" ] || { echo "the gate tree was not built"; false; }
  rm -f "$t/docs/memory/aliases.md"
  mkdir -p "$t/docs/memory/aliases.md"
  [ -d "$t/docs/memory/aliases.md" ] || { echo "the EISDIR fixture was not built"; false; }
  run node "$GOLDEN" --root "$t" --gate
  [ "$status" -eq 2 ] || { echo "expected exit 2, got $status"; echo "$output"; false; }
  [[ "$output" == *"could not be read"* ]]
  # The Node banner and the errno must NOT be what the operator is shown...
  [[ "$output" != *"errno"* ]]
  # ...paired with a positive, because a crash would satisfy a bare does-not-contain.
  [[ "$output" == *"aliases.md"* ]]
}

@test "golden gate: an alias row it could not read is NAMED, never dropped into the count" {
  # ADR-0706's second embeddings trigger is counted off `parseAliases().rows`, and this caller took
  # `.rows` and let `.exclusions` fall on the floor -- the identical Phase-01 defect, fixed in
  # arc-recall and never made in the caller that FEEDS A GATE. A refused row silently lowers a
  # number the gate then reports as measured.
  t="$(_gate_tree)"
  [ -n "$t" ] || { echo "the gate tree was not built"; false; }
  printf '\n| four | cells | here | extra |\n' >> "$t/docs/memory/aliases.md"
  grep -q "extra" "$t/docs/memory/aliases.md" || { echo "the broken alias row was not planted"; false; }
  run node "$GOLDEN" --root "$t" --gate
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"could NOT be read and are excluded from the alias count"* ]]
  [[ "$output" == *"alias row has 4 columns"* ]]
}

@test "reader-lint: a filename with a space is SCANNED, and a file it cannot read is not called clean" {
  # `for f in $FILES` word-split on whitespace, so a planted bypass inside `bad file.mjs` reached
  # awk as two nonexistent paths and the lint exited 0 -- the pipeline's status was never read,
  # because an empty report was taken to mean clean. `.claude/rules/lanes.md` names the unquoted
  # shape verbatim; here it was the loop rather than a flag.
  local r="$BATS_TEST_TMPDIR/space"
  mkdir -p "$r/.claude/scripts/memory" "$r/.claude/scripts/review"
  cp "$ARC_ROOT/.claude/scripts/review/spine-reader-lint.sh" "$r/.claude/scripts/review/"
  printf 'export const Q = "events/a.jsonl";\n' > "$r/.claude/scripts/memory/bad file.mjs"
  [ -f "$r/.claude/scripts/memory/bad file.mjs" ] || { echo "the spaced-filename fixture was not built"; false; }
  git -C "$r" init -q .
  git -C "$r" config user.email "fixture@arc.test"
  git -C "$r" config user.name "arc fixture"
  git -C "$r" add -A
  git -C "$r" commit -qm fixture
  [ -n "$(git -C "$r" ls-files)" ] || { echo "nothing was tracked, so the lint would exit 0 on an empty glob"; false; }
  run bash -c "cd '$r' && bash .claude/scripts/review/spine-reader-lint.sh"
  [ "$status" -eq 1 ] || { echo "the planted bypass was not caught, status $status"; echo "$output"; false; }
  [[ "$output" == *"bad file.mjs"* ]]

  # COULD NOT SCAN is a different answer from SCANNED CLEAN, and both used to be exit 0.
  local g="$BATS_TEST_TMPDIR/gone"
  mkdir -p "$g/.claude/scripts/memory" "$g/.claude/scripts/review"
  cp "$ARC_ROOT/.claude/scripts/review/spine-reader-lint.sh" "$g/.claude/scripts/review/"
  printf 'export const OK = 1;\n' > "$g/.claude/scripts/memory/gone.mjs"
  git -C "$g" init -q .
  git -C "$g" config user.email "fixture@arc.test"
  git -C "$g" config user.name "arc fixture"
  git -C "$g" add -A
  git -C "$g" commit -qm fixture
  mv "$g/.claude/scripts/memory/gone.mjs" "$g/.claude/scripts/memory/gone.moved"
  [ ! -f "$g/.claude/scripts/memory/gone.mjs" ] || { echo "the unreadable fixture was not built"; false; }
  run bash -c "cd '$g' && bash .claude/scripts/review/spine-reader-lint.sh"
  [ "$status" -eq 1 ] || { echo "an unscannable file was reported clean, status $status"; echo "$output"; false; }
  [[ "$output" == *"could not be scanned at all"* ]]
}

@test "golden gate: bats registers every test this file declares" {
  # MEASURED, not asserted: bats silently DROPS a @test whose name carries a non-ASCII character.
  declared="$(grep -c '^@test ' "$BATS_TEST_FILENAME")"
  registered="$(bats --count "$BATS_TEST_FILENAME")"
  [ "$registered" -eq "$declared" ] || { echo "declared $declared, bats registered $registered"; false; }
  [ "$declared" -gt 7 ]
}
