// tls slot, certificate managed by Vercel (ADR-1704; REQ-06). Nothing is created: Vercel issues the certificate once
// the domain's DNS points at it. scaffold asks Vercel whether the domain is configured; verify asks a named outside
// scanner (SSL Labs) for a grade of A or better with HSTS present. A scan that is pending, rate-limited or unreachable is
// UNSCANNED(reason) -- never verified.
const VERCEL = "https://api.vercel.com";
const SSLLABS = "https://api.ssllabs.com/api/v3";
const GOOD = new Set(["A+", "A"]);

const refuse = (code, message) => Object.assign(new Error(message), { code });
const SKIP = (n) => n < 0x20 || (n >= 0x7f && n < 0xa0) || n === 0x061c || (n >= 0x200b && n <= 0x200f) || (n >= 0x202a && n <= 0x202e) ||
  (n >= 0x2060 && n <= 0x2069) || n === 0x2028 || n === 0x2029 || n === 0xfeff;
const say = (v, cap = 120) => [...(v === null || v === undefined ? "" : String(v))].filter((c) => !SKIP(c.codePointAt(0))).slice(0, cap).join("");
const list = (v) => (Array.isArray(v) ? v.filter((r) => r && typeof r === "object") : []);
const HOST = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

function domainOf(ctx) {
  const d = String((ctx.profile && ctx.profile.brand && ctx.profile.brand.domain) || "").trim().toLowerCase().replace(/\.$/, "");
  if (!HOST.test(d)) throw refuse("BAD_DOMAIN", `brand.domain ${JSON.stringify(say(d, 80))} is not a plain hostname`);
  return d;
}

function vercelToken(ctx) {
  const t = String(ctx.env.VERCEL_TOKEN || "").trim();
  if (!/^[A-Za-z0-9_-]{20,}$/.test(t)) throw refuse("BAD_TOKEN", "VERCEL_TOKEN is not a token shape; its value is not printed");
  return t;
}

async function get(ctx, url, headers) {
  let res;
  try { res = await ctx.fetch(url, { method: "GET", headers: { "user-agent": "arc-launch", ...headers } }); } catch (e) {
    if (e && e.code) throw e;
    return { status: 0, body: null, transport: say(e && e.name, 30) || "unknown" };
  }
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, body: json };
}

export function envContract() {
  return ["VERCEL_TOKEN"];
}

// The certificate is Vercel's, so launch reports what it relies on, not something it made: the exit plan has no step.
export async function scaffold(ctx) {
  const domain = domainOf(ctx);
  const conf = await get(ctx, `${VERCEL}/v6/domains/${domain}/config`, { authorization: `Bearer ${vercelToken(ctx)}` });
  if (conf.status !== 200 || !conf.body || typeof conf.body !== "object")
    throw new Error(`vercel GET /v6/domains/${domain}/config -> ${conf.status || `transport error (${conf.transport})`}`);
  if (conf.body.misconfigured !== false)
    throw refuse("DOMAIN_MISCONFIGURED", `vercel reports ${domain} as not yet configured; its DNS must point at Vercel before a certificate is issued (the dns slot)`);
  ctx.report({ kind: "tls-managed", id: domain });
  return { files: [], resources: [{ kind: "tls-managed", id: domain }], notes: [] };
}

const wait = (ms, signal) => new Promise((res, rej) => {
  if (signal && signal.aborted) return rej(refuse("ABORTED", "slot timeout reached"));
  const onAbort = () => { clearTimeout(t); rej(refuse("ABORTED", "slot timeout reached")); };
  const t = setTimeout(() => { if (signal) signal.removeEventListener("abort", onAbort); res(); }, ms);
  if (signal) signal.addEventListener("abort", onAbort, { once: true });
});

const unscanned = (why) => ({ ok: false, reason: `UNSCANNED(${say(why, 100)})` });

// Asked of SSL Labs: a cached result up to a day old is used first, then a scan is polled for up to ~4.5 minutes,
// inside the slot's 300 s timeout. Every endpoint (each IP the name resolves to) must grade A or better with HSTS.
async function probe(ctx) {
  const domain = domainOf(ctx);
  let url = `${SSLLABS}/analyze?host=${encodeURIComponent(domain)}&publish=off&fromCache=on&maxAge=24&all=done`;
  let last = "scan not started";
  for (let i = 0; i < 9; i++) {
    if (i) await wait(30000, ctx.signal);
    const r = await ctx.fetch(url, { method: "GET", headers: { "user-agent": "arc-launch" } }).then(
      async (res) => { let b = null; try { b = await res.json(); } catch { b = null; } return { status: res.status, body: b }; },
      (e) => { if (e && e.code) throw e; return { status: 0, body: null }; });
    url = `${SSLLABS}/analyze?host=${encodeURIComponent(domain)}&publish=off&all=done`;
    if (r.status === 0) return unscanned("ssllabs unreachable");
    if (r.status === 429 || r.status === 529) return unscanned(`ssllabs rate-limited (${r.status})`);
    if (r.status === 503) return unscanned("ssllabs unavailable (503)");
    if (r.status !== 200 || !r.body || typeof r.body !== "object") return unscanned(`ssllabs answered ${r.status}`);
    const status = say(r.body.status, 20);
    if (status === "ERROR") return unscanned(`ssllabs error: ${say(r.body.statusMessage)}`);
    if (status !== "READY") { last = `scan ${status || "pending"}`; continue; }
    const eps = list(r.body.endpoints);
    if (!eps.length) return unscanned("ssllabs returned no endpoints");
    const bad = eps.filter((e) => !GOOD.has(e.grade) || !(e.details && e.details.hstsPolicy && e.details.hstsPolicy.status === "present"));
    if (bad.length)
      return { ok: false, reason: `ssllabs: ${bad.map((e) => `${say(e.ipAddress, 45)} grade ${say(e.grade, 4) || "none"}${e.details && e.details.hstsPolicy && e.details.hstsPolicy.status === "present" ? "" : ", no HSTS"}`).join("; ")}` };
    return { ok: true, answerer: "api.ssllabs.com", evidence: { host: domain, grades: eps.map((e) => e.grade), hsts: true } };
  }
  return unscanned(last);
}

// verify answers; every failure but the slot timeout is a not-ok answer, never a throw out of a read.
export async function verify(ctx) {
  // Every answer below comes over ctx.fetch from api.ssllabs.com; the probe is the scanner, never state.
  const ask = ctx.fetch.bind(ctx);
  try {
    return await probe({ ...ctx, fetch: ask });
  } catch (e) {
    if (e && e.code === "ABORTED") throw e;
    return { ok: false, reason: `${(e && e.code) || "error"}: ${say(e && e.message)}` };
  }
}

export async function teardown() {
  return { steps: [] };
}
