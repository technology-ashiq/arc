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
# Exit: 0 rendered | 1 refused (blank/near-empty page, stale duplicate, transport missing,
#                               determinism CSS not applied+painted)
#
# bash-3.2 / POSIX-safe: no arrays, no GNU-only flags.
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
. "$ROOT/.claude/scripts/core/common.sh" 2>/dev/null || true

ROUTE="${1:-}"
VIEWPORT="1440x900"
# Typeface and antialiasing are NOT pinned by default (owner decision 2026-07-30).
#
# They used to be, and it was the single most damaging rule in the design system. Pinning
# `font-family: Arial !important` on every render meant every variant was judged -- by the
# critic and by all three blind jurors -- with its typography deleted. Typography is the
# strongest carrier of design character, so the loop could not see the thing it existed to
# judge, and it duly reported three "genuinely different directions" that a human scored
# 23/100 for looking identical. They looked identical because they were rendered identical.
#
# The pin was added for cross-machine hash reproducibility, not for correctness of judgment.
# That job now belongs to the stable shutter below (shoot twice, publish only an agreed hash),
# which holds for causes nobody enumerated -- font drift included. Reproducibility across
# MACHINES is the thing genuinely traded away here, and `--pin-font` buys it back for the one
# use that needs it: comparing a route against a hash recorded elsewhere.
PIN_FONT=0
MEDIA="light"
shift 2>/dev/null || true
while [ "$#" -gt 0 ]; do
  case "$1" in
    --viewport) VIEWPORT="${2:-1440x900}"; shift 2;;
    --pin-font) PIN_FONT=1; shift;;
    --media) MEDIA="${2:-light}"; shift 2;;
    *) shift;;
  esac
done

case "$MEDIA" in
  light|dark) ;;
  *) echo "design-render: --media takes light or dark, got '$MEDIA'" >&2; exit 1;;
esac

if [ -z "$ROUTE" ]; then
  echo "design-render: usage: design-render.sh <route> [--viewport WxH] [--media light|dark] [--pin-font]" >&2
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

# One hasher, used for both the stability probe and the published hash -- two hashers would
# make "the captures agree" mean something different from "this is the recorded number".
_hash_png() {
  if command -v arc_hash_file >/dev/null 2>&1 || type arc_hash_file >/dev/null 2>&1; then
    arc_hash_file "$1"
  else
    sha256sum "$1" 2>/dev/null | cut -d' ' -f1
  fi
}

# Determinism recipe. Recorded in the meta file so a future run can tell whether a hash
# difference means the PAGE changed or the RECIPE did.
# - fixed viewport: the critic must know what it is judging
# - light + no animation: a dark host theme or a mid-flight transition changes pixels with no
#   code change, which would read as a design regression
# - pinned font stack + antialiasing off: font substitution and subpixel AA differ across the
#   3 CI legs; without pinning, the hash drifts between Windows dev and Linux CI on identical
#   bytes (phase-00-spec cross-OS drift rabbit hole)
# - settle-paint: the rules above must be APPLIED AND PAINTED before the shutter opens.
#   Injecting them and capturing immediately is a race, and it is not theoretical -- it is
#   issue #57. Measured on hq-dashboard-v1/variant-b: the injection moves pixels
#   (901e48cc -> ed1b1100) while document height does not move at all (scrollHeight 1528
#   both). A page that already declares the pinned font gives the pipeline no reflow to wait
#   on, so the capture lands on either side of the injection and the SAME bytes hash two
#   ways. Isolated rule by rule, font-pin and aa-off each move pixels on their own;
#   animations-off and caret move none. Waiting is therefore not belt-and-braces, it is the
#   only thing that makes the other five rules mean anything.
# Font and antialiasing rules are conditional (see PIN_FONT above). Everything else is
# unconditional: animations and caret are removed because a static capture of a moving page is
# a coin flip, and the scrollbar is hidden because its width differs per OS.
if [ "$PIN_FONT" = "1" ]; then
  FONT_RULE='html, body, * { font-family: Arial, Helvetica, sans-serif !important; }
  *,*::before,*::after { -webkit-font-smoothing: none !important; font-synthesis: none !important; }'
  # A pinned run can still check the pin landed. An UNPINNED run must not: there is no expected
  # font to test for, and asserting one would refuse every page that chose its own typeface.
  FONT_TEST=' && /^Arial/.test(getComputedStyle(root).fontFamily)'
  RECIPE_FONT='font-pinned;aa-off'
else
  FONT_RULE='/* typeface NOT pinned -- the design is judged in the type it was designed in */'
  FONT_TEST=''
  RECIPE_FONT='font-true;aa-on'
fi
RECIPE="viewport-fixed;full-page;media-$MEDIA;animations-off;$RECIPE_FONT;settle-paint"
# The marker is read back below: an injection that silently failed used to leave the render
# running with NO determinism rules at all, and nothing said so.
# `applied` is MEASURED, never asserted, and it took two goes to measure the right thing.
# A hardcoded applied=1 proved only that the eval ran. Replacing it with "did the computed
# font come back Arial" was still wrong in the way that matters: on a page that ALREADY
# declares the Arial stack -- which is the entire population this guard exists for, since
# that is what makes the race possible at all -- the page satisfies the font test by itself,
# so the check silently degenerated to "an element exists". A style-src CSP appends the
# element and applies nothing, and that read as success.
# `el.sheet.cssRules.length > 0` is the page-independent discriminator: a blocked or empty
# sheet has zero rules whatever the page declares. The font test stays as the second half --
# a sheet can hold rules that lost to an !important elsewhere.
# `document.body || document.documentElement` is not defensive padding: on a frameset or XML
# document body is null, getComputedStyle(null) throws OUTSIDE the try above, the eval
# rejects, stdout is empty, and the run refuses citing determinism rules for a reason that
# has nothing to do with them.
# Building the string by concatenation also keeps the literal marker out of the script text,
# so a transport that ever echoed a failing script back could not satisfy the shell glob.
DETERMINISM_CSS='(async () => { const s = document.createElement("style");
  s.id = "__arc_determinism__"; s.textContent = `
  *,*::before,*::after { animation: none !important; transition: none !important;
    caret-color: transparent !important; }
  '"$FONT_RULE"'
  html { scrollbar-width: none !important; }
`; document.head.appendChild(s);
  void document.documentElement.offsetHeight;
  try { await document.fonts.ready; } catch (e) {}
  var painted = await Promise.race([
    new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(function () { r(true); }); }); }),
    new Promise(function (r) { setTimeout(function () { r(false); }, 5000); })
  ]);
  var el = document.getElementById("__arc_determinism__");
  var landed = false;
  try { landed = !!el && !!el.sheet && el.sheet.cssRules.length > 0; }
  catch (e) { landed = !!el && !!el.sheet; }
  var root = document.body || document.documentElement;
  var applied = landed'"$FONT_TEST"';
  void root;
  return "arc-determinism:applied=" + (applied ? "1" : "0")
    + ":painted=" + (painted ? "1" : "0")
    + ":h=" + document.documentElement.scrollHeight; })()'

_ab set viewport "$VW" "$VH" >/dev/null 2>&1 \
  || { echo "design-render: could not set viewport ${VW}x${VH}" >&2; exit 1; }
_ab set media "$MEDIA" >/dev/null 2>&1 || true
if ! _ab open "$URL" --max-output 200 >/dev/null 2>&1; then
  echo "design-render: failed to open $URL" >&2
  _ab close >/dev/null 2>&1 || true
  exit 1
fi
# Rules landing is fail-closed: an injection that silently failed used to leave the render
# running with NO determinism rules at all, and nothing said so.
# Rules *painting* is NOT fail-closed, on purpose. requestAnimationFrame is throttled in
# headless Chromium often enough to see it (1 run in ~10 here) and those runs still produced
# the correct, identical hash -- refusing them would trade a wrong number for a broken
# command. The stable-shutter guard below is what actually holds the guarantee.
SETTLED="$(_ab eval "$DETERMINISM_CSS" 2>/dev/null | tr -d '\r')"
case "$SETTLED" in
  *arc-determinism:applied=1*) ;;
  *)
    echo "design-render: REFUSED -- determinism rules did not apply on $URL." >&2
    if [ -n "${SETTLED:-}" ]; then echo "  browser said: $SETTLED" >&2; fi
    echo "Capturing now would race the injection: the same bytes can hash two ways (#57)," >&2
    echo "and that hash gets sealed into a review receipt as the pixels the critic judged." >&2
    _ab close >/dev/null 2>&1 || true
    exit 1
    ;;
esac

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

# --full captures the WHOLE page, not just the viewport. Found the hard way: a viewport-only
# capture of any page taller than the viewport shows content sliced at the fold, and the critic
# correctly-but-uselessly reports "hard clip with no affordance" every single time. That is a
# permanent false VIOLATION on every real dashboard, and it makes the fix loop unable to
# converge -- there is nothing on the page to fix, the defect is in the camera.
# The viewport still matters (it sets layout width and breakpoints); it just no longer decides
# how much of the page the critic is allowed to see. Judging what sits above the fold is a
# separate question that needs a declared platform contract, not a silent side effect of how
# the screenshot was taken.
#
# Stable-shutter guard (#57). The settle step makes the injected rules land, but no amount of
# waiting PROVES a browser has finished painting -- and the whole failure was a hash nobody
# could reproduce ending up inside a sealed receipt. So the script does not publish a hash it
# has not reproduced: shoot twice, require the two to agree, retry up to 3 times, refuse if
# they never do. That holds for causes nobody has enumerated yet, which is the point --
# enumerating paint-time races in a browser is not a finishable task, and the guarantee the
# receipt needs is only "this number is reproducible".
#
# Cost of the guarantee, stated plainly: every render is now TWO full-page captures, so an
# explore render of 3 variants takes 6. That is the price of a hash nobody has to trust.
#
# On every refusal below, the PNG and the meta are BOTH removed. A refusal that left them
# behind would leave the last unstable capture on disk beside a meta still claiming an older
# hash -- a silently disagreeing pair, in the exact directory where #57 was found, and the
# one thing this whole change exists to make impossible.
PROBE="${PNG%.png}.probe.png"
# Separate traps on purpose. A single handler across EXIT INT TERM that does not itself exit
# swallows the signal: the handler runs, execution RESUMES, and the script survives a TERM
# that used to kill it -- so a CI timeout or a cancelled job hangs instead of dying, and the
# probe gets deleted mid-write and immediately recreated by the next loop pass.
# The signal handlers deliberately do NOT call `_ab close`: shelling out to a node CLI from a
# signal handler is its own hang risk, and an unhandled signal left the session open anyway,
# so this is not a regression. It does mean an interrupted render can leave the design-critic
# session parked on the old page -- which is the state the stale-duplicate guard below exists
# to catch, so it fails loudly rather than silently.
trap 'rm -f "$PROBE" 2>/dev/null || true' EXIT
trap 'rm -f "$PROBE" 2>/dev/null; exit 130' INT
trap 'rm -f "$PROBE" 2>/dev/null; exit 143' TERM
SHA=""
NOHASH=""
ATTEMPT=1
while [ "$ATTEMPT" -le 3 ]; do
  rm -f "$PNG" "$PROBE" 2>/dev/null || true
  if ! _ab screenshot "$PROBE" --full >/dev/null 2>&1 || [ ! -s "$PROBE" ] \
     || ! _ab screenshot "$PNG" --full >/dev/null 2>&1 || [ ! -s "$PNG" ]; then
    echo "design-render: screenshot failed for $URL" >&2
    _ab close >/dev/null 2>&1 || true
    rm -f "$PNG" "$META" 2>/dev/null || true
    exit 1
  fi
  SHA_A="$(_hash_png "$PROBE")"
  SHA_B="$(_hash_png "$PNG")"
  # A hasher that returns nothing for BOTH captures is a missing tool, not an unstable page.
  # Reporting that as "disagreed on 3 attempts" would send someone hunting a browser race
  # that is not there -- and would take 6 captures to say it.
  if [ -z "$SHA_A" ] && [ -z "$SHA_B" ]; then NOHASH=1; break; fi
  if [ -n "$SHA_B" ] && [ "$SHA_A" = "$SHA_B" ]; then SHA="$SHA_B"; break; fi
  ATTEMPT=$((ATTEMPT + 1))
done
rm -f "$PROBE" 2>/dev/null || true
_ab close >/dev/null 2>&1 || true

if [ -n "$NOHASH" ]; then
  echo "design-render: could not hash $PNG -- no sha256 tool resolved on this box." >&2
  rm -f "$PNG" "$META" 2>/dev/null || true
  exit 1
fi
if [ -z "$SHA" ]; then
  echo "design-render: REFUSED -- $URL does not render to a stable image." >&2
  echo "Two back-to-back captures of the same loaded page disagreed on 3 attempts, so any" >&2
  echo "hash recorded here would not be reproducible (#57) and the receipt would be fiction." >&2
  rm -f "$PNG" "$META" 2>/dev/null || true
  exit 1
fi

# The field this lands in is called screenshot_sha256, so it had better be one. arc_hash_file
# falls back to cksum when neither sha256sum nor shasum resolves, and cksum returns a CRC32 --
# still deterministic, so the two-capture agreement above would hold and nothing would look
# wrong, while every receipt on the spine carried a CRC under a name that says SHA-256. A
# change about receipts being honest does not get to ship that.
SHAPE_OK=1
case "$SHA" in *[!0-9a-fA-F]*) SHAPE_OK=0;; esac
[ "${#SHA}" -eq 64 ] || SHAPE_OK=0
if [ "$SHAPE_OK" -ne 1 ]; then
  echo "design-render: REFUSED -- the hash for $PNG is not a SHA-256 ($SHA)." >&2
  echo "No sha256sum or shasum on this box, so the hasher fell back to cksum. Recording a" >&2
  echo "CRC in a field named screenshot_sha256 would make every receipt it touches a lie." >&2
  rm -f "$PNG" "$META" 2>/dev/null || true
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
    rm -f "$PNG" "$META" 2>/dev/null || true
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
