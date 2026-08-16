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

## Correction, same day: this ADR's first version overclaimed, and the split was incoherent

Written before a two-surface adversarial pass, which returned 33 further invisible code points and
one argument that changes what this decision can honestly claim. Both are corrected above rather
than left as an addendum, because an ADR read later is read as the decision, not as its history.

**The refused set was a sample presented as a class.** Six hand-picked ranges. The pass found 33
more, including **U+2060 WORD JOINER — the character Unicode introduced so that U+FEFF could stop
being used for this**. Refusing the deprecated spelling while accepting the current one is the
split inverted. Worse, the tag block U+E0000–E007F encodes A–Z invisibly, so an entire hidden
string could ride inside a headline. Replaced with Unicode's own
`Default_Ignorable_Code_Point` class, minus a named allow-list. Format-control blocks not in every
version's table (Egyptian, U+13430) are named explicitly — a class is only as good as the version
you copied it from.

**The allow-list granted exactly the harm the refuse-list refuses.** `"Receipts driven" + ZWJ +
" OS"` renders identically to the plain title and produces a different idem. The justification for
allowing U+200D was *contextual* — emoji composition — but the rule it produced was
*unconditional*, licensing the character where it can join nothing at all. The joiners are now
**position-checked**: legal only between two non-ASCII characters they can actually join. Emoji
families and Hindi orthography pass; a joiner beside a space, at an edge, or between ASCII letters
does not.

**And the honest limit: refusal cannot close harm (b) at all.** Demonstrated in pure ASCII —

```
"Receipts  driven OS"  vs  "Receipts driven OS"   DIFFERENT IDEM, identical rendering
"Receipts driven OS "  vs  "Receipts driven OS"   DIFFERENT IDEM, identical rendering
```

HTML collapses whitespace runs, so these render byte-identically as a headline. U+0020 cannot be
refused. **Every codepoint rule in this ADR closes harm (a) — spoofing — and merely narrows harm
(b).** Closing (b) needs a *normalization-for-identity* policy: a folded key stored alongside the
verbatim preimage, so the bytes stay exact while identity is compared on a normal form. This ADR
rejected normalization outright without noticing that refusal alone cannot cover the class it
claimed. That policy is not designed here and is the honest open item.

## Consequences

**Good.** Harm (a) is substantially closed: no character in the default-ignorable class, the
control ranges, or the bidi overrides can reach a published headline, and the joiners that remain
legal must be doing real work. `contentIdem` now enforces the same rule as `assertContent`, so a
caller deriving a key without validating first is no longer a hole.

**The claim this section used to make is withdrawn.** It said the field "can no longer carry a
character that makes two identical-looking titles into two different facts". That is false, and
was false when written — the whitespace cases above need no special character at all.

**Bad, and stated.** This is a judgement about language, made by someone who does not read most of
the scripts it affects. The U+200E/U+200F row in particular is a guess that marks are safe enough,
and the revisit trigger exists because the first legitimate title this refuses is better evidence
than the reasoning above.

**Not addressed here — each named so the gap is visible rather than assumed covered:**

- **Homoglyphs.** Cyrillic "а" for Latin "a". Needs a confusables table; half of one produces a
  rule that looks like it handles them and does not.
- **Whitespace and identity.** Double spaces, trailing spaces, NBSP versus space — all render
  identically and hash differently, all in characters that cannot be refused. This is the residue
  of harm (b) described above, and it wants the normalization-for-identity policy, not a rule here.
- **`|` in a title is refused, and that is a real false positive.** `Title | Brand` is one of the
  commonest headline forms on the web. It is visible, printing, and spoofs nothing — it is refused
  only because ADR-1101 uses `|` as the idem join delimiter. **This ADR's own revisit trigger fires
  on it.** The structural answer is a preimage that content cannot forge — length-prefixed fields,
  or a hash-of-hashes — which belongs to ADR-1101 and is not taken here. Recorded because the
  alternative is someone rediscovering it while trying to publish an ordinary headline.
- **Unbounded combining marks.** 140 stacked U+0301 render as a spike escaping the line box and
  overprinting neighbouring content — harm (a), reached without any override, and stopped today
  only by the 300-byte cap, which is not a rule about display.
