#!/usr/bin/env bats
# Cycle 16 Phase 08 S1-S3 (REQ-10, ADR-1410) -- nothing leaves the repo carrying someone else's authorship.
#
# The packager is the gate whose failure is irreversible: a package reaches people outside arc. It is
# proved by REFUSAL, not by a clean pass -- a rival render, a gallery image and a render with no
# provenance are each planted and each refused by name. The clean package is the paired control, so the
# refusals cannot come from a gate that refuses everything.
bats_require_minimum_version 1.5.0
load 'test_helper'

_pkg() { echo "$SANDBOX/.claude/scripts/design/design-package.mjs"; }
_refpack() { echo "$SANDBOX/.claude/scripts/design/design-refpack.mjs"; }
_sha() { node -e 'process.stdout.write(require("crypto").createHash("sha256").update(require("fs").readFileSync(process.argv[1])).digest("hex"))' "$1"; }

# A real one-pixel PNG whose colour derives from $2, so distinct names give distinct bytes.
_png() {
  node -e 'const z=require("zlib"),c=require("crypto"),fs=require("fs");const crc=(b)=>{let x=~0;for(const v of b){x^=v;for(let k=0;k<8;k++)x=(x>>>1)^(0xedb88320&-(x&1))}return (~x)>>>0};const ch=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const r=Buffer.alloc(4);r.writeUInt32BE(crc(td));return Buffer.concat([l,td,r])};const h=c.createHash("sha256").update(process.argv[2]).digest();const ih=Buffer.alloc(13);ih.writeUInt32BE(1,0);ih.writeUInt32BE(1,4);ih[8]=8;ih[9]=2;fs.writeFileSync(process.argv[1],Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),ch("IHDR",ih),ch("IDAT",z.deflateSync(Buffer.from([0,h[0],h[1],h[2]]))),ch("IEND",Buffer.alloc(0))]))' "$1" "$2"
  [ -s "$1" ] || { echo "fixture: _png wrote nothing"; return 1; }
}

# A render receipt for session ex--$1 with provenance $2 ("-" writes none at all).
_render() {
  local d="$SANDBOX/.claude/state/design/renders/ex--$1" p prov=""
  mkdir -p "$d"; p="$d/r-1440x900.png"; _png "$p" "$1" || return 1
  [ "$2" = "-" ] || prov=",\"provenance\":\"$2\""
  printf '{"png":".claude/state/design/renders/ex--%s/r-1440x900.png","screenshot_sha256":"%s","viewport":"1440x900@1","session":"ex--%s","iter":1%s}\n' "$1" "$(_sha "$p")" "$1" "$prov" > "$d/r-1440x900.json"
  [ -s "$d/r-1440x900.json" ] || { echo "fixture: no meta for $1"; return 1; }
}

setup() {
  _arc_design_sandbox
  [ -f "$(_pkg)" ] || { echo "fixture: design-package.mjs not in the sandbox"; return 1; }
  _render variant-a arc && _render variant-b arc && _render variant-c arc
  _render rival-stitch rival:stitch && _render variant-d -
  mkdir -p "$SANDBOX/.claude/state/design/refpacks/bx"
  _png "$SANDBOX/.claude/state/design/refpacks/bx/nicelydone-0123456789abcdef.png" "gallery"
}

teardown() { rm -rf "$SANDBOX"; }

_build_clean() {
  run node "$(_pkg)" build --root "$SANDBOX" --explore ex --render variant-a --render variant-b --render variant-c
  [ "$status" -eq 0 ] || { echo "the clean build failed: $output"; return 1; }
  PKG="$SANDBOX/docs/design/blind-test/ex/package"
}

# ---------- S2: the packager ----------

@test "package: a clean build carries three arc renders, and the mapping sits BESIDE the package, never in it" {
  _build_clean
  [ "$(ls "$PKG" | tr '\n' ' ')" = "direction-1.png direction-2.png direction-3.png " ] || { echo "unexpected package contents: $(ls "$PKG")"; false; }
  [ -f "$SANDBOX/docs/design/blind-test/ex/package-manifest.json" ] || { echo "no manifest"; false; }
  node -e 'const m=require(process.argv[1]);if(m.files.length!==3||!m.files.every(f=>f.provenance==="arc"&&/^[0-9a-f]{64}$/.test(f.sha256)))process.exit(1)' "$SANDBOX/docs/design/blind-test/ex/package-manifest.json"
  [[ "$output" == *"clean -- every image is an arc render"* ]]
  run node "$(_pkg)" lint --root "$SANDBOX" --dir docs/design/blind-test/ex/package
  [ "$status" -eq 0 ] || { echo "lint refused a clean package: $output"; false; }
}

@test "package: THE THREE PLANTED REFUSALS -- a rival render, a gallery image, an absent provenance -- each by name" {
  _build_clean
  cp "$SANDBOX/.claude/state/design/renders/ex--rival-stitch/r-1440x900.png" "$PKG/direction-4.png"
  cp "$SANDBOX/.claude/state/design/refpacks/bx/nicelydone-0123456789abcdef.png" "$PKG/direction-5.png"
  cp "$SANDBOX/.claude/state/design/renders/ex--variant-d/r-1440x900.png" "$PKG/direction-6.png"
  run node "$(_pkg)" lint --root "$SANDBOX" --dir docs/design/blind-test/ex/package
  [ "$status" -eq 1 ] || { echo "a planted package passed: $output"; false; }
  [[ "$output" == *"REFUSED NON-ARC direction-4.png"*"rival:stitch"* ]] || { echo "the rival render was not refused by name: $output"; false; }
  [[ "$output" == *"REFUSED GALLERY direction-5.png"* ]] || { echo "the gallery image was not refused by name: $output"; false; }
  [[ "$output" == *"REFUSED PROVENANCE-ABSENT direction-6.png"* ]] || { echo "the provenance-less render was not refused by name: $output"; false; }
  local d; for d in direction-1.png direction-2.png direction-3.png; do
    [[ "$output" != *" $d "* ]] || { echo "the clean arc render $d was refused too: $output"; false; }
  done
  [ "$(printf "%s
" "$output" | grep -c "^design-package: REFUSED ")" -eq 3 ] || { echo "not exactly the three planted files refused: $output"; false; }
}

@test "package: bytes no receipt names, a renamed gallery image, a link, a subdir and a stray file type are refused" {
  _build_clean
  _png "$PKG/direction-4.png" "made-up"
  cp "$SANDBOX/.claude/state/design/refpacks/bx/nicelydone-0123456789abcdef.png" "$PKG/arc-direction.png"
  mkdir "$PKG/extra"
  printf 'x' > "$PKG/notes.txt"
  printf '{}' > "$PKG/package.json"
  ln -s "$SANDBOX/.claude/state/design/renders/ex--variant-a/r-1440x900.png" "$PKG/linked.png" 2>/dev/null || true
  run node "$(_pkg)" lint --root "$SANDBOX" --dir docs/design/blind-test/ex/package
  [ "$status" -eq 1 ] || { echo "$output"; false; }
  [[ "$output" == *"REFUSED UNATTRIBUTED direction-4.png"* ]] && [[ "$output" == *"REFUSED GALLERY arc-direction.png"* ]] || { echo "$output"; false; }
  [[ "$output" == *"REFUSED NOT-ALLOWED extra"* ]] && [[ "$output" == *"REFUSED NOT-ALLOWED notes.txt"* ]] && [[ "$output" == *"REFUSED NOT-ALLOWED package.json"* ]] || { echo "$output"; false; }
  if [ -L "$PKG/linked.png" ]; then [[ "$output" == *"REFUSED NOT-ALLOWED linked.png"* ]] || { echo "a link passed: $output"; false; }; fi
}

@test "package: build refuses a rival or reference asked for, a render with no or non-arc provenance, and a second build" {
  run node "$(_pkg)" build --root "$SANDBOX" --explore ex --render rival-stitch
  [ "$status" -eq 1 ] && [[ "$output" == *"--render takes variant-<letter>"* ]] || { echo "$status $output"; false; }
  run node "$(_pkg)" build --root "$SANDBOX" --explore ex --render variant-a --render variant-d
  [ "$status" -eq 1 ] && [[ "$output" == *"variant-d's latest render records provenance 'absent', not arc"* ]] || { echo "$status $output"; false; }
  [ ! -e "$SANDBOX/docs/design/blind-test/ex/package" ] || { echo "a refused build left a package"; false; }
  _build_clean
  run node "$(_pkg)" build --root "$SANDBOX" --explore ex --render variant-a
  [ "$status" -eq 1 ] && [[ "$output" == *"already exists"* ]] || { echo "$status $output"; false; }
}

@test "package: an empty package is not a clean one, and --out may not leave docs/design/blind-test" {
  mkdir -p "$SANDBOX/docs/design/blind-test/empty/package"
  run node "$(_pkg)" lint --root "$SANDBOX" --dir docs/design/blind-test/empty/package
  [ "$status" -eq 1 ] && [[ "$output" == *"no images"* ]] || { echo "$status $output"; false; }
  run node "$(_pkg)" build --root "$SANDBOX" --explore ex --render variant-a --out docs/elsewhere/package
  [ "$status" -eq 1 ] && [[ "$output" == *"--out must be a dir inside docs/design/blind-test/<explore>/"* ]] || { echo "$status $output"; false; }
}

@test "package: the committed lexos-case-workspace-v1 package FAILS CLOSED -- its renders predate provenance" {
  [ -d "$ARC_ROOT/docs/design/blind-test/lexos-case-workspace-v1/package" ] || skip "no committed v1 package in this checkout"
  run node "$ARC_ROOT/.claude/scripts/design/design-package.mjs" lint --root "$SANDBOX" --dir "$ARC_ROOT/docs/design/blind-test/lexos-case-workspace-v1/package"
  [ "$status" -eq 1 ] || { echo "a package with no render receipts passed: $output"; false; }
  [[ "$output" == *"REFUSED UNATTRIBUTED direction-1.png"* ]] || { echo "$output"; false; }
}

# ---------- S3: the manual-drop door ----------

@test "drop: an owner-chosen screen enters the pack attributed, and the next listing shows it" {
  _png "$BATS_TEST_TMPDIR/drop.png" "owner-drop"
  run node "$(_refpack)" --drop "$BATS_TEST_TMPDIR/drop.png" --brief bx --url "https://example.org/screen?sig=secret" --principle "status before history" --avoid "copying the look"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  sha="$(_sha "$BATS_TEST_TMPDIR/drop.png")"
  [ -f "$SANDBOX/.claude/state/design/refpacks/bx/manual-${sha:0:16}.png" ] || { echo "the screen was not placed in the pack"; false; }
  row="$(grep -F "$sha" "$SANDBOX/docs/design/refpacks/bx/sources.md")"
  [[ "$row" == *"| https://example.org/screen (dropped by the owner, not fetched) |"* ]] && [[ "$row" == *"| manual (owner) | status before history | copying the look |"* ]] || { echo "the row is not attributed: $row"; false; }
  [[ "$row" != *"sig=secret"* ]] || { echo "the query string reached the committed row"; false; }
  [ "$(awk -F'|' -v s="$sha" '$4 ~ s' "$SANDBOX/docs/design/refpacks/bx/sources.md" | wc -l | tr -d ' ')" -eq 1 ]
}

@test "drop: no url or no principle, a second drop of the same screen, a non-image and a link are each refused" {
  _png "$BATS_TEST_TMPDIR/drop.png" "owner-drop"
  run node "$(_refpack)" --drop "$BATS_TEST_TMPDIR/drop.png" --brief bx --principle p --avoid a
  [ "$status" -eq 1 ] && [[ "$output" == *"--drop needs --url"* ]] || { echo "$status $output"; false; }
  run node "$(_refpack)" --drop "$BATS_TEST_TMPDIR/drop.png" --brief bx --url https://example.org/s --avoid a
  [ "$status" -eq 1 ] && [[ "$output" == *"--drop needs --principle"* ]] || { echo "$status $output"; false; }
  [ ! -e "$SANDBOX/docs/design/refpacks/bx/sources.md" ] || { echo "a refused drop wrote a row"; false; }
  run node "$(_refpack)" --drop "$BATS_TEST_TMPDIR/drop.png" --brief bx --url https://example.org/s --principle p --avoid a
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  run node "$(_refpack)" --drop "$BATS_TEST_TMPDIR/drop.png" --brief bx --url https://example.org/s --principle p --avoid a
  [ "$status" -eq 1 ] && [[ "$output" == *"already in the pack"* ]] || { echo "a second row was written: $status $output"; false; }
  printf 'not an image' > "$BATS_TEST_TMPDIR/x.png"
  run node "$(_refpack)" --drop "$BATS_TEST_TMPDIR/x.png" --brief bx --url https://example.org/s --principle p --avoid a
  [ "$status" -eq 1 ] && [[ "$output" == *"not a png, jpg, gif, webp or avif image"* ]] || { echo "$status $output"; false; }
  ln -s "$BATS_TEST_TMPDIR/drop.png" "$BATS_TEST_TMPDIR/link.png" 2>/dev/null || true
  if [ -L "$BATS_TEST_TMPDIR/link.png" ]; then
    run node "$(_refpack)" --drop "$BATS_TEST_TMPDIR/link.png" --brief bx --url https://example.org/s2 --principle p --avoid a
    [ "$status" -eq 1 ] && [[ "$output" == *"a link or not a regular file"* ]] || { echo "$status $output"; false; }
  fi
}

@test "drop: a dropped screen is a gallery image to the packager -- it can never ride out in a package" {
  _png "$BATS_TEST_TMPDIR/drop.png" "owner-drop"
  run node "$(_refpack)" --drop "$BATS_TEST_TMPDIR/drop.png" --brief bx --url https://example.org/s --principle p --avoid a
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  _build_clean
  cp "$BATS_TEST_TMPDIR/drop.png" "$PKG/direction-4.png"
  run node "$(_pkg)" lint --root "$SANDBOX" --dir docs/design/blind-test/ex/package
  [ "$status" -eq 1 ] && [[ "$output" == *"REFUSED GALLERY direction-4.png"* ]] || { echo "$status $output"; false; }
}

# ---------- S1: provenance is derived from the route's own directory ----------

@test "render: a real render writes provenance from its own directory -- arc for a variant, rival:<p> for a rival" {
  mkdir -p "$SANDBOX/bin" "$SANDBOX/fakestate" "$SANDBOX/docs/design/explore/t/variant-a" "$SANDBOX/docs/design/explore/t/rival-stitch"
  cp "$ARC_ROOT/tests/fixtures/design/fake-agent-browser.sh" "$SANDBOX/bin/agent-browser"
  chmod +x "$SANDBOX/bin/agent-browser"
  PATH="$SANDBOX/bin:$PATH"; export PATH
  FAKE_AB_STATE="$SANDBOX/fakestate"; export FAKE_AB_STATE
  printf '<!doctype html><title>a</title><p>variant page</p>\n' > "$SANDBOX/docs/design/explore/t/variant-a/index.html"
  printf '<!doctype html><title>r</title><p>rival page</p>\n' > "$SANDBOX/docs/design/explore/t/rival-stitch/index.html"
  git -C "$SANDBOX" add -A >/dev/null 2>&1; git -C "$SANDBOX" commit -qm pages >/dev/null 2>&1
  cd "$SANDBOX"
  FAKE_AB_SHOTS="A A" run bash .claude/scripts/design/design-render.sh docs/design/explore/t/variant-a/index.html --mode explore --session t--variant-a --iter 1
  [ "$status" -eq 0 ] || { echo "the variant render failed: $output"; false; }
  rm -f "$SANDBOX/fakestate/count"
  FAKE_AB_SHOTS="B B" run bash .claude/scripts/design/design-render.sh docs/design/explore/t/rival-stitch/index.html --mode explore --session t--rival-stitch
  [ "$status" -eq 0 ] || { echo "the rival render failed: $output"; false; }
  va="$(ls "$SANDBOX"/.claude/state/design/renders/t--variant-a/*.json | head -1)"; rv="$(ls "$SANDBOX"/.claude/state/design/renders/t--rival-stitch/*.json | head -1)"
  [ -n "$va" ] && [ -n "$rv" ] || { echo "no metas were written"; false; }
  node -e 'const a=require(process.argv[1]),r=require(process.argv[2]);if(a.provenance!=="arc"||r.provenance!=="rival:stitch")process.exit(1)' "$va" "$rv" \
    || { echo "provenance wrong: $(cat "$va") $(cat "$rv")"; false; }
}

# ---------- attack 12b79c2 round 1 ----------

@test "package: a bare JSON naming any bytes as arc, or a receipt whose png is a hardlink, attributes nothing (L1 L2)" {
  _build_clean
  _png "$BATS_TEST_TMPDIR/foreign.png" "foreign"
  mkdir -p "$SANDBOX/.claude/state/design/renders/forge"
  printf '{"screenshot_sha256":"%s","provenance":"arc"}
' "$(_sha "$BATS_TEST_TMPDIR/foreign.png")" > "$SANDBOX/.claude/state/design/renders/forge/x.json"
  cp "$BATS_TEST_TMPDIR/foreign.png" "$PKG/direction-4.png"
  run node "$(_pkg)" lint --root "$SANDBOX" --dir docs/design/blind-test/ex/package
  [ "$status" -eq 1 ] && [[ "$output" == *"REFUSED UNATTRIBUTED direction-4.png"* ]] || { echo "a forged receipt attributed bytes: $status $output"; false; }
  rm -f "$PKG/direction-4.png"
  _png "$BATS_TEST_TMPDIR/outside.png" "outside"
  local s="$SANDBOX/.claude/state/design/renders/ex--variant-e"; mkdir -p "$s"
  ln "$BATS_TEST_TMPDIR/outside.png" "$s/r-1440x900.png" 2>/dev/null || skip "this filesystem cannot hardlink"
  printf '{"png":".claude/state/design/renders/ex--variant-e/r-1440x900.png","screenshot_sha256":"%s","viewport":"1440x900@1","iter":1,"provenance":"arc"}
' "$(_sha "$s/r-1440x900.png")" > "$s/r-1440x900.json"
  cp "$BATS_TEST_TMPDIR/outside.png" "$PKG/direction-4.png"
  run node "$(_pkg)" lint --root "$SANDBOX" --dir docs/design/blind-test/ex/package
  [ "$status" -eq 1 ] && [[ "$output" == *"REFUSED UNATTRIBUTED direction-4.png"* ]] || { echo "a hardlinked render was attributed: $status $output"; false; }
}

@test "package: the same render twice is a DUPLICATE, and a refused build leaves no manifest behind (L5 L7)" {
  _build_clean
  cp "$PKG/direction-1.png" "$PKG/direction-4.png"
  run node "$(_pkg)" lint --root "$SANDBOX" --dir docs/design/blind-test/ex/package
  [ "$status" -eq 1 ] && [[ "$output" == *"REFUSED DUPLICATE direction-4.png"* ]] || { echo "$status $output"; false; }
  _png "$SANDBOX/.claude/state/design/refpacks/bx/nicelydone-fedcba9876543210.png" "variant-b"
  run node "$(_pkg)" build --root "$SANDBOX" --explore ex --render variant-b --out docs/design/blind-test/ex2/package
  [ "$status" -eq 1 ] && [[ "$output" == *"REFUSED GALLERY"* ]] || { echo "a build carrying a gallery match passed: $status $output"; false; }
  [ ! -e "$SANDBOX/docs/design/blind-test/ex2/package" ] && [ ! -e "$SANDBOX/docs/design/blind-test/ex2/package-manifest.json" ] || { echo "a refused build left a package or a manifest"; false; }
}

@test "render: a rival route rendered OUTSIDE explore mode is still the rival, not arc (L12 B1)" {
  mkdir -p "$SANDBOX/bin" "$SANDBOX/fakestate" "$SANDBOX/docs/design/explore/t/rival-stitch"
  cp "$ARC_ROOT/tests/fixtures/design/fake-agent-browser.sh" "$SANDBOX/bin/agent-browser"; chmod +x "$SANDBOX/bin/agent-browser"
  PATH="$SANDBOX/bin:$PATH"; export PATH; FAKE_AB_STATE="$SANDBOX/fakestate"; export FAKE_AB_STATE
  printf '<!doctype html><title>r</title><p>rival page</p>
' > "$SANDBOX/docs/design/explore/t/rival-stitch/index.html"
  git -C "$SANDBOX" add -A >/dev/null 2>&1; git -C "$SANDBOX" commit -qm page >/dev/null 2>&1
  cd "$SANDBOX"
  FAKE_AB_SHOTS="C C" run bash .claude/scripts/design/design-render.sh docs/design/explore/t/rival-stitch/index.html
  [ "$status" -eq 0 ] || { echo "the plain render failed: $output"; false; }
  m="$(ls -t "$SANDBOX"/.claude/state/design/renders/*rival-stitch*.json 2>/dev/null | head -1)"
  [ -n "$m" ] || m="$(grep -rl '"route": "docs/design/explore/t/rival-stitch' "$SANDBOX/.claude/state/design/renders" | head -1)"
  [ -n "$m" ] || { echo "no meta was written"; false; }
  node -e 'if(require(process.argv[1]).provenance!=="rival:stitch")process.exit(1)' "$m" || { echo "a rival render outside explore was stamped: $(cat "$m")"; false; }
}

# ---------- attack 0b68278 round 2 ----------

@test "package: a README is refused -- prose can carry the mapping -- and the blind-test root is never a package (B5 B2)" {
  _build_clean
  printf "direction-1 is the guided workflow
" > "$PKG/README.md"
  run node "$(_pkg)" lint --root "$SANDBOX" --dir docs/design/blind-test/ex/package
  [ "$status" -eq 1 ] && [[ "$output" == *"REFUSED NOT-ALLOWED README.md"* ]] || { echo "a README rode in the package: $status $output"; false; }
  run node "$(_pkg)" build --root "$SANDBOX" --explore ex --render variant-a --out docs/design/blind-test
  [ "$status" -eq 1 ] && [[ "$output" == *"--out must be a dir inside"* ]] || { echo "$status $output"; false; }
  run node "$(_pkg)" build --root "$SANDBOX" --explore ex --render variant-a --out docs/design/blind-test/flat
  [ "$status" -eq 1 ] && [[ "$output" == *"--out must be a dir inside"* ]] || { echo "$status $output"; false; }
}

@test "this file registered every test it declares" {
  [ "${#BATS_TEST_NAMES[@]}" -eq 15 ] || {
    echo "registered ${#BATS_TEST_NAMES[@]} tests, expected 15 -- a @test was silently dropped"
    false
  }
}
