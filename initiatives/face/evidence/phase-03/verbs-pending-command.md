# Verbs pending the work door — command ring

Phase 03, ring 1 of 5 (face v2 Cycle 16, ADR-1326). **This ring renders no verb-pending card, and the
table below is empty on purpose.** Every write the command ring draws is a verb the door ALREADY
serves: the inbox stamps through `POST /api/decide` and ask arc asks through `POST /api/ask`, both
through the host's `ctx.onAct`. Nothing in these six modules is a button that writes nothing.

The file exists so the check cannot pass by absence: `tests/face/module-frame.mjs` requires a
`verbs-pending-<ring>.md` for every shipped ring and holds its rows EQUAL to the `verbPending()`
entries the ring's folds return, both ways. An empty list is a claim, and this is where it is made.

| module | verb | what it will write, and where |
|---|---|---|
