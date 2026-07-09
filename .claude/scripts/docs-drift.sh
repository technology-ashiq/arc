#!/usr/bin/env bash
# docs-drift.sh -- arc- enforcement moat
# Detects when a change touched PUBLIC SURFACE (API routes, exported entrypoints,
# deps, CLI, env contract) but left docs untouched. The enforced counterpart to
# gstack's advisory /document-release: stale docs become a ship condition.
#
# Reads .claude/settings.json -> arc.docsGate (block | warn, default warn)
# Compares against merge-base with the default branch (main), falling back to
# staged changes if no upstream.
#
# Exit: 0 no drift/allow | 1 drift in warn mode | 2 BLOCK (drift in block mode)
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"; cd "$ROOT" || exit 0
SETTINGS="$ROOT/.claude/settings.json"

# Mode resolves through the active strictness profile (block-by-default). An
# explicit .arc.docsGate in settings still overrides -- see arc-profile.sh.
MODE="$(bash "$ROOT/.claude/scripts/arc-profile.sh" mode docs 2>/dev/null || echo block)"

# Determine the changed-file set
BASE=""
for b in origin/main main origin/master master; do
  if git rev-parse --verify "$b" >/dev/null 2>&1; then BASE="$(git merge-base HEAD "$b" 2>/dev/null || true)"; [ -n "$BASE" ] && break; fi
done
if [ -n "$BASE" ]; then
  CHANGED="$(git diff --name-only "$BASE"...HEAD; git diff --name-only)"
else
  CHANGED="$(git diff --name-only --cached; git diff --name-only)"
fi
CHANGED="$(printf '%s\n' "$CHANGED" | sort -u | sed '/^$/d')"
[ -z "$CHANGED" ] && { echo "docs-drift: no changes"; exit 0; }

# Surface globs (extended regex) and doc globs
SURFACE_RE='^(app/api/|pages/api/|src/api/|.*\.(cli|command)\.|package\.json$|.*/index\.(ts|tsx|js)$|.*/public-api|supabase/migrations/|\.env\.example$)'
DOC_RE='(^README|(^|/)docs/|ARCHITECTURE|CHANGELOG|CLAUDE\.md$|\.claude/rules/)'

surface_hits="$(printf '%s\n' "$CHANGED" | grep -Ei "$SURFACE_RE" || true)"
doc_hits="$(printf '%s\n' "$CHANGED" | grep -Ei "$DOC_RE" || true)"

if [ -n "$surface_hits" ] && [ -z "$doc_hits" ]; then
  echo "docs-drift: public surface changed but no docs updated:" >&2
  printf '  %s\n' $surface_hits >&2
  echo "  -> run /arc-docs to sync README/ARCHITECTURE/CLAUDE.md, or set arc.docsGate=warn" >&2
  [ "$MODE" = "block" ] && exit 2 || exit 1
fi

echo "docs-drift: ok (surface changes have matching doc updates, or none)"
exit 0
