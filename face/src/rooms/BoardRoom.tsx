// BoardRoom -- every lane, its phase, and what it is burning.
//
// One read: GET /api/board. The door walks PORTFOLIO.md for the ORDER and each lane's
// initiatives/<lane>/PROGRESS.md machine header for every VALUE, because the board is a
// view and the lane files are the truth (ADR-0051). This room keeps that split visible
// rather than smoothing it over: the rows are in the owner's priority order and the
// numbers are the lanes' own.
//
// It decides nothing. Parsing `8d`, telling a measured `0d` apart from an unrecorded one,
// working out the distance to a kill line, and refusing to sum a lane whose header did not
// say — all of that is ../lib/spine.mjs, where `node` can run it.
//
// TWO RULES THIS SCREEN EXISTS TO NOT BREAK:
//
//  1. A LANE PAST ITS KILL LINE IS NOT RED. --red means incident.raised and nothing else.
//     Overrun gets a LABEL and a mark on the meter, which is also what makes it legible to
//     a reader who cannot see the hue at all. A fifth meaning does not get a fifth hue.
//
//  2. A LANE WITH NO BURN RECORDED IS NOT A LANE BURNING ZERO. `legal` is at burn 0d of
//     5d, which is measured; `design` is at burn —, which is nothing at all. They render
//     differently, and one of them has no meter.

import { useCallback, useEffect, useState } from "react";
import type { Door } from "../lib/door.mjs";
import {
  openingFor, boardRows, boardTotals, boardProvenance, meterGeometry,
  fmtInt, fmtDays, refusalOf, unescapeDoorText,
} from "../lib/spine.mjs";
import type { BoardRow, BoardView, Meter } from "../lib/spine.mjs";
import type { Refused } from "../lib/inbox.mjs";

export type BoardRoomProps = {
  door: Door;
  room?: { sentence?: string; lede?: string };
  sentence?: string;
  lede?: string;
};

/** The board is file-borne. It changes when a lane's header changes, which is a commit,
 *  not a heartbeat — so this polls slowly and offers an explicit re-read. */
const POLL_MS = 90_000;

type Panel = { phase: "loading" } | { phase: "ok"; view: BoardView } | { phase: "error"; said: Refused };

export function BoardRoom({ door, room, sentence, lede }: BoardRoomProps) {
  const opening = openingFor("board", room, { sentence, lede });
  const [panel, setPanel] = useState<Panel>({ phase: "loading" });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    const read = () => {
      door
        .board(ac.signal)
        .then((raw: unknown) => {
          if (ac.signal.aborted) return;
          const parsed = boardRows(raw);
          // `boardRows` returns either a view or a refusal it raised itself. A refusal this
          // shell raises must surface through the same path as one the door raised: the
          // owner needs the NAME either way.
          setPanel("rows" in parsed ? { phase: "ok", view: parsed } : { phase: "error", said: parsed });
        })
        .catch((err: unknown) => {
          if (!ac.signal.aborted) setPanel({ phase: "error", said: refusalOf(err) });
        });
    };
    read();
    const timer = window.setInterval(read, POLL_MS);
    return () => {
      window.clearInterval(timer);
      ac.abort();
    };
  }, [door, nonce]);

  const reread = useCallback(() => setNonce((n) => n + 1), []);

  const view = panel.phase === "ok" ? panel.view : null;
  const totals = view === null ? null : boardTotals(view.rows);

  return (
    <section className="b-room" aria-label="Board">
      <style>{CSS}</style>

      <header className="b-head">
        <div className="b-headtext">
          <h1 className="b-sentence">{opening.sentence}</h1>
          <p className="b-lede">{opening.lede}</p>
        </div>
        <div className="b-chrome">
          <ModeChip mode={view?.mode ?? null} />
          <span className="b-badge" title="this room reads the tree and the contract; the spine has nothing to say about it, so as-of does not apply here">
            {view?.badge ?? "file, not log"}
          </span>
          <button type="button" className="b-btn" onClick={reread}>
            re-read the board
          </button>
        </div>
      </header>

      {panel.phase === "error" ? <Refusal said={panel.said} what="the lane board" /> : null}
      {panel.phase === "loading" ? <p className="b-waiting">reading the board from the door…</p> : null}

      {view === null || totals === null ? null : (
        <>
          {/* ── the totals, with what is NOT in them counted out loud ─────── */}
          <div className="b-kpis">
            <Stat label="lanes on the board" value={totals.lanes} note="every lane with both a PORTFOLIO.md row and an initiatives/<lane>/PROGRESS.md. A board row without a lane directory is the lint's problem and the door does not serve it." />
            <Stat label="live" value={totals.live} note="a cycle is running. LIVE takes the product's own colour, which carries no meaning — it is a statement about the lane's header, not about urgency." />
            <Stat label="blocked" value={totals.blocked} note="the lane cannot move until what its header names is cleared. Not an approval and not an incident: nothing on this screen can decide one." />
            <Stat label="idle" value={totals.idle} note="no cycle is running in the lane." />
            <Stat
              label="past the line"
              value={totals.past}
              note="lanes whose burn has passed the appetite they bought. Named, never coloured: --red is reserved for incident.raised and stays unspent."
            />
            <Stat
              label="not in the totals"
              value={totals.unmeasured}
              state={totals.unmeasured > 0 ? "loud" : "plain"}
              note="lanes whose header records no appetite, or no burn, or spells one in a way this shell will not convert. They are counted here rather than summed as zero — a missing entry that rides a default is exactly how a measured table starts lying."
            />
          </div>

          <div className="b-panel">
            <p className="b-say">{totals.sentence}</p>
            <p className="b-prov">{boardProvenance(view)}</p>
          </div>

          {/* ── the lanes, in the board's own order ────────────────────────── */}
          {view.rows.length === 0 ? (
            <div className="b-panel">
              <p className="b-say">
                The door answered with an empty lane list. That is a read that succeeded and found
                no lanes — which is not the same fact as a company with no lanes, and this room will
                not draw the second from the first.
              </p>
            </div>
          ) : (
            <ol className="b-lanes">
              {view.rows.map((row, i) => (
                <Lane key={row.lane || `row-${i}`} row={row} rank={i + 1} />
              ))}
            </ol>
          )}
        </>
      )}

      <footer className="b-foot">
        <span>read-only room · row order is the owner's, values are the lanes' own</span>
        <span className="b-foot-nums">
          appetite is the kill line · a lane over it is named, never coloured
        </span>
      </footer>
    </section>
  );
}

/* -------------------------------------------------------------------------- *
 * pieces
 * -------------------------------------------------------------------------- */

function ModeChip({ mode }: { mode: string | null }) {
  if (mode === null) return <span className="b-mode">mode unread</span>;
  const sim = mode === "sim";
  return (
    <span
      className={`b-mode${sim ? " b-mode-sim" : ""}`}
      title={sim ? "fixture data from a spine named on the command line — never real" : "the canonical tree, read live"}
    >
      {sim ? "SIMULATED" : mode}
    </span>
  );
}

function Stat({
  label,
  value,
  note,
  state = "plain",
}: {
  label: string;
  value: number | null;
  note: string;
  state?: "plain" | "loud";
}) {
  return (
    <div className="b-tile" data-state={value === null ? "not-served" : state}>
      <div className="b-tile-v">{value === null ? <span className="b-unread">not served</span> : fmtInt(value)}</div>
      <div className="b-tile-l">{label}</div>
      <details className="b-why">
        <summary>Why?</summary>
        <p className="b-why-note">{note}</p>
      </details>
    </div>
  );
}

function Lane({ row, rank }: { row: BoardRow; rank: number }) {
  return (
    <li className="b-lane" data-status={row.status.tone} data-meter={row.meter.state}>
      <div className="b-lane-head">
        <span className="b-rank" aria-hidden="true">
          {fmtInt(rank)}
        </span>
        <span className="b-lane-name">{row.lane === "" ? "—" : row.lane}</span>
        <span className="b-status" style={{ color: row.status.ink }} title={row.status.note}>
          {row.status.label}
        </span>
        <span className="b-phase">
          {row.phase.number === null ? (
            <em title="the header records no phase number">no phase</em>
          ) : (
            <>
              phase <b>{row.phase.number}</b>
            </>
          )}
        </span>
        {row.cycle === null ? null : <span className="b-cycle">{row.cycle}</span>}
      </div>

      <Burn meter={row.meter} appetite={row.appetite.text} burn={row.burn.text} />

      {row.phase.note === null ? null : <p className="b-note">{row.phase.note}</p>}

      {row.blockedOn === null ? null : (
        <details className="b-blocked">
          <summary>
            blocked on
            <span>{firstClause(row.blockedOn)}</span>
          </summary>
          <p>{row.blockedOn}</p>
        </details>
      )}

      {row.dependsOn === null ? null : (
        <p className="b-depends">
          <span className="b-key">depends on</span> {row.dependsOn}
        </p>
      )}

      {row.unread.length === 0 ? null : (
        <p className="b-unread-keys">
          <span className="b-key">also in this header</span> {row.unread.join(" · ")} — fields this
          shell has no column for, named rather than dropped.
        </p>
      )}
    </li>
  );
}

/**
 * The meter. The track is METER_SCALE appetites wide so the kill line sits at the same x on
 * every row and two lanes can be compared at a glance — a tick that moved with each lane's
 * overrun would make that impossible.
 *
 * The fill up to the line is --accent, which carries no meaning. The segment past the line
 * is neutral ink with its own texture, so it reads as a different material in greyscale
 * and does not spend a reserved hue on a fifth meaning.
 */
function Burn({ meter, appetite, burn }: { meter: Meter; appetite: string; burn: string }) {
  const g = meterGeometry(meter);
  return (
    <div className="b-burn">
      <div className="b-burn-figs">
        <span className="b-fig">
          <em>burn</em>
          <b data-missing={meter.state === "burn-unrecorded" ? "yes" : "no"}>
            {meter.state === "burn-unrecorded" ? "NOT RECORDED" : burn || "—"}
          </b>
        </span>
        <span className="b-fig">
          <em>appetite</em>
          <b data-missing={meter.state === "no-appetite" ? "yes" : "no"}>
            {meter.state === "no-appetite" && appetite === "" ? "NONE BOUGHT" : appetite || "NONE BOUGHT"}
          </b>
        </span>
        <span className={`b-line-label${meter.past ? " b-past" : ""}${meter.atLine ? " b-at" : ""}`}>
          {meter.label}
        </span>
      </div>

      {g.drawable ? (
        <div
          className="b-track"
          role="img"
          aria-label={meter.sentence}
          style={{
            ["--fill" as string]: `${g.fillPct}%`,
            ["--over" as string]: `${g.overPct}%`,
            ["--line" as string]: `${g.linePct}%`,
          }}
        >
          <i className="b-fill" />
          <i className="b-over" />
          <i className="b-killline" />
        </div>
      ) : (
        <div className="b-track b-track-void" aria-hidden="true" />
      )}

      <p className="b-burn-say">{meter.sentence}</p>
      {g.clamped ? (
        <p className="b-burn-say b-burn-clamp">
          The bar stops at the edge of its scale; the number above it does not. {meter.label} is the
          measurement — the meter is only a picture of it.
        </p>
      ) : null}
    </div>
  );
}

function Refusal({ said, what }: { said: Refused; what: string }) {
  return (
    <div className="b-refusal" role="status">
      <span className="b-codeword">{said.code}</span>
      <p>{said.human}</p>
      <p className="b-refusal-what">
        {what} is not on this screen, and nothing has been guessed in its place.
      </p>
    </div>
  );
}

/**
 * The first clause of a long blocked-on line, for the summary. Some lanes carry a
 * paragraph in that field; the whole of it is inside the <details>, so nothing is lost by
 * showing the head of it closed.
 */
function firstClause(text: string): string {
  const t = unescapeDoorText(text);
  const cut = t.search(/[—.·]|\s—\s/);
  const head = cut > 12 ? t.slice(0, cut) : t;
  return head.length > 78 ? `${head.slice(0, 78)}…` : head;
}

/* -------------------------------------------------------------------------- *
 * style. Every colour is a token; there is no hex in this file, and none of the
 * four reserved hues appears anywhere in it.
 * -------------------------------------------------------------------------- */

const CSS = `
.b-room{font-family:var(--font-display);color:var(--prose);padding:calc(var(--grid)*3) calc(var(--grid)*3) calc(var(--grid)*6);max-width:1280px;margin:0 auto;display:flex;flex-direction:column;gap:calc(var(--grid)*2);}
.b-head{display:flex;align-items:flex-start;gap:calc(var(--grid)*2);flex-wrap:wrap;}
.b-headtext{flex:1 1 420px;min-width:0;}
.b-sentence{font-size:clamp(24px,3.6vw,var(--step-room));line-height:1.04;letter-spacing:-0.02em;font-weight:600;margin:0 0 var(--grid) 0;color:var(--prose);}
.b-lede{font-size:var(--step-lede);line-height:1.5;font-weight:300;color:var(--meta);margin:0;max-width:66ch;}
.b-chrome{display:flex;align-items:center;gap:var(--grid);flex-wrap:wrap;margin-left:auto;}
.b-mode,.b-badge{font-family:var(--font-mono);font-size:var(--step-meta);letter-spacing:var(--track-tight);text-transform:uppercase;padding:calc(var(--grid-in)*1) calc(var(--grid-in)*2);border-radius:var(--radius-pill);}
.b-mode{color:var(--mode-live);background:var(--mode-bg);}
.b-mode-sim{color:var(--mode-sim);background:var(--sim-hatch);}
.b-badge{color:var(--meta);border:1px solid var(--hairline-strong);text-transform:none;}
.b-btn{font-family:var(--font-mono);font-size:var(--step-data);letter-spacing:var(--track-tight);text-transform:uppercase;min-height:var(--row-h-live);padding:0 calc(var(--grid)*2);border-radius:var(--radius-chip);border:1px solid var(--hairline-strong);background:rgba(255,255,255,0.04);color:var(--prose);cursor:pointer;transition:border-color var(--dur-fast) var(--ease),background var(--dur-fast) var(--ease);}
.b-btn:hover{border-color:var(--accent-line);background:var(--accent-wash);}
.b-panel{border:1px solid var(--panel-border);border-radius:var(--radius-panel);background:var(--panel);backdrop-filter:blur(var(--panel-blur));-webkit-backdrop-filter:blur(var(--panel-blur));padding:var(--pad-panel);min-width:0;}
.b-say{font-size:var(--step-body);line-height:1.6;font-weight:300;color:var(--prose);margin:0;max-width:88ch;}
.b-prov{font-family:var(--font-mono);font-size:var(--step-meta);line-height:1.65;color:var(--faint);margin:calc(var(--grid)*2) 0 0;max-width:96ch;}
.b-waiting{font-family:var(--font-mono);font-size:var(--step-meta);color:var(--faint);margin:0;}
.b-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:var(--grid);}
.b-tile{padding:calc(var(--grid)*2);border:1px solid var(--panel-border);border-radius:var(--radius-panel);background:var(--panel);backdrop-filter:blur(var(--panel-blur));-webkit-backdrop-filter:blur(var(--panel-blur));min-width:0;}
.b-tile[data-state="not-served"]{border-style:dashed;border-color:var(--hairline);}
.b-tile[data-state="loud"]{border-color:var(--hairline-strong);}
.b-tile-v{font-size:var(--step-stat);line-height:1;font-weight:600;letter-spacing:-0.02em;font-variant-numeric:var(--numeric);color:var(--prose);}
.b-unread{font-size:calc(var(--step-stat)*0.42);letter-spacing:var(--track-tight);text-transform:uppercase;color:var(--faint);font-weight:500;}
.b-tile-l{font-family:var(--font-mono);font-size:var(--step-meta);letter-spacing:var(--track-mid);text-transform:uppercase;color:var(--faint);margin-top:var(--grid);}
.b-why{margin-top:var(--grid);}
.b-why summary{font-family:var(--font-mono);font-size:var(--step-micro);letter-spacing:var(--track-tight);text-transform:uppercase;color:var(--accent-dim);cursor:pointer;list-style:none;}
.b-why summary::-webkit-details-marker{display:none;}
.b-why summary:hover{color:var(--accent);}
.b-why-note{font-size:var(--step-body);line-height:1.45;color:var(--meta);font-weight:300;margin:var(--grid) 0 0;}
.b-lanes{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:var(--grid);}
.b-lane{border:1px solid var(--panel-border);border-left:2px solid var(--hairline-strong);border-radius:var(--radius-panel);background:var(--panel);backdrop-filter:blur(var(--panel-blur));-webkit-backdrop-filter:blur(var(--panel-blur));padding:calc(var(--grid)*2) var(--pad-panel);min-width:0;}
/* LIVE takes the product's own colour. Nothing on this board wears a reserved hue: a lane
   is not an approval, a rupee, an incident, or a simulation. */
.b-lane[data-status="live"]{border-left-color:var(--accent);}
.b-lane[data-status="blocked"]{border-left-color:var(--hairline-strong);border-left-style:dashed;}
.b-lane[data-status="missing"]{border-left-color:var(--hairline);border-left-style:dotted;}
.b-lane-head{display:flex;align-items:baseline;gap:var(--grid);flex-wrap:wrap;}
.b-rank{font-family:var(--font-mono);font-size:var(--step-micro);color:var(--faint);font-variant-numeric:var(--numeric);min-width:2ch;}
.b-lane-name{font-family:var(--font-mono);font-size:var(--step-lede);letter-spacing:-0.01em;color:var(--prose);}
.b-status{font-family:var(--font-mono);font-size:var(--step-meta);text-transform:uppercase;letter-spacing:var(--track-mid);border:1px solid var(--hairline-strong);border-radius:var(--radius-pill);padding:2px calc(var(--grid)*1);cursor:help;}
.b-phase,.b-cycle{font-family:var(--font-mono);font-size:var(--step-meta);color:var(--meta);}
.b-phase b{color:var(--prose);font-variant-numeric:var(--numeric);}
.b-phase em{font-style:normal;color:var(--faint);cursor:help;}
.b-cycle{margin-left:auto;color:var(--faint);overflow-wrap:anywhere;}
.b-burn{margin-top:calc(var(--grid)*1.5);}
.b-burn-figs{display:flex;align-items:baseline;gap:calc(var(--grid)*2);flex-wrap:wrap;}
.b-fig{display:inline-flex;align-items:baseline;gap:var(--grid-in);font-family:var(--font-mono);font-size:var(--step-data);}
.b-fig em{font-style:normal;font-size:var(--step-micro);text-transform:uppercase;letter-spacing:var(--track-mid);color:var(--faint);}
.b-fig b{color:var(--prose);font-variant-numeric:var(--numeric);}
.b-fig b[data-missing="yes"]{color:var(--faint);font-weight:500;font-size:var(--step-meta);letter-spacing:var(--track-tight);}
.b-line-label{margin-left:auto;font-family:var(--font-mono);font-size:var(--step-meta);text-transform:uppercase;letter-spacing:var(--track-mid);color:var(--meta);}
/* Past the line: heavier ink and a rule under it. NOT a hue -- a fifth meaning gets a
   label, and a label survives a reader who cannot see colour at all. */
.b-past{color:var(--prose);font-weight:600;border-bottom:2px solid var(--prose);padding-bottom:1px;}
.b-at{color:var(--prose);}
.b-track{position:relative;height:8px;border-radius:var(--radius-pill);background:var(--hairline);margin:var(--grid) 0;overflow:hidden;}
.b-track-void{background:repeating-linear-gradient(90deg,var(--hairline) 0 3px,transparent 3px 7px);}
.b-fill{position:absolute;left:0;top:0;bottom:0;width:var(--fill);background:var(--accent-line);border-right:1px solid var(--accent);}
.b-over{position:absolute;top:0;bottom:0;left:var(--line);width:var(--over);background:repeating-linear-gradient(90deg,var(--prose) 0 2px,transparent 2px 5px);}
.b-killline{position:absolute;top:-3px;bottom:-3px;left:var(--line);width:1px;background:var(--prose);}
.b-burn-say{font-size:var(--step-body);line-height:1.55;font-weight:300;color:var(--meta);margin:var(--grid-in) 0 0;max-width:88ch;}
.b-burn-clamp{color:var(--prose);}
.b-note{font-family:var(--font-mono);font-size:var(--step-meta);line-height:1.6;color:var(--faint);margin:var(--grid) 0 0;overflow-wrap:anywhere;}
.b-blocked{margin-top:var(--grid);}
.b-blocked summary{font-family:var(--font-mono);font-size:var(--step-meta);text-transform:uppercase;letter-spacing:var(--track-mid);color:var(--accent-dim);cursor:pointer;list-style:none;display:flex;gap:var(--grid);align-items:baseline;flex-wrap:wrap;}
.b-blocked summary::-webkit-details-marker{display:none;}
.b-blocked summary:hover{color:var(--accent);}
.b-blocked summary span{text-transform:none;letter-spacing:0;color:var(--meta);font-family:var(--font-display);font-size:var(--step-body);font-weight:300;}
.b-blocked p{font-size:var(--step-body);line-height:1.6;font-weight:300;color:var(--prose);margin:var(--grid) 0 0;max-width:92ch;overflow-wrap:anywhere;}
.b-depends,.b-unread-keys{font-family:var(--font-mono);font-size:var(--step-meta);line-height:1.6;color:var(--meta);margin:var(--grid) 0 0;overflow-wrap:anywhere;}
.b-unread-keys{color:var(--faint);}
.b-key{text-transform:uppercase;letter-spacing:var(--track-mid);color:var(--faint);font-size:var(--step-micro);}
.b-refusal{border:1px solid var(--hairline-strong);border-left:2px solid var(--accent);border-radius:var(--radius-chip);padding:calc(var(--grid)*2);}
.b-refusal p{margin:var(--grid) 0 0;font-size:var(--step-body);line-height:1.5;color:var(--prose);font-weight:300;}
.b-refusal-what{color:var(--meta) !important;font-size:var(--step-meta) !important;}
.b-codeword{font-family:var(--font-mono);font-size:var(--step-meta);letter-spacing:var(--track-tight);color:var(--accent);}
.b-foot{display:flex;justify-content:space-between;gap:var(--grid);flex-wrap:wrap;font-family:var(--font-mono);font-size:var(--step-meta);color:var(--faint);padding-top:var(--grid);border-top:1px solid var(--hairline);}
.b-foot-nums{color:var(--meta);}
@media (max-width:640px){.b-room{padding:calc(var(--grid)*2) var(--grid) calc(var(--grid)*4);}.b-chrome{margin-left:0;}.b-cycle{margin-left:0;}.b-line-label{margin-left:0;}}
`;

export default BoardRoom;
