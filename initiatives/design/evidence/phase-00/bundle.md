# Phase 00 — renderer proof + isolation · evidence bundle

**REQ-01** — two renders never collide, and iteration history survives.
**Closed:** 2026-08-23 · **Appetite:** 1.5d · **Branch:** `feat/arc-design-v2-c16` · **PR:** #222

## The verdict

`arc-ci` run **32655931704**, head SHA `40bbc2be6f8a113a353ab32ac8e82afe1f76e01b`, confirmed
equal to the branch tip. **19 of 19 jobs `success`**, read **per JOB** — ubuntu 18/20/22, macOS
3 shards, Windows 12 shards. The run conclusion was not taken from a watcher exit code; that has
returned 0 over a failing run in this repo before.

Tests **490–509** in `tests/design-render-session.bats`, a contiguous block with no gaps, every
one `ok`. The count was checked because bats silently drops a `@test` whose name contains a
non-ASCII character — five such tests once never ran and never failed, and the file was green.

## Red before green — the assertion proves the code runs

Run **32653287707** on `feat/design-p00-red`, the tests-only commit `ef0ec846`, read per JOB:

```
not ok 490 render_requires_session_in_explore_mode
not ok 491 session_less_meta_is_refused
```

...plus eight more, failing for exactly the stated reasons: `--mode explore` was swallowed by a
catch-all, the output path was keyed on the route alone, and the guard had no session field to
miss. The tests were committed **alone**, ahead of any implementation, so the red is a fact in
git history rather than a claim. A test green from birth proves nothing about the code it names;
this repo has shipped that three times, twice inside suites written to prevent it.

## Exit criteria

| Criterion | Evidence |
|---|---|
| `--session` mandatory in explore mode, refusing with a named message, never defaulting | `render_requires_session_in_explore_mode` |
| Critique path keeps its named session, isolation preserved | `default mode is critique and defaults the session…` — the `design-critic` literal is unchanged |
| 3 concurrent renders → 3 correct route/hash pairs | `3 concurrent renders…, 5 times running` — repeated 5×, each child's exit status read individually |
| Each render drove the browser with its OWN session | `each concurrent render actually drove the browser with its OWN session` — the fake records them; without this the acceptance measured path scoping only and could not fail |
| Meta carries `session`; guard discriminates on (route, session) | `meta carries session, iter and unchanged…` + the three case tests |
| A meta with an absent `session` refuses, never falls through | `session_less_meta_is_refused`, fixture at the **flat** path production actually produces |
| Same-route, same-session repeat records `unchanged: true`, not deleted | `iter-unchanged: …` |
| Stable-shutter guard re-proved per platform | `the same route hashes identically across 3 runs on this platform`, green on all three OS legs |
| Callers located mechanically and reconciled | `git grep -l` → `design-critique.sh`, `design-explore.sh`. **Zero invocation changes needed**, as the spec predicted, because `--mode` defaults to critique. But `design-critique.sh` **READS** the output path — the twin was in consumption, not invocation. |
| Sibling route-based comparators swept | `git grep -n route` across `design-critique.sh`, `design-gate.sh`, `critic-scope-check.sh` — **confirmed absent**; none does staleness matching |
| Two-surface adversarial pass by fresh agents | [`adversarial-logic.md`](adversarial-logic.md) · [`adversarial-shell.md`](adversarial-shell.md) — 26 findings, 22 fixed, 4 explicitly accepted |
| Tests green on CI per JOB at the branch head SHA | run 32655931704, above |

## The live demo

The concurrency scenario **is** Phase 00's demo, and it ran on all three OS legs rather than once
by hand: three routes, three sessions, launched concurrently, five rounds, with each background
job's status read individually and the resulting metas asserted for correct route/hash pairing.
No local run was performed — local test runs are forbidden here, and a green run on this box
would prove nothing about the matrix that actually gates. What the OS legs caught that a local
run could not is recorded below.

## What CI found that neither attacker did

Three failures, all invisible on the authoring box:

1. **`[!a-z0-9-]` on the session id** — a bracket range resolves through the locale collation
   table, which on macOS interleaves case, so `Design` is accepted on one OS and refused on the
   others, then collides with `design` on a case-insensitive filesystem. The session id becomes
   a **directory name**, exactly like the explore id whose comment in `design-explore.sh:37`
   documents this same defect — two files away from where I rewrote it.
2. **`tests/portability.bats` keys its allowlist on `path:lineno`** and every entry shifted.
3. **`tests/portfolio-board.bats` asserted the design lane is IDLE** and holds no `archive/` or
   `evidence/` directory. Cycle 16 makes it LIVE, ADR-0055 *requires* lane-scoped evidence, and
   `HISTORY-INDEX.md` says a lane archive holds post-portfolio cycles. Those tests pinned one
   lane's transient state as an invariant; they assert the rule now.

## What the phase changed

`design-render.sh` — `--mode explore|critique` (default critique, so no caller changed),
`--session` mandatory in explore, `--iter N`, session-scoped output paths, a three-case
`(route, session)` duplicate guard walking both directory depths, parsed meta reads, arity
guards on every value-taking flag, and fail-closed handling for absent sessions, unreadable
metas and unescapable routes.
`design-critique.sh` — reads the session-scoped path, and refuses to forward the three flags
that would move the renderer's write path out from under it.
`tests/fixtures/design/fake-agent-browser.sh` — records the sessions it is given, so session
isolation is observable.

## Honest limits

- `_slug()` remains non-injective; a collision now **refuses** rather than overwriting, which
  closes the data-loss path but not the collision itself.
- Three pre-existing shell-boundary findings are accepted rather than fixed, each recorded with
  its reason in `adversarial-shell.md`.
- The `unchanged` signal is proven mechanically. Whether a composer *acts* on it is Phase 01's
  question and nothing here claims it.
