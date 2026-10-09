---
name: outreach-draft
description: Drafts one first message to one researched lead, built from the lead's own research record and the approved offer. It never sends anything. Every draft goes to the owner as an approval, and arc-leads sends only what was approved. Use when the SDR / outbound role has a researched lead and no message out yet.
---

# Outreach draft

This skill gives the SDR / outbound role its hands on top of `arc-leads`. The script already does the
research and the sending. The skill writes the one thing in between that no script can: the message.

## Inputs, and nothing else

- **The lead's research record** from `arc-leads`, which is the `lead.researched` receipt. Every
  personal detail in the draft must appear in that record. Nothing is invented.
- **The approved offer** for the campaign, taken from the campaign file `arc-leads` reads.

## The draft

- It is at most 90 words, in plain language, with one specific observation about the lead taken from
  the research record and one question.
- It carries no price and no promise of terms. Pricing is E2, and "changing prices" belongs to the
  owner alone.
- It makes no claim about the product that the product cannot demonstrate today.

## The path it takes

Hand the draft to `arc-leads` as a proposal. `arc-leads` raises the `approval.requested` for it. The
owner approves or rejects it in `arc-inbox`, and only an approved draft is ever sent, as
`outreach.sent`. Rejections and their reasons are this role's most useful signal. `org review`
counts them against the role.

## Never

- Never send.
- Never write under the owner's name to a public channel. This is a one-to-one message sent after the
  owner approves it.
- Never contact a lead that has no research record.
