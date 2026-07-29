# HOLE (fixed): a closing fence the reader does not accept

- type: Pattern
- domain: legal case management
- user: solo-practitioner lawyer
- platform: desktop
- problem: getting the opener grammar right and the closer grammar wrong
- confidence: medium
- outcome: unknown
- source: fixture — adversarial pass round 3, library lint

```md
CommonMark forbids an info string on a CLOSING fence, so the line below does not close this
block: for a reader it runs to end of document and everything after it is code, not content.
A lax matcher ended the block there and read the two headings below as satisfied contracts —
the same quoted-contract hole as `held-tags-in-fence.md`, entered from the other end.
```js

## Principle

This prose sits inside an unterminated code block for a reader and must not satisfy the
principle contract here, however plainly the raw text appears to contain it.

## Do not copy

This prose is also inside that block and must not satisfy the do-not-copy contract either.
