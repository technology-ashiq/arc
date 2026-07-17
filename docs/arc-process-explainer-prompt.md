# arc process explainer — reusable prompt

A reusable prompt to get a **step-by-step Tanglish walkthrough** of the arc build
process (general methodology, phase-agnostic). Paste the block below into any session
opened in the arc repo. It explains every action with **ENA / YEN / EPDI / ENGA**
(what / why / how / where) and won't skip a step.

For a specific phase, add the optional hook at the bottom of the prompt.

---

```text
Naan arc project (idhoda OWN build system — phases/, PLAN.md, PROGRESS.md, /arc-*
commands) use panren. Arc-oda FULL build process-ah — mudhal to kadaisi, general
methodology-ah — step-by-step Tanglish la explain pannu. Ovvoru step-kum:
  ENA  = enna action pannanum
  YEN  = endha rule / DoD / non-negotiable / reason adha drive panudhu
  EPDI = exact command / skill / tool / mechanism
  ENGA = endha file / folder / tracker la nadakudhu
Oru step-um miss aagakoodadhu. Assert pannadha — evidence (file/command) kaatti sollu.

Padikkanumnaa idha use pannu: CLAUDE.md (Rules + Build process section),
docs/build-playbook.md (Golden Loop, DoD, 3-layer tracker), docs/how-it-works.md,
.claude/commands/arc-*.md (ovvoru command-oda logic).

Indha lifecycle-a order-la explain pannu:

1. KICKOFF (/arc-kickoff) — puthu build eppdi start aagudhu: PLAN.md (appetite, REQs,
   ADRs, assumptions ledger, kill criteria), phases risk-order-la, PROGRESS.md, lint +
   simulation gate. yen "code ku munnadi plan".

2. 3-LAYER TRACKER — PLAN.md (contract) vs PROGRESS.md (## Now + done-log) vs
   phases/phase-NN-spec.md (DoD + verification). yen moonu-um, epdi sync-a irukanum
   (kickoff-lint nonneg-drift).

3. RESUME (/arc-resume) — ovvoru session-um state epdi reconstruct aagudhu
   (POSITION/HEALTH/SCOREBOARD/RISKS/NEXT), yen files la irundhu (loose memory illa).

4. CHANGE INTAKE (/arc-change) — puthu idea/change yen NEVER code ad-hoc. Route:
   assumption-check → classify (trivial / new-REQ / ADR / bug) → appetite check →
   tracker update → STOP-and-confirm (load-bearing) → appuram build.

5. GOLDEN LOOP (build, per phase) — smallest slice → RED (failing test mudhalla) →
   GREEN (impl) → live demo → real-place verify → tracker flip. yen TDD, yen offline-first
   (interface + fake + real), yen gate/parser-ku ADVERSARIAL construct-a-breaking-input
   pass (council la 43 holes) + red fixtures pin.

6. REVIEW (/arc-review → code-reviewer agent) — scanners (opengrep/gitleaks/osv/knip) +
   4-pass OWASP, yen fix-first → ship, findings docs/reviews/ la archive.

7. PHASE-DONE (/arc-phase-done N) — DoD gate: full suite green + live demo + ovvoru exit
   criterion + kickoff-lint + assumptions/ADR trigger scan + evidence bundle
   (arc-evidence.sh bundle+verify, sha256 manifest) + tracker flip (PROGRESS ✅ + done-log
   metrics, PLAN REQ active→validated) + commit. yen "evidence over assertion".

8. SUPPORTING COMMANDS — /arc-commit, /arc-pr, /arc-audit, /arc-qa, /arc-docs, /arc-design,
   /arc-second-opinion, /arc-canary, /arc-freeze/-unfreeze, /arc-retro — ovvondrum eppo
   use aagudhu, oru vari-la.

Kadaisi la: oru chinna "endha step-la eppo evidence generate aagudhu, endha gate red-naa
merge aagaadhu" nu safety-net summary.

[Optional — specific phase venumnaa: "Phase NN specific-a: git show <feat-commit> +
<phase-done-commit>, phases/phase-NN-spec.md, PROGRESS done-log entry padichi mேl format-la
ovvoru action-um sollu" nu add pannu.]
```
