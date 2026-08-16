# ADR 1120 — Invisible and bidi-override characters are refused in a `title`; zero-width joiners are not

**Status:** accepted
**Date:** 2026-08-16
**Product:** `growth`
**Reversibility:** two-way
**Revisit trigger:** a legitimate title is refused by this rule. The allowed/refused split below is
a judgement about which characters have a real use in a headline, and the first false positive is
evidence the line is in the wrong place — the fix is then to move the line, never to strip the
character.

## Context

`content.published.title` is **the only free-form string in any idem preimage in this repo**
(ADR-1119). Everything else that reaches a preimage is constrained to ASCII by its grammar first.
That makes `title` the one field where Unicode behaviour is load-bearing rather than cosmetic, and
it has now produced two defects in two days.

The first was a **collision**: a lone surrogate encodes to the same UTF-8 bytes as U+FFFD, so two
different titles hashed to one idem and the second was dropped as `DUP_IDEM` (ADR-1119). Refused.

This ADR is the mirror image — a **false distinction**. The validator refuses only C0 controls and
DEL, which was measured rather than assumed:

```
U+202E RLO override        ACCEPTED
U+200B zero-width space    ACCEPTED
U+200D ZWJ bare            ACCEPTED
U+FEFF BOM mid-string      ACCEPTED
U+0085 NEL                 ACCEPTED
U+2028 line separator      ACCEPTED
U+009B CSI                 ACCEPTED
plain control (C0) tab     refused BAD_CONTENT
```

Two distinct harms, and the second is the one that belongs in an ADR rather than a bug report:

1. **Spoofing on a public page.** U+202E reverses rendering order, so a title can be made to
   display as something other than what it says. The site publishes under the owner's name (E2),
   and a headline that renders differently from the bytes behind it is exactly the thing a receipt
   is supposed to make impossible.
2. **Two titles that look identical and hash differently.** Because `title` is in the preimage, an
   invisible character produces a *distinct fact* to the spine and an *identical string* to every
   human reading either the page or the receipt. Nothing errors. It is the inverse of the surrogate
   collision — there, two different things shared one key; here, one apparent thing gets two.

## Options considered

1. **Refuse every non-printing character.** Rejected, and this is the option that would have been
   easy to ship and wrong. U+200D (zero-width joiner) is REQUIRED to compose emoji sequences — a
   family or a flag is literally surrogate pairs joined by U+200D — and U+200C (zero-width
   non-joiner) is orthographically necessary in Persian, Hindi and other scripts. A blanket ban
   refuses correct titles in real languages to prevent a spoof, which is the kind of rule that
   teaches the writer the validator is broken.
2. **Normalize — strip the offenders and accept the rest.** Rejected outright. `content_sha` and
   the idem are taken over the bytes; silently rewriting a title makes the receipt describe
   something other than what was published, and `validate-content.mjs` already records that
   normalizing is how a validator quietly becomes a suggestion.
3. **Refuse the characters that have no legitimate use in a headline, and name the ones that do.**
   Chosen.

## Decision

Refused in `title`, in addition to the existing C0 + DEL:

| Range | What | Why it has no place in a headline |
|---|---|---|
| U+0080–U+009F | C1 controls (NEL, CSI, …) | Terminal escape territory; no textual meaning |
| U+2028, U+2029 | Line / paragraph separator | A title is one line, by construction |
| U+202A–U+202E | Bidi embedding and **override** | Explicit reordering; the spoofing vector |
| U+2066–U+2069 | Bidi isolates | Same class, newer encoding |
| U+FEFF | Zero-width no-break space / BOM | Invisible, and an idem trap |
| U+200B | Zero-width space | Invisible, and an idem trap |

**Deliberately still ALLOWED, because refusing them would be the worse error:**

- **U+200D (ZWJ)** — emoji sequences are built from it. Refusing it would reject 👨‍👩‍👦 and every
  composed flag.
- **U+200C (ZWNJ)** — required orthography in several scripts. A validator that cannot spell Hindi
  correctly is not more secure, it is less usable by exactly the people it should serve.
- **U+200E, U+200F (LRM/RLM marks)** — *marks*, not overrides. They nudge the bidi algorithm toward
  correct display of mixed-direction text rather than reversing it, and mixed English/Arabic titles
  legitimately need them. This is the finest line in the table and the one most likely to move.

The split is therefore **override versus mark, and invisible-with-no-use versus invisible-with-a-use**
— not "printing versus non-printing", which is the distinction that looks principled and is wrong.

## Consequences

**Good.** The one free-form field reaching an idem can no longer carry a character that makes two
identical-looking titles into two different facts, nor one that makes a published headline render
as something it does not say. Both harms are silent today; both become a refusal at emit.

**Bad, and stated.** This is a judgement about language, made by someone who does not read most of
the scripts it affects. The U+200E/U+200F row in particular is a guess that marks are safe enough,
and the revisit trigger exists because the first legitimate title this refuses is better evidence
than the reasoning above.

**Not addressed here.** Homoglyph titles — Cyrillic "а" for Latin "a" — are the same *class* of
harm and are NOT refused. They cannot be caught by a codepoint range, only by a confusables table
and a normalization policy, and shipping half of that would produce a rule that looks like it
handles homoglyphs and does not. Named so the gap is visible rather than assumed covered.
