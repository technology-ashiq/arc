# The PICK — explore `face-hq-v1`

**Decided 2026-08-19 by the session, under the owner's explicit delegation** ("ella phases
fulla complete pannu, neeye decide pannu … arc unaku than nalla theriyum ena vida").
ADR-1308 assigns this to the owner; the owner assigned it here, in writing. It is recorded
as a receipt like any other decision and can be overturned by a later one — a delegated
call is still a call somebody can read and reverse.

I looked at all four rendered pages myself before deciding. That is not a formality: Cycle 3
scored 23/100 on work judged entirely through agent reports about pixels nobody had opened.

---

## The pick

**variant-a — the command center — is the structural base**, with two named grafts:

1. **variant-b's drawn Map** becomes the Map room.
2. **variant-c's receipt drawer and its seal-rendered-as-prose** become the shared
   components wherever a receipt or a seal appears.

## Why a, and not the two that beat it on individual cards

- **It is the only item no juror placed below second** (1st · 2nd · 1st, 11 points). Both
  rivals have a last place on someone's card; a has none.
- **It answers the job the brief actually states** — run the company in 30–60 minutes a day,
  primary object the receipt, primary action decide. Everything is one surface with no
  routes, so deciding never costs a navigation.
- **The live spine settled it.** The design fixture said 2 open approvals; the real number is
  **13, across four distinct profiles** (phase-done · engine-escalation · draft-verdict ·
  growth gates). variant-c's thesis — one approval at full depth, the queue collapsed to a
  rail — is beautiful and does not survive that: thirteen items one-at-a-time is thirteen
  navigations. variant-a's split of ready-to-decide from already-settled, most-at-risk
  first, is exactly the shape a real queue needs. The winning argument came from the
  product's own data, not from taste.

## Why the two grafts, rather than a clean single thesis

- **The Map.** variant-a's weakest zone by its own jurors' description; variant-b's transit
  map is the strongest single artifact anyone produced. A Map is a *room*, not a layout —
  ADR-1304 has lines and stations declared in manifests and rendered by the app, so which
  room draws them is independent of the shell that holds them. Taking b's Map costs a
  nothing structurally and fixes its one soft spot.
- **The receipt drawer and the seal.** variant-c's deepest strength: the drawer shows
  canonical JSON with the supersedes chain, and the seal is rendered as *explained prose*
  rather than a lock glyph — which is the whole point of a seal (it must say which article
  forbids the button, or it is decoration). Both are components, and components travel.

## What variant-a must fix before its tokens become canonical

- Its `LIVE` badge renders in the green the brief reserves for **real money**. That is a
  reserved-colour violation and a one-line fix. Reserved meanings are not style: amber =
  needs-you, green = real money, red = incident, hatched violet = every non-real class.
- All four items render the stale `1,386` receipts figure. In the built face every number is
  derived at read time through the door, so the class cannot survive into L3 — but the
  design system must not bake a literal anywhere.

## The PREDICTION — falsifiable, and scored in Phase 08

> **With variant-a's structure, ≥80 % of the owner's `decision.recorded` events during the
> five dogfood days will be preceded only by `/api/brief` and `/api/inbox` reads — no room
> navigation between opening the face and stamping.** And the median face-time to clear a
> day's open approvals will be **≤5 minutes**.

Both are measured from L2's own request journal against the spine's decision receipts, which
already exist and need no new instrumentation. If the owner routinely navigates into rooms
before deciding, the command-center thesis was the wrong read of the job and the ranking
flattered it — that is what would falsify this, and it is worth knowing.

Recorded as `decision.recorded` on the canonical spine; the ULID is the receipt this
document is the reasoning for.
