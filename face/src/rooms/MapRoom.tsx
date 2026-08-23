// MapRoom.tsx -- the Map room. A thin SVG renderer over what map.mjs computes.
//
// There is deliberately no geometry in this file. Every coordinate, every path, every dash
// array, every label position and every accessible sentence arrives already decided from
// ../lib/map.mjs, because CI never runs `npm install` and a number computed in here is a
// number no test can hold. What this file does is turn a list of draw ops into <path>, a
// list of stations into focusable links, and two media queries into a decision about motion.
//
// If you find yourself wanting an `if` here, it belongs in map.mjs.

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
// `a` is typed as the HTML anchor even inside <svg> -- React types the intrinsic, not the
// namespace, while the renderer still creates the node in the SVG namespace from its parent.
import type { MouseEvent } from "react";
import { buildMap, flightDots, legendGeometry, readout,
  gateSquare,
} from "../lib/map.mjs";
import type { DrawOp, MapRoomInput, MapStation } from "../lib/map.mjs";
import { buildHash, parseHash } from "../lib/shell.mjs";

export type MapRoomProps = {
  /** the registry exactly as `GET /api/rooms` served it -- all 33 rows, template included */
  rooms: MapRoomInput[];
  /** the Map room's own registry entry, which is where its opening sentence comes from */
  room?: MapRoomInput;
  /** the door's data mode: live · replay · sim. Unstated is drawn as unstated, never as live. */
  mode?: string;
  /** carried through into every station's href so navigating never drops the dev token */
  token?: string | null;
  /** roomId -> how many decisions are waiting on the owner there (REQ-04 gate squares) */
  needsYou?: Record<string, number>;
  /**
   * How many open decisions the contract could place in NO room. Counted separately and
   * shown in words, because a decision waiting on the owner that this map cannot draw is
   * the one thing a coverage-first product may never let disappear. Zero is the normal
   * case and says nothing; anything above zero is stated plainly.
   */
  needsYouUnplaced?: number;
  /** when given, a station click routes in-app instead of reloading on the fragment */
  onOpen?: (roomId: string) => void;
};

/**
 * The dev token, from the prop or from the address bar the door itself wrote. Every station
 * is a real link, and a link that drops the token navigates the owner into a 401 -- so when
 * the shell does not hand one over, this reads the one already in the fragment through the
 * SAME parser the shell uses. A second spelling of the fragment format here would be a
 * second thing to break.
 */
function currentToken(explicit: string | null | undefined): string | null {
  if (typeof explicit === "string" && explicit) return explicit;
  if (typeof window === "undefined") return null;
  return parseHash(window.location.hash).token;
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeMotion(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => undefined;
  const mq = window.matchMedia(REDUCED_MOTION);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function readMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return window.matchMedia(REDUCED_MOTION).matches;
}

// The server snapshot is `true` -- reduced. A surface that starts animating and is then told
// to stop has already broken the promise; starting still and never starting has not.
const serverMotion = (): boolean => true;

function Ops({ ops }: { ops: readonly DrawOp[] }): React.JSX.Element {
  return (
    <>
      {ops.map((op, i) => (
        <path
          key={i}
          className={`t-${op.tone}`}
          d={op.d}
          fill={op.fill ? "currentColor" : "none"}
          stroke={op.fill ? "none" : "currentColor"}
          strokeWidth={op.width || undefined}
          strokeDasharray={op.dash ?? undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </>
  );
}

export default function MapRoom({ rooms, room, mode, token = null, onOpen, needsYou = {}, needsYouUnplaced = 0 }: MapRoomProps): React.JSX.Element {
  const [active, setActive] = useState<string | null>(null);
  const reduced = useSyncExternalStore(subscribeMotion, readMotion, serverMotion);
  const linkToken = currentToken(token);

  const model = useMemo(() => buildMap(rooms, { mode, self: room ?? null }), [rooms, room, mode]);
  const legend = useMemo(() => legendGeometry(), []);
  // The dots are computed either way and dropped when motion is reduced, so the branch is
  // one expression rather than a fork through the render.
  const dots = useMemo(() => (reduced ? [] : flightDots(model)), [model, reduced]);
  const strip = readout(model, active);

  const open = useCallback(
    (id: string) => (e: MouseEvent<HTMLAnchorElement>) => {
      if (!onOpen) return;
      e.preventDefault();
      onOpen(id);
    },
    [onOpen],
  );

  const station = (s: MapStation): React.JSX.Element => (
    <a
      key={s.id}
      className="st"
      href={buildHash(s.id, linkToken)}
      tabIndex={0}
      aria-label={s.title}
      data-active={strip.id === s.id ? "yes" : "no"}
      onClick={open(s.id)}
      onFocus={() => setActive(s.id)}
      onBlur={() => setActive(null)}
      onMouseEnter={() => setActive(s.id)}
      onMouseLeave={() => setActive(null)}
    >
      <title>{s.title}</title>
      <circle className="hit" cx={s.x} cy={s.y} r={s.hitR} fill="transparent" />
      <circle className="focus" cx={s.x} cy={s.y} r={s.hitR - 4} fill="none" />
      <Ops ops={s.ops} />
      {/* The ONE reserved hue this map spends. Everywhere else it reads in stroke, shape
          and position, so that when amber appears it means exactly one thing: you are
          needed here. REQ-04's open-gate square. */}
      {(needsYou[s.id] ?? 0) > 0 ? (() => {
        const g = gateSquare(s, needsYou[s.id] ?? 0);
        return (
          <g className="gate">
            <title>{g.title}</title>
            <rect x={g.x} y={g.y} width={g.size} height={g.size} rx={1.5} />
            <text className="gatecount" x={g.x + g.size / 2} y={g.y + g.size - 2.5} textAnchor="middle">
              {g.label}
            </text>
          </g>
        );
      })() : null}
      <text className="lbl" x={s.label.x} y={s.label.y} textAnchor={s.label.anchor}>
        {s.label.text}
      </text>
    </a>
  );

  return (
    <section className="arc-map" aria-labelledby="map-sentence">
      <style>{CSS}</style>

      <header className="head">
        <div className="eyebrow">
          <span>command · map</span>
          <span
            className="mode"
            style={{ color: `var(${model.mode.token})`, backgroundImage: model.mode.background }}
          >
            {model.mode.label}
          </span>
        </div>
        <h1 id="map-sentence">{model.opening.sentence}</h1>
        <p className="lede">{model.opening.lede}</p>
      </header>

      <div className="frame" style={{ borderColor: `var(${model.mode.token})` }}>
        <div className="scroll">
          <svg
            className="canvas"
            viewBox={model.viewBox}
            role="group"
            aria-label={`Transit map of the company. ${model.summary.sentence}`}
            style={{ width: "100%", minWidth: model.width, height: "auto" }}
          >
            <desc>{model.summary.sentence}</desc>

            {model.lines.map((line) => (
              <g key={line.id} className="line" data-line={line.id}>
                <g className="plaque" aria-hidden="true">
                  <text className="plaque-name" x={line.plaque.x} y={line.plaque.y - 4} textAnchor="end">
                    {line.plaque.name}
                  </text>
                  <text className="plaque-count" x={line.plaque.x} y={line.plaque.y + 10} textAnchor="end">
                    {line.plaque.count}
                  </text>
                  <text className="plaque-lede" x={line.plaque.x} y={line.plaque.y + 23} textAnchor="end">
                    {line.plaque.lede}
                  </text>
                </g>

                {line.segments.map((seg) => (
                  <Ops key={`${seg.from}>${seg.to}`} ops={[seg.op]} />
                ))}
                <Ops ops={line.spurOp ? [line.spurOp] : []} />

                {line.stations.map(station)}
                {(line.spur ? [line.spur] : []).map(station)}
              </g>
            ))}

            {/* No cx/cy on the dot: animateMotion TRANSLATES the element, so any coordinate
                here would be added to the path position and float the dot off the line.
                map.mjs keeps it mid-journey with a negative begin instead. */}
            <g className="flight" aria-hidden="true">
              {dots.map((dot) => (
                <circle key={dot.lineId} r={dot.r} fill="currentColor">
                  <animateMotion dur={dot.dur} begin={dot.begin} repeatCount="indefinite" path={dot.d} />
                </circle>
              ))}
            </g>
          </svg>
        </div>
      </div>

      {needsYouUnplaced > 0 ? (
        <p className="unplaced" role="status">
          {needsYouUnplaced} decision{needsYouUnplaced === 1 ? " is" : "s are"} waiting on you
          that this map cannot place — the contract maps neither their gate nor their lane to
          a room. They are in the Inbox and they still need you; the gap is in the contract,
          not in the queue.
        </p>
      ) : null}

      <div className="readout" aria-live="polite">
        <div className="readout-head">
          <h2>{strip.title}</h2>
          <p>{strip.sub}</p>
        </div>
        <dl>
          {strip.rows.map((row) => (
            <div key={row.label} className="row">
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <section className="legend" aria-label="What every mark on this map means">
        <h2>Legend</h2>
        <ul>
          {legend.map((row) => (
            <li key={row.id}>
              <svg className="swatch" viewBox={`0 0 ${row.width} ${row.height}`} width={row.width} height={row.height} aria-hidden="true">
                <Ops ops={row.ops} />
              </svg>
              <div>
                <b>{row.label}</b>
                <span>{row.means}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}

// Every value here resolves through a token in ../tokens.css. There is not one literal
// colour in this file and there must never be one: a hex in a view is a second spelling of a
// reserved meaning, and reserved meanings are law rather than style.
const CSS = `
.arc-map { font-family: var(--font-display); color: var(--prose); }
.arc-map .head { max-width: 68ch; margin-bottom: calc(var(--grid) * 3); }
.arc-map .eyebrow {
  display: flex; align-items: center; gap: var(--grid);
  font-family: var(--font-mono); font-size: var(--step-meta);
  text-transform: uppercase; letter-spacing: var(--track-wide); color: var(--accent-dim);
  margin-bottom: calc(var(--grid) * 1.5);
}
.arc-map .mode {
  border: 1px solid currentColor; border-radius: var(--radius-pill);
  padding: 2px var(--grid); font-size: var(--step-micro); letter-spacing: var(--track-tight);
}
.arc-map h1 {
  font-size: var(--step-room); line-height: 1.04; letter-spacing: -0.01em;
  font-weight: 600; color: var(--prose); margin: 0 0 calc(var(--grid) * 1.5);
}
.arc-map .lede { font-size: var(--step-lede); line-height: 1.7; font-weight: 300; color: var(--meta); margin: 0; }

.arc-map .frame {
  background: var(--panel); backdrop-filter: blur(var(--panel-blur));
  -webkit-backdrop-filter: blur(var(--panel-blur));
  border: 1px solid var(--panel-border); border-radius: var(--radius-panel);
  padding: var(--pad-panel);
}
/* The map scrolls rather than shrinks. Scaling 33 stations down to fit a narrow panel is
   how a legible map becomes an unreadable one without anyone deciding to make it so. */
.arc-map .scroll { overflow-x: auto; overflow-y: hidden; }
.arc-map .canvas { display: block; }

.arc-map .t-line    { color: var(--accent-dim); }
.arc-map .t-station { color: var(--accent); }
.arc-map .t-dim     { color: var(--accent-line); }
.arc-map .t-faint   { color: var(--faint); }

.arc-map .plaque-name {
  font-family: var(--font-mono); font-size: var(--step-meta); fill: var(--prose);
  text-transform: uppercase; letter-spacing: var(--track-mid);
}
.arc-map .plaque-count { font-family: var(--font-mono); font-size: var(--step-micro); fill: var(--accent-dim); letter-spacing: var(--track-tight); }
.arc-map .plaque-lede  { font-family: var(--font-display); font-size: 9px; fill: var(--faint); font-weight: 300; }

.arc-map .st { cursor: pointer; }
.arc-map .st .lbl {
  font-family: var(--font-mono); font-size: var(--step-meta); fill: var(--prose);
  letter-spacing: 0.02em; transition: fill var(--dur-fast) var(--ease);
}
.arc-map .st .focus { stroke: var(--focus-ring); stroke-width: var(--focus-width); opacity: 0; }
.arc-map .st:focus { outline: none; }
.arc-map .st:focus-visible .focus { opacity: 1; }
.arc-map .st:hover .lbl,
.arc-map .st[data-active="yes"] .lbl { fill: var(--accent); }

/* The one reserved hue this map spends. Amber is needs-you and nothing else, so a square
   here is unambiguous the instant it appears. */
.arc-map .gate rect { fill: var(--amber); stroke: none; }
.arc-map .gate .gatecount {
  fill: var(--on-amber);
  font: 700 8px/1 var(--font-mono, monospace);
  letter-spacing: 0;
  pointer-events: none;
}
.arc-map .st[data-active="yes"] .focus { opacity: 0.55; }

.arc-map .flight { color: var(--accent); }

.arc-map .unplaced {
  margin: 12px 0 0;
  padding: 10px 12px;
  border: 1px solid var(--amber);
  border-radius: 8px;
  color: var(--amber);
  font: 400 12px/1.5 var(--font-mono, monospace);
  max-width: 72ch;
}
.arc-map .readout {
  margin-top: calc(var(--grid) * 2);
  border: 1px solid var(--hairline-strong); border-radius: var(--radius-panel);
  background: var(--panel); padding: var(--pad-panel);
}
.arc-map .readout-head h2 {
  margin: 0 0 var(--grid-in); font-size: var(--step-lede); font-weight: 600; color: var(--accent);
}
.arc-map .readout-head p { margin: 0 0 calc(var(--grid) * 2); font-size: var(--step-body); line-height: 1.6; color: var(--meta); max-width: 82ch; }
.arc-map .readout dl { margin: 0; display: grid; gap: var(--grid-in); }
.arc-map .readout .row { display: grid; grid-template-columns: 15ch 1fr; gap: var(--grid); align-items: baseline; }
.arc-map .readout dt {
  font-family: var(--font-mono); font-size: var(--step-meta); color: var(--faint);
  text-transform: uppercase; letter-spacing: var(--track-mid);
}
.arc-map .readout dd { margin: 0; font-size: var(--step-data); color: var(--prose); font-variant-numeric: var(--numeric); }

.arc-map .legend { margin-top: calc(var(--grid) * 2); }
.arc-map .legend h2 {
  font-family: var(--font-mono); font-size: var(--step-meta); color: var(--accent);
  text-transform: uppercase; letter-spacing: var(--track-wide); margin: 0 0 calc(var(--grid) * 1.5);
}
.arc-map .legend ul { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--grid); grid-template-columns: repeat(auto-fit, minmax(330px, 1fr)); }
.arc-map .legend li { display: grid; grid-template-columns: 54px 1fr; gap: var(--grid); align-items: start; border-top: 1px solid var(--hairline); padding-top: var(--grid); }
.arc-map .legend .swatch { color: var(--accent-dim); margin-top: 2px; }
.arc-map .legend b {
  display: block; font-family: var(--font-mono); font-size: var(--step-meta); font-weight: 500;
  color: var(--prose); text-transform: uppercase; letter-spacing: var(--track-mid); margin-bottom: 3px;
}
.arc-map .legend span { display: block; font-size: var(--step-data); line-height: 1.55; color: var(--meta); font-weight: 300; }
`;
