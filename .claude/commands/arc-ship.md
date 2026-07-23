---
description: Lint, build, test, then deploy — in one shot.
allowed-tools: Bash(npm run lint), Bash(npm run build), Bash(npm run test:*), Bash(vercel:*), Bash(bash .claude/scripts/hq/arc-event.sh:*)
---

Ship the current branch to production. Run these in order and STOP at the first failure:

1. `npm run lint`
2. `npm run build`
3. `npm run test`
4. If all three pass, deploy with `vercel --prod` (the pre-deploy-guard hook will re-check tests).
5. **Leave the receipt (spine)** — record the ship on the spine (hook-mode, never blocks the flow):
   ```bash
   bash .claude/scripts/hq/arc-event.sh emit ship.done --payload '{"url":"<prod-url>","summary":"<one line>"}'
   ```

After deploying, reply with the production URL and a one-line summary of what shipped.
If any step fails, show me the error and do NOT continue.
