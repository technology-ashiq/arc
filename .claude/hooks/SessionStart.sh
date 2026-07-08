#!/usr/bin/env bash
# === SessionStart hook ===  Load project context + toolchain health check on startup.
# Fires at the start of EVERY session. stdout is injected into Claude's context.
# Kept intentionally LIGHT: git + build-tracker context here; the toolchain check is delegated
# to .claude/scripts/toolchain-health.sh (full detail + one-command fixes via /arc-toolcheck).
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Heads-up: not a git repo yet. Run 'git init' for branch/commit context."
  exit 0
fi
BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "unknown")
LAST=$(git log -1 --pretty=format:'%h %s (%cr)' 2>/dev/null || echo "no commits yet")
DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
echo "Quick heads-up for this session:"
echo "- Branch: ${BRANCH}"
echo "- Last commit: ${LAST}"
[ "${DIRTY}" -gt 0 ] && echo "- ${DIRTY} uncommitted change(s) in your working tree." || echo "- Working tree is clean."

# Build-tracker position (docs/build-playbook.md, 3-layer tracking).
if [ -f PROGRESS.md ]; then
  echo "- Build status (PROGRESS.md -> ## Now):"
  awk '/^## Now/{f=1;next} /^## /{f=0} f' PROGRESS.md | head -n 6 | sed 's/^/    /'
fi

# --- arc review readiness: which reviews have run on the current commit (moat) ---
LEDGER="${CLAUDE_PROJECT_DIR:-.}/.claude/scripts/review-ledger.sh"
[ -f "$LEDGER" ] && echo "- $(bash "$LEDGER" status 2>/dev/null)"

# --- Toolchain health: brief line, delegated to the shared script (keeps this hook fast) ---
# One place checks every tool (graphify, codegraph, claude-mem, scanners, MCPs, env). Full
# report + one-command fixes: /arc-toolcheck. Add future tools in the script, not here.
HEALTH="${CLAUDE_PROJECT_DIR:-.}/.claude/scripts/toolchain-health.sh"
if [ -f "$HEALTH" ]; then
  bash "$HEALTH" --brief 2>/dev/null || echo "- Toolchain: run /arc-toolcheck to verify tools"
else
  echo "- Toolchain: checker missing -> re-sync the template, then run /arc-toolcheck"
fi
