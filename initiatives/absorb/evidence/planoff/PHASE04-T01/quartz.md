# Security audit -- findings

22 findings.

### 01-release-tag-shell / F1
- **claim:** bump_version leaves the patch component untouched on a minor bump, so bumping 1.4.7 by minor produces v1.5.7 instead of v1.5.0.
- **cite:** `subject/lib/version.sh:25`

### 01-release-tag-shell / F2
- **claim:** REPO_ROOT is taken from an unchecked command substitution, so when release-tag.sh runs outside a git work tree BUILD_DIR becomes /build/release and the EXIT trap deletes a path outside the repo.
- **cite:** `subject/release-tag.sh:5`

### 01-release-tag-shell / F3
- **claim:** The script never enables errexit, so a failing `git tag -a` does not stop execution: the push still runs and the script exits 0, reporting a release that was never tagged.
- **cite:** `subject/release-tag.sh:1`

### 01-release-tag-shell / F4
- **claim:** ALLOW_INITIAL_TAG is defined in release.env but read by nothing, so the guard it advertises does not exist and a repo with no tags is silently tagged v0.0.1.
- **cite:** `subject/config/release.env:8`

### 01-release-tag-shell / F5
- **claim:** The tag is force-pushed, so re-running the script after a bad release silently rewrites an existing release tag on the remote.
- **cite:** `subject/release-tag.sh:41`

### 01-release-tag-shell / F6
- **claim:** The bump argument is assigned straight from $1 with no check that it is one of major, minor or patch, so a typo like `mnior` falls through to bump_version and produces an empty tag.
- **cite:** `subject/release-tag.sh:23`

### 01-release-tag-shell / F7
- **claim:** semver.sh parses the version with a regex that accepts a leading v, so bump_version receives a doubled prefix and emits vv1.5.0.
- **cite:** `subject/lib/semver.sh:14`

### 01-release-tag-shell / F8
- **claim:** cleanup expands BUILD_DIR unquoted, so a checkout under a path containing a space deletes each whitespace-separated fragment instead of the build directory.
- **cite:** `subject/release-tag.sh:14`

### 02-review-cache-mjs / F1
- **claim:** readCache guards the read but not the parse: a truncated or hand-edited cache file throws a SyntaxError out of readCache, so a corrupt cache is fatal while a missing cache is handled.
- **cite:** `subject/cache.mjs:20`

### 02-review-cache-mjs / F2
- **claim:** writeCache does not await writeFile, so the returned promise resolves before the entry is on disk and the write can be lost when the caller exits.
- **cite:** `subject/cache.mjs:34`

### 02-review-cache-mjs / F3
- **claim:** A cached null is indistinguishable from a cache miss: computeVerdict returns null for markdown paths, writeCache persists it, readCache hands back that null, and verdictFor treats null as absence, so every markdown path is recomputed and rewritten on every run and the cache never hits.
- **cite:** `subject/index.mjs:17`

### 02-review-cache-mjs / F4
- **claim:** The cache key collapses every non-alphanumeric run to a single dash, so lib/a.mjs and lib-a.mjs map to the same key and one path serves the other path's verdict.
- **cite:** `subject/index.mjs:15`

### 02-review-cache-mjs / F5
- **claim:** The cache key comes from argv and is concatenated into a filesystem path, so a key of ../../etc/passwd escapes the cache directory and lets the caller read or clobber an arbitrary file.
- **cite:** `subject/cache.mjs:9`

### 02-review-cache-mjs / F6
- **claim:** readCache returns the stored value without comparing it against the clock, so expired entries are served forever and the TTL is decorative.
- **cite:** `subject/cache.mjs:24`

### 02-review-cache-mjs / F7
- **claim:** The entry records a relative TTL rather than an absolute expiry timestamp, so an entry written before a clock adjustment is treated as fresh forever.
- **cite:** `subject/cache.mjs:88`

### 03-verify-workflow-yaml / F1
- **claim:** The lint job is marked continue-on-error, so shellcheck and the process linters can fail while the workflow still reports success and the PR shows a green check.
- **cite:** `subject/workflow.yml:27`

### 03-verify-workflow-yaml / F2
- **claim:** The unit job hardcodes runs-on, so the matrix os axis is never consumed: all six legs run on ubuntu, the run count is doubled for nothing, and macOS is never actually tested.
- **cite:** `subject/workflow.yml:14`

### 03-verify-workflow-yaml / F3
- **claim:** The unit job hardcodes runs-on, so the matrix os axis it declares is never consumed and macOS is never tested.
- **cite:** `subject/workflow.yml:26`

### 03-verify-workflow-yaml / F4
- **claim:** No matrix leg runs on Windows, so path-separator and reserved-device-name failures reach main having never been executed on the one OS that exhibits them.
- **cite:** `subject/workflow.yml:18`

### 03-verify-workflow-yaml / F5
- **claim:** The CI doc states the suite is split across four shards, but the workflow matrix and shard.sh TOTAL both say three, so the documented gate does not match the gate that runs.
- **cite:** `subject/docs/ci.md:8`

### 03-verify-workflow-yaml / F6
- **claim:** The workflow has no push trigger, so CI runs only on pull requests and the merged tree on main is never verified.
- **cite:** `subject/workflow.yml:6`

### 03-verify-workflow-yaml / F7
- **claim:** The permissions block grants contents: write at workflow level, so any step, including a fork PR step, can push to the repository.
- **cite:** `subject/workflow.yaml:14`
