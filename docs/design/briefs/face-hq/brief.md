# Design brief — arc face v1 (the working HQ)

> Lane `face`, Phase 00. Design source: `docs/strategy/plans/PLAN-face.md` (owner-landed
> 2026-08-18). This brief is the contract the director, composers, critic and jury work
> against in Phase 01; `design-lint` enforces it. The working name in the UI is just
> **arc**.

- **date:** 2026-08-19
- **base revision:** `09c563f`
- **tier:** L

---

## A. Interaction model — 7 answers, no pixels until they exist

1. Run a one-person AI company in 30–60 minutes a day: see what needs him, decide it
   with a reason, and read what the company did while he was away.
2. The **receipt** (a spine event with a ULID) — every panel is a view over receipts and
   sanctioned files, and every number opens its receipts via *Why?*.
3. **Decide** — approve or reject an `approval.requested` with a mandatory typed reason
   (the Stamp, the product's only write).
4. Today's brief with needs-you first (never collapsed), what is in flight (the Map),
   and what changed since he left (the cursor diff "since you left: N receipts, M need
   you") — plus, on the card itself, the approval's full profile detail body.
5. Always visible: needs-you count, money strip, data mode (live/replay/sim), the tape
   ruler, the arc ring. Disclosed: room → station → receipt drawer (canonical JSON, sha,
   supersedes chain); ⌘K jumps anywhere (rooms, kinds, ULIDs, commands, concepts).
6. A landed stamp animates once (200 ms), prints the `decision.recorded` ULID on the
   card, and the card slides into the receipts feed; a refused decision shows the CLI's
   code verbatim (`ALREADY_DECIDED`, `UNKNOWN_APPROVAL`, `BAD_REASON`); walking away
   loses nothing because state is the log; coming back opens on "since you left: N
   receipts, M need you".
7. Keyboard-first: `j/k` move · `a/r` stamp (reason prompt) · `w` why · `t` tape · `/`
   search — a morning triage without touching the mouse; the map answers "enna
   nadakuthu?" in one glance without opening a session.

## B. Art direction

Direction to beat (not the answer — three theses are explored blind in Phase 01, per
ADR-1308): **"Ink & Signal"** — ink surfaces (near-black) with a paper mode for printing
the brief; ONE accent reserved for *needs-you* (amber); money-real green; incident red; a
single hatched violet family for every non-real class (simulated / rehearsal / drill /
exploratory) so the eye can never confuse them with truth; humanist sans for prose +
monospace with tabular numerals for receipts, hashes, ULIDs, ₹; hairline rules, 8-pt
grid, no shadows, no gradients; motion only on state change (200 ms), reduced-motion
honoured; the stamp and the seal are the two permitted skeuomorphs because they carry
meaning.

- **Reference bar** — the craft level the critic and blind jury judge against:
  - **Linear** (the app) — density + calm + keyboard-first: proof that a dark, dense
    operations tool can feel sovereign instead of dashboard-y. *(Also the jury's
    unlabelled fourth item.)*
  - **Vignelli's 1972 NYC subway map** — the Map's bar: ruthless geometric legibility
    over geographic truth; every line distinguishable at a glance.
  - **Stripe's balance page** — the Money bar: real money rendered with restraint,
    honest states, and zero chart junk.
- **At its best, this is…** the cockpit of a company you can trust with your eyes
  closed — every number traceable, every silence honest, every decision one keystroke
  and one reason away.
- **3 feel words:** sovereign · legible · alive
- **3 anti-words:** dashboard-y · glow · toy
- **State matrix** (per surface): empty · loading · error · success · disabled
  — empty is honest-empty text (a kind that never fired says so in words); error renders
  the refusal code verbatim; disabled is the sealed state (lock + the article/ADR).
- **Slop kill-list** (product-specific, beyond the generic list):
  - an invented number, ETA, or health emoji where the tree has none (protects: every
    number has a receipt)
  - a summed figure that mixes real with simulated/rehearsal/drill (protects: E3 honesty
    classes — hatched violet, never co-rendered)
  - a chart that decorates instead of answers (protects: density with purpose — the KPI
    tile's *Why?* is the feature, not the sparkline)
  - a button styled onto a forever-human act (protects: seals — the UI's honesty about
    what it cannot do IS the design)
  - purple gradients, glassmorphism, emoji status, mascots, particles (protects: an
    instrument, not a toy)
  - prettified vocabulary — "Approval Request" for `approval.requested` (protects:
    verbatim nouns, A5)
- **a11y floor:** contrast ≥4.5:1 · targets ≥44px · visible focus · reduced motion honoured
- **Declared contrast pairs** — every fg/bg pairing the direction relies on:

| pair | fg | bg |
|---|---|---|
| prose on ink | #E8E6E1 | #101114 |
| muted meta on ink | #9CA3AF | #101114 |
| needs-you amber on ink | #FFB020 | #101114 |
| money-real green on ink | #4ADE80 | #101114 |
| incident red on ink | #F87171 | #101114 |
| non-real violet on ink | #A78BFA | #101114 |
| prose on paper | #1A1B1E | #F7F5F0 |
| needs-you amber on paper | #92400E | #F7F5F0 |

## C. Platform contract

| Surface | Required? |
|---|---|
| Desktop | yes |
| Mobile | no |
| Tablet | yes |
| Keyboard-first | yes |
| Reduced motion | yes |

(Mobile read+stamp is a later cycle per the design source's platform contract — v1 is
desktop-first, tablet yes, localhost+token, works offline read-only on the last synced
cursor.)

## D. Content contract

- **Product nouns + object naming:** arc's own words **verbatim** — kinds
  (`approval.requested`, `run.completed`), gates, lanes, ADR ids, station names exactly
  as the commands/scripts that perform them. Never renamed, never prettified.
- **Primary action verbs:** the CLI's verbs — approve · reject · emit (never in UI) ·
  run (chip only) · close (chip only) · scrub · ask.
- **Voice + tone:** terse, honest, dated. Every state names its evidence or its absence
  ("0 receipts ever", "ABSENT (no criteria receipt)", "not instrumented").
- **Terms users ALREADY understand:** receipt · stamp · seal · chip · lane · phase ·
  appetite · burn · tripwire · century · spine · brief · inbox · kill line · proving
  week · dogfood — the company's living vocabulary, already in daily use.
- **Sensitive / error / destructive-action language:** refusal codes verbatim; real vs
  SIMULATED / REHEARSAL / DRILL / EXPLORATORY always labelled (E3); PII never (keyed ids
  only — draft/ticket bodies never from the spine); ₹ in paise-derived integers; IST
  everywhere.
- **Content density rules:** high density, 8-pt grid; needs-you never collapses; the
  brief's 40-line collapse rules honoured; monospace tabular numerals for every id and
  amount; realistic content mandatory in variants (real lane names, real kind names,
  real-length ULIDs, ₹ amounts) — placeholder filler text of any kind is a VIOLATION.

### Signature screens (8) — the explore set

Today · Inbox · Map · Spine/Tape · Council room · Money · Board · Ask arc
