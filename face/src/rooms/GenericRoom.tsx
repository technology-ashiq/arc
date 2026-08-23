// GenericRoom.tsx -- the renderer for every room with `render: "generic"`.
//
// Twenty-two of the thirty-three rooms come through here. That is the finding room-map.md
// D6 turns into a build order: most of the fourteen missing rooms were a RENDERING job, not
// a design job, because Phase 05 already put a `face:` section in all sixteen manifests and
// the contract already says what each room holds. This file is the 6-zone lane template of
// ADR-1306 generalised to every room.
//
// It decides nothing. The zones, their order, which of them exist, what the room's state is
// called and which kind of nothing an empty room is showing are all `rooms.mjs` -- because
// CI can import that file with plain `node` and cannot import this one at all.
//
// The one rule that outranks looking good here: an empty room must say WHICH KIND of empty
// it is. Fourteen convincing empty rooms would be worse than fourteen missing ones (D7).
import { useEffect, useState } from "react";
import type { Room } from "../lib/rooms.mjs";
import { absence, displayValue, lanePhases, unescapeDoorText, zonesFor } from "../lib/rooms.mjs";
import type { Door } from "../lib/door.mjs";
import { Chip, Hairline, Panel, PanelTitle, Receipt, RoomHead, Zone } from "../ui/kit";

export function GenericRoom({ room, door, lane }: { room: Room; door?: Door; lane?: string | null }) {
  const zones = zonesFor(room);
  const nothing = absence(room);
  const stations = room.stations ?? [];
  const declared = displayValue(room.itemCount);

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

      {lane && door ? <Phases door={door} lane={lane} /> : null}

      {stations.length > 0 ? (
        <div style={{ marginBottom: "calc(var(--grid) * 3)" }}>
          <Panel>
            <PanelTitle count={stations.length}>Stations</PanelTitle>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--grid)" }}>
              {stations.map((station) => (
                <Chip key={station} tone="live" title="a platform in this room — where the Map stops">
                  {unescapeDoorText(station)}
                </Chip>
              ))}
            </div>
          </Panel>
        </div>
      ) : null}

      {nothing === null ? (
        <div
          style={{
            display: "grid",
            // auto-fit + minmax rather than a breakpoint: inline styles carry no @media,
            // and a zone grid that reflows on container width needs neither.
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "calc(var(--grid) * 2)",
            alignItems: "start",
          }}
        >
          {zones.map((zone) => (
            <Zone key={zone.key} zone={zone} />
          ))}
        </div>
      ) : (
        <Panel tone="file">
          <PanelTitle tone="file">{nothing.label}</PanelTitle>
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
            {nothing.detail}
          </p>
        </Panel>
      )}

      <footer style={{ marginTop: "calc(var(--grid) * 5)" }}>
        <Hairline />
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "calc(var(--grid) * 1.5)",
            marginTop: "calc(var(--grid) * 2)",
          }}
        >
          {/* Every count carries its source. The number is not this file's opinion: it is
              the contract's own itemCount, served through the door with the room. */}
          <Receipt title="the generated room registry, served verbatim by GET /api/rooms">
            rooms.generated.json
          </Receipt>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontVariantNumeric: "var(--numeric)",
              fontSize: "var(--step-meta)",
              color: "var(--faint)",
            }}
          >
            {declared.text} declared · {zones.length} zones drawn · status {unescapeDoorText(room.status)}
          </span>
        </div>
      </footer>
    </article>
  );
}

/**
 * What the lane's phases PROMISED, read from the door (ADR-1317).
 *
 * A lane room named `phase 04` in its stations and rendered nothing behind it for a whole
 * cycle: the 107 specs sat in the directory `apiLane` already read, and nothing asked for
 * them. So the owner opening a lane mid-cycle got the tracker's one-line summary of the phase
 * instead of the phase, which is the summary of a promise rather than the promise.
 *
 * THREE STATES, NOT TWO. A door that does not carry the field is ABSENT and says so; a lane
 * with no specs yet is NONE. Drawing the second from the first is the lie this product exists
 * to refuse, and it is why the door sends an explicit empty array rather than omitting a key.
 */
function Phases({ door, lane }: { door: Door; lane: string }) {
  const [state, setState] = useState<{ phase: "loading" } | { phase: "ok"; body: unknown } | { phase: "error" }>({ phase: "loading" });
  useEffect(() => {
    const ac = new AbortController();
    // The `aborted` guard is what makes this survive StrictMode's mount/unmount/mount in dev:
    // effect #1's fetch rejects with an AbortError that must NOT become a visible failure, and
    // only effect #2's result may set state.
    door.lane(lane, ac.signal)
      .then((body: unknown) => { if (!ac.signal.aborted) setState({ phase: "ok", body }); })
      .catch(() => { if (!ac.signal.aborted) setState({ phase: "error" }); });
    return () => ac.abort();
  }, [door, lane]);

  if (state.phase === "loading") return null;
  if (state.phase === "error") {
    return (
      <div style={{ marginBottom: "calc(var(--grid) * 3)" }}>
        <Panel>
          <PanelTitle>Phases</PanelTitle>
          <p style={{ fontSize: "var(--step-meta)", color: "var(--faint)", margin: 0 }}>
            the door did not answer for lane <b>{lane}</b>, so this room cannot say what its phases
            promised. That is a fact about this read, not about the lane.
          </p>
        </Panel>
      </div>
    );
  }

  const read = lanePhases(state.body);
  if (read.state === "absent") return null; // an older door; say nothing rather than guess
  return (
    <div style={{ marginBottom: "calc(var(--grid) * 3)" }}>
      <Panel>
        <PanelTitle count={read.state === "none" ? undefined : read.phases.length}>Phases</PanelTitle>
        {read.state === "none" ? (
          <p style={{ fontSize: "var(--step-meta)", color: "var(--faint)", margin: 0 }}>
            lane <b>{lane}</b> has no phase specs on this tree. A measured none, not an unread one
            — the directory was there and it was empty.
          </p>
        ) : (
          <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {read.phases.map((p) => (
              <li key={p.file} style={{ borderTop: "1px solid var(--hairline)", padding: "calc(var(--grid) * 1) 0" }}>
                <details>
                  <summary style={{ cursor: "pointer", fontSize: "var(--step-meta)" }}>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--faint)", marginRight: ".75em" }}>
                      {p.phase === null ? "—" : String(p.phase).padStart(2, "0")}
                    </span>
                    {p.title === null ? <em style={{ color: "var(--faint)" }}>{p.file} (no heading)</em> : unescapeDoorText(p.title)}
                  </summary>
                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--step-micro)",
                      color: "var(--meta)",
                      margin: "calc(var(--grid) * 1) 0 0",
                      maxHeight: "32rem",
                      overflowY: "auto",
                    }}
                  >
                    {unescapeDoorText((p as { text?: string }).text ?? "")}
                    {(p as { truncated?: boolean }).truncated ? "\n\n[this spec was clipped by the door cap]" : ""}
                  </pre>
                </details>
              </li>
            ))}
          </ol>
        )}
        {read.omitted > 0 ? (
          <p style={{ fontSize: "var(--step-micro)", color: "var(--faint)", marginTop: "calc(var(--grid) * 1)" }}>
            {read.omitted} more spec(s) were not listed — the door caps the list, and says so rather
            than truncating in silence.
          </p>
        ) : null}
      </Panel>
    </div>
  );
}

export default GenericRoom;
