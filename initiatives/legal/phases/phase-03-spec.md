# Phase 03 — the real render (LexOS)

**Goal (one line):** one real venture's real facts become seven approved, receipted pages committed
into its own tree, with an integration handoff checklist and an honest record of what is still open.
**Appetite:** 1 day — blown appetite = cut scope or kill, never extend silently
**Depends on:** phase-01, phase-02

## What the kickoff already verified about this venture

Read from `E:/Work_Hub/01_Automemory/Lexos` on 2026-08-12, so Phase 3 does not start by guessing:

- **No policy pages and no footer exist.** Route tree is `/`, `/login`, `/signup`, `/auth/callback`,
  `/dashboard/*`, `/api/*`; `app/page.tsx` is a twelve-line stub. REQ-08 is therefore a
  FIRST-publish, not a supersede-with-receipts.
- **Razorpay IS formally ADR'd there** — `LexOS docs/adr/0003-razorpay-settle-to-each-firm.md`,
  accepted, one-way: each firm is its own merchant, LexOS never holds funds. Payment posture is
  `none` (ADR-1211), not `gateway`.
- **`stores_third_party_client_data: true`** — per-firm clients, cases and documents, privileged
  material. The processor clause is mandatory.
- **GST posture is NOT determinable from the repo.** The only GST field found is a per-FIRM invoice
  header. This is the one fact the owner must state; both branches exist either way.

## Exit criteria (Definition of Done)

- [ ] The GST-posture answer obtained from the owner and recorded in the facts file (assumptions ledger row 3 closed, not carried).
- [ ] Rule-3 and s.5(3) text re-verified against the gazette by a human or an unblocked fetch BEFORE this publish (assumptions ledger row 2; ADR-1206 is medium-confidence because both government hosts returned HTTP 403).
- [ ] `legal/facts.yaml` authored in the LexOS tree from real values — operator identity, geographic address, grievance contact, data categories, purposes, retention, deletion mailbox, sub-processors, route paths, `payment_model: none`, `stores_third_party_client_data: true`.
- [ ] Seven pages rendered; all three lints green; all ≥ 8 scenarios answered.
- [ ] `approval.requested` raised with the full page set; the owner reads the actual rendered pages — an agent's summary of a page is not the page — and decides via `arc-inbox` with a reason.
- [ ] Pages, `pins.yaml` and receipts committed into the LexOS working tree on a branch, never to its `main`, and never pushed or deployed by this cycle.
- [ ] **LexOS-side integration handoff checklist** produced and committed: route wiring for the seven paths · creating the footer that does not exist · signup consent capture · cancel-path UI parity · grievance mailbox provisioning · provider dashboard fields for whenever LexOS's own subscription billing lands.
- [ ] Live-deploy and production-probe rows recorded `OPEN-at-venture-resume` with the reason (LexOS is PAUSED under the same mandate) — never a fake green.
- [ ] **The production publish count is read from the spine and reported** at close, alongside the fixture count. An engine proven only by fixtures is the `arc-policy` 2026-08-10 failure shape, and only the ledger can say which this was.
- [ ] Evidence bundle at `initiatives/legal/evidence/phase-03/`, linking to the venture-local screenshots rather than copying them (ADR-1210 item 5).
- [ ] `/arc-retro` run, with the scope-creep question asked explicitly.

## Verification plan

- One coarse line at kickoff, refined via `/arc-change` when the phase starts: the proof is the real
  venture's committed diff plus the two spine event ids verified out of `_quarantine/`, and the
  honest OPEN rows for everything a paused venture cannot demonstrate.

## Rabbit holes in this phase

- **Fixing LexOS while inside it.** The footer, the routes and the consent capture are handoff items,
  not this cycle's work. Rendering into its tree is minutes and breaks no pause; building its UI
  would.
- **Publishing anything outward.** Nothing here is deployed, pushed to a public branch or shared.
  Publishing is irreversible and needs the owner's explicit OK, even where a plan asks for it.
- **Accepting a per-firm legal pack as "obviously next".** Each of LexOS's firms is its own merchant
  and would need its own pages — a separate brief, if ever. Named in the No-gos.

## Out of scope for this phase

Live deployment, the production probe against a served site, and any change to LexOS's product code.

## Your-setup / pending

**Two owner actions:** (1) state the GST-registration posture for the operator; (2) approve the real
publish through `arc-inbox` in the canonical clone, after reading the seven rendered pages.

## Non-negotiables (verbatim from PLAN)

- Not a lawyer, never pretends to be: no invented legal claims, and no compliance badge without a demonstrable truth plus an evidence link (Constitution E3, ADR-0012). Rendered pages carry no "reviewed by counsel" implication until ADR-1207 fires and it is true, and no page or checklist may imply a DPDP obligation is in force before it commences (ADR-1206).
- The human gate is permanent (REQ-06): every publish is L1, propose-only, and no auto-publish path exists in code. `targets.publish` in `hq.policy.yaml` stays empty (ADR-1203).
- All three lints (value / trace / completeness) are WARN-first in TRIAL, and no promotion to FAIL happens without an adversarial pass first — facts files and templates are hostile input (ADR-1202, ADR-1209).
- Every gate gets TWO fresh attackers with different surfaces (decision logic · shell and OS boundary), and each attacker prompt carries this lane's running fixed-defect list with "check each one in every OTHER file". The negative control is a MUTANT that runs, never a grep.
- The text-level attack panel runs on the RENDERED bytes of the authored set before Phase 0 closes — content is parser-class too, and a transform applied for lint stability must declare what signal it destroys (ADR-1202).
- Hash-chain law (ADR-1204): no publish without a bound receipt; no silent edits; no backdating; the canonicaliser is total and type-tagged; the preimage carries its own version and `--verify` reports stale-format and tamper as different exit codes.
- Emitter and reader discipline: zero new event kinds; every emit verified in `events/` AND `events/_quarantine/` by event id, never by ULID substring; `decision.recorded` only via `arc-inbox`.
- Zero-dep Node and POSIX (A2); central `tests/` (ADR-0021); tests run on CI, never on this box; never delete — superseded template versions and retired pages keep their files (A10).
- Original drafting only: no copied third-party policy text.
- Constitution articles this plan upholds, for kickoff-lint: E3, A2, A5, A8, A9, A10.
