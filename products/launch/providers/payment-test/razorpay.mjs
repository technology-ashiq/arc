// payment-test slot on Razorpay, test mode (ADR-1704, ADR-1736). Proves the keys are TEST keys and the account answers:
// one tagged INR 1 order, found before it is created, fetched back by verify. The purchase itself needs the checkout page a
// later slot builds, so the e2e is proven by checkout-portal -> webhooks-ledger -> refunds. A live key refuses before
// any call: this slot never reaches past gate 3 (ADR-1720).
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

const API = "https://api.razorpay.com/v1";
const AMOUNT = 100;
const CURRENCY = "INR";

const refuse = (code, message) => Object.assign(new Error(message), { code });
const SKIP = (n) => n < 0x20 || (n >= 0x7f && n < 0xa0) || n === 0x061c || (n >= 0x200b && n <= 0x200f) || (n >= 0x202a && n <= 0x202e) ||
  (n >= 0x2060 && n <= 0x2069) || n === 0x2028 || n === 0x2029 || n === 0xfeff;
const say = (v, cap = 120) => [...(v === null || v === undefined ? "" : String(v))].filter((c) => !SKIP(c.codePointAt(0))).slice(0, cap).join("");
const list = (v) => (Array.isArray(v) ? v.filter((r) => r && typeof r === "object") : []);

// Shapes, never values: a live id is named as live, and nothing else about either key is printed.
function keys(ctx) {
  const id = String(ctx.env.RAZORPAY_KEY_ID || "").trim();
  const keySecret = String(ctx.env.RAZORPAY_KEY_SECRET || "").trim();
  if (/^rzp_live_/.test(id)) throw refuse("LIVE_KEY", "RAZORPAY_KEY_ID is a live key; payment-test runs on test keys only (gate 3 is never crossed here, ADR-1720)");
  if (!/^rzp_test_[A-Za-z0-9]{14}$/.test(id)) throw refuse("BAD_TOKEN", "RAZORPAY_KEY_ID is not a test key shape (rzp_test_ and 14 letters or digits); its value is not printed");
  if (!/^[A-Za-z0-9]{16,64}$/.test(keySecret)) throw refuse("BAD_TOKEN", "RAZORPAY_KEY_SECRET is not a key shape (16 to 64 letters or digits); its value is not printed");
  return Buffer.from(`${id}:${keySecret}`, "utf8").toString("base64");
}

async function rz(ctx, method, path, body, { allow = [] } = {}) {
  const basic = keys(ctx);
  let res;
  try {
    res = await ctx.fetch(`${API}${path}`, {
      method,
      headers: { authorization: `Basic ${basic}`, "content-type": "application/json", "user-agent": "arc-launch" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    if (e && e.code) throw e;
    throw new Error(`razorpay ${method} ${path.split("?")[0]} -> transport error (${say(e && e.name, 30) || "unknown"})`);
  }
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  if (res.ok || allow.includes(res.status)) return { status: res.status, body: json };
  const desc = json && json.error && typeof json.error.description === "string" ? `: ${say(json.error.description)}` : "";
  throw new Error(`razorpay ${method} ${path.split("?")[0]} -> ${res.status}${desc}`);
}

// Razorpay caps receipt at 40 characters. A slug that fits is used whole; a longer one keeps a prefix plus 12 hex of its
// sha256, so two long slugs sharing a prefix never share a receipt (attack 1cb6b9a B2).
function receiptOf(ctx) {
  const slug = String(ctx.profile && ctx.profile.slug || "");
  if (!/^[a-z][a-z0-9-]{1,40}$/.test(slug)) throw refuse("BAD_SLUG", `venture slug ${JSON.stringify(say(slug, 50))} is not [a-z][a-z0-9-]`);
  const whole = `arc-launch-${slug}`;
  if (whole.length <= 40) return whole;
  return `arc-launch-${slug.slice(0, 16)}-${createHash("sha256").update(slug, "utf8").digest("hex").slice(0, 12)}`;
}

// The tag decides ownership, so an empty tag can never match an order without one (attack 1cb6b9a B3).
const ours = (ctx, o) => typeof ctx.tag === "string" && ctx.tag.length > 0 && o && o.notes && typeof o.notes === "object" && !Array.isArray(o.notes) && o.notes.arc_launch_tag === ctx.tag;

export function envContract() {
  return ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"];
}

export async function scaffold(ctx) {
  const receipt = receiptOf(ctx);
  keys(ctx);
  // An answer without an items array is unreadable, not empty: reading it as "absent" would create a second order
  // (attack 1cb6b9a B1, twin of the check-then-create rule). Every page is read: a filter the API ignores, or more than
  // one page of orders, must still find launch's own (attack da7f2e0 B1).
  const found = [];
  for (let page = 0; ; page++) {
    if (page >= 50) throw refuse("TOO_MANY_ORDERS", "razorpay lists more than 5000 orders for this receipt query; launch does not search further");
    const listed = (await rz(ctx, "GET", `/orders?receipt=${encodeURIComponent(receipt)}&count=100&skip=${page * 100}`)).body;
    if (!listed || !Array.isArray(listed.items)) throw new Error("razorpay answered the order list without an items array; nothing was created");
    found.push(...list(listed.items).filter((o) => o.receipt === receipt));
    if (found.some((o) => ours(ctx, o)) || listed.items.length < 100) break;
  }
  const mine = found.filter((o) => ours(ctx, o) && typeof o.id === "string");
  let order = mine[0] || null;
  if (!order) {
    // An order with launch's receipt but not its tag is the owner's: never adopted.
    if (found.length) throw refuse("FOREIGN_ORDER", `a Razorpay order with receipt ${receipt} exists that launch did not create; it is not adopted`);
    order = (await rz(ctx, "POST", "/orders", { amount: AMOUNT, currency: CURRENCY, receipt, notes: { arc_launch_tag: ctx.tag } })).body;
  }
  if (!order || typeof order.id !== "string" || !/^order_[A-Za-z0-9]{6,40}$/.test(order.id)) throw new Error("razorpay returned no usable order id");
  ctx.report({ kind: "razorpay-test-order", id: order.id });
  return { files: [], resources: [{ kind: "razorpay-test-order", id: order.id }], notes: ["the purchase e2e is proven by checkout-portal -> webhooks-ledger -> refunds (ADR-1736)"] };
}

// Asked of Razorpay: the recorded order answers, carries this slot's tag, and is the INR 1 order launch made.
async function probe(ctx) {
  keys(ctx);
  const rec = ctx.resources.filter((r) => r.kind === "razorpay-test-order");
  if (rec.length !== 1 || !/^order_[A-Za-z0-9]{6,40}$/.test(rec[0].id)) return { ok: false, reason: `state records ${rec.length} usable razorpay-test-order resources; verify needs exactly one` };
  const r = await rz(ctx, "GET", `/orders/${encodeURIComponent(rec[0].id)}`, undefined, { allow: [400, 404] });
  // Only Razorpay's own "does not exist" (or a 404) means absent; any other 400 is reported as itself (attack 1cb6b9a B6).
  const desc = r.body && r.body.error && typeof r.body.error.description === "string" ? r.body.error.description : "";
  if (r.status === 404 || (r.status === 400 && /does not exist/i.test(desc))) return { ok: false, reason: `razorpay has no order ${rec[0].id} for these keys` };
  if (r.status !== 200) return { ok: false, reason: `razorpay GET /orders/${rec[0].id} -> ${r.status}: ${say(desc)}` };
  if (!r.body || r.body.id !== rec[0].id) return { ok: false, reason: `razorpay answered order ${rec[0].id} with another id` };
  if (!ours(ctx, r.body)) return { ok: false, reason: `order ${rec[0].id} does not carry this slot's tag` };
  if (r.body.amount !== AMOUNT || r.body.currency !== CURRENCY) return { ok: false, reason: `order ${rec[0].id} is ${say(r.body.amount, 12)} ${say(r.body.currency, 6)}, not ${AMOUNT} ${CURRENCY}` };
  return { ok: true, answerer: "api.razorpay.com", evidence: { order: rec[0].id, mode: "test", amount: AMOUNT, currency: CURRENCY, status: say(r.body.status, 20) } };
}

// verify answers; every refusal and failure but the slot timeout is a not-ok answer, never a throw out of a read.
export async function verify(ctx) {
  // Every answer below comes over ctx.fetch from api.razorpay.com; the probe is Razorpay, never state.
  const ask = ctx.fetch.bind(ctx);
  try {
    return await probe({ ...ctx, fetch: ask });
  } catch (e) {
    if (e && e.code === "ABORTED") throw e;
    return { ok: false, reason: `${(e && e.code) || "error"}: ${say(e && e.message)}` };
  }
}

// Razorpay cannot delete an order, and a test-mode order moves no money: nothing to undo.
export async function teardown(ctx) {
  return { steps: ctx.resources.filter((r) => r.kind === "razorpay-test-order").map((r, i) => ({ order: i + 1, action: "none (test-mode order, Razorpay keeps it)", resource: say(r.id, 60) })) };
}
