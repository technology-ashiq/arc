// Contract arms for the database slot's second provider, neon (ADR-1721, REQ-08): the REAL neon adapter under the REAL
// ctx against the in-memory Neon, and plan over a registry copy where both database rows are vetted. Prints
// `RAN <scenario>` first and `DONE <json>` last.
//   node tests/launch/contract-neon.mjs <scenario>
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { loadRegistry, loadCatalog, resolveBoard, PRODUCT } from "../../.claude/scripts/launch/lib/catalog.mjs";
import { makeCtx } from "../../.claude/scripts/launch/lib/ctx.mjs";
import { planLines } from "../../.claude/scripts/launch/lib/board.mjs";
import { emptyState } from "../../.claude/scripts/launch/lib/state.mjs";
import { makeNeon } from "./fakes/neon.mjs";

const scenario = process.argv[2];
console.log(`RAN ${scenario}`);
const rows = loadRegistry();
const row = rows.find((r) => r.id === "neon");
if (!row) { console.error("no neon row in the registry"); process.exit(1); }
const adapter = await import(pathToFileURL(join(PRODUCT, row.adapter)).href);
const KEY = "neon_fixture_key_0123456789abcdefABCDEF"; // gitleaks:allow -- fixture key, never real
const fake = makeNeon({ key: KEY, rlsOff: scenario === "rls-off", anonBypass: scenario === "anon-bypass", foreign: scenario === "foreign" });
globalThis.fetch = fake.fetch;
const ROOT = mkdtempSync(join(tmpdir(), "launch-neon-"));
process.on("exit", () => rmSync(ROOT, { recursive: true, force: true }));
const PROFILE = { slug: "arc-sandbox", type: "saas-b2b", region: "in", payment_model: "gateway", tenancy: "multi", honesty_class: "rehearsal", brand: { name: "arc sandbox", domain: "sandbox.automemory.ai" } };
const state = [];
const ctxNow = (env = { NEON_API_KEY: KEY }) => makeCtx({
  profile: PROFILE, board: {}, slot: { id: "database" }, row, root: ROOT, resources: state, upstream: {}, tag: "arc-sandbox@database@neon",
  attempt: 1, signal: undefined, env, report: (r) => { if (!state.some((x) => x.kind === r.kind && x.id === r.id)) state.push(r); },
});
const attempt = async (fn) => { try { return { ok: true, value: await fn() }; } catch (e) { return { ok: false, code: e.code || null, message: e.message }; } };

const out = { scenario };
switch (scenario) {
  case "thread":
    out.first = (await attempt(() => adapter.scaffold(ctxNow()))).ok;
    out.second = (await attempt(() => adapter.scaffold(ctxNow()))).ok;
    out.projects = fake.projects.length;
    out.kinds = state.map((r) => r.kind);
    out.verify = await adapter.verify(ctxNow());
    out.teardown = (await adapter.teardown(ctxNow())).steps.map((s) => s.action);
    break;
  case "rls-off":
  case "anon-bypass":
    await adapter.scaffold(ctxNow());
    out.verify = await adapter.verify(ctxNow());
    break;
  case "bad-key":
    out.scaffold = await attempt(() => adapter.scaffold(ctxNow({ NEON_API_KEY: "short" })));
    out.calls = fake.calls.length;
    break;
  case "plan-both": {
    // Both database rows vetted on a registry copy: plan ranks them, each with its fit-rule ids (REQ-08).
    const vet = (r) => (r.slot === "database" ? { ...r, status: "vetted", vetted_by: "01M40ZHP72PYVBJT17R7A4WZ3W", last_verified: r.id === "neon" ? "2026-10-01" : "2026-09-01" } : r);
    const slots = loadCatalog();
    const board = resolveBoard(slots, PROFILE);
    const lines = planLines(slots, rows.map(vet), board, emptyState(PROFILE), PROFILE);
    out.line = (lines.find((l) => l.id === "database") || {}).line || "";
    break;
  }
  default:
    console.error(`unknown scenario ${scenario}`);
    process.exit(1);
}
console.log(`DONE ${JSON.stringify(out)}`);
