// dns slot on Cloudflare (ADR-1704 four functions, ADR-1725 target from hosting). One DNS-only CNAME from the venture's
// brand domain to the target the hosting slot reported. The record carries the resource tag in its `comment`, so a
// re-run finds what an earlier attempt created; a record with that name and any other comment is someone else's and
// is never touched. Grey cloud always: a proxied record hides the CNAME and breaks the hosting provider's TLS check.
const API = "https://api.cloudflare.com/client/v4";
const HOST = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

const bare = (h) => String(h || "").trim().toLowerCase().replace(/\.$/, "");
const refuse = (code, message) => Object.assign(new Error(message), { code });
// Provider and resolver text reaches the runner's reason and the board: controls, bidi and line separators are dropped
// and the length capped, so a hostile answer cannot forge or hide a line (attack 74c7f5a B4).
const SKIP = (n) => n < 0x20 || (n >= 0x7f && n < 0xa0) || (n >= 0x202a && n <= 0x202e) || (n >= 0x2066 && n <= 0x2069) || n === 0x2028 || n === 0x2029 || n === 0x200e || n === 0x200f;
const say = (v, cap = 120) => [...String(v)].filter((c) => !SKIP(c.codePointAt(0))).join("").slice(0, cap);

function hostName(value, what) {
  const h = bare(value);
  if (!HOST.test(h)) throw refuse("BAD_TARGET", `${what} ${JSON.stringify(say(value, 80))} is not a plain hostname`);
  return h;
}

// Upstream values are another adapter's output (ADR-1725): exactly one dns-target, and it must be a hostname.
function target(ctx) {
  const all = ((ctx.upstream && ctx.upstream.hosting) || []).filter((r) => r.kind === "dns-target");
  if (all.length !== 1) throw refuse("UPSTREAM_MISSING", `hosting reported ${all.length} dns-target resources; dns needs exactly one`);
  return hostName(all[0].id, "hosting dns-target");
}

async function cf(ctx, method, path, body) {
  const res = await ctx.fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${ctx.env.CLOUDFLARE_API_TOKEN}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  if (!res.ok || !json || json.success !== true) {
    const errs = ((json && json.errors) || []).slice(0, 3).map((e) => `${say(e.code, 12)}: ${say(e.message)}`).join("; ");
    throw new Error(`cloudflare ${method} ${path.split("?")[0]} -> ${res.status}${errs ? ` (${errs})` : ""}`);
  }
  return json.result;
}

// The zone is the longest suffix of the name that Cloudflare holds, never the bare TLD.
async function zoneOf(ctx, name) {
  const labels = name.split(".");
  for (let i = 0; i < labels.length - 1; i++) {
    const cand = labels.slice(i).join(".");
    const found = await cf(ctx, "GET", `/zones?name=${encodeURIComponent(cand)}`);
    const z = (found || []).find((r) => bare(r.name) === cand);
    if (z) return z;
  }
  throw refuse("NO_ZONE", `no Cloudflare zone this token can see holds ${name}`);
}

export function envContract() {
  return ["CLOUDFLARE_API_TOKEN"];
}

export async function scaffold(ctx) {
  const name = hostName(ctx.profile.brand && ctx.profile.brand.domain, "brand.domain");
  const to = target(ctx);
  const zone = await zoneOf(ctx, name);
  const records = await cf(ctx, "GET", `/zones/${zone.id}/dns_records?name=${encodeURIComponent(name)}`);
  const mine = (records || []).filter((r) => r.comment === ctx.tag);
  // ANY other record at the name refuses, TXT and MX included: a CNAME may not share its name with another record
  // (RFC 1034 3.6.2), so there is no type that could coexist with the one launch writes (attack 74c7f5a B6).
  const foreign = (records || []).filter((r) => r.comment !== ctx.tag);
  if (foreign.length)
    throw refuse("FOREIGN_RECORD", `${name} already has ${foreign.slice(0, 5).map((r) => `${say(r.type, 10)} ${say(r.id, 40)}`).join(", ")} not tagged ${ctx.tag}; launch never edits a record it did not create`);
  let rec = mine[0];
  if (!rec) {
    rec = await cf(ctx, "POST", `/zones/${zone.id}/dns_records`, { type: "CNAME", name, content: to, ttl: 1, proxied: false, comment: ctx.tag });
  } else if (rec.type !== "CNAME" || bare(rec.content) !== to || rec.proxied !== false) {
    rec = await cf(ctx, "PATCH", `/zones/${zone.id}/dns_records/${rec.id}`, { type: "CNAME", name, content: to, ttl: 1, proxied: false, comment: ctx.tag });
  }
  if (!rec || typeof rec.id !== "string") throw new Error("cloudflare returned no record id");
  ctx.report({ kind: "dns-record", id: `${zone.id}/${rec.id}` });
  return { files: [], resources: [{ kind: "dns-record", id: `${zone.id}/${rec.id}` }], notes: [] };
}

// An already-aborted signal never fires "abort" again, so it is checked first (attack 74c7f5a B1).
const wait = (ms, signal) => new Promise((res, rej) => {
  if (signal && signal.aborted) return rej(refuse("ABORTED", "slot timeout reached"));
  const onAbort = () => { clearTimeout(t); rej(refuse("ABORTED", "slot timeout reached")); };
  const t = setTimeout(() => { if (signal) signal.removeEventListener("abort", onAbort); res(); }, ms);
  if (signal) signal.addEventListener("abort", onAbort, { once: true });
});

const cnames = (answer) => ((answer && answer.Answer) || []).filter((a) => a && a.type === 5).slice(0, 8).map((a) => bare(say(a.data, 253)));

// Asked of two public resolvers, never of Cloudflare's API: the record existing is not the name resolving.
export async function verify(ctx) {
  const name = hostName(ctx.profile.brand && ctx.profile.brand.domain, "brand.domain");
  const to = target(ctx);
  let seen = null;
  for (let i = 0; i < 6; i++) {
    if (i) await wait(10000, ctx.signal);
    const r = await ctx.probe.doh(name, "CNAME");
    seen = { google: cnames(r.google), cloudflare: cnames(r.cloudflare) };
    if (seen.google.includes(to) && seen.cloudflare.includes(to))
      return { ok: true, answerer: "dns.google + cloudflare-dns.com", evidence: { name, cname: to, ...seen } };
  }
  return { ok: false, reason: `${name} CNAME not ${to} at both resolvers (google: ${say(seen.google.join(",")) || "none"}; cloudflare: ${say(seen.cloudflare.join(",")) || "none"})` };
}

export async function teardown(ctx) {
  return { steps: ctx.resources.filter((r) => r.kind === "dns-record").map((r, i) => ({ order: i + 1, action: "delete", resource: r.id })) };
}
