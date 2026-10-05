# Evidence Brief — arc-first vs venture-first sequencing

Research mode: live

> Neutral shared brief. Facts only. Two researchers: one live-web (base rates, named failure
> modes, counter-cases), one repo-grounded (arc's own documents and state). Confidence labels
> are the researchers'. Where a claim could not be verified it is marked so — an unverifiable
> claim marked as such is usable; a confident fabrication is not.

## A. arc's own constitution and doctrine

- **F1** [High] Constitution **A8**, verbatim: *"Earn before build. Capability is built when a
  venture pulls it, never pushed by ambition. The factory exists for the ventures, not the
  other way around."* — `docs/strategy/arc-CONSTITUTION-draft.md:59-61`
- **F2** [High] That constitution is **NOT adopted**. Its header: *"Adoption status: DRAFT —
  becomes law on Ashiq's explicit sign-off, recorded as the spine's first
  `constitution.adopted` event."* Title: "(DRAFT v0.1)". — `:1,8-9`
- **F3** [High] Adoption has not happened: `docs/HISTORY.md:28` — *"Constitution adopted … ⏳
  pending"*; `docs/strategy/README.md:20` — *"ACTIVE · awaiting Ashiq's sign-off"*. No
  `constitution.adopted` event exists on the spine.
- **F4** [High] Despite being a draft, A8 is cited as an **operative constraint** in live build
  artifacts: `plans/README.md:63` (*"No trigger → it doesn't get built (Constitution A8)"*),
  `PLAN-engine-process-layer.md:6`, `PLAN-model-policy.md:89`, all four model-policy phase
  specs, and `docs/adr/0069-balanced-model-policy.md:133`.
- **F5** [High] `arc-master-execution-plan.md:220-227` sets **system-level kill criteria**:
  *"2 full build→launch cycles with zero revenue AND zero audience growth → stop building …
  Any OS cycle whose output no venture uses within the next cycle → that module freezes.
  Weekly: OS-hours > venture-hours two weeks running (outside a sanctioned OS cycle) → OS
  freeze until a venture ships something."*
- **F6** [High] Same file, line 234, names the **top risk**: *"Factory-polishing addiction (the
  #1 real threat)"*.
- **F7** [High] `plans/README.md:81` — *"Venture track outweighs OS track on any tie."*
- **F8** [Med] **No document anywhere states "build arc first" as a principle.** The stated
  written doctrine is venture-first-on-tie (F5, F7). The actual arc-side sequencing is the
  product of individually-approved insertions into the ordering table, not a competing
  written doctrine. — researcher's contradiction check

## B. arc's current state

- **F9** [High] Plan library = 22 files (13 BRIEF, 8 PLAN, 1 index). Of the 21 non-index files,
  17 carry a pull trigger.
- **F10** [High] Classification of those 17: **6 require a LIVE VENTURE or REVENUE** (growth,
  ledger, legal-pack, ops, trader, leads) · **11 require internal scale/state only** ·
  **0 are buildable with no precondition at all.**
- **F11** [High] Cycles: v2 (PARKED), C1 Orchestrator (CLOSED), C2 Receipt Spine (**still
  LIVE**, Phase 04 dogfood), C3 arc-design (CLOSED), C4 arc-portfolio (CLOSED), C5
  model-policy (LIVE now).
- **F12** [Med] Elapsed calendar time from earliest dated marker (2026-07-13/16/17) to today
  (2026-08-02) = **16–20 days**, in which 6 named initiatives ran, 4 closed.
- **F13** [High] `PLAN-cycle3-venture-launch.md:3` trigger, verbatim: *"Cycle 2 (receipt spine)
  closed, or running late — **first money must not wait past ~2 weeks after it**."*
- **F14** [High] Cycle 2 kicked off 2026-07-22 and is **still LIVE** (not closed). ~2 weeks from
  that lands ≈**2026-08-05 — three days from today.**
- **F15** [High] **Four** arc-internal cycles (design, portfolio, model-policy, develop) were
  inserted into the ordering table **between** Cycle 2 and Cycle 3's slot. Three have run;
  develop has not started. — `plans/README.md:28-31`
- **F16** [High] **Zero revenue, ever.** No `revenue.received` event exists anywhere in live or
  archived spine data. `docs/evidence/phase-04/SUMMARY.md:53-56` — *"zero `revenue.received`,
  as required — arc earns no real money and none was fabricated."*
- **F17** [High] **No venture is LIVE.** The only passport row is *"lexos | private, separate
  repo | in build outside arc"*. `plans/README.md` confirms the Cycle-3 venture slot is still
  an unresolved choice among candidates.
- **F18** [High] `docs/HISTORY.md:29-30` — *"Venture chosen for Cycle-3 | ⏳ pending — **decision
  overdue**"* and *"First real ₹ | ⏳ target Sep 2026"*.
- **F19** [High] `PLAN-cycle3-venture-launch.md` goal: launch *"with live payments, real
  distribution assets, and its first real `revenue.received` event"* inside a **3-week hard
  cap**, with a pivot rule armed. It also freezes arc-side work during that cycle.
- **F20** [Med] `arc-master-execution-plan.md:184-198` money model set *"Sep 2026 | First real ₹
  | venture #1 launch"* — assuming the venture cycle was already running by ~Aug/Sep, i.e.
  before the four extra cycles (F15) were inserted.

## C. External evidence — the failure modes

- **F21** [High] **"Architecture astronaut"** (Joel Spolsky, 2001/2008) is a named, widely-cited
  failure mode: engineers who build abstract general-purpose frameworks instead of solving the
  problem in front of them — *"they don't solve an actual problem, they solve what looks like
  the template of a lot of problems."*
- **F22** [High] **"Second-system effect"** (Brooks, 1975): the first system is spare and
  careful; on the second, the builder adds every deferred frill, producing an over-architected,
  late system.
- **F23** [Med] Startup Genome (2011, ~3,200 startups): **"premature scaling"** — explicitly
  including *"investing into scalability of the product before product/market fit"* — was
  present in ~70% of studied startups and was the most-cited failure cause; 93% of those
  exhibiting it never passed $100k/month. *Primary PDF could not be rendered this session;
  confirmed via three independent secondary sources.*
- **F24** [Med] Ariely & Wertenbroch (2002): externally-imposed deadlines outperformed
  self-imposed ones. **F25** [Med] A 2026 replication (Hyndman & Bisin, *Psychological Science*)
  **failed to reproduce** this — the effect was negligible. This literature is **unsettled**;
  neither direction should be asserted as law.
- **F26** [Low] Practitioner sources attribute unshipped solo projects to scope creep in the
  absence of an external forcing function. Anecdotal, not measured.

## D. External evidence — the counter-cases

- **F27** [High] **Slack** began as an internal tool built to coordinate development of the game
  Glitch; productized after Glitch failed (2013).
- **F28** [High] **Trello** began as an internal Fog Creek project (launched 2011).
- **F29** [High] **Rails/Basecamp**: Rails was extracted as a byproduct of building Basecamp.
- **F30** [Med] **Shopify** grew out of software built to run the founders' own snowboard shop,
  productized after other merchants asked to license it.
- **F31** [Med] **The condition common to all four:** in every case the tool was built **while
  operating a real, externally-facing business** (a game, a services shop, an actual retailer),
  **not in isolation before any revenue-facing activity** — and each was productized only after
  *unprompted external demand* appeared. Pattern observation across the four cases.
- **F32** [Low] Venture-studio outperformance stats (30% higher success rate; 25.2 vs 56 months
  to Series A) trace to **one** 2022 GSSN report that is **not publicly available**; every
  citation found leads back to it, and GSSN is an industry body with a commercial interest in
  the result. Multiple marketing sites present it as triangulated; **it is not.**
- **F33** [High] The **"sharpen the axe"** Lincoln quote commonly used to justify
  infrastructure-first is **misattributed** — no historical evidence Lincoln said it.

## E. Declared evidence gaps

- **F34** [High] **No study exists** directly comparing solo founders who build tooling before
  any revenue product against those who ship first. The researcher states plainly: *"this
  specific comparison does not appear to have a dedicated empirical study."* All external
  evidence here is **adjacent** — named engineering failure modes, general scaling research,
  deadline psychology, and retrospectively-selected survivor cases.
- **F35** [High] The four counter-cases (F27–F30) are **survivors**. No base rate exists for how
  many internal tools built alongside a live product were simply abandoned; that denominator is
  not visible in public writing.
- **F36** [Med] It is undefined whether "Cycle 2 closed" in F13's trigger means "Phase 04
  formally retro'd" or a looser "core phases done". `HISTORY.md` shows Cycle 2 as still LIVE.
