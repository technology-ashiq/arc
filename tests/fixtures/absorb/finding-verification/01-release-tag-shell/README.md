# 01 — release-tag-shell

Subject: a bash release-tagging script, its sourced version helpers, and a committed
config file — the kind of shell a review surface sees every cycle.

Discriminates: **can a rule keep a finding whose defect is an absent line?** F3 (no
`set -euo pipefail`, so a failed `git tag` still pushes) and F4 (`ALLOW_INITIAL_TAG`
read by nothing) are the two highest-severity defects here and neither has a line to
quote. F8 is the sloppiness case: a real defect, byte-exact quote, cite two lines off.

Under **Rule OLD** all 8 enter the report, including the 3 false findings.
Under **Rule NEW** F1, F2, F5 and F6 have a quote matching their cite and reach the
main report — that includes false findings F5 and F6, whose quotes are byte-exact but
do not say what the claims say. F3, F4, F7 and F8 land in the appendix.
Correct result: F3 and F4 stay reachable as real defects despite being unquotable.
