# PLAN — social v1 · "the marketing loop" — v1.0

> **STATUS: kickoff-grade — landed owner-instructed from a claude.ai session, 2026-10-21,
> grounded against `main` @ `3fda79d`, disk-only, git untouched.** The owner branches/commits/PRs
> this drop himself (no machine git). Decisions are letters (**SOC-A…L**); real ADR numbers are
> assigned at kickoff from the **next free century, 2100–2199** (PORTFOLIO band table) — never
> here. This births a **new lane, `social`**; it does not reopen `growth` or `leads`.
>
> **Provenance:** an outside reference (a public "AI-native social media agent team" artifact:
> signals → orchestrator → 8 departments → engage → interrupts → feedback) was audited step by
> step against arc. Its loop is Collect → Score → Brief → Draft → Schedule → Approve → Engage →
> Measure. arc already runs five of those; **three are missing (Score, Schedule, Engage)**, and two
> arc does differently on purpose (Approve, Interrupts). Every claim about arc below was read off
> this tree on 2026-10-21; file paths are given so kickoff can re-verify, not trust.
>
> **Trigger: owner ruling, 2026-10-21.** "nama ventures koda oru company thana apo athukellam use
> agatha… full plan ready pannu… arc la pannuvom la athu maari plan ready pannu, apdiye repo la
> potu work start pannuvom."
>
> **Appetite (proposed, owner confirms at kickoff): 10 days → Tier M.** Kill line in §9.

## 0. One-liner

arc can already draft, gate and publish a web article and send a cold email, but it cannot keep a
social channel alive: nothing scores what to post today, nothing holds a calendar, nothing reads a
reply. Social v1 adds those three steps as one product, `products/social`, built on the leads
pattern (provider behind an interface, fake first, journal, guard at send), drafting through the
**existing** `build-in-public-draft` process, publishing only when the owner runs the command —
and proves it on arc's own channels first.

## 1. Current state this plan rides on (verified 2026-10-21)

- **The drafting seat already exists.** `org/roles/g-growth/build-in-public-social.role.yaml`:
  seat `human`, `autonomy_ceiling: L1`, `e2: publishing under Ashiq's name`, binds process
  `build-in-public-draft`. `processes/build-in-public-draft.process.yaml` v1.0.0: `tools: []`,
  pack inlined, `classification: external-ok` required (REQ-06 data boundary), output
  `draft + sources + pack-ref`. Its policy row (`hq.policy.yaml` `process:build-in-public-draft`)
  is `publish: L0`, `write: L0`. **A draft process exists; a publish path does not.**
- **Publishing a site is solved; publishing a channel is not.** `content.published` is the only
  `CONTENT_KINDS` entry (`.claude/scripts/hq/lib/validate-content.mjs:27`, ADR-1101). ADR-1101's
  own revisit trigger: *"a second publishing surface needs a field this payload does not carry —
  then the payload is extended by a new ADR."* A social channel is that second surface.
- **The send machinery to copy is in leads.** `.claude/scripts/leads/lib/` holds `drafts`,
  `journal`, `guard`, `sequencer`, `replies`, `caps`, `mail` (the provider), `spine-read`;
  `products/leads/manifest.json` declares its own kinds (`LEADS_KINDS`) and a face room in the
  `money` ring. ADR-0402 (provider behind an interface), ADR-0403 (never a daemon; send is a
  human-run command), ADR-0407 (send autonomy earned by ledger evidence, granted by a human),
  ADR-0413 (fake provider first).
- **Jobs are a solved shape.** `hq.jobs.yaml` script jobs (`launch-watch` daily@07:30,
  `distribute-radar`, `lane-stale`) each carry a `policy_kind` row; `lane-stale` (ADR-0079)
  derives into `.claude/state/**` and raises `incident.raised` — the exact pattern Score and the
  interrupts need.
- **Ventures are not arc's to hold.** ADR-0059: ventures live in their own repos with root-mode
  installs and appear only as passport rows. ADR-1214: a real venture's publish ledger lives with
  its facts, not in arc — **arc is a public repository.** ADR-2026: launch births ventures with
  every harness. So "one marketing loop for every venture" means **arc ships the capability and
  each venture runs it in its own repo**; arc never stores a venture's handles, tokens or journal.
- **The face is mid-cycle.** `face` Cycle 17 "Hands First" is LIVE and owns `RoomFrame`
  (Overview · Work · Records tabs, FV3-B). Rooms come from product manifests (`face.room`,
  `face.ring`). The Growth room is `products/growth`'s; a new product gets its own room.
- **WIP:** four LIVE lanes today (launch, face, growth, leads). Kickoff prints the WIP line and
  proceeds (ADR-0052).

## 2. Scope

**In:** `products/social` (CLI + libs + config + manifest + face room), the calendar, the
weekly review pack, `publish --due` on a fake provider, the daily triage job and two interrupt
checks, reply ingestion with reply drafts, the Social room "live map", one real provider
(LinkedIn) behind the interface, a venture-install check.

**Out (deferred, §12):** Instagram/Meta and every other channel, images/carousels/video, paid
ads, auto-publish at any level, an HQ read path into venture journals, evolve on social
surfaces, a new drafting process.

## 3. Decision record — SOC-A … L

- **SOC-A · A new lane and a new product.** `initiatives/social/` + `products/social/`, ADR band
  2100–2199. Not a growth revision: growth is the site content engine, blocked on the Search
  Console CSV, and one plan per lane (ADR-0051).
- **SOC-B · arc is the first client.** v1 runs on arc's own channels (the AutoMemory / arc
  presence, the owner's build-in-public seat). Ventures adopt it through their root-mode install
  (ADR-0059, ADR-2026); their config, tokens and journal stay in their repo (ADR-1214). An HQ read
  path into a venture's journal is deferred to that ADR's revisit trigger.
- **SOC-C · No new drafting process.** Drafts come from `build-in-public-draft` as it stands
  (L1, `tools: []`, pack inlined, `external-ok`). Social builds the **pack** from receipts and
  approved notes, and fits the draft to a channel's limits after the fact. A channel-shaped input
  is added only if assumption A2 fires, through `/arc-change` on the process file.
- **SOC-D · Publishing is E2 and stays human.** `arc-social publish --due` is a command the owner
  runs; no job, hook or face button presses it (E2 Human Sovereignty; ADR-0403's rule, applied
  here). The role's ceiling stays L1. Any later autonomy is a separate ADR on ledger evidence
  (ADR-0407's shape).
- **SOC-E · Provider behind an interface, fake first.** `publish`, `fetchReplies`,
  `fetchMetrics` behind one interface; an in-repo fake from Phase 00 (ADR-0402/0413). The real
  LinkedIn provider is Phase 05 and reads its credentials from the environment only
  (`.env.example` names the variable, never a value).
- **SOC-F · The calendar is a sequencer, and approval pins a sha.** Approving a review pack pins
  each draft's sha and assigns it a slot from the channel cadence; the guard at send refuses
  anything unapproved, not due, or whose text no longer matches its pinned sha. The journal is
  idempotent: a second run of `publish --due` publishes nothing twice.
- **SOC-G · One review pack a week, not one approval a post.** A venture's week of drafts lands
  as ONE `approval.requested`; the decision approves, rejects or edits each row. This is what
  keeps the owner's time flat as ventures are added.
- **SOC-H · Zero new spine kinds, one payload ADR.** Draft → the role's `handoff.ready`; the gate
  → `approval.requested` / `decision.recorded`; the publish → `content.published` extended with a
  `surface` field (the ADR-1101 revisit trigger, re-deriving its idem preimage in the same change);
  engagement → `metric.observed`; interrupts → `incident.raised`. If a field truly does not fit,
  a `SOCIAL_KINDS` set via `validate-social.mjs` is the fallback (assumption A3).
- **SOC-I · Score and interrupts are derivations, not daemons.** A daily `social-triage` script
  job (policy row in the same change, POL-I) derives per channel "what to post today" into
  `.claude/state/social/**` and raises `incident.raised` for a thin calendar; a second check reads
  the journal for a silent channel. The `lane-stale` shape (ADR-0079).
- **SOC-J · Engage drafts, never replies.** Replies are pulled through the provider; each that
  needs an answer becomes an L1 reply draft in the Inbox. Nothing is sent without the same gate
  as a post.
- **SOC-K · The Social room is a wall of real parts.** `products/social` declares room `social`
  in the `money` ring. Its Overview draws the reference's wall — signals, orchestrator steps,
  departments, engage, interrupts, run console — where **every tile is a real arc part with a
  derived status** (LIVE / BLOCKED / PLANNED / OWNER) read from a tile registry in the product and
  from receipts. No logo of a tool arc does not run. No fake data. Built after face Cycle 17
  lands, inside the four-file module contract.
- **SOC-L · Text posts only in v1.** One channel (LinkedIn), plain text with a link. Images,
  carousels and video wait for the voice/creative work.

## 4. REQ table (Tier M cap: 10)

| REQ | User outcome | Measurable acceptance | Phase |
|---|---|---|---|
| REQ-01 | The owner gets a post drafted from arc's own receipts | `arc-social draft` builds a pack, runs `build-in-public-draft`, writes a draft with ≥1 source and a `handoff.ready` receipt; fixture green | 00 |
| REQ-02 | Nothing reaches a channel unapproved | fake `publish --due` refuses an unapproved, not-due and sha-mismatched draft, each by name; 3/3 mutants refused | 00 |
| REQ-03 | A week of posts costs one decision | 5 drafts land as 1 `approval.requested`; one `decision.recorded` pins 5 shas and assigns 5 slots | 01 |
| REQ-04 | Publishing never double-posts | two consecutive `publish --due` runs → 1 `content.published` per draft, `surface` set; 0 duplicates | 01 |
| REQ-05 | The owner sees what to post today without asking | `social-triage` runs from `hq.jobs.yaml`, writes its derivation and raises `incident.raised` when slots < cadence; fixture green | 02 |
| REQ-06 | A reply never waits unseen | fake provider replies → reply drafts in the Inbox within one triage run; 0 sent without a decision | 03 |
| REQ-07 | The owner reads the whole loop on one screen | Social room renders the wall; 100% of tiles carry a derived status; face lints green; 0 console errors | 04 |
| REQ-08 | A real post leaves arc by the owner's hand | first LinkedIn post via `publish --due`, `content.published` with the provider's receipt id | 05 |
| REQ-09 | A venture can run it in its own repo | a root-mode fixture install runs draft → approve → fake publish with no arc-only path and no venture data written into arc | 06 |
| REQ-10 | Nothing else regressed | `kickoff-lint`, engine compile, policy `[birth-rule]`, spine validate suites green on the 3-OS CI | 06 |

## 5. Architecture

```mermaid
flowchart TB
  owner([Owner])
  subgraph arc [System: arc]
    triage[Job: social-triage]
    cli[Container: arc-social CLI]
    draft[Process: build-in-public-draft · L1]
    journal[(Journal + calendar)]
    spine[(Spine)]
    inbox[Inbox]
    room[Social room · face]
  end
  li[External: LinkedIn API]
  triage --> spine
  cli --> draft --> cli
  cli --> journal
  cli -- review pack --> inbox --> owner
  owner -- decision --> spine
  owner -- runs publish --due --> cli
  cli -- provider interface --> li
  cli --> spine --> room
```

## 6. Phases (risk-first)

| Phase | Capability | Appetite | Depends on |
|---|---|---|---|
| 00 | Steel thread: pack → draft → approval → **fake** publish → receipt; product skeleton, config, fake provider, journal, guard, the `surface` ADR | 2d | — |
| 01 | Calendar + weekly review pack + `publish --due` | 1.5d | 00 |
| 02 | `social-triage` job + thin-calendar and silent-channel checks + policy rows | 1.5d | 01 |
| 03 | Engage: reply pull (fake) + reply drafts to the Inbox | 1d | 01 |
| 04 | Social room wall (after face Cycle 17 merges) | 2d | 02 |
| 05 | Real LinkedIn provider (gated on app approval, applied for in Phase 00) | 1d + external wait | 01 |
| 06 | Venture-install check + seal | 1d | 05 |

Phase 00's verification plan is written at kickoff in full; later phases get one coarse line,
refined when they start.

## 7. Non-negotiables

- E2: no code path posts without the owner running the command.
- No venture's handles, tokens, journal or drafts are ever written into this public repo.
- No scraping, no unofficial API, no fake engagement or warm-up (ADR-0402).
- Kinds stay closed: a new kind only by ADR (ADR-0026).
- Every new job and process gets its policy row in the same change (POL-I).
- Branch-only writes; the machine never merges.

## 8. Assumptions ledger (cap 7)

| # | Assumption | Falsified when |
|---|---|---|
| A1 | LinkedIn grants posting to the chosen account through an approved app | the app review is refused or still pending at Phase 05 start → REQ-08 is cut to the next cycle |
| A2 | `build-in-public-draft` output fits the channel without a new input | > 1 in 10 drafts breaks the channel limit after fitting → `/arc-change` adds a `channel` input |
| A3 | `content.published` + `surface` carries every publish fact | a needed field has no home → `SOCIAL_KINDS` by ADR |
| A4 | One weekly review pack keeps the owner under 10 minutes a day | two straight weeks over 15 minutes → revisit SOC-G |
| A5 | face Cycle 17 merges before Phase 04 | not merged when Phase 04 starts → 04 waits, 05 runs first |

## 9. Kill criteria

- At 5 days burnt, Phase 00 not DONE → stop and re-plan; no later phase starts on a missing
  steel thread.
- LinkedIn app not approved when Phase 05 starts → Phase 05 is CUT (REQ-08 `dropped`), the lane
  seals on the fake provider, and the real provider becomes the next cycle's Phase 00.
- Any change that needs a daemon, a machine-pressed post, or venture data in arc is out of this
  cycle by definition.

## 10. External dependencies

| Dependency | Interface | Fake | Real | Contract test |
|---|---|---|---|---|
| LinkedIn posting + comments API | `provider.publish / fetchReplies / fetchMetrics` | in-repo, deterministic | env-configured, Phase 05 | same suite against fake and a recorded real fixture |

## 11. Open forks for kickoff (question-planner)

1. Appetite — 10 days (Tier M) as proposed?
2. First real account — the owner's personal LinkedIn (build-in-public) or an AutoMemory company page?
3. Default cadence — 3 posts a week per channel?
4. The wall — its own Social room (SOC-K, recommended: rooms are per product) or a station in the Growth room?

## 12. Deferred (consciously)

Instagram/Meta and other channels · images, carousels, video (voice lane) · paid ads · any
autonomy above L1 · HQ read path into venture journals (ADR-1214 trigger) · evolve arms on post
openings (needs volume) · a channel-shaped draft input (A2) · competitor and mention monitoring.

## 14. KICKOFF PROMPT (paste-ready)

```
/arc-kickoff --lane social social v1 "the marketing loop" — arc keeps a social channel alive: a daily triage says what to post, a weekly review pack drafts it through build-in-public-draft, the owner approves once, and the owner's own `arc-social publish --due` posts it on a fake provider first and LinkedIn second, with replies coming back as drafts.

Ground rules for this kickoff:
- Read docs/strategy/plans/PLAN-social.md FIRST. SOC-A…L are adjudicated and LOCKED — assign ADR numbers from the next free century (2100–2199), do not re-litigate. §11 lists the only open forks.
- New lane. Non-negotiables: E2 (no machine-pressed post) · zero new spine kinds unless SOC-H's fallback fires by ADR · no venture data in arc · POL-I rows in the same change · branch-only writes.
- Appetite: Tier M, 10 days unless the owner says otherwise; Phase 00 is the steel thread on the fake provider.
Emit kickoff.done + approval.requested{gate: kickoff} and STOP.
```
