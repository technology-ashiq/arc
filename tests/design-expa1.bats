#!/usr/bin/env bats
# design Phase 04 (EXP-A1; ADR-1400, ADR-1416, ADR-0070): the seal over model-policy's sealed
# bundle and the session-authored prediction, its FAILING control (one byte flipped in a scratch
# copy, exit status read directly), the thesis pairs, and the per-pair report.
bats_require_minimum_version 1.5.0
load 'test_helper'

teardown() { _arc_teardown; }

_explore() { echo "$SANDBOX/.claude/scripts/design/design-explore.sh"; }

# An explore `ex1` with three directed theses, the real ADR-1416 and a two-file stand-in for the
# model-policy bundle. Asserts its own fixture before any case leans on it.
_fixture() {
  _arc_design_sandbox
  cd "$SANDBOX" || return 1
  mkdir -p docs/adr docs/design/explore/ex1 initiatives/model-policy/evidence/phase-02/blind
  cp "$ARC_ROOT"/docs/adr/1416-the-exp-a1-prediction-is-session-authored-on-the-owners-delegation.md docs/adr/
  printf 'sealed key\n' > initiatives/model-policy/evidence/phase-02/SEALED-key.md
  printf 'png-one' > initiatives/model-policy/evidence/phase-02/blind/item-1.png
  printf 'abc1234def5678\n' > docs/design/explore/ex1/base-revision.txt
  local v
  for v in a b c; do
    mkdir -p "docs/design/explore/ex1/variant-$v"
    printf 'thesis %s: a structure\n' "$v" > "docs/design/explore/ex1/variant-$v/thesis.txt"
  done
  [ -s docs/adr/1416-the-exp-a1-prediction-is-session-authored-on-the-owners-delegation.md ] || { echo "fixture: no ADR-1416"; return 1; }
  [ -s initiatives/model-policy/evidence/phase-02/SEALED-key.md ] || { echo "fixture: no bundle"; return 1; }
}

_seal_file() { echo "$SANDBOX/initiatives/design/evidence/phase-04/seal-ex1.json"; }

@test "seal: hashes every bundle file and copies ADR-1416's prediction with its authorship" {
  _fixture
  run bash "$(_explore)" seal ex1
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"2 bundle file(s) hashed"* ]] || { echo "$output"; false; }
  [ -f "$(_seal_file)" ] || { echo "no seal written"; false; }
  grep -q '"SEALED-key.md"' "$(_seal_file)"
  grep -q '"blind/item-1.png"' "$(_seal_file)"
  grep -q 'Balanced-workhorse holds' "$(_seal_file)" || { echo "the prediction text was not copied: $(cat "$(_seal_file)")"; false; }
  grep -q 'session-authored' "$(_seal_file)"
  grep -q '"minMeanGap": 10' "$(_seal_file)"
}

@test "seal: refused once a variant has a page, and refused a second time" {
  _fixture
  printf '<main>a</main>\n' > docs/design/explore/ex1/variant-a/index.html
  run bash "$(_explore)" seal ex1
  [ "$status" -eq 1 ]
  [[ "$output" == *"sealed before the run, not after it"* ]] || { echo "$output"; false; }
  [ ! -e "$(_seal_file)" ]
  rm docs/design/explore/ex1/variant-a/index.html
  run bash "$(_explore)" seal ex1
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run bash "$(_explore)" seal ex1
  [ "$status" -eq 1 ]
  [[ "$output" == *"already exists"* ]] || { echo "$output"; false; }
}

@test "seal-check: THE FAILING CONTROL -- one byte flipped in a scratch copy exits 1, read directly; the real bundle exits 0" {
  _fixture
  run bash "$(_explore)" seal ex1
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local scratch="$BATS_TEST_TMPDIR/bundle-copy"
  cp -R initiatives/model-policy/evidence/phase-02 "$scratch"
  printf 'sealed kez\n' > "$scratch/SEALED-key.md"
  # Status read directly, never through a pipe: verify | tail once reported 0 over TAMPERED.
  local st=0
  bash "$(_explore)" seal-check ex1 --bundle "$scratch" > "$BATS_TEST_TMPDIR/flip.out" 2>&1 || st=$?
  [ "$st" -eq 1 ] || { echo "a flipped byte exited $st: $(cat "$BATS_TEST_TMPDIR/flip.out")"; false; }
  grep -q 'TAMPERED -- 1 difference(s).*changed SEALED-key.md' "$BATS_TEST_TMPDIR/flip.out" || { cat "$BATS_TEST_TMPDIR/flip.out"; false; }
  st=0
  bash "$(_explore)" seal-check ex1 > "$BATS_TEST_TMPDIR/real.out" 2>&1 || st=$?
  [ "$st" -eq 0 ] || { echo "the untouched bundle exited $st: $(cat "$BATS_TEST_TMPDIR/real.out")"; false; }
  grep -q '2 file(s) match the seal' "$BATS_TEST_TMPDIR/real.out"
}

@test "seal-check: an added file and a missing file are each a difference" {
  _fixture
  run bash "$(_explore)" seal ex1
  [ "$status" -eq 0 ]
  printf 'x' > initiatives/model-policy/evidence/phase-02/extra.md
  run bash "$(_explore)" seal-check ex1
  [ "$status" -eq 1 ]
  [[ "$output" == *"added extra.md"* ]] || { echo "$output"; false; }
  rm initiatives/model-policy/evidence/phase-02/extra.md initiatives/model-policy/evidence/phase-02/blind/item-1.png
  run bash "$(_explore)" seal-check ex1
  [ "$status" -eq 1 ]
  [[ "$output" == *"missing blind/item-1.png"* ]] || { echo "$output"; false; }
}

@test "pair: copies the thesis byte-for-byte, names tiers not models, and refuses without a seal" {
  _fixture
  run bash "$(_explore)" pair ex1 --from a --to d --from-arm balanced-workhorse --to-arm high-judgment
  [ "$status" -eq 1 ]
  [[ "$output" == *"no seal"* ]] || { echo "$output"; false; }
  run bash "$(_explore)" seal ex1
  [ "$status" -eq 0 ]
  run bash "$(_explore)" pair ex1 --from a --to d --from-arm balanced-workhorse --to-arm opus
  [ "$status" -eq 1 ]
  [[ "$output" == *"router tier"* ]] || { echo "$output"; false; }
  run bash "$(_explore)" pair ex1 --from a --to d --from-arm high-judgment --to-arm high-judgment
  [ "$status" -eq 1 ]
  run bash "$(_explore)" pair ex1 --from a --to d --from-arm balanced-workhorse --to-arm high-judgment
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  cmp docs/design/explore/ex1/variant-a/thesis.txt docs/design/explore/ex1/variant-d/thesis.txt
  grep -q '"toArm": "high-judgment"' docs/design/explore/ex1/pairs.json
  grep -q '"base": "abc1234def5678"' docs/design/explore/ex1/pairs.json
  run bash "$(_explore)" pair ex1 --from a --to e --from-arm balanced-workhorse --to-arm high-judgment
  [ "$status" -eq 1 ]
  [[ "$output" == *"already in a pair"* ]] || { echo "$output"; false; }
}

@test "compose: a paired variant whose thesis moved, or a bundle that changed, arms nothing" {
  _fixture
  run bash "$(_explore)" seal ex1
  [ "$status" -eq 0 ]
  run bash "$(_explore)" pair ex1 --from a --to d --from-arm balanced-workhorse --to-arm high-judgment
  [ "$status" -eq 0 ]
  printf 'a different thesis\n' > docs/design/explore/ex1/variant-d/thesis.txt
  run bash "$(_explore)" compose ex1 --variant d
  [ "$status" -eq 1 ]
  [[ "$output" == *"thesis moved"* ]] || { echo "$output"; false; }
  [ ! -e .claude/state/design/composer-session--ex1--variant-d ]
  cp docs/design/explore/ex1/variant-a/thesis.txt docs/design/explore/ex1/variant-d/thesis.txt
  printf 'tampered\n' >> initiatives/model-policy/evidence/phase-02/SEALED-key.md
  run bash "$(_explore)" compose ex1 --variant b
  [ "$status" -eq 1 ]
  [[ "$output" == *"TAMPERED"* ]] || { echo "$output"; false; }
  [ ! -e .claude/state/design/composer-session--ex1--variant-b ]
}

@test "compose: the guard passes a paired variant whose thesis and bundle are intact -- the control" {
  _fixture
  run bash "$(_explore)" seal ex1
  [ "$status" -eq 0 ]
  run bash "$(_explore)" pair ex1 --from a --to d --from-arm balanced-workhorse --to-arm high-judgment
  [ "$status" -eq 0 ]
  run node .claude/scripts/design/design-expa1.mjs pair-guard --root "$SANDBOX" --id ex1 --variant d
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"variant-d is the high-judgment arm"* ]] || { echo "$output"; false; }
}

@test "exp-a1: reports each pair from the owner's blind score and applies the pre-registered formula" {
  _fixture
  run bash "$(_explore)" seal ex1
  [ "$status" -eq 0 ]
  local p
  for p in "a d" "b e" "c f"; do
    set -- $p
    run bash "$(_explore)" pair ex1 --from "$1" --to "$2" --from-arm balanced-workhorse --to-arm high-judgment
    [ "$status" -eq 0 ] || { echo "$output"; false; }
  done
  mkdir -p .claude/state/design/explore/ex1/jury
  local scored; scored="$(node -e 'console.log(new Date(Date.now()+60000).toISOString())')"
  cat > .claude/state/design/explore/ex1/jury/unblind.json <<EOF
{"id":"ex1","scored":"$scored","rows":[
 {"label":"item-a","kind":"variant","source":"variant-a","score":50},
 {"label":"item-b","kind":"variant","source":"variant-d","score":70},
 {"label":"item-c","kind":"variant","source":"variant-b","score":40},
 {"label":"item-d","kind":"variant","source":"variant-e","score":55},
 {"label":"item-e","kind":"variant","source":"variant-c","score":60},
 {"label":"item-f","kind":"variant","source":"variant-f","score":58}]}
EOF
  run bash "$(_explore)" exp-a1 ex1
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"high-judgment won 2/3 pairs, mean gap 11.0"* ]] || { echo "$output"; false; }
  [[ "$output" == *"formula gain half MET"* ]] || { echo "$output"; false; }
  [[ "$output" == *"owner's explicit cost/time acceptance"* ]] || { echo "$output"; false; }
  # The same pairs one point short of the gap: NOT MET.
  sed -i.bak 's/"score":70/"score":67/' .claude/state/design/explore/ex1/jury/unblind.json
  run bash "$(_explore)" exp-a1 ex1
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"mean gap 10.0"* ]] || { echo "$output"; false; }
  sed -i.bak 's/"score":67/"score":66/' .claude/state/design/explore/ex1/jury/unblind.json
  run bash "$(_explore)" exp-a1 ex1
  [[ "$output" == *"formula gain half NOT MET"* ]] || { echo "$output"; false; }
  [[ "$output" == *"no promotion"* ]] || { echo "$output"; false; }
}

@test "exp-a1: a seal dated after the owner's score is not a prediction" {
  _fixture
  run bash "$(_explore)" seal ex1
  [ "$status" -eq 0 ]
  run bash "$(_explore)" pair ex1 --from a --to d --from-arm balanced-workhorse --to-arm high-judgment
  [ "$status" -eq 0 ]
  mkdir -p .claude/state/design/explore/ex1/jury
  printf '{"id":"ex1","scored":"2020-01-01T00:00:00.000Z","rows":[{"source":"variant-a","score":1},{"source":"variant-d","score":2}]}\n' > .claude/state/design/explore/ex1/jury/unblind.json
  run bash "$(_explore)" exp-a1 ex1
  [ "$status" -eq 1 ]
  [[ "$output" == *"not a prediction"* ]] || { echo "$output"; false; }
}

@test "attack fab6c70: a sealed explore with pairs.json deleted arms nothing, a lowered formula is refused, a duplicate row is refused, a device name is refused" {
  _fixture
  run bash "$(_explore)" seal ex1
  [ "$status" -eq 0 ]
  run bash "$(_explore)" pair ex1 --from a --to d --from-arm balanced-workhorse --to-arm high-judgment
  [ "$status" -eq 0 ]
  # B3: deleting the pairs file must not switch the guard off for a sealed explore.
  rm docs/design/explore/ex1/pairs.json
  run bash "$(_explore)" compose ex1 --variant a
  [ "$status" -eq 1 ]
  [[ "$output" == *"sealed for EXP-A1 and has no pairs.json"* ]] || { echo "$output"; false; }
  [ ! -e .claude/state/design/composer-session--ex1--variant-a ]
  run bash "$(_explore)" pair ex1 --from a --to d --from-arm balanced-workhorse --to-arm high-judgment
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # L3 L4 B10: a seal whose bar was lowered by hand is refused, not believed.
  cp "$(_seal_file)" "$BATS_TEST_TMPDIR/seal.bak"
  sed -i.bak 's/"minMeanGap": 10/"minMeanGap": 0/' "$(_seal_file)"
  grep -q '"minMeanGap": 0' "$(_seal_file)" || { echo "the lowered-formula fixture did not take"; false; }
  run bash "$(_explore)" seal-check ex1
  [ "$status" -eq 1 ]
  [[ "$output" == *"not the pre-registered one"* ]] || { echo "$output"; false; }
  cp "$BATS_TEST_TMPDIR/seal.bak" "$(_seal_file)"
  # L6 B6: two rows for one variant is not a record.
  mkdir -p .claude/state/design/explore/ex1/jury
  local scored; scored="$(node -e 'console.log(new Date(Date.now()+60000).toISOString())')"
  printf '{"id":"ex1","scored":"%s","rows":[{"source":"variant-a","score":40},{"source":"variant-d","score":90},{"source":"variant-d","score":10}]}\n' "$scored" > .claude/state/design/explore/ex1/jury/unblind.json
  run bash "$(_explore)" exp-a1 ex1
  [ "$status" -eq 1 ]
  [[ "$output" == *"variant-d has 2 rows"* ]] || { echo "$output"; false; }
  # B4: a Windows device name passes the grammar and must still be refused.
  run node .claude/scripts/design/design-expa1.mjs seal --root "$SANDBOX" --id nul
  [ "$status" -eq 1 ]
  [[ "$output" == *"reserved device name"* ]] || { echo "$output"; false; }
}

@test "attack 67551f8: a pair whose FROM side already composed is refused, a seal without its prediction is refused, a moved thesis fails the report" {
  _fixture
  run bash "$(_explore)" seal ex1
  [ "$status" -eq 0 ]
  printf '<main>b</main>\n' > docs/design/explore/ex1/variant-b/index.html
  run bash "$(_explore)" pair ex1 --from b --to e --from-arm balanced-workhorse --to-arm high-judgment
  [ "$status" -eq 1 ]
  [[ "$output" == *"variant-b already has a page"* ]] || { echo "$output"; false; }
  [ ! -e docs/design/explore/ex1/variant-e/thesis.txt ]
  run bash "$(_explore)" pair ex1 --from a --to d --from-arm balanced-workhorse --to-arm high-judgment
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # B4: the report re-hashes each paired thesis before it reads a score.
  mkdir -p .claude/state/design/explore/ex1/jury
  local scored; scored="$(node -e 'console.log(new Date(Date.now()+60000).toISOString())')"
  printf '{"id":"ex1","scored":"%s","rows":[{"source":"variant-a","score":40},{"source":"variant-d","score":90}]}\n' "$scored" > .claude/state/design/explore/ex1/jury/unblind.json
  run bash "$(_explore)" exp-a1 ex1
  [ "$status" -eq 0 ] || { echo "the intact control failed: $output"; false; }
  printf 'moved\n' >> docs/design/explore/ex1/variant-d/thesis.txt
  run bash "$(_explore)" exp-a1 ex1
  [ "$status" -eq 1 ]
  [[ "$output" == *"thesis moved since it was paired"* ]] || { echo "$output"; false; }
  # B3: a seal stripped of its prediction is refused.
  node -e 'const f=process.argv[1],fs=require("fs");const m=JSON.parse(fs.readFileSync(f,"utf8"));delete m.prediction;fs.writeFileSync(f,JSON.stringify(m,null,2)+"\n")' "$(_seal_file)"
  run bash "$(_explore)" seal-check ex1
  [ "$status" -eq 1 ]
  [[ "$output" == *"no sealed prediction"* ]] || { echo "$output"; false; }
}

@test "this file registers the 12 tests it declares" {
  [ "${#BATS_TEST_NAMES[@]}" -eq 12 ] || { echo "registered ${#BATS_TEST_NAMES[@]} tests, expected 12 -- a @test was silently dropped"; false; }
}
