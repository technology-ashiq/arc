# finding-verification — ground truth

Fixtures for the defect class **findings whose motivating source line cannot be quoted**.
Each fixture is `subject/` (review material) + `candidates.json` (submitted findings) +
`README.md` (what it discriminates). This file is the ground truth a measurement reads.

Column meanings:

- **truth** — is the claim a real defect in the subject? (independent of how it was cited)
- **quotable** — does a real source line exist that this finding can quote? For a true
  finding that means a line supporting the claim; for a false finding it means the cite
  resolves to a real line whose text can be quoted verbatim.
- A `quote` of `null` means the submitting reviewer offered no quote.
- Two candidates carry a byte-exact quote against an off-by-N cite (01/F8 = −2 lines,
  02/F2 = −1 line). Their quotes are exact for the file, not for the cited line — that is
  deliberate, not a broken fixture.

| fixture | id | truth | quotable | why |
|---|---|---|---|---|
| 01-release-tag-shell | F1 | true | true | Easy case: minor bump never resets patch; line exists and is cited correctly. |
| 01-release-tag-shell | F2 | true | true | True, quotable — but the supporting line is the unchecked `REPO_ROOT=` at :5, not the `rm` at :12 a careless reviewer cites. |
| 01-release-tag-shell | F3 | true | false | **CRITICAL** — no `set -euo pipefail`, so a failed `git tag` still pushes; the defect is an absent line. |
| 01-release-tag-shell | F4 | true | false | **CRITICAL** — `ALLOW_INITIAL_TAG` is defined and read by nothing; the claim is about the absence of a reader in another file. |
| 01-release-tag-shell | F5 | false | true | Claims a force-push; quote of the real `git push` line is byte-exact but carries no `--force`. |
| 01-release-tag-shell | F6 | false | true | Claims the bump arg is unvalidated, citing the real `BUMP="$1"`; the `case` block on :24-27 validates it. |
| 01-release-tag-shell | F7 | false | false | Invented citation — `subject/lib/semver.sh` does not exist. |
| 01-release-tag-shell | F8 | true | true | NEAR-MISS: real unquoted `rm -rf $BUILD_DIR`, quote exact for :12, cite two lines off at :14. |
| 02-review-cache-mjs | F1 | true | true | Easy case: `JSON.parse` sits outside the try, so a corrupt cache throws while a missing one is handled. |
| 02-review-cache-mjs | F2 | true | true | NEAR-MISS: `writeFile` is genuinely un-awaited, quote exact for :33, cite one line off at :34. |
| 02-review-cache-mjs | F3 | true | false | **CRITICAL** — a cached `null` is indistinguishable from a miss; the defect is the interaction of index.mjs and cache.mjs and only shows at runtime. |
| 02-review-cache-mjs | F4 | true | true | Key derivation collapses distinct paths to one key; quotable in the caller, not in the cache module. |
| 02-review-cache-mjs | F5 | false | true | Most convincing finding in the set: path traversal via the cited `join(CACHE_DIR, ...)`, but `assertSafeKey` one line above blocks it. |
| 02-review-cache-mjs | F6 | false | true | Claims no expiry check, citing the real `return entry.value;`; the check is three lines above. |
| 02-review-cache-mjs | F7 | false | false | Wrong representation claimed (relative TTL) and the cite is past EOF (`cache.mjs` has 34 lines). |
| 03-verify-workflow-yaml | F1 | true | true | Easy case: `continue-on-error: true` lets lint fail green. |
| 03-verify-workflow-yaml | F2 | true | true | Matrix `os` axis declared but never consumed because `runs-on` is hardcoded; cited correctly at :14. |
| 03-verify-workflow-yaml | F3 | true | true | DUPLICATE-TEXT TRAP: same claim about the `unit` job but cited on the `lint` job; both `runs-on` lines are byte-identical so a quote check passes on a mis-located finding. |
| 03-verify-workflow-yaml | F4 | true | false | **CRITICAL** — no Windows leg in the matrix; a value missing from a list has no line, so :18 is a location, not support. |
| 03-verify-workflow-yaml | F5 | true | true | Doc/gate drift: the wrong line is the doc line (`four shards`), not the workflow or shard.sh line a careless reviewer cites. |
| 03-verify-workflow-yaml | F6 | false | true | Claims no push trigger (very plausible in this repo), citing the real `pull_request:`; push to main is two lines above. |
| 03-verify-workflow-yaml | F7 | false | false | Cites `workflow.yaml` (file is `.yml`, so nothing resolves) and misreads `contents: read` as write. |

## Counts

| | quotable | not quotable | total |
|---|---|---|---|
| **true** | 10 | 4 | 14 |
| **false** | 5 | 3 | 8 |
| **total** | 15 | 7 | 22 |

Per fixture: 01 = 8 candidates, 02 = 7, 03 = 7. All three fixtures contain all four
combinations. The critical true-but-unquotable case appears in all three: 01/F3 and
01/F4 (absent line), 02/F3 (cross-file interaction, runtime-only), 03/F4 (value absent
from a list).
