# agent-browser → arc integration plan

> Status: **SHIPPED** (agent-browser is the primary QA driver across agents/commands/docs;
> Playwright MCP retained as the documented fallback until a green `/arc-qa` run validates the
> agent-browser path). Author: Claude + Ashiq. Date: 2026-07-09.
> Strategy chosen: **add alongside Playwright** (not a replacement). Session flow: this plan → approval → wire.

## 1. What it is (one screen)

[`vercel-labs/agent-browser`](https://github.com/vercel-labs/agent-browser) — a native **Rust CLI + daemon** that drives Chrome directly over CDP. Apache-2.0, ~35k stars, active, **v0.27 (pre-1.0, Vercel Labs)**. It has a built-in **MCP mode** (`agent-browser mcp`) *and* a scriptable **CLI**.

Same "accessibility-tree browser tools" idea as our current Playwright MCP, but:

- **Faster** — Rust daemon persists between commands, near-zero startup.
- **Lower context** — stable `@e1` snapshot refs + `--tools core` profile (vs Playwright's heavier output).
- **Superpowers Playwright MCP doesn't have:** `vitals` (real Core Web Vitals: LCP/CLS/TTFB/FCP/INP), `diff` (snapshot/screenshot/url regression vs a baseline), `react` (component tree / re-render / suspense), `read` (markdown extraction), `state` save/load (auth reuse).

## 2. Why arc wants it — the moat

arc's entire browser stack today runs on **Playwright MCP** → `qa-tester` agent → `/arc-qa` + `/arc-canary`. The weak spot is `/arc-canary`: it says *"capture Core Web Vitals **if available**"* — but there is no clean source, so in practice it's hand-wavy.

`agent-browser vitals` + `diff` are **exactly** that missing source. A canary that measures real CWV, diffs against the last known-good baseline, and **rolls back on a regression** is a genuine arc-twist gstack has no equivalent for.

## 3. Design principle (non-negotiable)

**agent-browser is an OPTIONAL enhancement, never a hard dependency.** arc must keep working with Playwright alone.

- It's an extra global install (`npm i -g agent-browser` + `agent-browser install` ≈ 684 MB Chrome-for-Testing). We do **not** force that on every arc user.
- Following arc's own `.mcp.json` convention, optional servers are **documented as commented examples**, not active in `mcpServers` — otherwise they red-fail on every session start for anyone who hasn't installed the binary.
- Every consumer (`qa-tester`, `/arc-canary`) must **detect availability and gracefully fall back** to the current Playwright/lighthouse path when agent-browser is absent.

This keeps arc reliable-as-a-mold while giving the owner (you) the superpowers once you opt in.

## 4. Two ways arc will use it

| Mode | Where | Why this mode |
|------|-------|---------------|
| **CLI via Bash** (`agent-browser vitals`, `diff`, `read` `--json`) | `/arc-canary` | One-shot commands with parseable JSON. No `.mcp.json` entry → zero session-start-failure risk. Canary already runs on Bash. |
| **MCP** (`agent-browser mcp --tools core`) | `qa-tester` agent | Interactive per-action driving (click/fill/snapshot) as tool calls. Registered as a **documented-optional** server; activate by moving into `mcpServers` after install. |

`toolchain-health.sh` detects the binary either way and tells you how to arm it.

## 5. File-by-file changes (this session, after approval)

1. **`.mcp.json`** — add an `//optional-agent-browser` documented example line (mirroring the existing `//optional-1/2/3` sentry/github style):
   ```json
   "//optional-4": "agent-browser (fast CDP browser, powers qa-tester + canary vitals/diff — needs: npm i -g agent-browser && agent-browser install): \"agent-browser\": { \"command\": \"agent-browser\", \"args\": [\"mcp\", \"--tools\", \"core\"] }"
   ```
   Not placed in active `mcpServers` by default (graceful degradation). One-line comment on how to activate.

2. **`.claude/scripts/core/toolchain-health.sh`** — one new row in `emit_all()` under the `QA` section, self-reporting (flows into session brief + `/arc-toolcheck` artifact automatically):
   - `have agent-browser` **and** Chrome present → `R_OK "agent-browser" "vitals + diff + fast CDP"`
   - binary present, Chrome missing → `R_STALE "agent-browser" "agent-browser install" "download Chrome-for-Testing"`
   - absent → `R_OPT "agent-browser" "npm i -g agent-browser" "then agent-browser install — arms canary vitals/diff"`

3. **`.claude/agents/qa-tester.md`** — add `mcp__agent-browser` to `tools`; add a short *"Browser driver"* note: **prefer agent-browser if its MCP is active (faster, `vitals` for the perf snapshot, `react` for render bugs), else use Playwright MCP.** Keep the axe-core + lighthouse steps as the fallback path. Description updated to "via agent-browser or Playwright MCP".

4. **`.claude/commands/arc-canary.md`** — replace *"capture Core Web Vitals if available"* with a concrete step: if `agent-browser` is installed, capture `agent-browser vitals <url> --json` per key route and `agent-browser diff` the snapshot/CWV against the `docs/canary/` baseline; else fall back to the current lighthouse-via-qa-tester path. Regression thresholds (CWV cliff) drive the existing rollback/block action — unchanged.

5. **`.claude/settings.json`** — confirm permissions allow `Bash(agent-browser:*)` and (if an MCP allowlist exists) `mcp__agent-browser`. Add only what's missing.

6. **Docs** — one line in `CLAUDE.md` *Tools/Tech* (keep it under ~200 lines); note the optional dependency in `docs/plugins.md`; a short mention in `docs/usermanual.md` where the browser stack is described. `.claude/rules/testing.md` gets a one-liner on the prefer/fallback rule.

## 6. Optional stretch (NOT this session — needs its own nod / `/arc-change`)

- **`/arc-perf`** — a dedicated command: `vitals` + `react` re-render analysis + snapshot `diff` as a first-class perf/regression gate. Net-new capability.
- **`/arc-design`** — feed `agent-browser screenshot --annotate` + a11y snapshot into the design-reviewer loop.

## 7. Prerequisites (owner runs once, to opt in)

```bash
npm i -g agent-browser      # the CLI + daemon
agent-browser install       # downloads Chrome-for-Testing (~684 MB); or point AGENT_BROWSER_EXECUTABLE_PATH at existing Chromium
# then: /arc-toolcheck  → flips agent-browser to 🟢, shows how to activate the MCP
```

## 8. Risks & mitigations

- **v0.x API churn** → don't hardcode its command surface; rely on the runtime skill (`agent-browser skills get core`) and keep Playwright as the stable default.
- **684 MB Chrome download** → optional install, never forced; existing Chromium can be reused via `--executable-path`.
- **MCP context bloat** → pin `--tools core` (not `all`).
- **Daemon lifecycle / stale sockets** → `agent-browser doctor` auto-cleans; set `AGENT_BROWSER_IDLE_TIMEOUT_MS`.
- **State files hold auth tokens in plaintext** → set `AGENT_BROWSER_ENCRYPTION_KEY` if we use `state` save/load; treat those files as secrets (already covered by `.gitignore` posture).

## 9. Verification (task #9)

- `node -e "JSON.parse(require('fs').readFileSync('.mcp.json','utf8'))"` → `.mcp.json` still valid.
- `bash .claude/scripts/core/toolchain-health.sh` → new agent-browser row renders with correct status on a machine without the binary (should read ⚪ optional, arc otherwise green).
- `grep -rn "agent-browser" .claude docs CLAUDE.md` → no orphaned/half-wired refs; every mention has its fallback.
- Read-through: qa-tester + canary both clearly state the "if available … else …" branch.

## 10. Rollout order

`.mcp.json` → `toolchain-health.sh` → `qa-tester.md` → `arc-canary.md` → `settings.json` → docs → verify. Each is a small, reversible edit; no product code touched.
