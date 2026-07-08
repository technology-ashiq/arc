# Deployment

## Target: Vercel
- Production branch: `main`. Every PR gets a preview deploy.
- Env vars live in the Vercel dashboard (Production + Preview set separately). Mirror `.env.example`.

## Flow
1. `/arc-ship`  (or manually: lint -> build -> test)
2. `vercel --prod` — the `pre-deploy-guard` hook re-runs tests and BLOCKS on failure.
3. Smoke-test the production URL.

## Rollback
- `vercel rollback <deployment-url>`, or re-promote the previous deployment in the dashboard.

## Don'ts
- Never deploy with failing tests (the hook enforces this).
- Never put secrets in `NEXT_PUBLIC_*` — those ship to the browser.
