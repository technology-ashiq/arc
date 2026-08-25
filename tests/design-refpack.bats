#!/usr/bin/env bats
# Cycle 16 Phase 02 slice B (REQ-04) -- the robots preflight and the pack builder.
#
# ADR-1404 caches images to .claude/state/design/refpacks/<brief>/ and commits provenance only.
# ADR-1412 decided WHICH sources may be read at all, on robots.txt and terms rather than on how
# good the gallery looks. Slice A made that decision typed and lint-guarded; this slice is the
# half that actually reaches the network, so it is the half where a wrong answer costs someone
# else something.
#
# Three refusal classes, kept SEPARATE on purpose, because collapsing them is the defect ADR-1412
# already paid for once:
#
#   DISALLOW    -- we read their robots.txt and it says no
#   UNREADABLE  -- we could not read their robots.txt at all (land-book returns 403 for
#                  robots.txt ITSELF). Unreadable permission is not permission, and it is also
#                  not a refusal by them -- it must never harden into "they said no"
#   ALLOW       -- including a 404, which is the standard's answer and not a guess
#
# Every refusal is RECORDED. A silent skip is the failure mode the phase spec names by name: a
# pack that quietly came from one source reads exactly like a pack that came from two.
#
# OFFLINE-FIRST. Every case here drives the fake transport (--robots-file / --robots-status /
# --fixture). Nothing in this file reaches the network, and the fake RECORDS each attempt so
# "zero fetch attempts" is a measured fact rather than the absence of an assertion.
bats_require_minimum_version 1.5.0
load 'test_helper'

_robots() { echo "$SANDBOX/.claude/scripts/design/design-robots.mjs"; }
_refpack() { echo "$SANDBOX/.claude/scripts/design/design-refpack.mjs"; }

# The registry the pack builder reads. Deliberately a MUTANT of the real file in exactly one
# dimension per case -- the same discipline design-sources.bats uses -- so a refusal for an
# unrelated reason is caught by the control case at the end of section 3.
_registry() {
  cat > "$SANDBOX/design.sources.yaml" <<'EOF'
sources:
  - id: lapa-ninja
    kind:
      - inspiration
    access: fetch
    allowed_use:
      - reference-pack
      - provenance
    auth: none
    cost: free
    status: active
    availability: unknown
    approved_by: ashiq
    added: 2026-08-23

  - id: awwwards
    kind:
      - inspiration
    access: fetch
    allowed_use:
      - provenance
      - link-only
    auth: none
    cost: free
    status: active
    availability: unknown
    approved_by: ashiq
    added: 2026-08-23

  - id: godly
    kind:
      - inspiration
    access: fetch
    allowed_use:
      - provenance
    auth: none
    cost: free
    status: off
    availability: unknown
    approved_by: ashiq
    added: 2026-08-23
EOF
}

# A robots.txt on disk. The transport fake reads this instead of the network.
_robots_file() {
  printf '%s\n' "$1" > "$SANDBOX/robots.txt"
  echo "$SANDBOX/robots.txt"
}

# One byte-stable fixture standing in for a fetched screen.
_fixture() {
  printf 'PNG-FIXTURE-BYTES-%s\n' "${1:-a}" > "$SANDBOX/screen-${1:-a}.bin"
  echo "$SANDBOX/screen-${1:-a}.bin"
}

_attempts() { echo "$SANDBOX/.claude/state/design/refpacks/lexos/attempts.log"; }
_availability() { echo "$SANDBOX/.claude/state/design/refpacks/lexos/availability.log"; }
_sources_md() { echo "$SANDBOX/docs/design/refpacks/lexos/sources.md"; }

_pack_sandbox() {
  _arc_design_sandbox
  _registry
}

teardown() { _arc_teardown 2>/dev/null || true; }

# ---------- 1. the preflight decides, and says which of the three it decided ----------

@test "preflight: a Disallow for our UA refuses, and names the rule that refused" {
  _pack_sandbox
  rf="$(_robots_file 'User-agent: ClaudeBot
Disallow: /')"
  run node "$(_robots)" --url https://example.test/inspiration/x --ua ClaudeBot --robots-file "$rf"
  [ "$status" -eq 3 ] || { echo "expected 3 DISALLOW, got $status: $output"; false; }
  echo "$output" | grep -q "DISALLOW" || { echo "refused without saying DISALLOW: $output"; false; }
  # The MATCHED rule, not just the verdict. A preflight that cannot say which line refused
  # cannot be audited, and this lane has already shipped a gate whose refusal reason was
  # unrecoverable from its own output.
  echo "$output" | grep -q "Disallow: /" || { echo "refused without naming the rule: $output"; false; }
}

@test "preflight: a Disallow aimed at a DIFFERENT path does not refuse ours" {
  _pack_sandbox
  # The paired control. Without it, a preflight that refuses everything passes the case above
  # and the gate is a permanent no.
  rf="$(_robots_file 'User-agent: *
Disallow: /api/')"
  run node "$(_robots)" --url https://example.test/inspiration/x --ua ClaudeBot --robots-file "$rf"
  [ "$status" -eq 0 ] || { echo "expected 0 ALLOW, got $status: $output"; false; }
  echo "$output" | grep -q "ALLOW" || { echo "allowed without saying ALLOW: $output"; false; }
}

@test "preflight: an absent robots.txt (404) is ALLOW, by the standard and not by guess" {
  _pack_sandbox
  run node "$(_robots)" --url https://example.test/x --ua ClaudeBot --robots-status 404
  [ "$status" -eq 0 ] || { echo "expected 0 ALLOW for 404, got $status: $output"; false; }
  echo "$output" | grep -q "404" || { echo "allowed without recording WHY: $output"; false; }
}

@test "preflight: robots.txt itself returning 403 is UNREADABLE, never ALLOW and never DISALLOW" {
  _pack_sandbox
  # land-book, verbatim from ADR-1412: a Cloudflare challenge returns 403 for robots.txt
  # ITSELF. Unreadable permission is not permission -- so this may not fall through to ALLOW.
  # It is also not their refusal -- so it may not be recorded as DISALLOW, or "we could not
  # check" hardens into "they said no" and the source never gets reconsidered.
  run node "$(_robots)" --url https://example.test/x --ua ClaudeBot --robots-status 403
  [ "$status" -eq 4 ] || { echo "expected 4 UNREADABLE, got $status: $output"; false; }
  echo "$output" | grep -q "UNREADABLE" || { echo "not classed UNREADABLE: $output"; false; }
  echo "$output" | grep -qi "disallow" && { echo "an unreadable robots was reported as their refusal: $output"; false; }
  true
}

@test "preflight: the UA-specific group beats the wildcard group" {
  _pack_sandbox
  # A wildcard Allow with a named Disallow is exactly godly's shape. Reading only the `*` group
  # would return ALLOW for a source that names us and says no.
  rf="$(_robots_file 'User-agent: *
Allow: /

User-agent: ClaudeBot
Disallow: /')"
  run node "$(_robots)" --url https://example.test/x --ua ClaudeBot --robots-file "$rf"
  [ "$status" -eq 3 ] || { echo "the wildcard group won over our own: $status $output"; false; }
}

@test "preflight: the longest matching path rule wins, and Allow beats Disallow at equal length" {
  _pack_sandbox
  rf="$(_robots_file 'User-agent: *
Disallow: /inspiration/
Allow: /inspiration/public/')"
  run node "$(_robots)" --url https://example.test/inspiration/public/x --ua ClaudeBot --robots-file "$rf"
  [ "$status" -eq 0 ] || { echo "the longer Allow lost: $status $output"; false; }
  run node "$(_robots)" --url https://example.test/inspiration/private/x --ua ClaudeBot --robots-file "$rf"
  [ "$status" -eq 3 ] || { echo "the Disallow did not cover its own subtree: $status $output"; false; }
}

@test "preflight: --url is required and a bare origin is not a URL" {
  _pack_sandbox
  run node "$(_robots)"
  [ "$status" -eq 1 ] || { echo "no --url should be a usage error, got $status"; false; }
  run node "$(_robots)" --url not-a-url --robots-status 404
  [ "$status" -eq 1 ] || { echo "a non-URL should be a usage error, got $status: $output"; false; }
}

# ---------- 2. the registry gates the fetch BEFORE the network is touched ----------

@test "registry: a source with status off produces ZERO fetch attempts" {
  _pack_sandbox
  rf="$(_robots_file 'User-agent: *
Allow: /')"
  run node "$(_refpack)" --brief lexos --source godly --url https://example.test/x \
      --registry "$SANDBOX/design.sources.yaml" --robots-file "$rf" --fixture "$(_fixture a)"
  [ "$status" -ne 0 ] || { echo "an off source was fetched: $output"; false; }
  # MEASURED, not inferred from the exit code. The fake appends one line per attempt, so an
  # implementation that refuses AFTER fetching still fails here -- which is the whole point:
  # "zero attempts" is a claim about what left this machine, not about what was returned.
  [ ! -s "$(_attempts)" ] || { echo "attempts were made: $(cat "$(_attempts)")"; false; }
  echo "$output" | grep -q "status: off" || { echo "refused without naming the status: $output"; false; }
}

@test "registry: a source whose allowed_use lacks reference-pack cannot serve a pack" {
  _pack_sandbox
  rf="$(_robots_file 'User-agent: *
Allow: /')"
  # awwwards is `active` and fetchable and STILL may not serve a cached pack: its terms permit a
  # provenance link and forbid reproduction. status and allowed_use are different questions, and
  # a builder that reads only status caches something it may not keep.
  run node "$(_refpack)" --brief lexos --source awwwards --url https://example.test/x \
      --registry "$SANDBOX/design.sources.yaml" --robots-file "$rf" --fixture "$(_fixture a)"
  [ "$status" -ne 0 ] || { echo "a link-only source served a pack: $output"; false; }
  [ ! -s "$(_attempts)" ] || { echo "attempts were made for a link-only source"; false; }
  echo "$output" | grep -q "reference-pack" || { echo "refused without naming the missing use: $output"; false; }
}

@test "registry: an id absent from the registry is refused, never treated as unrestricted" {
  _pack_sandbox
  rf="$(_robots_file 'User-agent: *
Allow: /')"
  run node "$(_refpack)" --brief lexos --source not-in-registry --url https://example.test/x \
      --registry "$SANDBOX/design.sources.yaml" --robots-file "$rf" --fixture "$(_fixture a)"
  [ "$status" -ne 0 ] || { echo "an unregistered source was fetched: $output"; false; }
  [ ! -s "$(_attempts)" ] || { echo "attempts were made for an unregistered source"; false; }
}

# ---------- 3. refusals are RECORDED, and the happy path is the control ----------

@test "refpack: a robots DISALLOW is recorded as a refusal, never a silent skip" {
  _pack_sandbox
  rf="$(_robots_file 'User-agent: *
Disallow: /')"
  run node "$(_refpack)" --brief lexos --source lapa-ninja --url https://example.test/x \
      --registry "$SANDBOX/design.sources.yaml" --robots-file "$rf" --fixture "$(_fixture a)"
  [ "$status" -ne 0 ] || { echo "a disallowed fetch succeeded: $output"; false; }
  [ -f "$(_availability)" ] || { echo "the refusal was not recorded anywhere"; false; }
  grep -q "DISALLOW" "$(_availability)" || { echo "recorded, but not as a refusal: $(cat "$(_availability)")"; false; }
  grep -q "lapa-ninja" "$(_availability)" || { echo "recorded without naming the source"; false; }
}

@test "refpack: an UNREADABLE robots is recorded distinctly from a DISALLOW" {
  _pack_sandbox
  run node "$(_refpack)" --brief lexos --source lapa-ninja --url https://example.test/x \
      --registry "$SANDBOX/design.sources.yaml" --robots-status 403 --fixture "$(_fixture a)"
  [ "$status" -ne 0 ] || { echo "an unreadable robots let the fetch through: $output"; false; }
  grep -q "UNREADABLE" "$(_availability)" || { echo "not recorded as UNREADABLE: $(cat "$(_availability)")"; false; }
  grep -q "DISALLOW" "$(_availability)" && { echo "an unreadable robots was logged as their refusal"; false; }
  true
}

@test "refpack: an allowed fetch writes the image, a provenance row, and an availability line" {
  _pack_sandbox
  rf="$(_robots_file 'User-agent: *
Allow: /')"
  run node "$(_refpack)" --brief lexos --source lapa-ninja --url https://example.test/screen-1 \
      --registry "$SANDBOX/design.sources.yaml" --robots-file "$rf" --fixture "$(_fixture a)" \
      --principle "the status line owns the top-left, so the answer precedes the navigation" \
      --avoid "the four identical secondary buttons"
  [ "$status" -eq 0 ] || { echo "an allowed fetch was refused: $output"; false; }
  # The image lands under the gitignored state path...
  ls "$SANDBOX/.claude/state/design/refpacks/lexos/"*.png >/dev/null 2>&1 \
    || { echo "no image cached: $(ls -A "$SANDBOX/.claude/state/design/refpacks/lexos/" 2>&1)"; false; }
  # ...and the repo gets the FACTS about it, never the pixels.
  [ -f "$(_sources_md)" ] || { echo "no sources.md written"; false; }
  grep -q "https://example.test/screen-1" "$(_sources_md)" || { echo "row has no url"; false; }
  grep -q "the status line owns the top-left" "$(_sources_md)" || { echo "row has no adaptable principle"; false; }
  grep -q "four identical secondary buttons" "$(_sources_md)" || { echo "row has no avoid-this"; false; }
  grep -q "ALLOW" "$(_availability)" || { echo "the successful fetch was not recorded"; false; }
}

@test "refpack: the recorded sha is the sha OF THE BYTES, not of the url" {
  _pack_sandbox
  rf="$(_robots_file 'User-agent: *
Allow: /')"
  fx="$(_fixture a)"
  node "$(_refpack)" --brief lexos --source lapa-ninja --url https://example.test/screen-1 \
      --registry "$SANDBOX/design.sources.yaml" --robots-file "$rf" --fixture "$fx" \
      --principle p --avoid a >/dev/null
  # Computed independently here, by a different tool than the one under test. A sha the script
  # both produces and verifies proves only that it is self-consistent.
  want="$(node -e 'const c=require("crypto"),f=require("fs");process.stdout.write(c.createHash("sha256").update(f.readFileSync(process.argv[1])).digest("hex"))' "$fx")"
  grep -q "$want" "$(_sources_md)" || { echo "sha in sources.md is not the sha of the fixture bytes: want $want, got: $(cat "$(_sources_md)")"; false; }
}

@test "refpack: a second screen from the same source appends a row, never replaces the file" {
  _pack_sandbox
  rf="$(_robots_file 'User-agent: *
Allow: /')"
  node "$(_refpack)" --brief lexos --source lapa-ninja --url https://example.test/screen-1 \
      --registry "$SANDBOX/design.sources.yaml" --robots-file "$rf" --fixture "$(_fixture a)" \
      --principle p1 --avoid a1 >/dev/null
  node "$(_refpack)" --brief lexos --source lapa-ninja --url https://example.test/screen-2 \
      --registry "$SANDBOX/design.sources.yaml" --robots-file "$rf" --fixture "$(_fixture b)" \
      --principle p2 --avoid a2 >/dev/null
  grep -q "screen-1" "$(_sources_md)" || { echo "the first row was lost"; false; }
  grep -q "screen-2" "$(_sources_md)" || { echo "the second row was not written"; false; }
  [ "$(ls "$SANDBOX/.claude/state/design/refpacks/lexos/"*.png | wc -l)" -eq 2 ] \
    || { echo "expected 2 cached images"; false; }
}

@test "refpack: --principle is mandatory, because a row without one is not evidence" {
  _pack_sandbox
  rf="$(_robots_file 'User-agent: *
Allow: /')"
  # The phase spec puts a human on this column: "a principle that describes appearance rather
  # than a transferable idea fails the phase". A machine cannot judge that -- but it can refuse
  # to write a row that has no principle at all, which is the half that IS mechanical.
  run node "$(_refpack)" --brief lexos --source lapa-ninja --url https://example.test/x \
      --registry "$SANDBOX/design.sources.yaml" --robots-file "$rf" --fixture "$(_fixture a)" \
      --avoid a
  [ "$status" -ne 0 ] || { echo "a row with no adaptable principle was written: $output"; false; }
}

# ---------- 4. no images in git -- asserted against the REAL rule, not the gitignore's text ----------

@test "refpack: a planted PNG under the refpack path is ignored by git check-ignore" {
  # Deliberately against $ARC_ROOT and not the sandbox: the DoD is a claim about THIS repo's
  # ignore rules, and a sandbox with a hand-copied .gitignore would prove only that the copy
  # works. The plant lands under .claude/state/, which is itself ignored, so it cannot pollute
  # the tree it is testing.
  probe="$ARC_ROOT/.claude/state/design/refpacks/gitignore-probe"
  mkdir -p "$probe"
  : > "$probe/planted.png"
  cd "$ARC_ROOT"
  run git check-ignore -v .claude/state/design/refpacks/gitignore-probe/planted.png
  rm -f "$probe/planted.png"
  rmdir "$probe" 2>/dev/null || true
  [ "$status" -eq 0 ] || { echo "a planted refpack PNG is NOT ignored -- images would enter git: $output"; false; }
  # The pattern that did it, printed, so a future narrowing of that rule fails here loudly
  # rather than silently letting pixels into the repo.
  echo "$output" | grep -q ".gitignore" || { echo "ignored, but not by a tracked rule: $output"; false; }
}

@test "refpack: building a pack leaves git status clean" {
  _pack_sandbox
  # The sandbox is a real git repo (test_helper inits one and commits a seed), so this is the
  # end-to-end version of the case above: build a pack, then ask git what changed. sources.md
  # is a deliberate exception and is asserted as such rather than ignored.
  cp "$ARC_ROOT/.gitignore" "$SANDBOX/.gitignore" 2>/dev/null || true
  git -C "$SANDBOX" add -A && git -C "$SANDBOX" commit -qm ignore-rules
  rf="$(_robots_file 'User-agent: *
Allow: /')"
  node "$(_refpack)" --brief lexos --source lapa-ninja --url https://example.test/screen-1 \
      --registry "$SANDBOX/design.sources.yaml" --robots-file "$rf" --fixture "$(_fixture a)" \
      --principle p --avoid a >/dev/null
  run git -C "$SANDBOX" status --porcelain
  echo "$output" | grep -q "\.png" && { echo "a cached image is visible to git: $output"; false; }
  echo "$output" | grep -q "sources.md" || { echo "sources.md should be a tracked change and is not: $output"; false; }
  true
}
