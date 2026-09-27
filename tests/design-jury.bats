#!/usr/bin/env bats
# Phase 03 S1 -- the N-item jury runner (ADR-1405, ADR-1411): design-explore.sh jury deals N blinded
# items (the variants' renders plus >=1 reference-pack screen) under a seeded shuffle and seals the
# key; jury-check reads every ranking and logs each deviation. A zero from a logger never shown to
# catch anything is a contract compared against nothing, so the planted skip-one-item ranking is
# the negative control every clean pass leans on.
bats_require_minimum_version 1.5.0
load 'test_helper'

_explore() { echo "$SANDBOX/.claude/scripts/design/design-explore.sh"; }
_jury_dir() { echo "$SANDBOX/.claude/state/design/explore/jx/jury"; }

# One png-shaped file per call, distinct bytes per name.
_png() { printf '\211PNG\r\n\032\n%s' "$2" > "$1"; }
_sha() { node -e 'const c=require("crypto"),f=require("fs");process.stdout.write(c.createHash("sha256").update(f.readFileSync(process.argv[1])).digest("hex"))' "$1"; }

# An explore `jx` on brief `bx` with $1 variants rendered at 1440x900, and $2 pack screens with
# provenance rows. Asserts its own fixture before any case leans on it.
_fixture() {
  local nv="$1" nr="$2" v i sess png sha
  _arc_design_sandbox
  cd "$SANDBOX" || return 1
  mkdir -p docs/design/briefs/bx docs/design/explore/jx docs/design/refpacks/bx .claude/state/design/refpacks/bx
  printf '# brief bx\n' > docs/design/briefs/bx/brief.md
  printf 'id=jx\nbrief=docs/design/briefs/bx/brief.md\nbase=0000000\n' > docs/design/explore/jx/explore.txt
  printf '# sources\n\n| url | fetched | sha256 | source | adaptable principle | avoid this |\n|---|---|---|---|---|---|\n' > docs/design/refpacks/bx/sources.md
  for v in $(printf 'a b c d e' | cut -d' ' -f1-"$nv"); do
    mkdir -p "docs/design/explore/jx/variant-$v"
    printf '<main>%s</main>\n' "$v" > "docs/design/explore/jx/variant-$v/index.html"
    sess=".claude/state/design/renders/jx--variant-$v"; mkdir -p "$sess"
    png="$sess/r-1440x900.png"; _png "$png" "variant-$v"; sha="$(_sha "$png")"
    printf '{\n  "route": "/",\n  "png": "%s",\n  "screenshot_sha256": "%s",\n  "viewport": "1440x900@1",\n  "session": "jx--variant-%s",\n  "iter": 1,\n  "unchanged": false\n}\n' "$png" "$sha" "$v" > "$sess/r-1440x900.json"
  done
  mkdir -p docs/design/rubrics; printf '# rubric rx

- anchor: pack screen 1 is an 80
' > docs/design/rubrics/rx.md
  # The rubric rides first in REFS so every deal carries it; "${REFS[@]:2}" is the refs alone.
  REFS=(--rubric docs/design/rubrics/rx.md)
  for i in $(seq 1 "$nr"); do
    png=".claude/state/design/refpacks/bx/probe.png"; _png "$png" "reference-$i"; sha="$(_sha "$png")"
    mv "$png" ".claude/state/design/refpacks/bx/nicelydone-${sha:0:16}.png"
    printf '| https://assets.nicelydone.club/x%s.png | 2026-09-27T00:00:00Z | %s | nicelydone | p | a |\n' "$i" "$sha" >> docs/design/refpacks/bx/sources.md
    REFS+=(--ref "${sha:0:16}")
  done
  [ "$(ls docs/design/explore/jx | grep -c '^variant-')" -eq "$nv" ] || { echo "fixture: variants not built"; return 1; }
  [ "$(ls .claude/state/design/refpacks/bx | grep -c '^nicelydone-')" -eq "$nr" ] || { echo "fixture: refs not built"; return 1; }
}

teardown() { _arc_teardown 2>/dev/null || true; }

# A ranking file for juror $1 from a ranked order $2 (space separated), with the right Why pairs.
_ranking() {
  local n="$1" order="$2" f="$SANDBOX/docs/design/explore/jx/ranking-$1.md" prev="" x
  { printf '# Ranking -- juror %s\n\n- ranked: %s\n- reference-position: unset\n' "$n" "$(printf '%s' "$order" | sed 's/ / > /g')"
    for x in $order; do
      [ -n "$prev" ] && printf '\n## Why %s over %s\nobservation\n' "$prev" "$x"
      prev="$x"
    done
    printf '\n## What would change my mind\nthing\n'
  } > "$f"
}

# ---------- deal ----------

@test "jury: deals N=4 blinded items -- three variants and one reference -- and seals the key" {
  _fixture 3 1
  run --separate-stderr bash "$(_explore)" jury jx --n 4 --seed 7 "${REFS[@]}"
  [ "$status" -eq 0 ] || { echo "the deal failed: $status $output $stderr"; false; }
  [ "$(ls "$(_jury_dir)/items" | wc -l | tr -d ' ')" -eq 4 ] || { echo "not four items: $(ls "$(_jury_dir)/items")"; false; }
  for l in a b c d; do ls "$(_jury_dir)/items/item-$l."* >/dev/null 2>&1 || { echo "no item-$l"; false; }; done
  [ -f "$(_jury_dir)/key.json" ] || { echo "no sealed key"; false; }
  node -e 'const k=require(process.argv[1]);const kinds=k.items.map(i=>i.kind).sort().join(",");if(k.n!==4||kinds!=="reference,variant,variant,variant")process.exit(1)' "$(_jury_dir)/key.json" \
    || { echo "the key does not hold three variants and one reference: $(cat "$(_jury_dir)/key.json")"; false; }
  # Each item's bytes are its source's bytes, checked by hash, not by name.
  node -e 'const c=require("crypto"),f=require("fs"),p=require("path");const d=process.argv[1];const k=require(p.join(d,"key.json"));for(const i of k.items){const b=f.readFileSync(p.join(d,"items",i.file));if(c.createHash("sha256").update(b).digest("hex")!==i.sha256)process.exit(1)}' "$(_jury_dir)" \
    || { echo "an item's bytes are not its source's"; false; }
  # The mapping is sealed: stdout names the items and the key's hash, never which item is which.
  ! printf '%s' "$output" | grep -qE 'variant-[a-c]|reference|nicelydone' || { echo "the deal printed the mapping: $output"; false; }
}

@test "jury: the shuffle is seeded -- one seed deals one order, and another seed may deal another" {
  _fixture 3 1
  run bash "$(_explore)" jury jx --n 4 --seed 7 "${REFS[@]}"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  one="$(node -e 'const k=require(process.argv[1]);console.log(k.items.map(i=>i.label+"="+i.source).join(" "))' "$(_jury_dir)/key.json")"
  rm -rf "$(_jury_dir)"
  run bash "$(_explore)" jury jx --n 4 --seed 7 "${REFS[@]}"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  two="$(node -e 'const k=require(process.argv[1]);console.log(k.items.map(i=>i.label+"="+i.source).join(" "))' "$(_jury_dir)/key.json")"
  [ "$one" = "$two" ] || { echo "one seed dealt two orders: [$one] [$two]"; false; }
  seen="$one"
  for s in 1 2 3 4 5 6 8 9; do
    rm -rf "$(_jury_dir)"
    run bash "$(_explore)" jury jx --n 4 --seed "$s" "${REFS[@]}"
    [ "$status" -eq 0 ] || { echo "$output"; false; }
    o="$(node -e 'const k=require(process.argv[1]);console.log(k.items.map(i=>i.label+"="+i.source).join(" "))' "$(_jury_dir)/key.json")"
    [ "$o" = "$one" ] || seen="different"
  done
  [ "$seen" = "different" ] || { echo "nine seeds dealt one order -- the seed is ignored"; false; }
}

@test "jury: N=5 and N=6 deal five and six items with no other change" {
  for spec in "3 2 5 e" "3 3 6 f"; do
    set -- $spec
    _fixture "$1" "$2"
    run bash "$(_explore)" jury jx --n "$3" --seed 11 "${REFS[@]}"
    [ "$status" -eq 0 ] || { echo "N=$3: $output"; false; }
    [ "$(ls "$(_jury_dir)/items" | wc -l | tr -d ' ')" -eq "$3" ] || { echo "N=$3: wrong item count"; false; }
    ls "$(_jury_dir)/items/item-$4."* >/dev/null 2>&1 || { echo "N=$3: no item-$4"; false; }
    _arc_teardown 2>/dev/null || true
  done
}

@test "jury: refuses a declared N that is not the count dealt, no reference at all, an unprovenanced reference, and a re-deal" {
  _fixture 3 1
  run bash "$(_explore)" jury jx --n 5 --seed 7 "${REFS[@]}"
  [ "$status" -eq 1 ] && [[ "$output" == *"--n 5"* ]] || { echo "a wrong N was dealt: $status $output"; false; }
  run bash "$(_explore)" jury jx --n 3 --seed 7 --rubric docs/design/rubrics/rx.md
  [ "$status" -eq 1 ] && [[ "$output" == *"at least one reference"* ]] || { echo "a jury with no reference was dealt: $status $output"; false; }
  _png ".claude/state/design/refpacks/bx/probe.png" "no-row"; nr="$(_sha .claude/state/design/refpacks/bx/probe.png)"
  mv .claude/state/design/refpacks/bx/probe.png ".claude/state/design/refpacks/bx/nicelydone-${nr:0:16}.png"
  run bash "$(_explore)" jury jx --n 4 --seed 7 --rubric docs/design/rubrics/rx.md --ref "${nr:0:16}"
  [ "$status" -eq 1 ] && [[ "$output" == *"sources.md"* ]] || { echo "a reference with no provenance row was dealt: $status $output"; false; }
  [ ! -e "$(_jury_dir)/key.json" ] || { echo "a refused deal left a key"; false; }
  run bash "$(_explore)" jury jx --n 4 --seed 7 "${REFS[@]}"
  [ "$status" -eq 0 ] || { echo "control deal failed: $output"; false; }
  run bash "$(_explore)" jury jx --n 4 --seed 8 "${REFS[@]}"
  [ "$status" -eq 1 ] && [[ "$output" == *"already dealt"* ]] || { echo "a second deal overwrote the sealed key: $status $output"; false; }
}

@test "jury: refuses a render whose bytes no longer match its meta" {
  _fixture 3 1
  printf 'changed' >> ".claude/state/design/renders/jx--variant-b/r-1440x900.png"
  run bash "$(_explore)" jury jx --n 4 --seed 7 "${REFS[@]}"
  [ "$status" -eq 1 ] && [[ "$output" == *"variant-b"* ]] || { echo "a changed render was dealt: $status $output"; false; }
}

# ---------- check ----------

@test "jury-check: three clean rankings are zero deviations, and the reference position is filled in from the key" {
  _fixture 3 1
  run bash "$(_explore)" jury jx --n 4 --seed 7 "${REFS[@]}"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  _ranking 1 "item-a item-b item-c item-d"; _ranking 2 "item-d item-c item-b item-a"; _ranking 3 "item-b item-a item-d item-c"
  run --separate-stderr bash "$(_explore)" jury-check jx
  [ "$status" -eq 0 ] || { echo "clean rankings were refused: $status $output $stderr"; false; }
  [[ "$output" == *"3 ranking(s), 0 deviation(s)"* ]] || { echo "the check did not report its count: $output"; false; }
  ref="$(node -e 'const k=require(process.argv[1]);console.log(k.items.find(i=>i.kind==="reference").label)' "$(_jury_dir)/key.json")"
  want="$(printf 'item-a item-b item-c item-d\n' | tr ' ' '\n' | grep -n "^$ref$" | cut -d: -f1)"
  got="$(node -e 'const r=require(process.argv[1]);console.log(r.rankings.find(x=>x.file==="ranking-1.md").referencePosition)' "$(_jury_dir)/result.json")"
  [ "$got" = "$want" ] || { echo "reference position $got, expected $want for $ref"; false; }
}

@test "jury-check: THE PLANTED DEVIATION -- a juror told to skip one item is caught and logged" {
  _fixture 3 1
  run bash "$(_explore)" jury jx --n 4 --seed 7 "${REFS[@]}"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  _ranking 1 "item-a item-b item-c item-d"; _ranking 2 "item-d item-c item-a"; _ranking 3 "item-b item-a item-d item-c"
  run bash "$(_explore)" jury-check jx
  [ "$status" -eq 1 ] || { echo "a skipped item passed: $output"; false; }
  [ -s "$(_jury_dir)/deviations.log" ] || { echo "nothing was logged"; false; }
  grep -q $'ranking-2.md\tmissing-item\titem-b' "$(_jury_dir)/deviations.log" || { echo "the skip was not logged as missing item-b on ranking 2: $(cat "$(_jury_dir)/deviations.log")"; false; }
  ! grep -q 'ranking-1.md\|ranking-3.md' "$(_jury_dir)/deviations.log" || { echo "a clean ranking was logged: $(cat "$(_jury_dir)/deviations.log")"; false; }
}

@test "jury-check: a duplicate, an unknown item, a guessed reference position and a wrong Why pair are each a deviation" {
  _fixture 3 1
  run bash "$(_explore)" jury jx --n 4 --seed 7 "${REFS[@]}"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  _ranking 1 "item-a item-a item-c item-d"
  _ranking 2 "item-a item-b item-c item-z"
  _ranking 3 "item-b item-a item-d item-c"; sed -i.bak 's/^- reference-position: unset$/- reference-position: 2/' "$SANDBOX/docs/design/explore/jx/ranking-3.md"
  _ranking 4 "item-c item-a item-b item-d"; sed -i.bak 's/^## Why item-a over item-b$/## Why item-b over item-a/' "$SANDBOX/docs/design/explore/jx/ranking-4.md"
  grep -q '^- reference-position: 2$' "$SANDBOX/docs/design/explore/jx/ranking-3.md" || { echo "fixture: the guess was not planted"; false; }
  grep -q '^## Why item-b over item-a$' "$SANDBOX/docs/design/explore/jx/ranking-4.md" || { echo "fixture: the pair was not planted"; false; }
  run bash "$(_explore)" jury-check jx
  [ "$status" -eq 1 ] || { echo "planted deviations passed: $output"; false; }
  L="$(_jury_dir)/deviations.log"
  grep -q $'ranking-1.md\tduplicate-item\titem-a' "$L" || { echo "duplicate not logged: $(cat "$L")"; false; }
  grep -q $'ranking-2.md\tunknown-item\titem-z' "$L" || { echo "unknown not logged: $(cat "$L")"; false; }
  grep -q $'ranking-3.md\treference-guess' "$L" || { echo "guess not logged: $(cat "$L")"; false; }
  grep -q $'ranking-4.md\twhy-pairs' "$L" || { echo "pair not logged: $(cat "$L")"; false; }
}

@test "jury-check: no rankings at all is a refusal, never a clean zero" {
  _fixture 3 1
  run bash "$(_explore)" jury jx --n 4 --seed 7 "${REFS[@]}"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run bash "$(_explore)" jury-check jx
  [ "$status" -eq 1 ] && [[ "$output" == *"no rankings"* ]] || { echo "an empty panel passed: $status $output"; false; }
  run bash "$(_explore)" jury-check nosuch
  [ "$status" -eq 1 ] || { echo "an explore with no deal passed: $status $output"; false; }
}

@test "jury: a meta naming a file outside its render session, a non-image, or a symlinked pack screen is refused (S1 attack B1 B3 L4)" {
  _fixture 3 1
  printf 'SECRET=1\n' > .env
  sha="$(_sha .env)"
  printf '{"route":"/","png":".env","screenshot_sha256":"%s","viewport":"1440x900@1","iter":99}\n' "$sha" > ".claude/state/design/renders/jx--variant-a/x.json"
  run bash "$(_explore)" jury jx --n 4 --seed 7 "${REFS[@]}"
  [ "$status" -eq 1 ] && [[ "$output" == *"outside"* ]] || { echo "a meta pointing at .env was dealt: $status $output"; false; }
  [ ! -e "$(_jury_dir)" ] || { echo "a refused deal claimed the jury dir"; false; }
  rm ".claude/state/design/renders/jx--variant-a/x.json"
  printf '<svg/>' > ".claude/state/design/renders/jx--variant-a/r.svg"; sha="$(_sha .claude/state/design/renders/jx--variant-a/r.svg)"
  printf '{"route":"/","png":".claude/state/design/renders/jx--variant-a/r.svg","screenshot_sha256":"%s","viewport":"1440x900@1","iter":99}\n' "$sha" > ".claude/state/design/renders/jx--variant-a/x.json"
  run bash "$(_explore)" jury jx --n 4 --seed 7 "${REFS[@]}"
  [ "$status" -eq 1 ] && [[ "$output" == *"not an image file"* ]] || { echo "a non-image render was dealt: $status $output"; false; }
  rm ".claude/state/design/renders/jx--variant-a/x.json"
  # CONTROL: with the planted metas gone the same deal goes through, so each red above was its plant.
  run bash "$(_explore)" jury jx --n 4 --seed 7 "${REFS[@]}"
  [ "$status" -eq 0 ] || { echo "control: $output"; false; }
  case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) return 0;; esac   # git-bash ln -s copies; the symlink half needs a real one
  rm -rf "$(_jury_dir)"
  ref="$(ls .claude/state/design/refpacks/bx/ | head -1)"
  mv ".claude/state/design/refpacks/bx/$ref" "$BATS_TEST_TMPDIR/$ref"
  ln -s "$BATS_TEST_TMPDIR/$ref" ".claude/state/design/refpacks/bx/$ref"
  [ -L ".claude/state/design/refpacks/bx/$ref" ] || { echo "fixture: no symlink"; false; }
  run bash "$(_explore)" jury jx --n 4 --seed 7 "${REFS[@]}"
  [ "$status" -eq 1 ] && [[ "$output" == *"not a regular file"* ]] || { echo "a symlinked pack screen was dealt: $status $output"; false; }
}

@test "jury: two deals at once -- exactly one wins, and the winner's items all match its key (S1 attack B2)" {
  _fixture 3 1
  bash "$(_explore)" jury jx --n 4 --seed 7 "${REFS[@]}" > "$BATS_TEST_TMPDIR/one.txt" 2>&1 & p1=$!
  bash "$(_explore)" jury jx --n 4 --seed 42 "${REFS[@]}" > "$BATS_TEST_TMPDIR/two.txt" 2>&1 & p2=$!
  # bats runs under set -e, and the losing deal exits 1 by design: its wait must not end the test.
  r1=0; wait "$p1" || r1=$?
  r2=0; wait "$p2" || r2=$?
  [ $((r1 + r2)) -eq 1 ] || { echo "not exactly one winner: $r1 $r2 $(cat "$BATS_TEST_TMPDIR/one.txt" "$BATS_TEST_TMPDIR/two.txt")"; false; }
  node -e 'const c=require("crypto"),f=require("fs"),p=require("path");const d=process.argv[1];const k=require(p.join(d,"key.json"));if(f.readdirSync(p.join(d,"items")).length!==k.n)process.exit(2);for(const i of k.items){if(c.createHash("sha256").update(f.readFileSync(p.join(d,"items",i.file))).digest("hex")!==i.sha256)process.exit(1)}' "$(_jury_dir)" \
    || { echo "the winner's items do not match its key"; false; }
}

@test "jury-check: a zero-padded ranking file is not a second juror (S1 attack L8)" {
  _fixture 3 1
  run bash "$(_explore)" jury jx --n 4 --seed 7 "${REFS[@]}"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  _ranking 1 "item-a item-b item-c item-d"
  cp "$SANDBOX/docs/design/explore/jx/ranking-1.md" "$SANDBOX/docs/design/explore/jx/ranking-01.md"
  run bash "$(_explore)" jury-check jx
  [ "$status" -eq 0 ] && [[ "$output" == *"1 ranking(s), 0 deviation(s)"* ]] || { echo "a zero-padded copy counted as a juror: $status $output"; false; }
}


# ---------- S4: the owner ritual ----------

# ADR-1411's sealed predictions, as the repo carries them, so the score gate has its record.
_adr1411() { mkdir -p docs/adr && cp "$ARC_ROOT"/docs/adr/1411-*.md docs/adr/; }

@test "ritual: a deal with no rubric is refused -- the owner scores against anchors fixed before the run" {
  _fixture 3 1
  run bash "$(_explore)" jury jx --n 4 --seed 7 "${REFS[@]:2}"
  [ "$status" -eq 1 ] && [[ "$output" == *"--rubric"* ]] || { echo "a deal with no rubric went through: $status $output"; false; }
}

@test "ritual: the score is refused before the predictions are sealed, for a missing or out-of-range item, and twice" {
  _fixture 3 1
  run bash "$(_explore)" jury jx --n 4 --seed 7 "${REFS[@]}"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run bash "$(_explore)" score jx --scores item-a=70,item-b=40,item-c=55,item-d=80
  [ "$status" -eq 1 ] && [[ "$output" == *"sealed predictions"* ]] || { echo "a score with no sealed predictions went through: $status $output"; false; }
  _adr1411
  run bash "$(_explore)" score jx --scores item-a=70,item-b=40,item-c=55
  [ "$status" -eq 1 ] && [[ "$output" == *"missing item-d"* ]] || { echo "a partial score went through: $status $output"; false; }
  run bash "$(_explore)" score jx --scores item-a=70,item-b=40,item-c=55,item-d=101
  [ "$status" -eq 1 ] || { echo "a score of 101 went through: $output"; false; }
  run bash "$(_explore)" score jx --scores item-a=70,item-b=40,item-c=55,item-d=80
  [ "$status" -eq 0 ] || { echo "control: a full score was refused: $output"; false; }
  run bash "$(_explore)" score jx --scores item-a=71,item-b=40,item-c=55,item-d=80
  [ "$status" -eq 1 ] && [[ "$output" == *"already recorded"* ]] || { echo "a second score overwrote the first: $status $output"; false; }
}

@test "ritual: a rubric edited after the deal refuses the score" {
  _fixture 3 1; _adr1411
  run bash "$(_explore)" jury jx --n 4 --seed 7 "${REFS[@]}"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  printf 'anchor moved\n' >> docs/design/rubrics/rx.md
  run bash "$(_explore)" score jx --scores item-a=70,item-b=40,item-c=55,item-d=80
  [ "$status" -eq 1 ] && [[ "$output" == *"rubric changed"* ]] || { echo "a moved anchor was scored against: $status $output"; false; }
}

@test "ritual: THE ORDERING -- unblind refuses before the score, and no score is taken after unblinding" {
  _fixture 3 1; _adr1411
  run bash "$(_explore)" jury jx --n 4 --seed 7 --control c "${REFS[@]}"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run bash "$(_explore)" unblind jx
  [ "$status" -eq 1 ] && [[ "$output" == *"no blind score yet"* ]] || { echo "unblinding ran before the score: $status $output"; false; }
  [ ! -e "$(_jury_dir)/unblind.json" ] || { echo "a refused unblind left a record"; false; }
  run bash "$(_explore)" score jx --scores item-a=70,item-b=40,item-c=55,item-d=80
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"note.logged receipt emitted"* ]] || { echo "the score's receipt was not emitted: $output"; false; }
  run node "$SANDBOX/.claude/scripts/hq/spine.mjs" read --kind note.logged
  [[ "$output" == *'"lens":"design"'* ]] && [[ "$output" == *"owner blind score"* ]] || { echo "no design note.logged on the spine: $output"; false; }
  run bash "$(_explore)" unblind jx
  [ "$status" -eq 0 ] || { echo "unblind after the score failed: $output"; false; }
  [[ "$output" == *"= control variant-c"* ]] && [[ "$output" == *"plain-prompt control"* ]] || { echo "the control was not named: $output"; false; }
  node -e 'const u=require(process.argv[1]);if(!(Date.parse(u.scored)<=Date.parse(u.unblinded)))process.exit(1)' "$(_jury_dir)/unblind.json" || { echo "the score is not timestamped before the unblinding"; false; }
  rm "$(_jury_dir)/score.json"
  run bash "$(_explore)" score jx --scores item-a=90,item-b=40,item-c=55,item-d=80
  [ "$status" -eq 1 ] && [[ "$output" == *"already unblinded"* ]] || { echo "a score was taken after unblinding: $status $output"; false; }
}

@test "ritual: the self-review catch rate counts iterations that caught a defect, and refuses an empty record" {
  _fixture 3 1
  run bash "$(_explore)" catch-rate jx
  [ "$status" -eq 1 ] && [[ "$output" == *"no self-review iterations"* ]] || { echo "a rate over nothing was reported: $status $output"; false; }
  mkdir -p docs/design/explore/jx/variant-a/self-review docs/design/explore/jx/variant-b/self-review
  printf '| iter | input | output | defect | revision |\n|---|---|---|---|---|\n| 1 | a | b | the rail clipped at 390 | widened |\n| 2 | b | b | unchanged: iteration 1 cleared it | none |\n' > docs/design/explore/jx/variant-a/self-review/manifest.md
  printf '| iter | input | output | defect | revision |\n|---|---|---|---|---|\n| 1 | a | c | the primary action was grey | darkened |\n' > docs/design/explore/jx/variant-b/self-review/manifest.md
  run bash "$(_explore)" catch-rate jx
  [ "$status" -eq 0 ] && [[ "$output" == *"2/3 iteration(s) caught a defect"* ]] || { echo "wrong catch rate: $status $output"; false; }
}

@test "this file registered every test it declares" {
  [ "${#BATS_TEST_NAMES[@]}" -eq 18 ] || {
    echo "registered ${#BATS_TEST_NAMES[@]} tests, expected 18 -- a @test was silently dropped"
    false
  }
}
