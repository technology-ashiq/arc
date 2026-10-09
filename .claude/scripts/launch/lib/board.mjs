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

// The fit rules (ADR-1706): each compares one provider-row field with the venture profile, and plan prints the id of
// every rule a pick passed, or the one rule a row failed. A slot with zero vetted fitting providers is REFUSED, never a
// fallback (ADR-1703). Adding a rule is an ADR plus a line here.
export const FIT_RULES = Object.freeze([
  { id: "FIT-1", field: "type", ok: (row, p) => !row.fits || (Array.isArray(row.fits) && row.fits.includes(p.type)), says: (row, p) => `type ${p.type}` },
  { id: "FIT-2", field: "region", ok: (row, p) => !row.region || row.region === "any" || row.region === p.region, says: (row, p) => `region ${row.region === "any" || !row.region ? "any" : p.region}` },
  { id: "FIT-3", field: "payment_model", ok: (row, p) => !row.payment_model || row.payment_model === "any" || row.payment_model === p.payment_model, says: (row, p) => `payment_model ${row.payment_model === "any" || !row.payment_model ? "any" : p.payment_model}` },
]);
// Among vetted fitting rows: RANK-1 the most recently verified first; RANK-2 the row id, so the order is stable and is
// never read as a preference. Receipt weighting is Cycle 2 (ADR-1706).
export const RANK_RULES = Object.freeze(["RANK-1 last_verified newest first", "RANK-2 row id"]);

export function fits(row, profile) {
  for (const r of FIT_RULES) if (!r.ok(row, profile)) return { ok: false, why: [`${r.id} ${r.field} ${clean(row[r.field === "type" ? "fits" : r.field])} excludes ${clean(profile[r.field])}`] };
  return { ok: true, why: FIT_RULES.map((r) => `${r.id} ${clean(r.says(row, profile))}`) };
}

// last_verified counts only as a calendar day, YYYY-MM-DD: anything else ranks and prints as never, so the line cannot
// show a date the ranking ignored (attack 530c056 L2, L9).
export const verifiedDay = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) ? v : null);
export function rank(rows) {
  const t = (r) => { const d = verifiedDay(r.last_verified); return d ? Date.parse(d) : -1; };
  return [...rows].sort((a, b) => t(b) - t(a) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

// overrides: Map slot -> { provider, decision } from approved `launch.override` requests (ADR-1748). The newest approved
// one wins; plan cites its decision id. An override naming a blocked, retired or unknown row is shown and not taken.
export function planLines(slots, rows, board, state, profile, overrides = new Map()) {
  const out = [];
  for (const id of topoOrder(slots)) {
    const b = board.get(id);
    const r = slotRow(state, id);
    if (!b.applies) { out.push({ id, line: `${id}: skipped (${b.reason})` }); continue; }
    // A slot that already holds resources is on its provider: plan never recommends another one over it (L7).
    if (r.state === "verified" || r.state === "applied") { out.push({ id, line: `${id}: ${r.state} via ${clean(r.provider)}${r.receipt ? ` (receipt ${clean(r.receipt)})` : ""}` }); continue; }
    const forSlot = rows.filter((x) => x.slot === id);
    const vetted = rank(forSlot.filter((x) => x.status === "vetted" && fits(x, profile).ok));
    const alts = forSlot.filter((x) => !vetted.includes(x)).map((x) => `${clean(x.id)} (${clean(x.status)}${x.reason ? `: ${clean(x.reason)}` : ""}${x.status === "vetted" ? `: ${fits(x, profile).why[0]}` : ""})`);
    const ov = overrides.get(id);
    const ovRow = ov && forSlot.find((x) => x.id === ov.provider && x.status !== "blocked" && x.status !== "retired");
    if (ov && !ovRow) out.push({ id, line: `${id}: override ${clean(ov.provider)} (decision ${clean(ov.decision)}) not taken -- no such usable row` });
    if (ovRow) {
      const others = forSlot.filter((x) => x !== ovRow).map((x) => clean(x.id));
      out.push({ id, line: `${id}: recommended ${clean(ovRow.id)} -- why: owner override, decision ${clean(ov.decision)}${fits(ovRow, profile).ok ? "" : ` (outside the fit rules: ${fits(ovRow, profile).why[0]})`} · status ${clean(ovRow.status)} · last_verified ${(verifiedDay(ovRow.last_verified) ?? "never")}${others.length ? ` · alternatives: ${others.join(", ")}` : ""}` });
      continue;
    }
    if (!vetted.length) { out.push({ id, refused: true, line: `${id}: REFUSED -- no vetted provider for ${id}${alts.length ? ` · candidates: ${alts.join(", ")}` : ""}` }); continue; }
    const [rec, ...more] = vetted;
    const ranked = more.length ? ` · ranked by ${RANK_RULES.join(", ")}` : "";
    out.push({ id, line: `${id}: recommended ${clean(rec.id)} -- why: ${fits(rec, profile).why.join(", ")} · status ${clean(rec.status)} · last_verified ${(verifiedDay(rec.last_verified) ?? "never")}${ranked}${more.length || alts.length ? ` · alternatives: ${[...more.map((x) => `${clean(x.id)} (${fits(x, profile).why.join(", ")})`), ...alts].join(", ")}` : ""}` });
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
