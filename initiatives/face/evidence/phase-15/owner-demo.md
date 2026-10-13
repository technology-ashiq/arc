# Phase 15 -- owner demo (live, main clone)

- **When:** 2026-10-13, main clone at `b509f261` (all of 15, 16 and 17 merged).
- **Server:** the owner's own `node .claude/scripts/hq/arc-face.mjs`, started from Git Bash, at `http://localhost:5180`.
- **Who read it:** the owner handed the agent the running URL and said "neeye check pannu pages" (check the pages
  yourself), then "sari pannu" (go ahead) to the close. The agent read the page in a headless browser; the owner
  did not look at the pixels himself. Stated plainly so nobody reads this as the owner's own eyes.

## Money room (`#/money`)

- The room header reads **`2 not instrumented`**. No `unknown` count is shown, which is the contract: a zero count
  shows nothing, never a silent default.
- DOM census of `[data-availability]` on the room: **3 `served` · 2 `not-instrumented`**.
- The two `not-instrumented` panels are "The milestone line" (owner: plan) and "Where money comes from"
  (owner: ledger). Each names its source route and its owner lane, as REQ-19 requires.
- Real money still reads "revenue.received has never fired. Not zero rupees measured -- no measurement exists".

Verdict: REQ-19's on-screen counts and per-field sources hold on the live surface.
