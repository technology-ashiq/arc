#!/usr/bin/env bats
# Cycle 3 Phase 02 -- explore mode: the deterministic half of theses -> variants -> pick.
#
# What bats CAN prove: the runner's scaffold (dirs, per-variant tokens, recorded base SHA),
# the existence checks (IA matrix, thesis lines), the raw-hex refusal, and the ADR-0044
# mechanism (two same-route receipts with distinct idems). What bats CANNOT prove: thesis
# divergence (the director's written judgment), variant quality (the critic + jury), and the
# pick (the owner). Pretending otherwise would be scoring judgment with a script -- the
# inverse of the ADR-0048 mistake, equally wrong.
bats_require_minimum_version 1.5.0
load 'test_helper'

EXPLORE="$ARC_ROOT/.claude/scripts/design/design-explore.sh"

setup()    { :; }
teardown() { _arc_teardown; }

# Sandbox with the design scripts + spine, then init one explore. Sets EX_DIR.
_explore_sandbox() {
  _arc_design_sandbox
  run bash "$SANDBOX/.claude/scripts/design/design-explore.sh" init hq-dashboard \
    --brief docs/design/briefs/test/brief.md
  [ "$status" -eq 0 ]
  EX_DIR="$SANDBOX/docs/design/explore/hq-dashboard"
}

# A minimal brief for the sandbox (the runner requires one -- explore without declared
# intent is exploration of nothing).
_plant_brief() {
  mkdir -p "$SANDBOX/docs/design/briefs/test"
  cp "$ARC_ROOT/tests/fixtures/design-lint/complete/brief.md" "$SANDBOX/docs/design/briefs/test/brief.md"
}

# ---------- 1. scaffold ----------

@test "init scaffolds the explore dir: three variant dirs, per-variant tokens, base SHA" {
  _arc_design_sandbox; _plant_brief
  run bash "$SANDBOX/.claude/scripts/design/design-explore.sh" init hq-dashboard \
    --brief docs/design/briefs/test/brief.md
  [ "$status" -eq 0 ]
  local d="$SANDBOX/docs/design/explore/hq-dashboard"
  [ -f "$d/variant-a/tokens.css" ]
  [ -f "$d/variant-b/tokens.css" ]
  [ -f "$d/variant-c/tokens.css" ]
  # base SHA recorded, and it is the sandbox HEAD -- variants all start from ONE revision
  grep -q "$(git -C "$SANDBOX" rev-parse --short HEAD)" "$d/base-revision.txt"
  # the brief the exploration answers to is recorded, not implied
  grep -q "docs/design/briefs/test/brief.md" "$d/explore.txt"
}

@test "init refuses a second run for the same id (an explore is append-only evidence)" {
  _arc_design_sandbox; _plant_brief
  bash "$SANDBOX/.claude/scripts/design/design-explore.sh" init hq-dashboard \
    --brief docs/design/briefs/test/brief.md
  run bash "$SANDBOX/.claude/scripts/design/design-explore.sh" init hq-dashboard \
    --brief docs/design/briefs/test/brief.md
  [ "$status" -ne 0 ]
}

@test "init refuses a missing brief -- exploration without declared intent is nothing" {
  _arc_design_sandbox
  run bash "$SANDBOX/.claude/scripts/design/design-explore.sh" init hq-dashboard \
    --brief docs/design/briefs/absent/brief.md
  [ "$status" -ne 0 ]
}

# ---------- 2. check: the deterministic gate before critique ----------

@test "check fails while the IA matrix is missing, naming it (existence only)" {
  _arc_design_sandbox; _plant_brief
  bash "$SANDBOX/.claude/scripts/design/design-explore.sh" init hq-dashboard \
    --brief docs/design/briefs/test/brief.md
  run bash "$SANDBOX/.claude/scripts/design/design-explore.sh" check hq-dashboard
  [ "$status" -ne 0 ]
  [[ "$output" == *"matrix"* ]]
}

@test "check passes once matrix + thesis lines + variant pages exist, tokens only" {
  _arc_design_sandbox; _plant_brief
  bash "$SANDBOX/.claude/scripts/design/design-explore.sh" init hq-dashboard \
    --brief docs/design/briefs/test/brief.md
  local d="$SANDBOX/docs/design/explore/hq-dashboard"
  printf '# IA matrix\n\n| dimension | A | B | C |\n|---|---|---|---|\n| primary object | card | queue | canvas |\n\nDirector call: A/B/C differ materially on 4 of 7 dimensions.\n' > "$d/matrix.md"
  for v in a b c; do
    printf '/* thesis: This product wins because the user can decide without hunting. */\n:root{--v-ink:#c3c2b7;--v-bg:#1a1a19}\n' > "$d/variant-$v/tokens.css"
    printf '<!doctype html><title>V%s</title><style>body{color:var(--v-ink);background:var(--v-bg)}</style><h1>ARC HQ</h1>\n' "$v" > "$d/variant-$v/index.html"
    printf 'This product wins because the user can decide without hunting.\n' > "$d/variant-$v/thesis.txt"
  done
  run bash "$SANDBOX/.claude/scripts/design/design-explore.sh" check hq-dashboard
  [ "$status" -eq 0 ]
}

@test "check refuses raw hex in a variant page -- colour lives in that variant's tokens" {
  _arc_design_sandbox; _plant_brief
  bash "$SANDBOX/.claude/scripts/design/design-explore.sh" init hq-dashboard \
    --brief docs/design/briefs/test/brief.md
  local d="$SANDBOX/docs/design/explore/hq-dashboard"
  printf '# IA matrix\n\nDirector call: differ on 4 of 7.\n' > "$d/matrix.md"
  for v in a b c; do
    printf ':root{--v-ink:#c3c2b7}\n' > "$d/variant-$v/tokens.css"
    printf 'thesis line\n' > "$d/variant-$v/thesis.txt"
    printf '<!doctype html><h1>ok</h1>\n' > "$d/variant-$v/index.html"
  done
  # one variant smuggles a raw hex into its page instead of its tokens
  printf '<!doctype html><h1 style="color:#ff00ff">painted</h1>\n' > "$d/variant-b/index.html"
  run bash "$SANDBOX/.claude/scripts/design/design-explore.sh" check hq-dashboard
  [ "$status" -ne 0 ]
  [[ "$output" == *"variant-b"* ]]
}

# ---------- 3. adversarial pass on check() -- every constructed attack, pinned ----------
#
# The first cut refused hex only; the pass walked past it three ways. HOLE = broke it,
# fixed, pinned. All the same class: a colour literal wearing different clothes.

# Shared scaffold for the colour-smuggle attacks: a complete, passing explore.
_smuggle_setup() {
  _arc_design_sandbox; _plant_brief
  bash "$SANDBOX/.claude/scripts/design/design-explore.sh" init hq-dashboard \
    --brief docs/design/briefs/test/brief.md
  EX_DIR="$SANDBOX/docs/design/explore/hq-dashboard"
  printf '# m\n\nDirector call: differ on 4 of 7.\n' > "$EX_DIR/matrix.md"
  for v in a b c; do
    printf 'thesis line\n' > "$EX_DIR/variant-$v/thesis.txt"
    printf ':root{--i:#c3c2b7}\n' > "$EX_DIR/variant-$v/tokens.css"
    printf '<!doctype html><h1>ok</h1>\n' > "$EX_DIR/variant-$v/index.html"
  done
}

@test "attack HOLE: rgb() literal is refused like hex (same smuggle, different clothes)" {
  _smuggle_setup
  printf '<!doctype html><h1 style="color:rgb(255,0,255)">x</h1>\n' > "$EX_DIR/variant-a/index.html"
  run bash "$SANDBOX/.claude/scripts/design/design-explore.sh" check hq-dashboard
  [ "$status" -ne 0 ]
  [[ "$output" == *"colour-literal"* ]]
}

@test "attack HOLE: hsl() literal is refused" {
  _smuggle_setup
  printf '<!doctype html><style>h1{background:hsl(300,100%%,50%%)}</style>\n' > "$EX_DIR/variant-c/index.html"
  run bash "$SANDBOX/.claude/scripts/design/design-explore.sh" check hq-dashboard
  [ "$status" -ne 0 ]
}

@test "attack HOLE: a named colour in value position is refused" {
  _smuggle_setup
  printf '<!doctype html><style>h1{color:magenta}</style><h1>x</h1>\n' > "$EX_DIR/variant-b/index.html"
  run bash "$SANDBOX/.claude/scripts/design/design-explore.sh" check hq-dashboard
  [ "$status" -ne 0 ]
}

@test "attack HOLE: --brief refusing '..' traversal (record must stay inside the repo)" {
  _arc_design_sandbox; _plant_brief
  run bash "$SANDBOX/.claude/scripts/design/design-explore.sh" init trav \
    --brief "docs/design/briefs/test/../test/brief.md"
  [ "$status" -ne 0 ]
}

@test "attack HELD: hex inside tokens.css stays legal -- that is where colour lives" {
  _smuggle_setup
  run bash "$SANDBOX/.claude/scripts/design/design-explore.sh" check hq-dashboard
  [ "$status" -eq 0 ]
}

# ---------- 4. the ADR-0044 mechanism, pinned where Phase 2 depends on it ----------

@test "two critique rounds on the SAME route leave two receipts with DISTINCT idems" {
  _arc_design_sandbox
  _arc_plant_critique "docs--r-html" "docs/r.html" "aaa" "VIOLATION: broken thing"
  bash "$(_arc_design design-critique.sh)" finish "docs/r.html"
  sleep 1
  _arc_plant_critique "docs--r-html" "docs/r.html" "aaa" "VIOLATION: broken thing"
  bash "$(_arc_design design-critique.sh)" finish "docs/r.html"
  # both rounds on the spine, and their idem keys differ -- the exact evidence shape
  # ADR-0044 demands at Phase-2 close (a merged-PR attestation alone is insufficient)
  run bash -c "cat '$SANDBOX'/events/*.jsonl | node -e '
    const ls = require(\"fs\").readFileSync(0, \"utf8\").trim().split(\"\\n\").map(JSON.parse)
      .filter(e => e.kind === \"review.completed\" && e.payload.target === \"docs/r.html\");
    if (ls.length !== 2) { console.error(\"receipts: \" + ls.length); process.exit(1); }
    if (new Set(ls.map(e => e.idem)).size !== 2) { console.error(\"idems collide\"); process.exit(1); }
    console.log(\"2 receipts, distinct idems\");
  '"
  [ "$status" -eq 0 ]
  [[ "$output" == *"2 receipts, distinct idems"* ]]
}
