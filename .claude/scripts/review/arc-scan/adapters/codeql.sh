#!/usr/bin/env bash
# adapters/codeql.sh -- deep SAST via CodeQL. OPTIONAL + CI-tier only.
# Same adapter contract as semgrep.sh, with two gates in front:
#   1. CI-tier only (ADR-0006): CodeQL's DB build takes minutes -- far past the
#      <30s hook budget. Runs only when ARC_TIER=ci or a CI environment is
#      detected; SKIPPED in the hook tier.
#   2. Optional (ADR-0004): semgrep is the always-available SAST spine; CodeQL
#      is a bonus. A missing codeql is a SKIP, never a failure.
# When it does run: detect the language in scope, build a DB over the source
# root (CodeQL needs the whole codebase), analyze with the security suite, emit
# CodeQL's native SARIF. Findings via SARIF, never a non-zero exit.
#
# v1 languages: javascript/typescript, python, ruby (extract without a build
# command). Compiled languages (java/go/c#/c++) need a build command -- a
# documented boundary for a later slice.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../../core/common.sh
. "$HERE/../../../core/common.sh"
. "$HERE/../lib/runtime.sh"
# Respect an inherited ROOT (CI/tests); default to the repo toplevel.
ROOT="${ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

scope="${1:?usage: codeql.sh <scope-file> <out-sarif>}"
out="${2:?usage: codeql.sh <scope-file> <out-sarif>}"

_empty_sarif() { printf '{"version":"2.1.0","runs":[]}\n' > "$out"; }
_ci_tier() { [ "${ARC_TIER:-}" = "ci" ] || [ -n "${CI:-}" ]; }

# --- gate 1: CI-tier only ----------------------------------------------------
if ! _ci_tier; then
  arc_skip "codeql (CI-tier only -- ADR-0006 heavy verifier; set ARC_TIER=ci)"
  _empty_sarif; exit 0
fi

# --- gate 2: optional (semgrep is the spine, ADR-0004) -----------------------
bin="$(arc_codeql_bin)"
if [ -z "$bin" ]; then
  arc_skip "codeql (optional deep SAST; not installed -- semgrep is the spine, ADR-0004)"
  _empty_sarif; exit 0
fi

# --- detect language from scope (js/ts -> python -> ruby priority) -----------
lang=""; has_py=0; has_rb=0
if [ -s "$scope" ]; then
  while IFS= read -r f; do
    case "$f" in
      *.js|*.jsx|*.ts|*.tsx|*.mjs|*.cjs|*.vue) lang=javascript; break;;
      *.py) has_py=1;;
      *.rb) has_rb=1;;
    esac
  done < "$scope"
fi
[ -z "$lang" ] && [ "$has_py" = 1 ] && lang=python
[ -z "$lang" ] && [ "$has_rb" = 1 ] && lang=ruby
if [ -z "$lang" ]; then
  arc_log "codeql: no supported language in scope (v1: js/ts, python, ruby)"
  _empty_sarif; exit 0
fi

# --- build DB over the source root, then analyze -----------------------------
db="$(mktemp -d 2>/dev/null || echo "${TMPDIR:-/tmp}/arc-codeql.$$")/db"
if ! "$bin" database create "$db" --language="$lang" --source-root="$ROOT" --overwrite --quiet >/dev/null 2>&1; then
  arc_skip "codeql (database create failed for $lang -- e.g. compiled lang needs a build command)"
  _empty_sarif; exit 0
fi

# security-and-quality suite; CodeQL writes SARIF natively to --output.
"$bin" database analyze "$db" "${lang}-security-and-quality.qls" \
  --format=sarif-latest --output="$out" --quiet >/dev/null 2>&1 || true

[ -s "$out" ] || _empty_sarif
arc_log "codeql: analyzed $lang via $bin"
exit 0
