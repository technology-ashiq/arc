# Inbound references to the four superseded documents (git grep -n, at the Phase 02 move)

Recorded so a later cleanup can retarget them; none were edited (ADR-1510: the stubs keep every link working).

## docs/how-it-works.md

```
CLAUDE.md:194:- How this setup works → `docs/how-it-works.md` (mental model + example flow)
docs/README.md:37:`how-it-works.md` · `usermanual.md` · `blueprint.md` · `product-runbook.md` · `plugins.md`
docs/adr/1510-doc-j-four-overlapping-docs-resolved-in-phase-02.md:10:Locked (DOC-J). Four documents already try to be this reference: `docs/how-it-works.md`,
docs/adr/1510-doc-j-four-overlapping-docs-resolved-in-phase-02.md:13:`docs/how-it-works.md` by name, so the move has at least one inbound reference to rewrite.
docs/blueprint.md:237:| `how-it-works.md` | Mental model — the six products, then the three loading behaviors |
docs/design/reference/face-hq/assets/arcface/scripts/arc-facts.json:1:{"meta":{"generated":"2026-08-25T07:04:56.539Z","repo":"E:/Work_Hub/01_Automemory/arc","readOnly":true,"generator":"gen-arc-facts.
docs/how-arc-works-simple.md:4:> Not the same as `how-it-works.md` (that's the product explainer synced to consumer repos).
docs/strategy/README.md:626:    the wiki and the face app cannot disagree about what exists. **`docs/how-it-works.md`,
docs/strategy/plans/PLAN-docs.md:79:`docs/how-it-works.md` (135 lines) · `docs/how-arc-works-simple.md` (160) ·
docs/strategy/plans/PLAN-docs.md:333:> 7. **DOC-J** — Phase 02 does not close until `docs/how-it-works.md`,
docs/strategy/plans/README.md:52:| — | **docs · arc's own reference (generated wiki)** | `PLAN-docs.md` | **TRIGGER FIRED by owner ruling (2026-09-18)** — a wiki over every product, lane and feat
docs/usermanual.md:102:   |- how-it-works.md
face/scripts/flows.mjs:72:    "design-studio.open-brief": { id: "browser-flow", brief: "docs/how-it-works.md" },
products/core/manifest.json:82:      "src": "docs/how-it-works.md",
products/core/manifest.json:83:      "dest": "docs/how-it-works.md"
sync-to-project.ps1:137:foreach ($f in @("blueprint.md", "how-it-works.md", "build-playbook.md", "product-runbook.md", "plugins.md", "usermanual.md")) {
sync-to-project.sh:170:for f in blueprint.md how-it-works.md build-playbook.md product-runbook.md plugins.md usermanual.md; do
tests/face/work-door.mjs:138:  "design-studio.open-brief": { id: "work-door-probe", brief: "docs/how-it-works.md" },
tests/fixtures/sync-golden/tree-manifest.txt:371:docs/how-it-works.md	ad787c719907465cddc9524c7bd7d922290e60480913db9005b2132a89d94e1f
tests/sync.bats:22:  [ -f "$TARGET/docs/how-it-works.md" ]
tests/sync.bats:58:  [ -f "$out/docs/how-it-works.md" ]   # a LATER step than the playbook copy -- proves no early abort
tests/sync.bats:85:  [ -f "$mtarget/docs/how-it-works.md" ]                     # ...and got past the playbook step...
```

## docs/how-arc-works-simple.md

```
docs/README.md:4:> Lost in the repo? Read `how-arc-works-simple.md` first. Updated 2026-07-25.
docs/README.md:21:| `how-arc-works-simple.md` | The owner's mental map — one rule, 3 time layers, lifecycle |
docs/README.md:80:  `how-arc-works-simple.md` §8.
docs/adr/1510-doc-j-four-overlapping-docs-resolved-in-phase-02.md:11:`docs/how-arc-works-simple.md`, `docs/usermanual.md`, `docs/blueprint.md`. Shipping a wiki beside
docs/strategy/README.md:627:    `docs/how-arc-works-simple.md`, `docs/usermanual.md` and `docs/blueprint.md` are marked for
docs/strategy/plans/PLAN-docs.md:79:`docs/how-it-works.md` (135 lines) · `docs/how-arc-works-simple.md` (160) ·
docs/strategy/plans/PLAN-docs.md:334:>    `docs/how-arc-works-simple.md`, `docs/usermanual.md` and `docs/blueprint.md` are archived or
docs/strategy/plans/PLAN-portfolio.md:50:`docs/how-arc-works-simple.md` §1, today's law: *"Exactly ONE plan is ever live: the root
docs/strategy/plans/README.md:52:| — | **docs · arc's own reference (generated wiki)** | `PLAN-docs.md` | **TRIGGER FIRED by owner ruling (2026-09-18)** — a wiki over every product, lane and feat
initiatives/portfolio/evidence/phase-03/README.md:16:| A1 | `docs/how-arc-works-simple.md` §1 | the per-lane law as the section's opening bold line, plus the clause naming `PORTFOLIO.md` "the index v
initiatives/portfolio/evidence/phase-03/README.md:17:| A2 | `docs/how-arc-works-simple.md` §3 | the folder tree showing `initiatives/<lane>/` with `PLAN.md` · `PROGRESS.md` · `phases/`, and `docs/e
initiatives/portfolio/evidence/phase-03/README.md:18:| A3 | `docs/how-arc-works-simple.md` §8 | the four-level truth hierarchy in `PORTFOLIO.md`'s own wording, plus the locked four-term vocabulary ta
initiatives/portfolio/evidence/phase-03/README.md:32:none of the five writers could see: **rewriting §1/§3/§8 left `how-arc-works-simple.md`
initiatives/portfolio/phases/phase-03-spec.md:37:| A1 | `docs/how-arc-works-simple.md` §1 *The one rule* | states the per-lane law — exactly ONE plan live **per lane** — and quotes `PORTFOLIO.md`
initiatives/portfolio/phases/phase-03-spec.md:38:| A2 | `docs/how-arc-works-simple.md` §3 *Folder map* | shows `initiatives/<lane>/` holding `PLAN.md` · `PROGRESS.md` · `phases/`, and marks `docs/e
initiatives/portfolio/phases/phase-03-spec.md:39:| A3 | `docs/how-arc-works-simple.md` §8 *Rules that prevent confusion* | carries the truth hierarchy (`PROGRESS` = where the work is · `PLAN` = what
```

## docs/usermanual.md

```
docs/README.md:37:`how-it-works.md` · `usermanual.md` · `blueprint.md` · `product-runbook.md` · `plugins.md`
docs/adr/1510-doc-j-four-overlapping-docs-resolved-in-phase-02.md:11:`docs/how-arc-works-simple.md`, `docs/usermanual.md`, `docs/blueprint.md`. Shipping a wiki beside
docs/agent-browser-integration.md:62:6. **Docs** — one line in `CLAUDE.md` *Tools/Tech* (keep it under ~200 lines); note the optional dependency in `docs/plugins.md`; a short mention in `docs/userma
docs/blueprint.md:238:| `usermanual.md` | The long-form walkthrough (Tanglish): every command, hook, agent and the full pipeline |
docs/strategy/README.md:627:    `docs/how-arc-works-simple.md`, `docs/usermanual.md` and `docs/blueprint.md` are marked for
docs/strategy/plans/PLAN-docs.md:80:`docs/usermanual.md` (547) · `docs/blueprint.md` (264). Shipping a wiki beside them recreates the
docs/strategy/plans/PLAN-docs.md:334:>    `docs/how-arc-works-simple.md`, `docs/usermanual.md` and `docs/blueprint.md` are archived or
docs/strategy/plans/README.md:52:| — | **docs · arc's own reference (generated wiki)** | `PLAN-docs.md` | **TRIGGER FIRED by owner ruling (2026-09-18)** — a wiki over every product, lane and feat
docs/usermanual.md:100:   |- usermanual.md          # <- neenga inga
initiatives/model-policy/PROGRESS.md:84:(`docs/blueprint.md`, `docs/usermanual.md`, `docs/council/README.md`,
initiatives/portfolio/PROGRESS.md:83:  `usermanual.md` and `adr-template.md` are content-hashed in the sync golden, so editing
initiatives/portfolio/PROGRESS.md:94:  §8 rule 2; §2 and §7 still taught the root-only law; `usermanual.md:111` still put the
initiatives/portfolio/evidence/phase-03/README.md:19:| A4 | `docs/usermanual.md` §9a | one new section in the manual's Tanglish register: `--lane` as the only way to name a lane, bare tokens never la
initiatives/portfolio/evidence/phase-03/README.md:36:root-only law; and `docs/usermanual.md:111` still placed the tracker at the root behind a
initiatives/portfolio/evidence/phase-03/golden-regen.txt:4:The trap: docs/usermanual.md and docs/templates/adr-template.md are content-hashed
initiatives/portfolio/evidence/phase-03/golden-regen.txt:22:-docs/usermanual.md
initiatives/portfolio/evidence/phase-03/golden-regen.txt:23:+docs/usermanual.md
initiatives/portfolio/phases/phase-03-spec.md:40:| A4 | `docs/usermanual.md` | one lane section in the manual's own register, naming `--lane` as the only way to name a lane and the resolution order (a
initiatives/portfolio/phases/phase-03-spec.md:57:  `docs/usermanual.md:154` and `docs/templates/adr-template.md:149`. Editing either changes
products/core/manifest.json:86:      "src": "docs/usermanual.md",
products/core/manifest.json:87:      "dest": "docs/usermanual.md"
sync-to-project.ps1:137:foreach ($f in @("blueprint.md", "how-it-works.md", "build-playbook.md", "product-runbook.md", "plugins.md", "usermanual.md")) {
sync-to-project.sh:170:for f in blueprint.md how-it-works.md build-playbook.md product-runbook.md plugins.md usermanual.md; do
tests/fixtures/sync-golden/tree-manifest.txt:382:docs/usermanual.md	e98ce23d8e115b9e0f6aa6db8d850744a6fd5a79c074d182319cde39f40a7bb8
tests/sync.bats:23:  [ -f "$TARGET/docs/usermanual.md" ]
```

## docs/blueprint.md

```
docs/README.md:37:`how-it-works.md` · `usermanual.md` · `blueprint.md` · `product-runbook.md` · `plugins.md`
docs/README.md:66:product-shipped files** (`arc-kickoff` command cites v3-plan · `blueprint.md` cites
docs/adr/1510-doc-j-four-overlapping-docs-resolved-in-phase-02.md:11:`docs/how-arc-works-simple.md`, `docs/usermanual.md`, `docs/blueprint.md`. Shipping a wiki beside
docs/blueprint.md:235:| `blueprint.md` | This file — the complete map |
docs/design/reference/face-hq/assets/arcface/scripts/arc-facts.json:1:{"meta":{"generated":"2026-08-25T07:04:56.539Z","repo":"E:/Work_Hub/01_Automemory/arc","readOnly":true,"generator":"gen-arc-facts.
docs/design/reference/face-hq/assets/arcface/src/data/arcFacts.js:3851:   "arc-company-org-blueprint.md",
docs/design/reference/face-hq/assets/arcface/src/data/arcFacts.js:3861:   "arc-hq-blueprint.md",
docs/strategy/README.md:22:| `arc-company-org-blueprint.md` | **ACTIVE — org lens** (2026-07-25) | The company org-chart view: ~50 roles → modules with EXISTS/PLANNED/MISSING/HUMAN status, the sha
docs/strategy/README.md:26:| `records/arc-hq-blueprint.md` | Record | HQ concept: autonomy ladder, learning-as-calibration, moat analysis. Absorbed into Cycle-2 plan + policy/evolve/dashboard/chat bri
docs/strategy/README.md:627:    `docs/how-arc-works-simple.md`, `docs/usermanual.md` and `docs/blueprint.md` are marked for
docs/strategy/plans/PLAN-docs.md:80:`docs/usermanual.md` (547) · `docs/blueprint.md` (264). Shipping a wiki beside them recreates the
docs/strategy/plans/PLAN-docs.md:334:>    `docs/how-arc-works-simple.md`, `docs/usermanual.md` and `docs/blueprint.md` are archived or
docs/strategy/plans/PLAN-face.md:445:| **Org** ✔ | blueprint's 54 roles → EXISTS / PLANNED / MISSING / HUMAN mapped to lanes/agents (dept = module, employee = spawned agent, HR = trial-ledger + re
docs/strategy/plans/README.md:52:| — | **docs · arc's own reference (generated wiki)** | `PLAN-docs.md` | **TRIGGER FIRED by owner ruling (2026-09-18)** — a wiki over every product, lane and feat
docs/strategy/plans/README.md:62:what's missing, and why roles ≠ standing agents: `../arc-company-org-blueprint.md`
initiatives/face/contracts/expected-set.json:374:          "arc-company-org-blueprint.md"
initiatives/model-policy/PROGRESS.md:84:(`docs/blueprint.md`, `docs/usermanual.md`, `docs/council/README.md`,
products/core/manifest.json:90:      "src": "docs/blueprint.md",
products/core/manifest.json:91:      "dest": "docs/blueprint.md"
sync-to-project.ps1:137:foreach ($f in @("blueprint.md", "how-it-works.md", "build-playbook.md", "product-runbook.md", "plugins.md", "usermanual.md")) {
sync-to-project.sh:170:for f in blueprint.md how-it-works.md build-playbook.md product-runbook.md plugins.md usermanual.md; do
tests/fixtures/sync-golden/tree-manifest.txt:367:docs/blueprint.md	ecb0102df0ac32c632cce3defb3189e0f3ab165820abc715e01c428d7b9c9b55
```
