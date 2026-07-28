#!/usr/bin/env bash
# design-gate.sh -- REQ-04: UI-bearing changes without a design review get FLAGGED, never blocked.
#
# The gate asks one question: does every route that has been critiqued in this repo carry a
# design receipt on the spine? A critique artifact with no receipt means a review happened and
# left no trace anybody can see in the daily brief -- which is the failure this cycle is about.
#
# WARN-ONLY THIS CYCLE (v3.5 WARN-first doctrine, arc.gates.yaml mode: warn):
#   0 -- every critiqued route has its receipt (or nothing has been critiqued)
#   1 -- a critiqued route is missing its receipt, OR the spine could not be read (WARN)
#   never 2 -- promotion to blocking needs a retro plus the owner's OK, not a code change here.
# A reader error resolves to 1 rather than 0 on purpose: "I could not check" must never be
# reported as "checked and fine".
#
# Evidence: .claude/state/design/gate.txt
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
CRITIQUE_DIR="$ROOT/docs/design/critique"
EVIDENCE="$ROOT/.claude/state/design/gate.txt"
mkdir -p "$(dirname "$EVIDENCE")" 2>/dev/null || true

_write_evidence() { printf '%s\n' "$1" > "$EVIDENCE" 2>/dev/null || true; }

# Nothing critiqued -> nothing to enforce. A repo with no design work must not nag.
have_any=0
for f in "$CRITIQUE_DIR"/*.md; do [ -f "$f" ] && { have_any=1; break; }; done
if [ "$have_any" -eq 0 ]; then
  _write_evidence "design-gate: OK -- no critique artifacts in docs/design/critique/, nothing to enforce."
  exit 0
fi

if ! command -v node >/dev/null 2>&1; then
  msg="design-gate: WARN -- node not on PATH, cannot read the spine; design receipts unverified."
  _write_evidence "$msg"; echo "$msg" >&2
  exit 1
fi

# Read receipts through the reader ONLY (ADR-0030: the spine's reader is arc's public API; a
# gate that greps events/*.jsonl is exactly the bypass spine-reader-lint exists to catch).
READER="$ROOT/.claude/scripts/hq/spine.mjs"
if [ ! -f "$READER" ]; then
  msg="design-gate: WARN -- spine reader missing at .claude/scripts/hq/spine.mjs; receipts unverified."
  _write_evidence "$msg"; echo "$msg" >&2
  exit 1
fi

# Every spelling of the repo root, so an absolute declared target can be made repo-relative
# whichever form it was written in (Git Bash reports two; Linux/macOS collapse to one).
ROOT_SPELLINGS="$ROOT"
if command -v cygpath >/dev/null 2>&1; then
  ROOT_WIN="$(cygpath -m "$ROOT" 2>/dev/null || true)"
  ROOT_MSYS="$(cygpath -u "$ROOT" 2>/dev/null || true)"
  [ -n "$ROOT_WIN" ]  && ROOT_SPELLINGS="$ROOT_SPELLINGS
$ROOT_WIN"
  [ -n "$ROOT_MSYS" ] && ROOT_SPELLINGS="$ROOT_SPELLINGS
$ROOT_MSYS"
fi

RECEIPTS="$(node "$READER" read --kind review.completed 2>/dev/null)"
READER_STATUS=$?
if [ "$READER_STATUS" -ne 0 ]; then
  msg="design-gate: WARN -- the spine reader errored (exit $READER_STATUS); design receipts unverified."
  _write_evidence "$msg"; echo "$msg" >&2
  exit 1
fi

# A torn spine is reported by the reader on stderr while still exiting 0 for the lines it could
# parse. "Partially read" is not "read", so it resolves to the same WARN: the missing line
# could be the very receipt being looked for.
TORN="$(node "$READER" read --kind review.completed 2>&1 >/dev/null | grep -c 'unparseable line' || true)"
case "$TORN" in ''|*[!0-9]*) TORN=0;; esac
if [ "$TORN" -gt 0 ]; then
  msg="design-gate: WARN -- the spine carries unparseable line(s); design receipts unverified."
  _write_evidence "$msg"; echo "$msg" >&2
  exit 1
fi

# Which routes have been critiqued, and which of those have a design receipt. The matching is
# on the receipt payload's `target` field parsed as JSON -- a substring grep would let a
# receipt for "docs/a.html" satisfy a critique of "docs/a.html.bak".
REPORT="$(printf '%s' "$RECEIPTS" | node -e '
  const fs = require("fs");
  const [critiqueDir, root] = process.argv.slice(1);
  const lines = fs.readFileSync(0, "utf8").split("\n").filter(Boolean);

  // Targets that carry a design-lens receipt. Unparseable or off-lens lines are skipped, not
  // guessed at: a receipt that cannot be read is not a receipt. `lens` is compared exactly --
  // accepting "Design" would be normalising a closed vocabulary into a suggestion (ADR-0026).
  //
  // A receipt with result FAIL still counts as covered, deliberately. The gate asks "was this
  // route reviewed", not "did it pass" -- passing is the review LEDGER'"'"'s job, and it stays
  // unstamped on FAIL. A gate that demanded PASS would make a found violation look like a
  // missing review.
  const covered = new Set();
  for (const l of lines) {
    let e; try { e = JSON.parse(l); } catch { continue; }
    const p = e && e.payload;
    if (!p || p.lens !== "design" || typeof p.target !== "string") continue;
    covered.add(p.target);
  }

  // Only files named the way the runner names them are critique artifacts. Any .md would drag
  // a README in the same directory into enforcement forever.
  const ARTIFACT_RE = /^\d{4}-\d{2}-\d{2}-.+\.md$/;

  // Fenced blocks are stripped before looking for the declared target: the artifact template
  // and any artifact quoting an example both carry a `- target:` line inside a fence, and
  // enforcing a quoted example demands a receipt for a route nobody critiqued.
  const stripFences = (s) => s.replace(/```[\s\S]*?```/g, "").replace(/^~~~[\s\S]*?^~~~/gm, "");

  // A declared target may be absolute while the receipt is repo-relative. Same route, two
  // spellings -- compared raw it warns forever about a route that WAS reviewed.
  //
  // `root` arrives as a newline-separated list of spellings, because on Windows the repo root
  // has two that are not string-comparable: the native C:/Users/.../Temp/x that git reports
  // and the MSYS /tmp/x the shell uses. Stripping only one of them leaves the other absolute
  // and permanently unmatched.
  const fwd = (p) => p.replace(/\\/g, "/");
  const roots = root.split("\n").map(fwd).filter(Boolean)
    .sort((a, b) => b.length - a.length);   // longest first: never strip a parent of the root
  const rel = (p) => {
    const t = fwd(p);
    for (const r of roots) if (t.startsWith(r + "/")) return t.slice(r.length + 1);
    return t;
  };

  let missing = [], undeclared = [], checked = 0;
  for (const f of fs.readdirSync(critiqueDir)) {
    if (!ARTIFACT_RE.test(f)) continue;
    const text = stripFences(fs.readFileSync(`${critiqueDir}/${f}`, "utf8"));
    const m = /^[-*]?\s*target:\s*`?([^`\n]+?)`?\s*$/m.exec(text);
    // An artifact that declares no target used to be skipped -- which meant a malformed
    // critique escaped the gate entirely and the run reported OK. Silence is the one thing a
    // gate must never do: report it instead (adversarial pass, this phase).
    if (!m) { undeclared.push(f); continue; }
    checked++;
    const raw = m[1].trim();
    if (!covered.has(raw) && !covered.has(rel(raw))) missing.push({ target: raw, artifact: f });
  }

  for (const x of missing)   console.log(`MISSING\t${x.target}\t${x.artifact}`);
  for (const f of undeclared) console.log(`UNDECLARED\t-\t${f}`);
  if (!missing.length && !undeclared.length) {
    console.log(checked
      ? `OK\t${checked} critiqued route(s), all carry a design receipt`
      : "OK\tno critique artifacts named like a critique, nothing to enforce");
  }
' "$CRITIQUE_DIR" "$ROOT_SPELLINGS" 2>/dev/null)"
NODE_STATUS=$?

if [ "$NODE_STATUS" -ne 0 ] || [ -z "$REPORT" ]; then
  msg="design-gate: WARN -- could not resolve critiqued routes against the spine; receipts unverified."
  _write_evidence "$msg"; echo "$msg" >&2
  exit 1
fi

case "$REPORT" in
  OK*)
    _write_evidence "design-gate: OK -- $(printf '%s' "$REPORT" | cut -f2-)"
    exit 0
    ;;
esac

{
  echo "design-gate: WARN -- design review evidence incomplete:"
  printf '%s\n' "$REPORT" | while IFS="$(printf '\t')" read -r what target artifact; do
    [ -n "$what" ] || continue
    case "$what" in
      MISSING)    echo "  no receipt on the spine for: $target   (artifact: docs/design/critique/$artifact)";;
      UNDECLARED) echo "  artifact declares no target, so it cannot be checked: docs/design/critique/$artifact";;
    esac
  done
  echo "Emit a receipt with: bash .claude/scripts/design/design-critique.sh finish <route>"
} > "$EVIDENCE" 2>/dev/null || true
cat "$EVIDENCE" >&2 2>/dev/null || true
exit 1
