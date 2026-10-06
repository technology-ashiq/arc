# PLAN (design source) — `distribute` v1: a portable core for verified harnesses, honest degradation everywhere else

> **Trigger FIRED — owner ruling, 2026-10-07.** *"arc Claude-la mattum thaan use panra maari iruku —
> atha global aakanum: ChatGPT, Kimi, Ollama, DeepSeek, Hermes, OpenCode… market-la iruka ella tools
> layum work panra maari."* The ruling goes on the spine as a `decision.recorded` in Phase 0 and every
> kickoff ADR cites it, the same pattern the Build-out Mandate set. It is the second time this gap has
> been named: the 2026-08-12 ECC study found `.codex/` to be a never-installed 23% copy and proposed
> this lane; the Build-out Mandate queue put executor, growth and others ahead of it. The queue is now
> empty of lanes that outrank it.
>
> **v1.1 — owner review round 1, 2026-10-07.** Nine review points, eight taken, one taken in part.
> The title no longer promises "any harness" — v1 verifies four targets and declares the rest.
> **Enforcement is now a three-level contract** (tool-time · commit-time · merge-time) with its own
> section before the phases, because a git hook is one `--no-verify` from silence and only the
> repository side can make a gate final: **REQ-09 added** (protected `main`, required checks, no
> direct push — an owner action, read back by `doctor`), **REQ-10 added** (transactional install),
> REQ-01 rewritten so it no longer contradicts A-02, DST-E gained an install manifest and `--dry-run`,
> DST-H gained an exact invocation contract, **P00 gained a live OpenCode spike**.
>
> **v1.2 — the source question, 2026-10-07.** The owner asked whether commands rewritten as skills
> would still work as commands, and whether anyone else had done it that way. A scan of five tools
> that solve this exact problem (GSD, Every's compound-engineering-plugin, GitHub spec-kit, rulesync,
> ECC) found **none uses SKILL.md as its source**: two keep the Claude dialect canonical and
> down-convert, two render from a neutral format of their own, and all of them treat skills as an
> *output* for the harnesses that want one. v1.1's "skills as source" would have changed every
> command's invocation model (model-triggered skill vs user-typed command) for no portability gain.
> **DST-A is rewritten to Claude-canonical**: `.claude/commands/*.md` and `.claude/agents/*.md` stay
> the hand-edited source, and every other harness directory is rendered down from them by the
> compiler arc already has. The 58-artifact migration phase disappears; **appetite 12.5/14 → 10.5/12 d.**
> Per-file `targets:` (rulesync's one good idea) added; spec-kit's "prose fallback" rejected by name.
>
> **Status: DRAFT for owner review — NOT landed.** On landing, decisions **DST-A…K lock**; **DST-L and
> DST-M stay open by design** and are decided at kickoff. This file then becomes the frozen decision
> record; the buildable cycle is cut from it into `initiatives/distribute/PLAN.md` at kickoff. Attack
> findings mutate that file, never this one.
>
> **Honesty note.** There is no external consumer of arc on any harness other than Claude Code, and
> none is invented: `sync-to-project.sh` copies `.claude/` only, LexOS runs root-mode under Claude
> Code, and the spine holds zero receipts from a non-Claude harness. This plan does not claim demand.
> The falsifiable claims it makes are mechanical: **REQ-03** (arc's own commit → review → ship loop
> runs end-to-end inside OpenCode on a non-Claude model, and the same gates refuse the same bad
> inputs), **REQ-09** (a change that fails a gate cannot reach `main` from any harness, by any
> route), **REQ-02** (an install that cannot place a feature says so by name and never claims it),
> and **REQ-01** (no blocking rule is enforced only below merge-time).
>
> **ADR band.** `distribute` holds no band. Claim **2000–2099** — PORTFOLIO's "next lane to be born"
> row — at kickoff, **after sweeping sibling worktrees.** `discover` claimed 1900 on 2026-10-06 one day
> before this file was written; a second lane born in the same week is exactly when the board is stale.

---

## Read this first — two words, two problems, and one source

"ChatGPT, Kimi, Ollama, DeepSeek" are **models** — who thinks. "OpenCode, Codex, Hermes, Claude Code"
are **harnesses** — who runs the commands, agents and hooks. The two are solved in different places,
and conflating them is how a cycle builds the wrong thing.

**The model seat is already solved and is NOT this lane.** `arc-run` dispatches to five drivers
(`claude-code` · `codex` · `generic-api` · `hermes` · `mock`) behind one interface (ADR-0203);
`engine/router.yaml` says which tier runs where (ADR-0069); ADR-0220 gives a receipted
`--trial-model` seam; model-policy v2 (ADR-1800..1803, closed 2026-10-06) lets a pin name a
`profile:<name>` from the owner store — OpenRouter, OmniRoute, a local Ollama endpoint. A DeepSeek or
Kimi model reaches arc today by one profile line. This lane touches none of it (DST-F).

**The harness seat is the gap, and it is one layer wide.** Read the tree as three layers:

```
A · BRAIN     processes/*.process.yaml · CONSTITUTION · docs/adr · playbooks · rules · PLANs
              plain markdown + yaml. every harness reads it. UNTOUCHED by this lane.

B · BINDING   .claude/commands (29) · .claude/agents (32) · .claude/hooks (7 events) ·
              .claude/settings.json · .claude/skills (4) · .codex/ (7 agents, 6 hook scripts,
              a hooks.json carrying absolute Windows paths) · .agents/skills (9) · AGENTS.md (a
              template that still says "Name: TODO")
              ← the Claude dialect. THIS is what the lane renders for other harnesses.

C · ENGINE    .claude/scripts/** (bash + mjs) · arc.gates.yaml · hq.policy.yaml · CI (4 workflows,
              210 bats files)
              runs in a shell, needs no Claude. ONE problem: layer B is what CALLS it —
              the blocking gates (PreToolUse, PreToolUse-edit) fire from Claude Code hooks and
              from nowhere else. No git hook exists (no core.hooksPath, no husky), and whether
              `main` is protected on GitHub was NOT readable from the review machine (no `gh`).
```

So the lane is not a rewrite. It is: render layer B per harness from the source it already is, and
move the *truth* of layer C's gates to a place every harness must pass through — the repository's
merge path — leaving commit hooks as the second line and harness hooks as the first. Two moves.

**The source question, settled by the market.** Five tools already ship one workflow to many
harnesses. Two (GSD, compound-engineering-plugin) keep the **Claude dialect as the canonical
source** and convert downward at install — Codex gets skills, Gemini gets TOML, hooks that cannot
land are *warned by name*. Two (spec-kit, rulesync) render from a **neutral format of their own**.
None of the five uses SKILL.md as its source; all of them emit skills as an *output* where a harness
wants one. arc is already shaped like the first group — 29 commands, 32 agents and 7 hook events in
a mature Claude dialect, a compiler (`arc-compile`) that renders `processes/` to `claude-code` and
`codex` with a **named** `[unsupported]` refusal and byte-diff goldens per target (ADR-0201/0202),
and, undeclared in the tree, eight `.agents/skills/source-command-arc-*` files that are exactly a
Claude-command-to-Codex-skill down-conversion someone already ran once. **This lane does what GSD
does, with the compiler arc already has: the Claude files stay the source, everything else is
rendered from them, and what cannot be rendered is said out loud.**

---

## Goal

`arc init --target <harness>` renders arc's commands, agents, rules, hooks and MCP config into that
harness's own dialect from the Claude-dialect source, owns only the paths it wrote, refuses by name
any feature the harness cannot hold, and `arc doctor` reads back what landed — while every blocking
gate arc relies on is enforced at merge-time on the repository, so a session in any of the four
verified harnesses, on any model, cannot land on `main` what a Claude Code session cannot land.

---

## Current state (verified 2026-10-07 against the live tree — re-verify at kickoff)

| Thing | Count | Role after this lane |
|---|---|---|
| Commands (`.claude/commands/*.md`) | 29 | **SOURCE** — 26 hand-edited; 3 generated from `processes/` (ADR-0201), unchanged |
| Processes (`processes/*.process.yaml`) | 14 | **SOURCE** of the 3; compile targets today **claude-code · codex** |
| Agents (`.claude/agents/*.md`) | 32 | **SOURCE** — Claude frontmatter (`model:` tier, `tools:`) stays as written |
| Hooks (`.claude/hooks/<Event>.d/`) | 7 events; 2 blocking | **SOURCE** for tool-time; fragments get commit-time and merge-time twins (DST-B) |
| Skills (`.claude/skills/`) | 4 | source; passed through to targets that read skills |
| Skills (`.agents/skills/`) | 9 — 8 `source-command-arc-*` + `seo-article-writer` | ⚠️ undeclared — resolved in P00 (DST-D) |
| `.codex/` | 7 agents · 6 hook scripts · `hooks.json` | ⚠️ undeclared, never installed, machine paths — becomes an **OUTPUT** or is deleted (DST-D) |
| `AGENTS.md` / `CLAUDE.md` | 118 / 206 lines | ❌ both template (`Name: TODO`); `AGENTS.md` becomes the brain (DST-G) |
| MCP config (`.mcp.json`, `.codex/config.toml`) | 2 hand-kept copies, drifting | `.mcp.json` SOURCE; the rest OUTPUT |
| Git hooks | **none** | commit-time line added (DST-B, DST-M) |
| Branch protection on `main` (`technology-ashiq/arc`) | **unverified** — `gh` absent on the review machine | REQ-09 baseline read at kickoff, not assumed |
| CI (`.github/workflows/`) | 4 | merge-time truth, once required (REQ-09) |
| Install path | `sync-to-project.sh` → `.claude/` + templates + playbooks | becomes a caller of the `claude-code` adapter, byte-identical (DST-E) |
| Drivers (`engine/drivers/`) | 5 | model seat — out of scope (DST-F) |

**Two things in this table are undeclared states, and Constitution E3 does not allow them to
persist.** `.codex/` reads as "arc supports Codex" and is a stale copy with a machine-specific hooks
file; `.agents/skills/source-command-*` reads as "arc's commands are skills" and nothing generates,
checks or installs them. Both are resolved in **P00**, before any new surface is added (DST-D).

---

## Success requirements

| # | Requirement | How it is proven |
|---|---|---|
| **REQ-01** | No blocking rule is enforced only below merge-time. Every rule in `arc.gates.yaml` and every blocking hook fragment has a merge-time twin (CI job or required check); tool-only rules are declared `advisory`. | `gate-parity.mjs` reads the enforcement table (see *Enforcement boundary*) and FAILs on a blocking rule with no merge-time row; `--mutant-selftest` plants a hook-only blocking rule and must FAIL naming it. |
| **REQ-02** | An install never claims a feature the harness cannot hold. | `arc init --target skills-only` on a tree with hooks prints each unplaced feature by name and exits 0 with a `degraded` section; the matrix test asserts every `false` cell produces that line. |
| **REQ-03** | arc's own loop runs under a second harness on a non-Claude model. | In OpenCode, on a model-policy profile that is not Anthropic: `arc-commit` → `arc-review` → `arc-ship` complete with receipts on the spine; the same three negative fixtures (push to main, secret in diff, generated-file hand-edit) are refused as they are under Claude Code. Receipts carry `harness: opencode` in payload. |
| **REQ-04** | One source, every rendered target byte-identical on re-run; the Claude target is the source itself. | `arc-compile --check --all --target <t>` is 100% byte-identical for `codex`, `opencode`, `skills-only`; CI runs it per target. For `claude-code` the check covers only the 3 process-generated commands, exactly as today. |
| **REQ-05** | `.codex/`, `.opencode/` and `.agents/skills/` hold nothing the compiler did not write. | A hand-placed file in any rendered directory fails the dirty-diff check (ADR-0201's rule on every output surface). |
| **REQ-06** | `AGENTS.md` is the brain and `CLAUDE.md` cannot disagree with it. | `brain-drift.mjs` FAILs on a rule heading in `CLAUDE.md` absent from `AGENTS.md` unless marked `<!-- claude-only -->`; both files lose every `TODO`. |
| **REQ-07** | `arc doctor` reports the truth of an install, not the intent. | Doctor reads the install manifest and the directory back and prints placed / degraded / missing / **unmanaged-conflict**; deleting one installed file flips its row; it also prints the REQ-09 repository state. |
| **REQ-08** | The package installs and runs on a clean machine with zero runtime dependencies, and is NOT published. | A CI job on a fresh runner (each of the three OS legs) installs from the tarball **and** from the git URL, runs `arc doctor`, exits 0; `package.json` has an empty `dependencies`; no `npm publish` in any script, workflow or doc. |
| **REQ-09** | A change that fails a gate cannot reach `main` from any harness by any route. | `main` is protected: required status checks name the CI jobs, direct push refused, force-push refused, `--no-verify` locally changes nothing at merge. Evidence: a PR carrying a planted gate failure shows the merge control disabled; `git push origin main` from a clean clone is refused by the server; `doctor --repo` reads the protection back and prints each setting. **The settings are an owner action**, listed in *Gates at kickoff*. |
| **REQ-10** | `apply` is transactional and refuses the boundary cases by name. | Writes go to a temp path and are renamed into place; a failure mid-apply rolls back every file of that run (manifest-driven); a target path that is a file, a symlink, or inside a path with spaces or a Windows drive letter is handled or refused with a named reason; fixtures for each run on all three CI legs. |

---

## Decisions (letters — real ADR numbers assigned at kickoff from the claimed century)

**DST-A · The Claude dialect is the source; every other harness directory is rendered from it.**
`.claude/commands/*.md` (26 hand-edited + 3 generated from `processes/`), `.claude/agents/*.md`,
`.claude/skills/`, `.claude/hooks/` and `.mcp.json` are the source and stay exactly as they are.
`arc-compile` gains command and agent inputs beside its process input and renders them through the
per-harness adapters into `.codex/`, `.opencode/` and the `skills-only` bundle — **outputs**, with
do-not-edit banners and dirty-diff CI, exactly as `.claude/commands/arc-kickoff.md` already is. The
Claude Code target is the identity: nothing is migrated, no invocation model changes, `/arc-kickoff`
is the same file it was yesterday. Three rules make the render honest: (1) a per-file frontmatter
key **`targets:`** (default: every verified row) lets a Claude-only command such as
`/arc-face-module` declare that it renders nowhere else; (2) a Claude construct the target cannot
express — `allowed-tools`, `model:`, `context: fork`, a hook event — is dropped **only where the
matrix cell says so**, and otherwise **fails compilation with a named `[unsupported]`**, the
compiler's existing behaviour; (3) **no prose fallback, ever** — spec-kit renders "a prose fallback"
where an agent lacks argument substitution; in arc that is a Truth Law violation, because a command
that silently became a paragraph still looks like a command. Skills are an **output format** (the
`codex` and `skills-only` rows), never the source — the harnesses that read skills get them, the
harness that reads commands keeps them, and the file the owner edits is one.

**DST-B · Enforcement is three levels, and only the top one is the truth.**
*Tool-time* (harness hooks) catches the mistake at the keystroke and may be advisory. *Commit-time*
(git `pre-commit` / `pre-push` through `core.hooksPath` or DST-M's answer) calls the **same**
fragment scripts and is the second line — it can be unset or `--no-verify`'d and the plan says so.
*Merge-time* (CI as required checks on a protected `main`) is the only level that cannot be
bypassed from a workstation, so **every blocking rule has a merge-time row** (REQ-01) and the
repository is configured to make it final (REQ-09). Claude hooks are kept; nothing is enforced *only*
there. A harness with no hook model is not a weaker arc; it is a slower one.

**DST-C · The capability matrix is declared, machine-readable, and the install obeys it.**
`engine/harnesses.yaml`: one row per target, one column per feature (commands · agents · hooks ·
skills · mcp · brain-file · subagents · **user-only invocation** · argument substitution), each cell
`true | false | partial:<note>`, and a `verified: <date>` per row. `arc init` places only `true`
cells, prints every `false` by name, and `arc doctor` reads the matrix to say what *should* be
there. A row with no date does not install. The ECC study's highest-fit finding: a declared gap is
Truth Law; a silent `.codex/` is not.

**DST-D · Undeclared surfaces are resolved in P00 before any new one is born.**
`.codex/` becomes a rendered output of the `codex` target or is deleted in the same PR — no third
state. `.agents/skills/source-command-*` are compared against the eight commands they name: if they
are a faithful down-conversion they become the `codex` adapter's first golden (they are evidence
that Pattern A already ran here once); if not, they are deleted. `seo-article-writer` is the growth
lane's and moves to `.claude/skills/`. Adding `.opencode/` beside two undeclared directories would be
a third lie.

**DST-E · Install is an adapter registry with plan → apply → doctor, an install manifest, and
goldens per target.**
`engine/install-targets/<harness>.mjs` exports `{ plan(tree, dir) → ops[], apply(ops), doctor(dir) }`.
`plan` is pure and printable — `arc init --dry-run` prints it and writes nothing. `apply` writes
only what `plan` returned, **records every path it owns in `<dir>/.arc-install.json`** (the
`arc-registry.json` pattern the ECC study judged better than ECC's own), and **refuses an unmanaged
file at a managed path by default** (`--force` overwrites, and says so in the manifest). `doctor`
reads the manifest first, the directory second. Every rendered target has a golden tree under
`tests/fixtures/distribute/goldens/<target>/` and CI byte-diffs it (REQ-04). `sync-to-project.sh`
becomes a thin caller of the `claude-code` adapter, so LexOS and every root-mode consumer see
**zero** behavioural change — a permanent consumer contract (ADR-0054's spirit) — and the golden
for `claude-code` is today's sync output, captured before any code moves. The `settings.json`
merge (`arc-settings-merge.mjs`) is the adapter's, not the shell script's.

**DST-F · The model seat is out of scope, and this file says so once.**
No driver, router row, profile or tier changes in this cycle. A harness is chosen by the owner's
hand; a model by model-policy (ADR-0069 b1: no auto-switching). REQ-03's "non-Claude model" is a
**profile line** the owner writes under ADR-1800, not code this lane writes.

**DST-G · `AGENTS.md` is the brain; `CLAUDE.md` is `@AGENTS.md` plus a marked Claude-only section.**
The rules that every harness must obey (branch discipline, publish-is-irreversible, change
discipline, tests-on-CI-only, the shell-quoting law) move to `AGENTS.md`; `CLAUDE.md` imports it
and keeps only what is Claude-specific (hook names, `code-reviewer` subagent, output styles), each
block marked `<!-- claude-only -->`. `brain-drift.mjs` is the gate (REQ-06). Both files lose their
`TODO` template lines in P01 — the owner has been loading a template as the brain for three months.

**DST-H · Packaging is a zero-dependency Node CLI over the existing scripts, with an exact
invocation contract, and nothing publishes.**
`bin/arc.mjs` with `init · doctor · compile` subcommands. **v1 invocation contract, both tested on
a clean runner (REQ-08):** (1) `npx github:technology-ashiq/arc init --target <t>` from the git URL,
(2) `npm i -g ./arc-<version>.tgz && arc init …` from a local tarball produced by `npm pack`. Bash
bodies are called, not ported — porting is a later lane's decision with its own evidence.
`npm publish`, a public README rewrite, and any marketing claim are **outside** this cycle (No-go
3): publishing outward is irreversible and needs its own owner OK.

**DST-I · Subagents degrade to role skills; they are never emulated by nesting harness calls.**
Where a harness has no subagent model, an agent renders as a skill carrying its role prompt and
`tools` as prose, and the matrix cell says `partial: single-session`. Spawning one harness from
inside another to fake a subagent is forbidden — it is the "agent-to-agent call" ORG-E already
refuses, with a harness in the middle.

**DST-J · First targets are `claude-code` · `codex` · `opencode`, plus one generic `skills-only`.**
`claude-code` is the identity target (DST-A). `opencode` is the row that makes the owner's model
list true at once — it runs Ollama, DeepSeek, Kimi, GLM and any OpenRouter model under one harness;
commands render as `.opencode/command/*.md`, agents as `.opencode/agent/*.md`. `codex` renders
commands **as skills** (`$arc-<name>`), the shape GSD and spec-kit both ship for Codex, and already
has a compile adapter and a driver. `skills-only` (AGENTS.md + skills + MCP, nothing else) is what
Hermes Agent, Kimi CLI and Gemini CLI get in v1, declared as such in the matrix; their full rows are
v2 triggers, not v1 work. Every target beyond these four is recorded in `harnesses.yaml` as
`status: unverified` with the date, never as a row that installs.

**DST-K · Two-surface adversarial pass on every adapter and every gate.**
One agent on the plan/compile logic, one on the filesystem and shell boundary (paths with spaces,
Windows drive letters — `.codex/hooks.json` is the standing exhibit — symlinks, a target directory
that is a file). Each carries the lane's running defect list with the instruction to check each one
in *every other adapter*. Neither may be the adapter's author. REQ-10 turns the boundary cases the
attacker is expected to find into acceptance criteria, so the pass confirms rather than discovers.

**DST-L · OPEN at kickoff — where the code lives.**
A new `products/distribute` with `.claude/scripts/distribute/`, or the adapters live in `engine`
beside `arc-compile` as a second consumer of its adapter registry? The second avoids a product whose
only job is installation and keeps one compiler; the first keeps `engine` from owning a CLI.
Decided at kickoff, recorded as an ADR.

**DST-M · OPEN at kickoff — the commit-time mechanism.**
`core.hooksPath .githooks/` (zero dependency, one `git config` that `arc init` runs) versus a hook
manager. The lane's bias is the zero-dependency path; the attacker's bias is that `core.hooksPath`
is one `git config --unset` from silence — which is why DST-B makes merge-time the truth and this
decision only chooses the *second* line. Decided at kickoff with the attacker's finding recorded.

---

## Enforcement boundary — what blocks what, from any harness

This table is the lane's central claim written as a contract. `gate-parity.mjs` reads it (REQ-01);
`doctor --repo` reads the last column back from GitHub (REQ-09). A row marked **truth** is the one
that cannot be bypassed from a workstation; everything above it is speed, not safety.

| Action | Tool-time (harness hook) | Commit-time (git hook) | Merge-time (repository) |
|---|---|---|---|
| Edit a generated file | Claude: `PreToolUse-edit` BLOCK · others: none | `pre-commit` → `arc-compile --check` refuses | CI `arc-compile --check` + dirty-diff — **truth** |
| Commit a secret / a `.env` | Claude: `PreToolUse` BLOCK · others: none | `pre-commit` → the same fragment | CI secret scan job — **truth** |
| Commit straight to `main` | Claude: hook WARN | `pre-commit` branch check refuses | **Protected `main`: direct push refused by server** — **truth** (REQ-09) |
| Push with failing tests / lints | — | `pre-push` → fast lints only (tests never run locally, `.claude/rules/testing.md`) | Required checks must be green to merge — **truth** |
| Merge a PR | — | — | Required checks + **owner's click** (E2: the machine never merges) — **truth** |
| Deploy / publish outward | Claude: `PreToolUse` BLOCK on deploy verbs | `pre-push` refuses deploy scripts | CI deploy job gated on `main` + owner approval receipt — **truth** |
| Run a destructive shell command | Claude: `PreToolUse` BLOCK · others: none | n/a — not a git event | n/a — **declared `advisory` for non-Claude harnesses in the matrix**; the damage class is local, not `main` |
| Hand-edit `.codex/`, `.opencode/`, a generated `.claude/` file | Claude: `PreToolUse-edit` BLOCK | `pre-commit` dirty-diff | CI dirty-diff — **truth** |

Two consequences the table makes explicit: (1) the only rows with no merge-time truth are local
damage classes (destructive shell), and those are **declared advisory** outside Claude Code rather
than silently absent — that is the A-02 case, now a row instead of a contradiction; (2) REQ-09 is a
*repository setting*, so until the owner flips it, every "truth" cell in the last column is a CI
job that advises and does not bind. `doctor --repo` says which state the repository is in.

---

## The three layers, after the cycle

```
LAYER 3 · GATES      gate-parity.mjs      — every blocking rule has a merge-time row   BLOCK  (DST-B, REQ-01)
                     brain-drift.mjs      — CLAUDE.md ⊆ AGENTS.md                      BLOCK  (DST-G, REQ-06)
                     arc-compile --check  — every rendered target byte-identical       BLOCK  (DST-A, REQ-04)
                     harness-matrix.bats  — every false cell prints by name            BLOCK  (DST-C, REQ-02)
                     doctor --repo        — protection read back from GitHub           REPORT (REQ-09)
                     protected main + required checks + git hooks — the SAME fragments BLOCK  (DST-B)

LAYER 2 · ADAPTERS   engine/install-targets/{claude-code,codex,opencode,skills-only}.mjs   (DST-E)
                     <dir>/.arc-install.json — what each install owns                        (DST-E)
                     engine/harnesses.yaml — the declared matrix, dated per row               (DST-C)
                     bin/arc.mjs — init [--dry-run|--force] · doctor [--repo] · compile       (DST-H)

LAYER 1 · SOURCE     processes/*.process.yaml → .claude/commands/ (3)                          (ADR-0201)
                     .claude/commands/*.md · .claude/agents/*.md · .claude/skills/ ·
                     .claude/hooks/ · .mcp.json · AGENTS.md — the Claude dialect, hand-edited  (DST-A, G)
                     ↓ rendered
OUTPUTS              .codex/ · .opencode/ · skills-only bundle — never hand-touched            (DST-A)
```

## How a harness gets arc — six steps, and the harness is told what it did not get

1. `npx github:technology-ashiq/arc init --target opencode --dry-run` runs `plan(tree, dir)` and
   prints the ops: files to render, files it would **refuse** (unmanaged at a managed path), the
   `degraded` list from `harnesses.yaml`, the commands excluded by their own `targets:`, the git-hook
   config it would set.
2. Without `--dry-run`, `apply` renders `.opencode/command/*.md`, `.opencode/agent/*.md`,
   `AGENTS.md`, skills, the MCP block — through temp-and-rename, recording each path in
   `.arc-install.json` — and nothing the matrix marks `false`.
3. `git config core.hooksPath .githooks` (or DST-M's answer) — commit-time is now on for *this*
   harness and every other.
4. `arc doctor` reads the manifest and directory back: placed / degraded / missing /
   unmanaged-conflict, one line each; `arc doctor --repo` adds the REQ-09 state of `main`.
5. The first `arc-commit` from that harness emits its receipt with `harness: opencode` in payload;
   the spine has its first non-Claude receipt, which is the lane's live-value milestone.
6. The first PR from that harness is merged by the owner's click after required checks — the
   merge-time row holds, or the plan's central claim is false and the retro says so.

---

## Phases (risk-ordered; appetites are ceilings)

**The cycle ends at P04.** Rows for Hermes, Kimi CLI and Gemini CLI beyond `skills-only`, a public
README, npm publish and a bash→Node port are deliberately *outside* it — each is throughput or an
irreversible decision, and a cycle that ends when the last harness is perfect has no end.

| Phase | Capability | Appetite | Why here |
|---|---|---|---|
| **P00** | **Matrix, the lies, and the spike.** `engine/harnesses.yaml` with the four v1 rows verified against each harness's live docs (`/arc-capability`, not memory), dated; `.codex/` and `.agents/skills/` resolved per DST-D; `claude-code` golden captured from today's `sync-to-project.sh` output **before any code moves**; REQ-09 baseline read from GitHub and recorded. **Live OpenCode spike:** owner installs OpenCode (ADR-0110 — arc installs nothing); one hand-rendered command is invoked from it and one receipt lands with `harness: opencode` in payload — if `validate.mjs` refuses the field, the vocab ADR lands in the same PR (ORG-C/D pattern). Study GSD's and compound-engineering's converters and ECC's `install-targets/` as evidence, not dependency. | 2 d | Cheapest phase, and every later phase reads the matrix. The spike is the kickoff-verification habit applied to the one unknown that could change the adapter architecture — found here it costs an afternoon; found in P03 it costs the adapters. |
| **P01** | **Gates to merge-time, and the brain.** The *Enforcement boundary* table lands as the file `gate-parity.mjs` reads; the gate is FAIL-FROM-BIRTH with `--mutant-selftest`; every blocking fragment gets its commit-time twin; CI jobs named so they can be required checks; `AGENTS.md` written, `CLAUDE.md` reduced to `@AGENTS.md` + marked Claude-only blocks; `brain-drift.mjs`. **Owner flips the REQ-09 settings in this phase**; `doctor --repo` confirms. Two-surface pass (DST-K). | 2.5 d | Highest risk and highest value. If arc's rules can be bypassed from a second harness, portability is a liability — this phase must hold before any second harness exists. |
| **P02** | **Source hygiene — no migration.** The P02 ADR enumerates the Claude frontmatter keys the compiler understands and what each target does with each (drop / render / `[unsupported]`); `targets:` added to the Claude-only commands; a frontmatter lint FAILs an unknown key; `arc-compile` gains command and agent inputs with the `claude-code` adapter as identity (byte-identical to the file itself, by construction). `.agents/skills/` either becomes the `codex` golden or is gone (DST-D). | 1 d | Small by design — v1.1 spent 3 d here migrating 58 files to a format no peer tool uses as source. What remains is making the existing source *declare* itself so the renderers cannot guess. |
| **P03** | **Install adapters.** `install-targets/{claude-code,codex,opencode,skills-only}.mjs`, plan → apply → doctor, manifest, `--dry-run` / `--force`, **REQ-10 transactional fixtures on all three CI legs**, goldens per rendered target, `sync-to-project.sh` re-pointed at the `claude-code` adapter with its golden unchanged. **Stop rule: more than 5 of the 29 commands come back `[unsupported]` on `opencode` → STOP, re-decide the matrix and the extension-key ADR before continuing.** Two-surface pass per adapter. **REQ-03 run for real** in OpenCode on a non-Anthropic profile, through to a merged PR (step 6). | 3.5 d | The visible deliverable, and safe only now: the source declares itself (P02), gates hold at merge-time (P01), the matrix says what each adapter may claim (P00). |
| **P04** | **`arc` CLI, clean-machine proof, retro.** `bin/arc.mjs` with `init · doctor · compile`; REQ-08's fresh-runner job installs from tarball **and** git URL on three OS legs and runs `doctor`; runbook; retro and seal. | 1.5 d | Packaging last — a CLI over unproven adapters would have been the thing people typed before any of it was true. |

**Planned 10.5 d · cap 12 d · 1.5 d slack.** The 2026-08-12 estimate was 10 d planned / 12 cap;
v1.1 rose to 12.5 / 14 on the review's additions; v1.2 drops 2 d by not migrating the source at
all. The sum is taken honestly either way — `kickoff-lint [appetite-sum]` fails hard on anything
else.

### Kill checkpoint — read at day 4.5, not at the 50% mark

Day 4.5 lands at the end of P01 and asks one question: **does a planted hook-only blocking rule get
refused on the merge path with no harness running — `gate-parity --mutant-selftest` fails closed,
and a PR carrying the planted failure shows its merge control disabled on the real repository?**
If the gates cannot be made to hold from the repository alone, the premise is unproven and the
cycle STOPs with that finding recorded — shipping adapters on top would hand every other harness a
copy of arc with its rules removed. The 50% mark falls inside P03 while the adapters are on
schedule, and a tripwire that fires on an on-track run is one that learns to be ignored.

---

## No-gos (v1)

- **No model work.** No driver, router row, profile or tier is touched (DST-F). "Ollama support" is
  one ADR-1800 profile line the owner writes, not a feature of this lane.
- **No migration of the source.** The Claude files are not moved, renamed, re-formatted or
  rewritten into any other format. A neutral source format of arc's own (the spec-kit / rulesync
  shape) is a **v2 trigger** — fired only if arc stops being Claude-first — and is named here so no
  afternoon re-opens it.
- **No prose fallback.** A construct a target cannot express fails by name. It is never rendered as
  a paragraph that looks like a command.
- **No full rows for Hermes, Kimi CLI, Gemini CLI, Cursor.** They get `skills-only` and a dated
  `unverified` note. Their full rows are v2 triggers: *a real person asks for one*, or the owner
  runs one for a week.
- **No publishing.** No `npm publish`, no public README rewrite, no "works with N tools" sentence
  anywhere. Publishing outward is irreversible and needs its own owner decision at that time — the
  LexOS-mockups near-miss is why this line exists. The README still says six products; fixing that
  is the growth lane's and happens when the public site exists to be wrong.
- **No bash→Node port.** The CLI *calls* the scripts. A port is a later lane with its own
  evidence; "bash looks unprofessional" is a feeling, and a 210-file test suite is a fact.
- **No hook emulation.** A harness without hooks gets gates at commit and at merge, not a wrapper
  that watches its process for tool calls.
- **No second compiler, no second walker.** `arc-compile` and `face-coverage`'s tree walkers are
  extended, never duplicated — the "validate one read, compare another" defect has now been fixed
  in four files and will not be born in a fifth.

---

## Rabbit holes (named detours)

**1. "Make every harness feel identical."** — *the one that would sink it.*
Hooks, subagents and permission models differ by design, and the attempt to paper over that
produces a shim per harness that nobody tests on the harness it targets. The lane's answer is the
matrix: say what is missing, in the install output, by name. A degraded row the user can read is
worth more than a parity nobody can verify.

**2. Porting the scripts to Node first "so the package is clean."** Twelve days become forty, the
210 bats tests become the port's backlog, and nothing installs anywhere. The CLI calls bash; the
port, if ever, is its own lane.

**3. A neutral source format "so Claude isn't privileged."** v1.1 of this file did this with
SKILL.md and it would have changed every command from user-typed to model-triggered for no
portability gain; spec-kit and rulesync do it with formats of their own and carry a converter *into*
Claude as well as out. arc is Claude-first by the owner's 2026-10-06 ruling; privileging the dialect
it is written in costs nothing today. If that ruling changes, this is the v2 that follows it.

**4. Verifying all nine harnesses in P00.** Four rows verified against live docs is a day; nine is
a week of reading changelogs for tools nobody here runs. The rest are `unverified` with a date.

**5. Treating the git hook as the gate.** It is the second line and the plan says so. The day a
session argues "the pre-commit hook covers it" is the day REQ-01 is read aloud.

**6. Fixing `README.md` while in there.** It is wrong (six products; twenty exist). It is also
public-facing, and rewriting it is the growth lane's publish decision. Note it in the retro.

---

## Assumptions ledger (cap 8 — each with a falsification trigger)

| # | Assumption | Falsified when |
|---|---|---|
| A-01 | Most of the 29 commands use only constructs OpenCode can express (`$ARGUMENTS`, body prose, shell calls). | P03's stop rule fires (>5 `[unsupported]`) → the matrix and extension-key ADR are re-decided; the count is printed in the P03 evidence either way. |
| A-02 | Every blocking hook fragment has a merge-time twin reachable without a harness. | A fragment's damage class is local (destructive shell) → it is a declared `advisory` row for non-Claude harnesses in the *Enforcement boundary*; REQ-01 counts it as declared, never as covered. |
| A-03 | OpenCode's command, agent and config formats are stable enough to golden. | The P00 spike or a minor OpenCode release within the cycle breaks the golden → the adapter pins a version in `harnesses.yaml` and `doctor` reports a mismatch. |
| A-04 | `core.hooksPath` survives the owner's normal workflow (13–37 worktrees, Windows, the main clone). | A worktree is found with hooks silent → DST-M flips to the manager, recorded as an ADR; merge-time is unaffected by construction. |
| A-05 | The `.agents/skills/source-command-*` bodies are a faithful down-conversion of their commands. | They diverged → they are deleted in P00 and the `codex` golden is produced fresh by the adapter. |
| A-06 | A non-Anthropic profile exists in the owner store by P03. | None does → REQ-03 runs on the `mock` driver with the harness swap proven and the model swap recorded as **owed**, never claimed. |
| A-07 | The face app reads nothing under `.claude/commands/` that this lane changes. | Nothing moves, so only the new `targets:` frontmatter key could matter → `face-coverage`'s `treeCommands` tolerates unknown keys or is extended there; coordinate with the face lane at kickoff. |
| A-08 | The owner can and will protect `main` with required checks during P01. | The repository plan or settings do not allow it → every "truth" cell in the merge-time column is downgraded to **advisory** in the table, `doctor --repo` says so on every run, and the honesty note is amended — the lane does not pretend. |

---

## Pre-mortem — top 7, seeded from this repo's own history

1. **Adapters ship, gates do not follow** — a second harness gets arc without its rules.
   *Mitigation:* phase order P01 before P03 is locked in the kickoff prompt; the day-4.5 checkpoint
   asks exactly this on the real repository.
2. **The git hook is mistaken for the gate** and `main` is never protected, so the whole merge-time
   column is a CI job that advises.
   *Mitigation:* REQ-09 is an owner action in P01 with `doctor --repo` as its witness; A-08 says what
   happens if it cannot be done.
3. **A rendered directory is hand-edited once and the generator is turned off "for now."**
   *Mitigation:* dirty-diff CI on every rendered directory from P03 — ADR-0201's rule, now on every
   output surface.
4. **The matrix is written from memory and is wrong on day one.** `.codex/hooks.json` was written
   from a machine, not a spec, and carries that machine's drive letter.
   *Mitigation:* P00 verifies each v1 row through `/arc-capability` against live docs, with the
   date in the row; the spike runs one row for real.
5. **A Claude-only construct is quietly flattened** — an `allowed-tools` line dropped on OpenCode
   without a word, so a command that was fenced in Claude runs unfenced elsewhere.
   *Mitigation:* DST-A rule (2): drop only where the matrix cell says so, otherwise `[unsupported]`
   by name; the P02 lint FAILs an unknown frontmatter key so nothing is dropped by ignorance.
6. **`arc init` overwrites a user's own `.opencode/` or `settings.json`.** `sync-to-project.sh`
   already did this once to `settings.json`.
   *Mitigation:* DST-E's manifest, refuse-unmanaged default, `--dry-run`; REQ-10's fixtures.
7. **The cycle grows a port, a publish, a README or a neutral source format** because each is
   "just one more day."
   *Mitigation:* the No-gos name all four; the retro records the pressure rather than the work.

---

## External evidence (checked 2026-10-07; re-check at kickoff through `/arc-capability`)

**How five tools ship one workflow to many harnesses — the scan that settled DST-A:**

| Tool | Canonical source | Reaches other harnesses by | What it says is not portable |
|---|---|---|---|
| **GSD** (get-shit-done) | Claude command markdown (`/gsd:help`) | Install-time conversion per runtime (`--claude --opencode --gemini --codex --all`); Codex gets **skills** (`$gsd-help`) | conversion of hooks/agents not documented |
| **compound-engineering-plugin** (Every) | Claude Code plugin format, as-is | `bunx` converter → 10+ targets (OpenCode, Codex, Gemini, Copilot, Kiro, Qwen…) | Gemini: "hooks explicitly unsupported — a warning is logged" |
| **spec-kit** (GitHub) | Its own neutral template markdown (`$ARGUMENTS`, `{SCRIPT}`) | `specify init --ai <agent>` renders for 40+ agents; skills-based install for Claude/Hermes/Devin | agents without argument substitution get "a prose fallback at render time" — **rejected here** (DST-A rule 3) |
| **rulesync** | `.rulesync/` frontmatter markdown with per-file `targets:` | `generate` → rules / commands / subagents / skills / hooks per tool; `generate --check` drift gate | Codex loses `globs` scoping (everything lands in root `AGENTS.md`) |
| **ECC** (MIT, pin `569b1d5…`) | Claude layout | `lib/harness-capabilities.js` matrix + `lib/install-targets/` adapters | declares per-harness unsupported features — the DST-C shape |

Reading: **none of the five uses SKILL.md as its source; all emit skills as an output where a
harness reads them.** The two closest to arc's shape (GSD, compound-engineering) keep the Claude
dialect canonical. rulesync's `targets:` key and `--check` gate are adopted; spec-kit's prose
fallback is named and refused.

- **Agent Skills open standard** — SKILL.md adopted by 32+ tools as of 2026-05 (Codex CLI, Claude
  Code, Gemini CLI, Cursor, Kiro among them); Codex scans `.agents/skills/` at repo level and
  `$HOME/.agents/skills/` at user level; tool-specific frontmatter keys are ignored by tools that do
  not know them. This is why skills are the right **output** for the `codex` and `skills-only` rows.
  Source: codex.danielvaughan.com, 2026-05-05.
- **Verified in-tree, not externally:** `arc-compile`'s named `[unsupported]` refusal and per-target
  goldens (ADR-0201/0202); `_dispatch.sh`'s advisory/blocking split; five drivers; model-policy v2
  profiles (ADR-1800..1803); `arc-settings-merge.mjs` as the record of the overwrite defect; the
  eight `.agents/skills/source-command-*` files as an undeclared prior run of the GSD shape. These
  are the parts this lane extends.
- **Not verified and not claimed:** exact current file formats for OpenCode commands/agents, Codex
  skills frontmatter, Kimi CLI and Hermes Agent project files; **the protection state of `main`**
  (the review machine had no `gh`). P00 reads each from its live source and records the date; a row
  without a date does not install, and a repository state that was not read is reported as unknown.

---

## Gates at kickoff (checked in-file before the prompt is pasted)

- Owner ruling on the spine as `decision.recorded` (Phase 0's first act), cited by every kickoff ADR
- Live slot acknowledged — `PORTFOLIO.md` WIP line (launch, discover, face, design, growth, legal,
  scheduler, bench are LIVE; ADR-0052 makes the number informational, never blocking)
- **Century claim 2000–2099** per `PORTFOLIO.md`, swept across sibling worktrees and remote branches
- **DST-L answered** — `products/distribute` vs `engine` home
- **DST-M answered** — `core.hooksPath` vs a hook manager, with the attacker's bypass finding recorded
- **Owner actions named and dated:** (a) OpenCode installed on the owner's machine for the P00 spike
  (ADR-0110 — arc installs nothing); (b) GitHub branch protection on `main` to be flipped in P01 —
  required checks, no direct push, no force-push — or A-08 invoked in writing
- `claude-code` golden captured from today's `sync-to-project.sh` output and committed **before** P03
- Adjacent-lane check: face v2 (A-07), growth (README is theirs), model-policy (A-06's profile line)
- `.agents/skills/source-command-*` provenance answered (A-05)

---

## Note on the model question (kept separate on purpose)

The owner's list — ChatGPT, Kimi, Ollama, DeepSeek, Hermes — reaches arc through two doors that
already exist and this lane does not touch: a model-policy **profile** (ADR-1800: one line naming an
OpenRouter / OmniRoute / local-Ollama gateway) for the model, and the `hermes` driver (engine Cycle 7)
for Hermes as a hired runtime. REQ-03 deliberately runs on such a profile so the cycle proves the
two doors compose — harness swapped by this lane, model swapped by that one — without this lane
owning either half. If the owner wants a particular model promoted to a router tier afterwards, that
is a separate reviewed diff citing ADR-0069, not part of this cycle.

---

## KICKOFF PROMPT — paste into Claude Code in the arc repo (after the gates above clear)

> Read `docs/strategy/plans/PLAN-distribute.md` end to end before doing anything, then run
> `/arc-kickoff "arc under verified harnesses: the Claude files stay the source, every other harness
> is rendered from them, every blocking gate is enforced at merge-time on the repository, and an
> install names what it could not place" --lane distribute`.
>
> Write PLAN.md and PROGRESS.md, then **stop and wait for my approval before any code.**
>
> These are locked and must appear in the PLAN you write:
>
> 1. **DST-A** — `.claude/commands/*.md`, `.claude/agents/*.md`, `.claude/skills/`, `.claude/hooks/`
>    and `.mcp.json` are the source and are **not moved, renamed or reformatted**. `.codex/`,
>    `.opencode/` and the `skills-only` bundle are rendered outputs of `arc-compile` with do-not-edit
>    banners and dirty-diff CI. A per-file `targets:` key limits where a command renders. A construct
>    a target cannot express is dropped only where the matrix cell says so and otherwise fails by
>    name — **never a prose fallback**. Skills are an output format, never the source.
> 2. **DST-B / REQ-01 / REQ-09** — enforcement is three levels and merge-time is the truth. The
>    *Enforcement boundary* table lands as a file `gate-parity.mjs` reads; the gate is FAIL-FROM-BIRTH
>    with `--mutant-selftest`; every blocking fragment gets a commit-time twin calling the **same
>    script** and a merge-time row; `doctor --repo` reads `main`'s protection back. Nothing is
>    enforced only in a Claude Code hook, and a git hook is never called the gate.
> 3. **DST-C** — `engine/harnesses.yaml` is the declared matrix with a `verified:` date per row and
>    columns for user-only invocation and argument substitution; `arc init` places only `true` cells
>    and prints every `false` by name; an undated row does not install.
> 4. **DST-D** — P00 resolves `.codex/` and `.agents/skills/` to rendered-or-deleted before any new
>    harness directory exists. No third state.
> 5. **DST-E / REQ-10** — adapters are `plan → apply → doctor` with an install manifest
>    (`.arc-install.json`), `--dry-run`, refuse-unmanaged-by-default, temp-and-rename writes with
>    rollback, and goldens per rendered target; the `claude-code` golden is captured from **today's**
>    `sync-to-project.sh` output in P00, and the re-pointed script must be byte-identical against it.
> 6. **DST-F** — no driver, router, profile or tier change. REQ-03's non-Claude model is an
>    ADR-1800 profile line I write, not code you write.
> 7. **DST-G / REQ-06** — `AGENTS.md` becomes the brain, `CLAUDE.md` becomes `@AGENTS.md` plus
>    `<!-- claude-only -->` blocks, `brain-drift.mjs` gates it, and every `TODO` leaves both files.
> 8. **DST-H / REQ-08** — `bin/arc.mjs` is zero-dependency and calls the existing scripts; the
>    clean-runner job installs from **both** the git URL and a local tarball on three OS legs.
>    **No `npm publish`, no public README rewrite, no bash port** in this cycle.
> 9. **DST-I / DST-J** — v1 targets are `claude-code` (identity) · `codex` (commands as skills) ·
>    `opencode` · `skills-only`; subagents degrade to role skills, never to a nested harness call;
>    every other harness is a dated `unverified` row.
> 10. **P00 carries the live OpenCode spike** — one command invoked from OpenCode, one receipt with
>     `harness: opencode` in payload, vocab ADR in the same PR if `validate.mjs` refuses the field.
> 11. Phase order is matrix+lies+spike → **gates to merge-time + brain** → source hygiene →
>     adapters → CLI. The gates phase precedes every adapter. Do not reorder.
> 12. **P03 stop rule** — more than 5 of the 29 commands rendering `[unsupported]` on `opencode`
>     STOPs the phase and re-opens the matrix and the extension-key ADR.
> 13. The **day-4.5 kill checkpoint** question is: *does a planted hook-only blocking rule get
>     refused on the merge path with no harness running, on the real repository?* If not, STOP and
>     record the finding.
> 14. **DST-K** — two fresh agents per adapter and per gate, one on logic, one on the filesystem
>     and shell boundary, carrying the lane's running defect list; neither is the author.
> 15. **DST-L** (home) and **DST-M** (commit-time mechanism) are yours to answer in the PLAN, each
>     recorded as an ADR.
> 16. Claim ADR century **2000** from `PORTFOLIO.md`, **after sweeping sibling worktrees and remote
>     branches**.
>
> Appetite: 10.5 days planned, 12 cap.
