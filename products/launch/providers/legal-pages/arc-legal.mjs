// legal-pages slot on arc-legal (ADR-1704, ADR-1745). arc-legal renders a venture's policy pages from its facts file,
// and publishing them is the owner's permanent human gate (`legal.publish`, legal lane REQ-06): launch never publishes.
// So scaffold creates nothing, and verify asks the live site: /privacy and /terms served as arc-legal pages is
// verified; both absent is the named ABSENT the slot's exit criterion allows ("legal renderer not ready"), observed
// by the site itself; anything between (one page, a non-arc page, an error) is not ok.
const HOST = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const PAGES = ["/privacy", "/terms"];
// arc-legal wraps every rendered clause in `<!-- clause:ID -->` ... `<!-- /clause:ID -->` (legal lib/template.mjs); a
// served page that keeps one closed pair is traceable to the renderer.
const MARK = /<!-- clause:([A-Za-z0-9._-]{1,80}) -->[\s\S]*?<!-- \/clause:\1 -->/;
const CAP = 1024 * 1024;

const refuse = (code, message) => Object.assign(new Error(message), { code });
const SKIP = (n) => n < 0x20 || (n >= 0x7f && n < 0xa0) || n === 0x061c || (n >= 0x200b && n <= 0x200f) || (n >= 0x202a && n <= 0x202e) ||
  (n >= 0x2060 && n <= 0x2069) || n === 0x2028 || n === 0x2029 || n === 0xfeff;
const say = (v, cap = 120) => [...(v === null || v === undefined ? "" : String(v))].filter((c) => !SKIP(c.codePointAt(0))).slice(0, cap).join("");

function domainOf(ctx) {
  const d = String((ctx.profile && ctx.profile.brand && ctx.profile.brand.domain) || "").trim().toLowerCase().replace(/\.$/, "");
  if (!HOST.test(d)) throw refuse("BAD_DOMAIN", `brand.domain ${JSON.stringify(say(d, 80))} is not a plain hostname`);
  return d;
}

export function envContract() {
  return [];
}

export async function scaffold(ctx) {
  const domain = domainOf(ctx);
  // Nothing is created: the pages are arc-legal's, published by the owner.
  for (const p of PAGES) ctx.report({ kind: "legal-url", id: `https://${domain}${p}` });
  return { files: [], resources: PAGES.map((p) => ({ kind: "legal-url", id: `https://${domain}${p}` })), notes: ["publish with arc-legal; the legal.publish approval is the owner's (ADR-1745)"] };
}

// One page: its status, and whether a bounded read of it carries arc-legal's generator mark.
async function page(ctx, url) {
  let res;
  try {
    res = await ctx.fetch(url, { method: "GET", headers: { "user-agent": "arc-launch", accept: "text/html" }, redirect: "manual" });
  } catch (e) {
    if (e && e.code) throw e;
    return { status: 0, arc: false };
  }
  if (res.status !== 200) { if (res.body) await res.body.cancel().catch(() => {}); return { status: res.status, arc: false }; }
  return { status: 200, arc: MARK.test(await capped(res)) };
}

// At most CAP bytes are read, then the stream is cancelled: a huge or slow-drip page cannot hold the slot (b6ffd12 B4).
async function capped(res) {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const parts = [];
  let n = 0;
  while (n < CAP) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    n += value.byteLength;
  }
  await reader.cancel().catch(() => {});
  const all = new Uint8Array(Math.min(n, CAP));
  let at = 0;
  for (const p of parts) { const take = p.subarray(0, Math.min(p.byteLength, all.byteLength - at)); all.set(take, at); at += take.byteLength; if (at >= all.byteLength) break; }
  return new TextDecoder().decode(all);
}

async function probe(ctx) {
  const domain = domainOf(ctx);
  const got = [];
  for (const p of PAGES) got.push({ path: p, ...(await page(ctx, `https://${domain}${p}`)) });
  if (got.every((g) => g.status === 200 && g.arc)) return { ok: true, answerer: domain, evidence: { pages: PAGES } };
  // Both answered 404 by a site that is itself up (its home page answers 200): the absence is observed outside the repo,
  // and the slot allows naming it. A dead or wrong site 404s everything and is never read as ABSENT (b6ffd12 B8).
  if (got.every((g) => g.status === 404) && (await page(ctx, `https://${domain}/`)).status === 200)
    return { ok: false, absent: "legal renderer not ready: /privacy and /terms are not served", answerer: domain, reason: "ABSENT: legal renderer not ready" };
  return { ok: false, reason: got.map((g) => `${g.path} ${g.status === 0 ? "unreachable" : g.status}${g.status === 200 && !g.arc ? " (not an arc-legal page)" : ""}`).join(", ") };
}

// verify answers; every failure but the slot timeout is a not-ok answer, never a throw out of a read.
export async function verify(ctx) {
  // Every answer below comes over ctx.fetch from the live site; never state.
  const ask = ctx.fetch.bind(ctx);
  try {
    return await probe({ ...ctx, fetch: ask });
  } catch (e) {
    if (e && e.code === "ABORTED") throw e;
    return { ok: false, reason: `${(e && e.code) || "error"}: ${say(e && e.message)}` };
  }
}

// Nothing was created; the published pages are the owner's.
export async function teardown(ctx) {
  return { steps: ctx.resources.filter((r) => r.kind === "legal-url").map((r, i) => ({ order: i + 1, action: "keep (published by the owner through arc-legal)", resource: say(r.id, 80) })) };
}
