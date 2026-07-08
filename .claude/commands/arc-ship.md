---
description: Lint, build, test, then deploy — in one shot.
allowed-tools: Bash(npm run lint), Bash(npm run build), Bash(npm run test:*), Bash(vercel:*)
---

Ship the current branch to production. Run these in order and STOP at the first failure:

1. `npm run lint`
2. `npm run build`
3. `npm run test`
4. If all three pass, deploy with `vercel --prod` (the pre-deploy-guard hook will re-check tests).

After deploying, reply with the production URL and a one-line summary of what shipped.
If any step fails, show me the error and do NOT continue.
