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
      "lapa-ninja": "active", "saasframe": "active", "awwwards": "active",
      "godly": "off", "dribbble": "off", "behance": "off",
      "land-book": "off", "page-collective": "off",
    };
    const bad = [];
    for (const [id, st] of Object.entries(want)) {
      if (!by[id]) { bad.push(`missing source: ${id}`); continue; }
      if (by[id].status !== st) bad.push(`${id}: status=${by[id].status} want ${st}`);
    }
    const aw = by["awwwards"];
    if (aw && !(aw.allowed_use || []).includes("link-only")) bad.push("awwwards: allowed_use must carry link-only -- its terms forbid reproduction, so provenance is permitted and a local image cache is not");
    if (aw && (aw.allowed_use || []).includes("reference-pack")) bad.push("awwwards: allowed_use must NOT carry reference-pack");
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
  mkdir -p ".claude/state/design/refpacks/ignore-probe"
  printf 'not-a-real-png' > ".claude/state/design/refpacks/ignore-probe/probe.png"
  run git check-ignore -q ".claude/state/design/refpacks/ignore-probe/probe.png"
  rc="$status"
  rm -rf ".claude/state/design/refpacks/ignore-probe"
  [ "$rc" -eq 0 ] || { echo "a PNG under refpacks/ is NOT ignored by git"; false; }
}

@test "this file registered every test it declares" {
  [ "${#BATS_TEST_NAMES[@]}" -eq 14 ] || {
    echo "registered ${#BATS_TEST_NAMES[@]} tests, expected 14 -- a @test was silently dropped"
    false
  }
}
