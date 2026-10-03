// Read-side views of a venture's board: plan (what would fill each slot, or why nothing can), status (where each slot
// is), and the teardown plan (the ordered exit, naming every resource the runner recorded -- ADR-1714). None of these
// writes state.
import { topoOrder } from "./dag.mjs";
import { slotRow, STATES } from "./state.mjs";

// Text an adapter or a provider supplied (a resource id, a reason, an answerer) is DATA: control characters are
// replaced before it reaches a terminal, so a newline cannot forge a "verified now" line and an escape sequence
// cannot rewrite the screen (attack 405007a B7).
// Line/paragraph separators and the bidi controls (U+202A-202E, U+2066-2069) can break or visually reorder a line
// without a control character (attack e37494d L4).
const SEPARATORS = new RegExp("[" + String.fromCharCode(0x2028, 0x2029, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069, 0x200e, 0x200f) + "]", "g");
export const clean = (v) => String(v ?? "").replace(/[\x00-\x1f\x7f-\x9f]/g, "?").replace(SEPARATORS, "?");

// Phase 01 recommendation: the vetted rows that fit the profile. Fit rules with ids arrive in Phase 04 (ADR-1706);
// until then a slot with zero vetted providers prints REFUSED and never a fallback (ADR-1703).
export function fits(row, profile) {
  const why = [];
  if (row.fits && !(Array.isArray(row.fits) && row.fits.includes(profile.type))) return { ok: false, why: [`fits excludes ${profile.type}`] };
  if (row.region && row.region !== "any" && row.region !== profile.region) return { ok: false, why: [`region ${row.region} != ${profile.region}`] };
  if (row.payment_model && row.payment_model !== "any" && row.payment_model !== profile.payment_model)
    return { ok: false, why: [`payment_model ${row.payment_model} != ${profile.payment_model}`] };
  why.push(`type ${profile.type}`, `region ${profile.region}`, `payment_model ${profile.payment_model}`);
  return { ok: true, why };
}

export function planLines(slots, rows, board, state, profile) {
  const out = [];
  for (const id of topoOrder(slots)) {
    const b = board.get(id);
    const r = slotRow(state, id);
    if (!b.applies) { out.push({ id, line: `${id}: skipped (${b.reason})` }); continue; }
    // A slot that already holds resources is on its provider: plan never recommends another one over it (L7).
    if (r.state === "verified" || r.state === "applied") { out.push({ id, line: `${id}: ${r.state} via ${clean(r.provider)}${r.receipt ? ` (receipt ${clean(r.receipt)})` : ""}` }); continue; }
    const forSlot = rows.filter((x) => x.slot === id);
    const vetted = forSlot.filter((x) => x.status === "vetted" && fits(x, profile).ok);
    const alts = forSlot.filter((x) => !vetted.includes(x)).map((x) => `${clean(x.id)} (${clean(x.status)}${x.reason ? `: ${clean(x.reason)}` : ""})`);
    if (!vetted.length) { out.push({ id, refused: true, line: `${id}: REFUSED -- no vetted provider for ${id}${alts.length ? ` · candidates: ${alts.join(", ")}` : ""}` }); continue; }
    const [rec, ...more] = vetted;
    out.push({ id, line: `${id}: recommended ${clean(rec.id)} -- why: ${fits(rec, profile).why.join(", ")} · status ${clean(rec.status)} · last_verified ${clean(rec.last_verified ?? "never")}${more.length || alts.length ? ` · alternatives: ${[...more.map((x) => clean(x.id)), ...alts].join(", ")}` : ""}` });
  }
  return out;
}

export function statusLines(slots, board, state) {
  return topoOrder(slots).map((id) => {
    const r = slotRow(state, id);
    const b = board.get(id);
    // State values come from a file anyone can edit: an unknown one is shown as such, never printed raw (L2).
    const st = b.applies ? (STATES.has(r.state) ? r.state : `unknown(${clean(r.state)})`) : "skipped";
    const reason = b.applies ? r.reason : b.reason;
    return `${st.padEnd(17)} ${id}${r.provider ? ` via ${clean(r.provider)}` : ""}${reason ? ` -- ${clean(reason)}` : ""}${r.receipt ? ` (receipt ${clean(r.receipt)})` : ""}${!r.receipt && st === "verified" ? " UNRECEIPTED" : ""}`;
  });
}

// The exit runs in reverse dependency order: whatever was applied last is undone first. Steps are rendered, never
// executed (teardown --apply is Cycle 2, behind gates).
export function teardownPlan(slots, state, profile) {
  const steps = [];
  for (const id of [...topoOrder(slots)].reverse()) {
    const r = slotRow(state, id);
    for (const res of r.resources || []) steps.push({ slot: id, provider: r.provider, kind: res.kind, id: res.id });
  }
  return [
    `teardown plan for ${profile.slug} (${profile.honesty_class}) -- rendered, never applied in v1`,
    "1. export: dump the venture's data and the state file before anything is removed",
    "2. notice: tell any user of the venture (a rehearsal venture has none -- state that, do not skip the step)",
    "3. cancel: stop every billing relationship the board recorded",
    "4. park: remove resources in reverse dependency order:",
    ...(steps.length ? steps.map((s, i) => `   4.${i + 1} ${s.slot} via ${clean(s.provider)}: ${clean(s.kind)} ${clean(s.id)}`) : ["   (no resources recorded yet)"]),
    "5. archive: keep the receipts; the spine is append-only and the board's history stays",
  ];
}
