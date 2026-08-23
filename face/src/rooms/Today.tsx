// Today -- the front page. Read-only, one screen, no route change.
//
// Four reads from the door assemble it: /api/health (the numbers and the door's own
// clock), /api/brief (the day in <=40 lines), /api/inbox (what is waiting), /api/spine
// (the day's receipts, and the window since the owner's mark). Nothing here totals,
// estimates or projects: every figure on this screen is a field one of those four
// returned, and every tile carries the route and field it came from.
//
// There is no logic in this file. Every decision it makes -- which lines collapse, which
// tone a kind may wear, what "since you left" means, what a zero means -- is a call into
// ../lib/inbox.mjs, because CI cannot exercise a branch that lives in a .tsx.

import { useCallback, useEffect, useRef, useState } from "react";
import type { Door } from "../lib/door.mjs";
import {
  roomOpening, MARK_KEY, BRIEF_BUDGET,
  readBrief, readHealth, readInbox, readSpinePage,
  parseBrief, collapseBrief, kpiTiles, sinceYouLeft, refusalOf,
  isUlid, dayOf, timeOfDay, shortId, fmtInt, tail, toneForKind,
} from "../lib/inbox.mjs";
import type { BriefView, HealthView, InboxView, SpinePage, Tone } from "../lib/inbox.mjs";

/* -------------------------------------------------------------------------- */

export type TodayProps = {
  /** The L2 client. The shell owns the token; this room only reads through it. */
  door: Door;
  /**
   * The registry's own entry for this room, when the shell has read /api/rooms. Typed
   * structurally rather than as `Room` so the two files need not move together; its
   * strings arrive escaped, like everything the door serves, and are decoded here.
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

/** How many of the day's receipts the timeline draws. The rest are in the Spine room. */
const FEED_ROWS = 40;
/** The door pages from the start of the log, so ask for a day's worth and take the tail. */
const FEED_LIMIT = 1000;
/** The live reads repeat on this beat. The brief does not: it shells the CLI. */
const POLL_MS = 45_000;

const TONE_INK: Record<Tone, string> = {
  "needs-you": "var(--amber)",
  "real-money": "var(--green)",
  incident: "var(--red)",
  "non-real": "var(--sim-fg)",
  chrome: "var(--accent-dim)",
  quiet: "var(--prose)",
};

/* -------------------------------------------------------------------------- */

export function Today({ door, room, sentence, lede }: TodayProps) {
  const opening = roomOpening("today", room, { sentence, lede });
  const [health, setHealth] = useState<Panel<HealthView>>({ phase: "loading" });
  const [brief, setBrief] = useState<Panel<BriefView>>({ phase: "loading" });
  const [inbox, setInbox] = useState<Panel<InboxView>>({ phase: "loading" });
  const [feed, setFeed] = useState<Panel<SpinePage>>({ phase: "loading" });
  const [since, setSince] = useState<Panel<SpinePage>>({ phase: "loading" });
  // The mark lives in this browser and nowhere else. It is a bookmark, not a receipt: the
  // spine never hears about it, and a browser that has never set one says so rather than
  // pretending the owner has seen everything.
  //
  // Read SYNCHRONOUSLY at first render rather than in an effect. In an effect it would be
  // a race against the first door read that depends on it -- one that happens to be won
  // today only because this effect is declared above that one, and would be lost silently
  // the day somebody reorders them.
  const [mark, setMark] = useState<string | null>(() => {
    try {
      const stored = window.localStorage.getItem(MARK_KEY);
      return isUlid(stored) ? stored : null;
    } catch { return null; /* storage disabled; the strip renders its no-mark state */ }
  });
  const [readAt, setReadAt] = useState<string>("");
  const [briefAt, setBriefAt] = useState<string>("");
  const markRef = useRef<string | null>(mark);

  const read = useCallback(async (signal: AbortSignal, withBrief: boolean) => {
    let day = "";
    try {
      const raw: unknown = await door.health(signal);
      const h = readHealth(raw);
      if (signal.aborted) return;
      day = dayOf(h.now);
      setHealth({ phase: "ok", data: h });
      setReadAt(h.now);
    } catch (err) {
      if (signal.aborted) return;
      setHealth({ phase: "error", ...refusalOf(err) });
    }

    try {
      const raw: unknown = await door.inbox(signal);
      if (!signal.aborted) setInbox({ phase: "ok", data: readInbox(raw) });
    } catch (err) {
      if (!signal.aborted) setInbox({ phase: "error", ...refusalOf(err) });
    }

    // The day the DOOR is in, not the day this browser is in. A machine in another
    // timezone must not ask the company for the wrong day and be told it was quiet.
    if (day !== "") {
      try {
        const raw: unknown = await door.spine({ date: day, limit: FEED_LIMIT }, signal);
        if (!signal.aborted) setFeed({ phase: "ok", data: readSpinePage(raw) });
      } catch (err) {
        if (!signal.aborted) setFeed({ phase: "error", ...refusalOf(err) });
      }
    }

    const m = markRef.current;
    if (isUlid(m)) {
      try {
        const raw: unknown = await door.spine({ since: m, limit: FEED_LIMIT }, signal);
        if (!signal.aborted) setSince({ phase: "ok", data: readSpinePage(raw) });
      } catch (err) {
        if (!signal.aborted) setSince({ phase: "error", ...refusalOf(err) });
      }
    }

    if (!withBrief) return;
    try {
      const raw: unknown = await door.brief(signal);
      if (signal.aborted) return;
      setBrief({ phase: "ok", data: readBrief(raw) });
      setBriefAt(day);
    } catch (err) {
      if (!signal.aborted) setBrief({ phase: "error", ...refusalOf(err) });
    }
  }, [door]);

  useEffect(() => {
    const ac = new AbortController();
    void read(ac.signal, true);
    const timer = window.setInterval(() => { void read(ac.signal, false); }, POLL_MS);
    return () => { window.clearInterval(timer); ac.abort(); };
  }, [read]);

  const reread = useCallback(() => {
    const ac = new AbortController();
    setBrief({ phase: "loading" });
    void read(ac.signal, true);
  }, [read]);

  const setMarkHere = useCallback((cursor: string | null) => {
    if (!isUlid(cursor)) return;
    try { window.localStorage.setItem(MARK_KEY, cursor); } catch { /* storage disabled */ }
    setMark(cursor);
    markRef.current = cursor;
    setSince({ phase: "loading" });
    const ac = new AbortController();
    void read(ac.signal, false);
  }, [read]);

  const clearMark = useCallback(() => {
    try { window.localStorage.removeItem(MARK_KEY); } catch { /* storage disabled */ }
    setMark(null);
    markRef.current = null;
    setSince({ phase: "loading" });
  }, []);

  const healthData = health.phase === "ok" ? health.data : null;
  const inboxData = inbox.phase === "ok" ? inbox.data : null;
  const tiles = kpiTiles({ health: healthData, inbox: inboxData });
  const window_ = since.phase === "ok" ? since.data : null;
  const cursorDiff = sinceYouLeft({ mark, page: window_, open: inboxData?.open ?? [] });

  return (
    <section className="t-room" aria-label="Today">
      <style>{CSS}</style>

      <header className="t-head">
        <ArcMark />
        <div className="t-headtext">
          <h1 className="t-sentence">{opening.sentence}</h1>
          <p className="t-lede">{opening.lede}</p>
        </div>
        <div className="t-chrome">
          <ModeChip mode={healthData?.mode ?? null} />
          <span className="t-clock" title="the door's own clock, in the company's timezone">
            {readAt === "" ? "reading…" : readAt}
          </span>
          <button type="button" className="t-btn" onClick={reread}>re-read the door</button>
        </div>
      </header>

      {/* cursor diff -- since you left */}
      <div className={`t-since${cursorDiff.known ? "" : " t-since-unset"}`}>
        <div className="t-since-body">
          <span className="t-since-label">cursor diff</span>
          <p className="t-since-sentence">
            {since.phase === "error"
              ? <>Your mark could not be measured: <b className="t-code">{since.code}</b> — {since.human}</>
              : cursorDiff.sentence}
          </p>
          {cursorDiff.known && cursorDiff.needsYou !== null && cursorDiff.needsYou > 0 ? (
            <p className="t-since-note">
              {fmtInt(cursorDiff.needsYou)} of them {cursorDiff.needsYou === 1 ? "is" : "are"} an open approval raised after your mark. The Inbox is the only place they can be decided.
            </p>
          ) : null}
        </div>
        <div className="t-since-acts">
          {mark === null ? null : <span className="t-receipt" title={mark}>⌗ {shortId(mark)}</span>}
          <button
            type="button"
            className="t-btn"
            disabled={!isUlid(healthData?.cursor ?? null)}
            onClick={() => setMarkHere(healthData?.cursor ?? null)}
            title="write the spine's newest receipt id into this browser; the next visit counts from there"
          >
            mark read to here
          </button>
          {mark === null ? null : <button type="button" className="t-btn t-btn-quiet" onClick={clearMark}>clear the mark</button>}
        </div>
      </div>

      {/* KPI row. The tiles are drawn whatever happened: a tile whose field the door did
          not serve says so in its own state, which is more honest than a whole row
          replaced by one message -- the counts that DID arrive are still true. */}
      {health.phase === "error"
        ? <Refusal code={health.code} human={health.human} what="the spine's own numbers" />
        : null}
      <div className="t-kpis">
        {tiles.map((t) => (
          <div className="t-tile" key={t.key} data-state={t.state}>
            <div className="t-tile-v" style={{ color: TONE_INK[t.tone] }}>
              {t.state === "never-fired" ? <span className="t-never">never</span> : t.value}
            </div>
            <div className="t-tile-l">{t.label}</div>
            <details className="t-why">
              <summary>Why?</summary>
              <p className="t-why-note">{t.note}</p>
              <p className="t-why-src">{t.why}</p>
            </details>
          </div>
        ))}
      </div>

      <div className="t-split">
        {/* the brief */}
        <div className="t-panel">
          <div className="t-panel-head">
            <span className="t-panel-title">the brief</span>
            <span className="t-panel-hint">
              {brief.phase === "ok"
                ? `${brief.data.asof === null ? "today" : `as of ${brief.data.asof}`} · noise budget ${BRIEF_BUDGET} lines${briefAt === "" ? "" : ` · assembled ${briefAt}`}`
                : `noise budget ${BRIEF_BUDGET} lines`}
            </span>
          </div>
          {brief.phase === "loading" ? <Waiting what="the brief" /> : null}
          {brief.phase === "error" ? <Refusal code={brief.code} human={brief.human} what="the brief" /> : null}
          {brief.phase === "ok" ? <Brief view={brief.data} /> : null}
        </div>

        {/* the live timeline */}
        <div className="t-panel">
          <div className="t-panel-head">
            <span className="t-panel-title">everything the company did</span>
            <span className="t-panel-hint">
              {feed.phase === "ok"
                ? `${feed.data.more ? "the first " : ""}${fmtInt(feed.data.count ?? 0)} receipt${feed.data.count === 1 ? "" : "s"} today · newest last`
                : "today, from the log"}
            </span>
          </div>
          {feed.phase === "loading" ? <Waiting what="today's receipts" /> : null}
          {feed.phase === "error" ? <Refusal code={feed.code} human={feed.human} what="the timeline" /> : null}
          {feed.phase === "ok" ? <Feed page={feed.data} /> : null}
        </div>
      </div>

      <footer className="t-foot">
        <span>read-only room · the one write in this product is a stamp in the Inbox</span>
        {healthData === null ? null : (
          <span className="t-foot-nums">
            {healthData.quarantined === null ? null : <>{fmtInt(healthData.quarantined)} refused and held separately, never counted as receipts</>}
            {healthData.torn !== null && healthData.torn > 0
              ? <> · <b className="t-loud">{fmtInt(healthData.torn)} UNREADABLE line{healthData.torn === 1 ? "" : "s"}</b></>
              : null}
            {inboxData?.decidedCount === null || inboxData === null ? null : <> · {fmtInt(inboxData.decidedCount)} approvals already decided</>}
          </span>
        )}
      </footer>
    </section>
  );
}

/* -------------------------------------------------------------------------- *
 * pieces
 * -------------------------------------------------------------------------- */

/** The mark: the arc ring. Chrome, in the product's own colour, carrying no meaning. */
function ArcMark() {
  return (
    <svg className="t-mark" viewBox="0 0 44 44" aria-hidden="true" focusable="false">
      <circle cx="22" cy="22" r="18" fill="none" stroke="var(--accent-line)" strokeWidth="1" />
      <circle cx="22" cy="22" r="18" fill="none" stroke="var(--accent)" strokeWidth="1.5"
        strokeDasharray="30 83" strokeLinecap="round" transform="rotate(-90 22 22)" />
      <circle cx="22" cy="22" r="4.5" fill="var(--accent)" />
    </svg>
  );
}

function ModeChip({ mode }: { mode: string | null }) {
  if (mode === null) return <span className="t-mode">mode unread</span>;
  const sim = mode === "sim";
  return (
    <span className={`t-mode${sim ? " t-mode-sim" : ""}`} title={sim
      ? "every value on this screen is fixture data from a spine named on the command line — never real"
      : "the canonical spine, read live"}>
      {sim ? "SIMULATED" : mode}
    </span>
  );
}

function Waiting({ what }: { what: string }) {
  // A number never shows a spinner. It says what it is waiting for, and for whom.
  return <p className="t-waiting">reading {what} from the door…</p>;
}

function Refusal({ code, human, what }: { code: string; human: string; what: string }) {
  return (
    <div className="t-refusal" role="status">
      <span className="t-code">{code}</span>
      <p>{human}</p>
      <p className="t-refusal-what">{what} is not on this screen, and nothing has been guessed in its place.</p>
    </div>
  );
}

function Brief({ view }: { view: BriefView }) {
  const display = collapseBrief(parseBrief(view.text), BRIEF_BUDGET);
  if (display.sections.length === 0 && display.notices.length === 0) {
    return (
      <p className="t-quiet-day">
        The brief came back with no groups at all. That is the door's answer, not an empty
        screen standing in for one: {view.source}
      </p>
    );
  }
  return (
    <div className="t-brief">
      {display.day === null ? null : <div className="t-brief-day">brief {display.day}</div>}
      {display.sections.map((s) => (
        <div className="t-group" key={s.name}>
          <div className="t-group-head" style={{ color: s.name === "needs-you" ? "var(--amber)" : "var(--accent-dim)" }}>
            {s.name}
            <span className="t-group-n">{s.count === null ? "" : fmtInt(s.count)}</span>
            {s.collapsible ? null : <span className="t-group-lock" title="needs-you and money never collapse to a count: every line in them is addressed to a person">never collapses</span>}
          </div>
          {s.collapsed
            ? <div className="t-collapsed">{s.summary}</div>
            : s.lines.map((l, i) => (
              <div className={`t-line${l.tone === "non-real" ? " t-nonreal" : ""}`} key={`${s.name}-${i}`} style={{ color: TONE_INK[l.tone] }}>
                {l.text}
              </div>
            ))}
        </div>
      ))}
      {display.notices.map((n) => (
        <div className={`t-notice${n.indexOf("UNREADABLE") === 0 ? " t-loud" : ""}`} key={n}>{n}</div>
      ))}
      <div className="t-brief-foot">
        {display.note === null
          ? `${display.lines} of ${display.budget} lines${display.collapsedHere.length === 0 ? "" : ` · ${display.collapsedHere.join(" and ")} collapsed to a count here`}`
          : display.note}
        <span className="t-brief-src">{view.source}</span>
      </div>
    </div>
  );
}

function Feed({ page }: { page: SpinePage }) {
  const rows = tail(page.events, FEED_ROWS);
  if (rows.length === 0) {
    // Not a sad empty state, and not a zero: the door answered, and its answer is that
    // this day carries no receipts yet.
    return (
      <p className="t-quiet-day">
        No receipt has landed today yet. The log is readable and this day is empty — which
        is a different fact from a day that could not be read.
      </p>
    );
  }
  return (
    <>
      <ol className="t-feed">
        {rows.map((e) => (
          <li className="t-row" key={e.id}>
            <span className="t-row-t">{timeOfDay(e.ts)}</span>
            <span className="t-row-k" style={{ color: TONE_INK[toneForKind(e.kind)] }}>{e.kind}</span>
            <span className="t-row-v">{e.venture}</span>
            {e.outcome === "ok" ? null : <span className="t-row-o">{e.outcome}</span>}
            <span className="t-receipt" title={e.id}>⌗ {shortId(e.id)}</span>
          </li>
        ))}
      </ol>
      {page.events.length > rows.length || page.more ? (
        <p className="t-feed-foot">
          showing the last {fmtInt(rows.length)} of {page.more ? "at least " : ""}
          {fmtInt(page.count ?? rows.length)} today · the whole log is the Spine room
        </p>
      ) : null}
    </>
  );
}

/* -------------------------------------------------------------------------- *
 * style. Every colour is a token; there is no hex in this file.
 * -------------------------------------------------------------------------- */

const CSS = `
.t-room{font-family:var(--font-display);color:var(--prose);padding:calc(var(--grid)*3) calc(var(--grid)*3) calc(var(--grid)*6);max-width:1280px;margin:0 auto;display:flex;flex-direction:column;gap:calc(var(--grid)*2);}
.t-head{display:flex;align-items:flex-start;gap:calc(var(--grid)*2);flex-wrap:wrap;}
.t-mark{width:44px;height:44px;flex:0 0 auto;margin-top:calc(var(--grid-in)*1);}
.t-headtext{flex:1 1 420px;min-width:0;}
.t-sentence{font-size:clamp(24px,3.6vw,var(--step-room));line-height:1.04;letter-spacing:-0.02em;font-weight:600;margin:0 0 var(--grid) 0;color:var(--prose);}
.t-lede{font-size:var(--step-lede);line-height:1.5;font-weight:300;color:var(--meta);margin:0;max-width:64ch;}
.t-chrome{display:flex;align-items:center;gap:var(--grid);flex-wrap:wrap;margin-left:auto;}
.t-mode,.t-clock{font-family:var(--font-mono);font-size:var(--step-meta);letter-spacing:var(--track-tight);text-transform:uppercase;padding:calc(var(--grid-in)*1) calc(var(--grid-in)*2);border-radius:var(--radius-pill);}
.t-mode{color:var(--mode-live);background:var(--mode-bg);}
.t-mode-sim{color:var(--mode-sim);background:var(--sim-hatch);}
.t-clock{color:var(--meta);text-transform:none;}
.t-btn{font-family:var(--font-mono);font-size:var(--step-data);letter-spacing:var(--track-tight);text-transform:uppercase;min-height:var(--row-h-live);padding:0 calc(var(--grid)*2);border-radius:var(--radius-chip);border:1px solid var(--hairline-strong);background:rgba(255,255,255,0.04);color:var(--prose);cursor:pointer;transition:border-color var(--dur-fast) var(--ease),background var(--dur-fast) var(--ease);}
.t-btn:hover:not(:disabled){border-color:var(--accent-line);background:var(--accent-wash);}
.t-btn:disabled{opacity:0.45;cursor:not-allowed;}
.t-btn-quiet{color:var(--meta);}
.t-since{display:flex;align-items:center;justify-content:space-between;gap:calc(var(--grid)*2);flex-wrap:wrap;padding:calc(var(--grid)*2);border:1px solid var(--panel-border);border-left:2px solid var(--accent);border-radius:var(--radius-panel);background:var(--panel);backdrop-filter:blur(var(--panel-blur));-webkit-backdrop-filter:blur(var(--panel-blur));}
.t-since-unset{border-left-color:var(--hairline-strong);}
.t-since-body{min-width:0;}
.t-since-label{font-family:var(--font-mono);font-size:var(--step-micro);letter-spacing:var(--track-wide);text-transform:uppercase;color:var(--faint);}
.t-since-sentence{margin:calc(var(--grid-in)*1) 0 0;font-size:var(--step-lede);line-height:1.45;color:var(--prose);}
.t-since-note{margin:calc(var(--grid-in)*1) 0 0;font-size:var(--step-body);color:var(--meta);font-weight:300;}
.t-since-acts{display:flex;align-items:center;gap:var(--grid);flex-wrap:wrap;}
.t-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:var(--grid);}
.t-tile{padding:calc(var(--grid)*2);border:1px solid var(--panel-border);border-radius:var(--radius-panel);background:var(--panel);backdrop-filter:blur(var(--panel-blur));-webkit-backdrop-filter:blur(var(--panel-blur));min-width:0;}
.t-tile[data-state="never-fired"]{border-style:dashed;}
.t-tile[data-state="not-served"]{border-color:var(--hairline);}
.t-tile-v{font-size:var(--step-stat);line-height:1;font-weight:600;letter-spacing:-0.02em;font-variant-numeric:var(--numeric);overflow-wrap:anywhere;}
.t-never{font-size:calc(var(--step-stat)*0.6);letter-spacing:var(--track-tight);text-transform:uppercase;color:var(--faint);font-weight:500;}
.t-tile-l{font-family:var(--font-mono);font-size:var(--step-meta);letter-spacing:var(--track-mid);text-transform:uppercase;color:var(--faint);margin-top:var(--grid);}
.t-why{margin-top:var(--grid);}
.t-why summary{font-family:var(--font-mono);font-size:var(--step-micro);letter-spacing:var(--track-tight);text-transform:uppercase;color:var(--accent-dim);cursor:pointer;min-height:var(--grid-in);list-style:none;}
.t-why summary::-webkit-details-marker{display:none;}
.t-why summary:hover{color:var(--accent);}
.t-why-note{font-size:var(--step-body);line-height:1.45;color:var(--meta);font-weight:300;margin:var(--grid) 0 calc(var(--grid-in)*1);}
.t-why-src{font-family:var(--font-mono);font-size:var(--step-meta);color:var(--accent-dim);margin:0;overflow-wrap:anywhere;}
.t-split{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:var(--grid);align-items:start;}
.t-panel{border:1px solid var(--panel-border);border-radius:var(--radius-panel);background:var(--panel);backdrop-filter:blur(var(--panel-blur));-webkit-backdrop-filter:blur(var(--panel-blur));padding:var(--pad-panel);min-width:0;}
.t-panel-head{display:flex;align-items:baseline;justify-content:space-between;gap:var(--grid);flex-wrap:wrap;margin-bottom:calc(var(--grid)*2);}
.t-panel-title{font-family:var(--font-mono);font-size:var(--step-meta);letter-spacing:var(--track-wide);text-transform:uppercase;color:var(--accent);}
.t-panel-hint{font-family:var(--font-mono);font-size:var(--step-meta);color:var(--faint);}
.t-brief{font-family:var(--font-mono);font-size:var(--step-data);line-height:1.65;}
.t-brief-day{color:var(--faint);margin-bottom:var(--grid);}
.t-group{margin-bottom:calc(var(--grid)*1.5);}
.t-group-head{display:flex;align-items:baseline;gap:var(--grid);font-size:var(--step-meta);letter-spacing:var(--track-mid);text-transform:uppercase;padding-bottom:calc(var(--grid-in)*1);border-bottom:1px solid var(--hairline);}
.t-group-n{font-variant-numeric:var(--numeric);color:var(--faint);}
.t-group-lock{margin-left:auto;font-size:var(--step-micro);letter-spacing:var(--track-tight);color:var(--faint);text-transform:none;}
.t-line{padding-left:var(--grid);white-space:pre-wrap;overflow-wrap:anywhere;}
.t-nonreal{background:var(--sim-hatch);padding-right:var(--grid-in);}
.t-collapsed{padding-left:var(--grid);color:var(--meta);}
.t-notice{padding:calc(var(--grid-in)*1) 0;overflow-wrap:anywhere;color:var(--meta);}
/* A torn line and a failed outcome are "something is wrong" -- but they are not an
   incident.raised receipt, and --red is that kind and nothing else. A fifth meaning
   does not get a fifth hue (tokens.css); it gets a label, and the label is the word. */
.t-loud{color:var(--prose);font-weight:600;letter-spacing:var(--track-tight);}
.t-brief-foot{margin-top:calc(var(--grid)*2);padding-top:var(--grid);border-top:1px solid var(--hairline);font-size:var(--step-meta);color:var(--faint);display:flex;flex-direction:column;gap:calc(var(--grid-in)*1);}
.t-brief-src{color:var(--meta);}
.t-feed{list-style:none;margin:0;padding:0;max-height:440px;overflow-y:auto;scrollbar-width:thin;}
.t-row{display:flex;align-items:baseline;gap:var(--grid);font-family:var(--font-mono);font-size:var(--step-data);min-height:var(--row-h);padding:calc(var(--grid-in)*1) 0;border-bottom:1px solid var(--hairline);}
.t-row-t{color:var(--faint);font-variant-numeric:var(--numeric);flex:0 0 auto;}
.t-row-k{flex:1 1 auto;min-width:0;overflow-wrap:anywhere;}
.t-row-v{color:var(--meta);flex:0 0 auto;}
.t-row-o{color:var(--prose);border:1px solid var(--hairline-strong);border-radius:var(--radius-chip);padding:0 var(--grid-in);flex:0 0 auto;text-transform:uppercase;font-size:var(--step-micro);letter-spacing:var(--track-tight);}
.t-receipt{font-family:var(--font-mono);font-size:var(--step-meta);color:var(--accent-dim);border:1px solid var(--accent-line);border-radius:var(--radius-chip);padding:calc(var(--grid-in)*0.5) calc(var(--grid-in)*1.5);flex:0 0 auto;}
.t-feed-foot,.t-waiting,.t-quiet-day{font-family:var(--font-mono);font-size:var(--step-meta);color:var(--faint);margin:var(--grid) 0 0;line-height:1.6;}
.t-quiet-day{font-family:var(--font-display);font-size:var(--step-body);font-weight:300;color:var(--meta);}
.t-refusal{border:1px solid var(--hairline-strong);border-left:2px solid var(--amber);border-radius:var(--radius-chip);padding:calc(var(--grid)*2);}
.t-refusal p{margin:var(--grid) 0 0;font-size:var(--step-body);line-height:1.5;color:var(--prose);font-weight:300;}
.t-refusal-what{color:var(--meta) !important;font-size:var(--step-meta) !important;}
.t-code{font-family:var(--font-mono);font-size:var(--step-meta);letter-spacing:var(--track-tight);color:var(--amber);}
.t-foot{display:flex;justify-content:space-between;gap:var(--grid);flex-wrap:wrap;font-family:var(--font-mono);font-size:var(--step-meta);color:var(--faint);padding-top:var(--grid);border-top:1px solid var(--hairline);}
.t-foot-nums{color:var(--meta);}
@media (max-width:640px){.t-room{padding:calc(var(--grid)*2) var(--grid) calc(var(--grid)*4);}.t-chrome{margin-left:0;}}
`;

// Named and default both: the shell that mounts this room is written by another hand, and
// an import style is not worth a broken build.
export default Today;
