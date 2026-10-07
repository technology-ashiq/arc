#!/usr/bin/env bash
# core -- secret-diff-scan: scan only the lines a change ADDS for secrets (distribute ADR-2002, ADR-2013).
#
#   secret-diff-scan.sh --staged          the index against HEAD      (commit-time: .githooks/pre-commit)
#   secret-diff-scan.sh --merge-parent    HEAD against its first parent (merge-time: a PR's merge ref)
#   secret-diff-scan.sh --base REF        HEAD against REF
#
# ONE script for both lines, so the commit-time twin can never drift from the merge-time truth.
#
# WHY ADDED LINES, NOT THE TREE. A whole-tree gitleaks pass on 2026-10-07 found 45 hits, almost all
# deliberate fixtures planted by other lanes' tests. A tree scan would turn every lane red at once.
# Scanning only what a change adds asks the right question, which is whether THIS change introduces a
# secret. A deliberate fixture line is marked `gitleaks:allow`, gitleaks' own inline escape.
#
# WHY A MISSING SCANNER FAILS. A scan that cannot run prints COULD NOT SCAN and exits 2. It never
# prints "clean", because an empty result is the one thing a broken scanner and a clean diff agree
# on (retro 2026-08-12). ARC_GITLEAKS overrides the binary, which is how the test removes it.
#
# Exit: 0 clean · 1 a secret in the added lines · 2 could not scan / usage.
set -u

mode="" base=""
while [ $# -gt 0 ]; do
  case "$1" in
    --staged|--merge-parent)
      [ -z "$mode" ] || { echo "secret-diff-scan: give exactly one mode" >&2; exit 2; }
      mode="$1"; shift ;;
    --base)
      [ -z "$mode" ] || { echo "secret-diff-scan: give exactly one mode" >&2; exit 2; }
      [ $# -ge 2 ] && [ -n "$2" ] && case "$2" in -*) false ;; *) true ;; esac \
        || { echo "secret-diff-scan: --base needs a ref" >&2; exit 2; }
      mode="--base"; base="$2"; shift 2 ;;
    *) echo "secret-diff-scan: unknown argument: $1" >&2; exit 2 ;;
  esac
done
[ -n "$mode" ] || { echo "usage: secret-diff-scan.sh --staged | --merge-parent | --base REF" >&2; exit 2; }

top=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "secret-diff-scan: COULD NOT SCAN -- not inside a git repository"; exit 2; }
cd "$top" || { echo "secret-diff-scan: COULD NOT SCAN -- cannot enter $top"; exit 2; }

gl="${ARC_GITLEAKS:-gitleaks}"
command -v "$gl" >/dev/null 2>&1 || { echo "secret-diff-scan: COULD NOT SCAN -- gitleaks not found ($gl)"; exit 2; }

case "$mode" in
  --staged) range=(--cached) ;;
  --base)   git rev-parse --verify -q "$base^{commit}" >/dev/null || { echo "secret-diff-scan: COULD NOT SCAN -- unknown ref $base"; exit 2; }
            range=("$base" HEAD) ;;
  --merge-parent)
    parent=$(git cat-file -p HEAD 2>/dev/null | sed -n 's/^parent //p' | head -1)
    [ -n "$parent" ] || { echo "secret-diff-scan: COULD NOT SCAN -- HEAD has no parent"; exit 2; }
    # A CI checkout is depth 1: the parent's SHA is in the commit object but its tree is not. Fetch
    # exactly that commit; never fall back to a guessed base.
    if ! git cat-file -e "$parent^{commit}" 2>/dev/null; then
      git fetch -q --depth=1 origin "$parent" 2>/dev/null \
        || { echo "secret-diff-scan: COULD NOT SCAN -- cannot fetch parent $parent"; exit 2; }
    fi
    range=("$parent" HEAD) ;;
esac

added="$(mktemp)" || { echo "secret-diff-scan: COULD NOT SCAN -- mktemp failed"; exit 2; }
trap 'rm -f "$added"' EXIT
# The diff's own exit status is read, not lost in a pipeline (retro: pipeline exit codes).
diffout="$(mktemp)" || { echo "secret-diff-scan: COULD NOT SCAN -- mktemp failed"; exit 2; }
trap 'rm -f "$added" "$diffout"' EXIT
git -c core.quotepath=off diff --no-color --no-ext-diff -U0 --diff-filter=ACMR "${range[@]}" > "$diffout" \
  || { echo "secret-diff-scan: COULD NOT SCAN -- git diff failed"; exit 2; }
grep -E '^[+]' "$diffout" | grep -vE '^[+][+][+] ' | sed 's/^[+]//' > "$added"
n=$(wc -l < "$added" | tr -d ' ')

if [ "$n" -eq 0 ]; then
  echo "secret-diff-scan: 0 added line(s) scanned, clean"
  echo "RAN secret-diff-scan"
  exit 0
fi

"$gl" stdin --no-banner --redact --exit-code 1 < "$added" > "$diffout" 2>&1
rc=$?
case "$rc" in
  0) echo "secret-diff-scan: $n added line(s) scanned, clean" ;;
  1) echo "secret-diff-scan: SECRET in the added lines -- gitleaks findings (redacted):"
     sed 's/^/  /' "$diffout"
     echo "  a deliberate test fixture carries gitleaks:allow on its line" ;;
  *) echo "secret-diff-scan: COULD NOT SCAN -- gitleaks exited $rc"; sed 's/^/  /' "$diffout"; rc=2 ;;
esac
echo "RAN secret-diff-scan"
exit "$rc"
