# ADR 1014 — The voice exemplars are machine-drafted candidates the owner approves once, never a writing task

**Status:** accepted
**Date:** 2026-08-12
**Product:** `growth`
**Reversibility:** two-way
**Revisit trigger:** the first cluster's drafts read like nobody in particular wrote them — then
the exemplars were too generic to anchor anything, and they are replaced with real writing the
owner supplies.

## Context

Pre-kickoff gate row 5 asks for "2–3 Ashiq-approved sample articles (the voice anchor)" placed in
the lane, and ADR-1110 makes those files **the only style input** to generation — there are no
style rules in prompts beyond them. The row is unevidenced (ADR-1103), so this cycle must produce
them.

The obvious reading is "the owner writes three articles first". That is a multi-hour writing task
standing between today and any generation, and it inverts the point of the module: growth exists
to reduce the owner's hours, not to open with a demand for them (Constitution A3).

## Options considered

1. **The machine drafts 2–3 candidate exemplars; the owner approves or rejects in one inbox item.**
2. The owner writes them. Con: hours of writing before any code runs, on the critical path of a
   10-day cycle.
3. Use existing arc prose — ADRs, retro entries, `PORTFOLIO.md` rows — as the anchor. Con: that is
   internal engineering register written for one reader who already has the context; an article for
   a stranger arriving from a search result is a different job. Worth *mining* for voice, not
   worth shipping as the anchor.

## Decision

**Option 1**, with option 3 folded in as the raw material. The candidates are drafted from arc's
existing written record — the register in the ADRs, retros and plans, which is the only large
sample of how this company actually writes — and rendered as three real articles on real subjects
from the cluster.

They land as **ONE inbox item**: three candidates, approve-with-selection or reject-with-reason.
Approved files are versioned at `initiatives/growth/exemplars/` and are inputs to every generation
run thereafter.

**This is not a third human gate.** It is a one-time setup approval, enumerated as such in
ADR-1112 — it happens once for the lane's lifetime, not per article or per cluster.

If the owner rejects all three, the fallback is option 2 and it is his call to make at that point,
with three concrete things to react to rather than a blank page — which is the cheapest form the
question can take.

**Evidence:** design source gate row 5, REQ-02 (exemplar-anchored drafting; no style rules beyond
them) · `CONSTITUTION.md:41` (A3) · ADR-1110 (exemplars are the only style input) · ADR-1112 (the
one-time/recurring distinction).
**Confidence:** medium — whether machine-drafted exemplars can anchor a voice they are also
imitating is genuinely unproven. Tracked as Assumption A-06; its trigger is the first cluster's
drafts reading generic, and the fallback is written above rather than improvised.
**Rejected because:** option 2 puts hours of owner writing on the critical path; option 3 ships an
internal register to an external reader.

## Consequences

Easier: nothing in this cycle waits on the owner writing anything. Harder: there is a real risk the
machine's own voice becomes its own anchor and the loop closes on itself — which is precisely what
Assumption A-06 exists to catch, and why the fallback is named before it is needed.
