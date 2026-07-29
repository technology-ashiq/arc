# A number shown without its scale is read as vague, not as terse

- type: Craft
- domain: solo-operator venture dashboard
- user: owner scanning verdicts to decide what to act on
- platform: desktop
- problem: displaying a score compactly enough for a dense row without making the reader guess what it measures
- confidence: medium
- outcome: unknown
- source: arc explore run `hq-dashboard-v1`; juror 1 (`docs/design/explore/hq-dashboard-v1/ranking-1.md`), contrasting `Promote 8.4` / `Kill 3.2` against `promote 84` / `hold 52`

## Principle

Compression that removes the scale anchor does not read as confident, it reads as unexplained.
`8.4` carries a hint of its own scale: the decimal point signals a small bounded range before
the reader has thought about it. `84` signals nothing — it could be a percentage, a score out
of a hundred, a rank, or an internal index, and the reader has to decide which before the
number means anything. The keystroke saved costs a beat of interpretation on every row.

Precision about what the source actually supports: the juror wrote that one form gave "a clear
score on a clear scale" and the other did not. That a decimal implies *ten specifically* is an
inference and is not claimed here — the supported claim is bounded-and-small versus unanchored.

The general form: a numeral is only self-describing if its *format* implies its range. Decimals
imply small bounded scales. Percent signs imply zero-to-one-hundred. Bare integers imply
nothing at all and inherit whatever the reader last saw. When a dense layout tempts you to drop
the anchor, drop a different character.

Worth noting where this surfaced: the brief for this surface named *vague* as an anti-word.
The variant that compressed its scores was not trying to be vague — it was trying to be tight,
and tightness produced the exact quality the brief had ruled out. Density and vagueness are
adjacent failure modes, not opposites.

## Do not copy

Do not adopt a ten-point scale because it appears here. The scale belongs to whatever the
number actually measures; a confidence, a currency and a count all want different formats. Copy
the check — *does the format alone tell a first-time reader the range?* — not the `8.4`.
