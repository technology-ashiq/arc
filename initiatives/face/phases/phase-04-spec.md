# Phase 04 — Shell (Today · Inbox · Spine/Tape on live L2)

**Goal (one line):** the L3 app is born (`arc-face` repo, ADR-1300) and the owner can read
Today, stamp the Inbox, and scrub the Tape against the real spine.
**Appetite:** 4 days
**Depends on:** phase-01, phase-03

## Exit criteria (Definition of Done)

- [ ] `arc-face` repo created (React + TS strict + Vite + `tokens.css` from Phase 01,
      ADR-1309) with a root-mode arc install; CI runs there; cross-repo evidence ref
      (repo + SHA + CI run id) accepted into this lane's bundle (assumption row 6)
- [ ] Today: the brief's four groups from the reader, 40-line collapse rules honoured,
      needs-you never collapses, KPI row with *Why?* precedents, "since you left" from a
      cursor (REQ-02)
- [ ] Inbox: every `approval.requested` profile renders its detail body; APPROVE/REJECT
      stamps with mandatory reason through `/api/decide`; refusal codes verbatim; other
      needs-you kinds are cards with chips, never stamps (REQ-03, ADR-1303)
- [ ] Spine/Tape: as-of scrub re-renders spine-derived views (ADR-1305); replay-identical
      fixture green; file-borne panels badged "file, not log" (REQ-05, assumption row 7);
      dated obligations flagged from the tree
- [ ] end-to-end hostile-payload RENDER fixture (second-opinion finding 5): the Phase 03
      hostile spine rows rendered in a real browser (Playwright) — script does not
      execute, bidi does not reorder chrome, the 64 KB body is capped in the DOM;
      escaping responsibility (L2 serializer vs L3 render) asserted end-to-end, not per
      layer alone
- [ ] keyboard model (`j/k` · `a/r` · `w` · `t` · `/`) + ⌘K jump; data modes live ·
      replay · sim visible in the chrome (ADR-1310) — the `m` (map) binding lands in
      Phase 05 with the Map room itself; Phase 04 must not register `m` against a route
      that does not exist yet
- [ ] tests green on CI per job in BOTH repos, verified by `gh run view --json jobs`
      against each repo's own head SHA (never a watcher exit code — bench 2026-08-13:
      `gh run watch --exit-status` exited 0 on a `failure` conclusion); the lane's
      PROGRESS.md/done-log and the arc-face repo's own merge land in the same close
      action, never a follow-up (engine 2026-08-03: PR merged while PROGRESS stayed
      stale, twice in one cycle)

## Verification plan

One coarse line, refined at phase start via `/arc-change`: REQ-02/03/05 fixtures green on
CI; live demo on the real spine from the main clone; qa-tester evidence for the stamp
flow.

## Rabbit holes in this phase

Animation systems (motion only on state change, 200 ms) · bespoke room panels (Phase 06)
· mobile app (no-go — mobile is read+stamp only, later).

## Out of scope for this phase

Map + coverage lint (Phase 05) · bespoke rooms (Phase 06) · Ask arc (Phase 07).

## Your-setup / pending

Owner: create/authorize the `arc-face` GitHub repo (private) at phase entry; the FIRST
push confirms a CI run exists whose headSha matches HEAD (`gh run list` in that repo)
before any phase evidence relies on "CI runs there" — memory 2026-08-12: a push created
no CI run at all, and waiting on a run never created is indistinguishable from waiting
on a slow one; ledger 2026-08-13: a draft/conflicting PR silently produced zero runs for
five pushes.

## Non-negotiables (verbatim from PLAN)

- One write path, mandatory reason, byte-parity with the CLI (E2, E1, ADR-1302).
- Reader-only over the spine; no second truth in the UI (SPINE-G/ADR-0030, A5, ADR-1301).
- Every number has *Why?* precedents; no invented numbers, ETAs, health emoji (A1, E3).
- Real vs simulated/rehearsal/drill never mixed or summed; MISSING ≠ 0; ABSENT with reason (E3, ADR-1313, ADR-1018, ADR-0416).
- Kinds, gates, lanes, ADR ids verbatim (A5); unknown kinds/profiles render generically — nothing dropped silently (E1, ADR-1306).
- Seals for every forever-human action; no button ever exists for them (E2, ADR-1303, ADR-0069 b1, ADR-0305, ADR-0110, ADR-1203).
- Localhost + token; no PII; escaped serializer (ADR-1312, ADR-0410, LED-C, SPINE-E).
- Design lane law: three theses, blind jury with reference, owner pick + prediction, two critique rounds max (ADR-1308, ADR-0034…0049).
- Every new face lint starts WARN-first in the TRIAL set and earns FAIL through the trial ledger (A1) — `face-coverage` excepted (a validator over the tree, FAIL from birth like policy-lint, ADR-1311).
- The Engine room's unlock-ladder rung indicator reads evidence only — the rung is never a control (E2).
- Tests green on CI per job; two fresh attackers per gate (decision logic + shell/HTTP boundary); attacker prompt carries the lane's fixed-defect list; vacuous-pass rule (assert it RAN before asserting what it printed).
- Zero product-code writes before explicit owner approval of this plan; L3 stack never enters the arc repo (ADR-1300, ADR-1309).
