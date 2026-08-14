# Evidence bundle — phase 02 · lane legal

**Guards and governance: nothing about a published page can move without someone deciding it.**

## What exists

| Piece | Verb / file | What it refuses |
|---|---|---|
| Per-venture pins | `pins.yaml` beside each venture's facts | a missing pin (never defaults to the newest set); a pin naming a set that does not exist; a pin that is not a set name |
| Template bump | `bump-templates --venture X --to vN (--guard F \| --no-guard)` | a no-op bump; a bump whose new set does not render (pin rolled back); a stale or missing CI guard |
| Verifier | `verify --venture X --dir D` | INTACT / TAMPERED / UNVERIFIABLE, three verdicts and three exit codes |
| Venture CI guard | `ci-guard --venture X` | generated, carries no comparison logic, refuses shell-unsafe input |
| Template approval | `propose-templates --set vN` + `approved-sets.json` | publishing a set whose prose is not the prose a human approved |
| Launch checklist | `checklist --venture X [--evidence F]` | a blank row; an outcome outside the four; NOT-APPLICABLE with no reason; a row with no `source_url` |

## The exit criteria, and where each is met

- **`--verify` re-derives and classifies, never trusting a declared version.** Three verdicts, not
  two: `UNVERIFIABLE` exists because **a stale format is not tampering** — a verifier that calls
  it that cries wolf across the estate on upgrade day, after which nobody reads its output.
  Mutant controls: a one-byte page edit → TAMPERED; a record with no preimage label → UNVERIFIABLE;
  the same unlabelled record with an edited page → still TAMPERED.
- **The venture-side CI guard is GENERATED from the function `--verify` calls.** It contains no
  comparison logic at all — the test asserts the *absence*: if `sha256` ever appears in the
  generated text, someone has inlined the comparison. Proven end to end in the layout a venture
  uses: clean tree exit 0, one appended byte exit 2.
- **`pins.yaml` per venture, two ventures on different sets in one run.** `v2` is a real second set
  (v1 plus a revised clause), two fixtures pinned to it and four to v1, all six rendering clean
  with visibly different set hashes.
- **`--bump-templates` forces re-approval, and a publish against a moved set without a bump is
  refused.** Both are the same mechanism seen from two sides, and the mechanism is **arithmetic,
  not a flag**: moving the pin changes `template_set_sha`, publish re-derives it and refuses. There
  is no separate needs-re-approval state that could drift out of step with the hashes.
- **Template-edit approval (REQ-07).** The per-venture approval approves a venture's FACTS; it does
  not approve the WORDING every venture shares. `approved-sets.json` records which set versions a
  human approved and at which bytes. A set absent from the record is NOT approved.
- **Launch checklist from `provider-pages.json`.** 5 provider-required, 2 provider-conditional per
  ADR-1001, counts asserted. All rows manual (probe automation cut #1 at kickoff). Four outcomes,
  `NOT-CHECKED` the default and a real answer.
- **Where the operator is not the merchant, activation rows are NOT-APPLICABLE with the reason**
  (ADR-1011) — rendering them green would tell an operator they had cleared a gate they were never
  standing at.

## Two-surface adversarial pass — ten holes, and two found the same two

Decision logic and shell/OS, fresh, blind to each other, both carrying the 28-row defect list.
**Both independently found the same two criticals**, which is the strongest signal this doctrine
produces.

| # | Hole | Why it mattered |
|---|---|---|
| 29 | The unapproved-file check was in `verifyChain` and **not** in `verifyPublished`, twelve lines below in the same file | Publish refused a stray page; verify blessed it forever. Verify is the half the guard runs in the VENTURE's repo — the one place no twin-fix sweep of this repo can reach |
| 30 | `verifyPublished` took its work-list from the record it was auditing | Deleting one key emptied the loop; verdict INTACT with every page defaced |
| 31 | The directory listing was flat | An unapproved page one level down published at exit 0 while identical bytes at the top level were refused |
| 32 | A page id read out of the record was joined into a path unconfined | A record naming `../decoy/terms` hashed a clean copy outside the directory and called the defaced one inside it INTACT |
| 33 | `canRederive` trusted the declared preimage label | Relabel a tampered record and TAMPERED became UNVERIFIABLE — with the tool then printing "re-publish under the current format", an instruction to launder the edit |
| 34 | `ci-guard` interpolated unvalidated input into generated bash | Command execution in the venture's CI, and a `--dir` that made the guard exit 0 having verified nothing |
| 35 | `bytesHash` hashed raw text while every input was normalised | On a Windows checkout **all seven pages verified TAMPERED on an untouched tree**. A guard that cries wolf on a clean checkout is one people switch off |
| 36 | The launch checklist had **zero tests** | Every body could have been deleted and the suite stayed green |
| 37 | A checklist note containing `|` rewrote the rendered outcome column | The blank-row guard inspects the OBJECT, so it could not see it |
| 38 | Assertions that pass on two error strings | The five-shape gate test asserted only `!= 0`; a two-set test compared two shas without checking either probe succeeded |

Two more the attackers proved with mutants rather than reasoning:

- **`SET_NOT_APPROVED` had no coverage.** The test that claimed to cover it deleted the whole
  `sets` map and exercised a different branch, so a one-line mutant (`sets[set] ?? sha`) passed all
  three approved-set tests **and published a set with no approval at all**.
- **`--guard` was optional by omission** — row 27's class, straight back, in the file the previous
  attacker had already hardened.

## Then CI went red, and the red was mine

Tightening `--guard` to mandatory broke two of my own bump tests; `--no-guard` did not parse
because every flag was assumed to take a value; and the stale-format test's premise stopped being
true the moment an unrecognised label became TAMPERED.

That last one is worth keeping. The tempting repair was to add a fake older version to the known
list so the test could pass. **`arc-legal-canon/1` is the only format this engine has ever
written**, so a genuinely older label does not exist — inventing one would be a lie told to make a
test green. A record with NO label asks the same question honestly, and that is what the test uses.

## Honest gaps carried out of Phase 02

- **The generated guard is CWD-relative** and works from the repo root. From elsewhere it exits 1,
  which its own header does not document. Named by the OS attacker; not yet fixed.
- **`--request` proves the operator retyped the decision file's own field.** Nothing correlates it
  with a real `approval.requested` event, so it catches a copy-paste slip rather than a decision
  minted about different bytes.
- **Case-insensitive filesystems**: `verifyPublished` finds `Terms.mdx` on Windows/macOS and not on
  ubuntu, so a verdict can differ by OS.
- **`publish-gate.mjs` still has no dedicated CI step** — `.github/` is write-denied here, so it
  runs inside the bats step. A publish target still turns the build red; the clear label is what
  is lost.
