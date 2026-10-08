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
  printf '%s\n' '{"verbs": [{"verb": "demo/bare", "class": "lane-tool", "why": "a lane tool, not a face op"}]}' > "$T/.claude/scripts/core/plan-bound-allowlist.json"
  run node "$(AUDIT)" --root "$T"
  _ran
  [ "$status" -eq 0 ] || { echo "status $status: $output"; false; }
  [[ "$output" == *"demo/bare · .claude/scripts/demo/bare.mjs · tracked-file · plan-bound no · allowlisted"* ]] || { echo "$output"; false; }
  printf '%s\n' '{"verbs": [{"verb": "demo/bare", "class": "lane-tool", "why": "   "}]}' > "$T/.claude/scripts/core/plan-bound-allowlist.json"
  run node "$(AUDIT)" --root "$T"
  _ran
  [ "$status" -eq 1 ] || { echo "an empty why passed: $output"; false; }
  [[ "$output" == *"ALLOWLIST allowlist row demo/bare has no why"* ]] || { echo "$output"; false; }
  printf '%s\n' '{"verbs": [{"verb": "demo/bare", "class": "lane-tool"}]}' > "$T/.claude/scripts/core/plan-bound-allowlist.json"
  run node "$(AUDIT)" --root "$T"
  [ "$status" -eq 1 ] || { echo "a missing why passed: $output"; false; }
}

@test "plan-bound-audit: a STALE row (a verb the tree no longer holds) FAILs, and so does a row for a verb now bound" {
  _tree; _bound_verb good
  printf '%s\n' '{"verbs": [{"verb": "demo/gone", "class": "lane-tool", "why": "was a lane tool"}]}' > "$T/.claude/scripts/core/plan-bound-allowlist.json"
  run node "$(AUDIT)" --root "$T"
  _ran
  [ "$status" -eq 1 ] || { echo "a stale row passed: $output"; false; }
  [[ "$output" == *"ALLOWLIST allowlist row demo/gone names no write verb in the tree"* ]] || { echo "$output"; false; }
  printf '%s\n' '{"verbs": [{"verb": "demo/good", "class": "lane-tool", "why": "carried until bound"}]}' > "$T/.claude/scripts/core/plan-bound-allowlist.json"
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

@test "plan-bound-audit: MUTANT a guard whose result is dropped is no guard (round-1 L2)" {
  _tree
  cat > "$T/.claude/scripts/demo/dropped.mjs" <<'EOS'
import { writeFileSync } from "node:fs";
import { staleReason } from "../core/plan-expect.mjs";
function apply(a, target, text) {
  staleReason(a.expect, "d");
  writeFileSync(target, text);
}
EOS
  cat > "$T/.claude/scripts/demo/unread.mjs" <<'EOS'
import { writeFileSync } from "node:fs";
import { staleReason } from "../core/plan-expect.mjs";
function apply(a, target, text) {
  const stale = staleReason(a.expect, "d");
  writeFileSync(target, text);
}
EOS
  _bound_verb good
  run node "$(AUDIT)" --root "$T"
  _ran
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  [[ "$output" == *"demo/dropped · .claude/scripts/demo/dropped.mjs · tracked-file · plan-bound no"* ]] || { echo "$output"; false; }
  [[ "$output" == *"demo/unread · .claude/scripts/demo/unread.mjs · tracked-file · plan-bound no"* ]] || { echo "$output"; false; }
  [[ "$output" == *"demo/good · .claude/scripts/demo/good.mjs · tracked-file · plan-bound yes"* ]] || { echo "$output"; false; }
}

@test "plan-bound-audit: MUTANT tmp-then-rename onto a tracked file is judged by its destination (round-1 B1)" {
  _tree
  cat > "$T/.claude/scripts/demo/swap.mjs" <<'EOS'
import { writeFileSync, renameSync } from "node:fs";
export function apply(tmp, target, text) { writeFileSync(tmp, text); renameSync(tmp, join(target, "PLAN.md")); }
EOS
  run node "$(AUDIT)" --root "$T"
  _ran
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  [[ "$output" == *"demo/swap · .claude/scripts/demo/swap.mjs · tracked-file · plan-bound no"* ]] || { echo "$output"; false; }
  # The scratch half is counted and printed, never silently dropped.
  [[ "$output" == *"SCRATCH demo/swap: 1 write(s) read as scratch"* ]] || { echo "$output"; false; }
}

@test "plan-bound-audit: MUTANT aliased, promise and dynamically imported fs writers are seen (round-1 B2 L9)" {
  _tree
  cat > "$T/.claude/scripts/demo/alias.mjs" <<'EOS'
import { writeFileSync as put } from "node:fs";
export function apply(target, text) { put(target, text); }
EOS
  cat > "$T/.claude/scripts/demo/prom.mjs" <<'EOS'
import { writeFile } from "node:fs/promises";
export async function apply(target, text) { await writeFile(target, text); }
EOS
  cat > "$T/.claude/scripts/demo/dyn.mjs" <<'EOS'
export async function apply(target, text) { const { appendFileSync: add } = await import("node:fs"); add(target, text); }
EOS
  cat > "$T/.claude/scripts/demo/emitas.mjs" <<'EOS'
import { emitReceipt as send } from "../core/plan-expect.mjs";
export function apply(p) { send("x", "note.logged", p); }
EOS
  run node "$(AUDIT)" --root "$T"
  _ran
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  for v in alias prom dyn; do
    [[ "$output" == *"demo/$v · .claude/scripts/demo/$v.mjs · tracked-file · plan-bound no"* ]] || { echo "demo/$v unseen: $output"; false; }
  done
  [[ "$output" == *"demo/emitas · .claude/scripts/demo/emitas.mjs · spine · plan-bound no"* ]] || { echo "$output"; false; }
}

@test "plan-bound-audit: MUTANT a write through an imported helper is charged to the importer, one hop (round-1 L3 B11)" {
  _tree
  mkdir -p "$T/.claude/scripts/demo/lib"
  cat > "$T/.claude/scripts/demo/lib/store.mjs" <<'EOS'
import { writeFileSync } from "node:fs";
export function save(target, text) { writeFileSync(target, text); }
export function read(target) { return target; }
EOS
  cat > "$T/.claude/scripts/demo/caller.mjs" <<'EOS'
import { save } from "./lib/store.mjs";
export function apply(target, text) { save(target, text); }
EOS
  cat > "$T/.claude/scripts/demo/reader.mjs" <<'EOS'
import { read } from "./lib/store.mjs";
export function look(target) { return read(target); }
EOS
  cat > "$T/.claude/scripts/demo/guarded.mjs" <<'EOS'
import { save } from "./lib/store.mjs";
import { staleReason } from "../core/plan-expect.mjs";
export function apply(a, target, text) { if (staleReason(a.expect, "d")) return; save(target, text); }
EOS
  run node "$(AUDIT)" --root "$T"
  _ran
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  [[ "$output" == *"demo/caller · .claude/scripts/demo/caller.mjs · tracked-file · plan-bound no"* ]] || { echo "$output"; false; }
  [[ "$output" == *"demo/guarded · .claude/scripts/demo/guarded.mjs · tracked-file · plan-bound yes"* ]] || { echo "$output"; false; }
  [[ "$output" != *"demo/reader"* ]] || { echo "a read-only import was charged as a write: $output"; false; }
}

@test "plan-bound-audit: MUTANT a shell emit with a flag before emit, and a continued line, are caught (round-1 L5 B4)" {
  _tree
  cat > "$T/.claude/scripts/demo/flag.sh" <<'EOS'
#!/usr/bin/env bash
bash "$ROOT/.claude/scripts/hq/arc-event.sh" --quiet emit note.logged --payload "$P"
EOS
  cat > "$T/.claude/scripts/demo/cont.sh" <<'EOS'
#!/usr/bin/env bash
bash "$ROOT/.claude/scripts/hq/arc-event.sh" \
  emit note.logged --payload "$P"
EOS
  run node "$(AUDIT)" --root "$T"
  _ran
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  [[ "$output" == *"demo/flag.sh · .claude/scripts/demo/flag.sh · spine · plan-bound no"* ]] || { echo "$output"; false; }
  [[ "$output" == *"demo/cont.sh · .claude/scripts/demo/cont.sh · spine · plan-bound no"* ]] || { echo "$output"; false; }
}

@test "plan-bound-audit: MUTANT git branch and add are writes, and their read-only forms are not (round-1 L6 B3)" {
  _tree
  cat > "$T/.claude/scripts/demo/gitw.mjs" <<'EOS'
import { execFileSync } from "node:child_process";
export function apply(name) { execFileSync("git", ["-C", ".", "branch", name]); }
EOS
  cat > "$T/.claude/scripts/demo/gitr.mjs" <<'EOS'
import { execFileSync } from "node:child_process";
export function look() { return execFileSync("git", ["branch", "--show-current"]); }
EOS
  cat > "$T/.claude/scripts/demo/gitadd.sh" <<'EOS'
#!/usr/bin/env bash
git -C "$D" add -- PLAN.md
EOS
  cat > "$T/.claude/scripts/demo/gitread.sh" <<'EOS'
#!/usr/bin/env bash
b=$(git symbolic-ref --short -q HEAD || git rev-parse HEAD)
EOS
  run node "$(AUDIT)" --root "$T"
  _ran
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  [[ "$output" == *"demo/gitw · .claude/scripts/demo/gitw.mjs · tracked-file · plan-bound no"* ]] || { echo "$output"; false; }
  [[ "$output" == *"demo/gitadd.sh · .claude/scripts/demo/gitadd.sh · tracked-file · plan-bound no"* ]] || { echo "$output"; false; }
  [[ "$output" != *"demo/gitr "* && "$output" != *"demo/gitread.sh "* ]] || { echo "a read-only git form was counted: $output"; false; }
}

@test "plan-bound-audit: MUTANT a line comment ended by a bare CR does not hide the write after it (round-1 B7)" {
  _tree
  printf 'import { writeFileSync } from "node:fs";\n// note\rwriteFileSync(target, text);\n' > "$T/.claude/scripts/demo/cr.mjs"
  run node "$(AUDIT)" --root "$T"
  _ran
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  [[ "$output" == *"demo/cr · .claude/scripts/demo/cr.mjs · tracked-file · plan-bound no"* ]] || { echo "$output"; false; }
}

@test "plan-bound-audit: a script it cannot parse is listed unknown, never passed (round-1 B5)" {
  _tree; _bound_verb good
  printf '%s\n' 'open("PLAN.md", "w").write("x")' > "$T/.claude/scripts/demo/tool.py"
  run node "$(AUDIT)" --root "$T"
  _ran
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  [[ "$output" == *"demo/tool.py · .claude/scripts/demo/tool.py · tracked-file · plan-bound unknown"* ]] || { echo "$output"; false; }
}

@test "plan-bound-audit: an allowlist row with an unknown class FAILs (round-1 L8)" {
  _tree
  cat > "$T/.claude/scripts/demo/bare.mjs" <<'EOS'
import { writeFileSync } from "node:fs";
export function apply(target, text) { writeFileSync(target, text); }
EOS
  printf '%s\n' '{"verbs": [{"verb": "demo/bare", "class": "trusted", "why": "it is fine"}]}' > "$T/.claude/scripts/core/plan-bound-allowlist.json"
  run node "$(AUDIT)" --root "$T"
  _ran
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  [[ "$output" == *'ALLOWLIST allowlist row demo/bare has class "trusted"'* ]] || { echo "$output"; false; }
}

@test "plan-bound-audit: an empty tree, a doubled or empty flag and a shared verb name are refused (round-1 L12 B9 B12)" {
  _tree
  run node "$(AUDIT)" --root "$T"
  [ "$status" -eq 1 ] || { echo "an audit that read nothing passed: $status $output"; false; }
  [[ "$output" == *"EMPTY the audit read no write verb at all"* ]] || { echo "$output"; false; }
  _bound_verb good
  run node "$(AUDIT)" --root "$T" --root "$T"
  [ "$status" -eq 2 ] || { echo "a doubled flag: $status $output"; false; }
  run node "$(AUDIT)" --root ""
  [ "$status" -eq 2 ] || { echo "an empty value: $status $output"; false; }
  run node "$(AUDIT)" --root --allowlist
  [ "$status" -eq 2 ] || { echo "a flag as a value: $status $output"; false; }
  cp "$T/.claude/scripts/demo/good.mjs" "$T/.claude/scripts/demo/good.js"
  run node "$(AUDIT)" --root "$T"
  [ "$status" -eq 2 ] || { echo "two files under one verb name: $status $output"; false; }
  [[ "$output" == *"two files share the verb name demo/good"* ]] || { echo "$output"; false; }
}

@test "plan-bound-audit: MUTANT git with a variable -C dir, a git wrapper helper and a rebound import are seen (round-2 B1 B2 L3)" {
  _tree
  cat > "$T/.claude/scripts/demo/gitvar.mjs" <<'EOS'
import { execFileSync } from "node:child_process";
export function apply(root, msg) { execFileSync("git", ["-C", root, "commit", "-m", msg]); }
EOS
  cat > "$T/.claude/scripts/demo/wrap.mjs" <<'EOS'
import { spawnSync } from "node:child_process";
function git(args) { return spawnSync("git", args, { encoding: "utf8" }); }
export function apply(name) { git(["branch", name]); }
export function look() { return git(["rev-parse", "HEAD"]); }
EOS
  cat > "$T/.claude/scripts/demo/wrapread.mjs" <<'EOS'
import { spawnSync } from "node:child_process";
function git(args) { return spawnSync("git", args, { encoding: "utf8" }); }
export function look() { return git(["rev-parse", "HEAD"]); }
EOS
  mkdir -p "$T/.claude/scripts/demo/lib"
  cat > "$T/.claude/scripts/demo/lib/store.mjs" <<'EOS'
import { writeFileSync } from "node:fs";
export function save(target, text) { writeFileSync(target, text); }
EOS
  cat > "$T/.claude/scripts/demo/rebind.mjs" <<'EOS'
import { save } from "./lib/store.mjs";
const put = save;
export function apply(target, text) { put(target, text); }
EOS
  run node "$(AUDIT)" --root "$T"
  _ran
  [ "$status" -eq 1 ] || { echo "status $status: $output"; false; }
  [[ "$output" == *"demo/gitvar · .claude/scripts/demo/gitvar.mjs · tracked-file · plan-bound no"* ]] || { echo "$output"; false; }
  [[ "$output" == *"demo/wrap · .claude/scripts/demo/wrap.mjs · tracked-file · plan-bound no"* ]] || { echo "$output"; false; }
  [[ "$output" == *"demo/rebind · .claude/scripts/demo/rebind.mjs · tracked-file · plan-bound no"* ]] || { echo "$output"; false; }
  [[ "$output" != *"demo/wrapread "* ]] || { echo "a read-only call through a git wrapper was counted: $output"; false; }
}

@test "plan-bound-audit: this suite registers all of its tests (a dropped title is a test that never ran)" {
  local declared
  declared=$(grep -c '^@test ' "$BATS_TEST_FILENAME")
  [ "$declared" -eq 23 ] || { echo "declared $declared @test blocks, expected 23 -- update this count with the suite"; false; }
  [ "${BATS_TEST_NUMBER:-0}" -eq 23 ] || { echo "this is test $BATS_TEST_NUMBER, expected the 23rd: a title was dropped"; false; }
}
