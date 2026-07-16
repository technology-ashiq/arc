# <PROJECT_NAME> — CLAUDE.md

> The **brain** of this project. Claude loads this every session, so you never re-explain the project.
> RULES: keep this file **under ~200 lines** — anything past that tends to get ignored.
> Keep deep detail in `docs/*.md` and `.claude/rules/*.md` and LINK to it; don't inline it.
> First time on a new project? Run `/init` to auto-generate this from your codebase, then trim.

## Project
- **Name:** TODO (e.g. Tilted)
- **Goal:** TODO — one sentence on what it does (e.g. a browser-based 3D animation editor)
- **Domain:** TODO (e.g. tilted.app)
- **Stack:** TODO (e.g. Next.js 14 · TypeScript · Tailwind · Supabase · Stripe · Vercel)

---

## Rules — Claude follows these EVERY time

### Git & deployment
- Never `git push` or deploy unless I explicitly ask. Never force-push `main`.
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`.
- Deploy target: Vercel. Always reply with the direct preview/production link after deploying.
- Work on a branch, open a PR — don't commit straight to `main`.

### Code standards
- Write **production-ready, robust** code from day one. No stubbed logic, no "// fix later".
- Strict TypeScript — no `any`. Always handle loading + error states.
- Icons: use **lucide-react** only. Do NOT mix icon sets. <!-- swap for your kit -->
- Brand assets live in `public/brand/`. Design tokens in `styles/tokens.css`.
- Comments explain *why*, not *what*, and stay short.
- Reuse an existing component before creating a new one.
- Code review ALWAYS runs through the `code-reviewer` agent (Task `subagent_type: code-reviewer`),
  never ad-hoc `general-purpose` reviewers — that agent is where the scanners + review method live.
- Impact questions (callers, dependents, schema-dependent queries): query the **Graphify
  knowledge graph first** — the index auto-refreshes at session start. Grep is the fallback.

### Build process  <!-- full method → docs/build-playbook.md -->
- New build? Start with `/arc-kickoff` — PLAN.md + phases-by-risk + PROGRESS.md BEFORE any code.
- A phase closes ONLY via `/arc-phase-done <n>`: tests green + live demo + tracker updated. Evidence over assertion.
- Offline-first: every external dependency gets an interface + fake + real impl.
- A gate/lint/parser is NOT done until an adversarial construct-a-breaking-input pass has run
  against it and the found holes are fixed + pinned as fixtures (council v2+v3: 43 real holes
  in code that looked correct and passed its own tests). Mandatory verification, not review.
- **Change discipline (mid-build):** a new ask, idea, or suggestion is NEVER coded ad-hoc — run
  `/arc-change` to route it through the structure first (triage → phase spec / ADR / current-phase note
  → confirm → then build via the Golden Loop). Applies to MY own suggestions too. No code change
  without a tracked home. Typo/one-liner fixes in code you're already in are exempt.

### Database  <!-- stack note → docs/supabase-setup.md -->
- Supabase = auth + Postgres + storage. Row Level Security on EVERY table.
- Schema changes via migrations only. Never print or commit secrets — read from env.

---

## Tools / Tech
- Framework: Next.js (App Router) · React · TypeScript
- Styling: Tailwind CSS
- Domain libs: TODO (e.g. three.js + ffmpeg.wasm for 3D render & video export)
- Data: Supabase (Postgres / Auth / Storage)
- Payments: Stripe
- Testing: Vitest (unit) + Playwright (e2e)

## Commands
- `npm run dev`   — local dev server (my port is in CLAUDE.local.md)
- `npm run build` — production build
- `npm run lint`  — eslint + typecheck
- `npm run test`  — unit tests
- `npm run e2e`   — Playwright
- `/arc-ship`         — lint → build → test → deploy in one shot (`.claude/commands/arc-ship.md`)
- `/arc-commit`       — grouped, conventional commits (never pushes)
- `/arc-pr [base]`    — open a GitHub PR with summary + test plan
- `/arc-review [base]`— diff review via the code-reviewer subagent
- `/arc-fix-issue <n>`— root-cause and fix a GitHub issue
- `/arc-kickoff <goal>`— start a build: PLAN.md, phases, PROGRESS.md (build playbook §9)
- `/arc-change <what>`— route a mid-build change/idea into the tracker (phase spec / ADR) before any code
- `/arc-phase-done <n>`— close a phase against its Definition of Done (build playbook §8)
- `/arc-retro [n]`    — end-of-phase retro: repeated corrections → permanent setup upgrades
- `/arc-toolcheck`    — full toolchain status (installed/missing/stale) + one-command fixes
- `/arc-qa [url]`      — browser QA loop (qa-tester) + a required regression test per fix
- `/arc-audit`         — deep OWASP+STRIDE pass (security-auditor); high-sev → tracked issue
- `/arc-second-opinion`— cross-model review of the diff; critical disagreement blocks ship
- `/arc-docs`          — fix documentation drift vs the diff (clears the docs ship-gate)
- `/arc-design [route]`— UI review-and-fix (design-reviewer): score 0-10, kill AI slop
- `/arc-canary <url>`  — post-deploy watch loop; failure rolls back / blocks promote
- `/arc-freeze <dir>` · `/arc-unfreeze` — deterministic edit-boundary while debugging
- `/arc-diagram <what>`— English → committed Mermaid (into PLAN/ADR/docs)
- `/arc-resume`        — rebuild session state from PROGRESS ## Now + last snapshot

## Key files
- Auth & API security → `.claude/rules/api.md`
- SEO / indexing      → `app/sitemap.ts`, `app/robots.ts`
- State / core        → `lib/store/` (TODO: describe your store)
- Env contract        → `.env.example`

## Architecture
- TODO: how the core domain is modelled. Example (video editor):
  - Timeline/scene state → `lib/store/timeline.ts`
  - Export pipeline      → `lib/export/` (render → encode → upload)
  - Heavy work runs off the main thread (web worker), never blocks the UI.

## Monetization
- Pricing: TODO (e.g. $79 one-time, no subscription).
- Feature gating: free = TODO; pro = TODO. Gate logic in `lib/entitlements.ts`.

## Environment variables
- Declared in `.env.example`. Real values in `.env.local` (gitignored) — never commit/print them.
- Groups: hosting/deploy · database (Supabase) · payments (Stripe) · analytics.

---

## Extended docs — Claude, READ these when the work touches them
- How this setup works → `docs/how-it-works.md` (mental model + example flow)
- Build process       → `docs/build-playbook.md` (Golden Loop · DoD · 3-layer tracker)
- Database setup      → `docs/supabase-setup.md`
- Payments / Stripe   → `docs/stripe-setup.md`
- Deployment          → `docs/deployment.md`
- UI conventions      → `docs/ui-conventions.md`
- Branding / social / contact → `docs/branding.md`
- API route rules     → `.claude/rules/api.md`
- Plugins we rely on  → `docs/plugins.md`
