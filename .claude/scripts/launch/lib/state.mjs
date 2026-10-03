// Durable per-venture runner state (ADR-1718). Instance-only: .claude/state/ is gitignored and never synced.
// Writes are temp + rename with the previous generation kept, so a kill mid-write loses at most the write in flight.
import { readFileSync, writeFileSync, renameSync, copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { LaunchError } from "./catalog.mjs";

export const STATES = new Set(["pending", "planned", "awaiting-approval", "applying", "applied", "verified", "failed", "skipped", "absent"]);

// Receipt key (locked): identifies one ATTEMPT's receipt. The resource tag is stable across attempts, so a resumed
// scaffold finds what an earlier attempt created even when that attempt died before recording it.
export const receiptKey = (venture, slot, provider, attempt) => `${venture}@${slot}@${provider}@${attempt}`;
export const resourceTag = (venture, slot, provider) => `${venture}@${slot}@${provider}`;

export const statePath = (dir, slug) => join(dir, `${slug}.json`);

export function emptyState(profile) {
  return { schema: 1, venture: profile.slug, honesty_class: profile.honesty_class, generation: 0, slots: {} };
}

export function loadState(dir, slug, { onFallback = () => {} } = {}) {
  const p = statePath(dir, slug);
  if (!existsSync(p)) return null;
  try {
    return check(JSON.parse(readFileSync(p, "utf8")), p);
  } catch (e) {
    const prev = `${p}.prev`;
    if (!existsSync(prev)) throw new LaunchError("STATE_CORRUPT", `${p} does not parse (${e.message}) and no previous generation exists`);
    const s = check(JSON.parse(readFileSync(prev, "utf8")), prev);
    onFallback(`state ${p} did not parse (${e.message}); loaded the previous generation ${s.generation}`);
    return s;
  }
}

function check(s, p) {
  if (!s || s.schema !== 1 || !s.slots || typeof s.slots !== "object" || Array.isArray(s.slots)) throw new LaunchError("STATE_SHAPE", `${p} is not a schema-1 launch state`);
  for (const [id, row] of Object.entries(s.slots))
    if (!STATES.has(row.state)) throw new LaunchError("STATE_SHAPE", `${p} slot ${id} has state ${JSON.stringify(row.state)}`);
  return s;
}

export function saveState(dir, state) {
  mkdirSync(dir, { recursive: true });
  const p = statePath(dir, state.venture);
  const next = { ...state, generation: (state.generation || 0) + 1 };
  writeFileSync(`${p}.tmp`, JSON.stringify(next, null, 2) + "\n");
  // Only a current file that parses becomes the previous generation; rotating a torn one in would destroy the
  // good copy the fallback depends on (attack 3b48ed1 B12).
  if (existsSync(p)) { try { JSON.parse(readFileSync(p, "utf8")); copyFileSync(p, `${p}.prev`); } catch { /* keep the last good .prev */ } }
  renameSync(`${p}.tmp`, p);
  return next;
}

export function slotRow(state, id) {
  return state.slots[id] || { state: "pending", provider: null, attempt: 0, resources: [], receipt: null, reason: null };
}

export function setSlot(state, id, patch) {
  state.slots[id] = { ...slotRow(state, id), ...patch, updated: new Date().toISOString() };
  return state;
}
