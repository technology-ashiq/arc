# arc-council — Should arc's attack pass redact credential-shaped text inside an attacker's findings, instead of refusing the attacker's whole report? (2026-09-25)

Roster: advocate, skeptic, neutral, engineer. Mode: deep (headless run).

**Decision statement:** *When an attacker's report in arc's attack pass (/arc-attack, run headless through arc-run) contains credential-shaped text, arc should mask the matching spans in place and pass the rest of the report on, instead of refusing the whole report.*

**Reading taken (headless, no one to ask):** "redact" = replace each matched span with a marker and keep the rest of the report. "Refusing the whole report" = today's behaviour: arc-run's `scrub()` finds a hit, stops the run, and every finding in that reply is lost. Domain: development / security engineering, so the engineer was convened. No other domain clearly matched.

**Headless process notes:**
- In this run the Chair could write only this one session file. Member outputs and rebuttals went to the verifier verbatim inside its prompt, not as separate files. The researchers' fact packs were folded into the Evidence Brief (F1-F27) with their file:line citations.
- The juror script is not on this run's tool list, so no cross-model juror ran. This is stated below and was not skipped silently.
- The web tools were denied to the researchers, so the research mode is `model-knowledge`. The repo facts (F1-F21) come from reading the local tree directly. The industry facts (F22-F27) are unverified model knowledge.

**Brief-framing disclosure (the verifier caught this, recorded here rather than buried):**
- F16 said ADR-0028 "rejected 'redact at read time'", which invites a mix-up. ADR-0028 chose redaction at emit. It rejected redacting when the log is *read* instead of when it is *written*. The proposal masks at write time, so that rejection does not apply to it. What does apply is ADR-0028's Decision text: on a scanner hit, the whole input is refused (`:31-34`). The ADR is marked one-way, and its lines 8-9 lock the drop-never-leak direction.
- F12 listed stream mode's `liveLine()` as existing redaction code. It holds back whole lines and does not mask spans, so there are two in-place masking copies, not three.
- The brief left out that the attacker's input is scanned before any driver sees it (`arc-run.mjs:1719`).

**Verifier findings not raised by any member:**
- arc-attack cannot see the findings before the scrub runs. arc-run scans the driver's raw stdout at `arc-run.mjs:1627`, before any parsing, and scans the payload again at `:1933`. It prints only after both scans pass. arc-attack reads stdout only on exit 0 (`arc-attack.mjs:324-343`). So any masking would have to live in the shared arc-run scrub path, at two sites at least, or behind a per-process switch inside arc-run.
- `scanSecrets` does more than match the raw text. It also matches key-named fields and scans other versions of the text: with whitespace removed, with invisible (zero-width) characters removed, with string fields joined, and base64-decoded (`redact.mjs:143-216`). A hit that only exists in one of those versions has no raw-text span to mask. `fixed-defects.md:552` records ordinary prose ("risk-assessment") reading as an `sk-` key once spaces are removed. Masking raw spans therefore would not fix the false positives that motivate the proposal: the masked text would still fail the re-scan.

## VERIFIER RATINGS
- A1: Supported — the reply is one JSON object (`attack-diff.process.yaml:119`), and the prompt itself says one literal sample loses every finding (`:115`)
- A2: Weak — `clean()` runs only on a failed run's stderr tail, after arc-run has already refused, and it matches raw text only; arc-attack never sees findings before the scrub
- A3: Weak — a refused surface writes no evidence, so the preflight (`arc-attack.mjs:256`) lets the same `--round` run again; a refusal costs one model call, not one of the two rounds
- A4: Plausible — the narrowed claim holds (one whole refusal, in the diff; the findings case is untested), but after the concession it no longer supports masking as a fix for false positives
- A5: Plausible — input is scanned before the driver runs (`:1719`), so a hit in findings is probably generated text; the key-field half doesn't apply to the findings schema
- A6: Weak — unverified model knowledge, selectively read; F22 calls masking not a security boundary, F23 shows raw-by-default, F24 lists BLOCK beside MASK
- S1: Supported — ADR-0028:31-34 refuses the whole input on a hit, and masking-then-passing is not among its options; the ADR is one-way and lines 8-9 lock the fail-safe direction; redact.mjs, the scanner the attack pass uses, cites it
- S2: Plausible — evidence bundles are committed (`.gitignore:30`), but a scanner miss leaks under either design; the masking-specific risk is a hit caught only in a derived version of the text
- S3: Supported — no end-to-end findings test exists (F21), and CLAUDE.md requires an adversarial construct-a-breaking-input pass before a gate change counts as done
- S4: Weak — "works today" is conceded, and nothing shows a fresh attacker agent knows or responds to the whole-report penalty beyond the prompt text, which masking does not remove
- S5: Plausible — the loss mechanism is real, but the `[<rule> redacted]` marker is visible, so it is not silent, and the loss is smaller than a whole refusal
- S6: Plausible — two or three copies exist and the drift risk is real (`arc-run.mjs:812-813` warns against copying the rules), but a shared export avoids it
- N1: Weak — it gets ADR-0028 backwards: ADR-0028 chose redaction at emit and rejected read-time redaction
- N2: Supported — one hit loses every finding; softened by the same-round re-run, but real
- N3: Plausible — the copies exist, but "no recorded leak" is absence of evidence, and the copies cover less than `scanSecrets`
- N4: Plausible — the destination is public, but scanner-miss risk is the same under either design
- N5: Supported — `fixed-defects.md:757` is the only incident, and it came from the diff at the input boundary
- N6: Supported — false positives are recorded (`:525/:549/:552/:766`), and no findings-path test exists
- EN1: Weak — "low cost" assumes the masking copies are enough; they leave out the structural rule, the derived views, base64 decoding and the joins
- EN2: Weak — wrong hook point: stdout is scanned at `:1627` before `succeed()`, and arc-attack gets nothing before the scrub
- EN3: Plausible — not weakening the shared gate is right, but "arc-attack's own findings path" doesn't exist; limiting the change needs a per-process switch inside arc-run
- EN4: Supported — the public destination is confirmed, and masking raw text cannot neutralise hits found in the derived views (`redact.mjs:148-186`)
- EN5: Supported — the one incident was the diff; nothing on record came from findings
- EN6: Weak — conceded by its author: one bats case cannot cover every derived-view path, and the doctrine requires an adversarial pass

## FIRST-PASS RATINGS
- A1: Supported — the reply is one JSON object and the prompt warns one literal sample loses every finding
- A2: Weak — `clean()` runs only on a failed run's stderr tail, after arc-run refused; arc-attack never sees findings before the scrub
- A3: Weak — a refused surface writes no evidence, so the same `--round` can run again
- A4: Plausible — the false positives elsewhere are real, but no findings-caused refusal is on record, and masking doesn't fix false positives
- A5: Plausible — input is scanned before the driver; the key-field half doesn't apply
- A6: Weak — unverified model knowledge, selectively read
- S1: Contested — ADR-0028 did choose refuse-on-hit, but the "rejected redact at read time" line is misapplied
- S2: Plausible — bundles are committed, but a scanner miss leaks under either design
- S3: Supported — no end-to-end findings test, and the adversarial-pass doctrine applies
- S4: Weak — "zero incidents proves the prompt works" is an unproven causal claim
- S5: Plausible — the loss is real, but the marker is visible, so not silent
- S6: Plausible — the drift risk is real but avoidable with a shared export
- N1: Weak — it gets ADR-0028 backwards
- N2: Supported — one hit loses every finding
- N3: Plausible — absence of evidence; the copies cover less than the scanner
- N4: Plausible — the destination is public, but the miss risk is the same either way
- N5: Supported — the only incident came from the diff
- N6: Supported — false positives recorded, no findings-path test
- EN1: Weak — the masking copies cover less than the scanner
- EN2: Weak — wrong hook point
- EN3: Plausible — right about the shared gate, but no separate findings path exists
- EN4: Supported — public destination, and derived-view hits cannot be masked
- EN5: Supported — nothing on record came from findings
- EN6: Contested — one bats case does not satisfy the adversarial-pass doctrine

## REBUTTAL LOG
- S1: Contested → Supported — the author dropped the misapplied read-time citation and rested the point on ADR-0028's Decision text (`:31-34`, whole input refused on a hit; one-way, lines 8-9), which the verifier confirmed
- S4: Weak → Weak — the author conceded "works today" and the regex-blind-spot leg; the remaining incentive claim has no evidence that the attacker agent responds to the penalty
- EN6: Contested → Weak — the author conceded: the test and attack work is multi-case, one family per derived view, plus the adversarial pass

**Rebuttal-set IDs outside the log.** A4 was in the rebuttal set because the verifier listed it under DISPUTED. It was first rated Plausible, and the lint's `## REBUTTAL LOG` accepts only points first rated Weak or Contested (ADR-0014). Result: A4 stayed Plausible. The author conceded that A4 cannot count as evidence that masking fixes false positives.

## UNRESOLVED
- [A4]: the real false-positive rate of `scanSecrets` on attacker findings text is unmeasured on both sides. No findings-triggered refusal is on record (N5), but prose can match once whitespace is stripped (`fixed-defects.md:552`), so the rate could be zero or not.

## VERDICT
PREDICTION: CONDITIONAL / Medium (recorded at intake, before research and members) → RESULT: NO / Medium. The evidence changed my mind. I expected masking to be a cheap, contained reuse of existing code. Instead, the verifier found that arc-attack cannot reach the findings before arc-run's shared scrub. It also found that the scanner catches hits in derived versions of the text that have no raw span to mask. So masking would not fix the false positives that motivate it, and it would reverse a one-way ADR on the scanner the attack pass shares.
DECISION: NO
CONFIDENCE: Medium
Research mode: model-knowledge
Juror: unavailable (headless council-convene run: council-juror.mjs is not on this run's tool allow-list)
Roster: advocate, skeptic, neutral, engineer

KEY REASONS:
- [S1] **Masking would reverse a one-way decision.** ADR-0028's Decision text refuses the whole input when the scanner finds a hit (`:31-34`). Masking and passing the rest on is not among its options. The ADR is marked one-way and locks the drop-never-leak direction (lines 8-9), and the attack pass uses that same scanner (`redact.mjs:1`). A change here needs its own ADR, not a quiet edit.
- [EN4] **Masking cannot handle a large share of the scanner's hits.** `scanSecrets` catches hits in whitespace-removed, zero-width-removed, joined and base64-decoded versions of the text (`redact.mjs:143-216`). Those hits have no raw-text span to mask, so the masked text would fail the re-scan. The false positives that motivate the proposal (prose like "risk-assessment" reading as `sk-`) are exactly this kind. Evidence bundles are committed to a public repo (F9), so the correctness bar is high.
- [EN3] **There is no contained place to put the change.** arc-attack reads arc-run's stdout only after both scans pass (`arc-run.mjs:1627`, `:1933`; `arc-attack.mjs:324-343`). Masking would have to go into the shared `scrub()` that gates every process, or behind a per-process switch inside it. That weakens a company-wide guarantee.
- [N5] **The failure it targets has never happened.** The only recorded attack-pass refusal from credential-shaped text came from the diff under attack at the input boundary (`fixed-defects.md:757`). No attacker's own findings have ever triggered one ([EN5]).
- [S3] **Its cost is larger than it looks.** No test runs a planted credential through mock findings end to end (F21). arc's doctrine requires an adversarial construct-a-breaking-input pass before a gate change counts as done, and every derived-view family needs its own cases ([N6]).

DISSENT (strongest surviving opposing point):
- [A1] Today one credential-shaped match anywhere in the reply loses every finding, HIGH and CRITICAL included, because the reply is one JSON object and the scan refuses the whole payload. The attack pass exists to surface those findings ([N2]). This cost is real. It is softened because a refused surface writes no evidence, so the same round can run again at the price of one model call (A3 was dropped for this reason). It does not make masking the right fix.

CHEAPEST TEST TO DE-RISK:
- Add one mock-driver fixture whose attacker findings carry a credential-shaped string built at run time, and assert the current behaviour end to end through arc-attack: RUN FAILED, the rule name printed, no evidence file, and the same `--round` can run again. That closes the F21 gap and pins the re-run path the dissent relies on. Separately, count `run.completed` fail receipts with `reason: "secret"` and process `attack-diff` on the spine over the next quarter. That measures [A4]'s unknown false-positive rate on findings. A non-trivial count is the trigger to reopen this question as a new ADR, and at that point a targeted retry (re-running the surface with the rule name in the prompt) is the cheaper fix to weigh before masking.

Review-by: 2026-12-24
Resolution: HIT if, at Review-by, arc-run still refuses the whole attack-diff payload on a scanner hit, and no more than one attack-diff run on the spine was refused with `reason: "secret"` caused by the attacker's own findings (not the diff). MISS if masking in attacker findings was adopted and held with no leak or re-scan regression, or if two or more findings-caused secret refusals were recorded, showing the cost is recurring. UNRESOLVED if nobody counted the refusals by Review-by.
