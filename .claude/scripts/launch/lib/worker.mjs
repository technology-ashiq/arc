// One attempt of one slot, run as a child of the runner so the slot timeout is a real kill (ADR-1718).
// It persists every reported resource BEFORE the adapter continues, so whatever kills this process, the record of
// what exists outlives it. Exit: 0 verified · 1 failed (reason in state) · 5 a sensitive action awaits the owner.
import { readFileSync, writeFileSync, mkdirSync, existsSync, realpathSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { homedir } from "node:os";
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

// Read before the scrub below removes it: a verify run may record every exchange its probe makes, raw, into a directory
// the operator names (outside any repo). A redaction pass turns it into the replay fixture CI runs (REQ-03).
const recordDir = a.mode === "verify" ? String(process.env.ARC_LAUNCH_RECORD || "") : "";

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
  arcProbe: makeArcProbe({ venture: a.venture, profile, catalog: a.catalog, stateDir: a.stateDir, root: a.ventureRoot }),
  // Every row's literal hosts, as the PARENT read them (ADR-1765); resolveHosts adds this row's own either way.
  registryHosts: Array.isArray(a.registryHosts) ? a.registryHosts : [],
  // The owner's private dir for this venture (ADR-1772): ARC_PRIVATE_DIR when set, as every arc tool reads it.
  privateRoot: join(process.env.ARC_PRIVATE_DIR || join(homedir(), ".arc-private"), "launch", a.venture),
  report(resource) {
    const cur = slotRow(loadState(a.stateDir, a.venture), a.slot);
    if (cur.resources.some((r) => r.kind === resource.kind && r.id === resource.id)) return;
    save({ resources: [...cur.resources, resource] });
  },
});

// verify-only: ask the outside world again about a slot already applied; never scaffold, never change its state --
// the answer is recorded beside it as last_verify, so drift is visible without un-doing the board (LAU-P).
if (a.mode === "verify") {
  // Every answer ctx.fetch receives, in order, with the inputs verify ran on: the probe is replayed from exactly these.
  const exchanges = [];
  // A raw record holds live keys and cookies: it is written only outside every git work tree (attack 9eaf4f1 B1), and
  // a URL never keeps a `key` query value (B2).
  // Every existing ancestor is read through its real path too, so a link from outside into a work tree counts as inside
  // (attack 1dc6035 B1).
  const insideRepo = (dir) => {
    for (let d = resolve(dir); ; d = dirname(d)) {
      let real = d;
      try { real = realpathSync(d); } catch { real = d; }
      if (existsSync(join(d, ".git")) || existsSync(join(real, ".git"))) return true;
      if (real !== d && insideRepo(real)) return true;
      if (dirname(d) === d) return false;
    }
  };
  const recording = recordDir && !insideRepo(recordDir);
  if (recordDir && !recording) process.stderr.write(`worker: ARC_LAUNCH_RECORD ${recordDir} is inside a git work tree; nothing is recorded\n`);
  if (recording) {
    const real = globalThis.fetch;
    // No userinfo and no secret-named query value is kept in a raw URL (B3).
    const urlOf = (u) => {
      try {
        const x = new URL(String(u));
        x.username = "";
        x.password = "";
        for (const k of [...x.searchParams.keys()]) if (/^(key|api_?key|token|secret|password|access_token)$/i.test(k)) x.searchParams.delete(k);
        return x.href;
      } catch { return "(not a URL)"; }
    };
    globalThis.fetch = async (u, init = {}) => {
      let res;
      // A request that never answered is recorded too, so the replay throws where the run threw (B3).
      try { res = await real(u, init); } catch (e) { exchanges.push({ method: String(init.method || "GET"), url: urlOf(u), error: String((e && e.name) || "Error") }); throw e; }
      let body = "";
      // The copy is read up to 2 MB and cancelled there, so a page streaming without end never stalls the record (B4).
      try {
        const c = res.clone();
        if (c.body && typeof c.body.getReader === "function") {
          const r = c.body.getReader();
          const dec = new TextDecoder();
          let n = 0;
          while (n < 2097152) { const { done, value } = await r.read(); if (done) break; n += value.length; body += dec.decode(value, { stream: true }); }
          await r.cancel().catch(() => {});
        } else body = await c.text();
      } catch { body = ""; }
      const headers = {};
      for (const [k, val] of res.headers) if (k !== "set-cookie") headers[k] = val;
      exchanges.push({ method: String(init.method || "GET"), url: urlOf(u), status: res.status, headers, setCookie: typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [], body });
      return res;
    };
  }
  let v;
  try { v = await mod.verify(ctx); } catch (e) { v = { ok: false, reason: e.code ? `refused:${e.code}` : `error:${e.message}` }; }
  clearTimeout(timer);
  // A record that cannot be written never costs the probe its answer (B4).
  if (recording) {
    try {
      mkdirSync(recordDir, { recursive: true });
      writeFileSync(join(recordDir, `${a.slot}.json`), JSON.stringify({ slot: a.slot, provider: row.id, recorded_at: new Date().toISOString(), profile, resources: prior.resources, upstream, env_keys: keys, exchanges, answer: v }, null, 1));
    } catch (e) { process.stderr.write(`worker: the record was not written (${(e && e.code) || "error"})\n`); }
  }
  const ok = !!(v && v.ok === true && typeof v.answerer === "string" && v.answerer);
  // A PENDING answer (REQ-18) keeps its name in the probe's reason, so verify --all says "still building", not a regression text.
  const pendingWhy = !ok && v && typeof v.pending === "string" && v.pending ? `PENDING(${[...clean(v.pending)].slice(0, 160).join("")})` : null;
  save({ last_verify: { ok, at: new Date().toISOString(), answerer: ok ? v.answerer : null, reason: ok ? null : pendingWhy || (v && v.reason) || "verify:no answerer named" } });
  // No process.exit here: on Windows, exiting while a provider's keep-alive socket is closing aborts node in libuv
  // (0xC0000409), and the runner read the crash as no answer though last_verify was saved. The loop drains instead.
  process.exitCode = ok ? 0 : 1;
  // A handle that never closes must not hold the runner to the slot timeout (attack 913d01d B5): unref'd, this fires only
  // while something else still keeps the loop alive.
  setTimeout(() => process.exit(ok ? 0 : 1), 10000).unref();
} else try {
  const out = await mod.scaffold(ctx);
  save({ state: "applied", files: (out && out.files) || [], queued: ctx.queued });
  // The in-attempt verify sees what this scaffold just reported: the ctx was built before it ran, so verify on that
  // snapshot read zero resources, failed, and the retry made a second test order (arc-sandbox payment-test, ADR-1760).
  // An unreadable state file at this moment falls back to the scaffold's own snapshot, never a TypeError (attack 913d01d B6).
  // The union with the snapshot, deduplicated by kind and id: an older state read never drops what this attempt knew
  // (attack d8f943a B3).
  const cur = loadState(a.stateDir, a.venture);
  const now = [];
  for (const r of [...ctx.resources, ...(cur ? slotRow(cur, a.slot).resources || [] : [])])
    if (r && !now.some((x) => x.kind === r.kind && x.id === r.id)) now.push(r);
  const v = await mod.verify(Object.freeze({ ...ctx, resources: now }));
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
  // PENDING (REQ-18, ADR-1771): the provider is still building what this slot's verify must read. Not failed and not
  // verified: the slot goes back to pending with a named reason, and a later apply asks again. Only an answer that
  // names what is pending and what answered counts; the runner exits 4, the walk's "waiting" code.
  if (v && v.ok === false && typeof v.pending === "string" && v.pending && typeof v.answerer === "string" && v.answerer) {
    const cut = (t, n) => [...clean(t)].slice(0, n).join("");
    save({ state: "pending", reason: `PENDING(${cut(v.pending, 160)})`, answerer: cut(v.answerer, 120), queued: [] });
    process.exit(4);
  }
  fail(v && v.ok === true ? "verify:no answerer named (a probe names what answered it)" : `verify:${(v && v.reason) || "failed"}`);
} catch (e) {
  clearTimeout(timer);
  if (e.code === "APPROVAL_PENDING") { save({ state: "awaiting-approval", pending_action: e.action, queued: ctx.queued }); process.exit(5); }
  if (e.code === "ABORTED" || e.name === "AbortError") fail("timeout");
  fail(e.code ? `refused:${e.code} ${e.message}` : `error:${e.message}`);
}
