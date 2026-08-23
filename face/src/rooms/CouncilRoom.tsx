// CouncilRoom -- "Twelve seats. No rubber stamps."
//
// The owner opening this room is not asking what the council decided. He is asking why a
// conclusion assembled out of language models is worth anything at all. So the METHOD is the
// page: evidence before argument, a blind parallel debate, a cross-examiner grading every
// single point, one bounded rebuttal, and then a verdict that commits WITH its dissent
// printed beside it. The past sessions come second, because until you believe the method the
// verdicts are just opinions with timestamps.
//
// THIS ROOM CANNOT ACT. It holds a handle carrying two read routes and no write, and it says
// so at the foot of the page with a number it computed rather than a promise it made.
//
// COLOUR: a council verdict is REAL. tokens.css collision 2 is exactly this room -- the
// owner's reference rendered the council family in --violet, which is reserved for the
// non-real family, and colouring a real verdict violet says the opposite of the truth. It
// renders --kind-council (which is --accent-dim), and a MISS is not an incident so it is not
// --red either: a council that was wrong and says so is the product working.
//
// No logic lives in this file. It is in ../lib/ask.mjs, where node can run it with no install.

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Door } from "../lib/door.mjs";
import {
  COUNCIL_GRANTS, COUNCIL_KINDS, COUNCIL_STAGES, GRADES,
  councilSeats, noHandsAudit, readCouncil, readOnly, readRegistryRoom,
  refusalOf, roomOpening, segments,
} from "../lib/ask.mjs";
import type { CouncilSession, CouncilState, Seat } from "../lib/ask.mjs";
import { displayValue } from "../lib/rooms.mjs";

/* -------------------------------------------------------------------------- */

export type CouncilRoomProps = {
  /** The L2 client. This room is handed a read-only facade of it and never the client itself. */
  door: Door;
  /**
   * The registry's own entry, when the shell has one. Typed structurally rather than as
   * `Room` so the two files need not move together. When it is absent the room reads its own
   * entry from `/api/rooms` — the seats come from the contract either way, never from a
   * constant in this file.
   */
  room?: { sentence?: string; lede?: string; holds?: { agents?: string[] } };
  sentence?: string;
  lede?: string;
  /** The door's data mode. "sim" means every count below is fixture data. */
  mode?: string;
};

type Panel<T> = { phase: "loading" } | { phase: "ok"; data: T } | { phase: "error"; code: string; human: string };

/* -------------------------------------------------------------------------- */

export function CouncilRoom({ door, room, sentence, lede, mode }: CouncilRoomProps) {
  // The facade, not the door. `readOnly` refuses to hand over a write-capable method at all,
  // so this room could not stamp anything even if a later edit asked it to.
  const handle = useMemo(() => readOnly(door, COUNCIL_GRANTS), [door]);
  const hands = useMemo(() => noHandsAudit(handle), [handle]);

  const [state, setState] = useState<Panel<CouncilState>>({ phase: "loading" });
  const [registry, setRegistry] = useState<{ sentence?: string; lede?: string; holds?: { agents?: string[] } } | null>(null);
  const [registryRefusal, setRegistryRefusal] = useState<{ code: string; human: string } | null>(null);

  // Two effects with PRIMITIVE dependencies, not one keyed on the `room` object. A parent that
  // builds its props inline hands a new object identity on every render, and an effect that
  // depends on it re-reads the door on every render — a panel-level fetch loop, which is
  // exactly the "panel-level caches" rabbit hole read from the other end.
  const seatsFromProp = Boolean(room?.holds?.agents?.length);

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      try {
        const data = await readCouncil(handle, ac.signal);
        if (!ac.signal.aborted) setState({ phase: "ok", data });
      } catch (err) {
        if (!ac.signal.aborted) setState({ phase: "error", ...refusalOf(err) });
      }
    })();
    return () => ac.abort();
  }, [handle]);

  useEffect(() => {
    // Only when the shell did not hand one over. The seats are the contract's, and this is how
    // the room reads the contract without keeping a copy of it.
    if (seatsFromProp) return undefined;
    const ac = new AbortController();
    void (async () => {
      const found = await readRegistryRoom(handle, "council-chamber", ac.signal);
      if (ac.signal.aborted) return;
      if (found.ok) setRegistry(found.room);
      else setRegistryRefusal({ code: found.code, human: found.human });
    })();
    return () => ac.abort();
  }, [handle, seatsFromProp]);

  const opening = roomOpening("council-chamber", room ?? registry ?? undefined, { sentence, lede });
  const roster = useMemo(() => councilSeats(seatsFromProp ? room : registry), [seatsFromProp, room, registry]);

  return (
    <div className="cc-room">
      <style>{CSS}</style>

      <header className="cc-head">
        <div className="cc-eyebrow">
          <span>factory · council-chamber</span>
          <span className="cc-rule" aria-hidden="true" />
          {mode === "sim" ? <span className="cc-sim" title="fixture data: every count on this page comes from the fixture spine named on the door's command line">SIMULATED</span> : null}
        </div>
        <h1 className="cc-sentence">{opening.sentence}</h1>
        <p className="cc-lede">{opening.lede}</p>
      </header>

      {/* ── the method, which is the room ───────────────────────────────── */}
      <section className="cc-panel" aria-labelledby="cc-method">
        <div className="cc-panel-head">
          <h2 className="cc-panel-title" id="cc-method">How a verdict is earned</h2>
          <span className="cc-panel-hint">{COUNCIL_STAGES.length} stages · fixed order · no step is optional on a deep run</span>
        </div>
        <p className="cc-panel-note">
          A rubber stamp is what you get when the members see each other, when nobody grades the
          evidence, and when the losing argument is thrown away instead of printed. Every stage
          below exists to remove one of those.
        </p>
        <ol className="cc-stages">
          {COUNCIL_STAGES.map((stage) => (
            <li key={stage.key} className="cc-stage">
              <span className="cc-stage-n" aria-hidden="true">{stage.n}</span>
              <div className="cc-stage-body">
                <h3 className="cc-stage-title">{stage.title}</h3>
                <p className="cc-stage-line"><Prose text={stage.line} /></p>
                <p className="cc-stage-guard"><span className="cc-guard-tag">why</span> {stage.guard}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ── the grading vocabulary ──────────────────────────────────────── */}
      <section className="cc-panel" aria-labelledby="cc-grades">
        <div className="cc-panel-head">
          <h2 className="cc-panel-title" id="cc-grades">What a grade costs a point</h2>
          <span className="cc-panel-hint">the verifier rates the EVIDENCE, never the conclusion</span>
        </div>
        <p className="cc-panel-note">
          These four words are the mechanism, not a mood. <em>Weak</em> is not a hedge — it is a
          deletion, and a reader who takes it for a hedge reads the whole verdict wrong.
        </p>
        <dl className="cc-grades">
          {GRADES.map((g) => (
            <div key={g.grade} className="cc-grade">
              <dt className="cc-grade-name">{g.grade}</dt>
              <dd className="cc-grade-body">
                <span className="cc-grade-means">{g.means}</span>
                <span className="cc-grade-fate">{g.fate}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── the twelve seats ────────────────────────────────────────────── */}
      <section className="cc-panel" aria-labelledby="cc-seats">
        <div className="cc-panel-head">
          <h2 className="cc-panel-title" id="cc-seats">The seats</h2>
          <span className="cc-panel-hint">
            {displayValue(roster.counted).text} homed in this room by the contract
            {roster.counted === roster.expected ? "" : ` · this shell names ${displayValue(roster.expected).text}`}
          </span>
        </div>
        {roster.counted === 0 ? (
          <div className="cc-absence">
            <p className="cc-absence-label">SEATS NOT READ</p>
            <p className="cc-absence-note">
              The contract's agent list for this room has not reached this page, so no seat map is
              drawn. Twelve chairs are not painted in from a constant in the renderer — a seat list
              this room kept for itself would go on showing a chair for an agent that had been
              renamed away.
              {registryRefusal ? <> The registry read refused: <code>{registryRefusal.code}</code> — {registryRefusal.human}</> : null}
            </p>
          </div>
        ) : (
          <>
            <p className="cc-panel-note">
              Five are convened on every run. The other seven are the domain roster and the Chair
              fills only the ones the question actually touches, ceiling four — a panel of twelve
              always full would be a picture of a council that does not exist.
            </p>
            <ul className="cc-seats">
              {roster.seats.map((seat) => <SeatCard key={seat.agent} seat={seat} />)}
            </ul>
            {roster.retired.length ? (
              <p className="cc-note-warn">
                {displayValue(roster.retired.length).text} seat{roster.retired.length === 1 ? "" : "s"} this
                shell names {roster.retired.length === 1 ? "is" : "are"} no longer homed here by the
                contract: <code>{roster.retired.join(", ")}</code>. Said out loud rather than quietly
                dropped — a chair that vanished between two spellings of a list is how a panel shrinks
                without anyone deciding it should.
              </p>
            ) : null}
          </>
        )}
      </section>

      {/* ── sessions and calibration, from the log ──────────────────────── */}
      {state.phase === "loading" ? (
        <section className="cc-panel"><p className="cc-waiting">reading the council's receipts from the door…</p></section>
      ) : null}

      {state.phase === "error" ? (
        <section className="cc-panel cc-refusal" role="status">
          <div className="cc-panel-head">
            <h2 className="cc-panel-title">could not read the council's receipts</h2>
            <span className="cc-code">{state.code}</span>
          </div>
          <p className="cc-refusal-line">{state.human}</p>
          <p className="cc-panel-note">
            No session list is shown and none has been invented. The method above is read from the
            contract and stands; everything below it is the log's to say.
          </p>
        </section>
      ) : null}

      {state.phase === "ok" ? <Sessions state={state.data} /> : null}
      {state.phase === "ok" ? <Calibration state={state.data} /> : null}
      {state.phase === "ok" ? <Kinds state={state.data} /> : null}

      {/* ── the boundary, computed ──────────────────────────────────────── */}
      <footer className={hands.clean ? "cc-hands" : "cc-hands cc-hands-broken"}>
        <span className="cc-hands-label">{hands.clean ? "NO HANDS" : "BOUNDARY BROKEN"}</span>
        <span className="cc-hands-line">{hands.line}</span>
      </footer>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function SeatCard({ seat }: { seat: Seat }) {
  return (
    <li className={seat.standing ? "cc-seat cc-seat-standing" : "cc-seat"}>
      <div className="cc-seat-top">
        <span className="cc-seat-name">{seat.seat}</span>
        {seat.prefix ? <span className="cc-seat-prefix" title="the prefix every point this seat makes is labelled with">{seat.prefix}1…</span> : null}
      </div>
      <code className="cc-seat-agent">{seat.agent}</code>
      <span className="cc-seat-when">{seat.when}</span>
      {seat.mapped ? null : <span className="cc-seat-unmapped">UNMAPPED — drawn anyway rather than dropped</span>}
    </li>
  );
}

function Sessions({ state }: { state: CouncilState }) {
  const { sessions } = state;
  return (
    <section className="cc-panel" aria-labelledby="cc-sessions">
      <div className="cc-panel-head">
        <h2 className="cc-panel-title" id="cc-sessions">Past sessions, and what happened next</h2>
        <span className="cc-panel-hint">
          {displayValue(sessions.length).text} session{sessions.length === 1 ? "" : "s"} on the spine
          {state.page.ok && state.page.more ? " · more receipts exist than this page carries" : ""}
        </span>
      </div>

      {sessions.length === 0 ? (
        <div className="cc-absence">
          <p className="cc-absence-label">NEVER CONVENED ON THE RECORD</p>
          <p className="cc-absence-note">
            Not zero sessions — <em>no receipts at all</em>. <code>council.verdict</code> and{" "}
            <code>council.outcome</code> are built and fixture-proven and neither has fired here. The
            council has run; what it has not yet done is leave a receipt behind, and there is no
            backfill: only calls emitted from wiring-time forward count, because backfilling the
            Markdown sessions would invent a record of sessions nobody scored.
          </p>
        </div>
      ) : (
        <ol className="cc-sessions">
          {sessions.map((s) => <SessionRow key={s.sessionId} session={s} />)}
        </ol>
      )}

      <p className="cc-panel-note cc-panel-foot">
        The QUESTION is not on this page and cannot be: <code>council.verdict</code>'s payload is
        closed to <code>session_id</code>, <code>question_hash</code>, <code>call</code> and{" "}
        <code>confidence</code>. What was asked lives in the session file; the spine carries only its
        hash. A room that printed a question here would be reading it from somewhere the receipt
        does not go.
      </p>
    </section>
  );
}

function SessionRow({ session }: { session: CouncilSession }) {
  const s = session;
  return (
    <li className={`cc-session cc-standing-${s.standing}`}>
      <div className="cc-session-top">
        <code className="cc-session-id">{s.sessionId}</code>
        <span className="cc-session-standing">{s.standing.toUpperCase()}</span>
        {s.verdictDay ? <span className="cc-session-day">{s.verdictDay}</span> : null}
      </div>
      <div className="cc-session-call">
        <span className="cc-call">{s.call ?? "MISSING"}</span>
        <span className="cc-session-sep" aria-hidden="true">·</span>
        <span className="cc-conf">
          {s.confidence ?? "MISSING"}
          {s.claimedProb === null ? null : <span className="cc-conf-prob"> claims {Math.round(s.claimedProb * 100)}%</span>}
        </span>
        {s.outcome ? (
          <>
            <span className="cc-session-sep" aria-hidden="true">→</span>
            <span className="cc-outcome">{s.outcome}{s.observedAt ? ` on ${s.observedAt}` : ""}</span>
          </>
        ) : null}
      </div>
      <p className="cc-session-read">{s.reading}</p>
      <div className="cc-session-receipts">
        {s.verdictId ? <Receipt title="the council.verdict receipt this row is drawn from">{s.verdictId}</Receipt> : null}
        {s.outcomeId ? <Receipt title="the council.outcome receipt this row is drawn from">{s.outcomeId}</Receipt> : null}
        {s.questionHash ? <span className="cc-hash" title="sha256 of the decision statement — the question itself is not on the spine">q {s.questionHash.slice(0, 12)}…</span> : null}
      </div>
    </li>
  );
}

function Calibration({ state }: { state: CouncilState }) {
  const c = state.calibration;
  const scored = c.brier !== null;
  return (
    <section className="cc-panel" aria-labelledby="cc-cal">
      <div className="cc-panel-head">
        <h2 className="cc-panel-title" id="cc-cal">Juror calibration</h2>
        <span className="cc-panel-hint">is the council's confidence worth anything?</span>
      </div>
      <p className="cc-panel-note">
        A council that says <em>High confidence</em> and is right 55 % of the time is not a council
        with a good record. It is a council whose confidence label means nothing. That is measurable,
        and it is measured from receipts rather than from what a session file claimed.
      </p>

      <div className={scored ? "cc-brier" : "cc-brier cc-brier-pending"}>
        <span className="cc-brier-value">{scored && c.brier !== null ? c.brier.toFixed(4) : c.verdict}</span>
        <span className="cc-brier-line">{c.line}</span>
      </div>

      <dl className="cc-tally">
        <div className="cc-tally-cell">
          <dt>scored</dt><dd>{displayValue(c.scored).text}</dd>
        </div>
        <div className="cc-tally-cell">
          <dt>pending</dt><dd>{displayValue(c.pending).text}</dd>
        </div>
        <div className="cc-tally-cell">
          <dt>excluded</dt><dd>{displayValue(c.excluded).text}</dd>
        </div>
        <div className="cc-tally-cell">
          <dt>floor</dt><dd>{displayValue(c.floor).text}</dd>
        </div>
      </dl>

      <table className="cc-buckets">
        <caption className="cc-buckets-cap">
          each word against the probability ADR-0009 says it claims
        </caption>
        <thead>
          <tr><th scope="col">confidence</th><th scope="col">claims</th><th scope="col">scored</th><th scope="col">hits</th><th scope="col">actual</th></tr>
        </thead>
        <tbody>
          {c.buckets.map((b) => (
            <tr key={b.bucket}>
              <th scope="row">{b.bucket}</th>
              <td>{Math.round(b.prob * 100)}%</td>
              <td>{displayValue(b.n).text}</td>
              <td>{displayValue(b.hits).text}</td>
              <td className={b.hitRate === null ? "cc-missing" : ""}>
                {b.hitRate === null ? "NOTHING TO RATE" : `${Math.round(b.hitRate * 100)}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="cc-panel-note cc-panel-foot">
        Two rules hold this number honest. <code>unresolved</code> is <em>excluded</em>, never scored
        as a miss — a session nobody followed up on is not a session the council got wrong, and
        scoring it zero would manufacture a calibration figure out of an absence. And below the floor
        there is no figure at all: {displayValue(c.scored).text} scored session
        {c.scored === 1 ? "" : "s"} would yield a Brier score to four decimal places, and it would
        mean nothing.
      </p>
    </section>
  );
}

function Kinds({ state }: { state: CouncilState }) {
  return (
    <section className="cc-panel" aria-labelledby="cc-kinds">
      <div className="cc-panel-head">
        <h2 className="cc-panel-title" id="cc-kinds">What this room records</h2>
        <span className="cc-panel-hint">{COUNCIL_KINDS.length} kinds homed here by the contract</span>
      </div>
      <ul className="cc-kinds">
        {state.kindRows.map((row) => (
          <li key={row.kind} className={row.state === "live" ? "cc-kind cc-kind-live" : "cc-kind"}>
            <code className="cc-kind-name">{row.kind}</code>
            <span className="cc-kind-count">{row.state === "live" ? displayValue(row.count).text : "—"}</span>
            <span className="cc-kind-note">{row.note}</span>
          </li>
        ))}
      </ul>
      <p className="cc-panel-note cc-panel-foot">
        <code>decision.recorded</code> is homed here and is <em>not</em> the council's act: it is the
        owner's stamp, made in the Inbox, in his own words. The chamber counts it and never renders
        it as though a panel had decided anything.
      </p>
    </section>
  );
}

/** A receipt chip — the signature element. Every claim on a page names where it came from. */
function Receipt({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span className="cc-receipt" title={title}>
      <span aria-hidden="true" className="cc-receipt-mark">&#8983;</span>
      {children}
    </span>
  );
}

/**
 * Prose with the machine's own vocabulary in mono. The two faces carry a meaning rather than a
 * style: display is what a human wrote, mono is what the log wrote. The split is decided by
 * `segments` in ../lib/ask.mjs; this only draws it, and it draws TEXT — never HTML.
 */
function Prose({ text }: { text: string }) {
  return (
    <>
      {segments(text).map((seg, i) => {
        if (seg.type === "code") return <code key={i} className="cc-code-span">{seg.text}</code>;
        if (seg.type === "em") return <em key={i}>{seg.text}</em>;
        return <span key={i}>{seg.text}</span>;
      })}
    </>
  );
}

export default CouncilRoom;

/* -------------------------------------------------------------------------- *
 * Styles. Injected rather than imported: `face/` carries no CSS framework and
 * no ambient declaration for a stylesheet import, so a `.css` import would not
 * type-check (kit.tsx, LIMITS). Every colour is a var() from tokens.css and
 * there is not one literal hex here — a second spelling of a colour is how a
 * reserved meaning rots.
 *
 * The reserved four: --amber, --green and --red appear NOWHERE in this file.
 * Nothing this room draws is a request for the owner's attention, a rupee, or
 * an incident, and a council MISS is none of the three. --violet appears only
 * as the SIMULATED marker, always with --sim-hatch, which is the one thing it
 * is for. Everything else is --accent / --kind-council, which carries no
 * meaning at all — which is exactly why the four survive intact.
 * -------------------------------------------------------------------------- */

const CSS = `
.cc-room{font-family:var(--font-display);color:var(--prose);padding:calc(var(--grid)*3) calc(var(--grid)*3) calc(var(--grid)*8);max-width:1080px;margin:0 auto;display:flex;flex-direction:column;gap:calc(var(--grid)*3);}

.cc-head{margin-bottom:var(--grid);}
.cc-eyebrow{display:flex;align-items:center;gap:calc(var(--grid)*1.5);font-family:var(--font-mono);font-size:var(--step-meta);text-transform:uppercase;letter-spacing:var(--track-wide);color:var(--accent-dim);margin-bottom:calc(var(--grid)*2);}
.cc-rule{height:1px;flex:1 1 40px;max-width:160px;background:var(--accent-line);}
.cc-sim{font-family:var(--font-mono);font-size:var(--step-micro);letter-spacing:var(--track-tight);color:var(--sim-fg);border:1px solid var(--sim-line);border-radius:var(--radius-pill);padding:4px 10px;background-image:var(--sim-hatch);}
.cc-sentence{font-size:clamp(28px,4vw,var(--step-room));line-height:1.04;letter-spacing:-0.02em;font-weight:600;margin:0 0 calc(var(--grid)*1.5) 0;max-width:18ch;}
.cc-lede{font-size:var(--step-lede);font-weight:300;line-height:1.6;color:var(--meta);margin:0;max-width:66ch;}

.cc-panel{position:relative;background:var(--panel);backdrop-filter:blur(var(--panel-blur));-webkit-backdrop-filter:blur(var(--panel-blur));border:1px solid var(--panel-border);border-radius:var(--radius-panel);padding:var(--pad-panel);min-width:0;}
.cc-panel-head{display:flex;align-items:baseline;justify-content:space-between;gap:var(--grid);flex-wrap:wrap;margin-bottom:calc(var(--grid)*1.5);}
.cc-panel-title{font-family:var(--font-mono);font-size:var(--step-meta);text-transform:uppercase;letter-spacing:var(--track-wide);color:var(--accent);margin:0;font-weight:400;}
.cc-panel-hint{font-family:var(--font-mono);font-size:var(--step-micro);color:var(--faint);overflow-wrap:anywhere;}
.cc-panel-note{font-size:var(--step-body);font-weight:300;line-height:1.65;color:var(--meta);margin:0 0 calc(var(--grid)*2) 0;max-width:74ch;}
.cc-panel-foot{margin:calc(var(--grid)*2) 0 0 0;padding-top:calc(var(--grid)*2);border-top:1px solid var(--hairline);}
.cc-panel-note code,.cc-absence-note code,.cc-note-warn code{font-family:var(--font-mono);font-size:var(--step-data);color:var(--prose);}
.cc-waiting{font-family:var(--font-mono);font-size:var(--step-data);color:var(--meta);margin:0;}
.cc-code-span{font-family:var(--font-mono);font-size:var(--step-data);color:var(--prose);}

.cc-stages{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;}
.cc-stage{display:flex;gap:calc(var(--grid)*2);padding:calc(var(--grid)*2) 0;border-top:1px solid var(--hairline);}
.cc-stage:first-child{border-top:0;padding-top:0;}
.cc-stage-n{flex:0 0 auto;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--accent-line);border-radius:var(--radius-pill);font-family:var(--font-mono);font-size:var(--step-meta);font-variant-numeric:var(--numeric);color:var(--accent);}
.cc-stage-body{min-width:0;}
.cc-stage-title{font-size:var(--step-lede);font-weight:500;line-height:1.3;margin:2px 0 var(--grid) 0;color:var(--prose);}
.cc-stage-line{font-size:var(--step-body);font-weight:300;line-height:1.65;color:var(--meta);margin:0 0 var(--grid) 0;max-width:76ch;}
.cc-stage-guard{font-family:var(--font-mono);font-size:var(--step-meta);line-height:1.6;color:var(--faint);margin:0;max-width:76ch;}
.cc-guard-tag{text-transform:uppercase;letter-spacing:var(--track-mid);color:var(--accent-dim);margin-right:var(--grid);}

.cc-grades{margin:0;display:grid;gap:var(--grid);grid-template-columns:repeat(auto-fit,minmax(230px,1fr));}
.cc-grade{border:1px solid var(--hairline-strong);border-radius:var(--radius-chip);padding:calc(var(--grid)*1.5);min-width:0;}
.cc-grade-name{font-family:var(--font-mono);font-size:var(--step-data);text-transform:uppercase;letter-spacing:var(--track-tight);color:var(--accent);margin-bottom:var(--grid);}
.cc-grade-body{margin:0;display:flex;flex-direction:column;gap:var(--grid-in);}
.cc-grade-means{font-size:var(--step-body);font-weight:300;line-height:1.5;color:var(--prose);}
.cc-grade-fate{font-family:var(--font-mono);font-size:var(--step-meta);line-height:1.55;color:var(--faint);}

.cc-seats{list-style:none;margin:0;padding:0;display:grid;gap:var(--grid);grid-template-columns:repeat(auto-fit,minmax(220px,1fr));}
.cc-seat{display:flex;flex-direction:column;gap:var(--grid-in);border:1px solid var(--hairline);border-radius:var(--radius-chip);padding:calc(var(--grid)*1.5);min-width:0;min-height:var(--row-h-live);}
.cc-seat-standing{border-color:var(--accent-line);}
.cc-seat-top{display:flex;align-items:baseline;justify-content:space-between;gap:var(--grid);}
.cc-seat-name{font-size:var(--step-body);font-weight:500;color:var(--prose);}
.cc-seat-prefix{font-family:var(--font-mono);font-size:var(--step-micro);color:var(--accent-dim);border:1px solid var(--accent-line);border-radius:var(--radius-pill);padding:2px 7px;white-space:nowrap;}
.cc-seat-agent{font-family:var(--font-mono);font-size:var(--step-meta);color:var(--meta);overflow-wrap:anywhere;}
.cc-seat-when{font-family:var(--font-mono);font-size:var(--step-micro);line-height:1.5;color:var(--faint);}
.cc-seat-unmapped{font-family:var(--font-mono);font-size:var(--step-micro);letter-spacing:var(--track-tight);color:var(--prose);border-top:1px solid var(--hairline-strong);padding-top:var(--grid-in);margin-top:var(--grid-in);}

.cc-absence{border:1px solid var(--hairline-strong);border-left:3px solid var(--accent-line);border-radius:var(--radius-chip);padding:calc(var(--grid)*2);}
.cc-absence-label{font-family:var(--font-mono);font-size:var(--step-data);text-transform:uppercase;letter-spacing:var(--track-mid);color:var(--prose);margin:0 0 var(--grid) 0;}
.cc-absence-note{font-size:var(--step-body);font-weight:300;line-height:1.65;color:var(--meta);margin:0;max-width:74ch;}
.cc-note-warn{font-family:var(--font-mono);font-size:var(--step-meta);line-height:1.6;color:var(--prose);margin:calc(var(--grid)*2) 0 0 0;padding:var(--grid) calc(var(--grid)*1.5);border:1px solid var(--hairline-strong);border-radius:var(--radius-chip);max-width:80ch;}

.cc-refusal{border-left:3px solid var(--hairline-strong);}
.cc-refusal-line{font-size:var(--step-body);font-weight:300;line-height:1.6;color:var(--prose);margin:0 0 var(--grid) 0;max-width:70ch;}
.cc-code{font-family:var(--font-mono);font-size:var(--step-meta);color:var(--prose);border:1px solid var(--hairline-strong);border-radius:var(--radius-chip);padding:3px 9px;}

.cc-sessions{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:var(--grid);}
.cc-session{border:1px solid var(--hairline);border-left:3px solid var(--hairline-strong);border-radius:var(--radius-chip);padding:calc(var(--grid)*1.5) calc(var(--grid)*2);min-width:0;}
.cc-standing-hit{border-left-color:var(--accent);}
.cc-standing-miss{border-left-color:var(--prose);}
.cc-session-top{display:flex;align-items:center;gap:var(--grid);flex-wrap:wrap;margin-bottom:var(--grid-in);}
.cc-session-id{font-family:var(--font-mono);font-size:var(--step-data);color:var(--prose);}
.cc-session-standing{font-family:var(--font-mono);font-size:var(--step-micro);text-transform:uppercase;letter-spacing:var(--track-mid);color:var(--accent-dim);}
.cc-standing-miss .cc-session-standing{color:var(--prose);}
.cc-standing-pending .cc-session-standing,.cc-standing-excluded .cc-session-standing,.cc-standing-orphan .cc-session-standing{color:var(--faint);}
.cc-session-day{font-family:var(--font-mono);font-size:var(--step-micro);color:var(--faint);margin-left:auto;}
.cc-session-call{display:flex;align-items:baseline;gap:var(--grid);flex-wrap:wrap;font-family:var(--font-mono);font-size:var(--step-data);color:var(--prose);margin-bottom:var(--grid-in);}
.cc-call{color:var(--accent);}
.cc-conf-prob,.cc-session-sep{color:var(--faint);}
.cc-outcome{color:var(--meta);}
.cc-session-read{font-size:var(--step-body);font-weight:300;line-height:1.6;color:var(--meta);margin:var(--grid-in) 0 var(--grid) 0;max-width:76ch;}
.cc-session-receipts{display:flex;flex-wrap:wrap;gap:var(--grid-in);}
.cc-hash{font-family:var(--font-mono);font-size:var(--step-micro);color:var(--faint);align-self:center;}

.cc-receipt{display:inline-flex;align-items:center;gap:6px;font-family:var(--font-mono);font-size:var(--step-meta);color:var(--accent);border:1px solid var(--accent-line);border-radius:var(--radius-chip);background:var(--panel);padding:3px 8px;overflow-wrap:anywhere;}
.cc-receipt-mark{opacity:0.85;}

.cc-brier{display:flex;align-items:baseline;gap:calc(var(--grid)*2);flex-wrap:wrap;border:1px solid var(--accent-line);border-radius:var(--radius-chip);padding:calc(var(--grid)*2);margin-bottom:calc(var(--grid)*2);}
.cc-brier-pending{border-color:var(--hairline-strong);}
.cc-brier-value{font-family:var(--font-mono);font-size:var(--step-stat);font-variant-numeric:var(--numeric);line-height:1;color:var(--accent);}
.cc-brier-pending .cc-brier-value{font-size:var(--step-lede);color:var(--faint);text-transform:uppercase;letter-spacing:var(--track-mid);}
.cc-brier-line{font-size:var(--step-body);font-weight:300;line-height:1.6;color:var(--meta);flex:1 1 320px;min-width:0;}

.cc-tally{display:grid;gap:var(--grid);grid-template-columns:repeat(auto-fit,minmax(110px,1fr));margin:0 0 calc(var(--grid)*2) 0;}
.cc-tally-cell dt{font-family:var(--font-mono);font-size:var(--step-micro);text-transform:uppercase;letter-spacing:var(--track-mid);color:var(--faint);margin-bottom:3px;}
.cc-tally-cell dd{font-family:var(--font-mono);font-size:var(--step-data);font-variant-numeric:var(--numeric);color:var(--prose);margin:0;}

.cc-buckets{width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:var(--step-data);font-variant-numeric:var(--numeric);}
.cc-buckets-cap{caption-side:top;text-align:left;font-size:var(--step-micro);color:var(--faint);padding-bottom:var(--grid);}
.cc-buckets th,.cc-buckets td{text-align:left;padding:var(--grid-in) var(--grid);border-bottom:1px solid var(--hairline);}
.cc-buckets thead th{font-size:var(--step-micro);text-transform:uppercase;letter-spacing:var(--track-mid);color:var(--faint);font-weight:400;}
.cc-buckets tbody th{color:var(--prose);font-weight:400;}
.cc-buckets td{color:var(--meta);}
.cc-missing{color:var(--faint);font-size:var(--step-micro);letter-spacing:var(--track-tight);}

.cc-kinds{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;}
.cc-kind{display:flex;align-items:baseline;gap:var(--grid);flex-wrap:wrap;padding:var(--grid) 0;border-bottom:1px solid var(--hairline);min-height:var(--row-h);}
.cc-kind-name{font-family:var(--font-mono);font-size:var(--step-data);color:var(--meta);flex:0 0 auto;}
.cc-kind-live .cc-kind-name{color:var(--prose);}
.cc-kind-count{font-family:var(--font-mono);font-size:var(--step-data);font-variant-numeric:var(--numeric);color:var(--accent);}
.cc-kind-note{font-family:var(--font-mono);font-size:var(--step-micro);line-height:1.5;color:var(--faint);flex:1 1 260px;min-width:0;}

.cc-hands{display:flex;align-items:center;gap:calc(var(--grid)*1.5);flex-wrap:wrap;border:1px solid var(--hairline-strong);border-radius:var(--radius-chip);padding:var(--grid) calc(var(--grid)*1.5);}
.cc-hands-label{font-family:var(--font-mono);font-size:var(--step-micro);text-transform:uppercase;letter-spacing:var(--track-mid);color:var(--accent-dim);}
.cc-hands-line{font-family:var(--font-mono);font-size:var(--step-meta);line-height:1.6;color:var(--faint);min-width:0;overflow-wrap:anywhere;}
.cc-hands-broken{border-color:var(--prose);background-image:repeating-linear-gradient(135deg,var(--hairline-strong) 0,var(--hairline-strong) 2px,transparent 2px,transparent 10px);}
.cc-hands-broken .cc-hands-label,.cc-hands-broken .cc-hands-line{color:var(--prose);}

@media (max-width:640px){
  .cc-room{padding:calc(var(--grid)*2) var(--grid) calc(var(--grid)*6);}
  .cc-stage{flex-direction:column;gap:var(--grid);}
  .cc-session-day{margin-left:0;}
}
`;
