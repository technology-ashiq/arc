# User Manual -- Sample Structure (arc- system)

> Intha manual project structure-a **fulla epdi use panradhu**-nu explain pannudhu (Tanglish).
> Ella commands, hooks, agents, scripts + background tools, and oru real **pipeline** --
> kickoff -> phase build -> review -> ship -> retro -- step-by-step.
> Idhu "ipo iruka structure"-ku exact-ah match aagum (2026-07-07 integrated version).

---

## 0. Idhu enna? (One-minute picture)

Idhu oru **project mold** -- Claude Code-ku "brain + rails". Nee code ezhudhradhukku munnadi,
intha structure Claude-a oru disciplined engineer-ah maathudhu: enna plan pannanum, epo test
pannanum, epo dhaan ship pannalaam-nu rules + automation vachi enforce pannudhu.

Oru line-la whole system:

> **CLAUDE.md guides | hooks enforce | commands/agents/skills/rules load on demand |
> docs hold the depth | tracker files remember the build.**

Rendu "half" iruku:
1. **Discipline spine (arc-)** -- un core process: plan, phase-by-risk, gates, committed tracker.
2. **Capability tools** -- review, security, QA, design, docs, cross-model -- ella-um arc- commands.

**"arc twist"** (whole system-oda soul): edhuvum sonna, adhu oru **committed artifact + oru gate +
resumable state** produce pannanum. Just "report" panna maaten -- enforce pannum. Adhu dhaan
idhukku power.

---

## 1. Mental model -- 3 madhiri load aagum (idha purinjika, ellame puriyum)

Structure-la ella piece-um moonu "loading behavior"-la ondhu:

| # | Behavior | Yaaru | Enna | Claude marakka mudiyuma? |
|---|----------|-------|------|--------------------------|
| 1 | **Advisory** (always in context) | `CLAUDE.md`, `CLAUDE.local.md`, `settings.json`, `statusline.sh` | Team brain / guidelines | Aamaa -- long session-la marakkalaam |
| 2 | **Deterministic** (event-la auto-run) | `.claude/hooks/*.sh` | Rules that MUST happen | **Illa -- hook forget aagadhu** |
| 3 | **On-demand** (thevai-ppatta-podhu) | `.claude/commands/`, `.claude/agents/`, `.claude/rules/`, `.claude/skills/`, `docs/` | Nee kupittaa / match aana-podhu load | N/A -- context-efficient |

**Golden rule:** guideline-na CLAUDE.md-la; *kandippa* nadakkanum-na hook-la; capability-na command/agent-la.

---

## 2. Folder structure (ipo iruka mold)

```
Sample Structure/
|- CLAUDE.md                 # team brain (advisory, <200 lines)
|- CLAUDE.local.md           # private (gitignored) -- un port, secrets pointers
|- README.md
|- .env.example              # env contract (key names only)
|- .mcp.json                 # MCP servers (supabase, playwright, codegraph...)
|- sync-to-project.ps1       # mold -> existing project-ku machinery push
|- .claude/
|  |- settings.json          # permissions + hooks wiring + arc.* config
|  |- settings.local.json    # personal taste (gitignored)
|  |- statusline.sh          # status bar
|  |- output-styles/terse.md
|  |- commands/  (20)        # /arc-*  -- nee type panradhu
|  |- agents/    (7)         # background specialists (Task subagents)
|  |- rules/     (6)         # path-glob-la auto-load aagum guidance
|  |- hooks/     (6)         # event-driven enforcement
|  |- scripts/   (5)         # shared scripts (hooks + commands kupidum)
|  |- skills/                # model self-invoke skills (seo-article-writer...)
|  `- state/                 # ledger + freeze + snapshots (auto)
`- docs/                     # depth -- build-playbook, setup guides, THIS manual
   |- usermanual.md          # <- neenga inga
   |- build-playbook.md      # Golden Loop, DoD, tracker method (full)
   |- how-it-works.md
   `- templates/             # PLAN / phase-spec / ADR templates
```

Build-time la innum moonu tracker files varum (root-la):
`PLAN.md` | `phases/phase-NN-spec.md` | `PROGRESS.md` -- (Section 8 paaru).

---

## 3. One-time setup (pudhu project start panna)

1. Intha mold folder-a copy panni un pudhu project repo root-la merge pannu (app code + `.claude/` ellam **ONE git repo**-la -- split panna venaam).
2. `CLAUDE.md`-la `<PROJECT_NAME>` replace panni ella `TODO`-vaiyum fill pannu (name, goal, stack).
3. `.env.example` -> `.env.local` copy panni real secrets pODu (`.env.local` gitignored -- commit panna koodadhu).
4. `.claude/rules/*` globs-a un folder layout-ku adjust pannu.
5. Hooks executable aakku: `chmod +x .claude/hooks/*.sh .claude/scripts/*.sh .claude/statusline.sh`
   (**Windows:** hooks Git Bash-la run aagum -- Git install pannirukanum.)
6. Session restart -> SessionStart hook branch/commit/tracker/toolchain summary + review-readiness kaattum.

**Commit pannu:** ellame (`.claude/`, `CLAUDE.md`, `docs/`, tracker) -- aana intha moonu private files **thavira**: `CLAUDE.local.md`, `.claude/settings.local.json`, `.env.local`.

---

## 4. Background machinery -- nee kupidaadha, thaana nadakkuradhu

Idhellam **auto** -- nee command type panna venaam. Aana enna nadakkudhu-nu therinjika:

### 4a. Hooks (`.claude/hooks/`) -- event-la fire aagum, marakka mudiyaadhu

| Hook | Epo fire | Enna pannudhu | Background tool |
|------|----------|---------------|-----------------|
| `SessionStart.sh` | Session start | Branch + last commit + dirty count + `PROGRESS.md ## Now` + toolchain brief + **review-readiness** (enna review run aachu HEAD-ku) | git, toolchain-health.sh, review-ledger.sh |
| `PreToolUse.sh` | Ovvoru **Bash** command munnadi | **Guard 1 destructive** (`rm -rf ~`, force-push, `DROP TABLE`, chained-um block) ; **Guard 2 deploy** (deploy detect aana -> test run, fail-na block; pass aana -> **arc gates**: coverage + review-readiness + docs-drift) | git, npm test, moat scripts |
| `PreToolUse-edit.sh` | Ovvoru **Edit/Write** munnadi | **Freeze boundary** -- `/arc-freeze` active-ah irundhaa, allowed dir-ku veliya edit block. Illa-na no-op | freeze-check.sh |
| `PostToolUse.sh` | Edit/Write apram | Touch pannina file-la prettier + eslint | prettier, eslint |
| `PreCompact.sh` | Context compact munnadi | State-a `.claude/state/`-la snapshot | -- |
| `SessionEnd.sh` | Session mudiyum-podhu | Session trail-a `docs/session-log.md`-la append | git |

> Guard 2 (deploy) important: **test fail-na deploy BLOCK** (exit 2). Idhu vibe illa, physics.

### 4b. Rules (`.claude/rules/`) -- path match aana-podhu mattum auto-load

| Rule | Epo load | Enna solludhu |
|------|----------|---------------|
| `api.md` | `app/api/**`, `src/api/**` touch panna | rate-limit, authz, zod validation, webhook signature, no PII logs |
| `supabase.md` | Supabase files | RLS on every table, migrations only |
| `stripe.md` | Stripe files | webhook verify, no client-trusted amounts |
| `testing.md` | test files | test conventions |
| `ui.md` *(pudhusu)* | `app/**/*.tsx`, `components/**`, `*.css` | design system reuse, ella state design pannu, a11y, `/arc-design` pass venum |
| `security-sensitive.md` *(pudhusu)* | `**/auth/**`, `**/api/**`, `**/payments/**`, `supabase/**` | authz server-side, secrets, `/arc-audit` run pannu |

### 4c. Moat scripts (`.claude/scripts/`) -- hooks + commands kupidum

| Script | Enna | Yaaru kupidum |
|--------|------|---------------|
| `toolchain-health.sh` | Ella tool (graphify, codegraph, claude-mem, scanners, MCP, env) health | SessionStart (`--brief`), `/arc-toolcheck` (full) |
| `review-ledger.sh` *(pudhusu)* | Enna review pass aachu-nu commit-SHA-la stamp; `require` -> ship block | review commands (stamp), PreToolUse deploy-guard (require), SessionStart (status) |
| `coverage-gate.sh` *(pudhusu)* | Coverage floor-ku keezha-na deploy block | PreToolUse deploy-guard |
| `docs-drift.sh` *(pudhusu)* | Public surface maari docs maaraama-na gate | PreToolUse deploy-guard |
| `freeze-check.sh` *(pudhusu)* | Freeze active-na boundary-ku veliya edit block | PreToolUse-edit hook |

### 4d. settings.json -- `arc.*` config (safe defaults)

```jsonc
"arc": {
  "profile": "standard",               // strictness profile -- ONE key drives all gates (ADR-0008)
  "coverageFloor": 80,                 // deploy blocked below this % (block mode-la)
  "coverageSummary": "coverage/coverage-summary.json"
  // optional per-gate override: "coverageMode"/"docsGate"/"scanMode": "warn"|"block", "requiredReviews": "code,security"
}
```

> **Block-by-default (Phase 01, ADR-0008).** Oru `profile` key ella gate-ayum set-ah switch pannum:
> - `starter` -- ella gate-um **warn** (onnum block aagadhu; onboarding / try panna).
> - `standard` *(default)* -- core gates (scan, coverage, docs) **block** + `code,security` reviews required.
> - `strict` -- ella-um **block** + full review set (`code,security,qa,design,docs`).
>
> Profile maathu: `arc.profile` edit pannu, illa `ARC_PROFILE=starter` env. Oru gate-ah mattum override
> panna explicit key podu (e.g. `"coverageMode":"warn"`) -- profile-a adhu beat pannum. Active modes paaru:
> `bash .claude/scripts/arc-profile.sh show`. Required reviews-ah `ARC_REQUIRED_REVIEWS` env-um override pannalaam.

---

## 5. Agents (`.claude/agents/`) -- background specialists

Nee neradiya kupidama, **commands ivanga-ala Task subagent-ah** invoke pannum (isolated context -- summary mattum thirumbi varum). Ella-um "one owner per job".

| Agent | Model | Enna pannudhu | Background tools | Yaaru kupidum |
|-------|-------|---------------|------------------|---------------|
| `code-reviewer` | opus | Scanner sweep + 4-pass OWASP review + blast-radius (callers/dependents) | semgrep/opengrep, gitleaks, osv-scanner, knip, codegraph/Graphify | `/arc-review` |
| `qa-tester` | sonnet | Real browser-la app-a drive panni exploratory test (happy/sad/boundary/tours) + axe a11y | **agent-browser CLI** (`@ref` snapshots, batch, vitals; fallback: Playwright MCP), lighthouse, axe-core | `/arc-qa`, `/arc-canary`, `/arc-phase-done` demo |
| `security-auditor` *(pudhusu)* | opus | Deep **OWASP Top 10 + STRIDE** threat model, ovvoru finding-ku exploit scenario, zero-noise | Read/Grep/Bash | `/arc-audit` |
| `design-reviewer` *(pudhusu)* | sonnet | Design dimensions 0-10 score, AI-slop detect, apram **fix** + before/after screenshot | Edit/Bash (+ browser) | `/arc-design` |
| `product-challenger` *(pudhusu)* | sonnet | Idea-va challenge (6 forcing questions), 3 approaches, Klein pre-mortem -> **PLAN.md-la ezhudhum** | Read/Edit | kickoff-ku munnadi |
| `researcher` | sonnet | Context7 + web, >=2 source triangulate | web, Context7 | thevai-ppatta-podhu |
| `log-analyzer` | sonnet | First-error + differential diagnosis | logs | debugging-la |

> Rule: review-type command oru specific subagent-a **explicit-ah** bind pannum, `general-purpose`-ku
> fall back aagaadhu. Subagent illa-na command STOP panni "sync template" solla-sollum.

---

## 6. Commands (`.claude/commands/`) -- nee type panradhu (stage-wise)

Motha **20 commands**. Pipeline order-la group panniruken. Ovvondhukum: enna, epdi kupidradhu,
background-la enna, enna artifact.

### Stage 1 -- PLAN
| Command | Epdi | Enna nadakkum | Artifact |
|---------|------|---------------|----------|
| *(product-challenger agent)* | kickoff-ku munnadi idea fuzzy-ah irundhaa | Idea reframe, assumptions veliya, pre-mortem | `PLAN.md` sections |
| `/arc-kickoff <goal>` | build start panna | `PLAN.md` (vision, **appetite**, C4 mermaid, ADR index, no-gos, rabbit holes, Klein pre-mortem) + **risk-order phases** + `PROGRESS.md` | committed tracker |

### Stage 2 -- BUILD & CHANGE DISCIPLINE
| Command | Epdi | Enna nadakkum |
|---------|------|---------------|
| `/arc-change <what>` | build naduvula pudhu idea/ask (un-oda-um!) vandhaa | Triage: trivial->current phase / pudhu capability->pudhu `phases/phase-NN-spec.md` (by risk) / decision->ADR / bug->`/arc-fix-issue`; `PROGRESS.md ## Now` update; confirm; apram build. **Rule: tracked home illama edhuvum code panna maaten.** |
| `/arc-fix-issue <n>` | tracked issue fix panna | Root-cause -> fix -> tracker update |

### Stage 3 -- REVIEW GATES (ivai dhaan quality moat)
| Command | Epdi | Background | Artifact + ledger |
|---------|------|-----------|-------------------|
| `/arc-review [base]` | phase code mudinjadhum | `code-reviewer` agent (scanners + OWASP) | `docs/reviews/...md`, verdict ship/fix-first/needs-discussion |
| `/arc-audit [scope]` | auth/payments/high-risk diff | `security-auditor` agent (STRIDE) | `docs/security/...md`; high-sev -> tracked issue; stamp `security` (0 critical-na) |
| `/arc-qa [url]` | UI/flow test | `qa-tester` agent (agent-browser CLI; fallback Playwright MCP) -> bug report; **main thread fix + mandatory regression test** | `docs/qa/...md`; stamp `qa` |
| `/arc-design [route]` | UI phase | `design-reviewer` agent (score+fix) | `docs/design/...md`; stamp `design` (PASS-na) |
| `/arc-second-opinion [base]` | critical diff | **codex CLI** (or 2nd model) cross-check vs `/arc-review` | `docs/reviews/...-second-opinion.md`; critical disagreement -> ship block |

### Stage 4 -- DOCS
| Command | Epdi | Enna |
|---------|------|------|
| `/arc-docs [scope]` | public surface maarina apram | Diff vs docs cross-check -> README/ARCHITECTURE/CLAUDE.md/rules update; stamp `docs`; docs-drift ship-gate clear |

### Stage 5 -- COMMIT / PR / SHIP / WATCH
| Command | Epdi | Enna |
|---------|------|------|
| `/arc-commit` | changes ready | Grouped conventional commits -- **push panna maaten** |
| `/arc-pr [base]` | branch ready | GitHub PR + summary + test plan |
| `/arc-ship` | production-ku | `lint -> build -> test -> vercel --prod`. deploy-guard hook test + arc gates re-check pannum (red/gate-fail -> block) |
| `/arc-canary <url>` | deploy apram | agent-browser watch loop (errors/5xx/vitals/visual diff vs `docs/canary/` baseline) + `qa-tester` money-flows; **fail-na rollback/block** |

### Stage 6 -- CLOSE PHASE
| Command | Epdi | Enna |
|---------|------|------|
| `/arc-phase-done <n>` | phase mudinjadhu-nu nenaikkum-podhu | **DoD gate**: tests green + **live demo paathaacha** + tracker flip -- illa-na **refuse** pannum. Evidence over assertion. |

### Stage 7 -- MAINTAIN / IMPROVE
| Command | Epdi | Enna |
|---------|------|------|
| `/arc-retro [n]` | phase apram | Repeated corrections-a **permanent setup upgrade**-ah (CLAUDE.md/rule/hook/command diff propose) |
| `/arc-toolcheck` | tool doubt varum-podhu | Full toolchain status + one-command fixes -- **smart-table artifact**-ah render aagum (template: `.claude/templates/toolchain-health-artifact.html`, same URL every run: `.claude/state/toolcheck-artifact-url`) |

### Utility / Safety
| Command | Epdi | Enna |
|---------|------|------|
| `/arc-freeze <dir>` | debugging-la scope lock | Edit-a andha dir-ku mattum limit (PreToolUse-edit hook enforce) |
| `/arc-unfreeze` | mudinjadhu | Boundary remove |
| `/arc-diagram <what>` | diagram venum | English -> mermaid, PLAN/ADR/`docs/`-la commit |
| `/arc-resume` | session-a thirumba pidikka | `PROGRESS.md ## Now` + last snapshot-la irundhu state rebuild |

---

## 7. FULL PIPELINE -- step by step (idhu dhaan main event)

Zero-la irundhu ship varaikum, oru real build epdi poidum. Ovvoru stage-um oru command +
enna nadakkudhu.

### Stage 1 -- Plan pannu
```
(optional) idea fuzzy-ah irundhaa: product-challenger-a run pannu -> PLAN.md-oda vision/appetite fill aagum
/arc-kickoff "user login + dashboard with Stripe billing"
```
Enna varum: `PLAN.md` (goal, **appetite** = time-box, C4 mermaid, no-gos, rabbit holes, Klein
pre-mortem), phases **risk-order-la** (ease illa), `PROGRESS.md`. **Code inga illa** -- plan mattum.

> Rule: written plan illama code panna maaten.

### Stage 2 -- Phase 0 = walking skeleton (FAKE data)
Mudhal phase eppovum oru **end-to-end runnable skeleton** -- fake auth, in-memory store, fake
payment flag, no keys/network -- aana deploy aagum. Idhu risk-a mudhal-la kolludhu.

### Stage 3 -- Oru phase build pannu (Golden Loop -- idhu repeat aagum)
```
Plan -> smallest working slice build -> test -> LIVE demo -> real place-la verify
     -> tracker update -> confirm -> next phase
```
- Ovvoru external dependency (DB/LLM/API/queue)-ku: **interface + fake + real impl** (offline-first).
- Test network touch pannaadhu (fake use pannum).

### Stage 4 -- Review gates (phase close panradhukku munnadi)
Phase-oda risk-ku thakka reviews run pannu:
```
/arc-review                 # ella phase-kum (code-reviewer: scanners + OWASP) -> docs/reviews/
/arc-audit                  # auth/payments/data touch panna (security-auditor: STRIDE)
/arc-qa http://localhost:3000   # UI/flow irundhaa (qa-tester browser) + regression test
/arc-design /dashboard      # UI phase-na (design-reviewer: score + fix)
/arc-second-opinion         # critical logic-na (codex cross-model)
```
Ovvondrum `docs/...`-la archive + ledger-la stamp pannum (Section 8).

### Stage 5 -- Docs sync
```
/arc-docs
```
Public surface (API/env/commands) maarina-na README/ARCHITECTURE/CLAUDE.md update. Idhu
docs-drift ship-gate-a clear pannum.

### Stage 6 -- Commit + phase close
```
/arc-commit                 # grouped conventional commits, push panna maaten
/arc-phase-done 1           # DoD GATE: tests green + live demo paathaacha + tracker flip -> illa-na REFUSE
```
`/arc-phase-done` dhaan un discipline crown jewel -- evidence illama phase close aagaadhu.

### Stage 7 -- Ship + watch
```
/arc-pr                     # (team flow-na) PR open
/arc-ship                   # lint -> build -> test -> vercel --prod
                            #   deploy-guard hook: test re-run + arc gates (coverage/review/docs) re-check
/arc-canary https://yourapp.com   # deploy apram watch; regression-na rollback/block
```

### Stage 8 -- Retro (phase/build apram)
```
/arc-retro
```
Same thappu 3 thadava correct pannina-na -> adha **permanent** aakku (CLAUDE.md/rule/hook diff).
System thaana improve aagum.

### Mid-build-la pudhu idea vandhaa? (eppavum)
Neradiya code panna **koodadhu**:
```
/arc-change "add dark mode toggle"
```
Triage -> phase spec / ADR / fix-issue -> `PROGRESS.md ## Now` update -> confirm -> apram Golden Loop.

### Oru build, commands-la (summary)
```
/arc-kickoff  ->  [Phase 0 skeleton]  ->  loop{ build -> /arc-review (+audit/qa/design)
   -> /arc-docs -> /arc-commit -> /arc-phase-done N }  ->  /arc-ship -> /arc-canary  ->  /arc-retro
```

---

## 8. Review ledger + gates -- enforcement epdi work aagudhu

**Idea:** enna review pass aachu-nu oru ledger (`.claude/state/reviews/<SHA>.txt`) maintain aagudhu.
Ship panna-podhu required reviews stamp aagala-na -> **BLOCK**.

- Review command pass aana-udan thaana stamp pannum:
  `bash .claude/scripts/review-ledger.sh stamp qa` (qa/security/design/docs auto).
- **Pudhu commit = pudhu SHA = ledger reset** -> pudhu code eppovum re-review aaganum (honest gate).
- SessionStart oru line kaattum: `- reviews @ <sha>: qa security`.

**Enforcement default-la ON (Phase 01, `standard` profile):**
- Core gates (scan, coverage, docs) **block**, required reviews = `code,security`. Idhu default -- extra
  setup illa. `/arc-ship` andha reviews + coverage + docs pass aanaal dhaan pogum.
- Bar-a innum kootanum-na `arc.profile: "strict"` (ella-um block + full review set).
- Friction venaam-na (onboarding / spike) `arc.profile: "starter"` -- ella gate-um warn, onnum block aagadhu.
- Required set-ah adhoc-ah override: `export ARC_REQUIRED_REVIEWS=code,qa,security,design`.

> **`code` stamp (Phase 01-la wired):** `/arc-review` ippo `docs/reviews/`-la archive pannudhu **matum illama**,
> ship verdict-la `bash .claude/scripts/review-ledger.sh stamp code` auto-run pannum (fix-first-na unstamp).
> Pudhu commit = pudhu SHA = stamp reset, so fixes apram re-review aaganum. (Munna oru gap irundhadhu -- ippo close.)
> (Venum-na naan andha auto-stamp-a wire panni tharen.)

---

## 9. The 3-layer tracker -- state files-la iruku, memory-la illa

| File | Enna | Rule |
|------|------|------|
| `PLAN.md` | Vision: goal, appetite, C4 mermaid, ADR index, non-negotiables, no-gos, rabbit holes, pre-mortem | Once per build |
| `phases/phase-NN-spec.md` | Ovvoru phase-oda Definition of Done | Zero-padded, phase-first naming |
| `PROGRESS.md` | Status table + done-log + `## Now` pointer (SessionStart idha padikkudhu) | Live update |
| `docs/adr/NNNN-title.md` | Oru decision oru file -- edit panna koodadhu, superseded mattum | Immutable |

State git-la irukkaradhaala, `/arc-resume` epovum session-a rebuild panna mudiyum.

---

## 10. Cheat-sheet (ella command onnu paarvaila)

| Stage | Command | Background | Artifact |
|-------|---------|-----------|----------|
| Plan | `/arc-kickoff` | (product-challenger) | PLAN.md, phases, PROGRESS.md |
| Change | `/arc-change`, `/arc-fix-issue` | tracker | phase-spec / ADR |
| Review | `/arc-review` | code-reviewer + scanners | docs/reviews/ |
| Security | `/arc-audit` | security-auditor (STRIDE) | docs/security/ + issue |
| QA | `/arc-qa` | qa-tester + agent-browser | docs/qa/ + regression test |
| Design | `/arc-design` | design-reviewer | docs/design/ |
| 2nd opinion | `/arc-second-opinion` | codex CLI | docs/reviews/ |
| Docs | `/arc-docs` | docs-drift.sh | updated docs |
| Commit | `/arc-commit` | git | conventional commits |
| PR | `/arc-pr` | GitHub | PR |
| Ship | `/arc-ship` | vercel + deploy-guard | production deploy |
| Watch | `/arc-canary` | agent-browser + qa-tester | docs/canary/ |
| Close | `/arc-phase-done` | DoD gate | tracker flip |
| Retro | `/arc-retro` | -- | setup upgrades |
| Tools | `/arc-toolcheck` | toolchain-health.sh | smart-table artifact (pinned URL) |
| Safety | `/arc-freeze`,`/arc-unfreeze` | freeze-check.sh | edit boundary |
| Util | `/arc-diagram`,`/arc-resume` | -- | mermaid / restored state |

---

## 11. Troubleshooting / FAQ

- **"subagent not available" solludhu** -> template sync pannala. `sync-to-project.ps1 -Target <project>`, apram session restart.
- **Deploy unexpected-ah block aagudhu** -> deploy-guard message paaru: (a) test fail -> fix, (b) coverage floor -> test coverage kootu illa `arc.coverageMode:"warn"`, (c) review missing -> andha review run pannu illa `ARC_REQUIRED_REVIEWS` unset, (d) docs drift -> `/arc-docs` illa `arc.docsGate:"warn"`. Ella gate-ayum oru shot-la off panna: `arc.profile:"starter"` (block-by-default default `standard`).
- **Edit block aagudhu "frozen boundary"** -> `/arc-freeze` active. `/arc-unfreeze` pannu.
- **Gates romba strict** -> default warn/unset-ku thirumbu (Section 8).
- **Maintainer note:** hooks + CLAUDE.md-la em-dash unicode iruku. Andha files edit panna-na **bash heredoc** use pannu, blind tool-edit venaam (unicode-la truncate aagum). Ezhudhina apram `wc -l` + `bash -n`-la verify pannu.

---

## 12. arc enna pannaadhu (idhukku gstack use pannu)

One-owner-per-job -- intha-vella arc rebuild pannaadhu, gstack-a neradiya use pannu:
- **Design exploration**: `/design-shotgun` -> `/design-html` (mockup/image-gen/production HTML).
- **Full browser stack**: `/browse`, `/pair-agent` (cross-agent).
- **GBrain**: persistent knowledge base (nammakku claude-mem + Graphify + tracker already iruku).

Rule of thumb: **throwaway/preview -> gstack | decision/gate/tracked deliverable -> arc.**

---

_Manual ends. `arc-` prefix ella command-kum collision-free -- gstack-oda parallel-ah use pannalaam._
