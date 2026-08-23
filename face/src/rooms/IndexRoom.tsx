// IndexRoom.tsx -- the renderer for `render: "index"` rooms: org and concepts.
//
// These two are not slices. Every other room shows you a part of the company; an index room
// shows you the WHOLE inventory it is named for -- all sixteen lanes, all 107 terms -- and
// that is why they need a renderer of their own rather than a generic zone grid. A paged or
// filtered index would defeat the only claim it makes.
//
// The endpoint set is closed (phase-06 spec: no new L2 route), so both inventories come out
// of doors that already exist: lanes from GET /api/board, the vocabulary from the
// allow-listed GET /api/file/expected-set -- the same frozen contract `face-coverage`
// checks, so this room cannot disagree with the gate.
//
// Every decision -- which route, how to narrow an untrusted body, how to group and order,
// what counts as missing -- is in rooms.mjs. What is left here is React plumbing: three
// render states, and the shapes the lib already decided.
import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { Door } from "../lib/door.mjs";
import type { Room } from "../lib/rooms.mjs";
import { conceptGroups, displayValue, indexSource, laneRoster, unescapeDoorText } from "../lib/rooms.mjs";
import { Chip, Failure, Field, Hairline, Loading, Panel, PanelTitle, Receipt, RoomHead } from "../ui/kit";

type Read =
  | { phase: "loading" }
  | { phase: "error"; error: unknown }
  | { phase: "ready"; data: unknown };

/**
 * One read through the door, with the two states that are not optional.
 *
 * The dependency list is `base` and `token` rather than the client object itself: a shell
 * that builds a fresh `new Door(...)` on each render would otherwise refetch on every
 * render forever. Two clients with the same origin and the same token are the same client
 * for this purpose, and the abort on cleanup means a route change cannot land its answer
 * after the next one.
 */
function useDoorRead(door: Door, route: string | null): Read {
  const [read, setRead] = useState<Read>({ phase: "loading" });
  const { base, token } = door;

  useEffect(() => {
    if (route === null) return;
    const control = new AbortController();
    let live = true;
    setRead({ phase: "loading" });
    door
      .call(route, { signal: control.signal })
      .then((data: unknown) => {
        if (live) setRead({ phase: "ready", data });
      })
      .catch((error: unknown) => {
        // An aborted read is this component tidying up, not a failure to report.
        if (live && !control.signal.aborted) setRead({ phase: "error", error });
      });
    return () => {
      live = false;
      control.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see the note above: identity
    // of `door` is not the thing that changes what this reads.
  }, [route, base, token]);

  return read;
}

const monoFace: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontVariantNumeric: "var(--numeric)",
};

function CountLine({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        ...monoFace,
        fontSize: "var(--step-meta)",
        color: "var(--faint)",
        lineHeight: 1.7,
      }}
    >
      {children}
    </div>
  );
}

/**
 * A shortfall is stated, never absorbed. The contract says sixteen lanes and 107 terms; if
 * the door serves fewer, the page says how many are not here. A short inventory rendered as
 * a complete one is the exact failure "nothing is missing" is supposed to make impossible.
 */
function Shortfall({ counted, expected, what }: { counted: number; expected: number; what: string }) {
  const gap = displayValue(expected - counted);
  return (
    <Panel tone="file" style={{ marginBottom: "calc(var(--grid) * 2)" }}>
      <PanelTitle tone="file">incomplete inventory</PanelTitle>
      <p
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--step-body)",
          fontWeight: 300,
          lineHeight: 1.7,
          color: "var(--prose)",
          margin: 0,
          maxWidth: "70ch",
        }}
      >
        The contract declares {displayValue(expected).text} {what}; this read returned{" "}
        {displayValue(counted).text}. {gap.text} are not on this page, and this room will not
        pretend otherwise — a full-looking list is how a gap stops being findable.
      </p>
    </Panel>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// org — the company as a roster. Sixteen lanes, each with the one thing it is
// waiting on.
//
// On colour: LIVE takes --accent, which carries no meaning and is free to
// emphasise anything. BLOCKED is deliberately NEUTRAL -- not --red, which is
// reserved for an incident and stays unspent until incident.raised fires, and
// not --amber, which means needs-you. A blocked lane is neither by default, and
// colouring it as one would be the surface inventing an urgency the log never
// recorded.
// ─────────────────────────────────────────────────────────────────────────────
function LaneBoard({ payload, rooms, expected }: { payload: unknown; rooms: Room[]; expected: number }) {
  const roster = laneRoster(payload, rooms, expected);
  if (!roster.ok) return <Failure error={roster} what="the lane board" />;

  return (
    <>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "calc(var(--grid) * 1.5)",
          marginBottom: "calc(var(--grid) * 3)",
        }}
      >
        <Receipt title="PORTFOLIO.md orders the rows; every value is read from that lane's own PROGRESS.md machine header (ADR-0051)">
          PORTFOLIO.md → initiatives/*/PROGRESS.md
        </Receipt>
        <Chip tone="file" title="read from the tree, not from the spine — as-of does not apply">
          file, not log
        </Chip>
        <CountLine>
          {displayValue(roster.counted).text} lanes · board updated {displayValue(roster.updated).text}
        </CountLine>
      </div>

      {roster.shortfall > 0 ? (
        <Shortfall counted={roster.counted} expected={roster.expected} what="lanes" />
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "calc(var(--grid) * 2)",
          alignItems: "start",
        }}
      >
        {roster.rows.map((row) => (
          <Panel key={row.lane} tone={row.status === "LIVE" ? "live" : "plain"}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "var(--grid)",
                marginBottom: "calc(var(--grid) * 2)",
              }}
            >
              <span
                style={{
                  ...monoFace,
                  fontSize: "var(--step-data)",
                  color: "var(--accent)",
                  letterSpacing: "var(--track-tight)",
                }}
              >
                {row.lane}
              </span>
              <Chip tone={row.status === "LIVE" ? "live" : "file"} title="from the lane's PROGRESS.md machine header">
                {displayValue(row.status).text}
              </Chip>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: "var(--grid)",
                marginBottom: "calc(var(--grid) * 2)",
              }}
            >
              <Field label="phase" value={row.phase} />
              <Field label="burn" value={row.burn} />
              <Field label="appetite" value={row.appetite} />
            </div>

            <Hairline />

            <div style={{ marginTop: "calc(var(--grid) * 2)" }}>
              <div
                style={{
                  ...monoFace,
                  fontSize: "var(--step-micro)",
                  textTransform: "uppercase",
                  letterSpacing: "var(--track-mid)",
                  color: "var(--faint)",
                  marginBottom: "3px",
                }}
              >
                waiting on
              </div>
              <p
                title={row.blockedOn ?? "this lane's header carries no blocked-on line"}
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--step-body)",
                  fontWeight: 300,
                  lineHeight: 1.6,
                  color: row.blockedOn === null ? "var(--faint)" : "var(--prose)",
                  margin: 0,
                  // Clamped, with the whole sentence on the title attribute. A blocked-on
                  // line can run to a paragraph; sixteen paragraphs is not a roster.
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: 3,
                  overflow: "hidden",
                }}
              >
                {displayValue(row.blockedOn).text}
              </p>
            </div>

            <div style={{ marginTop: "calc(var(--grid) * 2)" }}>
              {row.room === null ? (
                <CountLine>no room in the registry homes this lane</CountLine>
              ) : (
                <CountLine>
                  opens into {row.room.name} · {row.room.id}
                </CountLine>
              )}
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// concepts — every word arc uses, and the room it lives in.
//
// Grouped by room in registry order, which is ring order, which is the order the
// owner reads the company in. A term whose room is not in the registry is a ⌘K
// result that opens nothing: those are counted and drawn LAST and labelled,
// never quietly dropped.
// ─────────────────────────────────────────────────────────────────────────────
function Vocabulary({ payload, rooms, expected }: { payload: unknown; rooms: Room[]; expected: number }) {
  const index = conceptGroups(payload, rooms, expected);
  if (!index.ok) return <Failure error={index} what="the vocabulary" />;

  const sha = displayValue(index.sha256);
  return (
    <>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "calc(var(--grid) * 1.5)",
          marginBottom: "calc(var(--grid) * 3)",
        }}
      >
        <Receipt title="the frozen coverage contract itself, served from the door's allow-list — the same file face-coverage validates">
          {displayValue(index.path).text}
        </Receipt>
        <Receipt tone="file" title={sha.missing ? "the door returned no digest for this file" : `sha256 ${sha.text}`}>
          {sha.missing ? sha.text : `sha ${sha.text.slice(0, 12)}`}
        </Receipt>
        <Chip tone="file" title="read from the tree, not from the spine — as-of does not apply">
          file, not log
        </Chip>
        <CountLine>
          {displayValue(index.total).text} terms · {displayValue(index.groups.length).text} rooms
          {index.orphans > 0 ? ` · ${displayValue(index.orphans).text} homed in a room that does not exist` : ""}
        </CountLine>
      </div>

      {index.shortfall > 0 ? (
        <Shortfall counted={index.total} expected={index.expected} what="terms" />
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "calc(var(--grid) * 2)",
          alignItems: "start",
        }}
      >
        {index.groups.map((group) => (
          <Panel key={group.roomId || "unhomed"} tone={group.roomName === null ? "file" : "plain"}>
            <PanelTitle tone={group.roomName === null ? "file" : "plain"} count={group.terms.length}>
              {group.roomName ?? `${group.roomId || "no room"} — not in the registry`}
            </PanelTitle>

            {group.template ? (
              <CountLine>template — a shape every lane instantiates, not a room you can open</CountLine>
            ) : null}
            {group.roomName === null ? (
              <CountLine>these terms name a room this shell cannot open — a search result that goes nowhere</CountLine>
            ) : null}

            <dl style={{ margin: "calc(var(--grid) * 1.5) 0 0 0" }}>
              {group.terms.map((row) => (
                <div
                  key={row.term}
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: "var(--grid)",
                    padding: "6px 0",
                    borderTop: "1px solid var(--hairline)",
                  }}
                >
                  {/* the term is a word a human chose -- display face; the station is a
                      name out of the contract -- mono. That split is the type system. */}
                  <dt
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "var(--step-body)",
                      color: "var(--prose)",
                      minWidth: 0,
                      overflowWrap: "anywhere",
                    }}
                  >
                    {row.term}
                  </dt>
                  <dd
                    style={{
                      ...monoFace,
                      fontSize: "var(--step-meta)",
                      color: row.station === null ? "var(--faint)" : "var(--meta)",
                      margin: 0,
                      textAlign: "right",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {displayValue(row.station).text}
                  </dd>
                </div>
              ))}
            </dl>
          </Panel>
        ))}
      </div>
    </>
  );
}

export function IndexRoom({ room, rooms, door }: { room: Room; rooms: Room[]; door: Door }) {
  const source = indexSource(room);
  const read = useDoorRead(door, source.route);
  const what = `every ${unescapeDoorText(room.indexes) || "entry"} in the company`;

  return (
    <article
      style={{
        fontFamily: "var(--font-display)",
        color: "var(--prose)",
        maxWidth: "1180px",
        margin: "0 auto",
        padding: "calc(var(--grid) * 5) calc(var(--grid) * 3) calc(var(--grid) * 10)",
      }}
    >
      <RoomHead room={room} />

      {source.refusal !== null ? (
        <Failure error={source.refusal} what={what} />
      ) : read.phase === "loading" ? (
        <Loading what={what} />
      ) : read.phase === "error" ? (
        <Failure error={read.error} what={what} />
      ) : source.inventory === "lanes" ? (
        <LaneBoard payload={read.data} rooms={rooms} expected={room.itemCount} />
      ) : (
        <Vocabulary payload={read.data} rooms={rooms} expected={room.itemCount} />
      )}
    </article>
  );
}

export default IndexRoom;
