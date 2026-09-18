// AsOf.tsx -- the as-of scrub, in the header where v0.7 keeps its day control (face v2 Phase 02).
//
// A date, not a slider. A slider implies every point between two days is a place you can stand, and
// it is not: the spine is a sequence of DAYS, sealed one at a time. What it says matters more than
// what it does -- a sealed day replays to the same bytes, TODAY is still being written, and live is
// not a time at all. `asOfState` holds that distinction where a test can reach it.
//
// It is not offered on every room: a room whose numbers are not day-scoped (its module says
// `asOf: false`, or it is file-borne) disables the control and says why, rather than 501ing.
import { asOfState } from '../lib/shell.mjs'
import { MONO, UI } from '../ui/kit'

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
  // The header has room for a few words, not a sentence: each note is short enough never to be cut by an
  // ellipsis (the factory ring's shot review read "not this room — its numbers are …"), and the whole
  // sentence rides on its title.
  const note = !supported
    ? 'not day-scoped here'
    : state.scrubbed && !state.replayIdentical
      ? 'open day · a snapshot'
      : state.scrubbed
        ? 'sealed day · exact replay'
        : ''
  const said = !supported
    ? 'not this room: its numbers are not day-scoped, so there is no day to scrub to'
    : state.scrubbed && !state.replayIdentical
      ? 'an open day: a snapshot of what the spine holds so far, not a replay'
      : state.scrubbed
        ? 'a sealed day: it replays to the same bytes every time'
        : ''
  return (
    <span className="inline-flex items-center gap-2 text-[12px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
      <label htmlFor="asof-day" className="uppercase tracking-[0.06em] text-[10.5px]" style={{ fontWeight: 600 }}>
        as of
      </label>
      <input
        id="asof-day"
        type="date"
        value={asOf ?? ''}
        max={today ?? undefined}
        disabled={!supported}
        onChange={(e) => onChange(e.target.value || null)}
        title={supported ? state.note : 'this room reads no day-granular history, so there is nothing to scrub'}
        className="h-[28px] px-2 text-[12px] tnum outline-none transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent) disabled:cursor-not-allowed"
        style={{
          fontFamily: MONO,
          background: 'var(--bg-3)',
          // Scrubbing is a DATA-MODE statement, not a meaning, so it takes the product's colour and
          // never a reserved hue.
          color: supported ? (state.scrubbed ? 'var(--accent)' : 'var(--text-1)') : 'var(--text-3)',
          border: `1px solid ${state.scrubbed ? 'rgba(var(--accent-rgb), 0.45)' : 'var(--line-1)'}`,
          borderRadius: 'var(--r-md)',
          colorScheme: 'dark light',
        }}
      />
      {state.scrubbed ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="h-[24px] px-2 text-[10.5px] uppercase tracking-[0.06em] cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)"
          style={{ fontFamily: UI, fontWeight: 600, color: 'var(--accent)', background: 'transparent', border: '1px solid rgba(var(--accent-rgb), 0.45)', borderRadius: 'var(--r-sm)' }}
        >
          back to live
        </button>
      ) : (
        <span className="text-[10.5px] uppercase tracking-[0.06em]" style={{ fontWeight: 600, color: 'var(--mode-live)' }}>live</span>
      )}
      {note ? <span className="hidden xl:inline whitespace-nowrap" title={said}>{note}</span> : null}
    </span>
  )
}
