// In-memory GitHub: one token -> one login; repos with a main branch, files (Contents API), branch protection and
// Actions runs. It replaces only the transport (globalThis.fetch). Deterministic: every sha comes from a counter.
//   runConclusions  what each of the three legs concludes when a commit lands on main (all success unless set)
//   planLimit       branch protection answers 403 the way GitHub Free does for a private repo
//   pendingPolls    how many runs-list reads show a new run as in_progress before it completes
export const LEGS = ["ubuntu-latest", "windows-latest", "macos-latest"];

export function makeGithub({ login = "technology-ashiq", token = "gho_fixtureToken0123456789", repos = [], runConclusions = null, planLimit = false, pendingPolls = 0 } = {}) {
  const fresh = (r) => ({ private: true, description: "", files: {}, runs: [], protection: null, commits: [], ...r });
  const store = new Map(repos.map((r) => [`${r.owner || login}/${r.name}`, fresh(r)]));
  const calls = [];
  let n = 0;
  const sha = () => (++n).toString(16).padStart(40, "0");
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const err = (status, message) => json(status, { message, documentation_url: "https://docs.github.com" });
  const view = (full, r) => ({ full_name: full, name: full.split("/")[1], private: r.private, description: r.description, default_branch: "main", archived: !!r.archived });

  function commit(r, message, files) {
    const c = { sha: sha(), message, files };
    r.commits.push(c);
    r.runs.unshift({ id: r.runs.length + 1, status: "completed", head_sha: c.sha, branch: "main", pending: pendingPolls,
      jobs: LEGS.map((os, i) => ({ name: `test (${os})`, conclusion: (runConclusions && runConclusions[i]) || "success" })) });
    return c;
  }

  async function fetch(input, init = {}) {
    const url = new URL(String(input));
    const method = String(init.method || "GET").toUpperCase();
    calls.push(`${method} ${url.pathname}`);
    if (url.hostname !== "api.github.com") throw new Error(`fake github: unexpected host ${url.hostname}`);
    const h = init.headers || {};
    if (h.authorization !== `Bearer ${token}`) return err(401, "Bad credentials");
    if (!h["user-agent"]) return err(403, "Request forbidden by administrative rules. Please make sure your request has a User-Agent header");
    const body = init.body ? JSON.parse(init.body) : null;
    const p = url.pathname;
    if (method === "GET" && p === "/user") return json(200, { login });
    if (method === "POST" && p === "/user/repos") {
      const full = `${login}/${body.name}`;
      if (store.has(full)) return err(422, "Repository creation failed.");
      const r = fresh({ private: !!body.private, description: body.description || "" });
      store.set(full, r);
      if (body.auto_init) r.commits.push({ sha: sha(), message: "Initial commit", files: {} });
      return json(201, view(full, r));
    }
    let m = p.match(/^\/repos\/([^/]+\/[^/]+)$/);
    if (m && method === "GET") return store.has(m[1]) ? json(200, view(m[1], store.get(m[1]))) : err(404, "Not Found");

    m = p.match(/^\/repos\/([^/]+\/[^/]+)\/(.*)$/);
    const r = m && store.get(m[1]);
    if (!r) return err(404, "Not Found");
    const rest = m[2];

    if (method === "GET" && rest === "branches/main")
      return r.commits.length ? json(200, { name: "main", commit: { sha: r.commits[r.commits.length - 1].sha } }) : err(404, "Branch not found");

    // Branches other than main: r.branches[name] = [commits], oldest first; pulls are r.pulls.
    r.branches = r.branches || {};
    r.pulls = r.pulls || [];
    const head = (b) => (b === "main" ? r.commits[r.commits.length - 1] : (r.branches[b] || []).slice(-1)[0]);
    const rm = rest.match(/^git\/ref\/heads\/(.+)$/);
    if (rm && method === "GET") { const c = head(rm[1]); return c ? json(200, { ref: `refs/heads/${rm[1]}`, object: { sha: c.sha } }) : err(404, "Not Found"); }
    // Git Data API: blobs, trees, commits and a fast-forward ref update -- the path a multi-file writer commits by.
    r.blobs = r.blobs || {};
    r.trees = r.trees || {};
    if (method === "POST" && rest === "git/blobs") { const s = sha(); r.blobs[s] = body.content; return json(201, { sha: s }); }
    if (method === "POST" && rest === "git/trees") {
      const s = sha();
      r.trees[s] = { base: body.base_tree, entries: body.tree.map((e) => ({ path: e.path, sha: e.sha })) };
      return json(201, { sha: s });
    }
    const gc = rest.match(/^git\/commits\/([0-9a-f]{40})$/);
    if (gc && method === "GET") {
      const c = [...r.commits, ...Object.values(r.branches).flat()].find((x) => x.sha === gc[1]);
      return c ? json(200, { sha: c.sha, tree: { sha: c.tree || `${c.sha.slice(0, 39)}e` }, message: c.message }) : err(404, "Not Found");
    }
    if (method === "POST" && rest === "git/commits") {
      const t = r.trees[body.tree];
      if (!t) return err(422, "Tree SHA does not exist");
      r.pending = r.pending || {};
      const c = { sha: sha(), message: body.message, parents: body.parents, tree: body.tree, files: Object.fromEntries(t.entries.map((e) => [e.path, e.sha])) };
      r.pending[c.sha] = { c, entries: t.entries };
      return json(201, { sha: c.sha });
    }
    if (method === "PATCH" && rest === "git/refs/heads/main") {
      const p = r.pending && r.pending[body.sha];
      if (!p) return err(422, "Object does not exist");
      if (p.c.parents[0] !== head("main").sha) return err(422, "Update is not a fast forward");
      for (const e of p.entries) r.files[e.path] = { sha: e.sha, content: Buffer.from(r.blobs[e.sha], "utf8").toString("base64") };
      p.c.app = p.entries.some((e) => e.path === "package.json");
      r.commits.push(p.c);
      return json(200, { ref: "refs/heads/main", object: { sha: p.c.sha } });
    }
    r.tags = r.tags || {};
    const tm = rest.match(/^git\/ref\/tags\/(.+)$/);
    if (tm && method === "GET") return r.tags[tm[1]] ? json(200, { ref: `refs/tags/${tm[1]}`, object: { sha: r.tags[tm[1]] } }) : err(404, "Not Found");
    if (method === "POST" && rest === "git/refs" && String(body.ref).startsWith("refs/tags/")) {
      const t = String(body.ref).slice("refs/tags/".length);
      if (r.tags[t]) return err(422, "Reference already exists");
      if (!r.commits.some((c) => c.sha === body.sha)) return err(422, "Object does not exist");
      r.tags[t] = body.sha;
      return json(201, { ref: body.ref, object: { sha: body.sha } });
    }
    if (method === "POST" && rest === "git/refs") {
      const b = String(body.ref).replace(/^refs\/heads\//, "");
      if (head(b)) return err(422, "Reference already exists");
      const from = r.commits.find((c) => c.sha === body.sha);
      if (!from) return err(422, "Object does not exist");
      r.branches[b] = [from];
      return json(201, { ref: body.ref, object: { sha: body.sha } });
    }
    const hm = rest.match(/^commits\/([^/]+)$/);
    if (hm && method === "GET") {
      const key = decodeURIComponent(hm[1]);
      const c = head(key) || [...r.commits, ...Object.values(r.branches).flat()].find((x) => x.sha === key);
      return c ? json(200, { sha: c.sha, commit: { message: c.message } }) : err(404, "No commit found");
    }
    if (rest === "pulls" && method === "GET") {
      const h = url.searchParams.get("head");
      const st = url.searchParams.get("state") || "open";
      return json(200, r.pulls.filter((p) => (st === "all" || p.state === st) && (!h || `${login}:${p.head}` === h)));
    }
    const pm = rest.match(/^pulls\/(\d+)$/);
    if (pm && method === "PATCH") {
      const pr = r.pulls.find((p) => String(p.number) === pm[1]);
      if (!pr) return err(404, "Not Found");
      if (pr.merged_at) return err(422, "Cannot reopen a merged pull request");
      Object.assign(pr, body);
      return json(200, pr);
    }
    if (rest === "pulls" && method === "POST") {
      if (!head(body.head)) return err(422, "Validation Failed: head does not exist");
      if (r.pulls.some((p) => p.head === body.head && p.state === "open")) return err(422, "A pull request already exists");
      const pr = { number: r.pulls.length + 1, state: "open", head: body.head, base: body.base, title: body.title, body: body.body, merged_at: null };
      r.pulls.push(pr);
      return json(201, pr);
    }
    // main's tree: every path in r.files plus any in r.extraPaths (files the venture holds that no test wrote).
    if (method === "GET" && rest === "git/trees/main")
      return json(200, { truncated: !!r.truncated, tree: [...Object.keys(r.files), ...(r.extraPaths || [])].map((path) => ({ path, type: "blob" })) });
    const cm = rest.match(/^contents\/(.+)$/);
    if (cm && method === "PUT" && body.branch && body.branch !== "main") {
      if (!r.branches[body.branch]) return err(404, "Branch not found");
      const c = { sha: sha(), message: body.message, files: { [cm[1]]: "blob" } };
      r.branches[body.branch].push(c);
      return json(201, { content: { path: cm[1] }, commit: { sha: c.sha } });
    }
    if (cm) {
      const f = r.files[cm[1]];
      // ?ref=<commit sha>: the path is answered as of that commit -- absent if no commit up to it touched the path.
      const at = url.searchParams.get("ref");
      if (method === "GET" && at && /^[0-9a-f]{40}$/.test(at)) {
        const idx = r.commits.findIndex((c) => c.sha === at);
        if (idx >= 0 && !r.commits.slice(0, idx + 1).some((c) => c.files && c.files[cm[1]])) return err(404, "Not Found");
      }
      if (method === "GET") return f ? json(200, (f.dir ? [{ path: `${cm[1]}/x`, type: "file" }] : f.big ? { type: "file", path: cm[1], sha: f.sha, content: "", encoding: "none" } : { type: "file", path: cm[1], sha: f.sha, content: f.content, encoding: "base64" })) : err(404, "Not Found");
      if (method === "PUT") {
        if (f && body.sha !== f.sha) return err(409, `${cm[1]} does not match ${body.sha}`);
        if (!f && body.sha) return err(422, "sha was supplied for a file that does not exist");
        r.files[cm[1]] = { sha: sha(), content: body.content };
        const c = commit(r, body.message, { [cm[1]]: r.files[cm[1]].sha });
        // What Vercel's fake reads to decide whether this commit's production build is held (ADR-1727).
        if (cm[1] === "vercel.json") c.hold = Buffer.from(body.content, "base64").toString("utf8").includes("ignoreCommand");
        return json(f ? 200 : 201, { content: { path: cm[1], sha: r.files[cm[1]].sha }, commit: { sha: c.sha } });
      }
    }

    // protection: { contexts: [] | null (protected without status checks), strict, reviews }
    if (rest === "branches/main/protection" || rest === "branches/main/protection/required_status_checks") {
      if (planLimit) return err(403, "Upgrade to GitHub Pro or make this repository public to enable this feature.");
      if (method === "PUT" && rest === "branches/main/protection") { r.protection = { contexts: [...body.required_status_checks.contexts], strict: !!body.required_status_checks.strict, reviews: body.required_pull_request_reviews }; return json(200, { url: "protection" }); }
      if (!r.protection) return err(404, "Branch not protected");
      const rsc = r.protection.contexts ? { strict: !!r.protection.strict, contexts: r.protection.contexts } : null;
      if (method === "GET" && rest === "branches/main/protection")
        return json(200, { ...(rsc ? { required_status_checks: rsc } : {}), ...(r.protection.reviews ? { required_pull_request_reviews: r.protection.reviews } : {}) });
      if (!rsc) return err(404, "Required status checks not enabled");
      if (method === "GET") return json(200, rsc);
      if (method === "PATCH") { r.protection.contexts = [...body.contexts]; r.protection.strict = !!body.strict; return json(200, { contexts: r.protection.contexts }); }
    }
    if (method === "POST" && rest === "branches/main/protection/required_status_checks/contexts") {
      if (planLimit) return err(403, "Upgrade to GitHub Pro or make this repository public to enable this feature.");
      if (!r.protection || !r.protection.contexts) return err(404, "Required status checks not enabled");
      for (const c of body.contexts) if (!r.protection.contexts.includes(c)) r.protection.contexts.push(c);
      return json(200, r.protection.contexts);
    }
    // The newest commit on main that touched ?path=, the way the commits list answers it.
    if (method === "GET" && rest === "commits") {
      const path = url.searchParams.get("path");
      const hits = r.commits.filter((c) => !path || (c.files && c.files[path])).reverse();
      return json(200, hits.slice(0, Number(url.searchParams.get("per_page") || 30)).map((c) => ({ sha: c.sha, commit: { message: c.message } })));
    }

    // A run answers the branch and head_sha filters the way GitHub does; `pending` polls show it in progress first.
    if (method === "GET" && rest === "actions/workflows/arc-ci.yml/runs") {
      const branch = url.searchParams.get("branch"), head = url.searchParams.get("head_sha");
      const hits = r.runs.filter((x) => (!branch || (x.branch || "main") === branch) && (!head || x.head_sha === head));
      const shown = hits.slice(0, 1).map(({ jobs, pending, ...run }) => (pending > 0 ? { ...run, status: "in_progress" } : run));
      for (const x of hits.slice(0, 1)) if (x.pending > 0) x.pending--;
      return json(200, { total_count: hits.length, workflow_runs: shown });
    }
    const jm = rest.match(/^actions\/runs\/(\d+)\/jobs$/);
    if (jm && method === "GET") {
      const run = r.runs.find((x) => String(x.id) === jm[1]);
      return run ? json(200, { jobs: run.jobs }) : err(404, "Not Found");
    }
    return err(404, `fake github: ${method} ${p} not modelled`);
  }
  return { fetch, store, calls };
}
