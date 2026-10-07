// Contract arms for the webhooks-ledger slot (ADR-1739): the REAL razorpay-webhook adapter under the REAL ctx, and the
// REAL route file it commits, run from main's bytes by the webhook fake. Only the transport is in-memory GitHub +
// Supabase + the venture's domain. The ledger half runs the REAL simulated path into a temp spine. A fresh ctx per call.
// Prints `RAN <scenario>` first and `DONE <json>` last.
//   node tests/launch/contract-webhooks.mjs <scenario>
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadRegistry, PRODUCT, PATHS, ROOT as ARC } from "../../.claude/scripts/launch/lib/catalog.mjs";
import { makeCtx } from "../../.claude/scripts/launch/lib/ctx.mjs";
import { emptyState, saveState, statePath } from "../../.claude/scripts/launch/lib/state.mjs";
import { makeGithub } from "./fakes/github.mjs";
import { makeSupabase } from "./fakes/supabase.mjs";
import { makeWebhook } from "./fakes/webhook.mjs";

const scenario = process.argv[2];
console.log(`RAN ${scenario}`);
const row = loadRegistry().find((r) => r.id === "razorpay-webhook");
if (!row) { console.error("no razorpay-webhook row in the registry"); process.exit(1); }
const adapter = await import(pathToFileURL(join(PRODUCT, row.adapter)).href);

const FULL = "technology-ashiq/arc-sandbox";
const DOMAIN = "sandbox.automemory.ai";
const REF = "fixtureref0000000001";
const SECRET = "fixture_webhook_secret_not_real";
const TAG = "arc-sandbox@webhooks-ledger@razorpay-webhook";
const ENV = { RAZORPAY_WEBHOOK_SECRET: SECRET, SUPABASE_ACCESS_TOKEN: "sbp_fixture_token_0123456789abcd", GITHUB_TOKEN: "gho_fixtureToken0123456789" };

const github = makeGithub({ repos: [{ name: "arc-sandbox", description: "x", commits: [{ sha: "a".repeat(40), message: "Initial commit", files: {} }] }] });
const supabase = makeSupabase({ projects: [{ id: REF, name: "arc-sandbox" }] });
const opts = {
  "wrong-secret": { secret: "whsec_someone_else_9876543210" },
  "served-accepts-any": { serve: (src) => src.replace("if (given.length !== want.length || !timingSafeEqual(given, want)) return answer(401, { error: \"bad signature\" });", "") },
  "served-reserialises": { serve: (src) => src.replace("update(raw, \"utf8\")", "update(JSON.stringify(JSON.parse(raw)), \"utf8\")") },
  "policy": { policies: 1 },
  "foreign-table": { foreign: true },
  "secret-unset": { secret: null },
}[scenario] || {};
const webhook = makeWebhook({ github, supabase, full: FULL, domain: DOMAIN, secret: SECRET, inner: (i, o) => (new URL(String(i)).hostname === "api.github.com" ? github.fetch(i, o) : supabase.fetch(i, o)), ...opts });
globalThis.fetch = webhook.fetch;

const ROOT = mkdtempSync(join(tmpdir(), "launch-webhooks-"));
const SPINE = mkdtempSync(join(tmpdir(), "launch-webhooks-spine-"));
process.on("exit", () => { rmSync(ROOT, { recursive: true, force: true }); rmSync(SPINE, { recursive: true, force: true }); });
process.env.ARC_SPINE_ROOT = SPINE;
const state = [];
const UP = { plans: [{ kind: "venture-repo", id: FULL }, { kind: "supabase-ref", id: REF }], "payment-test": [{ kind: "razorpay-test-order", id: "order_Fixture0000001" }] };
const ctxNow = ({ domain = DOMAIN, env = ENV, upstream = UP } = {}) => makeCtx({
  profile: { slug: "arc-sandbox", region: "in", brand: { name: "arc sandbox", domain } }, board: {}, slot: { id: "webhooks-ledger" }, row,
  root: ROOT, resources: state, upstream, tag: TAG, attempt: 1, signal: undefined, env,
  report: (r) => { if (!state.some((x) => x.kind === r.kind && x.id === r.id)) state.push(r); },
});
const attempt = async (fn) => { try { return { ok: true, value: await fn() }; } catch (e) { return { ok: false, code: e.code || null, message: e.message }; } };
const repo = () => github.store.get(FULL);
const text = (path) => (repo().files[path] ? Buffer.from(repo().files[path].content, "base64").toString("utf8") : null);
const rows = () => (webhook.table() ? webhook.table().rows.length : 0);
const commits = () => repo().commits.filter((c) => (c.message || "").startsWith("webhooks:")).length;
// verify with its queue: the queue is what the runner books, so each arm reads it from the ctx verify ran under.
const verifyQ = async (o) => { const c = ctxNow(o); const v = await adapter.verify(c); return { v, queued: c.queued.map((q) => ({ kind: q.kind, payload: q.payload })) }; };
// A delivery straight to the deployed route, as Razorpay (or anyone) would make it.
const post = async (raw, sig, id) => {
  const headers = { "content-type": "application/json", "x-razorpay-signature": sig };
  if (id) headers["x-razorpay-event-id"] = id;
  const r = await fetch(`https://${DOMAIN}/api/webhooks/razorpay`, { method: "POST", headers, body: raw });
  let body = null;
  try { body = await r.json(); } catch { body = null; }
  return { status: r.status, body };
};
const hmac = (s, b) => createHmac("sha256", s).update(b, "utf8").digest("hex");
const spine = async () => {
  const { scanAll } = await import("../../.claude/scripts/hq/spine.mjs");
  const kinds = scanAll(SPINE).events.map((r) => r.event.kind);
  return { simulated: kinds.filter((k) => k === "revenue.simulated").length, received: kinds.filter((k) => k === "revenue.received").length };
};

const out = { scenario };
switch (scenario) {
  case "thread": {
    out.first = (await attempt(() => adapter.scaffold(ctxNow()))).ok;
    out.second = (await attempt(() => adapter.scaffold(ctxNow()))).ok;
    out.commits = commits();
    out.kinds = state.map((r) => r.kind);
    out.env = text(".env.example");
    out.table = { rls: webhook.table().rls, comment: webhook.table().comment };
    const one = await verifyQ();
    out.verify = one.v;
    out.queued = one.queued;
    out.rowsAfterVerify = rows();
    const two = await verifyQ();
    out.verifyAgain = two.v.ok;
    out.rowsAfterSecondVerify = rows();
    // The ledger half: the first verify's queue, then the second's (a replay of the same payment), through the real path.
    const { recordSimulated } = await import("../../.claude/scripts/launch/lib/simulated.mjs");
    out.book = recordSimulated("arc-sandbox", one.queued[0].payload, { process: "launch@0.1.0" });
    out.bookAgain = recordSimulated("arc-sandbox", two.queued[0].payload, { process: "launch@0.1.0" });
    out.spine = await spine();
    const { derivePnl } = await import("../../.claude/scripts/hq/lib/ledger/pnl.mjs");
    const { render } = await import("../../.claude/scripts/hq/arc-pnl.mjs");
    const sim = await derivePnl(SPINE, { mode: "simulated", engine: "scan" });
    out.simulatedLines = render(sim).split("\n").filter(Boolean);
    out.realVentures = (await derivePnl(SPINE, { mode: "real", engine: "scan" })).ventures.length;
    out.teardown = (await adapter.teardown(ctxNow())).steps.map((s) => s.action);
    break;
  }
  case "route": {
    // The committed route itself, driven directly: the shipped signature check and dedupe, not a model of them.
    await adapter.scaffold(ctxNow());
    const ev = { entity: "event", event: "payment.captured", payload: { payment: { entity: { id: "pay_RouteFixture01", amount: 100, fee: 2, currency: "INR", created_at: 1791000000 } } } };
    const raw = JSON.stringify(ev, null, 2);
    out.valid = await post(raw, hmac(SECRET, raw), "evtRoute000001");
    out.replay = await post(raw, hmac(SECRET, raw), "evtRoute000001");
    out.rowsAfterReplay = rows();
    out.badSig = await post(raw, hmac("whsec_not_the_secret_000000", raw), "evtRoute000002");
    out.reserialised = await post(raw, hmac(SECRET, JSON.stringify(JSON.parse(raw))), "evtRoute000003");
    out.noId = await post(raw, hmac(SECRET, raw), "");
    out.rowsAtEnd = rows();
    out.stored = webhook.table().rows.map((r) => ({ event_id: r.event_id, payment_id: r.payment_id, amount: r.amount, fee: r.fee, raw: r.body === raw }));
    break;
  }
  case "secret-unset": {
    await adapter.scaffold(ctxNow());
    const raw = JSON.stringify({ event: "payment.captured" });
    out.post = await post(raw, hmac(SECRET, raw), "evtRoute000009");
    out.rows = rows();
    break;
  }
  case "wrong-secret":
  case "served-accepts-any":
  case "served-reserialises":
  case "policy": {
    await adapter.scaffold(ctxNow());
    // A served build that is meant to differ must differ, or the arm proves nothing about it.
    out.mutated = opts.serve ? opts.serve(text("app/api/webhooks/razorpay/route.js")) !== text("app/api/webhooks/razorpay/route.js") : null;
    const v = await verifyQ();
    out.verify = v.v;
    out.queued = v.queued.length;
    out.rows = rows();
    break;
  }
  case "foreign-table":
    out.scaffold = await attempt(() => adapter.scaffold(ctxNow()));
    out.commits = commits();
    out.reported = state.length;
    break;
  case "host-refused": {
    // A domain outside the row's hosts[]: ctx.fetch refuses before anything leaves, so the route is never reached.
    await adapter.scaffold(ctxNow());
    const v = await verifyQ({ domain: "pay.evil-example.com" });
    out.verify = v.v;
    out.queued = v.queued.length;
    out.routeCalls = webhook.calls.length;
    break;
  }
  case "no-upstream":
    out.scaffold = await attempt(() => adapter.scaffold(ctxNow({ upstream: { "payment-test": UP["payment-test"] } })));
    out.calls = github.calls.length + supabase.calls.length;
    break;
  case "env-missing": {
    // The real worker, as the runner starts it, with every key but RAZORPAY_WEBHOOK_SECRET: the slot fails on the env.
    const dir = mkdtempSync(join(tmpdir(), "launch-webhooks-worker-"));
    try {
      saveState(dir, emptyState({ slug: "arc-sandbox", honesty_class: "rehearsal" }));
      const args = { catalog: PATHS.catalog, registry: PATHS.registry, providersDir: PATHS.providersDir, venturesDir: PATHS.venturesDir, stateDir: dir,
        mode: "apply", venture: "arc-sandbox", slot: "webhooks-ledger", provider: row.id, row, adapterPath: join(PRODUCT, row.adapter), ventureRoot: ROOT, attempt: 1, timeout: 60 };
      writeFileSync(join(dir, "args.json"), JSON.stringify(args));
      const env = { ...process.env, SUPABASE_ACCESS_TOKEN: ENV.SUPABASE_ACCESS_TOKEN, GITHUB_TOKEN: ENV.GITHUB_TOKEN };
      delete env.RAZORPAY_WEBHOOK_SECRET;
      const r = spawnSync(process.execPath, [join(ARC, ".claude", "scripts", "launch", "lib", "worker.mjs"), join(dir, "args.json")], { env, encoding: "utf8", timeout: 60000 });
      const s = JSON.parse(readFileSync(statePath(dir, "arc-sandbox"), "utf8")).slots["webhooks-ledger"] || {};
      out.exit = r.status;
      out.state = s.state;
      out.reason = s.reason;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    break;
  }
  case "ledger-refuses": {
    // A payment the ledger cannot book as simulated INR: refused, nothing written.
    const { recordSimulated } = await import("../../.claude/scripts/launch/lib/simulated.mjs");
    out.usd = recordSimulated("arc-sandbox", { payment_id: "pay_Fixture0123abcd", amount: 100, fee: 0, currency: "USD", paid_at: 1791000000 }, { process: "launch@0.1.0" });
    out.noId = recordSimulated("arc-sandbox", { payment_id: "order_Fixture0001", amount: 100, fee: 0, currency: "INR", paid_at: 1791000000 }, { process: "launch@0.1.0" });
    out.feeOver = recordSimulated("arc-sandbox", { payment_id: "pay_Fixture0123abcd", amount: 100, fee: 101, currency: "INR", paid_at: 1791000000 }, { process: "launch@0.1.0" });
    out.spine = await spine();
    break;
  }
  default:
    console.error(`unknown scenario ${scenario}`);
    process.exit(1);
}
console.log(`DONE ${JSON.stringify(out)}`);
