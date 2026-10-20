// domain slot on an owner-held Cloudflare zone (ADR-1766, ADR-1704 four functions). A real venture's domain is bought
// by the owner; launch never buys, edits or deletes it. Gate 1 is the owner's attestation that the domain is his, with
// WHOIS privacy on; this adapter then proves what something outside the repo can answer:
//   - Cloudflare holds exactly one zone of that name, `active`, with its assigned nameservers;
//   - both public resolvers return those nameservers for the apex (the delegation is live, not just configured);
//   - the registry's RDAP record says registered, not on hold or in redemption, and not expiring within 30 days.
// Every call is a GET: there is no write path in this file to reach by mistake.
const API = "https://api.cloudflare.com/client/v4";
const HOST = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
// The registry RDAP servers this row's hosts[] can reach, by TLD. A TLD outside it is a named failure, never a guess.
const RDAP = { com: "https://rdap.verisign.com/com/v1", net: "https://rdap.verisign.com/net/v1" };
const BAD_STATUS = ["client hold", "server hold", "redemption period", "pending delete", "pending restore", "inactive"];
const MIN_DAYS = 30;

const bare = (h) => String(h || "").trim().toLowerCase().replace(/\.$/, "");
const refuse = (code, message) => Object.assign(new Error(message), { code });
// Provider and resolver text reaches the runner's reason and the board: controls, bidi, invisible marks and line
// separators are dropped and the length capped by code point (the dns adapter's rule, attack 74c7f5a B4, fb3a494 B3).
const SKIP = (n) => n < 0x20 || (n >= 0x7f && n < 0xa0) || n === 0x061c || (n >= 0x200b && n <= 0x200f) || (n >= 0x202a && n <= 0x202e) ||
  (n >= 0x2060 && n <= 0x2069) || n === 0x2028 || n === 0x2029 || n === 0xfeff;
const say = (v, cap = 120) => [...(v === null || v === undefined ? "" : String(v))].filter((c) => !SKIP(c.codePointAt(0))).slice(0, cap).join("");
const list = (v) => (Array.isArray(v) ? v.filter((r) => r && typeof r === "object") : []);
const sameSet = (a, b) => a.length > 0 && a.length === b.length && a.every((x) => b.includes(x));

function domainOf(ctx) {
  const d = bare(ctx.profile && ctx.profile.brand && ctx.profile.brand.domain);
  if (!HOST.test(d)) throw refuse("BAD_DOMAIN", `brand.domain ${JSON.stringify(say(d, 80))} is not a plain hostname`);
  return d;
}

// The token is checked before it reaches a header: a CR from a CRLF env file makes fetch throw a TypeError quoting the
// whole header, secret included (attack fb3a494 B1). Transport errors are rethrown without their text.
function token(ctx) {
  const t = String(ctx.env.CLOUDFLARE_API_TOKEN || "").trim();
  if (!/^[A-Za-z0-9_-]{20,}$/.test(t)) throw refuse("BAD_TOKEN", "CLOUDFLARE_API_TOKEN is not a token shape (letters, digits, _ and -, 20 or more); its value is not printed");
  return t;
}

async function getJson(ctx, url, headers, what) {
  let res;
  try { res = await ctx.fetch(url, { method: "GET", headers }); } catch (e) {
    if (e && e.code) throw e;
    throw new Error(`${what} -> transport error (${say(e && e.name, 30) || "unknown"})`);
  }
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  return { res, json };
}

async function zoneNamed(ctx, d) {
  const { res, json } = await getJson(ctx, `${API}/zones?name=${encodeURIComponent(d)}`, { authorization: `Bearer ${token(ctx)}` }, "cloudflare GET /zones");
  if (!res.ok || !json || json.success !== true) {
    const errs = list(json && json.errors).slice(0, 3).map((e) => `${say(e.code, 12)}: ${say(e.message)}`).join("; ");
    throw new Error(`cloudflare GET /zones -> ${res.status}${errs ? ` (${errs})` : ""}`);
  }
  const zones = list(json.result).filter((z) => typeof z.name === "string" && bare(z.name) === d && typeof z.id === "string");
  if (zones.length === 0) throw refuse("NO_ZONE", `no Cloudflare zone this token can see is named ${d}`);
  if (zones.length > 1) throw refuse("ZONE_AMBIGUOUS", `${zones.length} Cloudflare zones are named ${d}; name one by hand`);
  return zones[0];
}

export function envContract() {
  return ["CLOUDFLARE_API_TOKEN"];
}

// Creates nothing. It records the zone it found, so dns and teardown can name it; a zone it did not find is refused
// before anything else runs.
export async function scaffold(ctx) {
  const zone = await zoneNamed(ctx, domainOf(ctx));
  ctx.report({ kind: "cloudflare-zone", id: zone.id });
  return { files: [], resources: [{ kind: "cloudflare-zone", id: zone.id }], notes: ["owner-held zone recorded; launch never edits it"] };
}

const nsOf = (answer) => ((answer && answer.Answer) || []).filter((a) => a && a.type === 2).slice(0, 13).map((a) => bare(say(a.data, 253))).sort();

function rdapFacts(json, now) {
  const status = (Array.isArray(json && json.status) ? json.status : []).map((s) => String(s).toLowerCase());
  // Every expiration event counts and the EARLIEST wins: a record listing a stale and a renewed date must not pass on
  // whichever came first in the array, and a malformed date is no date at all (attack b5b09df L3).
  const dates = (Array.isArray(json && json.events) ? json.events : []).filter((e) => e && e.eventAction === "expiration")
    .map((e) => Date.parse(String(e.eventDate))).filter(Number.isFinite);
  const expires = dates.length ? Math.min(...dates) : NaN;
  return { status, expires: Number.isFinite(expires) ? new Date(expires).toISOString() : null, days: Number.isFinite(expires) ? Math.floor((expires - now) / 86400000) : null };
}

export async function verify(ctx) {
  const d = domainOf(ctx);
  const zone = await zoneNamed(ctx, d);
  const assigned = (Array.isArray(zone.name_servers) ? zone.name_servers : []).map((n) => bare(say(n, 253))).sort();
  if (zone.status !== "active") return { ok: false, reason: `zone:${say(zone.status, 20) || "unknown"} -- Cloudflare has not activated ${d} (nameservers not delegated yet)` };
  if (!assigned.length) return { ok: false, reason: `zone:no-nameservers -- Cloudflare reported no nameservers for ${d}` };

  const r = await ctx.probe.doh(d, "NS");
  const seen = { google: nsOf(r.google), cloudflare: nsOf(r.cloudflare) };
  if (!sameSet(seen.google, assigned) || !sameSet(seen.cloudflare, assigned))
    return { ok: false, reason: `zone:ns-mismatch -- ${d} NS is google ${say(seen.google.join(",")) || "none"} / cloudflare ${say(seen.cloudflare.join(",")) || "none"}, Cloudflare assigned ${say(assigned.join(","))}` };

  const tld = d.split(".").pop();
  if (!RDAP[tld]) return { ok: false, reason: `rdap:tld-unsupported -- no registry RDAP server for .${say(tld, 20)} in this row` };
  const { res, json } = await getJson(ctx, `${RDAP[tld]}/domain/${encodeURIComponent(d)}`, { accept: "application/rdap+json" }, "rdap GET /domain");
  if (res.status === 404) return { ok: false, reason: `rdap:not-registered -- the .${tld} registry has no record of ${d}` };
  if (!res.ok || !json) return { ok: false, reason: `rdap:unreadable -- the registry answered ${res.status}` };
  // The record must be the one asked for: a registry answer about another name proves nothing about this one (36e7ee4 L7).
  if (String(json.ldhName || "").toLowerCase() !== d) return { ok: false, reason: `rdap:wrong-record -- the registry answered for ${say(json.ldhName, 80) || "no name"}, not ${d}` };
  const f = rdapFacts(json, Date.now());
  const bad = f.status.filter((s) => BAD_STATUS.includes(s));
  if (bad.length) return { ok: false, reason: `rdap:status -- ${d} is ${say(bad.join(", "))}` };
  if (f.days === null) return { ok: false, reason: `rdap:no-expiry -- the registry record for ${d} carries no expiration event` };
  if (f.days < MIN_DAYS) return { ok: false, reason: `rdap:expiring -- ${d} expires in ${f.days} day(s) (${f.expires}); renew before launch builds on it` };

  return {
    ok: true, answerer: `api.cloudflare.com + dns.google + cloudflare-dns.com + ${new URL(RDAP[tld]).hostname}`,
    evidence: { domain: d, zone: zone.id, nameservers: assigned, resolvers: seen, rdap: { status: f.status.slice(0, 8).map((s) => say(s, 40)), expires: f.expires, days: f.days } },
  };
}

// The zone is the owner's: launch made nothing, so it has nothing to take down.
export async function teardown(ctx) {
  return { steps: [] };
}
