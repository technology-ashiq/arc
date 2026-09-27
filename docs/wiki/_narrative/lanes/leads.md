<!-- facts: appetite=ecf3398e blocked-on=a68c9074 burn=ddacb3d5 cycle=a59a7db0 depends-on=a68c9074 hasPlan=b5bea41b phase=0b3aa5a1 status=8ddd7aee title=97bc66ed -->

## In plain words

Picture a single, careful salesperson rather than a call centre — one relationship built with
care at a time, instead of a purchased list blasted to strangers. <!-- plain -->

The lane's own goal is a command that turns a defined ideal-customer profile into a small,
deeply-researched, evidence-backed lead list of about twenty-five people rather than thousands,
drafts first-touch messages that cannot be a template blast, and runs a capped, human-approved
sequence from a warmed dedicated domain — every send, reply, meeting and suppression a typed
receipt on the spine, every cap enforced in code and proven unbypassable by a fixture. <!-- src: initiatives/leads/PLAN.md -->

### What it is building

- **The `leads` product**, called *the outbound engine* in its own plan, ships research and
  dossiers, a personalization lint, capped sending, reply parsing, and arc's own notification
  mail. <!-- src: products/leads/manifest.json; initiatives/leads/PLAN.md -->
- **Seven new receipt kinds** — a researched lead, a suppressed lead, a sent touch, a reply, a
  booked meeting, a won deal and a lost deal — extend the spine's closed vocabulary from 31 kinds
  to 38. <!-- src: ADR-0400 -->
- **A private data store that lives entirely outside the repository directory** holds names,
  email addresses, drafts and the send journal; the repo itself holds only schemas, fixtures,
  non-secret config and opaque references, and a tripwire lint watches for the common accident —
  though it cannot prove a tracked file is free of personal data on its own. <!-- src: ADR-0410 -->
- **arc's own outbound notification mail** rides its own transport and its own policy module,
  deliberately kept separate from the outreach sender, so the company can reach its own operator
  about a failed deploy or a waiting approval even when nobody is at a terminal. <!-- src: ADR-0415 -->

## arc words → normal words

| arc calls it | It is really |
|---|---|
| ICP | The input file (`ICP.json`) that `arc-leads research` turns into a list of researched leads. <!-- src: initiatives/leads/PLAN.md --> |
| dossier | One researched lead's file: why they fit, at least two source links, a provenance class, and a verified or held email address. <!-- src: initiatives/leads/PLAN.md --> |
| provenance allowlist | A closed list of acceptable ways a lead's information may have been found, so a purchased list or a login-walled scrape is rejected outright. <!-- src: ADR-0409 --> |
| BELOW-BAR | A heuristic warning class sitting beside a hard FAIL: a draft that is not dishonest but is thin, generic, or too similar to another draft. <!-- src: ADR-0404 --> |
| L1 | The autonomy level at which every single send needs a human's explicit approval. <!-- src: initiatives/leads/PLAN.md --> |
| send-moment guard | The last check run at the instant of sending, re-deriving every cap and suppression fact from receipts rather than trusting an earlier check. <!-- src: initiatives/leads/PLAN.md --> |
| suppression | A permanent, event-backed block on contacting a specific person again, triggered by an unsubscribe or a reply. <!-- src: initiatives/leads/PLAN.md --> |
| rehearsal mode | A labelled, allowlist-locked way of running the real sending path against a handful of real, owner-known addresses without counting as a real campaign. <!-- src: ADR-0416 --> |
| the journal | A crash-safe, two-phase record of an in-flight send that reconciles itself against the spine after a crash, spine-first. <!-- src: ADR-0411 --> |
| keyed HMAC lead id | A one-way scrambled identifier standing in for a real person's identity everywhere outside the private store, so raw personal data never reaches a receipt. <!-- src: ADR-0400 --> |
| EVO-H0 | The shared metrics vocabulary this lane shipped first, ahead of any lane actually using it to trigger an evaluation. <!-- src: ADR-0408 --> |

## How the work was planned

The lane opened with a seven-day hard cap that the owner later extended, in the open, to eleven
days once one phase had already overrun its own budget roughly twofold; the appetite rule
distinguishes a stated extension from a silent one, and this was the former. <!-- src: initiatives/leads/PLAN.md -->

It was sized as a Tier M piece of work. <!-- src: initiatives/leads/PLAN.md -->

Two cuts were pre-decided: an automated inbound reply webhook was cut down to a manual
ingestion command, and automatic reply-triage classification was cut down to a human picking the
class by hand in the inbox. <!-- src: initiatives/leads/PLAN.md -->

Its kill criteria set the line at 50% burnt (3.5 days): if the cap and suppression fixtures were
not green by then, the plan was to stop — nothing sends, ever, without that guard. <!-- src: initiatives/leads/PLAN.md -->

| REQ | User outcome |
|---|---|
| REQ-00 | A send can never burn the company's sending reputation: deliverability is checked live, by code, not by a checklist a person reads. <!-- src: initiatives/leads/PLAN.md --> |
| REQ-01 | An ideal-customer-profile file in gives twenty-five researched leads, each with a documented reason for the fit. <!-- src: initiatives/leads/PLAN.md --> |
| REQ-02 | Template-blast is structurally impossible, enforced by a three-class lint rather than by a style guideline. <!-- src: initiatives/leads/PLAN.md --> |
| REQ-03 | Sending caps and suppression cannot be exceeded, even by someone who asks the tool to. <!-- src: initiatives/leads/PLAN.md --> |
| REQ-04 | A reply is never left to rot, and an interested reply gets a calendar-link draft in the same run that classified it. <!-- src: initiatives/leads/PLAN.md --> |
| REQ-05 | One real campaign happens and is measured honestly, including its failures. <!-- src: initiatives/leads/PLAN.md --> |
| REQ-06 | Every send, reply, meeting and suppression is a typed receipt that replays to the same state from scratch. <!-- src: initiatives/leads/PLAN.md --> |
| REQ-07 | The gap between the fake sending path and the real one is closed before the first real lead is ever sent to. <!-- src: initiatives/leads/PLAN.md --> |
| REQ-08 | arc itself can send its own operator a message when nobody is watching a terminal. <!-- src: initiatives/leads/PLAN.md --> |

## The phases, one by one

| Phase | What it set out to prove | What shipped |
|---|---|---|
| 00 — Foundations | A private data store, the receipt vocabulary, a researcher, dossiers, and a deliverability preflight, all before any sending code. <!-- src: initiatives/leads/PLAN.md --> | Closed; a demo run produced a mix of passing, held, below-bar and rejected candidates, with every receipt accounted for on the spine. <!-- src: initiatives/leads/PROGRESS.md --> |
| 01 — Sequencer | Caps and suppression derived from receipts rather than a mutable counter, a crash-safe journal, and a personalization lint enforced as a code gate. <!-- src: initiatives/leads/PLAN.md; ADR-0411 --> | Closed; an adversarial pass found that running the crash-recovery step during a live send could void that send's own guard and let the next run repeat an identical message. <!-- src: initiatives/leads/PROGRESS.md --> |
| 02 — Replies | Ingesting a reply, parsing it, classifying it, and stopping the sequence automatically before the next batch. <!-- src: initiatives/leads/PLAN.md --> | Closed; a phrase using the accented apostrophe a real phone actually types was found to slip past a rule written to test only the plain typewriter apostrophe. <!-- src: initiatives/leads/PROGRESS.md --> |
| 03 — Rehearsal campaign | Running the whole pipeline once, for real, against a handful of owner-known addresses, before ever contacting a stranger. <!-- src: initiatives/leads/PLAN.md --> | In progress: a real rehearsal run went from research through drafting, review and inbox approval on five real dossiers, with all five approved by the owner, and every send was then refused because it fell outside the 09:30–18:00 IST weekday send window; the live run of five real journeys through an actual send stays the owner-gated act still outstanding. <!-- src: initiatives/leads/PROGRESS.md#rehearsal-03 --> |
| 04 — arc's own mail | A separate mailer that reuses this lane's sending transport to notify the operator, gated by an allowlist and its own caps. <!-- src: initiatives/leads/PLAN.md --> | Closed, with nine live messages sent and delivered through the real vendor and confirmed landing in the inbox rather than a spam folder. <!-- src: initiatives/leads/PROGRESS.md --> |
| 05 — Real campaign | At least twenty-five real sends to real prospects over several real days, on a warmed, dedicated sending domain. <!-- src: initiatives/leads/PLAN.md --> | Blocked and parked to a later cycle: the owner could not yet name a real offer or twenty-five real recipients, so warming a domain against no offer was refused as premature. <!-- src: initiatives/leads/PROGRESS.md --> |

## What it decided

| ADR | Decision |
|---|---|
| 0400 | Pipeline receipt kinds are a first-class vocabulary extension, keyed by a scrambled lead identifier. <!-- src: ADR-0400 --> |
| 0401 | Pipeline truth lives on the company's own spine, never on a separate venture-specific store. <!-- src: ADR-0401 --> |
| 0402 | Cold outbound sends only from a dedicated domain, behind a provider interface. <!-- src: ADR-0402 --> |
| 0403 | Caps and suppression derive from receipts and are re-checked at the moment of sending. <!-- src: ADR-0403 --> |
| 0404 | The personalization gate splits a deterministic hard failure from a heuristic warning. <!-- src: ADR-0404 --> |
| 0405 | Reply ingestion is an interface with a fake, plus a manual file fallback. <!-- src: ADR-0405 --> |
| 0406 | Jurisdiction is an allowlist enforced by a lint at research time. <!-- src: ADR-0406 --> |
| 0407 | Send autonomy beyond full human approval is earned by ledger evidence and granted by a human. <!-- src: ADR-0407 --> |
| 0408 | This lane is a separate module's first real client, shipping its receipt vocabulary rather than starting its evaluation clock itself. <!-- src: ADR-0408 --> |
| 0409 | Research provenance is a closed allowlist; an email that cannot be verified is held rather than rejected or assumed good. <!-- src: ADR-0409 --> |
| 0410 | Lead personal data lives entirely outside the repository directory. <!-- src: ADR-0410 --> |
| 0411 | A crash-safe send journal reconciles itself against the spine first, before anything else. <!-- src: ADR-0411 --> |
| 0412 | The human approver sees the drafted message; the spine itself never carries it. <!-- src: ADR-0412 --> |
| 0413 | Phases zero through two are built ahead of the pre-kickoff gate, while the phase touching real sends stays blocked. <!-- src: ADR-0413 --> |
| 0414 | A reply's identity is drawn from its own content, not from the moment it arrived. <!-- src: ADR-0414 --> |
| 0415 | arc's own notification mail is owner-directed and rides a transactional sending path, kept apart from cold outbound. <!-- src: ADR-0415 --> |
| 0416 | The outreach path may bind the company's own domain only in a labelled rehearsal mode. <!-- src: ADR-0416 --> |
| 0417 | Manual research reaches the store through a curated corpus file, refused if it resolves inside the repository. <!-- src: ADR-0417 --> |
| 0418 | The email verifier is a live mail-server lookup plus syntax checking, not a paid vendor. <!-- src: ADR-0418 --> |

## Where it stands now

The tracker reads live, sitting in the rehearsal phase, with just over two-thirds of its extended
appetite burned. <!-- src: fact:lanes/leads.status; fact:lanes/leads.phase; fact:lanes/leads.burn; fact:lanes/leads.appetite; initiatives/leads/PROGRESS.md -->

Every phase before it has closed. The rehearsal itself has run research, drafting, review and
inbox approval for real on five dossiers, with all five approved by the owner, and every send so
far refused because it fell outside the 09:30–18:00 IST weekday send window — the live run of
five real journeys through an actual send is the owner-gated act still outstanding. <!-- src: initiatives/leads/PROGRESS.md#rehearsal-03 -->

The real campaign that would prove reply rates, bounce behaviour and cold-domain reputation
remains parked to a later cycle, waiting on a named offer and a warmed sending domain that takes
calendar weeks rather than build effort to prepare. <!-- src: initiatives/leads/PROGRESS.md -->

## The bigger loop

### What went wrong and what was learned

- **A gate that only ever checked one lead identifier at a time missed a whole class of guard.**
  The reply-stop, already-sent and touch-cap checks each looked at a single lead, in code sitting
  right beside a suppression check that correctly looked at the whole roster — the same blind spot
  recurring across sibling branches rather than sibling files. <!-- src: initiatives/leads/PROGRESS.md -->
- **A safety property tested by name instead of by input let a real mutation through.** A test
  meant to catch a dangerous change matched only the wording of a rejection message rather than
  the input that should trigger it, so a change that kept the wording but broke the rule still
  passed. <!-- src: initiatives/leads/PROGRESS.md -->
- **A guard that lived in the wrong function protected nothing.** All three rehearsal signals
  were checked only inside the preflight function, but the command that actually sends never
  calls it and checks only one narrower thing, so a rehearsal run could enter the send loop while
  the gate itself refused correctly in a subcommand nobody had run. <!-- src: initiatives/leads/PROGRESS.md -->
- **A config file's own safety-relevant setting was itself overridable through an environment
  variable.** An env override could replace the whole config file, so the list defining a
  protected domain could be emptied out, and an emptied list passed another domain through
  ADR-0402 with a full green. <!-- src: initiatives/leads/PROGRESS.md -->
- **An extension of the appetite was recorded rather than absorbed quietly.** When one phase had
  already spent roughly double its own budget, the owner was presented with cutting scope,
  extending the cap, or stopping, and chose to extend — written down as a dated, one-time decision
  rather than a new default. <!-- src: initiatives/leads/PLAN.md -->

### How it connects to the rest of arc

This lane owns `validate-leads.mjs`, the validator for the shared `metric.observed` receipt kind
that growth also emits into as its second client; a spec-verify run at growth's kickoff found
deviations from the frozen spec, decided in favour of this lane's code, and is re-run as an
executable diff at growth's own Phase 5. <!-- src: ADR-1109 -->

Its private data store and its tripwire lint exist specifically so that personal data about real
people never becomes part of what a public repository could ever expose. <!-- src: ADR-0410 -->

The mailer this lane built for arc's own notifications rides its own transport and its own policy
module, kept deliberately separate from the outreach sender, so arc can notify its own operator
about a failed deploy (canary), a pending approval, or its daily brief, without the product domain
ever entering the cold-outbound code path. <!-- src: ADR-0415; initiatives/leads/PROGRESS.md -->

## Glossary

- **ICP** — the input file (`ICP.json`) that `arc-leads research` turns into a list of researched
  leads. <!-- src: initiatives/leads/PLAN.md -->
- **dossier** — one researched lead's evidence file, with its fit reason and source links. <!-- src: initiatives/leads/PLAN.md -->
- **L1** — the autonomy level at which every single send needs a human's explicit approval. <!-- src: initiatives/leads/PLAN.md -->
- **rehearsal mode** — running the real sending path against real, owner-known addresses in a way
  that is receipt-marked and never counted as a real campaign. <!-- src: ADR-0416 -->
- **the journal** — the crash-safe record that reconciles an in-flight send against the spine
  before trusting any other source. <!-- src: ADR-0411 -->
- **suppression** — a permanent, event-backed block on contacting someone again, triggered by an
  unsubscribe or a reply. <!-- src: initiatives/leads/PLAN.md -->
- **BELOW-BAR** — a heuristic warning sitting beside a hard failure, for a draft that is thin or
  too similar to another rather than outright dishonest. <!-- src: ADR-0404 -->
