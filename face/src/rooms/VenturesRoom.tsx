// VenturesRoom -- "The factory is not the product."
//
// Every venture, its own money, its own kill criteria, and how far it is from them. Today that
// is one venture, zero rupees earned, and two kill lines neither of which can be evaluated --
// and every one of those three facts is a DIFFERENT kind of nothing, drawn differently.
//
// THERE IS NO LOGIC IN THIS FILE. The roster, its ordering, which venture is a finding rather
// than a row, which of the five nothings a cell shows -- all of it is ../lib/money.mjs, because
// CI never runs `npm install` and a branch inside a .tsx is a branch nobody tests.
//
// TWO AUTHORITIES, JOINED, NEITHER TRUSTED ALONE:
//   ventures.yaml (through the kill panel) says WHICH VENTURES EXIST. It is the receipted file.
//   /api/pnl says WHAT EACH ONE EARNED.
// `ventureRoster` takes the union, because rendering only the declared list would delete a
// venture the company is actually spending on, and a missing row is what this product exists
// not to have. Both ways they can disagree are shown as findings rather than resolved.
//
// THE GLYPH IS THE ARGUMENT. A venture that has never earned gets an OUTLINED, DASHED RING
// where its number would be -- not a `0`, because a `0` cannot tell "measured, and it is zero"
// apart from "no measurement exists", and on this screen the second is the true one for every
// row. Dashed is already the product's mark for "built and has never run" (the Map draws
// unexercised stations dashed), so this says one thing in a second place rather than a new one.

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { Door } from "../lib/door.mjs";
import { readHealth } from "../lib/inbox.mjs";
import type { HealthView } from "../lib/inbox.mjs";
import {
  moneyOpening, readPnl, readKill, greenGate, ventureRoster, ventureMoney, rosterSummary,
  criterionSentence, costTally, formatMinor, pnlPath, refusalOf, fmtInt, asOfSupport,
  REAL_KIND, SIM_KIND, OVERHEAD_VENTURE, KILL_BADGE,
} from "../lib/money.mjs";
import type {
  PnlView, KillView, GreenGate, Figure, VentureRow, CostLine, RevenueRow,
} from "../lib/money.mjs";

/* -------------------------------------------------------------------------- */

export type VenturesRoomProps = {
  /** venture id -> room id, straight off the registry. Absent is drawn as absent, never empty. */
  declared?: Record<string, string>;
  /** The L2 client. The shell owns the token; this room only reads through it. */
  door: Door;
  /** The registry's own entry for this room, when the shell has read /api/rooms. */
  room?: { sentence?: string; lede?: string };
  /** Explicit overrides. They beat the registry, which beats the built-in constant. */
  sentence?: string;
  lede?: string;
};

type Panel<T> =
  | { phase: "loading" }
  | { phase: "ok"; data: T }
  | { phase: "error"; code: string; human: string };

const POLL_MS = 45_000;

/* -------------------------------------------------------------------------- */

export function VenturesRoom({ door, room, sentence, lede, declared }: VenturesRoomProps) {
  const opening = moneyOpening("ventures", room, { sentence, lede });
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

  // The roster needs the kill panel to know which ventures are DECLARED. Until it arrives there
  // is no roster -- and an empty roster is not drawn in its place, because "the company has no
  // ventures" and "the read has not finished" are different claims.
  const roster: VentureRow[] = killData === null ? [] : ventureRoster({ real: realData, sim: simData, kill: killData });
  const summary = killData === null
    ? { headline: "reading", detail: "" }
    : rosterSummary(roster, killData);
  const asof = asOfSupport();

  return (
    <section className="v-room" aria-label="Ventures">
      <style>{CSS}</style>

      <header className="v-head">
        <div className="v-headtext">
          <h1 className="v-sentence">{opening.sentence}</h1>
          <p className="v-lede">{opening.lede}</p>
        </div>
        <div className="v-chrome">
          <ModeChip mode={realData === null ? null : realData.doorMode} />
          <span className="v-clock" title="the door's own clock, in the company's timezone">
            {readAt === "" ? "reading…" : readAt}
          </span>
          <button type="button" className="v-btn" onClick={reread}>re-read the door</button>
        </div>
      </header>

      {/* ── the roster's own headline, which is not a bare count either ── */}
      <div className="v-summary">
        <span className="v-summary-h">{summary.headline}</span>
        <p className="v-summary-d">{summary.detail}</p>
        <span className="v-badge-file" title="which ventures exist is read from ventures.yaml on the tree, digested and folded against an approved receipt; a file has no day-granular history to scrub to">
          {KILL_BADGE} — the venture set
        </span>
      </div>

      {/* ── the green gate, restated here because this room draws money too and a reader may
             land on it first. Same function, same fact, no second spelling. ── */}
      <div className={`v-gate${gate.spendable ? " v-gate-spent" : ""}`}>
        <span className="v-gate-label">real money</span>
        <p className="v-gate-why">{gate.why}</p>
        <span className="v-receipt" title={gate.source}>⌗ {gate.source}</span>
      </div>
      {gate.contradiction === null ? null : <p className="v-contradiction">{gate.contradiction}</p>}

      {/* ── the kill panel's three refusal states. None of them is an empty panel: an absent
             kill panel and a healthy one looking alike is how a disarmed kill switch stays
             invisible, and this room is where that would happen. ── */}
      {kill.phase === "loading" ? (
        <p className="v-reading">waiting for the criteria file from the door…</p>
      ) : kill.phase === "error" ? (
        <Refusal code={kill.code} human={kill.human} what="the kill panel" loud />
      ) : killData !== null && killData.refusal !== null ? (
        <Refusal code={killData.refusal.code} human={killData.refusal.human} what="the kill lines" loud={killData.state === "unreceipted"} />
      ) : null}

      {/* ── the ventures ── */}
      {real.phase === "loading" || kill.phase === "loading" ? (
        <p className="v-reading">waiting for the P&amp;L from the door…</p>
      ) : real.phase === "error" ? (
        <Refusal code={real.code} human={real.human} what="the P&L" loud={false} />
      ) : roster.length === 0 ? null : (
        <div className="v-list">
          {roster.map((row) => (
            // `served` is not decoration. A venture missing from a body that never arrived is
            // not a venture with no receipts -- and saying it is would be a claim about the log
            // made out of a fact about the read.
            <VentureCard
              key={row.venture}
              row={row}
              gate={gate}
              served={{ real: real.phase === "ok", sim: sim.phase === "ok" }}
            />
          ))}
        </div>
      )}

      {/* ── the factory itself, which is deliberately NOT one of the rows above ── */}
      <section className="v-panel v-factory" aria-label="Overhead">
        <div className="v-panel-head">
          <span className="v-panel-title">the factory · venture: {OVERHEAD_VENTURE}</span>
          <span className="v-panel-hint">
            {realData === null ? "—" : fmtInt(realData.overhead.lines.length)} cost line
            {realData !== null && realData.overhead.lines.length === 1 ? "" : "s"}
          </span>
        </div>
        <p className="v-panel-lede">
          The room's own sentence, as a rule the data obeys: building the factory is not a cost of
          any product made in it, so <code className="v-code">venture: {OVERHEAD_VENTURE}</code> is
          Overhead and never appears as a venture above. It is shown here so its spend is not
          invisible — not so it can be counted against a product.
        </p>
        {realData === null ? null : realData.overhead.lines.length === 0 ? (
          <p className="v-empty">
            The door served no overhead line. That is an empty list, not a zero — nothing here
            claims the factory cost nil.
          </p>
        ) : (
          <>
            <ul className="v-chips">
              {costTally(realData.overhead.lines, "GET /api/pnl → model.overhead.lines[]").byCurrency.map((c) => (
                <li key={c.currency} className="v-chip">
                  {c.currency} · {fmtInt(c.count)} receipt{c.count === 1 ? "" : "s"}
                  {c.unrenderable === 0 ? null : <b className="v-chip-warn"> · {fmtInt(c.unrenderable)} unrenderable</b>}
                </li>
              ))}
            </ul>
            <p className="v-refusal">
              {costTally(realData.overhead.lines, "").refusal}
            </p>
            <details className="v-details">
              <summary>every overhead receipt</summary>
              <ul className="v-rowlist">
                {realData.overhead.lines.map((l) => <CostRow key={l.id} line={l} />)}
              </ul>
            </details>
          </>
        )}
      </section>

      <Declared ids={declared} />

      <p className="v-foot">
        <b className="v-code">{asof.code}</b> — {asof.offer} Which ventures exist comes from a file
        and has no history to scrub either; what each one earned comes from the spine and scopes by
        month, never by day.
      </p>
    </section>
  );
}

/**
 * The ventures arc has DECLARED, from ventures.yaml (ADR-1317).
 *
 * This room's panels are about what each venture EARNED, which comes from the spine. That is
 * the right main event and it left a hole: a venture declared in ventures.yaml but with no
 * money yet appeared nowhere at all, so adding a second venture changed nothing on the screen
 * that exists to watch them. Kill lines are the highest-consequence thing in arc; a roster
 * that only lists what has already moved money is a roster you cannot use to notice a gap.
 */
function Declared({ ids }: { ids?: Record<string, string> }) {
  const names = ids ? Object.keys(ids).sort() : null;
  return (
    <p className="v-foot v-declared">
      {names === null
        ? "the registry served no venture roster, so this room cannot say which ventures are declared. That is a fact about this read, not about the company."
        : names.length === 0
          ? "ventures.yaml declares no ventures. That is a measured zero, not a missing read — the file was there and it was empty."
          : `declared in ventures.yaml: ${names.join(", ")} — ${names.length === 1 ? "one venture, carrying a kill line" : `${names.length} ventures, each carrying a kill line`}. A venture appears here the moment it is declared, whether or not it has earned anything.`}
    </p>
  );
}

export default VenturesRoom;

/* ══════════════════════════════════════════════════════════════════════════ *
 * VentureCard — one venture: what it earned, what it simulated, what it cost, and how far it
 * is from each line someone drew for it.
 * ══════════════════════════════════════════════════════════════════════════ */
function VentureCard({
  row, gate, served,
}: {
  row: VentureRow;
  gate: GreenGate;
  served: { real: boolean; sim: boolean };
}) {
  const money = ventureMoney(row, gate, served);
  const worst = row.kill === null ? null : row.kill.worst;
  const danger = worst === "CROSSED" || worst === "WARNING" || !row.declared;

  return (
    <article className={danger ? "v-panel v-card v-card-loud" : "v-panel v-card"} aria-label={row.venture}>
      <div className="v-card-head">
        <h2 className="v-name">{row.venture}</h2>
        {row.declared ? (
          <span className="v-badge" title="named in ventures.yaml, whose criteria have an approved receipt on the spine">
            declared
          </span>
        ) : (
          <span className="v-badge v-badge-warn" title="money is booked to this venture and ventures.yaml declares no kill line for it">
            no kill lines
          </span>
        )}
        {worst === null ? null : <span className={worst === "CROSSED" ? "v-worst v-worst-loud" : "v-worst"}>{worst}</span>}
      </div>

      {/* ── the sentence first, the numbers second. A venture that has never earned says so in
             words as well as in shape, because the shape is what a reader sees and the words
             are what a reader can quote. ── */}
      <p className="v-earned">{money.earnedSentence}</p>

      <div className="v-stats">
        <Stat label={`real · ${REAL_KIND}`} figure={money.real} />
        <Stat label="MRR" figure={money.mrr} />
        <Stat label={`simulated · ${SIM_KIND}`} figure={money.sim} sim />
      </div>

      <p className="v-nevermix">
        The real figure and the simulated one come from two separate reads of two separate kinds.
        They are never added, never averaged, and the simulated one never wears the colour of the
        real one.
      </p>

      {money.components.length === 0 ? null : (
        <div className="v-components">
          {money.components.map((c) => (
            <div key={c.label} className="v-comp" data-state={c.state}>
              <span className="v-comp-l">{c.label}</span>
              <FigureValue figure={c} size="row" />
              {c.state === "absent" ? <span className="v-comp-n" title={c.note}>never recorded</span> : null}
            </div>
          ))}
        </div>
      )}

      {/* ── kill distance ── */}
      <div className="v-kill">
        <span className="v-sub">kill lines</span>
        {row.kill === null ? (
          <p className="v-kill-none">
            ventures.yaml declares no kill line for {row.venture}. There is no line to measure a
            distance to, so no distance is drawn — and nothing here reads that absence as safety.
          </p>
        ) : (
          <ul className="v-crit">
            {row.kill.criteria.map((c) => {
              const said = criterionSentence(c);
              return (
                <li key={c.criterion} className="v-critrow" data-state={said.state}>
                  <span className="v-crit-c">{c.criterion}</span>
                  <span className="v-crit-h" style={{ color: said.ink } as CSSProperties}>{said.headline}</span>
                  <span className="v-crit-d">{said.detail}</span>
                </li>
              );
            })}
          </ul>
        )}
        {row.kill === null || row.kill.absentCount === null || row.kill.absentCount === 0 ? null : (
          <p className="v-absent-count">
            {fmtInt(row.kill.absentCount)} criteri{row.kill.absentCount === 1 ? "on" : "a"} could
            not be evaluated. They are listed above with the reason rather than dropped — a shorter
            list is a greener one, and indistinguishable from a healthy venture.
          </p>
        )}
      </div>

      {row.finding === null ? null : (
        <div className="v-finding">
          <b className="v-code">{row.finding.code}</b>
          <p className="v-finding-h">{row.finding.human}</p>
        </div>
      )}

      {/* ── what it cost, counted and never summed ── */}
      <div className="v-cost">
        <span className="v-sub">what it cost</span>
        {money.cost.lines.length === 0 ? (
          <p className="v-empty">
            No cost line is booked to {row.venture}. An empty list, not a zero.
          </p>
        ) : (
          <>
            <ul className="v-chips">
              {money.cost.byCurrency.map((c) => (
                <li key={c.currency} className="v-chip">
                  {c.currency} · {fmtInt(c.count)} receipt{c.count === 1 ? "" : "s"}
                  {c.unrenderable === 0 ? null : <b className="v-chip-warn"> · {fmtInt(c.unrenderable)} unrenderable</b>}
                </li>
              ))}
            </ul>
            <p className="v-refusal">{money.cost.refusal}</p>
            <details className="v-details">
              <summary>every cost receipt for {row.venture}</summary>
              <ul className="v-rowlist">
                {money.cost.lines.map((l) => <CostRow key={l.id} line={l} />)}
              </ul>
            </details>
          </>
        )}
      </div>

      {row.real === null || row.real.rows.length === 0 ? null : (
        <details className="v-details">
          <summary>every revenue receipt for {row.venture}</summary>
          <ul className="v-rowlist">
            {row.real.rows.map((r) => <RevenueRowLine key={r.id} row={r} gate={gate} sim={false} />)}
          </ul>
        </details>
      )}
      {row.sim === null || row.sim.rows.length === 0 ? null : (
        <details className="v-details v-details-sim">
          <summary>every SIMULATED receipt for {row.venture}</summary>
          <ul className="v-rowlist v-hatch">
            {row.sim.rows.map((r) => <RevenueRowLine key={r.id} row={r} gate={gate} sim />)}
          </ul>
        </details>
      )}
    </article>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ *
 * FigureValue — the same drawing rule as the Money room, and the same reason.
 *
 * `zeroGlyph` in the lib decided the shape; this only draws it. A hollow figure is an
 * OUTLINED DASHED RING at the numeral's own size with nothing inside it, so the difference
 * between "no measurement exists" and "measured, and it is zero" survives with every word on
 * the page removed.
 * ══════════════════════════════════════════════════════════════════════════ */
function FigureValue({ figure, size = "stat" }: { figure: Figure; size?: "stat" | "row" }) {
  const cls = size === "stat" ? "v-fig v-fig-stat" : "v-fig v-fig-row";
  if (figure.glyph === "hollow") {
    return (
      <span className={cls} data-state={figure.state} title={figure.note}>
        <span
          className={size === "stat" ? "v-ring" : "v-ring v-ring-row"}
          aria-hidden="true"
          style={{ borderColor: figure.ink } as CSSProperties}
        />
        <span className="v-never">{figure.text}</span>
      </span>
    );
  }
  return (
    <span className={cls} data-state={figure.state} title={figure.note} style={{ color: figure.ink } as CSSProperties}>
      {figure.text}
    </span>
  );
}

function Stat({ label, figure, sim = false }: { label: string; figure: Figure; sim?: boolean }) {
  return (
    <div className={sim && figure.hatch ? "v-stat v-hatch" : "v-stat"} data-state={figure.state}>
      <FigureValue figure={figure} />
      <div className="v-stat-l">{label}</div>
      {figure.note === "" ? null : <p className="v-stat-n">{figure.note}</p>}
      <span className="v-receipt" title={figure.why}>⌗ {figure.why}</span>
    </div>
  );
}

function RevenueRowLine({ row, gate, sim }: { row: RevenueRow; gate: GreenGate; sim: boolean }) {
  const inr = row.amountInr === null ? null : formatMinor(row.amountInr, "INR");
  const native = row.amount === null || row.currency === null ? null : formatMinor(Math.abs(row.amount), row.currency);
  const ink = sim ? "var(--sim-fg)" : gate.spendable ? "var(--green)" : "var(--faint)";
  return (
    <li className="v-row">
      <span className="v-row-t">{row.ts}</span>
      <span className="v-row-a" style={{ color: ink } as CSSProperties}>{inr === null ? "not served" : inr.text}</span>
      <span className="v-row-p">{row.refundOf === null ? row.paymentId : `refund of ${row.refundOf}`}</span>
      {native === null || row.currency === "INR" ? null : (
        <span className="v-row-fx" title="converted at the rate recorded on this event — never one looked up at render (ADR-1003)">
          {native.text} {row.currency} @ {row.rate ?? "rate not recorded"}
        </span>
      )}
      <span className="v-row-id" title={row.id}>{row.id}</span>
    </li>
  );
}

function CostRow({ line }: { line: CostLine }) {
  const money = line.amount === null || line.currency === null ? null : formatMinor(line.amount, line.currency);
  return (
    <li className="v-row">
      <span className="v-row-t">{line.ts}</span>
      <span className={money === null || !money.exact ? "v-row-a v-row-a-off" : "v-row-a"} title={money?.note ?? "the door served no amount for this line"}>
        {money === null ? "—" : money.text}
      </span>
      <span className="v-row-p">{line.source ?? "source unrecorded"}{line.label === null ? "" : ` · ${line.label}`}</span>
      <span className="v-row-id" title={line.id}>{line.id}</span>
    </li>
  );
}

/**
 * A refused read shows the door's own sentence AND its code, verbatim. `loud` is for the one
 * refusal that is a CONTROL FIRING rather than a read failing: UNRECEIPTED CRITERIA CHANGE
 * means someone edited the kill lines and nobody approved them, and it is the loudest thing on
 * this page rather than the quietest. It is still not --red: --red is incident.raised.
 */
function Refusal({ code, human, what, loud }: { code: string; human: string; what: string; loud: boolean }) {
  return (
    <div className={loud ? "v-refused v-refused-loud" : "v-refused"}>
      <b className="v-code">{code}</b>
      <p className="v-refused-h">
        {loud ? "" : `Could not read ${what}. `}
        {human}
      </p>
    </div>
  );
}

function ModeChip({ mode }: { mode: string | null }) {
  if (mode === null) return <span className="v-mode v-mode-unknown">mode unknown</span>;
  return <span className={mode === "sim" ? "v-mode v-mode-sim" : "v-mode"}>{mode}</span>;
}

/* -------------------------------------------------------------------------- */

const CSS = `
.v-room{font-family:var(--font-display);color:var(--prose);padding:calc(var(--grid)*3) calc(var(--grid)*3) calc(var(--grid)*6);max-width:1280px;margin:0 auto;display:flex;flex-direction:column;gap:calc(var(--grid)*2);}
.v-head{display:flex;align-items:flex-start;gap:calc(var(--grid)*2);flex-wrap:wrap;}
.v-headtext{flex:1 1 420px;min-width:0;}
.v-sentence{font-size:clamp(24px,3.6vw,var(--step-room));line-height:1.04;letter-spacing:-0.02em;font-weight:600;margin:0 0 var(--grid) 0;color:var(--prose);}
.v-lede{font-size:var(--step-lede);line-height:1.5;font-weight:300;color:var(--meta);margin:0;max-width:64ch;}
.v-chrome{display:flex;align-items:center;gap:var(--grid);flex-wrap:wrap;margin-left:auto;}
.v-mode,.v-clock{font-family:var(--font-mono);font-size:var(--step-meta);letter-spacing:var(--track-tight);text-transform:uppercase;padding:calc(var(--grid-in)*1) calc(var(--grid-in)*2);border-radius:var(--radius-pill);}
.v-mode{color:var(--mode-live);background:var(--mode-bg);}
.v-mode-sim{color:var(--mode-sim);background:var(--sim-hatch);}
.v-mode-unknown{color:var(--faint);background:var(--mode-bg);}
.v-clock{color:var(--meta);text-transform:none;}
.v-btn{font-family:var(--font-mono);font-size:var(--step-data);letter-spacing:var(--track-tight);text-transform:uppercase;min-height:var(--row-h-live);padding:0 calc(var(--grid)*2);border-radius:var(--radius-chip);border:1px solid var(--hairline-strong);background:rgba(255,255,255,0.04);color:var(--prose);cursor:pointer;transition:border-color var(--dur-fast) var(--ease),background var(--dur-fast) var(--ease);}
.v-btn:hover{border-color:var(--accent-line);background:var(--accent-wash);}

.v-summary{display:flex;align-items:center;gap:calc(var(--grid)*2);flex-wrap:wrap;padding:calc(var(--grid)*2);border:1px solid var(--panel-border);border-radius:var(--radius-panel);background:var(--panel);backdrop-filter:blur(var(--panel-blur));-webkit-backdrop-filter:blur(var(--panel-blur));}
.v-summary-h{font-family:var(--font-mono);font-size:var(--step-data);letter-spacing:var(--track-mid);text-transform:uppercase;color:var(--accent);flex:0 0 auto;}
.v-summary-d{margin:0;font-size:var(--step-lede);line-height:1.45;font-weight:300;color:var(--prose);flex:1 1 320px;min-width:0;}

.v-gate{display:flex;align-items:center;gap:calc(var(--grid)*2);flex-wrap:wrap;padding:calc(var(--grid)*2);border:1px solid var(--panel-border);border-left:2px dashed var(--faint);border-radius:var(--radius-panel);background:var(--panel);backdrop-filter:blur(var(--panel-blur));-webkit-backdrop-filter:blur(var(--panel-blur));}
.v-gate-spent{border-left:2px solid var(--green);}
.v-gate-label{font-family:var(--font-mono);font-size:var(--step-micro);letter-spacing:var(--track-wide);text-transform:uppercase;color:var(--faint);flex:0 0 auto;}
.v-gate-why{margin:0;font-size:var(--step-body);line-height:1.5;color:var(--prose);flex:1 1 320px;min-width:0;}
.v-contradiction{margin:0;padding:calc(var(--grid)*1.5) calc(var(--grid)*2);border:1px solid var(--amber);border-radius:var(--radius-chip);color:var(--amber);font-size:var(--step-body);line-height:1.5;}

.v-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:var(--grid);align-items:start;}
.v-panel{border:1px solid var(--panel-border);border-radius:var(--radius-panel);background:var(--panel);backdrop-filter:blur(var(--panel-blur));-webkit-backdrop-filter:blur(var(--panel-blur));padding:var(--pad-panel);min-width:0;}
.v-card{display:flex;flex-direction:column;gap:calc(var(--grid)*1.5);}
.v-card-loud{border-color:var(--amber);}
.v-card-head{display:flex;align-items:baseline;gap:var(--grid);flex-wrap:wrap;}
.v-name{font-size:var(--step-lede);font-weight:600;letter-spacing:-0.01em;margin:0;color:var(--prose);font-family:var(--font-mono);}
.v-badge{font-family:var(--font-mono);font-size:var(--step-micro);letter-spacing:var(--track-tight);text-transform:uppercase;color:var(--meta);border:1px solid var(--hairline-strong);border-radius:var(--radius-pill);padding:2px 8px;}
.v-badge-warn{color:var(--amber);border-color:var(--amber);}
.v-worst{font-family:var(--font-mono);font-size:var(--step-micro);letter-spacing:var(--track-tight);text-transform:uppercase;color:var(--faint);margin-left:auto;}
.v-worst-loud{color:var(--amber);}
.v-badge-file{font-family:var(--font-mono);font-size:var(--step-micro);letter-spacing:var(--track-tight);text-transform:uppercase;color:var(--meta);border:1px solid var(--hairline-strong);border-radius:var(--radius-pill);padding:2px 8px;}

.v-earned{margin:0;font-size:var(--step-body);line-height:1.55;font-weight:300;color:var(--prose);max-width:66ch;}
.v-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:var(--grid);}
.v-stat{min-width:0;padding:calc(var(--grid)*1.5);border:1px solid var(--hairline);border-radius:var(--radius-chip);}
.v-stat[data-state="never-fired"]{border-style:dashed;border-color:var(--hairline-strong);}
.v-stat[data-state="absent"]{border-style:dotted;}
.v-stat-l{font-family:var(--font-mono);font-size:var(--step-micro);letter-spacing:var(--track-mid);text-transform:uppercase;color:var(--faint);margin-top:var(--grid);overflow-wrap:anywhere;}
.v-stat-n{font-size:var(--step-body);line-height:1.45;font-weight:300;color:var(--meta);margin:var(--grid-in) 0 var(--grid);max-width:44ch;}
.v-hatch{background-image:var(--sim-hatch);border-color:var(--sim-line);}

.v-fig{display:inline-flex;align-items:center;gap:calc(var(--grid-in)*2);font-family:var(--font-mono);font-variant-numeric:var(--numeric);letter-spacing:-0.02em;overflow-wrap:anywhere;}
.v-fig-stat{font-size:var(--step-stat);line-height:1;font-weight:600;}
.v-fig-row{font-size:var(--step-data);line-height:1.35;font-weight:500;}
.v-ring{display:inline-block;height:var(--step-stat);width:calc(var(--step-stat)*0.62);border:2px dashed var(--faint);border-radius:50%;flex:0 0 auto;}
.v-ring-row{height:calc(var(--step-data)*1.35);width:calc(var(--step-data)*0.84);border-width:1px;}
.v-never{font-size:calc(var(--step-stat)*0.42);letter-spacing:var(--track-tight);text-transform:uppercase;color:var(--faint);font-weight:500;}
.v-fig-row .v-never{font-size:var(--step-micro);}

.v-nevermix{margin:0;font-size:var(--step-body);line-height:1.5;font-weight:300;color:var(--meta);max-width:70ch;}
.v-components{display:flex;flex-wrap:wrap;gap:var(--grid);}
.v-comp{display:inline-flex;align-items:center;gap:var(--grid-in);border:1px solid var(--hairline);border-radius:var(--radius-chip);padding:4px 10px;}
.v-comp[data-state="absent"]{border-style:dotted;}
.v-comp-l{font-family:var(--font-mono);font-size:var(--step-micro);letter-spacing:var(--track-mid);text-transform:uppercase;color:var(--faint);}
.v-comp-n{font-family:var(--font-mono);font-size:var(--step-micro);color:var(--faint);}

.v-sub{font-family:var(--font-mono);font-size:var(--step-meta);letter-spacing:var(--track-wide);text-transform:uppercase;color:var(--accent);display:block;margin-bottom:var(--grid);}
.v-crit,.v-rowlist,.v-chips{list-style:none;margin:0;padding:0;}
.v-critrow{display:flex;align-items:baseline;gap:var(--grid);min-height:var(--row-h);padding:var(--grid-in) 0;border-bottom:1px solid var(--hairline);flex-wrap:wrap;}
.v-critrow[data-state="absent"]{border-bottom-style:dotted;}
.v-crit-c{font-family:var(--font-mono);font-size:var(--step-data);color:var(--prose);}
.v-crit-h{font-family:var(--font-mono);font-size:var(--step-data);letter-spacing:var(--track-tight);}
.v-crit-d{font-size:var(--step-body);line-height:1.5;font-weight:300;color:var(--meta);flex:1 1 220px;min-width:0;}
.v-kill-none,.v-absent-count{font-size:var(--step-body);line-height:1.5;font-weight:300;color:var(--meta);margin:var(--grid) 0 0;max-width:66ch;}

.v-finding{border-left:2px solid var(--amber);padding-left:var(--grid);}
.v-finding-h{font-size:var(--step-body);line-height:1.55;font-weight:300;color:var(--prose);margin:var(--grid-in) 0 0;max-width:70ch;}

.v-chips{display:flex;flex-wrap:wrap;gap:var(--grid);margin-bottom:var(--grid);}
.v-chip{font-family:var(--font-mono);font-size:var(--step-data);color:var(--prose);border:1px solid var(--panel-border);border-radius:var(--radius-chip);padding:5px 10px;}
.v-chip-warn{color:var(--amber);}
.v-refusal{font-size:var(--step-body);line-height:1.55;font-weight:300;color:var(--meta);margin:0 0 var(--grid);max-width:72ch;border-left:2px solid var(--hairline-strong);padding-left:var(--grid);}
.v-empty{font-size:var(--step-body);line-height:1.55;font-weight:300;color:var(--meta);margin:0;max-width:60ch;}

.v-details summary{font-family:var(--font-mono);font-size:var(--step-micro);letter-spacing:var(--track-tight);text-transform:uppercase;color:var(--accent-dim);cursor:pointer;list-style:none;}
.v-details summary::-webkit-details-marker{display:none;}
.v-details summary:hover{color:var(--accent);}
.v-details-sim summary{color:var(--sim-fg);}
.v-row{display:flex;align-items:baseline;gap:var(--grid);font-family:var(--font-mono);font-size:var(--step-data);min-height:var(--row-h);padding:var(--grid-in) 0;border-bottom:1px solid var(--hairline);flex-wrap:wrap;}
.v-row-t{color:var(--faint);font-variant-numeric:var(--numeric);flex:0 0 auto;}
.v-row-a{font-variant-numeric:var(--numeric);color:var(--prose);flex:0 0 auto;}
.v-row-a-off{color:var(--faint);}
.v-row-p{color:var(--meta);flex:1 1 120px;min-width:0;overflow-wrap:anywhere;}
.v-row-fx{color:var(--faint);font-size:var(--step-micro);}
.v-row-id{color:var(--faint);font-size:var(--step-micro);overflow-wrap:anywhere;}

.v-factory{border-style:dashed;}
.v-panel-head{display:flex;align-items:baseline;gap:var(--grid);flex-wrap:wrap;margin-bottom:var(--grid);}
.v-panel-title{font-family:var(--font-mono);font-size:var(--step-meta);letter-spacing:var(--track-wide);text-transform:uppercase;color:var(--accent);}
.v-panel-hint{font-family:var(--font-mono);font-size:var(--step-meta);color:var(--faint);margin-left:auto;}
.v-panel-lede{font-size:var(--step-body);line-height:1.55;font-weight:300;color:var(--meta);margin:0 0 calc(var(--grid)*2);max-width:76ch;}

.v-refused{border-left:2px solid var(--hairline-strong);padding-left:var(--grid);}
.v-refused-loud{border-left-color:var(--amber);}
.v-refused-h{font-size:var(--step-body);line-height:1.55;font-weight:300;color:var(--prose);margin:var(--grid-in) 0 0;max-width:82ch;}
.v-reading{font-family:var(--font-mono);font-size:var(--step-data);color:var(--meta);margin:0;}
.v-code{font-family:var(--font-mono);font-size:var(--step-meta);color:var(--accent-dim);letter-spacing:var(--track-tight);}
.v-declared{margin-top:var(--space-s);color:var(--faint);font-size:var(--step-micro);}
.v-foot{font-size:var(--step-body);line-height:1.55;font-weight:300;color:var(--meta);margin:0;max-width:82ch;}
.v-receipt{display:inline-flex;align-items:center;gap:6px;font-family:var(--font-mono);font-size:var(--step-meta);color:var(--accent-dim);border:1px solid var(--accent-line);border-radius:var(--radius-chip);padding:4px 9px;margin-top:var(--grid);overflow-wrap:anywhere;max-width:100%;}
`;
