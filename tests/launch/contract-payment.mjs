// Contract arm for the payment-test slot: the REAL razorpay adapter under the REAL ctx, only the transport swapped for
// the in-memory Razorpay. A fresh ctx per call. Prints `RAN <scenario>` first and `DONE <json>` last.
//   node tests/launch/contract-payment.mjs <scenario>
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadRegistry, PRODUCT } from "../../.claude/scripts/launch/lib/catalog.mjs";
import { makeCtx } from "../../.claude/scripts/launch/lib/ctx.mjs";
import { makeRazorpay } from "./fakes/razorpay.mjs";

const scenario = process.argv[2];
console.log(`RAN ${scenario}`);
const row = loadRegistry().find((r) => r.id === "razorpay");
if (!row) { console.error("no razorpay row in the registry"); process.exit(1); }
const adapter = await import(pathToFileURL(join(PRODUCT, row.adapter)).href);

const TAG = "arc-sandbox@payment-test@razorpay";
const RECEIPT = "arc-launch-arc-sandbox";
const KEY_ID = "rzp_test_Fixture0123456";
const KEY_SECRET = "fixtureSecret0123456789ab";
const seedOrders = {
  "foreign-order": [{ id: "order_Owner0000000001", receipt: RECEIPT, notes: {} }],
  "found-mine": [{ id: "order_Mine00000000001", receipt: RECEIPT, notes: { arc_launch_tag: TAG } }],
}[scenario] || [];
const rzOpts = {
  "list-no-items": { listShape: "no-items" },
}[scenario] || {};
const rz = makeRazorpay({ orders: seedOrders, ...rzOpts });
globalThis.fetch = rz.fetch;

const ROOT = mkdtempSync(join(tmpdir(), "launch-payment-"));
process.on("exit", () => rmSync(ROOT, { recursive: true, force: true }));
const reported = [];
const ctxNow = (env = { RAZORPAY_KEY_ID: KEY_ID, RAZORPAY_KEY_SECRET: KEY_SECRET }, { slug = "arc-sandbox", tag = TAG } = {}) => makeCtx({
  profile: { slug }, board: {}, slot: { id: "payment-test" }, row,
  root: ROOT, resources: reported, upstream: {}, tag, attempt: 1, signal: undefined, env,
  report: (r) => { if (!reported.some((x) => x.kind === r.kind && x.id === r.id)) reported.push(r); },
});
const attempt = async (fn) => { try { return { ok: true, value: await fn() }; } catch (e) { return { ok: false, code: e.code || null, message: e.message }; } };
const creates = () => rz.calls.filter((c) => c === "POST /v1/orders").length;

const out = { scenario };
switch (scenario) {
  case "twice": {
    const first = await attempt(() => adapter.scaffold(ctxNow()));
    out.first = first.ok;
    out.second = (await attempt(() => adapter.scaffold(ctxNow()))).ok;
    out.creates = creates();
    out.orders = rz.store.length;
    out.order = rz.store[0] ? { amount: rz.store[0].amount, currency: rz.store[0].currency, receipt: rz.store[0].receipt, tagged: rz.store[0].notes.arc_launch_tag === TAG } : null;
    out.reported = reported.map((r) => r.kind);
    out.notes = first.ok ? first.value.notes : [];
    out.verify = await adapter.verify(ctxNow());
    out.teardown = (await adapter.teardown(ctxNow())).steps.map((s) => s.action);
    break;
  }
  case "live-key":
    out.scaffold = await attempt(() => adapter.scaffold(ctxNow({ RAZORPAY_KEY_ID: "rzp_live_Fixture0123456", RAZORPAY_KEY_SECRET: KEY_SECRET })));
    out.calls = rz.calls.length;
    out.verify = await attempt(() => adapter.verify(ctxNow({ RAZORPAY_KEY_ID: "rzp_live_Fixture0123456", RAZORPAY_KEY_SECRET: KEY_SECRET })));
    break;
  case "bad-key": {
    const badSecret = `fixture${String.fromCharCode(10)}Secret0123456789`;
    out.scaffold = await attempt(() => adapter.scaffold(ctxNow({ RAZORPAY_KEY_ID: KEY_ID, RAZORPAY_KEY_SECRET: badSecret })));
    out.calls = rz.calls.length;
    out.leaked = out.scaffold.message.includes("Secret0123456789");
    out.badId = await attempt(() => adapter.scaffold(ctxNow({ RAZORPAY_KEY_ID: "rzp_test_short", RAZORPAY_KEY_SECRET: KEY_SECRET })));
    break;
  }
  case "wrong-pair":
    out.scaffold = await attempt(() => adapter.scaffold(ctxNow({ RAZORPAY_KEY_ID: KEY_ID, RAZORPAY_KEY_SECRET: "wrongSecret0123456789ab" })));
    out.creates = creates();
    break;
  case "foreign-order":
    out.scaffold = await attempt(() => adapter.scaffold(ctxNow()));
    out.creates = creates();
    out.reported = reported.length;
    break;
  case "found-mine":
    out.scaffold = await attempt(() => adapter.scaffold(ctxNow()));
    out.creates = creates();
    out.reported = reported.map((r) => r.id);
    break;
  case "verify-tampered": {
    // Each tamper is checked against a fresh copy of the order launch made.
    await adapter.scaffold(ctxNow());
    const o = rz.store[0];
    const keep = { ...o, notes: { ...o.notes } };
    o.amount = 50000;
    out.amount = await adapter.verify(ctxNow());
    Object.assign(o, keep, { notes: {} });
    out.untagged = await adapter.verify(ctxNow());
    Object.assign(o, keep);
    rz.store.length = 0;
    out.missing = await adapter.verify(ctxNow());
    break;
  }
  case "verify-no-record":
    out.verify = await adapter.verify(ctxNow());
    out.calls = rz.calls.length;
    break;
  case "list-no-items":
    out.scaffold = await attempt(() => adapter.scaffold(ctxNow()));
    out.creates = creates();
    break;
  case "long-slugs": {
    // Two 41-character slugs sharing their first 29 characters must not share a receipt.
    const a = "a".repeat(29) + "-venture-one", b = "a".repeat(29) + "-venture-two";
    await adapter.scaffold(ctxNow(undefined, { slug: a, tag: `${a}@payment-test@razorpay` }));
    out.second = await attempt(() => adapter.scaffold(ctxNow(undefined, { slug: b, tag: `${b}@payment-test@razorpay` })));
    out.receipts = rz.store.map((o) => o.receipt);
    out.creates = creates();
    break;
  }
  case "empty-tag":
    rz.store.push({ id: "order_Owner0000000002", entity: "order", amount: 100, currency: "INR", status: "created", receipt: RECEIPT, notes: {} });
    out.scaffold = await attempt(() => adapter.scaffold(ctxNow(undefined, { tag: "" })));
    out.creates = creates();
    break;
  case "verify-400-other": {
    await adapter.scaffold(ctxNow());
    const bad = makeRazorpay({ orders: rz.store, fetchError: { status: 400, description: "Bad request: the server is busy" } });
    globalThis.fetch = bad.fetch;
    out.verify = await adapter.verify(ctxNow());
    break;
  }
  default:
    console.error(`unknown scenario ${scenario}`);
    process.exit(1);
}
console.log(`DONE ${JSON.stringify(out)}`);
