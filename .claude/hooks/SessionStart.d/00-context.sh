#!/usr/bin/env bash
# core -- git position + build-tracker + review readiness (SessionStart).
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

# arc review readiness on the current commit (review-ledger is core -- present in any install).
LEDGER="${CLAUDE_PROJECT_DIR:-.}/.claude/scripts/review-ledger.sh"
[ -f "$LEDGER" ] && echo "- $(bash "$LEDGER" status 2>/dev/null)"
exit 0
