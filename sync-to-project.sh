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

# Excluded from the .claude sync: personal settings + per-project working state +
# the scheduled-tasks runtime lock (never belongs in a consumer repo -- REQ-04).
EXCLUDES=("settings.local.json" "state" "scheduled_tasks.lock")

mkdir -p "$TARGET/.claude" "$TARGET/docs/templates" "$TARGET/docs"

# ARC_SYNC_NO_RSYNC=1 forces the portable cp fallback even where rsync exists --
# lets CI prove REQ-02 (byte-identical output) holds on BOTH copy paths.
if command -v rsync >/dev/null 2>&1 && [ -z "${ARC_SYNC_NO_RSYNC:-}" ]; then
  rsync -a --exclude 'settings.local.json' --exclude 'state/' --exclude 'scheduled_tasks.lock' "$SRC/.claude/" "$TARGET/.claude/"
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

# arc-council docs + sessions skeleton (the .claude council core already rode along above).
# The target's own verdicts -- docs/council/sessions/** -- are never touched (v1 phase-04 contract).
mkdir -p "$TARGET/docs/council/references" "$TARGET/docs/council/sessions/.juror"
[ -f "$SRC/docs/council/README.md" ] && cp "$SRC/docs/council/README.md" "$TARGET/docs/council/README.md"
[ -f "$SRC/docs/council/references/fairness.md" ] && cp "$SRC/docs/council/references/fairness.md" "$TARGET/docs/council/references/fairness.md"

# Council juror env contract: append the JUROR_* block to the target's .env.example ONCE
# (line-start declaration = present; real keys stay in the target's own .env.local, never synced).
if [ -f "$SRC/.env.example" ] && ! grep -q '^JUROR_BASE_URL=' "$TARGET/.env.example" 2>/dev/null; then
  jb_start=$(grep -nm1 -iE '^#.*juror|^JUROR_' "$SRC/.env.example" | cut -d: -f1)
  jb_end=$(grep -nE '^JUROR2?_[A-Z_]*=' "$SRC/.env.example" | tail -1 | cut -d: -f1)
  if [ -n "$jb_start" ] && [ -n "$jb_end" ] && [ "$jb_start" -le "$jb_end" ]; then
    { [ -s "$TARGET/.env.example" ] && echo ""; sed -n "${jb_start},${jb_end}p" "$SRC/.env.example"; } >> "$TARGET/.env.example"
    echo "sync: council -- JUROR_* block appended to .env.example (keys go in the target's .env.local)."
  fi
fi

echo "sync: template -> $TARGET"
echo "sync: untouched -- CLAUDE.md, CLAUDE.local.md, settings.local.json, PLAN/PROGRESS/phases, adr, reviews, session-log, .claude/state, app code, docs/council/sessions."
echo "sync: IMPORTANT -- restart the Claude Code session in that project (commands load at session start)."
