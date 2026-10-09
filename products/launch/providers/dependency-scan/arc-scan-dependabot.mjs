import { Buffer } from "node:buffer";
// ---- shared by auth, authz, tenancy, plans, security-headers and dependency-scan (ADR-1734, ADR-1743). Adapters are one file each (ADR-1704), so this block is repeated.
const GITHUB = "https://api.github.com";
const SHA = /^[0-9a-f]{40}$/;
const HOST = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

const refuse = (code, message) => Object.assign(new Error(message), { code });
const SKIP = (n) => n < 0x20 || (n >= 0x7f && n < 0xa0) || n === 0x061c || (n >= 0x200b && n <= 0x200f) || (n >= 0x202a && n <= 0x202e) ||
  (n >= 0x2060 && n <= 0x2069) || n === 0x2028 || n === 0x2029 || n === 0xfeff;
const say = (v, cap = 120) => [...(v === null || v === undefined ? "" : String(v))].filter((c) => !SKIP(c.codePointAt(0))).slice(0, cap).join("");
const list = (v) => (Array.isArray(v) ? v.filter((r) => r && typeof r === "object") : []);
const utf8 = (b64) => new TextDecoder().decode(Uint8Array.from(atob(String(b64).replace(/\s/g, "")), (c) => c.charCodeAt(0)));

function tokenOf(ctx, key, shape) {
  const t = String(ctx.env[key] || "").trim();
  if (!shape.test(t)) throw refuse("BAD_TOKEN", `${key} is not a token shape; its value is not printed`);
  return t;
}

// One caller for every host: error text is the provider's sanitised message, never a header or a request body.
async function call(ctx, url, headers, method, body, allow, what) {
  let res;
  try {
    res = await ctx.fetch(url, { method, headers: { "content-type": "application/json", "user-agent": "arc-launch", ...headers }, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual" });
  } catch (e) {
    if (e && e.code) throw e;
    throw new Error(`${what} ${method} -> transport error (${say(e && e.name, 30) || "unknown"})`);
  }
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  if (res.ok || (allow || []).includes(res.status)) return { status: res.status, body: json, res };
  const m = json && typeof json === "object" ? json.message || json.msg || json.error_description || json.error : "";
  throw new Error(`${what} ${method} -> ${res.status}${typeof m === "string" && m ? `: ${say(m)}` : ""}`);
}
const gh = (ctx, method, path, body, allow) => call(ctx, `${GITHUB}${path}`, { authorization: `Bearer ${tokenOf(ctx, "GITHUB_TOKEN", /^[A-Za-z0-9_]{20,}$/)}`, accept: "application/vnd.github+json" }, method, body, allow, `github ${path.split("?")[0]}`);


function domainOf(ctx) {
  const d = String((ctx.profile && ctx.profile.brand && ctx.profile.brand.domain) || "").trim().toLowerCase().replace(/\.$/, "");
  if (!HOST.test(d)) throw refuse("BAD_DOMAIN", `brand.domain ${JSON.stringify(say(d, 80))} is not a plain hostname`);
  return d;
}
const repoShape = (full) => /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[a-z][a-z0-9-]{0,63}$/.test(full);
const trailer = (ctx) => `Arc-Launch-Tag: ${ctx.tag}`;
const hasLine = (msg, line) => typeof msg === "string" && msg.split("\n").some((l) => l.trim() === line);

// Commits FILES (owned: exact bytes and this slot's trailer decide) plus SHARED (paths several slots extend, such as
// .env.example, written as given) in one commit on one head; the local copy is written after the ref update lands.
async function commitFiles(ctx, full, FILES, SHARED, message) {
  const ref = await gh(ctx, "GET", `/repos/${full}/git/ref/heads/main`);
  const head = ref.body && ref.body.object ? String(ref.body.object.sha) : "";
  if (!SHA.test(head)) throw new Error(`github returned no main head for ${full}`);
  const changed = {};
  for (const [path, text] of Object.entries(FILES)) {
    const cur = await gh(ctx, "GET", `/repos/${full}/contents/${path}?ref=${head}`, undefined, [404]);
    if (cur.status === 404) { changed[path] = text; continue; }
    const b = cur.body;
    if (!b || b.type !== "file" || b.encoding !== "base64" || typeof b.content !== "string") throw refuse("FOREIGN_FILE", `${full}:${path} is not a plain file`);
    const log = await gh(ctx, "GET", `/repos/${full}/commits?path=${encodeURIComponent(path)}&sha=${head}&per_page=1`);
    const top = list(log.body)[0];
    const ours = hasLine(top && top.commit && top.commit.message, trailer(ctx));
    if (!ours) throw refuse("FOREIGN_FILE", `${full}:${path} holds the owner's code; it is not committed over`);
    if (utf8(b.content) !== text) changed[path] = text;
  }
  for (const [path, make] of Object.entries(SHARED || {})) {
    const cur = await gh(ctx, "GET", `/repos/${full}/contents/${path}?ref=${head}`, undefined, [404]);
    // A shared file is extended only when it decodes whole and round-trips: anything else is rewritten by nothing
    // (attack aadcd0c B2).
    const b = cur.body;
    const now = cur.status === 404 ? "" : b && b.type === "file" && b.encoding === "base64" && typeof b.content === "string" ? utf8(b.content) : null;
    // Base64 compared with whitespace dropped from both sides (the API wraps it in lines); split/join, not a regex, so no
    // escape can be lost on the way into this file (the defect was a regex that had lost its backslash).
    const flat = (x) => String(x).split("").filter((ch) => ch.trim() !== "").join("");
    if (now === null || (cur.status !== 404 && flat(Buffer.from(now, "utf8").toString("base64")) !== flat(b.content)))
      throw refuse("FOREIGN_FILE", `${full}:${path} is not a plain UTF-8 file launch can extend`);
    const next = make(now);
    if (next !== now) changed[path] = next;
  }
  if (!Object.keys(changed).length) return head;
  const base = await gh(ctx, "GET", `/repos/${full}/git/commits/${head}`);
  const baseTree = base.body && base.body.tree ? String(base.body.tree.sha) : "";
  if (!SHA.test(baseTree)) throw new Error(`github returned no tree for ${full}`);
  const tree = [];
  for (const [path, text] of Object.entries(changed)) {
    const blob = await gh(ctx, "POST", `/repos/${full}/git/blobs`, { content: text, encoding: "utf-8" });
    if (!blob.body || !SHA.test(String(blob.body.sha))) throw new Error(`github returned no blob for ${path}`);
    tree.push({ path, mode: "100644", type: "blob", sha: blob.body.sha });
  }
  const t = await gh(ctx, "POST", `/repos/${full}/git/trees`, { base_tree: baseTree, tree });
  const c = await gh(ctx, "POST", `/repos/${full}/git/commits`, { message: `${message}\n\n${trailer(ctx)}`, tree: t.body && t.body.sha, parents: [head] });
  const sha = c.body ? String(c.body.sha) : "";
  if (!SHA.test(sha)) throw new Error(`github returned no commit for ${full}`);
  await gh(ctx, "PATCH", `/repos/${full}/git/refs/heads/main`, { sha, force: false });
  for (const [path, text] of Object.entries(changed)) ctx.write(path, text);
  return sha;
}

// At main's head every owned file is launch's exact bytes with this slot's trailer.
async function oursAtHead(ctx, full, FILES) {
  const ref = await gh(ctx, "GET", `/repos/${full}/git/ref/heads/main`);
  const head = ref.body && ref.body.object ? String(ref.body.object.sha) : "";
  if (!SHA.test(head)) return `${full} main has no readable head`;
  for (const [path, text] of Object.entries(FILES)) {
    const cur = await gh(ctx, "GET", `/repos/${full}/contents/${path}?ref=${head}`, undefined, [404]);
    const b = cur.body;
    if (cur.status === 404 || !b || b.type !== "file" || typeof b.content !== "string" || utf8(b.content) !== text) return `${path} at ${head.slice(0, 7)} is not launch's file`;
    const log = await gh(ctx, "GET", `/repos/${full}/commits?path=${encodeURIComponent(path)}&sha=${head}&per_page=1`);
    const top = list(log.body)[0];
    if (!hasLine(top && top.commit && top.commit.message, trailer(ctx))) return `${path} at ${head.slice(0, 7)} was last committed by someone else`;
  }
  return "";
}
// ---- end of the shared block

// dependency-scan slot on GitHub Actions + Dependabot (ADR-1704, ADR-1743). Commits its own workflow, beside ci's
// arc-ci.yml and never inside it, whose `audit` job fails the push on a high or critical advisory, plus a Dependabot
// config for weekly npm and Actions updates. verify asks GitHub, never the files: both are launch's at main's head,
// and the dependency-scan run for that head concluded with `audit` success -- the gate is present AND green.
const WORKFLOW_FILE = "dependency-scan.yml";
const FILES = {
  ".github/workflows/dependency-scan.yml": [
    "# Written by arc launch (dependency-scan slot). Fails a push or PR on a high or critical npm advisory.",
    "name: dependency-scan",
    "on:",
    "  push:",
    "    branches: [main]",
    "  pull_request:",
    "  schedule:",
    "    - cron: \"17 3 * * 1\"",
    "permissions:",
    "  contents: read",
    "jobs:",
    "  audit:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - uses: actions/checkout@v4",
    "      - uses: actions/setup-node@v4",
    "        with:",
    "          node-version: 22",
    "      - run: npm install --package-lock-only --ignore-scripts --no-audit --no-fund",
    "      - run: npm audit --audit-level=high",
    "",
  ].join("\n"),
  ".github/dependabot.yml": [
    "# Written by arc launch (dependency-scan slot).",
    "version: 2",
    "updates:",
    "  - package-ecosystem: npm",
    "    directory: /",
    "    schedule:",
    "      interval: weekly",
    "  - package-ecosystem: github-actions",
    "    directory: /",
    "    schedule:",
    "      interval: weekly",
    "",
  ].join("\n"),
};

// Upstream: ci's reported workflow names the venture repo (ADR-1726). Validated here, never trusted.
function repoOf(ctx) {
  const up = list(ctx.upstream && ctx.upstream.ci);
  const wf = String((up.find((r) => r.kind === "github-workflow") || {}).id || "");
  const full = wf.slice(0, wf.lastIndexOf(":"));
  if (!repoShape(full)) throw refuse("UPSTREAM_MISSING", "ci reported no venture repo");
  return full;
}

export function envContract() {
  return ["GITHUB_TOKEN"];
}

export async function scaffold(ctx) {
  const full = repoOf(ctx);
  const sha = await commitFiles(ctx, full, FILES, {}, "dependency-scan: npm audit gate and Dependabot (ADR-1743)");
  ctx.report({ kind: "github-workflow", id: `${full}:.github/workflows/${WORKFLOW_FILE}` });
  ctx.report({ kind: "github-file", id: `${full}:.github/dependabot.yml` });
  return { files: Object.keys(FILES), resources: [{ kind: "github-workflow", id: `${full}:.github/workflows/${WORKFLOW_FILE}` }, { kind: "github-file", id: `${full}:.github/dependabot.yml` }], notes: [`head ${sha.slice(0, 7)}`] };
}

// An abort that already fired never notifies again: check it first, and drop the listener when the timer wins
// (attack b6ffd12 B3).
const pause = (ms, signal) => new Promise((res, rej) => {
  const stop = () => rej(Object.assign(new Error("aborted"), { code: "ABORTED" }));
  if (signal && signal.aborted) return stop();
  const onAbort = () => { clearTimeout(t); stop(); };
  const t = setTimeout(() => { if (signal) signal.removeEventListener("abort", onAbort); res(); }, ms);
  if (signal) signal.addEventListener("abort", onAbort, { once: true });
});

async function probe(ctx) {
  const full = repoOf(ctx);
  const drift = await oursAtHead(ctx, full, FILES);
  if (drift) return { ok: false, reason: drift };
  const head = await gh(ctx, "GET", `/repos/${full}/git/ref/heads/main`);
  const sha = head.body && head.body.object && SHA.test(String(head.body.object.sha)) ? String(head.body.object.sha) : null;
  if (!sha) return { ok: false, reason: `${full} main has no readable head` };
  let last = `no ${WORKFLOW_FILE} run for main's head ${sha.slice(0, 7)} yet`;
  for (let i = 0; i < 13; i++) {
    if (i) await pause(20000, ctx.signal);
    const runs = await gh(ctx, "GET", `/repos/${full}/actions/workflows/${WORKFLOW_FILE}/runs?branch=main&head_sha=${sha}&per_page=30`, undefined, [404]);
    if (runs.status === 200 && !(runs.body && Array.isArray(runs.body.workflow_runs))) return { ok: false, reason: "github answered the runs list without a workflow_runs array" };
    // Every run for the head: a cancelled re-run must not mask a green one, and a green one is the answer.
    const forHead = runs.status === 200 ? list(runs.body.workflow_runs).filter((r) => r.head_sha === sha && typeof r.id === "number") : [];
    const run = forHead.find((r) => r.status === "completed" && r.conclusion === "success") || forHead.find((r) => r.status !== "completed") || forHead[0] || null;
    if (!run) continue;
    if (run.status !== "completed") { last = `run ${run.id} for ${sha.slice(0, 7)} is still ${say(run.status, 20)}`; continue; }
    const jobs = await gh(ctx, "GET", `/repos/${full}/actions/runs/${run.id}/jobs`);
    const audit = list(jobs.body && jobs.body.jobs).find((j) => j.name === "audit");
    if (!audit || audit.conclusion !== "success") return { ok: false, reason: `run ${run.id}: audit ${say(audit ? audit.conclusion : "absent", 20)} -- the dependency gate is red or missing` };
    return { ok: true, answerer: "api.github.com", evidence: { repo: full, run: run.id, sha, job: "audit" } };
  }
  return { ok: false, reason: last };
}

// verify answers; every failure but the slot timeout is a not-ok answer, never a throw out of a read.
export async function verify(ctx) {
  // Every answer below comes over ctx.fetch from api.github.com; the probe is GitHub, never state.
  const ask = ctx.fetch.bind(ctx);
  try {
    return await probe({ ...ctx, fetch: ask });
  } catch (e) {
    if (e && e.code === "ABORTED") throw e;
    return { ok: false, reason: `${(e && e.code) || "error"}: ${say(e && e.message)}` };
  }
}

// The workflow and the Dependabot config are the venture's to keep: removing them would drop its dependency gate.
export async function teardown(ctx) {
  return { steps: ctx.resources.filter((r) => r.kind === "github-workflow" || r.kind === "github-file").map((r, i) => ({ order: i + 1, action: "keep (the venture's dependency gate)", resource: say(r.id, 80) })) };
}
