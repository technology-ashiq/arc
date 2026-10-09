// ledger-source slot (ADR-1704, ADR-1711, ADR-1751). The venture's revenue feed into arc's ledger is the webhook
// route and table webhooks-ledger proved, booked through the ledger's own parser (ADR-1739). This slot creates
// nothing; it registers that feed as the venture's ledger source and is verified by the first ingest receipt: arc's
// spine holds at least one revenue event for this venture, answered by arc's spine, never by state.
const SKIP = (n) => n < 0x20 || (n >= 0x7f && n < 0xa0) || n === 0x061c || (n >= 0x200b && n <= 0x200f) || (n >= 0x202a && n <= 0x202e) ||
  (n >= 0x2060 && n <= 0x2069) || n === 0x2028 || n === 0x2029 || n === 0xfeff;
const say = (v, cap = 120) => [...(v === null || v === undefined ? "" : String(v))].filter((c) => !SKIP(c.codePointAt(0))).slice(0, cap).join("");
const list = (v) => (Array.isArray(v) ? v.filter((r) => r && typeof r === "object") : []);
const refuse = (code, message) => Object.assign(new Error(message), { code });

export function envContract() {
  return [];
}

export async function scaffold(ctx) {
  const route = list(ctx.upstream && ctx.upstream["webhooks-ledger"]).find((r) => r.kind === "webhook-route");
  if (!route) throw refuse("UPSTREAM_MISSING", "webhooks-ledger reported no webhook route");
  ctx.report({ kind: "ledger-feed", id: `webhook:${route.id}` });
  return { files: [], resources: [{ kind: "ledger-feed", id: `webhook:${route.id}` }], notes: [] };
}

async function probe(ctx, ask) {
  const feed = ctx.resources.filter((r) => r.kind === "ledger-feed");
  if (feed.length !== 1) return { ok: false, reason: `state records ${feed.length} ledger feeds; verify needs exactly one` };
  const l = await ask("ledger");
  if (!l || !Number.isSafeInteger(l.count) || l.count < 1) return { ok: false, reason: "arc's spine holds no revenue event for this venture yet: no first ingest receipt" };
  return { ok: true, answerer: "arc spine", evidence: { first: say(l.first, 30), events: l.count, kinds: l.kinds } };
}

// verify answers; every failure but the slot timeout is a not-ok answer, never a throw out of a read.
export async function verify(ctx) {
  // The answer comes from arc's own organs through ctx.probe.arc (ADR-1751); never from state.
  const ask = ctx.probe.arc;
  try {
    return await probe(ctx, ask);
  } catch (e) {
    if (e && e.code === "ABORTED") throw e;
    return { ok: false, reason: `${(e && e.code) || "error"}: ${say(e && e.message)}` };
  }
}

// The feed is a registration: nothing to remove, and the booked lines stay on the append-only spine.
export async function teardown(ctx) {
  return { steps: ctx.resources.filter((r) => r.kind === "ledger-feed").map((r, i) => ({ order: i + 1, action: "none (the spine is append-only; the feed stops with the route)", resource: say(r.id, 80) })) };
}
