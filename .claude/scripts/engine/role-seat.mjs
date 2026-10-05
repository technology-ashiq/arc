// role-seat.mjs -- which bound agent sits a role for one run (org Cycle 20 Phase 00, ADR-1626).
//
// Pure: the caller hands in the card and the spine events it already read, so the same cards and
// the same spine always give the same agent. Never random, never by recency.
//
//   qualifies   >= MIN_RUNS run.completed receipts for this role carrying payload.role_agent = the agent,
//               the role read from payload.role OR payload.trial_role (a trial earns the seat no
//               org-review credit, but it is the only way a second agent ever builds evidence)
//   scored      the qualifying agent with the highest ok rate
//   card        a tie at the top, or no qualifier: the FIRST listed agent -- the card's order is the owner's preference
//   none        the card binds no agent, so nobody sits it
//   trial       --trial-seat named the agent for this run only

export const MIN_RUNS = 3;
export const AGENT_RE = /^[a-z][a-z0-9-]{0,63}$/;

function roleOf(p) {
  if (!p || typeof p !== "object") return null;
  if (typeof p.role === "string") return p.role;
  if (typeof p.trial_role === "string") return p.trial_role;
  return null;
}

/** Per-agent { runs, ok } for one role, counted only for agents the card binds. */
export function tally(roleId, agents, events) {
  const t = new Map(agents.map((a) => [a, { runs: 0, ok: 0 }]));
  for (const e of events || []) {
    if (!e || e.kind !== "run.completed") continue;
    const p = e.payload;
    if (roleOf(p) !== roleId || typeof p.role_agent !== "string") continue;
    const row = t.get(p.role_agent);
    if (!row) continue;
    row.runs += 1;
    if (p.outcome === "ok") row.ok += 1;
  }
  return t;
}

/**
 * @param {{ id: string, binds?: { agents?: string[] } }} card
 * @param {object[]} events  spine events (may be empty when the spine could not be read)
 * @param {{ trial?: string|null }} [opts]
 * @returns {{ agent: string|null, source: "card"|"scored"|"trial"|"none", why: string }}
 */
export function resolveSeat(card, events, { trial = null } = {}) {
  if (!card || typeof card.id !== "string") throw new Error("resolveSeat: no card");
  if (trial !== null) {
    if (typeof trial !== "string" || !AGENT_RE.test(trial)) throw new Error(`resolveSeat: bad trial agent ${JSON.stringify(trial)}`);
    return { agent: trial, source: "trial", why: "--trial-seat, this run only" };
  }
  const raw = card.binds && Array.isArray(card.binds.agents) ? card.binds.agents : [];
  // Duplicates collapse to their first position, so a card listing an agent twice cannot double its weight.
  const agents = [...new Set(raw.filter((a) => typeof a === "string" && AGENT_RE.test(a)))];
  if (agents.length === 0) return { agent: null, source: "none", why: `card ${card.id} binds no agent` };
  const t = tally(card.id, agents, events);
  let best = null;
  let bestRate = -1;
  let tied = false;
  for (const a of agents) {
    const { runs, ok } = t.get(a);
    if (runs < MIN_RUNS) continue;
    // Compared as ok*other.runs vs other.ok*runs: exact, no float equality on a tie.
    if (best === null || ok * t.get(best).runs > t.get(best).ok * runs) { best = a; bestRate = ok / runs; tied = false; }
    else if (ok * t.get(best).runs === t.get(best).ok * runs) tied = true;
  }
  if (best === null) return { agent: agents[0], source: "card", why: `no agent has ${MIN_RUNS}+ runs for ${card.id}; first listed` };
  const { runs, ok } = t.get(best);
  // Agents are walked in card order, so on a tie `best` is already the first listed of the tied.
  if (tied) return { agent: best, source: "card", why: `tie at ${Math.round(bestRate * 100)}%; first listed of the tied` };
  return { agent: best, source: "scored", why: `ok ${ok}/${runs} (${Math.round(bestRate * 100)}%), best of ${agents.length}` };
}

/** The agent file's body with its frontmatter removed -- what a trial seat puts in front of the process. */
export function personaOf(text) {
  const t = String(text).replace(/^﻿/, "").replace(/\r\n/g, "\n");
  if (!t.startsWith("---\n")) return t.trim();
  const end = t.indexOf("\n---", 4);
  if (end < 0) return t.trim();
  const after = t.indexOf("\n", end + 4);
  return (after < 0 ? "" : t.slice(after + 1)).trim();
}
