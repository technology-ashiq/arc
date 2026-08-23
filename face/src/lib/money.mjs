// money.mjs -- every decision the Money and Ventures rooms make, in one dependency-free file.
//
// MoneyRoom.tsx and VenturesRoom.tsx are markup. THIS is where the branches live, for the
// reason README.md gives: CI never runs `npm install`, so a branch inside a .tsx is a branch
// nobody tests. Which colour a rupee is allowed to wear, which of the four kinds of nothing a
// blank cell means, whether a total may be printed at all -- all of it is here.
//
// It imports door.mjs and inbox.mjs (both dependency-free) and NOTHING else. No React, no
// vite, no three, and -- by ADR-1316 -- nothing from `.claude/**`.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// THE THREE FACTS THIS FILE EXISTS TO KEEP APART
//
//   "measured, and it is zero"   a number was computed from receipts and came out zero
//   "never fired"                the kind that records this has never happened, so there is
//                                no measurement at all -- not a low one, not a zero one
//   "simulated"                  a real measurement of data that is not real money
//
// A surface that renders those three the same way is the exact lie the Truth Law exists to
// prevent, and this product's most dangerous screen is the one where all three appear at
// once. So they are three different STATES here (`measured` / `never-fired` / `non-real`
// tone), three different GLYPHS (`solid` / `hollow` / solid-on-hatch) and three different
// INKS -- and the glyph is load-bearing, because the eye reads shape before it reads a badge.
//
// THE FOURTH NOTHING, which is not one of the three and is drawn differently again:
//   "absent"      the component was never recorded on the event (an unknown fee and a waived
//                 fee are different facts -- ADR-1012 / `renderComponent`). Renders an
//                 em-dash, never a zero.
//   "not-served"  the door's body arrived without this field. Renders the words `not served`,
//                 never an em-dash, so it cannot be misread as an absence in the DATA.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// --green IS REAL MONEY AND NOTHING ELSE, AND IT IS UNSPENT
//
// tokens.css, collision 3: `--green` stays unspent until `revenue.received` fires for the
// first time. Not "until real revenue is nonzero" -- until the KIND fires. A simulated rupee
// in green is the single worst thing this product can do, and it is not a hypothetical: the
// owner's reference design shipped it (a green simulated 9,976 beside a green real 0), and
// two designers in the v2 round independently invented the fix.
//
// So the gate is structural rather than a rule someone remembers. `moneyInk` cannot return
// `var(--green)` unless it is handed a green gate that says the kind has fired, and
// `greenGate` FAILS CLOSED: if `/api/health` did not answer, green stays unspent. A colour
// understatement is a smaller wrong than a colour lie, and only one of the two is recoverable.
//
// ═══════════════════════════════════════════════════════════════════════════════════════
// FOUR THINGS THE DOOR'S REAL SHAPE FORCED, WRITTEN DOWN RATHER THAN DISCOVERED
//
//   1. `/api/pnl` SERVES NO COST TOTAL. `derivePnl` returns cost LINES (`venture.costs`,
//      `overhead.lines`) and never sums them -- costs arrive in their own currencies and
//      their payload carries no fx rate, and ADR-1003 forbids looking one up. So this file
//      does not sum them either: `costTally` COUNTS lines and groups them by currency, and
//      `returnStatement` refuses to compute a return BY NAME. A total assembled here would
//      be a number with no receipt behind it, which brief rule 3 forbids outright.
//
//   2. `model.mrr.byVenture` IS A `Map`, AND A `Map` JSON-SERIALISES TO `{}`. arc-dash's
//      `escapeDeep` walks `Object.keys`, so that field arrives on the wire as an empty
//      object on every read, always, even when MRR exists. It is not read here. The
//      per-venture number IS served, on `venture.mrr`, and that is what is rendered --
//      `mrrMapEmpty` reports the wire fact so the gap is visible rather than invisible.
//
//   3. `apiPnl` REFUSES A DAY-GRANULAR `?asof=` BY NAME. Its native time scope is
//      `?month=YYYY-MM`, because a month IS a time scope and a day is not one the money
//      brain has a seam for. `asOfSupport` carries that refusal verbatim, and neither room
//      offers a day scrubber -- a scrubber that silently does nothing is worse than none
//      (REQ-05). See `ASOF_MASKED_BY_KNOWN_REFUSALS` for the one hazard that leaves.
//
//   4. THE KILL PANEL IS FILE-BORNE AND THE P&L IS NOT. `deriveKillPanel` reads
//      `ventures.yaml` off the tree; `derivePnl` reads the spine. One route, two provenances
//      -- so the "file, not log" badge goes on the kill panel ALONE (`KILL_BADGE`) and never
//      over the money, and `fileBorneNote` says which half is which.

import { DoorError } from "./door.mjs";
import { decodeDoorText, fmtInt, refusalOf, toneForKind } from "./inbox.mjs";

// Re-exported so the two rooms have ONE import for their whole vocabulary. The rule still
// has exactly one home -- see rooms.mjs re-exporting `unescapeDoorText` for the same reason.
export { decodeDoorText, fmtInt, refusalOf, toneForKind };

/** @typedef {import("./inbox.mjs").Tone} Tone */
/** @typedef {import("./inbox.mjs").TileState} TileState */
/** @typedef {import("./inbox.mjs").HealthView} HealthView */
/** @typedef {{ code: string, human: string }} Refused */

/* ========================================================================== *
 * 0. the two sentences each room opens with
 *
 * The registry (`GET /api/rooms`) is the truth; these are the fallback for a room mounted
 * before it has answered. Same precedence and same reasoning as `roomOpening` in inbox.mjs
 * -- which is not reused directly only because its `ROOM_SENTENCE` table covers today and
 * inbox and would hand these two rooms `undefined`, i.e. a blank line where the largest
 * text on the page goes. Verbatim from initiatives/face/contracts/room-copy.json.
 * ========================================================================== */

export const MONEY_SENTENCE = "Real and simulated are different substances.";
export const MONEY_LEDE =
  "revenue.received is real-only and has never fired; everything else on this screen says so in its own colour";

export const VENTURES_SENTENCE = "The factory is not the product.";
export const VENTURES_LEDE =
  "each venture in its own repo with its own money and its own kill criteria — the venture track wins every tie";

/** @type {Record<string, { sentence: string, lede: string }>} */
const OPENINGS = Object.freeze({
  money: Object.freeze({ sentence: MONEY_SENTENCE, lede: MONEY_LEDE }),
  ventures: Object.freeze({ sentence: VENTURES_SENTENCE, lede: VENTURES_LEDE }),
});

/**
 * Which words a room opens with: what the shell was told explicitly, then the registry's own
 * entry (escaped, like everything the door serves), then the constant above.
 * @param {"money" | "ventures"} id
 * @param {{ sentence?: string, lede?: string } | undefined} room
 * @param {{ sentence?: string, lede?: string }} [overrides]
 * @returns {{ sentence: string, lede: string }}
 */
export function moneyOpening(id, room, overrides = {}) {
  const fallback = OPENINGS[id] ?? { sentence: "", lede: "" };
  const fromRegistry = room ?? {};
  return {
    sentence: overrides.sentence ?? (typeof fromRegistry.sentence === "string" && fromRegistry.sentence !== ""
      ? decodeDoorText(fromRegistry.sentence)
      : fallback.sentence),
    lede: overrides.lede ?? (typeof fromRegistry.lede === "string" && fromRegistry.lede !== ""
      ? decodeDoorText(fromRegistry.lede)
      : fallback.lede),
  };
}

/* ========================================================================== *
 * 1. the door's shape -- routes, scopes and the refusal it names
 * ========================================================================== */

/** The kind that records REAL money. One kind. Nothing else is ever painted --green. */
export const REAL_KIND = "revenue.received";
/** The non-real twin. Never added to the real one, never averaged with it, never adjacent to it in one row. */
export const SIM_KIND = "revenue.simulated";
/** Every rupee the company spends arrives as one of these. */
export const COST_KIND = "cost.incurred";
/** `venture: arc` is Overhead and is never attributed to a product (pnl.mjs, ADR-1006). */
export const OVERHEAD_VENTURE = "arc";
/** Everything on this route is reported in INR, converted at each event's OWN recorded rate. */
export const REPORTING_CURRENCY = "INR";

/** apiPnl validates `?month=` against exactly this. Checked here too, so a typo does not need a round trip. */
export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * The `/api/pnl` path for a scope. `Door` has a zero-argument `pnl()`, so anything scoped goes
 * through `door.call(pnlPath(...))` -- the client's own public escape hatch, not a second client.
 *
 * A malformed month is refused HERE as well as at the door, the precedent being `door.decide`
 * refusing an empty reason before the request leaves: the door's BAD_ARGS is the authority, and
 * a round trip to be told a month is not a month is a worse experience than being told at once.
 *
 * NO `asof` PARAMETER EXISTS ON PURPOSE. See `asOfSupport`.
 * @param {{ simulated?: boolean, venture?: string | null, month?: string | null }} [scope]
 * @returns {string}
 */
export function pnlPath(scope = {}) {
  const { simulated = false, venture = null, month = null } = scope;
  if (month !== null && !MONTH_RE.test(month))
    throw new DoorError("BAD_ARGS", `month ${JSON.stringify(month)} is not YYYY-MM, which is the only time scope this route has`, 0);
  const q = [];
  // `simulated=1` is the door's own spelling (`url.searchParams.get("simulated") === "1"`).
  // Anything else selects the REAL kind, so the flag is written exactly or not at all.
  if (simulated) q.push("simulated=1");
  if (venture !== null && venture !== "") q.push(`venture=${encodeURIComponent(venture)}`);
  if (month !== null) q.push(`month=${encodeURIComponent(month)}`);
  return q.length ? `/api/pnl?${q.join("&")}` : "/api/pnl";
}

/**
 * WHY THERE IS NO DAY SCRUBBER ON THESE TWO ROOMS, in the door's own words.
 *
 * `apiPnl` throws ASOF_UNSUPPORTED for any `?asof=` before it reads anything else. The message
 * below is that refusal verbatim from `.claude/scripts/hq/arc-dash.mjs`. It is quoted rather
 * than provoked because a UI that has to make the machine refuse in order to learn what it
 * refuses is a UI that will one day ship the request by accident.
 * @returns {{ supported: boolean, native: "month", code: string, human: string, offer: string }}
 */
export function asOfSupport() {
  return {
    supported: false,
    native: "month",
    code: "ASOF_UNSUPPORTED",
    human:
      "pnl's native as-of is ?month=YYYY-MM (a month IS a time scope); day-granular as-of needs an asof seam in the money brain's derivePnl and is deliberately not re-derived here (ADR-1301: the door never re-implements the money core)",
    offer:
      "No day scrubber is drawn here. A control that silently does nothing is worse than no control, and this one would be refused by name every time it moved.",
  };
}

/**
 * A HAZARD IN THE CLIENT, RECORDED WHERE IT WOULD BITE.
 *
 * `KNOWN_REFUSALS.ASOF_UNSUPPORTED` in door.mjs reads "This panel is file-borne; it has no
 * day-granular history to scrub to." -- true of the file-borne rooms it was written for, and
 * WRONG about the P&L, which is spine-borne and does have a month scope. `refusalOf` prefers
 * the known sentence over the door's own message, so a caller that ever sends `?asof=` on this
 * route would be shown the file-borne sentence and never told that `?month=` exists.
 *
 * Neither room sends one, which is why this is a note and not a bug today. Fixing it means
 * editing door.mjs, which these rooms do not own. Exported so a test can pin the fact.
 */
export const ASOF_MASKED_BY_KNOWN_REFUSALS = Object.freeze({
  route: "/api/pnl",
  clientSentence: "This panel is file-borne; it has no day-granular history to scrub to.",
  doorSentence: asOfSupport().human,
  note: "door.mjs's KNOWN_REFUSALS entry would mask the door's pnl-specific message. No caller in these two rooms sends ?asof=.",
});

/** The badge the KILL half of this route wears, and the money half does not. */
export const KILL_BADGE = "file, not log";

/**
 * Which half of `/api/pnl` came from where. One route, two provenances -- and a badge painted
 * across both would say the money is file-borne, which is the opposite of true.
 * @returns {{ half: string, source: string, badge: string | null, asof: string }[]}
 */
export function fileBorneNote() {
  return [
    {
      half: "the money",
      source: "the spine — every figure is derived at render from revenue and cost receipts, and nothing is cached",
      badge: null,
      asof: "scopes by month (?month=YYYY-MM); a day-granular as-of is refused by name",
    },
    {
      half: "the kill lines",
      source: "ventures.yaml on the tree, digested and folded against an approved receipt on the spine",
      badge: KILL_BADGE,
      asof: "none — a file has no day-granular history to scrub to",
    },
  ];
}

/* ========================================================================== *
 * 2. money, rendered
 *
 * A SECOND SPELLING OF `formatMinorUnits`, AND IT IS SANCTIONED.
 *
 * `.claude/scripts/hq/lib/ledger/money.mjs` owns the original. face/ imports nothing from
 * `.claude/**` -- that is the whole contract of ADR-1316 and the reason this tree can be split
 * out -- so the alternative to copying it is the door serving pre-formatted strings, which it
 * does not do and should not (a formatted string cannot be re-scoped by a client).
 *
 * The rules are copied exactly and the reasons with them: Indian grouping for INR because a
 * P&L its owner reads at a glance in the wrong grouping is a P&L read wrong; hand-rolled
 * grouping rather than `toLocaleString` because that would make the digits depend on the CI
 * leg's ICU data; and an unpinned currency is REFUSED rather than guessed (ADR-1013), because
 * an assumed exponent is a number wrong by a factor of a hundred.
 * ========================================================================== */

/** The pinned minor-unit exponents. Copied from ledger/money.mjs; a currency not here is refused. */
export const MINOR_EXPONENT = Object.freeze({ INR: 2, USD: 2 });

/** @param {unknown} currency @returns {number | null} */
export function minorExponent(currency) {
  if (typeof currency !== "string") return null;
  const e = Object.prototype.hasOwnProperty.call(MINOR_EXPONENT, currency)
    ? /** @type {Record<string, number>} */ (MINOR_EXPONENT)[currency]
    : undefined;
  return typeof e === "number" ? e : null;
}

/** @param {string} s */
function groupThousands(s) {
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** 2,2,3 from the right — 1,00,000 rather than 100,000. @param {string} s */
function groupIndian(s) {
  if (s.length <= 3) return s;
  const head = s.slice(0, s.length - 3);
  const tail = s.slice(s.length - 3);
  return head.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + tail;
}

/**
 * An integer count of minor units, as a human string.
 *
 * `exact: false` means the currency has no pinned exponent, so the RAW minor units are shown
 * with the code beside them and no decimal point is invented. That is uglier than a guess and
 * it is the only honest option: `formatMinorUnits` in the ledger refuses outright, and a
 * renderer that refuses outright would delete the row instead of showing what it does know.
 * @param {unknown} amount   an integer count of minor units
 * @param {unknown} currency
 * @returns {{ text: string, exact: boolean, note: string }}
 */
export function formatMinor(amount, currency) {
  if (typeof amount !== "number" || !Number.isSafeInteger(amount))
    return {
      text: "not a number",
      exact: false,
      note: "the door served an amount that is not an integer count of minor units (ADR-1012). It renders absent rather than as a number nobody can trust.",
    };
  const exp = minorExponent(currency);
  const code = typeof currency === "string" && currency !== "" ? currency : "?";
  if (exp === null)
    return {
      text: `${groupThousands(String(Math.abs(amount)))} ${code} minor units`,
      exact: false,
      note: `${code} has no pinned minor-unit exponent here (ADR-1013), so the raw minor units are shown. Guessing an exponent is how a number ends up wrong by a factor of a hundred.`,
    };
  const neg = amount < 0;
  const digits = String(Math.abs(amount)).padStart(exp + 1, "0");
  const whole = digits.slice(0, digits.length - exp);
  const frac = exp === 0 ? "" : "." + digits.slice(digits.length - exp);
  const grouped = code === "INR" ? groupIndian(whole) : groupThousands(whole);
  return { text: `${neg ? "-" : ""}${grouped}${frac}`, exact: true, note: "" };
}

/**
 * Reporting currency shorthand. Every figure on `/api/pnl` is already converted to INR.
 * @param {unknown} amount
 * @returns {{ text: string, exact: boolean, note: string }}
 */
export function rupees(amount) {
  return formatMinor(amount, REPORTING_CURRENCY);
}

/* ========================================================================== *
 * 3. the honesty model -- state, glyph, ink
 *
 * `TileState` and `Tone` are inbox.mjs's, deliberately: Today already carries the three-state
 * model and a second vocabulary for the same idea is how one of them ends up meaning something
 * slightly different. `toneForKind` is the ONLY place a kind is granted a reserved hue, and it
 * is called here rather than re-implemented, which is why "cost.incurred is real and is not
 * revenue, so it does not get the revenue colour" holds on this screen for free.
 * ========================================================================== */

/**
 * @typedef {object} GreenGate
 * @property {boolean} spendable    may --green be painted at all on this read
 * @property {string} why           the sentence behind the answer
 * @property {string} source        the exact route and field
 * @property {string | null} contradiction  set when two reads disagree about the same fact
 */

/**
 * WHETHER --green MAY BE PAINTED. Fails closed.
 *
 * The authority is `/api/health` -> `spine.kinds`, the set of kinds that have EVER fired --
 * the same field `moneyTile` uses on Today, so the two rooms cannot disagree about whether the
 * company has earned. `/api/pnl` -> `model.counts.revenue` is read only to CROSS-CHECK it: the
 * two are derived from the same log by different code, so a disagreement is a real finding and
 * is reported rather than resolved by preferring one.
 *
 * Health absent -> NOT spendable. Green on a guess is the defect this whole file is shaped
 * around; green missing from a real rupee is a understatement the next read corrects.
 * @param {{ health: HealthView | null, real: PnlView | null }} input
 * @returns {GreenGate}
 */
export function greenGate({ health, real }) {
  const source = "GET /api/health → spine.kinds (the set of kinds that have ever fired)";
  const counted = real && real.counts ? real.counts.revenue : null;
  if (!health || typeof health !== "object")
    return {
      spendable: false,
      why: "/api/health has not answered on this read, so nothing here can prove revenue.received has ever fired. Real money's colour stays unspent rather than being painted on an assumption.",
      source,
      contradiction: null,
    };
  // AN ARRAY, or the gate stays shut.
  //
  // This read `health.kinds.indexOf(REAL_KIND)` on whatever arrived, and an adversarial pass
  // showed both halves of that failing open. `{kinds: "the revenue.received kind"}` -- a
  // STRING -- made `indexOf` find the substring and returned `spendable: true`: the gate that
  // guards real money's colour, opened by a sentence. And `{}` or `{kinds: null}` THREW,
  // which is not the gate staying shut, it is the room refusing to render at all.
  //
  // A malformed health body is not evidence that revenue has ever arrived. It is no evidence,
  // and no evidence means unspent.
  if (!Array.isArray(health.kinds))
    return {
      spendable: false,
      why: `/api/health answered without a kinds ARRAY (got ${health.kinds === undefined ? "no field" : typeof health.kinds}), so nothing here can prove ${REAL_KIND} has ever fired. Real money's colour stays unspent rather than being painted on a shape nobody checked.`,
      source,
      contradiction: null,
    };
  const fired = health.kinds.includes(REAL_KIND);
  // Both directions are checked. A kinds-set that omits a kind the P&L counted, and a P&L
  // counting nothing for a kind the kinds-set carries, are different bugs and neither is a
  // reason to pick the friendlier answer.
  let contradiction = null;
  if (counted !== null && fired && counted === 0)
    contradiction = `/api/health lists ${REAL_KIND} among the kinds that have fired, and /api/pnl counted 0 of them. Two reads of one log disagree; nothing here resolves that for you.`;
  if (counted !== null && !fired && counted > 0)
    contradiction = `/api/pnl counted ${fmtInt(counted)} ${REAL_KIND} event(s) and /api/health does not list that kind as ever having fired. Two reads of one log disagree; the colour stays unspent until they do not.`;
  return {
    spendable: fired && contradiction === null,
    why: fired
      ? `${REAL_KIND} has fired. Real money may wear its own colour on this screen.`
      : `${REAL_KIND} has never fired. Not zero rupees measured — no measurement exists, so real money's colour is unspent and nothing on this screen wears it.`,
    source,
    contradiction,
  };
}

/**
 * @typedef {"measured" | "never-fired" | "absent" | "not-served"} FigureState
 */

/**
 * @typedef {object} Figure
 * @property {string} text          already formatted; "" when the glyph carries the meaning
 * @property {FigureState} state
 * @property {Tone} tone
 * @property {"solid" | "hollow" | "dash" | "none"} glyph
 * @property {boolean} hatch        the non-real family's texture; hue alone is not enough
 * @property {string} ink           a var() from tokens.css. Never a literal, never --green unguarded.
 * @property {string} note          the sentence that keeps this figure from lying
 * @property {string} why           the exact route and field this came from
 */

/**
 * The ink for a tone, WITH THE GREEN GATE APPLIED.
 *
 * Not a static table like Today's `TONE_INK`, and that is the whole point: real money's colour
 * is conditional on a fact about the log, and a lookup table cannot hold a condition. Every
 * value is a var() -- a second spelling of a colour is how a reserved meaning rots.
 * @param {Tone} tone
 * @param {GreenGate} gate
 * @returns {string}
 */
export function moneyInk(tone, gate) {
  switch (tone) {
    // THE ONE GUARDED BRANCH. There is no other path to --green in this file.
    case "real-money":
      return gate.spendable ? "var(--green)" : "var(--faint)";
    case "non-real":
      return "var(--sim-fg)";
    case "incident":
      return "var(--red)";
    case "needs-you":
      return "var(--amber)";
    case "chrome":
      return "var(--accent-dim)";
    default:
      return "var(--prose)";
  }
}

/**
 * HOW A NOTHING IS DRAWN. The eye reads shape and colour before it reads text, so the
 * difference between the kinds of nothing has to survive with the words removed.
 *
 *   solid   a filled numeral -- "0.00" and "1,20,000.00" are the same object at rest
 *   hollow  an OUTLINED, DASHED ring the size of the numeral it stands in for. Dashed is
 *           already the product's mark for "built and has never run" (map.mjs draws
 *           unexercised stations dashed), so this is the same statement in a second place
 *           rather than a new one.
 *   dash    an em-dash -- the component was never recorded. ledger/money.mjs's own ABSENT.
 *   none    the state's words carry it (`not served`), and no glyph pretends otherwise.
 * @param {FigureState} state
 * @returns {{ shape: "solid" | "hollow" | "dash" | "none", label: string, title: string }}
 */
export function zeroGlyph(state) {
  switch (state) {
    case "measured":
      return {
        shape: "solid",
        label: "",
        title: "measured from receipts on the spine",
      };
    case "never-fired":
      return {
        shape: "hollow",
        label: "never",
        title: "the kind that records this has never fired. There is no zero here — there is no measurement.",
      };
    case "absent":
      return {
        shape: "dash",
        label: "—",
        title: "never recorded on the event. An unknown fee and a waived fee are different facts, and neither is a zero.",
      };
    default:
      return {
        shape: "none",
        label: "not served",
        title: "the door did not serve this figure on this read — the body did not arrive, or arrived without the field. That is a fact about the READ, not about the money.",
      };
  }
}

/**
 * ONE FIGURE, DRAWN HONESTLY. Every number on either room goes through here.
 *
 * `everFired` is the caller's evidence that the kind that records this figure has happened AT
 * THIS SCOPE -- for the company, `spine.kinds`; for one venture, whether the door returned a
 * bucket for it. It is a required argument rather than a default because a default here is a
 * silent vote for one of the two states this file exists to keep apart.
 *
 * @param {object} input
 * @param {string} input.kind        the spine kind this figure is made of; decides the tone
 * @param {number | null} input.amount  minor units, or null for "the door did not serve it"
 * @param {string} [input.currency]
 * @param {boolean} input.everFired
 * @param {GreenGate} input.gate
 * @param {string} input.why         the route and field. Every figure carries its receipt.
 * @param {string} [input.scope]     what "never" is scoped to, in words
 * @returns {Figure}
 */
export function moneyFigure({ kind, amount, currency = REPORTING_CURRENCY, everFired, gate, why, scope = "on this spine" }) {
  const tone = toneForKind(kind);
  const ink = moneyInk(tone, gate);
  const hatch = tone === "non-real";

  if (!everFired) {
    const g = zeroGlyph("never-fired");
    return {
      text: g.label,
      state: "never-fired",
      tone,
      glyph: g.shape,
      hatch,
      // A never-fired figure is NEVER painted a money colour, real or simulated: there is no
      // money to colour. It takes the faint ink and the outline carries the meaning.
      ink: "var(--faint)",
      note: `${kind} has never fired ${scope}. Not zero — no measurement exists.`,
      why,
    };
  }
  if (amount === null) {
    const g = zeroGlyph("not-served");
    return { text: g.label, state: "not-served", tone, glyph: g.shape, hatch, ink: "var(--faint)", note: g.title, why };
  }
  const money = formatMinor(amount, currency);
  return {
    text: money.text,
    state: "measured",
    tone,
    glyph: "solid",
    hatch,
    ink,
    note: amount === 0
      ? `measured from receipts, and it is zero. ${kind} has fired ${scope}; this scope nets to nothing.`
      : money.exact ? "" : money.note,
    why,
  };
}

/**
 * A P&L COMPONENT -- gross, fees, tax, net. `null` here means ABSENT, never zero.
 *
 * `derivePnl` writes the rule this honours: "ABSENT STAYS ABSENT. A component nobody recorded
 * contributes nothing and renders absent; it is never coerced to 0, because an unknown fee and
 * a waived fee are different facts."
 * @param {number | null} value
 * @param {string} label
 * @param {GreenGate} gate
 * @param {string} kind
 * @param {string} why
 * @returns {Figure & { label: string }}
 */
export function componentFigure(value, label, gate, kind, why) {
  const tone = toneForKind(kind);
  if (value === null) {
    const g = zeroGlyph("absent");
    return { label, text: g.label, state: "absent", tone, glyph: g.shape, hatch: tone === "non-real", ink: "var(--faint)", note: g.title, why };
  }
  const money = rupees(value);
  return {
    label,
    text: money.text,
    state: "measured",
    tone,
    glyph: "solid",
    hatch: tone === "non-real",
    ink: moneyInk(tone, gate),
    note: value === 0 ? "recorded, and it is zero — which is not the same as never recorded" : money.note,
    why,
  };
}

/**
 * THE FIFTH THING THAT IS NOT A NUMBER, and the one that only exists on a scoped read.
 *
 * The kind HAS fired — so this is not "never fired" — and the door answered — so it is not
 * "not served" — and yet no receipt of it survived into this scope. That happens when every
 * event was excluded as a duplicate or an unpinned currency, or when a month filter left the
 * bucket empty. It renders as an absence with its own sentence rather than as any of the four,
 * because calling it a measured zero would assert an arithmetic nobody performed.
 * @param {object} input
 * @param {string} input.kind
 * @param {string} input.why
 * @param {string} input.scope
 * @returns {Figure}
 */
export function noRowsFigure({ kind, why, scope }) {
  const tone = toneForKind(kind);
  return {
    text: zeroGlyph("absent").label,
    state: "absent",
    tone,
    glyph: "dash",
    hatch: tone === "non-real",
    ink: "var(--faint)",
    note: `${kind} has fired, and no receipt of it survived into this scope (${scope}). That is not a zero: no sum was performed here at all.`,
    why,
  };
}

/* ========================================================================== *
 * 4. reading what the door returned
 *
 * Every reader takes `unknown`. A field the door did not send comes back `null` -- never 0,
 * never "" -- so "the door did not say" stays distinguishable from "the door said zero" all
 * the way to the pixel. Human strings are decoded once, here, where they enter.
 * ========================================================================== */

/** @param {unknown} v @returns {Record<string, unknown>} */
function asObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? /** @type {Record<string, unknown>} */ (v) : {};
}

/** @param {unknown} v @returns {unknown[]} */
function asArray(v) {
  return Array.isArray(v) ? v : [];
}

/**
 * Machine vocabulary — ids, kinds, ULIDs, digests. Verbatim: none of them can hold an entity.
 * @param {unknown} v @param {string} [fallback] @returns {string}
 */
function asToken(v, fallback = "") {
  return typeof v === "string" ? v : fallback;
}

/** Human text — decoded. @param {unknown} v @returns {string | null} */
function asText(v) {
  return typeof v === "string" && v.length ? decodeDoorText(v) : null;
}

/** @param {unknown} v @returns {number | null} */
function asNum(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Code-unit order, never localeCompare: a table that reorders itself between CI legs is a diff
 * nobody can read, and canonical.mjs refuses localeCompare for the same reason.
 * @param {string} a @param {string} b @returns {number}
 */
function byCodeUnit(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * A TOTAL order over receipts. ULIDs are unique, so (ts, id) never ties -- and a comparator that
 * can tie is a comparator whose output depends on the reader's arrival order.
 * @param {{ ts: string, id: string }} a @param {{ ts: string, id: string }} b @returns {number}
 */
export function byTsId(a, b) {
  return a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : byCodeUnit(a.id, b.id);
}

/**
 * @typedef {object} CostLine
 * @property {string} id
 * @property {string} ts
 * @property {string | null} source    measured | estimated | manual — arc's own word, verbatim
 * @property {number | null} amount    minor units; null when the event carried something else
 * @property {string | null} currency
 * @property {string | null} label
 */

/**
 * @typedef {object} RevenueRow
 * @property {string} id
 * @property {string} ts
 * @property {string} paymentId
 * @property {string | null} refundOf
 * @property {number | null} amount     native minor units; negative on a refund row
 * @property {string | null} currency
 * @property {number | null} amountInr
 * @property {number | null} gross
 * @property {number | null} fees
 * @property {number | null} tax
 * @property {number | null} net
 * @property {string | null} plan
 * @property {string | null} interval
 * @property {string | null} rate       the fx rate recorded ON THIS EVENT. Never looked up.
 */

/**
 * @typedef {object} VentureMoney
 * @property {string} venture
 * @property {number | null} gross
 * @property {number | null} fees
 * @property {number | null} tax
 * @property {number | null} net
 * @property {number | null} cashIn
 * @property {number | null} mrr
 * @property {RevenueRow[]} rows
 * @property {CostLine[]} costs
 */

/**
 * @typedef {object} PnlFlag
 * @property {string} type
 * @property {string} venture
 * @property {string} detail
 */

/**
 * @typedef {object} MrrTransition
 * @property {string} venture
 * @property {string} month
 * @property {string} id
 * @property {string} type
 * @property {number | null} from
 * @property {number | null} to
 */

/**
 * @typedef {object} PnlView
 * @property {"real" | "simulated"} substance   which kind this body was derived from
 * @property {string} kind                      the spine kind, spelled the way arc spells it
 * @property {string} doorMode                  live | sim — the DOOR's data mode, not the money's
 * @property {string | null} month
 * @property {string | null} ventureFilter
 * @property {string | null} engine
 * @property {VentureMoney[]} ventures
 * @property {{ venture: string, lines: CostLine[] }} overhead
 * @property {{ asOfMonth: string | null, transitions: MrrTransition[], mapEmpty: boolean }} mrr
 * @property {PnlFlag[]} needsYou
 * @property {{ revenue: number | null, charges: number | null, refunds: number | null, costs: number | null }} counts
 */

/** @param {unknown} raw @returns {CostLine} */
function readCostLine(raw) {
  const o = asObject(raw);
  return {
    id: asToken(o["id"]),
    ts: asToken(o["ts"]),
    source: asText(o["source"]),
    amount: asNum(o["amount"]),
    currency: asToken(o["currency"], "") || null,
    label: asText(o["label"]),
  };
}

/** @param {unknown} raw @returns {RevenueRow} */
function readRevenueRow(raw) {
  const o = asObject(raw);
  const fx = asObject(o["fx"]);
  return {
    id: asToken(o["id"]),
    ts: asToken(o["ts"]),
    paymentId: asToken(o["paymentId"]),
    refundOf: asToken(o["refundOf"], "") || null,
    amount: asNum(o["amount"]),
    currency: asToken(o["currency"], "") || null,
    amountInr: asNum(o["amountInr"]),
    gross: asNum(o["gross"]),
    fees: asNum(o["fees"]),
    tax: asNum(o["tax"]),
    net: asNum(o["net"]),
    plan: asText(o["plan"]),
    interval: asToken(o["interval"], "") || null,
    rate: asToken(fx["rate"], "") || null,
  };
}

/** @param {unknown} raw @returns {VentureMoney} */
function readVenture(raw) {
  const o = asObject(raw);
  return {
    venture: asToken(o["venture"]),
    gross: asNum(o["gross"]),
    fees: asNum(o["fees"]),
    tax: asNum(o["tax"]),
    net: asNum(o["net"]),
    cashIn: asNum(o["cashIn"]),
    mrr: asNum(o["mrr"]),
    rows: asArray(o["rows"]).map(readRevenueRow).sort(byTsId),
    costs: asArray(o["costs"]).map(readCostLine).sort(byTsId),
  };
}

/**
 * The whole `GET /api/pnl` body, narrowed.
 *
 * `substance` is derived from `model.mode` and NOT from the caller's own request: if a client
 * asks for simulated and the door answers with the real model, the screen must say REAL. A
 * renderer that labels a body by what it asked for rather than by what arrived is a
 * watermark that can be wrong, which is worse than no watermark at all.
 * @param {unknown} raw
 * @returns {PnlView}
 */
export function readPnl(raw) {
  const body = asObject(raw);
  const model = asObject(body["model"]);
  const mrr = asObject(model["mrr"]);
  const overhead = asObject(model["overhead"]);
  const counts = asObject(model["counts"]);
  const simulated = model["mode"] === "simulated";

  /** @type {MrrTransition[]} */
  const transitions = asArray(mrr["transitions"]).map((t) => {
    const o = asObject(t);
    return {
      venture: asToken(o["venture"]),
      month: asToken(o["month"]),
      id: asToken(o["id"]),
      type: asToken(o["type"]),
      from: asNum(o["from"]),
      to: asNum(o["to"]),
    };
  });

  return {
    substance: simulated ? "simulated" : "real",
    kind: simulated ? SIM_KIND : REAL_KIND,
    doorMode: asToken(body["mode"], "unknown"),
    month: asToken(body["month"], "") || null,
    ventureFilter: asToken(model["ventureFilter"], "") || null,
    engine: asToken(model["engine"], "") || null,
    ventures: asArray(model["ventures"]).map(readVenture).sort((a, b) => byCodeUnit(a.venture, b.venture)),
    overhead: {
      venture: asToken(overhead["venture"], OVERHEAD_VENTURE),
      lines: asArray(overhead["lines"]).map(readCostLine).sort(byTsId),
    },
    mrr: {
      asOfMonth: asToken(mrr["asOfMonth"], "") || null,
      transitions: transitions.sort((a, b) =>
        byCodeUnit(a.month, b.month) || byCodeUnit(a.venture, b.venture) || byCodeUnit(a.type, b.type) || byCodeUnit(a.id, b.id)),
      // A `Map` crosses JSON as `{}`. Reported, not read -- see the header, compromise 2.
      mapEmpty: Object.keys(asObject(mrr["byVenture"])).length === 0,
    },
    needsYou: asArray(model["needsYou"]).map((f) => {
      const o = asObject(f);
      return {
        type: asToken(o["type"], "UNNAMED"),
        venture: asToken(o["venture"], ""),
        detail: asText(o["detail"]) ?? "the door raised a flag and said nothing about why, which is itself the defect",
      };
    }).sort((a, b) => byCodeUnit(a.type, b.type) || byCodeUnit(a.detail, b.detail)),
    counts: {
      revenue: asNum(counts["revenue"]),
      charges: asNum(counts["charges"]),
      refunds: asNum(counts["refunds"]),
      costs: asNum(counts["costs"]),
    },
  };
}

/* ========================================================================== *
 * 5. the kill panel
 * ========================================================================== */

/** @typedef {"CROSSED" | "WARNING" | "OK" | "ABSENT"} KillStatus */

/**
 * @typedef {object} Criterion
 * @property {string} criterion
 * @property {string} status
 * @property {number | null} threshold
 * @property {number | null} value
 * @property {number | null} distance   SIGNED, and in the criterion's own unit on both polarities
 * @property {string | null} unit
 * @property {string | null} reason     mandatory when ABSENT, null otherwise
 */

/**
 * @typedef {object} KillVenture
 * @property {string} venture
 * @property {Criterion[]} criteria
 * @property {string | null} worst
 * @property {number | null} absentCount
 */

/**
 * @typedef {object} KillView
 * @property {"panel" | "absent" | "unreceipted" | "not-served"} state
 * @property {string | null} digest
 * @property {string | null} path
 * @property {string | null} asOf
 * @property {KillVenture[]} ventures
 * @property {(Criterion & { venture: string })[]} crossings
 * @property {(Criterion & { venture: string })[]} warnings
 * @property {number | null} absentCount
 * @property {{ venture: string, count: number | null }[]} futureRevenue
 * @property {Refused | null} refusal
 * @property {string} badge
 */

/** @param {unknown} raw @returns {Criterion} */
function readCriterion(raw) {
  const o = asObject(raw);
  return {
    criterion: asToken(o["criterion"]),
    status: asToken(o["status"], "ABSENT"),
    threshold: asNum(o["threshold"]),
    value: asNum(o["value"]),
    distance: asNum(o["distance"]),
    unit: asText(o["unit"]),
    reason: asText(o["reason"]),
  };
}

/**
 * The kill half of `GET /api/pnl`, narrowed into FOUR named states.
 *
 * The three the deriver can return each mean something different the owner might do next, and
 * collapsing them into "no panel" is how a disarmed kill switch looks identical to a healthy
 * one. The fourth -- `not-served` -- is this client's, for a body that arrived without the
 * field at all.
 *
 *   panel        criteria receipted; distances are real
 *   absent       there is no ventures.yaml on this tree. Every consumer install is here:
 *                ventures.yaml is arc's own organ and is not in the sync set.
 *   unreceipted  the file was EDITED and the new digest has no approved receipt. This is the
 *                control working. It is the loudest state on the screen, not the quietest.
 *   not-served   the body carried no `kill` object.
 * @param {unknown} raw   the raw GET /api/pnl body
 * @returns {KillView}
 */
export function readKill(raw) {
  const body = asObject(raw);
  const k = body["kill"];
  /** @type {KillView} */
  const base = {
    state: "not-served",
    digest: null,
    path: null,
    asOf: null,
    ventures: [],
    crossings: [],
    warnings: [],
    absentCount: null,
    futureRevenue: [],
    refusal: null,
    badge: KILL_BADGE,
  };

  if (k === undefined || k === null || typeof k !== "object" || Array.isArray(k))
    return {
      ...base,
      refusal: {
        code: "KILL_NOT_SERVED",
        human:
          "The P&L answered without its kill panel. No distance is drawn from a field that did not arrive — an absent panel and a healthy one must never look the same.",
      },
    };

  const o = asObject(k);
  const digest = asToken(o["digest"], "") || null;
  const path = asText(o["path"]);

  if (o["present"] !== true)
    return {
      ...base,
      state: "absent",
      refusal: {
        code: "NO_VENTURES",
        human:
          "There is no ventures.yaml on the tree this door is serving, so no kill lines are declared and none are drawn. That is the expected state for every install that is not arc's own: ventures.yaml is arc's own company organ and is not in the sync set.",
      },
    };

  if (o["receipted"] !== true)
    return {
      ...base,
      state: "unreceipted",
      digest,
      path,
      refusal: {
        code: "UNRECEIPTED CRITERIA CHANGE",
        human:
          `ventures.yaml has been changed and the criteria now in it (digest ${digest ?? "unknown"}) have no approved receipt on the spine. ` +
          "No distance is drawn against kill lines nobody approved — a control that authorises itself is not a control (ADR-1008 / ADR-1017). " +
          "To clear it: run `node .claude/scripts/hq/arc-pnl.mjs --criteria-digest` for the new digest, emit the approval carrying it, and decide it in the Inbox.",
      },
    };

  const ventures = asArray(o["ventures"]).map((v) => {
    const e = asObject(v);
    return {
      venture: asToken(e["venture"]),
      criteria: asArray(e["criteria"]).map(readCriterion).sort((a, b) => byCodeUnit(a.criterion, b.criterion)),
      worst: asToken(e["worst"], "") || null,
      absentCount: asNum(e["absentCount"]),
    };
  }).sort((a, b) => byCodeUnit(a.venture, b.venture));

  /** @param {unknown} list @returns {(Criterion & { venture: string })[]} */
  const flat = (list) => asArray(list).map((c) => ({ venture: asToken(asObject(c)["venture"]), ...readCriterion(c) }))
    .sort((a, b) => byCodeUnit(a.venture, b.venture) || byCodeUnit(a.criterion, b.criterion));

  return {
    state: "panel",
    digest,
    path,
    asOf: asToken(o["asOf"], "") || null,
    ventures,
    crossings: flat(o["crossings"]),
    warnings: flat(o["warnings"]),
    absentCount: asNum(o["absentCount"]),
    futureRevenue: asArray(o["futureRevenue"]).map((f) => {
      const e = asObject(f);
      return { venture: asToken(e["venture"]), count: asNum(e["count"]) };
    }).sort((a, b) => byCodeUnit(a.venture, b.venture)),
    refusal: null,
    badge: KILL_BADGE,
  };
}

/**
 * ONE CRITERION, IN WORDS AND IN A TONE.
 *
 * An ABSENT row is PRINTED, never dropped, and it is not OK: "a list that silently omits what
 * it could not evaluate is shorter and greener than the truth, and indistinguishable from a
 * healthy venture" (ADR-1018). `traffic_floor_monthly` is ABSENT for every venture on every
 * render in this lane and always will be until something counts visits -- rendering it as OK
 * would silently disable half the kill switch on day one.
 *
 * The distance sentence works on BOTH polarities without knowing which one it has, because
 * `distance` is signed and carries the criterion's own unit -- which is exactly the invariant
 * kill-distance.mjs documents.
 * @param {Criterion} c
 * @returns {{ headline: string, detail: string, tone: Tone, state: FigureState, ink: string, danger: boolean }}
 */
export function criterionSentence(c) {
  const unit = c.unit === null || c.unit === "" ? "" : ` ${c.unit}`;
  const line = c.threshold === null ? "a line that is not declared" : `${fmtInt(c.threshold)}${unit}`;
  if (c.status === "ABSENT")
    return {
      headline: "not evaluated",
      detail: c.reason ?? "the panel marked this criterion absent and gave no reason, which is itself the defect",
      // NOT a danger colour and NOT a healthy one. An absence is not a degree of safety --
      // kill-distance.mjs refuses to rank it for the same reason.
      tone: "quiet",
      state: "absent",
      ink: "var(--faint)",
      danger: false,
    };
  if (c.status === "CROSSED")
    return {
      headline: "CROSSED",
      detail: `${c.value === null ? "the observation" : fmtInt(c.value)}${unit} against a line of ${line}. This one is past its kill line and needs you.`,
      tone: "needs-you",
      state: "measured",
      ink: "var(--amber)",
      danger: true,
    };
  if (c.status === "WARNING")
    return {
      headline: `${c.distance === null ? "inside the warning band" : `${fmtInt(Math.abs(c.distance))}${unit} to the line`}`,
      detail: `${c.value === null ? "the observation" : fmtInt(c.value)}${unit} against a line of ${line} — inside the last fifth of the way.`,
      tone: "needs-you",
      state: "measured",
      ink: "var(--amber)",
      danger: true,
    };
  return {
    headline: `${c.distance === null ? "clear of the line" : `${fmtInt(Math.abs(c.distance))}${unit} to the line`}`,
    detail: `${c.value === null ? "the observation" : fmtInt(c.value)}${unit} against a line of ${line}.`,
    tone: "quiet",
    state: "measured",
    ink: "var(--prose)",
    danger: false,
  };
}

/**
 * The one-line summary of the whole panel, for the Money room, which shows the shape and sends
 * the reader to Ventures for the detail.
 * @param {KillView} kill
 * @returns {{ sentence: string, danger: boolean, counts: { crossed: number, warning: number, absent: number | null, ventures: number } }}
 */
export function killSummary(kill) {
  const counts = {
    crossed: kill.crossings.length,
    warning: kill.warnings.length,
    absent: kill.absentCount,
    ventures: kill.ventures.length,
  };
  if (kill.state !== "panel")
    return { sentence: kill.refusal ? kill.refusal.human : "no kill panel on this read", danger: kill.state === "unreceipted", counts };
  const parts = [];
  parts.push(counts.ventures === 1
    ? "1 venture carries declared kill lines"
    : `${fmtInt(counts.ventures)} ventures carry declared kill lines`);
  parts.push(counts.crossed === 0
    ? "none is past one"
    : `${fmtInt(counts.crossed)} ${counts.crossed === 1 ? "line is" : "lines are"} CROSSED`);
  if (counts.warning > 0) parts.push(`${fmtInt(counts.warning)} inside the warning band`);
  if (counts.absent !== null && counts.absent > 0)
    parts.push(`${fmtInt(counts.absent)} criteri${counts.absent === 1 ? "on" : "a"} could not be evaluated at all`);
  return { sentence: parts.join(" · "), danger: counts.crossed > 0 || counts.warning > 0, counts };
}

/* ========================================================================== *
 * 6. the Money room's panels
 * ========================================================================== */

/**
 * @typedef {object} RevenuePanel
 * @property {"real" | "simulated"} substance
 * @property {string} kind
 * @property {string} title
 * @property {string} lede
 * @property {boolean} hatch          the whole region wears the texture, not just a badge
 * @property {string} watermark       "" for real; the mark that must be on every line for simulated
 * @property {Figure} cashIn
 * @property {Figure} mrr
 * @property {(Figure & { label: string })[]} components
 * @property {{ venture: string, cashIn: Figure, mrr: Figure, rows: RevenueRow[] }[]} ventures
 * @property {string} why
 * @property {string} scopeNote
 */

/**
 * ONE SUBSTANCE, ONE PANEL. Real and simulated are assembled by the same function from two
 * DIFFERENT door reads, and never merged: `derivePnl` selects one kind at the top and never
 * reads the other, and this preserves that shape rather than filtering at the end. A filter
 * applied late is a filter a future edit can forget.
 *
 * THE COMPANY-LEVEL FIGURE IS NOT A TOTAL THIS FILE COMPUTED. When the door returns exactly
 * one venture, the company figure IS that venture's `cashIn` -- a number the door served. With
 * more than one, no company figure is drawn at all: summing them here would be a total with no
 * receipt, which brief rule 3 forbids. `scopeNote` says which of the two happened.
 * `want` NAMES THE PANEL WHEN THE BODY DID NOT ARRIVE, AND ONLY THEN.
 *
 * The first cut defaulted an absent body to "real", so a failed simulated read drew a panel
 * headed "real revenue" carrying the simulated read's refusal -- a panel labelled the opposite
 * of what it is, on the one screen where mislabelling a substance is the whole failure. When a
 * body DID arrive, `pnl.substance` still wins: a client that labels a response by what it asked
 * for rather than by what came back is a watermark that can be wrong, which is worse than none.
 *
 * @param {object} input
 * @param {PnlView | null} input.pnl
 * @param {GreenGate} input.gate
 * @param {boolean} input.everFired   has the kind that records this substance ever fired
 * @param {"real" | "simulated"} input.want  which panel this is, for when nothing arrived
 * @returns {RevenuePanel}
 */
export function revenuePanel({ pnl, gate, everFired, want }) {
  const substance = pnl === null ? want : pnl.substance;
  const kind = substance === "simulated" ? SIM_KIND : REAL_KIND;
  const simulated = substance === "simulated";
  const why = `GET ${pnlPath({ simulated })} → model.ventures[].cashIn`;
  const scope = simulated ? "on this spine" : "on this spine";

  const list = pnl === null ? [] : pnl.ventures;
  const single = list.length === 1 ? list[0] : undefined;

  /** @param {number | null} amount @param {string} field */
  const fig = (amount, field) =>
    moneyFigure({ kind, amount, everFired, gate, why: `GET ${pnlPath({ simulated })} → ${field}`, scope });

  /**
   * The three ways there is no single company figure, told apart rather than collapsed.
   * @param {string} field
   */
  const noSingle = (field) => {
    const w = `GET ${pnlPath({ simulated })} → ${field}`;
    if (pnl === null) return moneyFigure({ kind, amount: null, everFired, gate, why: w, scope });
    if (!everFired) return moneyFigure({ kind, amount: null, everFired: false, gate, why: w, scope });
    if (list.length === 0) return noRowsFigure({ kind, why: w, scope });
    // More than one venture. There IS money; there is no company total to show it as, and one
    // is not assembled here. The per-venture rows below carry every rupee of it.
    return noRowsFigure({ kind, why: w, scope: `${fmtInt(list.length)} ventures — read them one by one below` });
  };

  const cashIn = single === undefined ? noSingle("model.ventures[].cashIn") : fig(single.cashIn, "model.ventures[0].cashIn");
  const mrr = single === undefined ? noSingle("model.ventures[].mrr") : fig(single.mrr, "model.ventures[0].mrr");

  const components = single === undefined
    ? []
    : [
      componentFigure(single.gross, "gross", gate, kind, `GET ${pnlPath({ simulated })} → model.ventures[0].gross`),
      componentFigure(single.fees, "fees", gate, kind, `GET ${pnlPath({ simulated })} → model.ventures[0].fees`),
      componentFigure(single.tax, "tax", gate, kind, `GET ${pnlPath({ simulated })} → model.ventures[0].tax`),
      componentFigure(single.net, "net", gate, kind, `GET ${pnlPath({ simulated })} → model.ventures[0].net`),
    ];

  return {
    substance,
    kind,
    title: simulated ? "simulated revenue" : "real revenue",
    lede: simulated
      ? `every ${SIM_KIND} receipt. Simulated money is a real measurement of data that is not real money — it is never added to the panel above, never averaged with it, and never wears its colour.`
      : `every ${REAL_KIND} receipt. This is the only substance on this screen that is money.`,
    hatch: simulated,
    // The CLI watermarks every LINE rather than the header alone, because a header scrolls off
    // and a screenshot of the middle of a simulated P&L must not be mistakable for the real
    // thing. The hatch is this surface's equivalent and it covers the whole region.
    watermark: simulated ? "SIMULATED" : "",
    cashIn,
    mrr,
    components,
    ventures: list.map((v) => ({
      venture: v.venture,
      cashIn: moneyFigure({ kind, amount: v.cashIn, everFired: true, gate, why: `GET ${pnlPath({ simulated })} → model.ventures[].cashIn`, scope: `for ${v.venture}` }),
      mrr: moneyFigure({ kind, amount: v.mrr, everFired: true, gate, why: `GET ${pnlPath({ simulated })} → model.ventures[].mrr`, scope: `for ${v.venture}` }),
      rows: v.rows,
    })),
    why,
    scopeNote: list.length === 0
      ? `The door returned no venture at all for ${kind}, which is what a kind that has never fired looks like from here.`
      : list.length === 1
        ? `One venture carries ${kind}, so the figure above is that venture's own — a number the door served, not one assembled here.`
        : `${fmtInt(list.length)} ventures carry ${kind}. No company figure is drawn: the door serves no company total, and adding these here would be a number with no receipt behind it.`,
  };
}

/**
 * @typedef {object} CostTally
 * @property {CostLine[]} lines
 * @property {{ currency: string, count: number, unrenderable: number }[]} byCurrency
 * @property {{ source: string, count: number }[]} bySource
 * @property {number} unrenderable
 * @property {string} why
 * @property {string} refusal   why no total is printed. Not an apology — a rule.
 */

/**
 * COSTS, COUNTED AND NEVER SUMMED.
 *
 * `derivePnl` serves cost LINES and no total, and this does not invent one. The reason is the
 * ledger's own: costs arrive in their own currencies and a `cost.incurred` payload carries no
 * fx rate, so a single figure would need a rate looked up at render — which ADR-1003 forbids,
 * because a rate is a receipt and not a variable.
 *
 * What IS honest here is a COUNT: how many receipts, in which currencies, from which recorded
 * source. A count of receipts is a fact about the log, not a claim about money.
 * @param {CostLine[]} lines
 * @param {string} why
 * @returns {CostTally}
 */
export function costTally(lines, why) {
  /** @type {Map<string, { currency: string, count: number, unrenderable: number }>} */
  const byCurrency = new Map();
  /** @type {Map<string, number>} */
  const bySource = new Map();
  let unrenderable = 0;

  for (const l of lines) {
    const code = l.currency ?? "(no currency recorded)";
    const bucket = byCurrency.get(code) ?? { currency: code, count: 0, unrenderable: 0 };
    bucket.count += 1;
    // A line whose amount is not an integer count of minor units, or whose currency has no
    // pinned exponent, is COUNTED and shown with its amount absent. Dropping it would make the
    // list shorter and cleaner than the truth.
    if (l.amount === null || minorExponent(l.currency) === null) {
      bucket.unrenderable += 1;
      unrenderable += 1;
    }
    byCurrency.set(code, bucket);

    const src = l.source ?? "(no source recorded)";
    bySource.set(src, (bySource.get(src) ?? 0) + 1);
  }

  return {
    lines: lines.slice().sort(byTsId),
    byCurrency: [...byCurrency.values()].sort((a, b) => byCodeUnit(a.currency, b.currency)),
    bySource: [...bySource.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => byCodeUnit(a.source, b.source)),
    unrenderable,
    why,
    refusal:
      "No cost total is shown. GET /api/pnl serves each cost line and no sum, costs arrive in their own currencies, and the cost payload carries no exchange rate — ADR-1003 forbids looking one up at render. A single figure here would be a number with no receipt behind it. `node .claude/scripts/hq/arc-pnl.mjs` derives the totalled P&L.",
  };
}

/**
 * @typedef {object} ReturnStatement
 * @property {boolean} computable   always false today, and the reason is named
 * @property {string} code
 * @property {string} human
 * @property {{ label: string, value: string, why: string }[]} parts
 * @property {string} command       the exact command the owner runs to get the derived answer
 */

/**
 * THE RETURN — and why this screen will not print one.
 *
 * Two independent reasons, and the FIRST one is the one that matters: real revenue has never
 * been recorded, so there is nothing to set the cost against. That is not a return of zero. A
 * zero return would mean money came in and exactly matched what went out; what actually
 * happened is that no measurement of the numerator exists at all. Printing "0%" or "-100%"
 * here would be the same lie as a bare zero, wearing a percent sign.
 *
 * The second reason survives the first: even once revenue.received fires, this route serves no
 * cost total, so the return still cannot be assembled from what arrived. Both are stated, in
 * that order, because the owner will one day fix the first and needs to know the second is
 * still there.
 * @param {object} input
 * @param {GreenGate} input.gate
 * @param {PnlView | null} input.real
 * @param {CostTally} input.cost
 * @returns {ReturnStatement}
 */
export function returnStatement({ gate, real, cost }) {
  const receipts = real === null ? null : real.counts.costs;
  const parts = [
    {
      label: "real revenue",
      value: gate.spendable ? "recorded" : "never recorded",
      why: gate.source,
    },
    {
      label: `${COST_KIND} receipts`,
      value: receipts === null ? "not served" : fmtInt(receipts),
      why: "GET /api/pnl → model.counts.costs (every cost.incurred event on the spine, not a month's worth)",
    },
    {
      label: "currencies among them",
      value: cost.byCurrency.length === 0 ? "none" : cost.byCurrency.map((c) => c.currency).join(" · "),
      why: "GET /api/pnl → model.ventures[].costs[].currency and model.overhead.lines[].currency",
    },
  ];
  const command = "node .claude/scripts/hq/arc-pnl.mjs";

  if (!gate.spendable)
    return {
      computable: false,
      code: "NO_REAL_REVENUE",
      human:
        `A return is real revenue set against real cost. ${REAL_KIND} has never fired, so there is no revenue to set the cost against — and that is not a return of zero, it is the absence of the measurement. ` +
        `Every rupee of cost the company has spent has been spent against no recorded earnings. That is a fact the owner already knows and has decided to live with; drawing it as a sad empty state would be a lie in the other direction.`,
      parts,
      command,
    };

  return {
    computable: false,
    code: "NO_TOTAL_SERVED",
    human:
      `${REAL_KIND} has fired, so a return is now a real question — and this screen still cannot answer it. ${cost.refusal}`,
    parts,
    command,
  };
}

/**
 * The needs-you flags the money brain raised, as rows. Verbatim, never summarised: each one is
 * a duplicate payment, an unlinkable refund, an over-refund or an unpinned currency, and each
 * is a different thing for a person to do.
 * @param {PnlView[]} views
 * @returns {(PnlFlag & { substance: string })[]}
 */
export function moneyFlags(views) {
  /** @type {(PnlFlag & { substance: string })[]} */
  const out = [];
  for (const v of views) for (const f of v.needsYou) out.push({ ...f, substance: v.substance });
  return out.sort((a, b) =>
    byCodeUnit(a.substance, b.substance) || byCodeUnit(a.type, b.type) || byCodeUnit(a.venture, b.venture) || byCodeUnit(a.detail, b.detail));
}

/**
 * WHAT THIS ROUTE DID NOT SERVE, said out loud.
 *
 * A gap the reader cannot see is a gap the reader assumes is not there. Each row names a thing
 * a person might reasonably expect on this screen and why it is not on it.
 * @param {{ real: PnlView | null, sim: PnlView | null, health: HealthView | null }} input
 * @returns {{ what: string, why: string }[]}
 */
export function notServed({ real, sim, health }) {
  const rows = [];
  rows.push({
    what: "a company revenue total",
    why: "the door serves per-venture figures and no company sum. Adding them here would be a total with no receipt behind it.",
  });
  rows.push({
    what: "a cost total",
    why: "the door serves cost lines and no sum, and the cost payload carries no rate to convert across currencies (ADR-1003).",
  });
  if (real !== null && real.mrr.mapEmpty)
    rows.push({
      what: "the MRR map (model.mrr.byVenture)",
      why: "it is a JavaScript Map on the far side of the wire, and a Map serialises to {} — so it arrives empty on every read, always. The per-venture MRR is served on model.ventures[].mrr and that is what is drawn.",
    });
  if (sim === null)
    rows.push({
      what: `the ${SIM_KIND} panel`,
      why: "the simulated read did not answer on this pass. Its absence is not a claim that no simulated money exists.",
    });
  if (health === null)
    rows.push({
      what: "the kinds-ever-fired set",
      why: "/api/health did not answer, so nothing here can prove whether revenue.received has ever fired. Real money's colour stays unspent.",
    });
  rows.push({
    what: "a day-granular as-of",
    why: asOfSupport().human,
  });
  return rows;
}

/* ========================================================================== *
 * 7. the Ventures roster
 * ========================================================================== */

/**
 * @typedef {object} VentureRow
 * @property {string} venture
 * @property {boolean} declared          named in ventures.yaml, i.e. it has kill lines
 * @property {VentureMoney | null} real
 * @property {VentureMoney | null} sim
 * @property {KillVenture | null} kill
 * @property {number} rank
 * @property {Refused | null} finding    a fact about THIS row that needs a person
 */

/**
 * SEVERITY ORDER, AND UNDECLARED MONEY RANKS WITH A WARNING.
 *
 * A venture with money and no kill lines is not a tidy row to sort to the bottom: it is money
 * moving for something nobody drew a line for, which is the same class of danger as a line
 * being approached. ABSENT is deliberately not ranked as safe — kill-distance.mjs refuses to
 * fold it into the severity scale for exactly this reason, and neither does this.
 *
 *   0  a criterion is CROSSED
 *   1  money is booked to a venture ventures.yaml does not declare
 *   2  a criterion is inside the warning band
 *   3  everything else, including a venture whose every criterion is ABSENT
 * @param {{ declared: boolean, kill: KillVenture | null, real: VentureMoney | null, sim: VentureMoney | null }} row
 * @returns {number}
 */
export function ventureRank(row) {
  const worst = row.kill === null ? null : row.kill.worst;
  if (worst === "CROSSED") return 0;
  if (!row.declared && (row.real !== null || row.sim !== null)) return 1;
  if (worst === "WARNING") return 2;
  return 3;
}

/**
 * THE COMPANY'S VENTURES, from the two authorities that each know half of it.
 *
 * `ventures.yaml` (through the kill panel) is the authority on WHICH VENTURES EXIST -- it is
 * the receipted file, and `evaluateAll` already refuses to let a stray observation mint a row
 * on a venture no receipted file named. `/api/pnl` is the authority on WHAT EACH ONE EARNED.
 *
 * The union is taken rather than either list alone, and the two ways they can disagree are
 * both surfaced instead of resolved:
 *
 *   declared with no money   the ordinary state, and the one this company is in. It renders
 *                            "has never earned" against an OUTLINED zero, not a solid one.
 *   money with no kill line   a finding. Rendering only the declared list would delete a
 *                            venture the company is actually spending or earning on, and a
 *                            missing row is exactly what this product exists not to have.
 * @param {{ real: PnlView | null, sim: PnlView | null, kill: KillView }} input
 * @returns {VentureRow[]}
 */
export function ventureRoster({ real, sim, kill }) {
  /** @type {Map<string, VentureMoney>} */
  const realBy = new Map((real?.ventures ?? []).map((v) => [v.venture, v]));
  /** @type {Map<string, VentureMoney>} */
  const simBy = new Map((sim?.ventures ?? []).map((v) => [v.venture, v]));
  /** @type {Map<string, KillVenture>} */
  const killBy = new Map(kill.ventures.map((v) => [v.venture, v]));

  const names = new Set([...killBy.keys(), ...realBy.keys(), ...simBy.keys()]);
  // Overhead is not a venture. `venture: arc` is the factory, and building the factory is not
  // a cost of any product made in it (pnl.mjs / ADR-1006). It has its own block in Money.
  names.delete(OVERHEAD_VENTURE);

  /** @type {VentureRow[]} */
  const rows = [];
  for (const venture of [...names].sort(byCodeUnit)) {
    const declared = killBy.has(venture);
    const realMoney = realBy.get(venture) ?? null;
    const simMoney = simBy.get(venture) ?? null;
    const killVenture = killBy.get(venture) ?? null;
    /** @type {Refused | null} */
    let finding = null;
    if (!declared)
      finding = {
        code: "VENTURE_WITHOUT_KILL_LINES",
        human:
          `Money is booked to "${venture}" and ventures.yaml declares no kill lines for it. There is no line to measure a distance to, so nothing is watching this one. ` +
          "The fix is a receipted edit to ventures.yaml, not a change here.",
      };
    else if (killVenture !== null && killVenture.absentCount !== null && killVenture.criteria.length > 0 && killVenture.absentCount === killVenture.criteria.length)
      finding = {
        code: "EVERY_CRITERION_ABSENT",
        human:
          `Every kill line declared for "${venture}" is unevaluable on this read, so its declared lines are watching nothing right now. Each row says which and why — an absence with a stated reason, not a silence.`,
      };
    const base = { declared, kill: killVenture, real: realMoney, sim: simMoney };
    rows.push({ venture, ...base, rank: ventureRank(base), finding });
  }
  // rank first, then the code-unit name — a stable order on every CI leg.
  return rows.sort((a, b) => a.rank - b.rank || byCodeUnit(a.venture, b.venture));
}

/**
 * @typedef {object} VentureMoneyView
 * @property {Figure} real
 * @property {Figure} sim
 * @property {(Figure & { label: string })[]} components
 * @property {Figure} mrr
 * @property {CostTally} cost
 * @property {string} earnedSentence
 */

/**
 * ONE VENTURE'S MONEY, both substances, never merged into one figure.
 *
 * The `everFired` argument is scoped to the VENTURE, not to the company: `revenue.received`
 * having fired for some other venture does not make this one's zero a measured zero. Presence
 * in the door's own `model.ventures` list is the evidence, and it is a fact the door served
 * rather than one assembled here.
 *
 * `served` IS NOT OPTIONAL DECORATION. A venture absent from `model.ventures` means "no receipt
 * of this kind names it" ONLY IF that body was read at all. When the simulated request failed,
 * every venture is absent from a list that does not exist -- and reporting that as "this kind
 * has never fired for this venture" is a claim about the LOG made out of a fact about the READ.
 * That is the same class of lie as a bare zero, so the two are told apart here.
 * @param {VentureRow} row
 * @param {GreenGate} gate
 * @param {{ real?: boolean, sim?: boolean }} [served]  did each body arrive on this pass
 * @returns {VentureMoneyView}
 */
export function ventureMoney(row, gate, served = {}) {
  const realServed = served.real !== false;
  const simServed = served.sim !== false;
  // THE RECEIPT NAMES THE CALL THAT WAS ACTUALLY MADE. This room reads the company-wide P&L
  // once and picks each venture out of `model.ventures`; it does NOT make a `?venture=` request
  // per row. A "why" naming a route nobody called is a receipt that cannot be followed, which
  // is the same defect as no receipt at all.
  /** @param {boolean} simulated @param {string} field */
  const where = (simulated, field) =>
    `GET ${pnlPath({ simulated })} → model.ventures[] where venture = ${row.venture} → ${field}`;
  const realWhy = where(false, "cashIn");
  const simWhy = where(true, "cashIn");
  const scope = `for ${row.venture}`;

  /**
   * "the body did not arrive" beats "the kind never fired for this venture", every time.
   * @param {string} kind @param {VentureMoney | null} bucket @param {boolean} bodyServed
   * @param {"cashIn" | "mrr"} field @param {string} why
   */
  const figureFor = (kind, bucket, bodyServed, field, why) => {
    if (!bodyServed)
      return moneyFigure({ kind, amount: null, everFired: true, gate, why, scope });
    return moneyFigure({
      kind,
      amount: bucket === null ? null : bucket[field],
      everFired: bucket !== null,
      gate,
      why,
      scope,
    });
  };

  const real = figureFor(REAL_KIND, row.real, realServed, "cashIn", realWhy);
  const sim = figureFor(SIM_KIND, row.sim, simServed, "cashIn", simWhy);
  const mrr = figureFor(REAL_KIND, row.real, realServed, "mrr", where(false, "mrr"));

  const r = row.real;
  const components = r === null
    ? []
    : [
      componentFigure(r.gross, "gross", gate, REAL_KIND, where(false, "gross")),
      componentFigure(r.fees, "fees", gate, REAL_KIND, where(false, "fees")),
      componentFigure(r.tax, "tax", gate, REAL_KIND, where(false, "tax")),
      componentFigure(r.net, "net", gate, REAL_KIND, where(false, "net")),
    ];

  return {
    real,
    sim,
    mrr,
    components,
    cost: costTally(r === null ? [] : r.costs, where(false, "costs[]")),
    earnedSentence: !realServed
      ? `The real P&L did not arrive on this read, so nothing here knows whether ${row.venture} has earned. That is a fact about the read, not about the venture.`
      : row.real === null
        ? `${row.venture} has never earned. No ${REAL_KIND} receipt names it, so there is no zero here — there is no measurement.`
        : row.real.cashIn === 0
          ? `${row.venture} has earned, and this scope nets to zero. That is a measured zero: receipts exist and they cancel.`
          : `${row.venture} has earned, and every rupee of it traces to a ${REAL_KIND} receipt below.`,
  };
}

/**
 * The Ventures room's opening count, which must not be a bare number either.
 * @param {VentureRow[]} rows
 * @param {KillView} kill
 * @returns {{ headline: string, detail: string }}
 */
export function rosterSummary(rows, kill) {
  const n = rows.length;
  const earning = rows.filter((r) => r.real !== null).length;
  const undeclared = rows.filter((r) => !r.declared).length;
  if (n === 0)
    return {
      headline: "no ventures",
      detail: kill.state === "panel"
        ? "The receipted criteria file declares no venture, and no revenue or cost receipt names one either. This is an empty roster because the company has none — not because a read failed."
        : `No roster is drawn: ${kill.refusal ? kill.refusal.human : "the kill panel did not arrive"}`,
    };
  // Hand-agreed verbs. `1 carry` and `1 of 2 carry` both shipped once, and a sentence the
  // owner has to re-read is a sentence he stops trusting.
  const unwatched = undeclared === 0
    ? ""
    : undeclared === 1
      ? " 1 of them carries money with no declared kill line."
      : ` ${fmtInt(undeclared)} of them carry money with no declared kill line.`;
  return {
    headline: `${fmtInt(n)} venture${n === 1 ? "" : "s"}`,
    detail: earning === 0
      ? `Not one of them has a ${REAL_KIND} receipt against its name. The factory is proven and has never earned — which is a fact, not an empty state.${unwatched}`
      : `${fmtInt(earning)} of ${fmtInt(n)} ${earning === 1 ? "carries" : "carry"} a ${REAL_KIND} receipt.${unwatched}`,
  };
}
