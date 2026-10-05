// release slot (ADR-1704, ADR-1727, ADR-1730). Crosses gate 2: after the owner approves `deploy-prod-first`, lifts the
// production hold hosting placed by committing vercel.json as `{}` with release's trailer, and tags that commit. Its
// verify is the deploy receipt: Vercel BUILT a production deployment of the tagged commit (it was not skipped).
import { Buffer } from "node:buffer";

const VERCEL = "https://api.vercel.com";
const GITHUB = "https://api.github.com";
const FILE = "vercel.json";
const TAG = "launch-release-1";
const LIFTED = "{}\n";
const SHA = /^[0-9a-f]{40}$/;
// Built means Vercel ran the build: READY, or ERROR while main has no app yet (frontend proves it serves, ADR-1730).
const BUILT = new Set(["READY", "ERROR"]);
const PENDING = new Set(["QUEUED", "INITIALIZING", "BUILDING"]);

const refuse = (code, message) => Object.assign(new Error(message), { code });
const SKIP = (n) => n < 0x20 || (n >= 0x7f && n < 0xa0) || n === 0x061c || (n >= 0x200b && n <= 0x200f) || (n >= 0x202a && n <= 0x202e) ||
  (n >= 0x2060 && n <= 0x2069) || n === 0x2028 || n === 0x2029 || n === 0xfeff;
const say = (v, cap = 120) => [...(v === null || v === undefined ? "" : String(v))].filter((c) => !SKIP(c.codePointAt(0))).slice(0, cap).join("");
const list = (v) => (Array.isArray(v) ? v.filter((r) => r && typeof r === "object") : []);
const b64 = (text) => Buffer.from(text, "utf8").toString("base64");
const unb64 = (text) => Buffer.from(String(text || "").replace(/\s/g, ""), "base64").toString("utf8");

function tokenOf(ctx, key, shape) {
  const t = String(ctx.env[key] || "").trim();
  if (!shape.test(t)) throw refuse("BAD_TOKEN", `${key} is not a token shape; its value is not printed`);
  return t;
}

async function call(ctx, base, auth, method, path, body, allow) {
  let res;
  try {
    res = await ctx.fetch(`${base}${path}`, {
      method,
      headers: { authorization: `Bearer ${auth}`, "content-type": "application/json", "user-agent": "arc-launch", ...(base === GITHUB ? { accept: "application/vnd.github+json" } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    if (e && e.code) throw e;
    throw new Error(`${base === GITHUB ? "github" : "vercel"} ${method} ${path.split("?")[0]} -> transport error (${say(e && e.name, 30) || "unknown"})`);
  }
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  if (res.ok || (allow || []).includes(res.status)) return { status: res.status, body: json };
  const e = json && typeof json === "object" ? (json.error && typeof json.error === "object" ? json.error : json) : {};
  const msg = typeof e.message === "string" ? `: ${say(e.message)}` : "";
  throw new Error(`${base === GITHUB ? "github" : "vercel"} ${method} ${path.split("?")[0]} -> ${res.status}${msg}`);
}
const vc = (ctx, method, path, body, allow) => call(ctx, VERCEL, tokenOf(ctx, "VERCEL_TOKEN", /^[A-Za-z0-9_-]{20,}$/), method, path, body, allow);
const gh = (ctx, method, path, body, allow) => call(ctx, GITHUB, tokenOf(ctx, "GITHUB_TOKEN", /^[A-Za-z0-9_]{20,}$/), method, path, body, allow);

// Upstream: hosting's project; the repo is the one Vercel links it to.
function project(ctx) {
  const all = list(ctx.upstream && ctx.upstream.hosting).filter((r) => r.kind === "vercel-project" || r.kind === "vercel-project-found");
  if (all.length !== 1) throw refuse("UPSTREAM_MISSING", `hosting reported ${all.length} vercel projects; release needs exactly one`);
  if (!/^prj_[A-Za-z0-9]{1,64}$/.test(all[0].id)) throw refuse("BAD_UPSTREAM", `vercel project id ${JSON.stringify(say(all[0].id, 80))} is not a project id`);
  return all[0].id;
}
async function linkedRepo(ctx, pid) {
  const p = await vc(ctx, "GET", `/v9/projects/${pid}`);
  const link = p.body && p.body.link && typeof p.body.link === "object" ? p.body.link : null;
  const full = link && link.type === "github" ? `${link.org}/${link.repo}` : "";
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/.test(full)) throw refuse("UNLINKED_PROJECT", `vercel project ${pid} is not linked to a GitHub repo`);
  return full;
}

const trailer = (ctx) => `Arc-Launch-Tag: ${ctx.tag}`;
const hostingTrailer = (ctx) => `Arc-Launch-Tag: ${ctx.tag.split("@")[0]}@hosting@vercel`;
const hasLine = (msg, line) => typeof msg === "string" && msg.split("\n").some((l) => l.trim() === line);

export function envContract() {
  return ["VERCEL_TOKEN", "GITHUB_TOKEN"];
}

export async function scaffold(ctx) {
  const pid = project(ctx);
  const full = await linkedRepo(ctx, pid);

  // Already released: the tag exists and points at a commit carrying release's trailer. Nothing is asked or written.
  const tagRef = await gh(ctx, "GET", `/repos/${full}/git/ref/tags/${TAG}`, undefined, [404]);
  if (tagRef.status === 200) {
    const sha = tagRef.body && tagRef.body.object ? String(tagRef.body.object.sha) : "";
    const c = SHA.test(sha) ? await gh(ctx, "GET", `/repos/${full}/commits/${sha}`) : null;
    if (!c || !hasLine(c.body && c.body.commit && c.body.commit.message, trailer(ctx)))
      throw refuse("FOREIGN_TAG", `${full} has a tag ${TAG} launch did not make; it is not reused`);
    ctx.report({ kind: "github-tag", id: `${full}@${TAG}:${sha}` });
    return { files: [], resources: [{ kind: "github-tag", id: `${full}@${TAG}:${sha}` }], notes: [] };
  }

  // The hold must be hosting's, still in place: release lifts what launch placed and nothing else.
  const cur = await gh(ctx, "GET", `/repos/${full}/contents/${FILE}?ref=main`, undefined, [404]);
  if (cur.status === 404) throw refuse("NO_HOLD", `${full} has no ${FILE}; hosting placed no production hold to lift (ADR-1727)`);
  const log = await gh(ctx, "GET", `/repos/${full}/commits?path=${encodeURIComponent(FILE)}&sha=main&per_page=100`);
  // The NEWEST commit on the file is hosting's (or release's own, after a kill): an owner who has since rewritten
  // vercel.json owns it, and release does not lift over their config (attack 5e06edf B1).
  const top0 = list(log.body)[0];
  const topMsg = top0 && top0.commit ? top0.commit.message : "";
  if (!hasLine(topMsg, hostingTrailer(ctx)) && !hasLine(topMsg, trailer(ctx)))
    throw refuse("FOREIGN_FILE", `${full}:${FILE} was last written by someone other than launch; release does not edit it`);

  // Gate 2's sensitive action: the runner pauses here until the owner approves, before anything is written.
  ctx.sensitive("deploy-prod-first");

  let sha;
  if (unb64(cur.body && cur.body.content) === LIFTED) {
    // A kill after the lift and before the tag: the newest commit on the file is release's own.
    const top = list(log.body)[0];
    if (!top || !hasLine(top.commit && top.commit.message, trailer(ctx)) || !SHA.test(String(top.sha)))
      throw refuse("FOREIGN_FILE", `${full}:${FILE} is already lifted by a commit launch did not make`);
    sha = top.sha;
  } else {
    const put = await gh(ctx, "PUT", `/repos/${full}/contents/${FILE}`, {
      message: `release: lift the production hold, gate 2 decided (ADR-1730)\n\n${trailer(ctx)}`,
      content: b64(LIFTED), branch: "main", sha: cur.body.sha,
    });
    sha = put.body && put.body.commit ? String(put.body.commit.sha) : "";
    if (!SHA.test(sha)) throw new Error(`github returned no commit for the lift of ${full}:${FILE}`);
  }
  ctx.report({ kind: "release-commit", id: `${full}:${sha}` });
  await gh(ctx, "POST", `/repos/${full}/git/refs`, { ref: `refs/tags/${TAG}`, sha });
  ctx.report({ kind: "github-tag", id: `${full}@${TAG}:${sha}` });
  return { files: [], resources: [{ kind: "release-commit", id: `${full}:${sha}` }, { kind: "github-tag", id: `${full}@${TAG}:${sha}` }], notes: [] };
}

const wait = (ms, signal) => new Promise((res, rej) => {
  if (signal && signal.aborted) return rej(refuse("ABORTED", "slot timeout reached"));
  const onAbort = () => { clearTimeout(t); rej(refuse("ABORTED", "slot timeout reached")); };
  const t = setTimeout(() => { if (signal) signal.removeEventListener("abort", onAbort); res(); }, ms);
  if (signal) signal.addEventListener("abort", onAbort, { once: true });
});

// Asked of GitHub (where the tag points, and that it is release's commit) and Vercel (a production deployment of that
// commit that was built, not skipped). Twenty polls, 30 s apart, inside the slot's 900 s timeout.
async function probe(ctx) {
  const pid = project(ctx);
  const full = await linkedRepo(ctx, pid);
  const tagRef = await gh(ctx, "GET", `/repos/${full}/git/ref/tags/${TAG}`, undefined, [404]);
  const sha = tagRef.status === 200 && tagRef.body && tagRef.body.object ? String(tagRef.body.object.sha) : "";
  if (!SHA.test(sha)) return { ok: false, reason: `${full} has no ${TAG} tag` };
  const c = await gh(ctx, "GET", `/repos/${full}/commits/${sha}`);
  if (!hasLine(c.body && c.body.commit && c.body.commit.message, trailer(ctx))) return { ok: false, reason: `FOREIGN_TAG: ${TAG} does not point at release's commit` };
  let last = `no production deployment of ${sha.slice(0, 7)} yet`;
  for (let i = 0; i < 20; i++) {
    if (i) await wait(30000, ctx.signal);
    const deps = await vc(ctx, "GET", `/v6/deployments?projectId=${encodeURIComponent(pid)}&sha=${sha}&target=production&limit=20`);
    const d = list(deps.body && deps.body.deployments).find((x) => x.meta && x.meta.githubCommitSha === sha && x.target === "production");
    if (!d) continue;
    const state = say(d.readyState || d.state, 20);
    // ERROR counts only while the tagged commit holds no app: once package.json is there, a failed build is a failed
    // release, not a receipt (attack 5e06edf B2).
    if (state === "ERROR") {
      const pkg = await gh(ctx, "GET", `/repos/${full}/contents/package.json?ref=${sha}`, undefined, [404]);
      if (pkg.status !== 404) return { ok: false, reason: `production build of ${sha.slice(0, 7)} failed (ERROR) and the commit holds an app` };
    }
    if (BUILT.has(state)) return { ok: true, answerer: "api.vercel.com", evidence: { project: pid, tag: TAG, sha, deployment: say(d.uid, 64), state } };
    if (!PENDING.has(state)) return { ok: false, reason: `production deployment ${say(d.uid, 40)} of ${sha.slice(0, 7)} is ${state || "unknown"} -- the hold still skips it` };
    last = `production deployment ${say(d.uid, 40)} is ${state}`;
  }
  return { ok: false, reason: last };
}

// verify answers; every failure but the slot timeout is a not-ok answer, never a throw out of a read.
export async function verify(ctx) {
  // Every answer below comes over ctx.fetch from api.vercel.com and api.github.com; the probe is the providers.
  const ask = ctx.fetch.bind(ctx);
  try {
    return await probe({ ...ctx, fetch: ask });
  } catch (e) {
    if (e && e.code === "ABORTED") throw e;
    return { ok: false, reason: `${(e && e.code) || "error"}: ${say(e && e.message)}` };
  }
}

// A release is not undone by deleting a tag: the exit plan parks production, it never re-holds or rewrites history.
export async function teardown(ctx) {
  return { steps: ctx.resources.filter((r) => r.kind === "github-tag").map((r, i) => ({ order: i + 1, action: "keep (release history)", resource: r.id })) };
}
