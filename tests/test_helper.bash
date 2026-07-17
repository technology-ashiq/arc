#!/usr/bin/env bash
# Shared helpers for the arc-scan bats suite.

# Real repo paths (tests/ lives at repo root).
ARC_ROOT="$(cd "$BATS_TEST_DIRNAME/.." && pwd)"
ARC_SCAN_SRC="$ARC_ROOT/.claude/scripts/arc-scan"

# Source the pipeline libraries for unit-level tests (no git needed).
_arc_load_libs() {
  # shellcheck disable=SC1090
  . "$ARC_SCAN_SRC/lib/common.sh"
  . "$ARC_SCAN_SRC/lib/sarif.sh"
  . "$ARC_SCAN_SRC/lib/triage.sh"
}

# Build a throwaway git repo carrying a copy of .claude/scripts, so stamp/e2e
# tests never touch the real review ledger. Sets SANDBOX and cd's into it.
_arc_sandbox() {
  SANDBOX="$(mktemp -d 2>/dev/null || echo "${TMPDIR:-/tmp}/arc-bats.$$.$RANDOM")"
  mkdir -p "$SANDBOX/.claude/scripts"
  cp -r "$ARC_SCAN_SRC" "$SANDBOX/.claude/scripts/"
  cp "$ARC_ROOT/.claude/scripts/review-ledger.sh" "$SANDBOX/.claude/scripts/"
  cp "$ARC_ROOT/.claude/scripts/arc-profile.sh"   "$SANDBOX/.claude/scripts/"   # arc-scan resolves scan mode through it
  cd "$SANDBOX" || return 1
  git init -q
  git config user.email test@arc.local
  git config user.name arc-test
  echo "seed" > seed.txt
  git add -A && git commit -qm seed
}

_arc_teardown() { [ -n "${SANDBOX:-}" ] && rm -rf "$SANDBOX" 2>/dev/null || true; }

# Path to arc-scan in the current sandbox.
_arc_scan() { echo "$SANDBOX/.claude/scripts/arc-scan/arc-scan.sh"; }
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
