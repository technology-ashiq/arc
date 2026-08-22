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
- Run `git branch --show-current` immediately BEFORE every commit — the branch can change
  between turns without me saying so. If it's `main`, stop and move the work to a `feat/*` branch.
- Publishing anything outward — a public post, an upload, a shared link, product screenshots —
  is irreversible (indexed, cached, unrecoverable) and needs my explicit OK first, **even when a
  plan or ADR already asks for external input**. ADR-0040 required only that arc's *authorship*
  be hidden and said nothing about product confidentiality; that gap nearly put LexOS mockups on
  a public subreddit.

### Code standards
- Write **production-ready, robust** code from day one. No stubbed logic, no "// fix later".
- Strict TypeScript — no `any`. Always handle loading + error states.
- Icons: use **lucide-react** only. Do NOT mix icon sets. <!-- swap for your kit -->
- Brand assets live in `public/brand/`. Design tokens in `styles/tokens.css`.
- Comments explain *why*, not *what*, and stay short.
- Reuse an existing component before creating a new one.
- **A program embedded in a shell string carries no apostrophes and no single quotes — in code
  OR in comments — and inside a DOUBLE-quoted string, the same is true of a backtick and of `$`.**
  One apostrophe closes the single-quoted string and the shell expands the rest; one backtick
  opens a command substitution the shell then runs. This landed twice in one file in Cycle 6, the
  second time inside the comment explaining the first, again in the engine lane, and again on
  2026-08-12 in the memory lane — that last one a backtick, in the comment explaining the previous
  fix, which made bash try to execute the function the comment was naming. The moment the embedded
  program wants any of those three characters, it belongs in its own file.
- Code review ALWAYS runs through the `code-reviewer` agent (Task `subagent_type: code-reviewer`),
  never ad-hoc `general-purpose` reviewers — that agent is where the scanners + review method live.
- Impact questions (callers, dependents, schema-dependent queries): **codegraph first**
  (`codegraph explore`, or the MCP) — it is local, exact, and free of LLM tokens. Graphify's
  `graphify-out/` **does NOT auto-refresh in arc** and answers from whenever it was last built
  by hand: check its date before trusting it, and rebuild with `graphify update .` (a real
  token cost) or fall back to grep. Details → `CLAUDE.local.md` § Graphify facts.
- **Model tiers are law, not taste** — `docs/adr/0069-balanced-model-policy.md`. Changing any
  agent's frontmatter `model:` is a production tier change: it is a reviewed diff that cites
  that ADR, never a quiet edit. Tiers are *cheap-scan · balanced-workhorse · high-judgment ·
  independent-family-verifier*; haiku/sonnet/opus are only "implementation v1". Trials are
  free (isolated + fingerprinted, block g); auto-switching is forbidden everywhere.

### Build process  <!-- full method → docs/build-playbook.md -->
- **Exactly ONE plan is ever live per lane: that lane's `initiatives/<lane>/PLAN.md`.**
  `--lane <name>` is the only way to name a lane — never a bare token — and a lane is born
  only by `/arc-kickoff --lane <name>`; every other surface handed an unknown lane STOPs and
  creates nothing. `PORTFOLIO.md` is the **index view, not the truth** (ADR-0051): every value
  on it derives from a lane's `PROGRESS.md`, and on any mismatch the lane files win. No
  `initiatives/` dir at all = root-mode — root `PLAN.md` is that repo's one live plan
  (ADR-0054). Resolution order + paths → `.claude/rules/lanes.md`. Don't inline it here.
- New build? Start with `/arc-kickoff` — PLAN.md + phases-by-risk + PROGRESS.md BEFORE any code.
- A phase closes ONLY via `/arc-phase-done <n>`: tests green + live demo + tracker updated. Evidence over assertion.
- **After a push, read CI per-JOB before reporting the work done.** I reported a phase built on the
  strength of local gates twice while CI was red — once with a test that had never passed at all.
  `gh run view <id> --json jobs`, and confirm the run's head SHA is the local HEAD.
- **"Tests green" means green on CI. Never run a suite on this box** — and read per-JOB conclusions,
  not the watcher's exit code → `.claude/rules/testing.md` § where tests run.
- Offline-first: every external dependency gets an interface + fake + real impl.
- A gate/lint/parser is NOT done until an adversarial construct-a-breaking-input pass has run
  against it and the found holes are fixed + pinned as fixtures (council v2+v3: 43 real holes
  in code that looked correct and passed its own tests). Mandatory verification, not review.
  **The pass attacks the TEST that protects the rule, not only the rule** — Cycle 7's propose-only
  guard was a grep that a mutant module (overwriting the canonical file, deleting the champion,
  committing, spawning a deploy) walked straight past; the mutant IS the negative control.
  **And the attacker's prompt carries the lane's running list of already-fixed defects**, with the
  instruction to check each one in every OTHER file: "validate one read, compare another" was
  closed in `verdict.mjs` and left open in `lineage.mjs` one phase later — the second twin-fix
  recurrence in two days, after the written "grep the pattern, not the file" rule failed to take.
  A fix is not applied until it has been attacked somewhere it was never made.
- **That pass is TWO fresh agents with different surfaces, not one generalist** — one on the
  decision logic, one on the shell/OS boundary. Cycle 6 ran 7 passes for 77 real holes, and
  where two attacked one gate they shared the root cause and almost none of the findings. A
  single agent's blind spot is structural, not a matter of effort. Fresh = has not seen the
  implementation (`gate-author-cannot-be-its-attacker`: the author's own 26 breaking inputs
  found 0 holes; an unanchored agent found 9).
- **A test that passes proves the assertion held, not that the code ran.** Assert it RAN before
  asserting what it printed → `.claude/rules/testing.md` § the vacuous pass. Cycle 6 shipped
  this three times, twice inside the suites written to prevent it.
- **Look at the artifact before carrying its verdict.** An agent's report about a screenshot or
  a page is not the thing itself. Cycle 3 ran 5 critique rounds, 3 blind rankings, receipts, a
  sealed prediction and an external package on pixels the session never opened — I looked once
  and scored it 23/100.
- **A gate that transforms what it measures must declare what the transform destroys.**
  `design-render.sh` pinned `font-family: Arial !important` for hash stability, so every design
  was judged with its typography deleted — invisible for a whole cycle to every brief, agent
  prompt and ADR. Adding a normalisation? Write down which signal it removes, then check that
  signal is not the one being judged.
- **A pass condition that is only an absence cannot detect mediocrity.** `PASS = zero VIOLATION`
  meant "broke no rule", so compliant characterless work passed five runs running. A quality
  gate needs a class that fails for insufficiency (ADR-0049's `BELOW-BAR`), and ranking N
  candidates against each other always yields a winner but never a bar.
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
- `/arc-kickoff <goal> [--lane <name>]` — start a build: PLAN.md, phases, PROGRESS.md (playbook §9)
- `/arc-change <what> [--lane <name>]` — route a mid-build change/idea into the tracker (phase spec / ADR) before any code
- `/arc-develop <mode> [phase] [--lane <name>]` — execution harness: turn an approved phase into proven slices (`start`/`next`/`status`/`checkpoint`/`handoff`)
- `/arc-capability <need>` — scout a tool the harness lacks, then vet it (ADR-0110). Reports and refuses; **installs nothing**. `--vet <dir>` runs the gate, `--audit` reports stale pins.
- `/arc-phase-done <n> [--lane <name>]` — close a phase against its Definition of Done (playbook §8)
- `/arc-retro [n] [--lane <name>]` — end-of-phase retro: repeated corrections → permanent setup upgrades
- `/arc-toolcheck`    — full toolchain status (installed/missing/stale) + one-command fixes
- `/arc-qa [url]`      — browser QA loop (qa-tester) + a required regression test per fix
- `/arc-audit`         — deep OWASP+STRIDE pass (security-auditor); high-sev → tracked issue
- `/arc-second-opinion`— cross-model review of the diff; critical disagreement blocks ship
- `/arc-docs`          — fix documentation drift vs the diff (clears the docs ship-gate)
- `/arc-design [route]`— UI review-and-fix (design-reviewer): score 0-10, kill AI slop
- `/arc-canary <url>`  — post-deploy watch loop; failure rolls back / blocks promote
- `/arc-freeze <dir>` · `/arc-unfreeze` — deterministic edit-boundary while debugging
- `/arc-diagram <what>`— English → committed Mermaid (into PLAN/ADR/docs)
- `/arc-resume [--lane <name>]` — rebuild session state from PROGRESS ## Now + last snapshot
- Only the six command lines showing `[--lane <name>]` take the flag; the rest are lane-agnostic.
  A bare first argument is always the command's own (a phase number, a route, a URL, a goal
  sentence) — never a lane name. Omit the flag and the lane is resolved, or you are asked.

## Key files
- **GENERATED commands** → `.claude/commands/{arc-commit,arc-review,arc-kickoff}.md` are compiled
  from `processes/*.process.yaml` (engine Cycle 6, ADR-0201/0202). **Do not edit them** — the next
  regeneration deletes the edit. Change the process file, routed through `/arc-change`, then
  `node .claude/scripts/engine/arc-compile.mjs --write --all --target claude-code`. The other 21
  commands are still hand-written and unaffected.
- Company board       → `PORTFOLIO.md` (every lane in priority order — a view, not the truth)
- Lanes / workspaces  → `.claude/rules/lanes.md` (`--lane` is the ONLY way to name a lane)
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
- Testing rules       → `.claude/rules/testing.md` (incl. the vacuous-pass rule)
- Plugins we rely on  → `docs/plugins.md`
