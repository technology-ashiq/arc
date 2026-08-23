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
import type { Room } from "../lib/rooms.mjs";
import { absence, displayValue, unescapeDoorText, zonesFor } from "../lib/rooms.mjs";
import { Chip, Hairline, Panel, PanelTitle, Receipt, RoomHead, Zone } from "../ui/kit";

export function GenericRoom({ room }: { room: Room }) {
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

export default GenericRoom;
