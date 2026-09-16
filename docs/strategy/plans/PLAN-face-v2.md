# PLAN — face v2 · "The Workroom" — v1.0

> **STATUS: kickoff-grade — landed owner-instructed from a Cowork session, 2026-09-16,
> disk-only, git untouched.** The owner branches/commits/PRs this drop himself (no machine git).
> Kickoff runs via the paste-ready prompts in §14. Decisions are letters (**FV2-A…N**); real
> ADR numbers are assigned at kickoff from the **face band 1300–1399** (1300–1317 taken by
> Cycle 15 — next free is 1318, re-swept across sibling worktrees at kickoff per the band
> law) — never here. `PLAN-face.md` (v1.0, Cycle 15's design source) is **NOT superseded**:
> it is the frozen decision record of the v1 build and its REQ-01…REQ-10 statements stay
> readable; both files stand in `plans/`.
>
> **Provenance:** the owner's own design app read from source, not from renders —
> `arc-face-hq2/assets/arcface` v0.7 (2026-09-15): 36-room `roomRegistry.js`, `HQ.jsx`
> shell, `ui/kit.jsx`, `CHANGES-v0.5/0.6/0.7`, `docs/superpowers/specs/2026-09-15-hq-design-system.md`,
> `scripts/smoke.mjs` + `flows.mjs` → then the shipped product read against it: `face/README.md`,
> `face/src/App.tsx`, `face/src/lib/{door,rooms}.mjs`, `face/src/tokens.css`, `face/package.json`
> → then the lane's own truth: `initiatives/face/PROGRESS.md` machine header, `PORTFOLIO.md`
> row, `docs/design/reference/face-hq/SOURCE.md`, `docs/strategy/plans/PLAN-face.md`. Every
> room id, kind, route, lint and ADR named below exists in those files; nothing is invented.
>
> **Trigger: FIRED by owner ruling, 2026-09-15.** "ithu than final design… inime ellame arc
> oda frontend ithu than… ellame working modules ah maranum." This is the **third** instance
> of the standing design expectation (informative → operable) and the first where the owner
> has supplied a finished, self-consistent 36-room system rather than a brief. Also carried
> by the Build-out Mandate (2026-08-09, `01KZTM348858PDH44K4HA64CVA`).
>
> **Hard prerequisite: Cycle 15 closes first.** Phase 09's CI verdict lands, `/arc-phase-done`
> runs, `/arc-retro` closes the cycle. Cycle 15's REQ-10 (dogfood) is carried into this cycle
> rather than force-closed — see **FV2-L**: dogfooding a surface that is about to be replaced
> measures nothing.
>
> **Appetite: Tier L — 22 days effort in three banked blocks + 2 real dogfood days.** Kill
> triggers in §9 (50 % tripwire per block; the module-batch tripwire gates all work-door spend).

---

## 0. One-liner

The owner's v0.7 HQ becomes **the** arc frontend: one token source in two moods, one shell,
and **36 modules that are folders, not files** — each a manifest, a pure fold, a verb set and
a view — rendering only what the door serves and writing only through doors arc's law already
recognises, so the next lane arc grows gets a working room by adding one folder.

## 1. Current state this plan rides on (verified 2026-09-15)

**Exists — reuse, never rebuild:**

| Piece | Where | What this plan takes from it |
|---|---|---|
| L2 `arc dash` door | `.claude/scripts/hq/arc-dash.mjs` | 11 routes, token + origin + bind, zero-CORS posture, refusal codes by name. Unchanged law; this plan *adds* routes, it does not re-open the door's design. |
| The one write path | `POST /api/decide` = the `arc-inbox` function, byte-parity fixture (Phase 03) | Stays the stamp, untouched. REQ-08 is a regression bar, not new work. |
| One-command start | `node .claude/scripts/hq/arc-face.mjs` | The launcher survives verbatim — it is what ended the three-step morning, and the morning is what ends dogfoods. |
| L3 home | `face/` in-repo (**ADR-1316** supersedes ADR-1300 on placement) | No new repo. A layer without CI is not a layer that ships. |
| The logic law | `face/src/lib/*.mjs` — dependency-free ESM, imported by `node` with no install | The reason CI can test L3 at all. Every fold this plan writes obeys it. |
| Served registry | **ADR-1306** — `/api/rooms` serves the room list; the renderer never spells it twice | The module system attaches renderers to served ids. It does not become a second registry. |
| Token law | **ADR-1308** — `docs/design/system/tokens.css` is the source; `face/src/tokens.css` is a generated copy; `face-tokens --check` fails on drift | The v0.7 palette lands in the SOURCE file. The copy is never hand-edited. |
| Coverage gate | `face-coverage` — 9 inventories derived from the world, 220 homed rows, 93 selftest arms | Extended, not replaced: it grows module-side and op-side assertions. |
| Ask contract | `face/src/lib/ask.mjs` — `ASK_ACTIONS` + `actionAudit`; REQ-07 zero write tools | Unchanged. The reference's browser-key brain does not enter the product (**FV2-H**). |
| Verification harness | design app's `scripts/smoke.mjs` (36 rooms + both moods) + `scripts/flows.mjs` (20 write flows) | Ported into arc's CI rather than re-invented (**FV2-M**). This is the single largest saving in the plan. |

**The lane, as the machine header reads it (`initiatives/face/PROGRESS.md`, 2026-09-15):**

- `status: LIVE` · `cycle: arc-face (Cycle 15, opened 2026-08-19)` · `phase: 09` ·
  `appetite: 32d` · `burn: 14d` · band **1300–1399**, 1300–1317 written.
- Phases 03 · 04 · 05 · 06 · 09 BUILT; 07 deterministic half built, model half waits on the
  engine seam; **08 NOT MET — `face-dogfood` reads 1 matched, 59 decided outside the face,
  1 of 5 days.**
- What renders today: **34 rooms — 22 generic from pure derivation, 2 index, 9 bespoke,
  1 planned**, 0 crashed on the 2026-08-24 sweep. Tests: l3-logic 262 · dash-doors 78 ·
  readers 31 · coverage selftest 93 arms.

**What the owner's v0.7 carries that the product does not:**

- **36 rooms in five rings** with ids, aliases, sentences, icons and a 16-lane → room map
  (`roomRegistry.js`), against the product's 34.
- A **two-mood token system** (`html.hq` dark · `html.hq.hq-light` paper) with WCAG-AA
  computed per mood, and a neutral-dominant workroom scale the product has no equivalent of.
- A **kit the rooms actually share** — `RoomHead` · `KpiStrip` · `HPanel` · `PickRow` ·
  `Meter` · `Chip` · `Empty` · `SectionLabel` — which is why v0.7 reads as one product and
  a room-by-room build does not.
- **20 write-path flows** proven end to end in the browser, with refusals as inline text and
  47 owner receipts surviving a reload.
- A **smoke + flows harness** that already asserts on button text, placeholders, `data-*`
  and the h1 sentence — i.e. the design's behaviour is frozen by tests, not by prose.

**Corrections on record (found while reading v0.7 against the contract):**

1. **v0.7 renders `violet` for council AND for simulated.** `tokens.css` already adjudicated
   this as collision #2 and resolved it — council is `--accent-dim`, violet is the non-real
   family alone. The reference is the target; the contract is the law; **FV2-E** keeps the law.
2. **v0.7 adds `--blue` (neutral progress)** — a real gap in the current token file, where a
   non-money meter had no honest colour. It is adopted.
3. **`src/data/arcFacts.js` is a 137 KB generated snapshot of repo facts.** Its ancestor
   (`arcKnowledge.js`) was already caught quoting 22 commands / 23 agents where the frozen
   contract counts 26 / 30. It does not enter the product (**FV2-G**).
4. **v0.7's brain is browser-side with a pasted key and an `approve`/`reject` action
   protocol.** REQ-07 and E2 already settled this; the SOURCE.md ruling of 2026-08-24 stands
   (**FV2-H**).

## 2. Scope

**IN (v2):** v0.7 intake as the canonical reference · two-mood token rewrite in the source
file + generator + `--check` · the shared kit (`kit.tsx` + `bits.tsx`) · the v0.7 shell
(240 px rail · 56 px header · ⌘K · voice dock in the content column) · **`face/src/modules/`
— 36 modules, four files each, ringed folders** · the module birth rule + `face-pure` lint ·
a scaffold command · read-side folds for all 36 · **~17 new L2 read routes** derived from
what the modules prove they need · the **WORK door** (`/api/op/:id/plan|apply`) with a server
ops registry 1:1 with real CLIs · the **SESSION door** for streaming work (council convene,
absorb read, hire certification) · smoke + flows ported into CI on the three-OS matrix ·
dogfood on the final surface.

**OUT (v2) — §10 carries the graveyard:** any venture's own product UI (LexOS stays in its
own repo) · the bundled facts snapshot · a browser-side model key · a second room registry in
the client · new spine kinds invented by the face · merge from the UI · any write that does
not go through `/api/decide`, `/api/op/:id/apply` or a governed session · rebuilding the
design in the repo's own taste (the reference is the target, not an input to re-explore).

## 3. Decision record — FV2-A … FV2-N

ADR numbers at kickoff, from the face band's next free number (1318+). Each: the decision +
why + provenance.

**FV2-A — v0.7 is the canonical design; the explore rounds and the v0.4 reference are
retired to the record.** `docs/design/reference/face-hq/assets/arcface` is replaced by v0.7
in the same drop, `SOURCE.md` is rewritten against it, and
`docs/design/system/hq-design-system-v0.7.md` lands beside `tokens.css` as the spec every
module is polished against. The v0.4 tree and `docs/design/explore/face-hq-v{1,2}/` stay on
disk, marked superseded — never deleted. *Why:* the owner supplied a finished system twice
now; a lane that re-explores a decided design burns the appetite the modules need.
*Reversibility:* two-way — the folder is a folder.

**FV2-B — `face/` stays the home.** No new repo, no second app, no design app shipped inside
the product. ADR-1316's reasoning is unchanged: a layer this session cannot give CI to is a
layer that does not ship. *Reversibility:* two-way, and the split stays cheap by the module
boundary this plan introduces.

**And no new surface outside `.claude/scripts/` this cycle.** The ops registry lands beside the
door it serves. arc's real layout problem — product code AND the spine living inside a vendor's
folder, where deleting `.claude/` would take the company's ledger with it — is named here and is
the **distribute lane's** work, not this one's: one atomic `git mv` PR with a compat shim, a lint
that fails new references to the old path, and a `migrate-layout` command. Splitting the tree now
would run two conventions at once for weeks and save nothing, because a directory move costs
references, not files.

**FV2-C — the module contract: four files, and no fifth.**
`module.mjs` (manifest) · `fold.mjs` (pure) · `ops.mjs` (verbs) · `View.tsx` (render).
`fold.mjs` imports nothing from React, Vite or three; `View.tsx` carries no branch worth
asserting. *Why:* CI never runs `npm install` at the repo root, so a decision inside a `.tsx`
is a decision nobody tests — the same reasoning `face/README.md` already gives, applied at
36× the scale. Enforced by `face-pure` (REQ-03), not by review.

**FV2-D — the registry is served; modules attach to it.** A module whose id is not in
`/api/rooms` FAILs `face-coverage`; a served room with no module renders through the generic
module and is REPORTED, never silently blank. *Why:* ADR-1306 exists because a renamed room
once emptied a screen. Two-way orphan checking is the version of that lint the module system
needs.

**FV2-E — council renders `--accent-dim`; violet stays the non-real family alone.** v0.7
merges them; `tokens.css` collision #2 separated them after computing what a screen carrying
both does to the eye. The reference is the target, the contract is the law, and the token
file is where they are made to agree — exactly as SOURCE.md already records for the v0.4
intake. *Provenance:* v0.7 design-system spec, token table row `--violet`.

**FV2-F — Tailwind v4 enters L3, and stops there.** `face/package.json` gains
`tailwindcss` + `@tailwindcss/vite` + `@phosphor-icons/react`; `face/src/lib/*.mjs` stays
dependency-free and node-importable, and the repo's zero-dep legs are untouched because L3
already has a `package.json` and a tracked lockfile. *Why:* v0.7 is built on Tailwind v4
utilities including the light-mode `white → ink` remap; hand-translating 36 rooms guarantees
drift and buys nothing. *Rejected alternative in §10.*

**FV2-G — no facts snapshot in the product.** If a module needs a repo fact, the door serves
it through an allow-listed read route; if no route exists yet, the module renders
`NOT SERVED` honestly and the gap lands in P04's list. A grep-lint refuses a bundled facts
module in `face/src/**`. *Why:* the snapshot's ancestor was already stale on arrival.

**FV2-H — the brain keeps its contract.** `POST /api/ask` → `face-ask`, zero write tools,
`ASK_ACTIONS` = `open_room` · `set_speed` · `enter_hq`. No provider key in the browser, no
`approve`/`reject` in the action vocabulary. The Engine room renders driver, model and health
— it does not hold a key. *Provenance:* REQ-07, E2, and the 2026-08-24 ruling in SOURCE.md.

**FV2-I — the WORK door is two-phase, and it has no logic of its own.**
`POST /api/op/:id/plan` returns a dry run — the exact command line, the file diff, the ₹
estimate — and `POST /api/op/:id/apply` runs it and streams. Every op in the server registry
calls **the same script or emitter a hand-run calls**; a fixture proves there is no second
implementation. File-touching ops write to a `feat/face-*` branch only, show the diff, and
stop: `main` is untouchable and **merge never exists in the face**. A tool's own guard
(send-window, cap, budget, lint) refuses in its own words and the face renders that verbatim.
*Why:* this is the affordance the owner has asked for three times, expressed so that A5 (no
second logic path), E2 and the git workflow law all still hold. The SESSION door starts
**`arc-run --driver …`, never a harness binary**: a session whose command line names a harness
fails the fixture. The driver layer already exists (`engine/router.yaml` classes, `RUNTIME_DRIVERS`,
`--driver auto`, the `drivers/<name> version` contract) and is the ONLY way a session picks a
runtime — the face is harness-neutral by construction, and one hardcoded binary would end that
silently.

**FV2-J — the four `extra` rooms are kept as modules, labelled.** `factory` · `executor` ·
`agents` · `story` exist in v0.7 and not in arc's registry. They ship as modules with an
explicit not-in-registry badge and are exempted by name — never silently — in
`face-coverage`. *Why:* deleting the owner's rooms to satisfy a lint is the lint winning an
argument it should not be in.

**FV2-K — the three planned rooms stay dotted.** `ops` · `trader` · `discover` render from
the planned-rooms registry, drawn dotted, and every write path inside them says `REHEARSAL`.
No manifest is invented for an unborn lane.

**FV2-L — Cycle 15 closes before this opens, and REQ-10 is carried, not force-closed.** The
dogfood requirement measures "every decision goes through the face" against a surface this
cycle replaces; five days on the interim surface prove nothing about the final one. Cycle 15
closes with REQ-10 recorded **NOT MET and carried** — the honest entry, and the same pattern
C2's REQ-07 used (mechanism proven, live value pending). *Provenance:* `face-dogfood` reads
1 of 5 days as of 2026-09-15.

**And this cycle's bar is TWO days, not five** — owner's call, 2026-09-16. The reason is on
the record rather than hidden in a number: the company's first goal is revenue from its
ventures, and the money chain is blocked on calendar-gated work (offer + price, the legal
pages behind Razorpay, sending-domain warm-up), so three extra dogfood days buy a weaker
thing than they cost. **Two days prove the surface is operable for real work; they do NOT
prove the habit holds.** REQ-10 is written to claim exactly that and no more, and a later
cycle may raise the bar when the habit — not the surface — is the question.

**FV2-M — the verification harness is ported, not re-invented.** `smoke.mjs` and `flows.mjs`
come across with their assertions intact — button text, placeholders, `data-*`, the h1
sentence and the events emitted are **frozen strings**, which is what makes a redesign of this
size safe to attack. *Why:* the design already proved 36/36 rooms and 20/20 flows with 0
console errors; re-deriving that bar in arc's own idiom would cost days and lose the assertions.

**FV2-N — light mood ships with dark, not after it.** The token law is only proven by two
moods; a single-mood ship leaves `hq-light` unexercised and the AA claims unchecked.
*Why:* v0.7's own failure mode was a light mode faked with `filter: invert()`.

## 4. REQ table (L-tier cap: 10 — all measurable)

| REQ | Delivers | Measured by | Phase |
|---|---|---|---|
| REQ-01 | **Design fidelity** — all 36 modules render against the v0.7 spec in both moods | `smoke.mjs` 36/36 rooms, 0 console errors, dark + light; per-room shot diff vs the reference baseline reviewed by a fresh agent | P03 |
| REQ-02 | **Token law** — one source, two moods, no literal colour anywhere | `docs/design/system/tokens.css` rewritten with every contrast ratio **computed** in the header; `face-tokens --check` green; grep-lint: zero hex/`white`/`black` literals under `face/src/modules/**` | P01 |
| REQ-03 | **Module contract** — four files, fold/view split, node-testable decisions | `face-pure` FAILs a planted branch in a `View.tsx` and a planted React import in a `fold.mjs`; every `fold.mjs` imported by `node` with no install in the 3-OS matrix | P02 |
| REQ-04 | **Coverage, both directions** — no orphan module, no unrendered served room, no undeclared op | `face-coverage` extended: module↔registry two-way + `ops[]`↔server registry; mutant control FAILs from birth; `face-coverage --selftest` arms grow with it | P02, P05 |
| REQ-05 | **Read truth** — no bundled facts, no unlabelled gap | grep-lint refuses a facts bundle in `face/src/**`; every module either cites a door route or renders `NOT SERVED`; the P03 exit list enumerates every gap by name | P03 |
| REQ-06 | **Door read routes** — the gaps P03 named are served | each new route allow-listed, read-only, parsers imported from the lints (never re-implemented); reader-only lint green; `dash-doors` suite grows one arm per route | P04 |
| REQ-07 | **Work door** — verbs that are the owner's hand, not a second brain | `/api/op/:id/plan` returns command + diff + estimate; `apply` emits a receipt; **no-second-path fixture** proves each op shells the real script; `main`-untouchable fixture; a tool refusal renders verbatim | P05 |
| REQ-08 | **Stamp unchanged** — the one write path survives the redesign | the Phase 03 byte-parity fixture still green; route-enumeration fixture proves no bulk path appeared | P05 |
| REQ-09 | **Harness in CI** — the design's own assertions become arc's | `smoke.mjs` + `flows.mjs` run in CI on the 3-OS matrix; every op has a flow; a planted string change FAILs | P03, P05 |
| REQ-10 | **Dogfood on the final surface** — **2 real days** where every decision goes through the face **and ≥1 op/day is run from it**. Claims the surface is operable; claims nothing about the habit (FV2-L) | `face-dogfood` journal↔`decision.recorded` match + op receipts on both days; retro logged | P07 |

## 5. The module contract — shape, and the 36 modules

### 5.1 The four files

```
face/src/modules/<ring>/<id>/
  module.mjs     manifest — who this module is
  fold.mjs       pure — door payload → what the screen shows
  ops.mjs        verbs — what can be DONE here
  View.tsx       render — kit components, no branches
```

```js
// modules/kernel/policy/module.mjs
export default {
  id: 'policy',                         // MUST exist in /api/rooms (FV2-D)
  ring: 'kernel',
  icon: 'ShieldCheck',                  // presentation only — the sentence comes from the door
  routes: ['/api/policy'],              // what this module reads
  kinds: ['policy.proposed', 'policy.changed'],
  ops: ['policy.propose-cap'],          // MUST exist in the server ops registry (REQ-04)
  render: 'bespoke',
}
```

```js
// modules/kernel/policy/fold.mjs — imported by node, no install, no React
export function fold(payload) {
  // → { kpis: [...], panels: [...] }   every decision on this screen lives here
}
export function refusalSentence(code) { /* the door's word, never a generic failure */ }
```

```js
// modules/kernel/policy/ops.mjs
export default [{
  id: 'policy.propose-cap',
  label: 'Propose a cap',
  fields: [ /* label, type, hint — rendered by the kit, validated by fold */ ],
  // plan()/apply() call /api/op/policy.propose-cap — the server holds the command
}]
```

```tsx
// modules/kernel/policy/View.tsx
export default function View({ data }: { data: Payload }) {
  const v = fold(data)
  return <><RoomHead …/><KpiStrip items={v.kpis}/>{v.panels.map(…)}</>
}
```

**Birth rule.** A new arc lane gets a room by adding one folder plus its registry row. The
rail, the palette, the map and `org` all read the served registry — **no shell file is edited
to add a module.** `/arc-face-module <ring>/<id>` scaffolds the four files from a template and
refuses if the id is not served.

### 5.2 The 36 modules

`✔` = a door route exists today · `★` = a new read route (P04) · `—` = renders from the
registry alone · `†` planned lane (dotted, REHEARSAL) · `*` not in arc's registry (labelled, FV2-J)

**command (6) — the daily surface**

| id | reads | verbs (P05) |
|---|---|---|
| `overview` | ✔ `/api/brief` `/api/rooms` | capture idea |
| `inbox` | ✔ `/api/inbox` `/api/decide` | **stamp — already live, REQ-08 protects it** |
| `map` | ✔ `/api/rooms` `/api/file/:id` | — |
| `spine` | ✔ `/api/spine` | — |
| `board` | ✔ `/api/board` `/api/lane/:id` | — |
| `ask-arc` | ✔ `/api/ask` | — (no hands, REQ-07) |

**kernel (8) — what the company runs on**

| id | reads | verbs (P05) |
|---|---|---|
| `engine` | ★ `/api/engine` | driver switch |
| `model-policy` | ★ `/api/model-policy` | tier proposal |
| `policy` | ★ `/api/policy` | cap proposal |
| `scheduler` | ★ `/api/jobs` | register job |
| `memory` | ★ `/api/memory` | log lesson · promote rule |
| `evolve` | ★ `/api/evolve` | open · measure · conclude experiment |
| `bench` | ★ `/api/bench` | paste model → run → propose |
| `absorb` | ★ `/api/absorb` | pin source · trial · adopt |

**factory (8) — how things get built**

| id | reads | verbs (P05) |
|---|---|---|
| `council` | ★ `/api/council` | convene (SESSION) · send-to-council |
| `develop` | ★ `/api/slices` + ✔ `/api/lane/:id` | slice · proof · close phase |
| `review-ship` | ★ `/api/gates` | review → qa → ship |
| `design-studio` | ★ `/api/design` | open brief · record pick |
| `toolbelt` | ✔ `/api/file/:id` | pin tool |
| `factory` * | ✔ `/api/board` | switch profile |
| `executor` * | ★ `/api/roster` | hire wizard (SESSION) · dispatch · terminate |
| `agents` * | ★ `/api/roster` | add agent (tier forces the ADR-0069 citation) |

**money (8) — where it is earned, or honestly not yet**

| id | reads | verbs (P05) |
|---|---|---|
| `money` | ✔ `/api/pnl` | ingest · criteria · close month |
| `growth` | ★ `/api/growth` | draft → review pack → publish |
| `leads` | ★ `/api/leads` | daily send (capped — the owner's keystroke as a confirmed button) |
| `legal` | ★ `/api/legal` | full-read gate stamp |
| `ventures` | ★ `/api/ventures` | register · kill review |
| `ops` † | — | REHEARSAL only |
| `trader` † | — | REHEARSAL only |
| `discover` † | — | REHEARSAL only |

**company (6) — what it is, and what it learned**

| id | reads | verbs (P05) |
|---|---|---|
| `law` | ✔ `/api/file/:id` | — (amendment is forever-CLI) |
| `learn` | ★ `/api/learn` | — |
| `strategy` | ✔ `/api/file/:id` | adopt plan · record ADR |
| `org` | ★ `/api/lanes` | set lane status · lane birth |
| `concepts` | ✔ `/api/file/:id` | define concept |
| `story` * | ✔ `/api/file/:id` | — |

**Route gap: 17 new read routes**, and the list is not final until P03 proves it — a module
that renders `NOT SERVED` is the evidence, not this table.

## 6. Phases (22d effort, risk-first)

| Phase | Appetite | Delivers | Evidence gate |
|---|---|---|---|
| **P00 — intake + contract** | 1d | v0.7 → `docs/design/reference/face-hq/` (v0.4 marked superseded); `SOURCE.md` rewritten; design-system spec → `docs/design/system/`; the 36-module contract frozen as JSON beside `contracts/expected-set.json`, with the **delta report** vs the served 34 | Reference runs from its own folder; delta report names every added/renamed/extra id |
| **P01 — tokens + kit** | 2d | REQ-02: `tokens.css` rewritten (`:root` landing untouched · `html.hq` · `html.hq.hq-light`, `--blue` added, council→`--accent-dim` per FV2-E), ratios computed in the header, generator run; `ui/kit.tsx` + `ui/bits.tsx` ported; Tailwind v4 + phosphor added to L3 | `face-tokens --check` green; the 9 existing bespoke rooms render on the new kit in both moods; colour-literal lint green |
| **P02 — shell + module frame** | 2d | REQ-03, REQ-04 (module half): the v0.7 shell (rail · header · ⌘K · voice dock); `face/src/modules/` tree; `lib/registry.mjs` two-way reconcile; `face-pure` lint; `/arc-face-module` scaffold | Planted branch in a `View.tsx` FAILs; planted orphan module FAILs; scaffold produces a green module in one command |
| **P03 — the 36 modules, read-side** | 8d | REQ-01, REQ-05, REQ-09 (smoke half). Five batches: **command 1d · kernel 2d · factory 2d · money 2d · company 1d** | Per batch: `smoke.mjs` green for that ring in both moods, 0 console errors; batch exits with its `NOT SERVED` list. Whole-phase: 36/36, fresh-agent honesty sweep |
| **P04 — door read routes** | 3d | REQ-06: the ~17 routes P03 named — allow-listed, read-only, lint parsers imported; `dash-doors` arms per route | `NOT SERVED` count drops to 0 or to a named, labelled residue; reader-only lint green; routes green on the 3-OS matrix |
| **P05 — work door + verbs** | 4d | REQ-07, REQ-08, REQ-04 (op half), REQ-09 (flows half): `/api/op/:id/plan\|apply`, the server ops registry, module `ops.mjs`, branch-only writes, `flows.mjs` in CI | No-second-path fixture green per op; `main`-untouchable fixture; byte-parity fixture still green; a planted string change FAILs the flows suite |
| **P06 — session door** | 2d | Streaming work: council convene, absorb read, hire certification — start/stream/attach, click-started only | A convened session streams its phases and lands its verdict as a receipt; no session starts without a click |
| **P07 — dogfood + retro** | 2 real d | REQ-10 on the final surface; retro; HISTORY entry | `face-dogfood` MET: 2 days, journal↔receipt matched, ≥1 op/day on both |

Each phase lands independently: feat branch → PR → owner merges (git workflow law). Branch
names: `feat/face-v2-<phase>`.

**Blocks and banking.** **A · look** (P00+P01+P02 = 5d) · **B · rooms + truth** (P03+P04 =
11d) · **C · verbs** (P05+P06 = 6d) · dogfood 2 real days. A block that finishes early banks
its remainder forward and never silently extends.

## 7. Pre-mortem (top 8)

| # | Risk | Mitigation |
|---|---|---|
| 1 | P03 becomes a 36-room slog and the cycle dies in the middle | Ring batches, each independently shippable and independently green; the rail renders un-ported modules generically the whole way, so the product is never broken mid-phase |
| 2 | The port silently changes behaviour the design had proven | `flows.mjs` and `smoke.mjs` assert on frozen strings, `data-*` and emitted events (FV2-M) — a reworded button FAILs |
| 3 | Modules drift back into fat `.tsx` files under time pressure | `face-pure` FAILs the branch, not the reviewer; the lint lands in P02 **before** the 36 modules are written |
| 4 | A `NOT SERVED` residue is quietly "fixed" by bundling a fact file | FV2-G's grep-lint; the P03 exit list is a named artefact the phase closes against |
| 5 | The work door grows its own logic because a CLI is awkward to shell | The no-second-path fixture is per-op, not per-door; an op without one does not ship |
| 6 | Light mode ships broken because everything was built dark-first | REQ-01 measures both moods per batch, not at the end (FV2-N) |
| 7 | Tailwind pulls L2 or `lib/*.mjs` into a build step | FV2-F's boundary is a lint: `lib/*.mjs` must stay node-importable with no install — already asserted on the 3-OS matrix |
| 8 | Dogfood slips again for the same reason as Cycle 15 | The launcher already solved the morning; REQ-10 now also requires ≥1 op/day, which only the work door makes possible — the phase cannot start before P05 is green |

## 8. Retro metric pack (pre-declared, spine-derived only)

Modules ported per day (batch trend) · `NOT SERVED` count at each P03 batch exit and at P04
close · console errors per smoke run (target 0, both moods) · flows passing / ops declared ·
ops run per dogfood day · decisions stamped through the face vs outside it · new lint arms
added vs modules shipped.

## 9. Kill criteria

- **Block A tripwire (day 2.5):** if the 9 existing rooms do not render on the new kit in
  both moods, stop and re-scope the kit port before any module work.
- **Block B tripwire (day 5.5 of 11):** if the first two batches (command + kernel, 14
  modules) are not green, cut the remaining bespoke folds to generic renders and re-plan —
  do not extend the block.
- **Block C gate:** if P05's no-second-path fixture cannot be made green for the six
  flagship ops, **the work door does not ship**; the modules render read-only with an honest
  no-verbs badge and the door moves to its own cycle.
- **Cycle kill:** if the owner scores the ported surface BELOW the reference twice on the
  same batch, stop porting and re-read the spec — the reference is the bar, and failing it
  twice means the port method is wrong, not the design.

## 10. Rejected registry (adjudicated 2026-09-15; do not re-litigate at kickoff)

| Rejected | Why |
|---|---|
| Amend Cycle 15 with `/arc-change` instead of a new cycle | The remaining 18d of Cycle 15's appetite does not hold 22d of work, and its REQ set was written for the v1 surface. A change request that replaces the product's entire look and adds two doors is a cycle, not an amendment |
| Force-close Cycle 15's REQ-10 to tidy the board | Dogfooding a surface about to be replaced measures nothing; NOT MET + carried is the honest entry (FV2-L) |
| Hand-translate v0.7's Tailwind utilities into token CSS | 36 rooms of manual translation, drift guaranteed, and the light-mode `white → ink` remap has no hand equivalent |
| Ship `arcFacts.js` as a seed "just for the rooms with no route" | Its ancestor was already stale on arrival; a stale fact wearing a live fact's clothes is the one thing the honesty classes exist to prevent |
| Keep v0.7's browser-side brain because it works | REQ-07 + E2; a prompt is not a tool contract (SOURCE.md, 2026-08-24) |
| Keep violet for council because the design does | Collision #2 was adjudicated with computed reasoning; the token file is where the reference and the contract are made to agree |
| Delete the four extra rooms to satisfy `face-coverage` | The owner's rooms outrank the lint's tidiness; they are exempted **by name** (FV2-J) |
| Per-venture pages inside `face/` | Owner ruling 2026-09-15 — ventures stay in their own repos; the `ventures` room is arc's own board over them |
| A second registry in the client (porting `roomRegistry.js` as truth) | ADR-1306 — a renamed room silently emptying a screen is the failure this law exists for |

## 11. Cross-plan obligations

- **engine** — `face-ask`'s `hq.policy.yaml` row still waits on the empty-allowlist seam
  (Cycle 15 carry-over). P05's ops registry must not route around it.
- **model-policy** — adding an agent from the `agents` module forces the ADR-0069 citation;
  the op refuses without one.
- **policy** — the `policy` module's cap proposal lands as an approval subject the inbox
  already folds; no new kind.
- **design** — `docs/design/system/tokens.css` stays the design lane's artefact; this plan
  rewrites its contents, not its ownership.
- **scheduler / memory / evolve / bench / absorb** — their read routes (P04) must import the
  same parsers their lints use, never re-implement them.
- **Zero new spine kinds.** Every op emits a kind that already exists in `validate.mjs`; an op
  that needs a new one is out of scope and says so.

## 12. Deferred (consciously)

- The model half of `face-ask` (waits on the engine seam).
- Mobile/tablet layouts beyond the 400 px no-horizontal-scroll bar v0.7 already holds.
- Multi-user anything — accounts, roles, sharing. The face is one owner's hand.
- A public/SaaS skin of the face; this cycle makes it *possible* by the module boundary, and
  does not spend a day on it.
- Animation beyond what v0.7 ships (motion dial 3).

## 13. Open decisions at kickoff (owner rules there; none block this file)

1. Cycle 16 vs continuing Cycle 15 — this plan assumes **new cycle after `/arc-retro`** (§14).
2. Appetite: 22d recommended; the owner gives the number.
3. P03 batch order — `command → kernel → factory → money → company` recommended (the daily
   screen first).
4. Whether the six flagship ops for P05 are: `capture-idea` · `register-job` ·
   `add-agent` · `bench-a-model` · `propose-cap` · `pin-tool` — or a different six.
5. Whether `story` and `factory` (extra rooms) earn a registry row instead of an exemption.
6. Whether P06 (session door) stays in this cycle or banks to the next.

## 14. KICKOFF PROMPT (paste-ready)

**Step 1 — close Cycle 15 first** (run in the arc repo, main clone; each is its own command):

```
/arc-phase-done 09
/arc-retro
```

Phase 09's CI verdict must be in before `/arc-phase-done`. `/arc-retro` closes Cycle 15 with
**REQ-10 recorded NOT MET and carried** (FV2-L) — `face-dogfood` currently reads 1 matched,
59 decided outside the face, 1 of 5 days. Do not force-close it.

**Step 2 — kick off Cycle 16:**

```
/arc-kickoff --lane face face v2 "The Workroom" — the owner's v0.7 HQ becomes arc's frontend: one token source in two moods, one shared kit, one shell, and 36 modules that are folders (manifest + pure fold + verbs + view), reading only what the door serves and writing only through doors the law already recognises.

Ground rules for this kickoff:
- Read docs/strategy/plans/PLAN-face-v2.md FIRST. Its §3 decisions (FV2-A…FV2-N) and §10 rejected registry are adjudicated and LOCKED — assign ADR numbers from the face band's next free number (1318+, swept across sibling worktrees per the band law), do not re-litigate. Attack the PLAN.md you produce, not this record. PLAN-face.md v1.0 stays in plans/ as Cycle 15's frozen decision record and is NOT superseded.
- Preflight: the face lane EXISTS (initiatives/face/) and Cycle 15 must be CLOSED before this runs — this is a new cycle of that lane, not a new lane. Archive the Cycle 15 PROGRESS per preflight rules; never overwrite silently. Cycle 15's REQ-10 is carried here as Phase 07, not re-declared.
- Brownfield: run codebase-surveyor on face/src/** (App.tsx, lib/*.mjs, rooms/*.tsx, tokens.css), .claude/scripts/hq/arc-dash.mjs, .claude/scripts/core/face-tokens.mjs, face-coverage, and the reference at docs/design/reference/face-hq/.
- Hard sequence: P01 (tokens + kit) and P02 (module frame + face-pure lint) are green BEFORE any of the 36 modules is written. A lint that lands after the code it governs governs nothing.
- P03 runs in five ring batches (command, kernel, factory, money, company), each its own feat branch and PR, each exiting with its own NOT SERVED list. That list — not this plan's table — is what P04 builds routes against.
- P05's work door ships per-op or not at all: an op without a green no-second-path fixture does not ship, and the module renders read-only with an honest badge instead.
- Non-negotiables: the served registry is the only room list (ADR-1306) · tokens have one source and the copy is generated (ADR-1308) · every decision lives in a .mjs node can import with no install · POST /api/decide stays byte-parity with arc-inbox · zero new spine kinds · branch-only writes, main untouchable, merge never in the face · no provider key in the browser · the session door starts arc-run --driver, never a harness binary · no new surface outside .claude/scripts (the layout move is distribute's, in one atomic PR) · real vs simulated/rehearsal/planned never mixed · zero repo writes before approval.
- Appetite: I will give the number (recommendation on file: 22 days effort in three banked blocks + 2 real dogfood days → Tier L). Kill criteria per §9 — the Block B tripwire gates all work-door spend. REQ-10's dogfood bar is TWO days by owner's call (FV2-L) — do not raise it back to five, and do not let it claim the habit holds.
- Owner parallel steps: rule on §13 items 4 and 5 before P05; run the git for every phase PR.
Emit kickoff.done + approval.requested{gate: kickoff} and STOP.
```
