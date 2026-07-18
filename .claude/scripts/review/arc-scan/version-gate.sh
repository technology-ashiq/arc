#!/usr/bin/env bash
# version-gate.sh -- CI guard (ADR-0007). Fails the build unless:
#   * VERSION exists and is valid semver (X.Y.Z with optional -pre/+build)
#   * CHANGELOG.md exists and references that version OR carries an [Unreleased]
#     section (so an in-flight version is allowed pre-tag).
# Cross-platform: pure grep/sed, no jq/python needed.
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
V="$ROOT/VERSION"; CL="$ROOT/CHANGELOG.md"
fail() { printf 'version-gate: FAIL: %s\n' "$*" >&2; exit 1; }

[ -f "$V" ]  || fail "VERSION file missing"
[ -f "$CL" ] || fail "CHANGELOG.md missing"

ver="$(tr -d '[:space:]' < "$V")"
[ -n "$ver" ] || fail "VERSION is empty"
echo "$ver" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)*$' \
  || fail "VERSION '$ver' is not valid semver"

if grep -qF "$ver" "$CL"; then
  echo "version-gate: OK -- VERSION $ver referenced in CHANGELOG.md"
elif grep -qiE '^\#\#[[:space:]]*\[?Unreleased' "$CL"; then
  echo "version-gate: OK -- VERSION $ver (in-flight; [Unreleased] section present)"
else
  fail "VERSION '$ver' not found in CHANGELOG.md and no [Unreleased] section"
fi
