#!/usr/bin/env bash
# Shared helpers for the arc-scan bats suite.

# Real repo paths (tests/ lives at repo root).
ARC_ROOT="$(cd "$BATS_TEST_DIRNAME/.." && pwd)"
ARC_SCAN_SRC="$ARC_ROOT/.claude/scripts/review/arc-scan"
# common.sh is core-owned and moved OUT of arc-scan/lib in Phase 03 ckpt 2 -- the review
# product may not own a library the whole repo sources. Every other lib/ file stays put.
ARC_CORE_SRC="$ARC_ROOT/.claude/scripts/core"
# Repo-local tooling, deliberately OUTSIDE the synced .claude/ surface: product-lint
# refuses any file under .claude/ that no product manifest maps, and a one-off that
# migrates arc's own tracker must not ship to venture repos that can never use it.
ARC_MIGRATE_SRC="$ARC_ROOT/.github/scripts/tracker-migrate.sh"

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
  # hq has a LOAD-TIME dependency on core's ES modules (products/hq/manifest.json already
  # declares `requires: ["core"]`): validate.mjs re-exports the variant grammar from
  # core/variant-grammar.mjs, and validate-experiment.mjs imports the path and money-surface
  # rules from core/evolve-manifest.mjs, so there is exactly one copy of each rather than a
  # copy per product. A sandbox with core's .sh files but not its .mjs files is an INCOMPLETE
  # install of hq: arc-event.mjs dies on import, emits nothing, and every downstream assertion
  # fails for a reason that has nothing to do with the behaviour under test.
  cp "$ARC_CORE_SRC"/*.mjs                        "$SANDBOX/.claude/scripts/core/" 2>/dev/null
  cp "$ARC_CORE_SRC"/*.json                       "$SANDBOX/.claude/scripts/core/" 2>/dev/null
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
# Installed is not the same as WORKING, and the adapter cannot tell the difference: it ends its
# scan line with `|| true` (adapters/semgrep.sh:57,62), so a tool that crashes produces an empty
# SARIF and reads as a clean codebase. A guard that only checks `command -v` therefore lets a
# broken scanner turn into "your adapter is wrong".
#
# Measured 2026-08-12: arc-scan.bats, baseline.bats and arc-profile.bats fail in ISOLATION on
# windows on main AND on every branch (weigh-tests runs 31625002487 and 31627029442, identical
# rc=1).
#
# THE CAUSE IS NOW ESTABLISHED, AND THE SHARD-LUCK EXPLANATION THAT USED TO SIT HERE WAS WRONG.
# It is not an inter-file dependency on arc-tools-image.bats: red run 31622490938 put
# arc-tools-image.bats, arc-scan.bats and baseline.bats in the SAME shard and they still failed,
# and arc-tools-image.bats states at its own line 3 that it runs static offline checks and
# builds nothing.
#
# It is a CLOCK, not a shard plan. opengrep is pulled UNPINNED from releases/latest
# (.github/workflows/ci.yml:154), and v1.27.0 was published 2026-08-12T14:55:32Z. Main SHA
# 6792091c ran arc-ci twice across that instant -- run 31604575944 at 14:02 GREEN, run
# 31622490938 at 17:24 RED -- identical commit, identical shard file list, identical runner. The
# windows binary in v1.27.0 exits 2, which is semgrep's FATAL code, on every leg. ubuntu and
# macOS stay green on the same version, so it is the windows packaging and not the invocation.
# Both weigh-tests runs cited above ran AFTER 14:55:32Z, so "chronically red, not new" described
# a two-hour-old regression.
#
# The durable fix is to PIN opengrep the way gitleaks directly above it is already pinned. Until
# that lands, this canary is what keeps a broken scanner from reading as a clean codebase.
#
# So probe the TOOL directly, without the adapter's `|| true`, on a canary the arc-min rules are
# known to flag. Tool broken or ruleless -> skip, visibly, naming why. Tool fine but the adapter
# disagrees -> the test FAILS, which is the real bug it exists to catch. The probe runs once per
# bats invocation and caches its answer.
_arc_need_semgrep() {
  local bin
  bin="$(command -v opengrep 2>/dev/null || command -v semgrep 2>/dev/null)" \
    || skip "semgrep/opengrep not installed"

  local marker="${BATS_RUN_TMPDIR:-${TMPDIR:-/tmp}}/arc-semgrep-canary"
  if [ ! -f "$marker" ]; then
    local d rules rc=0
    d="$(mktemp -d)"
    rules="$ARC_SCAN_SRC/rules/arc-min.yaml"
    printf 'function h(req){ return eval(req.query.q); }\n' > "$d/canary.js"
    "$bin" scan --config "$rules" --sarif-output="$d/c.sarif" \
      --disable-version-check --quiet "$d/canary.js" >/dev/null 2>&1 || rc=$?
    if [ "$rc" -eq 0 ] && [ -s "$d/c.sarif" ] \
       && grep -q '"ruleId"' "$d/c.sarif" 2>/dev/null; then
      printf 'ok\n' > "$marker"
    else
      printf 'no rc=%s\n' "$rc" > "$marker"
    fi
    rm -rf "$d"
  fi
  case "$(cat "$marker")" in
    ok) : ;;
    *) skip "$(basename "$bin") cannot flag the arc-min canary on this runner ($(cat "$marker")) -- the scanner is not functional here, so these assertions would measure the runner rather than the adapter" ;;
  esac
}
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

# Emit "<col1>\t<col2>" for each data row of a named board table in a PORTFOLIO.md.
# Tolerant DETECTION (case, bold, heading level), exact-byte VALUES -- the same split the
# resolver uses on the PROGRESS header. Header and separator rows are dropped.
# Usage: _arc_board_rows <file> <lowercase table heading prefix>
_arc_board_rows() {
  awk -v want="$2" '
    /^[[:space:]]*#/ {
      low = tolower($0); gsub(/[*#]/, "", low); gsub(/^[ \t]+|[ \t]+$/, "", low)
      intbl = (index(low, want) == 1) ? 1 : 0
      next
    }
    intbl && /^[[:space:]]*\|/ {
      line = $0; sub(/\r$/, "", line)
      split(line, c, "|")
      a = c[2]; b = c[3]
      gsub(/[*`]/, "", a); gsub(/[*`]/, "", b)
      gsub(/^[ \t]+|[ \t]+$/, "", a); gsub(/^[ \t]+|[ \t]+$/, "", b)
      if (a == "" || a ~ /^-+$/) next
      if (tolower(a) == "lane" || tolower(a) == "venture") next
      print a "\t" b
    }
  ' "$1"
}

# One field out of a lane PROGRESS.md machine header (LAST value wins, header block only).
_arc_lane_header() {
  awk -v key="$2" '
    /^[[:space:]]*##/ { exit }
    {
      line = $0; sub(/\r$/, "", line)
      low = tolower(line); gsub(/\*/, "", low)
      if (index(low, key ":") == 1) {
        p = index(line, ":"); v = substr(line, p + 1)
        gsub(/[*`]/, "", v); gsub(/^[ \t]+|[ \t]+$/, "", v)
        out = v
      }
    }
    END { print out }
  ' "$1"
}

# Run the SessionStart context fragment against the current sandbox.
_arc_session_start() { CLAUDE_PROJECT_DIR="$SANDBOX" bash "$SANDBOX/.claude/hooks/SessionStart.d/00-context.sh"; }

# Write a minimal PORTFOLIO.md v1 into the sandbox. Rows are given as
# "lane|status|cycle|position"; the passports table is fixed, one venture.
_arc_make_board() {
  {
    echo "# PORTFOLIO.md — company board"
    echo ""
    echo "Updated: 2026-07-31"
    echo ""
    echo "## Active initiatives"
    echo ""
    echo "| lane | status | cycle | position | appetite/burn | blocked-on / depends-on | next |"
    echo "|---|---|---|---|---|---|---|"
    for row in "$@"; do
      IFS='|' read -r l s c p <<< "$row"
      echo "| $l | $s | $c | $p | 3d / 0d | — | — |"
    done
    echo ""
    echo "## Venture passports"
    echo ""
    echo "| venture | repository | current status | next |"
    echo "|---|---|---|---|"
    echo "| lexos | private | in build | — |"
  } > "$SANDBOX/PORTFOLIO.md"
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

# ---------- tracker migration harness (Cycle 4 portfolio, Phase 01 / REQ-02) ----------

# Sandbox for the SELF-HOSTING MOVE: a root-mode tracker (PLAN/PROGRESS/phases) plus
# frozen company history, carrying the mover and the resolver it asks for its inventory.
# Layout is mirrored, never flattened -- tracker-migrate.sh resolves the resolver at
# $HERE/../core/, so a flat copy would pass here while the real tree is broken.
# The frozen paths are seeded on purpose: "docs/archive + docs/evidence untouched" is a
# claim no fixture can make against a tree where they do not exist.
_arc_migrate_sandbox() {
  SANDBOX="$(mktemp -d 2>/dev/null || echo "${TMPDIR:-/tmp}/arc-mig.$$.$RANDOM")"
  mkdir -p "$SANDBOX/.claude/scripts/core" "$SANDBOX/.github/scripts" \
           "$SANDBOX/phases" "$SANDBOX/docs/archive" "$SANDBOX/docs/evidence/phase-00"
  cp "$ARC_CORE_SRC/lane-resolve.sh"  "$SANDBOX/.claude/scripts/core/"
  cp "$ARC_CORE_SRC/lane-resolve.mjs" "$SANDBOX/.claude/scripts/core/" 2>/dev/null || true
  cp "$ARC_CORE_SRC/common.sh"        "$SANDBOX/.claude/scripts/core/"
  # The mover is repo-local tooling, not product surface, so it lives beside
  # shard-tests.mjs in .github/scripts/ -- and it reaches the resolver at
  # ../../.claude/scripts/core/. Mirror that, never flatten it: a flat sandbox would
  # pass here while the real tree could not find the resolver at all.
  cp "$ARC_MIGRATE_SRC" "$SANDBOX/.github/scripts/" 2>/dev/null || true
  cd "$SANDBOX" || return 1
  git init -q
  git checkout -qb fixture-main
  # Repo-local identity, not GIT_AUTHOR_* env: the mover shells out to git in its own
  # subprocesses, and a clean CI runner with no global identity fails 128 there even
  # when the bats process has the env set (green local, red CI -- learned the hard way).
  git config user.name  arc-test
  git config user.email test@arc.local
  printf '# PLAN.md fixture\n\n## Goal\n\nfixture goal.\n'          > PLAN.md
  printf '# PROGRESS.md fixture\n\n## Now\n\n**Position:** fixture.\n' > PROGRESS.md
  printf '# Phase 00 fixture\n'                                     > phases/phase-00-spec.md
  printf '# Phase 01 fixture\n'                                     > phases/phase-01-spec.md
  printf 'frozen archive — sole canonical copy\n'                   > docs/archive/old-cycle.md
  printf 'frozen evidence — sole canonical copy\n'                  > docs/evidence/phase-00/proof.txt
  git add -A && git commit -qm "seed root-mode tracker"
}

# The mover inside the current sandbox. The four machine-header values are supplied
# because the mover refuses to invent them -- a header full of placeholders is the
# board's single source of truth lying from birth. They come FIRST so a test can
# override any of them by passing its own; the parser is last-wins.
_arc_migrate() {
  bash "$SANDBOX/.github/scripts/tracker-migrate.sh" --root "$SANDBOX" \
    --cycle "test cycle" --phase "00 — fixture" --appetite 3d --burn 0d "$@"
}

# The mover with NOTHING supplied -- for the arg-validation cases themselves.
_arc_migrate_raw() { bash "$SANDBOX/.github/scripts/tracker-migrate.sh" --root "$SANDBOX" "$@"; }

# Is <path> present in GIT'S RECORD (the index), compared byte-for-byte?
# `git ls-files -- <pathspec>` is NOT this check: pathspec matching consults
# core.ignorecase, so on a case-folding checkout it answers for `initiatives/Design`
# when asked about `initiatives/design` -- the exact fold this phase exists to catch.
# Listing the whole index and comparing bytes asks git, and only git.
_arc_in_index() {
  local want="$1" f
  while IFS= read -r -d '' f; do [ "$f" = "$want" ] && return 0; done < <(git -C "$SANDBOX" ls-files -z)
  return 1
}

# Blob oid of a path in the index -- git's own record of WHAT moved, not where.
_arc_oid() { git -C "$SANDBOX" rev-parse ":$1" 2>/dev/null; }

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

# ---------- WARN message shape (Cycle 4 portfolio, Phase 02 / REQ-03) ----------
#
# Phase 02 adds nine WARN classes. `phases/phase-02-spec.md` section A requires every
# one of them to print a four-line block -- a WARN line, then Expected / Found / Example --
# and to EXIT 0, because a WARN-first lint that exits non-zero is a BLOCK wearing a WARN's
# label. This family is the single assertion all nine fixtures go through, so a WARN that
# forgets a part fails the suite instead of shipping.
#
# WHY the shape is checked mechanically rather than by eyeballing a substring: ADR-0051
# makes the lane's machine header the one source every board value derives from, so a WARN
# that cannot cite WHERE its Expected value came from is unfalsifiable advice. The
# `Expected:` source pointer is that citation, and it is mandatory.
#
# Constants are set with `printf -v` and never `$(printf ...)`: file-scope code runs once
# per test per file, and a command substitution here was measured ~130x more expensive on
# the leg `tests/shard-timings.json` records at 2.82 s/test.
printf -v _ARC_WARN_DASH  '\342\200\224'   # U+2014 EM DASH   -- the WARN-line separator
printf -v _ARC_WARN_ARROW '\342\206\220'   # U+2190 LEFTWARDS -- the derived-from pointer
printf -v _ARC_WARN_CR    '\015'           # CR, for CRLF capture on windows-git-bash
_ARC_WARN_ABSENT='(none)'                  # a genuinely missing artifact, byte-distinct
                                           # from the board's U+2014 empty-cell marker

# The registry: `<class> <loc-kind> <example-target>`, one row per class.
# Data, not code, so every loosening is a visible diff (the tests/portability.bats:42-49
# heredoc idiom -- bash 3.2 has no associative arrays).
#   loc-kind        line = path:digits · file = a bare repo-relative path (whole-file defect)
#   example-target  board-row = a paste-able table row
#                   meta:<Key> = must begin `<Key>: ` (capital-U `Updated` matches the
#                     board's own key; lowercase `status` matches a lane machine header)
#                   free = the correction is a deletion, a move or a command, which is not
#                     mechanically decidable -- the call-site guard makes that class's own
#                     fixture pin the exact Example string instead.
_ARC_WARN_CLASSES() {
  cat <<'EOF'
board-header-drift line board-row
board-row-no-lane line free
lane-no-board-row file board-row
board-bad-status line board-row
board-bad-dependency-line line board-row
board-venture-in-initiatives line free
board-stale-updated line meta:Updated
lane-no-machine-header line meta:status
ownership-cross-lane file free
EOF
}

# Look up <class>. Sets _ARC_W_KIND and _ARC_W_TGT; returns 1 when unregistered.
_arc_warn_lookup() {
  local _want="$1" _c _k _t
  _ARC_W_KIND=""; _ARC_W_TGT=""
  [ -n "${_ARC_W_REG:-}" ] || _ARC_W_REG="$(_ARC_WARN_CLASSES)"
  while read -r _c _k _t; do
    [ "$_c" = "$_want" ] || continue
    _ARC_W_KIND="$_k"; _ARC_W_TGT="$_t"; return 0
  done <<< "$_ARC_W_REG"
  return 1
}

# Is <token> a legal location of <kind>? Explicit character LISTS only, never ranges:
# under some locales `[a-z]` matches `D`, which is how a lane called `Design` once passed
# the bash half of the resolver and failed the .mjs twin (A5, tests/portability.bats:31-40).
_arc_warn_loc_ok() {
  local _t="$1" _kind="$2" _n _p
  [ -n "$_t" ] || return 1
  if [ "$_kind" = "line" ]; then
    case "$_t" in *:*) ;; *) return 1;; esac
    _n="${_t##*:}"; _p="${_t%:*}"
    # empty, non-digit, `0`, or a leading zero (`007`) is not a line number
    case "$_n" in ""|*[!0123456789]*|0*) return 1;; esac
  else
    _p="$_t"
  fi
  # Repo-relative only: an absolute, dot-relative, parent-escaping, home-relative or
  # backslashed path is not a citation anyone can check out and open.
  # The colon test lives HERE, on the PATH half, not in the file-kind branch alone: under
  # loc-kind `line`, `E:/w/PORTFOLIO.md:16` splits into line `16` and a path still carrying
  # the windows drive colon, and a branch-local check let exactly that through (caught by
  # CI on all three legs, 2026-08-01, after the adversarial pass had named the case).
  case "$_p" in
    ""|.|..|/*|./*|../*|*/../*|*/..|~*|*\\*|*:*) return 1;;
  esac
  return 0
}

# Trim leading/trailing spaces and tabs into _ARC_W_TRIM. A global, not $( ), because
# every checker here must be callable as a STATEMENT -- see the banner note on subshells.
_arc_warn_trim() {
  local _s="$1"
  while :; do case "$_s" in " "*|"	"*) _s="${_s#?}";; *) break;; esac; done
  while :; do case "$_s" in *" "|*"	") _s="${_s%?}";; *) break;; esac; done
  _ARC_W_TRIM="$_s"
}

# Record one problem. Appends in the CURRENT shell: a checker called inside $( ) loses its
# accumulated list to the subshell, which silently turned seven confirmed rejections into
# ACCEPTs while this helper was being hardened.
_arc_w_fail() { _ARC_W_PROBS="${_ARC_W_PROBS}  -> $1
"; }

# Check one labelled part at _ARC_W_LINES[<index>].
#   <prefix>  the exact 12-byte label column        <label>  its name in a diagnosis
#   <mode>    src = value + 3 spaces + arrow + source · example = value only, no arrow
# Sets _ARC_W_VALUE to the trimmed value ("" when unusable).
_arc_w_part() {
  local _i="$1" _prefix="$2" _label="$3" _mode="$4"
  local _l _rest _val _src _key _c _has
  _ARC_W_VALUE=""
  if [ "$_i" -ge "${#_ARC_W_LINES[@]}" ]; then
    _arc_w_fail "$_label: line missing -- the four block lines must be contiguous and in order"
    return 1
  fi
  _l="${_ARC_W_LINES[$_i]}"
  case "$_l" in *"$_ARC_WARN_CR"*)
    _arc_w_fail "$_label: carriage return inside the line -- it overwrites the label in a rendered CI log"; return 1;;
  esac
  case "$_l" in *" "|*"	")
    _arc_w_fail "$_label: trailing whitespace";;
  esac
  # ONE equality rejects under-padding, over-padding and an all-whitespace value.
  if [ "${_l:0:12}" != "$_prefix" ]; then
    _arc_w_fail "$_label: label column drift -- want the 12-byte column '$_prefix', found '${_l:0:12}'"
    return 1
  fi
  case "${_l:12:1}" in " "|"	")
    _arc_w_fail "$_label: label column drift -- byte 13 is whitespace; a genuinely absent artifact is spelled $_ARC_WARN_ABSENT, never blank"
    return 1;;
  esac
  _rest="${_l:12}"
  if [ "$_mode" = "src" ]; then
    case "$_rest" in
      *"   $_ARC_WARN_ARROW "*) ;;
      *) _arc_w_fail "$_label: source pointer missing -- ADR-0051 requires the derived-from citation (value + 3 spaces + arrow + path:line)"; return 1;;
    esac
    _val="${_rest%%"   $_ARC_WARN_ARROW "*}"
    _src="${_rest#*"   $_ARC_WARN_ARROW "}"
    # The source token ends at the first comma or the first double space, so the spec's own
    # `PORTFOLIO.md:16, column ...` and `PROGRESS.md:8  \`burn: 1.9d\`` both survive.
    _src="${_src%%,*}"; _src="${_src%%"  "*}"
    _arc_warn_trim "$_src"; _src="$_ARC_W_TRIM"
    if ! _arc_warn_loc_ok "$_src" line; then
      _arc_w_fail "$_label: source not a repo-relative file:line -- found '$_src'"
    fi
  else
    case "$_rest" in *"$_ARC_WARN_ARROW"*)
      _arc_w_fail "$_label: carries a source arrow -- Example is the correction, not a citation"; return 1;;
    esac
    _val="$_rest"
  fi
  _arc_warn_trim "$_val"
  if [ "$_ARC_W_TRIM" != "$_val" ]; then
    _arc_w_fail "$_label: value padded with whitespace"
  fi
  _val="$_ARC_W_TRIM"
  if [ -z "$_val" ]; then
    _arc_w_fail "$_label: value empty -- an absent artifact is spelled $_ARC_WARN_ABSENT"
    return 1
  fi
  if [ "$_mode" = "example" ]; then
    case "$_ARC_W_TGT" in
      board-row)
        case "$_val" in
          "|"*) ;;
          *) _arc_w_fail "Example: not a paste-able board row -- must start with '|'"; return 1;;
        esac
        case "$_val" in
          *"|") ;;
          *) _arc_w_fail "Example: not a paste-able board row -- must end with '|'"; return 1;;
        esac
        _rest="$_val"; _has=0
        while [ -n "$_rest" ]; do
          _c="${_rest%"${_rest#?}"}"
          case "$_c" in "|"|" ") ;; *) _has=1; break;; esac
          _rest="${_rest#?}"
        done
        [ "$_has" = 1 ] || { _arc_w_fail "Example: board row has no non-blank cell"; return 1; }
        ;;
      meta:*)
        _key="${_ARC_W_TGT#meta:}"
        case "$_val" in
          "$_key: "*)
            _arc_warn_trim "${_val#"$_key: "}"
            [ -n "$_ARC_W_TRIM" ] || { _arc_w_fail "Example: '$_key:' carries no value"; return 1; }
            ;;
          *) _arc_w_fail "Example: must begin '$_key: ' for this class -- found '$_val'"; return 1;;
        esac
        ;;
    esac
  fi
  _ARC_W_VALUE="$_val"
  return 0
}

# Check the four-line block whose WARN line is at <index>.
_arc_w_block() {
  local _class="$1" _i="$2" _l _rest _loc _sum _exp _fnd
  _l="${_ARC_W_LINES[$_i]}"
  case "$_l" in *"$_ARC_WARN_CR"*)
    _arc_w_fail "[$_class] line $((_i + 1)) WARN line: carriage return inside the line";;
  esac
  case "$_l" in *" "|*"	")
    _arc_w_fail "[$_class] line $((_i + 1)) WARN line: trailing whitespace";;
  esac
  # QUOTED strip. Unquoted, `[board-header-drift]` is a glob character class, the strip
  # removes nothing, and the spec's own sample is rejected as a bad location.
  _rest="${_l#"WARN [$_class] "}"
  if [ "$_rest" = "$_l" ]; then
    _arc_w_fail "[$_class] line $((_i + 1)) WARN line: want exactly 'WARN [$_class] ' before the location"
    return 1
  fi
  # Parsed FROM the separator, never by first token: an em dash later in the summary can
  # never satisfy the rule, and a tracked path containing a space survives intact.
  case "$_rest" in
    *" $_ARC_WARN_DASH "*)
      _loc="${_rest%%" $_ARC_WARN_DASH "*}"
      _sum="${_rest#*" $_ARC_WARN_DASH "}"
      ;;
    *)
      _arc_w_fail "[$_class] line $((_i + 1)) WARN line: em dash separator missing -- want '<location> $_ARC_WARN_DASH <summary>'"
      return 1
      ;;
  esac
  if ! _arc_warn_loc_ok "$_loc" "$_ARC_W_KIND"; then
    _arc_w_fail "[$_class] line $((_i + 1)) WARN line: location is not a repo-relative $_ARC_W_KIND -- found '$_loc'"
  fi
  _arc_warn_trim "$_sum"
  [ -n "$_ARC_W_TRIM" ] || _arc_w_fail "[$_class] line $((_i + 1)) WARN line: summary empty"

  _arc_w_part "$((_i + 1))" "  Expected: " "[$_class] line $((_i + 2)) Expected" src; _exp="$_ARC_W_VALUE"
  _arc_w_part "$((_i + 2))" "  Found:    " "[$_class] line $((_i + 3)) Found"    src; _fnd="$_ARC_W_VALUE"
  _arc_w_part "$((_i + 3))" "  Example:  " "[$_class] line $((_i + 4)) Example"  example

  # A WARN that reports a difference must show two different values. Kills the all-TODO
  # placeholder block, which satisfies every other rule.
  if [ -n "$_exp" ] && [ "$_exp" = "$_fnd" ]; then
    _arc_w_fail "[$_class] line $((_i + 1)) block: Expected and Found values are identical ('$_exp') -- a WARN that reports a difference must show two"
  fi
}

# THE ASSERTION.  _arc_warn_shape <class> <exit-status> <text> [<expected-count>]
#
# Call it DIRECTLY. Its return code IS the assertion, so `run _arc_warn_shape ...`,
# `if _arc_warn_shape ...`, and `_arc_warn_shape ... || true` all silently disarm it --
# tests/warn-shape.bats has a ratchet that forbids exactly those at every other call site.
# Reads no globals: everything it judges arrives as an argument, which is what lets the
# self-test file drive it under `run` with literals.
_arc_warn_shape() {
  local _class _status _text _want _l _n _seen _i _name
  if [ "$#" -lt 3 ] || [ "$#" -gt 4 ]; then
    printf 'WARN-SHAPE FAILURE: bad helper call -- want <class> <exit-status> <text> [<count>], got %s argument(s)\n' "$#" >&2
    return 66
  fi
  _class="$1"; _status="$2"; _text="$3"; _want="${4:-1}"
  _ARC_W_PROBS=""
  case "$_want" in ""|*[!0123456789]*|0)
    printf 'WARN-SHAPE FAILURE: bad helper call -- expected-count must be a positive integer, got %s\n' "$_want" >&2
    return 66;;
  esac
  if ! _arc_warn_lookup "$_class"; then
    _arc_w_fail "class not registered: '$_class' -- add a row to _ARC_WARN_CLASSES or fix the fixture"
  fi
  case "$_status" in
    0) ;;
    *) _arc_w_fail "exit status not 0 -- a WARN-first lint never exits non-zero (found $_status)";;
  esac

  _ARC_W_LINES=()
  if [ -n "$_text" ]; then
    while IFS= read -r _l; do
      _ARC_W_LINES+=("${_l%"$_ARC_WARN_CR"}")
    done <<< "$_text"
  fi

  # WHOLE-OUTPUT sweep: a sibling class's malformed WARN in the same output fails this
  # assertion too. A fixture blind to everything but its own class is a fixture that
  # lets the other eight ship broken.
  _seen=0; _i=0
  while [ "$_i" -lt "${#_ARC_W_LINES[@]}" ]; do
    _l="${_ARC_W_LINES[$_i]}"
    case "$_l" in
      "WARN ["*)
        _name="${_l#WARN [}"; _name="${_name%%]*}"
        if [ "$_name" = "$_class" ]; then
          _seen=$((_seen + 1))
          _arc_w_block "$_class" "$_i"
        elif _arc_warn_lookup "$_name"; then
          _arc_w_block "$_name" "$_i"
          _arc_warn_lookup "$_class" || :
        else
          _arc_w_fail "line $((_i + 1)): unregistered class emitted: [$_name]"
        fi
        ;;
      "WARN "*|"WARN	"*)
        _arc_w_fail "line $((_i + 1)): header-form drift -- found a bare 'WARN ' line (the two-space kickoff-lint.mjs:497 form); this phase's shape is 'WARN [<class>] '"
        ;;
    esac
    _i=$((_i + 1))
  done

  if [ "$_seen" -ne "$_want" ]; then
    if [ "$_seen" = 0 ]; then
      _arc_w_fail "WARN line missing -- no 'WARN [$_class] ' line at column 1"
    else
      _arc_w_fail "occurrence count: found $_seen 'WARN [$_class]' block(s), want $_want"
    fi
  fi

  [ -n "$_ARC_W_PROBS" ] || return 0

  {
    printf 'WARN-SHAPE FAILURE for class [%s]\n' "$_class"
    printf '%s' "$_ARC_W_PROBS"
    printf -- '--- captured exit status: %s\n' "$_status"
    if [ "${#_ARC_W_LINES[@]}" -eq 0 ]; then
      printf '(captured output was empty)\n'
    else
      printf -- '--- captured output (CR-stripped, %s line(s)):\n' "${#_ARC_W_LINES[@]}"
      _n=0
      while [ "$_n" -lt "${#_ARC_W_LINES[@]}" ]; do
        printf '%s\n' "${_ARC_W_LINES[$_n]}"
        _n=$((_n + 1))
      done
    fi
  } >&2
  return 66
}

# Run a lint and PIN its streams. Class fixtures pass "$ARC_LINT_STATUS" "$ARC_LINT_OUTPUT"
# to _arc_warn_shape and nothing else: that forbids `bash -c '... || true'` laundering the
# exit code, and forbids asserting a hand-written fixture file against itself.
# Call directly, never under `run` and never via `bash -c`.
_arc_run_lint() {
  local _script="$1"; shift
  local _errf="${BATS_TEST_TMPDIR:-${TMPDIR:-/tmp}}/arc-lint-stderr.$$"
  ARC_LINT_OUTPUT="$(bash "$_script" "$@" 2>"$_errf")"
  ARC_LINT_STATUS=$?
  ARC_LINT_STDERR="$(cat "$_errf" 2>/dev/null || :)"
  rm -f "$_errf" 2>/dev/null || :
  return 0
}

# ---------------------------------------------------------------------------------------------
# arc_leave_the_repo -- run the rest of this test from a directory with NO repository above it.
#
# WHY IT EXISTS. `arc pnl` and `arc brief` resolve `ventures.yaml` from the REPOSITORY
# (kill-panel.mjs venturesPath -> spine-io.mjs repoRoot), never from the spine. That is deliberate:
# an earlier version derived it from the spine root and returned nothing whenever ARC_SPINE_ROOT was
# set, which silently deleted the kill panel AND the UNRECEIPTED refusal in every configuration a
# test runs in (ledger Phase 01, adversarial finding 1).
#
# The consequence for TESTS is that a suite invoking either binary from inside this checkout reads
# THIS repo's ventures.yaml, which is unreceipted against any scratch spine -- so `arc pnl` exits 3
# with an empty stdout and `arc brief` grows a NOT EVALUATED line in needs-you. Suites that assert
# byte-exact output are asserting the CONSUMER configuration: no criteria file at all, which is the
# state every install outside this repo is in.
#
# ONE COPY, HERE. Four suites need this, and four copies of a rule is the twin-fix shape this lane
# has already paid for twice.
#
# The precondition is ASSERTED and deliberately STRICTER than repoRoot's own rule (which wants
# `.claude` AND `.git`): a bare clone under TMPDIR would carry no `.claude` yet, would not be a repo
# by that rule, and would still invalidate the caller. If this ever fires, the fix is to run bats
# from outside any checkout -- never to delete the check.
arc_leave_the_repo() {
  cd "$BATS_TEST_TMPDIR" || { echo "could not cd to BATS_TEST_TMPDIR"; return 1; }
  local d="$PWD"
  while [ -n "$d" ]; do
    if [ -e "$d/.git" ]; then
      echo "cwd $PWD has a git repository above it at $d --"
      echo "these tests would read that repository's ventures.yaml instead of running as a consumer."
      return 1
    fi
    case "$d" in
      */*) d="${d%/*}" ;;
      *)   d="" ;;
    esac
  done
  [ -e "/.git" ] && { echo "a git repository at / would be read as this repo"; return 1; }
  return 0
}
