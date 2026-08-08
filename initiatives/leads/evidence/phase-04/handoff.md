# Phase 04 — arc's own mail · evidence

Closed 2026-08-08. Appetite 1.0d, actual ~1.0d. Amendments: 0. Reopened: n.

## What shipped

`mailer()` on `lib/deps.mjs` (interface + fake + Resend HTTP impl) and the policy in
`lib/mail.mjs` — allowlist, daily and monthly caps, argv credential scan, IST timestamp
grammar, idempotency key, delivery log. `lib/env.mjs` reads `.env.local` on the Node side for
the first time. `arc-leads mail` and `arc-leads notify (canary | approvals | brief)` share ONE
delivery path, `deliverNotification`, which holds the env guard, the recipient rule, the send
lock and the send.

Merged as `074927d` (PR #131), `dd08c16` (PR #133), and the tracker/ceremony work in PR #134.

## Tests

`tests/leads-mail-guard.bats` — **47 → 74**. CI green on every leg (ubuntu 18/20/22, macOS 3
shards, Windows 12 shards): run `31256032059` on the branch, run `31256390218` on merged main,
both 19/19 jobs. The suite asserts its own registered count, so a test that never runs shows up
as a falling number rather than a silent pass.

## Real-system evidence — this phase ran against the real vendor

**Nine live messages on 2026-08-08**, all four kinds:

| kind | sends |
|---|---|
| `notify` | 2 |
| `canary` | 3 |
| `brief` | 2 |
| `approvals` | 2 |

The vendor reports **9 delivered, 0 bounced, 0 complaints** (queried per message id via the
vendor API against the ids in the delivery log). Every send is in the delivery log with its
vendor id and every one was counted against the daily cap.

`approvals` was proved against a **throwaway spine root** holding one `approval.requested`,
because it correctly sends nothing when nothing is waiting — so the only trigger that reads
spine state would otherwise have had zero live coverage. The real spine was not touched.

## Placement and authentication

Placement: **inbox, not spam** — confirmed by the owner on the Zoho mailbox.

Received headers on the `approvals` message, read from the delivered mail and not from our own
DNS:

```
Authentication-Results: mx.zohomail.in; dkim=pass; spf=pass
X-ZohoMail-DKIM: pass (identity @automemory.ai)
DKIM-Signature: s=resend; d=automemory.ai
```

DKIM passes **signed as the From domain** — aligned, which is the strong half. SPF passes on
the `send.automemory.ai` envelope domain, which is relaxed-aligned to the organisational domain.

**No DMARC result, and the reason is that no DMARC record exists**: `_dmarc.automemory.ai`
returns NXDOMAIN on a live lookup against 8.8.8.8. Zoho did not omit the check; there was
nothing to evaluate. Only a DNS query separates those two readings, which is why the criterion
demands the headers and the gate demands the lookup.

## Carried forward — Phase 03's entry gate, not a leftover

`lib/preflight.mjs:82` refuses when no `v=DMARC1` record resolves, and `:83` refuses again on
`p=none`. So **Phase 03 cannot start until an enforcing DMARC record is published** — one TXT
record at `_dmarc.automemory.ai`, on the owner's registrar.

Reading the Gmail-class mailbox's headers is deferred behind that, deliberately: reading the
stricter mailbox today would measure a configuration already known to be incomplete and the
result would have to be discarded. Publish DMARC, then read the mailbox whose verdict is worth
having. The phase closed with this row open by the owner's explicit decision on 2026-08-08.

## How the defects were found, since that is the transferable part

**Two adversarial surfaces returned 27 findings and overlapped on three** — decision logic and
the shell/OS boundary. Fourth time in this lane that two surfaces have shared almost nothing.

**CI then found two classes neither surface saw**: a real address written into tracked files,
and eight tests that passed on Linux and macOS while failing on Windows because they
interpolated bats temp paths into embedded node programs.

**Three further CI reds each taught something.** Four tests had gone stale in a refactor — one
of them passing against a *different* guard than its name claimed, which is the worst shape: a
green test measuring nothing. A `/dev/null` fixture failed on Windows for the right verdict and
the wrong cause, and that wrong cause was itself a real defect (a raw `ENOENT` out of an alert
path). A local probe caught two more before CI: an `ENOENT`-vs-`ENOTDIR` split that made a
fail-closed guard fail open on exactly one of the three legs, and an end-of-options `--` marker
that deleted the guard it was meant to relax.

**The close ceremony found three more**: two ADRs still `proposed`, a PLAN naming a module that
does not exist, and the untested `approvals` trigger.
