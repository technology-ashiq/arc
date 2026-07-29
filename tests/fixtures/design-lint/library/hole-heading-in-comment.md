# HOLE (fixed): both required sections exist only inside an HTML comment

<!--
  Found by the library lint's adversarial pass. The twin of the fenced-heading hole in the
  brief lint: the tags are real and visible, but BOTH required headings live inside this
  comment block. A reader opens the entry and finds no principle at all; the section scan
  found two satisfied contracts. Fixed by parsing structure on one text with fences AND
  comments stripped, instead of two texts that disagreed about what the document said.
-->

- type: Pattern
- domain: legal case management
- user: solo-practitioner lawyer
- platform: desktop
- problem: an entry that reads as complete to a machine and as empty to a person
- confidence: medium
- outcome: unknown
- source: fixture — adversarial pass, library lint

<!--
## Principle

This prose is invisible on the rendered page and must not satisfy the principle contract here.

## Do not copy

This prose is also invisible and must not satisfy the do-not-copy contract for this entry.
-->
