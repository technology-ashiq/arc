#!/usr/bin/env bash
# tracker-migrate.sh -- move a ROOT-MODE tracker into initiatives/<lane>/.
# Cycle 4 (arc-portfolio) Phase 01, REQ-02 / ADR-0050+0051. A ONE-OFF: arc self-hosts
# once. It is deliberately not a reusable migration tool -- a venture repo has nothing
# to migrate (root-mode is a permanent consumer contract, ADR-0054, not a shim on the
# way to lanes), and a general mover is a rabbit hole this phase's spec already named.
#
# WHY IT LIVES IN .github/scripts/ AND NOT .claude/scripts/plan/: everything under
# .claude/ is the SYNCED surface, and product-lint refuses any file there that no
# product manifest maps -- correctly, because an unmapped file either ships to every
# consumer by accident or is dead weight nobody owns. This script is arc's own
# repo-local tooling, exactly like shard-tests.mjs beside it. Putting it in
# products/plan to satisfy the lint would ship a self-migration tool to every venture
# repo that can never use it; adding an exemption to the lint would weaken a gate to
# fit one file. Neither is worth it -- the file simply is not part of the product.
#
# Usage:
#   tracker-migrate.sh --lane NAME --cycle TEXT --phase TEXT --appetite Nd --burn Nd
#                      [--status LIVE|BLOCKED|QUEUED|IDLE] [--blocked-on T] [--depends-on T]
#                      [--root DIR] [--dry-run]
# Exit: 0 done/planned · 2 precondition refused · 5 invalid lane name · 6 case-fold collision
#
# TWO RULES, both learned the hard way, both fixtured in tests/portfolio-board.bats:
#
# 1. A CASE-ONLY COLLISION IS REFUSED ON EVERY OS. Assumption A5 fired on 2026-07-31
#    for locale collation and left its ORIGINAL subject -- `git mv` casing -- untested,
#    which is the half this move rests on. On a case-folding filesystem (Windows,
#    default macOS) `mkdir initiatives/design` succeeds when `initiatives/Design`
#    exists and lands INSIDE it. The tracker would then live somewhere the resolver
#    cannot see -- lane membership is decided by exact comparison against readdir, and
#    `Design` fails the grammar -- and the mover would report success. So a target that
#    folds onto an existing entry with different bytes stops here. Refusing is the only
#    outcome that is identical on all three legs; "succeed on Linux, refuse on Windows"
#    is precisely the one-OS surprise this rule exists to prevent.
#
# 2. WHAT MOVED IS READ OUT OF GIT, NOT OFF THE PATH WE ASKED FOR. After `git mv` the
#    index is listed and compared byte-for-byte, and each blob oid is matched against
#    the one captured before the move. `git ls-files -- <pathspec>` is NOT this check:
#    pathspec matching consults core.ignorecase and will answer for `Design` when asked
#    about `design`. Comparing the path we intended against the path we intended proves
#    nothing at all.
set -uo pipefail

# Byte semantics, not the operator's collation -- same rationale as lane-resolve.sh:
# a bracket RANGE is ordered by the locale's collation table, and under macOS's
# default locale that table interleaves case. Every comparison below is on bytes.
export LC_ALL=C LANG=C

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESOLVER="$HERE/../../.claude/scripts/core/lane-resolve.sh"

LANE=""; LANE_GIVEN=0; LANE_DUP=0; ROOT=""; DRY=0
CYCLE=""; PHASE=""; APPETITE=""; BURN=""
STATUS="LIVE"; BLOCKED_ON="—"; DEPENDS_ON="—"

_need_val() { [ "$1" -ge 2 ] || { echo "tracker-migrate: $2 needs a value" >&2; exit 2; }; }

while [ $# -gt 0 ]; do
  case "$1" in
    # Last-wins is the WRONG rule here (.claude/rules/lanes.md): silently picking one
    # of two named lanes is the "never guess" failure, and this surface moves a whole
    # tracker. The resolver enforces it, but only ever sees the value we forward, so
    # the duplicate has to be caught before it is collapsed.
    --lane)       _need_val $# --lane
                  [ "$LANE_GIVEN" -eq 1 ] && [ "$2" != "$LANE" ] && LANE_DUP=1
                  LANE_GIVEN=1; LANE="$2";  shift 2;;
    --root)       _need_val $# --root;       ROOT="$2";        shift 2;;
    --cycle)      _need_val $# --cycle;      CYCLE="$2";       shift 2;;
    --phase)      _need_val $# --phase;      PHASE="$2";       shift 2;;
    --appetite)   _need_val $# --appetite;   APPETITE="$2";    shift 2;;
    --burn)       _need_val $# --burn;       BURN="$2";        shift 2;;
    --status)     _need_val $# --status;     STATUS="$2";      shift 2;;
    --blocked-on) _need_val $# --blocked-on; BLOCKED_ON="$2";  shift 2;;
    --depends-on) _need_val $# --depends-on; DEPENDS_ON="$2";  shift 2;;
    --dry-run)    DRY=1; shift;;
    *) echo "tracker-migrate: unknown argument '$1'" >&2; exit 2;;
  esac
done

[ -n "$ROOT" ] || ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
[ -n "$LANE" ] || { echo "tracker-migrate: --lane is required" >&2; exit 2; }

_stop() { echo "STOP: $1" >&2; }

if [ "$LANE_DUP" -eq 1 ]; then
  _stop "--lane given more than once with different values."
  echo "  Name exactly one lane; a second --lane is an operator error, not an override." >&2
  exit 5
fi

# EVERY precondition below asks git. If git cannot answer, they do not "pass" — they
# were never run, and a check that cannot fail is the Phase-00 lesson repeating: the
# dirty-tree probe writes its error to stderr and an EMPTY stdout, which reads exactly
# like a clean tree. So the repo is established first, once, loudly.
if ! git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  _stop "'$ROOT' is not inside a git work tree."
  echo "  This move is verified against git's index; without a repo nothing here can be checked." >&2
  exit 2
fi

# Git's record of what exists, byte-for-byte, read once. Membership is decided against
# THIS, never against the filesystem: `[ -e phases ]` is true on a case-folding
# checkout whose index actually says `Phases/`, so a filesystem probe answers
# differently on ubuntu than on macOS and windows — the exact one-OS surprise A5 named.
INDEX=()
while IFS= read -r -d '' _f; do INDEX+=("$_f"); done < <(git -C "$ROOT" ls-files -z)
_index_has() { local w="$1" f; for f in ${INDEX[@]+"${INDEX[@]}"}; do [ "$f" = "$w" ] && return 0; done; return 1; }

# ---------- 1. name grammar: the resolver owns it, and only the resolver ----------
# Re-implementing the grammar here would be a second source of truth for "what is a
# lane name", and the two would drift on exactly the character the next bug needs.
res="$(bash "$RESOLVER" --root "$ROOT" --lane "$LANE" --for kickoff 2>/dev/null)"; rcode=$?
rstatus="$(printf '%s\n' "$res" | sed -n 's/^status=//p')"
if [ "$rcode" -eq 5 ] || [ "$rstatus" = "invalid" ]; then
  bash "$RESOLVER" --root "$ROOT" --lane "$LANE" --for kickoff --print human >&2
  exit 5
fi

# ---------- 2. the A5 guard: does the target fold onto an entry already there? ----------
# Read the directory the way the resolver reads it -- one readdir, exact bytes, arrays
# never word-split strings. The resolver's own `lanes=`/`skipped=` fields are joined by
# spaces, so a directory name containing a space would split into fragments and could
# fold by accident; asking the filesystem directly avoids inventing that failure.
_lower() { printf '%s' "${1-}" | LC_ALL=C tr 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' 'abcdefghijklmnopqrstuvwxyz'; }
if [ -d "$ROOT/initiatives" ]; then
  for d in "$ROOT/initiatives"/*; do
    [ -d "$d" ] || continue
    b="${d##*/}"
    case "$b" in .*) continue;; esac
    if [ "$(_lower "$b")" = "$(_lower "$LANE")" ] && [ "$b" != "$LANE" ]; then
      _stop "'initiatives/$b' already exists and differs from '$LANE' only in case."
      {
        echo "  On a case-folding filesystem (Windows, default macOS) creating"
        echo "  'initiatives/$LANE' would land inside 'initiatives/$b' and report success,"
        echo "  leaving the tracker where the lane resolver cannot see it."
        echo "  Fix: rename 'initiatives/$b' deliberately (a two-step git mv through a"
        echo "  temporary name), commit that, then run this again."
      } >&2
      exit 6
    fi
  done
fi

# ---------- 3. is there anything to migrate, and is it safe to touch? ----------
if [ "$rstatus" = "ok" ]; then
  _stop "lane '$LANE' already exists — this tracker looks migrated already."
  echo "  A second run is not a repair. Inspect 'initiatives/$LANE/' first." >&2
  exit 2
fi

if [ -n "$(git -C "$ROOT" status --porcelain 2>/dev/null)" ]; then
  _stop "the working tree has uncommitted changes."
  echo "  The move must land as ONE reviewable commit. Commit or stash first." >&2
  exit 2
fi

MISSING=""
_index_has "PLAN.md"     || MISSING="$MISSING PLAN.md"
_index_has "PROGRESS.md" || MISSING="$MISSING PROGRESS.md"
PHASE_FILES=()
for _f in ${INDEX[@]+"${INDEX[@]}"}; do
  case "$_f" in phases/*) PHASE_FILES+=("$_f");; esac
done
[ "${#PHASE_FILES[@]}" -gt 0 ] || MISSING="$MISSING phases/"
if [ -n "$MISSING" ]; then
  _stop "no root tracker in git's index to move — missing:$MISSING"
  echo "  (Checked against 'git ls-files', not the filesystem: a case-folding checkout" >&2
  echo "   reports 'phases' present when the index actually says 'Phases/'.)" >&2
  exit 2
fi

_require() { [ -n "$2" ] || { _stop "$1 is required — the machine header carries no invented values."; exit 2; }; }
_require --cycle    "$CYCLE"
_require --phase    "$PHASE"
_require --appetite "$APPETITE"
_require --burn     "$BURN"
case "$STATUS" in
  LIVE|BLOCKED|QUEUED|IDLE) ;;
  *) _stop "--status must be one of LIVE BLOCKED QUEUED IDLE (got '$STATUS')."; exit 2;;
esac

DEST="initiatives/$LANE"

# ---------- 4. the plan ----------
# Built once from git's record and used for both the dry run and the real run, so the
# transcript the operator approved is the transcript that executes. Two parallel
# ARRAYS, not one delimiter-joined string: a path may contain the delimiter, and
# splitting it back apart is a bug waiting for the first odd filename.
SRC=("PLAN.md" "PROGRESS.md"); DST=("$DEST/PLAN.md" "$DEST/PROGRESS.md")
while IFS= read -r f; do
  [ -n "$f" ] && { SRC+=("$f"); DST+=("$DEST/$f"); }
done < <(printf '%s\n' "${PHASE_FILES[@]}" | LC_ALL=C sort)

_print_plan() {
  echo "  move (git mv, history preserved):"
  for i in "${!SRC[@]}"; do echo "    ${SRC[$i]} -> ${DST[$i]}"; done
  echo "  amend: $DEST/PROGRESS.md gains the ADR-0051 machine header (status/cycle/phase/appetite/burn/blocked-on/depends-on)"
  echo "  stub:  PLAN.md · PROGRESS.md · phases/README.md — pointers at the old root paths"
  echo "  untouched: docs/archive/** · docs/evidence/** (frozen, ADR-0058) · everything outside the tracker"
}

if [ "$DRY" -eq 1 ]; then
  echo "DRY RUN — tracker '$ROOT' -> $DEST (nothing is written)"
  _print_plan
  exit 0
fi

# ---------- 5. execute ----------
# oids captured BEFORE the move: they are what "the same content arrived" is checked
# against afterwards. Captured from the index, which is git's record, not the disk.
OIDS=()
for i in "${!SRC[@]}"; do
  OIDS+=("$(git -C "$ROOT" rev-parse ":${SRC[$i]}" 2>/dev/null)")
done

mkdir -p "$ROOT/$DEST" || { _stop "could not create '$DEST'."; exit 2; }
git -C "$ROOT" mv PLAN.md     "$DEST/PLAN.md"     || { _stop "git mv PLAN.md failed"; exit 2; }
git -C "$ROOT" mv PROGRESS.md "$DEST/PROGRESS.md" || { _stop "git mv PROGRESS.md failed"; exit 2; }
git -C "$ROOT" mv phases      "$DEST/phases"      || { _stop "git mv phases failed"; exit 2; }

# ---------- 6. verify against git's record ----------
# The index is re-listed from scratch — the pre-move snapshot would only tell us what
# we already believed. Compared byte-for-byte: a `git ls-files -- <path>` probe would
# consult core.ignorecase and cheerfully confirm a path that folded.
AFTER=()
while IFS= read -r -d '' _f; do AFTER+=("$_f"); done < <(git -C "$ROOT" ls-files -z)
_after_has() { local w="$1" f; for f in ${AFTER[@]+"${AFTER[@]}"}; do [ "$f" = "$w" ] && return 0; done; return 1; }

FAILED=0
for i in "${!SRC[@]}"; do
  src="${SRC[$i]}"; dst="${DST[$i]}"; want_oid="${OIDS[$i]}"
  if ! _after_has "$dst"; then
    _stop "git's index has no '$dst' after the move — the rename did not land where it was asked to."
    FAILED=1; continue
  fi
  if _after_has "$src"; then
    _stop "git's index still carries '$src' after the move."
    FAILED=1; continue
  fi
  got_oid="$(git -C "$ROOT" rev-parse ":$dst" 2>/dev/null)"
  if [ "$got_oid" != "$want_oid" ]; then
    _stop "'$dst' holds blob $got_oid but '$src' was $want_oid — content changed during a pure move."
    FAILED=1
  fi
done
[ "$FAILED" -eq 0 ] || { echo "  Nothing has been committed. Inspect 'git status' and reset." >&2; exit 2; }

# ---------- 7. machine header (ADR-0051), written at birth, in this same commit ----------
PROG="$ROOT/$DEST/PROGRESS.md"
if ! head -n 20 "$PROG" | grep -q '^status: '; then
  tmp="$PROG.arc-tmp"
  {
    head -n 1 "$PROG"
    echo ""
    echo "status: $STATUS"
    echo "cycle: $CYCLE"
    echo "phase: $PHASE"
    echo "appetite: $APPETITE"
    echo "burn: $BURN"
    echo "blocked-on: $BLOCKED_ON"
    echo "depends-on: $DEPENDS_ON"
    tail -n +2 "$PROG"
  } > "$tmp" && mv "$tmp" "$PROG"
fi

# ---------- 8. pointer stubs at the old root paths ----------
# A stub must not read as a tracker: no `## Now` for the SessionStart hook to scrape,
# no phase table for a human to trust. It says where the real thing went, and stops.
cat > "$ROOT/PLAN.md" <<EOF
# PLAN.md — moved

This repo runs in lane-mode. The live plan is **[$DEST/PLAN.md]($DEST/PLAN.md)**.

Lanes live under \`initiatives/\`; \`PORTFOLIO.md\` is the company index view.
See \`.claude/rules/lanes.md\` for how a command picks its lane.
EOF
cat > "$ROOT/PROGRESS.md" <<EOF
# PROGRESS.md — moved

This repo runs in lane-mode. The live tracker is **[$DEST/PROGRESS.md]($DEST/PROGRESS.md)**.

Lanes live under \`initiatives/\`; \`PORTFOLIO.md\` is the company index view.
See \`.claude/rules/lanes.md\` for how a command picks its lane.
EOF
mkdir -p "$ROOT/phases"
cat > "$ROOT/phases/README.md" <<EOF
# phases/ — moved

Phase specs for this repo's live lane are at **[$DEST/phases/]($DEST/phases/)**.
EOF
git -C "$ROOT" add -- PLAN.md PROGRESS.md phases/README.md "$DEST/PROGRESS.md"

# ---------- 9. report (from git, not from intent) ----------
echo "Migrated tracker -> $DEST (verified against git index)"
for i in "${!SRC[@]}"; do echo "  moved:  ${SRC[$i]} -> ${DST[$i]}"; done
echo "  amended: $DEST/PROGRESS.md (machine header, status: $STATUS)"
echo "  stubbed: PLAN.md · PROGRESS.md · phases/README.md"
echo "  staged, NOT committed — review 'git status' and commit as one change."
exit 0
