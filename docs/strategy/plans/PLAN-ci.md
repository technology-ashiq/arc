# PLAN — ci v1 · "one Linux gate" — industry-standard CI/CD (local-first, `node:test`) — v1.0

> **STATUS: kickoff-grade. Landed owner-instructed from a claude.ai session, 2026-10-23,
> grounded against `main` @ `48aa8b86`. Disk only, git untouched.** The owner branches, commits and
> PRs this drop himself (no machine git). Decisions are letters (**CI-A…S**). Real ADR numbers are
> assigned at kickoff from the **next free century, proposed 2200–2299** (`social` claims
> 2100–2199 at its kickoff). Verify against the `PORTFOLIO.md` band table, and sweep every sibling
> worktree and remote branch first (sixth-stale-band-row rule). Never number them here.
> This births a **new lane, `ci`**.
>
> **Trigger: owner ruling, 2026-10-23.** *"Enaku industry standard CI/CD venum… na oru devops
> architect."* arc is the owner's private HQ only. It is not a public product, and it runs on one
> Windows machine. *"Local test okay than, athu romba time achu athunala than apdi sonnen."*
>
> **Appetite (proposed, owner confirms at kickoff): ~5 days → Tier M.** Phases 0–C ≈ 1 day,
> D ≈ 2–4 days on parallel workers, E ≈ ½ day. Kill line in §11.
>
> **Placement.** This file feeds `/arc-kickoff --lane ci`, so it lives in `plans/` (placement rule).
> It supersedes no strategy doc. Two files it retires in Phase A are not strategy docs:
> `docs/owner-paste-ci-pin-opengrep.yml` moves to `docs/archive/`, and the CI-only scripts leave
> through git history.

---

## 0. Why: the finding

GitHub's free private-repo minutes ran out. The owner made arc public to keep CI running. The
cause is the shape of the pipeline, not the amount of work:

| Fact (verified 2026-10-23) | Effect on a private repo |
|---|---|
| `arc-ci` starts **19 jobs** per push: 3 ubuntu (Node 18/20/22), 3 macOS shards, 12 Windows shards, `ci-tier` | Every push pays 19 setups (bats, jq via choco, gitleaks, opengrep), and **each job is rounded up to the minute** |
| macOS minutes bill at **10x**, Windows at **2x** | 15 of the 19 jobs are on the expensive OSes |
| `ci.yml:80`: *"Minutes are free (public repo). The only currency being spent is wall clock."* | Sharding was tuned for wall clock on a public repo. On a private repo it **multiplies** billed minutes |
| **Measured** (runs 39736016311 and 39717959656, 2026-10-22): **35–37 min wall clock per push**. Per-job minutes rounded up: Windows 258–267 (×2 = ~530), macOS 43–48 (×10 = ~450), ubuntu 84–103, ci-tier 1. Total **≈ 1,000–1,070 billed minutes per push → fewer than 2 pushes a month** on 2,000 free minutes | The repo was flipped public to escape the cap. *(The chat's earlier "~200 per push" was an estimate and was 5x too low.)* |
| One unsharded ubuntu leg alone takes **25–35 min** (`Run bats self-tests` 1,463–2,067 s for 4,815 tests). The 12 Windows shards add up to **~4.3 hours** of serial test time | Whatever the matrix, bats sets the floor on time. This is why "run it locally" was impossible on the owner's box |

**Five root causes.** Every one of them is fixed below.

1. **The CI design assumed a public repo** (`ci.yml:80`). Nothing warned what it would cost once private.
2. **The rules forbid local testing.** `.claude/rules/testing.md` ("Do not run `bats`, the full
   suite, or a suite shard locally … CI is the only gate") and `AGENTS.md:76` ("Never run a suite on
   this box"). So every fix is a push, and every push is 19 jobs. **This is the biggest single
   multiplier.**
3. **Node code is tested through bash.** arc has ~178k lines of `.mjs` and ~11.7k lines of `.sh`.
   The suite makes **1,774 `run node` calls against 23 bash-script runs**. Every bats `run` spawns a
   process, and process spawn is slow on Windows (2.82s/test vs 0.26s on Linux). That is the whole
   reason for 12 Windows shards.
4. **A 3-OS matrix for software that runs on one Windows PC.** ADR-0007's macOS amendment argued
   "three-OS parity is the portability moat". That holds for a public tool, not for a private HQ.
5. **Guard rot.** The test-count floor reads **911**. The suite holds **4,815** tests. The floor
   guards nothing.

The same shape is copied into every venture. `products/launch/providers/ci/github-actions.mjs`
writes a 3-OS (`LEGS = [ubuntu, windows, macos]`), push + PR workflow into each venture repo
(MyFitFolio included).

---

## 1. Ground truth this plan is built on (verified 2026-10-23)

- Repo `technology-ashiq/arc`: **user-owned, currently public**. Default branch `main`.
- Workflows: `ci.yml` (`arc-ci`, the only automatic one), plus three manual throwaways:
  `shard-calibrate.yml`, `weigh-tests.yml`, `measure-windows-cost.yml`. Support files:
  `.github/scripts/shard-tests.mjs`, `tests/shard-timings.json`, `tests/shard-tests.bats`.
  Stale paste file: `docs/owner-paste-ci-pin-opengrep.yml`.
- Tests: **243 `.bats` files, 4,815 `@test`s, ~72k lines**, flat in `tests/` with 53 name
  prefixes. Shared helper `tests/test_helper.bash` (57 KB). 215 helper `.mjs` files under `tests/`.
- Modules: **255 of 312** `.claude/scripts/**/*.mjs` already `export` functions. They can be
  imported directly by a test.
- `package.json`: `dependencies: {}`, `engines.node >=18`, and `"test"` runs **`ci-digest --wait`**.
  That waits on GitHub. It runs no tests.
- `face/` (React + Vite + TS) has its own `package.json` and lockfile. **CI never typechecks or
  builds it today.**
- `.claude/settings.json:61-62` denies `Edit`/`Write` on `.github/workflows/**` for sessions.
  ADR-2016 exists because of that deny.
- ADR-2015 (REQ-09): `main` protection with `enforce_admins: true` and **required checks = every
  `selftest (…)` check-run + `ci-tier`**.
- `face-coverage.mjs` `treeCi()` inventories `.github/workflows/*.yml` as `workflow:<name>`. The face
  contract and the docs wiki both read it.
- **GitHub Free gives protected branches to public repos only.** A private repo needs GitHub Pro,
  Team or Enterprise (docs.github.com, *About protected branches*).
- Node.js: **18 and 20 are EOL.** 22 is in maintenance until 2027-04. 24 is Active LTS.

---

## 2. Decisions

| ID | Decision | Supersedes / touches |
|---|---|---|
| **CI-A** | **Local-first.** The owner's box is the first gate. A `pre-push` hook runs lint plus the tests of the lanes changed (full suite when `core/` changes). CI confirms; it is not where code is first tried. **Owner confirmed 2026-10-23.** The 2026-09-23 "tests never run locally" ruling was made because local bats runs took too long. Two changes fix that: `node:test` (no per-test bash spawn) and running only the changed lanes. | Rewrites `.claude/rules/testing.md` "Where tests run"; `AGENTS.md:12, 68-76` |
| **CI-B** | **PR gate = ubuntu only, Node 24.** Jobs `quality`, `test`, `security`, plus a path-filtered `face` and `ci-tier`. These job names are stable and are the required checks. | ADR-2015 check names; ADR-2016 (gates may now be named jobs) |
| **CI-C** | **macOS dropped entirely.** Nobody runs arc on a Mac. Windows is covered by the owner's box on every push, plus a weekly `windows-latest` run on a clean machine. The bash-3.2 static audit stays as a lint, because it is cheap. | ADR-0007 + its macOS amendment |
| **CI-D** | **Node 24 only. `engines.node >=24`, `.nvmrc` = 24.** The JSONL-as-truth decision is unchanged. Only the "CI keeps a Node 18 leg" clause goes. | ADR-0024 (one clause) |
| **CI-E** | **Test runner = `node:test`** (built in, zero dependencies). bats is retired when the migration ends (Phase E). | ADR-0007 (bats-core as the framework) |
| **CI-F** | **Tests mirror the source.** `tests/<lane>/*.test.mjs` for `.claude/scripts/<lane>/` and `products/<lane>/`. Tests stay centralised under `tests/`; only the flat layout changes. | ADR-0021 (amended, not reversed) |
| **CI-G** | **Migrate lane by lane behind a parity gate (§6).** Order: HQ core → build machinery → security scanners → business lanes. | — |
| **CI-H** | **No hand-typed floor in the workflow, one count file per lane.** `tests/<lane>/.count` holds that lane's expected count. `npm test` compares `node --test`'s per-lane report against each file: a lower count fails, a higher count prints the number to commit. A PR that removes a test must lower its lane's `.count` in the diff, so every removal is visible in review. Per-lane files mean parallel lane PRs never conflict on one shared number (CI-R). | `ci.yml` "Test-count floor" step |
| **CI-I** | **Pipeline hygiene, every workflow:** `concurrency` with cancel-in-progress; draft PRs skip; `timeout-minutes` on every job; `permissions: contents: read`; actions **pinned by SHA**; path filtering **at job level** (a `changes` job), never workflow-level `paths-ignore`, because a required workflow that never starts leaves the PR "pending" forever. | — |
| **CI-J** | **Security job:** gitleaks (PR range; plus **one full-history scan now, because the repo has been public**), opengrep pinned v1.26.0, `npm audit --audit-level=high` for root and `face/`. **Dependabot** for npm (root, `face/`) and `github-actions`, weekly. | — |
| **CI-K** | **`weekly.yml`** (Sunday + `workflow_dispatch` + `workflow_call`): `windows-latest` full suite (`node:test` lanes only until Phase E; bats on Windows is ~4.3 h and is not run) + the clean-install proof (`npm pack` → install) + `ci-tier` (arc-tools image + trivy real-vuln proof). `ci-tier` also runs on PRs that touch `docker/**` or `.claude/scripts/review/arc-scan/adapters/trivy*`. | ADR-0006 (tier split unchanged; schedule changes) |
| **CI-L** | **CD = tag-driven.** Pushing `v*` calls `weekly.yml`, then `npm pack`, then a GitHub Release with the tarball and the matching `CHANGELOG.md` section. The existing `VERSION` / `CHANGELOG.md` / version-gate stay. *Changed from the chat proposal: no release-please. arc already has its own versioning, and a second one would fight it.* | — |
| **CI-M** | **OPEN, owner decides: visibility + protection.** (1) **GitHub Pro** (~US$4/month; verify the price at checkout): private repo, branch protection, 3,000 minutes. ← **recommended** (2) Stay public. (3) Private on Free, with no protection, relying on hooks and discipline. | ADR-2015 |
| **CI-N** | **OPEN, owner decides: ESLint.** Add ESLint (flat config, `eslint:recommended` + `no-undef`/`no-unused-vars`) as a **devDependency**. `dependencies` stays `{}`, so the runtime zero-dep rule holds. Prettier/Biome is deferred to Phase F. ← **recommended yes** | `AGENTS.md:12` "zero npm deps" (clarify: runtime) |
| **CI-O** | **Git hooks via `git config core.hooksPath .githooks`** with a tracked `.githooks/pre-push`. Zero dependencies. *Changed from the chat proposal: no lefthook, because of the zero-dep rule.* | — |
| **CI-P** | **Venture CI template gets the same shape.** `github-actions.mjs`: `LEGS = ["ubuntu-latest"]`, Node 24, `pull_request` plus `push: main`, concurrency, draft skip. Its `verify` required-check list and its tests change with it. Ventures deploy through Vercel's git integration, which costs no Actions minutes. Private venture repos hit the same CI-M protection question. **The file belongs to the LIVE `launch` lane** (manifest-derived ownership, ADR-0057), so the `ci` lane does not edit it. It files the change as `/arc-change --lane launch`. On any tie, the venture track outranks this OS-track cycle (standing rule). | ADR-1726/1733/1744 references to "all three legs" |
| **CI-Q** | **`.github/` write access for this cycle only.** The owner lifts the `settings.json` deny on `chore/ci-standard`, and restores it at cycle close. The restore is a REQ. | ADR-2016's premise |
| **CI-S** | **Trial status of the new checks.** The standing rule says all new lint starts WARN in TRIAL. So **ESLint (CI-N) starts WARN**: it reports in `quality` without blocking, and is promoted by retro. **`migrate-guard` and the per-lane floors are FAIL from birth, as a named exception** (precedent: `face-coverage`'s FAIL-FROM-BIRTH). A guard against silent test loss that only warns is a hope, and a cheaper worker model would pass straight through it. Existing gates keep their current status. | Standing rule "new lint starts WARN" (named exception) |
| **CI-R** | **Phase D runs as parallel workers on non-Claude models.** One worker = one lane = one worktree = one branch = one PR. Workers run through the owner's **OmniRoute / OpenRouter**. **The owner names the model per run**; this plan names none. Claude (Opus) keeps four jobs: the Phase C harness and template, the heavy-file lanes (§4 D.5), every worker PR's review, and any fix a review sends back. Workers are trusted only through **mechanical guards** (§6 + D.4), never by reading their claims. | ADR-0069 b1 (no auto-switching: every worker model is owner-named per run, so this is a human choice, not a switch) |

---

## 3. Target pipeline

```
owner's Windows box            GitHub (ubuntu, Node 24)                         rare / weekly
──────────────────            ─────────────────────────────────────            ──────────────────────
git push                      PR ready_for_review / synchronize                Sunday cron · tag v* ·
  └─ .githooks/pre-push   →   ├─ changes   (paths → booleans, ~10s)            workflow_dispatch
       lint                   ├─ quality   lint + arc gates                        └─ weekly.yml
       tests of changed       ├─ test      node --test (+ bats until Phase E)         ├─ windows-latest: full suite
       lanes (full suite      ├─ security  gitleaks · opengrep · npm audit             ├─ clean-install proof
       if core/ changed)      ├─ face      (if face/**) tsc + vite build              └─ ci-tier: image + trivy
                              └─ ci-tier   (if docker/** or trivy adapter)        tag v* → npm pack → GitHub Release
                                    │
                              merge (squash) when required checks green
```

**Required checks** (CI-M option 1 or 2): `quality`, `test`, `security`. `face` and `ci-tier` are
required too. Their `if:`-skipped runs report *skipped*, and GitHub counts skipped as passing.

**`quality` runs:** `npm run lint` = ESLint (CI-N) → `gate-parity.mjs` → `brain-drift.mjs` →
`arc-compile --check --all` → `product-lint.mjs` → `version-gate.sh` → `wiki-build --check` +
`wiki-coverage` → bash-3.2 portability audit.

### Time and cost, before vs after

| | Today (measured) | Phase A–D (bats remaining, 4 ubuntu shards) | After Phase E (`node:test`) |
|---|---|---|---|
| Jobs per PR push | 19 | 4 bats shards + node-test + quality + security + `test` aggregator (+ face / ci-tier if touched) | quality + test + security (+ face / ci-tier) |
| **Wall clock per PR push** | **35–37 min** | **~9–12 min** (4,815 tests ÷ 4 shards ≈ 7–9 min + setup); falls as lanes migrate | **~5–10 min** estimate; the pilot measures it |
| Billed minutes per PR push | ~1,000–1,070 | ~40–45 | ~10–15 |
| Pushes per month on 2,000 free | < 2 | ~40 | ~150 |
| Weekly run (Windows full suite + ci-tier) | — | ~4.3 h of bats on Windows: **too long, weekly runs `node:test` lanes only + the clean-install proof until Phase E** | ~10–15 min ×2 rate |
| Local full suite on the owner's box | ~4.3 h serial (impossible) | changed lanes only | minutes, parallel across the box's cores |

*Corrections to the chat: "~200 billed minutes per push" was 5x too low, and "4,815 tests in ~3 min on
Linux" was extrapolated from July's 911-test run. Both replaced by the measured numbers above.*

**Runner size caveat.** GitHub's standard Linux runner has 4 vCPU on public repos but 2 vCPU on
private ones. If CI-M goes private, shard times can grow. bats is mostly serial so the effect is
small; `node --test` runs files in parallel so the effect is larger. REQ-03 measures it after the
flip.

---

## 4. Phases

### Phase 0 — Prep (owner, ~15 min, before anything else)

1. Commit or stash the WIP on `feat/face-c17-p02-live`: 4 modified files plus untracked
   `PLAN-social.md` and the bench evidence folders.
2. `git switch main && git pull && git switch -c chore/ci-standard`.
3. Run `node -v` on the box. It must be ≥ 24. If not, install 24 LTS first (CI-D).
4. Decide **CI-M** and **CI-N**.
5. Lift the `.github/workflows/**` deny in `.claude/settings.json` (CI-Q).
6. Run a full-history gitleaks scan: `gitleaks git --log-opts="--all"`. Rotate any real secret it
   finds, because the repo has been public.

### Phase A — The pipeline (tonight, ~1–1.5 h)

**Add**
- `.github/workflows/ci.yml`: §3 PR gate. During migration the test stage is:
  - `bats (1..4)`: the remaining `.bats` files split **round-robin by file** over 4 ubuntu jobs
    (`ls tests/*.bats | awk 'NR % 4 == i'`). No weights file and no calibration: Linux bills at 1x,
    so balance only needs to be roughly even. This is temporary and dies in Phase E.
  - `node-test`: `node --test tests/` + the per-lane floors.
  - `test`: an aggregator job with `needs: [bats, node-test]` that fails unless every one of them
    succeeded. **`test` is the only required check name**, so the shard count can change, and
    bats can disappear in Phase E, without touching branch protection again.
- `.github/workflows/weekly.yml`: CI-K.
- `.github/workflows/release.yml`: CI-L.
- `.github/dependabot.yml`: CI-J.
- `.githooks/pre-push`, plus `.claude/scripts/core/test-changed.mjs`. It maps
  `git diff --name-only origin/main...HEAD` to lanes, then runs those lanes' tests (bats or
  `node:test`). Any `core/` or `test_helper` change runs everything.
- `.nvmrc` (`24`).

**Change `package.json`:**
- `engines.node` becomes `>=24`.
- `scripts.lint`: ESLint + the existing three gate commands.
- `scripts.test`: `node --test tests/` (+ derived floor).
- `scripts["test:bats"]`: temporary.
- `scripts["test:changed"]`, `scripts.ci` (= lint + test, the same as CI).
- `scripts["ci:status"]`: the old `ci-digest --wait`.
- `scripts.prepare`: `git config core.hooksPath .githooks`.
- `devDependencies`: eslint (CI-N), plus a committed `package-lock.json`.

**Remove through git** (recoverable from history): the three throwaway workflows,
`.github/scripts/shard-tests.mjs`, `tests/shard-timings.json`, `tests/shard-tests.bats` (14 tests;
the floor drops by 14). **Move** `docs/owner-paste-ci-pin-opengrep.yml` to `docs/archive/`.

**ESLint first run:** fix real errors (undefined names, unreachable code). Never disable a rule to
get green. Record any rule turned off with a one-line reason in `eslint.config.mjs`.

### Phase B — Everything coupled to the old CI (tonight, ~1 h)

- `.claude/rules/testing.md`: replace "Where tests run — CI, never this box" with the local-first
  rule (CI-A). Keep the per-job reading and the run-exists-for-SHA checks. They still hold.
- `AGENTS.md`: line 12 stack ("bats on CI (3 OS legs)") and lines 68–76 ("never run a suite on this
  box"). Rewrite them to: run the changed lanes locally, push once, read CI per job.
- `ci-digest.mjs`: no logic change (it already reads every job generically). Update its header
  example and the AGENTS reference to `npm run ci:status`.
- `products/launch/providers/ci/github-actions.mjs` + its tests (CI-P): **filed as
  `/arc-change --lane launch`**, not edited from this lane.
- `initiatives/face/contracts/expected-set.json`: workflow names (`workflow:ci`, `workflow:weekly`,
  `workflow:release`; the three removed names dropped). It lives in the face lane's workspace, so
  it is **filed as `/arc-change --lane face`** in the same window. Phase A's PR stays red on
  `face-coverage` until that change lands, so sequence the two together.
- Everything else this cycle touches is a shared organ (`.github/`, `tests/`, ADRs, root rules,
  `AGENTS.md`, `package.json`) or `core/`. `ownership-lint` is WARN-first; any WARN it raises is read,
  not ignored.
- **ADRs** (in the claimed century), written in arc's ADR format:
  1. CI is local-first with a one-OS PR gate (supersedes ADR-0007 + macOS amendment; amends
     ADR-0006 schedule).
  2. `node:test` replaces bats, and tests mirror the source (amends ADR-0021).
  3. Node 24 only (amends ADR-0024's CI-leg clause).
  4. Required checks are the named jobs (amends ADR-2015's check list; relaxes ADR-2016).
  5. Venture CI template is ubuntu-only (touches ADR-1726/1733/1744).
- `node .claude/scripts/docs/wiki-build.mjs` → `--check` green (new ADRs, changed rules).
- `PORTFOLIO.md` band row for the claimed century.
- **Last:** regenerate `tests/fixtures/sync-golden/tree-manifest.txt` per `testing.md`'s procedure.
  Only the touched rows move, and the row count is unchanged.

### Phase C — `node:test` harness + the template lane (tonight if time, else day 2)

- `tests/_lib/`: the subset of `test_helper.bash` that tests actually use: `ARC_ROOT`, a per-test
  temp dir, `runNode(script, args)` returning `{status, stdout, stderr}`, `runBash(...)` for the 23
  bash-script cases, fixture copy and mutate. Inventory the helpers first:
  `grep -oh '_arc_[a-z_]*\|run_[a-z_]*' tests/*.bats | sort | uniq -c`.
- Migrate **`org`** (11 files, 73 tests) as the template. Pure functions are imported, probes are
  spawned.
- Parity proof per §6, then delete the `org-*.bats` files.
- **Build the worker kit, so Phase D needs no Claude judgement to start a lane:**
  - `.claude/scripts/core/migrate-guard.mjs <lane>`: runs every §6 / D.4 check mechanically and
    prints one PASS/FAIL table. Workers run it before pushing; CI runs it on every
    `migrate/<lane>` PR as a step of the `test` job.
  - `tests/MIGRATING.md`: the worker brief (D.3). Conventions, `tests/_lib/` API, the `org` lane
    as the worked example, the `MIGRATED.md` format, forbidden moves.
  - `.claude/scripts/core/migrate-worktree.sh <lane>`: creates
    `../arc-wt/migrate-<lane>` on branch `migrate/<lane>` from `origin/main`, and prints the
    worker launch line (D.2).

### Phase D — Lane migration, parallel workers (days 2–4)

One lane per PR. Each lane passes the §6 gate and the D.4 guards.

#### D.1 Shape

- **1 worker = 1 lane = 1 git worktree = 1 branch (`migrate/<lane>`) = 1 PR.** Two workers never
  share a lane, because a lane's tests share helpers and fixtures.
- **Up to 5 workers at once**, on the owner's box, each in its own terminal.
- Workers never touch shared files (`package.json`, `tests/_lib/`, `.github/`, another lane).
  The per-lane `.count` (CI-H) means 5 PRs can merge in any order without conflicts.
- If a worker needs a `tests/_lib/` change, it **stops and reports**. Opus makes the change in its
  own small PR, and the workers rebase onto it.

#### D.2 Model setup (owner, at run time)

The owner picks the model per run through OmniRoute / OpenRouter. Two launch paths; the owner picks
whichever OmniRoute supports for the chosen model:

- **Claude Code pointed at the gateway.** In the worker's terminal, set `ANTHROPIC_BASE_URL` to
  OmniRoute's Anthropic-compatible endpoint, `ANTHROPIC_AUTH_TOKEN` to the gateway key, and
  `ANTHROPIC_MODEL` to the chosen model slug. Then run `claude` in the worktree. The model must
  handle tool calls well; verify on the pilot.
- **OpenCode with the gateway as an OpenAI-compatible provider**, if the chosen model or endpoint
  only speaks the OpenAI format. arc already compiles itself for OpenCode (distribute,
  `compile --self`), so the repo's rules reach that harness too.

Record per run: `lane · harness · model slug · start/end time · tokens/cost from OmniRoute logs`.
The record goes in `tests/<lane>/MIGRATED.md`'s header. The pilot comparison needs it.

#### D.3 The worker brief (`tests/MIGRATING.md`, paste-ready)

```
You are migrating ONE lane of arc's tests from bats to node:test. Lane: <lane>.
Read tests/MIGRATING.md, then tests/org/ as the worked example, then tests/<lane>-*.bats.
You MAY touch only: tests/<lane>/** (new), tests/<lane>-*.bats (delete at the end),
and fixtures via `git mv` into tests/<lane>/fixtures/ with no content change.
You MUST NOT edit source code, tests/_lib/, package.json, other lanes, or .github/.
If a test cannot be expressed without one of those, STOP and report. Do not work around it.
Every @test becomes a test with the SAME behaviour asserted. Never loosen an assertion, never
skip, never mark todo. If an old test was already broken, keep it failing and report it.
Write tests/<lane>/MIGRATED.md: old @test name → new test name, one row each.
Write tests/<lane>/.count = the number of tests.
Run: node --test tests/<lane>/ ; bats tests/<lane>-*.bats ; node .claude/scripts/core/migrate-guard.mjs <lane>
Push only when migrate-guard prints PASS. Open a PR titled "test(<lane>): migrate to node:test".
```

#### D.4 Guards (mechanical, in `migrate-guard.mjs`, run locally and on CI)

| Guard | FAIL when |
|---|---|
| Path guard | the diff touches anything outside `tests/<lane>/**` and deletions of `tests/<lane>-*.bats`, or a fixture move is not a 100%-similar rename |
| Count parity | `node --test tests/<lane>/` reports fewer tests than the lane's `@test` count before deletion (read from `origin/main`) |
| Name map | `MIGRATED.md` misses an old `@test` name, or names a new test that does not exist |
| Assertion density | the lane's new assertion count (`assert.*` calls) is below 90% of the old one (`[ … ]`, `[[ … ]]`, `assert_*` lines inside `@test` bodies). Override only with a per-test reason in `MIGRATED.md` |
| Skips | any `skip`, `todo` or `.only` in the new files |
| Both green | the old bats files (from `origin/main`) or the new suite fail on the PR head |

The **negative control** (§6.4) stays with the reviewer, because it needs judgement about which
behaviour to break.

#### D.5 Who does which lane

| Lanes | Who |
|---|---|
| `org` (Phase C template) | **Opus** |
| Heavy single files: `launch-contract` (116 KB, 213 tests), `design-composer-eyes` (83 KB), `leads-mail-guard` (81 KB), `ledger-close` (69 KB), `face-l3` (62 KB), `design-composer-bash` (58 KB), `face-browser` (54 KB) | **Opus**, or the pilot's winning model with a mandatory Opus review of every test (not a sample) |
| Everything else | **Workers** on the owner-named model |
| Review of every worker PR | **Opus**: reads the diff + the `migrate-guard` table, runs one negative control, approves or sends back |

#### D.6 Pilot first, then fan out

1. **Pilot:** two lanes of similar size at the same time. `spine` (14 files, 116 tests) on model X,
   `jobs` (6 files, 148 tests) on model Y. The owner names X and Y.
2. **Scorecard per model:** `migrate-guard` PASS on the first push (y/n) · Opus review findings by
   severity · negative control caught (y/n) · wall time · cost from OmniRoute.
3. **Owner picks** the model, or a split (e.g. one model for small lanes, another for large),
   from the scorecard. Not from impressions.
4. **Fan out** in batches of ≤5 workers, in this order:

| Order | Group | Lanes (tests) |
|---|---|---|
| 1 | HQ core — 1,228 | policy 326 · jobs 148 · spine 116 · portfolio 110 · org 73 (Phase C) · kickoff 72 · lane 63 · warn 43 · board 41 · products 37 · ownership 33 · wip 31 · sync 28 · plan 23 · hooks 20 · gates 15 · evidence 12 · council 10 · settings 8 · root 7 · portability 6 · embedded 6 |
| 2 | Build machinery — 2,082 | design 527 · engine 369 · develop 278 · absorb 209 · distribute 176 · evolve 154 · memory 105 · bench 102 · face 85 · docs 77 |
| 3 | Security scanners — 132 | arc 36 · triage 12 · bytediff 12 · prune 11 · trufflehog 9 · trivy 8 · runtime 7 · codeql 6 · baseline 6 · toolcheck 6 · zap 5 · rls 5 · suppress 5 · scan 4 |
| 4 | Business — 1,359 | leads 486 · launch 307 (`launch-contract.bats` alone is 213) · growth 202 · legal 173 · ledger 144 · discover 47 |

Within each group, workers take the remaining lanes largest-first. The heavy files in D.5 are
pulled out of their groups and go to Opus.

**OPEN (owner, when group 4 is reached):** leads and ledger are sleeping. Migrate them, or freeze
their code and archive their tests?

### Phase E — Retire bats

- Delete `tests/test_helper.bash`, the `test:bats` script, and bats from `weekly.yml`.
- Derived floor only.
- Measure the full local suite time on the owner's box and record it.

### Phase F — Later, optional

- Coverage report (`node --test --experimental-test-coverage`), report only at first.
- Formatter: one dedicated commit + `.git-blame-ignore-revs`.
- Self-hosted runner, only if the repo is private and minutes are still tight. **Never on a public
  repo:** fork PRs would run code on the owner's machine.
- Move to Node 26 LTS when 22-era code is gone and 26 is LTS. Dependabot will surface it.

---

## 5. Branch-protection cut-over: exact order (the one step that can lock `main`)

With `enforce_admins: true` and the old required checks (`selftest (…)` ×18 + `ci-tier`), a PR whose
CI no longer produces those names **can never merge, the owner's included**.

1. Open the Phase A PR. Wait for the new jobs to report on it once.
2. Owner, in Settings → Branches (or Rulesets), in one sitting: **remove** every `selftest (…)` and
   the old `ci-tier`, then **add** `quality`, `test`, `security`, `face`, `ci-tier` (new).
   Keep `strict`, `enforce_admins`, no force-push, no deletion.
3. Merge the PR once it is green.
4. Verify on `main`'s head: `node .claude/scripts/review/ci-digest.mjs`.
5. **Only then** flip visibility, if CI-M chose private. With option 3 (private on Free), protection
   disappears at the flip. Record that as an accepted risk in the ADR.

---

## 6. The parity gate (Phase C/D, every lane)

A lane's bats files are deleted only when **all** of these hold on the same commit:

1. **Count:** `node --test tests/<lane>/` reports **≥** the `@test` count of `tests/<lane>-*.bats`.
   Both numbers are written into the PR description.
2. **Both suites green** on that commit, on CI.
3. **Name map committed:** `tests/<lane>/MIGRATED.md` maps each old `@test` name to its new test
   name. Nothing is dropped silently. A deliberately dropped test is listed with its reason.
4. **Negative control:** break one asserted behaviour in the lane's code on a scratch branch. The
   new suite must go red. arc's mutant rule applies here too.

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| `main` locked by renamed required checks | §5 order; nothing is merged until protection is edited |
| A required check stays "pending" forever on docs-only PRs | Job-level `if:` via the `changes` job, never workflow-level `paths-ignore` (CI-I) |
| Windows-only breakage reaches `main` | The owner's box is Windows and runs the pre-push hook; weekly `windows-latest`; Windows is arc's only real runtime anyway |
| Tests silently lost in migration | §6 gate + derived floor (CI-H) |
| Pre-push is too slow while bats remains (full suite ~4.3 h serial on Windows, measured 2026-10-22) | `test:changed` runs only touched lanes; the full suite stays on CI ubuntu |
| ESLint's first run floods errors | Fix real ones; any rule turned off carries a written reason; never a blanket disable |
| Hook bypassed (`--no-verify`) | CI still gates; the hook is the cheap first line, not the only one |
| Secrets exposed while the repo was public | Phase 0 step 6: full-history gitleaks + rotation |
| Rules re-rot ("never run locally" creeping back via an old doc) | Phase B rewrites the two sources (`testing.md`, `AGENTS.md`); wiki `--check` + `wiki-drift` catch narratives naming deleted workflows |
| The `.github` deny is never restored | REQ-08 makes the restore part of done |
| A cheaper worker model passes the gate by weakening tests (loosened assertions, dropped tests, edited source) | D.4 path guard, count parity, assertion density, skip ban, all mechanical and on CI; Opus review + negative control on every PR |
| A worker model handles tool calls badly through the gateway | The D.6 pilot surfaces it on one lane, not on twenty; switch harness (D.2) or model |
| Parallel PRs conflict | One lane per worker, per-lane `.count`, shared files are off-limits; a `tests/_lib/` need stops the worker (D.1) |
| Worker cost is invisible | Every run records model, time and cost in `MIGRATED.md` (D.2); the pilot scorecard decides on numbers |

---

## 8. Owner-only checklist

- [ ] Phase 0 steps 1–6
- [ ] CI-M decision (Pro / public / private-unprotected)
- [ ] CI-N decision (ESLint devDependency)
- [ ] §5 step 2: edit required checks
- [ ] Merge PRs (or keep the session-merges-on-green grant of 2026-07-31)
- [ ] OmniRoute / OpenRouter keys and endpoint ready for workers (D.2)
- [ ] Name the pilot models X and Y, then pick the fan-out model from the scorecard (D.6)
- [ ] Group-4 decision: migrate or archive leads/ledger
- [ ] Restore the `.github/workflows/**` deny at close

---

## 9. Done line (REQs)

| REQ | Statement | Proof |
|---|---|---|
| REQ-01 | A PR push starts only ubuntu jobs on Node 24: ≤ 10 jobs while bats remains (4 shards + node-test + aggregator + changes + quality + security), ≤ 6 after Phase E | the run's job list |
| REQ-02 | Draft PRs start no billable job; a docs-only PR finishes with test jobs *skipped* and is mergeable | two real PRs |
| REQ-03 | Wall clock and billed minutes per PR push are **measured** and recorded. Before is already measured: run 39736016311, 35 min wall, ~1,070 billed. After = the first green run of the new `ci.yml`, and again after a private flip if CI-M chooses one | `gh api repos/technology-ashiq/arc/actions/runs/<id>/jobs` per-job durations |
| REQ-04 | `npm run ci` locally runs the same commands as the PR gate | script diff vs workflow |
| REQ-05 | The pre-push hook blocks a push with a failing changed-lane test | negative control |
| REQ-06 | Every lane migrated under §6; bats gone; floor derived | per-lane PRs + final count |
| REQ-07 | Weekly Windows + clean-install + ci-tier green once | weekly run id |
| REQ-08 | `.github` deny restored; ADRs landed; wiki `--check` + face-coverage green; sync-golden regenerated | CI on the close commit |
| REQ-09 | Venture template emits the ubuntu-only workflow; launch tests green | launch suite |
| REQ-10 | `migrate-guard` fails a planted violation of each D.4 guard (one mutant PR per guard) | guard self-test in `tests/core/` |
| REQ-11 | Pilot scorecard recorded for both models before any fan-out | `tests/spine/MIGRATED.md`, `tests/jobs/MIGRATED.md` headers + the review notes |

---

## 10. Open forks (decided by the owner, not by kickoff)

| Fork | When | Recommendation |
|---|---|---|
| **CI-M** visibility + protection: Pro / public / private-unprotected | Before Phase A merges (§5) | GitHub Pro |
| **CI-N** ESLint as a devDependency | Before Phase A | Yes (starts WARN per CI-S) |
| Pilot models X and Y | Start of Phase D (D.6) | Owner names them at run time |
| Fan-out model | After the pilot scorecard | From the scorecard, not impressions |
| Group 4: migrate or archive leads / ledger tests | When group 4 is reached | Owner's business call |

Everything else (CI-A…L, CI-O…S) is decided. Do not re-litigate at kickoff.

---

## 11. Kill line

Stop Phase D, keep the Phase A–B pipeline, and re-plan if **either** holds after Phase C:

- the `org` lane under `node:test` is **not at least 5x faster** than the same lane under bats on
  the owner's box, so the migration would not pay for itself; or
- the D.6 pilot's two models **both** fail `migrate-guard` on first push **and** the Opus review
  finds a weakened assertion in both, so cheap workers are not viable and the remaining ~4,700
  tests would fall back to Opus-only at a cost the owner must re-approve.

Phases A and B stand on their own. They take the bill from ~1,050 to ~40–45 minutes per push even
if the migration is killed.

---

## 12. KICKOFF PROMPT (paste-ready)

Owner prep first, outside the session: §4 Phase 0 steps 1–6 (WIP committed or stashed, branch
`chore/ci-standard`, `node -v` ≥ 24, the `.github/workflows/**` deny lifted, full-history gitleaks
clean). Then open Claude Code in arc on that branch and paste:

```
/arc-kickoff --lane ci ci v1 "one Linux gate" — arc's CI becomes industry standard: the owner's box is the first gate (pre-push, changed lanes), GitHub runs one ubuntu Node-24 PR gate (quality · test · security, + face / ci-tier when touched), Windows + docker run weekly, macOS is dropped, releases are tag-driven, and the 4,815 bats tests move to node:test lane by lane behind a mechanical parity gate, on parallel workers whose models the owner names.

Ground rules for this kickoff:
- Read docs/strategy/plans/PLAN-ci.md FIRST. CI-A…L and CI-O…S are adjudicated and LOCKED. Assign ADR numbers from the next free century (proposed 2200–2299; verify against PORTFOLIO.md and sweep every worktree + remote branch first). Do not re-litigate. §10 lists the only open forks; owner answers so far: CI-M = <1|2|3>, CI-N = <yes|no>.
- New lane. Non-negotiables: branch-only writes · never edit branch protection (stop and print the §5 step-2 list instead) · actions pinned by SHA · job-level path filters only · `migrate-guard` + per-lane floors FAIL from birth, ESLint WARN (CI-S) · launch's ci provider and face's expected-set change only through /arc-change on their own lanes (CI-P, Phase B) · `npm run ci` locally before every push, then read CI per job with ci-digest.
- Baseline for REQ-03 is already measured (run 39736016311: 35 min wall, ~1,070 billed minutes).
- Appetite: Tier M, ~5 days unless the owner says otherwise. Phase A is the steel thread: the new ci.yml green on its own PR. Phase D's parallel workers start only after the Phase C worker kit and the D.6 pilot.
Emit kickoff.done + approval.requested{gate: kickoff} and STOP.
```
