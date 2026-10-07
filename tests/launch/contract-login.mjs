// Contract arms for the login half (ADR-1734), on the whole steel thread: hosting holds, release lifts, frontend lands the
// shell, database makes the project and its RLS probe, then auth, authz and tenancy. The REAL adapters under the REAL
// ctx; only the transport is the in-memory GitHub + Vercel + Supabase + live site + venture app (+ Razorpay for
// checkout-portal, ADR-1738). A fresh ctx per call. Prints `RAN <scenario>` first and `DONE <json>` last.
//   node tests/launch/contract-login.mjs <scenario>
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadRegistry, loadProfile, PRODUCT, PATHS, ROOT as ARC } from "../../.claude/scripts/launch/lib/catalog.mjs";
import { makeCtx } from "../../.claude/scripts/launch/lib/ctx.mjs";
import { emptyState, saveState } from "../../.claude/scripts/launch/lib/state.mjs";
import { makeGithub } from "./fakes/github.mjs";
import { makeVercel } from "./fakes/vercel.mjs";
import { makeLive } from "./fakes/live.mjs";
import { makeSupabase } from "./fakes/supabase.mjs";
import { makeVenture } from "./fakes/venture.mjs";
import { makeRazorpay } from "./fakes/razorpay.mjs";

const scenario = process.argv[2];
console.log(`RAN ${scenario}`);
const rows = loadRegistry();
const load = async (id) => { const row = rows.find((r) => r.id === id); if (!row) { console.error(`no ${id} row`); process.exit(1); } return { row, mod: await import(pathToFileURL(join(PRODUCT, row.adapter)).href) }; };
const A = { hosting: await load("vercel"), release: await load("arc-ship-release"), frontend: await load("nextjs-shell"), database: await load("supabase"), auth: await load("supabase-auth"), authz: await load("rls-roles"), tenancy: await load("org-invite"), plans: await load("plans-yaml"), "checkout-portal": await load("razorpay-checkout") };
const realTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn) => realTimeout(fn, 0);

const FULL = "technology-ashiq/arc-sandbox";
const DOMAIN = "sandbox.automemory.ai";
const CO = "checkout-portal";
// The slot's test keys (the fake Razorpay's account), and a second test account a venture could be deployed with.
const RZ_ID = "rzp_test_Fixture0123456";
const RZ_SECRET = "fixtureSecret0123456789ab"; // gitleaks:allow -- a fake Razorpay test secret for the fake API
const OTHER_ID = "rzp_test_Another0123456";
const OTHER_SECRET = "anotherSecret0123456789ab";
const serverEnv = {
  "checkout-live-server": { RAZORPAY_KEY_ID: "rzp_live_Fixture0123456", RAZORPAY_KEY_SECRET: RZ_SECRET },
  "checkout-key-mismatch": { RAZORPAY_KEY_ID: OTHER_ID, RAZORPAY_KEY_SECRET: OTHER_SECRET },
}[scenario] || { RAZORPAY_KEY_ID: RZ_ID, RAZORPAY_KEY_SECRET: RZ_SECRET };
// A live build that is not main's head: each changes one thing the order carries.
const deployed = {
  "checkout-amount": (p, t) => (p === "lib/prices.js" ? t.replace("amount: 49900", "amount: 100") : t),
  "checkout-currency": (p, t) => (p === "lib/prices.js" ? t.replace("currency: \"INR\"", "currency: \"USD\"") : t),
  "checkout-org": (p, t) => (p === "app/api/checkout/route.js" ? t.replace("org_id: org,", "org_id: \"00000000-0000-4000-8000-999999999999\",") : t),
}[scenario];
const github = makeGithub({ repos: [{ name: "arc-sandbox", description: "x", commits: [{ sha: "a".repeat(40), message: "Initial commit", files: {} }] }] });
const vercel = makeVercel({ github });
const supabase = makeSupabase({ rlsOff: scenario === "rls-off-authz" });
const live = makeLive({ github, full: FULL, domain: DOMAIN, inner: (i, o) => supabase.fetch(i, o).catch(() => vercel.fetch(i, o)) });
const venture = makeVenture({ github, supabase, live, full: FULL, domain: DOMAIN, leakCrossTenant: scenario === "leak", ignorePlan: scenario === "plans-ignored", reportsFail: scenario === "plans-reports-fail", serverEnv, ...(deployed ? { deployed } : {}) });
const rz = makeRazorpay({ keyId: RZ_ID, keySecret: RZ_SECRET, alsoAccept: [[OTHER_ID, OTHER_SECRET]] });
// Route by host: Supabase hosts to its fake (through the venture fake for auth admin), Razorpay to its fake, the rest down the chain.
globalThis.fetch = async (input, init) => {
  const h = new URL(String(input)).hostname;
  if (h === "api.supabase.com" || (h.endsWith(".supabase.co") && !new URL(String(input)).pathname.startsWith("/auth/"))) return supabase.fetch(input, init);
  if (h === "api.razorpay.com") return rz.fetch(input, init);
  return venture.fetch(input, init);
};

const ROOT = mkdtempSync(join(tmpdir(), "launch-login-"));
process.on("exit", () => rmSync(ROOT, { recursive: true, force: true }));
const state = { hosting: [], release: [], frontend: [], database: [], auth: [], authz: [], tenancy: [], plans: [], [CO]: [], "payment-test": [], repo: [{ kind: "github-repo", id: FULL }], "email-transactional": [] };
const ENV = { VERCEL_TOKEN: "vercel_fixture_token_0123456789", GITHUB_TOKEN: "gho_fixtureToken0123456789", SUPABASE_ACCESS_TOKEN: "sbp_fixture_token_0123456789abcd", RAZORPAY_KEY_ID: RZ_ID, RAZORPAY_KEY_SECRET: RZ_SECRET };
const UP = { hosting: ["repo"], release: ["hosting"], frontend: ["repo", "release"], database: [], auth: ["database", "email-transactional", "frontend"], authz: ["auth"], tenancy: ["authz"], plans: ["authz"], [CO]: ["plans", "payment-test"] };
const ctxFor = (slot, approvals = [], { env = ENV, domain = DOMAIN } = {}) => makeCtx({
  profile: { slug: "arc-sandbox", region: "in", brand: { name: "arc sandbox", domain } }, board: {}, slot: { id: slot }, row: A[slot].row,
  root: ROOT, resources: state[slot], upstream: Object.fromEntries(UP[slot].map((d) => [d, state[d]])), tag: `arc-sandbox@${slot}@${A[slot].row.id}`,
  attempt: 1, signal: undefined, env, approvals,
  report: (r) => { if (!state[slot].some((x) => x.kind === r.kind && x.id === r.id)) state[slot].push(r); },
});
const attempt = async (fn) => { try { return { ok: true, value: await fn() }; } catch (e) { return { ok: false, code: e.code || null, message: e.message }; } };
const repo = () => github.store.get(FULL);
const text = (path) => (repo().files[path] ? Buffer.from(repo().files[path].content, "base64").toString("utf8") : null);
const creates = () => rz.calls.filter((c) => c === "POST /v1/orders").length;
const commitsOf = (prefix) => repo().commits.filter((c) => (c.message || "").startsWith(prefix)).length;
const orgId = (name) => (supabase.store[0].tables.orgs.rows.find((o) => o.name === name) || {}).id;
// The login half up to plans, with authz verified so both probe orgs exist: what checkout-portal stands on.
const toCheckout = async () => {
  await A.auth.mod.scaffold(ctxFor("auth"));
  await A.authz.mod.scaffold(ctxFor("authz"));
  await A.authz.mod.verify(ctxFor("authz"));
  await A.plans.mod.scaffold(ctxFor("plans"));
};
// A browser session for a probe user, minted the way the probes mint it: admin link, then /auth/confirm on the live app.
const browser = async (who) => {
  const p = supabase.store[0];
  const key = `service-key-${p.id}`;
  const email = `launch-probe-${who}@${DOMAIN}`;
  const adm = (path, body) => fetch(`https://${p.id}.supabase.co/auth/v1/admin${path}`, { method: "POST", headers: Object.fromEntries([["apikey", key], ["authorization", `Bearer ${key}`], ["content-type", "application/json"]]), body: JSON.stringify(body) });
  await adm("/users", { email, email_confirm: true });
  const hash = (await (await adm("/generate_link", { type: "magiclink", email })).json()).properties.hashed_token;
  const r = await fetch(`https://${DOMAIN}/auth/confirm?token_hash=${encodeURIComponent(hash)}&type=magiclink`, { redirect: "manual" });
  return String(r.headers.get("set-cookie") || "").split(";")[0];
};
const checkout = async (cookie, org) => {
  const r = await fetch(`https://${DOMAIN}/api/checkout`, { method: "POST", headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify({ org }) });
  let body = null;
  try { body = await r.json(); } catch { body = null; }
  return { status: r.status, body };
};

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
    out.authTeardown = (await A.auth.mod.teardown(ctxFor("auth"))).steps.map((s) => s.action);
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
  case "owner-template-confirmation-url":
    // An owner template that uses Supabase's own {{ .ConfirmationURL }}: theirs, and it does not land on /auth/confirm.
    supabase.store[0].auth = { site_url: "http://localhost:3000", mailer_templates_magic_link_content: "<h1>Welcome to us</h1><a href=\"{{ .ConfirmationURL }}\">go</a>" };
    out.auth = await attempt(() => A.auth.mod.scaffold(ctxFor("auth")));
    break;
  case "long-env":
    // A .env.example long enough that its base64 spans several 60-character lines (and holds lowercase s).
    repo().files[".env.example"] = { sha: "e".repeat(40), content: Buffer.from(`# mine, kept as is\n${Array.from({ length: 12 }, (_, i) => `SERVICE_SECRET_NAME_${i}=`).join("\n")}\n`).toString("base64") };
    repo().commits.push({ sha: "e".repeat(40), message: "owner env", files: { ".env.example": "e".repeat(40) } });
    out.auth = await attempt(() => A.auth.mod.scaffold(ctxFor("auth")));
    out.env = text(".env.example");
    break;
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
  case "plans": {
    // The whole login half, then plans: scaffold twice, verify pro -> 200 and downgraded -> 403, twice.
    await A.auth.mod.scaffold(ctxFor("auth"));
    await A.authz.mod.scaffold(ctxFor("authz"));
    out.before = await A.plans.mod.verify(ctxFor("plans"));
    out.plans = await attempt(() => A.plans.mod.scaffold(ctxFor("plans")));
    out.plansAgain = await attempt(() => A.plans.mod.scaffold(ctxFor("plans")));
    out.commits = repo().commits.filter((c) => (c.message || "").startsWith("plans:")).length;
    out.files = ["plans.yaml", "lib/plans.js", "app/api/reports/route.js"].map((p) => !!text(p));
    out.rls = supabase.store[0].tables.org_plans.rls;
    out.verify = await A.plans.mod.verify(ctxFor("plans"));
    out.verifyAgain = await A.plans.mod.verify(ctxFor("plans"));
    out.finalPlans = supabase.store[0].tables.org_plans.rows.map((r) => r.plan);
    out.kinds = state.plans.map((r) => r.kind);
    out.teardown = (await A.plans.mod.teardown(ctxFor("plans"))).steps.map((x) => x.action);
    break;
  }
  case "plans-ignored":
    // A route that ignores the plan: the downgrade does not close it, so verify is not ok.
    await A.auth.mod.scaffold(ctxFor("auth"));
    await A.authz.mod.scaffold(ctxFor("authz"));
    await A.plans.mod.scaffold(ctxFor("plans"));
    out.verify = await A.plans.mod.verify(ctxFor("plans"));
    break;
  case "plans-foreign-table":
    // The owner's org_plans, without launch's marker: never altered.
    await A.auth.mod.scaffold(ctxFor("auth"));
    await A.authz.mod.scaffold(ctxFor("authz"));
    supabase.store[0].tables.org_plans = { rls: false, rows: [{ org: "x", plan: "enterprise" }] };
    out.plans = await attempt(() => A.plans.mod.scaffold(ctxFor("plans")));
    out.rows = supabase.store[0].tables.org_plans.rows.map((r) => r.plan);
    break;
  case "plans-killed-after-migration":
    // The migration ran and the worker died before reporting the table: the re-run recognises its marker.
    await A.auth.mod.scaffold(ctxFor("auth"));
    await A.authz.mod.scaffold(ctxFor("authz"));
    await A.plans.mod.scaffold(ctxFor("plans"));
    state.plans.splice(state.plans.findIndex((r) => r.kind === "db-tables"), 1);
    out.plans = await attempt(() => A.plans.mod.scaffold(ctxFor("plans")));
    break;
  case "plans-owner-edited":
    // The owner rewrote the gated route after launch: verify names the drift and changes no plan.
    await A.auth.mod.scaffold(ctxFor("auth"));
    await A.authz.mod.scaffold(ctxFor("authz"));
    await A.plans.mod.scaffold(ctxFor("plans"));
    repo().files["app/api/reports/route.js"] = { sha: "f".repeat(40), content: Buffer.from("export async function GET() { return Response.json({}); }" + String.fromCharCode(10)).toString("base64") };
    repo().commits.push({ sha: "f".repeat(40), message: "owner rewrote reports", files: { "app/api/reports/route.js": "f".repeat(40) } });
    out.verify = await A.plans.mod.verify(ctxFor("plans"));
    out.planRows = supabase.store[0].tables.org_plans.rows.length;
    break;
  case "plans-reports-fail":
    // The pro read answers 500: verify is not ok, and the probe org is back on free.
    await A.auth.mod.scaffold(ctxFor("auth"));
    await A.authz.mod.scaffold(ctxFor("authz"));
    await A.plans.mod.scaffold(ctxFor("plans"));
    out.verify = await A.plans.mod.verify(ctxFor("plans"));
    out.finalPlans = supabase.store[0].tables.org_plans.rows.map((r) => r.plan);
    break;
  case "replaced-tables": {
    // launch recorded its tables; the owner then replaced them with their own, unmarked. A re-run never adopts them.
    await A.auth.mod.scaffold(ctxFor("auth"));
    await A.authz.mod.scaffold(ctxFor("authz"));
    await A.plans.mod.scaffold(ctxFor("plans"));
    supabase.store[0].tables.org_plans = { rls: false, rows: [{ org: "x", plan: "enterprise" }] };
    out.plans = await attempt(() => A.plans.mod.scaffold(ctxFor("plans")));
    out.planRls = supabase.store[0].tables.org_plans.rls;
    supabase.store[0].tables.orgs = { rls: false, rows: [{ id: "y", name: "real customer" }] };
    out.authz = await attempt(() => A.authz.mod.scaffold(ctxFor("authz")));
    out.orgRls = supabase.store[0].tables.orgs.rls;
    break;
  }
  case "plans-no-upstream":
    out.plans = await attempt(() => A.plans.mod.scaffold(ctxFor("plans")));
    break;
  case "checkout": {
    // checkout-portal on the login half and plans: scaffold twice (one commit, no Razorpay call), then verify twice.
    await toCheckout();
    out.before = await A[CO].mod.verify(ctxFor(CO));
    const n0 = rz.calls.length;
    out.first = await attempt(() => A[CO].mod.scaffold(ctxFor(CO)));
    out.second = await attempt(() => A[CO].mod.scaffold(ctxFor(CO)));
    out.scaffoldCalls = rz.calls.length - n0;
    out.commits = commitsOf("checkout-portal:");
    out.files = ["lib/prices.js", "app/api/checkout/route.js", "app/checkout/page.js"].map((p) => !!text(p));
    out.env = text(".env.example");
    out.envIds = out.env.split("\n").filter((l) => l === "RAZORPAY_KEY_ID=").length;
    out.verify = await A[CO].mod.verify(ctxFor(CO));
    const o = rz.store[rz.store.length - 1] || {};
    const probeOrg = orgId("launch-probe-a");
    out.order = { id: o.id, amount: o.amount, currency: o.currency, forProbeOrg: !!probeOrg && (o.notes || {}).org_id === probeOrg, plan: (o.notes || {}).plan, receipt: o.receipt === `org-${String(probeOrg)}` };
    out.verifyAgain = await A[CO].mod.verify(ctxFor(CO));
    out.creates = creates();
    out.kinds = state[CO].map((r) => r.kind);
    out.teardown = (await A[CO].mod.teardown(ctxFor(CO))).steps.map((x) => x.action);
    break;
  }
  case "checkout-refusals": {
    // The committed route itself, asked as a browser: signed out, a non-uuid org, another tenant's org, then the member.
    await toCheckout();
    await A[CO].mod.scaffold(ctxFor(CO));
    const a = await browser("a");
    const mine = orgId("launch-probe-a");
    const theirs = orgId("launch-probe-b");
    out.orgs = [mine, theirs].filter((x) => typeof x === "string").length;
    out.cookie = a.startsWith("sb-");
    const n0 = creates();
    out.signedOut = (await checkout("", mine)).status;
    out.notUuid = (await checkout(a, "not-a-uuid")).status;
    out.notMember = (await checkout(a, theirs)).status;
    out.refusedCreates = creates() - n0;
    const ok = await checkout(a, mine);
    out.member = { status: ok.status, test: String(ok.body && ok.body.key_id).startsWith("rzp_test_"), slotKey: !!ok.body && ok.body.key_id === ENV.RAZORPAY_KEY_ID, amount: ok.body && ok.body.amount, currency: ok.body && ok.body.currency, leaksSecret: JSON.stringify(ok.body).includes(RZ_SECRET) };
    out.creates = creates() - n0;
    break;
  }
  case "checkout-live-server": {
    // The slot's own live key refuses before any call; a live key in the venture's server env answers 503, no order.
    await toCheckout();
    const c0 = repo().commits.length;
    out.slotLive = await attempt(() => A[CO].mod.scaffold(ctxFor(CO, [], { env: { ...ENV, RAZORPAY_KEY_ID: "rzp_live_Fixture0123456" } })));
    out.slotLiveCommits = repo().commits.length - c0;
    out.slotLiveCalls = rz.calls.length;
    out.slotLiveVerify = await A[CO].mod.verify(ctxFor(CO, [], { env: { ...ENV, RAZORPAY_KEY_ID: "rzp_live_Fixture0123456" } }));
    await A[CO].mod.scaffold(ctxFor(CO));
    out.verify = await A[CO].mod.verify(ctxFor(CO));
    out.creates = creates();
    break;
  }
  case "checkout-key-mismatch":
    // The venture runs another test account's keys: the route answers 201, and verify refuses the key id it gave.
    await toCheckout();
    await A[CO].mod.scaffold(ctxFor(CO));
    out.verify = await A[CO].mod.verify(ctxFor(CO));
    out.creates = creates();
    break;
  case "checkout-amount":
  case "checkout-currency":
  case "checkout-org":
    // The live build differs from main's head in what the order carries: verify reads Razorpay's order and refuses.
    await toCheckout();
    await A[CO].mod.scaffold(ctxFor(CO));
    out.verify = await A[CO].mod.verify(ctxFor(CO));
    out.creates = creates();
    break;
  case "checkout-owner-prices":
    // The owner edits lib/prices.js after launch: verify names the drift before any order, and a re-run never commits over it.
    await toCheckout();
    await A[CO].mod.scaffold(ctxFor(CO));
    repo().files["lib/prices.js"] = { sha: "f".repeat(40), content: Buffer.from("export const PRICES = { pro: { amount: 99900, currency: \"INR\" } };" + String.fromCharCode(10)).toString("base64") };
    repo().commits.push({ sha: "f".repeat(40), message: "owner repriced pro", files: { "lib/prices.js": "f".repeat(40) } });
    out.verify = await A[CO].mod.verify(ctxFor(CO));
    out.creates = creates();
    out.again = await attempt(() => A[CO].mod.scaffold(ctxFor(CO)));
    break;
  case "checkout-host": {
    // A venture domain outside the row's hosts[]: ctx.fetch refuses it, so verify answers not ok and no order is made.
    await toCheckout();
    await A[CO].mod.scaffold(ctxFor(CO));
    out.verify = await A[CO].mod.verify(ctxFor(CO, [], { domain: "evil.example.com" }));
    out.creates = creates();
    break;
  }
  case "checkout-no-upstream":
    out.scaffold = await attempt(() => A[CO].mod.scaffold(ctxFor(CO)));
    break;
  case "checkout-env-missing": {
    // The REAL worker, as the runner spawns it, with RAZORPAY_KEY_ID absent from its environment: the slot fails by name
    // before the adapter is called, and nothing is committed.
    const dir = mkdtempSync(join(tmpdir(), "launch-worker-"));
    try {
      const stateDir = join(dir, "state");
      saveState(stateDir, emptyState(loadProfile("arc-sandbox")));
      const row = A[CO].row;
      const args = { catalog: PATHS.catalog, registry: PATHS.registry, providersDir: PATHS.providersDir, venturesDir: PATHS.venturesDir, stateDir,
        venture: "arc-sandbox", slot: CO, provider: row.id, row, adapterPath: join(PRODUCT, row.adapter), ventureRoot: ROOT, attempt: 1, timeout: 60 };
      writeFileSync(join(dir, "args.json"), JSON.stringify(args));
      const OS = new Set(["PATH", "Path", "SYSTEMROOT", "SystemRoot", "TEMP", "TMP", "HOME", "USERPROFILE", "WINDIR", "windir"]);
      const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => OS.has(k)));
      Object.assign(env, { RAZORPAY_KEY_SECRET: RZ_SECRET, SUPABASE_ACCESS_TOKEN: ENV.SUPABASE_ACCESS_TOKEN, GITHUB_TOKEN: ENV.GITHUB_TOKEN });
      const r = spawnSync(process.execPath, [join(ARC, ".claude", "scripts", "launch", "lib", "worker.mjs"), join(dir, "args.json")], { env, encoding: "utf8", timeout: 60000 });
      out.exit = r.status;
      const slot = JSON.parse(readFileSync(join(stateDir, "arc-sandbox.json"), "utf8")).slots[CO] || {};
      out.state = slot.state;
      out.reason = slot.reason;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    break;
  }
  default:
    console.error(`unknown scenario ${scenario}`);
    process.exit(1);
}
console.log(`DONE ${JSON.stringify(out)}`);
