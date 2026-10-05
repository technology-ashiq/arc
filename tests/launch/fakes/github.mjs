// In-memory GitHub: one token -> one login; repos with a main branch, files (Contents API), branch protection and
// Actions runs. It replaces only the transport (globalThis.fetch). Deterministic: every sha comes from a counter.
//   runConclusions  what each of the three legs concludes when a commit lands on main (all success unless set)
//   planLimit       branch protection answers 403 the way GitHub Free does for a private repo
export const LEGS = ["ubuntu-latest", "windows-latest", "macos-latest"];

export function makeGithub({ login = "technology-ashiq", token = "gho_fixtureToken0123456789", repos = [], runConclusions = null, planLimit = false } = {}) {
  const fresh = (r) => ({ private: true, description: "", files: {}, runs: [], protection: null, commits: [], ...r });
  const store = new Map(repos.map((r) => [`${r.owner || login}/${r.name}`, fresh(r)]));
  const calls = [];
  let n = 0;
  const sha = () => (++n).toString(16).padStart(40, "0");
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const err = (status, message) => json(status, { message, documentation_url: "https://docs.github.com" });
  const view = (full, r) => ({ full_name: full, name: full.split("/")[1], private: r.private, description: r.description, default_branch: "main" });

  function commit(r, message, files) {
    const c = { sha: sha(), message, files };
    r.commits.push(c);
    r.runs.unshift({ id: r.runs.length + 1, status: "completed", head_sha: c.sha,
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

    const cm = rest.match(/^contents\/(.+)$/);
    if (cm) {
      const f = r.files[cm[1]];
      if (method === "GET") return f ? json(200, { path: cm[1], sha: f.sha, content: f.content, encoding: "base64" }) : err(404, "Not Found");
      if (method === "PUT") {
        if (f && body.sha !== f.sha) return err(409, `${cm[1]} does not match ${body.sha}`);
        if (!f && body.sha) return err(422, "sha was supplied for a file that does not exist");
        r.files[cm[1]] = { sha: sha(), content: body.content };
        const c = commit(r, body.message, { [cm[1]]: r.files[cm[1]].sha });
        return json(f ? 200 : 201, { content: { path: cm[1], sha: r.files[cm[1]].sha }, commit: { sha: c.sha } });
      }
    }

    if (rest === "branches/main/protection" || rest === "branches/main/protection/required_status_checks") {
      if (planLimit) return err(403, "Upgrade to GitHub Pro or make this repository public to enable this feature.");
      if (method === "PUT" && rest === "branches/main/protection") { r.protection = { contexts: [...body.required_status_checks.contexts] }; return json(200, { url: "protection" }); }
      if (method === "GET" && rest.endsWith("required_status_checks"))
        return r.protection ? json(200, { contexts: r.protection.contexts }) : err(404, "Branch not protected");
    }

    if (method === "GET" && rest === "actions/workflows/arc-ci.yml/runs")
      return json(200, { total_count: r.runs.length, workflow_runs: r.runs.slice(0, 1).map(({ jobs, ...run }) => run) });
    const jm = rest.match(/^actions\/runs\/(\d+)\/jobs$/);
    if (jm && method === "GET") {
      const run = r.runs.find((x) => String(x.id) === jm[1]);
      return run ? json(200, { jobs: run.jobs }) : err(404, "Not Found");
    }
    return err(404, `fake github: ${method} ${p} not modelled`);
  }
  return { fetch, store, calls };
}
