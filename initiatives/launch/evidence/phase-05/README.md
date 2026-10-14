# Phase 05 close evidence: arc-sandbox, launch Cycle 1

## REQ-05: the rehearsal board closes complete

- **Core slots.** 33 of 33 core slots are `verified` or a named `ABSENT`, and none is `pending`. Per-slot receipts are
  in `board.md` and `../phase-0{1..4}/real-run.md`.
- **`verify --all` (branch runner, 2026-10-14).** 30 of 31 verified. The one failure is `passport`: `venture-register`
  refuses a worktree spine (WORKTREE_SPINE) by design. Main's runner verifies `passport` on the same board.
- **`face-room`.** Its seat (`plannedRooms.arc-sandbox -> ventures`) is on this branch only, so main's runner reads it
  after the merge.
- **Owed after the merge.** A single exit-0 `verify --all` from the main clone, appended here.
- **`launch-coverage`.** It reports 33 core slots with 0 vetted providers. All 31 providers used are vet-ready
  (`vet-ready.md`: adapter digest plus a passing real-verify receipt). The scout record and the `decision.recorded`
  id are the owner's to give (ADR-1705), and the agent does not stamp them.
- **Status.** REQ-05 is **not yet met**. It waits on the merge and on the owner's vetting.

## REQ-12: first real rupee from a launch-scaffolded venture is **OPEN at first venture**

`arc-sandbox` is a rehearsal (`honesty_class: rehearsal`). Its one test purchase is booked as `revenue.simulated` and
its refund nets cash-in to 0 (`arc pnl --venture arc-sandbox --simulated`). `payment-live` was REFUSED at gate 3. No
`revenue.received` exists for any launch-scaffolded venture. The board that makes one reachable is this one.

## Defects the real runs found, fixed on PR #410

ADR-1755 through ADR-1760 cover these fixes:

- `release` takes READY only;
- the login email goes through Resend on the free tier;
- the public Supabase values are placed on Vercel;
- GoTrue's top-level token is read;
- the backup drill restores into a Supabase-shaped scratch;
- the shell's pins clear the audit;
- `apply --again` is added, and the in-attempt verify reads fresh resources;
- the verify-mode worker no longer aborts on Windows.

## Owed (tracked in PROGRESS.md)

- `backup` provisions its own pooler role and `SUPABASE_DB_URL` (done by hand on arc-sandbox).
- `secrets` places runtime keys itself (the Razorpay keys, webhook secret and Supabase service key were placed by the
  agent from the private env file).
- A gate-aware re-receipt for `release`.
- Recorded real responses replayed on CI per adapter (Phase 01 DoD). The fakes were corrected to the real answers seen
  here, but no recorded response files exist yet.
