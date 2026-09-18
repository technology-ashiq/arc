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

case "$CMD" in
  begin)
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

    if [ "$VIOLATIONS" -eq 0 ] && [ "$BELOW_BAR" -eq 0 ]; then RESULT="PASS"; else RESULT="FAIL"; fi

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
