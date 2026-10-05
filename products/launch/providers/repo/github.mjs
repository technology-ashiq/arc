// repo slot on GitHub (ADR-1704, ADR-1722): one PRIVATE repo under the token owner's account, named after the venture
// slug. The repo's description carries the resource tag, so a re-run finds what an earlier attempt created; a repo of
// that name without the tag is someone else's and is never touched. A public repo of the right name is refused.
const API = "https://api.github.com";

const refuse = (code, message) => Object.assign(new Error(message), { code });
// Provider text reaches the runner's reason and the board: controls, bidi, zero-width marks dropped, capped by code
// points (the dns adapter's rule, fixed-defects B4 / fb3a494 B3).
const SKIP = (n) => n < 0x20 || (n >= 0x7f && n < 0xa0) || n === 0x061c || (n >= 0x200b && n <= 0x200f) || (n >= 0x202a && n <= 0x202e) ||
  (n >= 0x2060 && n <= 0x2069) || n === 0x2028 || n === 0x2029 || n === 0xfeff;
const say = (v, cap = 120) => [...String(v)].filter((c) => !SKIP(c.codePointAt(0))).slice(0, cap).join("");

const marker = (tag) => `[arc-launch ${tag}]`;

function token(ctx) {
  const t = String(ctx.env.GITHUB_TOKEN || "").trim();
  if (!/^[A-Za-z0-9_]{20,}$/.test(t)) throw refuse("BAD_TOKEN", "GITHUB_TOKEN is not a token shape (letters, digits and _, 20 or more); its value is not printed");
  return t;
}

// Returns { status, body }; a 404 is an answer the caller reads, every other non-2xx throws with GitHub's message.
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
    throw new Error(`github ${method} ${path} -> transport error (${say(e && e.name, 30) || "unknown"})`);
  }
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  if (res.ok || allow.includes(res.status)) return { status: res.status, body: json };
  const msg = json && typeof json === "object" && typeof json.message === "string" ? `: ${say(json.message)}` : "";
  throw new Error(`github ${method} ${path} -> ${res.status}${msg}`);
}

async function login(ctx) {
  const { body } = await gh(ctx, "GET", "/user");
  const l = body && typeof body.login === "string" ? body.login : "";
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(l)) throw new Error("github /user returned no usable login");
  return l;
}

function repoName(ctx) {
  const s = String((ctx.profile && ctx.profile.slug) || "");
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(s)) throw refuse("BAD_SLUG", `venture slug ${JSON.stringify(say(s, 40))} is not a repo name`);
  return s;
}

function own(ctx, repo, full) {
  if (!repo || typeof repo !== "object") throw new Error(`github returned no repo for ${full}`);
  // The marker ENDS the description, as launch writes it: pasted mid-text it is not ownership (attack 2b16424 L5).
  if (typeof repo.description !== "string" || !repo.description.trimEnd().endsWith(marker(ctx.tag)))
    throw refuse("FOREIGN_REPO", `${full} exists and is not tagged ${ctx.tag}; launch never adopts a repo it did not create`);
  if (repo.private !== true) throw refuse("NOT_PRIVATE", `${full} is public; a venture repo is private (ADR-1722)`);
  // An archived repo is read-only: refused here, not discovered later as a failed commit (attack 2b16424 L9).
  if (repo.archived === true) throw refuse("REPO_ARCHIVED", `${full} is archived (the exit plan ran); unarchive it by hand to launch again`);
  return repo;
}

export function envContract() {
  return ["GITHUB_TOKEN"];
}

export async function scaffold(ctx) {
  const name = repoName(ctx);
  const owner = await login(ctx);
  const full = `${owner}/${name}`;
  let found = await gh(ctx, "GET", `/repos/${full}`, undefined, { allow: [404] });
  if (found.status === 404) {
    const brand = say((ctx.profile.brand && ctx.profile.brand.name) || name, 60);
    const made = await gh(ctx, "POST", "/user/repos", { name, private: true, auto_init: true, description: `${brand} ${marker(ctx.tag)}` }, { allow: [422] });
    // 422 = a concurrent attempt created it between the check and the create: read it back and judge it like any other.
    // A 404 on that re-read means the 422 was not a concurrent create: GitHub refused the name (attack faccecd B5).
    if (made.status === 422) {
      found = await gh(ctx, "GET", `/repos/${full}`, undefined, { allow: [404] });
      if (found.status === 404) throw new Error(`github refused to create ${full} (422) and no such repo exists`);
    } else found = made;
  }
  own(ctx, found.body, full);
  ctx.report({ kind: "github-repo", id: full });
  return { files: [], resources: [{ kind: "github-repo", id: full }], notes: [] };
}

// Asked of GitHub, never of state: the repo is private, tagged, and its main branch holds a commit.
async function probe(ctx) {
  const full = `${await login(ctx)}/${repoName(ctx)}`;
  const { status, body } = await gh(ctx, "GET", `/repos/${full}`, undefined, { allow: [404] });
  if (status === 404) return { ok: false, reason: `${full} does not exist` };
  own(ctx, body, full);
  const branch = typeof body.default_branch === "string" && /^[A-Za-z0-9._/-]{1,100}$/.test(body.default_branch) ? body.default_branch : null;
  if (!branch) return { ok: false, reason: `${full} has no usable main branch` };
  const head = await gh(ctx, "GET", `/repos/${full}/branches/${encodeURIComponent(branch)}`, undefined, { allow: [404] });
  if (head.status === 404 || !head.body || !head.body.commit || typeof head.body.commit.sha !== "string")
    return { ok: false, reason: `${full} branch ${branch} holds no commit` };
  return { ok: true, answerer: "api.github.com", evidence: { repo: full, private: true, branch, head: head.body.commit.sha } };
}

// verify answers; a coded refusal (token, slug, foreign, archived) becomes a not-ok answer, never a throw out of a read
// (attack 2b16424 B1). Only the slot timeout propagates.
export async function verify(ctx) {
  // Every answer below comes over ctx.fetch from api.github.com; the probe is GitHub, never state.
  const ask = ctx.fetch.bind(ctx);
  try {
    return await probe({ ...ctx, fetch: ask });
  } catch (e) {
    if (e && e.code && e.code !== "ABORTED") return { ok: false, reason: `${e.code}: ${say(e.message)}` };
    throw e;
  }
}

export async function teardown(ctx) {
  // A repo is archived, never deleted, by the exit plan; `delete` stays a sensitive action behind the owner.
  return { steps: ctx.resources.filter((r) => r.kind === "github-repo").map((r, i) => ({ order: i + 1, action: "archive", resource: r.id })) };
}
