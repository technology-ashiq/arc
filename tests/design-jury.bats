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
# A real one-pixel PNG whose colour derives from $2, so distinct names give distinct bytes. The deal
# now parses every item as a PNG (Phase 07 S4b), so a signature with junk after it no longer passes.
_png() {
  node -e 'const z=require("zlib"),c=require("crypto"),fs=require("fs");const crc=(b)=>{let x=~0;for(const v of b){x^=v;for(let k=0;k<8;k++)x=(x>>>1)^(0xedb88320&-(x&1))}return (~x)>>>0};const ch=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const r=Buffer.alloc(4);r.writeUInt32BE(crc(td));return Buffer.concat([l,td,r])};const h=c.createHash("sha256").update(process.argv[2]).digest();const ih=Buffer.alloc(13);ih.writeUInt32BE(1,0);ih.writeUInt32BE(1,4);ih[8]=8;ih[9]=2;fs.writeFileSync(process.argv[1],Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),ch("IHDR",ih),ch("IDAT",z.deflateSync(Buffer.from([0,h[0],h[1],h[2]]))),ch("IEND",Buffer.alloc(0))]))' "$1" "$2"
  [ -s "$1" ] || { echo "fixture: _png wrote nothing"; return 1; }
}
# A pack screen framed into ref-<sha16>/ and rendered into its session, as design-explore.sh ref does.
_frame_ref() {
  local s="$1" src="$2" d="docs/design/explore/jx/ref-$1" sess=".claude/state/design/renders/jx--ref-$1" png sha
  mkdir -p "$d" "$sess"
  cp "$src" "$d/image.png"
  png="$sess/r-1440x900.png"; _png "$png" "ref-render-$s"; sha="$(_sha "$png")"
  printf '{\n  "route": "/",\n  "png": "%s",\n  "screenshot_sha256": "%s",\n  "viewport": "1440x900@1",\n  "session": "jx--ref-%s",\n  "iter": 0,\n  "unchanged": false\n}\n' "$png" "$sha" "$s" > "$sess/r-1440x900.json"
  [ -s "$sess/r-1440x900.json" ] || { echo "fixture: ref render not built"; return 1; }
}
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
    _frame_ref "${sha:0:16}" ".claude/state/design/refpacks/bx/nicelydone-${sha:0:16}.png" || return 1
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

@test "ritual: a second 1411 ADR, a directory manifest, control bytes in a source and symlinked inputs are refused (S4 attack B1-B4)" {
  _fixture 3 1; _adr1411
  run bash "$(_explore)" jury jx --n 4 --seed 7 --control c "${REFS[@]}"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # B1: two files numbered 1411 -- the first in directory order is not the record, so neither is read.
  cp docs/adr/1411-*.md docs/adr/1411-zz-duplicate.md
  run bash "$(_explore)" score jx --scores item-a=70,item-b=40,item-c=55,item-d=80
  [ "$status" -eq 1 ] && [[ "$output" == *"exactly one ADR-1411"* ]] || { echo "a duplicated ADR-1411 was scored against: $status $output"; false; }
  rm docs/adr/1411-zz-duplicate.md
  # B4: a symlinked ADR or rubric is refused like the rubric at the deal. git-bash ln -s copies, so only where it is real.
  case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) ;; *)
    adr="$(ls docs/adr/1411-*.md)"
    mv "$adr" "$BATS_TEST_TMPDIR/adr.md" && ln -s "$BATS_TEST_TMPDIR/adr.md" "$adr"
    [ -L "$adr" ] || { echo "fixture: no ADR symlink"; false; }
    run bash "$(_explore)" score jx --scores item-a=70,item-b=40,item-c=55,item-d=80
    [ "$status" -eq 1 ] && [[ "$output" == *"not a regular file"* ]] || { echo "a symlinked ADR-1411 was trusted: $status $output"; false; }
    rm "$adr" && mv "$BATS_TEST_TMPDIR/adr.md" "$adr"
    mv docs/design/rubrics/rx.md "$BATS_TEST_TMPDIR/rx.md" && ln -s "$BATS_TEST_TMPDIR/rx.md" docs/design/rubrics/rx.md
    run bash "$(_explore)" score jx --scores item-a=70,item-b=40,item-c=55,item-d=80
    [ "$status" -eq 1 ] && [[ "$output" == *"not a regular file"* ]] || { echo "a symlinked rubric was scored against: $status $output"; false; }
    rm docs/design/rubrics/rx.md && mv "$BATS_TEST_TMPDIR/rx.md" docs/design/rubrics/rx.md ;;
  esac
  # CONTROL: with every plant removed the same score goes through.
  run bash "$(_explore)" score jx --scores item-a=70,item-b=40,item-c=55,item-d=80
  [ "$status" -eq 0 ] || { echo "control: the clean score was refused: $output"; false; }
  # B3: a source carrying an escape sequence prints as text, never as a terminal command.
  node -e 'const f=require("fs"),p=process.argv[1],k=JSON.parse(f.readFileSync(p,"utf8"));k.items[0].source="x\u001b[2K\u001b[1Aarc beats it";f.writeFileSync(p,JSON.stringify(k))' "$(_jury_dir)/key.json"
  grep -q $'\e' "$(_jury_dir)/key.json" || grep -q 'u001b' "$(_jury_dir)/key.json" || { echo "fixture: no escape planted"; false; }
  run bash "$(_explore)" unblind jx
  [ "$status" -eq 0 ] && [[ "$output" == *"design-explore unblind: best arc"* ]] || { echo "unblind did not run: $status $output"; false; }
  [[ "$output" != *$'\e'* ]] || { echo "an escape byte reached the unblind output"; false; }
  # B2: a directory where the manifest belongs is a named refusal, never a stack trace.
  mkdir -p docs/design/explore/jx/variant-a/self-review/manifest.md
  run bash "$(_explore)" catch-rate jx
  [ "$status" -eq 1 ] && [[ "$output" == *"not a regular file"* ]] || { echo "a directory manifest was not refused by name: $status $output"; false; }
  [[ "$output" != *"EISDIR"* ]] || { echo "a raw read error leaked: $output"; false; }
}

# ---------- the rival item (Phase 07 S4, ADR-1409) ----------

# A rival drafted for jx: its vendored page, a render in the session shape a variant uses, and the
# adapter receipt that carries its provenance. $1 is the receipt status.
_rival_fixture() {
  local status="${1:-DRAFTED}" sess=".claude/state/design/renders/jx--rival-stitch" png sha
  mkdir -p docs/design/explore/jx/rival-stitch "$sess" .claude/state/design/rivals/bx/jx/stitch
  printf '<main>rival</main>\n' > docs/design/explore/jx/rival-stitch/index.html
  png="$sess/r-1440x900.png"; _png "$png" "rival-stitch"; sha="$(_sha "$png")"
  printf '{\n  "route": "/",\n  "png": "%s",\n  "screenshot_sha256": "%s",\n  "viewport": "1440x900@1",\n  "session": "jx--rival-stitch",\n  "iter": 0,\n  "unchanged": false\n}\n' "$png" "$sha" > "$sess/r-1440x900.json"
  printf '{"provider":"stitch","sdk":"@google/stitch-sdk@0.3.5","status":"%s","finishedAt":"2000-01-01T00:00:00.000Z","vendored":{"page_sha256":"%s"}}\n' "$status" "$(_sha docs/design/explore/jx/rival-stitch/index.html)" > .claude/state/design/rivals/bx/jx/stitch/receipt.json
  grep -qE '"page_sha256":"[0-9a-f]{64}"' .claude/state/design/rivals/bx/jx/stitch/receipt.json || { echo "fixture: no page hash in the receipt"; return 1; }
  printf '2026-10-07T00:00:00.000Z\tstitch\t%s\t(quota)\n' "$status" > .claude/state/design/rivals/bx/jx/status.log
  [ -s "$sess/r-1440x900.json" ] || { echo "fixture: no rival render meta"; return 1; }
}
_label_of() { node -e 'const k=require(process.argv[1]);process.stdout.write(k.items.filter(i=>i.kind===process.argv[2]).map(i=>i.label).join(" "))' "$(_jury_dir)/key.json" "$1"; }

@test "jury: a rival is dealt blind -- same labels, same renderer session shape, kind and provenance only in the key" {
  _fixture 3 1; _rival_fixture DRAFTED
  run --separate-stderr bash "$(_explore)" jury jx --n 5 --seed 7 --rival stitch "${REFS[@]}"
  [ "$status" -eq 0 ] || { echo "the deal failed: $status $output $stderr"; false; }
  node -e 'const k=require(process.argv[1]);const r=k.items.filter(i=>i.kind==="rival");const v=k.items.filter(i=>i.kind==="variant");if(k.n!==5||r.length!==1||r[0].provenance!=="rival:stitch@0.3.5"||!v.every(i=>i.provenance==="arc")||k.items.find(i=>i.kind==="reference").provenance!=="reference")process.exit(1)' "$(_jury_dir)/key.json" \
    || { echo "the key does not carry one rival with its provenance: $(cat "$(_jury_dir)/key.json")"; false; }
  # The items dir is labels only: five files, every name item-<letter>.png, nothing that says rival.
  [ "$(ls "$(_jury_dir)/items" | wc -l | tr -d ' ')" -eq 5 ] || { echo "not five items"; false; }
  ! ls "$(_jury_dir)/items" | grep -qvE '^item-[a-e]\.png$' || { echo "an item name is not opaque: $(ls "$(_jury_dir)/items")"; false; }
  ! printf '%s' "$output" | grep -qiE 'rival|stitch|variant-|nicelydone' || { echo "the deal printed the mapping: $output"; false; }
}

@test "jury: a rival that could not draft is LEFT OUT by name, and the count must be declared without it" {
  _fixture 3 1; _rival_fixture COULD-NOT-DRAFT
  run bash "$(_explore)" jury jx --n 5 --seed 7 --rival stitch "${REFS[@]}"
  [ "$status" -eq 1 ] || { echo "a five-item deal went through with four items: $output"; false; }
  [[ "$output" == *"rival stitch LEFT OUT -- COULD-NOT-DRAFT (quota)"* ]] && [[ "$output" == *"0 rival(s), 1 left out"* ]] || { echo "the left-out rival was not named: $output"; false; }
  [ ! -e "$(_jury_dir)" ] || { echo "a refused deal left a jury dir"; false; }
  run bash "$(_explore)" jury jx --n 4 --seed 7 --rival stitch "${REFS[@]}"
  [ "$status" -eq 0 ] || { echo "the arc-only deal failed: $output"; false; }
  [[ "$output" == *"rival stitch LEFT OUT"* ]] || { echo "the arc-only deal was silent about the rival: $output"; false; }
  [ -z "$(_label_of rival)" ] || { echo "a rival that never drafted was dealt"; false; }
}

@test "unblind: rival-beats-all-arc is recorded when the rival wins -- owner score, jury rate, spine receipt" {
  _fixture 3 1; _rival_fixture DRAFTED; _adr1411
  run bash "$(_explore)" jury jx --n 5 --seed 7 --rival stitch "${REFS[@]}"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  riv="$(_label_of rival)"; arcs="$(_label_of variant)"; ref="$(_label_of reference)"
  [ -n "$riv" ] && [ "$(printf '%s' "$arcs" | wc -w | tr -d ' ')" -eq 3 ] || { echo "fixture: labels not read"; false; }
  # Two jurors put the rival first, one puts it last.
  _ranking 1 "$riv $arcs $ref"; _ranking 2 "$riv $ref $arcs"; _ranking 3 "$arcs $ref $riv"
  run bash "$(_explore)" jury-check jx
  [ "$status" -eq 0 ] || { echo "the rankings did not check clean: $output"; false; }
  scores="$riv=91"; for l in $arcs; do scores="$scores,$l=60"; done; scores="$scores,$ref=70"
  run bash "$(_explore)" score jx --scores "$scores"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run bash "$(_explore)" unblind jx
  [ "$status" -eq 0 ] || { echo "unblind failed: $output"; false; }
  [[ "$output" == *"rival-beats-all-arc -- owner YES (rival 91 vs best arc 60), jury 2 of 3 valid ranking(s)"* ]] || { echo "the rate was not printed: $output"; false; }
  [[ "$output" == *"NEW thesis"* ]] && [[ "$output" == *"note.logged receipt emitted"* ]] || { echo "the win was not routed or receipted: $output"; false; }
  node -e 'const u=require(process.argv[1]);const r=u.rivalBeatsAllArc;if(!r||r.owner.rivalBeatsAllArc!==true||r.jury.beats!==2||r.jury.of!==3)process.exit(1)' "$(_jury_dir)/unblind.json" || { echo "unblind.json does not carry the rate"; false; }
  run node "$SANDBOX/.claude/scripts/hq/spine.mjs" read --kind note.logged
  [[ "$output" == *"rival-beats-all-arc"* ]] && [[ "$output" == *'"rivalBeatsAllArc":true'* ]] || { echo "no rival receipt on the spine: $output"; false; }
}

@test "unblind: rival-beats-all-arc is recorded when the rival LOSES too -- the embarrassment cuts both ways" {
  _fixture 3 1; _rival_fixture DRAFTED; _adr1411
  run bash "$(_explore)" jury jx --n 5 --seed 7 --rival stitch "${REFS[@]}"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  riv="$(_label_of rival)"; arcs="$(_label_of variant)"; ref="$(_label_of reference)"
  _ranking 1 "$arcs $ref $riv"
  run bash "$(_explore)" jury-check jx
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  scores="$riv=40"; for l in $arcs; do scores="$scores,$l=60"; done; scores="$scores,$ref=70"
  run bash "$(_explore)" score jx --scores "$scores"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run bash "$(_explore)" unblind jx
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"rival-beats-all-arc -- owner no (rival 40 vs best arc 60), jury 0 of 1 valid ranking(s)"* ]] || { echo "a rival loss was not recorded: $output"; false; }
  [[ "$output" != *"NEW thesis"* ]] || { echo "a loss was routed as a win"; false; }
  run node "$SANDBOX/.claude/scripts/hq/spine.mjs" read --kind note.logged
  [[ "$output" == *'"rivalBeatsAllArc":false'* ]] || { echo "the loss was not on the spine: $output"; false; }
}

# ---------- attack 65d01cc round 1 ----------

@test "jury: a rival name that is a device name or ends in a hyphen is refused, here and in the renderer (B7)" {
  _fixture 3 1
  local p
  for p in con a- nul lpt1; do
    run bash "$(_explore)" jury jx --n 4 --seed 7 --rival "$p" "${REFS[@]}"
    [ "$status" -eq 1 ] && [[ "$output" == *"--rival takes a provider name"* ]] || { echo "--rival $p was not refused: $status $output"; false; }
  done
  run bash "$SANDBOX/.claude/scripts/design/design-render.sh" docs/design/explore/jx/rival-con/index.html --mode explore --session jx--rival-con
  [ "$status" -eq 1 ] && [[ "$output" == *"rival-<lowercase kebab provider>"* ]] || { echo "the renderer took rival-con: $status $output"; false; }
}

@test "jury: a rival page that is not the page its receipt vendored, or a receipt with no pinned version, is refused (B6, L3)" {
  _fixture 3 1; _rival_fixture DRAFTED
  printf '<main>changed after drafting</main>\n' > docs/design/explore/jx/rival-stitch/index.html
  run bash "$(_explore)" jury jx --n 5 --seed 7 --rival stitch "${REFS[@]}"
  [ "$status" -eq 1 ] && [[ "$output" == *"is not the page its receipt vendored"* ]] || { echo "a changed page was dealt: $status $output"; false; }
  _rival_fixture DRAFTED
  sed -i.bak 's#"sdk":"@google/stitch-sdk@0.3.5",##' .claude/state/design/rivals/bx/jx/stitch/receipt.json
  ! grep -q '"sdk"' .claude/state/design/rivals/bx/jx/stitch/receipt.json || { echo "fixture: sdk not removed"; false; }
  run bash "$(_explore)" jury jx --n 5 --seed 7 --rival stitch "${REFS[@]}"
  [ "$status" -eq 1 ] && [[ "$output" == *"not stitch on the pinned @google/stitch-sdk@0.3.5"* ]] || { echo "a versionless rival was dealt: $status $output"; false; }
  [ ! -e "$(_jury_dir)" ] || { echo "a refused deal left a jury dir"; false; }
}

@test "jury: two different renders at one iter are refused, never settled by directory order (L2)" {
  _fixture 3 1
  local sess=".claude/state/design/renders/jx--variant-a" png sha
  png="$sess/r-copy-1440x900.png"; _png "$png" "variant-a-other"; sha="$(_sha "$png")"
  printf '{\n  "route": "/",\n  "png": "%s",\n  "screenshot_sha256": "%s",\n  "viewport": "1440x900@1",\n  "session": "jx--variant-a",\n  "iter": 1,\n  "unchanged": false\n}\n' "$png" "$sha" > "$sess/r-copy-1440x900.json"
  [ "$(ls "$sess" | grep -c '\.json$')" -eq 2 ] || { echo "fixture: second meta not written"; false; }
  run bash "$(_explore)" jury jx --n 4 --seed 7 "${REFS[@]}"
  [ "$status" -eq 1 ] && [[ "$output" == *"two different renders at iter 1"* ]] || { echo "a tie was dealt: $status $output"; false; }
}

# Deal with a rival, rank it, check, and score: rival $1, every arc $2, reference 70.
_rival_scored() {
  run bash "$(_explore)" jury jx --n 5 --seed 7 --rival stitch "${REFS[@]}"
  [ "$status" -eq 0 ] || { echo "deal: $output"; return 1; }
  riv="$(_label_of rival)"; arcs="$(_label_of variant)"; ref="$(_label_of reference)"
  _ranking 1 "$arcs $ref $riv"
  run bash "$(_explore)" jury-check jx
  [ "$status" -eq 0 ] || { echo "check: $output"; return 1; }
  local scores="$riv=$1" l
  for l in $arcs; do scores="$scores,$l=$2"; done
  run bash "$(_explore)" score jx --scores "$scores,$ref=70"
  [ "$status" -eq 0 ] || { echo "score: $output"; return 1; }
}

@test "unblind: the rival rate is refused on checked rankings from another deal (L5)" {
  _fixture 3 1; _rival_fixture DRAFTED; _adr1411
  _rival_scored 50 60
  node -e 'const f=process.argv[1],r=require(f);r.id="another-explore";require("fs").writeFileSync(f,JSON.stringify(r))' "$(_jury_dir)/result.json"
  run bash "$(_explore)" unblind jx
  [ "$status" -eq 1 ] && [[ "$output" == *"this deal's checked rankings"* ]] || { echo "a foreign result.json was counted: $status $output"; false; }
  [ ! -e "$(_jury_dir)/unblind.json" ] || { echo "the refused unblinding was written"; false; }
}

@test "unblind: a tie is named as a tie, and is not a rival win (L6)" {
  _fixture 3 1; _rival_fixture DRAFTED; _adr1411
  _rival_scored 60 60
  run bash "$(_explore)" unblind jx
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"rival-beats-all-arc -- owner no (a tie) (rival 60 vs best arc 60)"* ]] || { echo "the tie was not named: $output"; false; }
  node -e 'const u=require(process.argv[1]).rivalBeatsAllArc;if(u.owner.tie!==true||u.owner.rivalBeatsAllArc!==false)process.exit(1)' "$(_jury_dir)/unblind.json"
}

@test "unblind: a receipt that cannot be emitted is a non-zero exit, with the payload kept for the main clone (B12)" {
  _fixture 3 1; _rival_fixture DRAFTED; _adr1411
  _rival_scored 50 60
  rm -f "$SANDBOX/.claude/scripts/hq/arc-event.sh"
  [ ! -e "$SANDBOX/.claude/scripts/hq/arc-event.sh" ] || { echo "fixture: emitter still there"; false; }
  run bash "$(_explore)" unblind jx
  [ "$status" -eq 4 ] || { echo "a missing receipt exited $status: $output"; false; }
  [[ "$output" == *"note.logged receipt NOT emitted"* ]] && [[ "$output" == *"rival-rate.payload."* ]] || { echo "$output"; false; }
  grep -q '"what":"rival-beats-all-arc"' "$(_jury_dir)"/rival-rate.payload.*.json
  [ -f "$(_jury_dir)/unblind.json" ] || { echo "the unblinding itself was not written"; false; }
}

@test "explore rival: a --viewport value cannot smuggle a second flag into the renderer (B8, L13)" {
  _fixture 3 1
  run bash "$(_explore)" rival jx --viewport "1440x900 --session x"
  [ "$status" -eq 1 ] && [[ "$output" == *"--viewport takes WxH"* ]] || { echo "the smuggled flag was not refused: $status $output"; false; }
  run bash "$(_explore)" rival jx --media "dark --session x"
  [ "$status" -eq 1 ] && [[ "$output" == *"--media takes a lowercase keyword"* ]] || { echo "$status $output"; false; }
}

# ---------- attack ae0aeb8 round 2 ----------

@test "jury: a receipt naming another package, or a render older than its draft, is refused (L5 L10 L14, B5)" {
  _fixture 3 1; _rival_fixture DRAFTED
  sed -i.bak 's#"sdk":"@google/stitch-sdk@0.3.5"#"sdk":"@evil/sdk@9.9.9"#' .claude/state/design/rivals/bx/jx/stitch/receipt.json
  grep -q '@evil/sdk@9.9.9' .claude/state/design/rivals/bx/jx/stitch/receipt.json || { echo "fixture: package not swapped"; false; }
  run bash "$(_explore)" jury jx --n 5 --seed 7 --rival stitch "${REFS[@]}"
  [ "$status" -eq 1 ] && [[ "$output" == *"not stitch on the pinned @google/stitch-sdk@0.3.5"* ]] || { echo "another package was stamped as Stitch: $status $output"; false; }
  _rival_fixture DRAFTED
  sed -i.bak 's#"finishedAt":"2000-01-01T00:00:00.000Z"#"finishedAt":"2999-01-01T00:00:00.000Z"#' .claude/state/design/rivals/bx/jx/stitch/receipt.json
  grep -q '2999-01-01' .claude/state/design/rivals/bx/jx/stitch/receipt.json || { echo "fixture: time not moved"; false; }
  run bash "$(_explore)" jury jx --n 5 --seed 7 --rival stitch "${REFS[@]}"
  [ "$status" -eq 1 ] && [[ "$output" == *"render is older than its draft"* ]] || { echo "a stale render was dealt: $status $output"; false; }
  _rival_fixture DRAFTED
  run bash "$(_explore)" jury jx --n 5 --seed 7 --rival stitch "${REFS[@]}"
  [ "$status" -eq 0 ] || { echo "the clean fixture did not deal: $output"; false; }
  node -e 'const k=require(process.argv[1]);const r=k.items.find(i=>i.kind==="rival");if(r.package!=="@google/stitch-sdk@0.3.5")process.exit(1)' "$(_jury_dir)/key.json" || { echo "the key does not carry the package"; false; }
}

@test "jury: a reference hash outside the sha256 column, or in two rows, is not its provenance (L6)" {
  _fixture 3 1
  local full; full="$(grep -oE '\| [0-9a-f]{64} \|' docs/design/refpacks/bx/sources.md | head -1 | tr -d '| ')"
  [ "${#full}" -eq 64 ] || { echo "fixture: no hash in sources.md"; false; }
  printf '# sources\n\n| url | fetched | sha256 | source | adaptable principle | avoid this |\n|---|---|---|---|---|---|\n| https://x/y.png | 2026-09-27T00:00:00Z | other | nicelydone | %s | a |\n' "$full" > docs/design/refpacks/bx/sources.md
  run bash "$(_explore)" jury jx --n 4 --seed 7 "${REFS[@]}"
  [ "$status" -eq 1 ] && [[ "$output" == *"has no provenance row"* ]] || { echo "a hash in the principle column admitted the screen: $status $output"; false; }
  printf '| https://x/a.png | 2026-09-27T00:00:00Z | %s | nicelydone | p | a |\n| https://x/b.png | 2026-09-27T00:00:00Z | %s | nicelydone | p | a |\n' "$full" "$full" >> docs/design/refpacks/bx/sources.md
  run bash "$(_explore)" jury jx --n 4 --seed 7 "${REFS[@]}"
  [ "$status" -eq 1 ] && [[ "$output" == *"has 2 provenance rows"* ]] || { echo "two rows were accepted: $status $output"; false; }
}

@test "unblind: checked rankings bound to another sealed key are refused, even with the same id and n (L3)" {
  _fixture 3 1; _rival_fixture DRAFTED; _adr1411
  _rival_scored 50 60
  grep -qE '"key_sha256": "[0-9a-f]{64}"' "$(_jury_dir)/result.json" || { echo "jury-check did not bind the key"; false; }
  node -e 'const f=process.argv[1],r=require(f);r.key_sha256="0".repeat(64);require("fs").writeFileSync(f,JSON.stringify(r))' "$(_jury_dir)/result.json"
  run bash "$(_explore)" unblind jx
  [ "$status" -eq 1 ] && [[ "$output" == *"this deal's checked rankings"* ]] || { echo "rankings of another key were counted: $status $output"; false; }
}

@test "render: a rival route with an extra directory or a dot segment is refused before any pattern (L9, B10)" {
  _fixture 3 1
  local r
  for r in docs/design/explore/a/b/rival-x/index.html docs/design/explore/jx/rival-stitch/../variant-a/index.html docs/design/explore/jx//rival-stitch/index.html; do
    run bash "$SANDBOX/.claude/scripts/design/design-render.sh" "$r" --mode explore --session jx--rival-stitch
    [ "$status" -eq 1 ] && [[ "$output" == *"REFUSED"* ]] || { echo "the renderer took $r: $status $output"; false; }
  done
}

# ---------- Phase 07 S4b: every item through the renderer, nothing file-level left to tell them apart ----------

@test "jury: every dealt item is a PNG with no metadata and one timestamp, and a reference carries its pack hash (S4b)" {
  _fixture 3 1; _rival_fixture DRAFTED
  run bash "$(_explore)" jury jx --n 5 --seed 7 --rival stitch "${REFS[@]}"
  [ "$status" -eq 0 ] || { echo "the deal failed: $output"; false; }
  [ "$(ls "$(_jury_dir)/items" | grep -c '\.png$')" -eq 5 ] || { echo "not five PNGs: $(ls "$(_jury_dir)/items")"; false; }
  node -e 'const fs=require("fs"),p=require("path"),d=process.argv[1];const t=new Set(fs.readdirSync(d).map(f=>fs.statSync(p.join(d,f)).mtimeMs));if(t.size!==1)process.exit(1)' "$(_jury_dir)/items" \
    || { echo "the items carry different timestamps"; false; }
  node -e 'const k=require(process.argv[1]);const r=k.items.find(i=>i.kind==="reference");if(!/^[0-9a-f]{64}$/.test(r.pack_sha256||"")||r.pack_sha256===r.sha256)process.exit(1)' "$(_jury_dir)/key.json" \
    || { echo "the reference item is not the render of a framed pack screen"; false; }
}

@test "jury: a reference that was never framed, or whose frame is not the pack screen, is refused (S4b)" {
  _fixture 3 1
  local r="${REFS[3]}"
  [ "${#r}" -eq 16 ] || { echo "fixture: no ref prefix"; false; }
  printf 'not the pack screen' > "docs/design/explore/jx/ref-$r/image.png"
  run bash "$(_explore)" jury jx --n 4 --seed 7 "${REFS[@]}"
  [ "$status" -eq 1 ] && [[ "$output" == *"is not the pack screen it names"* ]] || { echo "a swapped frame was dealt: $status $output"; false; }
  rm -rf "docs/design/explore/jx/ref-$r"
  run bash "$(_explore)" jury jx --n 4 --seed 7 "${REFS[@]}"
  [ "$status" -eq 1 ] && [[ "$output" == *"is not framed for this explore"* ]] && [[ "$output" == *"design-explore.sh ref jx --ref $r"* ]] || { echo "an unframed reference was dealt: $status $output"; false; }
  [ ! -e "$(_jury_dir)" ] || { echo "a refused deal left a jury dir"; false; }
}

@test "jury: a render carrying a PNG text chunk is refused before it is dealt (S4b, the gallery iTXt source URL)" {
  _fixture 3 1
  local sess=".claude/state/design/renders/jx--variant-a" png meta
  png="$sess/r-1440x900.png"; meta="$sess/r-1440x900.json"
  node -e 'const fs=require("fs"),z=require("zlib");const f=process.argv[1];const b=fs.readFileSync(f);const crc=(x)=>{let c=~0;for(const v of x){c^=v;for(let k=0;k<8;k++)c=(c>>>1)^(0xedb88320&-(c&1))}return (~c)>>>0};const td=Buffer.concat([Buffer.from("iTXt"),Buffer.from("Source\0\0\0\0\0https://example.org/x")]);const l=Buffer.alloc(4);l.writeUInt32BE(td.length-4);const r=Buffer.alloc(4);r.writeUInt32BE(crc(td));const iend=b.length-12;fs.writeFileSync(f,Buffer.concat([b.subarray(0,iend),l,td,r,b.subarray(iend)]))' "$png"
  sha="$(_sha "$png")"
  node -e 'const fs=require("fs"),f=process.argv[1];const m=JSON.parse(fs.readFileSync(f));m.screenshot_sha256=process.argv[2];fs.writeFileSync(f,JSON.stringify(m))' "$meta" "$sha"
  grep -q 'iTXt' "$png" || { echo "fixture: chunk not planted"; false; }
  run bash "$(_explore)" jury jx --n 4 --seed 7 "${REFS[@]}"
  [ "$status" -eq 1 ] && [[ "$output" == *"carries PNG metadata (iTXt)"* ]] || { echo "a render with metadata was dealt: $status $output"; false; }
  [ ! -e "$(_jury_dir)" ] || { echo "a refused deal left a half-dealt jury dir (attack 1773af3 B1)"; false; }
}

# Plant one ancillary chunk of type $3 before IEND in render $1 and re-bind its meta $2 to the new bytes.
_plant_chunk() {
  node -e 'const fs=require("fs");const f=process.argv[1],t=process.argv[2];const b=fs.readFileSync(f);const crc=(x)=>{let c=~0;for(const v of x){c^=v;for(let k=0;k<8;k++)c=(c>>>1)^(0xedb88320&-(c&1))}return (~c)>>>0};const td=Buffer.concat([Buffer.from(t),Buffer.from([0])]);const l=Buffer.alloc(4);l.writeUInt32BE(1);const r=Buffer.alloc(4);r.writeUInt32BE(crc(td));const iend=b.length-12;fs.writeFileSync(f,Buffer.concat([b.subarray(0,iend),l,td,r,b.subarray(iend)]))' "$1" "$3"
  node -e 'const fs=require("fs"),c=require("crypto");const m=JSON.parse(fs.readFileSync(process.argv[1]));m.screenshot_sha256=c.createHash("sha256").update(fs.readFileSync(process.argv[2])).digest("hex");fs.writeFileSync(process.argv[1],JSON.stringify(m))' "$2" "$1"
  grep -q "$3" "$1" || { echo "fixture: $3 not planted"; return 1; }
}

@test "jury: a chunk one item carries and the others do not is refused; a chunk all items share is dealt (attack 1773af3 L8)" {
  _fixture 3 1
  _plant_chunk .claude/state/design/renders/jx--variant-a/r-1440x900.png .claude/state/design/renders/jx--variant-a/r-1440x900.json sRGB
  run bash "$(_explore)" jury jx --n 4 --seed 7 "${REFS[@]}"
  [ "$status" -eq 1 ] && [[ "$output" == *"do not share one PNG chunk set"* ]] || { echo "one encoder told apart was dealt: $status $output"; false; }
  [ ! -e "$(_jury_dir)" ] || { echo "a refused deal left a jury dir"; false; }
  local s
  for s in .claude/state/design/renders/jx--variant-b .claude/state/design/renders/jx--variant-c .claude/state/design/renders/jx--ref-"${REFS[3]}"; do
    _plant_chunk "$s/r-1440x900.png" "$s/r-1440x900.json" sRGB
  done
  run bash "$(_explore)" jury jx --n 4 --seed 7 "${REFS[@]}"
  [ "$status" -eq 0 ] || { echo "a chunk every item shares was refused: $output"; false; }
}

@test "frame: copies the pack screen into a gitignored ref dir under a text-free page, and refuses a linked dir (S4b)" {
  _fixture 3 1
  local r="${REFS[3]}"
  rm -rf "docs/design/explore/jx/ref-$r"
  run node "$SANDBOX/.claude/scripts/design/design-jury.mjs" frame --root "$SANDBOX" --id jx --ref "$r"
  [ "$status" -eq 0 ] && [[ "$output" == *"framed $r"* ]] || { echo "$status $output"; false; }
  [ "$(_sha "docs/design/explore/jx/ref-$r/image.png")" = "$(_sha .claude/state/design/refpacks/bx/nicelydone-$r.png)" ] || { echo "the frame is not the pack bytes"; false; }
  grep -q '<img src="image.png" alt="">' "docs/design/explore/jx/ref-$r/index.html"
  run git -C "$ARC_ROOT" check-ignore -q "docs/design/explore/any-explore/ref-$r/image.png"
  [ "$status" -eq 0 ] || { echo "a framed pack screen would be tracked by git"; false; }
  rm -rf "docs/design/explore/jx/ref-$r"; mkdir -p "$BATS_TEST_TMPDIR/elsewhere"
  ln -s "$BATS_TEST_TMPDIR/elsewhere" "docs/design/explore/jx/ref-$r" 2>/dev/null || true
  [ -L "docs/design/explore/jx/ref-$r" ] || skip "this filesystem made a copy, not a symlink"
  run node "$SANDBOX/.claude/scripts/design/design-jury.mjs" frame --root "$SANDBOX" --id jx --ref "$r"
  [ "$status" -eq 1 ] && [[ "$output" == *"is a link or not a directory"* ]] || { echo "$status $output"; false; }
  [ -z "$(ls -A "$BATS_TEST_TMPDIR/elsewhere")" ] || { echo "the frame was written through the link"; false; }
}

@test "render: a ref dir that is not ref-<16 lowercase hex> is refused (S4b)" {
  _fixture 3 1
  local r
  for r in docs/design/explore/jx/ref-0123/index.html docs/design/explore/jx/ref-0123456789ABCDEF/index.html docs/design/explore/jx/ref-0123456789abcdeg/index.html; do
    run bash "$SANDBOX/.claude/scripts/design/design-render.sh" "$r" --mode explore --session jx--ref-x
    [ "$status" -eq 1 ] && [[ "$output" == *"REFUSED"* ]] || { echo "the renderer took $r: $status $output"; false; }
  done
}

@test "this file registered every test it declares" {
  [ "${#BATS_TEST_NAMES[@]}" -eq 40 ] || {
    echo "registered ${#BATS_TEST_NAMES[@]} tests, expected 40 -- a @test was silently dropped"
    false
  }
}
