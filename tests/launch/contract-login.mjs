// Contract arms for the login half (ADR-1734), on the whole steel thread: hosting holds, release lifts, frontend lands the
// shell, database makes the project and its RLS probe, then auth, authz and tenancy. The REAL adapters under the REAL
// ctx; only the transport is the in-memory GitHub + Vercel + Supabase + live site + venture app. A fresh ctx per call.
// Prints `RAN <scenario>` first and `DONE <json>` last.
//   node tests/launch/contract-login.mjs <scenario>
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadRegistry, PRODUCT } from "../../.claude/scripts/launch/lib/catalog.mjs";
import { makeCtx } from "../../.claude/scripts/launch/lib/ctx.mjs";
import { makeGithub } from "./fakes/github.mjs";
import { makeVercel } from "./fakes/vercel.mjs";
import { makeLive } from "./fakes/live.mjs";
import { makeSupabase } from "./fakes/supabase.mjs";
import { makeVenture } from "./fakes/venture.mjs";

const scenario = process.argv[2];
console.log(`RAN ${scenario}`);
const rows = loadRegistry();
const load = async (id) => { const row = rows.find((r) => r.id === id); if (!row) { console.error(`no ${id} row`); process.exit(1); } return { row, mod: await import(pathToFileURL(join(PRODUCT, row.adapter)).href) }; };
const A = { hosting: await load("vercel"), release: await load("arc-ship-release"), frontend: await load("nextjs-shell"), database: await load("supabase"), auth: await load("supabase-auth"), authz: await load("rls-roles"), tenancy: await load("org-invite") };
const realTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn) => realTimeout(fn, 0);

const FULL = "technology-ashiq/arc-sandbox";
const DOMAIN = "sandbox.automemory.ai";
const github = makeGithub({ repos: [{ name: "arc-sandbox", description: "x", commits: [{ sha: "a".repeat(40), message: "Initial commit", files: {} }] }] });
const vercel = makeVercel({ github });
const supabase = makeSupabase({ rlsOff: scenario === "rls-off-authz" });
const live = makeLive({ github, full: FULL, domain: DOMAIN, inner: (i, o) => supabase.fetch(i, o).catch(() => vercel.fetch(i, o)) });
const venture = makeVenture({ github, supabase, live, full: FULL, domain: DOMAIN, leakCrossTenant: scenario === "leak" });
// Route by host: Supabase hosts to its fake (through the venture fake for auth admin), the rest down the chain.
globalThis.fetch = async (input, init) => {
  const h = new URL(String(input)).hostname;
  if (h === "api.supabase.com" || (h.endsWith(".supabase.co") && !new URL(String(input)).pathname.startsWith("/auth/"))) return supabase.fetch(input, init);
  return venture.fetch(input, init);
};

const ROOT = mkdtempSync(join(tmpdir(), "launch-login-"));
process.on("exit", () => rmSync(ROOT, { recursive: true, force: true }));
const state = { hosting: [], release: [], frontend: [], database: [], auth: [], authz: [], tenancy: [], repo: [{ kind: "github-repo", id: FULL }], "email-transactional": [] };
const ENV = { VERCEL_TOKEN: "vercel_fixture_token_0123456789", GITHUB_TOKEN: "gho_fixtureToken0123456789", SUPABASE_ACCESS_TOKEN: "sbp_fixture_token_0123456789abcd" };
const UP = { hosting: ["repo"], release: ["hosting"], frontend: ["repo", "release"], database: [], auth: ["database", "email-transactional", "frontend"], authz: ["auth"], tenancy: ["authz"] };
const ctxFor = (slot, approvals = []) => makeCtx({
  profile: { slug: "arc-sandbox", region: "in", brand: { name: "arc sandbox", domain: DOMAIN } }, board: {}, slot: { id: slot }, row: A[slot].row,
  root: ROOT, resources: state[slot], upstream: Object.fromEntries(UP[slot].map((d) => [d, state[d]])), tag: `arc-sandbox@${slot}@${A[slot].row.id}`,
  attempt: 1, signal: undefined, env: ENV, approvals,
  report: (r) => { if (!state[slot].some((x) => x.kind === r.kind && x.id === r.id)) state[slot].push(r); },
});
const attempt = async (fn) => { try { return { ok: true, value: await fn() }; } catch (e) { return { ok: false, code: e.code || null, message: e.message }; } };
const repo = () => github.store.get(FULL);
const text = (path) => (repo().files[path] ? Buffer.from(repo().files[path].content, "base64").toString("utf8") : null);

await A.hosting.mod.scaffold(ctxFor("hosting"));
await A.release.mod.scaffold(ctxFor("release", ["deploy-prod-first"]));
await A.frontend.mod.scaffold(ctxFor("frontend"));
await A.database.mod.scaffold(ctxFor("database"));
const out = { scenario };
switch (scenario) {
  case "thread": {
    out.authBefore = await A.auth.mod.verify(ctxFor("auth"));
    out.auth = await attempt(() => A.auth.mod.scaffold(ctxFor("auth")));
    out.authAgain = await attempt(() => A.auth.mod.scaffold(ctxFor("auth")));
    out.siteUrl = supabase.store[0].auth && supabase.store[0].auth.site_url;
    out.env = text(".env.example");
    out.authVerify = await A.auth.mod.verify(ctxFor("auth"));
    out.authz = await attempt(() => A.authz.mod.scaffold(ctxFor("authz")));
    out.authzVerify = await A.authz.mod.verify(ctxFor("authz"));
    out.authzVerifyAgain = await A.authz.mod.verify(ctxFor("authz"));
    out.orgs = supabase.store[0].tables.orgs.rows.length;
    out.tenancy = await attempt(() => A.tenancy.mod.scaffold(ctxFor("tenancy")));
    out.tenancyVerify = await A.tenancy.mod.verify(ctxFor("tenancy"));
    out.commits = ["auth:", "authz:", "tenancy:"].map((p) => repo().commits.filter((c) => (c.message || "").startsWith(p)).length);
    out.kinds = { auth: state.auth.map((r) => r.kind), authz: state.authz.map((r) => r.kind), tenancy: state.tenancy.map((r) => r.kind) };
    out.teardown = (await A.authz.mod.teardown(ctxFor("authz"))).steps.map((s) => s.action);
    break;
  }
  case "leak":
  case "rls-off-authz":
    await A.auth.mod.scaffold(ctxFor("auth"));
    out.authz = await attempt(() => A.authz.mod.scaffold(ctxFor("authz")));
    out.authzVerify = await A.authz.mod.verify(ctxFor("authz"));
    break;
  case "site-url-foreign":
    supabase.store[0].auth = { site_url: "https://someone-else.example.com" };
    out.auth = await attempt(() => A.auth.mod.scaffold(ctxFor("auth")));
    out.routes = !!repo().files["app/api/me/route.js"];
    break;
  case "owner-orgs-table":
    supabase.store[0].tables.orgs = { rls: false, rows: [{ id: "x", name: "real customer" }] };
    await A.auth.mod.scaffold(ctxFor("auth"));
    out.authz = await attempt(() => A.authz.mod.scaffold(ctxFor("authz")));
    out.rls = supabase.store[0].tables.orgs.rls;
    break;
  case "owner-env":
    // The owner's .env.example with their own names: auth adds its two, keeps every line, writes no value.
    repo().files[".env.example"] = { sha: "e".repeat(40), content: Buffer.from("# mine\nSTRIPE_KEY=\n").toString("base64") };
    repo().commits.push({ sha: "e".repeat(40), message: "owner env", files: { ".env.example": "e".repeat(40) } });
    out.auth = await attempt(() => A.auth.mod.scaffold(ctxFor("auth")));
    out.env = text(".env.example");
    break;
  case "owner-auth-config": {
    // The owner's redirect URL and own magic-link template that already lands on /auth/confirm: both kept.
    const mine = "<p>Hello! <a href=\"{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink\">sign in</a></p>";
    supabase.store[0].auth = { site_url: "http://localhost:3000", uri_allow_list: "https://staging.example.com/**", mailer_templates_magic_link_content: mine };
    out.auth = await attempt(() => A.auth.mod.scaffold(ctxFor("auth")));
    out.allow = supabase.store[0].auth.uri_allow_list;
    out.kept = supabase.store[0].auth.mailer_templates_magic_link_content === mine;
    break;
  }
  case "owner-template-elsewhere":
    supabase.store[0].auth = { site_url: "http://localhost:3000", mailer_templates_magic_link_content: "<p>{{ .Token }}</p>" };
    out.auth = await attempt(() => A.auth.mod.scaffold(ctxFor("auth")));
    break;
  case "found-project": {
    // database only found the project: the login half refuses to touch it.
    const i = state.database.findIndex((r) => r.kind === "supabase-project");
    state.database[i] = { kind: "supabase-project-found", id: state.database[i].id };
    out.auth = await attempt(() => A.auth.mod.scaffold(ctxFor("auth")));
    break;
  }
  case "killed-after-migration":
    // The authz migration ran and the worker died before reporting the tables: the re-run recognises its marker.
    await A.auth.mod.scaffold(ctxFor("auth"));
    await A.authz.mod.scaffold(ctxFor("authz"));
    state.authz.splice(state.authz.findIndex((r) => r.kind === "db-tables"), 1);
    out.authz = await attempt(() => A.authz.mod.scaffold(ctxFor("authz")));
    break;
  case "tenancy-before-authz-verify":
    await A.auth.mod.scaffold(ctxFor("auth"));
    await A.authz.mod.scaffold(ctxFor("authz"));
    await A.tenancy.mod.scaffold(ctxFor("tenancy"));
    out.tenancyVerify = await A.tenancy.mod.verify(ctxFor("tenancy"));
    break;
  default:
    console.error(`unknown scenario ${scenario}`);
    process.exit(1);
}
console.log(`DONE ${JSON.stringify(out)}`);
