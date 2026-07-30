#!/usr/bin/env bash
# design-explore.sh -- the deterministic bookends of explore mode (REQ-07, frozen plan 2.5).
#
# Explore is theses -> 3 isolated variants -> critique loop -> blind ranking -> owner pick.
# The JUDGMENT in that chain belongs to agents and the owner (director's divergence call,
# critic's findings, jury's rankings, the pick); this script owns everything that must NOT
# be judgment: the scaffold, the recorded base revision, the existence checks, and the
# raw-hex refusal. Same split as design-critique.sh (ADR-0047: agents produce evidence,
# scripts decide the mechanical), because a scaffold left to an agent drifts per run and
# then no two explores are comparable.
#
# Isolation is the ADR-0037 route-namespace fallback (phase-open decision 2026-07-29):
# docs/design/explore/<id>/variant-{a,b,c}/, each with its OWN tokens.css. Real blindness
# comes from fresh-context composers scoped by prompt; nothing merges to main before the
# pick because the whole dir lives on the phase branch.
#
#   design-explore.sh init  <id> --brief <path>   # scaffold + record base SHA + brief
#   design-explore.sh check <id>                  # deterministic gate before critique
#   design-explore.sh render <id>                 # one shared render command, all variants
#   design-explore.sh status <id>                 # where this explore stands
#
# Exit: 0 ok | 1 refused/incomplete. Never 2.
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
DESIGN_DIR="$ROOT/.claude/scripts/design"

CMD="${1:-}"
ID="${2:-}"
shift 2>/dev/null || true
shift 2>/dev/null || true

if [ -z "$CMD" ] || [ -z "$ID" ]; then
  echo "design-explore: usage: design-explore.sh {init|check|render|status} <explore-id> [--brief <path>]" >&2
  exit 1
fi
case "$ID" in
  *[!a-z0-9-]*) echo "design-explore: id '$ID' must be lowercase kebab (it becomes a directory)" >&2; exit 1;;
esac

EX="$ROOT/docs/design/explore/$ID"
VARIANTS="a b c"

case "$CMD" in
  init)
    BRIEF=""
    while [ "$#" -gt 0 ]; do
      case "$1" in --brief) BRIEF="${2:-}"; shift 2;; *) shift;; esac
    done
    if [ -z "$BRIEF" ]; then
      echo "design-explore: init needs --brief <path> — exploration without declared intent is exploration of nothing" >&2
      exit 1
    fi
    # Repo-relative, no traversal: the recorded brief path is read by every later agent in
    # this explore, and a `..` here would let the record point outside the repo (same
    # refusal as critic-scope-check.sh, found by this phase's adversarial pass).
    case "$BRIEF" in
      /*|[A-Za-z]:*|..|../*|*/..|*/../*)
        echo "design-explore: --brief must be a repo-relative path without '..' (got: $BRIEF)" >&2
        exit 1;;
    esac
    if [ ! -f "$ROOT/$BRIEF" ]; then
      echo "design-explore: brief not found at $BRIEF" >&2
      exit 1
    fi
    if [ -d "$EX" ]; then
      # An explore dir is append-only evidence: re-initialising would silently discard the
      # thesis assignments and artifacts of the run that already happened. A new attempt is
      # a NEW id, and the old dir stays as the record of the old attempt.
      echo "design-explore: '$ID' already exists at docs/design/explore/$ID — an explore is evidence, not a scratch dir. Use a new id." >&2
      exit 1
    fi
    BASE="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo no-git)"
    for v in $VARIANTS; do mkdir -p "$EX/variant-$v" || exit 1; done
    printf '%s\n' "$BASE" > "$EX/base-revision.txt"
    {
      echo "id=$ID"
      echo "brief=$BRIEF"
      echo "base=$BASE"
      echo "isolation=route-namespace (ADR-0037 fallback, phase-open decision 2026-07-29)"
    } > "$EX/explore.txt"
    for v in $VARIANTS; do
      # The token file is the variant's ONLY colour authority. It starts empty-but-armed:
      # a composer must declare tokens before painting, and check() enforces it.
      {
        echo "/* variant-$v tokens — the ONLY place colour values live for this variant."
        echo "   thesis: <the composer writes its one-line thesis here>  */"
        echo ":root{"
        echo "}"
      } > "$EX/variant-$v/tokens.css"
    done
    echo "design-explore: scaffolded docs/design/explore/$ID (base $BASE)"
    echo "  next: the director assigns theses + writes matrix.md; composers fill variant-{a,b,c}/"
    ;;

  check)
    [ -d "$EX" ] || { echo "design-explore: no explore '$ID' — run init first" >&2; exit 1; }
    fails=0
    _fail() { fails=$((fails+1)); echo "ERR  [$1] $2"; }

    # IA matrix: EXISTENCE only, plus the director's call being written down. The >=3/7
    # judgment itself is the director's and is never machine-diffed (superseded row 12:
    # string distance proves words differ, not concepts). What IS machine-checked is that a
    # line making the call exists -- the SHAPE of the evidence, never its content.
    #
    # HOLE found live in the first real run (hq-dashboard-v1): the first cut was
    # `grep -qi "director call"`, an anywhere-in-file substring. The director's own matrix
    # explained in prose that "the `Director call:` line is deliberately absent until Phase
    # 2" -- and that sentence satisfied the gate. The gate certified its own absence. Same
    # class as the colour-literal hole below, so the refusal covers the class:
    #   - anchored at line start (after optional blockquote '>' and backtick markdown), so a
    #     sentence merely MENTIONING the phrase can never satisfy it
    #   - must carry the judgment itself (N of 7), so the bare label is not the evidence
    if [ ! -f "$EX/matrix.md" ]; then
      _fail "matrix-missing" "no matrix.md — the IA-difference matrix is the divergence evidence"
    elif ! grep -qiE '^[[:space:]]*>?[[:space:]]*`?Director call:.*[0-9]+[[:space:]]+of[[:space:]]+(the[[:space:]]+)?7' "$EX/matrix.md"; then
      _fail "director-call-missing" "matrix.md carries no written verdict line — need a line that STARTS 'Director call:' and states the judgment, e.g. 'Director call: A/B/C differ materially on 4 of 7 dimensions — <why>.' A sentence mentioning the phrase does not count."
    fi
    # Art-direction divergence is a SECOND, independently-failing call, same grammar and same
    # anti-mention anchoring as above. It exists because structural divergence alone certified
    # a run whose three variants a human could not tell apart: they differed on 7 of 7 IA
    # dimensions and shared one flat visual language, so the loop passed pages nobody could
    # distinguish. Three layouts in one visual language is a failed explore; before this check
    # nothing in the pipeline could say so.
    if [ -f "$EX/matrix.md" ] && \
       ! grep -qiE '^[[:space:]]*>?[[:space:]]*`?Art-direction call:.*[0-9]+[[:space:]]+of[[:space:]]+(the[[:space:]]+)?4' "$EX/matrix.md"; then
      _fail "art-call-missing" "matrix.md carries no art-direction verdict — need a line that STARTS 'Art-direction call:' and states the judgment over the 4 axes (palette · typography · density & rhythm · surface & ornament), e.g. 'Art-direction call: A/B/C differ materially on 3 of 4 axes — <why>.' Structural difference alone is not divergence."
    fi

    for v in $VARIANTS; do
      d="$EX/variant-$v"
      [ -f "$d/thesis.txt" ] || _fail "thesis-missing" "variant-$v has no thesis.txt — a variant without a thesis is styling, not a direction"
      [ -f "$d/index.html" ] || _fail "page-missing" "variant-$v has no index.html"
      [ -f "$d/tokens.css" ] || _fail "tokens-missing" "variant-$v has no tokens.css"
      # Colour literals OUTSIDE the token file: colour smuggled past the variant's own
      # system. The first cut checked hex only, and the adversarial pass walked straight
      # past it three ways -- rgb(255,0,255), hsl(300,...), and `color:magenta` are all the
      # same smuggle in different clothes, so the refusal covers the CLASS: hex, the
      # functional forms, and named colours in a CSS value position. tokens.css is exempt --
      # it is where colour values LIVE. (Guardrail for our own composers, not a security
      # boundary: an exotic named colour in prose position can slip; the render + critic
      # still see the pixels.)
      if [ -d "$d" ]; then
        NAMES='red|blue|green|yellow|orange|purple|pink|magenta|cyan|lime|teal|navy|maroon|olive|silver|gray|grey|black|white|brown|gold|coral|salmon|crimson|indigo|violet|khaki|plum|orchid|turquoise|azure|beige|ivory|lavender|tan|fuchsia|aqua|chartreuse|tomato|wheat'
        COLOUR_PAT="#[0-9a-f]{3,8}\b|(rgb|rgba|hsl|hsla)[[:space:]]*\(|:[[:space:]]*($NAMES)[[:space:]]*[;!}\"')]"
        # An HTML numeric character reference is not a colour. `&#8377;` is the rupee sign, the
        # brief MANDATES ₹ amounts, and `#8377` matches the hex pattern exactly -- so every
        # variant that spelled ₹ as an entity was refused for a colour it does not contain.
        # Found on a real run, not by a constructed test: this gate had been attacked three ways
        # for BYPASSES and never once for over-refusal, which is the same blind spot the design
        # lint had. A gate that refuses correct work is not stricter, it is broken.
        # Candidates come from the same grep as before; each is then re-tested with entities
        # removed, so the reported line and line number stay exactly what the author sees.
        smuggled="$(grep -rniE "$COLOUR_PAT" "$d" --include='*.html' --include='*.css' --include='*.js' 2>/dev/null \
          | grep -v "/tokens.css:" \
          | while IFS= read -r hit; do
              printf '%s\n' "$hit" \
                | sed 's/&#x\{0,1\}[0-9A-Fa-f]\{1,\};/ /g' \
                | grep -qiE "$COLOUR_PAT" && printf '%s\n' "$hit"
            done || true)"
        if [ -n "$smuggled" ]; then
          _fail "colour-literal" "variant-$v carries a colour literal outside tokens.css: $(printf '%s' "$smuggled" | head -1 | cut -c1-100)"
        fi
      fi
    done

    if [ "$fails" -gt 0 ]; then
      echo "design-explore: check FAILED — $fails problem(s) in docs/design/explore/$ID" >&2
      exit 1
    fi
    echo "design-explore: check OK — matrix + director call + 3 variants (thesis, page, tokens-only colour)"
    ;;

  render)
    [ -d "$EX" ] || { echo "design-explore: no explore '$ID'" >&2; exit 1; }
    # ONE command renders every variant (frozen plan 2.5): same recipe, same viewport --
    # otherwise screenshot comparisons are not comparisons. Reuses design-render.sh whole.
    rc=0
    for v in $VARIANTS; do
      page="docs/design/explore/$ID/variant-$v/index.html"
      if [ ! -f "$ROOT/$page" ]; then
        echo "design-explore: variant-$v has no index.html yet — skipping" >&2
        rc=1
        continue
      fi
      bash "$DESIGN_DIR/design-render.sh" "$page" || rc=1
    done
    exit "$rc"
    ;;

  status)
    [ -d "$EX" ] || { echo "design-explore: no explore '$ID'" >&2; exit 1; }
    echo "explore: $ID"
    sed 's/^/  /' "$EX/explore.txt" 2>/dev/null
    for f in matrix.md ranking-1.md ranking-2.md ranking-3.md; do
      printf '  %-14s %s\n' "$f" "$([ -f "$EX/$f" ] && echo present || echo -)"
    done
    for v in $VARIANTS; do
      printf '  variant-%s: thesis=%s page=%s\n' "$v" \
        "$([ -f "$EX/variant-$v/thesis.txt" ] && echo yes || echo no)" \
        "$([ -f "$EX/variant-$v/index.html" ] && echo yes || echo no)"
    done
    ;;

  *)
    echo "design-explore: unknown command '$CMD' (want init|check|render|status)" >&2
    exit 1
    ;;
esac
