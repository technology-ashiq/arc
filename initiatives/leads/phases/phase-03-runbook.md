# Phase 03 runbook — the rehearsal journey, run by hand

> # ⛔ DO NOT FOLLOW THIS RUNBOOK YET
>
> **Two adversarial passes against the commit that added this file returned three CRITICALs,
> and one of them is in this document.** It merged as `bbfcede` (PR #145) with the findings
> recorded in that PR's comments and not yet fixed. Until they are:
>
> 1. **Step 1's `set -a; . ./.env.local; set +a` disables the guard this runbook cites in
>    step 1 as your protection.** `assertEnvLocalNames` is a policy about what `.env.local`
>    *carries*, but it is fed the list of what `loadEnvLocal` *applied* — and sourcing the file
>    first guarantees that list is empty. With `ARC_LEADS_FAKE=1` in `.env.local` the run then
>    prints `mail sent … EXIT=0` **having sent nothing**, which is the exact failure
>    `mail.mjs` exists to prevent. Verified both ways: not sourced → `refused`, exit 2;
>    sourced exactly as written below → `mail sent`, exit 0.
> 2. **Step 4's duplicate refusal can name the wrong draft.** The test that was supposed to
>    pin the pairing only proves that *some* known ref appeared in the output. This runbook
>    then tells you to "edit that draft" — which may be a different person's mail.
> 3. **Nothing here says `icp.json`'s `campaign` must equal the name from step 2.**
>    `research` takes the campaign from the ICP file, not from `campaign init`. Get them wrong
>    and every step reports success while receipts and approvals land under two different
>    campaign names, and the phase's one number comes back "no receipts", exit 2.
>
> Also open: `report` has a refusal this file's Known-refusals table omits, and R2's stated
> remedy hits it; the sourcing idiom is a second env parser that disagrees with `env.mjs` in
> both directions, so a truncated `RESEND_API_KEY` passes this file's own verification and
> fails at the vendor at the moment mail goes out; and no shell is named, while
> `set -a; . ./file` does not exist in PowerShell.
>
> **Two code defects merged alongside it** and are equally unfixed: the `research`
> duplicate-skip does not stop the spine quarantine, so `arc-leads report` is still killable
> three ways; and a partial `draft` run now makes a touch **permanently and silently**
> unqueueable, which is worse than the noisy duplicate it replaced.
>
> Remove this banner only when PR #145's findings are fixed and re-attacked.

This is what the owner follows for the real run. Every command below was walked end to end
against the FAKE on 2026-08-09 (slice 06); the outputs quoted are the ones the walk actually
produced, not what the source suggests they should be.

**Nothing in this file sends mail.** The send is a separate, deliberate human act — ADR-0407
makes every send individually approved, so the run stops at the approval and waits for you.

---

## The one rule about the five recipients

The five rehearsal addresses live in **`ARC_LEADS_REHEARSAL_ALLOWLIST` in `.env.local`**, which
is gitignored and outside every tracked path. They are **never typed into a command, never
pasted into a file in this repo, and never echoed to a terminal.**

That is not politeness. `argv` is readable in any local process listing, lands in shell history,
and is embedded verbatim into Node's `Command failed: …` message on a non-zero exit — three
separate ways for a real person's address to become permanent (ADR-0412). The refusal messages
in this lane deliberately do **not** echo the address for the same reason, so a refusal you can
read in a CI log tells you *that* something was refused and never *who*.

So the addresses reach the run by being **sourced from the file**, not by being typed:

```bash
set -a; . ./.env.local; set +a
```

Do this once, in the shell you will run the whole rehearsal from. Then confirm the shell has
them **without printing them** — a count is the whole answer:

```bash
node -e 'const v=process.env.ARC_LEADS_REHEARSAL_ALLOWLIST||"";console.log("allowlist entries: "+v.split(",").filter(Boolean).length)'
```

Expect `allowlist entries: 5`. If it says `0`, the sourcing did not happen and **every send will
refuse** — correctly, but for a reason whose message will send you in a circle (see *Known
refusals*, R3).

**Never set `ARC_LEADS_FAKE`, `ARC_LEADS_NOW`, `ARC_LEADS_STORE`, `ARC_LEADS_MAIL_BASE_URL` or
`LEADS_FIXTURE_DIR` in `.env.local`.** `mail.mjs` refuses that file outright if it carries any of
them: the CLI's startup guard runs before the file is read, so a `.env.local` holding
`ARC_LEADS_FAKE=1` would switch the whole run to the fake and report "mail sent" having sent
nothing.

---

## STOP — read this before you start

**Two steps of the journey cannot run today, and neither is a configuration problem.** The walk
found both by running the pipeline outside the fake for the first time.

| # | What refuses | Why | What unblocks it |
|---|---|---|---|
| **S1** | `arc-leads research` exits **4**: `no automated lead source is bound — v1 research is manual against ADR-0409's allowlisted classes` | `sourceReal.search()` is a refusal, not an implementation. `cmdResearch` is the **only** writer of `dossiers/<leadId>.json`, and the lead id is a keyed HMAC nobody can compute by hand — so there is no path by which a manually-researched person enters the store. | A reviewed binding for the real lead source (a curated corpus file, linted by the same `lintCandidates` gate). Route via `/arc-change`; binding a real external dependency is its own slice in this lane, exactly as slice 03 was for the provider. |
| **S2** | `verifyReal.verify()` throws: `no email verifier is bound — selected from the capability report at Phase-3 entry` | Even with a corpus, research dies on the first address. | ADR-0402/0409 route this to the capability report — `/arc-capability`. It is a decision about **how an address is verified**, and a wrong answer here bounces mail from a domain that costs 2–4 weeks to warm. |

Everything downstream of research — draft, the ADR-0404 lint, the approval, the guard, the send
— was walked and works. The journey is blocked at its first step only.

**Do not work around S1 by setting `ARC_LEADS_FAKE=1`.** That switch replaces the provider, the
verifier, the DNS reader and the inbound reader all at once. A "successful" rehearsal under it
would send nothing to nobody and prove nothing at all.

---

## Preconditions

```bash
cd <repo root>
git fetch && git status          # clean tree, on the branch you intend
node --version                   # 18/20/22 all supported
```

- `RESEND_API_KEY` — in `.env.local` already (Phase 04).
- `ARC_LEADS_OUTREACH_FROM` — **not set today.** The outreach provider refuses without it:
  `ARC_LEADS_OUTREACH_FROM is unset — a send needs an envelope sender, and it is deliberately
  NOT reused from the notification mailer (ADR-0415)`. Add it to `.env.local` before the send
  step; its domain must match the rehearsal domain.
- `ARC_LEADS_MAIL_ALLOWLIST` — in `.env.local` already. This is arc's **own** notification
  allowlist and is deliberately a different list from the rehearsal one, so a rehearsal
  recipient never starts receiving deploy alerts.
- The private store exists and is backed up. Losing its secret breaks suppression matching
  permanently.

---

## The run, in order

Every command is run from the repo root. `S` below is shorthand for
`node .claude/scripts/leads/arc-leads.mjs`.

### 1. Gate check

```bash
node .claude/scripts/leads/arc-leads.mjs preflight
```

Today this prints two `REFUSED` rows and exits **3**:

```
  REFUSED sending-domain: sending_domain is empty — no dedicated cold-outbound domain exists yet (ADR-0413) …
  REFUSED seed-smoke: seed_evidence_path is empty — no dated seed-inbox smoke exists …
arc-leads preflight: REFUSED — no send may happen until every clause passes live (REQ-00) …
```

**That is the correct answer and it does not block the rehearsal.** `preflight` asks about the
dedicated **cold** domain, which is Phase 05's. The rehearsal path is gated separately by
ADR-0416's three signals, checked inside the send itself. Read the rows, then continue.

> Never pipe this into `head`/`grep`. `$?` after a pipe is the **last** stage's status, so a
> refusal reads as exit 0. This bit us while writing this runbook.

### 2. Store and campaign

```bash
node .claude/scripts/leads/arc-leads.mjs store init          # only if the store does not exist
node .claude/scripts/leads/arc-leads.mjs campaign init rehearsal
```

Expect `campaign "rehearsal" bound to store <id>/<fingerprint>`.
Re-running `campaign init` refuses at exit 2 with `already exists` — harmless, it means step 2
was already done.

### 3. Research → dossiers

```bash
node .claude/scripts/leads/arc-leads.mjs research <icp.json>
```

**Blocked today — see S1/S2 above.** When it is unblocked, expect:

```
arc-leads research: 5 PASS · 0 HELD · 0 BELOW-BAR · 0 REJECTED
  dossiers: 5 in <store>/dossiers
  receipts: 5 new · 0 already on the spine
```

**Check before continuing:** `5 PASS`. A lead reported `HELD` has an address the verifier could
not confirm and **can never be sent to** — that is a dossier, not a rejection, and it silently
reduces five journeys to four. `BELOW-BAR` means fewer than two citable facts survived the
ICP-generic rule; the draft can still be written but will carry a warning into the inbox.

Any corpus file you feed this **must live outside the repository** — it holds names and
addresses, and the tripwire treats every tracked leads path as a violation on sight.

**Re-running research is safe.** It reports `receipts: 0 new · 5 already on the spine` and exits
0. (Before slice 06 it exited 2 halfway through and left a quarantine record that disabled
`report` — see R1.)

### 4. Drafts → the ADR-0404 lint

```bash
node .claude/scripts/leads/arc-leads.mjs draft rehearsal <drafts.json>
```

Expect one line per draft and a summary:

```
  PASS  draft_<16 hex> lead_hmac_v1_<32 hex>
  …
arc-leads draft: 5 queued for approval, 0 FAIL blocked before the inbox, 0 duplicate touch(es) refused
```

- `PASS` — clean.
- `WARN` — written and queued, with the reason rendered on the inbox item. Read it.
- `FAIL` — **never reaches the inbox.** A draft citing a fact absent from the dossier, or citing
  a fact it never mentions in the body, or citing one with no relevance line, is blocked at
  birth. This is the mechanism that makes invented personalization impossible; if you see a
  FAIL, fix the draft, do not argue with the lint.
- `duplicate touch(es) refused` — you already have a draft for that lead and touch. The line
  names the existing `draft_ref`. **Edit that draft**; a second record for the same touch is
  never how you revise one, and it would put two approval items in the inbox for one send.

### 5. Read every draft beside its evidence

```bash
node .claude/scripts/leads/arc-leads.mjs review <draft_ref>
```

This renders **locally** — the body and the address never touch the spine. Expect the header
block, the dossier evidence with source URLs, then the body.

**This is the step that must not be rushed.** For each of the five, check:

1. **Every cited fact is actually true of that person** — open the `evidence_url` and read it.
   The lint proves the fact is in the dossier; only you can prove the dossier is right.
2. **The `lint` line** — `PASS`, or a `BELOW-BAR:` with its reason.
3. **No `*** BODY EDITED SINCE WRITE ***`.** If you see it, the file changed after it was
   written and the `draft_sha` no longer matches. Approval binds exact content: an approval of
   the old sha will be refused at send time.
4. **The mail reads like one person wrote it to one person.** The lint catches structure, not
   character. It cannot tell you the mail is boring.

### 6. The L1 approval

The approval items are on the spine and render in the approval inbox:

```bash
node .claude/scripts/hq/arc-inbox.mjs
```

Expect exactly one line per draft:

```
01<ULID>  approve outreach touch 1 for lead_hmac_v1_<32 hex> in rehearsal  (leads-send)  arc
```

**Exactly five lines for five leads.** Two lines carrying the same `lead_hmac` means two
approvals for one send, and "which approval authorised this mail?" stops having an answer.

Optionally, mail yourself the fact that they are waiting:

```bash
node .claude/scripts/leads/arc-leads.mjs notify approvals
```

Expect `arc-leads: mail sent id=… idem=…`. It sends **nothing** when nothing is waiting, and
prints `nothing waiting — no mail sent` instead; that is deliberate, not a failure. Note this
mail is a real send to your own allowlisted address, and it does not touch the outreach path.

**Record the decision** for each approval you accept (a `decision.recorded` whose `decides` is
that approval's ULID). Both halves are required — an `approval.requested` with no matching
decision is not an approval, and the send path refuses it.

### 7. The send — NOT part of this runbook

Everything above stops here on purpose. The send needs `ARC_LEADS_REHEARSAL=1`,
`ARC_LEADS_REHEARSAL_ALLOWLIST` and the rehearsal domain all present, and it is your keystroke,
not a scripted step. When you run it, watch it live rather than reading a summary afterwards.

---

## Known refusals and what to do

**R1 — `report` refuses: `N receipt(s) sit in the spine quarantine … Resolve the quarantine,
then ask again.`**
A receipt the emitter rejected is sitting in `events/_quarantine/`. The report refuses rather
than answering over a set it could not fully read, because any quarantined line could be a real
send this count cannot see. Open the quarantine file, decide what each record is, and resolve
it. Slice 06 removed the one routine way to create these (a research re-run); a new one means
something genuinely refused.

**R2 — `report` refuses: `no outreach.sent receipt on the spine carries campaign "<name>"`.**
Not a bug. Before any send there are no receipts, so the campaign name cannot be resolved
against them. It refuses instead of answering `real: 0`, because a silent zero for a misspelled
name reads exactly like the answer you were hoping for. Run `report` with no `--campaign` to see
the whole spine.

**R3 — a send refuses: `rehearsal mode is DECLARED but incomplete` or `lead … is not on the
ADR-0416 rehearsal allowlist … check ARC_LEADS_REHEARSAL_ALLOWLIST in .env.local`.**
**The message points at a file the send path does not read.** `.env.local` is loaded at exactly
one place in the CLI — the notification mailer — and every other subcommand keeps the
environment it was given. The guard reads `process.env`. So an allowlist that only exists in
`.env.local` is invisible to `daily`, and the run refuses (safely, but confusingly). Fix: source
the file into the shell as shown at the top, then re-check the count.

**R4 — `daily` refuses: `N unresolved send intent(s) in the journal.`**
A previous run was interrupted between the provider ack and the receipt. Run
`arc-leads reconcile` and read every `!` line it prints. Do not delete intent files by hand —
that is the state that prevents sending the same mail twice.

**R5 — `daily` refuses: `no sending_domain configured`.**
Rehearsal mode is not declared, so the send fell through to the ADR-0402 rule that cold outbound
never leaves the product domain. Correct refusal; declare rehearsal mode properly.

**R6 — `store init` refuses, or a command exits 5.**
A store error. Do not re-init over an existing store: the HMAC secret is what makes suppression
survive, and a new secret means everyone who unsubscribed becomes contactable again.

---

## What this run can and cannot prove

**Can:** that the pipeline carries a person from research to an approval request; that the lint
blocks invented evidence; that the allowlist refuses a non-listed recipient before any socket
opens; that rehearsal sends are marked and counted separately from real ones.

**Cannot, on five people you know:** reply rate, positive-reply rate, bounce rate, complaint
rate, domain reputation, or whether the offer works. Those need strangers and they are Phase
05's. A report out of this phase quoting a reply rate is reporting a number about the owner's
own friends.

In the evidence bundle, recipients appear as `rehearsal-1` … `rehearsal-5`, **never verbatim**.
