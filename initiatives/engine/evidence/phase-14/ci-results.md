# Phase 14 -- live evidence (main clone, after the merge)

Merged: PR #423 squash `1fedd504` on 2026-10-14, after run 38549208594 at `fb808a70` (the PR #423 head, squash-merged unchanged as `1fedd504`): **19/19 jobs green, read per job**
The main clone was fast-forwarded to `1fedd504` before any dispatch.

Real dispatches from the main clone, `face-ask` (zero write tools), live spine:

| run.completed | driver | provider figure | money row | basis |
|---|---|---|---|---|
| 01M4X16H6PGXKW0RF5718FXDE7 | claude-code (routed, sonnet) | total_cost_usd 0.123618 | 13 USD cents, 01M4X16K73W8VD4KREN17FQEQ3 | harness-reported -- NOTIONAL: the owner's subscription login, not an invoice |
| 01M4X1EV8J98BA7NM0CNAXK5BB | generic-api via openrouter.ai (trial deepseek-v4-flash) | usage.cost 0.0000949 | 1 USD cent | provider-reported -- billed to the OpenRouter key |

A-12 held: OpenRouter returned usage.cost on the streamed last chunk. One failed attempt in between
(01M4X1CHQ4JV8A1TH9RMZCEYV1, generic-api run with no model set) receipted honestly as spend null,
spend_absence driver-unmetered, and wrote no money row.

Through the door: `door-api-pnl.json` -- arc-dash /api/pnl, mode live, status 200, 2 overhead cost lines, both > 0,
both traced to their run.completed by run_ref (untraced 0). They are the ONLY cost.incurred events on the spine
(counts.costs 2), so nothing was hand-planted.

Reverse trace: `spend-trace.json` -- 433 run.completed scanned, unbooked [] (exit 0). Quarantine untouched (last write
04:18, before the dispatches).
