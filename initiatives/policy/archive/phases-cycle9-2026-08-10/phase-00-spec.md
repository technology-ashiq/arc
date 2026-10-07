# Phase 00 — Steel thread: the law, its parser, and the decision

**Goal (one line):** `hq.policy.yaml` exists as a schema a parser enforces, and a request goes
into `authorizeAction` and a reasoned **`deny` / `propose` / `execute`** comes out — against fakes, with the
hostile corpus green and a hook-interception feasibility matrix that tells Phases 1 and 2 which
surfaces they may rely on.
**Appetite:** 2 days, with **no overrun room** — the REQ-01 kill criterion fires at end of day 2.
The second day is not a buffer that appeared; it is the day the old kill criterion was already
lending this phase, now allocated in the open. Blown appetite means STOP and retro the schema
scope, never a silent extension.
**Depends on:** none

## Why the decision function is in this phase and not Phase 1

The kickoff simulation gate rejected the first draft, which stopped at "schema plus parser". The
reason is worth keeping visible: over half of REQ-01's hostile corpus — symlink and path escape,
mutate-a-guarded-file-via-shell, forged promotion payloads, the un-grantable resource families —
are **runtime authorization** attacks. They need a concrete candidate action evaluated against
policy. A linter that reads glob patterns out of a YAML file has nothing to run them against, so
those fixtures could not have existed and the phase's own exit criteria were unmeetable. The
same gate found that `tests/policy-reducer.bats` would have been **vacuous**, asserting against a
reducer whose implementation was deferred to Phase 1.

So `resolveEffectivePolicy` and `authorizeAction` land here, against fakes, with **no `arc-run`
wiring and no money flow** — those stay in Phase 1. That is what makes this a steel thread
(input → decide → deny → receipt) rather than a parser with tests.

## Exit criteria (Definition of Done)

These exit **together**. A partial Phase 0 is a stopped cycle, not a late one.

- [ ] `hq.policy.yaml` schema defined: closed capability set of exactly 8 (`read`, `write`,
      `shell`, `network`, `message`, `publish`, `deploy`, `spend`) × closed level enum
      `L0|L1|L2|L3`. **`L4` is a parse error**, and the ADR recording the supersession of
      `docs/strategy/arc-full-architecture.md:61,217` (which says L0–L4) is merged.
- [ ] The canonical L0–L3 semantics table lives in `hq.policy.yaml` itself (POL-A: one source of
      truth), not in a doc that describes it.
- [ ] `policy-lint` merged at `.claude/scripts/hq/policy-lint.mjs`, **exit 2 on any violation
      from birth** — it is a validator, not an advisory lint. Zero dependencies, Node ESM.
- [ ] **E2 binding (ADR-0506).** Four rules, and **the scope is BLANKET, not per-item** — this is
      stated explicitly because the two readings give opposite lint verdicts on the same file and
      this is the human-sovereignty guard:

      1. A **missing `e2:` key is a lint error.** Silence is not consent.
      2. **A kind with a non-empty `e2:` may hold NO capability above L1** — all eight, not just
         a capability "corresponding to" the listed item. This is the general rule and it wins
         over any narrower reading. **Consequence: no phrase-to-capability mapping exists or is
         needed**, so "killing a venture" and "changing prices" need no capability of their own.
         A kind that can do any E2 thing is an L1 kind, entirely.
      3. `spend` above L1 is an error **unconditionally**, whatever `e2:` says — the one E2 item
         with an exact capability, made mechanical so it needs no honest declaration.
      4. Because rule 2 is blanket, `publish` or `deploy` above L1 therefore requires **`e2: []`
         exactly** — the empty list. Rule 4 is not an independent constraint; it is rule 2's
         consequence, spelled out because this is where it bites. **Nothing verifies that the
         empty list is true**: this is the model's single unverified human declaration, which is
         why `e2: []` on a kind granted `publish` or `deploy` above L1 needs explicit sign-off in
         the PR description and is a standing REQ-08 attack row.
- [ ] **E2 drift detection (ADR-0506), two ordered checks:** (1) sha256 of the live
      `CONSTITUTION.md` equals the value pinned in `hq.policy.yaml`
      (`233a64961dc0a028ceca6b113405ead699f9185b39342924c32c05f9786b6ee6`) — failure means the
      Constitution changed without a new adoption receipt; (2) **only then** the E2 paragraph is
      parsed and compared element-wise to `ungrantable_actions:`. Ordering is the mechanism: the
      parser is strict over prose, which is safe **only** because check 1 proves the bytes are
      pinned. Both checks read the file **once**, into one buffer — hash that buffer, then parse
      that same buffer, so there is no TOCTOU gap between them. Byte-stability across the
      win32 dev box and the ubuntu CI runners is already guaranteed by `.gitattributes`
      (`* text=auto eol=lf`, repo-wide); verified at kickoff — `CONSTITUTION.md` holds **zero CR
      bytes** here and hashes to exactly the pinned value. **A markdown `-text` override in
      `.gitattributes` would silently break this**, so that file is worth a glance if the hash
      check ever fails on a file nobody edited.
- [ ] **The E2 parse recipe, exactly.** The source text is prose, wrapped mid-clause. In
      `CONSTITUTION.md` it reads:

      ```
      **E2 · Human Sovereignty.**
      Irreversible actions belong to the human alone: moving money, killing a venture,
      changing prices, unlocking real-money trading, publishing under Ashiq's name. No level
      of proven autonomy ever includes these.
      ```

      Recipe: read as UTF-8 (the heading contains U+00B7 `·`); find the line equal to
      `**E2 · Human Sovereignty.**`; take following lines up to the first blank line; join them
      with a single space; match `/belong to the human alone: (.+?)\. No level/`; split the
      capture on `, `. It must yield **exactly five** items — any other count is exit 2, not a
      silent short list. Note the apostrophe in "Ashiq's" is ordinary text here and needs no
      escaping, but it must never be embedded in a single-quoted shell string.
- [ ] **ADR-0502's un-grantable resource list** enforced by **filesystem identity**, not string
      comparison: `fs.statSync(target)` → `dev`+`ino` compared against the same for each guarded
      path. One mechanism catches hardlink, symlink and NTFS junction together, because a
      hardlink has no canonical path for `realpath` to resolve to. Plus
      `fs.realpathSync.native()` to collapse 8.3 short names, a flat rejection of any segment
      matching `~[0-9]`, and case-folded comparison on win32. Applied to every `write` grant
      **and every file-mutating `shell` grant**. **The two no-inode cases are handled
      explicitly, never left to an uncaught throw** — an uncaught throw surfacing as a non-2
      exit is literally one of ADR-0501's fail-open modes: (a) the *target* does not exist yet
      (an ordinary create) → compare the resolved **parent directory's** `dev`+`ino` plus the
      literal basename, so a create at a guarded path is still caught; (b) a *guarded path*
      does not exist in this checkout (`.claude/settings.local.json` is gitignored and often
      absent) → record it once at load time as `guarded-path-absent`, keep enforcing it by
      normalised path string, and never throw from inside `authorizeAction`.
      **The string fallback in case (b) is the only place normalisation is needed**, because
      `dev`+`ino` resolves through the OS and compares no strings at all. There it is, in this
      order: Unicode **NFC** on both sides (NFC and not NFD, so a precomposed path and a
      decomposed one compare equal; not NFKC, which folds visually-distinct characters and would
      make the check over-broad), then `realpathSync.native()` where the parent exists, then
      case-folding on win32 only.
- [ ] Deny-by-default proven by fixture: an action kind absent from the file is read-only at L1.
- [ ] **`resolveEffectivePolicy` implemented** (POL-C), keyed per **(action kind, capability)**
      pair (ADR-0505). Fixtures cover: initial cap = `min(ceiling, L1)`; `policy.level.changed`
      sets the pair's cap to the approved level; `policy.demoted` sets it to
      `max(L0, effective-at-incident − 1)` **for the capability involved only**; the
      **cap-above-ceiling bite**; a same-run double incident; a demotion-versus-promotion race
      resolved by spine append order, never wall-clock; replay determinism.
- [ ] **`authorizeAction` implemented** against fakes, with **every input injected — it reads no
      global state and opens no file of its own**, which is precisely what makes Phase 1 pure
      wiring:

      ```
      authorizeAction(
        { kind, capability, resource },        // the candidate action
        { policy, events }                     // policy = parsed hq.policy.yaml
      ) -> { decision, reason, effective }     // events = ordered event array
      ```

      It calls `resolveEffectivePolicy(kind, capability, { policy, events })` internally for the
      pair's effective level, then applies the bound. In Phase 0 the test harness supplies both;
      in Phase 1 `arc-run` supplies the real file and the real spine. **Two calls with the same
      action and different `events` returning different decisions is the intended behaviour** —
      that is exactly what live-demo steps 6 and 7 demonstrate. No `arc-run` wiring, no provider
      calls, no money flow. This is what the runtime hostile families run against.

      **`decision` is three-valued, not a boolean** — this is forced by the level table and is
      the point of L1 existing at all:

      | effective level | `decision` | meaning |
      |---|---|---|
      | `L0` | `deny` | no call is attempted |
      | `L1` | `propose` | prepare and record the action as a proposal; **never execute it** |
      | `L2` | `execute` if the resource is inside the declared bound, otherwise `deny` | |
      | `L3` | `execute` | |

      A binary allow/deny would collapse L1 into either "deny" (making the birth level useless
      and the whole climb-from-L1 culture dead on arrival) or "allow" (making L1 a lie). Callers
      map `propose` to a proposal receipt; in Phase 0 the fakes just record it.

      **Every pair is born at `min(ceiling, L1)`**, so a freshly-declared kind returns `propose`
      for everything, not `execute` — that is correct and is exactly what "trust is earned"
      means. Reaching `execute` in Phase 0 requires a `policy.level.changed` in the reducer's
      **fixture** event stream; the live spine is not wired until Phase 2.
- [ ] Hash preimages use a **total, type-tagged encoder that refuses** `undefined`, `NaN`,
      `±Infinity`, `BigInt` and cycles rather than coercing them, with a fixture pinning one
      demoted-versus-tampered pair that must not collide (pre-mortem row 4).
- [ ] **Hostile corpus green — every input exits 2 or is denied.** It lives at
      `tests/fixtures/policy/hostile/` with a plain-text `INDEX`, mirroring
      `tests/fixtures/spine/hostile/`. **Two families, and the INDEX says which is which:**
      *static* (fed to `policy-lint`) — unknown kind name, unknown capability, duplicate YAML
      keys, **contradictory grants**, negative / overflow / decimal money, wildcard / IP-literal /
      encoded / private-net domains, missing `e2:`, E2-at-L2, E2-at-L3, `spend`-above-L1, L4,
      **an argv0 absent from `argv0_classes:`**, **an argv0_classes entry listing `shell` in its
      `reproduces`**.

      **"Contradictory grants" means a grant whose declared bound defeats itself or a file-level
      rule**, and it is a lint error rather than something left to the runtime check. The three
      canonical fixtures: (a) `write: { level: L2, roots: ["**"] }` — a root that swallows the
      `ungrantable_resources`, so the file claims to bound a write while granting everything;
      (b) `network: { level: L2, domains: [] }` — bounded execution whose bound admits nothing,
      which is L0 wearing L2's label; (c) a capability at L2 or above on a kind whose `e2:` is
      non-empty, which contradicts the E2 rule from the other direction. Case (a) matters most:
      the runtime identity check would catch the individual write, but a lint that accepts the
      grant leaves the policy file *saying* something false, and the file is the human-readable
      artifact people reason from;
      *runtime* (fed to `authorizeAction`) — shell injection, path traversal, symlink escape,
      NTFS junction and hardlink escape, 8.3 short-name aliasing, case-folding aliasing, unicode
      lookalikes, write-to-settings, write-to-policy-file, delete-a-hook,
      mutate-a-guarded-file-via-shell (`git checkout --`, `sed -i`, redirection), and
      **interpreter-argv0 escape** — `node -e "require('fs').writeFileSync('.claude/settings.json',…)"`,
      which carries no chaining metacharacter and no discrete path argument to `stat`, and is
      blocked only by ADR-0507's derivation rule. (`forged promotion payload` is **not** in this
      phase: `authorizeAction` takes `(kind, capability, resource)` and knows nothing about
      promotion payloads, whose validators land in Phase 2. It is a Phase-2 fixture and a
      REQ-08 attack row.)
- [ ] **ADR-0507's derivation rule, stated as an algorithm** (it is security-load-bearing, so it
      is specified here rather than left to be inferred from the worked example's comments):

      ```
      reproduced = union over p in argv0_allow of argv0_classes[p].reproduces
      "*" expands to the SEVEN non-shell capabilities
      declared(c)      = min( ceiling(c), cap(c) )          # no derivation, for all c
      effective(shell) = min( ceiling(shell), cap(shell),
                              min over c in reproduced of declared(c) )
      effective(c)     = declared(c)                        # every c other than shell
      ```

      Union, then minimum — so mixing `bats` (reproduces nothing) with `node` (reproduces
      everything) gives the same answer as `node` alone: the permissive entry never dilutes the
      restrictive one. An empty `reproduced` applies no extra constraint, so
      `effective(shell) = declared(shell)`.

      **`reproduces` may never contain `shell`, and a table entry that lists it is a lint error.**
      That restriction is what makes the no-cycle property structural rather than a hope: a
      program in `argv0_allow` is *already* exercising `shell`, so naming `shell` in its
      `reproduces` set says nothing while making `effective(shell)` self-referential. Note the
      trap this closes — `npm run` executes arbitrary lifecycle scripts, so the tempting entry is
      `reproduces: ["write","network","shell"]`, which would make the definition recurse into
      itself. The honest classification is that `npm` **is an interpreter**: it runs arbitrary
      programs, so it reproduces everything, and `"*"` already covers it.

      If a future capability gains its own derivation rule, this property must be re-established —
      this sentence is the reminder. An `argv0` absent from `argv0_classes:` is a lint error,
      never an implicit `narrow`.
- [ ] **Unknown kind name is a lint error.** The closed subject set is derived, not guessed:
      every `process:NAME` in `kinds:` must correspond to a `name:` field in some
      `processes/*.process.yaml`, plus the single reserved `session:interactive`. A kind in the
      file with no matching process is exit 2; a process with no kind in the file is the
      **birth-rule WARN** that Phase 3 wires (advisory, not this phase's error).
- [ ] **Hook-interception feasibility matrix** delivered, **generated from `.mcp.json`** (not
      hand-listed): one row per side-effect tool class across the four declared servers —
      `stripe`, `supabase`, `playwright`, `context7`, roughly 40 tool rows — plus every built-in
      side-effect tool class. Each row carries either a fixture proving intercept-and-block, or
      an assigned fail-closed fallback. **A server present in `.mcp.json` with no row is an exit
      failure.** "Hook later" is not a state (POL-H, ADR-0503).
- [ ] Each of ADR-0501's four claimed **fail-open modes is independently fixture-proven**: exit
      1 or 3-255, missing hook script, malformed JSON on exit 0, and timeout — the timeout case
      against a deliberately short configured timeout, never the 10-minute default. A mode that
      cannot be tested is recorded as still-an-assumption in the exit note, never folded into the
      matrix as proven.
- [ ] The deny-floor assignments from ADR-0501 are decided and written down: which classes get a
      static `permissions.deny` rule as well as a hook fragment (`spend`, `deploy`, `publish`,
      and every E2-adjacent action at minimum). **Written down here, installed in Phase 2.**
- [ ] Code homes match ADR-0500: library under `.claude/scripts/hq/lib/policy/`, lint at
      `.claude/scripts/hq/policy-lint.mjs`. No `products/policy` is created.
- [ ] Tests added and green **on CI** (per-job conclusions read, never the run-level tick).
- [ ] Adversarial pass: **two fresh agents on different surfaces** — one on the decision logic
      (schema, reducer, E2 handling, `authorizeAction`), one on the shell/OS boundary (path
      identity, YAML parsing, injection). Every hole found is fixed and pinned as a fixture.
- [ ] `tests/fixtures/sync-golden/tree-manifest.txt` regenerated if any synced file was added or
      changed, diff-checked so only the intended paths moved.
- [ ] Tracker updated (`initiatives/policy/PROGRESS.md` row ✅ + done-log) and the phase-close
      receipt emitted to the spine.

## The schema this phase implements — decided, not to be invented

Everything below is **already decided**. Phase 0 implements it; it does not design it.

### Subjects, verbs, instruments (ADR-0504)

- **Subject** = the *action kind*, the thing that holds authority. Two closed namespaces:
  `process:NAME` (one per `processes/*.process.yaml` `name:` field, so the set is a directory
  listing) and the single reserved `session:interactive`.
- **Verb** = one of the 8 capabilities. **Authority is keyed on the (subject, verb) pair**
  everywhere — ceiling, cap, effective, both transition events, the reducer (ADR-0505).
- **Instrument** = a tool (`Bash`, `Write`, `mcp__stripe__create_payment`). A tool is *mapped* to
  a capability by the feasibility matrix. **A tool never gets a level of its own** — that would
  collapse the model into a per-tool allowlist.

### The four levels — canonical, and this table goes into `hq.policy.yaml` itself

| Level | Meaning | Notes |
|---|---|---|
| `L0` | **Denied.** The capability is unavailable; no call is attempted. | |
| `L1` | **Propose.** The action may be prepared and recorded as a proposal; never executed. | **Birth level for every pair** — `min(ceiling, L1)` with no events. "Starts WARN/L1 and climbs." |
| `L2` | **Bounded execute.** Runs only inside the resource bound declared in the same grant. | A grant at L2 with **no bound** is a `policy-lint` error. That is what distinguishes L2 from L3. |
| `L3` | **Unbounded within the capability.** No per-resource bound; still confined to that capability. | Reachable only through a human `policy.level.changed` citing trial-ledger evidence. **Never on a kind with a non-empty `e2:`.** |

`L4` is a parse error (superseding `docs/strategy/arc-full-architecture.md:61,217`).

### Resource grammar, per capability

| Capability | Bound key at L2 | Grammar |
|---|---|---|
| `read` | none | read needs no bound; it is the deny-by-default floor |
| `write` | `roots` | list of POSIX-relative globs. No absolute path, no `..`, no backslash — reuse the existing `assertPathShape` rules in `validate.mjs`. Checked against the un-grantable resources by **filesystem identity at authorize time**, not by string prefix |
| `shell` | `argv0_allow` | closed list of program names. A command containing a chaining metacharacter (`;`, `&&`, `\|\|`, backtick, `$(`) is rejected outright — argv0-checking a chained command is theatre. **Every entry must appear in the top-level `argv0_classes:` table; an unclassified program is a lint error** (deny-by-default applied to the allowlist itself), and ADR-0507's derivation rule caps `effective(shell)` at the minimum of every capability its programs can reproduce |
| `network` | `domains` | **exact hostnames only.** No wildcards, no IP literals, no encoded forms, no private ranges. Each of those is a hostile-corpus row |
| `spend` | `cap` | `{ amount: integer minor units, currency: ISO-4217, window: daily }`. Reuse the existing `REVENUE_KINDS` money validator rather than writing a second one. **Never above L1 in v1** |
| `message`, `publish`, `deploy` | `targets` | closed enum of destination ids declared at the top level of the file under `targets:`. An empty `targets` at L2 is a lint error. Minimal by design (rabbit hole: perfect resource grammar) |

### `hq.policy.yaml` — worked example, valid against the above

```yaml
version: 1

constitution:
  version: "1.0"
  sha256: "233a64961dc0a028ceca6b113405ead699f9185b39342924c32c05f9786b6ee6"
  receipt: "01KZ9V0QXNNMB3ZH18MSH8DKH3"

levels:
  L0: "denied -- the capability is unavailable; no call is attempted"
  L1: "propose -- prepared and recorded, never executed; birth level for every pair"
  L2: "bounded -- executes only within the bound declared in this grant"
  L3: "unbounded within the capability; human-granted only; never on a kind with a non-empty e2"

# Parsed out of CONSTITUTION.md and compared element-wise, AFTER the sha256 above is verified.
ungrantable_actions:
  - "moving money"
  - "killing a venture"
  - "changing prices"
  - "unlocking real-money trading"
  - "publishing under Ashiq's name"

# ADR-0502. Excluded from every write grant AND every file-mutating shell grant, at every
# level, by filesystem identity rather than string comparison.
ungrantable_resources:
  - ".claude/settings.json"
  - ".claude/settings.local.json"
  - ".claude/hooks/**"
  - "hq.policy.yaml"

targets:
  message: []
  publish: []
  deploy: []

# ADR-0507. What each permitted program can REPRODUCE. An argv0 in a kind's allowlist
# but absent from this table is a lint error -- deny-by-default applied to the allowlist.
argv0_classes:
  # "*" = the seven non-shell capabilities. `shell` may never appear in a reproduces
  # list -- see the derivation-rule bullet in the exit criteria for why.
  node:   { class: interpreter, reproduces: ["*"] }
  python: { class: interpreter, reproduces: ["*"] }
  bash:   { class: interpreter, reproduces: ["*"] }
  sh:     { class: interpreter, reproduces: ["*"] }
  npm:    { class: interpreter, reproduces: ["*"] }   # `npm run` executes arbitrary scripts
  git:    { class: vcs,         reproduces: ["write", "network"] }
  gh:     { class: vcs,         reproduces: ["write", "network"] }
  curl:   { class: fetcher,     reproduces: ["network"] }
  bats:   { class: narrow,      reproduces: [] }
  jq:     { class: narrow,      reproduces: [] }

kinds:
  "process:kickoff-plan":
    e2: []                                  # mandatory; empty means "performs no E2 action"
    read:    { level: L3 }
    write:   { level: L2, roots: ["initiatives/**", "docs/adr/**"] }
    # DELIBERATELY the awkward case -- this example shows ADR-0507's rule BITING.
    # node is an interpreter, so effective(shell) = min over the seven non-shell
    # capabilities = network's L0.
    # This kind cannot run node at all, which is correct: for a kind with write:L2 and
    # network:L0, running node IS an unbounded write and an unbounded network call.
    # To actually run node here, the network grant must rise -- honestly, in a diff.
    shell:   { level: L2, argv0_allow: ["git", "node", "bats"] }
    network: { level: L0 }
    message: { level: L0 }
    publish: { level: L0 }
    deploy:  { level: L0 }
    spend:   { level: L0 }

  "process:lint-only":
    e2: []
    read:    { level: L3 }
    write:   { level: L0 }
    # Every argv0 here is `narrow`, so nothing is reproduced and effective(shell) = L2.
    shell:   { level: L2, argv0_allow: ["bats", "jq"] }
    network: { level: L0 }
    message: { level: L0 }
    publish: { level: L0 }
    deploy:  { level: L0 }
    spend:   { level: L0 }
```

**The two kinds above are illustrative.** The `hq.policy.yaml` actually committed at Phase-0
close contains only kinds whose names resolve — a `process:NAME` for each real
`processes/*.process.yaml`, plus `session:interactive` — because the unknown-kind-name check
below would otherwise fail the repo's own file. `kinds: {}` is valid and is the honest starting
point if no process is ready to be granted anything yet.

A kind absent from `kinds:` is **read-only at L1** and nothing else (POL-B). An absent capability
inside a present kind is `L0`. Unknown top-level keys, unknown capability names, unknown level
strings and a missing `e2:` are all hard errors.

### The four new event payloads — specified here, emitted in Phase 2

Closed shapes, unknown keys rejected, keys authored **sorted** (`tests/spine-emit.bats`
round-trips every ACCEPT fixture byte-for-byte through `canonicalize()`).

| Kind | Payload keys |
|---|---|
| `policy.level.changed` | `action_kind`, `capability`, `correlation`, `decision_ref`, `from_level`, `policy_hash`, `to_level`, `trial_ledger_ref` |
| `policy.demoted` | `action_kind`, `capability`, `correlation`, `from_level`, `incident_ref`, `policy_hash`, `to_level` |
| `spend.reserved` | `action_kind`, `amount`, `correlation`, `currency`, `idempotency_key`, `policy_hash`, `window` |
| `spend.released` | `correlation`, `policy_hash`, `reason`, `reservation_ref` |

`capability` is present on both transition kinds because authority is keyed on the pair
(ADR-0505). **The two kinds POL-E reuses are `approval.requested`** (under the strict
`policy.promotion` payload profile, which also carries `capability`) **and `cost.incurred`**
(settlement profile). Evolve's `promotion.proposed` is never touched.

### Reducer fixture format

One fixture = a JSONL event stream plus an expected result. Each line of
`tests/fixtures/policy/reducer/NN-name.jsonl` is one event, carrying the subset of the spine
envelope the reducer actually reads — `id`, `kind`, `ts`, `payload`:

```json
{"id":"01KZ9V0QXNNMB3ZH18MSH8DKH3","kind":"policy.level.changed","ts":"2026-08-06T10:00:00+05:30","payload":{"action_kind":"process:demo","capability":"write","correlation":"r-demo","decision_ref":"01KZ9V0QXNNMB3ZH18MSH8DKH4","from_level":"L1","policy_hash":"0000…","to_level":"L2","trial_ledger_ref":"docs/trial-ledger.md#demo"}}
```

**Line order IS spine append order, and it is the only ordering the reducer may use.** `ts` is
carried for human readability and must never be sorted on — that is the documented tie-break for
the demotion-versus-promotion race, and a reducer that sorts by timestamp fails that fixture.
`tests/fixtures/policy/demo-events.jsonl` is the same format: one line, raising
`(process:demo, write)` to L2.

The expected result lives in `NN-name.expected.json`:

```json
{ "action_kind": "process:kickoff-plan", "capability": "write",
  "ceiling": "L2", "cap": "L1", "effective": "L1" }
```

The expected file may hold an array when one stream pins several pairs at once — which is how
the "a network incident does not demote write" case is asserted.

### Feasibility matrix artifact

`.claude/scripts/hq/policy-matrix.mjs --from .mcp.json` writes
`initiatives/policy/evidence/phase-00/hook-matrix.json` — an array of rows:

```json
{ "surface": "mcp", "server": "stripe", "tool": "mcp__stripe__create_payment",
  "capability": "spend", "verdict": "static-deny",
  "fixture": "tests/policy-hook-matrix.bats:stripe payment is blocked" }
```

`verdict` is one of `intercepted` (a fixture proves the hook blocks it), `static-deny` (assigned
a `permissions.deny` rule), or `capped-l1` (POL-G: the surface may not exceed L1). **`null` is
not a value** — the script exits 2 if any row has no verdict, or if any server named in
`.mcp.json` produced zero rows. A sibling `hook-matrix.md` renders the same data for humans; the
JSON is what the tests assert against.

**Tool-to-capability mapping is a committed table, not a heuristic.** A tool may map to more
than one capability (`supabase` spans `write` and `deploy`; `playwright` spans `network` and
`shell`), so a row's `capability` is a list. The table lives at
`.claude/scripts/hq/lib/policy/tool-capabilities.json`, seeded by rule:

| Rule | Capabilities |
|---|---|
| tool name matches `create|update|insert|delete|upsert|write|apply_migration` | `write` |
| matches `deploy|publish|release|branch|merge` | `deploy` |
| matches `payment|charge|refund|price|customer|subscription|invoice|payout` | `spend` (and E2) |
| matches `send|message|post|comment|email` | `message` |
| matches `navigate|fetch|search|query|get|list|read` | `network` if it leaves the machine, else `read` |
| anything a rule does not match | **no default** — the row is emitted with `capability: []` and the script exits 2 |

The no-default line is the whole point: an unclassified tool is a build failure, so a new MCP
tool cannot quietly enter the system as harmless. That mirrors `argv0_classes:` (ADR-0507) —
deny-by-default applied to classification itself, in both places, for the same reason.

### How a bats test fires a real PreToolUse hook

The contract already exists in `.claude/hooks/_dispatch.sh` and is used as-is:

```bash
printf '%s' '{"tool_name":"Bash","tool_input":{"command":"rm -rf /"}}' \
  | bash .claude/hooks/PreToolUse.sh
```

Fragments receive the payload on **stdin**, `ARC_HOOK_PAYLOAD` points at a temp copy, fragments
run in lexical `NN-` order, and **the first `exit 2` blocks and stops the chain**. Isolation for
tests comes from `CLAUDE_PROJECT_DIR`: `arc_dispatch` resolves its fragment directory from that
variable, so a test points it at a fixture tree and installs whatever fragments it needs without
touching the repo's real hooks.

The four fail-open fixtures are built the same way — a fragment that exits 1 or 7, a fragment
path that does not exist, non-JSON on stdin, and a sleeping fragment against a deliberately short
configured timeout. **Note the corroboration:** `_dispatch.sh`'s own comment already states
`any other exit is ignored, fail-open`, and `PreToolUse.sh` exits 0 with a warning when the
dispatcher is missing. ADR-0501 was written from platform documentation; this repo's own code
says the same thing. The fixtures confirm it rather than discover it.

## Verification plan

- **Test command:** `bats tests/policy-lint.bats tests/policy-hostile.bats tests/policy-reducer.bats tests/policy-authorize.bats tests/policy-hook-matrix.bats`
  — one file at a time in the foreground on this box; **CI is the gate**
  (`.claude/rules/testing.md`). **One scope line per file, so nothing is written twice or
  nowhere:** `policy-lint.bats` = the schema rules on hand-written inline YAML (closed sets, L4,
  `e2:` rules, both E2 drift checks, `argv0_classes:`); `policy-hostile.bats` = the **corpus
  driver only** — it walks `tests/fixtures/policy/hostile/INDEX`, routes each fixture to
  `policy-lint` or `authorizeAction` by its declared family, and asserts the recorded outcome,
  so adding a fixture needs no new test code; `policy-reducer.bats` = event streams to effective
  levels; `policy-authorize.bats` = the decision function's own behaviour, including the real
  filesystem objects (hardlink, junction, 8.3); `policy-hook-matrix.bats` = real PreToolUse
  dispatch, the generated matrix, and the four fail-open modes.
- **Expected failure first:** `bats tests/policy-lint.bats` fails on its first case,
  `@test "policy-lint exits 2 when a capability is granted L4"`, with
  `node: cannot find module '.claude/scripts/hq/policy-lint.mjs'` and status `127` — neither the
  lint nor `hq.policy.yaml` exists yet. The second red is the one that matters more:
  `bats tests/policy-authorize.bats` fails on
  `@test "authorizeAction denies a write to a hardlink of settings.json"` because
  `authorizeAction` does not exist, and that test is **not** vacuous once it does — it creates a
  real hardlink in a temp tree and asserts the deny, so it can only pass if the identity check
  ran. Each file asserts its own registered test count from `BATS_TEST_NAMES`, and all `@test`
  names are ASCII-only, because bats silently drops a non-ASCII test name (five tests once
  vanished behind a green file, visible only as a shrinking CI count).
- **Live demo scenario:** (1) `node .claude/scripts/hq/policy-lint.mjs hq.policy.yaml` on the
  committed file → exit 0, prints the derived kind × capability × level table. (2) Copy it,
  change one grant to `L4` → exit 2 naming the kind, capability and closed enum. (3) Copy it,
  delete a kind's `e2:` line → exit 2 ("silence is not consent"). (4) Copy it, set
  `e2: ["moving money"]` and any capability to L2 → exit 2 quoting the constitutional clause.
  (5) Edit one character of `CONSTITUTION.md` → exit 2 on the **hash** check, naming the missing
  adoption receipt, before the parse is even attempted.
  **Steps 6-9 run against a committed demo pair — `tests/fixtures/policy/demo.yaml` plus the
  event stream `tests/fixtures/policy/demo-events.jsonl` — not the repo's real
  `hq.policy.yaml`**, which grants only kinds resolving to actual processes and may legitimately
  be `kinds: {}` at Phase-0 close. The demo policy carries `process:demo` with `e2: []`,
  `write: { level: L2, roots: ["tmp/**"] }`, `shell: { level: L2, argv0_allow: ["node","bats"] }`,
  `network: { level: L0 }` and everything else omitted (so L0). The event stream carries one
  `policy.level.changed` raising `(process:demo, write)` to L2 — **without it every pair sits at
  its birth cap of L1 and returns `propose`, which is the correct default and is itself
  demonstrated in step 6.**
  (6) `authorizeAction({kind:"process:demo", capability:"write", resource:"tmp/x"})` against an
  **empty** event stream → `propose`, effective L1 — the born-at-L1 rule, visible.
  (7) The same call against `demo-events.jsonl` → **`execute`**. Then the same call with
  `resource` set to a **hardlink** of `.claude/settings.json` → **`deny`**, the reason naming the
  un-grantable resource it resolved to by inode, even though the path string matches no guarded
  entry.
  (8) `authorizeAction({kind:"process:demo", capability:"shell", resource:"node -e ..."})` →
  **`deny`** — `node` is an interpreter, so `effective(shell)` is capped at `network`'s L0. Swap
  the allowlist to `["bats"]`, re-run → `execute`. That pair is ADR-0507 demonstrated in two
  commands, and it is the bypass an adversarial pass found in this schema's first draft.
  (9) `node .claude/scripts/hq/policy-matrix.mjs --from .mcp.json` → prints the matrix and exits
  2 if any declared server has no row.
- **Real-system check:** the feasibility matrix and the four fail-open fixtures run against
  **actual PreToolUse dispatch** through `.claude/hooks/PreToolUse.sh`, not a mock, isolated by
  `CLAUDE_PROJECT_DIR`. The hardlink, junction and 8.3 fixtures create **real filesystem
  objects** in a temp tree — a string-only test of a filesystem-identity check would be the
  vacuous pass this phase is specifically guarding against. No provider, MCP server or network
  endpoint is ever called for real.
- **Expected evidence:** CI job output for the five bats files; `hook-matrix.json` and its
  rendered `.md` committed under `initiatives/policy/evidence/phase-00/`; the hostile corpus
  `INDEX` with one row per family, its class (static or runtime) and its expected outcome; the
  two adversarial agents' findings lists with each hole's regression fixture named.

## Pre-planned cuts, in order — decided now, not at 6pm on day 2

Three independent verification passes (one attacker, two simulation rounds) judged this phase
over-full for 2 days. That is a managed risk only if the cut order is decided in advance, so it
is. When the appetite is going, cut **in this order**, and record which cuts were taken in the
phase-close note:

1. **The feasibility matrix's "every built-in side-effect tool class" scope** narrows to the two
   matchers that exist today (`Bash`, `Edit|Write`) plus the four `.mcp.json` servers. The
   built-in classes with no current matcher become `capped-l1` rows rather than fixtures.
2. **`message` / `publish` / `deploy` resource grammars** drop to a schema slot with an empty
   `targets` enum and a lint error on any level above L0. They have no live consumer, so this
   costs nothing real (see the rabbit hole).
3. **The unicode-lookalike and case-folding hostile families** move to Phase 4's attack list.
   They are genuine, but they are variants of an escape class whose primary form
   (hardlink/junction/traversal) is already fixture-covered here. **If this cut is taken, the
   "hostile corpus green" exit criterion is satisfied without those two fixture families** — the
   underlying mechanisms (win32 case-folded comparison, UTF-8 normalisation) stay required by the
   never-cut list below, so what is deferred is the *fixture*, never the *behaviour*. Record the
   deferral in the phase-close note so Phase 4 inherits it as an obligation rather than a
   forgotten intention.

**Never cut:** `policy-lint` failing from birth · both E2 checks · the un-grantable resource
enforcement **including the NFC-then-case-fold string fallback defined in its exit criterion**
(that mechanism is what cut 3 defers *fixtures* for, never the behaviour) · ADR-0507's
derivation rule · `authorizeAction` returning a reasoned deny · the two-surface adversarial pass. Those are the phase. If they cannot be reached by end of day 2,
the kill criterion fires and the cycle stops — that is the criterion working, not failing.

## Rabbit holes in this phase

- **Perfect resource grammar.** Write grammars only for capabilities with live consumers — write
  roots, shell allowlist, network domains, spend caps. `message`, `publish` and `deploy` get
  schema slots and minimal enums, nothing more.
- **Chasing the MCP surface.** The matrix is generated from `.mcp.json` and stops there
  (ADR-0503). A connector someone happens to have authenticated is not in scope.
- **Building the money flow.** `authorizeAction` lands here; `reserveSpend` does not. `spend` is
  never above L1 in v1, so the decision function's `spend` branch is a denial, not a ledger.
- **Wiring into `arc-run`.** Explicitly Phase 1. The temptation once `authorizeAction` works is
  to "just call it" — that call site needs the bypass fixture matrix around it, which is a
  Phase-1 deliverable, and a wire without those fixtures is exactly the untested enforcement
  point pre-mortem row 2 is about.
- **A YAML parser of our own.** Zero-dependency is a constraint (A2), but hand-rolling full YAML
  is a cycle in itself. Support the narrowest subset the schema needs and make everything outside
  it a parse error — which is also the security-correct answer. **But note that duplicate keys
  are INSIDE the subset, not outside it, so "everything outside is an error" does not catch them
  for free.** A parser built the obvious way — assign into a plain object as lines are read —
  lets the last occurrence win by ordinary JS semantics, which for this schema is a live
  escalation path: a second, more permissive `write:` or `e2:` block for the same kind silently
  overrides an earlier, stricter one, with no error. The parser must track seen keys **per
  mapping** and hard-error on a repeat *before* the second value is assigned. That is what the
  `duplicate YAML keys` hostile fixture actually tests.

## Out of scope for this phase

`arc-run` wiring and the capability fixture matrix around that call site (Phase 1) · the
reservation flow, `reserveSpend` and the double-spend fixtures (Phase 1) · the four new spine
event kinds and their vocabulary ADR (Phase 2 — their payload *shapes* are specified here, none
are emitted) · installing hook fragments and writing the static deny rules into
`.claude/settings.json` (Phase 2 — this phase decides *which* classes get them and proves the
matrix) · the birth-rule lint and cap inventory (Phase 3) · the adversarial security pass over
the whole engine (Phase 4 — the two-surface pass here covers Phase 0's own artifacts only).

## Your-setup / pending

Nothing. Zero-dependency Node, bash and bats are already installed; every external surface in
this phase is a recording fake, and no key, account or provider budget is needed. The hardlink
and junction fixtures need no elevated privilege on Windows — that is precisely why they are a
threat and why they are tested.

## Non-negotiables (verbatim from PLAN)

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
