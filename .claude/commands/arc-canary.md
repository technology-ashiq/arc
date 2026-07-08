---
description: Post-deploy watch loop -- monitor console errors, 5xx responses, Core Web Vitals, and visual drift for a window after deploy. Failure triggers rollback/block, not just a report.
argument-hint: <production-url> [--minutes N]
allowed-tools: Bash, Task, Read, Write
---

Watch production after a deploy: **$ARGUMENTS**

1. **Watch loop** (window default 10 min, poll every ~2 min) — drive it with the
   `agent-browser` CLI in an isolated session, locked to the prod domain so the canary
   can never wander:
   ```bash
   agent-browser --session canary --allowed-domains "<prod-domain>,*.<prod-domain>" open <url>
   agent-browser --session canary errors                               # uncaught JS exceptions
   agent-browser --session canary console --json                       # console errors/warnings
   agent-browser --session canary network requests --status 4xx,5xx    # failed requests
   agent-browser --session canary vitals <url> --json                  # LCP / CLS / INP / TTFB
   ```
   Repeat for each key route. (agent-browser missing? Fall back to the **qa-tester**
   subagent via Playwright MCP for the same checks — and say so in the report.)

2. **Baseline compare** — `docs/canary/` holds the last known-good `baseline.png` +
   `baseline-vitals.json` (create both on first run):
   ```bash
   agent-browser --session canary diff screenshot --baseline docs/canary/baseline.png
   ```
   **Regression =** new uncaught exceptions or console errors · any 5xx on a key route ·
   a CWV cliff vs baseline (LCP or INP > 1.5×, CLS worse by > 0.1) · a large visual diff
   on a key route.

3. **Flow-level verification** — spawn the **qa-tester** subagent on the 1–2 money flows
   (login, checkout). One owner per job: it owns flows; this command owns the
   error/vitals/diff watch. Close the session when the window ends:
   `agent-browser --session canary close`.

## The arc twist -- a failed canary acts, it doesn't just alert
- On regression: **roll back** (`vercel rollback` or your platform's equivalent) OR block
  promotion, and write the incident to `docs/canary/$(date +%F).md` — what regressed, the
  evidence (errors / vitals numbers / diff image path), and the action taken.
- On a green window: refresh the baseline (`screenshot` + vitals JSON into `docs/canary/`),
  then update `PROGRESS.md` `## Now` with the outcome. A green canary is required before a
  phase that deploys is marked done.
