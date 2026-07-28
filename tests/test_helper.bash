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
  cp "$ARC_CORE_SRC/review-ledger.sh"             "$SANDBOX/.claude/scripts/core/"
  cp "$ARC_CORE_SRC/arc-profile.sh"               "$SANDBOX/.claude/scripts/core/"
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
