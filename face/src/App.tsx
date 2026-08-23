// App.tsx -- the shell. It holds the face, the rail, and whichever room is open.
//
// It decides as little as possible: routing, the keyboard model, nav order and ring grouping
// all live in ../lib/*.mjs where `node` can hold them without an install. What is left here
// is wiring -- effects, fetches and which component to mount.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

import './tokens.css'

import { Door, DoorError, decodeRegistry, tokenFromHash, unescapeDoorText } from './lib/door.mjs'
import { byRing, findRoom, defaultRoom, errorSentence } from './lib/rooms.mjs'
import type { Room } from './lib/rooms.mjs'
import { HOME, buildHash, conceptsFromContract, isTextField, keyAction, moveRoom, navOrder, paletteItems, parseHash } from './lib/shell.mjs'

import FaceStage from './face/FaceStage'
import Rings from './shell/Rings'
import Palette from './shell/Palette'
import type { PaletteItem } from './shell/Palette'
import GenericRoom from './rooms/GenericRoom'
import IndexRoom from './rooms/IndexRoom'
import Today from './rooms/Today'
import Inbox from './rooms/Inbox'
import SpineRoom from './rooms/SpineRoom'
import BoardRoom from './rooms/BoardRoom'
import CouncilRoom from './rooms/CouncilRoom'
import AskArcRoom from './rooms/AskArcRoom'
import MoneyRoom from './rooms/MoneyRoom'
import VenturesRoom from './rooms/VenturesRoom'
import MapRoom from './rooms/MapRoom'
import { needsYouByRoom } from './lib/map.mjs'
import { Failure, Loading } from './ui/kit'

type Registry = { rings: string[]; rooms: Room[]; kindsEverFired: number; mode?: string }

export default function App() {
  const [registry, setRegistry] = useState<Registry | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [roomId, setRoomId] = useState<string>(() => parseHash(window.location.hash).room ?? HOME)
  const [talking] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [concepts, setConcepts] = useState<Record<string, { room: string; station: string }>>({})
  // Only the two maps the Map needs; the rest of the frozen contract is not this shell's
  // business, and narrowing here keeps an `unknown` from travelling into a pure function.
  const [contract, setContract] = useState<{ gates?: { map?: Record<string, string> }; lanes?: { map?: Record<string, string> } }>({})
  const [openItems, setOpenItems] = useState<{ gate?: string; venture?: string }[]>([])
  const token = useMemo(
    // The token arrives in the fragment, either as arc-dash prints it (`#token=...`) or
    // alongside a room. Both shapes are one function's problem, not this component's.
    () => parseHash(window.location.hash).token ?? tokenFromHash(window.location.hash),
    [],
  )
  const door = useMemo(() => new Door({ token: token ?? undefined }), [token])

  // The registry is fetched ONCE and drives everything: the rail, the nav order, the room.
  // It is never imported from disk -- a second spelling of the room list in the renderer is
  // how a renamed room silently empties a screen (ADR-1306).
  useEffect(() => {
    const ac = new AbortController()
    door
      .rooms(ac.signal)
      // Decoded HERE, once, where the registry enters -- not at each of the render
      // sites that show a room's name. See decodeRegistry for why that distinction matters.
      .then((r: Registry) => setRegistry(decodeRegistry(r)))
      .catch((e: unknown) => {
        if (e instanceof DoorError || !ac.signal.aborted) setError(e)
      })
    // The vocabulary comes from the frozen contract over the door's allow-listed file route
    // -- the SAME file face-coverage validates, so the palette cannot quietly know less than
    // arc does. A failure here dims the palette to rooms only; it never blocks the shell,
    // because not being able to search is a smaller problem than not being able to look.
    door
      .file('expected-set', ac.signal)
      .then((body: unknown) => {
        const got = conceptsFromContract(body, unescapeDoorText)
        if (got.ok) setConcepts(got.concepts)
        // The same contract answers "which room owns this gate", which is what turns an open
        // approval into a mark on the Map.
        try { setContract(JSON.parse(unescapeDoorText((body as { text?: unknown }).text)) as { gates?: { map?: Record<string, string> }; lanes?: { map?: Record<string, string> } }) } catch { /* palette-only */ }
      })
      .catch(() => { /* rooms-only palette; the shell still works */ })
    // What is waiting on the owner, so the Map can show WHERE he is needed rather than only
    // what exists. A failure here leaves the Map correct and unmarked; it never blocks it.
    door
      .inbox(ac.signal)
      .then((b: { open?: { gate?: string; venture?: string }[] }) => setOpenItems(Array.isArray(b.open) ? b.open : []))
      .catch(() => { /* an unmarked map is honest; a blocked one is not */ })
    return () => ac.abort()
  }, [door])

  const groups = useMemo(() => (registry ? byRing(registry.rooms) : []), [registry])
  const order = useMemo(() => navOrder(groups), [groups])

  const open = useCallback(
    (id: string) => {
      setRoomId(id)
      // Replace, not push: holding j through the company should not bury the back button
      // under thirty entries. A room is a view, not a destination you navigate back through.
      window.history.replaceState(null, '', buildHash(id, token))
    },
    [token],
  )

  // The browser's own back/forward, and anyone editing the address bar, stay authoritative.
  useEffect(() => {
    const onHash = () => {
      const next = parseHash(window.location.hash).room
      if (next) setRoomId(next)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Opening a room must start at its opening SENTENCE.
  //
  // The room column is what scrolls, and React keeps its scrollTop across a content swap --
  // so leaving Money half-read and opening Bench showed Bench's FOOTER and then a screenful
  // of nothing. Every room in this product leads with a declarative line that is the whole
  // point of the screen, and a room you arrive at from the bottom has effectively lost it.
  // Found by sweeping all 32 rooms and looking, not by any check.
  // It is the WINDOW that scrolls, not the room column. The column carries overflowY:auto but
  // nothing constrains its height, so it never overflows and the document scrolls instead --
  // which is why resetting the column's scrollTop was a no-op, and why the check that
  // "proved" the fix passed vacuously on 0 === 0. Asserting the precondition (that something
  // had actually been scrolled) is what caught it.
  const roomScrollRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    roomScrollRef.current?.scrollTo({ top: 0 })
    window.scrollTo({ top: 0 })
  }, [roomId])

  const orderRef = useRef(order)
  orderRef.current = order
  const roomRef = useRef(roomId)
  roomRef.current = roomId
  const paletteOpenRef = useRef(paletteOpen)
  paletteOpenRef.current = paletteOpen

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const action = keyAction(ev, {
        inTextField: isTextField(ev.target as Element | null),
        paletteOpen: paletteOpenRef.current,
      })
      if (!action) return
      if (action.type === 'palette-toggle') {
        ev.preventDefault()
        setPaletteOpen((o) => !o)
        return
      }
      if (action.type === 'palette-close') { ev.preventDefault(); setPaletteOpen(false); return }
      if (action.type === 'room-move' && typeof action.delta === 'number') {
        ev.preventDefault()
        open(moveRoom(orderRef.current, roomRef.current, action.delta))
      } else if (action.type === 'room-open' && action.room) {
        ev.preventDefault()
        open(action.room)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (error) {
    return (
      <main style={pageStyle}>
        <div style={{ padding: 'calc(var(--grid) * 4)', maxWidth: 640 }}>
          <Failure error={error} what="the room registry" />
          <p style={hintStyle}>
            {/* The door is localhost + token by law (ADR-1312). The overwhelmingly likely
                cause of a failure here is that it is not running, or the token is missing --
                say that, rather than making the owner guess. */}
            Start the door from the main clone with <code>node .claude/scripts/hq/arc-dash.mjs</code>,
            then open the URL it prints — it carries the token in the fragment.
          </p>
          <p style={hintStyle}>{errorSentence(error).human}</p>
        </div>
      </main>
    )
  }

  if (!registry) {
    return (
      <main style={pageStyle}>
        <Loading what="the company" />
      </main>
    )
  }

  const room = findRoom(registry.rooms, roomId) ?? defaultRoom(registry.rooms)
  const items: PaletteItem[] = paletteItems(registry.rooms, concepts)
  const needs = needsYouByRoom(openItems, contract, registry.rooms.map((r) => r.id))

  return (
    <main style={pageStyle}>
      {/* The face persists behind every room at reduced presence. It is the one element of
          the design the owner required unchanged, and it is the shell rather than a hero
          image -- which is what stops this reading as a dashboard template. */}
      <div style={faceLayerStyle} aria-hidden="true">
        <FaceStage presence={0.28} state={talking ? 'talking' : 'idle'} />
      </div>

      {paletteOpen && (
        <Palette
          items={items}
          onClose={() => setPaletteOpen(false)}
          onOpen={(item: PaletteItem) => { setPaletteOpen(false); open(item.room) }}
        />
      )}

      <div style={frameStyle}>
        <Rings groups={groups} current={room ? room.id : HOME} onOpen={open} />
        <section ref={roomScrollRef} style={roomStyle} aria-live="polite">
          {room ? <RoomHost room={room} rooms={registry.rooms} door={door} onOpen={open} mode={registry.mode} token={token} needs={needs.counts} needsUnplaced={needs.unplaced} /> : <NoSuchRoom id={roomId} />}
        </section>
      </div>
    </main>
  )
}

/**
 * Which component draws this room. The registry's own `render` decides, never a list of ids
 * kept here -- a second spelling of that decision would drift the moment a room changes mode.
 * The two bespoke ids are the exception and they are named, not guessed.
 */
function RoomHost({ room, rooms, door, onOpen, mode, token, needs, needsUnplaced }: { room: Room; rooms: Room[]; door: Door; onOpen: (id: string) => void; mode?: string; token: string | null; needs: Record<string, number>; needsUnplaced: number }) {
  if (room.id === 'today') return <Today door={door} sentence={room.sentence} lede={room.lede} />
  if (room.id === 'inbox') return <Inbox door={door} sentence={room.sentence} lede={room.lede} />
  if (room.id === 'spine') return <SpineRoom door={door} room={room} sentence={room.sentence} lede={room.lede} />
  if (room.id === 'board') return <BoardRoom door={door} room={room} sentence={room.sentence} lede={room.lede} />
  if (room.id === 'council-chamber') return <CouncilRoom door={door} room={room} sentence={room.sentence} lede={room.lede} />
  if (room.id === 'ask-arc') return <AskArcRoom door={door} room={room} sentence={room.sentence} lede={room.lede} onOpen={onOpen} />
  if (room.id === 'money') return <MoneyRoom door={door} room={room} sentence={room.sentence} lede={room.lede} />
  if (room.id === 'ventures') return <VenturesRoom door={door} room={room} sentence={room.sentence} lede={room.lede} />
  if (room.id === 'map') return <MapRoom rooms={rooms} onOpen={onOpen} mode={mode} token={token} needsYou={needs} needsYouUnplaced={needsUnplaced} />
  if (room.render === 'index') return <IndexRoom room={room} rooms={rooms} door={door} />
  return <GenericRoom room={room} />
}

/**
 * An unknown room id is a thing a person can type. It gets a named answer, never a blank
 * screen -- the product exists so nothing goes missing, and its own router must not be the
 * place where something silently does.
 */
function NoSuchRoom({ id }: { id: string }) {
  return (
    <div style={{ padding: 'calc(var(--grid) * 4)' }}>
      <h1 style={{ font: `600 var(--step-room)/1.1 var(--font-display)`, margin: 0, color: 'var(--prose)' }}>
        There is no room called “{id}”.
      </h1>
      <p style={hintStyle}>Every room arc has is in the rail, and all of them are on the Map.</p>
    </div>
  )
}

const pageStyle: CSSProperties = {
  position: 'relative',
  minHeight: '100vh',
  background: 'var(--ground)',
  color: 'var(--prose)',
  font: `400 var(--step-body)/1.5 var(--font-display)`,
}

const faceLayerStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 0,
  pointerEvents: 'none',
  // The face is the shell, and a shell must not compete with the words in front of it.
  // At full strength the particle field sat directly behind the room's opening sentence and
  // made it hard to read -- the same defect the reference has on its own landing, where the
  // paragraph beside the mask is barely legible. Presence drives SCALE, not opacity, so the
  // dimming belongs here rather than in a prop.
  opacity: 0.5,
}

const frameStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  alignItems: 'stretch',
  minHeight: '100vh',
}

const roomStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: 'calc(var(--grid) * 3)',
  overflowY: 'auto',
  // A scrim, not a slab. The reference puts translucent panels over the face and lets it
  // show through the gaps; the gaps are where a room's opening SENTENCE lives, and that is
  // the largest text on the page. This keeps the face visible while giving every headline a
  // ground to sit on -- the alternative, an opaque column, deletes the one element the owner
  // said must not change.
  background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.72), rgba(0, 0, 0, 0.55))',
}

const hintStyle: CSSProperties = {
  font: `400 var(--step-meta)/1.6 var(--font-mono)`,
  color: 'var(--meta)',
  maxWidth: '60ch',
}
