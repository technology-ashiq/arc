/**
 * dispatch.mjs -- the COO seat: which jobs a venture needs next, as PROPOSALS (org Phase 03).
 *
 * ADR-1605 (ORG-E) · ADR-1606 (stages) · ADR-1602 (vacancy demand counter) · ADR-1616 (budget lines) ·
 * REQ-08 · REQ-10.
 *
 * Deterministic arithmetic, no model, no execution, no agent calls: read the governed team, the
 * current stage's exit criteria and the spine; propose the role that owns each unmet criterion,
 * with full goal ancestry; skip a seat whose budget line is spent (one budget-cap request instead);
 * count a demand against a VACANT owner and propose a hire at the third; propose a stage change when
 * every criterion reads true. Never more than the team's queue cap in one day. Pure over its inputs.
 */
import { STAGES } from "./card.mjs";

export const DISPATCH_SUBJECT = "org.dispatch";
export const DEMAND_SIGNAL = "org.vacancy-demand";
export const DEMANDS_TO_HIRE = 3;
const KIND_OK = (kinds) => (k) => k === "manual" || kinds.has(k);

/** Findings for org/stages.yaml. */
export function validateStages(doc, cardIds, kinds) {
  const f = [];
  const okKind = KIND_OK(kinds);
  if (!doc || typeof doc !== "object" || doc.version !== 1 || typeof doc.stages !== "object" || !doc.stages)
    return ["org/stages.yaml: expected version: 1 and a stages: mapping"];
  for (const s of Object.keys(doc.stages)) if (!STAGES.includes(s)) f.push(`org/stages.yaml: unknown stage "${s}"`);
  for (const s of STAGES) {
    const list = doc.stages[s];
    if (!Array.isArray(list) || !list.length) { f.push(`org/stages.yaml: stage "${s}" has no exit criteria`); continue; }
    const seen = new Set();
    for (const c of list) {
      const at = `org/stages.yaml ${s}.${c?.id ?? "?"}`;
      if (!c || typeof c !== "object") { f.push(`${at}: not a mapping`); continue; }
      if (!/^[a-z][a-z0-9-]{1,63}$/.test(c.id || "")) f.push(`${at}: id must be a kebab id`);
      else if (seen.has(c.id)) f.push(`${at}: duplicate criterion id`); else seen.add(c.id);
      if (!okKind(c.kind)) f.push(`${at}: kind "${c.kind}" is not a spine kind (or manual)`);
      if (!Number.isInteger(c.count) || c.count < 1) f.push(`${at}: count must be a whole number >= 1`);
      if (!cardIds.has(c.role)) f.push(`${at}: role "${c.role}" is not a card`);
      if (typeof c.task !== "string" || !c.task.trim() || /[\r\n]/.test(c.task)) f.push(`${at}: task must be one line`);
    }
  }
  return f;
}

const dayOf = (ts) => String(ts).slice(0, 10);
const monthOf = (ts) => String(ts).slice(0, 7);

/**
 * @param i { venture, team, cards:Map, stagesDoc, events, today:'YYYY-MM-DD', placements:Map(eventId->{role}) }
 * @returns {{ proposals:object[], notes:object[], skipped:string[], todays:number, cap:number, overCap:boolean }}
 */
export function dispatch(i) {
  const { venture, team, cards, stagesDoc, events, today, placements } = i;
  const cap = team.dispatch?.queue_cap ?? 7;
  const stage = team.stage;
  const criteria = stagesDoc.stages?.[stage] ?? [];
  const onShift = new Set(team.on_shift?.[stage] ?? []);
  const vEvents = events.filter((e) => e.venture === venture);
  const decided = new Set(events.filter((e) => e.kind === "decision.recorded").map((e) => e.payload?.decides));
  const mine = events.filter((e) => e.kind === "approval.requested" && e.payload?.subject === DISPATCH_SUBJECT && e.payload?.venture === venture);
  const open = mine.filter((e) => !decided.has(e.id));
  const todays = mine.filter((e) => dayOf(e.ts) === today).length;
  const out = { proposals: [], notes: [], skipped: [], todays, cap, overCap: todays > cap };
  let slots = Math.max(0, cap - todays);
  if (!slots) { out.skipped.push(`queue full: ${todays} proposal(s) today against a cap of ${cap} (REQ-10)`); return out; }
  const isOpen = (pred) => open.some((e) => pred(e.payload || {}));
  const mission = team.mission;
  const propose = (p) => { if (slots > 0) { out.proposals.push({ subject: DISPATCH_SUBJECT, venture, what: p.task, ...p }); slots--; return true; } out.skipped.push(`queue full before ${p.role}: ${p.why_now}`); return false; };

  const have = (c) => (c.kind === "manual" ? 0 : vEvents.filter((e) => e.kind === c.kind).length);
  const unmet = criteria.filter((c) => c.kind === "manual" || have(c) < c.count);

  for (const c of unmet) {
    if (c.kind === "manual") { out.skipped.push(`${stage}.${c.id}: manual criterion -- the owner confirms it; never proposed past`); continue; }
    const role = c.role;
    const card = cards.get(role);
    if (!onShift.has(role)) { out.skipped.push(`${stage}.${c.id}: owner role ${role} is not on shift for ${stage} in the team manifest`); continue; }
    if (isOpen((p) => p.role === role && p.criterion === c.id)) { out.skipped.push(`${stage}.${c.id}: a proposal to ${role} is already open`); continue; }

    if (!card || card.seat === "vacant") {
      // ADR-1602: the venture hires, not the plan. Every time real work wants a vacant seat, count it.
      const prior = events.filter((e) => e.kind === "note.logged" && e.payload?.signal === DEMAND_SIGNAL && e.payload?.role === role).length;
      out.notes.push({ signal: DEMAND_SIGNAL, role, venture, criterion: `${stage}.${c.id}`, demand: prior + 1 });
      if (prior + 1 >= DEMANDS_TO_HIRE && !isOpen((p) => p.why_now === "vacancy-demand" && p.hire === role))
        propose({ role: "recruiter", hire: role, task: `Hire for ${role}: real work has wanted it ${prior + 1} times`,
          goal_ancestry: [mission, stage, c.id, c.task], budget: null, why_now: "vacancy-demand", criterion: c.id });
      else out.skipped.push(`${stage}.${c.id}: ${role} is vacant -- demand ${prior + 1} of ${DEMANDS_TO_HIRE} recorded`);
      continue;
    }

    // ADR-1616: a seat whose line is spent is not proposed; one budget-cap request per role per month.
    const line = team.seats?.[role]?.budget;
    if (line) {
      const spent = vEvents.filter((e) => e.kind === "cost.incurred" && placements.get(e.id)?.role === role && monthOf(e.ts) === today.slice(0, 7));
      const inr = spent.reduce((s, e) => s + (Number.isInteger(e.payload?.amount) ? e.payload.amount : 0), 0);
      const tokens = spent.reduce((s, e) => s + (Number.isInteger(e.payload?.tokens) ? e.payload.tokens : 0), 0);
      const overInr = inr > line.inr_month * 100;   // minor units; inr_month 0 means ANY spend is over
      const overTok = line.tokens_month > 0 && tokens >= line.tokens_month;
      if (overInr || overTok) {
        const already = mine.some((e) => e.payload?.why_now === "budget-cap" && e.payload?.role === role && monthOf(e.ts) === today.slice(0, 7));
        if (!already) propose({ role, task: `Budget line for ${role} is spent (${inr} minor INR, ${tokens} tokens) -- raise it or keep it stopped`,
          goal_ancestry: [mission, stage, c.id, c.task], budget: line, why_now: "budget-cap", criterion: c.id });
        else out.skipped.push(`${stage}.${c.id}: ${role} is over its budget line; the budget-cap request is already raised this month`);
        continue;
      }
    }
    propose({ role, task: c.task, goal_ancestry: [mission, stage, c.id, c.task], budget: line ?? null,
      why_now: `${stage} exit criterion ${c.id} unmet (${have(c)} of ${c.count} ${c.kind})`, criterion: c.id });
  }

  if (criteria.length && !unmet.length) {
    const next = STAGES[STAGES.indexOf(stage) + 1];
    if (next && !isOpen((p) => p.why_now === "stage-exit" && p.to === next))
      propose({ role: "coo-dispatcher", task: `Move ${venture} from ${stage} to ${next}: every ${stage} exit criterion reads true`,
        goal_ancestry: [mission, stage, "stage-exit", `enter ${next}`], budget: null, why_now: "stage-exit", from: stage, to: next });
  }
  return out;
}
