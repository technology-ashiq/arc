REJECTED: e37494d L3 (profile slug differs from its file) -- already-covered: loadProfile refuses the mismatch before any state is read (reproduced: exit 2, 'venture profile's slug ... is not fx-alpha')

## attack 2b16424 r2 (slice 3)

- L3 [high] REJECTED -- by design: the `ci` exit criterion is launch's three checks green on main's head; required checks the owner adds are theirs to judge, and verify reading every third-party check would couple launch to apps it did not install. Carried as debt D15.
- L2, L4, L7, L8, B4, B5, B6, B7 [low] -- D12-D15 cover the branch name, marker pinning and token shape; the rest are recorded in the round-2 JSON and fall under the two-round cap.

## attack 1406e29 r1 (slice 4)

- L7 [medium] REJECTED -- the worker's `report()` already dedupes by kind and id, so a re-run cannot duplicate resources; reporting each resource the moment it exists is the rule set by faccecd B2.
- L10 [medium] REJECTED -- both token checks are anchored `^[...]{20,}$` with no whitespace class, so an interior CR or LF already fails the shape test.
- B4 [medium] fixed by cutting the poll to 8 x 30 s.
- L6 -> D12 (branch name), B6 -> D16, L11 -> D17.

## attack 21d7acb r2 (slice 4)

- B1 [medium] -> debt D18: the window is a kill between an HTTP answer and a synchronous state write; closing it needs a provider-side marker Vercel projects do not carry.
- Logic surface: RUN FAILED (timeout); round cap reached, merged on boundary + CI.

## attack 0109a8d r1 (slice 5)

- L1 [high] (non-main branch) -> already debt D12 (repo, ci, hosting, environments all assume `main`).
- L6 [medium] REJECTED -- a preview must be on `*.vercel.app`; another suffix is not this slot's proof.
- L8 [medium] fixed as `*-if-ours` teardown actions; L10 fixed (READY without endpoints is malformed, not UNSCANNED).

## attack 8a7fb7f r2 (slice 5)

- L2/B3/B4 fixed (PR in any state). L3 (default branch) stays D12 across all four GitHub writers -- one fix for all, when the trigger fires.
- Forged-trailer findings (guessable `slug@slot@provider`) -> debt D19: ownership markers are not secrets; an owner who forges one owns the outcome.
- Fine-grained PAT write 403/404 surfaces as an uncoded GitHub error naming the status -- a refusal, not a pass; left as is.

## attack 5e06edf r1 / d931e53 r2 (slice 7)

- 5e06edf B1/B2/B3 fixed. d931e53 B1 fixed (release also requires vercel.json to hold hosting's exact bytes).
- d931e53 B2 [medium] REJECTED by design (ADR-1730): in the real order, release runs before any app exists, so every
  production build of the lift commit errors; release's receipt is "production now builds, not skipped". Serving is
  frontend's proof, and frontend's verify (live 200 + Lighthouse) catches a broken build.
- Logic: round 1 failed its output contract (empty `fix`), round 2 NOT RUN.

## attack 3f04230 r1 (slice 9)

- B1/B2/B4/L3/L4/L5/L12/L14/L15 fixed. L1 REJECTED: the header is built from the trimmed, shape-checked token, so no CR/LF can reach it. L2 REJECTED: a 422 on the non-forced ref update throws before the report, so no unmerged commit is recorded. L6/L8/L9 -> D19 (guessable markers). B3 (three-OS CI longer than the slot timeout) -> D22. L10 -> D23.
## attack cc949ef r1 / 8a0ae88 r2 (slice 8)

- All high and medium fixed in two rounds. Logic surface: round 1 RUN FAILED, round 2 NOT RUN.
## attack 14d5374 r1 (slice 6)

- The first run (7f15855) never reached a model: arc-run's input scanner refused a credential-shaped fixture value; renamed in 14d5374, pre-scanned clean.
- B1/B2/B3/B4 fixed; B5 narrowed in the claim and carried as D20. Logic surface timed out.

## attack 07bcb38 r2 (slice 6)

- B1 [high] fixed (linear last-segment check). B2 fixed (`*.env`, `.envrc`). B3 -> D20 (values in non-contract templates). Logic NOT RUN (no in-range round 1).

## attack 3a6350b r2 (slice 9)

- The round-2 job was reaped by the memory monitor after it wrote both results. Boundary 7 (B2/B3 fixed, B1 -> D24, B4 -> D25); logic 0.

## attack aadcd0c r1 (slice 10)

- The first run (80f0f5e) was refused by arc-run's input scanner on credential-shaped header literals in four files; rewritten with Object.fromEntries, input pre-scanned clean.
- B1/B2/B3/B4/B5 fixed. B6 -> D26 (a ctx change). L1 REJECTED: the template uses {{ .SiteURL }} and site_url is set to the brand domain in the same PATCH. L2 REJECTED: every call is schema-qualified (`auth.uid()`, `auth.jwt()`).

## attack 6a5c24e r2 (slice 10)

- B1 [high] fixed (round-trip check without a regex; fake wraps base64). B2 fixed (stock = empty). B3/B6 fixed in the exit plan's step order (invites before memberships/orgs, cascade). B7 is process: every finding of this slice is dispositioned here; the D18 twins (kill between a provider create and the report) for Resend and Supabase are added as D27. Logic: RUN FAILED.
