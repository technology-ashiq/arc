// MoneyRoom -- "Real and simulated are different substances."
//
// The most dangerous screen in the product. Real revenue is zero, the event that records money
// has never fired once, and there IS a simulated number that looks like money. Three facts,
// three different substances, and a surface that lets the eye mistake one for another is the
// exact lie this company's Truth Law exists to prevent.
//
// THERE IS NO LOGIC IN THIS FILE. Which colour a rupee may wear, which of the five kinds of
// nothing a cell is showing, whether a total may be printed at all -- every one of those is a
// call into ../lib/money.mjs, because CI never runs `npm install` and a branch inside a .tsx is
// a branch nobody tests.
//
// WHAT THIS FILE IS RESPONSIBLE FOR, and it is not nothing: the GLYPH. `zeroGlyph` decides
// which shape a figure takes and `Figure` below is what draws it -- a filled numeral for a
// measured zero, an OUTLINED DASHED RING for a kind that has never fired. The distinction has
// to survive with the words removed, because the eye reads shape and colour before it reads a
// badge, and the badge is what the reference design was relying on when it shipped a green
// simulated 9,976 beside a green real 0.
//
// Four reads assemble it, all sanctioned routes:
//   GET /api/health            the kinds-ever-fired set -- the ONLY thing that can unspend --green
//   GET /api/pnl               the real P&L and the kill panel
//   GET /api/pnl?simulated=1   the simulated P&L, which is never merged with the one above

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { Door } from "../lib/door.mjs";
import { readHealth } from "../lib/inbox.mjs";
import type { HealthView } from "../lib/inbox.mjs";
import {
  moneyOpening, readPnl, readKill, greenGate, revenuePanel, costTally, returnStatement,
  moneyFlags, notServed, killSummary, criterionSentence, fileBorneNote, asOfSupport,
  formatMinor, rupees, pnlPath, refusalOf, fmtInt,
  REAL_KIND, SIM_KIND, COST_KIND, OVERHEAD_VENTURE,
} from "../lib/money.mjs";
import type {
  PnlView, KillView, GreenGate, Figure, CostTally, RevenuePanel, CostLine, RevenueRow,
} from "../lib/money.mjs";

/* -------------------------------------------------------------------------- */

export type MoneyRoomProps = {
  /** The L2 client. The shell owns the token; this room only reads through it. */
  door: Door;
  /**
   * The registry's own entry for this room, when the shell has read /api/rooms. Typed
   * structurally rather than as `Room` so the two files need not move together; its strings
   * arrive escaped, like everything the door serves, and are decoded in the lib.
   */
  room?: { sentence?: string; lede?: string };
  /** Explicit overrides. They beat the registry, which beats the built-in constant. */
  sentence?: string;
  lede?: string;
};

type Panel<T> =
  | { phase: "loading" }
  | { phase: "ok"; data: T }
  | { phase: "error"; code: string; human: string };

/** The live reads repeat on this beat, the same one Today uses. */
const POLL_MS = 45_000;

/* -------------------------------------------------------------------------- */

export function MoneyRoom({ door, room, sentence, lede }: MoneyRoomProps) {
  const opening = moneyOpening("money", room, { sentence, lede });
  const [health, setHealth] = useState<Panel<HealthView>>({ phase: "loading" });
  const [real, setReal] = useState<Panel<PnlView>>({ phase: "loading" });
  const [sim, setSim] = useState<Panel<PnlView>>({ phase: "loading" });
  const [kill, setKill] = useState<Panel<KillView>>({ phase: "loading" });
  const [readAt, setReadAt] = useState<string>("");

  const read = useCallback(
    async (signal: AbortSignal) => {
      try {
        const raw: unknown = await door.health(signal);
        if (!signal.aborted) {
          const h = readHealth(raw);
          setHealth({ phase: "ok", data: h });
          setReadAt(h.now);
        }
      } catch (err) {
        if (!signal.aborted) setHealth({ phase: "error", ...refusalOf(err) });
      }

      // THE REAL BODY CARRIES BOTH the P&L and the kill panel, so one read fills two states.
      // They are held apart in state because they have different provenances -- the money is
      // spine-borne, the kill lines are file-borne -- and a single "money loaded" flag would
      // let a failed criteria read hide behind a successful P&L.
      try {
        const raw: unknown = await door.pnl(signal);
        if (!signal.aborted) {
          setReal({ phase: "ok", data: readPnl(raw) });
          setKill({ phase: "ok", data: readKill(raw) });
        }
      } catch (err) {
        if (!signal.aborted) {
          const said = refusalOf(err);
          setReal({ phase: "error", ...said });
          setKill({ phase: "error", ...said });
        }
      }

      // A SECOND REQUEST, NOT A SECOND FILTER. `derivePnl` selects one kind at the top and
      // never reads the other; two requests preserve that shape all the way to the screen,
      // where one request and a client-side split would not.
      try {
        const raw: unknown = await door.call(pnlPath({ simulated: true }), { signal });
        if (!signal.aborted) setSim({ phase: "ok", data: readPnl(raw) });
      } catch (err) {
        if (!signal.aborted) setSim({ phase: "error", ...refusalOf(err) });
      }
    },
    [door],
  );

  useEffect(() => {
    const ac = new AbortController();
    void read(ac.signal);
    const t = window.setInterval(() => void read(ac.signal), POLL_MS);
    return () => {
      ac.abort();
      window.clearInterval(t);
    };
  }, [read]);

  const reread = useCallback(() => {
    const ac = new AbortController();
    setHealth({ phase: "loading" });
    setReal({ phase: "loading" });
    setSim({ phase: "loading" });
    setKill({ phase: "loading" });
    void read(ac.signal);
  }, [read]);

  const healthData = health.phase === "ok" ? health.data : null;
  const realData = real.phase === "ok" ? real.data : null;
  const simData = sim.phase === "ok" ? sim.data : null;
  const killData = kill.phase === "ok" ? kill.data : null;

  const gate: GreenGate = greenGate({ health: healthData, real: realData });
  const realFired = healthData !== null && healthData.kinds.indexOf(REAL_KIND) !== -1;
  const simFired = healthData !== null && healthData.kinds.indexOf(SIM_KIND) !== -1;

  // `want` names each panel when its body did not arrive. A refusal from the simulated read
  // must never be drawn under a heading that says "real revenue".
  const realPanel = revenuePanel({ pnl: realData, gate, everFired: realFired, want: "real" });
  const simPanel = revenuePanel({ pnl: simData, gate, everFired: simFired, want: "simulated" });

  const ventureCosts: CostLine[] = realData === null ? [] : realData.ventures.flatMap((v) => v.costs);
  const productCost = costTally(ventureCosts, "GET /api/pnl → model.ventures[].costs[]");
  const overheadCost = costTally(
    realData === null ? [] : realData.overhead.lines,
    "GET /api/pnl → model.overhead.lines[]",
  );
  const allCost = costTally([...ventureCosts, ...(realData === null ? [] : realData.overhead.lines)], "GET /api/pnl → every cost line served");
  const ret = returnStatement({ gate, real: realData, cost: allCost });
  const flags = moneyFlags([realData, simData].filter((v): v is PnlView => v !== null));
  const gaps = notServed({ real: realData, sim: simData, health: healthData });
  const asof = asOfSupport();

  return (
    <section className="m-room" aria-label="Money">
      <style>{CSS}</style>

      <header className="m-head">
        <div className="m-headtext">
          <h1 className="m-sentence">{opening.sentence}</h1>
          <p className="m-lede">{opening.lede}</p>
        </div>
        <div className="m-chrome">
          <ModeChip mode={realData === null ? null : realData.doorMode} />
          <span className="m-clock" title="the door's own clock, in the company's timezone">
            {readAt === "" ? "reading…" : readAt}
          </span>
          <button type="button" className="m-btn" onClick={reread}>re-read the door</button>
        </div>
      </header>

      {/* ── THE GREEN GATE, STATED. This strip is the room's thesis and it is above every
             number on the page: it says whether the colour of real money is spent or unspent,
             and why. A reader who scrolls no further has the one fact that matters. ── */}
      <div className={`m-gate${gate.spendable ? " m-gate-spent" : ""}`}>
        <span className="m-gate-label">real money</span>
        <p className="m-gate-why">{gate.why}</p>
        <span className="m-receipt" title={gate.source}>⌗ {gate.source}</span>
      </div>
      {gate.contradiction === null ? null : (
        <p className="m-contradiction">{gate.contradiction}</p>
      )}

      {/* ── the two substances, never in one table, never in one row, never summed ── */}
      <div className="m-substances">
        <Substance panel={realPanel} state={real} gate={gate} what="the real P&L" />
        <Substance panel={simPanel} state={sim} gate={gate} what="the simulated P&L" />
      </div>

      <p className="m-never-added">
        These two panels are never added, never averaged, and never placed in one row. They are
        derived from two separate reads of two separate kinds — <code className="m-code">{REAL_KIND}</code> and{" "}
        <code className="m-code">{SIM_KIND}</code> — and the money brain selects one kind at the top and never
        reads the other. Nothing on this screen combines them, because there is no quantity a
        combination of them would be.
      </p>

      {/* ── cost, counted and never summed ── */}
      <div className="m-split">
        <CostPanel
          title={`${COST_KIND} — attributed to a product`}
          lede="what a venture cost. Every line is one receipt, in the currency it was recorded in."
          tally={productCost}
          state={real}
          what="the cost lines"
        />
        <CostPanel
          title={`${COST_KIND} — Overhead (venture: ${OVERHEAD_VENTURE})`}
          lede="building the factory is not a cost of any product made in it, so these are never attributed to a venture."
          tally={overheadCost}
          state={real}
          what="the overhead lines"
        />
      </div>

      {/* ── the return ── */}
      <div className="m-panel m-return">
        <div className="m-panel-head">
          <span className="m-panel-title">the return</span>
          <span className="m-panel-hint">{ret.code}</span>
        </div>
        <p className="m-return-human">{ret.human}</p>
        <div className="m-return-parts">
          {ret.parts.map((p) => (
            <div key={p.label} className="m-part">
              <div className="m-part-l">{p.label}</div>
              <div className="m-part-v">{p.value}</div>
              <div className="m-part-w">{p.why}</div>
            </div>
          ))}
        </div>
        <p className="m-cmd">
          The derived P&amp;L, totalled by the money brain rather than by this screen:{" "}
          <code className="m-code">{ret.command}</code>
        </p>
      </div>

      {/* ── kill distance, and the ONE badge on this page that says "file, not log" ── */}
      <KillPanel state={kill} kill={killData} />

      {/* ── what needs a person, from the money brain's own flags ── */}
      {flags.length === 0 ? null : (
        <div className="m-panel">
          <div className="m-panel-head">
            <span className="m-panel-title">needs you</span>
            <span className="m-panel-hint">{fmtInt(flags.length)}</span>
          </div>
          <ul className="m-flags">
            {flags.map((f) => (
              <li key={`${f.substance}-${f.type}-${f.detail}`} className={f.substance === "simulated" ? "m-flag m-hatch" : "m-flag"}>
                <span className="m-flag-t">{f.type}</span>
                {f.venture === "" ? null : <span className="m-flag-v">{f.venture}</span>}
                <span className="m-flag-d">{f.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── the gaps, said out loud. A gap the reader cannot see is a gap the reader
             assumes is not there. ── */}
      <div className="m-panel m-gaps">
        <div className="m-panel-head">
          <span className="m-panel-title">what this route does not serve</span>
          <span className="m-panel-hint">{fmtInt(gaps.length)}</span>
        </div>
        <dl className="m-gaplist">
          {gaps.map((g) => (
            <div key={g.what} className="m-gap">
              <dt className="m-gap-t">{g.what}</dt>
              <dd className="m-gap-d">{g.why}</dd>
            </div>
          ))}
        </dl>
        <ul className="m-prov">
          {fileBorneNote().map((n) => (
            <li key={n.half}>
              <b className="m-prov-h">{n.half}</b>
              {n.badge === null ? null : <span className="m-badge-file">{n.badge}</span>}
              <span className="m-prov-s">{n.source}</span>
              <span className="m-prov-a">as-of — {n.asof}</span>
            </li>
          ))}
        </ul>
        <p className="m-asof">
          <b className="m-code">{asof.code}</b> — {asof.offer}
        </p>
      </div>
    </section>
  );
}

export default MoneyRoom;

/* ══════════════════════════════════════════════════════════════════════════ *
 * Figure — THE component this whole room is built to get right.
 *
 * `zeroGlyph` in the lib decided which shape this is; nothing is decided here. What is HERE
 * is the drawing, and the drawing is the point:
 *
 *   solid   a filled tabular numeral. "0.00" and "1,20,000.00" are the same object at rest.
 *   hollow  an outlined, DASHED ring at the numeral's own size, with nothing inside it.
 *           Dashed is already this product's mark for "built and has never run" (the Map
 *           draws unexercised stations dashed), so this is one statement in a second place.
 *   dash    an em-dash. Absent, and never a zero.
 *   none    the word `not served`, never an em-dash, so a fact about the READ can never be
 *           misread as a fact about the money.
 * ══════════════════════════════════════════════════════════════════════════ */
function FigureValue({ figure, size = "stat" }: { figure: Figure; size?: "stat" | "row" }) {
  const cls = size === "stat" ? "m-fig m-fig-stat" : "m-fig m-fig-row";
  if (figure.glyph === "hollow") {
    return (
      <span className={cls} data-state={figure.state} title={figure.note}>
        <span
          className={size === "stat" ? "m-ring" : "m-ring m-ring-row"}
          aria-hidden="true"
          style={{ borderColor: figure.ink } as CSSProperties}
        />
        <span className="m-never">{figure.text}</span>
      </span>
    );
  }
  return (
    <span
      className={cls}
      data-state={figure.state}
      title={figure.note}
      style={{ color: figure.ink } as CSSProperties}
    >
      {figure.text}
    </span>
  );
}

/** A figure with its label, its sentence and its receipt. No number appears without all three. */
function Stat({ label, figure }: { label: string; figure: Figure }) {
  return (
    <div className="m-stat" data-state={figure.state}>
      <FigureValue figure={figure} />
      <div className="m-stat-l">{label}</div>
      {figure.note === "" ? null : <p className="m-stat-n">{figure.note}</p>}
      <span className="m-receipt" title={figure.why}>⌗ {figure.why}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ *
 * Substance — one P&L, one kind, one region.
 *
 * The simulated region carries the hatch across the WHOLE panel rather than a badge in its
 * corner. The CLI watermarks every LINE for the same reason: a header scrolls off, and a
 * screenshot of the middle of a simulated P&L must not be mistakable for the real thing.
 * ══════════════════════════════════════════════════════════════════════════ */
function Substance({
  panel, state, gate, what,
}: {
  panel: RevenuePanel;
  state: Panel<PnlView>;
  gate: GreenGate;
  what: string;
}) {
  const sim = panel.substance === "simulated";
  return (
    <section className={sim ? "m-panel m-sub m-sub-sim" : "m-panel m-sub"} aria-label={panel.title}>
      <div className="m-panel-head">
        <span className={sim ? "m-panel-title m-title-sim" : "m-panel-title"}>{panel.title}</span>
        {panel.watermark === "" ? null : <span className="m-watermark">{panel.watermark}</span>}
        <span className="m-panel-hint">{panel.kind}</span>
      </div>
      <p className="m-sub-lede">{panel.lede}</p>

      {state.phase === "loading" ? (
        <p className="m-reading">waiting for {what} from the door…</p>
      ) : state.phase === "error" ? (
        <Refusal code={state.code} human={state.human} what={what} />
      ) : (
        <>
          <div className="m-stats">
            <Stat label="cash in" figure={panel.cashIn} />
            <Stat label="MRR" figure={panel.mrr} />
          </div>
          <p className="m-scope">{panel.scopeNote}</p>

          {panel.components.length === 0 ? null : (
            <div className="m-components">
              {panel.components.map((c) => (
                <div key={c.label} className="m-comp" data-state={c.state}>
                  <span className="m-comp-l">{c.label}</span>
                  <FigureValue figure={c} size="row" />
                  {c.state === "absent" ? <span className="m-comp-n" title={c.note}>never recorded</span> : null}
                </div>
              ))}
            </div>
          )}

          {panel.ventures.length === 0 ? null : (
            <ul className="m-vlist">
              {panel.ventures.map((v) => (
                <li key={v.venture} className="m-vrow">
                  <span className="m-vname">{v.venture}</span>
                  <FigureValue figure={v.cashIn} size="row" />
                  <span className="m-vmrr">
                    MRR <FigureValue figure={v.mrr} size="row" />
                  </span>
                </li>
              ))}
            </ul>
          )}

          {panel.ventures.every((v) => v.rows.length === 0) ? null : (
            <details className="m-rows">
              <summary>every receipt behind these figures</summary>
              <ul className="m-rowlist">
                {panel.ventures.flatMap((v) => v.rows.map((r) => (
                  <Row key={r.id} row={r} venture={v.venture} gate={gate} sim={sim} />
                )))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}

/** One revenue receipt. The ULID is the thing that makes a figure followable. */
function Row({ row, venture, gate, sim }: { row: RevenueRow; venture: string; gate: GreenGate; sim: boolean }) {
  const inr = row.amountInr === null ? null : rupees(row.amountInr);
  const native = row.amount === null || row.currency === null ? null : formatMinor(Math.abs(row.amount), row.currency);
  const ink = sim ? "var(--sim-fg)" : gate.spendable ? "var(--green)" : "var(--faint)";
  return (
    <li className="m-row">
      <span className="m-row-t">{row.ts}</span>
      <span className="m-row-a" style={{ color: ink } as CSSProperties}>
        {inr === null ? "not served" : inr.text}
      </span>
      <span className="m-row-v">{venture}</span>
      <span className="m-row-p">{row.refundOf === null ? row.paymentId : `refund of ${row.refundOf}`}</span>
      {native === null || row.currency === "INR" ? null : (
        <span className="m-row-fx" title="converted at the rate recorded on this event — never one looked up at render (ADR-1003)">
          {native.text} {row.currency} @ {row.rate ?? "rate not recorded"}
        </span>
      )}
      <span className="m-row-id" title={row.id}>{row.id}</span>
    </li>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ *
 * CostPanel — counted, listed, and NEVER summed. `costTally` carries the refusal;
 * this draws it where the total would otherwise have been.
 * ══════════════════════════════════════════════════════════════════════════ */
function CostPanel({
  title, lede, tally, state, what,
}: {
  title: string;
  lede: string;
  tally: CostTally;
  state: Panel<PnlView>;
  what: string;
}) {
  return (
    <section className="m-panel" aria-label={title}>
      <div className="m-panel-head">
        <span className="m-panel-title">{title}</span>
        <span className="m-panel-hint">{fmtInt(tally.lines.length)} line{tally.lines.length === 1 ? "" : "s"}</span>
      </div>
      <p className="m-sub-lede">{lede}</p>

      {state.phase === "loading" ? (
        <p className="m-reading">waiting for {what} from the door…</p>
      ) : state.phase === "error" ? (
        <Refusal code={state.code} human={state.human} what={what} />
      ) : tally.lines.length === 0 ? (
        <p className="m-empty">
          The door served no cost line here. That is an empty list, not a zero — nothing on this
          screen claims the amount was nil.
        </p>
      ) : (
        <>
          <ul className="m-currencies">
            {tally.byCurrency.map((c) => (
              <li key={c.currency} className="m-chip">
                {c.currency} · {fmtInt(c.count)} receipt{c.count === 1 ? "" : "s"}
                {c.unrenderable === 0 ? null : <b className="m-chip-warn"> · {fmtInt(c.unrenderable)} unrenderable</b>}
              </li>
            ))}
            {tally.bySource.map((s) => (
              <li key={`src-${s.source}`} className="m-chip m-chip-quiet">
                source {s.source} · {fmtInt(s.count)}
              </li>
            ))}
          </ul>
          <p className="m-refusal">{tally.refusal}</p>
          <ul className="m-rowlist">
            {tally.lines.map((l) => <CostRow key={l.id} line={l} />)}
          </ul>
        </>
      )}
    </section>
  );
}

/**
 * One cost receipt. A line whose amount is not an integer count of minor units, or whose
 * currency has no pinned exponent, is SHOWN WITH ITS SOURCE and its amount absent — never
 * dropped. A list that omits what it could not read is shorter and cleaner than the truth.
 */
function CostRow({ line }: { line: CostLine }) {
  const money = line.amount === null || line.currency === null ? null : formatMinor(line.amount, line.currency);
  return (
    <li className="m-row">
      <span className="m-row-t">{line.ts}</span>
      <span className={money === null || !money.exact ? "m-row-a m-row-a-off" : "m-row-a"} title={money?.note ?? "the door served no amount for this line"}>
        {money === null ? "—" : money.text}
      </span>
      <span className="m-row-v">{line.source ?? "source unrecorded"}</span>
      <span className="m-row-p">{line.label ?? ""}</span>
      <span className="m-row-id" title={line.id}>{line.id}</span>
    </li>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ *
 * KillPanel — the ONE region on this page that wears "file, not log", because it is the
 * one region that reads a file. Its three refusal states are drawn differently from each
 * other and none of them is drawn as an empty panel: an absent kill panel and a healthy
 * one looking the same is how a disarmed kill switch stays invisible.
 * ══════════════════════════════════════════════════════════════════════════ */
function KillPanel({ state, kill }: { state: Panel<KillView>; kill: KillView | null }) {
  if (state.phase === "loading")
    return (
      <div className="m-panel">
        <div className="m-panel-head"><span className="m-panel-title">kill lines</span></div>
        <p className="m-reading">waiting for the kill panel from the door…</p>
      </div>
    );
  if (state.phase === "error")
    return (
      <div className="m-panel">
        <div className="m-panel-head"><span className="m-panel-title">kill lines</span></div>
        <Refusal code={state.code} human={state.human} what="the kill panel" />
      </div>
    );
  if (kill === null) return null;

  const summary = killSummary(kill);
  const loud = kill.state === "unreceipted";

  return (
    <section className={loud ? "m-panel m-kill m-kill-loud" : "m-panel m-kill"} aria-label="kill lines">
      <div className="m-panel-head">
        <span className="m-panel-title">kill lines</span>
        <span className="m-badge-file" title="this half of the route reads ventures.yaml on the tree; a file has no day-granular history to scrub to">
          {kill.badge}
        </span>
        {kill.asOf === null ? null : <span className="m-panel-hint">as of {kill.asOf}</span>}
      </div>

      {kill.refusal === null ? null : (
        <div className={loud ? "m-refused m-refused-loud" : "m-refused"}>
          <b className="m-code">{kill.refusal.code}</b>
          <p className="m-refused-h">{kill.refusal.human}</p>
        </div>
      )}

      {kill.state !== "panel" ? null : (
        <>
          <p className={summary.danger ? "m-kill-sum m-loud" : "m-kill-sum"}>{summary.sentence}</p>
          <ul className="m-crit">
            {kill.ventures.flatMap((v) =>
              v.criteria.map((c) => {
                const said = criterionSentence(c);
                return (
                  <li key={`${v.venture}-${c.criterion}`} className="m-critrow" data-state={said.state}>
                    <span className="m-crit-v">{v.venture}</span>
                    <span className="m-crit-c">{c.criterion}</span>
                    <span className="m-crit-h" style={{ color: said.ink } as CSSProperties}>{said.headline}</span>
                    <span className="m-crit-d">{said.detail}</span>
                  </li>
                );
              }),
            )}
          </ul>
          {kill.futureRevenue.length === 0 ? null : (
            <ul className="m-future">
              {kill.futureRevenue.map((f) => (
                <li key={f.venture}>
                  {f.venture} has {f.count === null ? "some" : fmtInt(f.count)} revenue event(s) dated after today.
                  They are excluded from the days-without-revenue clock, and the exclusion is shown
                  rather than left silent — one future-dated event could otherwise erase a real crossing.
                </li>
              ))}
            </ul>
          )}
          <span className="m-receipt" title={kill.path ?? "path not served"}>⌗ criteria {kill.digest ?? "digest not served"}</span>
        </>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * A refused read shows the door's own sentence AND its code, verbatim. The door refuses BY
 * NAME and each name means a different thing the owner might do next. Note the tone: a refused
 * read is not an incident, so it is NOT --red. --red is reserved for incident.raised.
 */
function Refusal({ code, human, what }: { code: string; human: string; what: string }) {
  return (
    <div className="m-refused">
      <b className="m-code">{code}</b>
      <p className="m-refused-h">
        Could not read {what}. {human}
      </p>
    </div>
  );
}

/** live / replay / sim is a statement about the DATA SOURCE, not about money (ADR-1310). */
function ModeChip({ mode }: { mode: string | null }) {
  if (mode === null) return <span className="m-mode m-mode-unknown">mode unknown</span>;
  return <span className={mode === "sim" ? "m-mode m-mode-sim" : "m-mode"}>{mode}</span>;
}

/* -------------------------------------------------------------------------- */

const CSS = `
.m-room{font-family:var(--font-display);color:var(--prose);padding:calc(var(--grid)*3) calc(var(--grid)*3) calc(var(--grid)*6);max-width:1280px;margin:0 auto;display:flex;flex-direction:column;gap:calc(var(--grid)*2);}
.m-head{display:flex;align-items:flex-start;gap:calc(var(--grid)*2);flex-wrap:wrap;}
.m-headtext{flex:1 1 420px;min-width:0;}
.m-sentence{font-size:clamp(24px,3.6vw,var(--step-room));line-height:1.04;letter-spacing:-0.02em;font-weight:600;margin:0 0 var(--grid) 0;color:var(--prose);}
.m-lede{font-size:var(--step-lede);line-height:1.5;font-weight:300;color:var(--meta);margin:0;max-width:64ch;}
.m-chrome{display:flex;align-items:center;gap:var(--grid);flex-wrap:wrap;margin-left:auto;}
.m-mode,.m-clock{font-family:var(--font-mono);font-size:var(--step-meta);letter-spacing:var(--track-tight);text-transform:uppercase;padding:calc(var(--grid-in)*1) calc(var(--grid-in)*2);border-radius:var(--radius-pill);}
.m-mode{color:var(--mode-live);background:var(--mode-bg);}
.m-mode-sim{color:var(--mode-sim);background:var(--sim-hatch);}
.m-mode-unknown{color:var(--faint);background:var(--mode-bg);}
.m-clock{color:var(--meta);text-transform:none;}
.m-btn{font-family:var(--font-mono);font-size:var(--step-data);letter-spacing:var(--track-tight);text-transform:uppercase;min-height:var(--row-h-live);padding:0 calc(var(--grid)*2);border-radius:var(--radius-chip);border:1px solid var(--hairline-strong);background:rgba(255,255,255,0.04);color:var(--prose);cursor:pointer;transition:border-color var(--dur-fast) var(--ease),background var(--dur-fast) var(--ease);}
.m-btn:hover{border-color:var(--accent-line);background:var(--accent-wash);}

/* the green gate — the room's thesis, above every number */
.m-gate{display:flex;align-items:center;gap:calc(var(--grid)*2);flex-wrap:wrap;padding:calc(var(--grid)*2);border:1px solid var(--panel-border);border-left:2px dashed var(--faint);border-radius:var(--radius-panel);background:var(--panel);backdrop-filter:blur(var(--panel-blur));-webkit-backdrop-filter:blur(var(--panel-blur));}
.m-gate-spent{border-left:2px solid var(--green);}
.m-gate-label{font-family:var(--font-mono);font-size:var(--step-micro);letter-spacing:var(--track-wide);text-transform:uppercase;color:var(--faint);flex:0 0 auto;}
.m-gate-why{margin:0;font-size:var(--step-lede);line-height:1.45;color:var(--prose);flex:1 1 320px;min-width:0;}
.m-contradiction{margin:0;padding:calc(var(--grid)*1.5) calc(var(--grid)*2);border:1px solid var(--amber);border-radius:var(--radius-chip);color:var(--amber);font-size:var(--step-body);line-height:1.5;}

.m-substances{display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:var(--grid);align-items:start;}
.m-split{display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:var(--grid);align-items:start;}
.m-panel{border:1px solid var(--panel-border);border-radius:var(--radius-panel);background:var(--panel);backdrop-filter:blur(var(--panel-blur));-webkit-backdrop-filter:blur(var(--panel-blur));padding:var(--pad-panel);min-width:0;}
.m-panel-head{display:flex;align-items:baseline;gap:var(--grid);flex-wrap:wrap;margin-bottom:var(--grid);}
.m-panel-title{font-family:var(--font-mono);font-size:var(--step-meta);letter-spacing:var(--track-wide);text-transform:uppercase;color:var(--accent);}
.m-title-sim{color:var(--sim-fg);}
.m-panel-hint{font-family:var(--font-mono);font-size:var(--step-meta);color:var(--faint);margin-left:auto;}
.m-sub-lede{font-size:var(--step-body);line-height:1.5;font-weight:300;color:var(--meta);margin:0 0 calc(var(--grid)*2);max-width:60ch;}

/* the non-real family: the texture covers the REGION, not a badge in its corner. Hue alone
   is not enough — a reader who cannot see the violet still gets the hatch. */
.m-sub-sim{border-color:var(--sim-line);background-image:var(--sim-hatch);background-blend-mode:normal;}
.m-watermark{font-family:var(--font-mono);font-size:var(--step-micro);letter-spacing:var(--track-wide);color:var(--sim-fg);border:1px solid var(--sim-line);border-radius:var(--radius-pill);padding:2px 8px;}
.m-hatch{background-image:var(--sim-hatch);}

.m-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:var(--grid);}
.m-stat{min-width:0;padding:calc(var(--grid)*1.5);border:1px solid var(--hairline);border-radius:var(--radius-chip);}
.m-stat[data-state="never-fired"]{border-style:dashed;border-color:var(--hairline-strong);}
.m-stat[data-state="not-served"]{border-color:var(--hairline);}
.m-stat-l{font-family:var(--font-mono);font-size:var(--step-meta);letter-spacing:var(--track-mid);text-transform:uppercase;color:var(--faint);margin-top:var(--grid);}
.m-stat-n{font-size:var(--step-body);line-height:1.45;font-weight:300;color:var(--meta);margin:var(--grid-in) 0 var(--grid);max-width:44ch;}

/* THE FIGURE. A solid numeral, or an outlined dashed ring with nothing inside it. */
.m-fig{display:inline-flex;align-items:center;gap:calc(var(--grid-in)*2);font-family:var(--font-mono);font-variant-numeric:var(--numeric);letter-spacing:-0.02em;overflow-wrap:anywhere;}
.m-fig-stat{font-size:var(--step-stat);line-height:1;font-weight:600;}
.m-fig-row{font-size:var(--step-data);line-height:1.35;font-weight:500;}
.m-ring{display:inline-block;height:var(--step-stat);width:calc(var(--step-stat)*0.62);border:2px dashed var(--faint);border-radius:50%;flex:0 0 auto;}
.m-ring-row{height:calc(var(--step-data)*1.35);width:calc(var(--step-data)*0.84);border-width:1px;}
.m-never{font-size:calc(var(--step-stat)*0.42);letter-spacing:var(--track-tight);text-transform:uppercase;color:var(--faint);font-weight:500;}
.m-fig-row .m-never{font-size:var(--step-micro);}

.m-scope{font-size:var(--step-body);line-height:1.5;font-weight:300;color:var(--meta);margin:calc(var(--grid)*1.5) 0 0;max-width:60ch;}
.m-components{display:flex;flex-wrap:wrap;gap:var(--grid);margin-top:calc(var(--grid)*1.5);}
.m-comp{display:inline-flex;align-items:center;gap:var(--grid-in);border:1px solid var(--hairline);border-radius:var(--radius-chip);padding:4px 10px;}
.m-comp[data-state="absent"]{border-style:dotted;}
.m-comp-l{font-family:var(--font-mono);font-size:var(--step-micro);letter-spacing:var(--track-mid);text-transform:uppercase;color:var(--faint);}
.m-comp-n{font-family:var(--font-mono);font-size:var(--step-micro);color:var(--faint);}

.m-vlist,.m-rowlist,.m-crit,.m-flags,.m-currencies,.m-future,.m-prov{list-style:none;margin:0;padding:0;}
.m-vlist{margin-top:calc(var(--grid)*2);border-top:1px solid var(--hairline);}
.m-vrow{display:flex;align-items:center;gap:var(--grid);min-height:var(--row-h);padding:var(--grid-in) 0;border-bottom:1px solid var(--hairline);flex-wrap:wrap;}
.m-vname{font-family:var(--font-mono);font-size:var(--step-data);color:var(--prose);flex:1 1 auto;min-width:0;overflow-wrap:anywhere;}
.m-vmrr{font-family:var(--font-mono);font-size:var(--step-micro);letter-spacing:var(--track-mid);text-transform:uppercase;color:var(--faint);display:inline-flex;align-items:center;gap:var(--grid-in);}

.m-rows{margin-top:calc(var(--grid)*2);}
.m-rows summary{font-family:var(--font-mono);font-size:var(--step-micro);letter-spacing:var(--track-tight);text-transform:uppercase;color:var(--accent-dim);cursor:pointer;list-style:none;}
.m-rows summary::-webkit-details-marker{display:none;}
.m-rows summary:hover{color:var(--accent);}
.m-row{display:flex;align-items:baseline;gap:var(--grid);font-family:var(--font-mono);font-size:var(--step-data);min-height:var(--row-h);padding:var(--grid-in) 0;border-bottom:1px solid var(--hairline);flex-wrap:wrap;}
.m-row-t{color:var(--faint);font-variant-numeric:var(--numeric);flex:0 0 auto;}
.m-row-a{font-variant-numeric:var(--numeric);color:var(--prose);flex:0 0 auto;}
.m-row-a-off{color:var(--faint);}
.m-row-v{color:var(--meta);}
.m-row-p{color:var(--meta);flex:1 1 120px;min-width:0;overflow-wrap:anywhere;}
.m-row-fx{color:var(--faint);font-size:var(--step-micro);}
.m-row-id{color:var(--faint);font-size:var(--step-micro);overflow-wrap:anywhere;}

.m-never-added{font-size:var(--step-body);line-height:1.6;font-weight:300;color:var(--meta);margin:0;max-width:82ch;}
.m-code{font-family:var(--font-mono);font-size:var(--step-meta);color:var(--accent-dim);letter-spacing:var(--track-tight);}

.m-currencies{display:flex;flex-wrap:wrap;gap:var(--grid);margin-bottom:var(--grid);}
.m-chip{font-family:var(--font-mono);font-size:var(--step-data);color:var(--prose);border:1px solid var(--panel-border);border-radius:var(--radius-chip);padding:5px 10px;}
.m-chip-quiet{color:var(--meta);}
.m-chip-warn{color:var(--amber);}
.m-refusal{font-size:var(--step-body);line-height:1.55;font-weight:300;color:var(--meta);margin:0 0 calc(var(--grid)*1.5);max-width:72ch;border-left:2px solid var(--hairline-strong);padding-left:var(--grid);}
.m-empty{font-size:var(--step-body);line-height:1.55;font-weight:300;color:var(--meta);margin:0;max-width:60ch;}

.m-return-human{font-size:var(--step-lede);line-height:1.55;font-weight:300;color:var(--prose);margin:0 0 calc(var(--grid)*2);max-width:82ch;}
.m-return-parts{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:var(--grid);}
.m-part{border:1px solid var(--hairline);border-radius:var(--radius-chip);padding:calc(var(--grid)*1.5);min-width:0;}
.m-part-l{font-family:var(--font-mono);font-size:var(--step-micro);letter-spacing:var(--track-mid);text-transform:uppercase;color:var(--faint);}
.m-part-v{font-family:var(--font-mono);font-size:var(--step-data);color:var(--prose);margin:var(--grid-in) 0;overflow-wrap:anywhere;}
.m-part-w{font-family:var(--font-mono);font-size:var(--step-micro);color:var(--accent-dim);overflow-wrap:anywhere;}
.m-cmd{font-size:var(--step-body);line-height:1.5;font-weight:300;color:var(--meta);margin:calc(var(--grid)*2) 0 0;}

.m-kill-loud{border-color:var(--amber);}
.m-kill-sum{font-size:var(--step-lede);line-height:1.45;color:var(--meta);margin:0 0 calc(var(--grid)*2);}
.m-loud{color:var(--amber);}
.m-critrow{display:flex;align-items:baseline;gap:var(--grid);min-height:var(--row-h);padding:var(--grid-in) 0;border-bottom:1px solid var(--hairline);flex-wrap:wrap;}
.m-critrow[data-state="absent"]{border-bottom-style:dotted;}
.m-crit-v{font-family:var(--font-mono);font-size:var(--step-data);color:var(--prose);}
.m-crit-c{font-family:var(--font-mono);font-size:var(--step-data);color:var(--meta);}
.m-crit-h{font-family:var(--font-mono);font-size:var(--step-data);letter-spacing:var(--track-tight);}
.m-crit-d{font-size:var(--step-body);line-height:1.5;font-weight:300;color:var(--meta);flex:1 1 240px;min-width:0;}
.m-future{margin-top:var(--grid);font-size:var(--step-body);line-height:1.5;color:var(--amber);font-weight:300;}

.m-refused{border-left:2px solid var(--hairline-strong);padding-left:var(--grid);}
.m-refused-loud{border-left-color:var(--amber);}
.m-refused-h{font-size:var(--step-body);line-height:1.55;font-weight:300;color:var(--prose);margin:var(--grid-in) 0 0;max-width:76ch;}
.m-reading{font-family:var(--font-mono);font-size:var(--step-data);color:var(--meta);margin:0;}

.m-flag{display:flex;align-items:baseline;gap:var(--grid);padding:var(--grid-in) var(--grid-in);border-bottom:1px solid var(--hairline);flex-wrap:wrap;}
.m-flag-t{font-family:var(--font-mono);font-size:var(--step-data);color:var(--amber);}
.m-flag-v{font-family:var(--font-mono);font-size:var(--step-data);color:var(--meta);}
.m-flag-d{font-size:var(--step-body);line-height:1.5;font-weight:300;color:var(--prose);flex:1 1 260px;min-width:0;}

.m-gaplist{margin:0;}
.m-gap{padding:var(--grid-in) 0;border-bottom:1px solid var(--hairline);}
.m-gap-t{font-family:var(--font-mono);font-size:var(--step-data);color:var(--prose);}
.m-gap-d{font-size:var(--step-body);line-height:1.5;font-weight:300;color:var(--meta);margin:var(--grid-in) 0 0;max-width:82ch;}
.m-prov{margin-top:calc(var(--grid)*2);display:flex;flex-direction:column;gap:var(--grid-in);}
.m-prov li{display:flex;align-items:baseline;gap:var(--grid);flex-wrap:wrap;font-size:var(--step-body);font-weight:300;color:var(--meta);}
.m-prov-h{font-family:var(--font-mono);font-size:var(--step-data);color:var(--prose);font-weight:500;}
.m-prov-s{flex:1 1 240px;min-width:0;}
.m-prov-a{font-family:var(--font-mono);font-size:var(--step-micro);color:var(--faint);}
.m-badge-file{font-family:var(--font-mono);font-size:var(--step-micro);letter-spacing:var(--track-tight);text-transform:uppercase;color:var(--meta);border:1px solid var(--hairline-strong);border-radius:var(--radius-pill);padding:2px 8px;}
.m-asof{font-size:var(--step-body);line-height:1.5;font-weight:300;color:var(--meta);margin:calc(var(--grid)*2) 0 0;max-width:82ch;}
.m-receipt{display:inline-flex;align-items:center;gap:6px;font-family:var(--font-mono);font-size:var(--step-meta);color:var(--accent-dim);border:1px solid var(--accent-line);border-radius:var(--radius-chip);padding:4px 9px;margin-top:var(--grid);overflow-wrap:anywhere;max-width:100%;}
`;
