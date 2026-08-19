# Fact pack — explore `face-hq-v1` (shared floor content)

> Written at assignment time, 2026-08-19, from the live tree. Every variant renders THESE
> facts verbatim — same data across A/B/C so the jury compares design, never content.
> Nothing here may be invented, rounded, prettified or summed. Real vs non-real classes
> are never mixed (E3). Use the raw ₹ character (not an HTML entity). Indian digit
> grouping (₹4,00,000). IST dates. Monospace tabular numerals for ids and amounts.

## Spine (live, 2026-08-19)

- **1,146 receipts** · 21 `day.closed` seals · **14 of 46 kinds have ever fired** ·
  245 quarantined records held SEPARATELY (231 `DUP_IDEM` · 6 `BAD_ARGS` · 3
  `UNKNOWN_KIND` · 2 `BAD_DECISION` · 1 each `BAD_JSON`/`BAD_ADOPTION_PROPOSAL`/`BAD_PROCESS`)
  — quarantined records are what did NOT reach the spine and are never added to the receipt
  count. **CORRECTED 2026-08-19:** this pack first carried 1,386, a number taken from a
  survey report rather than derived through the reader. The door's own `spineHealth()` says
  1,146, and `spine.mjs` is the authority (ADR-0030) — the day-file line count agrees with
  it exactly. The face's first live read against the real spine caught the discrepancy,
  which is the whole argument for deriving every number instead of quoting one.
- counts, DERIVED through `spine.query` 2026-08-19 (not quoted from a report):
  `note.logged` 918 · `approval.requested` 55 · `decision.recorded` 42 ·
  `phase.closed` 29 · `run.completed` 25 · `day.closed` 21 · `review.completed` 21 ·
  `lead.researched` 15 · `kickoff.done` 11 · `content.published` 4 · `commit.done` 2 ·
  `constitution.adopted` 1 · `develop.started` 1 · `slice.done` 1
- **zero ever**: `revenue.received`, `revenue.simulated`, `cost.incurred`,
  `incident.raised`, all `experiment.*`, all `policy.*` kinds, `council.verdict`,
  `month.closed` — a line/station for these renders DASHED with the honest label
  *fixture-proven, unexercised*
- today's receipts (2026-08-19): `kickoff.done` `01M0B8T4ZQ1APZK5SJ7331K1KS` ·
  `approval.requested{gate: kickoff}` `01M0B8T5F81RC6V06MRY289B6D` · `decision.recorded`
  (approve — reason: "pannu; WIP 6 vs guideline 2 acknowledged")

## Board (16 lanes · 7 LIVE vs guideline 2 — informational)

| lane | status | phase | appetite/burn | clock / note |
|---|---|---|---|---|
| bench | LIVE | 04 | 8d / 7.25d | guard NEXT-CHECK 2026-09-01 · production receipts 0 |
| engine | LIVE | 06 | 9.5d / 7.5d | Hermes v2026.8.3 hired · 3 dispatches, 0 accepted drafts · hermes `review_by` 2026-08-31 |
| face | LIVE | 03 | 32d / 4d | born 2026-08-19 (this build) |
| growth | LIVE | 06 | 10d / 8.0d | Google first discovered the site 2026-08-19; earliest honest read 2026-08-26 |
| leads | LIVE | 03 | 11d / 7.5d | rehearsal only — live send = owner keystroke pending |
| legal | LIVE | 00 | 5d / 0d | awaiting owner approval |
| scheduler | LIVE | 03 | 3d / 2.5d | proving week restarted 08-17 → runs to 2026-08-24 |

IDLE: absorb · develop · evolve · ledger · memory · model-policy · policy · portfolio ·
design. Mode B **NOT CERTIFIED**. Centuries claimed 0001–1399, next 1400.

## Needs-you (real, open — 13 as measured through the door 2026-08-19)

Folded through `arc-inbox.loadApprovals` — `approval.requested` 55 raised, 42 decided,
**13 still open**. This is the Inbox's real load, and it is the argument for the room: the
count was 2 in an earlier snapshot and nobody noticed it becoming 13.

| # | ULID | profile | what |
|---|---|---|---|
| 1 | `01KZR8PYW8280T0J2S9XAC8J31` | phase-done | approve moving past phase 00 in lane memory |
| 2 | `01KZTJ97KAYEY8JX8HN6ZMZ5D3` | phase-done | approve moving past phase 02 (arc-memory Cycle 11, cycle closed) |
| 3 | `01M05A4Y4QM54VRQWSNE9ENQMD` | phase-done | approve moving past phase 04 (engine lane) — the day-5 kill checkpoint is 0.5d away with REQ-02 uncertified |
| 4 | `01M07QQGNR0WQ2WNXXG7CZWVAR` | engine-escalation | escalate `commit-msg-draft` to a stronger tier |
| 5 | `01M07QZ879AGAAADFEMYQ7Q9Z5` | engine-escalation | escalate `commit-msg-draft` to a stronger tier |
| 6 | `01M07R90E9GGWYPJYHD2YVB51P` | engine-escalation | escalate `commit-msg-draft` to a stronger tier |
| 7 | `01M0ASG8JG8X6PQ0045MJ6TY8Q` | engine-escalation | escalate `build-in-public-draft` to a stronger tier |
| 8 | `01M0ASSN5SYARR7RJYRBSPN089` | engine-escalation | escalate `build-in-public-draft` to a stronger tier |
| 9 | `01M0B1T10NHH0AVR8MFGCKTJXA` | engine-escalation | escalate `build-in-public-draft` to a stronger tier |
| 10 | `01M0B22ZTZSCW41YSXJWJCQY76` | engine-escalation | escalate `build-in-public-draft` to a stronger tier |
| 11 | `01M0B663APQMV49EQR9AGR1WJQ` | draft-verdict | accept or reject build-in-public draft 1 of 3, with one line of reason |
| 12 | `01M0B6642HPE0S3PJ6DDF76CVV` | draft-verdict | accept or reject build-in-public draft 2 of 3, with one line of reason |
| 13 | `01M0B664M83R2SFF29SD3BXBSE` | draft-verdict | accept or reject build-in-public draft 3 of 3, with one line of reason |

Four distinct approval PROFILES are live here (phase-done · engine-escalation ·
draft-verdict · the growth gates when they reopen), which is what the Inbox's
profile-specific detail bodies exist for.

Refusal codes (verbatim, error states): `ALREADY_DECIDED` · `UNKNOWN_APPROVAL` ·
`BAD_REASON` · `WRONG_KIND`.

## Money (honest-empty — the hardest screen to design honestly)

- real revenue: **₹0 — 0 `revenue.received` receipts ever** ("mechanism proven, live
  value pending"); MRR —; kill-distance: **NOT EVALUATED** (no criteria receipt for a
  live venture month)
- costs: three lines (provider · infra · one-off) + Overhead — **never totalled**
- SIMULATED panel: watermarked, hatched-violet class, never co-rendered with real
- north-star: ₹/month per hour of the owner's attention — *not instrumented*

## Clocks the Tape flags (dated obligations, from the tree)

scheduler proving week → **2026-08-24** · growth earliest honest read → **2026-08-26** ·
hermes `review_by` → **2026-08-31** · bench guard → **2026-09-01** · council 002
Review-by → **2026-09-15** · T-01 `review_by` → **2026-11-09** · council 001 Review-by →
2027-02-02 · DPDP commencement → 2027-05-13/14

## Council chamber

sessions 2 · **001** CONDITIONAL/Medium → OUTCOME **UNRESOLVED**, Review-by 2027-02-02 ·
**002** NO/Medium (standard mode), Review-by 2026-09-15 · scored 0 · Brier — *(insufficient
evidence)* · roster 12 (3 stance · 1 researcher · 1 verifier · 7 experts) ·
`council.verdict` on the spine: **0 ever** (both sessions file-borne — station renders
dashed)

## Honest badges (verbatim, must appear where their room/line shows)

policy engine *fixture-proven, unexercised* · evolve *unexercised* · ledger *mechanism
proven, live value pending* · leads *rehearsal only, live send = owner keystroke pending* ·
engine *3 dispatches, 0 accepted drafts* · bench *production receipts 0* · Mode B *NOT
CERTIFIED*

## Vocabulary (verbatim — prettifying any of these is a VIOLATION)

`approval.requested` · `decision.recorded` · `run.completed` · `day.closed` ·
`note.logged` · `metric.observed` · stamp · chip · seal · lane · phase · appetite · burn ·
tripwire · century · spine · brief · inbox · kill line · proving week · needs-you ·
as-of · replay · SIMULATED · REHEARSAL · DRILL · EXPLORATORY
