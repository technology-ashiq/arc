#!/usr/bin/env bash
# === PreToolUse hook (matcher: Bash) ===  Two deterministic guards.
# Fires BEFORE any Bash command.  exit 0 = allow | exit 2 = block (stderr -> Claude).
#   Guard 1: DESTRUCTIVE GUARD — hard-blocks irreversible commands (permission deny rules are
#            prefix-matched and bypassable via chaining; this inspects the WHOLE command line).
#   Guard 2: DEPLOY GUARD — if it's a deploy, run tests first and block on failure.
set -uo pipefail
PAYLOAD=$(cat)
PY=$(command -v python3 || command -v python)  # Windows Git Bash often has "python" only
if [ -n "${PY:-}" ]; then
  CMD=$(printf '%s' "$PAYLOAD" | "$PY" -c 'import sys,json;print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' 2>/dev/null || echo "")
elif command -v jq >/dev/null 2>&1; then
  CMD=$(printf '%s' "$PAYLOAD" | jq -r '.tool_input.command // ""')
else
  CMD="$PAYLOAD"
fi

# --- Guard 1: destructive commands — block outright, even mid-chain (&&, ;, |) ---
if echo "$CMD" | grep -Eq 'rm -rf? +(/|~|\$HOME|\.\.)|git push[^;&|]*( --force[^ ]*| -f)( |$)|git clean -[a-z]*f|drop +(table|database) |supabase db reset --linked'; then
  echo "BLOCKED by destructive-guard: this command is irreversible. If it is truly intended, the human must run it themselves." >&2
  exit 2
fi

# --- Guard 2: deploy guard — tests must pass before any deploy ---
if echo "$CMD" | grep -Eq '(^|[;&|] *)(vercel( [^;&|]*)?(--prod|--prebuilt|deploy)|(npm|pnpm|yarn)( run)? deploy)'; then
  echo "PreToolUse/deploy-guard: deploy detected -> running tests..." >&2
  cd "${CLAUDE_PROJECT_DIR:-.}"
  if npm run test --silent >/tmp/predeploy.log 2>&1; then
    echo "deploy-guard: tests passed." >&2
    # --- arc deploy gates (advisory by default; enable via .claude/settings.json arc.* + ARC_REQUIRED_REVIEWS) ---
    GD="${CLAUDE_PROJECT_DIR:-.}/.claude/scripts"
    bash "$GD/coverage-gate.sh" >&2;                                    [ "$?" -eq 2 ] && exit 2
    bash "$GD/review-ledger.sh" require "${ARC_REQUIRED_REVIEWS:-}" >&2; [ "$?" -eq 2 ] && exit 2
    bash "$GD/docs-drift.sh" >&2;                                       [ "$?" -eq 2 ] && exit 2
    echo "deploy-guard: all gates passed. Allowed." >&2; exit 0
  else
    echo "BLOCKED: tests are failing, not deploying. Fix them first. Last 20 lines:" >&2
    tail -n 20 /tmp/predeploy.log >&2; exit 2
  fi
fi
exit 0
