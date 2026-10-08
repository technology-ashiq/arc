#!/usr/bin/env bats
# face Phase 14 -- every write verb measured against the plan binding (REQ-18, ADR-1353).
#
# Runs beside face-coverage on every leg: `.github/workflows/**` is not mine to edit, so the gate bites
# through a bats suite. Every test asserts the audit RAN (a summary line with a verb count above zero)
# before it asserts what the audit decided, because an audit that read no file says "0 unbound" too.
bats_require_minimum_version 1.5.0
load 'test_helper'

AUDIT() { echo "$ARC_ROOT/.claude/scripts/core/plan-bound-audit.mjs"; }

# A sandbox tree holding only `.claude/scripts/<lane>/<file>` fixtures and an allowlist the test writes.
_tree() {
  T="$BATS_TEST_TMPDIR/tree"
  mkdir -p "$T/.claude/scripts/core" "$T/.claude/scripts/demo"
  printf '%s\n' '{"verbs": []}' > "$T/.claude/scripts/core/plan-bound-allowlist.json"
}

# A bound verb: the guard runs before the write in the same declaration. The positive control.
_bound_verb() {
  cat > "$T/.claude/scripts/demo/$1.mjs" <<'EOF'
import { writeFileSync } from "node:fs";
import { staleReason, planDigest } from "../core/plan-expect.mjs";
function apply(a, target, text) {
  const stale = staleReason(a.expect, planDigest(text));
  if (stale) throw new Error(stale);
  writeFileSync(target, text);
}
EOF
}

_ran() {
  # The summary line, with its verb count, must be there before anything else is believed.
  local n
  n=$(printf '%s\n' "$output" | sed -n 's/^plan-bound-audit: \([0-9]\{1,\}\) write verbs.*/\1/p')
  [ -n "$n" ] && [ "$n" -gt 0 ] || { echo "the audit did not run (no verb count): $output"; false; }
}

@test "plan-bound-audit: the real tree -- every row has four columns, and every unbound verb is allowlisted" {
  run node "$(AUDIT)"
  _ran
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local rows total
  rows=$(printf '%s\n' "$output" | grep -cE '^[^ ]+ · \.claude/scripts/[^ ]+ · (spine|tracked-file|spine\+tracked-file) · plan-bound (yes|no|unknown)( · allowlisted)?$')
  total=$(printf '%s\n' "$output" | sed -n 's/^plan-bound-audit: \([0-9]\{1,\}\) write verbs.*/\1/p')
  [ "$rows" -eq "$total" ] || { echo "rows in the four-column shape ($rows) != the summary's count ($total): $output"; false; }
  # Floored, not pinned: 87 verbs on 2026-10-09. A floor far below the truth stops measuring, so it sits near it.
  [ "$total" -ge 75 ] || { echo "verb count collapsed to $total: $output"; false; }
  # The verbs the face door already binds are seen as bound -- a detector that called everything `no` fails here.
  for v in org/org-own design/pick core/profile-request evolve/arc-evolve engine/propose; do
    printf '%s\n' "$output" | grep -qE "^$v · .* · plan-bound yes$" || { echo "$v is not read as plan-bound: $output"; false; }
  done
}

@test "plan-bound-audit: a bound verb passes with an empty allowlist (the positive control)" {
  _tree; _bound_verb good
  run node "$(AUDIT)" --root "$T"
  _ran
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"demo/good · .claude/scripts/demo/good.mjs · tracked-file · plan-bound yes"* ]] || { echo "$output"; false; }
}

@test "plan-bound-audit: MUTANT a write verb with no --expect path FAILs, named" {
  _tree; _bound_verb good
  cat > "$T/.claude/scripts/demo/bare.mjs" <<'EOF'
import { writeFileSync } from "node:fs";
export function apply(target, text) { writeFileSync(target, text); }
EOF
  run node "$(AUDIT)" --root "$T"
  _ran
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  [[ "$output" == *"demo/bare · .claude/scripts/demo/bare.mjs · tracked-file · plan-bound no"* ]] || { echo "$output"; false; }
  [[ "$output" == *"UNBOUND demo/bare:"* ]] || { echo "$output"; false; }
  [[ "$output" == *"1 unbound"* ]] || { echo "$output"; false; }
}

@test "plan-bound-audit: MUTANT a verb that reads --expect but writes BEFORE checking it FAILs" {
  _tree
  cat > "$T/.claude/scripts/demo/late.mjs" <<'EOF'
import { writeFileSync } from "node:fs";
import { staleReason, planDigest } from "../core/plan-expect.mjs";
function apply(a, target, text) {
  writeFileSync(target, text);
  const stale = staleReason(a.expect, planDigest(text));
  if (stale) throw new Error(stale);
}
EOF
  run node "$(AUDIT)" --root "$T"
  _ran
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  [[ "$output" == *"demo/late · .claude/scripts/demo/late.mjs · tracked-file · plan-bound no"* ]] || { echo "$output"; false; }
}

@test "plan-bound-audit: a spine emit before the guard FAILs too, and an emit spawned with --dry-run is not a write" {
  _tree
  cat > "$T/.claude/scripts/demo/emitfirst.mjs" <<'EOF'
import { spawnSync } from "node:child_process";
import { spineRefusal } from "../core/plan-expect.mjs";
const ARC_EVENT = "hq/arc-event.mjs";
function apply(p) {
  spawnSync(process.execPath, [ARC_EVENT, "emit", "note.logged", "--payload", p]);
  if (spineRefusal(ARC_EVENT, "note.logged", p)) throw new Error("no");
}
EOF
  cat > "$T/.claude/scripts/demo/dryonly.mjs" <<'EOF'
import { spawnSync } from "node:child_process";
const ARC_EVENT = "hq/arc-event.mjs";
function plan(p) { return spawnSync(process.execPath, [ARC_EVENT, "emit", "note.logged", "--payload", p, "--dry-run"]); }
EOF
  _bound_verb good
  run node "$(AUDIT)" --root "$T"
  _ran
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  [[ "$output" == *"demo/emitfirst · .claude/scripts/demo/emitfirst.mjs · spine · plan-bound no"* ]] || { echo "$output"; false; }
  [[ "$output" != *"demo/dryonly"* ]] || { echo "a --dry-run emit was counted as a write: $output"; false; }
}

@test "plan-bound-audit: a write in a helper with no guard, in a file that guards elsewhere, is unknown and FAILs" {
  _tree
  cat > "$T/.claude/scripts/demo/helper.mjs" <<'EOF'
import { writeFileSync } from "node:fs";
import { staleReason } from "../core/plan-expect.mjs";
function put(target, text) { writeFileSync(target, text); }
function apply(a, target, text) { if (staleReason(a.expect, "x")) return; put(target, text); }
EOF
  run node "$(AUDIT)" --root "$T"
  _ran
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  [[ "$output" == *"demo/helper · .claude/scripts/demo/helper.mjs · tracked-file · plan-bound unknown"* ]] || { echo "$output"; false; }
}

@test "plan-bound-audit: a guard or a write named only in a comment or a string is not read as code" {
  _tree
  cat > "$T/.claude/scripts/demo/words.mjs" <<'EOF'
import { writeFileSync } from "node:fs";
// staleReason(a.expect, d) runs first -- a comment, not a check
const note = "spineRefusal(x) is called before the write";
function apply(target, text) { writeFileSync(target, text); }
EOF
  cat > "$T/.claude/scripts/demo/talk.mjs" <<'EOF'
const help = "this tool never calls writeFileSync(target) itself";
EOF
  run node "$(AUDIT)" --root "$T"
  _ran
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  [[ "$output" == *"demo/words · .claude/scripts/demo/words.mjs · tracked-file · plan-bound no"* ]] || { echo "$output"; false; }
  [[ "$output" != *"demo/talk"* ]] || { echo "a write named in a string was counted: $output"; false; }
}

@test "plan-bound-audit: a shell verb that emits is never bound, and is caught" {
  _tree
  cat > "$T/.claude/scripts/demo/emit.sh" <<'EOF'
#!/usr/bin/env bash
bash "$ROOT/.claude/scripts/hq/arc-event.sh" emit note.logged --payload "$P"
EOF
  run node "$(AUDIT)" --root "$T"
  _ran
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  [[ "$output" == *"demo/emit.sh · .claude/scripts/demo/emit.sh · spine · plan-bound no"* ]] || { echo "$output"; false; }
}

@test "plan-bound-audit: an allowlisted unbound verb passes; its row with an EMPTY why FAILs" {
  _tree
  cat > "$T/.claude/scripts/demo/bare.mjs" <<'EOF'
import { writeFileSync } from "node:fs";
export function apply(target, text) { writeFileSync(target, text); }
EOF
  printf '%s\n' '{"verbs": [{"verb": "demo/bare", "why": "a lane tool, not a face op"}]}' > "$T/.claude/scripts/core/plan-bound-allowlist.json"
  run node "$(AUDIT)" --root "$T"
  _ran
  [ "$status" -eq 0 ] || { echo "status $status: $output"; false; }
  [[ "$output" == *"demo/bare · .claude/scripts/demo/bare.mjs · tracked-file · plan-bound no · allowlisted"* ]] || { echo "$output"; false; }
  printf '%s\n' '{"verbs": [{"verb": "demo/bare", "why": "   "}]}' > "$T/.claude/scripts/core/plan-bound-allowlist.json"
  run node "$(AUDIT)" --root "$T"
  _ran
  [ "$status" -eq 1 ] || { echo "an empty why passed: $output"; false; }
  [[ "$output" == *"ALLOWLIST allowlist row demo/bare has no why"* ]] || { echo "$output"; false; }
  printf '%s\n' '{"verbs": [{"verb": "demo/bare"}]}' > "$T/.claude/scripts/core/plan-bound-allowlist.json"
  run node "$(AUDIT)" --root "$T"
  [ "$status" -eq 1 ] || { echo "a missing why passed: $output"; false; }
}

@test "plan-bound-audit: a STALE row (a verb the tree no longer holds) FAILs, and so does a row for a verb now bound" {
  _tree; _bound_verb good
  printf '%s\n' '{"verbs": [{"verb": "demo/gone", "why": "was a lane tool"}]}' > "$T/.claude/scripts/core/plan-bound-allowlist.json"
  run node "$(AUDIT)" --root "$T"
  _ran
  [ "$status" -eq 1 ] || { echo "a stale row passed: $output"; false; }
  [[ "$output" == *"ALLOWLIST allowlist row demo/gone names no write verb in the tree"* ]] || { echo "$output"; false; }
  printf '%s\n' '{"verbs": [{"verb": "demo/good", "why": "carried until bound"}]}' > "$T/.claude/scripts/core/plan-bound-allowlist.json"
  run node "$(AUDIT)" --root "$T"
  [ "$status" -eq 1 ] || { echo "a row for a bound verb passed: $output"; false; }
  [[ "$output" == *"names a verb that is now plan-bound"* ]] || { echo "$output"; false; }
}

@test "plan-bound-audit: an unreadable allowlist and an unknown flag are usage errors, never a pass" {
  _tree; _bound_verb good
  printf '%s\n' 'not json' > "$T/.claude/scripts/core/plan-bound-allowlist.json"
  run node "$(AUDIT)" --root "$T"
  [ "$status" -eq 2 ] || { echo "status $status: $output"; false; }
  run node "$(AUDIT)" --root "$T" --bogus
  [ "$status" -eq 2 ] || { echo "status $status: $output"; false; }
}

@test "plan-bound-audit: this suite registers all of its tests (a dropped title is a test that never ran)" {
  local declared
  declared=$(grep -c '^@test ' "$BATS_TEST_FILENAME")
  [ "$declared" -eq 12 ] || { echo "declared $declared @test blocks, expected 12 -- update this count with the suite"; false; }
  [ "${BATS_TEST_NUMBER:-0}" -eq 12 ] || { echo "this is test $BATS_TEST_NUMBER, expected the 12th: a title was dropped"; false; }
}
