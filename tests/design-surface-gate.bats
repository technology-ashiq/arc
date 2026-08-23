#!/usr/bin/env bats
# Cycle 16 Phase 01 (REQ-03) -- every surface the brief declares is rendered and correctly
# classified.
#
# Two halves, both of them contract-driven:
#
#   viewports  -- ADR-1403. The brief's section C is a platform contract, and Cycle 3 rendered
#                 desktop only. A platform contract the pipeline never renders is a contract
#                 nobody signed: the declaration existed, nothing consumed it, and no part of
#                 the loop could report the gap.
#
#   surfaces   -- ADR-1407. Cycle 3's variants spent 30-60% of their scroll on state-matrix and
#                 keyboard documentation and the jury ranked them UP for it. The obvious fix --
#                 refuse pages whose text says "Reference" or "States" -- is the shape this lane
#                 already has a scar from: design-explore.sh once refused a correct variant over
#                 `&#8377;`, the rupee entity, because a text rule cannot tell a colour literal
#                 from a currency sign. So classification is DECLARED, never guessed, and the
#                 case that a legitimate product page may say "Reference" is a test here.
bats_require_minimum_version 1.5.0
load 'test_helper'

_surface_sandbox() {
  _arc_design_sandbox
  EX="docs/design/explore/lexos-v1"
  mkdir -p "$SANDBOX/$EX/variant-a" "$SANDBOX/docs/design/briefs/lexos"
  BRIEF="$SANDBOX/docs/design/briefs/lexos/brief.md"
  PAGE="$SANDBOX/$EX/variant-a/index.html"
}

# A brief carrying section C with the given Mobile answer. Only the platform contract matters
# to these cases, so the other sections are present but minimal.
_brief_with_mobile() {
  cat > "$BRIEF" <<EOF
# Brief — lexos

## A. Interaction model
1. answer one
2. answer two

## B. Art direction
axes

## C. Platform contract

| Surface | Required? |
|---|---|
| Desktop | yes |
| Mobile | $1 |
| Tablet | no |
| Keyboard-first | no |
| Reduced motion | no |

## D. Content contract
content
EOF
}

_lint() { echo "$SANDBOX/.claude/scripts/design/design-lint.mjs"; }
_explore() { echo "$SANDBOX/.claude/scripts/design/design-explore.sh"; }

teardown() { _arc_teardown; }

# ---------- 1. the viewport set derives from the contract, never from a fixed list ----------

@test "viewports: Mobile no -> desktop only" {
  _surface_sandbox
  _brief_with_mobile "no"
  run node "$(_lint)" --viewports "$BRIEF"
  [ "$status" -eq 0 ]
  echo "$output" | grep -q '1440x900'
  echo "$output" | grep -q '390x844' && false
  true
}

@test "viewports: Mobile yes -> desktop AND mobile" {
  _surface_sandbox
  _brief_with_mobile "yes"
  run node "$(_lint)" --viewports "$BRIEF"
  [ "$status" -eq 0 ]
  echo "$output" | grep -q '1440x900'
  echo "$output" | grep -q '390x844'
}

@test "viewports: a brief with no section C REFUSES rather than defaulting to desktop" {
  _surface_sandbox
  printf '# Brief\n\n## A. Interaction model\n1. x\n' > "$BRIEF"
  # Silently returning the desktop default is how the contract stopped being consumed in the
  # first place: the pipeline would look correct and cover nothing.
  run node "$(_lint)" --viewports "$BRIEF"
  [ "$status" -ne 0 ]
  # Same reason: this passed red against a mode that did not exist.
  echo "$output" | grep -q "platform-contract-missing"
}

@test "viewports: a Mobile row with an unreadable answer REFUSES, it does not guess" {
  _surface_sandbox
  _brief_with_mobile "maybe"
  run node "$(_lint)" --viewports "$BRIEF"
  [ "$status" -ne 0 ]
  echo "$output" | grep -qi "mobile"
}

# ---------- 2. surfaces are DECLARED, and an unmarked one fails closed ----------

@test "surfaces: a fully marked product page passes" {
  _surface_sandbox
  cat > "$PAGE" <<'EOF'
<!doctype html><title>case workspace</title>
<main>
  <section data-arc-surface="product"><h1>Matter 4821</h1><p>Hearing on 12 Mar</p></section>
  <section data-arc-surface="product"><h2>Filings</h2><p>Three documents</p></section>
</main>
EOF
  run bash "$(_explore)" surfaces lexos-v1
  [ "$status" -eq 0 ]
}

@test "surfaces: an UNMARKED surface fails closed" {
  _surface_sandbox
  cat > "$PAGE" <<'EOF'
<!doctype html><title>case workspace</title>
<main>
  <section data-arc-surface="product"><h1>Matter 4821</h1></section>
  <section><h2>Filings</h2></section>
</main>
EOF
  # A composer who forgets the attribute gets a refusal. That cost is accepted deliberately:
  # the alternative is guessing, and guessing is what this gate exists to replace.
  run bash "$(_explore)" surfaces lexos-v1
  [ "$status" -ne 0 ]
  echo "$output" | grep -q "unmarked"
}

@test "surfaces: an unknown marker value fails closed too" {
  _surface_sandbox
  cat > "$PAGE" <<'EOF'
<!doctype html><title>x</title>
<main><section data-arc-surface="produkt"><h1>Matter</h1></section></main>
EOF
  run bash "$(_explore)" surfaces lexos-v1
  [ "$status" -ne 0 ]
  # Named, not merely non-zero. This test PASSED in the red run against a subcommand that did
  # not exist at all -- "command missing" and "marker unknown" are different facts, and an
  # assertion that cannot tell them apart is measuring nothing.
  echo "$output" | grep -q "surface-unknown"
}

# ---------- 3. the failure this gate was actually built for ----------

@test "surfaces: documentation nested inside a product surface is a deterministic ERR" {
  _surface_sandbox
  cat > "$PAGE" <<'EOF'
<!doctype html><title>case workspace</title>
<main>
  <section data-arc-surface="product">
    <h1>Matter 4821</h1>
    <div data-arc-surface="doc"><h2>Keyboard shortcuts</h2><table><tr><td>J</td></tr></table></div>
  </section>
</main>
EOF
  # Cycle 3's variants spent a third of their scroll on exactly this and were ranked UP for it.
  run bash "$(_explore)" surfaces lexos-v1
  [ "$status" -ne 0 ]
  echo "$output" | grep -q "doc-on-canvas"
}

@test "surfaces: a doc surface as its own top-level sibling is allowed" {
  _surface_sandbox
  cat > "$PAGE" <<'EOF'
<!doctype html><title>case workspace</title>
<main>
  <section data-arc-surface="product"><h1>Matter 4821</h1></section>
  <section data-arc-surface="doc"><h2>State matrix</h2></section>
</main>
EOF
  # A demo or reference surface is legitimate -- it just may not sit ON the product canvas.
  run bash "$(_explore)" surfaces lexos-v1
  [ "$status" -eq 0 ]
}

# ---------- 4. the over-refusal control -- this lane's scar ----------

@test "surfaces: a product page whose TEXT says Reference passes" {
  _surface_sandbox
  cat > "$PAGE" <<'EOF'
<!doctype html><title>case workspace</title>
<main>
  <section data-arc-surface="product">
    <h1>Matter 4821</h1>
    <p>Reference: HC/2026/4821</p>
    <p>Filed under the States and Union Territories schedule. Keyboard: J to advance.</p>
    <p>Fees: &#8377;12,50,000</p>
  </section>
</main>
EOF
  # THE control for ADR-1407. Every word a text-matching gate would trip on is here --
  # Reference, States, Keyboard -- plus the rupee entity that once caused a real over-refusal.
  # A gate that refuses correct work is broken, not strict.
  run bash "$(_explore)" surfaces lexos-v1
  [ "$status" -eq 0 ]
}

@test "surfaces: the marker is matched as an ATTRIBUTE, not as text anywhere on the page" {
  _surface_sandbox
  cat > "$PAGE" <<'EOF'
<!doctype html><title>x</title>
<main>
  <section data-arc-surface="product">
    <h1>Matter</h1>
    <p>Mark documentation regions with data-arc-surface="doc" in the design system.</p>
  </section>
</main>
EOF
  # A page may legitimately DISCUSS the marker. The 2026-07-16 cosmetic-variant lesson and
  # the 2026-08-02 prose-mention regex both say the same thing: detect the real construct,
  # never a mention of it.
  run bash "$(_explore)" surfaces lexos-v1
  [ "$status" -eq 0 ]
}

# ---------- 5. coverage: a declared surface the run never rendered blocks PASS ----------

@test "surfaces: a brief declaring Mobile with no mobile render is a run gap" {
  _surface_sandbox
  _brief_with_mobile "yes"
  cat > "$PAGE" <<'EOF'
<!doctype html><title>x</title>
<main><section data-arc-surface="product"><h1>Matter</h1></section></main>
EOF
  mkdir -p "$SANDBOX/.claude/state/design/renders/lexos-v1--variant-a"
  # Only the desktop render exists.
  printf '{\n  "route": "docs/design/explore/lexos-v1/variant-a/index.html",\n  "viewport": "1440x900@1",\n  "session": "lexos-v1--variant-a"\n}\n' \
    > "$SANDBOX/.claude/state/design/renders/lexos-v1--variant-a/x.json"
  run bash "$(_explore)" coverage lexos-v1 --brief "$BRIEF"
  [ "$status" -ne 0 ]
  echo "$output" | grep -q "390x844"
}

@test "surfaces: both declared viewports rendered -> coverage passes" {
  _surface_sandbox
  _brief_with_mobile "yes"
  cat > "$PAGE" <<'EOF'
<!doctype html><title>x</title>
<main><section data-arc-surface="product"><h1>Matter</h1></section></main>
EOF
  mkdir -p "$SANDBOX/.claude/state/design/renders/lexos-v1--variant-a"
  printf '{\n  "route": "docs/design/explore/lexos-v1/variant-a/index.html",\n  "viewport": "1440x900@1",\n  "session": "lexos-v1--variant-a"\n}\n' \
    > "$SANDBOX/.claude/state/design/renders/lexos-v1--variant-a/d.json"
  printf '{\n  "route": "docs/design/explore/lexos-v1/variant-a/index.html",\n  "viewport": "390x844@1",\n  "session": "lexos-v1--variant-a"\n}\n' \
    > "$SANDBOX/.claude/state/design/renders/lexos-v1--variant-a/m.json"
  run bash "$(_explore)" coverage lexos-v1 --brief "$BRIEF"
  [ "$status" -eq 0 ]
}
