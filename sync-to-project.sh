#!/usr/bin/env bash
# sync-to-project.sh -- push this template's machinery into an existing project.
# Cross-platform bash twin of sync-to-project.ps1 (Git Bash + Linux). The .ps1 is
# kept for Windows-native use; this is the primary, CI-testable path.
#
# Usage:
#   bash sync-to-project.sh <target-project-dir>              # full suite (default)
#   bash sync-to-project.sh <target-project-dir> --products council,plan
#   bash sync-to-project.sh --list                            # list products, exit
#
# Full suite syncs:   .claude/ (agents, commands, hooks, rules, output-styles,
#   skills, settings.json, statusline), docs/templates/, and the meta docs. It is
#   byte-identical to the pre-initiative behaviour (REQ-02, golden-gated).
# Selective (--products) drives the resolver (arc-products.mjs): only the named
#   products + core are installed, via its COPY/MKDIR/ENVBLOCK line protocol.
# Never touches:  CLAUDE.md, CLAUDE.local.md, settings.local.json, PLAN.md,
#   PROGRESS.md, phases/, docs/adr/, docs/reviews/, docs/session-log.md, your app
#   code -- and NOT .claude/state/, .claude/worktrees/ (transient git worktrees), nor
#   .claude/scheduled_tasks.lock (all working state, never belongs in a consumer repo).
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESOLVER="$SRC/.claude/scripts/core/arc-products.mjs"

# ---------- args: <target> [--products a,b | --list] ----------
TARGET=""; MODE="full"; PRODUCTS=""
while [ $# -gt 0 ]; do
  case "$1" in
    --list)         MODE="list" ;;
    --products)     MODE="products"; PRODUCTS="${2:?sync: --products needs a value}"; shift ;;
    --products=*)   MODE="products"; PRODUCTS="${1#*=}" ;;
    -*)             echo "sync: unknown option: $1" >&2; exit 2 ;;
    *)              if [ -z "$TARGET" ]; then TARGET="$1"; else echo "sync: unexpected argument: $1" >&2; exit 2; fi ;;
  esac
  shift
done

# ---------- --list: names only, no target required ----------
if [ "$MODE" = "list" ]; then
  exec node "$RESOLVER" --list --root "$SRC"
fi

: "${TARGET:?usage: sync-to-project.sh <target-project-dir> [--products a,b | --list]}"
[ -d "$TARGET" ] || { echo "sync: target folder not found: $TARGET" >&2; exit 1; }
[ -d "$TARGET/.git" ] || echo "sync: note -- target has no .git, is this really a project root?" >&2

# Council JUROR env contract: append the JUROR_* block from a source .env.example to
# the target's ONCE (sentinel present = already there). Shared by both install paths;
# council is the only product with an envBlock in v1 (the range regexes are JUROR-specific).
_arc_env_block() {  # <src-env-file> <sentinel-regex>
  local srcenv="$1" sentinel="$2" tgtenv="$TARGET/.env.example"
  [ -f "$srcenv" ] || return 0
  grep -q "$sentinel" "$tgtenv" 2>/dev/null && return 0
  local jb_start jb_end
  jb_start=$(grep -nm1 -iE '^#.*juror|^JUROR_' "$srcenv" | cut -d: -f1)
  jb_end=$(grep -nE '^JUROR2?_[A-Z_]*=' "$srcenv" | tail -1 | cut -d: -f1)
  if [ -n "$jb_start" ] && [ -n "$jb_end" ] && [ "$jb_start" -le "$jb_end" ]; then
    { [ -s "$tgtenv" ] && echo ""; sed -n "${jb_start},${jb_end}p" "$srcenv"; } >> "$tgtenv"
    echo "sync: council -- JUROR_* block appended to .env.example (keys go in the target's .env.local)."
  fi
}

# ---------- --products: manifest-driven selective install ----------
if [ "$MODE" = "products" ]; then
  PLAN="$(node "$RESOLVER" --products "$PRODUCTS" --root "$SRC")" || exit 2
  [ "$(printf '%s\n' "$PLAN" | head -1)" = "$(printf 'PROTO\t1')" ] \
    || { echo "sync: unexpected resolver plan protocol" >&2; exit 3; }
  printf '%s\n' "$PLAN" | while IFS=$'\t' read -r verb a b; do
    case "$verb" in
      PROTO)    : ;;
      MKDIR)    mkdir -p "$TARGET/$a" ;;
      COPY)     mkdir -p "$TARGET/$(dirname "$b")"; cp "$SRC/$a" "$TARGET/$b" ;;
      ENVBLOCK) _arc_env_block "$SRC/$a" "$b" ;;
      *)        echo "sync: unknown resolver plan verb: $verb" >&2; exit 3 ;;
    esac
  done
  # arc-registry.json: the target's installed-products ground truth (REQ-08). The
  # resolver (the single JSON parser) produces it. Capture-then-write (mirrors the ps1
  # twin) so a generation failure never truncates the file to 0 bytes mid-install.
  _reg="$(node "$RESOLVER" --registry --products "$PRODUCTS" --root "$SRC")" \
    || { echo "sync: registry generation failed" >&2; exit 3; }
  mkdir -p "$TARGET/.claude"
  printf '%s\n' "$_reg" > "$TARGET/.claude/arc-registry.json"
  echo "sync: products [$PRODUCTS] + core -> $TARGET"
  echo "sync: IMPORTANT -- restart the Claude Code session in that project (commands load at session start)."
  exit 0
fi

# ---------- full (default): byte-identical to pre-initiative (REQ-02) ----------
# Excluded from the .claude sync: personal settings + per-project working state +
# the scheduled-tasks runtime lock (never belongs in a consumer repo -- REQ-04).
EXCLUDES=("settings.local.json" "state" "scheduled_tasks.lock" "worktrees")

mkdir -p "$TARGET/.claude" "$TARGET/docs/templates" "$TARGET/docs"

# ARC_SYNC_NO_RSYNC=1 forces the portable cp fallback even where rsync exists --
# lets CI prove REQ-02 (byte-identical output) holds on BOTH copy paths.
if command -v rsync >/dev/null 2>&1 && [ -z "${ARC_SYNC_NO_RSYNC:-}" ]; then
  rsync -a --exclude 'settings.local.json' --exclude 'state/' --exclude 'scheduled_tasks.lock' --exclude 'worktrees/' "$SRC/.claude/" "$TARGET/.claude/"
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

_arc_env_block "$SRC/.env.example" "^JUROR_BASE_URL="

# arc-registry.json: bare install = every product; same ground-truth file (REQ-08).
# Excluded from the REQ-02 golden manifest (carries a per-install-volatile source.commit).
# Capture-then-write (mirrors ps1): a generation failure never leaves a 0-byte registry.
_reg="$(node "$RESOLVER" --registry --root "$SRC")" \
  || { echo "sync: registry generation failed" >&2; exit 3; }
printf '%s\n' "$_reg" > "$TARGET/.claude/arc-registry.json"

echo "sync: template -> $TARGET"
echo "sync: untouched -- CLAUDE.md, CLAUDE.local.md, settings.local.json, PLAN/PROGRESS/phases, adr, reviews, session-log, .claude/state, app code, docs/council/sessions."
echo "sync: IMPORTANT -- restart the Claude Code session in that project (commands load at session start)."
