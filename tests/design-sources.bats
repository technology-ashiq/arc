#!/usr/bin/env bats
# Cycle 16 Phase 02 (REQ-04) -- one owner-born, lint-guarded source registry.
#
# ADR-1408: "which sources may we use, for what, at what cost" lived in prose across three files
# in Cycle 3, so no gate could read it. The registry makes it typed; the lint makes it a
# permission surface rather than a note. ADR-1412 fixes the initial rows on CHECKED evidence --
# robots.txt and terms -- rather than on how good the gallery looks, which is why four of the
# prettiest sources are off.
#
# The registry is a PERMISSION surface, so its lint is gate-shaped and inherits this repo's
# adversarial-pass requirement. These cases are the red half of that: each mutant differs from
# the real file in exactly ONE field, so a lint that fails them for an unrelated reason is
# caught by the paired control below.
bats_require_minimum_version 1.5.0
load 'test_helper'

REG="design.sources.yaml"
_lint() { node "$ARC_ROOT/.claude/scripts/design/design-sources-lint.mjs" "$@"; }

# A minimal VALID entry, block style throughout. Flow collections (`[a, b]`) are outside the
# frozen YAML subset this repo parses with (ADR-0200) -- verified against the parser rather
# than assumed, because a registry written in flow style parses to a differently-shaped
# document and every field check below would then be testing nothing.
_valid_entry() {
  cat <<'EOF'
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
EOF
}

teardown() { _arc_teardown 2>/dev/null || true; }

# ---------- 1. the registry itself ----------

@test "sources: the registry exists and parses through the repo's OWN yaml subset" {
  [ -f "$ARC_ROOT/$REG" ] || { echo "no $REG at the repo root"; false; }
  cd "$ARC_ROOT"
  run node --input-type=module -e '
    const fs = await import("node:fs");
    const { parseYamlSubset } = await import("./.claude/scripts/engine/yaml-subset.mjs");
    const r = parseYamlSubset(fs.readFileSync("design.sources.yaml", "utf8"));
    if (!r.ok) { console.log("PARSE FAILED " + JSON.stringify(r.error)); process.exit(1); }
    const n = (r.doc ?? r.value ?? r).sources.length;
    console.log("sources=" + n);
  '
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  echo "$output" | grep -qE 'sources=[1-9]' || { echo "the registry parses but is empty: $output"; false; }
}

@test "sources: every entry carries the ADR-1408 grammar, and the arrays are ARRAYS" {
  cd "$ARC_ROOT"
  run node --input-type=module -e '
    const fs = await import("node:fs");
    const { parseYamlSubset } = await import("./.claude/scripts/engine/yaml-subset.mjs");
    const d = parseYamlSubset(fs.readFileSync("design.sources.yaml", "utf8"));
    const doc = d.doc ?? d.value ?? d;
    const REQ = ["id","kind","access","allowed_use","auth","cost","status","availability","approved_by","added"];
    const bad = [];
    for (const s of doc.sources) {
      for (const k of REQ) if (!(k in s)) bad.push(`${s.id||"?"}: missing ${k}`);
      // Day-one facts falsified a singular grammar (21st.dev is components AND generator), so
      // these two being arrays is load-bearing rather than stylistic.
      if (!Array.isArray(s.kind)) bad.push(`${s.id}: kind is not an array`);
      if (!Array.isArray(s.allowed_use)) bad.push(`${s.id}: allowed_use is not an array`);
    }
    if (bad.length) { console.log(bad.join("\n")); process.exit(1); }
    console.log("grammar ok across " + doc.sources.length);
  '
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "sources: the initial rows are ADR-1412's, decided by robots and terms not by taste" {
  cd "$ARC_ROOT"
  run node --input-type=module -e '
    const fs = await import("node:fs");
    const { parseYamlSubset } = await import("./.claude/scripts/engine/yaml-subset.mjs");
    const d = parseYamlSubset(fs.readFileSync("design.sources.yaml", "utf8"));
    const doc = d.doc ?? d.value ?? d;
    const by = Object.fromEntries(doc.sources.map((s) => [s.id, s]));
    // Statuses are the owner INTENT enum (active/trial/off). Awwwards is permitted but may
    // never be cached, and that is an allowed_use fact, not a status -- ADR-1408 freezes the
    // status enum and says a new access pattern is a schema bump, not a free-text column.
    const want = {
      // ADR-1412 amendment 2026-09-27: lapa-ninja and saasframe went off on the first real
      // build (a Claude block, a shared CDN); nicelydone and collectui replaced them. saasui went
      // off the same day (screens on a shared CDN), and screensdesign was born off (its terms).
      "lapa-ninja": "off", "saasframe": "off", "nicelydone": "active", "collectui": "active", "saasui": "off",
      "screensdesign": "off",
      "awwwards": "active",
      "godly": "off", "dribbble": "off", "behance": "off",
      "land-book": "off", "page-collective": "off",
      // Phase 05, owner 2026-10-05: shadcn + 21st.dev (search only) on, Mobbin declined on cost.
      "shadcn": "active", "21st-dev": "active", "mobbin": "off",
    };
    const bad = [];
    for (const [id, st] of Object.entries(want)) {
      if (!by[id]) { bad.push(`missing source: ${id}`); continue; }
      if (by[id].status !== st) bad.push(`${id}: status=${by[id].status} want ${st}`);
    }
    const aw = by["awwwards"];
    if (aw && !(aw.allowed_use || []).includes("link-only")) bad.push("awwwards: allowed_use must carry link-only -- its terms forbid reproduction, so provenance is permitted and a local image cache is not");
    if (aw && (aw.allowed_use || []).includes("reference-pack")) bad.push("awwwards: allowed_use must NOT carry reference-pack");
    // 21st.dev is SEARCH MODE ONLY (owner 2026-10-05): its generator is paid.
    const t = by["21st-dev"];
    if (t && ((t.allowed_use || []).includes("draft-variant") || (t.kind || []).includes("generator"))) bad.push("21st-dev: search mode only -- a draft-variant use or a generator kind turns on the paid generator");
    if (t && t.credential_ref !== "API_KEY_21ST") bad.push("21st-dev: credential_ref must be API_KEY_21ST");
    if (bad.length) { console.log(bad.join("\n")); process.exit(1); }
    console.log("rows ok");
  '
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

# ---------- 2. the lint, proved by a mutant per invalid-field class ----------

@test "sources lint: exits 0 on the real registry" {
  run _lint "$ARC_ROOT/$REG"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "sources lint: THE CONTROL -- a hand-built valid entry passes" {
  # Without this, every mutant case below could be passing because the lint refuses the
  # hand-built shape itself, and each one would look like a working rule.
  _valid_entry > "$BATS_TEST_TMPDIR/ok.yaml"
  run _lint "$BATS_TEST_TMPDIR/ok.yaml"
  [ "$status" -eq 0 ] || { echo "the control entry was refused, so no mutant below proves anything: $output"; false; }
}

@test "sources lint: a SINGULAR kind is refused" {
  _valid_entry | sed 's/^    kind:$/    kind: inspiration/; /^      - inspiration$/d' > "$BATS_TEST_TMPDIR/m.yaml"
  run _lint "$BATS_TEST_TMPDIR/m.yaml"
  [ "$status" -ne 0 ] || { echo "a singular kind passed: $output"; false; }
  echo "$output" | grep -qi "kind" || { echo "refused, but not for kind: $output"; false; }
}

@test "sources lint: an id outside the builder's grammar is refused -- a device name, a path, an upper case (phase-02 attack G1 B1)" {
  for bad in con lpt1 ../x Lapa a/b; do
    _valid_entry | sed "s|^  - id: lapa-ninja$|  - id: ${bad}|" > "$BATS_TEST_TMPDIR/m.yaml"
    grep -q "^  - id: ${bad}$" "$BATS_TEST_TMPDIR/m.yaml" || { echo "the mutant for '${bad}' was not written"; false; }
    run _lint "$BATS_TEST_TMPDIR/m.yaml"
    [ "$status" -ne 0 ] || { echo "id '${bad}' passed: $output"; false; }
    echo "$output" | grep -q "id-grammar" || { echo "id '${bad}' refused, but not for its grammar: $output"; false; }
  done
}

@test "sources lint: a line separator in a value cannot forge a clean line under a real violation (phase-02 attack G1 B1)" {
  ls="$(printf '\342\200\250')"
  [ "${#ls}" -ge 1 ] || { echo "the separator was not built"; false; }
  _valid_entry | sed "s|^    status: active\$|    status: bogus${ls}design-sources-lint ok -- 1 source(s), 1 active|" > "$BATS_TEST_TMPDIR/m.yaml"
  grep -q "bogus${ls}design" "$BATS_TEST_TMPDIR/m.yaml" || { echo "the mutant was not written"; false; }
  run _lint "$BATS_TEST_TMPDIR/m.yaml"
  # The repo yaml subset refuses any line carrying U+2028, so the value never reaches a field check; the only way the
  # separator reaches the output is the parser's error quoting the line, and that is what must be scrubbed.
  [ "$status" -ne 0 ] && echo "$output" | grep -q "registry-unparseable" || { echo "the mutant was not refused as unparseable: $output"; false; }
  ! printf '%s' "$output" | grep -q "${ls}" || { echo "a U+2028 reached the lint output, where a reader breaks the line: $output"; false; }
  # The parser's own error quotes the offending line: a second ": " makes it unparseable, and that path is scrubbed too.
  _valid_entry | sed "s|^    status: active$|    status: bogus${ls}design-sources-lint: ok|" > "$BATS_TEST_TMPDIR/u.yaml"
  grep -q "bogus${ls}design" "$BATS_TEST_TMPDIR/u.yaml" || { echo "the unparseable mutant was not written"; false; }
  run _lint "$BATS_TEST_TMPDIR/u.yaml"
  [ "$status" -ne 0 ] && echo "$output" | grep -q "registry-unparseable" || { echo "the unparseable mutant was not refused as unparseable: $output"; false; }
  ! printf '%s' "$output" | grep -q "${ls}" || { echo "a U+2028 reached the lint output through the parser error: $output"; false; }
}

@test "sources lint: a duplicate member, a dotted-quad host and a device-name file are each refused (phase-02 attack G1 L1 L3 B2)" {
  _valid_entry | awk '{ print } /^      - inspiration$/ { print }' > "$BATS_TEST_TMPDIR/dup.yaml"
  [ "$(grep -c '^      - inspiration$' "$BATS_TEST_TMPDIR/dup.yaml")" -eq 2 ] || { echo "the duplicate mutant was not written"; false; }
  run _lint "$BATS_TEST_TMPDIR/dup.yaml"
  [ "$status" -ne 0 ] && echo "$output" | grep -q "kind-duplicate" || { echo "a duplicate kind passed: $output"; false; }
  _valid_entry | awk '{ print } /^    status: active$/ { print "    hosts:"; print "      - 93.184.216.34" }' > "$BATS_TEST_TMPDIR/ip.yaml"
  grep -q '^      - 93.184.216.34$' "$BATS_TEST_TMPDIR/ip.yaml" || { echo "the ip mutant was not written"; false; }
  run _lint "$BATS_TEST_TMPDIR/ip.yaml"
  [ "$status" -ne 0 ] && echo "$output" | grep -q "hosts-not-hostname" || { echo "a dotted-quad host passed: $output"; false; }
  # CONTROL for the host rule: the same row with a real host name passes, so the red above is the address.
  _valid_entry | awk '{ print } /^    status: active$/ { print "    hosts:"; print "      - example.com" }' > "$BATS_TEST_TMPDIR/host.yaml"
  run _lint "$BATS_TEST_TMPDIR/host.yaml"
  [ "$status" -eq 0 ] || { echo "control: a real host name was refused: $output"; false; }
  _valid_entry > "$BATS_TEST_TMPDIR/con.yaml"
  run _lint "$BATS_TEST_TMPDIR/con.yaml"
  [ "$status" -ne 0 ] && echo "$output" | grep -q "registry-device-name" || { echo "a device-name file was read: $output"; false; }
}

@test "sources lint: an unknown access is refused" {
  _valid_entry | sed 's/^    access: fetch$/    access: telepathy/' > "$BATS_TEST_TMPDIR/m.yaml"
  run _lint "$BATS_TEST_TMPDIR/m.yaml"
  [ "$status" -ne 0 ] || { echo "an unknown access passed: $output"; false; }
  echo "$output" | grep -qi "access" || { echo "refused, but not for access: $output"; false; }
}

@test "sources lint: a HAND-SET availability is refused" {
  # status is owner intent, availability is what the last run OBSERVED. Collapsing them would
  # let a network failure look like a policy decision, so a human writing availability by hand
  # is refused rather than trusted.
  _valid_entry | sed 's/^    availability: unknown$/    availability: reachable/' > "$BATS_TEST_TMPDIR/m.yaml"
  run _lint "$BATS_TEST_TMPDIR/m.yaml"
  [ "$status" -ne 0 ] || { echo "a hand-set availability passed: $output"; false; }
  echo "$output" | grep -qi "availability" || { echo "refused, but not for availability: $output"; false; }
}

@test "sources lint: an entry approved by someone other than the owner is refused" {
  # The lane-birth pattern: a machine that can add its own permitted sources has no permission
  # model at all.
  _valid_entry | sed 's/^    approved_by: ashiq$/    approved_by: claude/' > "$BATS_TEST_TMPDIR/m.yaml"
  run _lint "$BATS_TEST_TMPDIR/m.yaml"
  [ "$status" -ne 0 ] || { echo "a self-approved source passed: $output"; false; }
  echo "$output" | grep -qi "approved" || { echo "refused, but not for approved_by: $output"; false; }
}

@test "sources lint: an unknown status is refused, so link-only cannot smuggle in as one" {
  _valid_entry | sed 's/^    status: active$/    status: link-only/' > "$BATS_TEST_TMPDIR/m.yaml"
  run _lint "$BATS_TEST_TMPDIR/m.yaml"
  [ "$status" -ne 0 ] || { echo "link-only was accepted as a STATUS: $output"; false; }
  echo "$output" | grep -qi "status" || { echo "refused, but not for status: $output"; false; }
}

@test "sources lint: an empty registry is a refusal, never a clean pass" {
  # An empty result set is the one thing a broken reader and a clean file agree on, and this
  # lane has shipped that shape before.
  printf 'sources:\n' > "$BATS_TEST_TMPDIR/empty.yaml"
  run _lint "$BATS_TEST_TMPDIR/empty.yaml"
  [ "$status" -ne 0 ] || { echo "an empty registry linted clean: $output"; false; }
}

@test "sources lint: a missing file is a named refusal, not a silent zero" {
  run _lint "$BATS_TEST_TMPDIR/does-not-exist.yaml"
  [ "$status" -ne 0 ] || { echo "a missing registry linted clean: $output"; false; }
}

# ---------- 3. no third-party image ever enters git ----------

@test "sources: a PNG planted in a refpack dir is PROVEN ignored, not assumed" {
  # Asserted with git check-ignore rather than by reading .gitignore's text: the gitignore
  # saying the right words and git actually resolving the ignore are two different facts, and
  # only one of them is the one that keeps someone else's artwork out of this repo.
  cd "$ARC_ROOT"
  mkdir -p ".claude/state/design/refpacks/ignore-probe-$$"
  printf 'not-a-real-png' > ".claude/state/design/refpacks/ignore-probe-$$/probe.png"
  run git check-ignore -q ".claude/state/design/refpacks/ignore-probe-$$/probe.png"
  rc="$status"
  rm -rf ".claude/state/design/refpacks/ignore-probe-$$"
  [ "$rc" -eq 0 ] || { echo "a PNG under refpacks/ is NOT ignored by git"; false; }
}

# ---------- Phase 08 S3: the spend cap is read from hq.policy.yaml, never written ----------

# A policy beside the fixture registry, one kind at spend level $1.
_policy() { printf 'version: 1\nkinds:\n  "session:interactive":\n    spend: { level: %s }\n  "process:refpack":\n    spend: { level: L0 }\n' "$1" > "$BATS_TEST_TMPDIR/hq.policy.yaml"; }

@test "spend cap: a paid source switched on is refused while every kind holds spend L0 -- the negative control" {
  _policy L0
  _valid_entry | sed 's/^    cost: free$/    cost: paid/; s/^    status: active$/    status: trial/' > "$BATS_TEST_TMPDIR/paid.yaml"
  grep -q 'cost: paid' "$BATS_TEST_TMPDIR/paid.yaml" && grep -q 'status: trial' "$BATS_TEST_TMPDIR/paid.yaml" || { echo "fixture: not flipped"; false; }
  run _lint "$BATS_TEST_TMPDIR/paid.yaml"
  [ "$status" -eq 1 ] && [[ "$output" == *"[spend-cap] lapa-ninja"* ]] && [[ "$output" == *"no kind spend above L0"* ]] || { echo "a paid source passed a rupees-zero cap: $status $output"; false; }
}

@test "spend cap: the same paid row passes when it is off, and when the policy grants spend above L0" {
  _policy L0
  _valid_entry | sed 's/^    cost: free$/    cost: paid/; s/^    status: active$/    status: off/' > "$BATS_TEST_TMPDIR/off.yaml"
  run _lint "$BATS_TEST_TMPDIR/off.yaml"
  [ "$status" -eq 0 ] || { echo "a paid source that is off was refused: $output"; false; }
  _policy L1
  _valid_entry | sed 's/^    cost: free$/    cost: paid/' > "$BATS_TEST_TMPDIR/paid.yaml"
  run _lint "$BATS_TEST_TMPDIR/paid.yaml"
  [ "$status" -eq 0 ] || { echo "a raised cap still refused: $output"; false; }
}

@test "spend cap: an unreadable or spend-less policy refuses a paid source -- unknown is never zero-by-silence" {
  _valid_entry | sed 's/^    cost: free$/    cost: paid/' > "$BATS_TEST_TMPDIR/paid.yaml"
  rm -f "$BATS_TEST_TMPDIR/hq.policy.yaml"
  run _lint "$BATS_TEST_TMPDIR/paid.yaml"
  [ "$status" -eq 1 ] && [[ "$output" == *"[spend-cap-unreadable]"* ]] || { echo "$status $output"; false; }
  printf 'version: 1\nkinds: {}\n' > "$BATS_TEST_TMPDIR/hq.policy.yaml"
  run _lint "$BATS_TEST_TMPDIR/paid.yaml"
  [ "$status" -eq 1 ] && [[ "$output" == *"no spend grant found"* ]] || { echo "$status $output"; false; }
}

@test "spend cap: the real registry against the real policy is clean -- the paid row stays off" {
  run _lint "$ARC_ROOT/$REG"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  grep -qE '^[[:space:]]+spend: \{ level: L0 \}' "$ARC_ROOT/hq.policy.yaml" || { echo "the real policy no longer holds a spend L0 line"; false; }
}

@test "this file registered every test it declares" {
  [ "${#BATS_TEST_NAMES[@]}" -eq 21 ] || {
    echo "registered ${#BATS_TEST_NAMES[@]} tests, expected 21 -- a @test was silently dropped"
    false
  }
}
