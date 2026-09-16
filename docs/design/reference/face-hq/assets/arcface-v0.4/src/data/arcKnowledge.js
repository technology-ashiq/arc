// ─────────────────────────────────────────────────────────────
// Knowledge base for the arc face — v0.3.0, regenerated 2026-07-28
// from the arc repo's live state: README, PLAN/PROGRESS (Cycle 3),
// HISTORY, master execution plan v1.1, org blueprint, constitution
// draft, ADR index (0001–0048), products/ manifests, .claude/
// commands+agents listings, and the LexOS venture record.
// Every number here is copied from a repo receipt, never invented.
// Simulated things are labeled simulated (Constitution E3).
// ─────────────────────────────────────────────────────────────
export const ARC = {
  identity: {
    name: "arc",
    version: "0.3.0",
    tagline: "The factory that ships with receipts.",
    oneLiner:
      "arc is a receipt-driven company operating system — one event spine, one process layer, one model router, one human approval inbox. The kernel runs the company, workflows do the work, ventures make the money, and every claim has a receipt.",
    story:
      "arc started as a production-grade Claude Code setup and grew into a company operating system in cycles. Cycle one turned it into a factory of installable modules — closed six of six phases at roughly twenty-two percent of its appetite. Cycle two built the receipt spine: an append-only event log where every action of the company lands, with a morning brief and an approval inbox on top — live since July twenty-fourth, running the company's own days. Cycle three is running right now: the designer — a read-only vision critic, machine-checked design briefs, and a critique loop that files receipts. Meanwhile the first venture, LexOS, is live on its own repo with arc installed inside. The philosophy never changed: evidence over assertion. Plans before code, gates that block by default, an adversarial breaking-input pass on anything that judges, and trust that is earned on a ladder, never assumed.",
    owner: "Ashiq",
  },

  // ── the 8 live modules (products/ manifests, 2026-07-28) ──
  products: [
    {
      id: "core",
      name: "core",
      purpose:
        "The foundation every other module requires — the deterministic layer that cannot forget. Hooks for session context, destructive-guard and deploy-guard, auto-format, state snapshots; the gate runner and strictness profiles; the commit-keyed review ledger; path-scoped rules; the freeze boundary; the per-target install registry.",
      pieces: ["/arc", "/arc-toolcheck", "/arc-resume", "/arc-freeze + /arc-unfreeze", "hooks: SessionStart · PreToolUse guards · PostToolUse format · PreCompact snapshot · SessionEnd trail", "scripts: arc-gates, arc-profile, review-ledger, toolchain-health, freeze-check"],
      status: "live since Cycle 1",
      era: "c1",
    },
    {
      id: "plan",
      name: "plan",
      purpose:
        "The planning spine. Kickoff v3.5 turns a one-line goal into a committed plan — appetite sets the tier, forks become ADRs, phases are risk-ordered, then attack agents and a simulator try to break the plan before lint gates it. Change routes every mid-build idea through the tracker; phase-done closes phases only on evidence; retro turns repeated corrections into permanent upgrades.",
      pieces: ["/arc-kickoff", "/arc-change", "/arc-phase-done", "/arc-retro", "/arc-diagram", "agents: question-planner · plan-attacker · plan-simulator · codebase-surveyor · product-challenger"],
      status: "live since Cycle 1",
      era: "c1",
    },
    {
      id: "review",
      name: "review",
      purpose:
        "Code review and security. A scanner-armed four-pass OWASP diff review, a deeper OWASP-plus-STRIDE audit, a cross-model second opinion where critical disagreement blocks ship, and docs-drift detection that gates deploys. The arc-scan suite adapts semgrep, gitleaks, trivy, trufflehog, codeql and zap behind one runner.",
      pieces: ["/arc-review", "/arc-audit", "/arc-second-opinion", "/arc-docs", "agents: code-reviewer · security-auditor", "gates: docs-drift · coverage · rls"],
      status: "live since Cycle 1",
      era: "c1",
    },
    {
      id: "qa",
      name: "qa",
      purpose:
        "Quality where users live — a real browser. Exploratory QA with a mandatory regression test per fix, UI review that scores and fixes, and a post-deploy canary watch that rolls back on regression.",
      pieces: ["/arc-qa", "/arc-design", "/arc-canary", "agents: qa-tester (real browser + axe + vitals) · design-reviewer"],
      status: "live since Cycle 1",
      era: "c1",
    },
    {
      id: "git",
      name: "git",
      purpose:
        "Shipping discipline. Grouped conventional commits that never push, approval-gated pull requests, root-cause issue fixes that start from a failing test, and a lint-build-test-deploy pipeline where the deploy-guard re-runs tests so red code physically cannot ship.",
      pieces: ["/arc-commit", "/arc-pr", "/arc-fix-issue", "/arc-ship"],
      status: "live since Cycle 1",
      era: "c1",
    },
    {
      id: "council",
      name: "council",
      purpose:
        "Multi-agent judgment for hard decisions. Twelve seats debate blind and in parallel from one shared evidence brief; a verifier grades every point Supported, Plausible, Weak or Contested; one bounded rebuttal round runs; a cross-model juror can re-grade contested points. Verdicts commit — YES, NO, CONDITIONAL or WAIT — with confidence, dissent, a cheapest de-risk test and a review-by date, then get scored HIT or MISS against reality.",
      pieces: ["/arc-council (full · quick · review modes)", "12 seats: advocate · skeptic · neutral · verifier · researcher · strategist · risk-analyst · marketer · designer · engineer · policy-analyst · life-counselor", "council-calibrate: per-confidence hit-rates + Brier scores"],
      status: "live since Cycle 1",
      era: "c1",
    },
    {
      id: "hq",
      name: "hq",
      purpose:
        "The receipt spine — the company's memory and only public API. An emitter that validates, redacts and appends every event to canonical JSONL; a replayer that rebuilds state deterministically; a reader with per-consumer cursors; a morning brief that fits the whole day in one screen; and an approval inbox where a decision becomes a receipt.",
      pieces: ["arc-event emit (dual-mode: hook never blocks · strict for CI)", "arc-replay → derived state, idempotency index", "spine reader + cursors — the ONLY way in", "arc brief (≤40 lines)", "arc-inbox approve / reject → decision.recorded"],
      status: "LIVE — Cycle 2, dogfooding since 2026-07-24",
      era: "c2",
    },
    {
      id: "design",
      name: "design",
      purpose:
        "The Designer — being built right now, in Cycle 3. A read-only vision critic whose write boundary is enforced by hooks, judging rendered UI against a declared brief; design-lint that machine-checks briefs (contrast computed from declared pairs, lorem-ipsum hunted, contracts present); deterministic full-page renders; and critique verdicts that land as receipts on the spine.",
      pieces: ["/arc-design-critique", "agent: design-critic (no Edit tools — mechanically enforced)", "design-lint v0 (adversarially passed: 10 attacks, 4 holes found + pinned)", "briefs: 4 contracts — interaction · art direction · platform · content"],
      status: "BUILDING — Cycle 3 Phase 00 closed 2026-07-28, Phase 01 built",
      era: "c3",
    },
  ],

  // ── all 23 commands (.claude/commands/, 2026-07-28) ──
  commands: [
    { name: "/arc", short: "Read-only module install and health dashboard", detail: "Shows every arc module with its installed state in this repo, read from the registry the sync writes — looked up, never guessed. For anything missing it prints the exact command to add it. It routes; it never writes.", product: "core" },
    { name: "/arc-audit", short: "Deep OWASP plus STRIDE security audit", detail: "Sends security-sensitive diffs to the security-auditor for OWASP Top 10 plus STRIDE threat modeling, starting from committed scanner evidence. Every high or critical finding opens a tracked issue, and the security stamp lands only with zero open criticals.", product: "review" },
    { name: "/arc-canary", short: "Post-deploy watch loop with rollback", detail: "Watches production after a deploy — errors, bad responses, Core Web Vitals, visual drift against a committed baseline. A regression triggers rollback or blocks promotion and writes an incident report.", product: "qa" },
    { name: "/arc-change", short: "Route mid-build changes through the tracker", detail: "Intake for any mid-build idea or ask — nothing gets coded ad-hoc. It triages the change into the current phase, a new phase spec, an ADR, or the bug flow, updates the tracker before any code, and stops for confirmation on anything load-bearing. Step zero asks whether the change violates a constitution article.", product: "plan" },
    { name: "/arc-commit", short: "Grouped conventional commits, never pushes", detail: "Reads the diff first, splits unrelated changes into separate commits, and writes conventional messages whose bodies explain why. Never pushes — pushing always needs an explicit ask.", product: "git" },
    { name: "/arc-council", short: "Convene the twelve-seat decision council", detail: "Researchers build one shared evidence brief, then stances and matched experts debate blind and in parallel. A verifier grades every point, one bounded rebuttal runs, and the verdict commits — YES, NO, CONDITIONAL or WAIT — with confidence, dissent, a cheapest de-risk test and a review-by date. Review mode later grades verdicts HIT or MISS for calibration.", product: "council" },
    { name: "/arc-design", short: "Legacy UI review-and-fix, scored zero to ten", detail: "The older design-reviewer flow: scores eight design dimensions, flags AI slop, then fixes what it finds with atomic commits. Kept byte-untouched while the new critique loop earns its place beside it — parallel migration, per ADR-0042.", product: "qa" },
    { name: "/arc-design-critique", short: "Read-only design critique with receipts", detail: "The new loop from Cycle 3: renders the route deterministically full-page, then the design-critic — an agent with no edit tools at all — judges it against the declared brief and files findings as VIOLATION, WEAKNESS or POLISH. The runner owns the verdict: PASS means zero violations, and the result lands on the spine as a receipt. Creation fixes, the critic re-verifies — it can never fix its own findings.", product: "design" },
    { name: "/arc-diagram", short: "English to committed Mermaid diagram", detail: "Turns a description into the right Mermaid diagram and saves the source into PLAN.md, an ADR, or docs — version-controlled, never a throwaway preview.", product: "plan" },
    { name: "/arc-docs", short: "Detect and fix documentation drift", detail: "Cross-references README, architecture docs and rules against the diff and updates whatever went stale. Because docs-drift runs inside the deploy guard, this is how a blocked ship gate gets cleared.", product: "review" },
    { name: "/arc-fix-issue", short: "Root-cause and fix a GitHub issue", detail: "Reads the issue, finds the root cause instead of patching symptoms, writes a failing test that reproduces it, then makes it pass. Ends with a proposed conventional commit — no pushing.", product: "git" },
    { name: "/arc-freeze", short: "Lock edits to named directories", detail: "Writes an edit boundary that a hook deterministically enforces: any edit outside the listed directories is blocked until /arc-unfreeze. Used while debugging so unrelated code cannot be helpfully changed.", product: "core" },
    { name: "/arc-kickoff", short: "Start a build: plan, phases, tracker", detail: "Turns a one-line goal into a committed plan before any code. Your appetite sets the tier, forks become ADRs with reversibility notes, phases are ordered by risk with Phase 0 as a walking skeleton. Plan-attackers and a simulator then try to break the plan, lint gates it mechanically, and it stops for your explicit approval.", product: "plan" },
    { name: "/arc-phase-done", short: "Close a phase on evidence, or refuse", detail: "The definition-of-done gate: full test suite green, live demo run, every exit criterion ticked. It writes a tamper-evident evidence bundle with a sha256 manifest and flips the tracker — if anything fails, the phase is simply not done and it says exactly what is missing.", product: "plan" },
    { name: "/arc-pr", short: "Open a GitHub PR with test plan", detail: "Verifies you are off main with everything committed, summarizes the branch, asks approval before any push, then opens the PR with a summary and test plan.", product: "git" },
    { name: "/arc-qa", short: "Browser QA loop with required regression tests", detail: "The qa-tester drives the app in a real browser and returns pass or fail evidence per flow. Every bug fix carries a mandatory regression test — no test means not fixed — then flows are re-verified and the qa gate is stamped.", product: "qa" },
    { name: "/arc-resume", short: "Rebuild session state from the tracker", detail: "Read-only reconstruction of where the build stands: position, health, scoreboard, risks, and the one exact next action. If health is red, next is fixing that — never feature work on a broken base.", product: "core" },
    { name: "/arc-retro", short: "Turn repeated corrections into permanent upgrades", detail: "Scans the phase for friction — repeated instructions, repeated mistakes — and proposes a permanent home for each: a rule, a command, a hook, a gate promotion. Correct the system twice and it makes a third time impossible.", product: "plan" },
    { name: "/arc-review", short: "Scanner-armed diff review via code-reviewer", detail: "Scanner sweep first, then four judgment passes over security, correctness, performance and maintainability. Findings come back with file and line, the review archives as a committed audit trail, and the verdict stamps the commit-keyed code gate.", product: "review" },
    { name: "/arc-second-opinion", short: "Cross-model diff review; disagreement blocks ship", detail: "Sends the diff to a second model and compares findings with the latest review. If the two models disagree on a critical finding, ship is blocked until a human resolves it — and it never fakes a second opinion.", product: "review" },
    { name: "/arc-ship", short: "Lint, build, test, then deploy", detail: "Runs lint, build and test in order, stopping at the first failure, then deploys. The deploy-guard hook independently re-runs tests and re-checks the gates — so red code physically cannot ship. That is not vibes, that is physics.", product: "git" },
    { name: "/arc-toolcheck", short: "Full toolchain health with exact fixes", detail: "Runs the single source-of-truth health script and renders every tool's status, with the exact fix command for anything missing or stale.", product: "core" },
    { name: "/arc-unfreeze", short: "Remove the edit boundary", detail: "Deletes the freeze state so edits are unrestricted again. The counterpart to /arc-freeze once debugging is done.", product: "core" },
  ],

  // ── all 24 agents (.claude/agents/, 2026-07-28) ──
  agents: [
    { name: "code-reviewer", role: "Principal-level diff reviewer: scanner sweep, then a four-pass OWASP-mapped judgment review with blast-radius checks, ending in ship, fix-first, or needs-discussion.", group: "review" },
    { name: "codebase-surveyor", role: "Brownfield preflight for kickoff: maps an existing codebase's stack, conventions, hot modules and danger zones into a curated current-state block.", group: "plan" },
    { name: "council-advocate", role: "Stance seat building the strongest evidence-based case FOR the decision — deliberately biased toward yes, kept honest by the skeptic and the verifier.", group: "council" },
    { name: "council-designer", role: "Domain seat judging through a user and craft lens: jobs-to-be-done, usability friction, product feel, accessibility, brand coherence.", group: "council" },
    { name: "council-engineer", role: "Domain seat on feasibility: complexity, effort, maintainability, build-versus-buy, failure modes, technical reversibility.", group: "council" },
    { name: "council-life-counselor", role: "Domain seat for personal calls: values alignment, reversibility, regret minimization, long-term wellbeing.", group: "council" },
    { name: "council-marketer", role: "Domain seat on positioning and demand: audience, channels, acquisition cost, message, brand trust, retention.", group: "council" },
    { name: "council-neutral", role: "Stance seat that takes no side — weighs base rates, tradeoffs, load-bearing assumptions and genuine unknowns as the honest broker.", group: "council" },
    { name: "council-policy-analyst", role: "Non-partisan seat for policy questions: stakeholders, incentives, second-order effects, precedent, unintended consequences.", group: "council" },
    { name: "council-researcher", role: "The council's fact-finder: takes one sub-question and returns a triangulated fact pack of sourced, confidence-labeled facts — never a recommendation.", group: "council" },
    { name: "council-risk-analyst", role: "Domain seat for finance: expected value versus variance, downside and ruin risk, base rates, liquidity — downside first.", group: "council" },
    { name: "council-skeptic", role: "Stance seat building the strongest evidence-based case AGAINST — risks, failure modes, hidden costs — deliberately biased toward caution.", group: "council" },
    { name: "council-strategist", role: "Domain seat with a VC-plus-operator lens: market, moat, go-to-market, unit economics, timing, competition, founder fit.", group: "council" },
    { name: "council-verifier", role: "The council's cross-examiner: grades the evidence behind every point as Supported, Plausible, Weak or Contested — only surviving points may reach the verdict.", group: "council" },
    { name: "design-critic", role: "Cycle 3's new hire: a vision critic that judges rendered UI against the declared brief and files VIOLATION, WEAKNESS or POLISH findings. It has no edit tools at all — its read-only nature is enforced by hooks, not by promises. Creation fixes; the critic re-verifies.", group: "design" },
    { name: "design-reviewer", role: "The legacy UI reviewer: scores eight design dimensions, detects AI slop, then fixes issues itself — kept untouched while the new critique loop runs beside it.", group: "qa" },
    { name: "log-analyzer", role: "Incident diagnostician using first-error analysis to separate root cause from trigger from symptom, plus the minimal fix and prevention.", group: "ops" },
    { name: "plan-attacker", role: "Adversarial plan reviewer attacking a drafted plan from one assigned focus — edge cases, hidden dependencies, or pre-mortem — returning exact mutations.", group: "plan" },
    { name: "plan-simulator", role: "Kickoff's simulation gate: reads only the plan exactly as an executor would, and counts every missing or ambiguous piece as a blocker — zero blockers to pass.", group: "plan" },
    { name: "product-challenger", role: "Pre-kickoff interrogator: six forcing questions, three implementation approaches, and a pre-mortem, written straight into the plan.", group: "plan" },
    { name: "qa-tester", role: "Drives the running app in a real browser: happy paths, sad paths, boundaries, accessibility checks, evidence-only reporting.", group: "qa" },
    { name: "question-planner", role: "Designs kickoff's fork questions from a fresh context — because the planning thread would otherwise ask questions that confirm its own assumptions.", group: "plan" },
    { name: "researcher", role: "Research analyst who triangulates two-plus independent sources with confidence labels and dates before answering.", group: "research" },
    { name: "security-auditor", role: "Deep application security audit: OWASP Top 10 plus STRIDE per trust boundary, a concrete exploit scenario required for every finding.", group: "review" },
  ],

  // ── the golden loop ──
  pipeline: {
    summary:
      "An idea gets pressure-tested first — forcing questions for fuzzy products, the council for hard forks. Kickoff turns it into a committed plan with ADRs and risk-ordered phases. Each phase runs the golden loop — smallest working slice, tests, live demo, verify in the real place, tracker update — and passes its gates before phase-done will close it on evidence. Shipping goes through the deploy guard and a canary watch, retro feeds every lesson back as a permanent upgrade, and since Cycle 2 every step of all of it lands on the spine as a receipt.",
    stages: [
      { name: "Challenge", what: "Fuzzy idea → six forcing questions. Hard fork → a council verdict. Nothing skips straight to code." },
      { name: "Kickoff", what: "Appetite sets the tier, forks become ADRs, phases are risk-ordered. Attack agents and a simulator try to break the plan; lint gates it; then it stops for explicit approval." },
      { name: "Walking skeleton", what: "Phase 0 is the thinnest deployable end-to-end slice on fakes — the biggest risk dies first." },
      { name: "Golden loop", what: "Per phase: build the smallest working slice, test it, demo it live, verify in the real place, update the tracker. Every external dependency gets an interface, a fake, and a real implementation." },
      { name: "Change discipline", what: "Any mid-build idea goes through /arc-change — triaged into a tracked home before any code. Applies to the owner's own suggestions too." },
      { name: "Gates", what: "Review on every phase, audit for sensitive surfaces, browser QA with mandatory regression tests, design critique for UI, second opinion for critical logic. Each stamps the commit-keyed ledger." },
      { name: "Close on evidence", what: "Phase-done demands green suite + live demo + exit criteria, then writes a sha256-verified evidence bundle — or refuses and names what is missing." },
      { name: "Ship + watch", what: "Gated PR, deploy with the guard re-running tests, canary watching production with rollback." },
      { name: "Retro", what: "Repeated corrections become permanent upgrades. Trial gates get promoted on ledger evidence. The system that made the mistake stops existing." },
      { name: "Receipt", what: "Every step above emitted an event. The day closes on the spine — replayable, greppable, forever." },
    ],
  },

  council: {
    summary:
      "The council is arc's decision court. Researchers compile one neutral evidence brief; then three stances — advocate for, skeptic against, neutral — plus up to four matched domain experts debate in parallel, blind to each other. A verifier grades every point Supported, Plausible, Weak or Contested; one bounded rebuttal round runs; a cross-model juror can independently re-grade contested points. Verdicts always commit — YES, NO, CONDITIONAL or WAIT — with confidence, the strongest dissent, a cheapest de-risk test, and a review-by date. Review mode later scores each verdict HIT or MISS against reality, feeding per-confidence hit-rates and Brier scores. Session 001 reviewed the first venture's scope — verdict CONDITIONAL; the founder overrode it with a written ADR, which is exactly how disagreement is supposed to leave a trail.",
  },

  gates: {
    summary:
      "arc's gates block by default. One profile key — starter, standard, strict — switches every gate as a set: the destructive guard, the deploy guard's test re-run, coverage, docs-drift, scans, and required review stamps keyed to the commit sha, so any new commit resets the stamps and forces honest re-review. New gates enter WARN-first trial mode and are promoted to blocking only with trial-ledger evidence. And no gate, lint or parser counts as done until an adversarial construct-a-breaking-input pass has run against it — that pass found forty-three real holes in the early gates, twenty-five more in the spine build, and four in design-lint. All fixed, all pinned as fixtures so they can never sneak back.",
  },

  autonomy: {
    summary:
      "Automation in arc is a ladder, not a switch. Every capability starts at the bottom and climbs only on trial-ledger evidence — for example twenty consecutive drafts approved unedited. Any incident demotes it automatically; trust is re-earned, never argued back. And some things stay human forever, at any autonomy level: kill decisions, pricing, refunds, ad spend, real-money trading, and publishing under the owner's name.",
    levels: [
      { level: "L0", meaning: "observe only — the spine watches, nothing acts" },
      { level: "L1", meaning: "draft — every output waits for human approval" },
      { level: "L2", meaning: "act inside hard caps — bounded, budgeted, reversible" },
      { level: "L3", meaning: "act freely, report in the weekly digest" },
      { level: "L4", meaning: "barely exists — and never for money, kills, or the owner's name" },
    ],
    foreverHuman: ["kickoff approvals", "kill decisions", "pricing", "refunds", "ad spend", "real-money trading unlock", "publishing under Ashiq's name"],
  },

  // ── the receipt spine (LIVE — Cycle 2) ──
  spine: {
    summary:
      "The spine is the company's memory and its only public API — an append-only JSONL event log. If it isn't an event, it didn't happen. The emitter validates, redacts and appends; in hook mode it never blocks work (invalid events quarantine instead), in strict mode it fails CI loudly. A replayer rebuilds all derived state deterministically from the log. Consumers read through one reader with per-consumer cursors — nothing else may touch the files, and a lint hunts for violations. Closed days are immutable; corrections supersede, never edit. Secrets can never leak: redaction is fail-safe and stub-only.",
    laws: [
      { name: "canonical JSONL is truth", adr: "ADR-0024", what: "append-only daily files, canonical serialization, sha-chained — greppable, replayable, corruption-proof" },
      { name: "instance-only", adr: "ADR-0025", what: "the spine lives in the instance's state, never synced into the mold — state never lives in the template" },
      { name: "closed vocabulary", adr: "ADR-0026", what: "18 event kinds, fixed set — a new kind needs an ADR, so the language of the company cannot silently drift" },
      { name: "CLI-first", adr: "ADR-0027", what: "brief and inbox are commands before they are pixels — the dashboard is a later skin over the same reader" },
      { name: "redaction fail-safe", adr: "ADR-0028", what: "on any doubt, stub-only — no field names, no values, no lengths ever leak into the log" },
      { name: "immutability windows", adr: "ADR-0029", what: "active day append-only, closed day immutable; corrections via supersedes, never edits" },
      { name: "spine = only public API", adr: "ADR-0030", what: "one reader, per-consumer cursors — no bus, no daemon; event-driven later with zero consumer changes" },
      { name: "dual-mode emitter", adr: "ADR-0031", what: "hook mode never blocks the work; strict mode exits loudly for CI and ingest" },
    ],
    brief:
      "arc brief compresses the company's day into one screen — needs-you first, then money, progress, background. Hard noise budget: forty lines or it is a bug. Dogfood day one, for real: ten lines, three hundred six milliseconds, twenty-two receipts behind it.",
    inbox:
      "approval.requested events queue for the owner; arc-inbox approve or reject — always with a reason — writes decision.recorded back to the spine. Every decision becomes calibration data. The reasons are the company learning its owner's taste.",
    revenueTruth:
      "revenue.received is real-only: it enters the log through strict ingest with cross-day dedupe. Pre-launch ventures emit revenue.simulated — clearly separated, so the P&L can never be polluted by wishes. Real revenue so far: zero. It says so on its own dashboard, because that is the brand.",
  },

  // ── ventures ──
  ventures: {
    rule: "arc is the factory; a venture is a thing the factory's tools get installed into. Revenue products live in their own repos with their own money, their own kill criteria set at kickoff, and arc synced inside. The factory is never the product — and the venture track wins every tie.",
    portfolio: [
      {
        id: "lexos",
        name: "LexOS",
        badge: "venture #1 · LIVE",
        what: "Legal practice management for India — solo advocates and two-to-ten-lawyer firms. Clients, cases, hearing reminders on WhatsApp, invoicing through Razorpay, a no-login client portal, and AI drafting. It replaces WhatsApp plus Excel.",
        pricing: "₹2,999 Growth · ₹5,999 Pro, per month",
        receipts: ["Phase 1 closed — live at lexos-bay.vercel.app", "row-level security on 10/10 tables", "163 tests green", "p95 267 ms", "decision recorded as ADR-0007, revisit at the 50% checkpoint"],
        honest: "Kill checkpoint set in writing: one week after billing ships, around day twenty-six. First real ₹ targeted September 2026 — until then its revenue events are labeled simulated.",
      },
      { id: "venturemind", name: "venturemind", badge: "consumer repo", what: "An earlier product repo, now an arc consumer — the upgrade-path dogfood target.", pricing: "", receipts: ["arc installed via sync, registry-tracked"], honest: "" },
      { id: "opportunity-scout", name: "Opportunity-Scout", badge: "consumer repo", what: "Pain-mining scout, the fresh-install dogfood target — and the seed of the future discover module.", pricing: "", receipts: ["arc installed via sync, registry-tracked"], honest: "" },
    ],
    math: "Portfolio honesty: expect one in four ventures to live. Every venture ships WITH a distribution plan or does not ship. Whatever fails its criteria is attic'd with a retro — killed honestly, learning kept.",
  },

  // ── the roadmap + sleeping modules ──
  vision: {
    hq: "HQ is the command room: the spine below, a brief and inbox on top, later a dashboard and a chat interface over the same reader — talk to the company, ask it what happened, approve from anywhere. The face you are looking at is a concept of exactly that: the company OS with a voice.",
    roadmap:
      "Cycle one built the factory — closed at about twenty-two percent of its appetite. Cycle two built the receipt spine — live since July twenty-fourth. Cycle three, running now, is the designer. Next: LexOS launches billing and takes the first real rupee, target September. Then growth engines when a venture pulls them, the public arc launch with sponsors around November, the evolve self-improvement loop in December, and from twenty-twenty-seven arc itself as a product — public repo first, SaaS later, integrating every AI coding tool through its model-agnostic engine.",
    milestones: [
      { when: "Sep 2026", what: "first real ₹ — venture #1's first paying customer", state: "target" },
      { when: "Oct–Nov 2026", what: "₹10–30k MRR — venture growth + maybe a service lane", state: "target" },
      { when: "Nov–Dec 2026", what: "arc goes public — sponsors begin", state: "target" },
      { when: "Dec 2026", what: "₹25k MRR (stretch ₹50k)", state: "target" },
      { when: "mid-2027", what: "₹1L+ MRR — two to three earning ventures + arc revenue", state: "target" },
      { when: "2027+", what: "arc itself as SaaS — every AI tool, one OS", state: "target" },
    ],
    sleeping: [
      { id: "develop", dept: "engineering", wakes: "plan v5 frozen in review — the execution harness between plan-approval and phase-done", what: "small spec-anchored increments, each independently proven; every number computed or earned, never self-declared" },
      { id: "discover", dept: "product", wakes: "when venture #2 must be chosen", what: "pain mining: complaints in, clustered and scored ideas out, council hand-off" },
      { id: "growth", dept: "marketing", wakes: "when a live venture needs traffic", what: "SEO/content engine + the faceless-video pipeline, publishing tied to ventures" },
      { id: "leads", dept: "sales", wakes: "when an offer needs outbound", what: "ICP, enrichment, capped sequences — twenty a day, drafts first, evidence to escalate" },
      { id: "ops", dept: "support", wakes: "at two live ventures", what: "canary sweeps, support triage drafts, weekly health reports" },
      { id: "ledger", dept: "finance", wakes: "at two revenue sources", what: "per-venture P&L, AI-cost attribution, kill-distance meters" },
      { id: "legal-pack", dept: "legal", wakes: "at first launch prep", what: "policies before real payments — terms, privacy, refunds per venture" },
      { id: "memory", dept: "kernel", wakes: "when finding a lesson takes over two minutes", what: "playbooks + full-text recall for every process" },
      { id: "engine", dept: "kernel", wakes: "at public prep, or a second runtime", what: "model drivers + router — claude, codex, gemini, local, anything" },
      { id: "bench", dept: "kernel", wakes: "when drivers disagree on quality", what: "eval packs score every model on every process — a new model benchmarks in a day, with receipts" },
      { id: "evolve", dept: "kernel", wakes: "at four-plus weeks of real metrics", what: "scoreboards → experiments → champion/challenger promotions — propose-only, never self-merge" },
      { id: "dashboard", dept: "hq", wakes: "when the brief overflows its screen", what: "the HQ mock wired to the reader — a skin, not a new truth" },
      { id: "chat-mcp", dept: "hq", wakes: "when the dashboard is live", what: "talk to the company over MCP — query, brief, approve from a conversation" },
      { id: "policy", dept: "governance", wakes: "at three action kinds running L2 — before any scheduler", what: "per-action capability vectors, deny-by-default" },
      { id: "scheduler", dept: "hq", wakes: "at the first L3 process — policy engine is a hard prerequisite", what: "cron → headless runs with budgets" },
      { id: "trader", dept: "sandbox", wakes: "monthly revenue + a written opening from Ashiq — LAST", what: "paper-only, isolated instance and creds, a 72-hour cooldown on any real-money unlock, circuit breaker — never load-bearing income" },
    ],
  },

  workflow: {
    git: "All build work happens on feature branches and reaches main through PRs — never direct commits to main, never force-push. Pushing and deploying happen only on an explicit ask, and the deploy guard re-runs tests before any ship.",
    approval: "Nothing is implemented without the owner's explicit go — a plan is presented, and only an explicit approval starts the edit. Every cycle, every phase, every module obeys the same gate. In this house even the AI waits for 'pannu'.",
  },

  // ── the constitution (draft v0.1, adoption pending) ──
  constitution: {
    status: "DRAFT v0.1 — becomes law on the owner's sign-off, recorded as the spine's first constitution.adopted event",
    precedence: "Constitution > ADRs > PLAN > code",
    eternal: [
      { id: "E1", name: "The Receipts Law", text: "Every action that matters emits an event. The spine is append-only — nothing edited, nothing deleted, corrections supersede. A claim without a receipt is an opinion." },
      { id: "E2", name: "Human Sovereignty", text: "Irreversible actions belong to the human alone: moving money, killing a venture, changing prices, unlocking real-money trading, publishing under Ashiq's name. No level of proven autonomy ever includes these." },
      { id: "E3", name: "The Truth Law", text: "The system never fakes evidence. Simulated is always labeled simulated, untested is never reported as tested, and a failing result is never dressed as a passing one — no matter which model produced it." },
    ],
    working: [
      { id: "A1", name: "Evidence over assertion", text: "LLM output is a draft until a deterministic check or a human verifies it." },
      { id: "A2", name: "Boring tech first", text: "Files, POSIX, zero-dep Node, SQLite. Cleverness must pay rent." },
      { id: "A3", name: "Every module reduces CEO time", text: "The north-star is ₹ per hour of the human's week. Added human hours = regression." },
      { id: "A4", name: "Reversible or it doesn't run", text: "Every automation can be stopped, rolled back, demoted. Incidents demote automatically." },
      { id: "A5", name: "One source of truth", text: "Each fact lives in one place; everything else is a rebuildable view." },
      { id: "A6", name: "Measured or it didn't improve", text: "Hypothesis, sample floor, holdout. Nothing changes silently — prompts included." },
      { id: "A7", name: "Everything is replaceable", text: "Models, drivers, runtimes are parts, not identities. Contracts over vendors." },
      { id: "A8", name: "Earn before build", text: "Capability is built when a venture pulls it, never pushed by ambition." },
      { id: "A9", name: "Appetite over estimate", text: "Every effort carries a hard cap. A blown cap means cut or kill — never a silent extension." },
      { id: "A10", name: "Kill honestly, keep the learning", text: "Whatever fails its criteria is attic'd with a retro, and the lesson is pinned." },
    ],
    amendment: "Tier E is unamendable — a fork that changes it is a different company. Tier A amendments need a written proposal, a seven-day cooling period, explicit human sign-off, and a constitution.amended event. Machines may cite the constitution and flag tension with it — but only the human may amend it.",
  },

  // ── the numbers strip (all receipted) ──
  stats: {
    modules: 8,
    commands: 23,
    agents: 24,
    councilSeats: 12,
    tests: "389 · 3-OS CI",
    adrs: 48,
    spineKinds: 18,
    cyclesClosed: 2,
    venturesLive: 1,
    realRevenue: "₹0 — and it says so",
  },

  // ── QA bank for the voice brain ──
  qa: [
    { id: "what-is-arc", keywords: ["what is arc", "arc na enna", "about arc", "intro", "yourself", "nee yaru", "who are you", "arc pathi sollu", "explain arc", "company os"], answer: "I am arc — a receipt-driven company operating system, built and owned by Ashiq. One event spine, one process layer, one model router, one human approval inbox. Eight modules run the factory today, one venture is live, and every claim I make has a receipt behind it. Evidence over assertion — that is basically my whole personality." },
    { id: "products", keywords: ["products", "modules", "enna products", "portfolio", "eight modules", "products sollu", "evlo products", "what modules"], answer: "Eight modules today. Core is the deterministic foundation. Plan owns kickoff and phased builds. Review does scanner-armed code review. QA drives a real browser. Git handles commits and gated ships. Council is the twelve-seat decision court. HQ is the live receipt spine with the brief and the approval inbox. And design — the newest — is being built right now, in Cycle 3." },
    { id: "receipts", keywords: ["receipt", "receipts", "evidence", "proof", "spine receipts", "why receipts"], answer: "A receipt is an event on the spine — an append-only log where every action of the company lands. Phases close with evidence bundles, reviews stamp a commit-keyed ledger, decisions record their reasons. A claim without a receipt is an opinion. That rule is Eternal Article One of the constitution." },
    { id: "spine", keywords: ["spine", "event spine", "event log", "receipt spine", "jsonl", "events", "spine na enna"], answer: "The spine is the company's memory and its only public API. Every action appends an event to canonical JSONL — eighteen closed kinds, nothing else. A replayer rebuilds all state from it deterministically. Consumers read through one reader with cursors; closed days are immutable; corrections supersede. It went live on July twenty-fourth and has been recording the company's real days since." },
    { id: "brief", keywords: ["brief", "morning brief", "daily brief", "one screen", "arc brief"], answer: "arc brief compresses the whole company's day into one screen — needs-you first, then money, progress, background. The noise budget is hard: forty lines or it is a bug. On dogfood day one it ran ten lines in three hundred six milliseconds, with twenty-two receipts behind it." },
    { id: "inbox", keywords: ["inbox", "approval inbox", "approve", "approvals", "decision", "pending approvals"], answer: "The approval inbox is where the company asks for its owner. approval.requested events queue up; Ashiq approves or rejects, always with a reason, and that becomes a decision.recorded receipt. Nine-ish minutes a day of decisions — everything else is the machine's." },
    { id: "council", keywords: ["council", "council na enna", "debate", "jury", "jurors", "decision court", "verdict", "council epdi", "council pathi"], answer: "The council is my decision court — twelve seats. Three stances argue for, against, and neutral; matched domain experts join; everyone debates blind and in parallel from one shared evidence brief. A verifier grades every point, a cross-model juror can re-grade contested ones, and the verdict commits: YES, NO, CONDITIONAL or WAIT, with confidence, dissent, and a review-by date. Later each verdict is scored against reality — hit or miss." },
    { id: "council-001", keywords: ["session 001", "first session", "council session", "lexos council", "conditional verdict", "founder override"], answer: "Council session one reviewed LexOS's scope. Verdict: CONDITIONAL. The founder went ahead anyway — and recorded the override as a written decision, ADR-0006, completeness-first. That is the system working: disagreement is allowed, but it always leaves a receipt." },
    { id: "gates", keywords: ["gates", "quality gates", "gate na enna", "blocking", "profile", "strictness", "warn", "trial mode", "enforcement", "fail mode"], answer: "My gates block by default. One profile key — starter, standard, strict — sets them all: coverage, docs drift, scans, review stamps keyed to the commit. New gates start WARN-first in trial and earn blocking mode through logged evidence. And nothing that judges counts as done until an adversarial pass has attacked it — that pass has found seventy-plus real holes across my history, every one fixed and pinned." },
    { id: "adversarial", keywords: ["adversarial", "43 holes", "breaking input", "attack pass", "holes", "hardening"], answer: "Every gate, lint and parser gets a construct-a-breaking-input pass before it earns trust. It found forty-three holes in the early gates, twenty-five in the spine build, four in design-lint — all in code that looked correct and passed its own tests. Each hole is fixed and pinned as a fixture, so it can never sneak back. Paranoia, but with receipts." },
    { id: "autonomy", keywords: ["autonomy", "autonomy ladder", "automatic", "levels", "l0", "l1", "l2", "l3", "l4", "trust ladder", "auto epdi", "self driving"], answer: "Automation here is a ladder, not a switch. L0 observes, L1 drafts for approval, L2 acts inside hard caps, L3 acts and reports weekly, and L4 barely exists. Promotion needs trial-ledger evidence — like twenty consecutive unedited approvals. Any incident demotes automatically. And money, kills, pricing, and Ashiq's name never leave human hands, at any level." },
    { id: "forever-human", keywords: ["forever human", "human only", "never automated", "human sovereignty", "what stays human"], answer: "Some things no autonomy level ever touches: kickoff approvals, kill decisions, pricing, refunds, ad spend, unlocking real-money trading, and publishing under Ashiq's name. That is Eternal Article Two — human sovereignty. The machine runs the company; the human owns it." },
    { id: "constitution", keywords: ["constitution", "law", "articles", "dna", "eternal", "amendment", "supreme"], answer: "The constitution is arc's DNA — it outranks every plan, ADR and line of code. Three eternal articles: receipts, human sovereignty, truth. Ten working articles cover evidence, boring tech, appetites, honest kills. Amending a working article takes a written proposal, seven days of cooling, and the owner's sign-off. Machines may cite it, never amend it. It is a draft right now — adoption lands as the spine's first constitution.adopted event." },
    { id: "truth-law", keywords: ["truth law", "e3", "fake", "simulated", "honest", "honesty"], answer: "Eternal Article Three: the system never fakes evidence. Simulated is always labeled simulated — my revenue feed literally says simulated on it until real money lands. Untested is never reported as tested. A failing result is never dressed as passing. Even this face follows it — every number I speak has a receipt, and where there is none, I say so." },
    { id: "lexos", keywords: ["lexos", "venture one", "venture 1", "first venture", "legal saas", "lawyers", "advocate"], answer: "LexOS is venture number one — legal practice management for India, for solo advocates and small firms. Clients, cases, hearing reminders on WhatsApp, Razorpay invoicing, a no-login client portal, AI drafting. Two plans: two thousand nine hundred ninety-nine and five thousand nine hundred ninety-nine rupees a month. Phase one is closed and live — row-level security on all ten tables, one hundred sixty-three tests, p ninety-five at two sixty-seven milliseconds. Its kill checkpoint is already set in writing. First real rupee: targeted September." },
    { id: "ventures", keywords: ["ventures", "venture", "revenue products", "portfolio math", "factory vs venture", "apps"], answer: "arc is the factory; ventures are what it builds — separate repos with their own money and their own kill criteria, arc installed inside. LexOS is live as venture one; venturemind and Opportunity-Scout run as consumer repos. Portfolio honesty: expect one in four to live, every venture ships with a distribution plan, and whatever fails is killed honestly — attic'd with its learning kept." },
    { id: "money", keywords: ["money", "revenue", "mrr", "milestones", "kaasu", "panam", "income", "earning", "first money"], answer: "Honest numbers: real revenue today is zero, and the spine says so — pre-launch events are labeled simulated. The targets: first real rupee in September twenty-six when LexOS billing ships. Twenty-five thousand MRR by December. A lakh-plus monthly by mid twenty-seven, from two to three earning ventures plus arc itself. The north-star metric is rupees per month per hour of Ashiq's week." },
    { id: "north-star", keywords: ["north star", "north-star", "metric", "goal metric", "optimize", "per hour"], answer: "One number rules everything: rupees per month of revenue, per hour of Ashiq's weekly involvement. A feature that adds human hours is a regression, however impressive. That is Working Article Three of the constitution." },
    { id: "roadmap", keywords: ["roadmap", "next", "cycles", "plan ahead", "what next", "adutha enna", "timeline", "execution plan", "future"], answer: "Cycle one built the factory — closed. Cycle two built the receipt spine — live. Cycle three, running now, is the designer. Next comes LexOS's billing launch and the first real rupee, target September. Then growth engines when a venture pulls them, the public arc launch around November, the evolve loop in December — and from twenty-twenty-seven, arc itself as a product for every AI tool." },
    { id: "sleeping", keywords: ["sleeping", "pull trigger", "triggers", "queue", "planned modules", "future modules", "backlog", "waiting"], answer: "Sixteen-plus modules sleep in the queue, each with an alarm called a pull-trigger: growth wakes when a venture needs traffic, discover when venture two must be found, ledger at two revenue sources, policy before any scheduler, trader last of all — paper-only, with a seventy-two-hour cooldown on real money. Nothing gets built before its trigger fires. Earn before build — Working Article Eight." },
    { id: "designer", keywords: ["designer", "design module", "design critic", "critique", "cycle 3", "current cycle", "ipo enna", "what building now"], answer: "Right now, Cycle three is building the designer. Its critic is a vision agent that judges rendered UI against a declared brief — and it is read-only by construction: no edit tools, write boundary enforced by hooks. Design-lint machine-checks every brief, computing contrast from declared color pairs. Phase zero closed on day one — the critic caught a planted lorem ipsum — and phase one survived ten constructed attacks. Verdicts land on the spine as receipts." },
    { id: "design-brief", keywords: ["design brief", "art direction", "feel words", "contracts", "brief contracts"], answer: "Every designed surface declares a brief with four contracts: the interaction model — seven answers about the user's job; art direction — feel words, anti-words, declared contrast pairs; a platform contract — which surfaces are actually supported; and a content contract — the exact nouns, verbs and tone. The critic judges against the brief, and a linter machine-checks the brief itself. Taste, written down, then enforced." },
    { id: "kickoff", keywords: ["kickoff", "arc-kickoff", "start build", "new project", "plan first", "kickoff epdi"], answer: "Kickoff is how anything gets built: a one-line goal becomes a committed plan before any code. Appetite sets the tier, forks become ADRs, phases are risk-ordered with a walking skeleton first. Then attack agents and a simulator try to break the plan, lint gates it mechanically, and it stops for explicit approval. In this house even the AI waits for pannu." },
    { id: "phases", keywords: ["phase", "phase done", "close phase", "evidence bundle", "definition of done"], answer: "A phase closes only through phase-done: full suite green, the live demo run, every exit criterion ticked — then a tamper-evident evidence bundle with a sha256 manifest gets written. If anything fails, the phase is simply not done, and it tells you exactly what is missing. Evidence over assertion." },
    { id: "retro", keywords: ["retro", "retrospective", "improve", "learnings", "lessons", "self improve"], answer: "Retro closes the improvement loop: repeated corrections become permanent upgrades — a rule, a hook, a gate promotion — shipped as diffs the owner approves. Correct me twice and I make the third time impossible. Later, the evolve module generalizes this into scoreboards and champion-challenger experiments for every module — propose-only, never self-merged." },
    { id: "model-agnostic", keywords: ["model agnostic", "models", "claude only", "other models", "gemini", "codex", "gpt", "engine", "router", "any llm", "vendor lock"], answer: "The IP is the process, not the model. The plan: every command's substance becomes a model-neutral process file; adapters compile it to each runtime, proven by byte-diff; drivers and a router run any model — claude, codex, gemini, local, whatever comes next. And bench scores every model on every process class, so when a new model drops, the whole company upgrades in a day — with receipts. Models are parts, not identities." },
    { id: "evolve", keywords: ["evolve", "self improvement", "champion challenger", "experiments", "scoreboard", "improve itself"], answer: "Evolve is the generalized retro, sleeping until four-plus weeks of real metrics exist. It reads the spine, rolls scoreboards per module, proposes bounded experiments, and promotes winners as reviewed diffs with sample floors, holdouts and auto-rollback. It may propose, never self-merge. Continuous improvement, but with a paper trail." },
    { id: "trader", keywords: ["trader", "trading", "stocks", "crypto", "real money trading", "paper trading"], answer: "The trader is permanently special: a paper-trading sandbox, isolated instance and credentials, scored two out of ten as an income idea — and it stays last in the queue. Real money unlocks only by a hand-written policy change from Ashiq, with a seventy-two-hour cooldown and a circuit breaker. It is never load-bearing income. That is the honest answer about trading." },
    { id: "tests", keywords: ["tests", "bats", "test suite", "ci", "evlo tests", "how many tests", "coverage"], answer: "Three hundred eighty-nine tests, green across three operating systems in CI — that run is the authority, not any local pass. The suite grew from two hundred forty-seven through the factory cycle to today, and every adversarial hole ever found lives on as a pinned fixture inside it." },
    { id: "counts", keywords: ["how many", "count", "evlo", "ethana", "numbers", "stats"], answer: "Today's numbers, all receipted: eight modules, twenty-three commands, twenty-four agents — twelve of them council seats — three hundred eighty-nine tests on three operating systems, forty-eight recorded decisions as ADRs, eighteen event kinds on the spine, two cycles closed, one venture live. Real revenue: zero, and it says so." },
    { id: "adr", keywords: ["adr", "decisions", "decision records", "why is it like this", "architecture decisions"], answer: "Every fork in arc's history is an ADR — forty-eight so far. Why JSONL is truth, why the spine is the only API, why the critic is read-only, why tests stay centralised, even why a venture overrode the council. When you ask why is it like this, the answer is a numbered file, not a memory." },
    { id: "approval-gate", keywords: ["approval", "pannu", "permission", "explicit approval", "who approves"], answer: "Nothing is implemented without the owner's explicit go. A plan is presented, and only an explicit approval — pannu — starts the edit. Every cycle, every phase, every mid-build change obeys the same gate. It is the deepest rule in the house, and it applies to me most of all." },
    { id: "git-workflow", keywords: ["git workflow", "branches", "push", "main branch", "pr", "commit epdi", "deploy rules", "feature branch"], answer: "Work happens on feature branches, never straight on main. Commits are conventional and grouped, pushes and deploys happen only on an explicit ask, and the deploy guard re-runs tests before any ship. Red means blocked — physically." },
    { id: "hq-vision", keywords: ["hq", "arc hq", "jarvis", "second brain", "dashboard vision", "command room", "company dashboard"], answer: "HQ is the command room: the spine below, the brief and inbox on top — live today as CLI. Next skins: a dashboard when the brief outgrows its screen, then a chat interface over the same reader, so you can ask the company what happened and approve from a conversation. This face is a concept of exactly that. And people say Jarvis — the name is arc." },
    { id: "public-saas", keywords: ["public", "open source", "saas", "release", "github", "sponsors", "sell arc"], answer: "The plan for arc itself: public repo around November with the launch story told from its own receipts, sponsors after, SaaS from twenty-twenty-seven — and integration with every AI coding tool through the model-agnostic engine. The factory becomes a product once its ventures prove it. The constitution doubles as the manifesto." },
    { id: "org", keywords: ["org", "company roles", "employees", "staff", "team", "who works", "departments", "hiring"], answer: "If arc is a company, about fifty roles map onto it — board is the council, HR is the trial-ledger and the autonomy ladder, engineering is the factory, and the operator departments are briefs waiting on triggers. But roles are a catalog, not headcount: an employee here is an agent spawned for a task, then gone. Twenty-ish roles exist today, nineteen are planned, five stay human forever. The CEO is Ashiq — thirty to sixty minutes a day." },
    { id: "burn", keywords: ["burn", "appetite", "under budget", "how fast", "velocity", "speed"], answer: "Appetites are hard caps, and the record is consistent: cycle one closed six of six phases at about twenty-two percent of its appetite; cycle two's build phases used about forty percent. A blown cap means cut or kill, never a silent extension — banked beats perfect, Working Article Nine." },
    { id: "history", keywords: ["history", "story", "journey", "how did arc start", "origin", "evolution"], answer: "The short logbook: arc began as a Claude Code template, became a six-module factory in cycle one, grew its receipt spine in cycle two — live July twenty-fourth — and is growing its designer now in cycle three. One venture is live, the constitution awaits adoption, and the first real rupee is targeted for September. Every step of that story exists as archives, evidence bundles and ADRs — the story is greppable." },
    { id: "face", keywords: ["face", "this face", "particle", "who is this face", "voice", "talking", "mask"], answer: "This face is arc's front door — fourteen thousand particles in the shape the owner picked, with my voice running fully in your browser: speech in, local brain, speech out, no backend, no keys. The face is a concept of the HQ chat layer — talk to the company, get answers with receipts." },
    { id: "ashiq", keywords: ["ashiq", "owner", "founder", "who built", "creator", "yaru panna"], answer: "Ashiq built arc and owns every irreversible decision in it — kickoffs, kills, pricing, money, and his own name. The system's whole design goal is to compress his day to the decisions only he can make: thirty to sixty minutes of brief and inbox, everything else receipted machine work." },
    { id: "what-can-i-ask", keywords: ["what can i ask", "help", "enna kekalam", "capabilities", "what do you know", "topics", "enna panna mudiyum", "menu"], answer: "Ask me anything about arc. The eight modules, any of the twenty-three commands or twenty-four agents, how the council votes, how the spine records the company, the autonomy ladder, LexOS, the money milestones, the constitution, or what is being built right now. Try one — ask how a phase closes." },
    { id: "fallback", keywords: ["fallback", "default", "unknown"], answer: "I do not have a receipt for that one. Try my modules, commands, the council, the spine, the ladder, LexOS, the roadmap, or the constitution — those I know cold." },
  ],
}
