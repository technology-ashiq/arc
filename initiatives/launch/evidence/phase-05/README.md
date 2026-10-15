# Phase 05 close evidence: arc-sandbox, launch Cycle 1

## REQ-05: the rehearsal board closes complete

- **Core slots (2026-10-15).** 34 of 34 core slots are `verified` or a named `ABSENT`, and none is `pending`
  (`board.md`, rendered from the runner state). `arc-harnesses` (ADR-1763) is the 34th.
- **`verify --all` (branch runner, 2026-10-15, `verify-all.txt`).** 31 of 32 verified, each naming the outside
  answerer. The one failure is `passport`: `venture-register` refuses a worktree spine (WORKTREE_SPINE) by design.
  Main's runner verifies `passport` on the same board, exit 0 (`verify-passport-main.txt`).
- **`verify --all` (main clone at `ca72f1f9`, after the merge of #425, 2026-10-15, `verify-all-main.txt`).** 32 of
  32 verified, **exit 0**, each naming the outside answerer. The first main run read 31/32: `security-headers` came
  back UNSCANNED because Mozilla Observatory answered 500. The slot passed on its first retry, and the full run
  above was then repeated from the start.
- **`launch-coverage` (main, after the merge, `coverage.txt`).** 86 slots, 34 core; 37 rows (3 candidate, 33 vetted,
  1 blocked). The owner's stamp (decision.recorded `01M4YYNSS3H8N5A5HWAG77BM3J`, on approval.requested
  `01M4YAHP98TJ22E49S7WQGXAWE`) vetted the 33 rows of the scout record (`../phase-04/provider-scout.md`), each
  digest recomputed at the flip. Core slots with zero vetted providers read 2/34, and the two are exactly the named
  ABSENTs that have no other row (ADR-1764):
  - `domain` (`cloudflare-registrar`): rehearsal never crosses gate 1.
  - `legal-pages` (`arc-legal`): the legal renderer is not ready.
- **Status.** REQ-05 is **met with two named exceptions** (ADR-1764). `launch-coverage --require-core-vetted` still
  exits 1 and names them, because the count stays a measurement.

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
- A gate-aware re-receipt for `release`: its state row still carries the first receipt's ERROR evidence, while its
  live verify answers READY. `apply --again` refuses a gated slot (gate 2) by design.
- `security-headers` waits for the live build, as `frontend` does.

Done since PR #410: recorded real responses replay on CI per adapter (ADR-1761), so that item is no longer owed.
