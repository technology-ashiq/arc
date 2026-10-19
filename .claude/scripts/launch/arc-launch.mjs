#!/usr/bin/env node
// arc launch -- turn a venture.yaml into a receipted board, one slot at a time (ADR-1723: the CLI is the contract).
//
//   arc-launch new   --venture SLUG [--venture-root D]
//   arc-launch apply SLOT --venture SLUG --venture-root D [--provider ID] [--vet]
//   arc-launch apply --next|--all --venture SLUG --venture-root D   (core slots in DAG order; stops on any non-zero exit)
//   arc-launch plan | status | teardown --plan  --venture SLUG
//   arc-launch verify SLOT|--all --venture SLUG [--venture-root D] [--public-only]   (--public-only: the weekly watch)
//   arc-launch override SLOT --venture SLUG --provider ID --reason TEXT   (asks the owner; plan cites the decision)
//
//   path overrides (fixtures): --catalog P --registry P --providers-dir D --ventures-dir D --state-dir D
//
// Exit: 0 done/no-op · 1 slot failed · 2 refused · 3 lock held by a live apply · 4 unmet dependencies ·
//       5 awaiting the owner's approval.
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LaunchError, loadCatalog, loadRegistry, loadProfile, resolveBoard } from "./lib/catalog.mjs";
import { emptyState, loadState, saveState, setSlot } from "./lib/state.mjs";
import { apply, verifySlots, resolvePaths, emit, EXIT } from "./lib/runner.mjs";
import { query } from "../hq/spine.mjs";
import { spineRoot } from "../hq/lib/spine-io.mjs";
import { planLines, statusLines, teardownPlan, clean } from "./lib/board.mjs";
import { topoOrder } from "./lib/dag.mjs";

const VALUE_FLAGS = {
  "--venture": "venture", "--venture-root": "ventureRoot", "--provider": "provider", "--catalog": "catalog",
  "--registry": "registry", "--providers-dir": "providersDir", "--ventures-dir": "venturesDir", "--state-dir": "stateDir",
  "--reason": "reason",
};

export function parseArgs(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--vet") { o.vet = true; continue; }
    if (a === "--all") { o.all = true; continue; }
    if (a === "--next") { o.next = true; continue; }
    if (a === "--again") { o.again = true; continue; }
    if (a === "--plan") { o.plan = true; continue; }
    if (a === "--public-only") { o.publicOnly = true; continue; }
    if (VALUE_FLAGS[a]) {
      const v = argv[i + 1];
      if (v === undefined || v === "" || v.startsWith("--")) throw new LaunchError("BAD_ARGS", `${a} needs a value`);
      if (o[VALUE_FLAGS[a]] !== undefined) throw new LaunchError("BAD_ARGS", `${a} given twice`);
      o[VALUE_FLAGS[a]] = v;
      i++;
      continue;
    }
    if (a.startsWith("--")) throw new LaunchError("BAD_ARGS", `unknown flag ${a}`);
    o._.push(a);
  }
  return o;
}

function cmdNew(o) {
  const P = resolvePaths(o);
  const profile = loadProfile(o.venture, P.venturesDir);
  const board = resolveBoard(loadCatalog(P.catalog), profile);
  let state = loadState(P.stateDir, profile.slug, { onFallback: console.log });
  const fresh = !state;
  if (fresh) {
    state = emptyState(profile);
    if (o.ventureRoot) state.venture_root = resolve(o.ventureRoot);
    for (const [id, b] of board) setSlot(state, id, b.applies ? { state: "pending" } : { state: "skipped", reason: b.reason });
    state = saveState(P.stateDir, state);
  }
  const rows = [...board.values()];
  const n = (pred) => rows.filter(pred).length;
  console.log(`${profile.slug} (${profile.honesty_class}) -- board ${fresh ? "created" : "exists, unchanged"}`);
  console.log(`  ${rows.length} slots: ${n((b) => b.slot.tier === "core")} core · ${n((b) => b.slot.tier === "required")} required · ${n((b) => b.slot.tier === "optional")} optional`);
  console.log(`  applies to this venture: ${n((b) => b.applies)} · skipped: ${n((b) => !b.applies)}`);
  return EXIT.OK;
}

function board(o) {
  const P = resolvePaths(o);
  const slots = loadCatalog(P.catalog);
  const profile = loadProfile(o.venture, P.venturesDir);
  const state = loadState(P.stateDir, profile.slug, { onFallback: console.log });
  if (!state) throw new LaunchError("REFUSED", `no board for ${profile.slug} -- run new first`);
  return { P, slots, profile, state, board: resolveBoard(slots, profile) };
}

// plan: per slot, the recommendation and why -- or REFUSED. A view: it writes no state, applies nothing, and never
// names a fallback (ADR-1703).
// The approved overrides for one venture, newest decision per slot (ADR-1748). A request with no decision, or a
// rejected one, is not an override.
export async function overridesFor(slug) {
  const root = spineRoot();
  const asks = (await query(root, { kind: "approval.requested", engine: "scan" })).events.map((r) => r.event)
    .filter((e) => e && e.payload && e.payload.subject === OVERRIDE && e.payload.venture === slug && typeof e.payload.slot === "string" && typeof e.payload.provider === "string");
  const decided = new Map((await query(root, { kind: "decision.recorded", engine: "scan" })).events.map((r) => r.event)
    .filter((e) => e && e.payload && typeof e.payload.decides === "string").map((e) => [e.payload.decides, e]));
  const out = new Map();
  for (const a of asks) {
    const d = decided.get(a.id);
    if (!d || d.payload.verdict !== "approve") continue;
    const prev = out.get(a.payload.slot);
    if (!prev || prev.ts < d.ts) out.set(a.payload.slot, { provider: a.payload.provider, decision: d.id, ts: d.ts });
  }
  return out;
}
const OVERRIDE = "launch.override";

// override: a request, never a write to the plan. The owner decides it in arc-inbox; the next plan cites the decision.
function cmdOverride(o, slot) {
  const b = board(o);
  if (!b.board.has(slot)) { console.log(`unknown slot ${slot}`); return EXIT.REFUSED; }
  const row = loadRegistry(b.P.registry).find((r) => r.slot === slot && r.id === o.provider);
  if (!row) { console.log(`no provider row ${o.provider} for slot ${slot}`); return EXIT.REFUSED; }
  if (row.status === "blocked" || row.status === "retired") { console.log(`provider ${o.provider} is ${row.status}; it cannot be an override`); return EXIT.REFUSED; }
  const reason = String(o.reason || "").trim();
  if (reason.length < 8) { console.log("--reason must say why (8 characters or more)"); return EXIT.REFUSED; }
  const id = emit("approval.requested", { subject: OVERRIDE, what: `override ${slot} -> ${row.id} for ${b.profile.slug}`, venture: b.profile.slug, slot, provider: row.id, reason: reason.slice(0, 300) }, b.profile.slug, console.log);
  if (!id) return EXIT.FAILED;
  console.log(`${slot}: override ${row.id} requested -- approval.requested ${id}; decide with arc-inbox, then plan cites it`);
  return EXIT.AWAITING;
}

async function cmdPlan(o) {
  const b = board(o);
  const lines = planLines(b.slots, loadRegistry(b.P.registry), b.board, b.state, b.profile, await overridesFor(b.profile.slug));
  for (const l of lines) console.log(l.line);
  const refused = lines.filter((l) => l.refused).length;
  console.log(`${b.profile.slug}: ${lines.length} slots · ${refused} REFUSED (no vetted provider)`);
  return EXIT.OK;
}

function cmdStatus(o) {
  const b = board(o);
  for (const l of statusLines(b.slots, b.board, b.state)) console.log(l);
  const counts = {};
  for (const [id, x] of b.board) { const st = x.applies ? (b.state.slots[id] || {}).state || "pending" : "skipped"; counts[st] = (counts[st] || 0) + 1; }
  console.log(`${b.profile.slug} (${b.profile.honesty_class}): ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(" · ")}`);
  return EXIT.OK;
}

// apply --next / --all (ADR-1767): the core slots in topoOrder, one apply() each, stopping on the first non-zero exit.
// Required and optional slots are never walked -- a core slot depends on core slots only (ADR-1717), so the filtered
// order is closed. The walk answers no gate and writes no state of its own; apply() does both as it always has.
async function cmdWalk(o) {
  const P = resolvePaths(o);
  const slots = loadCatalog(P.catalog);
  const profile = loadProfile(o.venture, P.venturesDir);
  const order = topoOrder(slots.filter((s) => s.tier === "core"));
  const real = profile.honesty_class === "real";
  const retried = new Set();
  let applied = 0;
  const done = () => {
    const state = loadState(P.stateDir, profile.slug) || { slots: {} };
    const skipped = order.filter((id) => (state.slots[id] || {}).state === "skipped").length;
    console.log(`walk complete: ${applied} applied, ${skipped} skipped`);
    return EXIT.OK;
  };
  for (;;) {
    const state = loadState(P.stateDir, profile.slug, { onFallback: console.log });
    if (!state) { console.log(`no board for ${profile.slug} -- run new first`); return EXIT.REFUSED; }
    const at = (id) => (state.slots[id] || {}).state || "pending";
    const id = order.find((x) => !["verified", "skipped"].includes(at(x)) && !(at(x) === "absent" && !real));
    if (!id) return done();
    if (at(id) === "absent") { console.log(`stopped at ${id}: exit ${EXIT.REFUSED} absent on real`); return EXIT.REFUSED; }
    let last = "";
    const log = (line) => { console.log(line); last = String(line); };
    let code;
    try { code = await apply({ ...o, slot: id, again: false }, log); }
    catch (e) {
      if (!(e instanceof LaunchError)) throw e;
      code = e.exit || EXIT.REFUSED;
      log(e.message);
    }
    if (code === EXIT.OK) {
      const now = ((loadState(P.stateDir, profile.slug) || { slots: {} }).slots[id] || {}).state || "pending";
      // An exit 0 that left the slot where it was would be picked again forever; it is a stop, not a step.
      if (!["verified", "skipped", "absent"].includes(now)) { console.log(`stopped at ${id}: exit 0 but the slot is still ${now}`); return EXIT.FAILED; }
      // Only a slot this step verified was applied; a skip or a rehearsal's refusal-path absent is not (attack 74ba8f0 B4).
      if (now === "verified") applied++;
      if (o.next) return done();
      continue;
    }
    // A failed slot is retried once, at once; the second failure stops the walk and names itself. A refusal recorded
    // as the failure (`refused:` -- a rejected sensitive action, an undeclared key) is the owner's or the row's to
    // change, and a retry would only repeat it (attack 74ba8f0 B5).
    const why = String(((loadState(P.stateDir, profile.slug) || { slots: {} }).slots[id] || {}).reason || "");
    if (code === EXIT.FAILED && !retried.has(id) && !why.startsWith("refused:")) { retried.add(id); continue; }
    // The last line can carry an adapter's words; it is cleaned like every other adapter string (attack 74ba8f0 B6).
    console.log(`stopped at ${id}: exit ${code} ${clean(last)}`);
    return code;
  }
}

function cmdTeardownPlan(o) {
  const b = board(o);
  for (const l of teardownPlan(b.slots, b.state, b.profile)) console.log(l);
  return EXIT.OK;
}

export async function main(argv) {
  let o;
  try { o = parseArgs(argv); } catch (e) { console.log(e.message); return EXIT.REFUSED; }
  const [verb, slot] = o._;
  if (!o.venture) { console.log("--venture SLUG is required"); return EXIT.REFUSED; }
  try {
    if (verb === "new") return cmdNew(o);
    if (verb === "plan") return await cmdPlan(o);
    if (verb === "override") {
      if (!slot || !o.provider) { console.log("override needs a SLOT and --provider ID"); return EXIT.REFUSED; }
      return cmdOverride(o, slot);
    }
    if (verb === "status") return cmdStatus(o);
    if (verb === "verify") {
      if (o.all && slot) { console.log("verify takes a SLOT or --all, not both"); return EXIT.REFUSED; }
      if (!o.all && !slot) { console.log("verify needs a SLOT or --all"); return EXIT.REFUSED; }
      return await verifySlots({ ...o, slot });
    }
    if (verb === "teardown") {
      if (!o.plan) { console.log("teardown takes --plan only in v1; --apply is Cycle 2, behind approval gates"); return EXIT.REFUSED; }
      return cmdTeardownPlan(o);
    }
    if (verb === "apply") {
      if (o.next || o.all) {
        if (o.next && o.all) { console.log("apply takes --next or --all, not both"); return EXIT.REFUSED; }
        if (slot) { console.log("apply takes a SLOT or --next/--all, not both"); return EXIT.REFUSED; }
        if (o.again) { console.log("--again takes one SLOT"); return EXIT.REFUSED; }
        return await cmdWalk(o);
      }
      if (!slot) { console.log("apply needs a SLOT"); return EXIT.REFUSED; }
      return await apply({ ...o, slot });
    }
  } catch (e) {
    if (e instanceof LaunchError) { console.log(e.message); return EXIT.REFUSED; }
    throw e;
  }
  console.log(`unknown verb ${verb ?? "(none)"} -- new | plan | apply | verify | status | teardown | override`);
  return EXIT.REFUSED;
}

const invoked = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invoked) process.exitCode = await main(process.argv.slice(2));
