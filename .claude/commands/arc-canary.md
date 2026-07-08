---
description: Post-deploy watch loop -- monitor console errors, performance regressions, and page failures for a window after deploy. Failure triggers rollback/block, not just a report.
argument-hint: <production-url> [--minutes N]
allowed-tools: Bash, Task, Read, Write
---

Watch production after a deploy: **$ARGUMENTS**

1. For the window (default 10 min), poll the URL + key routes. Use the **qa-tester** subagent for real-browser checks (console errors, failed requests, broken pages) and capture Core Web Vitals if available.
2. Compare against the last known-good baseline in `docs/canary/` (create it on first run).

## The arc twist -- a failed canary acts, it doesn't just alert
- On regression (new console errors, 5xx, CWV cliff): **roll back** (`vercel rollback` or your platform's equivalent) OR block promotion, and write the incident to `docs/canary/$(date +%F).md`.
- Update `PROGRESS.md` `## Now` with the outcome. A green canary is required before a phase that deploys is marked done.
