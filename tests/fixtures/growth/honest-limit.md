# The honest-limit fixture

**This file is slop, and both lints pass it. That is the point.**

ADR-1110 makes this fixture mandatory. A gate that cannot fail its own weakest case is a gate
nobody knows the shape of, and the shape of these two is: they catch specific known-bad patterns
and specific missing citations. Neither one can tell you the writing below says nothing.

Nothing here trips a marker. There is no forbidden phrase, no em-dash pile, no figure without a
source. Every sentence is grammatical. The paragraphs are a reasonable length. If the lints were
the only gate, this would reach a reader.

---

## Understanding modern software teams

Software teams today face a number of considerations. There are many factors that influence how a
team works, and these factors vary from one organisation to another. Understanding these factors
can help teams make better decisions about how they operate.

One consideration is process. Different teams use different processes, and the process a team uses
will depend on the team. Some processes work well for some teams and less well for others. Choosing
a process is therefore an important decision for any team to make.

Another consideration is tooling. Tools help teams do their work. The right tool for a team depends
on what the team needs to do. Teams should evaluate their tools regularly to make sure the tools
still meet their needs.

Communication also matters. Teams that communicate well tend to work well together. There are many
ways for a team to communicate, and teams should choose the ways that suit them best.

In practice, most teams find that a combination of these things works best. What matters is that
the team thinks about them and makes a deliberate choice rather than letting things happen by
default.

---

**What caught it instead:** the POV floor, at the human gate. Read the article above and try to name
the one thing arc learned by doing that is written down in it. There is nothing to name. That
question is a human's to answer, and ADR-1110 keeps it out of the lints on purpose, because
"carries an original stance" is not detectable by a marker list and a lint that claimed otherwise
would be the prescriptive turn arriving in disguise.
