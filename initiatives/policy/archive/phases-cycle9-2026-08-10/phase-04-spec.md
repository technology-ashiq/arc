# Phase 04 — Adversarial security pass: two full days, untouchable

**Goal (one line):** fresh agents that have not seen the implementation try to make the engine
allow something it forbids, and every hole they find becomes a permanent regression fixture.
**Appetite:** 2 days. **These two days are not compressible for any REQ, and the plan's slack is
never taken from here.** If earlier phases overrun, they cut their own scope — this phase does
not shrink. A build that ships without them ships an unattacked security engine.
**Depends on:** phase-01, phase-02, phase-03

## Exit criteria (Definition of Done)

- [ ] **Two full days, two fresh agents per day on different surfaces** — one on decision logic
      (schema, reducer, promotion chain, effective-level arithmetic), one on the shell and OS
      boundary (path normalisation, hook dispatch, settings, process spawning). Fresh means the
      agent has not seen the implementation: the gate's author found 0 holes in their own gate
      where an unanchored agent found 9.
- [ ] **Each attacker's prompt carries the lane's running list of already-fixed defects**, with
      the instruction to check every one of them in every **other** file. The twin-fix
      recurrence has bitten this repo twice — a fix is not applied until it has been attacked
      somewhere it was never made.
- [ ] **The attack list, at minimum:** wrapper bypass via direct driver · a denied command
      embedded in an allowed shell · symlink and path escape from write roots · NTFS junction,
      hardlink, 8.3 short-name and case-folding escape · domain allowlist bypass (redirect,
      DNS-rebind, IP-encode, subdomain, proxy) · concurrent double-spend race ·
      demotion-fails-open · cap-above-ceiling no-op attempt · demotion racing a promotion
      decision · fake or missing trial-ledger evidence · forged promotion payload · stale cached
      policy versus the file on disk · hook fail-open under **each** of the four fail-open modes
      · deny-rule deletion via a write grant · **a guarded file mutated through the shell rather
      than the write tool** · **a hook script left in place but made non-spawnable** (permission
      bit or extension change, no content bytes touched) · quarantined-event-reported-as-success
      · a `policy_hash` collision between a demoted and a tampered state · **interpreter-argv0
      escape** (`node -e` writing a guarded path — no chaining metacharacter, no discrete path
      argument) · **an `argv0_classes:` entry whose class understates what the program can do**,
      which is ADR-0507's own named soft spot · **a kind holding `publish` or `deploy` above L1
      with `e2: []` whose work actually publishes**, which is the one place the model rests on an
      unverified human declaration (ADR-0506) · a forged promotion payload.
- [ ] **The mutant is the negative control.** At least one attacker builds a deliberately
      malicious module — one that overwrites the policy file, deletes a hook, forges a promotion
      and spawns a driver directly — and the pass only counts if the engine stops it. A grep-shaped
      guard that a mutant walks past is the Cycle 7 failure, repeated.
- [ ] **Every hole found lands as a permanent regression fixture**, with an ASCII-only bats
      `@test` name, in a file that asserts its own registered test count from `BATS_TEST_NAMES`
      — bats silently drops a non-ASCII test name, and five tests once vanished behind a green
      file, visible only as a shrinking CI count.
- [ ] **Every hole is back-ported into REQ-01's hostile corpus** before this phase closes, not
      merely parked in a standalone bats file. Otherwise CI stops catching it the moment the two
      adversarial days end.
- [ ] **"No findings" does not close this REQ** without demonstrated attack paths — the evidence
      is the attempts, not the verdict. A report that lists what was tried and how each attempt
      was blocked passes; a report that says the engine looks correct does not.
- [ ] **Kill criterion check:** if a bypass class is found that the Phase-1/2 architecture cannot
      close — meaning the enforcement point is not actually the sole entry — **STOP** and take it
      to the owner. Do not ship a policy engine that polices politely.
- [ ] Tests green on CI; `tree-manifest.txt` regenerated if needed; tracker updated; phase-close
      receipt on the spine.

## Verification plan

One coarse line at kickoff, refined via `/arc-change` when the phase starts: each attack row is
either a committed fixture that proves the attempt is blocked, or a recorded finding with its own
new fixture — and the phase's own exit check is a diff showing REQ-01's hostile corpus grew by
the number of holes found. A corpus that did not grow while findings were reported is the exit
failure this check exists to catch.

## Rabbit holes in this phase

- **Compressing the two days** because everything looks green on day one. Green is the condition
  under which every one of this repo's 96 holes across three prior phases was found.
- **Letting the attackers fix what they find.** They report; the fix and its fixture are the
  build session's work, then re-attacked. An attacker who patches its own finding stops attacking.
- **Accepting a clean report.** Demanded evidence is the attempt list. See the exit criteria.

## Out of scope for this phase

Any new capability, kind, or feature — this phase adds fixtures and fixes only · scheduler work
of any kind · migrating a cap-bearing module · widening the MCP scope beyond `.mcp.json`.

## Your-setup / pending

Nothing, except the owner's availability if the kill criterion fires: an unclosable bypass class
is a human decision, not a build-session judgement call.

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
