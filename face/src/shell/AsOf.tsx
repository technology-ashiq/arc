import type { CSSProperties } from 'react'
import { asOfState } from '../lib/shell.mjs'

/**
 * The as-of scrub (REQ-05).
 *
 * A date, not a slider. A slider implies every point between two days is a place you can
 * stand, and it is not: the spine is a sequence of DAYS, sealed one at a time, and a control
 * that suggests otherwise is a nicer lie than a plainer one.
 *
 * What it says matters more than what it does. Three states, and they are three different
 * promises: a sealed day replays to the same bytes; TODAY is still being written, so a read
 * of it is a snapshot and must not borrow the stronger guarantee; and live is not a time at
 * all. `asOfState` holds that distinction where a test can reach it.
 *
 * It is deliberately not offered on every room. The P&L refuses a day-granular as-of by name
 * because its native scope is a month, and the door will not re-derive the money core to fake
 * one -- so the scrub reaches the three routes that take it and the Money room says why it
 * does not reach there. A control that silently 501s a room looks broken; a boundary a room
 * can explain is a fact.
 */
export default function AsOf({
  asOf,
  today,
  supported,
  onChange,
}: {
  asOf: string | null
  today: string | null
  /** false in a room whose data has no day-granular history -- the control says so and stays put */
  supported: boolean
  onChange: (day: string | null) => void
}) {
  const state = asOfState(asOf, today)

  return (
    <div style={wrapStyle}>
      <label style={labelStyle} htmlFor="asof-day">
        as of
      </label>
      <input
        id="asof-day"
        type="date"
        value={asOf ?? ''}
        max={today ?? undefined}
        disabled={!supported}
        onChange={(e) => onChange(e.target.value || null)}
        style={inputStyle(state.scrubbed, supported)}
        title={supported ? state.note : 'this room reads no day-granular history, so there is nothing to scrub'}
      />
      {state.scrubbed ? (
        <button type="button" onClick={() => onChange(null)} style={liveBtnStyle}>
          back to live
        </button>
      ) : (
        <span style={liveTagStyle}>live</span>
      )}
      <span style={noteStyle}>
        {!supported
          ? 'not this room — its numbers are not day-scoped'
          : state.scrubbed && !state.replayIdentical
            ? 'open day — a snapshot, not a replay'
            : state.scrubbed
              ? 'sealed day — replays to the same bytes'
              : ''}
      </span>
    </div>
  )
}

const wrapStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--grid-in)',
  minHeight: 'var(--row-h-live)',
  font: `400 var(--step-meta)/1.2 var(--font-mono)`,
  color: 'var(--meta)',
}

const labelStyle: CSSProperties = {
  textTransform: 'uppercase',
  letterSpacing: 'var(--track-tight)',
  color: 'var(--faint)',
}

function inputStyle(scrubbed: boolean, supported: boolean): CSSProperties {
  return {
    // Scrubbing is a DATA-MODE statement, not a meaning, so it takes the product's own
    // colour and never one of the four reserved hues (ADR-1310).
    background: 'transparent',
    color: supported ? (scrubbed ? 'var(--accent)' : 'var(--prose)') : 'var(--faint)',
    border: `1px solid ${scrubbed ? 'var(--accent-line)' : 'var(--hairline-strong)'}`,
    borderRadius: 'var(--radius-chip)',
    padding: '0 var(--grid-in)',
    minHeight: '30px',
    font: `400 var(--step-meta)/1 var(--font-mono)`,
    colorScheme: 'dark',
    cursor: supported ? 'pointer' : 'not-allowed',
  }
}

const liveBtnStyle: CSSProperties = {
  minHeight: '30px',
  padding: '0 var(--grid-in)',
  background: 'transparent',
  color: 'var(--accent)',
  border: '1px solid var(--accent-line)',
  borderRadius: 'var(--radius-chip)',
  cursor: 'pointer',
  font: `400 var(--step-micro)/1 var(--font-mono)`,
  textTransform: 'uppercase',
  letterSpacing: 'var(--track-tight)',
}

const liveTagStyle: CSSProperties = {
  color: 'var(--mode-live)',
  textTransform: 'uppercase',
  letterSpacing: 'var(--track-tight)',
  font: `400 var(--step-micro)/1 var(--font-mono)`,
}

const noteStyle: CSSProperties = {
  color: 'var(--faint)',
  font: `400 var(--step-micro)/1.2 var(--font-mono)`,
}
