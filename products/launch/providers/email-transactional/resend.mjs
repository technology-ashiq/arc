// email-transactional slot on Resend (ADR-1704, ADR-1732). Creates (or finds) the Resend domain for the brand domain,
// writes every record Resend lists plus DMARC (p=quarantine) on the Cloudflare zone, DNS-only and tagged in each record's
// comment, then asks Resend to verify. verify asks Resend (verified = DKIM passes for the mail it signs) and both public
// resolvers (DMARC at p=quarantine, SPF present).
const RESEND = "https://api.resend.com";
const CF = "https://api.cloudflare.com/client/v4";
const DMARC = "v=DMARC1; p=quarantine; adkim=s; aspf=s;";

const refuse = (code, message) => Object.assign(new Error(message), { code });
const SKIP = (n) => n < 0x20 || (n >= 0x7f && n < 0xa0) || n === 0x061c || (n >= 0x200b && n <= 0x200f) || (n >= 0x202a && n <= 0x202e) ||
  (n >= 0x2060 && n <= 0x2069) || n === 0x2028 || n === 0x2029 || n === 0xfeff;
const say = (v, cap = 120) => [...(v === null || v === undefined ? "" : String(v))].filter((c) => !SKIP(c.codePointAt(0))).slice(0, cap).join("");
const list = (v) => (Array.isArray(v) ? v.filter((r) => r && typeof r === "object") : []);
const HOST = /^(?=.{1,253}$)(?:[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const bare = (h) => String(h || "").trim().toLowerCase().replace(/\.$/, "");
const TYPES = new Set(["TXT", "CNAME", "MX"]);
// A double quote, by code: the adapter scanner reads quote characters in a regex literal as the start of a string.
const Q = String.fromCharCode(34);
const unquote = (v) => { let s = String(v || "").trim(); if (s.startsWith(Q)) s = s.slice(1); if (s.endsWith(Q)) s = s.slice(0, -1); return s; };
// Which single-per-name policy a TXT is (SPF, DMARC) or none: two of the same policy at one name is a conflict.
const policyOf = (v) => { const m = unquote(v).match(/^v=(spf1|DMARC1)\b/i); return m ? m[1].toLowerCase() : null; };

function tokenOf(ctx, key, shape) {
  const t = String(ctx.env[key] || "").trim();
  if (!shape.test(t)) throw refuse("BAD_TOKEN", `${key} is not a token shape; its value is not printed`);
  return t;
}

async function call(ctx, url, auth, method, body, allow, what) {
  let res;
  try {
    res = await ctx.fetch(url, { method, headers: { authorization: `Bearer ${auth}`, "content-type": "application/json", "user-agent": "arc-launch" }, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (e) {
    if (e && e.code) throw e;
    throw new Error(`${what} ${method} -> transport error (${say(e && e.name, 30) || "unknown"})`);
  }
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, ok: res.ok || (allow || []).includes(res.status), body: json };
}
async function rs(ctx, method, path, body, allow) {
  const r = await call(ctx, `${RESEND}${path}`, tokenOf(ctx, "RESEND_API_KEY", /^re_[A-Za-z0-9_]{16,}$/), method, body, allow, `resend ${path.split("?")[0]}`);
  if (r.ok) return r;
  const msg = r.body && typeof r.body.message === "string" ? `: ${say(r.body.message)}` : "";
  throw new Error(`resend ${method} ${path.split("?")[0]} -> ${r.status}${msg}`);
}
async function cf(ctx, method, path, body) {
  const r = await call(ctx, `${CF}${path}`, tokenOf(ctx, "CLOUDFLARE_API_TOKEN", /^[A-Za-z0-9_-]{20,}$/), method, body, [], `cloudflare ${path.split("?")[0]}`);
  if (r.ok && r.body && r.body.success === true) return r.body.result;
  const errs = list(r.body && r.body.errors).slice(0, 3).map((e) => `${say(e.code, 12)}: ${say(e.message)}`).join("; ");
  throw new Error(`cloudflare ${method} ${path.split("?")[0]} -> ${r.status}${errs ? ` (${errs})` : ""}`);
}

function domainOf(ctx) {
  const d = bare(ctx.profile && ctx.profile.brand && ctx.profile.brand.domain);
  if (!HOST.test(d) || d.includes("_")) throw refuse("BAD_DOMAIN", `brand.domain ${JSON.stringify(say(d, 80))} is not a plain hostname`);
  return d;
}

async function zoneOf(ctx, name) {
  const labels = name.split(".");
  for (let i = 0; i < labels.length - 1; i++) {
    const cand = labels.slice(i).join(".");
    const z = list(await cf(ctx, "GET", `/zones?name=${encodeURIComponent(cand)}`)).find((r) => bare(r.name) === cand && typeof r.id === "string");
    if (z) return z;
  }
  throw refuse("NO_ZONE", `no Cloudflare zone this token can see holds ${name}`);
}

// Resend's records, validated: a name under the brand domain, a known type, a value of bounded length. The provider's
// answer is another party's text and decides what launch writes to DNS.
// Names are read by one rule (attack 8a0ae88 B1): a name ending in the zone's apex is absolute; `@` is the apex; any
// other is relative to the ZONE apex, the way Resend lists them (`send.sandbox` under automemory.ai). Guessing against the
// brand domain doubled a subdomain into `send.sandbox.sandbox.automemory.ai`.
function wanted(domain, apex, records) {
  const out = [];
  for (const r of list(records)) {
    const type = String(r.type || r.record || "").toUpperCase();
    const rawName = bare(r.name);
    const name = rawName === "@" ? apex : rawName === apex || rawName.endsWith(`.${apex}`) ? rawName : rawName ? `${rawName}.${apex}` : "";
    const content = String(r.value || "").trim();
    const priority = r.priority === undefined || r.priority === null ? undefined : Number(r.priority);
    if (!TYPES.has(type)) throw refuse("BAD_RECORD", `resend listed a ${say(type, 10)} record; only TXT, CNAME and MX are written`);
    if (!HOST.test(name) || !(name === domain || name.endsWith(`.${domain}`))) throw refuse("BAD_RECORD", `resend listed record name ${JSON.stringify(say(rawName, 80))} outside ${domain}`);
    if (!content || content.length > 2048 || /[\r\n]/.test(content)) throw refuse("BAD_RECORD", `resend listed an unusable value for ${name}`);
    if (type === "MX" && !(Number.isInteger(priority) && priority >= 0 && priority <= 65535)) throw refuse("BAD_RECORD", `resend listed an MX for ${name} without a priority`);
    out.push({ type, name, content, ...(type === "MX" ? { priority } : {}) });
  }
  if (!out.length) throw refuse("BAD_RECORD", "resend listed no DNS records for the domain");
  out.push({ type: "TXT", name: `_dmarc.${domain}`, content: DMARC });
  return out;
}

export function envContract() {
  return ["RESEND_API_KEY", "CLOUDFLARE_API_TOKEN"];
}

// Every page of the domain list: a domain past the first page must be found, never re-created (attack cc949ef B5).
async function findDomain(ctx, domain) {
  let after = "";
  for (let page = 0; page < 50; page++) {
    const r = (await rs(ctx, "GET", `/domains?limit=100${after ? `&after=${encodeURIComponent(after)}` : ""}`)).body;
    const rows = list(r && r.data);
    const hit = rows.find((d) => bare(d.name) === domain);
    if (hit) return hit;
    if (!(r && r.has_more === true) || !rows.length || typeof rows[rows.length - 1].id !== "string") return null;
    after = rows[rows.length - 1].id;
  }
  throw refuse("TOO_MANY_DOMAINS", "resend lists more than 5000 domains; launch does not search further");
}

export async function scaffold(ctx) {
  const domain = domainOf(ctx);
  let dom = await findDomain(ctx, domain);
  let kind = "resend-domain";
  if (dom) kind = ctx.resources.some((r) => r.kind === "resend-domain" && r.id === String(dom.id)) ? "resend-domain" : "resend-domain-found";
  else dom = (await rs(ctx, "POST", "/domains", { name: domain })).body;
  if (!dom || typeof dom.id !== "string") throw new Error(`resend returned no domain id for ${domain}`);
  ctx.report({ kind, id: dom.id });

  const detail = (await rs(ctx, "GET", `/domains/${encodeURIComponent(dom.id)}`)).body;
  const zone = await zoneOf(ctx, domain);
  const recs = wanted(domain, bare(zone.name), detail && detail.records);
  // Every conflict is found BEFORE anything is written: a refusal half-way would leave Resend a partial record set
  // (attack cc949ef B6). One DMARC and one SPF per name is the rule a resolver enforces: a same-policy record launch
  // did not create is the owner's, and is refused rather than doubled.
  const plan = [];
  for (const want of recs) {
    // Read by NAME, every type: a CNAME shares its name with nothing, so any record there conflicts with one, and a CNAME
    // there conflicts with anything. Launch's own record matches on type and content (or SPF/DMARC policy), so two
    // wanted records at one name never claim the same existing one (attack 8a0ae88 B6).
    const existing = list(await cf(ctx, "GET", `/zones/${zone.id}/dns_records?name=${encodeURIComponent(want.name)}`));
    const same = (r) => r.type === want.type && (want.type !== "TXT" ? true : policyOf(want.content) ? policyOf(r.content) === policyOf(want.content) : unquote(r.content) === want.content);
    const mine = existing.find((r) => r.comment === ctx.tag && same(r));
    const foreign = existing.filter((r) => r.comment !== ctx.tag && (want.type === "CNAME" || r.type === "CNAME" || (r.type === want.type && (want.type !== "TXT" || (policyOf(want.content) && policyOf(r.content) === policyOf(want.content))))));
    if (!mine && foreign.length)
      throw refuse("FOREIGN_RECORD", `${want.name} already has a ${want.type} record launch did not create; launch does not write over it`);
    plan.push({ want, mine });
  }
  for (const { want, mine } of plan) {
    const body = { type: want.type, name: want.name, content: want.content, ttl: 1, proxied: false, comment: ctx.tag, ...(want.priority !== undefined ? { priority: want.priority } : {}) };
    let rec = mine;
    if (!rec) rec = await cf(ctx, "POST", `/zones/${zone.id}/dns_records`, body);
    else if (unquote(rec.content) !== want.content) rec = await cf(ctx, "PATCH", `/zones/${zone.id}/dns_records/${rec.id}`, body);
    if (!rec || typeof rec.id !== "string") throw new Error(`cloudflare returned no record id for ${want.name}`);
    ctx.report({ kind: "dns-record", id: `${zone.id}/${rec.id}` });
  }
  await rs(ctx, "POST", `/domains/${encodeURIComponent(dom.id)}/verify`);
  return { files: [], resources: [{ kind, id: dom.id }], notes: [] };
}

const wait = (ms, signal) => new Promise((res, rej) => {
  if (signal && signal.aborted) return rej(refuse("ABORTED", "slot timeout reached"));
  const onAbort = () => { clearTimeout(t); rej(refuse("ABORTED", "slot timeout reached")); };
  const t = setTimeout(() => { if (signal) signal.removeEventListener("abort", onAbort); res(); }, ms);
  if (signal) signal.addEventListener("abort", onAbort, { once: true });
});

// A TXT answer arrives quoted and may be split into 255-byte strings: the pieces are joined, the quotes dropped.
const txts = (answer) => list(answer && answer.Answer).filter((a) => a.type === 16).map((a) => unquote(String(a.data || "").split(`${Q} ${Q}`).join("")));

// Asked of Resend and of both public resolvers; eight polls, 30 s apart, inside the slot's 300 s timeout.
async function probe(ctx) {
  const domain = domainOf(ctx);
  const dom = await findDomain(ctx, domain);
  if (!dom) return { ok: false, reason: `resend has no domain ${domain}` };
  let last = "";
  for (let i = 0; i < 8; i++) {
    if (i) await wait(30000, ctx.signal);
    const d = (await rs(ctx, "GET", `/domains/${encodeURIComponent(dom.id)}`)).body;
    const st = say(d && d.status, 30);
    const dm = await ctx.probe.doh(`_dmarc.${domain}`, "TXT");
    const sp = await ctx.probe.doh(domain, "TXT");
    const dmarcOk = [dm.google, dm.cloudflare].every((a) => txts(a).some((t) => /^v=DMARC1;/i.test(t) && /(^|;)\s*p=quarantine\s*(;|$)/i.test(t)));
    const spfOk = [sp.google, sp.cloudflare].some((a) => txts(a).some((t) => /^v=spf1\s/i.test(t))) || list(d && d.records).some((r) => /spf/i.test(String(r.record || "")) && /verified/i.test(String(r.status || "")));
    if (st === "verified" && dmarcOk && spfOk)
      return { ok: true, answerer: "api.resend.com + dns.google + cloudflare-dns.com", evidence: { domain, resend: st, dmarc: "p=quarantine", spf: true } };
    last = `resend ${st || "unknown"}; dmarc ${dmarcOk ? "ok" : "not quarantine at both resolvers"}; spf ${spfOk ? "ok" : "absent"}`;
    if (st === "failed") break;
  }
  return { ok: false, reason: last };
}

// verify answers; every failure but the slot timeout is a not-ok answer, never a throw out of a read.
export async function verify(ctx) {
  // Every answer below comes over ctx.fetch (api.resend.com) and ctx.probe (public resolvers); never state.
  const ask = ctx.fetch.bind(ctx);
  try {
    return await probe({ ...ctx, fetch: ask });
  } catch (e) {
    if (e && e.code === "ABORTED") throw e;
    return { ok: false, reason: `${(e && e.code) || "error"}: ${say(e && e.message)}` };
  }
}

// The records this slot wrote (its comment tag), then the Resend domain if launch created it.
export async function teardown(ctx) {
  const steps = [];
  for (const r of ctx.resources) if (r.kind === "dns-record") steps.push({ action: "delete-if-tagged", resource: r.id });
  for (const r of ctx.resources) if (r.kind === "resend-domain") steps.push({ action: "delete-domain", resource: r.id });
  return { steps: steps.map((s, i) => ({ order: i + 1, ...s })) };
}
