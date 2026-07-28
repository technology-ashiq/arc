#!/usr/bin/env bash
# design-render.sh -- the ONE deterministic render command (frozen plan 2.5).
#
# Every critique and, from Phase 2, every variant screenshot comes from here. If two
# screenshots are produced by two different commands then comparing them is not a comparison,
# and a critic judging an unknown viewport is judging nothing in particular.
#
# Writes:  .claude/state/design/renders/<slug>.png
#          .claude/state/design/renders/<slug>.json   (hash + viewport + url + recipe)
#
#   design-render.sh <route> [--viewport WxH]
#
# Exit: 0 rendered | 1 refused (blank/near-empty page, stale duplicate, transport missing)
#
# bash-3.2 / POSIX-safe: no arrays, no GNU-only flags.
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
. "$ROOT/.claude/scripts/core/common.sh" 2>/dev/null || true

ROUTE="${1:-}"
VIEWPORT="1440x900"
shift 2>/dev/null || true
while [ "$#" -gt 0 ]; do
  case "$1" in
    --viewport) VIEWPORT="${2:-1440x900}"; shift 2;;
    *) shift;;
  esac
done

if [ -z "$ROUTE" ]; then
  echo "design-render: usage: design-render.sh <route> [--viewport WxH]" >&2
  exit 1
fi

# Session is fixed and isolated, so a critique render never inherits cookies, viewport or a
# stale page from somebody's QA session.
SESSION="design-critic"
VW="${VIEWPORT%x*}"
VH="${VIEWPORT#*x}"
case "$VW" in ''|*[!0-9]*) echo "design-render: bad viewport '$VIEWPORT' (want WxH)" >&2; exit 1;; esac
case "$VH" in ''|*[!0-9]*) echo "design-render: bad viewport '$VIEWPORT' (want WxH)" >&2; exit 1;; esac

# Slug: the FULL repo-relative path, separators encoded. A basename slug collides the moment
# two routes are both called page.tsx, and a collision here means one route's critique
# silently overwrites another's.
_slug() { printf '%s' "$1" | tr '\\' '/' | sed 's#/#--#g; s#[^A-Za-z0-9-]#-#g' | tr '[:upper:]' '[:lower:]'; }
SLUG="$(_slug "$ROUTE")"

OUT_DIR="$ROOT/.claude/state/design/renders"
PNG="$OUT_DIR/$SLUG.png"
META="$OUT_DIR/$SLUG.json"
mkdir -p "$OUT_DIR" || exit 1

# A repo-relative file becomes a file:// URL; anything already a URL is used as-is (Phase 2
# variants run on a dev server).
case "$ROUTE" in
  http://*|https://*|file://*) URL="$ROUTE";;
  *)
    if [ ! -f "$ROOT/$ROUTE" ]; then
      echo "design-render: no such route '$ROUTE' (looked for $ROOT/$ROUTE)" >&2
      exit 1
    fi
    ABS="$ROOT/$ROUTE"
    if command -v cygpath >/dev/null 2>&1; then ABS="$(cygpath -m "$ABS" 2>/dev/null || printf '%s' "$ABS")"; fi
    URL="file:///$(printf '%s' "$ABS" | sed 's#^/##')"
    ;;
esac

if ! command -v agent-browser >/dev/null 2>&1; then
  echo "design-render: agent-browser not on PATH -- the critic has no eyes." >&2
  echo "install: npm install -g agent-browser && agent-browser install" >&2
  exit 1
fi

_ab() { agent-browser --session "$SESSION" "$@"; }

# Determinism recipe. Recorded in the meta file so a future run can tell whether a hash
# difference means the PAGE changed or the RECIPE did.
# - fixed viewport: the critic must know what it is judging
# - light + no animation: a dark host theme or a mid-flight transition changes pixels with no
#   code change, which would read as a design regression
# - pinned font stack + antialiasing off: font substitution and subpixel AA differ across the
#   3 CI legs; without pinning, the hash drifts between Windows dev and Linux CI on identical
#   bytes (phase-00-spec cross-OS drift rabbit hole)
RECIPE='viewport-fixed;media-light;animations-off;font-pinned;aa-off'
DETERMINISM_CSS='(() => { const s = document.createElement("style"); s.textContent = `
  *,*::before,*::after { animation: none !important; transition: none !important;
    caret-color: transparent !important;
    -webkit-font-smoothing: none !important; font-synthesis: none !important; }
  html, body, * { font-family: Arial, Helvetica, sans-serif !important; }
  html { scrollbar-width: none !important; }
`; document.head.appendChild(s); return "ok"; })()'

_ab set viewport "$VW" "$VH" >/dev/null 2>&1 \
  || { echo "design-render: could not set viewport ${VW}x${VH}" >&2; exit 1; }
_ab set media light >/dev/null 2>&1 || true
if ! _ab open "$URL" --max-output 200 >/dev/null 2>&1; then
  echo "design-render: failed to open $URL" >&2
  _ab close >/dev/null 2>&1 || true
  exit 1
fi
_ab eval "$DETERMINISM_CSS" >/dev/null 2>&1 || true

# Blank-render guard (pre-mortem risk 3): the failure mode is not a crash, it is a confident
# critique of a blank or half-loaded page. Prove there is content BEFORE spending a vision
# pass on it.
# `get text` requires a selector -- called without one it errors, which reads as 0 chars and
# refuses every render. Fail-closed is the right direction but it must fail on a blank PAGE,
# not on a malformed probe.
TEXT_LEN="$(_ab get text body 2>/dev/null | wc -c | tr -d ' ')"
case "$TEXT_LEN" in ''|*[!0-9]*) TEXT_LEN=0;; esac
if [ "$TEXT_LEN" -lt 200 ]; then
  echo "design-render: REFUSED -- $URL rendered only ${TEXT_LEN} chars of text (blank or half-loaded)." >&2
  echo "A critique of a blank page is confident nonsense; fix the render before judging." >&2
  _ab close >/dev/null 2>&1 || true
  exit 1
fi

rm -f "$PNG" 2>/dev/null || true
if ! _ab screenshot "$PNG" >/dev/null 2>&1 || [ ! -s "$PNG" ]; then
  echo "design-render: screenshot failed for $URL" >&2
  _ab close >/dev/null 2>&1 || true
  exit 1
fi
_ab close >/dev/null 2>&1 || true

if command -v arc_hash_file >/dev/null 2>&1 || type arc_hash_file >/dev/null 2>&1; then
  SHA="$(arc_hash_file "$PNG")"
else
  SHA="$(sha256sum "$PNG" 2>/dev/null | cut -d' ' -f1)"
fi
if [ -z "$SHA" ]; then
  echo "design-render: could not hash $PNG" >&2
  exit 1
fi

# Stale/duplicate guard (pre-mortem risk 3): the same pixels under two different route names
# means one of them did not actually render -- almost always a stale page the browser never
# navigated away from. Identical pixels for the SAME route are expected and fine.
for m in "$OUT_DIR"/*.json; do
  [ -f "$m" ] || continue
  case "$m" in "$META") continue;; esac
  if grep -qF "\"screenshot_sha256\": \"$SHA\"" "$m" 2>/dev/null; then
    other="$(sed -n 's/.*"route": "\([^"]*\)".*/\1/p' "$m" | head -1)"
    echo "design-render: REFUSED -- these exact pixels are already recorded for '$other'." >&2
    echo "Two routes cannot render identically; the browser most likely never left the old page." >&2
    exit 1
  fi
done

# node writes the JSON so the route/url strings are escaped by a real serialiser rather than
# by printf, which is how a path containing a quote becomes an unparseable meta file.
if command -v node >/dev/null 2>&1; then
  node -e '
    const [route,url,png,sha,vw,vh,recipe,out] = process.argv.slice(1);
    require("fs").writeFileSync(out, JSON.stringify({
      route, url, png: png.replace(/\\/g,"/"),
      screenshot_sha256: sha, viewport: `${vw}x${vh}@1`, recipe,
    }, null, 2) + "\n");
  ' "$ROUTE" "$URL" "${PNG#"$ROOT"/}" "$SHA" "$VW" "$VH" "$RECIPE" "$META" || exit 1
else
  printf '{\n  "route": "%s",\n  "screenshot_sha256": "%s",\n  "viewport": "%sx%s@1",\n  "recipe": "%s"\n}\n' \
    "$ROUTE" "$SHA" "$VW" "$VH" "$RECIPE" > "$META" || exit 1
fi

echo "design-render: $ROUTE -> ${PNG#"$ROOT"/}"
echo "  viewport: ${VW}x${VH}@1  recipe: $RECIPE"
echo "  screenshot_sha256: $SHA"
