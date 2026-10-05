#!/usr/bin/env bash
# design-critique.sh -- the critique runner: everything in a critique run that must NOT be
# the critic's own judgment call (frozen plan 2.3 responsibility split).
#
# The split is the whole point of ADR-0034. The RUNNER arms and releases the write boundary,
# renders, decides PASS/FAIL from the artifact, and stamps the review ledger. The CRITIC
# writes only its critique artifact and emits its own receipt. A critic that could stamp the
# ledger would be approving its own work, which is the thing this cycle exists to make
# impossible.
#
#   design-critique.sh begin  <route> [--viewport WxH]   # arm boundary + render
#   design-critique.sh begin  <route> --brief <path>     # every viewport the brief declares, + its pack
#   design-critique.sh finish <route>                    # judge artifact, stamp, release
#
# `begin` and `finish` are separate because the critic runs BETWEEN them, and the critic is an
# agent spawned by the session -- arc has no headless-claude path, so no shell script can
# spawn it. The slash command is the orchestrator; these two halves are the deterministic
# bookends around it.
#
# PASS is defined once, here: zero VIOLATION and zero BELOW-BAR findings (REQ-03). WEAKNESS and
# POLISH never fail a run; that is what keeps the gate honest instead of theatrical.
# BELOW-BAR was added 2026-07-30: "broke no rule" was the entire definition of PASS for a whole
# cycle, and it certified work the owner scored 23/100. A gate that can only detect rule-breaking
# cannot detect mediocrity, and mediocrity was the actual failure.
#
# Exit: 0 judged (PASS or FAIL, both are results) | 1 refused (no artifact, bad args)
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
DESIGN_DIR="$ROOT/.claude/scripts/design"
CRITIQUE_DIR="docs/design/critique"

CMD="${1:-}"
ROUTE="${2:-}"
shift 2>/dev/null || true
shift 2>/dev/null || true

if [ -z "$CMD" ] || [ -z "$ROUTE" ]; then
  echo "design-critique: usage: design-critique.sh {begin|finish} <route> [--viewport WxH]" >&2
  exit 1
fi

_slug() { printf '%s' "$1" | tr '\\' '/' | sed 's#/#--#g; s#[^A-Za-z0-9-]#-#g' | tr '[:upper:]' '[:lower:]'; }
SLUG="$(_slug "$ROUTE")"

# Newest artifact for this route. Globbed rather than date-computed: a run that crosses
# midnight would otherwise look for a file that does not exist.
_artifact() {
  ls -1t "$ROOT/$CRITIQUE_DIR"/*"$SLUG".md 2>/dev/null | head -1
}

# A run begun with --brief records what finish must hold it to (Phase 03 S2): the brief, its pack, and every
# viewport the brief's platform contract declares. Absent, finish judges exactly as before.
RUN_FILE="$ROOT/.claude/state/design/renders/design-critic/$SLUG.run"

case "$CMD" in
  begin)
    BRIEF=""
    _prev=""
    for _a in "$@"; do
      [ "$_prev" = "--brief" ] && BRIEF="$_a"
      _prev="$_a"
    done
    if [ -n "$BRIEF" ]; then
      for _a in "$@"; do
        [ "$_a" = "--viewport" ] && { echo "design-critique: --brief derives the viewport set from the platform contract; --viewport would override it" >&2; exit 1; }
      done
      [ "$#" -eq 2 ] || { echo "design-critique: begin --brief takes only the brief path" >&2; exit 1; }
      case "$BRIEF" in
        docs/design/briefs/*/brief.md) BRIEF_ID="${BRIEF#docs/design/briefs/}"; BRIEF_ID="${BRIEF_ID%/brief.md}";;
        *) echo "design-critique: --brief must be docs/design/briefs/<id>/brief.md (got $BRIEF)" >&2; exit 1;;
      esac
      case "$BRIEF_ID" in
        ''|*[!abcdefghijklmnopqrstuvwxyz0123456789-]*|-*) echo "design-critique: the brief id '$BRIEF_ID' is not lowercase kebab" >&2; exit 1;;
        # A Windows device name passes the charset and breaks the pack path on one CI leg (S2 attack B1).
        con|prn|aux|nul|com[0-9]|lpt[0-9]) echo "design-critique: the brief id '$BRIEF_ID' is a Windows device name" >&2; exit 1;;
      esac
      # A run record from an earlier begin must never survive a begin that fails: finish would hold the new
      # critique to the old brief (S2 attack B2).
      rm -f "$RUN_FILE" 2>/dev/null
      [ -f "$ROOT/$BRIEF" ] || { echo "design-critique: no brief at $BRIEF" >&2; exit 1; }
      WANT="$(node "$DESIGN_DIR/design-lint.mjs" --viewports "$ROOT/$BRIEF")" || { echo "design-critique: could not derive the viewport set from $BRIEF" >&2; exit 1; }
      # Quoted, then split by tr: an unquoted $WANT is word-split AND globbed against the cwd (S2 attack B3).
      WANT="$(printf '%s\n' "$WANT" | tr ' ' '\n' | grep -E '^[0-9]{2,5}x[0-9]{2,5}$' | tr '\n' ' ' | sed 's/ $//')"
      [ -n "$WANT" ] || { echo "design-critique: $BRIEF declares no viewport -- that is a broken contract, not a pass" >&2; exit 1; }
      bash "$DESIGN_DIR/critic-scope-check.sh" --begin "$ROUTE" || exit 1
      RD="$ROOT/.claude/state/design/renders/design-critic"
      for _vp in $WANT; do
        if ! bash "$DESIGN_DIR/design-render.sh" "$ROUTE" --viewport "$_vp"; then
          bash "$DESIGN_DIR/critic-scope-check.sh" --end >/dev/null 2>&1 || true
          echo "design-critique: render refused at $_vp -- nothing to critique." >&2
          exit 1
        fi
        # design-render names a critique render by route alone, so each viewport is moved under its own name
        # before the next one overwrites it, and its meta is pointed at the moved file.
        mv -f "$RD/$SLUG.png" "$RD/$SLUG--$_vp.png" && sed "s#$SLUG\.png#$SLUG--$_vp.png#" "$RD/$SLUG.json" > "$RD/$SLUG--$_vp.json" && rm -f "$RD/$SLUG.json" \
          || { bash "$DESIGN_DIR/critic-scope-check.sh" --end >/dev/null 2>&1 || true; echo "design-critique: could not keep the $_vp render" >&2; exit 1; }
      done
      printf 'brief=%s\nbrief_id=%s\nviewports=%s\n' "$BRIEF" "$BRIEF_ID" "$WANT" > "$RUN_FILE" \
        || { bash "$DESIGN_DIR/critic-scope-check.sh" --end >/dev/null 2>&1 || true; echo "design-critique: could not record the run" >&2; exit 1; }
      echo ""
      echo "design-critique: ready for the critic."
      echo "  route:    $ROUTE"
      echo "  brief:    $BRIEF"
      for _vp in $WANT; do echo "  render:   .claude/state/design/renders/design-critic/$SLUG--$_vp.png  (meta alongside)"; done
      echo "  pack:     .claude/state/design/refpacks/$BRIEF_ID/  and  docs/design/refpacks/$BRIEF_ID/sources.md"
      echo "  artifact: $CRITIQUE_DIR/$(date +%Y-%m-%d)-$SLUG.md   <- the critic writes ONLY here"
      echo "  rules:    one '## Viewport WxH' section per viewport; every BELOW-BAR cites pack:<sha16>"
      echo ""
      echo "Next: spawn the design-critic agent, then run:"
      echo "  bash .claude/scripts/design/design-critique.sh finish $ROUTE"
      exit 0
    fi
    rm -f "$RUN_FILE" 2>/dev/null
    bash "$DESIGN_DIR/critic-scope-check.sh" --begin "$ROUTE" || exit 1
    # Whitelist what is forwarded. This function hardcodes the meta/render READ path below,
    # and --session/--iter/--mode move the renderer WRITE path -- so forwarding them blind
    # would have the critic judging a stale PNG from a previous run, or nothing at all, and
    # sealing that into a receipt.
    for _a in "$@"; do
      case "$_a" in
        --session|--iter|--mode)
          echo "design-critique: $_a is not forwardable -- it moves the render output path this command reads from." >&2
          bash "$DESIGN_DIR/critic-scope-check.sh" --end >/dev/null 2>&1 || true
          exit 1;;
      esac
    done
    if ! bash "$DESIGN_DIR/design-render.sh" "$ROUTE" "$@"; then
      # A failed render must not leave the boundary armed, or every later edit in the session
      # blocks for a reason nobody can see.
      bash "$DESIGN_DIR/critic-scope-check.sh" --end >/dev/null 2>&1 || true
      echo "design-critique: render refused -- nothing to critique." >&2
      exit 1
    fi
    # design-render.sh writes SESSION-scoped since ADR-1402. Critique keeps the fixed
    # literal it has always used, so this path is stable -- but it is READ here, which is
    # why the caller sweep has to cover consumers and not only invocations.
    META="$ROOT/.claude/state/design/renders/design-critic/$SLUG.json"
    echo ""
    echo "design-critique: ready for the critic."
    echo "  route:    $ROUTE"
    echo "  render:   .claude/state/design/renders/design-critic/$SLUG.png"
    echo "  meta:     ${META#"$ROOT"/}"
    echo "  artifact: $CRITIQUE_DIR/$(date +%Y-%m-%d)-$SLUG.md   <- the critic writes ONLY here"
    echo ""
    echo "Next: spawn the design-critic agent, then run:"
    echo "  bash .claude/scripts/design/design-critique.sh finish $ROUTE"
    ;;

  finish)
    ART="$(_artifact)"
    # Release the boundary FIRST and unconditionally: whatever happens to the verdict below,
    # leaving the boundary armed would block the creation side from fixing what was found.
    bash "$DESIGN_DIR/critic-scope-check.sh" --end >/dev/null 2>&1 || true

    if [ -z "$ART" ] || [ ! -f "$ART" ]; then
      echo "design-critique: REFUSED -- no critique artifact found for $ROUTE." >&2
      echo "Expected $CRITIQUE_DIR/<date>-$SLUG.md. No artifact means no critique happened;" >&2
      echo "a run with nothing to read is not a PASS." >&2
      exit 1
    fi

    # VIOLATION counted only where a finding is DECLARED -- at the start of a list item or a
    # heading. Counting the bare word anywhere would let the sentence "no VIOLATION findings"
    # fail its own clean run, and prose about violations is not a finding.
    VIOLATIONS="$(grep -cE '^[[:space:]]*([-*+][[:space:]]+|#+[[:space:]]*|[0-9]+\.[[:space:]]+)?\**VIOLATION\**[[:space:]]*:' "$ART" 2>/dev/null || true)"
    case "$VIOLATIONS" in ''|*[!0-9]*) VIOLATIONS=0;; esac

    # BELOW-BAR: compliant, and not good enough to ship. Counted with the same declared-finding
    # anchoring as VIOLATION, and it fails a run just as hard.
    #
    # This class exists because for a whole cycle PASS meant "broke no rule" and nothing else.
    # A characterless page cleared every contract five runs running and the owner scored the
    # result 23/100. WEAKNESS and POLISH could not carry it -- by design they never fail a run --
    # so the critic had no way to make "this is not good enough" reach a verdict, and the loop
    # certified work nobody would ship. An absence of violations is not quality.
    # Case-INSENSITIVE, unlike the VIOLATION counter above, and deliberately so. A miscased
    # quality finding that silently vanishes is precisely the failure this class was added to
    # fix; a stray prose line starting "below-bar:" merely fails a run, which is the safe
    # direction to be wrong in.
    BELOW_BAR="$(grep -ciE '^[[:space:]]*([-*+][[:space:]]+|#+[[:space:]]*|[0-9]+\.[[:space:]]+)?\**BELOW-BAR\**[[:space:]]*:' "$ART" 2>/dev/null || true)"
    case "$BELOW_BAR" in ''|*[!0-9]*) BELOW_BAR=0;; esac

    UNJUDGED=""
    if [ -f "$RUN_FILE" ]; then
      RUN_BRIEF_ID="$(sed -n 's/^brief_id=//p' "$RUN_FILE" | head -1)"
      RUN_VPS="$(sed -n 's/^viewports=//p' "$RUN_FILE" | head -1)"
      SOURCES="$ROOT/docs/design/refpacks/$RUN_BRIEF_ID/sources.md"
      # Every BELOW-BAR is anchored to the pack: a bar nobody can point at is taste, not a bar (ADR-1405). Refused,
      # not failed: an unanchored finding is an unfinished critique, and a verdict over it would be a guess.
      _bad=""
      while IFS= read -r _line; do
        [ -n "$_line" ] || continue
        _cites="$(printf '%s\n' "$_line" | grep -oE 'pack:[0-9a-f]{16}' | sed 's/^pack://')"
        if [ -z "$_cites" ]; then _bad="$_bad
    no pack screen cited: $(printf '%s' "$_line" | cut -c1-120)"; continue; fi
        for _c in $_cites; do
          grep -qE "\| *$_c[0-9a-f]{48} *\|" "$SOURCES" 2>/dev/null || _bad="$_bad
    pack:$_c is not a screen in $RUN_BRIEF_ID's pack"
        done
      done <<EOF_BB
$(grep -iE '^[[:space:]]*([-*+][[:space:]]+|#+[[:space:]]*|[0-9]+\.[[:space:]]+)?\**BELOW-BAR\**[[:space:]]*:' "$ART" 2>/dev/null)
EOF_BB
      if [ -n "$_bad" ]; then
        echo "design-critique: REFUSED -- a BELOW-BAR finding is not anchored to the pack:$_bad" >&2
        echo "Cite the screen it falls short of as pack:<sha16> (docs/design/refpacks/$RUN_BRIEF_ID/sources.md), then run finish again." >&2
        exit 1
      fi
      # Every declared viewport is judged, or the run cannot PASS (moved here from Phase 01, 2026-09-17).
      for _vp in $RUN_VPS; do
        grep -qE "^## Viewport $_vp[[:space:]]*$" "$ART" || UNJUDGED="$UNJUDGED $_vp"
      done
    fi
    if [ "$VIOLATIONS" -eq 0 ] && [ "$BELOW_BAR" -eq 0 ] && [ -z "$UNJUDGED" ]; then RESULT="PASS"; else RESULT="FAIL"; fi

    SHA="$(sed -n 's/.*screenshot_sha256[^a-f0-9]*\([a-f0-9]\{16,64\}\).*/\1/p' "$ART" | head -1)"
    [ -n "$SHA" ] || SHA="unrecorded"

    # The receipt goes on the spine in the CLOSED vocabulary (ADR-0026/0035): review.completed
    # carrying the design lens. `target` is the key the gate matches on, so it is the
    # repo-relative route exactly as passed in -- not a slug, not a display name.
    if command -v node >/dev/null 2>&1; then
      PAYLOAD="$(node -e '
        const [lens,target,result,sha] = process.argv.slice(1);
        process.stdout.write(JSON.stringify({lens,target,result,screenshot_sha256:sha}));
      ' design "$ROUTE" "$RESULT" "$SHA")"
    else
      PAYLOAD="{\"lens\":\"design\",\"target\":\"$ROUTE\",\"result\":\"$RESULT\",\"screenshot_sha256\":\"$SHA\"}"
    fi
    bash "$ROOT/.claude/scripts/hq/arc-event.sh" emit review.completed --payload "$PAYLOAD" >/dev/null 2>&1 || true

    # Stamped ONLY on PASS. This is the line that makes the ledger mean something.
    if [ "$RESULT" = "PASS" ]; then
      bash "$ROOT/.claude/scripts/core/review-ledger.sh" stamp design >/dev/null 2>&1 || true
    fi

    echo "design-critique: $RESULT -- $ROUTE"
    echo "  artifact:   ${ART#"$ROOT"/}"
    echo "  violations: $VIOLATIONS"
    echo "  below-bar:  $BELOW_BAR"
    [ -n "$UNJUDGED" ] && echo "  unjudged:  $UNJUDGED -- a declared viewport with no '## Viewport' section cannot PASS"
    rm -f "$RUN_FILE" 2>/dev/null
    echo "  screenshot_sha256: $SHA"
    if [ "$RESULT" = "PASS" ]; then
      echo "  ledger:     design stamped for $(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo no-git)"
    else
      echo "  ledger:     NOT stamped -- the creation side fixes, then the critic re-verifies (ADR-0034)"
    fi
    ;;

  *)
    echo "design-critique: unknown command '$CMD' (want begin|finish)" >&2
    exit 1
    ;;
esac
