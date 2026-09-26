# Phase 06 residue -- the session verbs that did not ship

**15 verbs: 5 ship with their receipt shown, 4 start but their receipt is not yet shown, 6 are residue.** The phase spec's exit criterion (ADR-1339) asks each of the 15 SESSION verbs in
`evidence/phase-05/cli-probe.md` to start from a click through `arc-run --driver` and land a receipt of an existing
kind, OR be a row here, approved by the owner as a whole. Mapped by hand on 2026-09-26 from `SESSIONS` in
`.claude/scripts/hq/face-sessions.mjs` against `processes/` on `main` at `b94f681b`.

**Owner ruling, 2026-09-26:** "All six to residue.md" -- asked at `/arc-resume --lane face` with the six named and
the alternative (build some or all now) offered. The approval of THIS list as a whole is the owner's stamp at
`/arc-phase-done 06`; this file is what that stamp reads.

## What ships, receipt shown (5)

| row id | process file | receipt kind |
|---|---|---|
| `council.convene` | `council-convene` | `council.verdict` -- live demo passed, read back off the spine by id (`live-demo.md`) |
| `develop.proof` | `develop-proof` | `slice.done` (#282, face-dash factory ring read-back) |
| `memory.log-lesson` | `lesson-log` | `note.logged` (#278; `tests/face/session-door.mjs` credits it off the spine the door named) |
| `memory.promote-rule` | `rule-promote` | `approval.requested` (#278) |
| `strategy.record-adr` | `adr-record` | `note.logged` (#282, face-dash kernel ring read-back) |

## Starts from a click, receipt NOT yet shown (4)

Found by the close's spec-fidelity pass (2026-09-26). Each starts `arc-run --process <file> --driver` from its click, and
the fixtures prove that start. The door credits a receipt by kind the same way for every row, but that crediting is
proven on `memory.log-lesson` alone. None of these four has had its OWN receipt read back. The criterion asks for that
read-back, so these rows do not meet it in full. They are listed here for the owner's stamp, not counted as shipped.

| row id | process file | receipt kind | not yet shown |
|---|---|---|---|
| `review-ship.review` | `review-diff` | `review.completed` | a read-back of `review.completed` from a door-started run |
| `executor.dispatch` | the one the owner picks | `run.completed` | a read-back of `run.completed` from a door-started run |
| `strategy.adopt-plan` | `kickoff-plan` | `kickoff.done` | a read-back of `kickoff.done` from a door-started run |
| `org.lane-birth` | `kickoff-plan` | `kickoff.done` | the same, from the lane-birth row |

Pay-down: a face PR adds one read-back per row. A live run would cost money, so this should be a mock-driver fixture
whose process emits the row's kind, filed to face. It is on the debt ledger.

## The residue (6)

Each row stays on the door, served, and refuses at start with the code shown -- the refusal names what is missing, so
the button is honest rather than hidden. None is faked with a nearby process (`face-sessions.mjs:11`). No new spine
kind is proposed for any of them (ADR-0026).

| row id | door today | missing piece | filed to |
|---|---|---|---|
| `review-ship.ship` | `CONFIRM_STEP_UNENFORCED` (`session-door.mjs:307`) | `ship` deploys outward, so its session must stop for the owner's confirmation before `vercel --prod`. `arc-run` has no way to carry that stop and enforce it, so no row may start it. Also no `ship-run` process file. | engine |
| `review-ship.qa` | `NO_PROCESS` (`qa-run`) | `/arc-qa` drives a real browser against a running app; a headless session has neither a dev server it started nor a browser it may open. No `qa-run` process file. | engine |
| `develop.close-phase` | `NO_PROCESS` (`phase-close`) | `/arc-phase-done` reads CI per job, must run from the main clone (no receipt is emitted from a worktree), and ends in the owner's stamp. The DoD check is judgement (probe row 67). No `phase-close` process file. | develop |
| `executor.hire` | `NO_PROCESS` (`hire-certify`) | There is no hire procedure to encode ("a hire is a session", probe row 76), and no receipt kind was chosen from KINDS. No `hire-certify` process file. | engine |
| `absorb.adopt` | `NO_PROCESS` (`absorb-adopt`) | An adoption needs `decision_refs.adopt`: the owner's inbox decision with a reason ("nothing adopts itself", `absorb/registry-ref.mjs:158`). It may also need a displacement at the cap. A single `item` field cannot supply that A/B decision. No `absorb-adopt` process file. | absorb |
| `growth.draft` | `NO_PROCESS` (`growth-draft`) | The row takes one `topic`; `arc-growth generate` needs `--cluster-id`, `--plan` and `--keyword` (`growth/arc-growth.mjs:5`), which come out of the cluster step first. No `growth-draft` process file. | growth |

REQ-08's "absorb read" and "hire certification" are the `absorb.adopt` and `executor.hire` rows (phase spec,
verification step 4), so both land here as NOT SHIPPABLE, which that criterion allows (ADR-1334).
