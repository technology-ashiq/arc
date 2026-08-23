// SpineRoom -- the log itself, and the health of the thing that holds it.
//
// "If it isn't an event, it didn't happen." Every other room in this product is a view
// over what is on this screen, which is why this one shows the bytes: the log, paged with
// the door's own cursor, and a drawer per receipt carrying the canonical payload.
//
// It decides NOTHING. The paging arithmetic, the walk to the newest receipt, the refusal
// taxonomy, the legend, the canonical serializer and the eight laws are all
// ../lib/spine.mjs, because `node` can import that file with no install and cannot import
// this one at all. If an `if` in here is worth asserting, it is in the wrong file.
//
// Two things on this screen are load-bearing and easy to get wrong:
//
//  1. THE DOOR PAGES FROM THE START. `limit=50` returns the OLDEST fifty receipts. The
//     walk in spine.mjs is what makes the room open on the newest one; see the header
//     comment there for the whole contract.
//
//  2. THE QUARANTINE IS MOSTLY DEDUPLICATION. A single total reads as catastrophe. Grouped
//     by refusal code it reads as the idempotency guard doing its job, plus a small number
//     of real refusals. The grouping is the honesty, not the decoration.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Door } from "../lib/door.mjs";
import {
  openingFor, newSeek, seekQuery, seekAbsorb, seekSentence, readLogPage, readSpineHealth,
  rungCount, rungQuery, rungWindow, tailRung, tailRecords, toggleKind, kindMenu, isDay,
  legendRows, quarantineView, tornView, kindsView, receiptFields, payloadView, sharePct,
  SPINE_LAWS, PAGE_ROWS, TONE_INK, fmtInt, shortId, timeOfDay, refusalOf, toneForKind,
} from "../lib/spine.mjs";
import type { LogRecord, SeekState, SpineHealth } from "../lib/spine.mjs";
import type { Refused } from "../lib/inbox.mjs";

export type SpineRoomProps = {
  /** The L2 client. The shell owns the token; this room only reads through it. */
  door: Door;
  /** The registry's own entry, when the shell has read /api/rooms. Its strings arrive
   *  escaped like everything the door serves and are decoded by `openingFor`. */
  room?: { sentence?: string; lede?: string };
  sentence?: string;
  lede?: string;
};

/** Health repeats on this beat. The walk does not: it costs real requests, and each one
 *  re-scans the whole log at the door. Re-walking is an explicit act. */
const POLL_MS = 45_000;

export function SpineRoom({ door, room, sentence, lede }: SpineRoomProps) {
  const opening = openingFor("spine", room, { sentence, lede });

  const [health, setHealth] = useState<SpineHealth | null>(null);
  const [healthError, setHealthError] = useState<Refused | null>(null);

  const [kinds, setKinds] = useState<string[]>([]);
  const [day, setDay] = useState<string>("");
  const [dayDraft, setDayDraft] = useState<string>("");

  const [seek, setSeek] = useState<SeekState | null>(null);
  const [seekError, setSeekError] = useState<Refused | null>(null);
  const [at, setAt] = useState<number | null>(null);
  const [records, setRecords] = useState<LogRecord[] | null>(null);
  const [pageError, setPageError] = useState<Refused | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [walkNonce, setWalkNonce] = useState(0);

  const seekRef = useRef<SeekState | null>(null);
  seekRef.current = seek;
  const pageAbort = useRef<AbortController | null>(null);

  // ── health ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const ac = new AbortController();
    const read = () => {
      door
        .health(ac.signal)
        .then((raw: unknown) => {
          if (ac.signal.aborted) return;
          setHealth(readSpineHealth(raw));
          setHealthError(null);
        })
        .catch((err: unknown) => {
          if (!ac.signal.aborted) setHealthError(refusalOf(err));
        });
    };
    read();
    const timer = window.setInterval(read, POLL_MS);
    return () => {
      window.clearInterval(timer);
      ac.abort();
    };
  }, [door]);

  // ── the walk ──────────────────────────────────────────────────────────────
  // Re-runs whenever the filter set changes, because a rung cursor is a position in the
  // FILTERED stream: change the kinds and every rung on the ladder means something else.
  const filterKey = `${kinds.join(",")}|${day}`;
  useEffect(() => {
    const ac = new AbortController();
    let live = newSeek({ kinds, day: day === "" ? null : day });
    setSeek(live);
    setSeekError(null);
    setAt(null);
    setRecords(null);
    setPageError(null);
    setOpenId(null);

    void (async () => {
      try {
        for (;;) {
          const q = seekQuery(live);
          if (q === null) break;
          const raw: unknown = await door.spine(q, ac.signal);
          if (ac.signal.aborted) return;
          live = seekAbsorb(live, readLogPage(raw));
          setSeek(live);
        }
        if (ac.signal.aborted) return;
        setAt(tailRung(live));
        setRecords(tailRecords(live));
      } catch (err) {
        if (!ac.signal.aborted) setSeekError(refusalOf(err));
      }
    })();

    return () => ac.abort();
    // `filterKey` IS `kinds` and `day`, joined — one dependency rather than two arrays,
    // because a new array identity on every render would restart the walk on every render,
    // and a walk is real requests against a door that re-scans the whole log for each one.
  }, [door, filterKey, walkNonce]);

  // ── one page of rows ──────────────────────────────────────────────────────
  const goRung = useCallback(
    (index: number) => {
      const live = seekRef.current;
      if (live === null) return;
      const q = rungQuery(live, index);
      if (q === null) return;
      pageAbort.current?.abort();
      setAt(index);
      setPageError(null);
      setOpenId(null);
      if (index === tailRung(live)) {
        // Already in hand: the walk kept the last page as it went past.
        setRecords(tailRecords(live));
        return;
      }
      setRecords(null);
      const ac = new AbortController();
      pageAbort.current = ac;
      door
        .spine(q, ac.signal)
        .then((raw: unknown) => {
          if (!ac.signal.aborted) setRecords(readLogPage(raw).records);
        })
        .catch((err: unknown) => {
          if (!ac.signal.aborted) setPageError(refusalOf(err));
        });
    },
    [door],
  );

  useEffect(() => () => pageAbort.current?.abort(), []);

  const menu = useMemo(() => kindMenu(health), [health]);
  const legend = useMemo(() => legendRows(health), [health]);
  const quarantine = useMemo(() => quarantineView(health), [health]);
  const torn = useMemo(() => tornView(health), [health]);
  const kindsSaid = useMemo(() => kindsView(health), [health]);
  const window_ = seek !== null && at !== null ? rungWindow(seek, at) : null;
  const pages = seek === null ? 0 : rungCount(seek);

  const applyDay = useCallback(() => {
    if (dayDraft === "") {
      setDay("");
      return;
    }
    if (!isDay(dayDraft)) return; // refused locally rather than sent; see the input's note
    setDay(dayDraft);
  }, [dayDraft]);

  const dayBad = dayDraft !== "" && !isDay(dayDraft);

  return (
    <section className="s-room" aria-label="Spine">
      <style>{CSS}</style>

      <header className="s-head">
        <div className="s-headtext">
          <h1 className="s-sentence">{opening.sentence}</h1>
          <p className="s-lede">{opening.lede}</p>
        </div>
        <div className="s-chrome">
          <ModeChip mode={health?.mode ?? null} />
          <span className="s-clock" title="the door's own clock, in the company's timezone">
            {health === null ? "reading…" : health.now}
          </span>
          {health?.cursor === undefined || health.cursor === null ? null : (
            <span className="s-receipt" title={`the newest receipt on the spine — ${health.cursor}`}>
              ⌗ {shortId(health.cursor)}
            </span>
          )}
        </div>
      </header>

      {healthError === null ? null : <Refusal said={healthError} what="the spine's own health" />}

      {/* ── the numbers ───────────────────────────────────────────────────── */}
      <div className="s-kpis">
        <Stat
          label="receipts"
          value={health === null ? null : health.events}
          note="every line the reader parsed back off the log. Counted at read time, never cached — a stored total is the second truth ADR-1301 forbids."
        />
        <Stat
          label="kinds ever fired"
          value={health === null ? null : health.kindsSeen}
          note={kindsSaid.sentence}
        />
        <Stat
          label="days sealed"
          value={health === null ? null : health.daysClosed}
          of={health === null ? null : health.days}
          note="a closed day is immutable forever, pinned by the sha in its day.closed receipt (ADR-0029)."
        />
        <Stat
          label="idem index"
          value={health === null ? null : health.idemIndex}
          note="how many idempotency keys the derived index holds. −1 means the index itself could not be read, which is a named state and not a count."
        />
        <Stat
          label="torn lines"
          value={torn.state === "unread" ? null : torn.count}
          state={torn.state === "torn" ? "loud" : "plain"}
          note={torn.sentence}
        />
      </div>

      {/* ── quarantine, by refusal code ───────────────────────────────────── */}
      <div className="s-panel">
        <div className="s-panel-head">
          <span className="s-panel-title">refused and held separately</span>
          <span className="s-panel-hint">
            grouped by the door's own refusal code · {quarantine.measured ? "measured" : "not served"}
          </span>
        </div>
        <p className="s-say">{quarantine.headline}</p>
        {quarantine.families.length === 0 ? null : (
          <ul className="s-fams">
            {quarantine.families.map((f) => {
              const share = sharePct(f.count, quarantine.total);
              return (
                <li className="s-fam" key={f.family} data-loss={f.loss}>
                  <div className="s-fam-head">
                    <span className="s-fam-label">{f.label}</span>
                    <span className="s-fam-n">{fmtInt(f.count)}</span>
                    <span className="s-fam-share">{share === null ? "" : `${fmtInt(share)}%`}</span>
                  </div>
                  <div
                    className="s-bar"
                    aria-hidden="true"
                    style={{ ["--w" as string]: `${share === null ? 0 : share}%` }}
                  >
                    <i className="s-bar-fill" />
                  </div>
                  <p className="s-fam-say">{f.sentence}</p>
                  <div className="s-codes">
                    {f.codes.map((c) => (
                      <span className="s-code-chip" key={c.code} title={`${c.code} — ${fmtInt(c.count)} record${c.count === 1 ? "" : "s"}`}>
                        {c.code}
                        <b>{fmtInt(c.count)}</b>
                      </span>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="s-foot-note">
          {quarantine.stubOnly === null
            ? "The door did not say how many records are stub-only."
            : `${fmtInt(quarantine.stubOnly)} of these are STUB-ONLY: a deny-pattern hit whose bytes were never persisted (ADR-0028), so there is nothing for any screen to show and that is by design.`}
          {quarantine.unreadable === null
            ? ""
            : ` ${fmtInt(quarantine.unreadable)} quarantine record${quarantine.unreadable === 1 ? " was" : "s were"} themselves unreadable.`}
        </p>
      </div>

      {/* ── filters ───────────────────────────────────────────────────────── */}
      <div className="s-panel">
        <div className="s-panel-head">
          <span className="s-panel-title">filter the log</span>
          <span className="s-panel-hint">
            {menu.length === 0
              ? "waiting for the kinds that have fired"
              : `${fmtInt(menu.length)} kind${menu.length === 1 ? "" : "s"} have ever fired · a kind that never fired is not offered, because it would filter to nothing`}
          </span>
        </div>
        <div className="s-kinds">
          {menu.map((k) => {
            const on = kinds.indexOf(k.kind) !== -1;
            return (
              <button
                type="button"
                key={k.kind}
                className={`s-kind${on ? " s-kind-on" : ""}`}
                style={{ color: k.ink }}
                aria-pressed={on}
                onClick={() => setKinds((prev) => toggleKind(prev, k.kind))}
              >
                {k.kind}
              </button>
            );
          })}
        </div>
        <div className="s-filterbar">
          <label className="s-daylabel" htmlFor="s-day">
            one day
          </label>
          <input
            id="s-day"
            className={`s-dayinput${dayBad ? " s-dayinput-bad" : ""}`}
            type="text"
            inputMode="numeric"
            placeholder="YYYY-MM-DD"
            value={dayDraft}
            onChange={(ev) => setDayDraft(ev.target.value.trim())}
            onKeyDown={(ev) => {
              if (ev.key === "Enter") applyDay();
            }}
          />
          <button type="button" className="s-btn" onClick={applyDay} disabled={dayBad}>
            apply
          </button>
          {kinds.length === 0 && day === "" ? null : (
            <button
              type="button"
              className="s-btn s-btn-quiet"
              onClick={() => {
                setKinds([]);
                setDay("");
                setDayDraft("");
              }}
            >
              clear {fmtInt(kinds.length + (day === "" ? 0 : 1))}
            </button>
          )}
          <button
            type="button"
            className="s-btn s-btn-quiet"
            title="the ladder was built when the walk ran; receipts that landed since are past its end"
            onClick={() => setWalkNonce((n) => n + 1)}
          >
            walk again
          </button>
        </div>
        {dayBad ? (
          <p className="s-say s-say-warn">
            <b className="s-codeword">BAD_DAY</b> — a day is YYYY-MM-DD. This is refused here rather
            than sent, because the door filters on an exact string match and would answer 200 with an
            empty page, which reads as “nothing happened” instead of “that is not a day”.
          </p>
        ) : null}
      </div>

      {/* ── the log ───────────────────────────────────────────────────────── */}
      <div className="s-panel">
        <div className="s-panel-head">
          <span className="s-panel-title">the log</span>
          <span className="s-panel-hint">
            {window_ === null ? "walking" : `${window_.label} · newest first`}
          </span>
        </div>

        <p className="s-say">{seek === null ? "Starting the walk…" : seekSentence(seek)}</p>

        {seekError !== null ? <Refusal said={seekError} what="the log" /> : null}
        {pageError !== null ? <Refusal said={pageError} what="this page of the log" /> : null}

        {seek === null || at === null ? null : (
          <nav className="s-pager" aria-label="log pages">
            <button type="button" className="s-btn" disabled={at <= 0} onClick={() => goRung(0)}>
              oldest
            </button>
            <button type="button" className="s-btn" disabled={at <= 0} onClick={() => goRung(at - 1)}>
              ← older
            </button>
            <span className="s-pagerlabel">
              page {fmtInt(at + 1)} of {fmtInt(pages)}
              <em>{PAGE_ROWS} rows a page</em>
            </span>
            <button
              type="button"
              className="s-btn"
              disabled={at >= pages - 1}
              onClick={() => goRung(at + 1)}
            >
              newer →
            </button>
            <button
              type="button"
              className="s-btn"
              disabled={at >= pages - 1}
              onClick={() => goRung(pages - 1)}
            >
              newest
            </button>
          </nav>
        )}

        {records === null && seekError === null && pageError === null ? (
          <p className="s-waiting">reading this page from the door…</p>
        ) : null}

        {records !== null && records.length === 0 ? (
          <p className="s-say">
            The door answered, and nothing on the spine matches this filter. That is a read that
            succeeded and found nothing — a different fact from a read that failed, and the reason
            this is a sentence rather than an empty table.
          </p>
        ) : null}

        {records === null || records.length === 0 ? null : (
          <ol className="s-log">
            {/* Newest first. The door hands a page back in append order, so the last row it
                sent is the most recent thing that happened. */}
            {[...records].reverse().map((rec) => {
              const tone = toneForKind(rec.kind);
              const open = openId === rec.id;
              return (
                <li className={`s-item${open ? " s-item-open" : ""}`} key={rec.id || `${rec.day}:${rec.seq ?? 0}`}>
                  <button
                    type="button"
                    className="s-row"
                    aria-expanded={open}
                    onClick={() => setOpenId(open ? null : rec.id)}
                  >
                    <span className="s-row-caret" aria-hidden="true">
                      {open ? "▾" : "▸"}
                    </span>
                    <span className="s-row-day">{rec.day}</span>
                    <span className="s-row-t">{timeOfDay(rec.ts)}</span>
                    <span
                      className={`s-row-k${tone === "non-real" ? " s-nonreal" : ""}`}
                      style={{ color: TONE_INK[tone] }}
                    >
                      {rec.kind}
                    </span>
                    <span className="s-row-v">{rec.venture}</span>
                    {rec.outcome === "ok" || rec.outcome === "" ? null : (
                      <span className="s-row-o">{rec.outcome}</span>
                    )}
                    {rec.supersedes === null ? null : (
                      <span className="s-row-sup" title={`supersedes ${rec.supersedes}`}>
                        supersedes
                      </span>
                    )}
                    <span className="s-receipt" title={rec.id}>
                      ⌗ {shortId(rec.id)}
                    </span>
                  </button>
                  {open ? <Drawer rec={rec} /> : null}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* ── the legend ────────────────────────────────────────────────────── */}
      <div className="s-panel">
        <div className="s-panel-head">
          <span className="s-panel-title">what the colours mean</span>
          <span className="s-panel-hint">four reserved hues, and one that carries no meaning at all</span>
        </div>
        <ul className="s-legend">
          {legend.map((row) => (
            <li className="s-leg" key={row.tone} data-state={row.state}>
              <span
                className={`s-leg-dot${row.tone === "non-real" ? " s-leg-hatch" : ""}`}
                aria-hidden="true"
                style={{ background: row.tone === "non-real" ? undefined : row.ink }}
              />
              <div className="s-leg-body">
                <div className="s-leg-head">
                  <span className="s-leg-label" style={{ color: row.ink }}>
                    {row.label}
                  </span>
                  <span className="s-leg-n">
                    {row.state === "unread"
                      ? "not read"
                      : row.state === "never-fired"
                        ? "never fired"
                        : `${fmtInt(row.count)} kind${row.count === 1 ? "" : "s"}`}
                  </span>
                </div>
                <p className="s-leg-rule">{row.rule}</p>
                {row.kinds.length === 0 ? null : (
                  <p className="s-leg-kinds">{row.kinds.join(" · ")}</p>
                )}
                {row.state === "never-fired" ? (
                  <p className="s-leg-kinds">
                    Not a zero. No kind wearing this colour has ever fired, so there is no count to
                    show — and that absence is the point.
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* ── the eight laws ────────────────────────────────────────────────── */}
      <div className="s-panel">
        <div className="s-panel-head">
          <span className="s-panel-title">the eight laws of this log</span>
          <span className="s-panel-hint">ADR-0024 … ADR-0031 · the reason anything above is worth believing</span>
        </div>
        <ol className="s-laws">
          {SPINE_LAWS.map((l) => (
            <li className="s-law" key={l.adr}>
              <div className="s-law-head">
                <span className="s-law-letter" aria-hidden="true">
                  {l.letter}
                </span>
                <span className="s-law-title">{l.title}</span>
                <span className="s-law-adr">{l.adr}</span>
              </div>
              <p className="s-law-body">{l.law}</p>
            </li>
          ))}
        </ol>
      </div>

      <footer className="s-foot">
        <span>read-only room · the one write in this product is a stamp in the Inbox</span>
        <span className="s-foot-nums">
          {health === null ? null : (
            <>
              reader {seek?.engine ?? "—"} · root {health.root ?? "—"}
              {health.journal === null ? "" : ` · journal ${health.journal}`}
            </>
          )}
        </span>
      </footer>
    </section>
  );
}

/* -------------------------------------------------------------------------- *
 * pieces
 * -------------------------------------------------------------------------- */

function ModeChip({ mode }: { mode: string | null }) {
  if (mode === null) return <span className="s-mode">mode unread</span>;
  const sim = mode === "sim";
  return (
    <span
      className={`s-mode${sim ? " s-mode-sim" : ""}`}
      title={
        sim
          ? "every value on this screen is fixture data from a spine named on the command line — never real"
          : "the canonical spine, read live"
      }
    >
      {sim ? "SIMULATED" : mode}
    </span>
  );
}

/**
 * A number that never lies about not knowing. `null` is not 0: it is the door not having
 * served the field, and the tile says so in words rather than printing a digit nobody
 * measured.
 */
function Stat({
  label,
  value,
  of,
  note,
  state = "plain",
}: {
  label: string;
  value: number | null;
  of?: number | null;
  note: string;
  state?: "plain" | "loud";
}) {
  return (
    <div className="s-tile" data-state={value === null ? "not-served" : state}>
      <div className="s-tile-v">
        {value === null ? (
          <span className="s-unread">not served</span>
        ) : (
          <>
            {fmtInt(value)}
            {of === null || of === undefined ? null : <em className="s-tile-of"> / {fmtInt(of)}</em>}
          </>
        )}
      </div>
      <div className="s-tile-l">{label}</div>
      <details className="s-why">
        <summary>Why?</summary>
        <p className="s-why-note">{note}</p>
      </details>
    </div>
  );
}

/** The receipt, opened. Identity above, canonical payload below. */
function Drawer({ rec }: { rec: LogRecord }) {
  const [raw, setRaw] = useState(false);
  const fields = receiptFields(rec);
  const payload = payloadView(rec);
  return (
    <div className="s-drawer">
      <dl className="s-fields">
        {fields.map((f) => (
          <div className="s-field" key={f.key} data-missing={f.missing ? "yes" : "no"}>
            <dt title={f.note}>{f.key}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
      </dl>
      <div className="s-payhead">
        <span className="s-panel-title">payload</span>
        <span className="s-panel-hint">{payload.sentence}</span>
        <button type="button" className="s-btn s-btn-quiet" onClick={() => setRaw((v) => !v)}>
          {raw ? "readable" : "canonical bytes"}
        </button>
      </div>
      <pre className="s-json">{raw ? payload.canonical : payload.pretty}</pre>
      <p className="s-foot-note">
        Sorted keys, because that is what canonical serialization means (ADR-0024). The{" "}
        <b>canonical bytes</b> view is the exact shape the sha was taken over, with the sha field
        excluded — and nothing in this browser recomputes it. The sha above is shown as the spine
        recorded it, which is a weaker claim than “verified”, and the weaker claim is the true one.
      </p>
    </div>
  );
}

/**
 * A refused read, never “something went wrong”. The door refuses BY NAME and each name
 * means a different thing to do next; the code is shown verbatim beside the sentence.
 * Note the tone: a refused read is not an incident, so this is not --red.
 */
function Refusal({ said, what }: { said: Refused; what: string }) {
  return (
    <div className="s-refusal" role="status">
      <span className="s-codeword">{said.code}</span>
      <p>{said.human}</p>
      <p className="s-refusal-what">
        {what} is not on this screen, and nothing has been guessed in its place.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * style. Every colour is a token; there is no hex in this file.
 * -------------------------------------------------------------------------- */

const CSS = `
.s-room{font-family:var(--font-display);color:var(--prose);padding:calc(var(--grid)*3) calc(var(--grid)*3) calc(var(--grid)*6);max-width:1280px;margin:0 auto;display:flex;flex-direction:column;gap:calc(var(--grid)*2);}
.s-head{display:flex;align-items:flex-start;gap:calc(var(--grid)*2);flex-wrap:wrap;}
.s-headtext{flex:1 1 420px;min-width:0;}
.s-sentence{font-size:clamp(24px,3.6vw,var(--step-room));line-height:1.04;letter-spacing:-0.02em;font-weight:600;margin:0 0 var(--grid) 0;color:var(--prose);}
.s-lede{font-size:var(--step-lede);line-height:1.5;font-weight:300;color:var(--meta);margin:0;max-width:66ch;}
.s-chrome{display:flex;align-items:center;gap:var(--grid);flex-wrap:wrap;margin-left:auto;}
.s-mode,.s-clock{font-family:var(--font-mono);font-size:var(--step-meta);letter-spacing:var(--track-tight);text-transform:uppercase;padding:calc(var(--grid-in)*1) calc(var(--grid-in)*2);border-radius:var(--radius-pill);}
.s-mode{color:var(--mode-live);background:var(--mode-bg);}
.s-mode-sim{color:var(--mode-sim);background:var(--sim-hatch);}
.s-clock{color:var(--meta);text-transform:none;}
.s-receipt{font-family:var(--font-mono);font-size:var(--step-meta);color:var(--accent-dim);border:1px solid var(--accent-line);border-radius:var(--radius-chip);padding:calc(var(--grid-in)*0.5) calc(var(--grid-in)*1.5);flex:0 0 auto;white-space:nowrap;}
.s-btn{font-family:var(--font-mono);font-size:var(--step-data);letter-spacing:var(--track-tight);text-transform:uppercase;min-height:var(--row-h-live);padding:0 calc(var(--grid)*2);border-radius:var(--radius-chip);border:1px solid var(--hairline-strong);background:rgba(255,255,255,0.04);color:var(--prose);cursor:pointer;transition:border-color var(--dur-fast) var(--ease),background var(--dur-fast) var(--ease);}
.s-btn:hover:not(:disabled){border-color:var(--accent-line);background:var(--accent-wash);}
.s-btn:disabled{opacity:0.4;cursor:not-allowed;}
.s-btn-quiet{color:var(--meta);}
.s-panel{border:1px solid var(--panel-border);border-radius:var(--radius-panel);background:var(--panel);backdrop-filter:blur(var(--panel-blur));-webkit-backdrop-filter:blur(var(--panel-blur));padding:var(--pad-panel);min-width:0;}
.s-panel-head{display:flex;align-items:baseline;justify-content:space-between;gap:var(--grid);flex-wrap:wrap;margin-bottom:calc(var(--grid)*2);}
.s-panel-title{font-family:var(--font-mono);font-size:var(--step-meta);letter-spacing:var(--track-wide);text-transform:uppercase;color:var(--accent);}
.s-panel-hint{font-family:var(--font-mono);font-size:var(--step-meta);color:var(--faint);}
.s-say{font-size:var(--step-body);line-height:1.6;font-weight:300;color:var(--prose);margin:0 0 calc(var(--grid)*2);max-width:84ch;}
.s-say-warn{color:var(--meta);}
.s-waiting,.s-foot-note{font-family:var(--font-mono);font-size:var(--step-meta);color:var(--faint);line-height:1.6;margin:var(--grid) 0 0;}
.s-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:var(--grid);}
.s-tile{padding:calc(var(--grid)*2);border:1px solid var(--panel-border);border-radius:var(--radius-panel);background:var(--panel);backdrop-filter:blur(var(--panel-blur));-webkit-backdrop-filter:blur(var(--panel-blur));min-width:0;}
.s-tile[data-state="not-served"]{border-style:dashed;border-color:var(--hairline);}
.s-tile[data-state="loud"]{border-color:var(--hairline-strong);}
.s-tile-v{font-size:var(--step-stat);line-height:1;font-weight:600;letter-spacing:-0.02em;font-variant-numeric:var(--numeric);color:var(--prose);overflow-wrap:anywhere;}
.s-tile-of{font-size:calc(var(--step-stat)*0.5);font-style:normal;color:var(--faint);}
.s-unread{font-size:calc(var(--step-stat)*0.42);letter-spacing:var(--track-tight);text-transform:uppercase;color:var(--faint);font-weight:500;}
.s-tile-l{font-family:var(--font-mono);font-size:var(--step-meta);letter-spacing:var(--track-mid);text-transform:uppercase;color:var(--faint);margin-top:var(--grid);}
.s-why{margin-top:var(--grid);}
.s-why summary{font-family:var(--font-mono);font-size:var(--step-micro);letter-spacing:var(--track-tight);text-transform:uppercase;color:var(--accent-dim);cursor:pointer;list-style:none;}
.s-why summary::-webkit-details-marker{display:none;}
.s-why summary:hover{color:var(--accent);}
.s-why-note{font-size:var(--step-body);line-height:1.45;color:var(--meta);font-weight:300;margin:var(--grid) 0 0;}
.s-fams{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:calc(var(--grid)*2);}
.s-fam{border-left:2px solid var(--hairline-strong);padding-left:calc(var(--grid)*1.5);}
/* A family that lost nothing is the reassuring one and reads in the product's own colour,
   which carries no meaning. Nothing here borrows a reserved hue: a refused input is not an
   incident, and a WITHHELD secret is not a member of the non-real family either -- it is a
   real input that was correctly never written down. It gets a texture, not a violet. */
.s-fam[data-loss="none"]{border-left-color:var(--accent-line);}
.s-fam[data-loss="withheld"]{border-left-style:dotted;}
.s-fam-head{display:flex;align-items:baseline;gap:var(--grid);font-family:var(--font-mono);font-size:var(--step-data);text-transform:uppercase;letter-spacing:var(--track-tight);}
.s-fam-label{color:var(--prose);}
.s-fam-n{color:var(--accent);font-variant-numeric:var(--numeric);}
.s-fam-share{margin-left:auto;color:var(--faint);font-variant-numeric:var(--numeric);}
.s-bar{position:relative;height:4px;border-radius:var(--radius-pill);background:var(--hairline);margin:var(--grid) 0;overflow:hidden;}
.s-bar-fill{display:block;height:100%;width:var(--w);background:var(--accent-line);}
.s-fam-say{font-size:var(--step-body);line-height:1.55;font-weight:300;color:var(--meta);margin:0 0 var(--grid);max-width:84ch;}
.s-codes{display:flex;flex-wrap:wrap;gap:var(--grid-in);}
.s-code-chip{font-family:var(--font-mono);font-size:var(--step-meta);color:var(--meta);border:1px solid var(--hairline-strong);border-radius:var(--radius-chip);padding:2px calc(var(--grid-in)*1.5);display:inline-flex;gap:var(--grid-in);align-items:baseline;}
.s-code-chip b{color:var(--prose);font-variant-numeric:var(--numeric);}
.s-kinds{display:flex;flex-wrap:wrap;gap:var(--grid-in);margin-bottom:calc(var(--grid)*2);}
.s-kind{font-family:var(--font-mono);font-size:var(--step-meta);background:transparent;border:1px solid var(--hairline);border-radius:var(--radius-chip);padding:4px calc(var(--grid)*1);cursor:pointer;opacity:0.68;transition:opacity var(--dur-fast) var(--ease),border-color var(--dur-fast) var(--ease);}
.s-kind:hover{opacity:1;border-color:var(--hairline-strong);}
.s-kind-on{opacity:1;border-color:var(--accent);background:var(--mode-bg);}
.s-filterbar{display:flex;align-items:center;gap:var(--grid);flex-wrap:wrap;}
.s-daylabel{font-family:var(--font-mono);font-size:var(--step-meta);text-transform:uppercase;letter-spacing:var(--track-mid);color:var(--faint);}
.s-dayinput{font-family:var(--font-mono);font-size:var(--step-data);min-height:var(--row-h-live);width:13ch;padding:0 var(--grid);border-radius:var(--radius-chip);border:1px solid var(--hairline-strong);background:rgba(255,255,255,0.03);color:var(--prose);}
.s-dayinput-bad{border-color:var(--accent-line);}
.s-pager{display:flex;align-items:center;gap:var(--grid);flex-wrap:wrap;margin-bottom:calc(var(--grid)*2);}
.s-pagerlabel{font-family:var(--font-mono);font-size:var(--step-meta);color:var(--meta);display:flex;flex-direction:column;line-height:1.35;}
.s-pagerlabel em{font-style:normal;color:var(--faint);font-size:var(--step-micro);}
.s-log{list-style:none;margin:0;padding:0;border-top:1px solid var(--hairline);}
.s-item{border-bottom:1px solid var(--hairline);}
.s-item-open{background:rgba(255,255,255,0.03);}
.s-row{display:flex;align-items:baseline;gap:var(--grid);width:100%;text-align:left;background:transparent;border:0;cursor:pointer;font-family:var(--font-mono);font-size:var(--step-data);min-height:var(--row-h-live);padding:var(--grid-in) var(--grid-in);color:var(--prose);}
.s-row:hover{background:rgba(255,255,255,0.04);}
.s-row-caret{color:var(--accent-dim);flex:0 0 auto;}
.s-row-day{color:var(--faint);flex:0 0 auto;}
.s-row-t{color:var(--meta);font-variant-numeric:var(--numeric);flex:0 0 auto;}
.s-row-k{flex:1 1 auto;min-width:0;overflow-wrap:anywhere;}
.s-nonreal{background:var(--sim-hatch);padding-right:var(--grid-in);}
.s-row-v{color:var(--meta);flex:0 0 auto;}
.s-row-o,.s-row-sup{flex:0 0 auto;text-transform:uppercase;font-size:var(--step-micro);letter-spacing:var(--track-tight);border:1px solid var(--hairline-strong);border-radius:var(--radius-chip);padding:0 var(--grid-in);color:var(--prose);}
.s-row-sup{color:var(--accent-dim);border-color:var(--accent-line);}
.s-drawer{padding:calc(var(--grid)*2) var(--grid) calc(var(--grid)*3);border-top:1px dashed var(--hairline-strong);}
.s-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:var(--grid);margin:0 0 calc(var(--grid)*2);}
.s-field{min-width:0;}
.s-field dt{font-family:var(--font-mono);font-size:var(--step-micro);text-transform:uppercase;letter-spacing:var(--track-mid);color:var(--faint);margin-bottom:2px;cursor:help;}
.s-field dd{font-family:var(--font-mono);font-size:var(--step-data);color:var(--prose);margin:0;overflow-wrap:anywhere;}
.s-field[data-missing="yes"] dd{color:var(--faint);}
.s-payhead{display:flex;align-items:baseline;gap:var(--grid);flex-wrap:wrap;margin-bottom:var(--grid);}
.s-payhead .s-panel-hint{margin-right:auto;}
.s-json{font-family:var(--font-mono);font-size:var(--step-data);line-height:1.55;color:var(--prose);background:rgba(0,0,0,0.45);border:1px solid var(--hairline);border-radius:var(--radius-chip);padding:calc(var(--grid)*1.5);margin:0;max-height:340px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;scrollbar-width:thin;}
.s-legend{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:calc(var(--grid)*2);}
.s-leg{display:flex;gap:var(--grid);align-items:flex-start;}
.s-leg[data-state="never-fired"]{opacity:0.86;}
.s-leg-dot{width:10px;height:10px;flex:0 0 auto;margin-top:5px;border-radius:var(--radius-pill);}
.s-leg-hatch{border:1px solid var(--sim-line);background-image:var(--sim-hatch);}
.s-leg-body{min-width:0;}
.s-leg-head{display:flex;align-items:baseline;gap:var(--grid);}
.s-leg-label{font-family:var(--font-mono);font-size:var(--step-data);text-transform:uppercase;letter-spacing:var(--track-tight);}
.s-leg-n{font-family:var(--font-mono);font-size:var(--step-micro);text-transform:uppercase;letter-spacing:var(--track-tight);color:var(--faint);}
.s-leg-rule{font-size:var(--step-body);line-height:1.55;font-weight:300;color:var(--meta);margin:var(--grid-in) 0 0;max-width:82ch;}
.s-leg-kinds{font-family:var(--font-mono);font-size:var(--step-meta);color:var(--faint);margin:var(--grid-in) 0 0;overflow-wrap:anywhere;line-height:1.6;}
.s-laws{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:calc(var(--grid)*2);}
.s-law{min-width:0;}
.s-law-head{display:flex;align-items:baseline;gap:var(--grid);}
.s-law-letter{font-family:var(--font-mono);font-size:var(--step-meta);color:var(--on-accent);background:var(--accent);border-radius:var(--radius-pill);width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;align-self:center;}
.s-law-title{font-family:var(--font-mono);font-size:var(--step-data);text-transform:uppercase;letter-spacing:var(--track-tight);color:var(--prose);}
.s-law-adr{margin-left:auto;font-family:var(--font-mono);font-size:var(--step-micro);color:var(--faint);}
.s-law-body{font-size:var(--step-body);line-height:1.6;font-weight:300;color:var(--meta);margin:var(--grid) 0 0;}
.s-refusal{border:1px solid var(--hairline-strong);border-left:2px solid var(--accent);border-radius:var(--radius-chip);padding:calc(var(--grid)*2);margin-bottom:calc(var(--grid)*2);}
.s-refusal p{margin:var(--grid) 0 0;font-size:var(--step-body);line-height:1.5;color:var(--prose);font-weight:300;}
.s-refusal-what{color:var(--meta) !important;font-size:var(--step-meta) !important;}
.s-codeword{font-family:var(--font-mono);font-size:var(--step-meta);letter-spacing:var(--track-tight);color:var(--accent);}
.s-foot{display:flex;justify-content:space-between;gap:var(--grid);flex-wrap:wrap;font-family:var(--font-mono);font-size:var(--step-meta);color:var(--faint);padding-top:var(--grid);border-top:1px solid var(--hairline);}
.s-foot-nums{color:var(--meta);overflow-wrap:anywhere;}
@media (max-width:640px){.s-room{padding:calc(var(--grid)*2) var(--grid) calc(var(--grid)*4);}.s-chrome{margin-left:0;}.s-row-day{display:none;}}
`;

// Named and default both: the shell that mounts this room is written by another hand, and
// an import style is not worth a broken build.
export default SpineRoom;
