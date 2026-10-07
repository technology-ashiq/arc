// The live venture app plus Supabase Auth's admin API, for the login half (ADR-1734). Every route answers only when its
// file is on main in the GitHub fake, the site is serving (hold lifted, app present, via `live`), and the tables its
// queries need exist in the Supabase fake -- so a test cannot pass by asserting the app into being. Sessions are
// cookies a probe must carry back exactly as a browser does. Other hosts, and the site while it is not serving, go to `live`.
//   siteUrlNeeded   /auth/confirm works only once the project's site_url is the venture's (the auth slot sets it)
//   leakCrossTenant the orgs read ignores membership -- a broken RLS -- so authz must fail
export function makeVenture({ github, supabase, live, full, domain, siteUrlNeeded = true, leakCrossTenant = false } = {}) {
  const inner = live.fetch;
  const users = new Map(); // email -> { id, email }
  const links = new Map(); // hash -> email
  const sessions = new Map(); // token -> user id
  let n = 0;
  const id = (p) => `${p}${String(++n).padStart(12, "0")}`;
  const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
  const json = (s, body, headers = []) => new Response(JSON.stringify(body), { status: s, headers: [["content-type", "application/json"], ...headers] });
  const project = () => supabase.store[0];
  const cookieName = () => `sb-${project().id}-auth-token`;
  const onMain = (path) => !!github.store.get(full).files[path];
  const tables = () => project().tables;

  function sessionUser(req) {
    const c = String((req.headers || {}).cookie || "");
    const m = c.split(";").map((s) => s.trim()).find((s) => s.startsWith(`${cookieName()}=`));
    const tok = m ? m.slice(cookieName().length + 1) : "";
    const uid = sessions.get(tok);
    return uid ? [...users.values()].find((u) => u.id === uid) : null;
  }
  const member = (org, uid) => (tables().memberships ? tables().memberships.rows : []).some((r) => r.org === org && r.user === uid);
  const owner = (org, uid) => (tables().memberships ? tables().memberships.rows : []).some((r) => r.org === org && r.user === uid && r.role === "owner");

  async function fetch(input, init = {}) {
    const url = new URL(String(input));
    const method = String(init.method || "GET").toUpperCase();
    const body = init.body ? JSON.parse(init.body) : {};
    const p = project();

    // Supabase Auth admin, with the project's service key.
    if (p && url.hostname === `${p.id}.supabase.co` && url.pathname.startsWith("/auth/v1/admin/")) {
      if ((init.headers || {}).apikey !== `service-key-${p.id}`) return json(401, { msg: "Invalid API key" });
      if (method === "POST" && url.pathname === "/auth/v1/admin/users") {
        if (users.has(body.email)) return json(422, { msg: "A user with this email address has already been registered" });
        users.set(body.email, { id: uuid(), email: body.email });
        return json(200, users.get(body.email));
      }
      if (method === "POST" && url.pathname === "/auth/v1/admin/generate_link") {
        if (!users.has(body.email)) return json(404, { msg: "User not found" });
        const hash = id("pkce_");
        links.set(hash, body.email);
        return json(200, { properties: { hashed_token: hash, verification_type: "magiclink" } });
      }
      return json(404, { msg: "not modelled" });
    }

    if (url.hostname !== domain || !live.serving()) return inner(input, init);
    const served = (path) => onMain(path) || null;
    const route = url.pathname;
    if (route === "/auth/confirm" && served("app/auth/confirm/route.js")) {
      if (siteUrlNeeded && (!p.auth || p.auth.site_url !== `https://${domain}`)) return json(401, { error: "link expired or used" });
      const email = links.get(url.searchParams.get("token_hash"));
      if (!email || url.searchParams.get("type") !== "magiclink") return json(401, { error: "link expired or used" });
      links.delete(url.searchParams.get("token_hash"));
      const tok = id("sess_");
      sessions.set(tok, users.get(email).id);
      return new Response(null, { status: 303, headers: [["location", `https://${domain}/`], ["set-cookie", `${cookieName()}=${tok}; Path=/; HttpOnly; Secure; SameSite=Lax`]] });
    }
    const who = sessionUser(init);
    if (route === "/api/me" && served("app/api/me/route.js")) return who ? json(200, { id: who.id, email: who.email }) : json(401, { error: "not signed in" });
    if (route === "/api/logout" && method === "POST" && served("app/api/logout/route.js")) {
      for (const [k, v] of sessions) if (who && v === who.id) sessions.delete(k);
      return json(200, { ok: true }, [["set-cookie", `${cookieName()}=; Path=/; Max-Age=0`]]);
    }
    if (route === "/api/orgs" && served("app/api/orgs/route.js") && tables().orgs) {
      if (!who) return json(401, { error: "not signed in" });
      if (method === "GET") return json(200, { orgs: tables().orgs.rows.filter((o) => leakCrossTenant || member(o.id, who.id)).map((o) => ({ id: o.id, name: o.name })) });
      if (method === "POST") {
        const org = { id: uuid(), name: String(body.name || "").trim() };
        tables().orgs.rows.push(org);
        tables().memberships.rows.push({ org: org.id, user: who.id, role: "owner" });
        return json(201, { id: org.id });
      }
    }
    const om = route.match(/^\/api\/orgs\/([0-9a-f-]{36})$/);
    if (om && served("app/api/orgs/[id]/route.js") && tables().orgs) {
      if (!who) return json(401, { error: "not signed in" });
      const o = tables().orgs.rows.find((x) => x.id === om[1] && (leakCrossTenant || member(x.id, who.id)));
      return o ? json(200, { id: o.id, name: o.name }) : json(403, { error: "not a member of this org" });
    }
    if (route === "/api/invites" && method === "POST" && served("app/api/invites/route.js") && tables().invites) {
      if (!who) return json(401, { error: "not signed in" });
      if (!owner(body.org_id, who.id)) return json(403, { error: "not an owner of this org" });
      const token = `${"0".repeat(36)}${String(++n).padStart(12, "0")}`;
      tables().invites.rows.push({ token, org: body.org_id, email: String(body.email).toLowerCase(), accepted: false });
      return json(201, { token });
    }
    if (route === "/api/invites/accept" && method === "POST" && served("app/api/invites/accept/route.js") && tables().invites) {
      if (!who) return json(401, { error: "not signed in" });
      const inv = tables().invites.rows.find((x) => x.token === body.token && !x.accepted);
      if (!inv || inv.email !== who.email.toLowerCase()) return json(403, { error: "this invite cannot be accepted by you" });
      if (!member(inv.org, who.id)) tables().memberships.rows.push({ org: inv.org, user: who.id, role: "member" });
      inv.accepted = true;
      return json(200, { org_id: inv.org });
    }
    return inner(input, init);
  }
  return { fetch, users, sessions };
}
