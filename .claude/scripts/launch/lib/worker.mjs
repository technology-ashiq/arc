// One attempt of one slot, run as a child of the runner so the slot timeout is a real kill (ADR-1718).
// It persists every reported resource BEFORE the adapter continues, so whatever kills this process, the record of
// what exists outlives it. Exit: 0 verified · 1 failed (reason in state) · 5 a sensitive action awaits the owner.
import { readFileSync } from "node:fs";
import { normalizeAdapter, digestOf } from "./scan.mjs";
import { loadCatalog, loadProfile, resolveBoard } from "./catalog.mjs";
import { loadState, saveState, slotRow, setSlot, resourceTag } from "./state.mjs";
import { makeCtx } from "./ctx.mjs";
import { clean } from "./board.mjs";
import { makeArcProbe } from "./arc-probe.mjs";

const a = JSON.parse(readFileSync(process.argv[2], "utf8"));
const profile = loadProfile(a.venture, a.venturesDir);
const slot = loadCatalog(a.catalog).find((s) => s.id === a.slot);
// The row the PARENT checked, not a fresh read: a registry swapped between the check and this import must not
// change the hosts, keys or sensitive actions the adapter runs under (attack 3b48ed1 B5).
const row = a.row;
const board = Object.fromEntries([...resolveBoard(loadCatalog(a.catalog), profile)].map(([k, v]) => [k, { applies: v.applies, reason: v.reason }]));

const save = (patch) => {
  const s = loadState(a.stateDir, a.venture);
  saveState(a.stateDir, setSlot(s, a.slot, patch));
};
// In verify mode a refusal (missing key, drift) is recorded as the probe's answer; the slot's state is never touched.
const fail = (reason, flags = {}) => {
  save(a.mode === "verify" ? { last_verify: { ok: false, at: new Date().toISOString(), answerer: null, reason, ...flags } } : { state: "failed", reason });
  process.exit(1);
};

// Hash and run the SAME bytes: read once, check the pinned digest, import those bytes from a data: URL -- a file
// swapped after the check is never the code that runs (attack 3b48ed1 B5).
const source = normalizeAdapter(readFileSync(a.adapterPath, "utf8"));
if (row.digest && digestOf(source) !== row.digest) fail("refused:DIGEST_DRIFT adapter changed between the check and the run");

// The adapter sees only the keys its row declares, never the rest of the environment (other providers' tokens),
// even through module top-level code -- the scrub happens before the import (attack 3b48ed1 B2).
const declared = new Set(row.env_keys || []);
const OS_KEYS = new Set(["PATH", "Path", "SYSTEMROOT", "SystemRoot", "TEMP", "TMP", "HOME", "USERPROFILE", "WINDIR", "windir"]);
const kept = {};
for (const k of Object.keys(process.env)) {
  if (declared.has(k)) kept[k] = process.env[k];
  if (!declared.has(k) && !OS_KEYS.has(k)) delete process.env[k];
}

const mod = await import(`data:text/javascript;base64,${Buffer.from(source, "utf8").toString("base64")}`);
const keys = mod.envContract();
const undeclared = keys.filter((k) => !declared.has(k));
if (undeclared.length) fail(`refused:ENV_UNDECLARED ${undeclared.join(", ")} not in the row's env_keys`);
const missing = keys.filter((k) => !kept[k]);
// missing_env is set here and only here, so an adapter whose reason merely starts "env:" is not a skipped slot (attack 143525f B9).
if (missing.length) fail(`env:${missing[0]}`, { missing_env: true });

const ac = new AbortController();
const timer = setTimeout(() => ac.abort(), Math.max(1, Number(a.timeout) * 1000 - 100));
const st0 = loadState(a.stateDir, a.venture);
const prior = slotRow(st0, a.slot);
// Only a VERIFIED dependency's resources reach the adapter: a failed or half-run upstream attempt can hold a stale
// value, and an adapter would build on it (attack fb3a494 B4).
const upstream = Object.fromEntries((slot.depends_on || []).map((d) => { const r = slotRow(st0, d); return [d, r.state === "verified" ? r.resources || [] : []]; }));
const ctx = makeCtx({
  profile, board, slot, row, root: a.ventureRoot, resources: prior.resources, upstream, tag: resourceTag(a.venture, a.slot, row.id),
  attempt: a.attempt, signal: ac.signal, env: Object.fromEntries(keys.map((k) => [k, kept[k]])), approvals: prior.approvals || [],
  arcProbe: makeArcProbe({ venture: a.venture, profile, catalog: a.catalog, stateDir: a.stateDir }),
  report(resource) {
    const cur = slotRow(loadState(a.stateDir, a.venture), a.slot);
    if (cur.resources.some((r) => r.kind === resource.kind && r.id === resource.id)) return;
    save({ resources: [...cur.resources, resource] });
  },
});

// verify-only: ask the outside world again about a slot already applied; never scaffold, never change its state --
// the answer is recorded beside it as last_verify, so drift is visible without un-doing the board (LAU-P).
if (a.mode === "verify") {
  let v;
  try { v = await mod.verify(ctx); } catch (e) { v = { ok: false, reason: e.code ? `refused:${e.code}` : `error:${e.message}` }; }
  clearTimeout(timer);
  const ok = !!(v && v.ok === true && typeof v.answerer === "string" && v.answerer);
  save({ last_verify: { ok, at: new Date().toISOString(), answerer: ok ? v.answerer : null, reason: ok ? null : (v && v.reason) || "verify:no answerer named" } });
  process.exit(ok ? 0 : 1);
}

try {
  const out = await mod.scaffold(ctx);
  save({ state: "applied", files: (out && out.files) || [], queued: ctx.queued });
  const v = await mod.verify(ctx);
  clearTimeout(timer);
  if (v && v.ok === true && typeof v.answerer === "string" && v.answerer) {
    save({ state: "verified", answerer: v.answerer, evidence: v.evidence ?? null, queued: ctx.queued, verified_at: new Date().toISOString() });
    process.exit(0);
  }
  // A named ABSENT is an answer only where the slot's own exit criteria allow one, and only when something outside the
  // repo observed the absence; an adapter can never mark any other slot absent (ADR-1745).
  const allowsAbsent = (slot.exit_criteria || []).some((c) => /\bABSENT\b/.test(String(c)));
  if (v && v.ok === false && allowsAbsent && typeof v.absent === "string" && v.absent && typeof v.answerer === "string" && v.answerer) {
    // Adapter text is data: controls and bidi marks replaced, cut by code point so no surrogate is split (b6ffd12 B2).
    const cut = (t, n) => [...clean(t)].slice(0, n).join("");
    save({ state: "absent", reason: `ABSENT(${cut(v.absent, 160)})`, answerer: cut(v.answerer, 120), queued: [], verified_at: new Date().toISOString() });
    process.exit(0);
  }
  fail(v && v.ok === true ? "verify:no answerer named (a probe names what answered it)" : `verify:${(v && v.reason) || "failed"}`);
} catch (e) {
  clearTimeout(timer);
  if (e.code === "APPROVAL_PENDING") { save({ state: "awaiting-approval", pending_action: e.action, queued: ctx.queued }); process.exit(5); }
  if (e.code === "ABORTED" || e.name === "AbortError") fail("timeout");
  fail(e.code ? `refused:${e.code} ${e.message}` : `error:${e.message}`);
}
