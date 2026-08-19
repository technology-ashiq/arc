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
const MATCHERS = [
  {
    id: "needs-you",
    when: (q) => /(needs?\s+me|need\s+you|waiting|open\s+approv|inbox|to\s?do|what.*decide)/i.test(q),
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
    when: (q) => /(revenue|money|earn|income|mrr|profit|paid|₹|rupee)/i.test(q),
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
    when: (q) => /(burn|appetite|tripwire|how\s+far|budget)/i.test(q),
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
    when: (q) => /(lanes?|board|live|what.*running|status|wip)/i.test(q),
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
    when: (q) => /(unexercised|never\s+fired|not\s+used|dashed|zero\s+receipts)/i.test(q),
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
    when: (q) => /(receipts?|spine|kinds?|how\s+many\s+event|log)/i.test(q),
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
  const q = String(question || "");
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
  if (/(approve|reject|merge|publish|promote|kill|send|deploy|run it|do it)\b/i.test(q)) {
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
    if (!m.when(q)) continue;
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
