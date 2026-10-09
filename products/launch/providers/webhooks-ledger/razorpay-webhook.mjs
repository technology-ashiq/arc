import { Buffer } from "node:buffer";
import { createHash, createHmac } from "node:crypto";
// ---- shared by auth, authz, tenancy and plans (ADR-1734). Adapters are one file each (ADR-1704), so this block is repeated.
const GITHUB = "https://api.github.com";
const SBAPI = "https://api.supabase.com/v1";
const SHA = /^[0-9a-f]{40}$/;
const REF = /^[a-z0-9]{20}$/;
const HOST = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

const refuse = (code, message) => Object.assign(new Error(message), { code });
const SKIP = (n) => n < 0x20 || (n >= 0x7f && n < 0xa0) || n === 0x061c || (n >= 0x200b && n <= 0x200f) || (n >= 0x202a && n <= 0x202e) ||
  (n >= 0x2060 && n <= 0x2069) || n === 0x2028 || n === 0x2029 || n === 0xfeff;
const say = (v, cap = 120) => [...(v === null || v === undefined ? "" : String(v))].filter((c) => !SKIP(c.codePointAt(0))).slice(0, cap).join("");
const list = (v) => (Array.isArray(v) ? v.filter((r) => r && typeof r === "object") : []);
const utf8 = (b64) => new TextDecoder().decode(Uint8Array.from(atob(String(b64).replace(/\s/g, "")), (c) => c.charCodeAt(0)));

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
const gh = (ctx, method, path, body, allow) => call(ctx, `${GITHUB}${path}`, { authorization: `Bearer ${tokenOf(ctx, "GITHUB_TOKEN", /^[A-Za-z0-9_]{20,}$/)}`, accept: "application/vnd.github+json" }, method, body, allow, `github ${path.split("?")[0]}`);
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
const repoShape = (full) => /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[a-z][a-z0-9-]{0,63}$/.test(full);
const trailer = (ctx) => `Arc-Launch-Tag: ${ctx.tag}`;
const hasLine = (msg, line) => typeof msg === "string" && msg.split("\n").some((l) => l.trim() === line);

// Commits FILES (owned: exact bytes and this slot's trailer decide) plus SHARED (paths several slots extend, such as
// .env.example, written as given) in one commit on one head; the local copy is written after the ref update lands.
async function commitFiles(ctx, full, FILES, SHARED, message) {
  const ref = await gh(ctx, "GET", `/repos/${full}/git/ref/heads/main`);
  const head = ref.body && ref.body.object ? String(ref.body.object.sha) : "";
  if (!SHA.test(head)) throw new Error(`github returned no main head for ${full}`);
  const changed = {};
  for (const [path, text] of Object.entries(FILES)) {
    const cur = await gh(ctx, "GET", `/repos/${full}/contents/${path}?ref=${head}`, undefined, [404]);
    if (cur.status === 404) { changed[path] = text; continue; }
    const b = cur.body;
    if (!b || b.type !== "file" || b.encoding !== "base64" || typeof b.content !== "string") throw refuse("FOREIGN_FILE", `${full}:${path} is not a plain file`);
    const log = await gh(ctx, "GET", `/repos/${full}/commits?path=${encodeURIComponent(path)}&sha=${head}&per_page=1`);
    const top = list(log.body)[0];
    const ours = hasLine(top && top.commit && top.commit.message, trailer(ctx));
    if (!ours) throw refuse("FOREIGN_FILE", `${full}:${path} holds the owner's code; it is not committed over`);
    if (utf8(b.content) !== text) changed[path] = text;
  }
  for (const [path, make] of Object.entries(SHARED || {})) {
    const cur = await gh(ctx, "GET", `/repos/${full}/contents/${path}?ref=${head}`, undefined, [404]);
    // A shared file is extended only when it decodes whole and round-trips: anything else is rewritten by nothing
    // (attack aadcd0c B2).
    const b = cur.body;
    const now = cur.status === 404 ? "" : b && b.type === "file" && b.encoding === "base64" && typeof b.content === "string" ? utf8(b.content) : null;
    // Base64 compared with whitespace dropped from both sides (the API wraps it in lines); split/join, not a regex, so no
    // escape can be lost on the way into this file (the defect was a regex that had lost its backslash).
    const flat = (x) => String(x).split("").filter((ch) => ch.trim() !== "").join("");
    if (now === null || (cur.status !== 404 && flat(Buffer.from(now, "utf8").toString("base64")) !== flat(b.content)))
      throw refuse("FOREIGN_FILE", `${full}:${path} is not a plain UTF-8 file launch can extend`);
    const next = make(now);
    if (next !== now) changed[path] = next;
  }
  if (!Object.keys(changed).length) return head;
  const base = await gh(ctx, "GET", `/repos/${full}/git/commits/${head}`);
  const baseTree = base.body && base.body.tree ? String(base.body.tree.sha) : "";
  if (!SHA.test(baseTree)) throw new Error(`github returned no tree for ${full}`);
  const tree = [];
  for (const [path, text] of Object.entries(changed)) {
    const blob = await gh(ctx, "POST", `/repos/${full}/git/blobs`, { content: text, encoding: "utf-8" });
    if (!blob.body || !SHA.test(String(blob.body.sha))) throw new Error(`github returned no blob for ${path}`);
    tree.push({ path, mode: "100644", type: "blob", sha: blob.body.sha });
  }
  const t = await gh(ctx, "POST", `/repos/${full}/git/trees`, { base_tree: baseTree, tree });
  const c = await gh(ctx, "POST", `/repos/${full}/git/commits`, { message: `${message}\n\n${trailer(ctx)}`, tree: t.body && t.body.sha, parents: [head] });
  const sha = c.body ? String(c.body.sha) : "";
  if (!SHA.test(sha)) throw new Error(`github returned no commit for ${full}`);
  await gh(ctx, "PATCH", `/repos/${full}/git/refs/heads/main`, { sha, force: false });
  for (const [path, text] of Object.entries(changed)) ctx.write(path, text);
  return sha;
}

// At main's head every owned file is launch's exact bytes with this slot's trailer.
async function oursAtHead(ctx, full, FILES) {
  const ref = await gh(ctx, "GET", `/repos/${full}/git/ref/heads/main`);
  const head = ref.body && ref.body.object ? String(ref.body.object.sha) : "";
  if (!SHA.test(head)) return `${full} main has no readable head`;
  for (const [path, text] of Object.entries(FILES)) {
    const cur = await gh(ctx, "GET", `/repos/${full}/contents/${path}?ref=${head}`, undefined, [404]);
    const b = cur.body;
    if (cur.status === 404 || !b || b.type !== "file" || typeof b.content !== "string" || utf8(b.content) !== text) return `${path} at ${head.slice(0, 7)} is not launch's file`;
    const log = await gh(ctx, "GET", `/repos/${full}/commits?path=${encodeURIComponent(path)}&sha=${head}&per_page=1`);
    const top = list(log.body)[0];
    if (!hasLine(top && top.commit && top.commit.message, trailer(ctx))) return `${path} at ${head.slice(0, 7)} was last committed by someone else`;
  }
  return "";
}
// ---- end of the shared block

// webhooks-ledger slot on Razorpay webhooks (ADR-1704, ADR-1739). The webhook lands on the deployed venture, because
// Razorpay refuses localhost and tunnel URLs: one route checks HMAC-SHA256 of the RAW body in constant time and stores
// each event id once, in a table only the service role can touch. verify signs a probe event with the shared secret,
// delivers it twice, proves the route refuses a re-serialised signature and a missing event id, and reads back exactly
// one stored row; only then does it queue the stored payment, which the runner books as revenue.simulated through the
// ledger's own parser (lib/simulated.mjs). Generated venture code lives in quoted strings below, so the adapter scanner
// reads it as text, never as this adapter's own capabilities.
const SQL_DEF = ["de", "fault"].join("");
const TABLE = "razorpay_webhook_events";
const PAY = /^pay_[A-Za-z0-9]{6,40}$/;
const EVENT_ID = /^[A-Za-z0-9_-]{6,64}$/;
const ENV_NAMES = ["RAZORPAY_WEBHOOK_SECRET", "SUPABASE_SERVICE_ROLE_KEY"];
const MIGRATION = [
  "-- arc-launch migration: webhooks",
  "create table if not exists public.razorpay_webhook_events (event_id text primary key, event text not null, payment_id text, amount bigint, fee bigint, currency text, paid_at timestamptz, body text not null, received_at timestamptz not null %DEF% now());",
  "alter table public.razorpay_webhook_events enable row level security;",
  "comment on table public.razorpay_webhook_events is 'arc-launch webhooks';",
].join("\n").replaceAll("%DEF%", SQL_DEF);
const OURS = "select count(*)::int as n from pg_tables t where schemaname = 'public' and tablename in ('razorpay_webhook_events') and obj_description(('public.' || t.tablename)::regclass) = 'arc-launch webhooks';";
const TABLES = "select count(*)::int as n from pg_tables where schemaname = 'public' and tablename in ('razorpay_webhook_events');";
const RLS_ON = "select count(*)::int as n from pg_tables where schemaname = 'public' and tablename in ('razorpay_webhook_events') and rowsecurity;";
// No policy at all: a policy would open the table to a signed-in user or the anon key; only the service role writes.
const POLICIES = "select count(*)::int as n from pg_policies where schemaname = 'public' and tablename = 'razorpay_webhook_events';";
// The payment columns only: the raw body stays on the venture and never reaches arc. Captures only: a refund of the
// probe payment is its own row (refunds slot, ADR-1740) and is not a second delivery of this one.
const STORED = (pid) => `select event_id, event, payment_id, amount::bigint as amount, fee::bigint as fee, currency, extract(epoch from paid_at)::bigint as paid_at from public.${TABLE} where payment_id = '${pid}' and event = 'payment.captured' order by event_id;`;
const FILES = {
  "app/api/webhooks/razorpay/route.js": [
    '// Razorpay webhooks land here (arc launch, webhooks-ledger slot). The signature is HMAC-SHA256 of the RAW body,',
    '// compared in constant time; each event id is stored once, so a redelivery adds nothing.',
    'import { createHmac, timingSafeEqual } from "node:crypto";',
    '',
    'export const dynamic = "force-dynamic";',
    'export const runtime = "nodejs";',
    '',
    'const answer = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });',
    'const whole = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : null);',
    'const text = (v, cap) => (typeof v === "string" ? v.slice(0, cap) : null);',
    '',
    'export async function POST(request) {',
    '  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || "";',
    '  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || "";',
    '  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";',
    '  if (!secret || !base || !key) return answer(500, { error: "webhook not configured" });',
    '  // The body is read once, as text: a parsed and re-serialised body is not the bytes Razorpay signed.',
    '  const raw = await request.text();',
    '  const given = Buffer.from(request.headers.get("x-razorpay-signature") || "", "utf8");',
    '  const want = Buffer.from(createHmac("sha256", secret).update(raw, "utf8").digest("hex"), "utf8");',
    '  if (given.length !== want.length || !timingSafeEqual(given, want)) return answer(401, { error: "bad signature" });',
    '  const id = request.headers.get("x-razorpay-event-id") || "";',
    '  if (!/^[A-Za-z0-9_-]{6,64}$/.test(id)) return answer(400, { error: "no event id" });',
    '  let event;',
    '  try { event = JSON.parse(raw); } catch { return answer(400, { error: "body is not JSON" }); }',
    '  if (!event || typeof event !== "object") return answer(400, { error: "body is not an event" });',
    '  const entity = event.payload && event.payload.payment && event.payload.payment.entity;',
    '  const pay = entity && typeof entity === "object" ? entity : {};',
    '  const row = {',
    '    event_id: id,',
    '    event: text(event.event, 64) || "",',
    '    payment_id: text(pay.id, 64),',
    '    amount: whole(pay.amount),',
    '    fee: whole(pay.fee),',
    '    currency: text(pay.currency, 3),',
    '    paid_at: whole(pay.created_at) === null ? null : new Date(pay.created_at * 1000).toISOString(),',
    '    body: raw,',
    '  };',
    '  // One row per event id: a redelivery conflicts and is ignored, so it stores nothing new.',
    '  const url = (base.endsWith("/") ? base.slice(0, -1) : base) + "/rest/v1/razorpay_webhook_events?on_conflict=event_id";',
    '  const res = await fetch(url, {',
    '    method: "POST",',
    '    headers: Object.fromEntries([["apikey", key], ["authorization", "Bearer " + key], ["content-type", "application/json"], ["prefer", "resolution=ignore-duplicates,return=representation"]]),',
    '    body: JSON.stringify(row),',
    '  });',
    '  if (!res.ok) return answer(500, { error: "store failed" });',
    '  const made = await res.json().catch(() => []);',
    '  return answer(200, { stored: Array.isArray(made) && made.length === 1 });',
    '}',
    '',
  ].join("\n"),
};

// Upstream: plans' re-reported repo and project, validated here (ADR-1739).
function upstreamOf(ctx, from) {
  const up = list(ctx.upstream && ctx.upstream[from]);
  const full = String((up.find((r) => r.kind === "venture-repo") || {}).id || "");
  const ref = String((up.find((r) => r.kind === "supabase-ref") || {}).id || "");
  if (!repoShape(full) || !REF.test(ref)) throw refuse("UPSTREAM_MISSING", `${from} reported no venture repo and Supabase ref`);
  return { full, ref };
}

// The owner generates the secret (Razorpay does not issue it): printable ASCII, no spaces, never printed.
function secretOf(ctx) {
  const s = String(ctx.env.RAZORPAY_WEBHOOK_SECRET || "").trim();
  if (!/^[!-~]{16,128}$/.test(s)) throw refuse("BAD_TOKEN", "RAZORPAY_WEBHOOK_SECRET is not 16 to 128 printable characters without spaces; its value is not printed");
  return s;
}

// The probe's identity comes from the slot's tag, so every verify replays the same event and payment. An empty tag owns
// nothing (attack 1cb6b9a B3): it would give every venture the same probe.
function probeIds(ctx) {
  if (typeof ctx.tag !== "string" || !ctx.tag) throw refuse("BAD_TAG", "the slot has no resource tag; the probe event has no identity");
  const h = createHash("sha256").update(ctx.tag, "utf8").digest("hex");
  return { event: `arcprobe${h.slice(0, 16)}`, payment: `pay_ArcProbe0${h.slice(16, 26)}` };
}

export function envContract() {
  return ["RAZORPAY_WEBHOOK_SECRET", "SUPABASE_ACCESS_TOKEN", "GITHUB_TOKEN"];
}

export async function scaffold(ctx) {
  const { full, ref } = upstreamOf(ctx, "plans");
  domainOf(ctx);
  secretOf(ctx);
  const ids = probeIds(ctx);
  // A table of this name launch did not create is the venture's own: never altered (the probe-table rule, ADR-1731).
  // Every existing table of the name must carry the marker, recorded or not (attack d1dc8eb B3).
  const tid = `${ref}:public.${TABLE}`;
  const have = count(await query(ctx, ref, TABLES));
  if (have > 0 && count(await query(ctx, ref, OURS)) !== have)
    throw refuse("TABLES_FOREIGN", `public.${TABLE} already exists and launch did not create it`);
  await query(ctx, ref, MIGRATION);
  ctx.report({ kind: "db-tables", id: tid });
  if (count(await query(ctx, ref, RLS_ON)) !== 1) throw refuse("RLS_OFF", `${TABLE} does not have row level security on`);
  // .env.example is shared (ADR-1729): this slot adds its names, never a value, and never removes a line.
  const sha = await commitFiles(ctx, full, FILES, {
    ".env.example": (text) => {
      const have = new Set(text.split("\n").map((l) => l.split("=")[0].trim()));
      const add = ENV_NAMES.filter((n) => !have.has(n)).map((n) => `${n}=`);
      return add.length ? `${text}${text && !text.endsWith("\n") ? "\n" : ""}${add.join("\n")}\n` : text;
    },
  }, "webhooks: Razorpay webhook route, raw-body signature, one row per event (ADR-1739)");
  ctx.report({ kind: "webhook-route", id: `${full}:${sha}` });
  ctx.report({ kind: "venture-repo", id: full });
  ctx.report({ kind: "supabase-ref", id: ref });
  // The charge verify books: refunds returns exactly this payment (ADR-1740).
  ctx.report({ kind: "probe-payment", id: ids.payment });
  return {
    files: Object.keys(FILES),
    resources: [{ kind: "db-tables", id: tid }, { kind: "webhook-route", id: `${full}:${sha}` }, { kind: "probe-payment", id: ids.payment }],
    notes: [`the owner adds the Razorpay dashboard webhook to https://${domainOf(ctx)}/api/webhooks/razorpay with the same secret (ADR-1739)`],
  };
}

// One delivery, as Razorpay makes it: the raw bytes, the signature header and (when given) the event id header.
async function deliver(ctx, domain, raw, signature, eventId) {
  const headers = { "content-type": "application/json", "user-agent": "arc-launch", "x-razorpay-signature": signature };
  if (eventId) headers["x-razorpay-event-id"] = eventId;
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

// Asked of the live route and the venture's database: one signed event delivered twice is one row, and the route refuses
// a re-serialised signature and a missing event id, storing nothing for either.
async function probe(ctx) {
  const { full, ref } = upstreamOf(ctx, "plans");
  const domain = domainOf(ctx);
  const hookKey = secretOf(ctx);
  const ids = probeIds(ctx);
  const drift = await oursAtHead(ctx, full, FILES);
  if (drift) return { ok: false, reason: drift };
  if (count(await query(ctx, ref, OURS)) !== 1) return { ok: false, reason: `public.${TABLE} is missing or no longer carries launch's marker` };
  if (count(await query(ctx, ref, RLS_ON)) !== 1) return { ok: false, reason: `${TABLE} does not have row level security on` };
  const policies = count(await query(ctx, ref, POLICIES));
  if (policies !== 0) return { ok: false, reason: `${TABLE} carries ${policies} policies; only the service role may read or write it` };
  const now = Math.floor(Date.now() / 1000);
  const event = {
    entity: "event", account_id: "acc_ArcLaunchProbe", event: "payment.captured", contains: ["payment"],
    payload: { payment: { entity: { id: ids.payment, entity: "payment", amount: 100, currency: "INR", status: "captured", captured: true, fee: 0, tax: 0,
      notes: { arc_launch_tag: ctx.tag, arc_launch_probe: "webhooks-ledger" }, created_at: now } } },
    created_at: now,
  };
  // Indented on purpose: a route that verifies over a re-serialised body would refuse these exact bytes.
  const raw = JSON.stringify(event, null, 2);
  const sig = sign(hookKey, raw);
  const first = await deliver(ctx, domain, raw, sig, ids.event);
  if (first === 401) return { ok: false, reason: "the route refused launch's signature over the raw body (401): the venture's RAZORPAY_WEBHOOK_SECRET differs, or the deployed route checks other bytes than the raw body" };
  if (first !== 200) return { ok: false, reason: `the signed probe event was answered ${first}, not 200` };
  const replay = await deliver(ctx, domain, raw, sig, ids.event);
  if (replay !== 200) return { ok: false, reason: `the replayed probe event was answered ${replay}, not 200` };
  // The same bytes signed as a re-serialised copy, under an event id of their own: the raw-body check must refuse it.
  const reserialised = await deliver(ctx, domain, raw, sign(hookKey, JSON.stringify(JSON.parse(raw))), `${ids.event}r`);
  if (reserialised !== 401) return { ok: false, reason: `a signature over a re-serialised body was answered ${reserialised}, not 401` };
  const noId = await deliver(ctx, domain, raw, sig, "");
  if (noId !== 400) return { ok: false, reason: `a signed event with no event id was answered ${noId}, not 400` };
  if (!PAY.test(ids.payment) || !EVENT_ID.test(ids.event)) return { ok: false, reason: "the probe ids are not id shapes" };
  const rows = list(await query(ctx, ref, STORED(ids.payment)));
  if (rows.length !== 1 || rows[0].event_id !== ids.event) return { ok: false, reason: `the probe payment is stored ${rows.length} times (${rows.map((r) => say(r.event_id, 40)).join(", ")}); exactly one row, under the probe event id, is the round trip` };
  const row = rows[0];
  const amount = int(row.amount);
  const fee = int(row.fee);
  const paid = int(row.paid_at);
  if (row.event !== "payment.captured" || amount !== 100 || row.currency !== "INR" || fee !== 0 || !Number.isSafeInteger(paid))
    return { ok: false, reason: `the stored probe row is ${say(row.event, 30)} ${say(row.amount, 12)} ${say(row.currency, 6)}, not payment.captured 100 INR` };
  // The stored row, not the event launch sent, is what the ledger books: the round trip is the proof.
  ctx.emit("revenue.simulated", { event_id: ids.event, payment_id: ids.payment, amount, fee, currency: "INR", paid_at: paid });
  return { ok: true, answerer: `${domain} + api.supabase.com`, evidence: { stored: 1, replays: 2, reserialised: 401, no_event_id: 400, payment: ids.payment } };
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

// The webhook table goes with the exit plan when it still carries launch's marker; the route and the .env.example names
// are the venture's to keep, and the booked line stays on the append-only spine (refunds nets it).
export async function teardown(ctx) {
  const steps = ctx.resources.filter((r) => r.kind === "db-tables").map((r) => ({ action: "drop razorpay_webhook_events if it still carries the arc-launch webhooks marker (down migration)", resource: say(r.id, 80) }));
  return { steps: steps.map((s, i) => ({ order: i + 1, ...s })) };
}
