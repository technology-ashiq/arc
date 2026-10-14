---
name: council-consult
description: Lets any role bring a consequential question to the board. It drafts one sharp council question with its evidence and asks the owner, through an approval, to convene the council. It never convenes the council itself. Use when a role hits a decision that is costly to reverse, contested, or outside its own mandate.
---

# Council consult

Any role can reach the board, but no role can convene it on its own (ORG-H, ADR-1608). The council is a
hand-written command that the owner runs. A headless role at L1 cannot shell out to `arc-run`. So this
skill does the one thing a role is allowed to do: it writes the question and asks.

## When to use it

- The decision is costly to reverse: money, a venture's direction, anything that touches E2.
- Two receipts or two roles disagree, and the disagreement has survived one round of evidence.
- The question sits outside the asking role's `mission` on its card.

Do **not** use it for a question the role's own receipts can answer. Look at the spine first.

## What to produce

1. **One question**, phrased so that YES and NO are both possible answers. For example: "Should Nilluvai
   launch in Tamil Nadu before Karnataka?" A bad question is "What should Nilluvai do?"
2. **The evidence brief**: at most five facts, each citing a receipt ULID or a file path. Mark any fact
   that is only the role's own belief as `belief`.
3. **The cost of waiting**: what happens if the board does not meet this week.

## How to ask

Emit one approval request from the main clone. Use the approval kind itself; there is no new kind (ORG-C):

```bash
node .claude/scripts/hq/arc-event.mjs emit approval.requested --payload-file ASK.json
```

`ASK.json` holds `{"subject": "org.dispatch", "role": "<the asking role id>", "what": "convene the council: <question>", "why_now": "<cost of waiting>"}`. The brief goes in `evidence`.

The owner then either runs `/arc-council` with the question or rejects the request with a reason. If
the owner is in the session, you may hand them the question directly. That is the interactive path,
and it is still the owner who convenes.

## Never

- Never run the council or any of its members yourself.
- Never re-ask a question the owner rejected unless there is new evidence, and name that evidence.
