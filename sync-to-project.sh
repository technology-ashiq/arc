#!/usr/bin/env bash
# sync-to-project.sh -- push this template's machinery into an existing project.
# Cross-platform bash twin of sync-to-project.ps1 (Git Bash + Linux). The .ps1 is
# kept for Windows-native use; this is now the primary, CI-testable path.
#
# Usage:   bash sync-to-project.sh <target-project-dir>
#
# Syncs:   .claude/ (agents, commands, hooks, rules, output-styles, skills,
#          settings.json, statusline), docs/templates/, and the meta docs
#          (blueprint, how-it-works, build-playbook, product-runbook, plugins,
#          usermanual).
# Never touches:  CLAUDE.md, CLAUDE.local.md, settings.local.json, PLAN.md,
#          PROGRESS.md, phases/, docs/adr/, docs/reviews/, docs/session-log.md,
#          your app code -- and NOT .claude/state/ (per-project working state).
set -euo pipefail

TARGET="${1:?usage: sync-to-project.sh <target-project-dir>}"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

[ -d "$TARGET" ] || { echo "sync: target folder not found: $TARGET" >&2; exit 1; }
[ -d "$TARGET/.git" ] || echo "sync: note -- target has no .git, is this really a project root?" >&2

# Excluded from the .claude sync: personal settings + per-project working state.
EXCLUDES=("settings.local.json" "state")

mkdir -p "$TARGET/.claude" "$TARGET/docs/templates" "$TARGET/docs"

if command -v rsync >/dev/null 2>&1; then
  rsync -a --exclude 'settings.local.json' --exclude 'state/' "$SRC/.claude/" "$TARGET/.claude/"
  rsync -a "$SRC/docs/templates/" "$TARGET/docs/templates/"
else
  # Portable cp fallback (Git Bash has no rsync): copy all, then drop excludes.
  cp -r "$SRC/.claude/." "$TARGET/.claude/"
  for x in "${EXCLUDES[@]}"; do rm -rf "$TARGET/.claude/${x:?}" 2>/dev/null || true; done
  [ -d "$SRC/docs/templates" ] && cp -r "$SRC/docs/templates/." "$TARGET/docs/templates/"
fi

# Meta docs describe the system, not your product -- safe to overwrite.
for f in blueprint.md how-it-works.md build-playbook.md product-runbook.md plugins.md usermanual.md; do
  [ -f "$SRC/docs/$f" ] && cp "$SRC/docs/$f" "$TARGET/docs/$f"
done

echo "sync: template -> $TARGET"
echo "sync: untouched -- CLAUDE.md, CLAUDE.local.md, settings.local.json, PLAN/PROGRESS/phases, adr, reviews, session-log, .claude/state, app code."
echo "sync: IMPORTANT -- restart the Claude Code session in that project (commands load at session start)."
