# ADR 1345 — The session door: driver-only, click-started, no state of its own; and the council's call on the spine

**Status:** accepted
**Date:** 2026-09-25
**Product:** face (with an additive change in the council command, under ADR-1339's routing)
**Reversibility:** two-way
**Revisit trigger:** a session verb needs a stop mid-run (the council convene demo is the first paid session) -- the
click-gated STOP verb in `initiatives/face/debt-ledger.md` then lands, and the mutating-route set this ADR fixes at
three grows to four.

## Context

REQ-08 (Phase 06) asks for judgement work -- a council, a review, a phase close -- to start from the face, stream its
phases and land a receipt of a kind that already exists. ADR-1326 already fixed the one hard rule: the session door
starts `arc-run --driver …`, never a harness binary. What the door is, around that rule, was open, and four attack
rounds on PRs #269, #270 and #271 found the ways a naive door fails: a session is a model with shell tools, not a
deterministic CLI, and it outlives the request that started it.

Separately, the Phase 05 probe found that `/arc-council` writes a `council.verdict` payload
(`{decision, confidence, session}`) that the spine's closed shape (`validate.mjs`: `session_id · question_hash · call ·
confidence`) rejects as BAD_COUNCIL -- so no council has ever landed the receipt calibration reads.

## Decision

1. **One argv, checked where it is spawned.** `face-sessions.mjs` holds the 15 SESSION verbs; `sessionCommand()` is
   the only place a session argv is built (`--process`, `--driver`, `--input` JSON, `--transcript-dir`), and
   `driverOnly()` runs on the argv about to be spawned -- never on the row -- refusing a harness binary as the command
   or a stray argument, a joined argv, an empty or relative value, and an unknown driver.
2. **Click-started only.** A start spends a one-shot click token (60 s) the face asks for inside the owner's click;
   `door.sessionStart` fetches its own and refuses a caller's. The face calls it at one site, bound to `onClick`, held
   by a structural gate over the raw text of every face file and by a browser flow that counts the door's start
   requests across mount, reload and attach (0), then one click (1).
3. **No session state in the door.** A session is its directory (`session.json`, one `run.log` for stdout and stderr,
   `exit.json`), written atomically, shape-checked on read; the child is detached and told only its transcript
   directory. A restarted door attaches from disk, and a run it did not see end says so.
4. **A model with tools gets less than a CLI.** The child's env is an allow-list (OS basics, `ARC_*` minus the door's
   own and the leads steering list, provider keys); it is told the door's spine; every served line is redacted as well
   as path-scrubbed; it starts only on a `feat/*` branch, and attach flags a checkout that moved.
5. **Receipts are credited, not assumed.** Only arc-run's own named line, of the row's claimed kind or `run.completed`
   for this process, credits a receipt; any other id the run printed is listed as unattributed.
6. **Held back by name.** A verb whose session must stop for the owner before an outward step (ship's deploy) is NOT
   SHIPPABLE from any row, dispatch included, until that stop is carried to arc-run.
7. **No key in the browser, in the read host.** Every payload and the fold context of every module room pass
   `face/src/lib/keys.mjs` in `registry.foldModule`: a provider-key shape is withheld before any fold sees it and named
   by its read. The Engine room shows driver, model and health measured from `run.completed` receipts.
8. **The council's call.** `/arc-council` writes `council.verdict` in the closed shape: `session_id` = `c-<NNN-slug>`,
   `question_hash` = sha256 of the question as asked, `confidence` = the verdict's bucket, and `call` =
   `proceed` for YES and CONDITIONAL (a conditional yes is a call to go, on its conditions) and `hold` for NO and WAIT.
   This is the reading `evolve/calibrate.mjs` already scores by ("a proceed call is right when it happened").

## Consequences

- Every Phase 06 session verb rides one start path; a verb without its process file is NOT SHIPPABLE by name, never a
  borrowed process.
- The mutating routes are three: `/api/decide`, `/api/op/:id/apply`, `/api/session/:id/start`.
- Calibration can finally read council calls; a WAIT and a NO score alike, which is the simplification this accepts.

## Related

ADR-1326 (the doors), ADR-1334 (receipts of existing kinds), ADR-1339 (routing to owning lanes), ADR-1325 (no key in the
browser), ADR-0307/0310 (the council measuring itself), ADR-0226 (the attacker pass).
