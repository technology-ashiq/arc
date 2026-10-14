---
name: support-reply
description: Drafts a reply to one customer support message. Every answer is grounded in the venture's own documentation or a receipt, and anything the docs do not cover is escalated rather than guessed. The draft goes to the owner as an approval and is never sent directly. Use when a support message arrives for a staffed venture.
---

# Support reply

Department I (Customer Success & Support) had nothing at all before this skill (ADR-1608). Its job is
narrow on purpose: answer what is known, and escalate what is not.

## Classify first

Put each message in exactly one class:

1. **How-to.** The venture's docs answer it. Reply with the steps and link the page.
2. **Bug.** The customer describes behaviour the docs say should not happen. Reply to acknowledge it,
   and hand the report to Support L2 as a `handoff.ready` artifact with the steps to reproduce it.
3. **Money, refund, price or legal.** These are E2 or owner territory. Reply only to acknowledge that a
   person will answer, and escalate to `human:ashiq`.
4. **Unclear.** Ask one clarifying question and nothing else.

## The reply

- It uses the customer's own words for the problem and the venture's docs for the answer.
- It makes no promise of a date, a fix or a credit.
- Every claim cites a docs page or a receipt. A claim that has no citation is removed from the draft.

## The path it takes

The draft becomes an `approval.requested` on the role's seat. The owner approves it and then it is
sent. Escalations go to the card's `escalate_to`.

## Never

- Never send.
- Never share another customer's data.
- Never guess at a policy. Escalate instead.
