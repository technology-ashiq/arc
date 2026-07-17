#!/usr/bin/env bash
# core -- deploy guard (PreToolUse/Bash): tests + arc gates must pass before any deploy.
# exit 2 = block. Degrades loudly (SKIP + allow) when the gate engine/config isn't
# installed -- a partial install has no arc.gates.yaml (REQ-06).
set -uo pipefail
. "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/_dispatch.sh"
PAYLOAD=$(cat)
CMD=$(arc_hook_field command "$PAYLOAD")
[ -z "$CMD" ] && CMD="$PAYLOAD"

echo "$CMD" | grep -Eq '(^|[;&|] *)(vercel( [^;&|]*)?(--prod|--prebuilt|deploy)|(npm|pnpm|yarn)( run)? deploy)' || exit 0

echo "PreToolUse/deploy-guard: deploy detected -> running tests..." >&2
cd "${CLAUDE_PROJECT_DIR:-.}"
if npm run test --silent >/tmp/predeploy.log 2>&1; then
  echo "deploy-guard: tests passed." >&2
  GATES="${CLAUDE_PROJECT_DIR:-.}/.claude/scripts/arc-gates.sh"
  if [ ! -f "$GATES" ] || [ ! -f "${CLAUDE_PROJECT_DIR:-.}/arc.gates.yaml" ]; then
    echo "deploy-guard: SKIP arc-gates -- gate engine/config not installed (partial install). Allowed." >&2
    exit 0
  fi
  if bash "$GATES" --tier hook >&2; then
    echo "deploy-guard: all hook-tier gates passed. Allowed." >&2; exit 0
  else
    echo "BLOCKED by arc-gates: a block-mode gate failed (see above). Fix or adjust arc.gates.yaml / profile." >&2
    exit 2
  fi
else
  echo "BLOCKED: tests are failing, not deploying. Fix them first. Last 20 lines:" >&2
  tail -n 20 /tmp/predeploy.log >&2; exit 2
fi
