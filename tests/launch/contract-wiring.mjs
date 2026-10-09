// Contract arms for the wiring block (ADR-1711, ADR-1751): the REAL ledger-source, venture-register, face-planned and
// teardown-render adapters under the REAL ctx with the REAL arc probe, over a temp spine and a temp board. Prints
// `RAN <scenario>` first and `DONE <json>` last.
//   node tests/launch/contract-wiring.mjs <scenario>
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { loadRegistry, loadCatalog, PRODUCT, PATHS } from "../../.claude/scripts/launch/lib/catalog.mjs";
import { makeCtx } from "../../.claude/scripts/launch/lib/ctx.mjs";
import { makeArcProbe } from "../../.claude/scripts/launch/lib/arc-probe.mjs";
import { emptyState, saveState, setSlot } from "../../.claude/scripts/launch/lib/state.mjs";

const scenario = process.argv[2];
console.log(`RAN ${scenario}`);
const SPINE = mkdtempSync(join(tmpdir(), "launch-wiring-spine-"));
const STATE = mkdtempSync(join(tmpdir(), "launch-wiring-state-"));
process.on("exit", () => { rmSync(SPINE, { recursive: true, force: true }); rmSync(STATE, { recursive: true, force: true }); });
process.env.ARC_SPINE_ROOT = SPINE;
const rows = loadRegistry();
const slots = loadCatalog();
const PROFILE = (slug) => ({ slug, type: "saas-b2b", region: "in", payment_model: "gateway", tenancy: "multi", honesty_class: "rehearsal",
  brand: { name: slug, domain: "sandbox.automemory.ai" }, repository: `technology-ashiq/${slug}`, kill_lines: { days_without_revenue: 90, traffic_floor_monthly: 100 } });
const run = async (slotId, providerId, { slug = "arc-sandbox", upstream = {}, resources = [] } = {}) => {
  const row = rows.find((r) => r.id === providerId);
  const slot = slots.find((s) => s.id === slotId);
  const mod = await import(pathToFileURL(join(PRODUCT, row.adapter)).href);
  const state = [...resources];
  const ctx = () => makeCtx({ profile: PROFILE(slug), board: {}, slot, row, root: STATE, resources: state, upstream, tag: `${slug}@${slotId}@${providerId}`, attempt: 1,
    signal: undefined, env: {}, report: (r) => { if (!state.some((x) => x.kind === r.kind && x.id === r.id)) state.push(r); },
    arcProbe: makeArcProbe({ venture: slug, profile: PROFILE(slug), catalog: PATHS.catalog, stateDir: STATE }) });
  let scaffold;
  try { scaffold = { ok: true, kinds: (await mod.scaffold(ctx())).resources.map((r) => r.kind) }; } catch (e) { scaffold = { ok: false, code: e.code || null }; }
  return { scaffold, verify: await mod.verify(ctx()) };
};

const out = { scenario };
const ROUTE = { "webhooks-ledger": [{ kind: "webhook-route", id: "technology-ashiq/arc-sandbox:abc1234" }] };
switch (scenario) {
  case "ledger": {
    out.before = await run("ledger-source", "ledger-source", { upstream: ROUTE });
    const { recordSimulated } = await import("../../.claude/scripts/launch/lib/simulated.mjs");
    out.book = recordSimulated("arc-sandbox", { payment_id: "pay_Wiring0123abcd", amount: 100, fee: 0, currency: "INR", paid_at: 1791000000 }, { process: "launch@0.1.0" }).state;
    out.after = await run("ledger-source", "ledger-source", { upstream: ROUTE });
    out.other = await run("ledger-source", "ledger-source", { slug: "someone-else", upstream: ROUTE });
    out.noRoute = await run("ledger-source", "ledger-source");
    break;
  }
  case "passport":
    out.result = await run("passport", "venture-register");
    break;
  case "face":
    out.unseated = await run("face-room", "face-planned");
    out.seated = await run("face-room", "face-planned", { slug: "lexos" });
    break;
  case "teardown": {
    let s = emptyState(PROFILE("arc-sandbox"));
    s = setSlot(s, "dns", { state: "verified", provider: "cloudflare-dns", resources: [{ kind: "dns-record", id: "rec_fixture01" }] });
    saveState(STATE, s);
    out.result = await run("teardown-plan", "teardown-render");
    break;
  }
  case "not-wiring": {
    // A non-wiring slot's ctx refuses arc's organs even when the runner supplies the probe.
    const row = rows.find((r) => r.id === "cloudflare-dns");
    const ctx = makeCtx({ profile: PROFILE("arc-sandbox"), board: {}, slot: slots.find((x) => x.id === "dns"), row, root: STATE, resources: [], upstream: {}, tag: "t", attempt: 1,
      signal: undefined, env: {}, report: () => {}, arcProbe: makeArcProbe({ venture: "arc-sandbox", profile: PROFILE("arc-sandbox"), catalog: PATHS.catalog, stateDir: STATE }) });
    try { await ctx.probe.arc("ledger"); out.code = "answered"; } catch (e) { out.code = e.code; }
    break;
  }
  default:
    console.error(`unknown scenario ${scenario}`);
    process.exit(1);
}
console.log(`DONE ${JSON.stringify(out)}`);
