# HOLE (fixed): an unterminated HTML comment hid both sections

- type: Pattern
- domain: legal case management
- user: solo-practitioner lawyer
- platform: desktop
- problem: closing one bypass with a regex that carried the same bypass
- confidence: medium
- outcome: unknown
- source: fixture — adversarial pass round 2, library lint

<!--
The first fix for the commented-heading hole required a closing delimiter, so deleting three
characters restored it. CommonMark runs an unterminated HTML block to end of document: a reader
sees nothing from here down, while a close-requiring regex saw an ordinary document with two
satisfied section contracts.

This fixture must never contain the closing delimiter, not even quoted in backticks. Writing it
out once here is exactly how the first cut of this file terminated its own comment and quietly
stopped testing anything.

## Principle

This prose is invisible on the rendered page and must not satisfy the principle contract here.

## Do not copy

This prose is also invisible and must not satisfy the do-not-copy contract for this entry.
