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
  # The filenames the RENDERER emits, not two letters of convenience. This fixture used to be
  # d.json and m.json -- names design-render.sh could not produce -- so the gate read green
  # against a shape production never makes. It could not have produced them either: the output
  # path carried no viewport component at all, so a second render overwrote the first and two
  # metas could not coexist in one session. Writing the real names keeps this fixture honest,
  # and design-render-session.bats proves separately that the renderer emits them.
  SR="$SANDBOX/.claude/state/design/renders/lexos-v1--variant-a"
  SL="docs--design--explore--lexos-v1--variant-a--index-html"
  mkdir -p "$SR"
  printf '{\n  "route": "docs/design/explore/lexos-v1/variant-a/index.html",\n  "viewport": "1440x900@1",\n  "session": "lexos-v1--variant-a"\n}\n' \
    > "$SR/$SL--1440x900.json"
  printf '{\n  "route": "docs/design/explore/lexos-v1/variant-a/index.html",\n  "viewport": "390x844@1",\n  "session": "lexos-v1--variant-a"\n}\n' \
    > "$SR/$SL--390x844.json"
  run bash "$(_explore)" coverage lexos-v1 --brief "$BRIEF"
  [ "$status" -eq 0 ]
}

# ---------- the div-built page (adversarial pass, 2026-08-24) ----------
#
# The unmarked-surface rule fires on `tag === "section"` alone. A page built entirely from
# <div>s therefore carries zero markers, trips nothing, and PASSES -- and Cycle 3's variants,
# the ones this gate was written against, were div-built pages. The gate does not cover the
# shape it exists for.
#
# The rule that closes it is not "every div needs a marker" -- that would demand an attribute
# on every layout wrapper for no gain. It is that a page declaring NO surface at all cannot be
# classified, and REQ-03 says unmarked fails closed. Zero markers is the emptiest possible
# declaration, and an empty result set is the one thing a broken scanner and a clean page agree
# on.

@test "surfaces: a div-built page with ZERO markers fails closed" {
  _surface_sandbox
  cat > "$PAGE" <<'EOF'
<!doctype html><title>case workspace</title>
<div class="shell">
  <div class="panel"><h1>Matter 4821</h1><p>Hearing on 12 Mar</p></div>
  <div class="panel"><h2>Filings</h2><p>Three documents</p></div>
</div>
EOF
  run bash "$(_explore)" surfaces lexos-v1
  [ "$status" -ne 0 ] || { echo "a page declaring no surface at all passed: $output"; false; }
  echo "$output" | grep -q "surface" || { echo "refused, but not by the surface gate: $output"; false; }
}

@test "surfaces: a div-built page that DOES mark its surfaces passes" {
  _surface_sandbox
  # The paired positive control. The rule above must fail the undeclared page without
  # outlawing <div> as a surface container -- the marker is the contract, not the tag name.
  cat > "$PAGE" <<'EOF'
<!doctype html><title>case workspace</title>
<div class="shell">
  <div class="panel" data-arc-surface="product"><h1>Matter 4821</h1><p>Hearing on 12 Mar</p></div>
  <div class="panel" data-arc-surface="product"><h2>Filings</h2><p>Three documents</p></div>
</div>
EOF
  run bash "$(_explore)" surfaces lexos-v1
  [ "$status" -eq 0 ] || { echo "a correctly marked div page was refused: $output"; false; }
}

# ---------- selfreview is opt-in (adversarial pass, 2026-08-24) ----------
#
# `[ -d "$srdir" ] || continue`. The reasoning written above it is right as far as it goes: a
# variant composed in one pass has nothing to prove, and absence is not a failure. What it
# misses is the case where absence is a CONTRADICTION -- iteration receipts sitting in the
# session directory say iterations happened, and no self-review/ means nothing records what
# they were for. Three iterations on disk and no manifest currently reads as a clean pass.

@test "selfreview: iteration receipts on disk with NO self-review dir fails closed" {
  _surface_sandbox
  sess="$SANDBOX/.claude/state/design/renders/lexos-v1--variant-a"
  mkdir -p "$sess"
  # Literal hashes rather than $(printf ... $(seq 64)): seq is not POSIX and this suite runs
  # on three OS legs. A fixture that fails to BUILD on one leg fails the case for a reason
  # that has nothing to do with the behaviour under test.
  a64=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
  b64=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
  printf '{\n  "screenshot_sha256": "%s",\n  "iter": 1\n}\n' "$a64" > "$sess/page--iter-1.json"
  printf '{\n  "screenshot_sha256": "%s",\n  "iter": 2\n}\n' "$b64" > "$sess/page--iter-2.json"
  run bash "$(_explore)" selfreview lexos-v1
  [ "$status" -ne 0 ] || { echo "iterations happened and nothing recorded them, yet this passed: $output"; false; }
  echo "$output" | grep -qi "self-review" || { echo "refused, but not for the missing self-review: $output"; false; }
}

@test "selfreview: a variant composed in ONE pass still needs no self-review dir" {
  _surface_sandbox
  # The paired control, and the reason the rule above is about CONTRADICTION rather than
  # about presence. No iteration receipts means no claim was made, and a gate that demanded a
  # manifest here would force ceremony on the composer who got it right first time.
  sess="$SANDBOX/.claude/state/design/renders/lexos-v1--variant-a"
  mkdir -p "$sess"
  c64=cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
  printf '{\n  "screenshot_sha256": "%s",\n  "iter": null\n}\n' "$c64" > "$sess/page.json"
  run bash "$(_explore)" selfreview lexos-v1
  [ "$status" -eq 0 ] || { echo "a single-pass variant was refused: $output"; false; }
}

# ---------- render writes where the gates read (adversarial pass, 2026-08-24) ----------
#
# `design-explore.sh render` calls design-render.sh with NO flags. MODE then defaults to
# critique and SESSION to design-critic, so output lands in renders/design-critic/ while
# coverage and selfreview read renders/<id>--variant-<v>. `render <id>` followed by
# `coverage <id>` therefore ALWAYS reports a viewport gap, and selfreview sees no metas at
# all. Only the composer's hand-typed flags produce what the gates read -- which means the
# one command that renders every variant is the one command whose output nothing consumes.

@test "render: every variant is rendered into ITS OWN session, in explore mode" {
  _surface_sandbox
  printf '<!doctype html><title>a</title>\n' > "$PAGE"
  # A stub renderer that records the argv it was handed. The real one needs a browser; what
  # is under test here is the invocation, and a stub is the only way to assert argv without
  # asserting a screenshot too.
  cat > "$SANDBOX/.claude/scripts/design/design-render.sh" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "${CLAUDE_PROJECT_DIR:-.}/render-argv.log"
STUB
  run bash "$(_explore)" render lexos-v1
  log="$SANDBOX/render-argv.log"
  [ -f "$log" ] || { echo "the renderer was never invoked: $output"; false; }
  grep -q -- "--mode explore" "$log" || { echo "render did not ask for explore mode: $(cat "$log")"; false; }
  grep -q -- "--session lexos-v1--variant-a" "$log" || { echo "render did not scope the session to the variant: $(cat "$log")"; false; }
}
