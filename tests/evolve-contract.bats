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
