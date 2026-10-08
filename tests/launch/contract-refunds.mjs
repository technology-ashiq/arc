// Contract arms for the refunds slot (ADR-1740): the REAL razorpay-refunds adapter under the REAL ctx, after the REAL
// webhooks-ledger adapter has committed its route and booked its probe payment. The deployed route is main's file, run
// by the webhook fake; only the transport is in-memory GitHub + Supabase + the venture's domain. The ledger half runs the
// REAL simulated path into a temp spine and the REAL `arc pnl` render. Prints `RAN <scenario>` first, `DONE <json>` last.
//   node tests/launch/contract-refunds.mjs <scenario>
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadRegistry, PRODUCT } from "../../.claude/scripts/launch/lib/catalog.mjs";
import { makeCtx } from "../../.claude/scripts/launch/lib/ctx.mjs";
import { makeGithub } from "./fakes/github.mjs";
import { makeSupabase } from "./fakes/supabase.mjs";
import { makeWebhook } from "./fakes/webhook.mjs";

const scenario = process.argv[2];
console.log(`RAN ${scenario}`);
const rows = loadRegistry();
const hookRow = rows.find((r) => r.id === "razorpay-webhook");
const row = rows.find((r) => r.id === "razorpay-refunds");
if (!hookRow || !row) { console.error("no razorpay-webhook or razorpay-refunds row in the registry"); process.exit(1); }
const hooks = await import(pathToFileURL(join(PRODUCT, hookRow.adapter)).href);
const adapter = await import(pathToFileURL(join(PRODUCT, row.adapter)).href);

const FULL = "technology-ashiq/arc-sandbox";
const DOMAIN = "sandbox.automemory.ai";
const REF = "fixtureref0000000001";
const HOOK_KEY = "fixture_webhook_secret_not_real";
const ENV = { RAZORPAY_WEBHOOK_SECRET: HOOK_KEY, SUPABASE_ACCESS_TOKEN: "sbp_fixture_token_0123456789abcd", GITHUB_TOKEN: "gho_fixtureToken0123456789" };

const github = makeGithub({ repos: [{ name: "arc-sandbox", description: "x", commits: [{ sha: "a".repeat(40), message: "Initial commit", files: {} }] }] });
const supabase = makeSupabase({ projects: [{ id: REF, name: "arc-sandbox" }] });
const opts = { "other-hook-key": { hookKey: "whsec_someone_else_9876543210" }, "foreign-table": { foreign: true } }[scenario] || {};
const webhook = makeWebhook({ github, supabase, full: FULL, domain: DOMAIN, hookKey: HOOK_KEY, inner: (i, o) => (new URL(String(i)).hostname === "api.github.com" ? github.fetch(i, o) : supabase.fetch(i, o)), ...opts });
globalThis.fetch = webhook.fetch;

const ROOT = mkdtempSync(join(tmpdir(), "launch-refunds-"));
const SPINE = mkdtempSync(join(tmpdir(), "launch-refunds-spine-"));
process.on("exit", () => { rmSync(ROOT, { recursive: true, force: true }); rmSync(SPINE, { recursive: true, force: true }); });
process.env.ARC_SPINE_ROOT = SPINE;
const PROFILE = (domain = DOMAIN) => ({ slug: "arc-sandbox", region: "in", brand: { name: "arc sandbox", domain } });
const hookState = [];
const state = [];
const hookCtx = () => makeCtx({
  profile: PROFILE(), board: {}, slot: { id: "webhooks-ledger" }, row: hookRow, root: ROOT, resources: hookState,
  upstream: { plans: [{ kind: "venture-repo", id: FULL }, { kind: "supabase-ref", id: REF }] }, tag: "arc-sandbox@webhooks-ledger@razorpay-webhook",
  attempt: 1, signal: undefined, env: ENV, report: (r) => { if (!hookState.some((x) => x.kind === r.kind && x.id === r.id)) hookState.push(r); },
});
const ctxNow = ({ domain = DOMAIN, upstream = null } = {}) => makeCtx({
  profile: PROFILE(domain), board: {}, slot: { id: "refunds" }, row, root: ROOT, resources: state,
  upstream: upstream || { "webhooks-ledger": hookState }, tag: "arc-sandbox@refunds@razorpay-refunds", attempt: 1, signal: undefined, env: ENV,
  report: (r) => { if (!state.some((x) => x.kind === r.kind && x.id === r.id)) state.push(r); },
});
const attempt = async (fn) => { try { return { ok: true, value: await fn() }; } catch (e) { return { ok: false, code: e.code || null, message: e.message }; } };
const verifyQ = async (o) => { const c = ctxNow(o); const v = await adapter.verify(c); return { v, queued: c.queued.map((q) => ({ kind: q.kind, payload: q.payload })) }; };
const { recordSimulated } = await import("../../.claude/scripts/launch/lib/simulated.mjs");
const book = (p) => recordSimulated("arc-sandbox", p, { process: "launch@0.1.0" });
const spine = async () => {
  const { scanAll } = await import("../../.claude/scripts/hq/spine.mjs");
  const evs = scanAll(SPINE).events.map((r) => r.event);
  return { simulated: evs.filter((e) => e.kind === "revenue.simulated").length, refunds: evs.filter((e) => e.kind === "revenue.simulated" && "refund_of" in e.payload).length, received: evs.filter((e) => e.kind === "revenue.received").length };
};
// The webhooks-ledger slot as the runner leaves it: scaffolded, verified, its probe payment booked.
const charge = async () => {
  await hooks.scaffold(hookCtx());
  const c = hookCtx();
  const v = await hooks.verify(c);
  if (!v.ok || c.queued.length !== 1) throw new Error(`the webhooks-ledger fixture did not verify: ${v.reason}`);
  const got = book(c.queued[0].payload);
  if (got.state !== "landed") throw new Error(`the charge was not booked: ${got.why}`);
  return c.queued[0].payload;
};

const out = { scenario };
switch (scenario) {
  case "thread": {
    out.charge = (await charge()).payment_id;
    const writes = () => github.calls.filter((c) => !String(c).startsWith("GET")).length;
    const w0 = writes();
    out.scaffold = (await attempt(() => adapter.scaffold(ctxNow()))).ok;
    out.scaffoldAgain = (await attempt(() => adapter.scaffold(ctxNow()))).ok;
    out.kinds = state.map((r) => r.kind);
    out.githubWrites = writes() - w0;
    const one = await verifyQ();
    out.verify = one.v;
    out.queued = one.queued;
    out.refundRows = webhook.table().rows.filter((r) => r.event === "refund.processed").length;
    const two = await verifyQ();
    out.verifyAgain = two.v.ok;
    out.refundRowsAgain = webhook.table().rows.filter((r) => r.event === "refund.processed").length;
    // webhooks-ledger still verifies with a refund of its payment stored beside it.
    out.hooksStillOk = (await hooks.verify(hookCtx())).ok;
    out.book = book(one.queued[0].payload);
    out.bookAgain = book(two.queued[0].payload);
    out.spine = await spine();
    const { derivePnl } = await import("../../.claude/scripts/hq/lib/ledger/pnl.mjs");
    const { render } = await import("../../.claude/scripts/hq/arc-pnl.mjs");
    const sim = await derivePnl(SPINE, { mode: "simulated", engine: "scan" });
    out.cashIn = sim.ventures.map((v) => `${v.venture}:${v.cashIn}`);
    out.flags = sim.needsYou.map((f) => f.type);
    out.simulatedLines = render(sim).split("\n").filter(Boolean);
    out.realVentures = (await derivePnl(SPINE, { mode: "real", engine: "scan" })).ventures.length;
    out.teardown = (await adapter.teardown(ctxNow())).steps.map((s) => s.action);
    break;
  }
  case "refund-before-charge": {
    // The refund queued before its charge is booked: refused, nothing written.
    await hooks.scaffold(hookCtx());
    await adapter.scaffold(ctxNow());
    const v = await verifyQ();
    out.verify = v.v.ok;
    out.book = book(v.queued[0].payload);
    out.spine = await spine();
    break;
  }
  case "ledger-refuses": {
    const p = await charge();
    out.over = book({ payment_id: "rfnd_Fixture0123abcd", refund_of: p.payment_id, amount: 101, fee: 0, currency: "INR", paid_at: 1791000000 });
    out.partOne = book({ payment_id: "rfnd_Fixture0123abce", refund_of: p.payment_id, amount: 60, fee: 0, currency: "INR", paid_at: 1791000000 });
    out.partTwo = book({ payment_id: "rfnd_Fixture0123abcf", refund_of: p.payment_id, amount: 41, fee: 0, currency: "INR", paid_at: 1791000000 });
    out.badId = book({ payment_id: "pay_Fixture0123abcg", refund_of: p.payment_id, amount: 10, fee: 0, currency: "INR", paid_at: 1791000000 });
    out.badOf = book({ payment_id: "rfnd_Fixture0123abch", refund_of: "order_Fixture0001", amount: 10, fee: 0, currency: "INR", paid_at: 1791000000 });
    out.otherVenture = recordSimulated("someone-else", { payment_id: "rfnd_Fixture0123abci", refund_of: p.payment_id, amount: 10, fee: 0, currency: "INR", paid_at: 1791000000 }, { process: "launch@0.1.0" });
    out.spine = await spine();
    break;
  }
  case "other-hook-key": {
    await charge().catch(() => null);
    await attempt(() => adapter.scaffold(ctxNow()));
    const v = await verifyQ();
    out.verify = v.v;
    out.queued = v.queued.length;
    break;
  }
  case "foreign-table": {
    // The owner's own razorpay_webhook_events (no marker): refunds never reads it as launch's.
    hookState.push({ kind: "supabase-ref", id: REF }, { kind: "probe-payment", id: "pay_ArcProbe0abcdef0123" });
    out.scaffold = await attempt(() => adapter.scaffold(ctxNow()));
    out.reported = state.length;
    const v = await verifyQ();
    out.verify = v.v;
    out.queued = v.queued.length;
    break;
  }
  case "foreign-refund": {
    // Someone holding the secret refunds the probe payment under another refund id: the probe is not ok (55c5065 L7).
    const p = await charge();
    await adapter.scaffold(ctxNow());
    const { createHmac } = await import("node:crypto");
    const raw = JSON.stringify({ event: "refund.processed", payload: { refund: { entity: { id: "rfnd_Someone0000001", amount: 50, currency: "INR", payment_id: p.payment_id, created_at: 1791000000 } },
      payment: { entity: { id: p.payment_id, amount: 100, currency: "INR", fee: 0, created_at: 1791000000 } } } });
    out.planted = (await fetch(`https://${DOMAIN}/api/webhooks/razorpay`, { method: "POST", headers: { "content-type": "application/json", "x-razorpay-signature": createHmac("sha256", HOOK_KEY).update(raw, "utf8").digest("hex"), "x-razorpay-event-id": "evtSomeone000001" }, body: raw })).status;
    const v = await verifyQ();
    out.verify = v.v;
    out.queued = v.queued.length;
    break;
  }
  case "new-payment": {
    // webhooks-ledger's probe payment changes (a new tag): the probe refund gets a new event id and stores (55c5065 B3).
    await charge();
    await adapter.scaffold(ctxNow());
    out.first = (await verifyQ()).v.ok;
    const i = hookState.findIndex((r) => r.kind === "probe-payment");
    hookState[i] = { kind: "probe-payment", id: "pay_ArcProbe0fedcba9876" };
    const v = await verifyQ();
    out.second = v.v;
    out.refundOf = v.queued.length ? v.queued[0].payload.refund_of : null;
    out.refundRows = webhook.table().rows.filter((r) => r.event === "refund.processed").length;
    break;
  }
  case "no-upstream":
    out.scaffold = await attempt(() => adapter.scaffold(ctxNow({ upstream: { "webhooks-ledger": [{ kind: "supabase-ref", id: REF }] } })));
    out.calls = github.calls.length + supabase.calls.length + webhook.calls.length;
    break;
  case "host-refused": {
    await charge();
    await adapter.scaffold(ctxNow());
    const before = webhook.calls.length;
    const v = await verifyQ({ domain: "pay.evil-example.com" });
    out.verify = v.v;
    out.queued = v.queued.length;
    out.routeCalls = webhook.calls.length - before;
    break;
  }
  default:
    console.error(`unknown scenario ${scenario}`);
    process.exit(1);
}
console.log(`DONE ${JSON.stringify(out)}`);
