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

# ---------- which tracker is this session about? (ADR-0054) ----------
# The BASH twin on purpose: a SessionStart hook must still work on a box with no node
# on PATH, and the heads-up is core UX. Root-mode returns mode=root and every branch
# below collapses to the pre-portfolio behaviour, byte for byte -- that is the
# permanent consumer contract root-golden.bats pins, not an implementation detail.
LMODE="root"; LLANE=""; LVIA=""; LTRACK="."; LELIG=""; LLANES=""; LCOUNT=0
if [ -f .claude/scripts/core/lane-resolve.sh ]; then
  _lout="$(bash .claude/scripts/core/lane-resolve.sh --root "$PWD" --for session-start 2>/dev/null)"
  if [ -n "$_lout" ]; then
    LMODE="$(printf  '%s\n' "$_lout" | sed -n 's/^mode=//p')"
    LLANE="$(printf  '%s\n' "$_lout" | sed -n 's/^lane=//p')"
    LVIA="$(printf   '%s\n' "$_lout" | sed -n 's/^via=//p')"
    LTRACK="$(printf '%s\n' "$_lout" | sed -n 's/^tracker=//p')"
    LELIG="$(printf  '%s\n' "$_lout" | sed -n 's/^eligible=//p')"
    LLANES="$(printf '%s\n' "$_lout" | sed -n 's/^lanes=//p')"
    LCOUNT="$(printf '%s\n' "$_lout" | sed -n 's/^counted=//p')"
  fi
fi
[ -n "$LMODE" ]  || LMODE="root"
[ -n "$LCOUNT" ] || LCOUNT=0

echo "Quick heads-up for this session:"
# Canonical output order (ADR-0054): the lane echo comes FIRST, because working in
# the wrong lane is the risk worth interrupting for. A passive hook cannot ask a
# question, so when the answer is not unique it selects NOTHING and says so.
if [ "$LMODE" = "lane" ] && [ -n "$LLANE" ]; then
  echo "- Selected lane: ${LLANE} (via ${LVIA})"
elif [ "$LMODE" != "root" ]; then
  if [ "$LCOUNT" -gt 1 ]; then
    echo "- Lane: NOT selected — ${LCOUNT} lanes are eligible: $(printf '%s' "$LELIG" | sed 's/ /, /g')"
  else
    echo "- Lane: NOT selected — no lane is eligible (LIVE or BLOCKED). Known: $(printf '%s' "$LLANES" | sed 's/ /, /g')"
  fi
  echo "    run /arc-resume --lane <name>"
fi

echo "- Branch: ${BRANCH}"
echo "- Last commit: ${LAST}"
[ "${DIRTY}" -gt 0 ] && echo "- ${DIRTY} uncommitted change(s) in your working tree." || echo "- Working tree is clean."

# Company context, second in the canonical order. A tolerant read of ONE table: the
# strict board grammar and its lint are Phase 02's, and a second parser here would be
# a second answer to "is this board valid". Ventures live in their own table and are
# skipped -- a passport is not a lane, and the boundary stays clean (ADR-0051).
if [ "$LMODE" != "root" ] && [ -f PORTFOLIO.md ]; then
  _upd=$(sed -n 's/^[[:space:]]*\(Updated:[[:space:]]*[0-9-]*\).*/\1/p' PORTFOLIO.md | head -n1)
  _rows=$(awk '
    /^[[:space:]]*##/ {
      low = tolower($0); gsub(/[*#]/, "", low); gsub(/^[ \t]+|[ \t]+$/, "", low)
      intbl = (low ~ /^active initiatives/) ? 1 : 0
      next
    }
    intbl && /^[[:space:]]*\|/ {
      line = $0; sub(/\r$/, "", line)
      split(line, c, "|")
      lane = c[2]; st = c[3]
      gsub(/[*`]/, "", lane); gsub(/[*`]/, "", st)
      gsub(/^[ \t]+|[ \t]+$/, "", lane); gsub(/^[ \t]+|[ \t]+$/, "", st)
      if (lane == "" || tolower(lane) == "lane" || lane ~ /^-+$/) next
      out = out (out == "" ? "" : " · ") lane " " st
    }
    END { if (out != "") print out }
  ' PORTFOLIO.md)
  [ -n "$_rows" ] && echo "- Board (${_upd:-Updated: ?}): ${_rows}"
fi

# Build-tracker position (docs/build-playbook.md, 3-layer tracking). Read from the
# SELECTED tracker: after the Phase-01 move the root PROGRESS.md is a pointer stub
# with no `## Now`, so a hook still reading the root path prints an empty position
# and looks like it worked. When nothing is selected, nothing is reported -- a
# position from a lane the operator did not choose is worse than no position.
if [ "$LMODE" = "root" ]; then
  _prog="PROGRESS.md"
elif [ -n "$LLANE" ]; then
  _prog="${LTRACK}/PROGRESS.md"
else
  _prog=""
fi
if [ -n "$_prog" ] && [ -f "$_prog" ]; then
  echo "- Build status (${_prog} -> ## Now):"
  awk '/^## Now/{f=1;next} /^## /{f=0} f' "$_prog" | head -n 6 | sed 's/^/    /'
fi

# arc review readiness on the current commit (review-ledger is core -- present in any install).
LEDGER="${CLAUDE_PROJECT_DIR:-.}/.claude/scripts/core/review-ledger.sh"
[ -f "$LEDGER" ] && echo "- $(bash "$LEDGER" status 2>/dev/null)"
exit 0
