# org Phase 01 — evidence bundle (attribution + scorecard)

**Built at** `535849d2` on `feat/arc-org-cycle18` (PR #302). The owner ruled on 2026-09-30 that all four phases land on one PR, merged once at the end, so this phase closes against CI on that PR.

## REQ-05: a seat's performance is derived from receipts

- `org/attribution.yaml` holds 24 ordered rules. 15 of them name their source, meaning they match on a process or on an exact non-scheduler actor. First match wins. The `actor` field is read and never rewritten (ADR-1604).
- `org-review --all` was run against the live main-clone spine (read-only, `--spine-dir`) and the output is in `scorecard.txt`. 13 of 71 roles have evidence. 1262 of 1457 receipts are unattributed, and that count is printed rather than guessed. Most of them are `note.logged` and `day.closed`, which belong to no job.
- `--audit` recomputes every number with an independent tally over a fresh read and compares the two (`audit.txt`): 71 roles, **0 differences**.
- **Cost: no evidence for every role.** The live spine holds 0 `cost.incurred` receipts, and the `cost` field is null on every event. ORG-P's budget enforcement (Phase 03) will act only once cost receipts exist. That absence is reported here, not hidden.

## Day-3 kill checkpoint: PROCEED

`checkpoint.txt`. The map digest `1f0ece13…` was committed in `535849d2` **before** the count ran. Five seated roles are measured from 1460 receipts. A role counts only when it has at least 1 `run.completed` or at least 1 decision verdict, and that receipt was placed by a source-naming rule; `scheduler:*` heartbeats and kind-only rules do not count.

| Role | Receipts | Via |
|---|---|---|
| build-in-public-social (human seat) | 16 | process `build-in-public-draft` |
| devops-release | 11 | process `commit-msg-draft` (8 runs, **0 ok**, the hermes driver's failures) |
| sdr-outbound | 5 | actor `arc-leads`, decisions through `decides` |
| board-advisors | 4 | process `council-convene` |
| design-director | 1 | process `arc-design-explore` |

Excluding the human seat, 4 is still at least 3. The negative control is `tests/org-review.bats`: a spine of heartbeats and kind-only receipts exits 1 with STOP.

## A-01: which kinds accept `payload.role`

`kinds-table.txt`, tested on each kind's own live receipt after that receipt first validates unmodified:

- **Accept:** run.completed, approval.requested, review.completed, slice.done, phase.closed, kickoff.done.
- **Closed, so map-only:** decision.recorded (placed via `decides`), content.published, lead.researched.
- **Untested, because no live receipt exists:** incident.raised, cost.incurred, handoff.ready, outreach.sent.

`validate.mjs` is untouched (ORG-C).

## Gates and tests

- `org-coverage` now validates the map, and the self-test's arm M13 plants a rule pointing at a ghost role. 14 of 14 arms pass, 13 of them through the real CLI.
- `tests/org-review.bats` (11 tests) runs against written spines and never against the live one.
