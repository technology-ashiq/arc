# VERBS PENDING -- after Phase 05 (face v2 Cycle 16, ADR-1339)

Every verb v0.7 draws that the face does not perform yet. It is Phase 03's five lists (`evidence/phase-03/verbs-pending-*.md`, frozen
as Phase 03 left them) minus each card a work-door op has retired: an op row in `.claude/scripts/hq/face-ops.mjs` names
the card it retires in `retires`, and the card leaves its fold in the same change.

Derived, never typed: `tests/face/module-frame.mjs` holds these rows equal to the folds' `verbPending()` entries, both
ways, AND to Phase 03's rows minus the registry's retirements -- so a card can neither vanish without an op that
retires it nor be invented. The browser suite counts the same cards in the page, per room.

| module | verb | what it would do |
|---|---|---|
| `absorb` | Absorb something | A candidate tool, skill, repo or dependency is captured, studied read-only, reported and vetted before anything installs. Capture arrives with the work door. |
| `bench` | Add a model to the bench | A model joins as a challenger, runs its scorecard, and a win becomes a promotion proposal in your inbox. Every step arrives with the work door. |
| `evolve` | Open an experiment | One declared surface, one metric, one hypothesis, written before the first batch. Opening, measuring and concluding arrive with the work door. |
| `memory` | Log a correction | A correction is counted against its earlier repeats by its normalized text; the second one makes it proposable as a rule. Logging arrives with the work door. |
| `memory` | Recall | How did we get burned by this before: a fold over the lessons, the trial ledger and the receipts, with no model and no spend. It runs through the work door. |
| `model-policy` | Propose a tier change | A tier change is a reviewed diff to the router file citing ADR-0069, raised to your inbox for a stamp; the route keeps its tier until you stamp. The face raises it once the work door exists. |
| `policy` | Propose a cap, or demote a pair | A cap rises only on your stamp, citing trial-ledger evidence; a demotion needs no key at all. Both reach the policy through the work door. |
| `policy` | Declare a subject | A new subject is a reviewed diff to hq.policy.yaml and is born at the lowest acting level: no row in the policy file, no job. |
| `scheduler` | Fire now, pause or resume a job | A fire is idempotent per slot, and a pause lets the slot pass with no catch-up. Both are verbs of the work door; today the clock runs from hq.jobs.yaml alone. |
| `scheduler` | Register a job | A job is a reviewed diff to hq.jobs.yaml that names a policy subject, and jobs-lint refuses an illegal schedule before anything runs unattended. |
| `agents` | Add an agent | An agent joins the roster with its tier declared at birth; the tier forces the ADR-0069 citation, and changing one later is a reviewed diff. It arrives with the work door. |
| `council-chamber` | Convene the council | Seats argue blind and in parallel, a verifier grades every point, one bounded rebuttal follows, and the verdict commits with its dissent. Convening arrives with the work door. |
| `design-studio` | Submit a surface | One surface goes out to three explores, each with a thesis it must differ by, before anything is judged. Submitting arrives with the work door. |
| `design-studio` | Run a critique, or convene the jury | The critique is read-only and may fail work for insufficiency, not only for breaking a rule; the jury ranks blind, with a reference item it is not told about. Both arrive with the work door. |
| `develop` | Open a slice | A named unit of the live phase, open until it is proven: tests green AND the owner saw it run. Opening and proving arrive with the work door. |
| `develop` | Close a phase on evidence | The close is refused unless the Definition of Done computes, and the refusal is itself a receipt that says what is missing. It arrives with the work door. |
| `executor` | Hire someone | A hire is a session: the four tenure terms are mandatory, the certification runs, and the row lands only on your approval. The work door starts it; the session itself runs through the session door. |
| `executor` | Dispatch a task | A task goes to a certified hire under its cap, and its draft comes back through a judge. It arrives with the work door. |
| `executor` | Terminate a hire | A hire past its tenure date is refused by name and proposed for rejustify-or-retire; ending one is a recorded decision, never a quiet edit to its row. It arrives with the work door. |
| `factory` | Switch the profile | One key switches every gate as a set, with a reason written down; loosening is a profile switch, never a flag somebody remembers. It arrives with the work door. |
| `review-ship` | Review a commit, or run qa | A review is keyed to the commit it read: a new commit is a new review. Running one from here arrives with the work door. |
| `review-ship` | Ship | A ship is the last gate passing, not a button that skips the others; loosening any gate asks you to say why, in writing. It arrives with the work door. |
| `toolbelt` | Pin a tool to the top of this room | A pin is a receipt, so the room remembers what the owner reaches for most. It arrives with the work door. |
| `growth` | Draft a piece | content.drafted, with the slop lint run as you type: it catches bad patterns and never prescribes a style. It arrives with the work door. |
| `growth` | Send the review pack to your inbox | Gate one: one inbox item bundling the preview, the lint results and the diff; your stamp pins the draft's sha. It arrives with the work door. |
| `leads` | Research a lead | lead.researched, with its geography riding on it for the jurisdiction guard, keyed by an HMAC id and never a raw contact. It arrives with the work door. |
| `leads` | Send today's outreach | A capped daily send, confirmed by your keystroke: approval authorises a send attempt, never a send, and the caps, suppression and jurisdiction are checked at the moment of use. |
| `leads` | Move a lead along the funnel | Mark a reply, book a meeting, record a win or a loss -- each a receipt, and a reply stops every later touch at once. It arrives with the work door. |
| `leads` | Suppress a lead | lead.suppressed is honoured at once and survives every campaign: a suppressed lead is never contacted again, and there is no way to reset it. |
| `legal` | Change a gate's mode | A gate's mode changes by a reviewed diff to arc.gates.yaml -- never an agent's action -- and the change is a receipt. It arrives with the work door. |
| `legal` | Run the legal lints | The publish gate, claims that need a source, the PII tripwire and the hash-chain verify, each result landing as a receipt. It arrives with the work door. |
| `legal` | Stamp the full-read gate | Nothing ships under the owner's name until a person has read it in full and stamped it; the stamp is the gate. It arrives with the work door. |
| `money` | Record real revenue | revenue.received is recorded by a person's hand only, through the ledger's ingest; the first one opens the green gate and resets the kill clock. It arrives with the work door. |
| `ventures` | Register a venture | venture.registered makes a candidate, and its kill line is written before its first launch. It arrives with the work door. |
| `ventures` | Stage a venture | Kickoff, building, launched, live -- each move a receipt, and the venture track wins every tie. It arrives with the work door. |
| `ventures` | Propose a kill review | A kill is a stamped decision: the attic with a retro, components harvested, the lesson pinned -- never a deletion. The proposal lands in your inbox with the work door. |
| `concepts` | Define a term | A term is homed in a room and a station on its line, as a reviewed edit to the contract -- the palette finds it the moment it lands. It arrives with the work door. |
| `org` | Set a lane's status | A lane's status is its PROGRESS header; changing it -- awake, idle, blocked on a named thing -- is a reviewed edit that lands as a receipt. It arrives with the work door. |
| `org` | Birth a lane | Only /arc-kickoff births a lane: it claims the next ADR century and lands the lane's room in the same change. The work door will start that ceremony from here. |
| `strategy` | Adopt a plan | A plan becomes a lane's live plan at /arc-kickoff, and the lane's previous plan becomes history in the same change; the adoption is a receipt. It arrives with the work door. |
| `strategy` | Record an ADR | An ADR takes the next free number in its lane's century, never the company's highest-plus-one, and lands as a reviewed file. It arrives with the work door. |
