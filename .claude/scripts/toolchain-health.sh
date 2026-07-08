#!/usr/bin/env bash
# === Toolchain health check ===  Single source of truth for "is my toolchain ready?"
#
#   Full report (Markdown table + copy-paste fixes) on demand:  /arc-toolcheck
#   Run it directly:                                            bash .claude/scripts/toolchain-health.sh
#   The SessionStart hook calls it brief (one line):            bash .claude/scripts/toolchain-health.sh --brief
#
# Full output = a Markdown table (Tool | Status | Action needed | Details) + a "Quick fix" block
# (paste to install the missing ones) + a "You do these" list (steps only a human can do).
# Status: ready / needs action / stale / optional (shown with colour dots).
#
# >>> ADD A FUTURE TOOL IN ONE LINE <<<  Add a row (R_OK / R_MISS / R_ENV / R_OPT / R_STALE)
# under the right sec "..." block in emit_all(). Installable actions auto-flow into the Quick-fix
# block; env/manual actions flow into "You do these". Self-reports in the hook + /arc-toolcheck too.
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || true
MODE="${1:-full}"
BT='`'   # backtick, for wrapping commands as Markdown code

case "$(uname -s 2>/dev/null)" in
  MINGW*|MSYS*|CYGWIN*) OS=win ;;
  Darwin) OS=mac ;;
  *) OS=linux ;;
esac

FIXES=$(mktemp 2>/dev/null || echo /tmp/tc_fix.$$)
FIXES_OPT=$(mktemp 2>/dev/null || echo /tmp/tc_opt.$$)
MANUAL=$(mktemp 2>/dev/null || echo /tmp/tc_man.$$)
: > "$FIXES"; : > "$FIXES_OPT"; : > "$MANUAL"

have(){ command -v "$1" >/dev/null 2>&1; }
ver(){ "$1" --version 2>/dev/null | head -n1 | tr -d '\r' | cut -c1-22; }
env_has(){ [ -f .env.local ] && grep -Eq "^[[:space:]]*$1=.+" .env.local; }

fix_add(){
  case "$1" in *"<"*) return ;; esac
  case "$1" in
    pipx\ *|scoop\ *|brew\ *|npm\ *|npx\ *|cp\ *|uv\ *|"claude mcp"*)
      if [ "${2:-req}" = opt ]; then printf '%s\n' "$1" >> "$FIXES_OPT"; else printf '%s\n' "$1" >> "$FIXES"; fi ;;
  esac
}
man_add(){ printf -- '- %s\n' "$1" >> "$MANUAL"; }

row(){ printf '| %s | %s | %s | %s |\n' "$1" "$2" "$3" "$4"; }
sec(){ printf '| **%s** | | | |\n' "$1"; }
R_OK(){    row "$1" "🟢 Ready"     "—"              "${2:-}"; }
R_MISS(){  fix_add "$2" req; row "$1" "🔴 Missing"   "${BT}${2}${BT}" "${3:-}"; }
R_STALE(){ fix_add "$2" req; row "$1" "🟡 Stale"     "${BT}${2}${BT}" "${3:-}"; }
R_OPT(){   fix_add "$2" opt; row "$1" "⚪ Optional"  "${BT}${2}${BT}" "${3:-}"; }
R_ENV(){   man_add "$1 — $2 ${3:-}"; row "$1" "🔴 Needs env" "$2" "${3:-}"; }
R_NG(){    man_add "$1 — run ${BT}$2${BT} ${3:+($3)}"; row "$1" "🔴 No graph" "${BT}${2}${BT}" "${3:-}"; }

emit_all(){
  sec "CORE"
  if have git;  then R_OK "git"  "$(ver git)";  elif [ "$OS" = win ]; then R_MISS "git"  "scoop install git"        "version control"; else R_MISS "git"  "brew install git"  "version control"; fi
  if have node; then R_OK "node" "$(ver node)"; elif [ "$OS" = win ]; then R_MISS "node" "scoop install nodejs-lts" "runtime + npx";    else R_MISS "node" "brew install node" "runtime + npx"; fi
  if have npm;  then R_OK "npm"  "$(ver npm)";  else R_MISS "npm" "scoop install nodejs-lts" "ships with Node"; fi

  sec "CODE REVIEW"
  if have semgrep;    then R_OK "semgrep"  "$(ver semgrep) · SAST"
  elif have opengrep; then R_OK "opengrep" "$(ver opengrep) · SAST"
  else R_MISS "semgrep / opengrep" "pipx install semgrep" "SAST scan · or opengrep fork"; fi
  if have gitleaks;    then R_OK "gitleaks"    "$(ver gitleaks) · secrets"; elif [ "$OS" = win ]; then R_MISS "gitleaks"    "scoop install gitleaks"    "secret scan"; else R_MISS "gitleaks"    "brew install gitleaks"    "secret scan"; fi
  if have osv-scanner; then R_OK "osv-scanner" "$(ver osv-scanner) · CVEs"; elif [ "$OS" = win ]; then R_MISS "osv-scanner" "scoop install osv-scanner" "dependency CVEs"; else R_MISS "osv-scanner" "brew install osv-scanner" "dependency CVEs"; fi
  if [ -f package.json ] && grep -q '"knip"' package.json 2>/dev/null; then R_OK "knip" "devDep · dead code"; else R_OPT "knip" "npm i -D knip" "dead-code detection"; fi

  sec "QA"
  if [ -f package.json ] && grep -q '@axe-core/playwright' package.json 2>/dev/null; then R_OK "axe-core" "devDep · WCAG"; else R_OPT "axe-core" "npm i -D @axe-core/playwright" "WCAG 2.1 AA scans"; fi
  if have npx; then R_OK "playwright / lighthouse" "via npx on demand"; else R_MISS "npx" "scoop install nodejs-lts" "runs playwright/lighthouse"; fi

  sec "MEMORY & KNOWLEDGE GRAPH"
  if grep -qs 'claude-mem' "$HOME/.claude/settings.json" 2>/dev/null || ls "$HOME/.claude/plugins" 2>/dev/null | grep -qi 'claude-mem'; then
    R_OK "claude-mem" "hooks active · auto-capture"
  elif have claude-mem; then R_MISS "claude-mem" "claude-mem install" "binary found, hooks off"
  else R_MISS "claude-mem" "npx claude-mem install" "session recall"; fi

  if ! have graphify; then
    if [ "$OS" = win ]; then R_MISS "graphify" "pipx install graphifyy" "then graphify install --platform windows"
    else R_MISS "graphify" "pipx install graphifyy" "then graphify install"; fi
  elif [ ! -f graphify-out/graph.json ]; then
    R_NG "graphify" "/graphify ." "then graphify hook install"
  else
    if [ -f .git/hooks/post-commit ] && grep -qi graphify .git/hooks/post-commit 2>/dev/null; then GH="auto-rebuild hook OK"; else GH="run graphify hook install"; fi
    LC=$(git log -1 --format=%ct 2>/dev/null || echo 0); GT=$(stat -c %Y graphify-out/graph.json 2>/dev/null || echo 0)
    if [ "$LC" -gt "$GT" ]; then R_STALE "graphify" "graphify update ." "$GH"; else R_OK "graphify" "ready · $GH"; fi
  fi

  if [ -n "${CODEGRAPH_CMD:-}" ]; then
    if have "$CODEGRAPH_CMD"; then R_OK "codegraph" "CLI configured"; else R_ENV "codegraph" "fix ${BT}CODEGRAPH_CMD${BT} in settings.local.json" "CLI not found"; fi
  elif grep -qs '"codegraph"' .mcp.json 2>/dev/null || grep -qs 'codegraph' "$HOME/.claude.json" 2>/dev/null; then
    R_OK "codegraph" "MCP registered · verify /mcp"
  else
    R_OPT "codegraph" "claude mcp add codegraph -- <cmd>" "callers/impact graph"
  fi

  sec "MCP SERVERS"
  if [ -f .mcp.json ]; then
    if grep -qs '"supabase"' .mcp.json; then if env_has SUPABASE_ACCESS_TOKEN && env_has SUPABASE_PROJECT_REF; then R_OK "supabase MCP" "env set"; else R_ENV "supabase MCP" "set ${BT}SUPABASE_ACCESS_TOKEN${BT} + ${BT}SUPABASE_PROJECT_REF${BT}" "in .env.local"; fi; fi
    if grep -qs '"stripe"'   .mcp.json; then if env_has STRIPE_SECRET_KEY; then R_OK "stripe MCP" "env set"; else R_ENV "stripe MCP" "set ${BT}STRIPE_SECRET_KEY${BT}" "in .env.local"; fi; fi
    grep -qs '"playwright"'  .mcp.json && R_OK "playwright MCP" "no key needed"
    grep -qs '"context7"'    .mcp.json && R_OK "context7 MCP" "no key needed"
  fi

  sec "ENV CONTRACT"
  if [ ! -f .env.example ]; then :
  elif [ ! -f .env.local ]; then R_ENV ".env.local" "${BT}cp .env.example .env.local${BT}" "then fill values"
  else
    MISS=""
    while IFS= read -r line; do
      case "$line" in ''|\#*) continue ;; esac
      k="${line%%=*}"; k="$(printf '%s' "$k" | tr -d '[:space:]')"
      [ -z "$k" ] && continue
      env_has "$k" || MISS="$MISS $k"
    done < .env.example
    if [ -n "$MISS" ]; then R_ENV ".env.local" "fill:$MISS" "missing keys"; else R_OK ".env.local" "all keys present"; fi
  fi
}

BODY="$(emit_all)"
READY=$(printf '%s\n' "$BODY" | grep -c '🟢')
ACTN=$(printf '%s\n'  "$BODY" | grep -cE '🔴|🟡')
OPTN=$(printf '%s\n'  "$BODY" | grep -c '⚪')

if [ "$MODE" = "--brief" ] || [ "$MODE" = "brief" ]; then
  if [ "$ACTN" -gt 0 ]; then
    printf -- '- Toolchain: %s ready, %s need action, %s optional -> run /arc-toolcheck\n' "$READY" "$ACTN" "$OPTN"
  else
    printf -- '- Toolchain: %s ready, all armed (%s optional)\n' "$READY" "$OPTN"
  fi
  rm -f "$FIXES" "$FIXES_OPT" "$MANUAL"; exit 0
fi

REPO=$(basename "$(pwd)")
echo "## Toolchain health — ${REPO}  ·  $(date '+%Y-%m-%d %H:%M')"
echo ""
echo "**${READY} ready · ${ACTN} need action · ${OPTN} optional**"
echo ""
echo "| Tool | Status | Action needed | Details |"
echo "|------|--------|---------------|---------|"
printf '%s\n' "$BODY"
echo ""
echo "> 🟢 ready · 🔴 needs action · 🟡 stale · ⚪ optional"

if [ -s "$FIXES" ]; then
  echo ""
  echo "### ⚡ Quick fix — paste to install what's missing"
  echo '```bash'
  sort -u "$FIXES"
  echo '```'
fi
if [ -s "$MANUAL" ]; then
  echo ""
  echo "### 🙋 You do these (Claude can't run them for you)"
  sort -u "$MANUAL"
fi
if [ -s "$FIXES_OPT" ]; then
  echo ""
  echo "### ➕ Optional extras"
  echo '```bash'
  sort -u "$FIXES_OPT"
  echo '```'
fi
echo ""
echo "_Tip: tell Claude \"fix the toolchain\" and it runs the Quick-fix block for you (with your OK)._"
rm -f "$FIXES" "$FIXES_OPT" "$MANUAL"
