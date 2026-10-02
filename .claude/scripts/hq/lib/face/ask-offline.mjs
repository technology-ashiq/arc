// ask-offline -- the deterministic half of Ask arc (face REQ-07, ADR-1307).
//
// This is NOT a fallback in the apologetic sense. It is the half of the brain that needs no
// model at all: questions about live state have exact answers, and an exact answer computed
// from the log beats a fluent one every time. The engine process (`face-ask`) exists for the
// questions this cannot reach -- and while the claude-code driver cannot yet express a
// zero-tool grant (see phases/phase-07-spec.md), THIS is what answers.
//
// Three rules it never breaks:
//   1. Every number comes from the reader. Nothing is estimated, inferred or rounded.
//   2. Every answer carries citations, and `citations: []` is a legal, honest answer for a
//      question the state cannot reach. "I cannot answer that from the log" is a result.
//   3. It never tells the operator to do something the Constitution reserves for him. It
//      names the CLI he runs himself; it does not offer to run it.
//
// Output shape is the face-ask process's own contract: { answer, citations, verified }.

/** Matchers are ordered MOST SPECIFIC FIRST; the first whose `when` fires answers.
 *  (Ordering is load-bearing: "which kinds have never fired?" matched the general
 *  spine-shape matcher before the specific unexercised one, found by driving it live.) Deliberately explicit -- a
 *  question that matches nothing gets the honest refusal, never a nearest-neighbour guess. */
// A question is arc's only when its words say so (owner, 2026-10-02: "general questions keta ans pannala"). Bare
// substrings sent "learn" to revenue, "blog" to the spine, "keyboard" and "deliver" to the board, so 8 of 14 general
// questions never reached the owner's model. Every pattern is whole-word, and a word that also means something outside
// arc (status, live, log, money, send) answers only beside a word that is arc's: a lane's name or one below.
const ARC_WORDS = /\b(arc|hq|lanes?|phases?|approvals?|receipts?|spine|ventures?|revenue|mrr|appetite|tripwire|wip|inbox|cycle)\b/i;
const WE = /\b(we|our|us)\b/i;
const ME = /\b(me|my|i)\b/i;
/** @param {string} q @param {{ lanes?: { lane: string }[] }} s */
function arcContext(q, s) {
  // A lane name read from disk becomes a pattern only if it is a lane name by the grammar (attack 7bbd4e6 B2, B3): a
  // row that is not, or a list that is not a list, makes no context -- it never throws on an unrelated question.
  const lanes = Array.isArray(s.lanes) ? s.lanes : [];
  return ARC_WORDS.test(q) || lanes.some((l) => typeof l?.lane === "string" && /^[a-z][a-z0-9-]{0,63}$/.test(l.lane) &&
    new RegExp(`\\b${l.lane}\\b`, "i").test(q));
}

const MATCHERS = [
  {
    id: "needs-you",
    when: (q, s) => /\b(needs?\s+me|need\s+you|open\s+approv\w*|inbox)\b/i.test(q) ||
      (/\b(waiting|to\s?do|decide)\b/i.test(q) && (arcContext(q, s) || ME.test(q) || WE.test(q))),
    answer(s) {
      if (!s.open.length) {
        return {
          answer: "Nothing needs you. There are no open `approval.requested` on the spine — " +
            `${s.raised} raised, ${s.decided} decided, 0 open.`,
          citations: [],
        };
      }
      const byGate = {};
      for (const o of s.open) byGate[o.gate] = (byGate[o.gate] || 0) + 1;
      const spread = Object.entries(byGate).sort((a, b) => b[1] - a[1])
        .map(([g, n]) => `${n} ${g}`).join(" · ");
      return {
        answer: `${s.open.length} \`approval.requested\` are open and waiting on you (${spread}). ` +
          `${s.raised} raised, ${s.decided} decided — the difference is the queue. ` +
          "You stamp each one yourself: `arc-inbox approve <id> --reason \"…\"` " +
          "(or `reject`), run from the main clone.",
        citations: s.open.map((o) => o.id),
      };
    },
  },
  {
    id: "revenue",
    when: (q, s) => /\b(revenue|mrr)\b/i.test(q) ||
      ((/\b(money|earn(ed|ings?)?|income|profit|paid|rupees?)\b/i.test(q) || q.includes("₹")) && (arcContext(q, s) || WE.test(q))),
    answer(s) {
      const real = s.kinds["revenue.received"] || 0;
      if (real === 0) {
        return {
          answer: "₹0 — and that is an ABSENT number, not a small one: `revenue.received` has " +
            "never fired on the spine, so there is nothing to sum. MRR is not instrumented. " +
            "Anything labelled SIMULATED is a separate class and is never added to this (E3). " +
            "The ledger's own words for the state: mechanism proven, live value pending.",
          citations: [],
        };
      }
      return {
        answer: `\`revenue.received\` has fired ${real} time(s). The amounts are the money brain's ` +
          "to derive — run `arc pnl` yourself for the per-venture P&L; this answerer does not " +
          "re-derive money.",
        citations: [],
      };
    },
  },
  {
    id: "lane-burn",
    when: (q, s) => /\b(appetite|tripwire)\b/i.test(q) || (/\b(burn|budget|how\s+far)\b/i.test(q) && arcContext(q, s)),
    answer(s, q) {
      const named = s.lanes.find((l) => new RegExp(`\\b${l.lane}\\b`, "i").test(q));
      const rows = named ? [named] : s.lanes.filter((l) => l.status === "LIVE");
      if (!rows.length) return null;
      const body = rows.map((l) =>
        `${l.lane}: ${l.burn || "—"} of ${l.appetite || "—"} at phase ${l.phase || "—"}`).join(" · ");
      return {
        answer: (named ? "" : "LIVE lanes, burn against appetite: ") + body +
          ". The 50 % tripwire is each lane's own; a blown appetite is cut or killed, never " +
          "silently extended.",
        citations: rows.map((l) => `file:lane/${l.lane}`),
      };
    },
  },
  {
    id: "board",
    when: (q, s) => /\b(lanes?|wip)\b/i.test(q) || /\bwhat('s|\s+is)\s+running(\s+right)?\s+now\b/i.test(q) ||
      // A bare "status" typed into arc's own HQ asks about arc.
      (/\b(board|live|running|status)\b/i.test(q) && (arcContext(q, s) || /^(status|board|live) ?\??$/i.test(q))),
    answer(s) {
      const live = s.lanes.filter((l) => l.status === "LIVE");
      return {
        answer: `${s.lanes.length} lanes on the board, ${live.length} LIVE: ` +
          live.map((l) => `${l.lane} (phase ${l.phase || "—"})`).join(" · ") +
          `. The WIP guideline is 2 and this is ${live.length} — informational, never blocking ` +
          "(ADR-0052).",
        citations: live.map((l) => `file:lane/${l.lane}`),
      };
    },
  },
  {
    id: "unexercised",
    when: (q, s) => /\b(unexercised|never\s+fired|dashed|zero\s+receipts)\b/i.test(q) || (/\bnot\s+used\b/i.test(q) && arcContext(q, s)),
    answer(s) {
      const fired = Object.keys(s.kinds);
      return {
        answer: `${fired.length} of 46 kinds have ever fired. Everything else has zero receipts ` +
          "and is drawn dashed with the honest label *fixture-proven, unexercised* — built, " +
          "tested, never exercised in production. That is a different statement from zero, and " +
          "the face never collapses the two.",
        citations: [],
      };
    },
  },  {
    id: "spine-shape",
    when: (q, s) => /\b(receipts?|spine|how\s+many\s+events?)\b/i.test(q) || /\bkinds?\b.*\bfired\b/i.test(q) ||
      /\bthe\s+log\b(?!\s+of)/i.test(q) || (/\b(kinds?|log)\b/i.test(q) && arcContext(q, s)),
    answer(s) {
      const fired = Object.keys(s.kinds).length;
      const top = Object.entries(s.kinds).sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([k, n]) => `\`${k}\` ${n}`).join(" · ");
      return {
        answer: `${s.events} receipts on the spine across ${s.days} days, ${s.daysClosed} of them ` +
          `sealed with \`day.closed\`. ${fired} of 46 kinds have ever fired — the other ` +
          `${46 - fired} render dashed and labelled *fixture-proven, unexercised*, never as zero. ` +
          `Heaviest: ${top}. ${s.quarantined} records were REFUSED and are held separately; ` +
          "they are not receipts and are never added to the count.",
        citations: [],
      };
    },
  },

];

/**
 * Answer from live state alone.
 * @param {object} state  { events, days, daysClosed, quarantined, kinds:{kind:count},
 *                          open:[{id,gate,what}], raised, decided, lanes:[{lane,status,phase,burn,appetite}] }
 * @returns {{answer:string, citations:string[], verified:boolean}}
 */
export function askOffline(question, state) {
  // One space per gap and a bounded length before any pattern runs (attack 7bbd4e6 B1): a run of 200,000 spaces must
  // not make a matcher backtrack on the door's only thread. The door still sends the model the question as typed.
  const q = String(question || "").replace(/\s+/g, " ").trim().slice(0, 2000);
  if (!q.trim()) {
    return {
      answer: "No question was asked.",
      citations: [],
      verified: true,
      matched: "empty",
    };
  }
  // An action request is refused BEFORE any matcher runs: the refusal is the answer, and it
  // must not depend on whether some matcher happened to fire first (E2, ADR-1307).
  // arc's own verbs always refuse; send, publish and kill also name everyday how-tos ("how to send an email"), so they
  // refuse only as an order, about something named (it, this) or beside an arc word -- the model refuses an act anyway.
  const order = !/^\s*(how|what|why|when|where|who|which|explain|tell|is|are|does|do)\b/i.test(q);
  if (/\b(approve|reject|merge|promote|deploy|run\s+it|do\s+it)\b/i.test(q) ||
      (/\b(send|publish|kill)\b/i.test(q) && (order || /\b(send|publish|kill)\s+(it|this|that|them)\b/i.test(q) || arcContext(q, state || {})))) {
    return {
      answer: "I read; I do not act. That is structural, not a setting (Constitution E2): the " +
        "only write outside the factory is your stamp, and publishing, merging, promoting, " +
        "killing and sending are forever-human. I can tell you which one is open and what the " +
        "exact command is — you run it.",
      citations: [],
      verified: true,
      matched: "refusal:act",
    };
  }
  for (const m of MATCHERS) {
    if (!m.when(q, state || {})) continue;
    const out = m.answer(state, q);
    if (out) return { ...out, verified: true, matched: m.id };
  }
  return {
    answer: "The live state I hold cannot answer that. What it does carry: open approvals, " +
      "receipts and which kinds have fired, the board and each lane's burn against its " +
      "appetite, and whether any real revenue exists. Ask about one of those, or run the " +
      "question against the tree yourself — a plausible answer I cannot trace to a receipt " +
      "would be worse than this refusal.",
    citations: [],
    verified: true,
    matched: null,
  };
}

export const MATCHER_IDS = MATCHERS.map((m) => m.id);
