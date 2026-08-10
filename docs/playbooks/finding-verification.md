# Playbook — verify a finding before you emit it

**Where this is wired, exactly one surface: `/arc-audit`.** Not `/arc-review`, not `/arc-qa`, not
`/arc-design`, and **not** the two-surface adversarial pass every phase runs — those emit findings a
human acts on and none of them carries this rule. Do not read the list of *candidates* below as a
list of *callers*. Grep for this filename: one hit outside this file is the whole coverage.

**Provenance.** Found by studying an external review agent read-only
(`initiatives/absorb/evidence/phase-04/extraction-report.md`, technique **T-01**, source pinned by
sha256, **license NOT FOUND**). Nothing is copied. The rule below is arc's own re-expression against
arc's own surfaces, which is the only thing an absent license permits.

---

## The rule

**A finding is UNVERIFIED until you can quote the source line that motivated it.**

Every finding carries three fields, and a finding missing any of them is not a finding yet:

| Field | What it holds |
|---|---|
| `claim` | what is wrong |
| `cite` | repo-root-relative `path:line` or `path:from-to` |
| `quote` | the verbatim text at `cite` |

`cite` without `quote` is the failure this catches. A plausible-looking `path:line` is the cheapest
thing in a review to invent and the most expensive thing to check, so the reviewer who made the claim
resolves it once, instead of every reader resolving it forever.

**`cite` grammar, pinned so two readers cannot differ.** Repo-root-relative. Resolved against the
**working tree at HEAD**, never against diff line numbers — the default audit scope is
`git diff main...HEAD`, and a quote lifted from a `+` line carries the `+` and a line number that
does not exist in the file. A path outside the repo (a pinned external source) cannot be re-quoted by
a reader and is **not** a valid `cite`; describe it in prose and mark the finding unverified.

### One `cite` + `quote` per asserted clause

A claim with two clauses needs two citations. This is the rule's main evasion and it is fully
compliant with a naive reading:

```
claim: lib/supabase/admin.ts is imported by a client component, so the service-role key
       ships in the client bundle.
cite:  lib/supabase/admin.ts:14
quote: const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!);
```

The `quote` resolves. It also proves nothing: the load-bearing clause is *"is imported by a client
component"*, and nobody opened an importer. **A claim whose subject is a relationship between two
locations needs both quoted, or it is unverified.** One quote per finding is how a verified-looking
finding smuggles an unchecked assertion into a tracked issue.

### Absence is quotable, by anchor

Most security findings are absences — no signature check, no RLS policy, no auth on a route — and a
naive reading routes every one of them to the appendix, which would make the entire missing-control
class unreportable. It does not.

**For a missing-control finding, `cite` is the line where the control must appear** — the handler, the
route definition, the table definition — and `quote` is that line. The claim then reads "this handler
does not verify the signature", anchored at the handler. That is a verified finding, not an appendix
entry.

**The appendix is for findings with no anchor at all**: a defect that only appears at runtime, an
interaction with no single locus, a suspicion without a location.

## What happens to an unverified finding

**It goes to an appendix. It is never deleted.**

`## Appendix -- unverified` — a **top-level `##` section, last in the report, never nested inside a
severity group.** Nesting it under `## HIGH` re-attaches the severity this section exists to withhold,
and every checker of this rule is a text search that nesting walks straight past.

Each entry carries whatever partial evidence exists, one line on what was missing, and a
**provisional severity**. The provisional severity **gates and never opens an issue** — see the two
paragraphs below, which are the difference between this rule helping and this rule doing harm.

**Always state the appendix count in the report's first paragraph, including when it is zero** —
`Appendix -- unverified: 0 entries`. A conditional count is invisible in exactly the case where it
matters: a reviewer who drops three unquotable findings outright produces a report indistinguishable
from one that had nothing to set aside. The stated count must equal the number of entries.

**The provisional severity exists because without it this rule is worse than no rule.** Consider an
auditor 9/10 confident that a payment webhook trusts a client-supplied amount, where the defect is the
absence of a signature check. Route it to a severity-less appendix and it is not a CRITICAL, so "zero
CRITICAL findings remain open" is true, so the security ledger stamps, so the ship gate goes green —
on a finding that before this rule would have blocked it. **A gating decision must read the appendix.**
`/arc-audit` implements this: it stamps only when no CRITICAL remains open in *either* section.

**And the appendix is a record, not a mechanism.** The source practice paired it with a
calibration-learning loop that read entries back and measured how often the gate was wrong. **That
loop is not rebuilt here.** Nothing in arc reads this appendix, so it prevents a false negative only
to the extent a human opens it. Do not read the sections above as saying the appendix makes this rule
safe; they say the appendix and the provisional severity are the two things that stop it being
obviously unsafe.

## The clause that stops the obvious workaround

**Raising a finding's confidence, or asserting a severity, to make it look verified defeats this
rule, and is worse than the finding it protects.**

The gate is on the *quote*, not on stated certainty. There is no confidence level that substitutes
for a resolved citation, and no "clearly" or "obviously" that does either. A reviewer who cannot quote
the line and emits the finding anyway with a raised severity has not skipped a bureaucratic step — it
has laundered an unverified claim into a tracked issue somebody will spend a day on.

This clause exists because the workaround is invisible in the output: a laundered finding and a
verified finding read identically. The only place it shows is the missing `quote`.

## What this claims, and what it does not

**Claims:** it removes findings whose motivating line does not exist or does not say what the claim
says.

**Does not claim:** general accuracy. A finding can be fully quotable and still wrong — the quote
proves the line exists and says what was claimed, not that the conclusion holds. This is **not a
substitute for the adversarial pass**, and a surface that adopts it has not earned fewer reviewers.

**Checkable by a reader — and nothing in arc checks it.** No lint reads an audit report; no test opens
one. The second half of the claim ("does not say what the claim says") is the reviewer's own
certification. "Verification happens before emission" is likewise a discipline, not an observable: no
artifact distinguishes verify-then-write from write-then-resolve. **The fields are the technique; the
ordering is the intent.**

**NOT YET MEASURED — and the earlier version of this section said otherwise.** REQ-03's A/B has
**three fixtures named and zero executed** (`initiatives/absorb/evidence/planoff/LEDGER.md`, and
`README.md` there reads *"None yet"*). The one real result on the record is a single sealed blind
preference on *wording*, not on fixtures: `planoff/PHASE03-CHAIN-V2/RESULTS.md`, decision
`01KZKBYSQ5J46Y82PRN7W3AJNH` — whose own text says *"No fixture was executed… REQ-08 remains NOT
MET."* So the appendix's protective effect is a design argument, and the true-but-unquotable case is
its **only planned positive control and has not run**. When the A/B lands, this section gets numbers
or this file gets retired through the registry — not quietly softened.

## How to apply it

1. Draft the finding: what is wrong.
2. For **each asserted clause**, open the file and find the line that motivated it. For a missing
   control, that is the line where the control must appear.
3. Paste it verbatim into `quote`, with its repo-root-relative `path:line` in `cite`.
4. **Cannot find it?** Then either the claim has an anchor you have not looked at yet — and if you
   restate the claim against a line that IS there, the restated claim must be the *whole* claim, not
   the undisputed half of it — or there is no anchor, in which case the finding goes to the appendix
   with a provisional severity and one line saying what was missing. Both are fine. Emitting it as
   verified is not.
5. State the appendix count in the summary, including zero.

## What is NOT enforced, and cannot be from here

**The rule binds whoever writes the finding, and on `/arc-audit` that is the `security-auditor`
subagent — whose definition this playbook cannot reach.** `.claude/agents/**` is off the ADR-0602
allowlist; the owner ruled DO NOT WIDEN on 2026-08-09 and that stands. So:

- `security-auditor.md` mandates `Severity / Location / Exploit scenario / Fix` and does not know
  about `claim`/`cite`/`quote`.
- It is told to **drop** a finding it cannot write an exploit scenario for, and to report only at
  `>= 8/10` confidence. Those are deletions, which this playbook forbids — a contradiction that ships
  in the same product (`products/review/manifest.json` installs both files).
- The `/arc-audit` orchestrator has no `Read` tool in its `allowed-tools`, so it cannot resolve a
  citation even if it wanted to.

**The only enforcement reachable from inside the allowlist is the caller forwarding this requirement
into the subagent's Task prompt**, and re-routing those two drops as appendix entries. `/arc-audit`
does both. That is a prompt-level instruction, not a gate: it is weaker than a lint and it is what is
available. Fixing it properly means the review *method* in `.claude/agents/code-reviewer.md` and
`security-auditor.md` — ADR-0602 Amendment 1's routes 1 and 3 — and `products/absorb/registry.json`
records T-01 as **`candidate`**, not as an adoption, for exactly this reason. A playbook plus one
forwarded prompt is the honest v1, not the destination.

## A sibling that already has this defect

`.claude/scripts/absorb/report-lint.mjs` requires every extraction-report row to carry a `citation`
and **does not require a quote** — the precise thing this playbook calls "a coordinate, not evidence".
The lint now WARNs on an approximate citation, and the gap is recorded rather than closed, because
adding a required `quote` column is a format change to a shipped report shape. This playbook's own
provenance row cites `~1275-1281` in a file that is not in this repo: cite-without-quote, in the
document that names cite-without-quote as the failure. Recorded, not excused.
