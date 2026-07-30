#!/usr/bin/env bash
# Shared helpers for the arc-scan bats suite.

# Real repo paths (tests/ lives at repo root).
ARC_ROOT="$(cd "$BATS_TEST_DIRNAME/.." && pwd)"
ARC_SCAN_SRC="$ARC_ROOT/.claude/scripts/review/arc-scan"
# common.sh is core-owned and moved OUT of arc-scan/lib in Phase 03 ckpt 2 -- the review
# product may not own a library the whole repo sources. Every other lib/ file stays put.
ARC_CORE_SRC="$ARC_ROOT/.claude/scripts/core"

# Source the pipeline libraries for unit-level tests (no git needed).
_arc_load_libs() {
  # shellcheck disable=SC1090
  . "$ARC_CORE_SRC/common.sh"
  . "$ARC_SCAN_SRC/lib/sarif.sh"
  . "$ARC_SCAN_SRC/lib/triage.sh"
}

# Build a throwaway git repo carrying a copy of .claude/scripts, so stamp/e2e
# tests never touch the real review ledger. Sets SANDBOX and cd's into it.
_arc_sandbox() {
  SANDBOX="$(mktemp -d 2>/dev/null || echo "${TMPDIR:-/tmp}/arc-bats.$$.$RANDOM")"
  # The sandbox must mirror the REAL tree's product layout, not a flattened version of it.
  # After ckpt 4 arc-scan lives at .claude/scripts/review/arc-scan/ and sources common.sh at
  # $HERE/../../core/common.sh; copying it to a flat .claude/scripts/arc-scan/ would put core
  # one level off and the source would silently miss. A flat sandbox can pass while the real
  # layout is broken -- mirror the layout, do not approximate it.
  mkdir -p "$SANDBOX/.claude/scripts/core" "$SANDBOX/.claude/scripts/review"
  cp -r "$ARC_SCAN_SRC" "$SANDBOX/.claude/scripts/review/"
  cp "$ARC_CORE_SRC/common.sh"        "$SANDBOX/.claude/scripts/core/"
  cp "$ARC_CORE_SRC/review-ledger.sh" "$SANDBOX/.claude/scripts/core/"
  cp "$ARC_CORE_SRC/arc-profile.sh"   "$SANDBOX/.claude/scripts/core/"   # arc-scan resolves scan mode through it
  cd "$SANDBOX" || return 1
  # Identity via env, not two `git config` subprocesses. Measured on Git Bash: the git
  # block was 751ms of the ~1s sandbox cost, and process spawn -- not work -- is what is
  # expensive on Windows. Same identity, two fewer spawns per test, 247 tests per run.
  export GIT_AUTHOR_NAME=arc-test GIT_AUTHOR_EMAIL=test@arc.local \
         GIT_COMMITTER_NAME=arc-test GIT_COMMITTER_EMAIL=test@arc.local
  git init -q
  echo "seed" > seed.txt
  git add -A && git commit -qm seed
}

_arc_teardown() { [ -n "${SANDBOX:-}" ] && rm -rf "$SANDBOX" 2>/dev/null || true; }

# Sandbox for the design steel thread (Cycle 3 Phase 00). Mirrors the REAL layout for the
# design scripts plus everything they call out to -- the spine emitter + reader, the review
# ledger, and the PreToolUse-edit fragment. Same lesson as _arc_sandbox: a flattened copy
# can pass while the real tree is broken, so the layout is mirrored, never approximated.
# The spine root is the sandbox, so no test ever appends to the real spine.
_arc_design_sandbox() {
  SANDBOX="$(mktemp -d 2>/dev/null || echo "${TMPDIR:-/tmp}/arc-design.$$.$RANDOM")"
  mkdir -p "$SANDBOX/.claude/scripts/core" \
           "$SANDBOX/.claude/scripts/design" \
           "$SANDBOX/.claude/scripts/hq/lib" \
           "$SANDBOX/.claude/hooks/PreToolUse-edit.d"
  cp "$ARC_ROOT"/.claude/scripts/design/*.sh      "$SANDBOX/.claude/scripts/design/" 2>/dev/null
  # The gate shells out to design-lint.mjs (ADR-0046, one gate row) -- a sandbox without it
  # would fail the lint half of every gate test for a reason that has nothing to do with
  # the behaviour under test.
  cp "$ARC_ROOT"/.claude/scripts/design/*.mjs     "$SANDBOX/.claude/scripts/design/" 2>/dev/null
  cp "$ARC_CORE_SRC/review-ledger.sh"             "$SANDBOX/.claude/scripts/core/"
  cp "$ARC_CORE_SRC/arc-profile.sh"               "$SANDBOX/.claude/scripts/core/"
  # common.sh carries arc_hash_file (GNU sha256sum / BSD-macOS shasum / cksum fallback).
  # Without it design-render.sh silently drops to raw `sha256sum`, which stock macOS does not
  # ship -- so the macOS leg would exercise a hasher production never uses, and the
  # two-captures-disagree case would pass for the wrong reason (both hashes empty).
  cp "$ARC_CORE_SRC/common.sh"                    "$SANDBOX/.claude/scripts/core/" 2>/dev/null
  cp "$ARC_ROOT"/.claude/scripts/hq/arc-event.sh  "$SANDBOX/.claude/scripts/hq/"
  cp "$ARC_ROOT"/.claude/scripts/hq/arc-event.mjs "$SANDBOX/.claude/scripts/hq/"
  cp "$ARC_ROOT"/.claude/scripts/hq/spine.mjs     "$SANDBOX/.claude/scripts/hq/"
  cp "$ARC_ROOT"/.claude/scripts/hq/lib/*.mjs     "$SANDBOX/.claude/scripts/hq/lib/"
  cp "$ARC_ROOT"/.claude/hooks/PreToolUse-edit.d/10-design-critic.sh \
     "$SANDBOX/.claude/hooks/PreToolUse-edit.d/" 2>/dev/null
  cd "$SANDBOX" || return 1
  git init -q
  # Repo-local identity, not GIT_AUTHOR_* env: the design scripts shell out to git in
  # their own subprocesses, and a clean CI runner with no global identity fails 128 there
  # even when the bats process has the env set (green local, red CI -- learned the hard way).
  git config user.name  arc-test
  git config user.email test@arc.local
  echo "seed" > seed.txt
  git add -A && git commit -qm seed
  export ARC_SPINE_ROOT="$SANDBOX"
  export CLAUDE_PROJECT_DIR="$SANDBOX"
}

# The design critique/render/gate scripts inside the current sandbox.
_arc_design() { echo "$SANDBOX/.claude/scripts/design/$1"; }

# Append a raw review.completed line to the sandbox spine. Hand-written on purpose: these are
# the ADVERSARIAL receipts (case-varied lens, non-string target, wrong route) that the real
# emitter would refuse to produce, and the gate must survive every one of them.
# Usage: _arc_plant_receipt <n> <payload-json>
_arc_plant_receipt() {
  local n="$1" payload="$2" day="$SANDBOX/events/2026-07-28.jsonl"
  mkdir -p "$SANDBOX/events"
  printf '{"id":"01K00000000000000000%02d","v":1,"ts":"2026-07-28T10:00:%02d+05:30","kind":"review.completed","payload":%s}\n' \
    "$n" "$n" "$payload" >> "$day"
}

# Write a critique artifact verbatim -- for malformed shapes _arc_plant_critique cannot express
# (no target line, a target inside a fenced block, a non-artifact filename).
# Usage: _arc_plant_raw_critique <filename> <body>
_arc_plant_raw_critique() {
  mkdir -p "$SANDBOX/docs/design/critique"
  printf '%s\n' "$2" > "$SANDBOX/docs/design/critique/$1"
}

# Plant a critique artifact the way the critic would write one. Usage:
#   _arc_plant_critique <slug> <target-path> <sha256> <finding-line>...
_arc_plant_critique() {
  local slug="$1" target="$2" sha="$3"; shift 3
  local dir="$SANDBOX/docs/design/critique" out
  mkdir -p "$dir"
  out="$dir/2026-07-28-$slug.md"
  {
    # Every line goes through a '%s\n' format: a format string STARTING with '-' is read by
    # bash printf as a flag ("printf: - : invalid option"), and every line of this artifact
    # is a markdown list item.
    printf '# Design critique — %s\n\n' "$target"
    printf '%s\n' "- target: \`$target\`"
    printf '%s\n' "- screenshot_sha256: \`$sha\`"
    printf '%s\n\n' "- viewport: \`1440x900@1\`"
    printf '## Findings\n\n'
    if [ "$#" -eq 0 ]; then
      printf '%s\n' "- none"
    else
      for _f in "$@"; do printf '%s\n' "- $_f"; done
    fi
  } > "$out"
  echo "$out"
}

# Path to arc-scan in the current sandbox.
_arc_scan() { echo "$SANDBOX/.claude/scripts/review/arc-scan/arc-scan.sh"; }
_arc_ledger_file() {
  local sha; sha="$(git -C "$SANDBOX" rev-parse --short HEAD)"
  echo "$SANDBOX/.claude/state/reviews/$sha.txt"
}

# Write a file with planted content, return its path via stdout.
_arc_write() { local p="$1"; shift; mkdir -p "$(dirname "$p")"; printf '%s\n' "$*" > "$p"; echo "$p"; }

# Extract a JS expression (over parsed `j`) from a JSON file -- no jq dependency.
# Usage: _arc_json <file> 'j.some.path'  (objects/arrays print as JSON, scalars as-is)
_arc_json() {
  node -e 'const j=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const v=eval(process.argv[2]);process.stdout.write(typeof v==="object"?JSON.stringify(v):String(v))' "$1" "$2"
}

# Skip guards for tests that need a real scanner (keeps CI green + honest when a
# runner cannot install a tool; local runs with tools present always execute).
_arc_need_semgrep()  { command -v opengrep >/dev/null 2>&1 || command -v semgrep >/dev/null 2>&1 || skip "semgrep/opengrep not installed"; }
_arc_need_gitleaks() { command -v gitleaks >/dev/null 2>&1 || skip "gitleaks not installed"; }

# Portable sha256 of stdin -> hex (GNU sha256sum / BSD-macOS shasum / openssl).
# Mirrors common.sh's arc_hash_file fallback so macOS CI (no sha256sum) works.
_arc_sha256() {
  if   command -v sha256sum >/dev/null 2>&1; then sha256sum | cut -d' ' -f1
  elif command -v shasum    >/dev/null 2>&1; then shasum -a 256 | cut -d' ' -f1
  else openssl dgst -sha256 | sed 's/.* //'
  fi
}

# ---------- root-mode golden harness (Cycle 4 portfolio, REQ-01) ----------

# Sandbox for the ROOT-MODE tracker surfaces (SessionStart/SessionEnd hooks,
# arc-evidence). Mirrors the REAL layout (same lesson as _arc_sandbox: a flat
# copy can pass while the real tree is broken). Deterministic on purpose:
# fixed branch name, repo-local git identity (clean CI runners have no global
# identity — env-only identity is green local, red CI), controlled PROGRESS.md.
_arc_tracker_sandbox() {
  SANDBOX="$(mktemp -d 2>/dev/null || echo "${TMPDIR:-/tmp}/arc-root.$$.$RANDOM")"
  mkdir -p "$SANDBOX/.claude/hooks/SessionStart.d" \
           "$SANDBOX/.claude/hooks/SessionEnd.d" \
           "$SANDBOX/.claude/scripts/core" \
           "$SANDBOX/.claude/scripts/plan"
  cp "$ARC_ROOT/.claude/hooks/SessionStart.d/00-context.sh"   "$SANDBOX/.claude/hooks/SessionStart.d/"
  cp "$ARC_ROOT/.claude/hooks/SessionEnd.d/00-session-log.sh" "$SANDBOX/.claude/hooks/SessionEnd.d/"
  cp "$ARC_CORE_SRC/common.sh"        "$SANDBOX/.claude/scripts/core/"
  cp "$ARC_CORE_SRC/review-ledger.sh" "$SANDBOX/.claude/scripts/core/"
  cp "$ARC_CORE_SRC/arc-profile.sh"   "$SANDBOX/.claude/scripts/core/" 2>/dev/null || true
  cp "$ARC_CORE_SRC/lane-resolve.sh"  "$SANDBOX/.claude/scripts/core/"
  cp "$ARC_ROOT/.claude/scripts/plan/arc-evidence.sh" "$SANDBOX/.claude/scripts/plan/"
  cd "$SANDBOX" || return 1
  git init -q
  git checkout -qb fixture-main
  git config user.name  arc-test
  git config user.email test@arc.local
  cat > PROGRESS.md <<'EOF'
# PROGRESS.md — fixture tracker

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | fixture capability | 1 day | in progress |

## Now

**Position:** fixture position line one.
line two
line three
line four
line five
line six
line seven — must NOT appear in SessionStart output (head -n 6 contract)

## After

after-section line — must never leak into the Now extraction
EOF
  git add -A && git commit -qm "seed tracker"
  export CLAUDE_PROJECT_DIR="$SANDBOX"
}

# Sandbox for the LANE RESOLVER (Cycle 4 portfolio, REQ-01 / ADR-0054). Carries
# both implementations so the equivalence gate can run them side by side.
_arc_lane_sandbox() {
  SANDBOX="$(mktemp -d 2>/dev/null || echo "${TMPDIR:-/tmp}/arc-lane.$$.$RANDOM")"
  mkdir -p "$SANDBOX/.claude/scripts/core"
  cp "$ARC_CORE_SRC/lane-resolve.sh"  "$SANDBOX/.claude/scripts/core/" 2>/dev/null || true
  cp "$ARC_CORE_SRC/lane-resolve.mjs" "$SANDBOX/.claude/scripts/core/" 2>/dev/null || true
  cp "$ARC_CORE_SRC/common.sh"        "$SANDBOX/.claude/scripts/core/"
  cd "$SANDBOX" || return 1
  git init -q
  git config user.name  arc-test
  git config user.email test@arc.local
  echo seed > seed.txt
  git add -A && git commit -qm seed
}

# Create initiatives/<name>/ with a machine-header PROGRESS.md.
# Usage: _arc_make_lane <name> <status> [cycle]
_arc_make_lane() {
  local name="$1" st="$2" cycle="${3:-test cycle}" d="$SANDBOX/initiatives/$1"
  mkdir -p "$d"
  cat > "$d/PROGRESS.md" <<EOF
# PROGRESS.md — $name

status: $st
cycle: $cycle
phase: 00 — fixture
appetite: 3d
burn: 0d
blocked-on: —
depends-on: —

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | fixture | 1 day | in progress |

## Now

**Position:** fixture.
EOF
}

# Run BOTH resolver implementations with identical args, assert they agree, then
# behave like the single command the test thinks it called.
#
# This is deliberately not "a bash helper plus a couple of equivalence cases at the
# bottom of the file": that shape let 31 behavioural assertions exercise ONE twin
# while the gate claimed to cover both, which is the same dishonesty as a gate
# reporting success on a runner where it never ran. Routing every case through here
# makes all of them equivalence cases for free — a divergence returns 99, so whatever
# the test asserted about $status fails loudly with both outputs printed.
_arc_lane_both() {
  local out_sh out_mjs code_sh code_mjs
  out_sh="$(bash "$SANDBOX/.claude/scripts/core/lane-resolve.sh" --root "$SANDBOX" "$@" 2>&1)"; code_sh=$?
  out_mjs="$(node "$SANDBOX/.claude/scripts/core/lane-resolve.mjs" --root "$SANDBOX" "$@" 2>&1)"; code_mjs=$?
  if [ "$out_sh" != "$out_mjs" ] || [ "$code_sh" != "$code_mjs" ]; then
    echo "EQUIVALENCE FAILURE for args: $*"
    echo "--- lane-resolve.sh (exit $code_sh)"; echo "$out_sh"
    echo "--- lane-resolve.mjs (exit $code_mjs)"; echo "$out_mjs"
    return 99
  fi
  [ -n "$out_sh" ] && printf '%s\n' "$out_sh"
  return "$code_sh"
}
_arc_lane_sh() { _arc_lane_both "$@"; }

# Read one KEY=value field out of resolver output held in $output.
_arc_field() { printf '%s\n' "$output" | sed -n "s/^$1=//p" | head -n1; }

# DECLARED normalization for root-mode goldens (the gate-transform rule: a gate
# that transforms what it measures must declare what the transform destroys).
# Removes ONLY machine-run identity, never behavior:
#   CR bytes (Windows tty)          -> judged signal is text, not line endings
#   commit hashes (Last commit/reviews@) -> hash varies per run by construction
#   relative/absolute wall-clock    -> time varies per run by construction
#   sandbox/git-root absolute paths -> machine-specific, replaced with SBX
# It deliberately PRESERVES: wording, ordering, counts, branch names, tracker
# content, truncation behavior — the signals the goldens exist to judge.
_arc_root_norm() {
  local groot="${1:-__nogroot__}" sbx="${SANDBOX:-__nosbx__}"
  LC_ALL=C sed \
    -e 's/\r$//' \
    -e 's/^- Last commit: [0-9a-f][0-9a-f]*/- Last commit: HASH/' \
    -e 's/(\([0-9][^)]*\) ago)/(TIME ago)/' \
    -e 's/^## 20[0-9][0-9]-[0-9-]* [0-9:]* — /## DATE TIME — /' \
    -e 's/reviews @ [0-9a-f][0-9a-f]*:/reviews @ HASH:/' \
    -e "s|$groot|SBX|g" \
    -e "s|$sbx|SBX|g"
}

# Compare normalized actual (stdin) against a pinned golden. Regen is a NAMED
# step: ARC_ROOT_GOLDEN_RECORD=1 bats tests/root-golden.bats — reviewed diff only.
# Per-OS override: tests/fixtures/root-golden/<name>.<linux|macos|windows>.txt
# wins over <name>.txt when present (pin one only when an OS genuinely differs).
_arc_root_golden_check() {
  local name="$1" dir="$ARC_ROOT/tests/fixtures/root-golden"
  local a="$BATS_TEST_TMPDIR/$name.actual" g="$dir/$name.txt" os
  cat > "$a"
  if [ "${ARC_ROOT_GOLDEN_RECORD:-0}" = "1" ]; then mkdir -p "$dir"; cp "$a" "$g"; return 0; fi
  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*) os=windows;;
    Darwin)               os=macos;;
    *)                    os=linux;;
  esac
  [ -f "$dir/$name.$os.txt" ] && g="$dir/$name.$os.txt"
  diff -u "$g" "$a"
}

# Deterministic tree fingerprint for the sync golden-output gate (REQ-02):
# every file's path + LF-normalized SHA-256, sorted (LC_ALL=C), .git excluded.
# CR bytes are stripped before hashing so a Windows checkout and a Linux CI
# checkout of the same committed bytes fingerprint identically.
# .claude/arc-registry.json is EXCLUDED (Phase 02): it is an intentional additive
# per-install artifact carrying a volatile source.commit, so it lives outside the
# byte-identical gate -- its own bats (sync.bats/products.bats) prove it correct.
_arc_tree_manifest() {
  ( cd "$1" && find . -type f -not -path './.git/*' -not -path './.claude/arc-registry.json' | LC_ALL=C sort | while IFS= read -r f; do
      printf '%s\t%s\n' "${f#./}" "$(tr -d '\r' < "$f" | _arc_sha256)"
    done )
}
