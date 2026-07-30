# Blind-test package — `lexos-case-workspace-v1`

**Ready to send.** Three directions, arc's authorship undisclosed, notes stripped.
This file is INTERNAL — never send it. The two framing blocks below are what gets sent.

## Mapping — internal only

| Sent as | Actually | sha256 of the sent file | Post-strip critique |
|---|---|---|---|
| `direction-1.png` | variant-c | `68b2e14c0de10c77` | PASS, 0 violation (unchanged by the strip — c never had a note) |
| `direction-2.png` | variant-a | `b69d9d175785bb0d` | PASS, 0 violation, seam clean |
| `direction-3.png` | variant-b | `ad50b5621daa1aa3` | PASS, 0 violation, seam clean |

**Order is deliberate.** variant-b is the owner's pick and the jury's 2–1 winner, so it is placed
**last**, not first. If it still wins, it won against position rather than with it.

**The sha256 above is of the archived PNG file itself** — these exact bytes are what respondents
saw, and that is the evidence. Note that variant-b's *renderer* does not reproduce its hash
reliably (`ad50b562` ×6, `295dd98e` ×1, refused ×4 across ~11 runs); the archived file is fixed
regardless, and no claim of render reproducibility is made for it anywhere.

## Known tell, left in on purpose

All three pages end with a reference section rendering the empty / loading / error / success /
disabled states. It is process-facing and it does mark these as mockups — but **all three carry
it**, so it biases no comparison. The width-departure notes were stripped precisely because only
two of three carried them. The framing below names the mockup nature outright, which turns the
appendix from a tell into something expected.

---

## SEND THIS — Stream A (designers)

> I've got three different design directions for the same screen and I can't pick between them.
> Would you take a look?
>
> It's a case workspace for litigation lawyers in India — the screen where a lawyer opens one
> court case and sees what has happened on it and what is due next. The three take genuinely
> different views of what the page is *about*, not just different styling.
>
> These are static mockups, so nothing clicks. Each one ends with a reference section showing
> the empty / loading / error / disabled states — that's for completeness, ignore it if it isn't
> useful to you.
>
> What I'd like to know:
> 1. Which of the three would you take seriously as a real product direction, and which wouldn't
>    you? (It's fine if that's all three or only one.)
> 2. Rank them, and say why in your own words.
> 3. Anything that looks off, unfinished, or like it wouldn't survive real data.
>
> No wrong answers and no need to be gentle — blunt is more useful.

**Fill results into** `../stream-a-designers.md`. **PASS bar: ≥2 of 3 directions taken seriously.**

---

## SEND THIS — Stream B (practising lawyers)

> Could I borrow ten minutes? No prep needed, and there's nothing to fill in.
>
> I'll show you three versions of the same screen — a case workspace, the page where you open one
> case and see where it stands. They're pictures, not a working app, so nothing clicks.
>
> All I want to know is: **looking at each one, can you tell what has already happened on this
> case and what you'd have to do next?** Then which of the three you'd rather actually work in.
>
> Say whatever comes to mind as you look, including if something makes no sense.

**Rules for whoever runs this — these decide whether the evidence counts:**

| Rule | Why |
|---|---|
| Give **no** hints, no clarifying, no "try the thing on the left" | The bar is *task completed **without intervention***. The moment help is given, that attempt is a FAIL and gets recorded as one |
| Never say arc, AI, or that you made it | Someone who knows is answering a different question |
| Write down where they hesitated, not just the answer | The hesitation is the finding; the ranking is only the summary |
| Record a dissenting or confused response in full | A tidy result nobody argued with is the least useful kind |

**Fill results into** `../stream-b-users.md`. **PASS bar: the task completed without intervention.**

---

## After results arrive

Emit one `note.logged` per stream — command and field meanings in `../../README.md`. Two
receipts, never one merged receipt. Each must carry `scores: 01KYRX3HYM2BYMHKEZZD1RDHN9`, the
decision holding the owner's pick and prediction, or the prediction can never be settled.
