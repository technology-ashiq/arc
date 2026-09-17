// App.tsx -- the workroom shell (face v2 Phase 02): v0.7's 240 px rail, 56 px header, ⌘K palette and
// a text-only dock in the content column (ADR-1315), around whichever room is open.
//
// It names no room. The served registry says which rooms exist, in which ring and order, and which
// one the shell opens on (registry.mjs); a module folder attaches to a served room by id, and a
// served room with no module draws through the generic module and says so (ADR-1321). Every
// decision is in ../lib/*.mjs where node can hold it; what is left here is wiring.
//
// The face stage is not in the workroom, in either mood. v0.7's workroom is "a clean room, the face
// belongs to the front door" (its App.jsx), and the reference is the target (ADR-1318); the owner's
// Phase 01 ruling left the stage dark-only until this phase placed it. The product has no front door,
// so the stage is unmounted here and kept, WebGL-guarded, for the room that next draws it.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// Tailwind v4 and the generated token copy both enter through index.css (ADR-1323).
import './index.css'

import { ASOF_ROUTES, Door, DoorError, decodeRegistry, tokenFromHash, unescapeDoorText } from './lib/door.mjs'
import { findRoom, errorSentence } from './lib/rooms.mjs'
import type { Room } from './lib/rooms.mjs'
import { buildHash, conceptsFromContract, isTextField, keyAction, moveRoom, navOrder, paletteItems, parseHash } from './lib/shell.mjs'
import { asOfReaches, attachModules, collectModules, homeRoom, modeChip, railGroups, roomHoldingKind } from './lib/registry.mjs'
import type { ModuleContext } from './lib/registry.mjs'
import { needsYouByRoom } from './lib/map.mjs'
import { applyMood, nextMood, readMood, storeMood } from './lib/mood.mjs'
import type { Mood } from './lib/mood.mjs'

import Rail from './shell/Rail'
import Header from './shell/Header'
import Palette from './shell/Palette'
import Dock from './shell/Dock'
import RoomFrame from './shell/RoomFrame'
import type { PaletteItem } from './shell/Palette'
import { Failure, Loading } from './ui/legacy'
import { UI } from './ui/kit'

// `inventories` is nullable, not optional-with-a-default. A door serving a registry generated
// before ADR-1317 sends null, and a room must be able to say "the registry carried no band map"
// rather than draw an empty one.
type Registry = { rings: string[]; rooms: Room[]; kindsEverFired: number; mode?: string; inventories?: Record<string, Record<string, string>> | null }
type Contract = { gates?: { map?: Record<string, string> }; lanes?: { map?: Record<string, string> } }

// The kind the header's inbox chip counts; the chip opens the room that homes it.
const APPROVAL_KIND = 'approval.requested'

// Every module the bundler can find, by the key shape registry.mjs reads (`./modules/RING/ID/FILE`).
// The glob lives in THIS file because its keys are relative to it: from face/src the keys start
// `./modules/`, and from anywhere else they would not. Four globs, one per file of the contract, so a
// folder missing one is visible to collectModules as an incomplete module rather than a silent gap.
const FOUND_MODULES: Record<string, unknown> = {
  ...import.meta.glob('./modules/*/*/module.mjs', { eager: true }),
  ...import.meta.glob('./modules/*/*/fold.mjs', { eager: true }),
  ...import.meta.glob('./modules/*/*/ops.mjs', { eager: true }),
  ...import.meta.glob('./modules/*/*/View.tsx', { eager: true }),
}

export default function App() {
  const [registry, setRegistry] = useState<Registry | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [roomId, setRoomId] = useState<string | null>(() => parseHash(window.location.hash).room)
  // The workroom's mood. main.tsx already put the stored one on <html> before the first render;
  // this state only follows it, and a toggle writes both the classes and the preference.
  const [mood, setMood] = useState<Mood>(() => readMood(storage()))
  const toggleMood = useCallback(() => setMood((m) => nextMood(m)), [])
  useEffect(() => {
    applyMood(document.documentElement.classList, mood)
    storeMood(storage(), mood)
  }, [mood])
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [asOf, setAsOf] = useState<string | null>(() => parseHash(window.location.hash).asOf)
  const [today, setToday] = useState<string | null>(null)
  const [concepts, setConcepts] = useState<Record<string, { room: string; station: string }>>({})
  const [contract, setContract] = useState<Contract>({})
  const [openItems, setOpenItems] = useState<{ gate?: string; venture?: string }[] | null>(null)
  const token = useMemo(
    // The token arrives in the fragment, either as arc-dash prints it (`#token=...`) or alongside a
    // room. Both shapes are one function's problem, not this component's.
    () => parseHash(window.location.hash).token ?? tokenFromHash(window.location.hash),
    [],
  )
  // The scrub lives on the DOOR, so every room inherits it without knowing it exists.
  const door = useMemo(() => new Door({ token: token ?? undefined, asOf }), [token, asOf])

  // The registry is fetched ONCE and drives everything: the rail, the nav order, home, the room.
  // It is never imported from disk -- a second spelling of the room list in the renderer is how a
  // renamed room silently empties a screen (ADR-1306).
  useEffect(() => {
    const ac = new AbortController()
    door
      .rooms(ac.signal)
      .then((r: Registry) => setRegistry(decodeRegistry(r)))
      .catch((e: unknown) => {
        if (e instanceof DoorError || !ac.signal.aborted) setError(e)
      })
    // The door's own day, never the browser's: a clock skew of one day would label a sealed day as
    // open, or the reverse, and the two carry different guarantees.
    door
      .health(ac.signal)
      .then((h: { now?: unknown }) => { if (typeof h.now === 'string') setToday(h.now.slice(0, 10)) })
      .catch(() => { /* the control still works; it just cannot mark today */ })
    // The vocabulary comes from the frozen contract over the door's allow-listed file route -- the
    // SAME file face-coverage validates, so the palette cannot quietly know less than arc does.
    door
      .file('expected-set', ac.signal)
      .then((body: unknown) => {
        const got = conceptsFromContract(body, unescapeDoorText)
        if (got.ok) setConcepts(got.concepts)
        try { setContract(JSON.parse(unescapeDoorText((body as { text?: unknown }).text)) as Contract) } catch { /* palette-only */ }
      })
      .catch(() => { /* rooms-only palette; the shell still works */ })
    // What is waiting on the owner. A failure leaves the inbox chip saying it could not read --
    // never "inbox zero", which would be a claim about the company made from a failed read.
    door
      .inbox(ac.signal)
      .then((b: { open?: { gate?: string; venture?: string }[] }) => setOpenItems(Array.isArray(b.open) ? b.open : []))
      .catch(() => setOpenItems(null))
    return () => ac.abort()
  }, [door])

  const groups = useMemo(() => (registry ? railGroups(registry) : []), [registry])
  const order = useMemo(() => navOrder(groups), [groups])
  const home = useMemo(() => (registry ? homeRoom(registry) : null), [registry])
  // Modules attach to the SERVED rooms, both ways (ADR-1321). What the glob found is fixed at
  // build time; what it attaches to is whatever the door serves today.
  const attachment = useMemo(() => attachModules(registry ?? { rooms: [] }, collectModules(FOUND_MODULES)), [registry])

  const open = useCallback(
    (id: string) => {
      setRoomId(id)
      // Replace, not push: holding j through the company should not bury the back button under
      // thirty entries. A room is a view, not a destination you navigate back through.
      window.history.replaceState(null, '', buildHash(id, token, asOf))
    },
    [token, asOf],
  )

  // The browser's own back/forward, and anyone editing the address bar, stay authoritative.
  useEffect(() => {
    const onHash = () => {
      const h = parseHash(window.location.hash)
      if (h.room) setRoomId(h.room)
      setAsOf(h.asOf)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Opening a room starts at its opening SENTENCE. The document scrolls in v0.7's shell (the rail
  // and header are fixed), so it is the window that is reset.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [roomId])

  const orderRef = useRef(order)
  orderRef.current = order
  const roomRef = useRef(roomId)
  roomRef.current = roomId
  const homeRef = useRef(home)
  homeRef.current = home
  const paletteOpenRef = useRef(paletteOpen)
  paletteOpenRef.current = paletteOpen

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const action = keyAction(ev, {
        inTextField: isTextField(ev.target as Element | null),
        paletteOpen: paletteOpenRef.current,
      })
      if (!action) return
      if (action.type === 'palette-toggle') { ev.preventDefault(); setPaletteOpen((o) => !o); return }
      if (action.type === 'palette-close') { ev.preventDefault(); setPaletteOpen(false); return }
      const current = roomRef.current ?? homeRef.current
      if (action.type === 'room-move' && typeof action.delta === 'number' && current) {
        ev.preventDefault()
        open(moveRoom(orderRef.current, current, action.delta))
      } else if (action.type === 'room-home' && homeRef.current) {
        ev.preventDefault()
        open(homeRef.current)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (error) {
    return (
      <main className="min-h-screen" style={{ background: 'var(--bg-0)', color: 'var(--text-1)', fontFamily: UI }}>
        <div className="p-8 max-w-[640px]">
          <Failure error={error} what="the room registry" />
          <p className="text-[12.5px] leading-[20px] mt-4" style={{ color: 'var(--text-2)' }}>
            {/* The door is localhost + token by law (ADR-1312). The overwhelmingly likely cause of a
                failure here is that it is not running, or the token is missing -- say that. */}
            Start the door from the main clone with <code>node .claude/scripts/hq/arc-dash.mjs</code>, then
            open the URL it prints — it carries the token in the fragment.
          </p>
          <p className="text-[12.5px] leading-[20px] mt-2" style={{ color: 'var(--text-3)' }}>{errorSentence(error).human}</p>
        </div>
      </main>
    )
  }

  if (!registry) {
    return (
      <main className="min-h-screen" style={{ background: 'var(--bg-0)', color: 'var(--text-1)', fontFamily: UI }}>
        <Loading what="the company" />
      </main>
    )
  }

  const shownId = roomId ?? home
  const room = shownId === null ? null : findRoom(registry.rooms, shownId)
  // A template is not a room you can open; asking for it by URL is answered like any unknown id.
  const openable = room && !room.template ? room : null
  const items: PaletteItem[] = paletteItems(registry.rooms, concepts)
  const needs = needsYouByRoom(openItems ?? [], contract, registry.rooms.map((r) => r.id))
  const attached = openable ? attachment.attached[openable.id] : undefined
  const ctx: ModuleContext | null = openable
    ? {
        room: openable, rooms: registry.rooms, door, onOpen: open, mode: registry.mode, token,
        needs: needs.counts, needsUnplaced: needs.unplaced, inventories: registry.inventories, laneMap: contract.lanes?.map,
      }
    : null

  return (
    <div className="relative min-h-screen" style={{ fontFamily: UI, background: 'var(--bg-0)', color: 'var(--text-1)' }}>
      {paletteOpen && (
        <Palette
          items={items}
          onClose={() => setPaletteOpen(false)}
          onOpen={(item: PaletteItem) => { setPaletteOpen(false); open(item.room) }}
        />
      )}

      <Rail
        groups={groups}
        current={openable ? openable.id : null}
        onOpen={open}
        onPalette={() => setPaletteOpen(true)}
        attachment={attachment}
        ringCount={registry.rings.length}
      />

      <Header
        room={openable}
        mode={modeChip(registry.mode)}
        inbox={{ open: openItems === null ? null : openItems.length, room: roomHoldingKind(registry, APPROVAL_KIND) }}
        onOpen={open}
        mood={mood}
        onToggleMood={toggleMood}
        asOf={asOf}
        today={today}
        asOfSupported={openable !== null && ASOF_ROUTES.length > 0 && asOfReaches(openable, attached ? attached.manifest : null)}
        onAsOf={(day) => {
          setAsOf(day)
          window.history.replaceState(null, '', buildHash(openable ? openable.id : shownId ?? '', token, day))
        }}
        groups={groups}
        current={openable ? openable.id : null}
      />

      {/* No z-index here on purpose: a room's drawers (z-50, fixed) must stack above the rail and
          header (z-40), as in v0.7. */}
      <main className="relative pt-[104px] lg:pt-[80px] lg:pl-[240px] pb-40 overflow-x-clip">
        <div className="px-4 sm:px-6 lg:px-8 max-w-[1440px] min-w-0">
          {/* data-room names the room actually rendered and data-render how, so the browser harness
              can tell "opened the room I asked for" from a fallback, and a module from the generic
              module (face v2 Phases 00 and 02). */}
          <section
            aria-live="polite"
            data-room={openable ? openable.id : ''}
            data-render={openable ? (attached ? 'module' : 'generic') : 'none'}
            data-module={attached ? attached.key : undefined}
          >
            {openable && ctx ? (
              <div key={openable.id} className="room-enter">
                <RoomFrame room={openable} attachment={attachment} ctx={ctx} />
              </div>
            ) : (
              <NoSuchRoom id={shownId ?? ''} />
            )}
          </section>
        </div>
      </main>

      <Dock door={door} />
    </div>
  )
}

/**
 * An unknown room id is a thing a person can type. It gets a named answer, never a blank screen --
 * the product exists so nothing goes missing, and its own router must not be where something does.
 */
function NoSuchRoom({ id }: { id: string }) {
  return (
    <div className="py-10">
      <h1 className="text-[22px] sm:text-[26px] leading-[1.15] tracking-[-0.01em]" style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-1)' }}>
        There is no room called “{id}”.
      </h1>
      <p className="text-[13.5px] leading-[21px] mt-1.5" style={{ color: 'var(--text-2)' }}>
        Every room arc has is in the rail, and all of them are on the Map.
      </p>
    </div>
  )
}

/** `window.localStorage` can throw on access under a storage policy; the mood then lives for this visit only. */
function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}
