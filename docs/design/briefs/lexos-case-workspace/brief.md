# Design brief — LexOS case workspace (`/dashboard/cases/[id]`)

> Phase 03's pilot brief: the first brief arc writes for a product that is not arc. The surface
> is a shipped, tested, `design: PASS` feature in a separate repo
> (`E:/Work_Hub/01_Automemory/Lexos`), so this is not a rescue — it is an explore against a
> working baseline, which is the harder and more honest test of the system.
>
> Read fresh before writing this, as the phase requires: the two companion drafts
> `docs/design/2026-07-26-dashboard-clients.md` and `docs/design/2026-07-27-case-workspace.md`
> in that repo. Every number and token below is read out of them or out of
> `tailwind.config.ts`, never typed from memory.
>
> **Do not edit the LexOS repo.** It carries the owner's uncommitted Phase-04 work. This brief
> and the variants that follow read it and render it; they do not touch it.

- **date:** 2026-07-30
- **base revision:** `4784ac9`
- **tier:** M

## A. Interaction model

1. **The user's job, in ONE sentence.** — A solo-practitioner lawyer opens a case and knows, without hunting, what has happened on it and what is due next.
2. **The primary OBJECT of the product.** — **The case.** Answered by a real LexOS lawyer on 2026-07-29, receipt `01KYQ9B2BXMXWWADZZYVWXEGRT` — case, not client. This is the pre-designed PROVISIONAL fallback NOT being taken: the client is an attribute of a case, never the container the work lives inside.
3. **The primary ACTION on it.** — Advance the case: record what just happened (a hearing outcome, a filed document, a task closed) and set what is due next.
4. **What must be VISIBLE before that action.** — The case's status, the next hearing date, and whether anything on it is overdue. A lawyer deciding what to do next cannot be made to open a tab to learn the case is overdue.
5. **Progressive disclosure vs always-visible — the explicit split.** — Always visible: the case's identity (parties, case number where one exists), its status, its next hearing, its overdue count. On demand: the full hearing history, the document list, the task list, the notes. **This brief deliberately does not declare HOW that split is arranged** — the current build answers it with a five-tab rail, and whether that is the right shape is exactly what the three variants exist to disagree about.
6. **After success / failure / interruption / return — what does the user see?** — Success: the recorded fact appears in place, dated, with the case's next-due recomputed in the same view. Failure: the entry stays put with what failed and the next step stated inline. Interruption: switching sections must show a designed loading state — the shipped build has none (`force-dynamic` server components with no `loading.tsx`, so a tab switch is a bare wait), and `SKEL`/`SKEL_SOFT` already exist in the system for exactly this. Return: the case opens on what is due, not on whatever was last clicked.
7. **What becomes FASTER once the user has learned the product (expert path).** — Moving between sections and between the cases due this week without the mouse. Focus is already visible and measured on the rebuilt rail (2px inset `outline-ink`); what does not exist yet is a way to go from "this case is done for today" to the next case that needs him.

**The two known debts the shipped review escalated to the owner, and would not fix as polish.**
Both are IA decisions, both are named in the 2026-07-27 draft's *Not fixed, and why*, and both are
fair game for a variant to answer differently:

- **The content column is 416px from 1024px to infinity.** `max-w-shell` (48rem) minus a 16rem
  actions panel minus the gap, measured identical at 1024px and 1280px, while the same rows
  render at 689px on the list route. The layout stops using width above `lg`. The draft's own
  words: *"Dropping the sidebar is a product decision, not polish… it is the biggest remaining
  design debt in the feature."*
- **The actions panel has no internal hierarchy** and offers all four actions on every tab —
  four identical secondary buttons, of which one is relevant.

## B. Art direction

**Taste decided here, not researched.** LexOS's existing system already has a stance and it is a
coherent one: no drop shadows anywhere in the feature, separation by `line` borders, a single
radius token, empty states left-aligned on a quiet fill rather than centred in a dashed box, and
the dimmest ink in the system chosen as the dimmest that still passes AA. That is a records-first
instrument, not an app that wants to be liked. This brief keeps that stance and sharpens it —
departing from it would make the pilot a rewrite instead of an explore.

- **3 feel words:** exact · unhurried · durable
- **3 anti-words:** urgent · decorative · chatty
- **State matrix** (per surface): the case header and each section declare all five (empty · loading · error · success · disabled). Loading is the one that does not exist in the shipped build and must exist here — a section switch that shows nothing is not a loading state.
- **Slop kill-list:** no drop shadows (the system separates with `line`, and adding one would introduce a second visual language) · no gradient heroes · no emoji as iconography · no centre-everything empty states in dashed boxes · no raw enum text rendered to a lawyer (`ON_HOLD` shipped once already; `statusLabel()` exists) · no invented labels where court vocabulary exists · no colour as the only carrier of status
- **a11y floor:** contrast ≥4.5:1 · targets ≥44px · visible focus · reduced motion honoured
- **Declared contrast pairs** — every fg/bg pairing the direction relies on, read out of `tailwind.config.ts`:

| pair | fg | bg |
|---|---|---|
| body + headings | #111827 | #ffffff |
| secondary prose | #4b5563 | #ffffff |
| dimmest ink (placeholder) | #6b7280 | #ffffff |
| link idle | #374151 | #ffffff |
| primary button | #ffffff | #111827 |
| body on a receded card | #111827 | #f9fafb |
| destructive link + error text | #b91c1c | #ffffff |
| error panel text | #991b1b | #fef2f2 |
| warning badge | #78350f | #fffbeb |
| success badge | #166534 | #f0fdf4 |
| disabled surface | #ffffff | #6b7280 |

Two notes on that table, both deliberate. `disabled` (#6b7280 under white) is **4.83:1 — it
passes, and it is intentional**; the Phase-2 review earned that number on purpose because
Tailwind's reflex `gray-400` is 2.16:1, and it is not to be "cleaned up". And the table carries
**text pairs only**: `line-strong` (#d1d5db) is an input border, which owes 3:1 as a control
rather than 4.5:1 as text, and declaring it here would fail a floor that was never written for
it. Control-contrast is real and is out of this lint's scope — do not read its absence as a pass.

## C. Platform contract

| Surface | Required? |
|---|---|
| Desktop | yes |
| Mobile | yes |
| Tablet | no |
| Keyboard-first | yes |
| Reduced motion | yes |

Tablet is `no` by declaration, not by accident — but note the shipped review measured 768px and
1024px anyway while chasing the rail's reflow, and 768px is where the content column is at its
widest. A variant is free to use that; it just does not owe it.

## D. Content contract

- **Product nouns + object naming:** case · hearing · document · task · note · client · firm — the objects the app already ships and a lawyer already says out loud; the case is the container and the client hangs off it, per answer 2
- **Primary action verbs — the ones the product actually ships:** add · edit · remove · save · record · file. Checked against `app/` and `components/`, not recalled: a first draft of this line also declared *close*, *reschedule* and *reopen*, and all three appear in **zero** LexOS files. A variant may well need a verb that does not exist yet — the case status set has no "reopen" transition today — but it must introduce it deliberately and in court vocabulary, and this line is not the place to smuggle one in. Inventing labels here is the exact VIOLATION this section exists to prevent.
- **Voice + tone:** a court record, not an assistant — state the fact and its date; no exclamation marks, no encouragement, no "Great!"; the app never congratulates a lawyer for filing something
- **Terms users ALREADY understand:** hearing · case number · court · case type · filing · client · firm · the four shipped case statuses `INTAKE` · `ACTIVE` · `ON_HOLD` · `CLOSED` (rendered through `statusLabel()`, never raw) · ₹ amounts in Indian digit grouping (₹1,54,300) · dates as `27 Jul 2026`, the format the shipped rows already use. Every term above was grepped in the LexOS repo before it was written down — a first draft also listed *cause title* and *adjournment*, which are real Indian court vocabulary and appear in **zero** files of this product. Real-sounding is not the bar; the bar is that the user has already met the word here.
- **Sensitive / error / destructive-action language:** removing a hearing or a document names the thing and states that it cannot be undone, never a bare "Confirm"; a destructive link is never styled identically to a benign one beside it (`LINK_DANGER` exists because "Remove" once rendered the same grey as "Edit" 12px away); errors say what failed and what to do next
- **Content density rules:** one row per hearing, one per document, one per task · dates and amounts in tabular numerals so they align down a column · a row's meta separated by ` · ` consistently (the documents row currently uses a bare gap and the list row uses ` · ` — pick one) · a field that exists and is empty still shows, because an empty field is information in a legal record
