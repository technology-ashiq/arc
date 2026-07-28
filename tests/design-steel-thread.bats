#!/usr/bin/env bats
# Cycle 3 Phase 00 -- the design steel thread: read-only vision critique with a receipt.
#
# What bats CAN prove is the mechanical contract: the critic's write boundary, PASS/FAIL
# computation from the critique artifact, receipt emission + reader visibility, the ledger
# stamp, and the gate's exit codes. What bats CANNOT prove is the critic's judgment -- that
# an agent looking at a PNG names the planted defect. That half is the live demo's job
# (phase-00-spec Verification plan), and pretending a bats assertion covers it would be the
# exact "green suite, unproven capability" trap the playbook warns about.
#
# Test 1 is the phase's red-first anchor: it fails until the real live-demo run has happened
# and its artifact is committed.
bats_require_minimum_version 1.5.0
load 'test_helper'

TARGET="docs/strategy/arc-hq-mockup.html"
SLUG="docs--strategy--arc-hq-mockup-html"

setup()    { :; }
teardown() { _arc_teardown; }

# ---------- 1. the live-demo anchor (real repo, not a sandbox) ----------

@test "the target route has a committed critique artifact carrying its screenshot hash" {
  local found=""
  for f in "$ARC_ROOT"/docs/design/critique/*arc-hq-mockup*.md; do
    [ -f "$f" ] && { found="$f"; break; }
  done
  if [ -z "$found" ]; then
    echo "no critique artifact found for arc-hq-mockup" >&2
    echo "expected: docs/design/critique/<date>-$SLUG.md (written by the live critique run)" >&2
    false
  fi
  # Committed, not just sitting in the working tree -- evidence lives in git (arc-resume
  # reconstructs state from committed files, never from loose WIP).
  run git -C "$ARC_ROOT" ls-files --error-unmatch "${found#"$ARC_ROOT"/}"
  [ "$status" -eq 0 ]
  # The artifact must record WHAT was judged, so a stale-screenshot critique is detectable.
  grep -q 'screenshot_sha256' "$found"
  grep -qF "$TARGET" "$found"
}

# ---------- 2. the critic's write boundary (ADR-0034 mechanism 2) ----------

@test "critic scope: with no marker the hook is a no-op (never a global always-on rule)" {
  _arc_design_sandbox
  run bash "$SANDBOX/.claude/hooks/PreToolUse-edit.d/10-design-critic.sh" "README.md"
  [ "$status" -eq 0 ]
}

@test "critic scope: while the marker exists, a write outside the critique dir blocks" {
  _arc_design_sandbox
  bash "$(_arc_design critic-scope-check.sh)" --begin "$TARGET"
  run bash "$SANDBOX/.claude/hooks/PreToolUse-edit.d/10-design-critic.sh" "README.md"
  [ "$status" -eq 2 ]
  [[ "$output" == *"design-critic"* ]]
}

@test "critic scope: while the marker exists, a write inside the critique dir is allowed" {
  _arc_design_sandbox
  bash "$(_arc_design critic-scope-check.sh)" --begin "$TARGET"
  run bash "$SANDBOX/.claude/hooks/PreToolUse-edit.d/10-design-critic.sh" \
      "docs/design/critique/2026-07-28-$SLUG.md"
  [ "$status" -eq 0 ]
}

@test "critic scope: the marker is cleared, so the boundary does not outlive the run" {
  _arc_design_sandbox
  bash "$(_arc_design critic-scope-check.sh)" --begin "$TARGET"
  bash "$(_arc_design critic-scope-check.sh)" --end
  run bash "$SANDBOX/.claude/hooks/PreToolUse-edit.d/10-design-critic.sh" "README.md"
  [ "$status" -eq 0 ]
}

@test "critic scope: an absolute path inside the critique dir is allowed (path normalising)" {
  _arc_design_sandbox
  bash "$(_arc_design critic-scope-check.sh)" --begin "$TARGET"
  run bash "$SANDBOX/.claude/hooks/PreToolUse-edit.d/10-design-critic.sh" \
      "$SANDBOX/docs/design/critique/2026-07-28-$SLUG.md"
  [ "$status" -eq 0 ]
}

@test "critic scope: a traversal path escaping the critique dir blocks" {
  _arc_design_sandbox
  bash "$(_arc_design critic-scope-check.sh)" --begin "$TARGET"
  run bash "$SANDBOX/.claude/hooks/PreToolUse-edit.d/10-design-critic.sh" \
      "docs/design/critique/../../../README.md"
  [ "$status" -eq 2 ]
}

@test "critic scope: a path spelled through a symlink still resolves inside the repo" {
  _arc_design_sandbox
  # The cross-OS trap, made reproducible. One directory has more than one spelling: macOS
  # calls it both /var/folders/x and /private/var/folders/x, Windows calls it both
  # C:/Users/RUNNER~1 and C:/Users/runneradmin. Compare the spellings as strings and the
  # prefix strip misses, the path stays absolute, and the guard BLOCKS the critic's own
  # legitimate write. On the development box both spellings coincided, so nothing failed
  # until 3-OS CI. A symlink reproduces that divergence on every platform, which is what
  # turns an invisible CI-only bug into one this suite can catch locally.
  local link="$BATS_TEST_TMPDIR/repo-link"
  ln -s "$SANDBOX" "$link" 2>/dev/null || skip "symlinks unavailable on this runner"
  [ -L "$link" ] || skip "symlinks unavailable on this runner"
  bash "$(_arc_design critic-scope-check.sh)" --begin "$TARGET"
  run bash "$SANDBOX/.claude/hooks/PreToolUse-edit.d/10-design-critic.sh" \
      "$link/docs/design/critique/2026-07-28-$SLUG.md"
  [ "$status" -eq 0 ]
}

@test "critic scope: a symlinked path OUTSIDE the critique dir still blocks" {
  _arc_design_sandbox
  # The other half: resolving spellings must not become a way through the boundary.
  local link="$BATS_TEST_TMPDIR/repo-link2"
  ln -s "$SANDBOX" "$link" 2>/dev/null || skip "symlinks unavailable on this runner"
  [ -L "$link" ] || skip "symlinks unavailable on this runner"
  bash "$(_arc_design critic-scope-check.sh)" --begin "$TARGET"
  run bash "$SANDBOX/.claude/hooks/PreToolUse-edit.d/10-design-critic.sh" "$link/README.md"
  [ "$status" -eq 2 ]
}

# ---------- 3. PASS/FAIL from the artifact, receipt, ledger stamp (REQ-03) ----------

@test "finish: zero VIOLATION findings is PASS -> receipt result PASS + design stamp" {
  _arc_design_sandbox
  _arc_plant_critique "$SLUG" "$TARGET" "abc123" "WEAKNESS: cramped footer" "POLISH: icon weight"
  run bash "$(_arc_design design-critique.sh)" finish "$TARGET"
  [ "$status" -eq 0 ]
  [[ "$output" == *"PASS"* ]]

  # The receipt is on the spine, and readable through the reader -- not by opening the JSONL
  # (ADR-0030: the reader is the only public API).
  run node "$SANDBOX/.claude/scripts/hq/spine.mjs" read --kind review.completed
  [ "$status" -eq 0 ]
  [[ "$output" == *'"lens":"design"'* ]]
  [[ "$output" == *"$TARGET"* ]]
  [[ "$output" == *'"result":"PASS"'* ]]

  # Stamped only on PASS.
  run bash "$SANDBOX/.claude/scripts/core/review-ledger.sh" check design
  [ "$status" -eq 0 ]
}

@test "finish: a VIOLATION finding is FAIL -> receipt result FAIL and NO design stamp" {
  _arc_design_sandbox
  _arc_plant_critique "$SLUG" "$TARGET" "abc123" "VIOLATION: lorem ipsum in the hero"
  run bash "$(_arc_design design-critique.sh)" finish "$TARGET"
  [ "$status" -eq 0 ]
  [[ "$output" == *"FAIL"* ]]

  run node "$SANDBOX/.claude/scripts/hq/spine.mjs" read --kind review.completed
  [ "$status" -eq 0 ]
  [[ "$output" == *'"result":"FAIL"'* ]]

  # A failing critique must never stamp the ledger -- that is the whole point of the stamp.
  run bash "$SANDBOX/.claude/scripts/core/review-ledger.sh" check design
  [ "$status" -ne 0 ]
}

@test "finish: refuses when no critique artifact exists (never invents a PASS)" {
  _arc_design_sandbox
  run bash "$(_arc_design design-critique.sh)" finish "$TARGET"
  [ "$status" -ne 0 ]
  run bash "$SANDBOX/.claude/scripts/core/review-ledger.sh" check design
  [ "$status" -ne 0 ]
}

@test "finish: clears the critic marker even on FAIL (no boundary left armed)" {
  _arc_design_sandbox
  bash "$(_arc_design critic-scope-check.sh)" --begin "$TARGET"
  _arc_plant_critique "$SLUG" "$TARGET" "abc123" "VIOLATION: broken focus ring"
  bash "$(_arc_design design-critique.sh)" finish "$TARGET"
  run bash "$SANDBOX/.claude/hooks/PreToolUse-edit.d/10-design-critic.sh" "README.md"
  [ "$status" -eq 0 ]
}

# ---------- 4. the warn gate (REQ-04) ----------

@test "gate: exits 1 when a critiqued route has no receipt on the spine" {
  _arc_design_sandbox
  _arc_plant_critique "$SLUG" "$TARGET" "abc123"
  run bash "$(_arc_design design-gate.sh)"
  [ "$status" -eq 1 ]
  [[ "$output" == *"$TARGET"* ]]
}

@test "gate: exits 0 once the receipt for that route is present" {
  _arc_design_sandbox
  _arc_plant_critique "$SLUG" "$TARGET" "abc123" "WEAKNESS: cramped footer"
  bash "$(_arc_design design-critique.sh)" finish "$TARGET"
  run bash "$(_arc_design design-gate.sh)"
  [ "$status" -eq 0 ]
}

@test "gate: exits 0 when nothing has been critiqued (nothing to enforce)" {
  _arc_design_sandbox
  run bash "$(_arc_design design-gate.sh)"
  [ "$status" -eq 0 ]
}

@test "gate: a receipt for a DIFFERENT route does not satisfy this route" {
  _arc_design_sandbox
  _arc_plant_critique "$SLUG" "$TARGET" "abc123"
  _arc_plant_critique "other--page-html" "other/page.html" "def456" "WEAKNESS: x"
  bash "$(_arc_design design-critique.sh)" finish "other/page.html"
  run bash "$(_arc_design design-gate.sh)"
  [ "$status" -eq 1 ]
  [[ "$output" == *"$TARGET"* ]]
}

@test "gate: a torn spine is a WARN exit 1, never a block and never a crash" {
  _arc_design_sandbox
  _arc_plant_critique "$SLUG" "$TARGET" "abc123"
  mkdir -p "$SANDBOX/events"
  printf '{ this is not json\n' > "$SANDBOX/events/2026-07-28.jsonl"
  run bash "$(_arc_design design-gate.sh)"
  [ "$status" -eq 1 ]
  [[ "$output" == *"WARN"* ]]
}

@test "gate: never exits 2 this cycle, in any state (REQ-04 warn-only)" {
  _arc_design_sandbox
  # no artifacts
  run bash "$(_arc_design design-gate.sh)"; [ "$status" -ne 2 ]
  # artifact without receipt
  _arc_plant_critique "$SLUG" "$TARGET" "abc123"
  run bash "$(_arc_design design-gate.sh)"; [ "$status" -ne 2 ]
  # unreadable spine root
  ARC_SPINE_ROOT="$SANDBOX/nope-does-not-exist" run bash "$(_arc_design design-gate.sh)"
  [ "$status" -ne 2 ]
}

# ---------- 5. adversarial pass on the gate (non-negotiable) ----------
#
# Every case below was CONSTRUCTED to break the gate, and three of them did. A gate is not done
# until somebody has tried to fool it, and the holes it had are pinned here so they cannot come
# back quietly. HOLE = was broken, now fixed. HELD = attacked, already correct.

@test "gate HOLE: an artifact declaring no target is reported, never silently skipped" {
  _arc_design_sandbox
  # The dangerous direction: this used to exit 0. A malformed critique escaped enforcement
  # entirely and the gate reported OK -- a review nobody could verify, recorded as fine.
  _arc_plant_raw_critique "2026-07-28-sneaky.md" "# c
## Findings
- WEAKNESS: no target line anywhere"
  run bash "$(_arc_design design-gate.sh)"
  [ "$status" -eq 1 ]
  [[ "$output" == *"declares no target"* ]]
}

@test "gate HOLE: a target inside a fenced block is not treated as a declared target" {
  _arc_design_sandbox
  _arc_plant_raw_critique "2026-07-28-fenced.md" '# c

```md
- target: `docs/fake.html`
```
'
  run bash "$(_arc_design design-gate.sh)"
  # Reported as undeclared -- never as a demand for a receipt for docs/fake.html, a route
  # nobody critiqued.
  [ "$status" -eq 1 ]
  [[ "$output" == *"declares no target"* ]]
  [[ "$output" != *"docs/fake.html"* ]]
}

@test "gate HOLE: an absolute declared target still matches its repo-relative receipt" {
  _arc_design_sandbox
  # Two spellings of one path. Compared raw, this warned forever about a route that WAS
  # reviewed.
  #
  # This is the case that survived one CI round and needed a second fix, so the mechanism is
  # written down. On Git Bash, $SANDBOX is the MSYS spelling (/tmp/x) while `git rev-parse`
  # reports the native one (C:/Users/.../Temp/x). The artifact holds the MSYS spelling,
  # read off disk and never rewritten. The gate cannot hand node the MSYS spelling of the
  # root to strip with, because MSYS rewrites absolute-looking paths on their way into a
  # native child process -- through argv AND through the environment, both verified. So the
  # gate falls back to a slash-anchored tail match; see design-gate.sh for the trade.
  _arc_plant_critique "docs--d-html" "$SANDBOX/docs/d.html" "abc123" "WEAKNESS: x"
  bash "$(_arc_design design-critique.sh)" finish "docs/d.html"
  run bash "$(_arc_design design-gate.sh)"
  [ "$status" -eq 0 ]
}

@test "gate HOLE: a target declared through a symlink still matches its receipt" {
  _arc_design_sandbox
  # Same divergent-spelling trap as the scope guard, on the gate side: the artifact declares
  # one spelling of the route, the receipt carries another, and a string compare warns forever
  # about a route that WAS reviewed. Caught by 3-OS CI, pinned here so it cannot return.
  local link="$BATS_TEST_TMPDIR/repo-link3"
  ln -s "$SANDBOX" "$link" 2>/dev/null || skip "symlinks unavailable on this runner"
  [ -L "$link" ] || skip "symlinks unavailable on this runner"
  _arc_plant_critique "docs--d-html" "$link/docs/d.html" "abc123" "WEAKNESS: x"
  bash "$(_arc_design design-critique.sh)" finish "docs/d.html"
  run bash "$(_arc_design design-gate.sh)"
  [ "$status" -eq 0 ]
}

@test "gate HELD: a case-varied lens does not satisfy the gate (closed vocabulary)" {
  _arc_design_sandbox
  _arc_plant_critique "$SLUG" "$TARGET" "abc123"
  _arc_plant_receipt 1 "{\"lens\":\"Design\",\"target\":\"$TARGET\",\"result\":\"PASS\"}"
  run bash "$(_arc_design design-gate.sh)"
  # Normalising "Design" to "design" is how a validator becomes a suggestion (ADR-0026).
  [ "$status" -eq 1 ]
}

@test "gate HELD: a receipt for a path PREFIX does not satisfy a longer route" {
  _arc_design_sandbox
  _arc_plant_critique "bak" "docs/a.html.bak" "abc123"
  _arc_plant_receipt 2 '{"lens":"design","target":"docs/a.html","result":"PASS"}'
  run bash "$(_arc_design design-gate.sh)"
  [ "$status" -eq 1 ]
}

@test "gate HELD: a non-string target neither satisfies the gate nor crashes it" {
  _arc_design_sandbox
  _arc_plant_critique "c" "docs/c.html" "abc123"
  _arc_plant_receipt 3 '{"lens":"design","target":{"x":1},"result":"PASS"}'
  run bash "$(_arc_design design-gate.sh)"
  [ "$status" -eq 1 ]
  [ "$status" -ne 2 ]
}

@test "gate DECIDED: a FAIL receipt counts as reviewed, while the ledger stays unstamped" {
  _arc_design_sandbox
  # Deliberate, not an oversight: the gate asks "was this route reviewed", not "did it pass".
  # Demanding PASS here would make a found violation look like a missing review, and the
  # review ledger is what carries "passed".
  _arc_plant_critique "docs--e-html" "docs/e.html" "abc123" "VIOLATION: broken contrast"
  bash "$(_arc_design design-critique.sh)" finish "docs/e.html"
  run bash "$(_arc_design design-gate.sh)"
  [ "$status" -eq 0 ]
  run bash "$SANDBOX/.claude/scripts/core/review-ledger.sh" check design
  [ "$status" -ne 0 ]
}

@test "gate HELD: a README beside the artifacts is not dragged into enforcement" {
  _arc_design_sandbox
  _arc_plant_raw_critique "README.md" '# Critique archive
- target: `whatever`'
  run bash "$(_arc_design design-gate.sh)"
  [ "$status" -eq 0 ]
}

# ---------- 6. the gate row is actually wired (a script nobody runs is not a gate) ----------

@test "arc.gates.yaml carries the design row in warn mode with its evidence path" {
  run node -e '
    const t = require("fs").readFileSync(process.argv[1],"utf8");
    const b = t.split(/^  - name: /m).find(s => s.startsWith("design"));
    if (!b) { console.error("no design gate row in arc.gates.yaml"); process.exit(1); }
    const need = {
      check: "bash .claude/scripts/design/design-gate.sh",
      mode: "warn", tier: "hook", runtime: "native",
      evidence: ".claude/state/design/gate.txt",
    };
    for (const [k,v] of Object.entries(need)) {
      const m = new RegExp("^    "+k+": (.*)$","m").exec(b);
      if (!m || m[1].trim() !== v) { console.error(`design gate ${k}: expected "${v}", got "${m?m[1].trim():"(missing)"}"`); process.exit(1); }
    }
  ' "$ARC_ROOT/arc.gates.yaml"
  [ "$status" -eq 0 ]
}
