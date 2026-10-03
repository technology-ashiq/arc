// One attempt of one slot, run as a child of the runner so the slot timeout is a real kill (ADR-1718).
// It persists every reported resource BEFORE the adapter continues, so whatever kills this process, the record of
// what exists outlives it. Exit: 0 verified · 1 failed (reason in state) · 5 a sensitive action awaits the owner.
import { resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { loadCatalog, loadRegistry, loadProfile, resolveBoard } from "./catalog.mjs";
import { loadState, saveState, slotRow, setSlot, resourceTag } from "./state.mjs";
import { makeCtx } from "./ctx.mjs";

const a = JSON.parse(process.argv[2]);
const profile = loadProfile(a.venture, a.venturesDir);
const slot = loadCatalog(a.catalog).find((s) => s.id === a.slot);
const row = loadRegistry(a.registry).find((r) => r.slot === a.slot && r.id === a.provider);
const board = Object.fromEntries([...resolveBoard(loadCatalog(a.catalog), profile)].map(([k, v]) => [k, { applies: v.applies, reason: v.reason }]));

const save = (patch) => {
  const s = loadState(a.stateDir, a.venture);
  saveState(a.stateDir, setSlot(s, a.slot, patch));
};
const fail = (reason) => { save({ state: "failed", reason }); process.exit(1); };

const mod = await import(pathToFileURL(resolve(dirname(a.registry), row.adapter)).href);
const keys = mod.envContract();
const missing = keys.filter((k) => !process.env[k]);
if (missing.length) fail(`env:${missing[0]}`);

const ac = new AbortController();
const timer = setTimeout(() => ac.abort(), Math.max(1, Number(a.timeout) * 1000 - 100));
const prior = slotRow(loadState(a.stateDir, a.venture), a.slot);
const ctx = makeCtx({
  profile, board, slot, row, root: a.ventureRoot, resources: prior.resources, tag: resourceTag(a.venture, a.slot, row.id),
  attempt: a.attempt, signal: ac.signal, env: Object.fromEntries(keys.map((k) => [k, process.env[k]])), approvals: prior.approvals || [],
  report(resource) {
    const cur = slotRow(loadState(a.stateDir, a.venture), a.slot);
    if (cur.resources.some((r) => r.kind === resource.kind && r.id === resource.id)) return;
    save({ resources: [...cur.resources, resource] });
  },
});

try {
  const out = await mod.scaffold(ctx);
  save({ state: "applied", files: (out && out.files) || [], queued: ctx.queued });
  const v = await mod.verify(ctx);
  clearTimeout(timer);
  if (v && v.ok === true && typeof v.answerer === "string" && v.answerer) {
    save({ state: "verified", answerer: v.answerer, evidence: v.evidence ?? null, queued: ctx.queued, verified_at: new Date().toISOString() });
    process.exit(0);
  }
  fail(v && v.ok === true ? "verify:no answerer named (a probe names what answered it)" : `verify:${(v && v.reason) || "failed"}`);
} catch (e) {
  clearTimeout(timer);
  if (e.code === "APPROVAL_PENDING") { save({ state: "awaiting-approval", pending_action: e.action, queued: ctx.queued }); process.exit(5); }
  if (e.code === "ABORTED" || e.name === "AbortError") fail("timeout");
  fail(e.code ? `refused:${e.code} ${e.message}` : `error:${e.message}`);
}
