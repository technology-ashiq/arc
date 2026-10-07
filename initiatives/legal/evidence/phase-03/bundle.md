# Evidence bundle — phase 03 · lane legal

**The real render: one real venture's real facts became seven approved, receipted pages,
committed into the venture's own tree. Everything a paused venture cannot prove stays OPEN.**

Closed 2026-10-07. The operator's facts are not quoted anywhere in this bundle: arc's repository is
public, and they live in the owner's private facts file and in LexOS's private repository only.

## The exit criteria, and where each is met

| Criterion | Where | Proof |
|---|---|---|
| GST posture from the owner, recorded in the facts | LexOS `legal/facts.yaml` `gst_registered` | the owner stated it; the field is set (value kept out of this public bundle). Assumptions row 3 closed |
| Rule 3 / s.5(3) re-verified against the gazette before publish | PLAN assumptions row 2 (`FIRED 2026-10-07`), ADR-1215 | G.S.R. 846(E) read from the MeitY host (HTTP 200): commencement 13-May-2027 holds, Rule 3(c) gap closed by template set v3 (PR #366, `5a46cce0`) |
| `approval.requested` for the full set; owner reads the real pages and decides via `arc-inbox` | spine | request `01M4AHJZPVC46NN5PDYRAZK2WW` · decision `01M4AKZ32VHVY264SBKMHWZZYA` (`decision.recorded`, verdict `approve`) |
| Pages, `pins.yaml` and receipts committed into LexOS on a branch, never its `main`, never deployed | LexOS `feat/legal-pages` `645efcf` | seven `.mdx`, `facts.yaml`, `pins.yaml`, `pages/_published.json`, `pages/_approval.json`, `published.json`. **Deviation, stated:** the branch was pushed to LexOS's PRIVATE remote under the owner's standing push permission of 2026-10-07. Not merged, not deployed |
| A `--venture-dir` venture's ledger lives beside its facts, never in arc's public tree (ADR-1214) | `~/.arc-private/legal/lexos/published.json` | written by this publish; `products/legal/published/` does not exist in arc's tree at close. Fixture proof: `legal-receipts.bats` (PR #357) |
| LexOS-side integration handoff checklist | LexOS `legal/HANDOFF.md` | route wiring (7 paths) · the missing footer · signup consent capture · cancel-path UI parity · grievance and deletion mailboxes · provider dashboard fields |
| Live-deploy and production-probe rows `OPEN-at-venture-resume` | LexOS `legal/HANDOFF.md` §1-§7 | every live-site row says `OPEN-at-venture-resume`; none is green. LexOS is PAUSED |
| Production publish count read from the spine | below | **1 production · 3 fixture** |
| Evidence bundle, linking not copying | this file | no screenshots exist: there is no served site to capture |
| `/arc-retro` with the scope-creep question | follows this close | |

## The live demo, run against the real spine (2026-10-07, canonical clone at `3f953e25`)

1. `render --venture lexos` with the private venture dir → **7 pages, `0 FAIL, 0 WARN`**, facts
   `e84abe10…`, set `v3@240b7949…`. No `PLACEHOLDER` text in any page.
2. `propose --dry-run` → digest `e7d5082f…`; `propose --expect e7d5082f…` →
   **`approval.requested 01M4AHJZPVC46NN5PDYRAZK2WW`**.
3. The owner read the seven pages and stamped through `arc-inbox` → **`01M4AKZ32VHVY264SBKMHWZZYA`**,
   recorded 2026-10-07T12:54:08+05:30. That is before `effective_date` 2026-10-20, so the stamp is not BACKDATED.
4. `publish --request 01M4AHJZPVC46NN5PDYRAZK2WW` → **`published 7 page(s) for lexos`, bound to
   decision `01M4AKZ32VHVY264SBKMHWZZYA`**, exit 0.
5. Both ids verified by id: **1** hit each in `.claude/state/hq/events/*.jsonl`, **0** in
   `events/_quarantine/`.
6. `verify --venture lexos --dir <LexOS>/legal/pages` → **`verdict: INTACT`**, exit 0.
   - Negative control (the mutant runs): the same pages with one byte appended to `about.mdx` →
     **`verdict: TAMPERED`**, exit 2.
   - CRLF control: every page converted to CRLF, as a Windows checkout of LexOS would do →
     **`INTACT`**, exit 0. The CRLF normalisation therefore does not make a fresh clone fail its own guard.

## The production publish count (spine, 2026-10-07)

| Request | What | Decision |
|---|---|---|
| `01M46QX0KG8CB77HSX9AEE638E` | fixture-gateway-nogst · set v1 | approve |
| `01M48WX1AK96C9Q8RZJY7WYMB9` | fixture-gateway-nogst · set v1 | approve |
| `01M498H3WKN5SNS9TPHYMY2JZT` | fixture-gateway-nogst · set v1 | approve |
| `01M4AHJZPVC46NN5PDYRAZK2WW` | **lexos · set v3** | approve |

The engine has now published one real venture. Before today it had been proven only on fixtures.

## Still open, honestly

Everything that needs a served site: route wiring, the footer, consent capture, cancel-path parity,
the mailboxes, the live checklist. All of it is `OPEN-at-venture-resume` in LexOS `legal/HANDOFF.md`.
`legal/ci-guard.sh` can now be wired into LexOS CI. That is also deferred until the venture resumes.

## Attack record

`attack-a544ce1-r1-{logic,boundary}.json` (this dir): Phase 03's one code change (ADR-1214),
attacked before PR #357 merged. Low findings are in `debt-ledger.md` § Phase 03.
