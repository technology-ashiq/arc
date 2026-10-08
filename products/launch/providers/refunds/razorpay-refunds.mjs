import { createHash, createHmac } from "node:crypto";
// ---- shared by webhooks-ledger and refunds (ADR-1739, ADR-1740). Adapters are one file each (ADR-1704), so this block is repeated.
const SBAPI = "https://api.supabase.com/v1";
const REF = /^[a-z0-9]{20}$/;
const HOST = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

const refuse = (code, message) => Object.assign(new Error(message), { code });
const SKIP = (n) => n < 0x20 || (n >= 0x7f && n < 0xa0) || n === 0x061c || (n >= 0x200b && n <= 0x200f) || (n >= 0x202a && n <= 0x202e) ||
  (n >= 0x2060 && n <= 0x2069) || n === 0x2028 || n === 0x2029 || n === 0xfeff;
const say = (v, cap = 120) => [...(v === null || v === undefined ? "" : String(v))].filter((c) => !SKIP(c.codePointAt(0))).slice(0, cap).join("");
const list = (v) => (Array.isArray(v) ? v.filter((r) => r && typeof r === "object") : []);

function tokenOf(ctx, key, shape) {
  const t = String(ctx.env[key] || "").trim();
  if (!shape.test(t)) throw refuse("BAD_TOKEN", `${key} is not a token shape; its value is not printed`);
  return t;
}

// One caller for every host: error text is the provider's sanitised message, never a header or a request body.
async function call(ctx, url, headers, method, body, allow, what) {
  let res;
  try {
    res = await ctx.fetch(url, { method, headers: { "content-type": "application/json", "user-agent": "arc-launch", ...headers }, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual" });
  } catch (e) {
    if (e && e.code) throw e;
    throw new Error(`${what} ${method} -> transport error (${say(e && e.name, 30) || "unknown"})`);
  }
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  if (res.ok || (allow || []).includes(res.status)) return { status: res.status, body: json, res };
  const m = json && typeof json === "object" ? json.message || json.msg || json.error_description || json.error : "";
  throw new Error(`${what} ${method} -> ${res.status}${typeof m === "string" && m ? `: ${say(m)}` : ""}`);
}
const sb = (ctx, method, path, body, allow) => call(ctx, `${SBAPI}${path}`, { authorization: `Bearer ${tokenOf(ctx, "SUPABASE_ACCESS_TOKEN", /^sbp_[A-Za-z0-9_]{20,}$/)}` }, method, body, allow, `supabase ${path.split("?")[0]}`);

// The Management API query endpoint answers with the last statement's rows (ADR-1731).
async function query(ctx, ref, sql) {
  const r = await sb(ctx, "POST", `/projects/${ref}/database/query`, { query: sql });
  if (!Array.isArray(r.body)) throw new Error("supabase database/query answered without a rows array");
  return r.body;
}
const count = (rows) => {
  const n = rows.length ? rows[rows.length - 1].n : undefined;
  if (typeof n !== "number") throw new Error("supabase database/query answered without a count");
  return n;
};

function domainOf(ctx) {
  const d = String((ctx.profile && ctx.profile.brand && ctx.profile.brand.domain) || "").trim().toLowerCase().replace(/\.$/, "");
  if (!HOST.test(d)) throw refuse("BAD_DOMAIN", `brand.domain ${JSON.stringify(say(d, 80))} is not a plain hostname`);
  return d;
}
// ---- end of the shared block

// refunds slot on Razorpay (ADR-1740). A refund reaches arc the way a payment does: Razorpay posts `refund.processed`
// to the venture's webhook route (webhooks-ledger), which stores it once per event id with the raw body. verify signs
// a probe refund of webhooks-ledger's own probe payment, delivers it twice, and reads back exactly one stored refund
// row; only then does it queue the refund, which the runner books as a revenue.simulated line carrying refund_of, so
// `arc pnl --simulated` nets it against the charge. This slot creates nothing: the route and the table are
// webhooks-ledger's, and a refund of a real test purchase lands in the same table with no code of its own.
const TABLE = "razorpay_webhook_events";
const PAY = /^pay_[A-Za-z0-9]{6,40}$/;
const RFND = /^rfnd_[A-Za-z0-9]{6,40}$/;
const EVENT_ID = /^[A-Za-z0-9_-]{6,64}$/;
const OURS = "select count(*)::int as n from pg_tables t where schemaname = 'public' and tablename in ('razorpay_webhook_events') and obj_description(('public.' || t.tablename)::regclass) = 'arc-launch webhooks';";
const RLS_ON = "select count(*)::int as n from pg_tables where schemaname = 'public' and tablename in ('razorpay_webhook_events') and rowsecurity;";
// The refund entity's fields only, read out of the stored body on the venture: the body itself never reaches arc. The
// rows are filtered in a materialized CTE first, so no other row's body is ever cast (attack 55c5065 B1).
const REFUNDS = (pid) => [
  `with r as materialized (select event_id, event, payment_id, body from public.${TABLE} where payment_id = '${pid}' and event = 'refund.processed')`,
  " select event_id, event, payment_id,",
  " body::jsonb #>> '{payload,refund,entity,id}' as refund_id,",
  " body::jsonb #>> '{payload,refund,entity,amount}' as amount,",
  " body::jsonb #>> '{payload,refund,entity,currency}' as currency,",
  " body::jsonb #>> '{payload,refund,entity,created_at}' as refunded_at,",
  " body::jsonb #>> '{payload,refund,entity,payment_id}' as refund_of",
  " from r order by event_id limit 101;",
].join("");
const AMOUNT = 100;

// Upstream: webhooks-ledger's project and the probe payment it booked (ADR-1740). Validated here, never trusted.
function upstreamOf(ctx) {
  const up = list(ctx.upstream && ctx.upstream["webhooks-ledger"]);
  const ref = String((up.find((r) => r.kind === "supabase-ref") || {}).id || "");
  const payment = String((up.find((r) => r.kind === "probe-payment") || {}).id || "");
  if (!REF.test(ref) || !PAY.test(payment)) throw refuse("UPSTREAM_MISSING", "webhooks-ledger reported no Supabase ref and probe payment");
  return { ref, payment };
}

// The owner generates the secret (Razorpay does not issue it): printable ASCII, no spaces, never printed.
function secretOf(ctx) {
  const s = String(ctx.env.RAZORPAY_WEBHOOK_SECRET || "").trim();
  if (!/^[!-~]{16,128}$/.test(s)) throw refuse("BAD_TOKEN", "RAZORPAY_WEBHOOK_SECRET is not 16 to 128 printable characters without spaces; its value is not printed");
  return s;
}

// The probe refund's identity comes from this slot's tag and the charge it refunds, so every verify replays the same
// refund, and a new upstream payment gets a new event id the route has not stored (attack 55c5065 B3). An empty tag
// owns nothing: it would give every venture the same probe.
function probeIds(ctx, payment) {
  if (typeof ctx.tag !== "string" || !ctx.tag) throw refuse("BAD_TAG", "the slot has no resource tag; the probe refund has no identity");
  const h = createHash("sha256").update(`${ctx.tag}
${payment}`, "utf8").digest("hex");
  return { event: `arcrefund${h.slice(0, 16)}`, refund: `rfnd_ArcProbe0${h.slice(16, 26)}` };
}

// The table must be webhooks-ledger's, with RLS on: a same-named table the owner made is not read as launch's.
async function tableIsOurs(ctx, ref) {
  if (count(await query(ctx, ref, OURS)) !== 1) return `public.${TABLE} is missing or does not carry launch's webhooks marker`;
  if (count(await query(ctx, ref, RLS_ON)) !== 1) return `${TABLE} does not have row level security on`;
  return "";
}

export function envContract() {
  return ["RAZORPAY_WEBHOOK_SECRET", "SUPABASE_ACCESS_TOKEN"];
}

export async function scaffold(ctx) {
  const { ref, payment } = upstreamOf(ctx);
  domainOf(ctx);
  secretOf(ctx);
  const ids = probeIds(ctx, payment);
  const bad = await tableIsOurs(ctx, ref);
  if (bad) throw refuse("UPSTREAM_TABLE", bad);
  // Nothing is created: the refund source is webhooks-ledger's table, read by event.
  ctx.report({ kind: "refund-source", id: `${ref}:public.${TABLE}#refund.processed` });
  ctx.report({ kind: "probe-refund", id: `${ids.refund}:${payment}` });
  return {
    files: [],
    resources: [{ kind: "refund-source", id: `${ref}:public.${TABLE}#refund.processed` }, { kind: "probe-refund", id: `${ids.refund}:${payment}` }],
    notes: ["the Razorpay dashboard webhook must include refund.processed (ADR-1740)"],
  };
}

async function deliver(ctx, domain, raw, signature, eventId) {
  const headers = { "content-type": "application/json", "user-agent": "arc-launch", "x-razorpay-signature": signature, "x-razorpay-event-id": eventId };
  let res;
  try {
    res = await ctx.fetch(`https://${domain}/api/webhooks/razorpay`, { method: "POST", headers, body: raw, redirect: "manual" });
  } catch (e) {
    if (e && e.code) throw e;
    return 0;
  }
  return res.status;
}
const sign = (secret, bytes) => createHmac("sha256", secret).update(bytes, "utf8").digest("hex");
const int = (v) => (typeof v === "number" ? v : typeof v === "string" && /^[0-9]{1,15}$/.test(v) ? Number(v) : NaN);

// Asked of the live route and the venture's database: one signed refund delivered twice is one stored refund row of the
// probe payment, for the amount refunded.
async function probe(ctx) {
  const { ref, payment } = upstreamOf(ctx);
  const domain = domainOf(ctx);
  const hookKey = secretOf(ctx);
  const ids = probeIds(ctx, payment);
  if (!RFND.test(ids.refund) || !EVENT_ID.test(ids.event)) return { ok: false, reason: "the probe ids are not id shapes" };
  const bad = await tableIsOurs(ctx, ref);
  if (bad) return { ok: false, reason: bad };
  const now = Math.floor(Date.now() / 1000);
  const event = {
    entity: "event", account_id: "acc_ArcLaunchProbe", event: "refund.processed", contains: ["refund", "payment"],
    payload: {
      refund: { entity: { id: ids.refund, entity: "refund", amount: AMOUNT, currency: "INR", payment_id: payment, status: "processed",
        notes: { arc_launch_tag: ctx.tag, arc_launch_probe: "refunds" }, created_at: now } },
      payment: { entity: { id: payment, entity: "payment", amount: AMOUNT, currency: "INR", status: "refunded", amount_refunded: AMOUNT, fee: 0, tax: 0, created_at: now } },
    },
    created_at: now,
  };
  const raw = JSON.stringify(event, null, 2);
  const sig = sign(hookKey, raw);
  const first = await deliver(ctx, domain, raw, sig, ids.event);
  if (first === 401) return { ok: false, reason: "the route refused launch's signature over the raw body (401): the venture's RAZORPAY_WEBHOOK_SECRET differs" };
  if (first !== 200) return { ok: false, reason: `the signed probe refund was answered ${first}, not 200` };
  const replay = await deliver(ctx, domain, raw, sig, ids.event);
  if (replay !== 200) return { ok: false, reason: `the replayed probe refund was answered ${replay}, not 200` };
  const all = list(await query(ctx, ref, REFUNDS(payment)));
  // The probe payment is refunded by the probe alone: any other refund of it is not launch's (attack 55c5065 L7).
  const rows = all.filter((r) => r.refund_id === ids.refund);
  if (all.length !== rows.length) return { ok: false, reason: `the probe payment carries ${all.length - rows.length} refund.processed rows launch did not send` };
  if (rows.length !== 1 || rows[0].event_id !== ids.event) return { ok: false, reason: `the probe refund is stored ${rows.length} times; exactly one row, under the probe event id, is the round trip` };
  const row = rows[0];
  const amount = int(row.amount);
  const at = int(row.refunded_at);
  if (row.payment_id !== payment || row.refund_of !== payment || amount !== AMOUNT || row.currency !== "INR" || !Number.isSafeInteger(at))
    return { ok: false, reason: `the stored probe refund is ${say(row.amount, 12)} ${say(row.currency, 6)} of ${say(row.refund_of, 40)}, not ${AMOUNT} INR of ${payment}` };
  // The stored row, not the event launch sent, is what the ledger books, against the charge it names.
  ctx.emit("revenue.simulated", { event_id: ids.event, payment_id: ids.refund, refund_of: payment, amount, fee: 0, currency: "INR", paid_at: at });
  return { ok: true, answerer: `${domain} + api.supabase.com`, evidence: { stored: 1, replays: 2, refund: ids.refund, refund_of: payment, amount } };
}

// verify answers; every failure but the slot timeout is a not-ok answer, never a throw out of a read.
export async function verify(ctx) {
  // Every answer below comes over ctx.fetch from the live route and the Supabase Management API; never state.
  const ask = ctx.fetch.bind(ctx);
  try {
    return await probe({ ...ctx, fetch: ask });
  } catch (e) {
    if (e && e.code === "ABORTED") throw e;
    return { ok: false, reason: `${(e && e.code) || "error"}: ${say(e && e.message)}` };
  }
}

// Nothing was created, so nothing is undone: the refund line stays on the append-only spine, netted.
export async function teardown(ctx) {
  return { steps: ctx.resources.filter((r) => r.kind === "refund-source").map((r, i) => ({ order: i + 1, action: "none (reads webhooks-ledger's table; nothing created)", resource: say(r.id, 80) })) };
}
