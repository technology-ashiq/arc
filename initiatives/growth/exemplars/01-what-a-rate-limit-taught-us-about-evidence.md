# What a rate limit taught us about the word "dead"

The first time our keyword miner ran against a real source instead of a fixture, it reported that
41 of 51 evidence links did not resolve. Every one of those links was fine. The source had answered
HTTP 429, and the code had two states where it needed three.

That is the whole bug, and it is worth sitting with because it is not a coding mistake. The
resolver asked one question, "is this link alive", and allowed two answers. A 429 is neither. It
means the source declined to say. Collapsing "I could not check" into "dead" produced a candidate
pool that had lost eighty percent of its rows, and the run carried on cheerfully with what was
left.

The failure mode here is not that something broke. It is that nothing broke. An error would have
stopped the run. Instead the run succeeded, wrote a file, and printed a number that looked like a
result. A thin market got manufactured out of a rate limit, and the only way to notice was to open
the file and read it.

## Three states, and the one that costs money

We now carry `live`, `dead` and `unknown`, and the run stops rather than proceeding on a pool that
lost rows to `unknown`. Continuing requires saying so out loud, with a flag, which lands in the
command history where someone can see it later.

The second half of the fix mattered more. Those 429s were self-inflicted. The miner was issuing one
HEAD request per candidate against the human-facing item page, which is a page built for people.
The source publishes a documented API for exactly this, returns fifty-one results in one request,
and a 404 there means the story genuinely does not exist rather than "you are asking too fast".

Verification is the source's job. We were doing it by hand, badly, against the wrong door.

## What we would tell you to check

If you have a pipeline that classifies anything external, find the place where two states are doing
the work of three. It is usually the cheapest fix in the system and it is usually invisible, because
the shape of the bug is a number that looks plausible. Missing is not zero. A gap you can see costs
far less than a wrong answer you cannot.
