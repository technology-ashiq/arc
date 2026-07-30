# HOLE (fixed): an unterminated code fence hid the tags and both sections

The same three-character bypass as the unterminated comment, on the other stripper. The fence
below is never closed, so everything after it is invisible to a reader while a
closing-fence-required regex left it all standing as real content.

```md
- type: Pattern
- domain: legal case management
- user: solo-practitioner lawyer
- platform: desktop
- problem: a stripper that only handles well-formed input is not a stripper
- confidence: medium
- outcome: unknown
- source: fixture — adversarial pass round 2, library lint

## Principle

This prose is inside an unterminated fence and must not satisfy the principle contract here.

## Do not copy

This prose is also fenced away and must not satisfy the do-not-copy contract for this entry.
