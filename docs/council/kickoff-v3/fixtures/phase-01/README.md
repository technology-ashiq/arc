# phase-01 fixtures — SHA-256 binding + fabrication probe (REQ-05)

The `binding/` set proves the byte-level verdict↔artifact tie (ADR-0018, forced by the kickoff attack
panel) — all **key-independent** (the artifact is produced in fake mode; the checks are pure hashing +
id/rating comparison). Run `node .claude/scripts/council-lint.mjs --verdict <verdict> --juror-artifact
binding/artifact-bound.md`.

| Fixture | Targets | Expected |
|---|---|---|
| `artifact-bound.md` | the real script-written juror artifact (fake mode) — grades S2, A4 | — |
| `verdict-bound.md` | honest verdict: `Juror-Artifact-SHA256` matches + displayed JUROR RATINGS == artifact | 0 |
| `verdict-hash-mismatch.md` | the verdict points at the artifact but its SHA line is a different hash | 1 (hash mismatch) |
| `verdict-doctored.md` | genuine artifact + hash, but the DISPLAYED A4 rating was flattered Weak→Plausible | 1 (rating doctored) |
| `verdict-fabricated-contest.md` | **the P2 attack, now caught:** a rubber-stamp laundered via a fabricated first-pass `S1: Contested` with S1 hand-typed into JUROR RATINGS — but the script artifact never graded S1 | 1 (section diverges from artifact) |

Without `--juror-artifact`, `--verdict` still requires a well-formed `Juror-Artifact-SHA256:` line whenever
`Juror:` names a model (a named juror with no binding line fails). The real-provider fetch path
(auth / rate-limit / timeout taxonomy, retries) is proven against a local mock OpenAI-compatible server —
see the mock test in the build log; only the ≥2-real-provider runs + the live dogfood await API keys.
