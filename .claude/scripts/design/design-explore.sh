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
#   design-explore.sh compose <id> --variant <x>  # ARM the composer read boundary
#   design-explore.sh compose-done <id> --variant <x> [--brief <path>]
#                                                 # release it, then run the composer gates
#   design-explore.sh render <id>                 # one shared render command, all variants
#   design-explore.sh status <id>                 # where this explore stands
#   design-explore.sh surfaces|coverage|selfreview <id>   # the REQ-03 / REQ-02b gates
#
# compose/compose-done are the bookends, and they are the reason the gates are reachable at
# all: the three of them shipped with zero production callers, so nothing armed the marker
# and the read hook was a no-op everywhere except its own tests.
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
  echo "design-explore: usage: design-explore.sh {init|check|compose|compose-done|render|status|surfaces|coverage|selfreview} <explore-id> [--variant <x>] [--brief <path>]" >&2
  exit 1
fi
# Characters spelled out, not `a-z`: a bracket range resolves through the locale's
# collation table, which on macOS interleaves case, so `[!a-z0-9-]` did not fire for
# `Design` and the id was accepted on one OS and refused on the others -- then collided
# with an existing `design` explore on a case-insensitive filesystem. Same defect this
# commit fixes in lane-resolve.sh; pinned by tests/portability.bats.
case "$ID" in
  *[!abcdefghijklmnopqrstuvwxyz0123456789-]*) echo "design-explore: id '$ID' must be lowercase kebab (it becomes a directory)" >&2; exit 1;;
esac

EX="$ROOT/docs/design/explore/$ID"
VARIANTS="a b c"

case "$CMD" in
  init)
    BRIEF=""
    # `shift 2` with one argument left FAILS and shifts nothing; set -e is off, so the loop
    # re-reads the same $1 until the CI job times out. This is the identical defect
    # design-render.sh documents in a nine-line comment, that five of its tests pin, and that
    # this file's own `coverage` branch fixes correctly 160 lines below. Written twice in one
    # tree and not carried to the sibling loop -- the twin-fix shape, third time this cycle.
    # The catch-all is a refusal for the same reason: `--breif docs/x.md` used to vanish and
    # report "init needs --brief", which is an omitted flag wearing a typo's clothes.
    while [ "$#" -gt 0 ]; do
      case "$1" in
        --brief) [ "$#" -ge 2 ] || { echo "design-explore: --brief needs a value" >&2; exit 1; }; BRIEF="$2"; shift 2;;
        *) echo "design-explore: unknown argument '$1'" >&2; exit 1;;
      esac
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

  surfaces)
    # REQ-03 / ADR-1407: product canvas vs documentation, decided by MARKER.
    #
    # The judgment lives in design-lint.mjs, which already owns every parser in this product.
    # A second implementation here would be the twin-fix shape: two readers of one contract,
    # drifting apart the first time either is touched.
    [ -d "$EX" ] || { echo "design-explore: no explore '$ID' -- run init first" >&2; exit 1; }
    sfails=0
    seen=0
    for v in $VARIANTS; do
      page="$EX/variant-$v/index.html"
      # EX is already absolute; prefixing $ROOT again would look plausible and resolve nowhere.
      [ -f "$page" ] || continue
      seen=$((seen + 1))
      node "$DESIGN_DIR/design-lint.mjs" --surfaces "$page" || sfails=$((sfails + 1))
    done
    # Nothing to check is a MESSAGE, never a silent pass. An empty result set is the one
    # thing a broken scanner and a clean tree agree on, and this lane has shipped that.
    if [ "$seen" -eq 0 ]; then
      echo "design-explore: no variant pages found under $EX -- nothing to classify (this is not a pass)" >&2
      exit 1
    fi
    [ "$sfails" -eq 0 ] || { echo "design-explore: $sfails variant(s) failed the surface gate"; exit 1; }
    echo "design-explore: surfaces ok across $seen variant(s)"
    exit 0
    ;;

  coverage)
    # REQ-03 / ADR-1403: every viewport the brief DECLARES must actually have been rendered.
    #
    # Cycle 3 rendered desktop only while section C sat there declaring surfaces nobody
    # consumed. This is the control that makes the declaration load-bearing: a
    # declared-but-unrendered surface is a run gap, and a run gap blocks PASS.
    [ -d "$EX" ] || { echo "design-explore: no explore '$ID' -- run init first" >&2; exit 1; }
    BRIEF=""
    while [ "$#" -gt 0 ]; do
      case "$1" in
        --brief) [ "$#" -ge 2 ] || { echo "design-explore: --brief needs a value" >&2; exit 1; }; BRIEF="$2"; shift 2;;
        *) echo "design-explore: unknown argument '$1'" >&2; exit 1;;
      esac
    done
    if [ -z "$BRIEF" ]; then
      echo "design-explore: coverage needs --brief <path> -- the viewport set is DERIVED from the platform contract, never assumed" >&2
      exit 1
    fi
    # init resolves the brief against $ROOT; this handed it straight to node, cwd-relative, so
    # the same relative path worked in one subcommand and failed in the other whenever the
    # caller was not standing at the repo root. Traversal is refused here as init refuses it.
    case "$BRIEF" in
      ..|../*|*/..|*/../*) echo "design-explore: --brief may not contain a '..' segment" >&2; exit 1;;
    esac
    case "$BRIEF" in /*|[A-Za-z]:*) ;; *) BRIEF="$ROOT/$BRIEF";; esac
    WANT="$(node "$DESIGN_DIR/design-lint.mjs" --viewports "$BRIEF")" || {
      echo "design-explore: could not derive the viewport set from $BRIEF" >&2
      exit 1
    }
    # An empty derived set would make the loop below never iterate and report a clean pass --
    # the exact shape the surfaces branch spells out twenty lines above ("an empty result set
    # is the one thing a broken scanner and a clean tree agree on").
    if [ -z "$WANT" ]; then
      echo "design-explore: derived an EMPTY viewport set from $BRIEF -- that is a broken contract, not a pass" >&2
      exit 1
    fi
    cfails=0
    cseen=0
    for v in $VARIANTS; do
      [ -f "$EX/variant-$v/index.html" ] || continue
      cseen=$((cseen + 1))
      sess="$ID--variant-$v"
      rdir="$ROOT/.claude/state/design/renders/$sess"
      for want in $WANT; do
        # The meta records viewport as WxH@1; match that exact shape rather than a substring,
        # so 390x844 can never be satisfied by 1390x8440.
        if ! grep -qs "\"viewport\": \"$want@1\"" "$rdir"/*.json; then
          echo "ERR  [viewport-gap] variant-$v: the brief declares $want and no render at that viewport exists in $sess"
          cfails=$((cfails + 1))
        fi
      done
    done
    if [ "$cseen" -eq 0 ]; then
      echo "design-explore: no variant pages found under $EX -- nothing to cover (this is not a pass)" >&2
      exit 1
    fi
    [ "$cfails" -eq 0 ] || { echo "design-explore: $cfails declared-but-unrendered surface(s) -- a contract the run never rendered is one nobody signed"; exit 1; }
    echo "design-explore: coverage ok -- every declared viewport rendered across $cseen variant(s)"
    exit 0
    ;;

  selfreview)
    # REQ-02b / ADR-1401: the self-review manifest, checked against the ARTIFACTS.
    #
    # "Iteration 2 fixed what iteration 1 found" has to be provable from the hashes, not
    # narrated in prose. The lane's own history is the reason this is a gate and not a
    # convention: a whole cycle of critiques, rankings, receipts and a sealed prediction was
    # built on pixels nobody in the session ever opened, and the owner scored it 23/100.
    [ -d "$EX" ] || { echo "design-explore: no explore '$ID' -- run init first" >&2; exit 1; }
    rfails=0
    for v in $VARIANTS; do
      srdir="$EX/variant-$v/self-review"
      sess="$ROOT/.claude/state/design/renders/$ID--variant-$v"
      # A variant composed in one pass has nothing to prove. Absence is not a failure; only
      # a CLAIM that cannot be substantiated is.
      #
      # But absence has two shapes and only one of them is innocent. If the session holds
      # ITERATION receipts, iterations happened -- and a missing self-review/ then means
      # nothing records what they were for, which is the gate's whole subject arriving as a
      # silent pass. Opt-in is not fail-closed. So: no iterations, no obligation; iterations
      # with no manifest directory, refused.
      if [ ! -d "$srdir" ]; then
        _iters=0
        for _im in "$sess"/*--iter-*.json; do
          [ -f "$_im" ] || continue
          _iters=$((_iters + 1))
        done
        if [ "$_iters" -gt 0 ]; then
          echo "ERR  [selfreview-dir-missing] variant-$v: $_iters iteration receipt(s) in $ID--variant-$v and no self-review/ directory -- iterations happened and nothing records what they were for"
          rfails=$((rfails + 1))
        fi
        continue
      fi
      man="$srdir/manifest.md"
      if [ ! -f "$man" ]; then
        echo "ERR  [selfreview-manifest-missing] variant-$v: a self-review/ directory with no manifest.md -- iterations happened and nothing records what they were for"
        rfails=$((rfails + 1))
        continue
      fi
      # `sess` is set once, above the self-review/ check, because that check now reads the
      # session too. A second assignment here would be a second place to keep in step.

      # Read a meta's published hash. Anchored to the whole pretty-printed line: an
      # unanchored match would let any line mentioning the key decide the comparison.
      # tr -d '\r' first: the $ anchor below cannot match past a CR, so a CRLF meta would
      # yield an empty hash and fail every row with "the render published ". MSYS2 sed strips
      # the CR silently, so the Windows leg reads clean while ubuntu and macOS fail -- an
      # OS-asymmetric gate no Windows-authored test can pin.
      _sha_of() { tr -d '\r' < "$1" 2>/dev/null | sed -n 's/^[[:space:]]*"screenshot_sha256": "\(.*\)",\{0,1\}[[:space:]]*$/\1/p' | head -1; }
      # The iteration's meta, found by GLOB rather than by recomputing the slug. _slug()
      # already exists in design-render.sh and design-critique.sh; a third copy is the
      # twin-fix shape, and this needs the file, not the name.
      # `ls ... | head -1` picks by LC_COLLATE when a session holds more than one route, so a
      # second page rendered into the same session made the gate compare the WRONG meta -- and
      # which one wins differs between ubuntu, macOS and Git Bash, so one manifest passes on
      # one leg and fails on another. design-render.sh already refuses when more than one line
      # matches; same lesson, now carried. Ambiguity is a refusal, never a pick.
      # Read the pixel WIDTH out of a meta's "viewport": "1440x900@1" line. Same tr -d '\r'
      # and same whole-line anchoring as _sha_of above, for the same reason.
      _vw_of() {
        tr -d '\r' < "$1" 2>/dev/null \
          | sed -n 's/^[[:space:]]*"viewport": "\([0-9][0-9]*\)x[0-9][0-9]*@.*$/\1/p' | head -1
      }
      # ONE meta per iteration -- but "one" stopped meaning "one file" when the renderer began
      # writing a viewport component, which ADR-1403 requires: desktop and mobile in a single
      # iteration are two metas and NEITHER is a decoy.
      #
      # Refusing on any multiple was right while a second file could only be a second ROUTE
      # (the `ls | head -1` defect: LC_COLLATE decided the comparison, so a manifest passed on
      # one OS leg and failed on another). It is wrong now, and the fix is not "pick one" --
      # it is answering what a self-review row CLAIMS about. The row is the composer's judgment
      # on the page it designed, so it claims about the primary surface: the WIDEST viewport of
      # that iteration. coverage separately proves the narrow surface was rendered at all.
      #
      # Two metas at the SAME width is the original defect unchanged -- two routes in one
      # session -- and still refuses. Resolving the viewport case must not resolve that one.
      _meta_for() {
        _mf_n=0; _mf_hit=""; _mf_w=-1; _mf_tie=0
        for _mf in "$sess"/*--iter-"$1".json; do
          [ -f "$_mf" ] || continue
          _mf_n=$((_mf_n + 1))
          _mf_this="$(_vw_of "$_mf")"
          # A meta with no readable viewport cannot be ranked, so it can never win on width.
          # Treated as width 0 rather than skipped: it still COUNTS, so two unreadable metas
          # tie at 0 and refuse instead of quietly leaving one candidate standing.
          [ -n "$_mf_this" ] || _mf_this=0
          if [ "$_mf_this" -gt "$_mf_w" ] 2>/dev/null; then
            _mf_w="$_mf_this"; _mf_hit="$_mf"; _mf_tie=0
          elif [ "$_mf_this" -eq "$_mf_w" ] 2>/dev/null; then
            _mf_tie=1
          fi
        done
        [ "$_mf_n" -eq 0 ] && return 1
        [ "$_mf_tie" -eq 0 ] || { echo "AMBIGUOUS"; return 0; }
        printf '%s' "$_mf_hit"
      }

      # Every iteration on disk past the first OWES a row. Without this, a manifest that
      # merely mentions a table in prose satisfies the gate by looking like one -- the
      # cosmetic-variant class this repo has logged twice.
      for m in "$sess"/*--iter-*.json; do
        [ -f "$m" ] || continue
        n="$(printf '%s' "$m" | sed -n 's/.*--iter-\([0-9]*\)\.json$/\1/p')"
        [ -n "$n" ] || continue
        [ "$n" -ge 2 ] 2>/dev/null || continue
        # One pattern, not two: the second subsumed the first ([[:space:]]* matches zero), so
        # the pair read as two cases and was one, which is how a dead branch survives review.
        if ! grep -qE "^[[:space:]]*\|[[:space:]]*$n[[:space:]]*\|[[:space:]]*[0-9a-f]{8,}" "$man" 2>/dev/null; then
          echo "ERR  [selfreview-row-missing] variant-$v: iteration $n was rendered and the manifest carries no row for it"
          rfails=$((rfails + 1))
        fi
      done

      # Now judge the rows that ARE there. Anchored at line start so a sentence quoting a
      # row can never be one.
      while IFS= read -r line; do
        [ -n "$line" ] || continue
        # Field COUNT first. An escaped pipe inside a prose cell (legal CommonMark) shifts
        # every field right, so the defect/revision checks silently read the wrong cells and an
        # empty revision substantiated a row. A row whose shape is not the shape is refused,
        # rather than parsed into something that looks plausible.
        nf="$(printf '%s' "$line" | awk -F'|' '{print NF}')"
        case "$nf" in
          7|8) ;;
          *) echo "ERR  [selfreview-row-shape] a manifest row splits into $nf fields -- five cells and nothing else, and a literal pipe inside a cell is not supported"
             rfails=$((rfails + 1)); continue;;
        esac
        # [[:space:]], not a literal space: a tab-delimited row was selected by the grep above
        # and then failed with an unusable message.
        n="$(printf '%s' "$line" | awk -F'|' '{gsub(/[[:space:]]/,"",$2); print $2}')"
        inh="$(printf '%s' "$line" | awk -F'|' '{gsub(/[[:space:]]/,"",$3); print $3}')"
        outh="$(printf '%s' "$line" | awk -F'|' '{gsub(/[[:space:]]/,"",$4); print $4}')"
        defect="$(printf '%s' "$line" | awk -F'|' '{print $5}' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"
        revision="$(printf '%s' "$line" | awk -F'|' '{print $6}' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"

        if [ -z "$defect" ] || [ -z "$revision" ]; then
          echo "ERR  [selfreview-empty] variant-$v iteration $n: the defect and revision cells are the whole point of the row"
          rfails=$((rfails + 1)); continue
        fi

        cur="$(_meta_for "$n")"
        if [ "$cur" = "AMBIGUOUS" ]; then
          echo "ERR  [selfreview-ambiguous] variant-$v: more than one render meta matches iteration $n in $sess -- refusing to pick one by directory order"
          rfails=$((rfails + 1)); continue
        fi
        if [ -z "$cur" ]; then
          echo "ERR  [selfreview-no-render] variant-$v: the manifest claims iteration $n and there is no render meta for it"
          rfails=$((rfails + 1)); continue
        fi
        prev_n=$((n - 1))
        prev="$(_meta_for "$prev_n")"
        if [ "$prev" = "AMBIGUOUS" ]; then
          echo "ERR  [selfreview-ambiguous] variant-$v: more than one render meta matches iteration $prev_n in $sess"
          rfails=$((rfails + 1)); continue
        fi
        if [ -z "$prev" ]; then
          echo "ERR  [selfreview-no-render] variant-$v: iteration $n names iteration $prev_n as its input and there is no render meta for it"
          rfails=$((rfails + 1)); continue
        fi

        real_out="$(_sha_of "$cur")"
        real_in="$(_sha_of "$prev")"
        if [ "$outh" != "$real_out" ]; then
          echo "ERR  [selfreview-output-hash] variant-$v iteration $n: the manifest names output $outh and the render published $real_out"
          rfails=$((rfails + 1)); continue
        fi
        if [ "$inh" != "$real_in" ]; then
          echo "ERR  [selfreview-input-hash] variant-$v iteration $n: the manifest names input $inh and iteration $prev_n published $real_in"
          rfails=$((rfails + 1)); continue
        fi

        # The load-bearing rule. Identical hashes mean the pixels did not move, so nothing was
        # visibly fixed -- and a row claiming otherwise is the narrated verdict this gate
        # exists to refuse. An honest null claim ("unchanged") is accepted: under ADR-1417
        # "nothing changed" is a first-class RESULT, not a fault.
        if [ "$inh" = "$outh" ]; then
          case "$(printf '%s' "$defect" | tr 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' 'abcdefghijklmnopqrstuvwxyz')" in
            unchanged*) ;;
            *)
              echo "ERR  [selfreview-unchanged-claim] variant-$v iteration $n: input and output hashes are identical, so the pixels did not move -- a row may not claim it fixed '$defect'"
              rfails=$((rfails + 1));;
          esac
        fi
      done <<EOF
$(grep -E "^[[:space:]]*\|[[:space:]]*[0-9]+[[:space:]]*\|" "$man" 2>/dev/null || true)
EOF
    done
    [ "$rfails" -eq 0 ] || { echo "design-explore: $rfails self-review error(s)"; exit 1; }
    echo "design-explore: self-review manifests substantiated"
    exit 0
    ;;

  compose|compose-done)
    # THE BOOKENDS THAT ARM THE BOUNDARY -- and the reason they exist at all.
    #
    # Phase 01 shipped three gates and wired none of them. `grep -rn` across commands,
    # skills, processes, hooks and CI found ZERO callers of composer-scope-check.sh --begin
    # and ZERO callers of surfaces|coverage|selfreview outside tests/. Nothing armed the
    # marker, so `[ -f "$MARKER" ] || exit 0` made the read hook a permanent no-op in
    # production. Every one of those slices was green on CI, which is exactly the distinction
    # this repo already writes down: a green matrix is evidence the assertions held, never
    # evidence a guard guards.
    #
    # The shape is not invented here. design-critique.sh begin/finish already arms the
    # CRITIC's boundary, runs the work, and releases it -- and the design-critic contract
    # says "invoked between begin and finish". This is that pattern for the composer.
    [ -d "$EX" ] || { echo "design-explore: no explore '$ID' -- run init first" >&2; exit 1; }
    V=""
    BRIEF=""
    while [ "$#" -gt 0 ]; do
      case "$1" in
        --variant) [ "$#" -ge 2 ] || { echo "design-explore: --variant needs a value" >&2; exit 1; }; V="$2"; shift 2;;
        --brief)   [ "$#" -ge 2 ] || { echo "design-explore: --brief needs a value" >&2; exit 1; }; BRIEF="$2"; shift 2;;
        *) echo "design-explore: unknown argument '$1'" >&2; exit 1;;
      esac
    done
    # Spelled out rather than a bracket range, for the reason the id check 380 lines above
    # already carries: a range resolves through LC_COLLATE and macOS interleaves case.
    case "$V" in
      "") echo "design-explore: $CMD needs --variant <x> -- a boundary that cannot say which variant it protects is not a boundary" >&2; exit 1;;
      *[!abcdefghijklmnopqrstuvwxyz0123456789-]*) echo "design-explore: variant '$V' must be lowercase kebab" >&2; exit 1;;
    esac
    [ -d "$EX/variant-$V" ] || { echo "design-explore: no variant-$V under $EX" >&2; exit 1; }

    if [ "$CMD" = "compose" ]; then
      bash "$DESIGN_DIR/composer-scope-check.sh" --begin "$ID" "variant-$V" || exit 1
      echo ""
      echo "design-explore: read boundary ARMED for $ID variant-$V."
      echo "  writes:  docs/design/explore/$ID/variant-$V/"
      echo "  reads:   that dir, .claude/state/design/renders/$ID--variant-$V/,"
      echo "           .claude/state/design/refpacks/$ID/   -- and nothing else"
      echo "  renders: bash .claude/scripts/design/design-render.sh <page> --mode explore --session $ID--variant-$V --iter N"
      echo ""
      echo "Next: spawn the ui-composer agent for variant-$V, then run:"
      echo "  bash .claude/scripts/design/design-explore.sh compose-done $ID --variant $V"
      exit 0
    fi

    # compose-done. Release FIRST and unconditionally: design-critique.sh learned this the
    # hard way -- whatever the gates below decide, a boundary left armed blocks every later
    # read in the session for a reason nobody can see.
    bash "$DESIGN_DIR/composer-scope-check.sh" --end >/dev/null 2>&1 || true

    gfails=0
    page="$EX/variant-$V/index.html"
    if [ ! -f "$page" ]; then
      echo "ERR  [compose-no-page] variant-$V has no index.html -- a composer that wrote nothing is not a composer that finished"
      gfails=$((gfails + 1))
    else
      node "$DESIGN_DIR/design-lint.mjs" --surfaces "$page" || gfails=$((gfails + 1))
    fi
    # The self-review gate runs over the whole explore rather than this variant alone: its
    # loop already skips a variant with nothing to prove, and scoping it here would need a
    # second spelling of the same walk.
    bash "$0" selfreview "$ID" || gfails=$((gfails + 1))
    # coverage only when the caller names the brief, because the viewport set is DERIVED from
    # the platform contract and a defaulted set is how the contract stopped being consumed.
    if [ -n "$BRIEF" ]; then
      bash "$0" coverage "$ID" --brief "$BRIEF" || gfails=$((gfails + 1))
    fi

    [ "$gfails" -eq 0 ] || { echo "design-explore: variant-$V did not clear the composer gates ($gfails failing)" >&2; exit 1; }
    echo "design-explore: boundary released and variant-$V cleared the composer gates"
    exit 0
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
      # --mode explore --session <id>--variant-<v> is not optional decoration.
      #
      # Called bare, design-render.sh defaults MODE to critique and SESSION to design-critic,
      # so every variant landed in renders/design-critic/ -- overwriting each other -- while
      # coverage and selfreview read renders/<id>--variant-<v>. `render <id>` followed by
      # `coverage <id>` therefore ALWAYS reported a viewport gap, and selfreview saw no metas
      # at all. The one command that renders every variant was the one command whose output
      # nothing consumed. Since ADR-1402 explore mode REQUIRES --session, so this is also the
      # only spelling the renderer will accept in the mode these gates read.
      bash "$DESIGN_DIR/design-render.sh" "$page" --mode explore --session "$ID--variant-$v" || rc=1
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
    echo "design-explore: unknown command '$CMD' (want init|check|compose|compose-done|render|status|surfaces|coverage|selfreview)" >&2
    exit 1
    ;;
esac
