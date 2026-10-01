// App.tsx -- the workroom shell (face v2 Phase 02): v0.7's 240 px rail, 56 px header, ⌘K palette and
// a text-only dock in the content column (ADR-1315), around whichever room is open.
//
// It names no room. The served registry says which rooms exist, in which ring and order, and which
// one the shell opens on (registry.mjs); a module folder attaches to a served room by id, and a
// served room with no module draws through the generic module and says so (ADR-1321). Every
// decision is in ../lib/*.mjs where node can hold it; what is left here is wiring.
//
// Two surfaces over one address bar (face v2 Phase 09, ADR-1349): the FRONT DOOR at `/`, the face at full
// presence and one ENTER HQ, and the workroom at `#hq` or `#/<room>`. The workroom is "a clean room, the
// face belongs to the front door" (v0.7 App.jsx): the stage is mounted on the door, flies past the camera
// on the way in (the warp) and is unmounted STAGE_UNMOUNT_MS later; a workroom opened from its address
// never mounts it, in either mood. Which surface, and when the stage is on, are mode.mjs's decisions.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// Tailwind v4 and the generated token copy both enter through index.css (ADR-1323).
import './index.css'

import { ASOF_ROUTES, Door, DoorError, decodeRegistry, tokenFromHash, unescapeDoorText } from './lib/door.mjs'
import { findRoom, errorSentence } from './lib/rooms.mjs'
import type { Room } from './lib/rooms.mjs'
import { buildHash, conceptsFromContract, isTextField, keyAction, moveRoom, navOrder, paletteItems, parseHash, referenceAt } from './lib/shell.mjs'
import { asOfReaches, attachModules, collectModules, EXEMPTION_FILE, extraRooms, homeRoom, modeChip, PULSE_MS, railGroups, refusedPayload, roomHoldingKind, withExtras } from './lib/registry.mjs'
import type { ExtraRooms, ModuleContext } from './lib/registry.mjs'
import { needsYouByRoom } from './lib/map.mjs'
import { referenceRoom } from './lib/lane-room.mjs'
import { applyMood, nextMood, readMood, storeMood } from './lib/mood.mjs'
import type { Mood } from './lib/mood.mjs'
import { enterHash, exitHash, modeOf, STAGE_UNMOUNT_MS, stageOn, warpDir } from './lib/mode.mjs'

import Rail from './shell/Rail'
import Header from './shell/Header'
import Palette from './shell/Palette'
import Dock from './shell/Dock'
import RoomFrame from './shell/RoomFrame'
import type { PaletteItem } from './shell/Palette'
import { Failure, Loading } from './ui/legacy'
import { UI } from './ui/kit'
import FaceStage from './face/FaceStage'
import FrontDoor from './frontdoor/FrontDoor'
import StageGuard from './frontdoor/StageGuard'

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
  // Which surface: the front door or the workroom. The address bar is the truth; this follows it.
  const [surface, setSurface] = useState<'door' | 'hq'>(() => modeOf(window.location.hash))
  // The crossing: each one starts a warp pass, and one into the workroom keeps the stage on while it flies.
  const [warp, setWarp] = useState<{ dir: 1 | -1; id: number } | undefined>(undefined)
  const [warping, setWarping] = useState(false)
  // The stage could not draw (no WebGL, or it threw): the door says so and the workroom is untouched.
  const [stageFailed, setStageFailed] = useState(false)
  const failStage = useCallback(() => setStageFailed(true), [])
  const prevSurface = useRef(surface)
  useEffect(() => {
    const dir = warpDir(prevSurface.current, surface)
    prevSurface.current = surface
    // The last few surfaces this page took, with when: printed by the harness beside a stage that did not leave.
    const trail = (document.documentElement.dataset.surfaceTrail || '').split(' ').filter(Boolean)
    document.documentElement.dataset.surfaceTrail = [...trail, `${surface}@${Math.round(performance.now())}`].slice(-6).join(' ')
    if (dir === 0) return
    setWarp((w) => ({ dir, id: (w ? w.id : 0) + 1 }))
    if (dir === -1) { setWarping(false); return }
    setWarping(true)
    // How long the stage stayed for the fly-through, on <html> once it leaves: the harness judges the warp from this
    // record instead of a read that races the hold on a loaded machine. Cleared at the start of each crossing.
    const root = document.documentElement
    delete root.dataset.warpHeldMs
    const t0 = performance.now()
    const t = window.setTimeout(() => {
      root.dataset.warpHeldMs = String(Math.round(performance.now() - t0))
      setWarping(false)
    }, STAGE_UNMOUNT_MS)
    return () => window.clearTimeout(t)
  }, [surface])
  const [registry, setRegistry] = useState<Registry | null>(null)
  // The rooms arc does not serve but the face keeps (ADR-1327): drawn from the exemption rows the door serves as a
  // file, never from a list typed here. Until they are read, or if they cannot be, the served rooms stand alone.
  const [extras, setExtras] = useState<ExtraRooms>(() => extraRooms({ state: 'loading' }))
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
  const [at, setAt] = useState<string | null>(() => parseHash(window.location.hash).at)
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
    door
      .file(EXEMPTION_FILE, ac.signal)
      .then((body: unknown) => setExtras(extraRooms({ state: 'ok', data: body })))
      .catch((e: unknown) => { if (!ac.signal.aborted) setExtras(extraRooms(refusedPayload(e))) })
    // What is waiting on the owner. A failure leaves the inbox chip saying it could not read --
    // never "inbox zero", which would be a claim about the company made from a failed read.
    door
      .inbox(ac.signal)
      .then((b: { open?: { gate?: string; venture?: string }[] }) => setOpenItems(Array.isArray(b.open) ? b.open : []))
      .catch(() => setOpenItems(null))
    return () => ac.abort()
  }, [door])

  // REQ-11: the door's pulse, asked every PULSE_MS -- a fingerprint of what the rooms read. A change re-reads the open
  // room (RoomFrame) and the shell's own live reads below. Never over a scrubbed day: history does not change under the
  // owner, so a re-read there would only redraw the page. One ask at a time; a missed pulse is a slower room, not a
  // wrong one.
  const [pulse, setPulse] = useState<string | undefined>(undefined)
  useEffect(() => {
    if (asOf) return
    const ac = new AbortController()
    let asking = false
    const ask = () => {
      if (asking) return
      asking = true
      door
        .pulse(ac.signal)
        .then((b: { pulse?: unknown }) => { if (!ac.signal.aborted && typeof b.pulse === 'string') setPulse(b.pulse) })
        .catch(() => { /* the next tick asks again */ })
        .finally(() => { asking = false })
    }
    ask()
    const t = window.setInterval(ask, PULSE_MS)
    return () => { ac.abort(); window.clearInterval(t) }
  }, [door, asOf])
  // The shell's live reads -- the inbox chip, and the registry whose live block says which kinds ever fired -- follow
  // the pulse too. The first pulse is where the shell starts, not a change: bootstrap has just read both.
  const seenPulse = useRef<string | undefined>(undefined)
  // One re-read of the pair at a time. A pulse that arrives while they are in flight marks them, and they run once more
  // when they land -- aborting them on every pulse starved a /api/rooms that takes longer than the pulse interval, so it
  // never landed at all (PR 2 logic attack).
  const shellFlight = useRef<AbortController | null>(null)
  const shellDirty = useRef(false)
  const rereadShell = useCallback(() => {
    if (shellFlight.current) { shellDirty.current = true; return }
    const ac = new AbortController()
    shellFlight.current = ac
    const inbox = door
      .inbox(ac.signal)
      .then((b: { open?: { gate?: string; venture?: string }[] }) => { if (!ac.signal.aborted) setOpenItems(Array.isArray(b.open) ? b.open : []) })
      .catch(() => { /* the chip keeps its last honest answer */ })
    const rooms = door
      .rooms(ac.signal)
      .then((r: Registry) => { if (!ac.signal.aborted) setRegistry(decodeRegistry(r)) })
      .catch(() => { /* the rail keeps the registry it has */ })
    void Promise.allSettled([inbox, rooms]).then(() => {
      if (shellFlight.current !== ac) return
      shellFlight.current = null
      if (shellDirty.current && !ac.signal.aborted) { shellDirty.current = false; rereadShell() }
    })
  }, [door])
  useEffect(() => () => { shellFlight.current?.abort(); shellFlight.current = null; shellDirty.current = false }, [door])
  useEffect(() => {
    if (pulse === undefined) return
    if (seenPulse.current === undefined) { seenPulse.current = pulse; return }
    if (seenPulse.current === pulse) return
    seenPulse.current = pulse
    rereadShell()
  }, [pulse, rereadShell])

  // What the bundle found is fixed at build time: read once, and handed to both questions asked of it.
  const collected = useMemo(() => collectModules(FOUND_MODULES), [])
  // The room list the shell draws: the served registry, then each exempted extra in its ring, where its module lives
  // (ADR-1327). What could not be drawn is said, in the rail and on a deep link -- never a silent absence.
  const shell = useMemo(() => (registry ? withExtras(registry, extras, collected.modules) : null), [registry, extras, collected])
  const extrasNote = useMemo(() => {
    const dropped = shell ? shell.extrasDropped : []
    const parts = [extras.isLoading ? '' : extras.problem, dropped.length ? `rows left out: ${dropped.join(', ')}` : ''].filter((x) => x !== '')
    return parts.join('; ')
  }, [shell, extras])
  const groups = useMemo(() => (shell ? railGroups(shell) : []), [shell])
  const order = useMemo(() => navOrder(groups), [groups])
  const home = useMemo(() => (registry ? homeRoom(registry) : null), [registry])
  // Modules attach to the SERVED rooms, both ways (ADR-1321), and to an exempted extra through its row. What the
  // glob found is fixed at build time; what it attaches to is whatever the door serves today.
  const attachment = useMemo(() => attachModules(shell ?? { rooms: [] }, collected), [shell, collected])
  const referenceId = useMemo(() => referenceRoom(shell?.rooms ?? [], attachment.attached), [shell, attachment])

  const open = useCallback(
    (id: string, nextAt: string | null = null) => {
      // A room is in the workroom: opening one from the door's palette crosses into it.
      setSurface('hq')
      setRoomId(id)
      setAt(nextAt)
      // Replace, not push: holding j through the company should not bury the back button under
      // thirty entries. A room is a view, not a destination you navigate back through.
      window.history.replaceState(null, '', buildHash(id, token, asOf, nextAt))
    },
    [token, asOf],
  )

  // The browser's own back/forward, and anyone editing the address bar, stay authoritative.
  useEffect(() => {
    const onHash = () => {
      const h = parseHash(window.location.hash)
      const next = modeOf(window.location.hash)
      setSurface(next)
      // ENTER HQ names no room: the workroom opens on the registry's home, not the last room left.
      if (h.room) setRoomId(h.room)
      else if (next === 'hq') setRoomId(null)
      setAsOf(h.asOf)
      setAt(h.at)
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
  const surfaceRef = useRef(surface)
  surfaceRef.current = surface

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const action = keyAction(ev, {
        inTextField: isTextField(ev.target as Element | null),
        paletteOpen: paletteOpenRef.current,
      })
      if (!action) return
      if (action.type === 'palette-toggle') { ev.preventDefault(); setPaletteOpen((o) => !o); return }
      if (action.type === 'palette-close') { ev.preventDefault(); setPaletteOpen(false); return }
      // The door has the palette (v0.7: "⌘K works everywhere, the landing included") and nothing else: a room key
      // pressed on the door is not a way in.
      if (surfaceRef.current === 'door') return
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

  const enter = () => { window.location.hash = enterHash(window.location.hash) }
  const exit = () => { setPaletteOpen(false); window.location.hash = exitHash(window.location.hash) }
  const stage = stageOn(surface, warping) && !stageFailed ? (
    <StageGuard onFail={failStage}>
      <FaceStage presence={surface === 'door' ? 1 : 0.24} warp={warp} neon onUnavailable={failStage} />
    </StageGuard>
  ) : null

  // ONE place for the stage in every branch: the first child of the root fragment. Crossing from the door into the
  // workroom changes the tree around it, and a stage drawn inside each branch's own root was a different element to
  // React, so ENTER HQ threw the running face away and built a second WebGL context mid-warp (CI 2026-10-01: under
  // software WebGL that rebuild held the page for seconds and the stage outlived its unmount timer).
  const body = (() => {
  // The door draws before the registry is read, and whether or not it could be: the face does not wait on the company.
  if (surface === 'door') {
    return (
      <>
        {paletteOpen && shell && (
          <Palette
            items={paletteItems(shell.rooms, concepts)}
            onClose={() => setPaletteOpen(false)}
            onOpen={(item: PaletteItem) => { setPaletteOpen(false); open(item.room) }}
          />
        )}
        <FrontDoor onEnter={enter} stageFailed={stageFailed} />
        {/* Phase 10 (REQ-14, ADR-1350): the face is asked on its own door, by typing or by voice. */}
        <Dock door={door} onDoor />
      </>
    )
  }

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

  if (!registry || !shell) {
    return (
      <main className="min-h-screen" style={{ background: 'var(--bg-0)', color: 'var(--text-1)', fontFamily: UI }}>
        <Loading what="the company" />
      </main>
    )
  }

  const shownId = roomId ?? home
  const room = shownId === null ? null : findRoom(shell.rooms, shownId)
  // A template is not a room you can open; asking for it by URL is answered like any unknown id.
  const openable = room && !room.template ? room : null
  const items: PaletteItem[] = paletteItems(shell.rooms, concepts)
  const needs = needsYouByRoom(openItems ?? [], contract, shell.rooms.map((r) => r.id))
  const attached = openable ? attachment.attached[openable.id] : undefined
  const ctx: ModuleContext | null = openable
    ? {
        room: openable, rooms: shell.rooms, door, onOpen: open, mode: registry.mode, token, pulse,
        needs: needs.counts, needsUnplaced: needs.unplaced, inventories: registry.inventories, laneMap: contract.lanes?.map,
      }
    : null

  return (
    <div className="relative min-h-screen" style={{ fontFamily: UI, background: stage ? 'transparent' : 'var(--bg-0)', color: 'var(--text-1)' }}>
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
        onExit={exit}
        attachment={attachment}
        ringCount={registry.rings.length}
        extrasNote={extras.isLoading ? '' : extrasNote}
      />

      <Header
        room={openable}
        mode={modeChip(registry.mode)}
        inbox={{ open: openItems === null ? null : openItems.length, room: roomHoldingKind(registry, APPROVAL_KIND) }}
        onOpen={open}
        onExit={exit}
        mood={mood}
        onToggleMood={toggleMood}
        asOf={asOf}
        today={today}
        asOfSupported={openable !== null && ASOF_ROUTES.length > 0 && asOfReaches(openable, attached ? attached.manifest : null)}
        onAsOf={(day) => {
          setAsOf(day)
          // The page rides along: an as-of write that dropped it would reload into a different page (attack 5308c9c B5).
          window.history.replaceState(null, '', buildHash(openable ? openable.id : shownId ?? '', token, day, at))
        }}
        groups={groups}
        current={openable ? openable.id : null}
        reference={{ at: openable ? referenceAt(openable) : null, served: referenceId !== null }}
        onReference={(a) => { if (referenceId !== null) open(referenceId, a) }}
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
                <RoomFrame key={`${openable.id}|${at ?? ''}`} room={openable} attachment={attachment} ctx={ctx} seed={at && openable.id === referenceId ? { at } : undefined} />
              </div>
            ) : (
              <NoSuchRoom id={shownId ?? ''} extrasNote={extras.isLoading ? 'the exemption rows are still being read' : extrasNote} />
            )}
          </section>
        </div>
      </main>

      <Dock door={door} />
    </div>
  )
  })()

  return (
    <>
      {stage}
      {/* the reading scrim, only while the face is still flying into the workroom (v0.7 App.jsx); once the stage
          unmounts the workroom's own ground takes over. z 0, after the stage: above the face, and below the room, whose
          drawers must stack over everything. */}
      {stage && surface === 'hq' && <div aria-hidden="true" className="fixed inset-0 pointer-events-none" style={{ zIndex: 0, background: 'var(--bg-0)', opacity: 0.6 }} />}
      {body}
    </>
  )
}

/**
 * An unknown room id is a thing a person can type. It gets a named answer, never a blank screen --
 * the product exists so nothing goes missing, and its own router must not be where something does.
 */
/**
 * A room id nothing draws. While the rooms arc does not serve are unread -- or could not be read -- the answer is not
 * "there is no such room": that would be a claim made from a failed read (company ring attack).
 */
function NoSuchRoom({ id, extrasNote }: { id: string; extrasNote: string }) {
  const unsure = extrasNote !== ''
  return (
    <div className="py-10">
      <h1 className="text-[22px] sm:text-[26px] leading-[1.15] tracking-[-0.01em]" style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-1)' }}>
        {unsure ? <>No room called “{id}” is drawn yet.</> : <>There is no room called “{id}”.</>}
      </h1>
      <p className="text-[13.5px] leading-[21px] mt-1.5" style={{ color: 'var(--text-2)' }}>
        {unsure ? <>The rooms arc does not serve are drawn from a file the door serves, and {extrasNote}.</> : <>Every room arc has is in the rail.</>}
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
