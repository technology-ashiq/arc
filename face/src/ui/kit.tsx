// kit.tsx -- the one surface vocabulary every non-bespoke room is built out of.
//
// The visual language is the OWNER'S REFERENCE, read from
// docs/design/reference/face-hq/assets/arcface/src/ui/kit.jsx: a near-black ground, a
// translucent slab floating over the particle face, mono for anything the machine wrote
// and the display face for anything a human wrote, and the receipt chip as the signature
// -- every claim carries its source.
//
// Three things are deliberately NOT the reference:
//
//  1. NO LITERAL COLOURS. The reference hard-codes '#00ffd1' inline in twenty places; that
//     is correct for a reference and wrong for the product, because a second spelling of a
//     colour is how a reserved meaning rots. Every colour here is a var() from tokens.css.
//
//  2. NO TAILWIND, NO .css IMPORT. face/ has no CSS framework and src carries no ambient
//     declaration for a stylesheet import, so a `.css`/`.module.css` import would not type
//     -check. Styling is inline style objects over the tokens. What that costs is written
//     down where it bites (see LIMITS at the foot of this file).
//
//  3. THE RESERVED FOUR ARE LAW HERE. --amber is needs-you, --green is real money, --red
//     is an incident, --violet is the non-real family and always carries --sim-hatch.
//     Three of the four appear NOWHERE in this file: nothing a generic room draws is a
//     request for the owner's attention, a rupee, or an incident. Violet appears only for
//     the "sim" tone `stateBadge` itself assigns, and never without the hatch. Everything
//     else -- titles, borders, chips, counts, rules, receipts -- is --accent, which carries
//     no meaning at all. That is exactly why the four survive intact.
import type { CSSProperties, ReactNode } from "react";
import type { Room } from "../lib/rooms.mjs";
import { displayValue, errorSentence, headNotes, stateBadge, unescapeDoorText } from "../lib/rooms.mjs";

/**
 * The tones a surface can take. These are the four `stateBadge` returns plus `plain`, so a
 * component never has to translate between two vocabularies for the same idea.
 * `live` is the product colour, NOT green: liveness is a statement about the data source,
 * and --green is reserved for real money (tokens.css, collision 3).
 */
export type Tone = "live" | "sim" | "file" | "index" | "plain";

const FG: Record<Tone, string> = {
  live: "var(--mode-live)",
  sim: "var(--sim-fg)",
  file: "var(--meta)",
  index: "var(--accent-dim)",
  plain: "var(--accent)",
};

const LINE: Record<Tone, string> = {
  live: "var(--accent-line)",
  sim: "var(--sim-line)",
  file: "var(--hairline-strong)",
  index: "var(--accent-line)",
  plain: "var(--panel-border)",
};

const mono: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontVariantNumeric: "var(--numeric)",
};

const display: CSSProperties = { fontFamily: "var(--font-display)" };

// ─────────────────────────────────────────────────────────────────────────────
// Panel — the raised glass slab. The face stays visible THROUGH the UI rather
// than being covered by it, which is the whole reason the ground is true black.
// ─────────────────────────────────────────────────────────────────────────────
export function Panel({
  children,
  tone = "plain",
  style,
}: {
  children: ReactNode;
  tone?: Tone;
  style?: CSSProperties;
}) {
  return (
    <section
      style={{
        position: "relative",
        background: "var(--panel)",
        backdropFilter: "blur(var(--panel-blur))",
        WebkitBackdropFilter: "blur(var(--panel-blur))",
        border: `1px solid ${LINE[tone]}`,
        borderRadius: "var(--radius-panel)",
        padding: "var(--pad-panel)",
        minWidth: 0,
        ...style,
      }}
    >
      {children}
    </section>
  );
}

export function PanelTitle({
  children,
  tone = "plain",
  count,
}: {
  children: ReactNode;
  tone?: Tone;
  count?: number;
}) {
  const n = count === undefined ? null : displayValue(count);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: "var(--grid)",
        marginBottom: "calc(var(--grid) * 2)",
      }}
    >
      <span
        style={{
          ...mono,
          fontSize: "var(--step-meta)",
          textTransform: "uppercase",
          letterSpacing: "var(--track-wide)",
          color: FG[tone],
        }}
      >
        {children}
      </span>
      {n === null ? null : (
        <span style={{ ...mono, fontSize: "var(--step-micro)", color: "var(--faint)" }}>{n.text}</span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chip — one item out of an inventory. Mono by default because almost everything
// a room holds is a name the machine wrote: a kind, a lane, a command, an agent.
// ─────────────────────────────────────────────────────────────────────────────
export function Chip({
  children,
  tone = "plain",
  face = "mono",
  title,
}: {
  children: ReactNode;
  tone?: Tone;
  face?: "mono" | "display";
  title?: string;
}) {
  return (
    <span
      title={title}
      style={{
        ...(face === "mono" ? mono : display),
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--grid-in)",
        fontSize: "var(--step-data)",
        lineHeight: 1.35,
        color: tone === "plain" ? "var(--prose)" : FG[tone],
        border: `1px solid ${LINE[tone]}`,
        borderRadius: "var(--radius-chip)",
        padding: "5px 10px",
        maxWidth: "100%",
        overflowWrap: "anywhere",
      }}
    >
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Receipt — the signature element. A small mono chip that proves a claim by
// naming where it came from. Every count on a page carries one.
// ─────────────────────────────────────────────────────────────────────────────
export function Receipt({
  children,
  tone = "plain",
  title,
}: {
  children: ReactNode;
  tone?: Tone;
  title?: string;
}) {
  return (
    <span
      title={title}
      style={{
        ...mono,
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "var(--step-meta)",
        color: tone === "plain" ? "var(--accent)" : FG[tone],
        border: `1px solid ${LINE[tone]}`,
        borderRadius: "var(--radius-chip)",
        background: "var(--panel)",
        padding: "4px 9px",
        verticalAlign: "middle",
        overflowWrap: "anywhere",
      }}
    >
      <span aria-hidden="true" style={{ opacity: 0.85 }}>
        &#8983;
      </span>
      {children}
    </span>
  );
}

/**
 * The hatched marker of the non-real family. Hue alone is not enough -- a reader who
 * cannot see the violet still gets the texture, which is why tokens.css defines
 * --sim-hatch as a line pattern rather than a tint.
 */
function HatchDot() {
  return (
    <span
      aria-hidden="true"
      style={{
        width: "9px",
        height: "9px",
        flex: "0 0 auto",
        borderRadius: "var(--radius-pill)",
        border: "1px solid var(--sim-line)",
        backgroundImage: "var(--sim-hatch)",
      }}
    />
  );
}

function Dot({ tone }: { tone: Tone }) {
  if (tone === "sim") return <HatchDot />;
  return (
    <span
      aria-hidden="true"
      style={{
        width: "7px",
        height: "7px",
        flex: "0 0 auto",
        borderRadius: "var(--radius-pill)",
        background: FG[tone],
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StateBadge — the honest state, and the most load-bearing component in the kit.
//
// A room whose kinds have never fired renders "unexercised", not a 0. The
// difference is the entire Truth Law: "0" cannot tell "measured, and it is zero"
// apart from "this has never run". The decision is `stateBadge` in rooms.mjs;
// this only draws what it decided.
// ─────────────────────────────────────────────────────────────────────────────
export function StateBadge({ room }: { room: Room }) {
  const badge = stateBadge(room);
  return (
    <span
      title={badge.title}
      style={{
        ...mono,
        display: "inline-flex",
        alignItems: "center",
        gap: "7px",
        fontSize: "var(--step-meta)",
        textTransform: "uppercase",
        letterSpacing: "var(--track-tight)",
        color: FG[badge.tone],
        border: `1px solid ${LINE[badge.tone]}`,
        borderRadius: "var(--radius-pill)",
        padding: "5px 12px",
        whiteSpace: "nowrap",
      }}
    >
      <Dot tone={badge.tone} />
      {badge.label}
    </span>
  );
}

export function Hairline({ tone = "plain" }: { tone?: Tone }) {
  return (
    <div
      aria-hidden="true"
      style={{
        height: "1px",
        width: "100%",
        background:
          tone === "sim"
            ? "var(--sim-hatch)"
            : `linear-gradient(to right, transparent, ${LINE[tone]}, transparent)`,
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Field — a labelled value that never renders a blank cell. `displayValue` is
// the rule: a measured 0 prints 0, an absent value prints MISSING and looks
// absent. A blank and a zero are the two ways a table lies about not knowing.
// ─────────────────────────────────────────────────────────────────────────────
export function Field({
  label,
  value,
  title,
}: {
  label: string;
  value: string | number | null | undefined;
  title?: string;
}) {
  const v = displayValue(value);
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          ...mono,
          fontSize: "var(--step-micro)",
          textTransform: "uppercase",
          letterSpacing: "var(--track-mid)",
          color: "var(--faint)",
          marginBottom: "3px",
        }}
      >
        {label}
      </div>
      <div
        title={title}
        style={{
          ...mono,
          fontSize: "var(--step-data)",
          color: v.missing ? "var(--faint)" : "var(--prose)",
          overflowWrap: "anywhere",
        }}
      >
        {v.text}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RoomHead — every room opens with a SENTENCE, not a title. That is the single
// strongest thing in the owner's reference and it is what keeps this from
// reading as a dashboard. The name is an eyebrow above it, not the headline.
// ─────────────────────────────────────────────────────────────────────────────
export function RoomHead({ room, children }: { room: Room; children?: ReactNode }) {
  const badge = stateBadge(room);
  return (
    <header style={{ marginBottom: "calc(var(--grid) * 4)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "calc(var(--grid) * 1.5)",
          flexWrap: "wrap",
          marginBottom: "calc(var(--grid) * 2)",
        }}
      >
        <span
          style={{
            ...mono,
            fontSize: "var(--step-meta)",
            textTransform: "uppercase",
            letterSpacing: "var(--track-wide)",
            color: "var(--accent-dim)",
          }}
        >
          {room.ring} · {room.id}
        </span>
        <span
          aria-hidden="true"
          style={{ height: "1px", flex: "1 1 40px", maxWidth: "120px", background: "var(--accent-line)" }}
        />
        <StateBadge room={room} />
      </div>

      <h1
        style={{
          ...display,
          fontSize: "var(--step-room)",
          fontWeight: 600,
          lineHeight: 1.05,
          letterSpacing: "-0.01em",
          color: "var(--prose)",
          margin: "0 0 calc(var(--grid) * 2) 0",
          maxWidth: "22ch",
        }}
      >
        {unescapeDoorText(room.sentence)}
      </h1>

      <p
        style={{
          ...display,
          fontSize: "var(--step-lede)",
          fontWeight: 300,
          lineHeight: 1.65,
          color: "var(--meta)",
          margin: "0 0 calc(var(--grid) * 2) 0",
          maxWidth: "70ch",
        }}
      >
        {unescapeDoorText(room.lede)}
      </p>

      {/* The state, spelled out. The badge is a word; this is the sentence behind it, and
          for an unexercised room it is the one that matters: built and tested, never run. */}
      <p
        style={{
          ...mono,
          fontSize: "var(--step-meta)",
          lineHeight: 1.6,
          color: badge.tone === "sim" ? "var(--sim-fg)" : "var(--faint)",
          margin: 0,
          maxWidth: "82ch",
        }}
      >
        {badge.label} — {badge.title}
      </p>

      {badge.tone === "sim" ? (
        <div style={{ marginTop: "var(--grid)", maxWidth: "82ch" }}>
          <Hairline tone="sim" />
        </div>
      ) : null}

      <ul
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "calc(var(--grid) * 2)",
          listStyle: "none",
          padding: 0,
          margin: "calc(var(--grid) * 2) 0 0 0",
        }}
      >
        {headNotes(room).map((note) => (
          <li key={note} style={{ ...mono, fontSize: "var(--step-micro)", color: "var(--faint)" }}>
            {note}
          </li>
        ))}
      </ul>

      {children}
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Zone — one slab of the 6-zone lane template (ADR-1306) generalised. The room's
// own inventory decides which zones exist; this never draws an empty one,
// because `zonesFor` never hands it one.
// ─────────────────────────────────────────────────────────────────────────────
export function Zone({ zone }: { zone: { key: string; title: string; items: string[] } }) {
  return (
    <Panel>
      <PanelTitle count={zone.items.length}>{zone.title}</PanelTitle>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--grid)" }}>
        {zone.items.map((item) => (
          <Chip key={item} title={`${zone.key} · ${unescapeDoorText(item)}`}>
            {unescapeDoorText(item)}
          </Chip>
        ))}
      </div>
    </Panel>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading / Failure — mandatory, and neither is allowed to be vague.
//
// Failure shows the door's own refusal sentence AND its code, verbatim. The door
// refuses BY NAME and each name means a different thing the owner might do next;
// a client that collapses them into "something went wrong" throws away the only
// part that was actionable. Note the tone: a refused read is not an incident, so
// it is NOT --red. --red is reserved for incident.raised and stays unspent.
// ─────────────────────────────────────────────────────────────────────────────
export function Loading({ what }: { what: string }) {
  return (
    <Panel>
      <PanelTitle>reading</PanelTitle>
      <p style={{ ...mono, fontSize: "var(--step-data)", color: "var(--meta)", margin: 0 }}>
        waiting for {what} from the door…
      </p>
    </Panel>
  );
}

export function Failure({ error, what }: { error: unknown; what: string }) {
  const said = errorSentence(error);
  return (
    <Panel tone="file">
      <PanelTitle tone="file">could not read {what}</PanelTitle>
      <p
        style={{
          ...display,
          fontSize: "var(--step-body)",
          fontWeight: 300,
          lineHeight: 1.6,
          color: "var(--prose)",
          margin: "0 0 calc(var(--grid) * 2) 0",
          maxWidth: "70ch",
        }}
      >
        {said.human}
      </p>
      <Receipt tone="file" title="the door's own refusal code, verbatim">
        {said.code}
      </Receipt>
    </Panel>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LIMITS of the inline-style approach, written down rather than discovered:
//   · no :hover, no ::before, no @keyframes. Nothing in these two rooms depends
//     on a hover to be understood -- every truncated value carries a title
//     attribute instead, which works on touch and for a screen reader.
//   · no @media. Every grid here is `repeat(auto-fit, minmax(...))`, which
//     reflows on container width without a breakpoint.
//   · :focus-visible is already global in tokens.css, so keyboard focus works
//     without a rule here.
// If a room ever needs a real stylesheet, the missing piece is an ambient module
// declaration for "*.module.css" -- one .d.ts, and it belongs to whoever owns
// the app shell, not to this file.
// ─────────────────────────────────────────────────────────────────────────────
