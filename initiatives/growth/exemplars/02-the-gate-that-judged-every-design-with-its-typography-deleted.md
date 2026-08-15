# The gate that judged every design with its typography deleted

For one full cycle, our design review pinned `font-family: Arial !important` before taking a
screenshot. The reason was good: hashes have to be stable, and fonts load at different times on
different machines, so a screenshot that sometimes has your typeface and sometimes does not cannot
be compared against yesterday's.

The consequence took a cycle to notice. Every design that gate looked at was judged with its
typography removed. Typography is not a detail of a visual design. It is most of one. We were
scoring layout and colour and calling the result a design review, and the normalisation that made
the measurement reliable had quietly deleted the thing being measured.

Nothing in the system was wrong. The screenshot was correct. The hash was stable. The review ran.
The reports were internally consistent and they were about a different artifact than the one we
thought.

## The rule we wrote afterwards

A gate that transforms what it measures must declare what the transform destroys.

That is now a line in our build rules, and it is deliberately phrased as an obligation on whoever
adds the normalisation rather than on whoever reads the report. The person adding
`!important` to a stylesheet for hash stability is the only person in the loop who knows what they
just removed. Six months later that knowledge is gone and the gate looks like it always worked.

## Where else this hides

Anywhere you normalise before comparing. Lowercasing before a diff hides case bugs. Stripping
whitespace before a hash hides indentation regressions. Sorting a list before comparing it hides
ordering defects, and ordering defects are the ones that ruin a cache key.

None of those normalisations is wrong. Each one is a decision about which signal is noise, made
once, usually in a hurry, and then inherited by everyone downstream as though it were physics.
Write down what you deleted. The note costs a line and it is the only thing standing between a
useful gate and a confident one.
