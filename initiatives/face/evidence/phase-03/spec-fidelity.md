# Spec-fidelity — Phase 03 · lane face

The `spec-fidelity` agent ran in a fresh context over `initiatives/face/phases/phase-03-spec.md` and
`git diff fd78a4f7..d8386216` (the Phase 02 close to the fifth ring's merge), reading only the spec and the
diff. Its verdict line is **`FIDELITY: drift found`**, and it stands as filed. Each finding below carries a
disposition: **FIXED** (changed at this close, with a check), **DECLARED** (a deliberate reading, recorded where
the next reader will look), **DEBT** (a row in `debt-ledger.md`).

## The findings, with their dispositions

**1. "No facts bundle under face/src/\*\*" -- bent in a small way (typed numbers and names).** The agent named
`factory/executor` ("twelve fixtures"), `money/trader` ("thirty paper days", twice), `money/ventures` ("One in
four ventures is expected to live") and `money/legal`, whose NOT SERVED "five seals" panel listed the five seals
inside the placeholder -- the spec's own rabbit hole, "fixing a NOT SERVED panel with a constant". —
**FIXED.** Each number, name or threshold is removed or moved behind the route that will serve it: executor's
certification names no fixture count; trader's cards point at "the paper period the planned line names" (the
planned-rooms registry carries it as a station); legal's panel is "The seals" and its sentence lists none;
ventures' "1 in 4" panel is now a `NOT SERVED` panel, "The base rate", on `/api/ventures`. The same pattern was
then grepped across every fold and View rather than fixed file by file, and four twins were found and fixed:
the command ring's **board** drew the same "1 in 4" base rate as typed prose in its View (now the same NOT
SERVED panel), law's amendment sentence said "seven-day", ops' rehearsal card said "two ventures", and
ventures' distribution sentence said "one channel a day". The NOT SERVED lists for command and money gained
"The base rate", re-derived from the folds.

**2. The served registry is the only room list -- kept to the letter, stretched in how it works.** Exactly two
rooms are exempt and a third unnamed one fails, and ADR-1337 records the owner's ruling; but the shell now
builds its room list from two sources (the registry, then the exemption rows, which carry room text), and the
door serves the exemption file, and ADR-1337 recorded neither. — **DECLARED**, and recorded where it belongs:
ADR-1337 gains a section, "How the two exemptions are drawn", naming the allow-list row, the fields a row
carries, the gate that holds them, and the fixed order of the two sources.

**3. "0 console errors" met in a narrower sense.** The smoke allows up to two `net::ERR_NO_BUFFER_SPACE`
errors per mood on Windows, in one room, counted on their own `runner-errors` line and kept out of `errors=0`;
disclosed, but approved by neither the spec nor an ADR. — **DEBT**, the existing row: the class was measured
before it was named (the money ring), it is the exact Chrome line on win32 only with a ceiling, and it is never
folded into a clean zero. An ADR belongs with the change that removes the ceiling or raises it.

**4. The factory ring's extras landed in the company ring's PR.** — **DECLARED**: the owner's section 13 item 5
ruling was pending when the factory ring merged, and PROGRESS recorded that the four extras would not be built
before it; ADR-1337 and the company ring's PR carry them together.

**5. F2 met in the sense the Cycle 15 finding meant, not its literal words.** The scheduler's lede still promises
"next fire" and "heartbeat"; the room draws both as NOT SERVED panels on `/api/jobs`. — **DECLARED**: the lede is
the registry's authored copy of what the room is for, and the finding was that "nothing says they are missing";
every promise now has a panel that either fills it or names the route that will. Phase 04's `/api/jobs` fills
them without touching the sentence.

**6. Scope beyond the spec.** A door change in a phase that leaves door work to Phase 04 (`arc-dash`'s
`FILE_ALLOW` gains `module-exemptions`); exemption rows that grew fields and a gate that checks them; the
`verbs-pending-*` and `rehearsal-money` lists; the critiques duplicated in `docs/design/critique/`. —
**DECLARED**: the allow-list row serves an existing contract file over the existing route (no new route), and is
recorded in ADR-1337; the verbs lists are Phase 05's input exactly as the NOT SERVED lists are Phase 04's; the
critique files are where the `design-critic` agent writes by its own contract, and the evidence copies carry the
ring author's disposition beside them.

**7. The company ring's dogfood reading was not in the diff.** — **FIXED** at this close: PROGRESS records it
(6 · 55 · 1 of 5, from the main clone at `d8386216`).

## The agent's report, as filed

> The spec asked for all 36 modules drawn only from what the door serves, and the diff builds that. I found three
> places where it drifts from the wording, and one change to the door that the spec kept for Phase 04. The
> biggest issue is under "No facts bundle".
>
> - "No facts bundle under face/src/\*\*": bent in a small way. There is no facts bundle (`face-facts.mjs` printed
>   `fail=0 warn=0`), but some shown numbers are typed into the code instead of traced to a door route:
>   `factory/executor/fold.mjs:54` "twelve fixtures"; `money/trader/fold.mjs:45,60` "thirty paper days";
>   `money/ventures/fold.mjs:229` "One in four ventures is expected to live"; `money/legal/fold.mjs:58-61`, the
>   clearest case of the "fixing a NOT SERVED panel with a constant" rabbit hole.
> - "The served registry is the only room list … exempted by name only": kept to the letter, stretched in how it
>   works -- the shell builds its room list from two sources, and ADR-1337 records neither the door serving the
>   exemption file nor the rows carrying room text.
> - "Real vs simulated / rehearsal / planned never mixed": kept. Other non-negotiables intact: all 36 `ops.mjs`
>   empty, no colour literal or React import under `modules/`, `validate.mjs`, the token files and the decide
>   handler untouched.
> - Exit criteria: four files per module met; `not-served-<ring>.md` met; F1 met (`company/org/fold.mjs`); F3
>   met; the facts-bundle lint met; two attackers met (command ring, `81dcf814`); Block B recorded GREEN; the
>   throwing rooms met; 0 console errors partly met (the Windows runner-class ceiling); the factory extras met in
>   a different PR (ADR-1337); F2 met in the finding's sense, not its literal wording.
> - Scope creep: the `FILE_ALLOW` row; the exemption rows' new fields; the verbs and rehearsal lists; duplicated
>   critiques. Not creep: the `face-pure.mjs` lexer changes the facts lint needed, and `ask.mjs`'s
>   `claimRead`/`resolutionOf`.
> - What a user would notice: all 36 rooms, in both moods, are v0.7 modules that show only what the door serves;
>   a panel the door cannot fill says "not served" and names its route; planned rooms say "planned" instead of
>   LIVE; Story and Factory are real rooms, and Executor and Agents appear with a "not in registry" badge.

FIDELITY: drift found
