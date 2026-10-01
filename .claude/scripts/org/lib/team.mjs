/**
 * team.mjs -- a venture's team manifest: grammar, digest, governance, install closure (org Phase 02).
 *
 * REQ-06 · REQ-07 · ADR-1606 (stages) · ADR-1615 (heads judge) · ADR-1616 (seat budgets) ·
 * ADR-1619 (a public repo carries ids, never positioning).
 *
 * A manifest at org/teams/SLUG.team.yaml staffs one venture from the catalog. It cannot change
 * silently: its digest is over the PARSED values (the ADR-1017 rule), and a manifest is governed
 * only when an `approval.requested` with subject `org.team` carries that exact digest and an owner
 * `decision.recorded` approves it. Pure over its inputs; the CLI owns every read.
 */
import { createHash } from "node:crypto";
import { STAGES, DEPTS, OWNER, isId, isStaffed } from "./card.mjs";

export const TEAM_SUBJECT = "org.team";
export const QUEUE_CAP_MAX = 7; // REQ-10: the dispatcher never proposes more than 7 a day
const KEYS = new Set(["venture", "stage", "mission", "on_shift", "heads", "seats", "dispatch"]);
const SEAT_KEYS = new Set(["holder", "budget"]);
const BUDGET_KEYS = new Set(["tokens_month", "inr_month", "cap_action"]);
const DISPATCH_KEYS = new Set(["heartbeat", "queue_cap"]);
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const nonNegInt = (v) => Number.isInteger(v) && v >= 0;

export function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (isObj(v)) return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`;
  return JSON.stringify(v);
}
export const teamDigest = (doc) => createHash("sha256").update(canonical(doc)).digest("hex");

/** Every card id on shift in any stage. */
export function teamRoles(doc) {
  const ids = new Set();
  if (isObj(doc?.on_shift)) for (const v of Object.values(doc.on_shift)) if (Array.isArray(v)) for (const x of v) ids.add(x);
  return ids;
}

/**
 * @param doc parsed manifest  @param ctx { stem, ventures:Set, cards:Map(id->card), ungrantable:Set }
 * @returns findings (strings)
 */
export function validateTeam(doc, ctx) {
  const f = [];
  const who = `team ${ctx.stem}`;
  const bad = (m) => f.push(`${who}: ${m}`);
  if (!isObj(doc)) return [`${who}: not a mapping`];
  for (const k of Object.keys(doc)) if (!KEYS.has(k)) bad(`unknown key "${k}"`);
  if (!isId(doc.venture)) bad("venture must be a slug");
  else {
    if (doc.venture !== ctx.stem) bad(`venture "${doc.venture}" differs from its file stem`);
    if (!ctx.ventures.has(doc.venture)) bad(`venture "${doc.venture}" is not in ventures.yaml`);
  }
  if (!STAGES.includes(doc.stage)) bad(`stage must be one of ${STAGES.join(" ")}`);
  // ADR-1619: the literal `private`, or ONE public-safe line the owner approved with the digest.
  if (!(doc.mission === "private" || (typeof doc.mission === "string" && doc.mission.trim() && doc.mission.length <= 200 && !/[\r\n]/.test(doc.mission))))
    bad("mission must be `private` or one public-safe line");

  if (!isObj(doc.on_shift) || !Object.keys(doc.on_shift).length) bad("on_shift must map at least one stage to roles");
  else for (const [stage, ids] of Object.entries(doc.on_shift)) {
    if (!STAGES.includes(stage)) bad(`on_shift has unknown stage "${stage}"`);
    if (!Array.isArray(ids) || !ids.length) { bad(`on_shift.${stage} must be a non-empty list`); continue; }
    for (const id of ids) if (!ctx.cards.has(id)) bad(`on_shift.${stage} names "${id}", which is not a card`);
  }
  if (isObj(doc.on_shift) && Array.isArray(doc.on_shift[doc.stage]) === false && STAGES.includes(doc.stage))
    bad(`nobody is on shift for the current stage "${doc.stage}"`);
  const roles = teamRoles(doc);

  // Heads judge their department's workers on THIS team (ADR-1615).
  if (doc.heads !== undefined) {
    if (!isObj(doc.heads)) bad("heads must map a department to a role");
    else for (const [dept, head] of Object.entries(doc.heads)) {
      if (!DEPTS.includes(dept)) { bad(`heads has unknown department "${dept}"`); continue; }
      const hc = ctx.cards.get(head);
      if (!hc) { bad(`heads.${dept} "${head}" is not a card`); continue; }
      if (hc.dept !== dept) bad(`heads.${dept} "${head}" belongs to ${hc.dept}`);
      const workers = [...roles].map((id) => ctx.cards.get(id)).filter((c) => c && c.reports_to === head && isStaffed(c));
      if (workers.length < 2) bad(`heads.${dept} "${head}" judges ${workers.length} staffed worker(s) on this team -- a head needs >= 2 (ORG-O)`);
    }
  }

  // Seats: who holds each role here, and its budget line (ADR-1616).
  if (!isObj(doc.seats)) bad("seats must be a mapping (it may be {})");
  else for (const [id, seat] of Object.entries(doc.seats)) {
    const card = ctx.cards.get(id);
    if (!card) { bad(`seats names "${id}", which is not a card`); continue; }
    if (!roles.has(id)) bad(`seats.${id} is on no shift`);
    if (!isObj(seat)) { bad(`seats.${id} must be a mapping`); continue; }
    for (const k of Object.keys(seat)) if (!SEAT_KEYS.has(k)) bad(`seats.${id} has unknown key "${k}"`);
    if (seat.holder !== undefined && seat.holder !== OWNER && seat.holder !== "card") bad(`seats.${id}.holder must be ${OWNER} or card`);
    if (Array.isArray(card.e2) && card.e2.length && seat.holder !== OWNER) bad(`seats.${id} touches E2 (${card.e2.join("; ")}) -- its holder must be ${OWNER}`);
    if (seat.budget !== undefined) {
      const b = seat.budget;
      if (!isObj(b)) { bad(`seats.${id}.budget must be a mapping`); continue; }
      for (const k of Object.keys(b)) if (!BUDGET_KEYS.has(k)) bad(`seats.${id}.budget has unknown key "${k}"`);
      if (!nonNegInt(b.tokens_month)) bad(`seats.${id}.budget.tokens_month must be a whole number >= 0`);
      if (!nonNegInt(b.inr_month)) bad(`seats.${id}.budget.inr_month must be a whole number >= 0`);
      if (b.cap_action !== "stop-and-propose") bad(`seats.${id}.budget.cap_action must be stop-and-propose -- nothing is killed or renewed automatically`);
    }
  }
  // Every E2 role on shift is seated by the owner in this team, whether or not it has a budget.
  for (const id of roles) {
    const c = ctx.cards.get(id);
    if (c && Array.isArray(c.e2) && c.e2.length && doc.seats?.[id]?.holder !== OWNER) bad(`${id} is on shift and touches E2 -- seats.${id}.holder must be ${OWNER}`);
  }

  // REQ-13, team scope: every kind a role on this team consumes is produced by a role on this team.
  const produced = new Set([...roles].map((id) => ctx.cards.get(id)?.produces?.kind).filter(Boolean));
  for (const id of roles) for (const k of ctx.cards.get(id)?.consumes ?? []) if (!produced.has(k)) bad(`${id} consumes "${k}", which no role on this team produces (REQ-13)`);

  if (!isObj(doc.dispatch)) bad("dispatch must be a mapping");
  else {
    for (const k of Object.keys(doc.dispatch)) if (!DISPATCH_KEYS.has(k)) bad(`dispatch has unknown key "${k}"`);
    if (doc.dispatch.heartbeat !== "daily") bad("dispatch.heartbeat must be daily");
    const q = doc.dispatch.queue_cap;
    if (!Number.isInteger(q) || q < 1 || q > QUEUE_CAP_MAX) bad(`dispatch.queue_cap must be 1..${QUEUE_CAP_MAX} (REQ-10)`);
  }
  return f;
}

/**
 * Is this exact digest approved on the spine? The newest approval.requested for subject org.team,
 * this venture and this digest must be decided `approve` by a decision.recorded. A subject that
 * differs only by case or whitespace is not the subject (never normalised, never exempt).
 * @returns {{approved:boolean, request?:string, decision?:string, why:string}}
 */
export function teamApproval(events, venture, digest) {
  const reqs = events.filter((e) => e.kind === "approval.requested" && e.payload?.subject === TEAM_SUBJECT
    && e.payload?.venture === venture && e.payload?.digest === digest);
  if (!reqs.length) return { approved: false, why: "no approval.requested carries this digest" };
  const ids = new Set(reqs.map((r) => r.id));
  const decisions = events.filter((e) => e.kind === "decision.recorded" && ids.has(e.payload?.decides));
  // A request decided twice is a spine the emitter refuses to write (validate.mjs binds a decision's idem to the
  // request it decides), so this one was edited: fail closed rather than pick either verdict (logic attack L1).
  const twice = [...ids].find((id) => decisions.filter((d) => d.payload?.decides === id).length > 1);
  if (twice) return { approved: false, request: twice, why: `request ${twice} carries more than one decision -- a spine the emitter would refuse, so not read as approved` };
  const yes = decisions.filter((d) => d.payload?.verdict === "approve");
  if (!yes.length) return { approved: false, request: reqs.at(-1).id, why: decisions.length ? "the request was rejected" : "the request is undecided" };
  return { approved: true, request: yes.at(-1).payload.decides, decision: yes.at(-1).id, why: "approved" };
}

/**
 * The products a venture's team needs: every product that ships an agent, skill or script a
 * STAFFED role on the team binds, plus `core` (REQ-07). Returns { products:[...sorted], unowned:[...] }.
 * @param manifests Map(productName -> parsed manifest)
 */
export function productsFor(doc, cards, manifests) {
  const owner = new Map();
  for (const [name, m] of manifests)
    for (const key of ["agents", "scripts", "files", "commands", "docs"])
      for (const p of Array.isArray(m?.[key]) ? m[key] : []) if (typeof p === "string") owner.set(p, name);
  const need = new Set(["core"]);
  const unowned = [];
  for (const id of teamRoles(doc)) {
    const c = cards.get(id);
    if (!c || !isStaffed(c)) continue;
    const paths = [
      ...(c.binds?.agents ?? []).map((a) => `.claude/agents/${a}.md`),
      ...(c.binds?.skills ?? []).map((s) => `.claude/skills/${s}/SKILL.md`),
      ...(c.binds?.scripts ?? []),
    ];
    for (const p of paths) {
      const prod = owner.get(p);
      if (prod) need.add(prod); else unowned.push(`${id}: ${p}`);
    }
  }
  return { products: [...need].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)), unowned };
}
