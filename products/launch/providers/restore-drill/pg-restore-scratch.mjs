import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
// ---- shared by auth, authz, tenancy, plans and the Phase 03 GitHub slots (ADR-1734, ADR-1746). Adapters are one file each (ADR-1704), so this block is repeated.
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

// restore-drill slot (ADR-1704, ADR-1709, ADR-1746). The drill is backup's workflow: its restore step restores the dump
// into a scratch Postgres and fails unless every table's row count equals the source's. This slot creates nothing; its
// receipt is that step's green run of launch's own drill file (backup's digest), asked of GitHub, never of state. The run must be under eight days old, so a
// drill whose weekly schedule stopped is not a standing receipt.
const WORKFLOW_FILE = "backup-drill.yml";
const STEP_DUMP = "dump and checksum";
const STEP_RESTORE = "restore and compare row counts";
const sha256 = (t) => createHash("sha256").update(t, "utf8").digest("hex");
const MAX_AGE_MS = 8 * 24 * 3600 * 1000;

// Upstream: backup's reported workflow names the venture repo, and its drill digest is the only file this slot trusts a
// run of (ADR-1746, b6ffd12 B5). Validated here, never trusted.
function digestOf(ctx) {
  const d = String((list(ctx.upstream && ctx.upstream.backup).find((r) => r.kind === "drill-digest") || {}).id || "");
  if (!/^[0-9a-f]{64}$/.test(d)) throw refuse("UPSTREAM_MISSING", "backup reported no drill digest");
  return d;
}

function repoOf(ctx) {
  const up = list(ctx.upstream && ctx.upstream.backup);
  const wf = String((up.find((r) => r.kind === "github-workflow") || {}).id || "");
  const full = wf.slice(0, wf.lastIndexOf(":"));
  if (!repoShape(full) || wf.slice(wf.lastIndexOf(":") + 1) !== `.github/workflows/${WORKFLOW_FILE}`) throw refuse("UPSTREAM_MISSING", "backup reported no drill workflow");
  return full;
}

export function envContract() {
  return ["GITHUB_TOKEN"];
}

export async function scaffold(ctx) {
  const full = repoOf(ctx);
  digestOf(ctx);
  ctx.report({ kind: "restore-source", id: `${full}:.github/workflows/${WORKFLOW_FILE}#restore` });
  return { files: [], resources: [{ kind: "restore-source", id: `${full}:.github/workflows/${WORKFLOW_FILE}#restore` }], notes: [] };
}

// The newest drill run on main that answers for launch's file: completed, not cancelled or skipped (a newer cancelled
// run must not mask a green one), and run at a head whose workflow file is byte-for-byte launch's (b6ffd12 B6). Then
// the conclusion of each named step of its one job. Shared shape with restore-drill, which carries the same code.
async function drill(ctx, full, digest) {
  const runs = await gh(ctx, "GET", `/repos/${full}/actions/workflows/${WORKFLOW_FILE}/runs?branch=main&status=completed&per_page=30`, undefined, [404]);
  if (runs.status === 404) return { reason: `${full} has no ${WORKFLOW_FILE} workflow` };
  if (!(runs.body && Array.isArray(runs.body.workflow_runs))) return { reason: "github answered the runs list without a workflow_runs array" };
  const done = list(runs.body.workflow_runs)
    .filter((r) => r.status === "completed" && !["cancelled", "skipped"].includes(r.conclusion) && typeof r.id === "number" && typeof r.created_at === "string" && SHA.test(String(r.head_sha)))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  for (const run of done.slice(0, 5)) {
    const age = Date.now() - Date.parse(run.created_at);
    if (!Number.isFinite(age) || age > MAX_AGE_MS) return { reason: `the newest drill run ${run.id} is older than eight days` };
    const at = await gh(ctx, "GET", `/repos/${full}/contents/.github/workflows/${WORKFLOW_FILE}?ref=${run.head_sha}`, undefined, [404]);
    const b = at.body;
    if (at.status === 404 || !b || typeof b.content !== "string" || sha256(utf8(b.content)) !== digest) continue;
    const jobs = await gh(ctx, "GET", `/repos/${full}/actions/runs/${run.id}/jobs`);
    const job = list(jobs.body && jobs.body.jobs).find((j) => j.name === "drill");
    const steps = new Map(list(job && job.steps).map((s) => [s.name, s.conclusion]));
    return { run: run.id, dump: steps.get(STEP_DUMP) ?? "absent", restore: steps.get(STEP_RESTORE) ?? "absent" };
  }
  return { reason: `no completed ${WORKFLOW_FILE} run on main ran launch's drill file` };
}

async function probe(ctx) {
  const full = repoOf(ctx);
  const d = await drill(ctx, full, digestOf(ctx));
  if (d.reason) return { ok: false, reason: d.reason };
  if (d.restore !== "success") return { ok: false, reason: `drill run ${d.run}: restore ${say(d.restore, 20)} -- no restore with equal row counts` };
  return { ok: true, answerer: "api.github.com", evidence: { repo: full, run: d.run, step: STEP_RESTORE, rule: "every table's row count equal, at least one table" } };
}

// verify answers; every failure but the slot timeout is a not-ok answer, never a throw out of a read.
export async function verify(ctx) {
  // Every answer below comes over ctx.fetch from api.github.com; the probe is the drill's run, never state.
  const ask = ctx.fetch.bind(ctx);
  try {
    return await probe({ ...ctx, fetch: ask });
  } catch (e) {
    if (e && e.code === "ABORTED") throw e;
    return { ok: false, reason: `${(e && e.code) || "error"}: ${say(e && e.message)}` };
  }
}

// Nothing was created: the drill is backup's, and the scratch database lived only inside the run.
export async function teardown(ctx) {
  return { steps: ctx.resources.filter((r) => r.kind === "restore-source").map((r, i) => ({ order: i + 1, action: "none (the scratch database lived only inside the run)", resource: say(r.id, 80) })) };
}
