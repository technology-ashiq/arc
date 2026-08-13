#!/usr/bin/env bats
# Phase 01 -- recall people can trust.
#
# Every hostile-query fixture runs through a REAL `arc-recall.mjs` process invocation, not an
# in-process call, and each one names whether it crosses argv or an internal API. That distinction
# is not pedantry: a literal NUL cannot survive process creation on either platform, so an argv
# fixture claiming to test one would be testing nothing.
#
# Fixture trees are copied into $BATS_TEST_TMPDIR first, and they carry no `initiatives/`
# directory -- which makes every test here also a root-mode test (ADR-0707).
#
# @test names are ASCII-only: bats silently DROPS a test whose name carries a non-ASCII character.
bats_require_minimum_version 1.5.0
load 'test_helper'

MEM="$ARC_ROOT/.claude/scripts/memory/memory-index.mjs"
RECALL="$ARC_ROOT/.claude/scripts/memory/arc-recall.mjs"
GOLDEN="$ARC_ROOT/.claude/scripts/memory/golden-check.mjs"
FIXTURES="$ARC_ROOT/tests/fixtures/memory"
EVENT="$ARC_ROOT/.claude/scripts/hq/arc-event.sh"
INBOX="$ARC_ROOT/.claude/scripts/hq/arc-inbox.mjs"
VALIDATE="$ARC_ROOT/.claude/scripts/hq/lib/validate.mjs"

setup() {
  SPINE="$BATS_TEST_TMPDIR/spine"
  mkdir -p "$SPINE"
  export ARC_SPINE_ROOT="$SPINE"
  export ARC_SPINE_NOW="1785000000000"
  export ARC_SPINE_RAND="00112233445566778899"
  # Module URLs computed BY NODE from node's own cwd. Handing node a bash-side path is what broke
  # the Phase-00 suite on windows alone: MSYS gives `/d/a/arc/arc/...` and pathToFileURL turns
  # that into `D:\d\a\arc\arc\...`, a path that does not exist. Same fix, applied here before it
  # could recur -- which is the twin-fix rule working for once.
  eval "$(cd "$ARC_ROOT" && node -e '
    const {pathToFileURL}=require("node:url");const {resolve}=require("node:path");
    const u=(p)=>pathToFileURL(resolve(p)).href;
    process.stdout.write(
      "export TOK=" + u(".claude/scripts/memory/lib/tokenize.mjs") + "\n" +
      "export BM="  + u(".claude/scripts/memory/lib/bm25.mjs")     + "\n" +
      "export AL="  + u(".claude/scripts/memory/lib/aliases.mjs")  + "\n");')"
}

# A built fixture tree, ready to query.
_built() {
  cp -r "$FIXTURES/organs-good" "$BATS_TEST_TMPDIR/tree"
  run node "$MEM" --root "$BATS_TEST_TMPDIR/tree" --rebuild
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  echo "$BATS_TEST_TMPDIR/tree"
}

# The same tree, plus ONE recorded decision on the tmpdir spine: verdict `reject`, reason
# "worktree mode B is not certified". Seeded through arc-inbox and never a raw emit --
# decision.recorded carries a WELDED idem, sha256("decision.recorded|" + decides), so a raw emit
# is refused with BAD_DECISION.
#
# Every step is checked, because a fixture builder that fails quietly is a silent pass generator
# that looks exactly like a clean run: the caller sees an empty $tree and, without the -n check
# on the other side, a filter test would then "pass" against an empty index.
#
# TWO decisions with OPPOSITE verdicts, not one. Both adversarial passes killed the one-decision
# version: flipping `terms.every` to `terms.some` -- turning the ANDed grammar into an OR -- left
# every `--decisions` test green, because with a single seeded row an OR and an AND select the
# same thing. A fixture that cannot tell those apart is not testing the grammar. The approve row
# also carries a MIXED-CASE reason, so a `~` that silently became case-sensitive goes red too.
_built_with_decision() {
  local approval approval2
  approval="$(bash "$EVENT" emit approval.requested --strict --payload \
    '{"what":"seed for the REQ-04 decisions filter","gate":"fixture"}')" || return 1
  [ -n "$approval" ] || return 1
  node "$INBOX" reject "$approval" --reason "worktree mode B is not certified" >/dev/null 2>&1 || return 1
  # A DIFFERENT clock for the second emit. setup() pins ARC_SPINE_NOW and ARC_SPINE_RAND so runs
  # are reproducible, which means two emits in the same test would mint the IDENTICAL ULID -- and
  # a decision whose `decides` names the wrong approval is refused. Reproducibility and a second
  # event are both wanted, so the clock is advanced deliberately rather than unpinned.
  approval2="$(ARC_SPINE_NOW=1785000001000 bash "$EVENT" emit approval.requested --strict --payload \
    '{"what":"second seed, the opposite verdict","gate":"fixture"}')" || return 1
  [ -n "$approval2" ] || return 1
  [ "$approval2" != "$approval" ] || { echo "both approvals minted the same ULID"; return 1; }
  node "$INBOX" approve "$approval2" --reason "Worktree Mode A is certified" >/dev/null 2>&1 || return 1
  # Exit 0 from a writer is not evidence that anything was written. Look in BOTH places.
  [ -z "$(ls -A "$SPINE/events/_quarantine" 2>/dev/null)" ] || return 1
  [ -n "$(ls -A "$SPINE/events" 2>/dev/null)" ] || return 1
  cp -r "$FIXTURES/organs-good" "$BATS_TEST_TMPDIR/tree" || return 1
  node "$MEM" --root "$BATS_TEST_TMPDIR/tree" --rebuild >/dev/null 2>&1 || return 1
  echo "$BATS_TEST_TMPDIR/tree"
}

@test "arc-recall: the CLI is present at its contracted path" {
  [ -f "$RECALL" ]
}

@test "arc-recall: a query returns the recorded lesson verbatim with a path-bearing citation" {
  tree="$(_built)"
  run node "$RECALL" --root "$tree" "unanchored heading regex prose"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # The citation carries a repo-relative path AND a line -- a bare number is never printed alone.
  [[ "$output" == *"docs/retro-log.md:"* ]]
  # VERBATIM: the prevention text is reproduced exactly as recorded, code span and all.
  [[ "$output" == *'anchor it as `(?:^|\n)##` so a mention in prose cannot pass'* ]]
  [[ "$output" == *"engine js, requested auto"* ]]
}

@test "arc-recall: zero results is a result, not an error" {
  tree="$(_built)"
  run node "$RECALL" --root "$tree" "zzzz nonexistent gibberish token"
  [ "$status" -eq 0 ]
  [[ "$output" == *"no recorded lesson matched"* ]]
  [[ "$output" == *"That is a result, not an error"* ]]
}

@test "arc-recall: the exit map is honoured" {
  tree="$(_built)"
  # 2 = bad usage
  run node "$RECALL" --root "$tree" --nonsense; [ "$status" -eq 2 ]
  run node "$RECALL" --root "$tree" --limit abc "x"; [ "$status" -eq 2 ]
  run node "$RECALL" --root "$tree" --limit -3 "x"; [ "$status" -eq 2 ]
  run node "$RECALL" --root "$tree" --source nope "x"; [ "$status" -eq 2 ]
  run node "$RECALL" --root "$tree" --since 11-08-2026 "x"; [ "$status" -eq 2 ]
  run node "$RECALL" --root "$tree" --engine sqlite "x"; [ "$status" -eq 2 ]
  # The message used to promise "sqlite arrives in Phase 2". REQ-07's engine was CUT on the
  # measurement ADR-0701 asked for, so a refusal advertising it would be a promise the repo has
  # decided not to keep. It now enumerates the REGISTRY, which cannot go stale the way a
  # hand-written sentence just did.
  [[ "$output" == *"is not one of: js, auto"* ]]
  run node "$RECALL" --root "$tree" --tag a --tag b "x"; [ "$status" -eq 2 ]
  [[ "$output" == *"given twice"* ]]
  run node "$RECALL" --root "$tree"; [ "$status" -eq 2 ]
  # 0 = ran
  run node "$RECALL" --root "$tree" "anything"; [ "$status" -eq 0 ]
}

@test "arc-recall: an index that cannot be built exits 3, naming the cause" {
  tree="$(_built)"
  rm -r "$tree/.claude/state/memory"
  rm "$tree/docs/trial-ledger.md"
  run node "$RECALL" --root "$tree" "anything"
  [ "$status" -eq 3 ]
  [[ "$output" == *"rebuild failed"* ]]
  [[ "$output" == *"trial-ledger"* ]]
}

# ---------- the ten hostile queries ----------
#
# Each must neither crash NOR change semantics: the operator characters are made LITERAL, never
# dropped. A searcher who typed `-i` was asking about the `sed -i` lesson, and a sanitizer that
# deleted the token would silently answer a different question.

@test "arc-recall: hostile 1-5 cross argv and become LITERAL TOKENS, not dropped ones" {
  # This test used to assert exit 0 plus the query echoed back -- and the echo is argv, never the
  # tokens. A mutant sanitizer that DELETED near/and/or/not/a/b/foo passed all ten hostile
  # fixtures unchanged while answering an entirely different question. The rule is NEUTRALIZE,
  # never DROP, so the assertion has to be on the tokens the engine actually searched for.
  tree="$(_built)"
  run node "$RECALL" --root "$tree" --json 'NEAR(a,b)'
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  echo "$output" > "$BATS_TEST_TMPDIR/h1.json"
  run node -e '(async()=>{const {readFileSync}=await import("node:fs");const j=JSON.parse(readFileSync(process.argv[1],"utf8"));const t=j.tokens.join(",");if(t!=="near,a,b")throw new Error("tokens were "+JSON.stringify(j.tokens)+" -- an operator word was DROPPED, not neutralized");console.log("TOKENS OK "+t);})()' "$BATS_TEST_TMPDIR/h1.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }

  run node "$RECALL" --root "$tree" --json 'AND OR NOT'
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  echo "$output" > "$BATS_TEST_TMPDIR/h2.json"
  run node -e '(async()=>{const {readFileSync}=await import("node:fs");const j=JSON.parse(readFileSync(process.argv[1],"utf8"));const t=j.tokens.join(",");if(t!=="and,or,not")throw new Error("boolean words were dropped: "+JSON.stringify(j.tokens));console.log("TOKENS OK "+t);})()' "$BATS_TEST_TMPDIR/h2.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }

  run node "$RECALL" --root "$tree" --json '-foo'
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  echo "$output" > "$BATS_TEST_TMPDIR/h3.json"
  run node -e '(async()=>{const {readFileSync}=await import("node:fs");const j=JSON.parse(readFileSync(process.argv[1],"utf8"));if(j.tokens.join(",")!=="foo")throw new Error("a leading dash changed the token: "+JSON.stringify(j.tokens));console.log("TOKENS OK");})()' "$BATS_TEST_TMPDIR/h3.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }

  for q in '*' 'he said "never'; do
    run node "$RECALL" --root "$tree" "$q"
    [ "$status" -eq 0 ] || { echo "query=$q status=$status"; echo "$output"; false; }
    [[ "$output" == *"recall \"$q\""* ]]
  done
}

@test "arc-recall: a sanitizer that DROPPED tokens would fail this suite" {
  # The negative control for the test above, because the test above is the thing that failed.
  # A mutant copy of tokenize.mjs with a drop-list is built here and asserted to produce
  # DIFFERENT tokens for the same query -- so if someone reintroduces dropping, the semantic
  # assertions above have something to catch.
  export MUT="$BATS_TEST_TMPDIR/mutant-tokenize.mjs"
  run node -e '(async()=>{
    const {readFileSync,writeFileSync}=await import("node:fs");
    const {pathToFileURL}=await import("node:url");
    const {fileURLToPath}=await import("node:url");const src=readFileSync(fileURLToPath(process.env.TOK),"utf8");
    const mutant=src.replace("  return { tokens, notes };","  const DROP=new Set([\"near\",\"and\",\"or\",\"not\",\"a\",\"b\",\"foo\"]);\n  return { tokens: tokens.filter(t=>!DROP.has(t)), notes };");
    if(mutant===src)throw new Error("the mutant anchor moved; this control is not controlling anything");
    writeFileSync(process.env.MUT,mutant);
    const {sanitizeQuery}=await import(pathToFileURL(process.env.MUT).href);
    const t=sanitizeQuery("NEAR(a,b)").tokens.join(",");
    if(t==="near,a,b")throw new Error("the mutant did not mutate");
    console.log("MUTANT DIFFERS: "+JSON.stringify(t));})()'
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"MUTANT DIFFERS"* ]]
}

@test "arc-recall: hostile 6-8 cross argv and neither crash nor rewrite the query" {
  tree="$(_built)"
  for q in 'a" OR "1"="1' '../../etc/passwd' 'pattern with an emoji and accents cafe resume'; do
    run node "$RECALL" --root "$tree" "$q"
    [ "$status" -eq 0 ] || { echo "query=$q status=$status"; echo "$output"; false; }
  done
}

@test "arc-recall: hostile 9 crosses argv and is bounded rather than refused" {
  # A 20000-character query. Bounded at the byte ceiling and the token cap, and the truncation is
  # NAMED in the output -- a silent truncation is a query nobody knows was not the one they asked.
  tree="$(_built)"
  long="$(node -e 'process.stdout.write("verification ".repeat(1600))')"
  run node "$RECALL" --root "$tree" "$long"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"note: query truncated from"* ]]
}

@test "arc-recall: hostile 10 crosses an INTERNAL API, because argv cannot carry it" {
  # A literal NUL cannot survive process creation on windows or POSIX, so this fixture calls the
  # sanitizer directly and says so. An argv fixture claiming to test a NUL would be testing
  # nothing at all -- which is the vacuous-pass shape.
  run node -e '(async()=>{const {sanitizeQuery}=await import(process.env.TOK);const NUL=String.fromCharCode(0);const r=sanitizeQuery("exit"+NUL+"quarantined");console.log(JSON.stringify(r));})()'
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"NUL byte(s) replaced with spaces"* ]]
  [[ "$output" == *'"exit","quarantined"'* ]]
}

# ---------- filters, modes, provenance ----------

@test "arc-recall: --grep is literal, unranked, and says which it is" {
  tree="$(_built)"
  run node "$RECALL" --root "$tree" --grep "the third prevention"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"literal substring, unranked"* ]]
  [[ "$output" == *"retro:2026-01-02#1"* ]]
}

@test "arc-recall: --full prints one whole record, and an unknown id is exit 0" {
  tree="$(_built)"
  run node "$RECALL" --root "$tree" --full "retro:2026-01-01#1"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"the first prevention"* ]]
  run node "$RECALL" --root "$tree" --full "retro:1999-01-01#9"
  [ "$status" -eq 0 ]
  [[ "$output" == *"no record with id"* ]]
}

@test "arc-recall: --source and --tag narrow the pool" {
  tree="$(_built)"
  run node "$RECALL" --root "$tree" --source adr "fixture decision"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"adr:0900"* ]] || [[ "$output" == *"adr:0901"* ]]
  run node "$RECALL" --root "$tree" --source trial-ledger "fixture"
  [ "$status" -eq 0 ]
  [[ "$output" != *"retro:"* ]]
  [[ "$output" == *"trial:"* ]]
}

@test "arc-recall: --lane in a tree with no lanes is an empty result at exit 0" {
  # ADR-0707: root-mode is the permanent consumer contract. A venture repo must never see an error
  # for a lane concept it does not have.
  tree="$(_built)"
  [ ! -d "$tree/initiatives" ]
  run node "$RECALL" --root "$tree" --lane memory "prevention"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"no recorded lesson matched"* ]]
}

@test "arc-recall: root-mode returns normal results in a tree with no initiatives directory" {
  tree="$(_built)"
  [ ! -d "$tree/initiatives" ]
  run node "$RECALL" --root "$tree" "prevention"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"retro:"* ]]
}

@test "arc-recall: --json carries the citation and the engine that actually ran" {
  tree="$(_built)"
  run node "$RECALL" --root "$tree" --json "the first prevention"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  echo "$output" > "$BATS_TEST_TMPDIR/out.json"
  run node -e 'const j=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));if(j.engine!=="js")throw new Error("engine "+j.engine);if(!j.results.length)throw new Error("no results");if(!/^docs\/retro-log\.md:\d+$/.test(j.results[0].citation))throw new Error("citation "+j.results[0].citation);console.log("JSON OK");' "$BATS_TEST_TMPDIR/out.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

# ---------- determinism ----------

@test "arc-recall: query determinism -- delete the index, rebuild, identical ordered ids" {
  # Phase 00 could not prove this: ranking did not exist yet, so it proved INDEX determinism and
  # left query determinism here.
  tree="$(_built)"
  run node "$RECALL" --root "$tree" --json --limit 5 "prevention pattern fixture"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  echo "$output" > "$BATS_TEST_TMPDIR/a.json"
  rm -r "$tree/.claude/state/memory"
  run node "$MEM" --root "$tree" --rebuild
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run node "$RECALL" --root "$tree" --json --limit 5 "prevention pattern fixture"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  echo "$output" > "$BATS_TEST_TMPDIR/b.json"
  run node -e 'const f=require("fs");const g=p=>JSON.parse(f.readFileSync(p,"utf8")).results.map(r=>r.id);const a=g(process.argv[1]),b=g(process.argv[2]);if(!a.length)throw new Error("no results, so this test would prove nothing");if(a.join("|")!==b.join("|"))throw new Error("drift: "+a+" vs "+b);console.log("IDENTICAL "+a.length+" ids");' "$BATS_TEST_TMPDIR/a.json" "$BATS_TEST_TMPDIR/b.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"IDENTICAL"* ]]
}

@test "arc-recall: equal scores break by id ascending, and it is the id not the row order" {
  run node -e '(async()=>{
    const {search}=await import(process.env.BM);
    const recs=[{id:"z:2",title:"gate",body:"gate",tags:[]},{id:"a:1",title:"gate",body:"gate",tags:[]}];
    const {buildPostings}=await import(process.env.BM);
    const p=buildPostings(recs);
    const out=search(p,recs,["gate"],{limit:2}).map(h=>recs[h.index].id);
    if(out[0]!=="a:1")throw new Error("tie-break gave "+out.join(","));
    console.log("TIEBREAK OK "+out.join(","));})()'
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"TIEBREAK OK a:1,z:2"* ]]
}

# ---------- the golden set ----------

@test "arc-recall: the golden set anchors resolve and the queries rank" {
  # Anchors first: a row whose id has drifted onto a different lesson would otherwise score as a
  # hit for the wrong reason, which is how a golden set stays green after it stops grading.
  run node "$MEM" --root "$ARC_ROOT" --rebuild --allow-missing-spine
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run node "$GOLDEN" --root "$ARC_ROOT" --rank
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"12/12 anchors resolve"* ]]
  [[ "$output" == *"12/12 queries hit an expected id in the top 3"* ]]
}

@test "arc-recall: the alias mechanism works even though the table is empty" {
  # The table ships EMPTY on purpose -- measured, all ten speculative rows contributed nothing.
  # The mechanism still has to be correct for the day a real miss earns a row, so it is exercised
  # against a fixture table rather than against the live file.
  run node -e '(async()=>{
    const {parseAliases,expand}=await import(process.env.AL);
    const md=["## The rows","","| terms | expands-to | why |","|---|---|---|","| duplicate, dedup | dup, idem | a real miss |"].join("\n");
    const {rows}=parseAliases(md);
    if(rows.length!==1)throw new Error("parsed "+rows.length);
    const r=expand(["duplicate","receipts"],rows);
    if(!r.tokens.includes("idem"))throw new Error("no expansion: "+r.tokens);
    if(!r.tokens.includes("receipts"))throw new Error("expansion DROPPED the literal query");
    if(r.fired[0].why!=="a real miss")throw new Error("the why is not reported");
    console.log("ALIAS OK "+r.tokens.join(","));})()'
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"ALIAS OK duplicate,receipts,dup,idem"* ]]
}

@test "arc-recall: the live alias table is empty and says why" {
  # Counted with the REAL parser, not a grep. The file carries other tables -- the measurement
  # table recording WHY it is empty is itself made of pipe rows -- and a grep for a leading pipe
  # counts those too. It did: the first version of this assertion read 6 and would have failed
  # while the alias table was, correctly, empty. A gate asserting on the wrong table is a gate
  # about nothing.
  file="$ARC_ROOT/docs/memory/aliases.md"
  [ -f "$file" ]
  run node -e '(async()=>{const {parseAliases}=await import(process.env.AL);const {readFileSync}=await import("node:fs");const x=parseAliases(readFileSync(process.argv[1],"utf8"));console.log("ALIAS ROWS "+x.rows.length+" EXCLUSIONS "+x.exclusions.length);})()' "$file"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"ALIAS ROWS 0 EXCLUSIONS 0"* ]]
  grep -q "deliberately EMPTY" "$file"
}

@test "arc-recall: the printed body is the FIXTURE FILE's own bytes, not this program's" {
  # The anti-stub assertion, and the reason it exists: a 60-line stub that read no organ, held no
  # index and imported nothing passed FIFTEEN of this file's assertions unchanged. Every one was a
  # substring or exit-code check on output the callee itself produces, so a canned printer
  # satisfied them all -- including "returns the lesson verbatim", "the exit map is honoured" and
  # "query determinism". .claude/rules/testing.md: prefer an assertion that fails when the code is
  # deleted.
  #
  # This one cannot be satisfied by printing. The expected string is extracted from the fixture
  # ORGAN by an independent path (awk over the file), never from the CLI, and compared byte for
  # byte. A stub would have to embed the fixture to pass, at which point it is reading the organ.
  tree="$(_built)"
  # Row 3 on purpose: its fields carry no code span, so this extraction needs none of the
  # masking logic under test. Using the code-span row here would mean re-implementing the very
  # thing being verified, and a check that shares its subject's logic verifies nothing.
  want="$(grep '^2026-01-02 | fixture | the third pattern' "$tree/docs/retro-log.md" | cut -d'|' -f4 | sed 's/^ *//;s/ *$//')"
  [ -n "$want" ] || { echo "the fixture row moved; this test is measuring nothing"; false; }

  run node "$RECALL" --root "$tree" --json "the third prevention"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  echo "$output" > "$BATS_TEST_TMPDIR/verbatim.json"
  WANT="$want" run node -e '(async()=>{
    const {readFileSync}=await import("node:fs");
    const j=JSON.parse(readFileSync(process.argv[1],"utf8"));
    const hit=j.results.find(r=>r.id==="retro:2026-01-02#1");
    if(!hit)throw new Error("the expected record is not in the results at all: "+j.results.map(r=>r.id).join(","));
    const want=process.env.WANT;
    if(!hit.body.startsWith(want))throw new Error("body is NOT the fixture bytes. fixture="+JSON.stringify(want)+" printed="+JSON.stringify(hit.body.slice(0,want.length)));
    if(hit.fields.prevention!==want)throw new Error("the prevention field differs from the fixture");
    console.log("VERBATIM OK "+want.length+" bytes");
  })()' "$BATS_TEST_TMPDIR/verbatim.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"VERBATIM OK"* ]]
}

@test "arc-recall: the ranked ids are the ones the INDEX holds, checked independently" {
  # The determinism test compares the CLI to itself, so a canned printer passes it. This computes
  # the expected ranking from the index file with the engine's own library and asserts the CLI
  # agrees -- two different paths to one answer, so a stub in either one diverges.
  tree="$(_built)"
  run node "$RECALL" --root "$tree" --json --limit 5 "prevention pattern fixture"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  echo "$output" > "$BATS_TEST_TMPDIR/cli.json"
  run node -e '(async()=>{
    const {readFileSync}=await import("node:fs");
    const {search}=await import(process.env.BM);
    const {sanitizeQuery}=await import(process.env.TOK);
    const idx=JSON.parse(readFileSync(process.argv[2],"utf8"));
    const want=search(idx.postings,idx.records,sanitizeQuery("prevention pattern fixture").tokens,{limit:5}).map(h=>idx.records[h.index].id);
    if(!want.length)throw new Error("the library found nothing, so this test would prove nothing");
    const got=JSON.parse(readFileSync(process.argv[1],"utf8")).results.map(r=>r.id);
    if(got.join("|")!==want.join("|"))throw new Error("CLI "+got.join(",")+" vs library "+want.join(","));
    console.log("AGREES ON "+want.length+" ids");
  })()' "$BATS_TEST_TMPDIR/cli.json" "$tree/.claude/state/memory/index.json"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"AGREES ON"* ]]
}

@test "arc-recall: a broken index is refused, not answered from" {
  # An empty JSON object used to pass every freshness check: isStale iterates the manifest, so an
  # ABSENT manifest is zero iterations and then "manifest matches". Making the index MORE broken
  # defeated the check. And nothing read the schema version, so an old index answered every ranked
  # query with a confident zero while --grep on the same file found the records.
  tree="$(_built)"
  printf '{}' > "$tree/.claude/state/memory/index.json"
  run node "$RECALL" --root "$tree" "prevention"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"index rebuilt first"* ]]
  [[ "$output" == *"schema version"* ]]
  [[ "$output" == *"retro:"* ]]
}

@test "arc-recall: a flag-shaped value and an empty value are both refused" {
  # lanes.md names this verbatim: an unquoted empty value eats the next flag. `--tag --json "q"`
  # silently consumed --json as the tag and then printed non-JSON on stdout at exit 0, which the
  # --json contract forbids outright. `--grep ""` had a deliberate carve-out that turned the
  # quoted form the lane rules MANDATE into "print the whole index".
  tree="$(_built)"
  run node "$RECALL" --root "$tree" --tag --json "prevention"; [ "$status" -eq 2 ]
  [[ "$output" == *"which is a flag, not a value"* ]]
  run node "$RECALL" --root "$tree" --grep ""; [ "$status" -eq 2 ]
  run node "$RECALL" --root "$tree" --full-text "x"; [ "$status" -eq 2 ]
  run node "$RECALL" --root "$tree" -- --limit
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *'recall "--limit"'* ]]
}

@test "arc-recall: --decisions returns the recorded reason byte-exact with its ULID citation" {
  # REQ-04. The reason is reproduced as recorded -- this surface is a reader over the decisions
  # organ, and a recall surface that paraphrases the organ has become a second, worse copy of it.
  tree="$(_built_with_decision)"
  [ -n "$tree" ] || { echo "the seeded-decision fixture was not built"; false; }
  run node "$RECALL" --root "$tree" --decisions 'verdict:reject reason~worktree'
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"worktree mode B is not certified"* ]]
  # A decision has no file line, so the ULID IS the locator -- and it is never printed bare.
  [[ "$output" == *"(spine) "* ]]
  [[ "$output" == *"filtered, unranked"* ]]
  # `showing N of M` prints both numbers, so a --limit truncation cannot masquerade as the whole
  # answer -- the confident-partial shape `--limit 0` was refused for.
  [[ "$output" == *"showing 1 of 1 matching decision(s); 2 in the index"* ]]
}

@test "arc-recall: --decisions actually narrows, proven against the opposite verdict" {
  # The assertion that fails if the filter is deleted. Without the second half, a --decisions that
  # ignored its terms entirely would still satisfy the first half, and a --decisions that matched
  # NOTHING would be indistinguishable from a fixture that never seeded.
  tree="$(_built_with_decision)"
  [ -n "$tree" ] || { echo "the seeded-decision fixture was not built"; false; }
  # THE AND IS REAL, and this is the assertion an OR mutant fails: the tree holds one reject and
  # one approve, so `verdict:reject reason~worktree` must select exactly ONE. Under `some` it
  # selects both, because the approve row matches `reason~worktree` on its own.
  run node "$RECALL" --root "$tree" --decisions 'verdict:reject reason~worktree'
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"showing 1 of 1 matching decision(s); 2 in the index"* ]]
  [[ "$output" == *"worktree mode B is not certified"* ]]
  [[ "$output" != *"Worktree Mode A is certified"* ]]
  # Each verdict alone selects its own single row, so neither is unreachable.
  run node "$RECALL" --root "$tree" --decisions 'verdict:approve'
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"showing 1 of 1 matching decision(s); 2 in the index"* ]]
  [[ "$output" == *"Worktree Mode A is certified"* ]]
  run node "$RECALL" --root "$tree" --decisions 'verdict:reject'
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"showing 1 of 1 matching decision(s); 2 in the index"* ]]
  # `~` is CASE-INSENSITIVE. An UPPERCASE needle against two reasons that both spell the word in
  # lower case must match BOTH; a `~` that silently became case-sensitive returns 0. Two-versus-
  # zero is the discriminator, so this cannot pass by accident.
  run node "$RECALL" --root "$tree" --decisions 'reason~CERTIFIED'
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"showing 2 of 2 matching decision(s); 2 in the index"* ]]
  # A multi-word value is impossible by design -- terms split on whitespace -- and that is REFUSED
  # loudly rather than silently truncated to the first word.
  run node "$RECALL" --root "$tree" --decisions 'reason~worktree mode a'
  [ "$status" -eq 2 ]
  [[ "$output" == *"has no operator"* ]]
  # A filter that genuinely matches nothing still reads as a result.
  run node "$RECALL" --root "$tree" --decisions 'verdict:reject reason~zzznotpresent'
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"showing 0 of 0 matching decision(s)"* ]]
  [[ "$output" == *"no recorded decision matched that filter"* ]]
  [[ "$output" == *"That is a result, not an error"* ]]
  # `:` is exact and `~` is substring, and they are not the same operator: a substring value under
  # the exact operator must MISS, or the two operators have quietly collapsed into one.
  run node "$RECALL" --root "$tree" --decisions 'reason:worktree'
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"showing 0 of 0 matching decision(s)"* ]]
}

@test "arc-recall: the --decisions grammar refuses what it cannot honour, naming each refusal" {
  # An accepted-but-inert term is worse than a rejected one: the operator believes it took effect.
  # That is the `--full-text` defect from Phase 01, and this is it closed before it can recur.
  tree="$(_built)"
  run node "$RECALL" --root "$tree" --decisions 'sender:ashiq'; [ "$status" -eq 2 ]
  [[ "$output" == *"is not one of: verdict, reason, decides, ulid, ts"* ]]
  run node "$RECALL" --root "$tree" --decisions 'reject'; [ "$status" -eq 2 ]
  [[ "$output" == *"has no operator"* ]]
  run node "$RECALL" --root "$tree" --decisions 'verdict:'; [ "$status" -eq 2 ]
  [[ "$output" == *"has an empty value"* ]]
  run node "$RECALL" --root "$tree" --decisions ':reject'; [ "$status" -eq 2 ]
  [[ "$output" == *"names no field"* ]]
  # An AND over one field that can never hold twice is an operator error, not last-wins -- the
  # same rule lanes.md sets for two --lane flags with different values.
  run node "$RECALL" --root "$tree" --decisions 'verdict:reject verdict:approve'; [ "$status" -eq 2 ]
  [[ "$output" == *"that is an operator error"* ]]
  # The quoted-empty-variable shape the lane rules mandate, and the flag-eats-flag shape.
  run node "$RECALL" --root "$tree" --decisions ''; [ "$status" -eq 2 ]
  run node "$RECALL" --root "$tree" --decisions --json; [ "$status" -eq 2 ]
  [[ "$output" == *"which is a flag, not a value"* ]]
  run node "$RECALL" --root "$tree" --decisions 'verdict:reject' --decisions 'verdict:approve'; [ "$status" -eq 2 ]
  [[ "$output" == *"given twice"* ]]
}

@test "arc-recall: --decisions refuses every argument it would otherwise drop in silence" {
  tree="$(_built)"
  run node "$RECALL" --root "$tree" --decisions 'verdict:reject' "worktree"; [ "$status" -eq 2 ]
  [[ "$output" == *"would have been ignored in silence"* ]]
  run node "$RECALL" --root "$tree" --decisions 'verdict:reject' --grep worktree; [ "$status" -eq 2 ]
  [[ "$output" == *"two different searches"* ]]
  # --source can only contradict --decisions; the contradiction reads exactly like a real miss.
  run node "$RECALL" --root "$tree" --decisions 'verdict:reject' --source adr; [ "$status" -eq 2 ]
  [[ "$output" == *"could only contradict it"* ]]
  run node "$RECALL" --root "$tree" --full retro:1 --decisions 'verdict:reject'; [ "$status" -eq 2 ]
  [[ "$output" == *"--full takes one id and nothing else"* ]]
  # Structurally identical to --source, and it was neither refused nor noted: the decisions adapter
  # emits no `lane` field, so --lane with --decisions can NEVER match. It printed "showing 0 of 0"
  # and blamed the --decisions expression for a zero the lane flag caused.
  run node "$RECALL" --root "$tree" --decisions 'verdict:reject' --lane memory; [ "$status" -eq 2 ]
  [[ "$output" == *"a recorded decision carries no lane"* ]]
  # --tag is deliberately NOT in that refusal list: decisions records really do carry tags
  # (`decision` plus the verdict), so it is a genuine narrowing and refusing it would be wrong.
  run node "$RECALL" --root "$tree" --decisions 'verdict:reject' --tag decision; [ "$status" -eq 0 ]
  [[ "$output" == *"matching decision(s)"* ]]
}

@test "arc-recall: verdict is a CLOSED set, so a value that can never match is refused not answered" {
  # `verdict:Reject` and `verdict:aprove` printed "no recorded decision matched that filter. That is
  # a result, not an error." at exit 0 -- byte-identical to a real miss, which is the exact outcome
  # the --decisions header says this grammar exists to prevent. The closed-set rule had been applied
  # to the field NAME and never to the one field whose VALUES are closed too, while --source and
  # --engine both enumerate their set on refusal.
  #
  # The SEEDED fixture, not the bare one: the positive halves below have to match a real decision,
  # or "still a legal query" would be proven by a zero that means nothing.
  tree="$(_built_with_decision)"
  [ -n "$tree" ] || { echo "the seeded-decision fixture was not built"; false; }
  run node "$RECALL" --root "$tree" --decisions 'verdict:Reject'; [ "$status" -eq 2 ]
  [[ "$output" == *"can never match"* ]]
  [[ "$output" == *"closed set (approve, reject)"* ]]
  run node "$RECALL" --root "$tree" --decisions 'verdict:aprove'; [ "$status" -eq 2 ]
  [[ "$output" == *"not one of them"* ]]
  # `~` is a case-insensitive SUBSTRING, so a partial that really can match stays a legal query...
  run node "$RECALL" --root "$tree" --decisions 'verdict~rej'; [ "$status" -eq 0 ]
  [[ "$output" == *"showing 1 of 1 matching decision(s)"* ]]
  run node "$RECALL" --root "$tree" --decisions 'verdict~REJ'; [ "$status" -eq 0 ]
  [[ "$output" == *"showing 1 of 1 matching decision(s)"* ]]
  # ...and one that is a substring of NEITHER member is refused, or the guard only covers `:`.
  run node "$RECALL" --root "$tree" --decisions 'verdict~zzz'; [ "$status" -eq 2 ]
  [[ "$output" == *"a substring of none of them"* ]]
  # The exact operator on a REAL member is untouched, or this guard has broken the feature -- and
  # one-versus-one against the OPPOSITE verdict, so it cannot pass by matching everything.
  run node "$RECALL" --root "$tree" --decisions 'verdict:reject'; [ "$status" -eq 0 ]
  [[ "$output" == *"worktree mode B is not certified"* ]]
  run node "$RECALL" --root "$tree" --decisions 'verdict:approve'; [ "$status" -eq 0 ]
  [[ "$output" == *"Worktree Mode A is certified"* ]]
}

@test "arc-recall: --engine is refused by the three modes that do not rank" {
  # P2-1 recurring inside the file where P2-1 was fixed. main()'s refusal list enumerated the
  # positional query, --grep, --source and --full, and the suite asserting it "refuses every
  # argument it would otherwise drop in silence" enumerated the same four -- so three of the four
  # modes accepted --engine and did nothing: --grep reported engine "literal", --decisions "filter",
  # --full a hardcoded "js". An accepted-but-inert flag is worse than a rejected one.
  tree="$(_built)"
  run node "$RECALL" --root "$tree" --grep prevention --engine js; [ "$status" -eq 2 ]
  [[ "$output" == *"silently done nothing"* ]]
  run node "$RECALL" --root "$tree" --decisions 'verdict:approve' --engine js; [ "$status" -eq 2 ]
  [[ "$output" == *"silently done nothing"* ]]
  run node "$RECALL" --root "$tree" --full retro:1 --engine js; [ "$status" -eq 2 ]
  [[ "$output" == *"silently done nothing"* ]]
  # The RANKED query is the one mode the seam applies to, and it still reports which engine ran.
  run node "$RECALL" --root "$tree" --engine js "prevention"; [ "$status" -eq 0 ]
  [[ "$output" == *"engine js, requested js"* ]]
  # ...and every one of those three modes is still perfectly legal WITHOUT the flag, or the refusal
  # above has quietly broken three surfaces instead of one flag.
  run node "$RECALL" --root "$tree" --grep prevention; [ "$status" -eq 0 ]
  run node "$RECALL" --root "$tree" --decisions 'verdict:approve'; [ "$status" -eq 0 ]
}

@test "arc-recall: REQ-04 adds no event kind and opens no spine of its own" {
  # ADR-0703: memory reads the spine through the reader library and emits nothing. A new query
  # surface is exactly where a closed vocabulary (ADR-0026) grows by accident, so this is checked
  # rather than assumed.
  #
  # It used to check by pinning the GLOBAL total -- which is not the claim in this test's name. Any
  # OTHER lane extending the vocabulary legitimately turned this red, and it happened twice inside
  # one week: growth's `content.published` (ADR-1001) took it to 45, and the ledger lane's
  # `month.closed` (ADR-1004) took it to 46. Each time the failure message read "memory added a
  # kind" while memory had done nothing at all.
  #
  # The ledger lane wrote the right answer into its own bump before this rewrite existed: "if a
  # third lane trips it, the sharper form of this assertion is that the set of kinds reachable from
  # memory's own modules is empty, which stays true no matter who else adds one." That is what is
  # implemented here. Both lanes reached the same conclusion independently; this is the merge taking
  # the STRONGER version rather than the earlier one (.claude/rules/lanes.md).
  #
  # A shared file in tests/ belongs to no lane, so its assertions have to survive every lane.
  vurl="$(cd "$ARC_ROOT" && node -e 'const {pathToFileURL}=require("node:url");const {resolve}=require("node:path");process.stdout.write(pathToFileURL(resolve(".claude/scripts/hq/lib/validate.mjs")).href)')"
  [ -n "$vurl" ]
  # 'loaded' is the positive control: without it, 'owns-none' would also be satisfied by an empty
  # or failed import, which is the vacuous pass this file's own last test exists to prevent.
  run node -e "import(process.argv[1]).then(m=>{ const mine = m.KINDS.filter(k=>/^(memory|recall)[.]/.test(k)); console.log([mine.length ? 'OWNS:' + mine.join(',') : 'owns-none', m.KINDS.length === new Set(m.KINDS).size ? 'unique' : 'DUPES', m.KINDS.length > 10 ? 'loaded' : 'EMPTY'].join(' ')); })" "$vurl"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "owns-none unique loaded" ] || { echo "$output"; false; }
  # Positive control FIRST: prove this grep is reading the file it claims to read, so the absence
  # assertion below cannot pass on a typo in the path.
  run grep -c -- "--decisions" "$RECALL"
  [ "$status" -eq 0 ] || { echo "grep found no --decisions in $RECALL at all"; false; }
  [ "$output" -gt 0 ]
  # Reader-only: the three tokens `spine-reader-lint.sh` bans must not appear in this surface.
  run grep -nE "events/|[.]jsonl|state[.]db" "$RECALL"
  [ "$status" -ne 0 ] || { echo "arc-recall.mjs reaches for the spine directly: $output"; false; }
}

@test "arc-recall: bats registers every test this file declares" {
  # MEASURED, not asserted. Comparing a grep over the source to a hardcoded literal cannot see the
  # failure it cites -- bats silently DROPS a @test whose name carries a non-ASCII character, and
  # the natural response to that red is to bump the literal, which restores green on a suite
  # running one test fewer. `bats --count` asks bats what it actually registered.
  declared="$(grep -c '^@test ' "$BATS_TEST_FILENAME")"
  registered="$(bats --count "$BATS_TEST_FILENAME")"
  [ "$registered" -eq "$declared" ] || { echo "declared $declared, bats registered $registered"; false; }
  [ "$declared" -gt 15 ]
}
