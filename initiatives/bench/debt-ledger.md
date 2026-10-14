# debt-ledger.md — LOW leftovers and accepted findings (ADR-2011)

One row per finding that was not fixed in its PR, with the reason and the trigger that reopens it.

| # | Source | Finding | Disposition | Reopen when |
|---|---|---|---|---|
| 1 | attack ca7ba9a r2 boundary B2 (low) | a pass-through line that begins `arc-run: ` can still pose as arc-run's own reason | accepted: drivers' stderr reaches bench only through arc-run, which prefixes driver lines with the driver name, and the reason is display text that gates nothing | a scorecard reason is ever read by a gate rather than a person |
| 2 | attack ca7ba9a r2 boundary B6 (low) | `retry.why` is interpolated raw into a stderr line, so a newline in it splits the reason | accepted: `why` comes from the schema validator's own message (a JSON path plus a rule), not from model text | a validator message is ever built from the answer's own strings |
| 3 | attack ca7ba9a r2 boundary B5 (low) | the trial early exit could skip cleanup shared with the normal exit | accepted: it calls the same `emitRun` and `process.exit(1)` as the tier-change path below it, so there is no cleanup that one runs and the other skips | a `finally`/exit hook is added to the schema-stop path |
| 4 | attack a59752e r1 logic L6, ca7ba9a r2 logic L9 (low) | `--strict-mcp-config` fails a benched run that needs a project-scoped MCP server | accepted: no benched process uses MCP, and the fixture repo carries no `.mcp.json` | a benched process declares an MCP tool |
| 5 | attack ca7ba9a r2 logic L7 (low) | hermes withholds the contract when its canonical read failed | accepted: an unreadable canonical file has no `output` to show, and hermes already says NO PROCESS BRIEF on that path | — |

Rejected (ADR-0067 taxonomy): a59752e L1 and ca7ba9a L1 (an indented contract line; arc-run prints
both at column 0), a59752e L3 and ca7ba9a L5 (control characters in `--trial-model`; `MODEL_RE`
refuses them before the run starts), a59752e L4 and ca7ba9a L6 (a schema posing as the header; the
schema is the repo's canonical file), ca7ba9a L4 (whitespace-only stderr already yields the exit
status), and ca7ba9a L10 (a test-wording observation, not a defect).
