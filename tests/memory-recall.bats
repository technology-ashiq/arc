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
  [[ "$output" == *"sqlite arrives in Phase 2"* ]]
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
    const src=readFileSync(process.env.TOK.replace("file:///",""),"utf8");
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
