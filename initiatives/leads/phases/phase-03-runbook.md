# Phase 03 runbook — the rehearsal journey, run by hand

> # ⚠ NOT YET APPROVED FOR THE LIVE RUN — read this first
>
> **Every defect the previous banner listed is fixed.** That banner named three CRITICALs from
> PR #145 — the `set -a; . ./.env.local` instruction that blinded its own guard, a duplicate
> refusal that could name the wrong draft, and the unstated campaign-name contract — plus four
> open items and two code defects. None of them survives in this document or in the code it
> drives. It is replaced rather than deleted, because a banner whose every symptom is already
> absent teaches the reader that banners are stale, and this lane cannot afford that.
>
> **What is true as of 2026-08-10:**
>
> - **Nine adversarial rounds have run against this slice**, two independent surfaces each, and
>   they returned 3, 9, 10, 8, 2, 3, 2, 1 and 1 CRITICALs. Near-zero overlap between the surfaces every
>   round. Several findings were defects introduced *by the fix for* an earlier round — twice
>   inside the comment explaining that fix.
> - **CI is green**: 19 jobs, ubuntu 18/20/22 + macOS + Windows, 0 failures.
> - **Known holes are listed, not hidden** — `phases/phase-03-known-holes.md`, each with why it
>   is left and what would close it. The owner set the bar on 2026-08-10: only a CRITICAL blocks
>   this slice.
>
> **What is still outstanding before the live run:** the fixes from the most recent round have
> not themselves been attacked, and the branch has not merged. Walking this document against the
> **fake** to rehearse the sequence is fine and is what it is for. Do not do the live send until
> that line is struck from this banner.

This is what the owner follows for the real run. Every command below was walked end to end
against the FAKE on 2026-08-09 (slice 06); the outputs quoted are the ones the walk actually
produced, not what the source suggests they should be.

**One caveat on that claim, added 2026-08-10.** A run on the fake can no longer print the
sentence a real delivery prints — both `mail`/`notify` and `daily` now say `NOT SENT —
ARC_LEADS_FAKE=1 … nothing left this machine` instead. So any success line quoted below is the
REAL one, reconstructed from the code rather than transcribed from the fake walk, and it is
marked where it matters. If you see a `NOT SENT` line at any point in this runbook, stop:
nothing you have done since has left the machine.

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

So the addresses reach the run **from the file, through arc's own reader**, and are never typed.

> **This step used to say `set -a; . ./.env.local; set +a`, and that instruction was a CRITICAL
> in its own right** — it is why this runbook carried a DO-NOT-FOLLOW banner. Two reasons, and
> both survive the guard being repaired:
>
> 1. **It is a second parser.** `lib/env.mjs` is a deliberately small grammar with no variable
>    interpolation; `.` in bash is a full shell. The two disagree in both directions — bash
>    expands an unquoted `$`, executes an unquoted space, and strips an inline `#` comment. A
>    `RESEND_API_KEY` silently truncated at a `#` still passes a "is it set?" check and fails at
>    the vendor at the exact moment mail goes out.
> 2. **It does not exist on this box's primary shell.** Nothing in this file named a shell, and
>    PowerShell has no `set -a` and no `. ./file` with those semantics.

**There is nothing to source, and nothing to export for the addresses.** `arc-leads daily`
reads `.env.local` itself, through `lib/env.mjs` — the same reader `mail` and `notify` have used
since Phase 04, and the only parser of that file anywhere in this lane. Put the addresses in
`.env.local` as `ARC_LEADS_REHEARSAL_ALLOWLIST=` followed by the five addresses, comma-separated,
and that is the whole step. (No example is written out here, and that is not squeamishness: the
tripwire refuses **any** email-shaped string in a tracked file, and it caught the first draft of
this very sentence.)

The **one** variable you export by hand is the mode, and it is deliberately not a file setting:
declaring a run to be a rehearsal is a per-run act, not something a file decides for you.

```bash
export ARC_LEADS_REHEARSAL=1          # bash / Git Bash
```
```powershell
$env:ARC_LEADS_REHEARSAL = "1"        # PowerShell
```

Then confirm arc can see the list **without printing it**. One command, and it runs identically
in bash, Git Bash and PowerShell because it is a file rather than a shell one-liner:

```
node .claude/scripts/leads/rehearsal-check.mjs
```

Expect it to end with `rehearsal-check: OK`, exit 0. It prints counts and booleans only — never
an address.

> **This check used to be a shell one-liner and that was a CRITICAL of its own.** It read the
> FILE while the send reads the file **into the environment**, where the environment wins — so
> an operator with a stale `ARC_LEADS_REHEARSAL_ALLOWLIST` exported in their shell (which is
> exactly what running the *previous* version of this step leaves behind) was told `entries: 5`
> while the send resolved one stale address. It also parsed addresses a third way, disagreeing
> with the store in both directions on zero-width characters and on single-label domains. And it
> did not run at all in PowerShell 5.1, which strips the quotes out of `node -e` arguments.
>
> The script resolves everything through the same functions `arc-leads daily` uses. If it ever
> disagrees with the send, both are wrong together — which is the only kind of check worth
> having here.

What it will tell you, and what to do:

| Line | Meaning |
|---|---|
| `resolved from: .env.local` | good — the file is what the send will use |
| `resolved from: the ENVIRONMENT (it overrode the file)` | **stop.** A value exported earlier in this shell is winning over the file you just edited. Open a new shell |
| `resolved from: .env.local declares it EMPTY` | the line exists with nothing after the `=`; fill it in. This is not an override, and looking for one wastes an hour |
| `resolved from: the ENVIRONMENT (the file does not declare it)` | **stop.** The addresses are only in your shell, which means they went through your history and a process listing (ADR-0412). Put them in `.env.local` and open a new shell |
| `resolved from: NOWHERE — it is not in the file and not in this shell` | the ordinary first-run state on a fresh clone. Nothing has leaked; the list simply is not set yet. Put it in `.env.local` |
| `entries the send will use : 0` | every send will refuse — correctly, but with a message that sends you in a circle (see *Known refusals*, R3) |
| `distinct people` lower than `entries you typed` | two entries are the same person after normalisation (a case twin, or an invisible character pasted in), or one is not address-shaped. You have four recipients, not five |
| `forbidden-name guard: REFUSED` | `.env.local` names a variable that decides how a send behaves — remove that line before anything else |

**Never set `ARC_LEADS_FAKE`, `ARC_LEADS_NOW`, `ARC_LEADS_STORE`, `ARC_LEADS_REHEARSAL`,
`ARC_LEADS_MAIL_BASE_URL`, `LEADS_PROVIDER_BASE_URL`, `LEADS_CONFIG`, `LEADS_WARMUP_APPROVED` or
`LEADS_FIXTURE_DIR` in `.env.local`.** `mail.mjs` refuses that file outright if it *names* any of
them — with or without a value, and whatever the case. The reason is not a startup guard (there
is only one of those, and it is for `ARC_LEADS_NOW`): it is that these nine variables decide
whether a send is real, whether it is a rehearsal binding the PRODUCT domain, which day the cap
buckets to, where the store lives, which host receives the key **and the recipient and the
body**, what the config says every cap is, whether the warm-up counts as attested, and where
fixtures come from — and a credential file is not where any of those decisions belong.

> **Those nine are examples, not the rule** — do not read this paragraph as a list to check
> against. The guard is an **allowlist**: inside the `ARC_*` and `LEADS_*`
> families, `.env.local` may carry only `ARC_LEADS_MAIL_FROM`, `ARC_LEADS_MAIL_ALLOWLIST`,
> `ARC_LEADS_REHEARSAL_ALLOWLIST` and `ARC_LEADS_OUTREACH_FROM`; **everything else in those
> families is refused, including a name nobody has invented yet.** On top of that it refuses
> anything that steers this process or the children it spawns, regardless of family: `NODE_*`,
> `BASH_ENV`, `PATH`, `LD_*`, `DYLD_*`, the proxy variables, and the runtime-configuration class
> — `OPENSSL_CONF`, `SSL_*`, `GIT_*`, `HOME`, `TMPDIR`, `PYTHON*`, and anything ending `_CONF`,
> `_CONFIG`, `_OPTIONS` or `_PROFILE`.
>
> It became an allowlist because it was a list of nine and **six** separate adversarial rounds
> each found a different name missing from it — `ARC_SPINE_ROOT`, which moves the entire spine
> and is therefore worse than `ARC_LEADS_STORE` which had been listed from the start; then
> `ARC_NODE`, which chooses the interpreter `arc-event.sh` runs; then `OPENSSL_CONF`, which node
> parses at STARTUP before a line of the program runs.
>
> The reason any of it matters: `emit()` spawns `bash` and then `node` on **every receipt** with
> the environment this file has just written into, and it passes no `env:` of its own. So a name
> that chooses an interpreter, a startup file, a search path or a TLS setting chooses them for
> the send. That is live in every command that reads the file — step 1 (`preflight`), step 6 (the
> notification path) and the send itself. `NODE_TLS_REJECT_UNAUTHORIZED=0`, a line people paste
> in behind a corporate proxy, turns off certificate validation on the request carrying your key,
> your recipient and your text.
>
> If you are unsure whether a line belongs in `.env.local`, run `rehearsal-check.mjs`: it applies
> the same guard and tells you before the send does.
A `.env.local` holding `ARC_LEADS_FAKE=1` would otherwise switch the whole run to the fake and
report "mail sent" having sent nothing.

> The guard now reads what the file **declares** rather than what it managed to **apply**, which
> is what made it blind to a file whose variables were already in the environment. And a run on
> the fake mailer no longer prints the sentence a real delivery prints: it says `NOT SENT —
> ARC_LEADS_FAKE=1 … nothing left this machine`. If you ever see that line during this
> rehearsal, stop; nothing you have done since has sent anything.

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

Run these from the repo root. `&&` is not a statement separator in PowerShell 5.1, so the two
git commands are listed separately rather than chained:

```
git fetch
git status
node --version
```

`git status` must show a clean tree on the branch you intend. Node 18, 20, 22 and 24 are all
supported; this walk was done on 24.

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

Every command is run from the repo root, and every one of them is written out in full as
`node .claude/scripts/leads/arc-leads.mjs …`. There is no `arc-leads` on your PATH — a shorthand
was defined here once and never used, while two of the Known-refusals rows told you to run the
bare name, which in PowerShell is a "not recognized" dead end at the moment you are trying to
recover from something.

### 1. Gate check

```bash
node .claude/scripts/leads/arc-leads.mjs preflight
```

**What this prints depends on whether you have exported `ARC_LEADS_REHEARSAL=1` yet, and the
difference is large.** `effectiveSendingDomain` substitutes the rehearsal domain when the mode is
declared, so the whole gate changes subject — from the cold domain that does not exist to the
rehearsal domain that does. Read the section that matches your shell.

**Without the mode declared** (a bare shell) it prints **exactly two** `REFUSED` rows and exits **3**:

```
  REFUSED sending-domain: sending_domain is empty — no dedicated cold-outbound domain exists yet (ADR-0413) …
  REFUSED seed-smoke: seed_evidence_path is empty — no dated seed-inbox smoke exists …
arc-leads preflight: REFUSED — no send may happen until every clause passes live (REQ-00) …
```

**That is the correct answer and it does not block the rehearsal.** `preflight` asks about the
dedicated **cold** domain, which is Phase 05's. The rehearsal path is gated separately by
ADR-0416's three signals, checked inside the send itself. Read the rows, then continue.

**With `ARC_LEADS_REHEARSAL=1` exported — which is the state you will actually be in from the
allowlist step onward — it prints something completely different**, and this is the version that
matters:

```
  ok       rehearsal-mode: … the domain under test is rehearsal_domain "automemory.ai" …
  ok       dedicated-domain: automemory.ai IS a product domain, permitted ONLY because …
  REFUSED  spf:            no v=spf1 TXT record resolves for automemory.ai (live lookup)
  REFUSED  dmarc:          no v=DMARC1 TXT record resolves for _dmarc.automemory.ai (live lookup)
  REFUSED  dkim:           no DKIM TXT at resend._domainkey.automemory.ai (live lookup)
  REFUSED  provider-spf / provider-dkim / provider-dmarc: …
  REFUSED  warmup:         …
  REFUSED  seed-smoke:     …
exit 3
```

**`sending-domain` does not appear at all**, and the two `ok` rows are the rehearsal mode
resolving correctly — they are the good news, not a warning. **Do not count the refusals and
compare them to a number in this document.** Read each row.

> **The `provider-*` rows only exist because `preflight` now reads `.env.local`** and therefore
> reaches the vendor with your real key. Before that fix it could not authenticate at all and
> printed a single `provider-auth` refusal instead — which is what an earlier version of this
> block quoted, along with the claim that `provider-auth` and `seed-smoke` were "the two rows
> Phase 03 is allowed to carry open, and only those two". Both halves were stale the moment the
> gate started resolving the same world the send does.
>
> With `ARC_LEADS_OUTREACH_FROM` unset — which the Preconditions above say it is — the vendor
> lookup has no domain to match and all three `provider-*` rows refuse. That is the **expected**
> state, not an incident. `warmup` refuses too, and stays refused even after the domain verifies,
> because the vendor returns no warm-up age.
>
> **These are live questions about the world, not config reads.** `spf`, `dmarc` and `dkim`
> refusing means the records are not resolving *right now from this machine* — if DMARC was
> published and this says otherwise, you have a propagation or resolver problem and the
> rehearsal will bounce. "Read them and continue" does **not** apply to any of these.
>
> **If the first line says `ON FIXTURES`, stop.** That means `ARC_LEADS_FAKE=1` is exported in
> this shell and every row below it was answered by a file in `tests/fixtures`. The command
> refuses in that state on purpose and will not print `PASS` from it at any exit code — but the
> `ok` rows still look like `ok`, and Phase 03's entry gate is read off this output.

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

> ### ⚠ THE CAMPAIGN NAME APPEARS IN THREE PLACES AND THEY MUST BE THE SAME STRING
>
> `rehearsal` here, `"campaign": "rehearsal"` inside your `icp.json`, and `rehearsal` as the
> argument to `draft` in step 4. **Nothing used to check that they agreed**, and `research` takes
> its campaign from the ICP file rather than from this command — so a walk with
> `icp.campaign = "walk"` and this file's literal steps reported success at every single step,
> landed the research receipts and the approvals under two different campaign names, and then
> answered the phase's one question with:
>
> ```
> no outreach.sent receipt on the spine carries campaign "rehearsal" … Campaign(s) with receipts: (none)
> ```
>
> exit 2, at the very end, after every irreversible act. Check it before step 3, not after step 8
> — same script as step 1, two more flags, same behaviour in every shell:
>
> ```
> node .claude/scripts/leads/rehearsal-check.mjs --icp path/to/icp.json --campaign rehearsal
> ```
>
> Expect `campaign agreement      : PASS`. `research`, `draft` and `daily` all now refuse a name
> that is not `[a-z0-9-]{1,64}`, so `Rehearsal` is rejected outright rather than opening the
> `rehearsal` directory on a case-insensitive filesystem and writing into it under a name the
> spine treats as different.

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

> ### ⚠ `arc-replay` BEFORE the restore is the one move that turns a refusal into a real defect
>
> Every command that hits the index-ahead-of-events state refuses and tells you the same thing,
> in the same order, because the order is the whole instruction. Replay rebuilds the index **from
> the day files that are present**. Run it while a day is still archived and the count goes to
> zero — not because the receipts were found, but because they were **forgotten**. The refusal
> then disappears, the work is re-announced, and restoring the archived day afterwards leaves
> **two live approvals for one touch**: both undecided, both rendering in the inbox, and no
> answer to "which approval authorised this mail?"
>
> Walked end to end on 2026-08-10, which is why this box exists: refuse → replay → resume →
> restore → two live approvals on two draft refs, at exit 0 behind a success summary.
>
> **Restore the day file first. Then replay. Then re-run the command.**

**Re-running research is safe.** It reports `receipts: 0 new · 5 already on the spine` and exits
0. (Before slice 06 it exited 2 halfway through and left a quarantine record that disabled
`report` — see R1. The first fix for that was itself wrong in three ways and is the reason this
file carried a DO-NOT-FOLLOW banner; the guard is now under the send lock, reads both spine
files, and grows as it goes.)

**If it exits 2 with `ANOMALY` lines, read them — they are not the same failure.** Each names one
lead and one cause:

| Anomaly | What it means | What to do |
|---|---|---|
| `payload differs` | a receipt with this exact idem is already on the spine but says something else — most often a lead that was `verified` and is now `held`, because `email_status` is not part of the idem preimage | not a re-run problem. The spine still asserts the old value and needs a correction receipt |
| `in derived/idem.index but in no day file` | a restored or archived day left the index ahead of the events | **Restore the missing day file FIRST, and only then run `node .claude/scripts/hq/arc-replay.mjs`.** Retrying this command cannot help, and running replay first is worse than doing nothing — see the box below |
| `another writer took this idem` | you lost a genuine race, and the refusal left a quarantine record | clear the quarantine **before** step 8, or `report` refuses |
| `the emitter refused its receipt` | anything else | read the message; the dossiers are written and the command is re-runnable |

### 4. Drafts → the ADR-0404 lint

```bash
node .claude/scripts/leads/arc-leads.mjs draft rehearsal <drafts.json>
```

Expect one line per draft and a summary:

```
  PASS  draft_<16 hex> lead_hmac_v1_<32 hex>
  …
arc-leads draft: 5 queued for approval, 0 resumed from an interrupted run, 0 FAIL blocked before the inbox, 0 duplicate touch(es) refused, 0 unchanged after a rejection, 0 stale draft(s) left alone, 0 half-written
```

- `PASS` — clean.
- `WARN` — written and queued, with the reason rendered on the inbox item. Read it.
- `FAIL` — **never reaches the inbox.** A draft citing a fact absent from the dossier, or citing
  a fact it never mentions in the body, or citing one with no relevance line, is blocked at
  birth. This is the mechanism that makes invented personalization impossible; if you see a
  FAIL, fix the draft, do not argue with the lint.
- `DUP` / `duplicate touch(es) refused` — you already have a draft for that lead and touch **and
  its approval is live in the inbox**. The line names that exact `draft_ref` — the one for the
  lead on that line, which is worth stating because the test protecting this only proved that
  *some* known ref appeared anywhere in the output, and a mutant that printed another lead's ref
  on every DUP line passed it 9 times out of 9. **Edit that draft**; a second record for the same
  touch is never how you revise one, and it would put two approval items in the inbox for one send.
- `RESUME` — a previous run wrote that draft and died before announcing it. Nothing was lost and
  nothing was duplicated: its approval is in the inbox now. This is the recovery path for a
  Ctrl-C, a spine-lock timeout, or a full disk between the two writes.
- `STALE` — same situation, except the body on disk differs from the one in this input file. It
  was **not** announced, because approving a body you have since edited is precisely the thing
  `draft_sha` exists to prevent. `review` it, then keep it or remove it.
- `NO` — that touch was **rejected** in the inbox and this input carries the identical body.
  A rejection is not permanent: change the body and re-run, and the revision is announced as a
  new approval with its own sha. (Before this fix a rejection WAS permanent, and the only way
  round it was a different `touch_n` — which is two live approvals for one send, the exact state
  the one-approval-per-touch rule exists to forbid.)
- `HALF` — the draft is on disk and its approval was refused. The command exits 2 and names it;
  **re-run this same command** and it finishes the job.

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

Expect `arc-leads: mail sent id=… idem=…` — **on the real mailer**. On the fake it says
`arc-leads: NOT SENT — ARC_LEADS_FAKE=1 …` and nothing is delivered. It sends **nothing** when nothing is waiting, and
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

> **The remedy above walks straight into R2b if the campaign names disagree.** "Run it with no
> `--campaign`" is the right move for a typo and the wrong move for the mismatch in step 2's
> warning box: with receipts under two names, the open report answers over both and tells you
> nothing about either. Check the three spellings first.

**R2b — `report` refuses: `N event(s) on the spine supersede an outreach.sent inside this
window … refusing, because this fold does not resolve supersedes`.**
**This refusal was missing from this table**, which mattered because it is reachable by exactly
the route R2's own remedy recommends. A correction receipt reclassifies a send rehearsal↔real,
and the fold does not follow `supersedes` — so rather than counting one physical send in two
classes, it refuses and names the receipt. There is no operator fix: it is a fold-shaped change
tracked for a later slice. Narrow the window with `--from`/`--to` to exclude the corrected send
if you need the number today, and say in the evidence bundle that you did.

**R3 — a send refuses: `rehearsal mode is DECLARED but incomplete` or `lead … is not on the
ADR-0416 rehearsal allowlist … check ARC_LEADS_REHEARSAL_ALLOWLIST in .env.local`.**
**The message used to point at a file the send path did not read**, which is why the top of this
runbook once told you to source it. `daily` now loads `.env.local` through `lib/env.mjs` before
it opens the store, so the allowlist in that file is the allowlist the guard sees, and this
refusal means what it says. Fix: run `node .claude/scripts/leads/rehearsal-check.mjs` — it
resolves the allowlist exactly as the send does, tells you which of the four places the value
came from, and checks that `ARC_LEADS_REHEARSAL=1` is exported in **this** shell, which is the
one thing that is deliberately not a file setting.

**R4 — `daily` refuses: `N unresolved send intent(s) in the journal.`**
A previous run was interrupted between the provider ack and the receipt. Run
`node .claude/scripts/leads/arc-leads.mjs reconcile` and read every `!` line it prints. Do not delete intent files by hand —
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
