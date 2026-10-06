// orm slot on drizzle (ADR-1704, ADR-1726, ADR-1733). Commits the typed schema of the probe table (ADR-1731) and a
// node --test that asserts its columns, in one commit through the Git Data API. verify asks GitHub for the arc-ci run of
// main's head: all three legs green while db/schema.js is in that commit -- the schema type-checked outside this repo.
const GITHUB = "https://api.github.com";
const SHA = /^[0-9a-f]{40}$/;
const LEGS = ["ubuntu-latest", "windows-latest", "macos-latest"].map((os) => `test (${os})`);
const FILES = {
  "db/schema.js": [
    "// The venture's database schema, written by arc launch (orm slot). launch_probe is the RLS probe (ADR-1731).",
    "import { pgTable, integer, text } from \"drizzle-orm/pg-core\";",
    "",
    "export const launchProbe = pgTable(\"launch_probe\", {",
    "  id: integer(\"id\").primaryKey(),",
    "  note: text(\"note\").notNull(),",
    "});",
    "",
  ].join("\n"),
  "db/schema.test.js": [
    "// The schema's own check, run by arc-ci on every leg (node --test).",
    "import { test } from \"node:test\";",
    "import assert from \"node:assert/strict\";",
    "import { getTableConfig } from \"drizzle-orm/pg-core\";",
    "import { launchProbe } from \"./schema.js\";",
    "",
    "test(\"launch_probe has exactly id (primary key) and note (not null)\", () => {",
    "  const t = getTableConfig(launchProbe);",
    "  assert.equal(t.name, \"launch_probe\");",
    "  assert.deepEqual(t.columns.map((c) => [c.name, c.primary, c.notNull]).sort(), [[\"id\", true, true], [\"note\", false, true]]);",
    "});",
    "",
  ].join("\n"),
};

const refuse = (code, message) => Object.assign(new Error(message), { code });
const SKIP = (n) => n < 0x20 || (n >= 0x7f && n < 0xa0) || n === 0x061c || (n >= 0x200b && n <= 0x200f) || (n >= 0x202a && n <= 0x202e) ||
  (n >= 0x2060 && n <= 0x2069) || n === 0x2028 || n === 0x2029 || n === 0xfeff;
const say = (v, cap = 120) => [...(v === null || v === undefined ? "" : String(v))].filter((c) => !SKIP(c.codePointAt(0))).slice(0, cap).join("");
const list = (v) => (Array.isArray(v) ? v.filter((r) => r && typeof r === "object") : []);

function tokenOf(ctx) {
  const t = String(ctx.env.GITHUB_TOKEN || "").trim();
  if (!/^[A-Za-z0-9_]{20,}$/.test(t)) throw refuse("BAD_TOKEN", "GITHUB_TOKEN is not a token shape; its value is not printed");
  return t;
}
async function gh(ctx, method, path, body, allow) {
  let res;
  try {
    res = await ctx.fetch(`${GITHUB}${path}`, { method, headers: { authorization: `Bearer ${tokenOf(ctx)}`, accept: "application/vnd.github+json", "content-type": "application/json", "user-agent": "arc-launch" }, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (e) {
    if (e && e.code) throw e;
    throw new Error(`github ${method} ${path.split("?")[0]} -> transport error (${say(e && e.name, 30) || "unknown"})`);
  }
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  if (res.ok || (allow || []).includes(res.status)) return { status: res.status, body: json };
  const msg = json && typeof json === "object" && typeof json.message === "string" ? `: ${say(json.message)}` : "";
  throw new Error(`github ${method} ${path.split("?")[0]} -> ${res.status}${msg}`);
}
function repo(ctx) {
  const all = list(ctx.upstream && ctx.upstream.frontend).filter((r) => r.kind === "frontend-shell");
  if (all.length < 1) throw refuse("UPSTREAM_MISSING", "frontend reported no shell; the schema is written beside it");
  const full = String(all[all.length - 1].id).split(":")[0];
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[a-z][a-z0-9-]{0,63}$/.test(full)) throw refuse("BAD_UPSTREAM", "frontend's shell id names no owner/name repo");
  if (!list(ctx.upstream && ctx.upstream.database).some((r) => r.kind === "db-probe-table")) throw refuse("UPSTREAM_MISSING", "database recorded no probe table; the schema describes it");
  return full;
}
const trailer = (ctx) => `Arc-Launch-Tag: ${ctx.tag}`;
const hasLine = (msg, line) => typeof msg === "string" && msg.split("\n").some((l) => l.trim() === line);
const utf8 = (b64) => new TextDecoder().decode(Uint8Array.from(atob(String(b64).replace(/\s/g, "")), (c) => c.charCodeAt(0)));

// At `head`, `path` holds launch's exact bytes AND its newest commit carries this slot's trailer (attack 3f04230 B1/B4/L5).
async function oursAt(ctx, full, head, path) {
  const cur = await gh(ctx, "GET", `/repos/${full}/contents/${path}?ref=${head}`, undefined, [404]);
  const b = cur.body;
  if (cur.status === 404 || !b || b.type !== "file" || typeof b.content !== "string" || utf8(b.content) !== FILES[path]) return false;
  const log = await gh(ctx, "GET", `/repos/${full}/commits?path=${encodeURIComponent(path)}&sha=${head}&per_page=1`);
  const top = list(log.body)[0];
  return hasLine(top && top.commit && top.commit.message, trailer(ctx));
}

export function envContract() {
  return ["GITHUB_TOKEN"];
}

// One commit on one head: head read first, every file checked at that sha, a non-forced ref update.
export async function scaffold(ctx) {
  const full = repo(ctx);
  const ref = await gh(ctx, "GET", `/repos/${full}/git/ref/heads/main`);
  const head = ref.body && ref.body.object ? String(ref.body.object.sha) : "";
  if (!SHA.test(head)) throw new Error(`github returned no main head for ${full}`);
  const changed = [];
  for (const [path, text] of Object.entries(FILES)) {
    const cur = await gh(ctx, "GET", `/repos/${full}/contents/${path}?ref=${head}`, undefined, [404]);
    if (cur.status === 404) { changed.push(path); continue; }
    const b = cur.body;
    if (!b || b.type !== "file" || b.encoding !== "base64" || typeof b.content !== "string") throw refuse("FOREIGN_FILE", `${full}:${path} is not a plain file`);
    // Identical bytes are still the owner's unless launch committed them: the trailer decides, content alone never
    // does (attack 3f04230 L3/L4).
    const log = await gh(ctx, "GET", `/repos/${full}/commits?path=${encodeURIComponent(path)}&sha=${head}&per_page=1`);
    const top = list(log.body)[0];
    if (utf8(b.content) === text && hasLine(top && top.commit && top.commit.message, trailer(ctx))) continue;
    if (!hasLine(top && top.commit && top.commit.message, trailer(ctx))) throw refuse("FOREIGN_FILE", `${full}:${path} holds the owner's schema; it is not committed over`);
    changed.push(path);
  }
  let sha = head;
  if (changed.length) {
    const base = await gh(ctx, "GET", `/repos/${full}/git/commits/${head}`);
    const baseTree = base.body && base.body.tree ? String(base.body.tree.sha) : "";
    if (!SHA.test(baseTree)) throw new Error(`github returned no tree for ${full}`);
    const tree = [];
    for (const path of changed) {
      const blob = await gh(ctx, "POST", `/repos/${full}/git/blobs`, { content: FILES[path], encoding: "utf-8" });
      if (!blob.body || !SHA.test(String(blob.body.sha))) throw new Error(`github returned no blob for ${path}`);
      tree.push({ path, mode: "100644", type: "blob", sha: blob.body.sha });
    }
    const t = await gh(ctx, "POST", `/repos/${full}/git/trees`, { base_tree: baseTree, tree });
    const c = await gh(ctx, "POST", `/repos/${full}/git/commits`, { message: `orm: the typed schema and its check (ADR-1733)\n\n${trailer(ctx)}`, tree: t.body && t.body.sha, parents: [head] });
    sha = c.body ? String(c.body.sha) : "";
    if (!SHA.test(sha)) throw new Error(`github returned no commit for ${full}`);
    await gh(ctx, "PATCH", `/repos/${full}/git/refs/heads/main`, { sha, force: false });
    // The local copy is written only once the commit is on main, so the venture root never holds files the repo lacks
    // (attack 3a6350b B3).
    for (const path of changed) ctx.write(path, FILES[path]);
  }
  ctx.report({ kind: "orm-schema", id: `${full}:${sha}` });
  return { files: Object.keys(FILES), resources: [{ kind: "orm-schema", id: `${full}:${sha}` }], notes: [] };
}

const wait = (ms, signal) => new Promise((res, rej) => {
  if (signal && signal.aborted) return rej(refuse("ABORTED", "slot timeout reached"));
  const onAbort = () => { clearTimeout(t); rej(refuse("ABORTED", "slot timeout reached")); };
  const t = setTimeout(() => { if (signal) signal.removeEventListener("abort", onAbort); res(); }, ms);
  if (signal) signal.addEventListener("abort", onAbort, { once: true });
});

// Asked of GitHub: main's head holds this exact schema, and its arc-ci run concluded green on all three legs.
async function probe(ctx) {
  const full = repo(ctx);
  const ref = await gh(ctx, "GET", `/repos/${full}/git/ref/heads/main`);
  const head = ref.body && ref.body.object ? String(ref.body.object.sha) : "";
  if (!SHA.test(head)) return { ok: false, reason: `${full} main has no readable head` };
  for (const path of Object.keys(FILES))
    if (!(await oursAt(ctx, full, head, path))) return { ok: false, reason: `${full}@${head.slice(0, 7)}: ${path} is not launch's schema file` };
  let last = `no arc-ci run for ${head.slice(0, 7)} yet`;
  for (let i = 0; i < 8; i++) {
    if (i) await wait(30000, ctx.signal);
    const runs = await gh(ctx, "GET", `/repos/${full}/actions/workflows/arc-ci.yml/runs?branch=main&head_sha=${head}&per_page=30`, undefined, [404]);
    // No arc-ci workflow at all is an answer, not a wait (attack 3f04230 B2).
    if (runs.status === 404) return { ok: false, reason: `${full} has no arc-ci workflow (the ci slot writes it)` };
    // Every run for the head, newest first: a cancelled or skipped re-run must not mask a green one (attack 3a6350b B2).
    const forHead = runs.status === 200 && runs.body ? list(runs.body.workflow_runs).filter((r) => r.head_sha === head && typeof r.id === "number") : [];
    const run = forHead.find((r) => r.status === "completed" && r.conclusion === "success") || forHead.find((r) => r.status !== "completed") || forHead[0] || null;
    if (!run) continue;
    if (run.status !== "completed") { last = `run ${run.id} is still ${say(run.status, 20)}`; continue; }
    const jobs = await gh(ctx, "GET", `/repos/${full}/actions/runs/${run.id}/jobs`);
    const js = list(jobs.body && jobs.body.jobs);
    // A completed run can still list a job without its conclusion: that is still running (attack 3f04230 L12).
    if (js.some((j) => LEGS.includes(j.name) && j.status !== "completed")) { last = `run ${run.id} still has a leg running`; continue; }
    const byName = new Map(js.map((j) => [j.name, j.conclusion]));
    const red = LEGS.filter((n) => byName.get(n) !== "success");
    if (red.length) return { ok: false, reason: `run ${run.id}: ${red.map((n) => `${n} ${say(byName.get(n) ?? "absent", 20)}`).join(", ")}` };
    return { ok: true, answerer: "api.github.com", evidence: { repo: full, head, run: run.id } };
  }
  return { ok: false, reason: last };
}

// verify answers; every failure but the slot timeout is a not-ok answer, never a throw out of a read.
export async function verify(ctx) {
  // Every answer below comes over ctx.fetch from api.github.com; the probe is CI's run, never state.
  const ask = ctx.fetch.bind(ctx);
  try {
    return await probe({ ...ctx, fetch: ask });
  } catch (e) {
    if (e && e.code === "ABORTED") throw e;
    return { ok: false, reason: `${(e && e.code) || "error"}: ${say(e && e.message)}` };
  }
}

export async function teardown() {
  return { steps: [] };
}
