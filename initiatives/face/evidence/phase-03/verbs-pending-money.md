# VERBS PENDING — money ring

Phase 03, ring 4 of 5 (face v2 Cycle 16, ADR-1326). Every verb v0.7 draws in the money ring's rooms that the face
does not perform yet: each arrives with the work door in Phase 05, and until then its panel draws a card saying so
rather than a form that writes nothing.

Derived, never typed: `tests/face/module-frame.mjs` folds every money module and requires the rows below to EQUAL
the `verbPending()` entries the folds return, both ways. The smoke counts the same cards in the page per room.

| module | verb | what it would do |
|---|---|---|
| `growth` | Draft a piece | content.drafted, with the slop lint run as you type: it catches bad patterns and never prescribes a style. It arrives with the work door. |
| `growth` | Send the review pack to your inbox | Gate one: one inbox item bundling the preview, the lint results and the diff; your stamp pins the draft's sha. It arrives with the work door. |
| `growth` | Merge and publish | Gate two: a person merges, and content.published carries the sha read from the merged tree -- unedited means the approved sha and the published sha match. The machine writes the branch; it never merges. |
| `leads` | Research a lead | lead.researched, with its geography riding on it for the jurisdiction guard, keyed by an HMAC id and never a raw contact. It arrives with the work door. |
| `leads` | Send today's outreach | A capped daily send, confirmed by your keystroke: approval authorises a send attempt, never a send, and the caps, suppression and jurisdiction are checked at the moment of use. |
| `leads` | Move a lead along the funnel | Mark a reply, book a meeting, record a win or a loss -- each a receipt, and a reply stops every later touch at once. It arrives with the work door. |
| `leads` | Suppress a lead | lead.suppressed is honoured at once and survives every campaign: a suppressed lead is never contacted again, and there is no way to reset it. |
| `legal` | Change a gate's mode | A gate's mode changes by a reviewed diff to arc.gates.yaml -- never an agent's action -- and the change is a receipt. It arrives with the work door. |
| `legal` | Run the legal lints | The publish gate, claims that need a source, the PII tripwire and the hash-chain verify, each result landing as a receipt. It arrives with the work door. |
| `legal` | Stamp the full-read gate | Nothing ships under the owner's name until a person has read it in full and stamped it; the stamp is the gate. It arrives with the work door. |
| `money` | Record real revenue | revenue.received is recorded by a person's hand only, through the ledger's ingest; the first one opens the green gate and resets the kill clock. It arrives with the work door. |
| `money` | Set a venture's kill criteria | Criteria are written at kickoff into ventures.yaml and approved by your stamp; a change is a reviewed diff, never an edit on a screen. It arrives with the work door. |
| `money` | Close the month | month.closed seals a month's P&L so it replays to the same figures for ever. It arrives with the work door. |
| `ventures` | Register a venture | venture.registered makes a candidate, and its kill line is written before its first launch. It arrives with the work door. |
| `ventures` | Stage a venture | Kickoff, building, launched, live -- each move a receipt, and the venture track wins every tie. It arrives with the work door. |
| `ventures` | Propose a kill review | A kill is a stamped decision: the attic with a retro, components harvested, the lesson pinned -- never a deletion. The proposal lands in your inbox with the work door. |

PLAN-face-v2 §5.2 names the money ring's Phase 05 verbs as ingest, criteria and close month (`money`), draft →
review pack → publish (`growth`), the capped daily send (`leads`), the full-read gate stamp (`legal`) and register
and kill review (`ventures`); every one of them is a row above. The planned rooms' flows are not here: they are
REHEARSAL and never reach the work door (`rehearsal-money.md`, ADR-1328).
