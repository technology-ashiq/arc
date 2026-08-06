# Build Brief — phase 00 · Steel thread: the law, its parser, and the decision

spec-hash: sha256:afbaf580d5c23349716cf1b74fc1beae2a4d33991289df7f3fdb4b89ed9a41e3
lane: policy
reqs: 
adrs: 0028, 0068, 0106, 0107, 0500, 0501, 0502, 0503, 0504, 0505, 0506, 0507
blast-radius: .., .claude/hooks/PreToolUse.sh, .claude/hooks/_dispatch.sh, .claude/rules/testing.md, .claude/scripts/hq/lib/policy/, .claude/scripts/hq/lib/policy/tool-capabilities.json, .claude/scripts/hq/policy-lint.mjs, .claude/settings.json, .claude/settings.local.json, .gitattributes, .mcp.json, CONSTITUTION.md, docs/strategy/arc-full-architecture.md:61,217, initiatives/policy/PROGRESS.md, initiatives/policy/evidence/phase-00/, initiatives/policy/evidence/phase-00/hook-matrix.json, processes/*.process.yaml, products/policy, tests/fixtures/policy/demo-events.jsonl, tests/fixtures/policy/demo.yaml, tests/fixtures/policy/hostile/, tests/fixtures/policy/hostile/INDEX, tests/fixtures/policy/reducer/NN-name.jsonl, tests/fixtures/spine/hostile/, tests/fixtures/sync-golden/tree-manifest.txt, tests/policy-reducer.bats, tests/spine-emit.bats
no-gos: 
blast-radius-dropped: 26

### Non-negotiables

- **Fail-closed everywhere, honestly scoped (ADR-0501)**: a policy check that throws blocks the run (ADR-0028 fail-safe precedent); a hook fragment exits 2 on its own internal error; and because a hook that never runs cannot deny, every high-blast-radius capability also carries a static `permissions.deny` backstop. An event that lands in quarantine is never reported as enforcement success (ADR-0106/0032).
- **Enforcement lives in code paths agents cannot bypass** — the `arc-run` wrapper and registered hooks; never prompts, never convention.
- **Deny-by-default**: no wildcard grants, a kind absent from the file is read-only, unknown fields are hard errors (POL-B).
- **E2's five items are never above L1**, quoted verbatim from the adopted Constitution (receipt `01KZ9V0QXNNMB3ZH18MSH8DKH3`); the un-grantable resource list (ADR-0502) is excluded from **every write grant and every shell grant capable of mutating a file** (`git checkout --`, `cp`, `sed -i`, `mv`, output redirection) regardless of ceiling or cap — `shell` and `write` are separate vectors, so an exclusion written against writes alone is not an exclusion.
- **No auto-promotion, no auto-recovery, no time-decay** — every raise is a human decision citing trial-ledger evidence (A4, A1).
- **Money**: Mode A only; no provider call before a successful reservation; no real-money movement above L1; spend-capable kinds excluded from any future scheduling in v1.
- **One implementation, two consumers** (POL-D) — the wrapper and the hooks call the same library; two interpretations of policy is guaranteed drift.
- **Counts derived, never hardcoded** (ADR-0107); profiles and hashes forward-only, never backfilled or estimated (ADR-0068 spirit).
- **`policy-lint` FAILs from birth** — it is a validator (spine strict-mode exit-2 precedent), not an advisory lint; every other new advisory lint starts WARN-first in TRIAL.
- **A gate is not done until a fresh agent that has not seen the implementation has attacked it**, on two different surfaces, and every hole found is pinned as a permanent regression fixture.
- **Every phase close leaves its receipt on the spine**, and "tests green" means green on CI, read per job.
- Constitution articles this plan upholds, for kickoff-lint: E1, E2, E3, A1, A2, A4, A5, A8, A9, A10.

### Predictions

likely-failure-mode: (empty until proven)
likely-regression-site: (empty until proven)
riskiest-file: (empty until proven)
expected-blockers: (empty until proven)
expected-proof-failures: (empty until proven)

### Slices

#### slice: 01

title: `hq.policy.yaml` schema defined: closed capability set of exactly 8 (`read`, `write`, `shell`, `network`, `message`, `publish`, `deploy`, `spend`) × closed level enum `L0|L1|L2|L3`. **`L4` is a parse error**, and the ADR recording the supersession of `docs/strategy/arc-full-architecture.md:61,217` (which says L0–L4) is merged.
kind: logic
risk: high
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 02

title: The canonical L0–L3 semantics table lives in `hq.policy.yaml` itself (POL-A: one source of truth), not in a doc that describes it.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 03

title: `policy-lint` merged at `.claude/scripts/hq/policy-lint.mjs`, **exit 2 on any violation from birth** — it is a validator, not an advisory lint. Zero dependencies, Node ESM.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 04

title: **E2 binding (ADR-0506).** Four rules, and **the scope is BLANKET, not per-item** — this is stated explicitly because the two readings give opposite lint verdicts on the same file and this is the human-sovereignty guard: a capability "corresponding to" the listed item. This is the general rule and it wins over any narrower reading. **Consequence: no phrase-to-capability mapping exists or is needed**, so "killing a venture" and "changing prices" need no capability of their own. A kind that can do any E2 thing is an L1 kind, entirely. with an exact capability, made mechanical so it needs no honest declaration. exactly** — the empty list. Rule 4 is not an independent constraint; it is rule 2's consequence, spelled out because this is where it bites. **Nothing verifies that the empty list is true**: this is the model's single unverified human declaration, which is why `e2: []` on a kind granted `publish` or `deploy` above L1 needs explicit sign-off in the PR description and is a standing REQ-08 attack row.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 05

title: **E2 drift detection (ADR-0506), two ordered checks:** (1) sha256 of the live `CONSTITUTION.md` equals the value pinned in `hq.policy.yaml` (`233a64961dc0a028ceca6b113405ead699f9185b39342924c32c05f9786b6ee6`) — failure means the Constitution changed without a new adoption receipt; (2) **only then** the E2 paragraph is parsed and compared element-wise to `ungrantable_actions:`. Ordering is the mechanism: the parser is strict over prose, which is safe **only** because check 1 proves the bytes are pinned. Both checks read the file **once**, into one buffer — hash that buffer, then parse that same buffer, so there is no TOCTOU gap between them. Byte-stability across the win32 dev box and the ubuntu CI runners is already guaranteed by `.gitattributes` (`* text=auto eol=lf`, repo-wide); verified at kickoff — `CONSTITUTION.md` holds **zero CR bytes** here and hashes to exactly the pinned value. **A markdown `-text` override in `.gitattributes` would silently break this**, so that file is worth a glance if the hash check ever fails on a file nobody edited.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 06

title: **The E2 parse recipe, exactly.** The source text is prose, wrapped mid-clause. In `CONSTITUTION.md` it reads: ``` **E2 · Human Sovereignty.** Irreversible actions belong to the human alone: moving money, killing a venture, changing prices, unlocking real-money trading, publishing under Ashiq's name. No level of proven autonomy ever includes these. ``` Recipe: read as UTF-8 (the heading contains U+00B7 `·`); find the line equal to `**E2 · Human Sovereignty.**`; take following lines up to the first blank line; join them with a single space; match `/belong to the human alone: (.+?)\. No level/`; split the capture on `, `. It must yield **exactly five** items — any other count is exit 2, not a silent short list. Note the apostrophe in "Ashiq's" is ordinary text here and needs no escaping, but it must never be embedded in a single-quoted shell string.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 07

title: **ADR-0502's un-grantable resource list** enforced by **filesystem identity**, not string comparison: `fs.statSync(target)` → `dev`+`ino` compared against the same for each guarded path. One mechanism catches hardlink, symlink and NTFS junction together, because a hardlink has no canonical path for `realpath` to resolve to. Plus `fs.realpathSync.native()` to collapse 8.3 short names, a flat rejection of any segment matching `~[0-9]`, and case-folded comparison on win32. Applied to every `write` grant **and every file-mutating `shell` grant**. **The two no-inode cases are handled explicitly, never left to an uncaught throw** — an uncaught throw surfacing as a non-2 exit is literally one of ADR-0501's fail-open modes: (a) the *target* does not exist yet (an ordinary create) → compare the resolved **parent directory's** `dev`+`ino` plus the literal basename, so a create at a guarded path is still caught; (b) a *guarded path* does not exist in this checkout (`.claude/settings.local.json` is gitignored and often absent) → record it once at load time as `guarded-path-absent`, keep enforcing it by normalised path string, and never throw from inside `authorizeAction`. **The string fallback in case (b) is the only place normalisation is needed**, because `dev`+`ino` resolves through the OS and compares no strings at all. There it is, in this order: Unicode **NFC** on both sides (NFC and not NFD, so a precomposed path and a decomposed one compare equal; not NFKC, which folds visually-distinct characters and would make the check over-broad), then `realpathSync.native()` where the parent exists, then case-folding on win32 only.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 08

title: Deny-by-default proven by fixture: an action kind absent from the file is read-only at L1.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 09

title: **`resolveEffectivePolicy` implemented** (POL-C), keyed per **(action kind, capability)** pair (ADR-0505). Fixtures cover: initial cap = `min(ceiling, L1)`; `policy.level.changed` sets the pair's cap to the approved level; `policy.demoted` sets it to `max(L0, effective-at-incident − 1)` **for the capability involved only**; the **cap-above-ceiling bite**; a same-run double incident; a demotion-versus-promotion race resolved by spine append order, never wall-clock; replay determinism.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 10

title: **`authorizeAction` implemented** against fakes, with **every input injected — it reads no global state and opens no file of its own**, which is precisely what makes Phase 1 pure wiring: ``` authorizeAction( { kind, capability, resource }, // the candidate action { policy, events } // policy = parsed hq.policy.yaml ) -> { decision, reason, effective } // events = ordered event array ``` It calls `resolveEffectivePolicy(kind, capability, { policy, events })` internally for the pair's effective level, then applies the bound. In Phase 0 the test harness supplies both; in Phase 1 `arc-run` supplies the real file and the real spine. **Two calls with the same action and different `events` returning different decisions is the intended behaviour** — that is exactly what live-demo steps 6 and 7 demonstrate. No `arc-run` wiring, no provider calls, no money flow. This is what the runtime hostile families run against. **`decision` is three-valued, not a boolean** — this is forced by the level table and is the point of L1 existing at all: | effective level | `decision` | meaning | |---|---|---| | `L0` | `deny` | no call is attempted | | `L1` | `propose` | prepare and record the action as a proposal; **never execute it** | | `L2` | `execute` if the resource is inside the declared bound, otherwise `deny` | | | `L3` | `execute` | | A binary allow/deny would collapse L1 into either "deny" (making the birth level useless and the whole climb-from-L1 culture dead on arrival) or "allow" (making L1 a lie). Callers map `propose` to a proposal receipt; in Phase 0 the fakes just record it. **Every pair is born at `min(ceiling, L1)`**, so a freshly-declared kind returns `propose` for everything, not `execute` — that is correct and is exactly what "trust is earned" means. Reaching `execute` in Phase 0 requires a `policy.level.changed` in the reducer's **fixture** event stream; the live spine is not wired until Phase 2.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 11

title: Hash preimages use a **total, type-tagged encoder that refuses** `undefined`, `NaN`, `±Infinity`, `BigInt` and cycles rather than coercing them, with a fixture pinning one demoted-versus-tampered pair that must not collide (pre-mortem row 4).
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 12

title: **Hostile corpus green — every input exits 2 or is denied.** It lives at `tests/fixtures/policy/hostile/` with a plain-text `INDEX`, mirroring `tests/fixtures/spine/hostile/`. **Two families, and the INDEX says which is which:** *static* (fed to `policy-lint`) — unknown kind name, unknown capability, duplicate YAML keys, **contradictory grants**, negative / overflow / decimal money, wildcard / IP-literal / encoded / private-net domains, missing `e2:`, E2-at-L2, E2-at-L3, `spend`-above-L1, L4, **an argv0 absent from `argv0_classes:`**, **an argv0_classes entry listing `shell` in its `reproduces`**. **"Contradictory grants" means a grant whose declared bound defeats itself or a file-level rule**, and it is a lint error rather than something left to the runtime check. The three canonical fixtures: (a) `write: { level: L2, roots: ["**"] }` — a root that swallows the `ungrantable_resources`, so the file claims to bound a write while granting everything; (b) `network: { level: L2, domains: [] }` — bounded execution whose bound admits nothing, which is L0 wearing L2's label; (c) a capability at L2 or above on a kind whose `e2:` is non-empty, which contradicts the E2 rule from the other direction. Case (a) matters most: the runtime identity check would catch the individual write, but a lint that accepts the grant leaves the policy file *saying* something false, and the file is the human-readable artifact people reason from; *runtime* (fed to `authorizeAction`) — shell injection, path traversal, symlink escape, NTFS junction and hardlink escape, 8.3 short-name aliasing, case-folding aliasing, unicode lookalikes, write-to-settings, write-to-policy-file, delete-a-hook, mutate-a-guarded-file-via-shell (`git checkout --`, `sed -i`, redirection), and **interpreter-argv0 escape** — `node -e "require('fs').writeFileSync('.claude/settings.json',…)"`, which carries no chaining metacharacter and no discrete path argument to `stat`, and is blocked only by ADR-0507's derivation rule. (`forged promotion payload` is **not** in this phase: `authorizeAction` takes `(kind, capability, resource)` and knows nothing about promotion payloads, whose validators land in Phase 2. It is a Phase-2 fixture and a REQ-08 attack row.)
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 13

title: **ADR-0507's derivation rule, stated as an algorithm** (it is security-load-bearing, so it is specified here rather than left to be inferred from the worked example's comments): ``` reproduced = union over p in argv0_allow of argv0_classes[p].reproduces "*" expands to the SEVEN non-shell capabilities declared(c) = min( ceiling(c), cap(c) ) # no derivation, for all c effective(shell) = min( ceiling(shell), cap(shell), min over c in reproduced of declared(c) ) effective(c) = declared(c) # every c other than shell ``` Union, then minimum — so mixing `bats` (reproduces nothing) with `node` (reproduces everything) gives the same answer as `node` alone: the permissive entry never dilutes the restrictive one. An empty `reproduced` applies no extra constraint, so `effective(shell) = declared(shell)`. **`reproduces` may never contain `shell`, and a table entry that lists it is a lint error.** That restriction is what makes the no-cycle property structural rather than a hope: a program in `argv0_allow` is *already* exercising `shell`, so naming `shell` in its `reproduces` set says nothing while making `effective(shell)` self-referential. Note the trap this closes — `npm run` executes arbitrary lifecycle scripts, so the tempting entry is `reproduces: ["write","network","shell"]`, which would make the definition recurse into itself. The honest classification is that `npm` **is an interpreter**: it runs arbitrary programs, so it reproduces everything, and `"*"` already covers it. If a future capability gains its own derivation rule, this property must be re-established — this sentence is the reminder. An `argv0` absent from `argv0_classes:` is a lint error, never an implicit `narrow`.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 14

title: **Unknown kind name is a lint error.** The closed subject set is derived, not guessed: every `process:NAME` in `kinds:` must correspond to a `name:` field in some `processes/*.process.yaml`, plus the single reserved `session:interactive`. A kind in the file with no matching process is exit 2; a process with no kind in the file is the **birth-rule WARN** that Phase 3 wires (advisory, not this phase's error).
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 15

title: **Hook-interception feasibility matrix** delivered, **generated from `.mcp.json`** (not hand-listed): one row per side-effect tool class across the four declared servers — `stripe`, `supabase`, `playwright`, `context7`, roughly 40 tool rows — plus every built-in side-effect tool class. Each row carries either a fixture proving intercept-and-block, or an assigned fail-closed fallback. **A server present in `.mcp.json` with no row is an exit failure.** "Hook later" is not a state (POL-H, ADR-0503).
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 16

title: Each of ADR-0501's four claimed **fail-open modes is independently fixture-proven**: exit 1 or 3-255, missing hook script, malformed JSON on exit 0, and timeout — the timeout case against a deliberately short configured timeout, never the 10-minute default. A mode that cannot be tested is recorded as still-an-assumption in the exit note, never folded into the matrix as proven.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 17

title: The deny-floor assignments from ADR-0501 are decided and written down: which classes get a static `permissions.deny` rule as well as a hook fragment (`spend`, `deploy`, `publish`, and every E2-adjacent action at minimum). **Written down here, installed in Phase 2.**
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 18

title: Code homes match ADR-0500: library under `.claude/scripts/hq/lib/policy/`, lint at `.claude/scripts/hq/policy-lint.mjs`. No `products/policy` is created.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 19

title: Tests added and green **on CI** (per-job conclusions read, never the run-level tick).
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 20

title: Adversarial pass: **two fresh agents on different surfaces** — one on the decision logic (schema, reducer, E2 handling, `authorizeAction`), one on the shell/OS boundary (path identity, YAML parsing, injection). Every hole found is fixed and pinned as a fixture.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 21

title: `tests/fixtures/sync-golden/tree-manifest.txt` regenerated if any synced file was added or changed, diff-checked so only the intended paths moved.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 22

title: Tracker updated (`initiatives/policy/PROGRESS.md` row ✅ + done-log) and the phase-close receipt emitted to the spine.
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-00-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)
