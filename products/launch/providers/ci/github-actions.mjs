// ci slot on GitHub Actions (ADR-1704, ADR-1726). Writes one workflow that runs the venture's tests on three operating
// systems, commits it through the Contents API (unchanged content is not re-committed), and requires its three checks
// on main. The repo comes from ctx.upstream.repo (ADR-1725). A plan that refuses branch protection on a private repo is
// refused by name (ADR-1726), never reported as done.
import { Buffer } from "node:buffer";

const API = "https://api.github.com";
const PATH = ".github/workflows/arc-ci.yml";
const LEGS = ["ubuntu-latest", "windows-latest", "macos-latest"];
const CHECKS = LEGS.map((os) => `test (${os})`);

const refuse = (code, message) => Object.assign(new Error(message), { code });
const SKIP = (n) => n < 0x20 || (n >= 0x7f && n < 0xa0) || n === 0x061c || (n >= 0x200b && n <= 0x200f) || (n >= 0x202a && n <= 0x202e) ||
  (n >= 0x2060 && n <= 0x2069) || n === 0x2028 || n === 0x2029 || n === 0xfeff;
const say = (v, cap = 120) => [...(v === null || v === undefined ? "" : String(v))].filter((c) => !SKIP(c.codePointAt(0))).slice(0, cap).join("");
const list = (v) => (Array.isArray(v) ? v.filter((r) => r && typeof r === "object") : []);

const WORKFLOW = [
  "# Written by arc launch (ci slot). Edit freely; launch rewrites it only when its own content changes.",
  "name: arc-ci",
  "on:",
  "  push:",
  "    branches: [main]",
  "  pull_request:",
  "jobs:",
  "  test:",
  "    strategy:",
  "      fail-fast: false",
  "      matrix:",
  `        os: [${LEGS.join(", ")}]`,
  "    runs-on: ${{ matrix.os }}",
  "    steps:",
  "      - uses: actions/checkout@v4",
  "      - uses: actions/setup-node@v4",
  "        with:",
  "          node-version: 20",
  "      - name: test",
  "        shell: bash",
  "        run: if [ -f package.json ]; then npm ci && npm test --if-present; else echo no package.json yet; fi",
  "",
].join("\n");

function token(ctx) {
  const t = String(ctx.env.GITHUB_TOKEN || "").trim();
  if (!/^[A-Za-z0-9_]{20,}$/.test(t)) throw refuse("BAD_TOKEN", "GITHUB_TOKEN is not a token shape (letters, digits and _, 20 or more); its value is not printed");
  return t;
}

async function gh(ctx, method, path, body, { allow = [] } = {}) {
  const auth = `Bearer ${token(ctx)}`;
  let res;
  try {
    res = await ctx.fetch(`${API}${path}`, {
      method,
      headers: { authorization: auth, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "arc-launch", "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    if (e && e.code) throw e;
    throw new Error(`github ${method} ${path.split("?")[0]} -> transport error (${say(e && e.name, 30) || "unknown"})`);
  }
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  if (res.ok || allow.includes(res.status)) return { status: res.status, body: json };
  const msg = json && typeof json === "object" && typeof json.message === "string" ? json.message : "";
  if (res.status === 403 && /upgrade to github pro|make this repository public/i.test(msg))
    throw refuse("PLAN_LIMIT", "this GitHub plan refuses branch protection on a private repo (ADR-1726: record it, do not work round it)");
  throw new Error(`github ${method} ${path.split("?")[0]} -> ${res.status}${msg ? `: ${say(msg)}` : ""}`);
}

// Upstream values are another adapter's output: exactly one repo, shaped owner/name.
function repo(ctx) {
  const all = list(ctx.upstream && ctx.upstream.repo).filter((r) => r.kind === "github-repo");
  if (all.length !== 1) throw refuse("UPSTREAM_MISSING", `repo reported ${all.length} github-repo resources; ci needs exactly one`);
  const full = all[0].id;
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[a-z][a-z0-9-]{0,63}$/.test(full)) throw refuse("BAD_UPSTREAM", `repo ${JSON.stringify(say(full, 80))} is not owner/name`);
  return full;
}

const b64 = (text) => Buffer.from(text, "utf8").toString("base64");
const unb64 = (text) => Buffer.from(String(text || "").replace(/\s/g, ""), "base64").toString("utf8");

export function envContract() {
  return ["GITHUB_TOKEN"];
}

export async function scaffold(ctx) {
  const full = repo(ctx);
  ctx.write(PATH, WORKFLOW);
  const cur = await gh(ctx, "GET", `/repos/${full}/contents/${PATH}?ref=main`, undefined, { allow: [404] });
  const have = cur.status === 200 && cur.body && typeof cur.body.sha === "string" ? cur.body : null;
  if (!have || unb64(have.content) !== WORKFLOW) {
    await gh(ctx, "PUT", `/repos/${full}/contents/${PATH}`, {
      message: `ci: arc-ci on ${LEGS.length} operating systems\n\nArc-Launch-Tag: ${ctx.tag}`,
      content: b64(WORKFLOW), branch: "main", ...(have ? { sha: have.sha } : {}),
    });
  }
  await gh(ctx, "PUT", `/repos/${full}/branches/main/protection`, {
    required_status_checks: { strict: false, contexts: CHECKS },
    enforce_admins: false, required_pull_request_reviews: null, restrictions: null,
  });
  ctx.report({ kind: "github-workflow", id: `${full}:${PATH}` });
  ctx.report({ kind: "branch-protection", id: `${full}@main` });
  return { files: [PATH], resources: [{ kind: "github-workflow", id: `${full}:${PATH}` }, { kind: "branch-protection", id: `${full}@main` }], notes: [] };
}

const wait = (ms, signal) => new Promise((res, rej) => {
  if (signal && signal.aborted) return rej(refuse("ABORTED", "slot timeout reached"));
  const onAbort = () => { clearTimeout(t); rej(refuse("ABORTED", "slot timeout reached")); };
  const t = setTimeout(() => { if (signal) signal.removeEventListener("abort", onAbort); res(); }, ms);
  if (signal) signal.addEventListener("abort", onAbort, { once: true });
});

// Asked of GitHub: the three checks are required on main, and the newest run of the workflow on main has all three
// legs green. A run still going is polled; one that ended any other way is the answer.
export async function verify(ctx) {
  // Every answer below comes over ctx.fetch from api.github.com; the probe is GitHub, never state.
  const ask = ctx.fetch.bind(ctx);
  ctx = { ...ctx, fetch: ask };
  const full = repo(ctx);
  const prot = await gh(ctx, "GET", `/repos/${full}/branches/main/protection/required_status_checks`, undefined, { allow: [404] });
  const contexts = prot.status === 200 && prot.body && Array.isArray(prot.body.contexts) ? prot.body.contexts : [];
  const missing = CHECKS.filter((c) => !contexts.includes(c));
  if (missing.length) return { ok: false, reason: `main does not require ${missing.join(", ")}` };
  let last = "no run of arc-ci on main yet";
  for (let i = 0; i < 12; i++) {
    if (i) await wait(20000, ctx.signal);
    const runs = await gh(ctx, "GET", `/repos/${full}/actions/workflows/arc-ci.yml/runs?branch=main&per_page=1`, undefined, { allow: [404] });
    const run = runs.status === 200 && runs.body ? list(runs.body.workflow_runs)[0] : null;
    if (!run || typeof run.id !== "number") continue;
    if (run.status !== "completed") { last = `run ${run.id} is ${say(run.status, 20)}`; continue; }
    const jobs = await gh(ctx, "GET", `/repos/${full}/actions/runs/${run.id}/jobs`);
    const byName = new Map(list(jobs.body && jobs.body.jobs).map((j) => [j.name, j.conclusion]));
    const red = CHECKS.filter((c) => byName.get(c) !== "success");
    if (red.length) return { ok: false, reason: `run ${run.id}: ${red.map((c) => `${c} ${say(byName.get(c) ?? "absent", 20)}`).join(", ")}` };
    return { ok: true, answerer: "api.github.com", evidence: { repo: full, run: run.id, sha: say(run.head_sha, 40), checks: CHECKS } };
  }
  return { ok: false, reason: last };
}

export async function teardown(ctx) {
  return { steps: ctx.resources.filter((r) => r.kind === "github-workflow" || r.kind === "branch-protection").map((r, i) => ({ order: i + 1, action: r.kind === "branch-protection" ? "unprotect" : "delete", resource: r.id })) };
}
