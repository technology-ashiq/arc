# Phase 06 — `@venture` hosts + `apply --next/--all`; the first real venture moves (Cycle 2 steel thread)

**Goal (one line):** On merged `main`, `myfitfolio`'s `frontend` verifies live, because its adapters can now reach
`myfitfolio.com`, and only that. The owner walks the board with one command.
**Appetite:** 2.5 days (2026-10-19 → 2026-10-21). Blown → cut REQ-14's live transcript first (PLAN cut order).
**Depends on:** phase-00

## Exit criteria (Definition of Done)
- [ ] `lib/ctx.mjs` resolves `@venture` from the profile's `brand.domain` exactly per ADR-1765: whole-entry token only,
      lower-cased, fail-closed `VENTURE_HOST_UNRESOLVED` / `VENTURE_HOST_COLLIDES`
- [ ] the 19 `sandbox.automemory.ai` literals in `products/launch/launch.providers.yaml` become `@venture`; 0 `digest:`,
      `vetted_by:`, `approved_by:` or `scout:` lines change (`git diff` shows only `hosts` entries)
- [ ] every other reader of a row's `hosts` (grep `\.hosts\b` across `.claude/scripts/launch/**` and
      `products/launch/providers/**`) resolves through the same function, or the PR names why it needs no resolution;
      the pattern is added to `initiatives/launch/fixed-defects.md`; `evidence/phase-06/` holds a table that lists, for
      each `@venture` row, every hostname its adapter fetches (grep `ctx.fetch`, URL literals, `new URL`), and any host
      outside `{brand.domain subtree} ∪ the row's other literals` fires ADR-1765's revisit trigger before the PR
- [ ] the public-suffix and collision checks run in `ctx` and in `launch-lint` over the registry and every profile
- [ ] day 1: `myfitfolio.venture.yaml` read once; every core slot's `required_when` evaluated and the count written to
      PROGRESS (34 expected: `tenancy: multi`, `payment_model: gateway`); `verify --all` run once on today's board and
      once on a fixture board with one ABSENT slot, and the exit codes differ (REQ-20's tool proven before Phase 07)
- [ ] `launch-lint` accepts `@venture` as a whole entry and its self-test refuses the 4 mutants `@venture.evil.com`,
      `x.@venture`, `@VENTURE`, and a duplicated token
- [ ] `apply --next` and `apply --all` per ADR-1767: core slots only, the state table pinned by fixtures; `apply SLOT`
      output byte-identical to Cycle 1
- [ ] F5 (owner UX, `/arc-change` 2026-10-20): the walk prints `→ [i/n] applying {slot} via {provider}` before each
      slot, `· [i/n] {slot}: {state} -- passed over` per slot it skips, and a closing `walk summary: {v} verified · {a}
      applied · {s} skipped · stopped at {slot|none}`; the `walk complete:` and `stopped at` lines stay byte-stable
      (fixtures in `tests/launch-cli.bats`)
- [ ] sync golden regenerated in this worktree only, with untracked files filtered out (`git ls-files --others
      --exclude-standard`), never from the main clone; the `tree-manifest.txt` diff shows no `myfitfolio.venture.yaml`
      row; `docs/wiki` regenerated for ADR-1765..1769; on a conflict in either file, regenerate on the merged tree and run
      `--check`, never hand-merge; before the final push, merge `origin/main` and regenerate again (strict up-to-date)
- [ ] two-surface `/arc-attack` on the local commit (1 round), findings fixed, then one push; CI green per job
      (`ci-digest.mjs`)
- [ ] PR 1 (code) merged green per job; then in the MAIN clone (`cd E:/Work_Hub/01_Automemory/arc && git pull`):
      `apply frontend --venture myfitfolio` exits 0 with `honesty_class: real` (A-15 fires → moved to Phase 07), then the
      `apply --all` transcript
- [ ] PR 2 (close, small) carries `evidence/phase-06/`, the PROGRESS row ✅ and done-log; `/arc-phase-done 06` runs
      there, and it merges before Phase 07 starts

## Contract + commands (the executor's reference; ADR-1765, ADR-1767)

**Host token.** `VENTURE_HOST_UNRESOLVED` and `VENTURE_HOST_COLLIDES` are reasons carried by a `HOST_REFUSED` refusal
(`refusal("HOST_REFUSED", ..., { reason })`), never codes of their own.
- Shared namespace = a new module `.claude/scripts/launch/lib/public-suffixes.mjs`, imported by both `ctx.mjs` and
  `launch-lint.mjs`. It exports (a) the multi-tenant suffixes `vercel.app`, `github.io`, `pages.dev`, `netlify.app`,
  `web.app`, `herokuapp.com`, `workers.dev`, `supabase.co`; and (b) the rule that a 2-label name whose first label is
  one of `co com net org gov ac edu` under a 2-letter TLD (`co.uk`, `co.in`) is a suffix. A `brand.domain` that equals
  an entry, or is a 2-label (b)-suffix, is UNRESOLVED. This is not a full PSL. ADR-1765 is amended to name this module.
- COLLIDES = the case-folded `brand.domain` equals, is a parent of, or is a subdomain of any literal entry in any
  registry row's `hosts[]`. `github.com` collides because it is the parent of `api.github.com`. After the change,
  `sandbox.automemory.ai` is no row's literal, so `arc-sandbox` does not collide.

**Walk.** `apply --next` = apply the first core slot in `topoOrder` that the state table does not pass over, then exit
with that slot's code. `apply --all` = repeat `--next` until a non-zero exit or nothing is left. `--again` is Cycle 1's
existing flag (re-apply a verified, ungated slot), and combining it with `--next` or `--all` exits 2 with
`--again takes one SLOT`. The stop line's `{reason}` is the refusal or failure reason the slot already prints. Exits
1-5 are injected through the existing fixture adapter in `tests/launch/make-fixture.mjs`, extended with a per-slot
forced exit. "Byte-identical to Cycle 1" = the existing `apply probe` cases in `tests/launch-cli.bats` pass unedited:
the diff touches none of their lines.

**Resolver mutants.** Two env-free copies, built by the test into `$BATS_TEST_TMPDIR` (a `ctx.mjs` whose resolver
returns the token unchanged, and one that skips lower-casing). The suite runs the 19-row and `@VENTURE` cases against
each copy and asserts they fail.

**Red first.** CI is the only runner, and each PR gets one push. Red-first is shown two ways: the tests commit comes
before the implementation commit in the PR's history, and the two mutants are red on CI in the same run.

**Generators** (in this worktree, never the main clone):
- Wiki: `node .claude/scripts/docs/wiki-build.mjs`, then `node .claude/scripts/docs/wiki-build.mjs --check`.
- Sync golden:
  `export BATS_TEST_DIRNAME="$PWD/tests"; source tests/test_helper.bash; T="$(mktemp -d)"; mkdir -p "$T/.git"; bash sync-to-project.sh "$T" >/dev/null 2>&1; _arc_tree_manifest "$T" > "$T.golden"`.
  Diff it against `tests/fixtures/sync-golden/tree-manifest.txt`, drop any row whose path appears in
  `git ls-files --others --exclude-standard`, then copy it over.
- `products/launch/manifest.json` needs no change, because `public-suffixes.mjs` sits under `.claude/`. The golden
  carries it.

**Key probes** (agent-run in the main clone, read-only `curl` GETs; values come from the env and are never echoed).
Each result goes into PROGRESS as one line, `probe {service}: pass|fail {http status}`.

| Service | Call | Pass |
|---|---|---|
| Cloudflare | `GET api.cloudflare.com/client/v4/zones?name=myfitfolio.com` | 200, exactly 1 result |
| Resend | `GET api.resend.com/domains` | 200 |
| Supabase | `GET api.supabase.com/v1/projects` | 200 |
| Razorpay test | `GET api.razorpay.com/v1/orders?count=1` (test key) | 200 |
| Vercel | `GET api.vercel.com/v9/projects/{myfitfolio project}/env` | 200. Write scope is proven by `secrets` in Phase 08, not here |
| Sentry | `GET sentry.io/api/0/organizations/` | 200 |
| PageSpeed | `GET pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://myfitfolio.com` | 200 |

**Legal dry-run (A-12).** `node .claude/scripts/legal/arc-legal.mjs propose --venture myfitfolio --out "$TMP/legal"
--venture-dir ~/.arc-private/legal/myfitfolio --dry-run`. It passes when it exits 0 and every rendered path is under the
shell's `app/` route tree. The result is recorded in PROGRESS. The real `publish` is the owner's gate in Phase 08.

**A-15 fallback.** If `verify frontend` is unreachable after the merge, the live-run checkbox below is ticked by
recording `A-15 FIRED -> moved to phase-07` in PROGRESS, not by the run itself.

**Seams (read from the code, 2026-10-20).**
- Resolver: new export `resolveHosts(row, profile) -> string[]` in `lib/ctx.mjs`. It throws
  `refusal("HOST_REFUSED", msg, { reason })` for the two reasons. `makeCtx` already receives `profile`
  (`ctx.mjs:51`), so its one change is `fetch: guardedFetch(resolveHosts(row, profile))` in place of
  `guardedFetch(row.hosts || [])`. A resolver mutant replaces the body of `resolveHosts` in a copied `ctx.mjs`. Every
  other `.hosts` reader calls `resolveHosts`.
- Collision scan: it skips `@venture` tokens and counts only literal entries. It covers every row, including rows that
  also hold `@venture`.
- `applies`: comes from `resolveBoard(slots, profile)` (`catalog.mjs:93`, `evalPredicate` on `required_when`). The walk
  calls the existing `apply()` per slot (`runner.mjs:108`), which already writes `skipped` for `!entry.applies`
  (`runner.mjs:124`) through `setSlot` / `saveUnderLock`. The walk itself writes no state.

**Stop-line reasons.** `{reason}` is the line `apply()` already logs:
- 3: `another apply holds {slug}'s lock ...`
- 4: `waiting on {slots} (not verified, skipped or absent)`
- 5: `awaiting the owner's decision on {approval_id} ({gate})`
- 1 and 2: the LaunchError message.

The walk prints the stop line after that log.

**Absent on real.** An `absent` slot on a `real` venture stops the walk with exit 2 (REFUSED):
`stopped at {slot}: exit 2 absent on real`. The REQ-14 fixture asserts 2.

**Lint profile check.**
- `launch-lint` checks each committed profile under `products/launch/ventures/`.
- On a `real` profile, UNRESOLVED or COLLIDES is a lint error.
- On a `rehearsal` profile, `unassigned` is allowed (`invoice-reminders-6e390c`), and COLLIDES is still an error.
- The deliberately bad `fx-*` profiles live only in the fixture dir, never in the repo, so the repo lint run never
  reads them. They are fed to `launch-lint --self-test` and to the trust cases instead.
- A registry literal is not suffix-checked. Literals are owner-vetted vendor hosts, and the collision rule protects them.

**Output and `--next`.**
- Stop lines and `walk complete` go to stdout. Exit codes carry the verdict.
- `--next` follows the same table as `--all`, retry-once included. With nothing left it prints `walk complete: 0
  applied, {s} skipped` and exits 0.
- A duplicated `@venture` in one row is a lint error, and `ctx` dedups it on resolve.
- A `fixed-defects.md` entry follows the file's existing row shape.

**Failed retry.** A `failed` slot is retried immediately, at most once in a walk. If the retry succeeds it counts as
`applied`. If the retry fails, the stop line reports the second failure.

**Forced exits.** No new knob is added; each exit comes from a board shape the fixture builds. The fixture catalog in
`make-fixture.mjs` gains core slots for this:
- 1: the existing fake adapter failing its verify;
- 2: a core slot with no registry row;
- 3: a planted live lock (`FAKE_HOLDING` + `FAKE_HOLD_MS`, as `launch-runner.bats` does today);
- 4: a core slot whose `depends_on` is pending;
- 5: the existing `gate-2` slot.

**CI profiles.** `make-fixture.mjs` writes one extra profile per REQ-13 case into its `ventures/` dir:
- `fx-real.venture.yaml` with `honesty_class: real` and `brand.domain: myfitfolio.test`;
- `fx-unassigned` (`unassigned`), `fx-suffix` (`vercel.app`), `fx-cc` (`co.uk`) and `fx-collide` (`github.com`).

The trust cases use `fx-real`. `myfitfolio.com` itself is never needed on CI, because a real host is proven live in the
main clone. `launch-lint` enumerates `products/launch/ventures/*.venture.yaml` with `loadProfile`; on CI those are the
committed profiles plus the fixture's.

**Hostname-table hit.** If an adapter fetches a host outside the `brand.domain` subtree, that host is added as a literal
next to `@venture` in that row's `hosts[]`, never a wildcard. The host and the adapter line go into the table. Its own
`/arc-attack` covers it.

**ABSENT fixture board.** `verify --all --venture fx-sandbox $FX_FLAGS` runs on a fixture state with every core slot
verified: exit 0. Re-run after one core slot is set to `absent`: exit 1 on `fx-real` and exit 0 on `fx-sandbox`. On the
real board in the main clone, the day-1 run is expected to exit 1 (only 5 of 34 verified). Both codes go into PROGRESS.

**Probe env vars** (names from `~/.arc-private/launch/myfitfolio.env`, which follows `arc-sandbox.env`):
`CLOUDFLARE_API_TOKEN`, `RESEND_API_KEY`, `SUPABASE_ACCESS_TOKEN`, `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET`,
`VERCEL_TOKEN`, `SENTRY_AUTH_TOKEN`, `PAGESPEED_API_KEY`. `RAZORPAY_WEBHOOK_SECRET` is checked as present only. The
Vercel project id is the `vercel-project` resource in the `hosting` row of
`.claude/state/launch/myfitfolio.json` (main clone). Probes run under bash with `set -a; . ~/.arc-private/launch/myfitfolio.env`.

**Legal dry-run check.** The shell is `E:/Work_Hub/01_Automemory/myfitfolio/app/` (`layout.js`, `page.js`). It passes when
`propose --dry-run` exits 0 and every path it lists under `--out` maps to `app/privacy/` or `app/terms/`. That is
checked with `find "$TMP/legal" -type f` against those two prefixes.

**Red-first check.** `git log --format=%s origin/main..HEAD` lists the `test:` commit before the `feat:` commit.

**Plan prefix.** The `plan` output lists slots in walk order. The prefix is every core row printed before the first row
that reads `REFUSED` or `awaiting`.

## Verification plan

- **Test command:** `bats tests/launch-trust.bats tests/launch-cli.bats tests/launch-lint.bats` (CI only, per job via
  `node .claude/scripts/review/ci-digest.mjs`)
- **Expected failure first:** a new `launch-trust.bats` case "ctx.fetch reaches the venture's own brand.domain via
  @venture" fails before the change, with `HOST_REFUSED: myfitfolio.com is not in this provider's hosts[]`; a new
  `launch-cli.bats` case "apply --all walks the fake board" fails with the CLI's unknown-slot refusal for `--all`.
  The 19-row fixture derives its rows from the registry and compares them element for element with the literals read from
  `git show` of the pre-change file; two resolver mutants (identity, un-lowered) must each turn the suite red, or the
  seam is untested.
- **Live demo scenario:** in the main clone after the merge: (1) `node .claude/scripts/launch/arc-launch.mjs verify
  frontend --venture myfitfolio` → `verified`; (2) first `arc-launch.mjs plan --venture myfitfolio`, pasting into evidence
  the core `topoOrder` prefix the walk would apply before its first refusal; any provider-side create in that prefix
  other than `domain` is listed with its `sensitive_actions[]`, and if one is a one-way resource the live transcript is cut
  (PLAN cut order 1); (3) only then `apply --all --venture myfitfolio --venture-root E:/Work_Hub/01_Automemory/myfitfolio`
  → stops at the slot the plan output named (expected `domain`, `exit 2`, no vetted row until Phase 07) and prints the
  stop line.
- **Real-system check:** the `run.completed` receipt for `frontend` in `.claude/state/hq/events/<date>.jsonl` carries
  `honesty_class: real` and the main SHA; `https://myfitfolio.com` serves the launch shell's generator tag.
- **Expected evidence:** `evidence/phase-06/` holds the CI per-job digest, the attack report, the receipt id for
  `frontend`, the `apply --all` transcript, and the 19-row resolution fixture output for `arc-sandbox`.

## Rabbit holes in this phase
- Widening `hostAllowed`. The match rule does not change; only the list given to it does.
- Fixing `frontend`'s Lighthouse score if A-14 fires. That is logged and fixed inside this appetite, without touching the
  token code.

## Out of scope for this phase
`domain` (Phase 07); every `required` slot (Cycle 3).

## Your-setup / pending
- Owner: approve this plan (kickoff stamp). That approval is the record that the 19 rows' host scope changed (ADR-1765).
- Owner: `myfitfolio.venture.yaml` stays untracked in the main clone unless you say commit it. The arc repo is public.
- Owner, before Phase 06 closes, as env only on the box: the Cloudflare token with `Zone:Read` + `DNS:Edit` on
  `myfitfolio.com` (A-09), the Resend key (A-10), the Supabase org token (A-11), the Razorpay test key id + secret and
  webhook secret in `~/.arc-private/launch/myfitfolio.env` (A-13), a Vercel token with env write (REQ-16), the Sentry
  token and the PageSpeed key. Phase 06 runs one read-only probe per key and records pass/fail in PROGRESS, so a missing
  key fires its assumption now, not on the day its phase opens.
- Owner, by the end of Phase 06: start the legal lane's publish for `myfitfolio` against the live shell (A-12; facts in
  `~/.arc-private/legal/`, never git).

## Non-negotiables (verbatim from PLAN)

- A slot never names a tool and a provider row never redefines exit criteria (ADR-1701).
- No default provider anywhere: zero vetted providers is REFUSED, `apply` exits 2, and the word `default` fails the lint in both YAML files and in adapter code (ADR-1703).
- Provider rows are owner-only: `approved_by` is linted against the owner (ADR-1702); `vetted` needs a scout record, one real passing verify, a `decision.recorded` id and the digest (ADR-1705).
- Adapters are four functions with no business logic; `scaffold()` is check-then-create and reports `resources[]`; they import no package (ADR-1704, ADR-1715).
- `ctx.fetch` refuses hosts outside `hosts[]`, `ctx.write` refuses paths outside the venture root, digest drift flips the row to `candidate`, and every `sensitive_actions[]` entry emits `approval.requested` first (ADR-1719).
- `@venture` resolves only to the venture's own `brand.domain` and fails closed: unresolved or colliding is HOST_REFUSED, never an empty allow-list that passes (ADR-1765).
- Verify is a probe something outside the repo answered; `backup` is verified only by a restore with matching row counts (ADR-1709).
- Zero new spine kinds; every slot run is `run.completed process=launch@x.y.z` with `honesty_class` in the payload (ADR-1708).
- Every `arc-sandbox` receipt is `rehearsal`; only `myfitfolio` emits `real` receipts; a gate is crossed only by the owner's approval, and a walk never answers one (ADR-1700, ADR-1767).
- Secrets never enter any repo and launch never fetches a key; a missing key is `failed(env:{KEY})` (ADR-1713, ADR-1724).
- No `depends_on` edge from a core slot to a non-core slot; the DAG is acyclic and every edge resolves (ADR-1717).
- Tests run on CI only, never on this box; every fixture asserts it RAN before asserting what it printed.
