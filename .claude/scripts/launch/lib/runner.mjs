// The durable runner (ADR-1718). The parent takes the venture lock, runs ONE attempt in a child worker under the
// slot's timeout (a real process kill, not a timer the adapter can ignore), then writes the receipt. The child
// persists state as it goes, so a kill at any point leaves what was created on the record for the next attempt.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, realpathSync, rmSync } from "node:fs";
import { join, resolve, dirname, relative, isAbsolute, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { hostname } from "node:os";
import { ROOT, PATHS, LaunchError, loadCatalog, loadRegistry, loadProfile, resolveBoard } from "./catalog.mjs";
import { adapterDigest } from "./scan.mjs";
import { clean } from "./board.mjs";
import { emptyState, loadState, saveState, slotRow, setSlot, receiptKey } from "./state.mjs";
import { recordSimulated } from "./simulated.mjs";
import { withLock, spineRoot, eventsDir } from "../../hq/lib/spine-io.mjs";

export const LAUNCH_VERSION = "0.1.0";
export const PROCESS = `launch@${LAUNCH_VERSION}`;
export const EXIT = { OK: 0, FAILED: 1, REFUSED: 2, LOCKED: 3, DEPS: 4, AWAITING: 5 };
const HERE = dirname(fileURLToPath(import.meta.url));
const WORKER = join(HERE, "worker.mjs");
const ARC_EVENT = join(ROOT, ".claude", "scripts", "hq", "arc-event.mjs");
const ROLLING = new Set(["gate-1", "gate-3"]); // gates a rehearsal venture exercises only through refusal (ADR-1700)

export function resolvePaths(o = {}) {
  return {
    catalog: resolve(o.catalog || PATHS.catalog),
    registry: resolve(o.registry || PATHS.registry),
    providersDir: resolve(o.providersDir || PATHS.providersDir),
    venturesDir: resolve(o.venturesDir || PATHS.venturesDir),
    stateDir: resolve(o.stateDir || PATHS.stateDir),
  };
}

// A receipt goes through arc-event --strict, so a refused event is a failure here, never a silent exit 0.
export function emit(kind, payload, slug, log) {
  const r = spawnSync(process.execPath, [ARC_EVENT, "emit", kind, "--strict", "--process", PROCESS, "--venture", slug, "--payload", JSON.stringify(payload)], { encoding: "utf8", timeout: 60000, killSignal: "SIGKILL" });
  const id = (r.stdout || "").trim().split("\n").pop();
  if (r.status !== 0 || !/^[0-9A-HJKMNP-TV-Z]{26}$/.test(id || "")) {
    log(`UNRECEIPTED: ${kind} was not recorded (${(r.stderr || "").trim().split("\n").pop() || `exit ${r.status}`})`);
    return null;
  }
  return id;
}

async function decisionFor(approvalId) {
  const { query } = await import("../../hq/spine.mjs");
  const { events } = await query(spineRoot(), { kind: "decision.recorded", engine: "scan" });
  const hit = events.map((e) => e.event.payload || {}).find((p) => p.decides === approvalId);
  return hit ? hit.verdict : null;
}

function lockHolder(stateDir, slug) {
  const p = join(eventsDir(join(stateDir, "locks")), `.${slug}.lock`);
  if (!existsSync(p)) return null;
  const [host, pid] = readFileSync(p, "utf8").trim().split("|");
  let alive = true;
  if (host === hostname()) { try { process.kill(Number(pid), 0); } catch (e) { alive = e.code === "EPERM"; } }
  return { pid, alive };
}

export function pickProvider(rows, slotId, profile, providerId, vet) {
  const forSlot = rows.filter((r) => r.slot === slotId);
  if (providerId) {
    const row = forSlot.find((r) => r.id === providerId);
    if (!row) throw new LaunchError("REFUSED", `no provider row ${providerId} for slot ${slotId}`);
    if (row.status === "blocked" || row.status === "retired") throw new LaunchError("REFUSED", `provider ${providerId} is ${row.status}${row.reason ? ` -- ${row.reason}` : ""}`);
    if (row.status === "candidate" && !vet) throw new LaunchError("REFUSED", `provider ${providerId} is a candidate; only a vet run (--vet) may run it`);
    return row;
  }
  const vetted = forSlot.filter((r) => r.status === "vetted");
  if (vetted.length === 0) throw new LaunchError("REFUSED", `REFUSED -- no vetted provider for ${slotId}`);
  if (vetted.length > 1) throw new LaunchError("REFUSED", `${vetted.length} vetted providers for ${slotId}; name one with --provider (plan ranks them)`);
  return vetted[0];
}

// The venture root is ctx.write's whole boundary, and arc's repo is public: a root that is arc itself, inside it,
// or above it would put venture code where ADR-1722 says it never goes (attack 3b48ed1 B9). ONE function, called
// by every verb that runs an adapter -- verify re-implemented half of it and left the rest open (attack 405007a B2).
export function checkVentureRoot(given) {
  if (!given) throw new LaunchError("REFUSED", "--venture-root is required; launch never guesses where a venture's repo lives");
  if (!existsSync(resolve(given))) throw new LaunchError("REFUSED", `--venture-root ${resolve(given)} does not exist`);
  const ventureRoot = realpathSync(resolve(given));
  const arcRoot = realpathSync(ROOT);
  const rel = relative(arcRoot, ventureRoot);
  const insideArc = rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
  const up = relative(ventureRoot, arcRoot);
  const aboveArc = up !== "" && !up.startsWith("..") && !isAbsolute(up);
  if (insideArc || aboveArc || dirname(ventureRoot) === ventureRoot)
    throw new LaunchError("REFUSED", `--venture-root ${ventureRoot} is ${insideArc ? "arc's own tree" : "an ancestor of arc's tree or a filesystem root"} -- a venture lives in its own repo (ADR-1722)`);
  return ventureRoot;
}

// The row's adapter path is data: it may only name `<id>.mjs` under the providers tree, never climb out of it or
// spell itself with backslashes that read differently per OS (attack 3b48ed1 B4), and a pinned digest must match.
// Shared by apply and verify for the same reason as checkVentureRoot (attack 405007a B1).
export function checkAdapter(P, prow) {
  const adapterPath = resolve(dirname(P.registry), String(prow.adapter));
  const inProviders = relative(P.providersDir, adapterPath);
  if (/\\|(^|\/)\.\.(\/|$)/.test(String(prow.adapter)) || inProviders.startsWith("..") || isAbsolute(inProviders) || basename(adapterPath) !== `${prow.id}.mjs`)
    throw new LaunchError("REFUSED", `${prow.id}'s adapter path ${prow.adapter} is not <id>.mjs inside the providers tree`);
  if (!existsSync(adapterPath)) throw new LaunchError("REFUSED", `candidate-unbuilt: ${prow.id}'s adapter ${prow.adapter} does not exist yet`);
  if (prow.status === "vetted" && !prow.digest) throw new LaunchError("REFUSED", `${prow.id} is vetted with no digest -- the registry is wrong (launch-lint)`);
  if (prow.digest && adapterDigest(adapterPath) !== prow.digest)
    throw new LaunchError("DIGEST_DRIFT", `${prow.id}'s adapter changed since it was vetted (digest drift) -- the row reads as candidate until the owner re-vets it`);
  return adapterPath;
}

export async function apply(opts, log = console.log) {
  const P = resolvePaths(opts);
  const slug = opts.venture;
  try {
    const slots = loadCatalog(P.catalog);
    const rows = loadRegistry(P.registry);
    const profile = loadProfile(slug, P.venturesDir);
    if (!opts.ventureRoot) throw new LaunchError("REFUSED", "--venture-root is required; launch never guesses where a venture's repo lives");
    const ventureRoot = checkVentureRoot(opts.ventureRoot);
    const board = resolveBoard(slots, profile);
    const entry = board.get(opts.slot);
    if (!entry) throw new LaunchError("REFUSED", `unknown slot ${opts.slot}`);
    const slot = entry.slot;
    let state = loadState(P.stateDir, slug, { onFallback: log }) || emptyState(profile);
    let row = slotRow(state, slot.id);

    if (!entry.applies) {
      saveUnderLock(P, slug, (s) => setSlot(s, slot.id, { state: "skipped", reason: entry.reason }), profile, log);
      log(`${slot.id}: skipped (${entry.reason})`);
      return EXIT.OK;
    }
    if (row.state === "verified") {
      log(`${slot.id}: verified -- no-op (receipt ${row.receipt})`);
      return EXIT.OK;
    }
    const unmet = (slot.depends_on || []).filter((d) => {
      const b = board.get(d);
      if (b && !b.applies) return false;
      return !["verified", "skipped", "absent"].includes(slotRow(state, d).state);
    });
    if (unmet.length) { log(`${slot.id}: waiting on ${unmet.join(", ")} (not verified, skipped or absent)`); return EXIT.DEPS; }

    const prow = pickProvider(rows, slot.id, profile, opts.provider, opts.vet);
    checkAdapter(P, prow);

    // Gates: rehearsal ventures exercise gate-1 and gate-3 through their refusal path only (ADR-1700, ADR-1720).
    if (slot.gate && slot.gate !== "none") {
      const res = await gate(P, slug, slot, prow, profile, state, row, log);
      if (res !== null) return res;
      state = loadState(P.stateDir, slug) || state;
      row = slotRow(state, slot.id);
    }
    if (row.state === "awaiting-approval" && row.pending_action) {
      const res = await sensitiveDecision(P, slug, slot, row, profile, log);
      if (res !== null) return res;
    }
    return runAttempt(P, slug, slot, prow, profile, ventureRoot, opts, log);
  } catch (e) {
    if (e.exit) { log(e.message); return e.exit; }
    if (e instanceof LaunchError || e.code === "DIGEST_DRIFT") { log(e.message); return EXIT.REFUSED; }
    throw e;
  }
}

async function gate(P, slug, slot, prow, profile, state, row, log) {
  const rehearsalRefuses = profile.honesty_class === "rehearsal" && ROLLING.has(slot.gate);
  // A rehearsal's refusal is terminal: a re-run refuses again from the record, never "awaiting" a decision that
  // could not change the answer, and never a second approval.requested (attack 06cbc03 L2).
  if (rehearsalRefuses && row.approval_id) {
    log(`${slot.id}: REFUSED -- a rehearsal venture never crosses ${slot.gate} (already recorded: ${row.approval_id})`);
    return EXIT.REFUSED;
  }
  if (row.approval_id && !row.gate_approved) {
    const verdict = await decisionFor(row.approval_id);
    if (!verdict) { log(`${slot.id}: awaiting the owner's decision on ${row.approval_id} (${slot.gate})`); return EXIT.AWAITING; }
    if (verdict !== "approve" || rehearsalRefuses) {
      saveUnderLock(P, slug, (s) => setSlot(s, slot.id, { state: rehearsalRefuses ? "absent" : "failed", reason: rehearsalRefuses ? `rehearsal never crosses ${slot.gate} (decision on ${row.approval_id}: ${verdict})` : `refused:${slot.gate} rejected` }), profile, log);
      log(`${slot.id}: ${slot.gate} not crossed (${verdict}${rehearsalRefuses ? ", rehearsal" : ""})`);
      return EXIT.REFUSED;
    }
    saveUnderLock(P, slug, (s) => setSlot(s, slot.id, { gate_approved: true }), profile, log);
    return null;
  }
  if (row.gate_approved) return null;
  // Check-then-emit happens under the venture lock, against a fresh read: two concurrent applies must not both
  // request, or the owner approves one id while state holds the other (attack 3b48ed1 B6).
  let id;
  try {
    id = underLock(P, slug, () => {
      const fresh = slotRow(loadState(P.stateDir, slug) || emptyState(profile), slot.id);
      if (fresh.approval_id) return { already: fresh.approval_id };
      const got = emit("approval.requested", { what: `${slot.gate}: ${slot.id} via ${prow.id} for ${slug}`, gate: slot.gate, slot: slot.id, provider: prow.id, venture: slug, honesty_class: profile.honesty_class }, slug, log);
      if (got) {
        const s = loadState(P.stateDir, slug) || emptyState(profile);
        saveState(P.stateDir, setSlot(s, slot.id, rehearsalRefuses
          ? { state: "absent", approval_id: got, reason: `rehearsal never crosses ${slot.gate} (approval.requested ${got} recorded, refusal path exercised)` }
          : { state: "awaiting-approval", approval_id: got, provider: prow.id }));
      }
      return got;
    }, log);
  } catch (e) {
    if (e.exit) { log(e.message); return e.exit; }
    throw e;
  }
  if (id && id.already) {
    if (rehearsalRefuses) { log(`${slot.id}: REFUSED -- a rehearsal venture never crosses ${slot.gate} (already recorded: ${id.already})`); return EXIT.REFUSED; }
    log(`${slot.id}: ${slot.gate} already requested (${id.already}); decide with arc-inbox, then apply again`);
    return EXIT.AWAITING;
  }
  if (!id) return EXIT.FAILED;
  if (rehearsalRefuses) {
    log(`${slot.id}: REFUSED -- a rehearsal venture never crosses ${slot.gate}; approval.requested ${id} recorded`);
    return EXIT.REFUSED;
  }
  log(`${slot.id}: ${slot.gate} -- approval.requested ${id}; decide with arc-inbox, then apply again`);
  return EXIT.AWAITING;
}

async function sensitiveDecision(P, slug, slot, row, profile, log) {
  const verdict = row.approval_id ? await decisionFor(row.approval_id) : null;
  if (!verdict) { log(`${slot.id}: sensitive action ${row.pending_action} awaiting ${row.approval_id}`); return EXIT.AWAITING; }
  if (verdict !== "approve") {
    saveUnderLock(P, slug, (s) => setSlot(s, slot.id, { state: "failed", reason: `refused:${row.pending_action} rejected` }), profile, log);
    return EXIT.REFUSED;
  }
  saveUnderLock(P, slug, (s) => setSlot(s, slot.id, { approvals: [...(row.approvals || []), row.pending_action], pending_action: null }), profile, log);
  return null;
}

function lockOpts(P, slug) {
  return { root: join(P.stateDir, "locks"), opt: { lockName: `.${slug}.lock`, timeoutMs: 500 } };
}

function underLock(P, slug, fn, log) {
  const held = lockHolder(P.stateDir, slug);
  // A live holder is refused HERE, not by waiting: withLock treats a holder older than ten minutes as a reused pid,
  // and a hosting apply may legitimately run fifteen.
  if (held && held.alive) throw Object.assign(new LaunchError("LOCKED", `another apply holds ${slug}'s lock (pid ${held.pid}); one apply at a time`), { exit: EXIT.LOCKED });
  if (held && !held.alive) log(`taking over the lock left by dead pid ${held.pid}`);
  const { root, opt } = lockOpts(P, slug);
  mkdirSync(root, { recursive: true });
  try {
    return withLock(root, fn, opt);
  } catch (e) {
    if (e.code === "LOCK_TIMEOUT") {
      const h = lockHolder(P.stateDir, slug);
      throw Object.assign(new LaunchError("LOCKED", `another apply holds ${slug}'s lock (pid ${h ? h.pid : "unknown"}); one apply at a time`), { exit: EXIT.LOCKED });
    }
    throw e;
  }
}

function saveUnderLock(P, slug, mutate, profile, log) {
  return underLock(P, slug, () => saveState(P.stateDir, mutate(loadState(P.stateDir, slug) || emptyState(profile))), log);
}

// `verify` re-asks the outside world about slots that are already verified or applied, one at a time. Everything a
// probe depends on -- the slot's state, its provider, its attempt, the adapter check -- is read INSIDE the venture
// lock, so a concurrent apply cannot change what is verified between the read and the run (attack 405007a B4).
// A lock held by a live apply skips that one slot and the loop goes on (B6). One run.completed per probe.
export async function verifySlots(opts, log = console.log) {
  const P = resolvePaths(opts);
  const slug = opts.venture;
  try {
    const slots = loadCatalog(P.catalog);
    const rows = loadRegistry(P.registry);
    const profile = loadProfile(slug, P.venturesDir);
    const state0 = loadState(P.stateDir, slug, { onFallback: log });
    if (!state0) throw new LaunchError("REFUSED", `no board for ${slug} -- run new first`);
    const ventureRoot = checkVentureRoot(opts.ventureRoot || state0.venture_root);
    if (opts.slot && !slots.some((s) => s.id === opts.slot)) throw new LaunchError("REFUSED", `unknown slot ${opts.slot}`);
    const ids = opts.slot ? [opts.slot] : slots.map((s) => s.id).filter((id) => ["verified", "applied"].includes(slotRow(state0, id).state));
    if (!ids.length) { log(`${slug}: nothing applied yet -- nothing to verify`); return EXIT.OK; }
    let ok = 0, failed = 0, skipped = 0;
    for (const id of ids) {
      const slot = slots.find((s) => s.id === id);
      let res;
      try {
        res = underLock(P, slug, () => probeOne(P, slug, slot, rows, profile, ventureRoot, log), log);
      } catch (e) {
        if (e.exit === EXIT.LOCKED) { log(`${id}: SKIPPED -- ${e.message}`); skipped++; continue; }
        if (e instanceof LaunchError || e.code === "DIGEST_DRIFT") { log(`${id}: UNVERIFIABLE -- ${e.message}`); failed++; continue; }
        throw e;
      }
      if (res) ok++; else failed++;
    }
    log(`${slug}: ${ok}/${ids.length} slot(s) verified now${failed ? ` · ${failed} failed` : ""}${skipped ? ` · ${skipped} skipped (locked)` : ""}`);
    return failed ? EXIT.FAILED : skipped ? EXIT.LOCKED : EXIT.OK;
  } catch (e) {
    if (e.exit) { log(e.message); return e.exit; }
    if (e instanceof LaunchError) { log(e.message); return EXIT.REFUSED; }
    throw e;
  }
}

// Runs under the venture lock. Returns true when the provider answered.
function probeOne(P, slug, slot, rows, profile, ventureRoot, log) {
  const id = slot.id;
  const r0 = slotRow(loadState(P.stateDir, slug), id);
  if (!["verified", "applied"].includes(r0.state)) throw new LaunchError("REFUSED", `${id} is ${r0.state}, not applied -- apply it first`);
  const prow = rows.find((r) => r.slot === id && r.id === r0.provider);
  if (!prow) throw new LaunchError("REFUSED", `no provider row ${r0.provider ?? "(none)"} for ${id}`);
  const adapterPath = checkAdapter(P, prow);
  // A stale answer must never be read as this probe's: clear it first, so a killed probe leaves "no answer" (B3).
  saveState(P.stateDir, setSlot(loadState(P.stateDir, slug), id, { last_verify: null }));
  const args = { ...P, mode: "verify", venture: slug, slot: id, provider: prow.id, row: prow, adapterPath, ventureRoot, attempt: r0.attempt || 0, timeout: slot.timeout };
  const argsFile = join(P.stateDir, `.${slug}.worker-args.json`);
  writeFileSync(argsFile, JSON.stringify(args));
  let r;
  try {
    r = spawnSync(process.execPath, [WORKER, argsFile], { stdio: "inherit", timeout: Number(slot.timeout || 300) * 1000, killSignal: "SIGKILL" });
  } finally {
    rmSync(argsFile, { force: true });
  }
  const lv = slotRow(loadState(P.stateDir, slug), id).last_verify;
  const timedOut = r.error && r.error.code === "ETIMEDOUT";
  const good = r.status === 0 && !!lv && lv.ok === true;
  const reason = good ? null : timedOut ? "timeout" : lv && lv.reason ? lv.reason : `worker ended without an answer (${r.signal ? `signal ${r.signal}` : `exit ${r.status}`})`;
  if (!lv) saveState(P.stateDir, setSlot(loadState(P.stateDir, slug), id, { last_verify: { ok: false, at: new Date().toISOString(), answerer: null, reason } }));
  emit("run.completed", { slot: id, provider: prow.id, honesty_class: profile.honesty_class, attempt: r0.attempt || 0, mode: "verify", outcome: good ? "ok" : "fail" }, slug, log);
  log(`${id}: ${good ? `verified now (answered by ${clean(lv.answerer)})` : `VERIFY FAILED -- ${clean(reason)}`}`);
  return good;
}

function runAttempt(P, slug, slot, prow, profile, ventureRoot, opts, log) {
  try {
    return underLock(P, slug, () => {
      let s = loadState(P.stateDir, slug, { onFallback: log }) || emptyState(profile);
      const prev = slotRow(s, slot.id);
      if (prev.state === "verified") { log(`${slot.id}: verified -- no-op (receipt ${prev.receipt})`); return EXIT.OK; }
      // An attempt left `applying` belonged to a runner that died holding the lock: it never wrote its receipt, so
      // the attempt is closed here, as failed, before a new one starts -- every attempt ends with exactly one receipt.
      if (prev.state === "applying" && prev.attempt && !prev.receipt) {
        const orphan = emit("run.completed", { slot: slot.id, provider: prev.provider, honesty_class: profile.honesty_class, attempt: prev.attempt, key: receiptKey(slug, slot.id, prev.provider, prev.attempt), outcome: "fail" }, slug, log);
        s = saveState(P.stateDir, setSlot(s, slot.id, { state: "failed", reason: "error:runner died mid-attempt", receipt: orphan }));
        log(`${slot.id}: attempt ${prev.attempt} was orphaned by a dead runner -- closed as failed (receipt ${orphan || "UNRECEIPTED"})`);
      }
      const attempt = (prev.attempt || 0) + 1;
      s = saveState(P.stateDir, setSlot(s, slot.id, { state: "applying", provider: prow.id, attempt, reason: null, receipt: null }));
      const args = { ...P, venture: slug, slot: slot.id, provider: prow.id, row: prow, adapterPath: resolve(dirname(P.registry), prow.adapter), ventureRoot, attempt, timeout: slot.timeout };
      // The args travel as a file, not one argv element: Windows caps a command line near 32k and re-parses quotes
      // in it, so a long or quote-bearing path would reach the worker cut or changed (attack 06cbc03 B4).
      const argsFile = join(P.stateDir, `.${slug}.worker-args.json`);
      writeFileSync(argsFile, JSON.stringify(args));
      const r = spawnSync(process.execPath, [WORKER, argsFile], { stdio: "inherit", timeout: Number(slot.timeout) * 1000, killSignal: "SIGKILL" });
      s = loadState(P.stateDir, slug, { onFallback: log }) || s;
      const after = slotRow(s, slot.id);
      const key = receiptKey(slug, slot.id, prow.id, attempt);
      const base = { slot: slot.id, provider: prow.id, honesty_class: profile.honesty_class, attempt, key };
      // A queued revenue.simulated is booked through the ledger's parser, never emitted as written (ADR-1739). The slot
      // is verified only once its ledger line exists: a refusal fails the attempt with the ledger's reason.
      let ledger = null;
      for (const q of after.queued || []) {
        if (q.kind !== "revenue.simulated") { emit(q.kind, { ...q.payload, venture: slug }, slug, log); continue; }
        const got = recordSimulated(slug, q.payload, { process: PROCESS });
        if (got.state === "landed" || got.state === "recorded") log(`${slot.id}: revenue.simulated ${got.state === "landed" ? `booked ${got.id || "(id line lost)"}` : "already booked -- nothing added"}`);
        else ledger = ledger || `ledger:${got.state} ${got.why}`;
      }
      if (r.status === 5 && after.state === "awaiting-approval") {
        const id = emit("approval.requested", { what: `${after.pending_action}: ${slot.id} via ${prow.id} for ${slug}`, gate: `sensitive:${after.pending_action}`, slot: slot.id, provider: prow.id, venture: slug, honesty_class: profile.honesty_class }, slug, log);
        // An unrecorded request is a failure, never a pause: a slot "awaiting" an approval id that does not exist
        // could only be freed by hand-editing state (attack 3b48ed1 B8).
        if (!id) {
          saveState(P.stateDir, setSlot(s, slot.id, { state: "failed", reason: `unreceipted:approval.requested for ${after.pending_action}`, pending_action: null, queued: [] }));
          log(`${slot.id}: ${after.pending_action} needs the owner, but the request was not recorded -- failed, apply again`);
          return EXIT.FAILED;
        }
        saveState(P.stateDir, setSlot(s, slot.id, { approval_id: id, queued: [] }));
        log(`${slot.id}: ${after.pending_action} needs the owner -- approval.requested ${id}`);
        return EXIT.AWAITING;
      }
      let outcome;
      if (r.status === 0 && after.state === "verified" && !ledger) outcome = "ok";
      else {
        const timedOut = r.error && r.error.code === "ETIMEDOUT";
        // A worker that recorded no terminal state died mid-attempt; Windows reports a SIGKILL as plain exit 1, so the
        // reason names what is known (no result) rather than guessing the cause from the code.
        const reason = timedOut ? "timeout" : ledger && after.state === "verified" ? ledger : after.state === "failed" && after.reason ? after.reason
          : `error:worker ended without a result (${r.signal ? `signal ${r.signal}` : `exit ${r.status}`})`;
        s = saveState(P.stateDir, setSlot(s, slot.id, { state: "failed", reason }));
        outcome = "fail";
      }
      const receipt = emit("run.completed", { ...base, outcome }, slug, log);
      saveState(P.stateDir, setSlot(loadState(P.stateDir, slug), slot.id, { receipt, queued: [] }));
      const fin = slotRow(loadState(P.stateDir, slug), slot.id);
      log(`${slot.id}: ${fin.state}${fin.reason ? ` (${fin.reason})` : ""} -- attempt ${attempt}, receipt ${receipt || "UNRECEIPTED"}`);
      if (!receipt) return EXIT.FAILED;
      return outcome === "ok" ? EXIT.OK : EXIT.FAILED;
    }, log);
  } catch (e) {
    if (e.exit === EXIT.LOCKED) { log(e.message); return EXIT.LOCKED; }
    throw e;
  }
}
