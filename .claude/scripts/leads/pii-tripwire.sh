#!/usr/bin/env bash
# pii-tripwire.sh -- the ALARM, not the wall (ADR-0410).
#
# The wall is location isolation: lead PII lives outside the repository directory entirely,
# so it cannot be committed by accident. This script catches the common accident anyway --
# an address or a store path that made it into a tracked file -- and it is honest about what
# it cannot do: it CANNOT prove arbitrary prose PII-free. A name in a sentence passes here.
# That limit is stated in ADR-0410 and is not a defect to be fixed by a bigger regex.
#
# SCOPE is leads-owned paths only. Repo-wide would turn CI red on pre-existing tracked
# content from commit one, and a gate that is red for reasons outside the change is a gate
# people learn to ignore.
#
# Exit: 0 clean | 2 violation (path + line + rule named) | 3 usage error.
set -euo pipefail

REPO_ROOT="${1:-$(git rev-parse --show-toplevel 2>/dev/null || true)}"
if [ -z "$REPO_ROOT" ] || [ ! -d "$REPO_ROOT" ]; then
  echo "pii-tripwire: usage: pii-tripwire.sh [repo-root]  (not inside a git repo?)" >&2
  exit 3
fi
cd "$REPO_ROOT"

# Fixture paths may hold sample addresses -- but ONLY reserved domains (RFC 2606), so even a
# fixture can never carry a real one. This is a path PREFIX, deliberately: a declaration file
# listing exempt paths is a file someone appends to when a check is inconvenient.
FIXTURE_PREFIX="tests/fixtures/leads/"

# An email-shaped string. Kept deliberately loose -- a false positive here costs a rename;
# a false negative costs a permanent leak into public git history.
EMAIL_RE='[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
# Reserved domains that a fixture may use. `.test` and `.invalid` are TLDs, so they anchor
# at end-of-token rather than needing a dot-suffix.
RESERVED_RE='@(example\.(com|net|org)|[A-Za-z0-9.-]+\.(test|invalid))([^A-Za-z0-9.-]|$)'

violations=0
report() {
  printf 'pii-tripwire: VIOLATION %s\n  file: %s:%s\n  rule: %s\n' "$1" "$2" "$3" "$4" >&2
  violations=$((violations + 1))
}

# git ls-files, not find: an untracked scratch file is not a leak, and a deleted-but-staged
# path must not be scanned as if it still existed.
files=$(git ls-files -- \
  '.claude/scripts/leads' \
  '.claude/config/leads.json' \
  'products/leads' \
  'initiatives/leads' \
  'tests/leads-*.bats' \
  'tests/fixtures/leads' 2>/dev/null || true)

# ---------- rule 1: email-shaped strings ----------
for f in $files; do
  [ -f "$f" ] || continue
  # This script is itself in scope and contains the regexes above; skip only ITSELF, by exact
  # path, rather than skipping a pattern that would also exempt a real file later.
  [ "$f" = ".claude/scripts/leads/pii-tripwire.sh" ] && continue

  while IFS=: read -r lineno line; do
    [ -n "${lineno:-}" ] || continue
    case "$f" in
      "$FIXTURE_PREFIX"*)
        # Inside a fixture path: reserved domains only.
        if ! printf '%s' "$line" | grep -Eq "$RESERVED_RE"; then
          report "non-reserved address in a fixture path" "$f" "$lineno" \
            "fixture paths may hold ONLY example.com/.net/.org, .test, .invalid (RFC 2606) -- so even a fixture cannot carry a real address"
        fi
        ;;
      *)
        report "email-shaped string in a tracked file" "$f" "$lineno" \
          "lead addresses live in the private store outside the repo (ADR-0410); git history is forever and this repo is headed public"
        ;;
    esac
  done < <(grep -nE "$EMAIL_RE" "$f" 2>/dev/null || true)
done

# ---------- rule 2: a resolved store path in a tracked file ----------
#
# Checked in BOTH native forms and case-folded. A prior cycle lost an entire capability scan
# to a single backslash: the Windows leg writes C:\Users\...\.arc\leads while git-bash writes
# /c/Users/.../.arc/leads, and a check that knows only one form silently scans nothing on the
# other. A gate that passes while scanning nothing is worse than no gate.
STORE_RAW="${ARC_LEADS_STORE:-$HOME/.arc/leads}"
store_posix=$(printf '%s' "$STORE_RAW" | tr '\\' '/' | tr -s '/')
store_win=$(printf '%s' "$STORE_RAW" | tr '/' '\\')

for f in $files; do
  [ -f "$f" ] || continue
  [ "$f" = ".claude/scripts/leads/pii-tripwire.sh" ] && continue
  for form in "$store_posix" "$store_win"; do
    [ -n "$form" ] || continue
    while IFS=: read -r lineno _; do
      [ -n "${lineno:-}" ] || continue
      report "resolved store path in a tracked file" "$f" "$lineno" \
        "the store path resolves at runtime from ARC_LEADS_STORE; a personal filesystem path committed to a future-public repo is itself a leak (ADR-0410)"
    done < <(grep -niF "$form" "$f" 2>/dev/null || true)
  done
done

if [ "$violations" -gt 0 ]; then
  echo "pii-tripwire: $violations violation(s)" >&2
  exit 2
fi
echo "pii-tripwire: clean ($(printf '%s\n' $files | grep -c . || true) tracked leads files scanned)"
exit 0
