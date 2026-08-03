#!/usr/bin/env bats
# evolve Phase 00 -- the `evolve` manifest section contract (ADR-0301).
#
# The section validator lives INSIDE the existing hostile-fixture corpus, not beside it:
# product-lint is parser-class, so it inherits the adversarial discipline recorded in
# docs/retro-log.md 2026-07-16 and re-confirmed 2026-08-02.
bats_require_minimum_version 1.5.0
load 'test_helper'

FIX="$ARC_ROOT/tests/fixtures/products"
LINT="$ARC_ROOT/.claude/scripts/core/product-lint.mjs"

# ---------- absent = silent (ADR-0301's first enforcement level) ----------

@test "evolve absent: the pre-existing good corpus is untouched, exit 0" {
  run node "$LINT" --root "$FIX/good"
  [ "$status" -eq 0 ]
  [[ "$output" != *"evolve"* ]]
}

@test "evolve present and complete: exit 0" {
  run node "$LINT" --root "$FIX/good-evolve"
  [ "$status" -eq 0 ]
}

# ---------- present but invalid = exit 2, naming the exact missing keys ----------

@test "evolve present but empty: exit 2 naming all four required keys by name" {
  run node "$LINT" --root "$FIX/hostile/evolve-missing-keys"
  [ "$status" -eq 2 ]
  [[ "$output" == *"metrics"* ]]
  [[ "$output" == *"experiments"* ]]
  [[ "$output" == *"evals"* ]]
  [[ "$output" == *"promote_via"* ]]
}

@test "evolve missing exactly one key: exit 2 naming evals, and not the three present ones" {
  run node "$LINT" --root "$FIX/hostile/evolve-missing-evals"
  [ "$status" -eq 2 ]
  [[ "$output" == *"missing required key \"evals\""* ]]
  [[ "$output" != *"missing required key \"metrics\""* ]]
  [[ "$output" != *"missing required key \"experiments\""* ]]
  [[ "$output" != *"missing required key \"promote_via\""* ]]
}

@test "evolve is not an object: exit 2, and no key-by-key noise" {
  run node "$LINT" --root "$FIX/hostile/evolve-not-object"
  [ "$status" -eq 2 ]
  [[ "$output" == *"evolve must be an object"* ]]
}

@test "evolve carries an unknown key: exit 2 (the section is closed)" {
  run node "$LINT" --root "$FIX/hostile/evolve-unknown-key"
  [ "$status" -eq 2 ]
  [[ "$output" == *"auto_promote"* ]]
}

@test "a case-varied enum is rejected, never normalized" {
  run node "$LINT" --root "$FIX/hostile/evolve-bad-enum"
  [ "$status" -eq 2 ]
  [[ "$output" == *"direction"* ]]
  [[ "$output" == *"Higher-Is-Better"* ]]
}

# ---------- money surfaces: permanently refused at the contract layer ----------

@test "a money-named promote_via path is refused" {
  run node "$LINT" --root "$FIX/hostile/evolve-money-path"
  [ "$status" -eq 2 ]
  [[ "$output" == *"money-touching surface"* ]]
  [[ "$output" == *"app/pricing/plans.tsx"* ]]
}

@test "a vendor-dir money path naming no money keyword is still refused" {
  # lib/stripe/webhook-handler.ts carries none of pricing/payments/revenue in its name.
  # A substring search over three words passes it; the **/stripe/** vendor glob does not.
  run node "$LINT" --root "$FIX/hostile/evolve-money-vendor-dir"
  [ "$status" -eq 2 ]
  [[ "$output" == *"money-touching surface"* ]]
  [[ "$output" == *"lib/stripe/webhook-handler.ts"* ]]
}

# ---------- promote_via is an exact-path allowlist ----------

@test "a glob in promote_via is refused (allowlist is exact paths only)" {
  run node "$LINT" --root "$FIX/hostile/evolve-promote-glob"
  [ "$status" -eq 2 ]
  [[ "$output" == *"promote_via"* ]]
  [[ "$output" == *"glob"* ]]
}

@test "a traversal in promote_via is refused" {
  run node "$LINT" --root "$FIX/hostile/evolve-promote-traversal"
  [ "$status" -eq 2 ]
  [[ "$output" == *"promote_via"* ]]
  [[ "$output" == *"traversal"* ]]
}

# ---------- holes found by the fresh-agent adversarial pass (slice 09) ----------
#
# Every case below LINTED GREEN before the pass. They are pinned here so the fix cannot regress.

@test "HOLE 1: a case-varied money segment is refused (NTFS/APFS resolve it to the real file)" {
  # app/PRICING/plans.tsx opens the real app/pricing/plans.tsx on a case-insensitive filesystem.
  # The attacker proved it by writing through the accepted path.
  run node "$LINT" --root "$FIX/hostile/evolve-money-case"
  [ "$status" -eq 2 ]
  [[ "$output" == *"money-touching surface"* ]]
  [[ "$output" == *"app/PRICING/plans.tsx"* ]]
}

@test "HOLE 3a: a bare directory in promote_via is refused" {
  # A directory target makes the money check vacuous — it covers everything beneath it.
  run node "$LINT" --root "$FIX/hostile/evolve-promote-dir"
  [ "$status" -eq 2 ]
  [[ "$output" == *"not a regular file"* ]]
}

@test "HOLE 3b: promote_via of \".\" is refused" {
  run node "$LINT" --root "$FIX/hostile/evolve-promote-dot"
  [ "$status" -eq 2 ]
}

@test "HOLE 4a: a Next.js route group naming the pricing route is refused" {
  # app/(pricing)/page.tsx IS the pricing route. Prefix-only segment matching missed it.
  run node "$LINT" --root "$FIX/hostile/evolve-route-group"
  [ "$status" -eq 2 ]
  [[ "$output" == *"money-touching surface"* ]]
  [[ "$output" == *"(pricing)"* ]]
}

@test "HOLE 4b: a money keyword mid-segment is refused (lib/vendor-stripe/client.ts)" {
  run node "$LINT" --root "$FIX/hostile/evolve-infix-money"
  [ "$status" -eq 2 ]
  [[ "$output" == *"money-touching surface"* ]]
}

@test "HOLE 4c: a Next.js DYNAMIC route with no money segment is still ACCEPTED" {
  # The over-broad glob-char rule made app/[locale]/... unrepresentable, which pushed authors
  # toward the route-group form that HOLE 4a let through. Fixing one without the other would
  # have traded a false negative for a false positive.
  run node "$LINT" --root "$FIX/good-evolve"
  [ "$status" -eq 0 ]
}

@test "HOLE 5: a duplicate JSON key cannot hide a money path" {
  # JSON.parse is last-wins: the money promote_via sits in the file's BYTES and was overwritten
  # by a clean duplicate. Any first-wins reader downstream sees the money path.
  run node "$LINT" --root "$FIX/hostile/evolve-dup-key"
  [ "$status" -eq 2 ]
  [[ "$output" == *"duplicate object key"* ]]
}

@test "HOLE 6a: non-canonical aliases of one file are refused" {
  run node "$LINT" --root "$FIX/hostile/evolve-noncanonical"
  [ "$status" -eq 2 ]
  [[ "$output" == *"canonical path"* ]]
}

@test "HOLE 6b: two case-variant spellings of one file are refused as duplicates" {
  run node "$LINT" --root "$FIX/hostile/evolve-dup-case"
  [ "$status" -eq 2 ]
  [[ "$output" == *"same file twice"* ]]
}

@test "HOLE 2: path aliases (symlink / junction / hardlink) cannot reach a money surface" {
  # Driven through the injectable probe rather than a real junction: git does not carry a
  # Windows junction across all three CI legs, so a filesystem fixture would silently stop
  # testing anything on two of them. The probe is the exact seam the fix hangs on.
  cat > "$BATS_TEST_TMPDIR/alias.mjs" <<'NODE'
// Run via `node --input-type=module -e` from the repo root, so this relative specifier resolves
// against cwd. Written to a file only to keep the JSON readable; a file:// URL is not an option
// because ARC_ROOT is an MSYS path (/c/...) that Node cannot parse.
const { checkEvolveSection } = await import("./.claude/scripts/core/evolve-manifest.mjs");
const base = {
  metrics: [{ name: "m", source_event: "metric.observed", aggregation: "rate", direction: "higher-is-better", role: "primary" }],
  experiments: [{ surface_file: "app/promo/plans.tsx", variant_grammar: "h@1.0.0", split: [50, 50], excluded_categories: [] }],
  evals: { holdout_rule: "cohort-50-50", per_arm_floor: 1800, minimum_effect_rule: "mde-at-80-power", test_id: "newcombe-wilson-difference-v1", alpha: 0.05, effect_floor: 0 },
  promote_via: ["app/promo/plans.tsx"],
};
const run = (probe) => checkEvolveSection(base, "t", { probe }).join(" ;; ");
// a symlink / junction: refused outright, never followed
const link = run(() => ({ kind: "link" }));
// a HARDLINK has no link bit — it is a regular file whose realpath is the money surface
const hard = run(() => ({ kind: "file", realRel: "app/pricing/plans.tsx" }));
// a path resolving outside the repo root
const esc  = run(() => ({ kind: "escapes", realRel: "../../etc/passwd" }));
const fail = [];
if (!/symlink, junction or reparse point/.test(link)) fail.push("symlink not refused: " + link);
if (!/resolves to app\/pricing\/plans\.tsx/.test(hard)) fail.push("hardlink not refused: " + hard);
if (!/resolves outside the repository root/.test(esc)) fail.push("escape not refused: " + esc);
// control: a clean regular file inside the root must still PASS, or the rule refuses everything
const ok = run(() => ({ kind: "file", realRel: "app/promo/plans.tsx" }));
if (ok !== "") fail.push("clean path wrongly refused: " + ok);
if (fail.length) { console.log(fail.join("\n")); process.exit(1); }
console.log("ALIASES_REFUSED");
NODE
  cd "$ARC_ROOT"
  run node --input-type=module -e "$(cat "$BATS_TEST_TMPDIR/alias.mjs")"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"ALIASES_REFUSED"* ]]
}

# ---------- coverage-invariant walk: the negative control ----------

@test "coverage walk: an unmapped .claude file is rejected (proves the walk can FAIL)" {
  # The walk is a company-wide gate that this phase relies on to catch every new file it adds.
  # A gate only ever observed passing has not been shown to work — this is its failing case.
  run node "$LINT" --root "$FIX/hostile/unmapped-file"
  [ "$status" -eq 2 ]
  [[ "$output" == *"unmapped file (synced but in no product): .claude/rules/orphan.md"* ]]
  # ...and the file that IS mapped is not also reported, or the walk would be flagging
  # everything rather than discriminating.
  [[ "$output" != *"rules/mapped.md"* ]]
}

@test "coverage walk: the real repo root is green (every file this phase adds is owned)" {
  run node "$LINT"
  [ "$status" -eq 0 ]
  [[ "$output" == *"all manifests valid"* ]]
}
