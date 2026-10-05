// environments slot on Vercel (ADR-1704, ADR-1728). Proves "a preview URL per PR" with launch's own PR: branch
// arc/preview-check, one tagged file, one PR to main that is never merged. verify asks Vercel for a READY preview of
// that branch's head. A branch or PR of that name launch did not make is refused, never reused.
import { Buffer } from "node:buffer";

const VERCEL = "https://api.vercel.com";
const GITHUB = "https://api.github.com";
const BRANCH = "arc/preview-check";
const FILE = ".arc/preview-check.md";
const BODY = "Opened by arc launch (environments slot) so every venture has one live preview. Never merge it.\n";

const refuse = (code, message) => Object.assign(new Error(message), { code });
const SKIP = (n) => n < 0x20 || (n >= 0x7f && n < 0xa0) || n === 0x061c || (n >= 0x200b && n <= 0x200f) || (n >= 0x202a && n <= 0x202e) ||
  (n >= 0x2060 && n <= 0x2069) || n === 0x2028 || n === 0x2029 || n === 0xfeff;
const say = (v, cap = 120) => [...(v === null || v === undefined ? "" : String(v))].filter((c) => !SKIP(c.codePointAt(0))).slice(0, cap).join("");
const list = (v) => (Array.isArray(v) ? v.filter((r) => r && typeof r === "object") : []);
const b64 = (text) => Buffer.from(text, "utf8").toString("base64");
const SHA = /^[0-9a-f]{40}$/;

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

// Upstream: the project hosting created or found, and the repo it is linked to (read from Vercel, never rebuilt).
function project(ctx) {
  const all = list(ctx.upstream && ctx.upstream.hosting).filter((r) => r.kind === "vercel-project" || r.kind === "vercel-project-found");
  if (all.length !== 1) throw refuse("UPSTREAM_MISSING", `hosting reported ${all.length} vercel projects; environments needs exactly one`);
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
const isOurs = (ctx, msg) => typeof msg === "string" && msg.split("\n").some((l) => l.trim() === trailer(ctx));

export function envContract() {
  return ["VERCEL_TOKEN", "GITHUB_TOKEN"];
}

export async function scaffold(ctx) {
  const pid = project(ctx);
  const full = await linkedRepo(ctx, pid);
  const p = await vc(ctx, "GET", `/v9/projects/${pid}`);
  if (p.body && p.body.previewDeploymentsDisabled === true) throw refuse("PREVIEWS_DISABLED", `vercel project ${pid} has preview deployments turned off; the owner turns them on`);

  // The branch is launch's when its head commit carries this slot's trailer; any other branch of that name is refused.
  const ref = await gh(ctx, "GET", `/repos/${full}/git/ref/heads/${BRANCH}`, undefined, [404]);
  if (ref.status === 404) {
    const main = await gh(ctx, "GET", `/repos/${full}/git/ref/heads/main`);
    const base = main.body && main.body.object && SHA.test(String(main.body.object.sha)) ? main.body.object.sha : null;
    if (!base) throw new Error(`github returned no main head for ${full}`);
    await gh(ctx, "POST", `/repos/${full}/git/refs`, { ref: `refs/heads/${BRANCH}`, sha: base });
    await gh(ctx, "PUT", `/repos/${full}/contents/${FILE}`, { message: `environments: preview check (ADR-1728)\n\n${trailer(ctx)}`, content: b64(BODY), branch: BRANCH });
  } else {
    const head = await gh(ctx, "GET", `/repos/${full}/commits/${encodeURIComponent(BRANCH)}`);
    if (!isOurs(ctx, head.body && head.body.commit && head.body.commit.message))
      throw refuse("FOREIGN_BRANCH", `${full} already has a branch ${BRANCH} launch did not make; it is not reused`);
  }
  ctx.report({ kind: "github-branch", id: `${full}:${BRANCH}` });

  const [owner] = full.split("/");
  const open = await gh(ctx, "GET", `/repos/${full}/pulls?state=open&head=${encodeURIComponent(`${owner}:${BRANCH}`)}`);
  let pr = list(open.body)[0];
  if (!pr) pr = (await gh(ctx, "POST", `/repos/${full}/pulls`, { title: "arc launch: preview check", head: BRANCH, base: "main", body: BODY })).body;
  if (!pr || typeof pr.number !== "number") throw new Error(`github returned no pull request for ${full}:${BRANCH}`);
  ctx.report({ kind: "github-pr", id: `${full}#${pr.number}` });
  return { files: [], resources: [{ kind: "github-branch", id: `${full}:${BRANCH}` }, { kind: "github-pr", id: `${full}#${pr.number}` }], notes: [] };
}

const wait = (ms, signal) => new Promise((res, rej) => {
  if (signal && signal.aborted) return rej(refuse("ABORTED", "slot timeout reached"));
  const onAbort = () => { clearTimeout(t); rej(refuse("ABORTED", "slot timeout reached")); };
  const t = setTimeout(() => { if (signal) signal.removeEventListener("abort", onAbort); res(); }, ms);
  if (signal) signal.addEventListener("abort", onAbort, { once: true });
});

// Asked of Vercel: a READY, non-production deployment of the preview branch's CURRENT head, with a URL. Eight polls,
// 30 s apart, inside the slot's 300 s timeout.
async function probe(ctx) {
  const pid = project(ctx);
  const full = await linkedRepo(ctx, pid);
  const head = await gh(ctx, "GET", `/repos/${full}/git/ref/heads/${BRANCH}`, undefined, [404]);
  const sha = head.status === 200 && head.body && head.body.object && SHA.test(String(head.body.object.sha)) ? head.body.object.sha : null;
  if (!sha) return { ok: false, reason: `${full} has no ${BRANCH} branch` };
  let last = `no preview deployment of ${sha.slice(0, 7)} yet`;
  for (let i = 0; i < 8; i++) {
    if (i) await wait(30000, ctx.signal);
    const deps = await vc(ctx, "GET", `/v6/deployments?projectId=${encodeURIComponent(pid)}&sha=${sha}&limit=20`);
    const d = list(deps.body && deps.body.deployments).find((x) => x.meta && x.meta.githubCommitSha === sha && x.target !== "production");
    if (!d) continue;
    const state = say(d.readyState || d.state, 20);
    if (state !== "READY") { last = `preview ${say(d.uid, 40)} is ${state}`; if (state === "ERROR" || state === "CANCELED") break; continue; }
    const url = say(d.url, 200);
    if (!/^[a-z0-9.-]+\.vercel\.app$/.test(url)) return { ok: false, reason: `preview ${say(d.uid, 40)} has no vercel.app URL` };
    return { ok: true, answerer: "api.vercel.com", evidence: { project: pid, deployment: say(d.uid, 64), sha, url: `https://${url}` } };
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

export async function teardown(ctx) {
  const order = { "github-pr": "close-pr", "github-branch": "delete-branch" };
  const mine = ctx.resources.filter((r) => order[r.kind]).sort((a, b) => Object.keys(order).indexOf(a.kind) - Object.keys(order).indexOf(b.kind));
  return { steps: mine.map((r, i) => ({ order: i + 1, action: order[r.kind], resource: r.id })) };
}
