#!/usr/bin/env bash
# design-render.sh -- the ONE deterministic render command (frozen plan 2.5).
#
# Every critique and, from Phase 2, every variant screenshot comes from here. If two
# screenshots are produced by two different commands then comparing them is not a comparison,
# and a critic judging an unknown viewport is judging nothing in particular.
#
# Writes:  .claude/state/design/renders/<session>/<slug>.png
#          .claude/state/design/renders/<session>/<slug>.json
#          ...or <slug>--iter-N.{png,json} when --iter is given (ADR-1401's self-review loop).
#
# The path is SESSION-scoped (ADR-1402) and the duplicate guard discriminates on
# (route, session) (ADR-1417). Keyed on route alone, a same-route re-render overwrote the one
# file at that path and the guard skipped it by path identity -- so the composer's most
# valuable signal, "my revision changed nothing", was classed as a stale browser page,
# refused, and deleted.
#
#   design-render.sh <route> [--mode explore|critique] [--session ID] [--iter N] [--viewport WxH]
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
# Mode defaults to critique so every caller written before ADR-1402 keeps working untouched:
# design-critique.sh forwards "$@" and design-explore.sh passes no flags at all. Explore mode
# is the one that refuses without a session, because a shared session is exactly what races
# three parallel composers.
MODE="critique"
SESSION_ARG=""
ITER=""
MODE_GIVEN=0
SESSION_GIVEN=0
ITER_GIVEN=0

# A two-argument flag given as the LAST argument used to hang this script forever: `shift 2`
# with one argument left FAILS and shifts nothing, `set -e` is off, so the loop re-read the
# same $1 until the CI leg timed out. Measured on all five flags. The fix was already written
# down 30 lines away in tests/fixtures/design/fake-agent-browser.sh, whose comment names this
# exact failure -- applied to the fixture and never carried to the script it fakes. So each
# branch now checks arity BEFORE consuming, and ${2:-default} is gone: it HID the arity error
# instead of catching it.
_need_value() {
  [ "$2" -ge 2 ] || { echo "design-render: $1 needs a value" >&2; exit 1; }
}
# Two differing values for one flag is an operator error, not a last-wins override --
# .claude/rules/lanes.md already ruled on exactly this shape for --lane, and the session IS
# this script's lane: the duplicate guard keys on it, so silently picking one of two is
# precisely the "never guess" failure.
_no_redefine() {
  [ "$2" -eq 0 ] || [ "$3" = "$4" ] || { echo "design-render: $1 given twice with different values ('$4' then '$3')" >&2; exit 1; }
}
shift 2>/dev/null || true
while [ "$#" -gt 0 ]; do
  case "$1" in
    --viewport) _need_value --viewport "$#"; VIEWPORT="$2"; shift 2;;
    --pin-font) PIN_FONT=1; shift;;
    --media) _need_value --media "$#"; MEDIA="$2"; shift 2;;
    --mode) _need_value --mode "$#"; _no_redefine --mode "$MODE_GIVEN" "$2" "$MODE"; MODE="$2"; MODE_GIVEN=1; shift 2;;
    --session) _need_value --session "$#"; _no_redefine --session "$SESSION_GIVEN" "$2" "$SESSION_ARG"; SESSION_ARG="$2"; SESSION_GIVEN=1; shift 2;;
    --iter) _need_value --iter "$#"; _no_redefine --iter "$ITER_GIVEN" "$2" "$ITER"; ITER="$2"; ITER_GIVEN=1; shift 2;;
    # An unknown flag REFUSES rather than being swallowed. The old catch-all was `*) shift;;`,
    # which meant a typo like --sesion s1 vanished and the render silently proceeded in
    # critique mode under the default session -- an omitted --session wearing a flag's clothes.
    *) echo "design-render: unknown argument '$1'" >&2
       echo "usage: design-render.sh <route> [--mode explore|critique] [--session ID] [--iter N] [--viewport WxH] [--media light|dark] [--pin-font]" >&2
       exit 1;;
  esac
done

case "$MODE" in
  explore|critique) ;;
  *) echo "design-render: --mode takes explore or critique, got '$MODE'" >&2; exit 1;;
esac

# Validate whenever the flag was GIVEN, never whenever the value is non-empty. `--iter ""`
# -- the shape a caller produces writing --iter "$N" with N unset -- used to skip this check
# entirely and silently overwrite the base render path instead of an iteration path.
if [ "$ITER_GIVEN" -eq 1 ]; then
  case "$ITER" in
    1|2|3) ;;
    *) echo "design-render: --iter takes 1, 2 or 3, got '$ITER' (ADR-1401 caps the loop at three)" >&2; exit 1;;
  esac
fi

case "$MEDIA" in
  light|dark) ;;
  *) echo "design-render: --media takes light or dark, got '$MEDIA'" >&2; exit 1;;
esac

if [ -z "$ROUTE" ]; then
  echo "design-render: usage: design-render.sh <route> [--viewport WxH] [--media light|dark] [--pin-font]" >&2
  exit 1
fi

# Session isolation, two ways. Critique keeps the fixed literal it has always used, so a
# critique render never inherits cookies, viewport or a stale page from somebody's QA session.
# Explore MUST name its own, because three composers rendering at once through one browser
# session race each other -- and an absent flag refuses rather than falling back, since a
# silent default would reintroduce the race while looking like it worked.
# Missing and empty are DIFFERENT here, in both directions. `--session ""` in critique mode
# used to fall through :- and silently join the shared critique session; in explore mode it
# reported "--session is required" when a --session had in fact been given. Both are the
# missing-vs-empty conflation this repo has fixed four times elsewhere.
if [ "$MODE" = "explore" ] && [ "$SESSION_GIVEN" -eq 0 ]; then
  echo "design-render: REFUSED -- --session is required in explore mode (no default; a shared session races parallel renders)." >&2
  exit 1
fi
if [ "$SESSION_GIVEN" -eq 1 ]; then
  SESSION="$SESSION_ARG"          # let the grammar below reject "" with the RIGHT message
else
  SESSION="design-critic"
fi
# The id becomes a directory name, so it is constrained where it is USED, not trusted.
# Phase 01 will pass <explore-id>--variant-<x>; both fit this grammar.
#
# Characters spelled out, not `a-z`: a bracket range resolves through the locale's collation
# table, which on macOS interleaves case, so `[!a-z0-9-]` does NOT fire for `Design` -- the id
# is accepted on one OS and refused on the others, then collides with an existing `design`
# directory on a case-insensitive filesystem. design-explore.sh:37 carries this exact lesson
# for its explore id, which has exactly these semantics, and this range was written `a-z`
# two files away from it. tests/portability.bats caught it on CI.
case "$SESSION" in
  ""|*[!abcdefghijklmnopqrstuvwxyz0123456789-]*)
    echo "design-render: --session takes lowercase letters, digits and hyphens, got '$SESSION'" >&2; exit 1;;
esac

# An explore render is confined to its own variant directory (ADR-1418). This used to open the
# page as file://, and a file:// page loads any file on disk: a composer framed its sibling from
# its OWN page, every tool boundary allowed it, and the sibling's pixels landed in the one render
# the composer may read. So explore mode takes exactly one route shape -- a page inside
# docs/design/explore/<id>/variant-<x>/ -- and serves that directory over loopback further down.
# A URL route is refused rather than passed through: the render is served from the variant, not
# opened wherever the route points. Characters are spelled out, never ranged (portability.bats).
EXPLORE_ROOT=""
EXPLORE_PAGE=""
if [ "$MODE" = "explore" ]; then
  _explore_route_refuse() {
    echo "design-render: REFUSED -- explore mode renders only a page inside docs/design/explore/<id>/variant-<x>/, got '$(printf '%s' "$ROUTE" | cut -c1-200)'." >&2
    echo "  $1" >&2
    exit 1
  }
  case "$ROUTE" in
    *:*) _explore_route_refuse "A URL or a drive path is never an explore page.";;
    docs/design/explore/*/variant-?/?*) ;;
    *) _explore_route_refuse "The route is not a page inside a variant directory.";;
  esac
  # `*` in a case pattern crosses `/`, so each part is taken apart and checked on its own.
  _er_rest="${ROUTE#docs/design/explore/}"
  _er_id="${_er_rest%%/*}"
  _er_rest="${_er_rest#*/}"
  _er_variant="${_er_rest%%/*}"
  EXPLORE_PAGE="${_er_rest#*/}"
  case "$_er_id" in
    ""|-*|*[!abcdefghijklmnopqrstuvwxyz0123456789-]*) _explore_route_refuse "The explore id must be lowercase kebab.";;
  esac
  case "$_er_variant" in
    variant-[abcdefghijklmnopqrstuvwxyz]) ;;
    *) _explore_route_refuse "The variant directory must be variant-<one lowercase letter>.";;
  esac
  case "/$EXPLORE_PAGE/" in
    *//*|*/./*|*/../*) _explore_route_refuse "The page is not a plain path inside the variant.";;
  esac
  # Every character left is one a URL path carries unescaped, so the page is served at exactly the
  # path it was named by.
  case "$EXPLORE_PAGE" in
    *[!ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._/-]*)
      _explore_route_refuse "The page path carries a character a URL would have to escape.";;
  esac
  EXPLORE_ROOT="docs/design/explore/$_er_id/$_er_variant"
  if ! command -v node >/dev/null 2>&1; then
    echo "design-render: REFUSED -- explore mode serves the page from its variant directory with node, and node is not on PATH." >&2
    echo "  Falling back to file:// would reopen the sibling leak ADR-1418 closes." >&2
    exit 1
  fi
fi

VW="${VIEWPORT%x*}"
VH="${VIEWPORT#*x}"
case "$VW" in ''|*[!0-9]*) echo "design-render: bad viewport '$VIEWPORT' (want WxH)" >&2; exit 1;; esac
case "$VH" in ''|*[!0-9]*) echo "design-render: bad viewport '$VIEWPORT' (want WxH)" >&2; exit 1;; esac

# Slug: the FULL repo-relative path, separators encoded. A basename slug collides the moment
# two routes are both called page.tsx, and a collision here means one route's critique
# silently overwrites another's.
_slug() { printf '%s' "$1" | tr '\\' '/' | sed 's#/#--#g; s#[^A-Za-z0-9-]#-#g' | tr '[:upper:]' '[:lower:]'; }
SLUG="$(_slug "$ROUTE")"

RENDER_ROOT="$ROOT/.claude/state/design/renders"
OUT_DIR="$RENDER_ROOT/$SESSION"
# Iteration outputs are immutable: iter-2 never overwrites iter-1, which is what makes
# "iteration 2 fixed what iteration 1 found" provable from the shas rather than narrated.
#
# The VIEWPORT is part of that immutability in explore mode, and its absence made ADR-1403
# unsatisfiable. coverage requires every viewport the brief DECLARES to have been rendered and
# proves it by reading the viewport field out of every meta in the session -- but with the path
# keyed on slug and iteration alone, rendering one route at 1440x900 and then at 390x844 wrote
# the second straight over the first. Only the last viewport ever survived, so coverage could
# never see two, and the gate's own passing fixture hand-wrote filenames this script cannot
# emit. A requirement nothing can satisfy is not a requirement.
#
# CRITIQUE MODE DELIBERATELY DOES NOT MOVE. design-critique.sh builds
# renders/design-critic/<slug>.json as a fixed literal and READS it; Phase 00's done-log
# records that the caller sweep's twin was in consumption rather than invocation, and this is
# that same seam. Critique renders one viewport per route, so it has nothing to disambiguate.
# BASE_STEM is everything before the iteration suffix, and it exists so there is exactly ONE
# spelling of it. The unchanged-detection below has to name the PREVIOUS iteration's file, and
# it used to rebuild that name from "$SLUG--iter-N" by hand -- a second spelling that was
# correct only while the stem was the slug. Adding the viewport broke it instantly: the
# comparison looked for a file that no longer existed, found nothing, and every iteration
# reported "unchanged": false. Phase 00's own suite caught it, and its done-log had already
# named the class -- the caller sweep's twin is in CONSUMPTION, not invocation.
BASE_STEM="$SLUG"
[ "$MODE" = "explore" ] && BASE_STEM="$BASE_STEM--${VW}x${VH}"
BASE="$BASE_STEM"
[ -n "$ITER" ] && BASE="$BASE_STEM--iter-$ITER"
PNG="$OUT_DIR/$BASE.png"
META="$OUT_DIR/$BASE.json"
# mkdir deliberately NOT here: it used to run before the route-existence check, so every
# refusal below left an empty session directory behind and falsified the suite's own claim
# that refusing publishes nothing. It happens once the route resolves, further down.

# Read ONE field out of a meta file. The route is written through JSON.stringify and was
# being read back with a raw regex that does not unescape -- so a Windows route like
# docs\one.html round-tripped to docs\\one.html, compared unequal to itself, and a
# same-route iteration was classed as a stale page and DELETED. That is the exact outcome
# ADR-1417 exists to prevent, resurrected in the read path.
#   exit 0 = present (value on stdout) · 3 = key absent · 1 = unreadable or malformed
HAVE_NODE=0
command -v node >/dev/null 2>&1 && HAVE_NODE=1
_meta_field() {
  if [ "$HAVE_NODE" = "1" ]; then
    node -e '
      const fs = require("fs");
      let m; try { m = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); } catch (e) { process.exit(1); }
      if (m === null || typeof m !== "object") process.exit(1);
      const k = process.argv[2];
      if (!Object.prototype.hasOwnProperty.call(m, k)) process.exit(3);
      const v = m[k];
      if (v === null) process.exit(3);
      process.stdout.write(String(v));
    ' "$1" "$2"
    return $?
  fi
  # No-node fallback. Anchored to the whole pretty-printed line, and REFUSING when more than
  # one line matches, because the old `head -1` let a decoy key ordered ahead of the real one
  # decide the comparison.
  # grep -c PRINTS 0 and EXITS 1 on no match, so `|| echo 0` appended a second zero and the
  # comparison below saw a two-line count. Read the count, then normalise an empty capture.
  # tr -d '\r' FIRST, for the reason _sha_of and _vw_of in design-explore.sh already carry it:
  # the `$` anchor below cannot match past a CR, so a CRLF meta yields an EMPTY capture. MSYS2
  # sed strips the CR silently, so this reads clean on Windows and fails on ubuntu and macOS --
  # an OS-asymmetric defect no Windows-authored test can pin. The fix landed in the two design-
  # explore readers and was left standing here: the third instance of the twin shape this cycle,
  # found by a fresh attacker grepping the PATTERN rather than re-reading the file it was fixed in.
  _v="$(tr -d '\r' < "$1" 2>/dev/null | sed -n "s/^  \"$2\": \"\(.*\)\",\{0,1\}$/\1/p")"
  _n="$(tr -d '\r' < "$1" 2>/dev/null | grep -c "^  \"$2\": ")" || true
  [ -n "$_n" ] || _n=0
  [ "$_n" = "1" ] || { [ "$_n" = "0" ] && return 3; return 1; }
  # The count said the key is there and the capture came back empty. That is UNREADABLE, not
  # absent, and the distinction is load-bearing: every caller of this function treats rc=1 as
  # "fail closed" and an empty rc=0 as "a value I can compare". Returning 0 with "" made the
  # stale-duplicate guard skip the meta and the unchanged-detection report false, both silently.
  # Every key read through here (screenshot_sha256, route, session) is a non-empty JSON string,
  # so empty can only mean the line did not parse.
  [ -n "$_v" ] || return 1
  printf '%s\n' "$_v"
  return 0
}

# Read what this exact path last published BEFORE the render overwrites it, so a plain
# same-path re-render can still report "nothing changed" instead of losing the comparison.
#
# _slug() is NOT injective -- docs/(shop)/page.html and docs/[shop]/page.html both collapse to
# the same slug, as do a.b and a-b. Two such routes share one output path, and trusting
# PREV_SHA blindly meant the second route's FIRST EVER render came out exit 0 carrying
# "unchanged": true while the first route's PNG and receipt vanished. So the previous meta's
# ROUTE is read too: a mismatch is a collision, and a collision is case 1 -- refuse rather
# than overwrite. Making the slug injective would ripple through every hardcoded path in the
# suite and in design-critique.sh; refusing closes the hole without that blast radius.
PREV_SHA=""
PREV_ROUTE=""
if [ -f "$META" ]; then
  PREV_SHA="$(_meta_field "$META" screenshot_sha256)" || PREV_SHA=""
  PREV_ROUTE="$(_meta_field "$META" route)" || PREV_ROUTE=""
  if [ -n "$PREV_ROUTE" ] && [ "$PREV_ROUTE" != "$ROUTE" ]; then
    echo "design-render: REFUSED -- '$ROUTE' and '$PREV_ROUTE' collapse to the same slug '$SLUG'." >&2
    echo "One would silently overwrite the other's render and receipt. Rename one route." >&2
    exit 1
  fi
fi

# A repo-relative file becomes a file:// URL; anything already a URL is used as-is (Phase 2
# variants run on a dev server). Critique mode only: explore mode refused URL routes above, and
# its URL is the loopback server's, known once that server is listening.
case "$ROUTE" in
  http://*|https://*|file://*) URL="$ROUTE";;
  *)
    if [ ! -f "$ROOT/$ROUTE" ]; then
      echo "design-render: no such route '$ROUTE' (looked for $ROOT/$ROUTE)" >&2
      exit 1
    fi
    URL=""
    if [ "$MODE" != "explore" ]; then
      ABS="$ROOT/$ROUTE"
      if command -v cygpath >/dev/null 2>&1; then ABS="$(cygpath -m "$ABS" 2>/dev/null || printf '%s' "$ABS")"; fi
      URL="file:///$(printf '%s' "$ABS" | sed 's#^/##')"
    fi
    ;;
esac

# Only now, once the route is known good: an earlier mkdir left an empty session directory
# behind on every refusal above.
mkdir -p "$OUT_DIR" || { echo "design-render: cannot create $OUT_DIR" >&2; exit 1; }

if ! command -v agent-browser >/dev/null 2>&1; then
  echo "design-render: agent-browser not on PATH -- the critic has no eyes." >&2
  echo "install: npm install -g agent-browser && agent-browser install" >&2
  exit 1
fi

_ab() { agent-browser --session "$SESSION" "$@"; }

# The loopback server an explore page is served from (ADR-1418, design-render-serve.mjs). Stopping
# it is a plain `kill`: the signal handlers below must not shell out to node, and the server's own
# lifetime cap is the backstop for a kill that never lands.
SRV_DIR=""
SRV_PID=""
PORT=""
_confine_stop() { if [ -n "$SRV_PID" ]; then kill "$SRV_PID" 2>/dev/null || true; fi; return 0; }
_confine_cleanup() { _confine_stop; if [ -n "$SRV_DIR" ]; then rm -rf "$SRV_DIR" 2>/dev/null || true; fi; return 0; }
if [ "$MODE" = "explore" ]; then
  SRV_DIR="$(mktemp -d 2>/dev/null)" || SRV_DIR=""
  if [ -z "$SRV_DIR" ] || [ ! -d "$SRV_DIR" ]; then
    echo "design-render: REFUSED -- cannot create a private directory for the loopback server; refusing to fall back to file:// (ADR-1418)." >&2
    exit 1
  fi
  _native() {
    if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1" 2>/dev/null || printf '%s' "$1"; else printf '%s' "$1"; fi
  }
  trap '_confine_cleanup' EXIT
  trap '_confine_stop; exit 130' INT
  trap '_confine_stop; exit 143' TERM
  # No inherited descriptors: a server holding the caller's stdout or bats' fd 3 would keep a
  # `run` or a CI job open until its cap.
  node "$ROOT/.claude/scripts/design/design-render-serve.mjs" \
    --root "$(_native "$ROOT/$EXPLORE_ROOT")" --dir "$(_native "$SRV_DIR")" --max-seconds 300 \
    </dev/null >/dev/null 2>&1 3>&- &
  SRV_PID=$!
  _i=0
  while [ "$_i" -lt 150 ]; do
    if [ -s "$SRV_DIR/port" ]; then PORT="$(cat "$SRV_DIR/port" 2>/dev/null)"; break; fi
    kill -0 "$SRV_PID" 2>/dev/null || break
    sleep 0.1
    _i=$((_i + 1))
  done
  case "$PORT" in
    ""|*[!0123456789]*)
      echo "design-render: REFUSED -- the loopback server for $EXPLORE_ROOT/ did not start; refusing to fall back to file:// (ADR-1418)." >&2
      if [ -s "$SRV_DIR/record" ]; then head -n 3 "$SRV_DIR/record" | cut -c1-240 | sed 's/^/  /' >&2; fi
      exit 1
      ;;
  esac
  URL="http://127.0.0.1:$PORT/$EXPLORE_PAGE"
fi

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
# The transport is part of the recipe: the same page served from its variant directory and opened
# as file:// are different renders the moment the page reaches outside (ADR-1418).
[ "$MODE" = "explore" ] && RECIPE="$RECIPE;confined-loopback"
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
# Fail-closed, like the viewport above. This was `|| true` while RECIPE hardcodes
# "media-$MEDIA" into the meta and into every receipt built from it -- so a --media dark
# render whose browser silently ignored the command was sealed as "judged in dark". A gate
# that transforms what it measures must declare what the transform destroys, and this one
# was asserting a transform it never checked had happened.
_ab set media "$MEDIA" >/dev/null 2>&1 \
  || { echo "design-render: could not set media '$MEDIA'; refusing to record it in the recipe as if it had applied" >&2; exit 1; }
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
# These replace the loopback server's traps set above, so they carry its cleanup too.
trap 'rm -f "$PROBE" 2>/dev/null || true; _confine_cleanup' EXIT
trap 'rm -f "$PROBE" 2>/dev/null; _confine_stop; exit 130' INT
trap 'rm -f "$PROBE" 2>/dev/null; _confine_stop; exit 143' TERM
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
# Read from OUTSIDE the page, before the browser closes: where the page ended up, and how many tabs
# it left. A page can lie through `eval`; it cannot answer for agent-browser.
FINAL_URL=""
TAB_LINES=""
if [ "$MODE" = "explore" ]; then
  FINAL_URL="$(_ab get url 2>/dev/null | tr -d '\r' | head -n 1)"
  TAB_LINES="$(_ab tab 2>/dev/null | tr -d '\r' | grep -cE '^.{0,6}\[t[0-9]+\] ' || true)"
fi
_ab close >/dev/null 2>&1 || true

# The confinement verdict (ADR-1418), ahead of every other refusal, so a page that reached out is
# named for that and not for a side effect of it. Every refusal removes the PNG and the meta.
if [ "$MODE" = "explore" ]; then
  _confine_refuse() {
    echo "design-render: REFUSED -- $1" >&2
    shift
    for _l in "$@"; do echo "  $_l" >&2; done
    rm -f "$PNG" "$META" 2>/dev/null || true
    exit 1
  }
  # The server creates its record before it reports a port, so a missing one is a server that could
  # not keep evidence -- and an empty record from nowhere proves nothing.
  [ -f "$SRV_DIR/record" ] \
    || _confine_refuse "the loopback server kept no record, so nothing proves the page stayed inside $EXPLORE_ROOT/."
  if grep -qE '^(lifetime|error)' "$SRV_DIR/record" 2>/dev/null; then
    _confine_refuse "the loopback server for $EXPLORE_ROOT/ stopped mid-render:" \
      "$(grep -E '^(lifetime|error)' "$SRV_DIR/record" | head -n 3 | cut -c1-240)"
  fi
  if [ -s "$SRV_DIR/record" ]; then
    _confine_refuse "the page left its variant directory, $EXPLORE_ROOT/ (ADR-1418). What it asked for that is not a file inside it:" \
      "$(head -n 10 "$SRV_DIR/record" | cut -c1-240)" \
      "A render may show only its own variant. Nothing was published."
  fi
  case "$FINAL_URL" in
    "http://127.0.0.1:$PORT/"*) ;;
    *) _confine_refuse "the page navigated away from http://127.0.0.1:$PORT/ and ended at '$(printf '%s' "$FINAL_URL" | cut -c1-200)'." \
         "What was captured is not the page that was served.";;
  esac
  [ "$TAB_LINES" = "1" ] \
    || _confine_refuse "the render ended with ${TAB_LINES:-no} tabs open; a page that opens another cannot prove which one was captured."
fi

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

# Stale/duplicate guard (pre-mortem risk 3), now discriminating on (route, session) per
# ADR-1417. It walks EVERY session, not just this one: case 3 below is only visible across
# sessions. Identical pixels mean one of three different things, and conflating them is how
# the self-review loop's key signal became a deletion.
UNCHANGED="false"
[ -n "$PREV_SHA" ] && [ "$PREV_SHA" = "$SHA" ] && UNCHANGED="true"

# For an iteration, the ONLY meaningful comparison is the iteration before it. Comparing
# against every meta in the session made a REVERT read as a no-op: iter-1 pixels A, iter-2
# pixels B, iter-3 back to A reported "unchanged": true, when iteration 3 changed a great
# deal. ADR-1417 defines the signal as "my revision changed nothing visible".
if [ "$ITER_GIVEN" -eq 1 ]; then
  UNCHANGED="false"
  if [ "$ITER" -gt 1 ]; then
    # BASE_STEM, never "$SLUG" again: the previous iteration sits beside this one, under the
    # same stem, and rebuilding that name from a different expression is how this read went
    # looking for a file the writer had stopped producing.
    _prev_iter="$OUT_DIR/$BASE_STEM--iter-$((ITER - 1)).json"
    if [ -f "$_prev_iter" ]; then
      _pv="$(_meta_field "$_prev_iter" screenshot_sha256)" || _pv=""
      [ -n "$_pv" ] && [ "$_pv" = "$SHA" ] && UNCHANGED="true"
    fi
  fi
fi

# Both depths. The flat pattern is not legacy trivia: every meta written before ADR-1402 sits
# at renders/<slug>.json, .claude/state/ is gitignored so those files are on every box that
# ever ran a critique, and they are the ONLY metas that genuinely lack a session field. A
# guard globbing */*.json alone could not see them at all -- so the fail-closed path this ADR
# demanded was unreachable for exactly the population it was written for, and the suite's own
# fixture was planted in a subdirectory production never produced, passing by avoiding the
# real path.
for m in "$RENDER_ROOT"/*.json "$RENDER_ROOT"/*/*.json; do
  [ -f "$m" ] || continue
  case "$m" in "$META") continue;; esac
  _sha_other="$(_meta_field "$m" screenshot_sha256)"; _rc=$?
  # An unreadable or malformed meta is COULD NOT SCAN, which is not the same fact as no
  # duplicate here. Both used to take the same silent `continue`, and an empty result set is
  # the one thing a broken scanner and a clean tree agree on.
  if [ "$_rc" -eq 1 ]; then
    echo "design-render: REFUSED -- could not read meta $m; a meta this guard cannot parse is not evidence of no duplicate." >&2
    rm -f "$PNG" "$META" 2>/dev/null || true
    exit 1
  fi
  [ "$_rc" -eq 0 ] || continue
  [ "$_sha_other" = "$SHA" ] || continue
  other_route="$(_meta_field "$m" route)" || other_route=""
  other_session="$(_meta_field "$m" session)"; _srC=$?
  [ "$_srC" -eq 0 ] || other_session=""
  # A meta with no session field cannot be compared on (route, session). Falling through to
  # the old route-only comparison here is exactly how this ADR would silently revert in code
  # while every line of the spec still read as correct -- so it fails closed instead.
  if [ -z "$other_session" ]; then
    echo "design-render: REFUSED -- meta $m carries no session field; refusing to fall back to route-only comparison." >&2
    echo "Written before ADR-1402, or by a writer that does not set one. Delete it or re-render it." >&2
    rm -f "$PNG" "$META" 2>/dev/null || true
    exit 1
  fi
  if [ "$other_route" != "$ROUTE" ]; then
    # Case 1, unchanged from before: two routes cannot render identically.
    echo "design-render: REFUSED -- these exact pixels are already recorded for '$other_route'." >&2
    echo "Two routes cannot render identically; the browser most likely never left the old page." >&2
    rm -f "$PNG" "$META" 2>/dev/null || true
    exit 1
  fi
  if [ "$other_session" != "$SESSION" ]; then
    # Case 3, which ADR-1417 left unspecified and the simulation gate caught: a crash-retry
    # that minted a fresh session id and produced byte-identical pixels never re-rendered.
    echo "design-render: REFUSED -- these exact pixels are already recorded for route '$ROUTE' in session '$other_session'; a different session re-rendering one route to identical pixels is a retry that never re-rendered." >&2
    rm -f "$PNG" "$META" 2>/dev/null || true
    exit 1
  fi
  # Case 2: same route, same session, same pixels -- not a fault. For a NON-iteration render
  # that is the "nothing changed" result the loop exists to produce.
  #
  # For an ITERATION it is not, and this branch used to override the iteration-aware answer
  # computed above: iter-3 returning to iter-1's pixels matched iter-1 here and was written
  # `unchanged: true`, when iteration 3 had changed a great deal. The iteration comparison is
  # authoritative because ADR-1417 defines the signal against the PREVIOUS iteration, so this
  # branch must not speak for it. The loop still runs, because its three refusal cases apply
  # to iterations exactly as they do to anything else.
  [ "$ITER_GIVEN" -eq 1 ] || UNCHANGED="true"
done

# node writes the JSON so the route/url strings are escaped by a real serialiser rather than
# by printf, which is how a path containing a quote becomes an unparseable meta file.
if command -v node >/dev/null 2>&1; then
  node -e '
    const [route,url,png,sha,vw,vh,recipe,session,iter,unchanged,out] = process.argv.slice(1);
    require("fs").writeFileSync(out, JSON.stringify({
      route, url, png: png.replace(/\\/g,"/"),
      screenshot_sha256: sha, viewport: `${vw}x${vh}@1`, recipe,
      session, iter: iter === "" ? null : Number(iter), unchanged: unchanged === "true",
    }, null, 2) + "\n");
  ' "$ROUTE" "$URL" "${PNG#"$ROOT"/}" "$SHA" "$VW" "$VH" "$RECIPE" "$SESSION" "$ITER" "$UNCHANGED" "$META" \
    || { rm -f "$PNG" "$META" 2>/dev/null; exit 1; }
else
  # This branch already emitted a DIFFERENT, smaller object than the node one above -- no url,
  # no png. Both now carry the three new keys, because a box without node writing a meta the
  # guard cannot read is the twin fix this repo keeps missing.
  if [ -n "$ITER" ]; then _iter_json="$ITER"; else _iter_json="null"; fi
  # Parity of KEYS was achieved here and parity of ESCAPING was not. A route carrying a quote
  # produced unparseable JSON, and a crafted URL route injected a "session" key AHEAD of the
  # real one -- a guard-disabling write on any box without node. The route is the one field
  # with no grammar check upstream, so this branch refuses what it cannot represent rather
  # than emitting a meta the guard will misread.
  case "$ROUTE$URL" in
    *\"*|*\\*) echo "design-render: REFUSED -- no node on this box, and the route contains a quote or backslash this fallback writer cannot escape safely." >&2
       rm -f "$PNG" "$META" 2>/dev/null; exit 1;;
  esac
  printf '{\n  "route": "%s",\n  "url": "%s",\n  "png": "%s",\n  "screenshot_sha256": "%s",\n  "viewport": "%sx%s@1",\n  "recipe": "%s",\n  "session": "%s",\n  "iter": %s,\n  "unchanged": %s\n}\n' \
    "$ROUTE" "$URL" "${PNG#"$ROOT"/}" "$SHA" "$VW" "$VH" "$RECIPE" "$SESSION" "$_iter_json" "$UNCHANGED" > "$META" \
    || { rm -f "$PNG" "$META" 2>/dev/null; exit 1; }
fi

echo "design-render: $ROUTE -> ${PNG#"$ROOT"/}"
echo "  viewport: ${VW}x${VH}@1  recipe: $RECIPE"
echo "  screenshot_sha256: $SHA"

# EXPLICIT, and the last line of the file. Without it this script inherits the status of the
# echo above, so a successful render reported FAILURE whenever stdout was closed or its reader
# had gone (`| head -0` gives 141 on SIGPIPE) -- and design-explore.sh render turns that into
# `rc=1`, reporting a whole variant set as failed when every render worked.
exit 0
