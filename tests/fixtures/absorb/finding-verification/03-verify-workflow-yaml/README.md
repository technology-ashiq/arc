# 03 — verify-workflow-yaml

Subject: a CI workflow, the doc that describes it, and the shard script it calls —
config plus prose, where most real review findings are drift, not logic.

Discriminates two things a quote check cannot see on its own. **F4** is the critical
case: no matrix leg runs on Windows. A value missing from a list has no line, so the
cite (`workflow.yml:18`) is a location, not support. **F3** is the duplicate-text
trap: the claim is about the `unit` job but the cite lands on the `lint` job, and both
`    runs-on: ubuntu-latest` lines are byte-identical — so a quote check passes on a
mis-located finding. F5 is drift whose wrong line is the *doc* line, not the workflow
line a careless reviewer would cite.

Under **Rule OLD** all 7 enter the report, 2 of them false.
Under **Rule NEW** F1, F2, F3, F5, F6 reach the main report (F6 false, F3 mis-located);
F4 (unquotable) and F7 (`workflow.yaml` does not exist) go to the appendix.
Correct result: F4 stays a tracked defect, and F3 is not treated as verified.
