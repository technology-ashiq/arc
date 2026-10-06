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
  // `npm ci` needs a lockfile, which the shell (ADR-1730) does not ship: install without one until the venture adds it.
  "        run: if [ -f package.json ]; then if [ -f package-lock.json ]; then npm ci; else npm install --no-audit --no-fund; fi && npm test --if-present; else echo no package.json yet; fi",
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
  // Only the protection call can be a plan limit; a 403 anywhere else (rate limit, scope) is reported as itself
  // (attack faccecd L5).
  if (res.status === 403 && path.includes("/branches/main/protection") && /upgrade to github pro|make this repository public/i.test(msg))
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

// The workflow is launch's only when launch committed it: content equal to ours is not enough, since an owner may have
// copied it (attack 2b16424 L10). The newest commit touching the file must carry this slot's tag trailer.
async function wroteIt(ctx, full) {
  const log = await gh(ctx, "GET", `/repos/${full}/commits?path=${encodeURIComponent(PATH)}&sha=main&per_page=1`);
  const top = list(log.body)[0];
  const msg = top && top.commit && typeof top.commit.message === "string" ? top.commit.message : "";
  return msg.split("\n").some((l) => l.trim() === `Arc-Launch-Tag: ${ctx.tag}`);
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
  } else if (!(await wroteIt(ctx, full))) {
    throw refuse("FOREIGN_WORKFLOW", `${full}:${PATH} already holds this workflow from a commit launch did not make; it is not adopted`);
  }
  // Reported the moment it exists: a protection call that fails next must not leave a commit nothing records
  // (attack faccecd B2).
  ctx.report({ kind: "github-workflow", id: `${full}:${PATH}` });
  // An owner's existing protection is extended, never replaced (attack faccecd B1): the missing checks are ADDED
  // through the contexts endpoint, so their other checks and app bindings stay as they are (attack 2b16424 L6/B3).
  // What launch created and what it only added are recorded apart, so the exit plan removes no owner rule
  // (attack 2b16424 B2).
  const prot = await gh(ctx, "GET", `/repos/${full}/branches/main/protection`, undefined, { allow: [404] });
  let kind;
  if (prot.status === 404) {
    await gh(ctx, "PUT", `/repos/${full}/branches/main/protection`, {
      required_status_checks: { strict: false, contexts: CHECKS },
      enforce_admins: false, required_pull_request_reviews: null, restrictions: null,
    });
    kind = "branch-protection";
  } else {
    const rsc = prot.body && typeof prot.body === "object" ? prot.body.required_status_checks : null;
    if (!rsc || typeof rsc !== "object")
      throw refuse("PROTECTION_EXISTS", `${full}@main is protected without status checks; launch adds checks to protection, it does not rewrite the owner's rules`);
    const present = Array.isArray(rsc.contexts) ? rsc.contexts.filter((c) => typeof c === "string") : [];
    const add = CHECKS.filter((c) => !present.includes(c));
    if (add.length) await gh(ctx, "POST", `/repos/${full}/branches/main/protection/required_status_checks/contexts`, { contexts: add });
    // Protection an earlier attempt of this slot created stays launch's on a re-run.
    kind = ctx.resources.some((r) => r.kind === "branch-protection" && r.id === `${full}@main`) ? "branch-protection" : "required-checks";
  }
  ctx.report({ kind, id: `${full}@main` });
  return { files: [PATH], resources: [{ kind: "github-workflow", id: `${full}:${PATH}` }, { kind, id: `${full}@main` }], notes: [] };
}

const wait = (ms, signal) => new Promise((res, rej) => {
  if (signal && signal.aborted) return rej(refuse("ABORTED", "slot timeout reached"));
  const onAbort = () => { clearTimeout(t); rej(refuse("ABORTED", "slot timeout reached")); };
  const t = setTimeout(() => { if (signal) signal.removeEventListener("abort", onAbort); res(); }, ms);
  if (signal) signal.addEventListener("abort", onAbort, { once: true });
});

// Asked of GitHub: the three checks are required on main, and the run of the workflow for main's CURRENT head has all
// three legs green. An older run is never the answer (attack faccecd B3); a run not yet created and a run still going
// are reported apart (attack faccecd L2). Thirteen polls, 20 s apart, fit inside the slot's 300 s timeout. Required
// checks the owner added are theirs to judge (debt D15).
async function probe(ctx) {
  const full = repo(ctx);
  const prot = await gh(ctx, "GET", `/repos/${full}/branches/main/protection/required_status_checks`, undefined, { allow: [404] });
  const contexts = prot.status === 200 && prot.body && Array.isArray(prot.body.contexts) ? prot.body.contexts : [];
  const missing = CHECKS.filter((c) => !contexts.includes(c));
  if (missing.length) return { ok: false, reason: `main does not require ${missing.join(", ")}` };
  const head = await gh(ctx, "GET", `/repos/${full}/branches/main`);
  const sha = head.body && head.body.commit && typeof head.body.commit.sha === "string" && /^[0-9a-f]{40}$/.test(head.body.commit.sha) ? head.body.commit.sha : null;
  if (!sha) return { ok: false, reason: `${full} main has no readable head commit` };
  let last = `no run of arc-ci for main's head ${sha.slice(0, 7)} yet`;
  for (let i = 0; i < 13; i++) {
    if (i) await wait(20000, ctx.signal);
    const runs = await gh(ctx, "GET", `/repos/${full}/actions/workflows/arc-ci.yml/runs?branch=main&head_sha=${sha}&per_page=1`, undefined, { allow: [404] });
    if (runs.status === 200 && !(runs.body && Array.isArray(runs.body.workflow_runs)))
      return { ok: false, reason: "github answered the runs list without a workflow_runs array" };
    const run = runs.status === 200 ? list(runs.body.workflow_runs).find((r) => r.head_sha === sha && typeof r.id === "number") : null;
    if (!run) continue;
    if (run.status !== "completed") { last = `run ${run.id} for ${sha.slice(0, 7)} is still ${say(run.status, 20)}`; continue; }
    const jobs = await gh(ctx, "GET", `/repos/${full}/actions/runs/${run.id}/jobs`);
    const byName = new Map(list(jobs.body && jobs.body.jobs).map((j) => [j.name, j.conclusion]));
    const red = CHECKS.filter((c) => byName.get(c) !== "success");
    if (red.length) return { ok: false, reason: `run ${run.id}: ${red.map((c) => `${c} ${say(byName.get(c) ?? "absent", 20)}`).join(", ")}` };
    return { ok: true, answerer: "api.github.com", evidence: { repo: full, run: run.id, sha, checks: CHECKS } };
  }
  return { ok: false, reason: last };
}

// verify answers; a coded refusal from anywhere in the probe (token, upstream, plan limit) becomes a not-ok answer,
// never a throw out of a read (attack faccecd B8, 2b16424 L1/B1). Only the slot timeout propagates: the runner owns it.
export async function verify(ctx) {
  // Every answer below comes over ctx.fetch from api.github.com; the probe is GitHub, never state.
  const ask = ctx.fetch.bind(ctx);
  try {
    return await probe({ ...ctx, fetch: ask });
  } catch (e) {
    // An uncoded failure (5xx, 429, transport) is an answer too, not a throw (attack 1406e29 B3, twin).
    if (e && e.code === "ABORTED") throw e;
    return { ok: false, reason: `${(e && e.code) || "error"}: ${say(e && e.message)}` };
  }
}

// The exit plan undoes only what launch made: protection it created is removed, checks it added to the owner's
// protection are removed from it, and the owner's rules stay.
export async function teardown(ctx) {
  const action = { "github-workflow": "delete", "branch-protection": "unprotect", "required-checks": "remove-checks" };
  return { steps: ctx.resources.filter((r) => action[r.kind]).map((r, i) => ({ order: i + 1, action: action[r.kind], resource: r.id })) };
}
