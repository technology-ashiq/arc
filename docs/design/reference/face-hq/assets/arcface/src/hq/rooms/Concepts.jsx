// CONCEPTS — "Every word arc uses, and the room it lives in."
// The glossary inventory behind the command palette: 107 seed terms, each
// anchored to a room and a station, plus the terms you define here. A term
// without a room is a face-coverage failure in arc — listed, never hidden.
import { useState } from 'react'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { MONO, Btn, Field, TextInput, PickRow, SimBadge, YoursBadge, Meter, Chip } from '../../ui/kit.jsx'
import { RoomHead, HPanel, SectionLabel, Empty, EventRow, ReceiptDrawer } from '../bits.jsx'
import { useSpine } from '../useSpine.js'
import { spine } from '../../spine/store.js'
import { wsAppend } from '../../spine/workspace.js'
import { concepts, searchConcepts } from '../../spine/registries.js'
import { FACTS } from '../../data/arcFacts.js'
import { uiBus } from '../../lib/uiBus.js'
import { ROOM_META, ROOM_IDS, resolveRoom, roomMeta } from '../roomRegistry.js'

const ROOM = 'concepts'

// a term is a small item card: the word, its station, and who homed it
function TermChip({ c, onOpen }) {
  const id = resolveRoom(c.room)
  return (
    <button
      type="button"
      onClick={() => id && onOpen(id)}
      title={id ? `open ${id}` : 'no room resolves for this term'}
      className="inline-flex items-baseline gap-1.5 px-2.5 py-[5px] text-left cursor-pointer max-w-full border border-(--line-1) hover:border-(--accent) transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)"
      style={{ background: 'var(--well)', borderRadius: 'var(--r-sm)' }}
    >
      <span className="text-[12.5px] break-words" style={{ fontWeight: 500, color: 'var(--text-1)' }}>{c.term}</span>
      {c.station && <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>· {c.station}</span>}
      {!c.seed && <YoursBadge>yours</YoursBadge>}
    </button>
  )
}

// an inline confirmation under a write path — quiet, never an alert
function Note({ children }) {
  return (
    <div className="mt-3 pl-3 text-[12.5px] leading-[19px] break-words" style={{ borderLeft: '2px solid var(--accent)', color: 'var(--text-2)' }}>
      {children}
    </div>
  )
}

export default function Concepts() {
  useSpine()
  const [q, setQ] = useState('')
  const [term, setTerm] = useState('')
  const [room, setRoom] = useState('spine')
  const [station, setStation] = useState('')
  const [def, setDef] = useState('')
  const [msg, setMsg] = useState(null)
  const [st, setSt] = useState(null) // station filter — local to this view; the palette searches terms only
  const [receipt, setReceipt] = useState(null)

  const all = concepts()
  const s = q.trim()
  const hits = s ? searchConcepts(s) : []
  const stations = [...all.reduce((m, c) => (c.station ? m.set(c.station, (m.get(c.station) || 0) + 1) : m), new Map()).entries()].sort((a, b) => b[1] - a[1])
  const byRoom = new Map()
  const unhomed = []
  for (const c of all) {
    const id = resolveRoom(c.room)
    if (!id) {
      unhomed.push(c)
      continue
    }
    if (!byRoom.has(id)) byRoom.set(id, [])
    byRoom.get(id).push(c)
  }
  // coverage is always the whole glossary; the station filter narrows only the grouped view
  const coverage = ROOM_META.filter((r) => byRoom.has(r.id)).map((r) => ({ room: r, terms: byRoom.get(r.id) }))
  const grouped = coverage.map((g) => ({ room: g.room, terms: st ? g.terms.filter((c) => c.station === st) : g.terms })).filter((g) => g.terms.length > 0)
  const empty = ROOM_META.filter((r) => !byRoom.has(r.id))
  const max = Math.max(1, ...coverage.map((g) => g.terms.length))
  const yours = all.filter((c) => !c.seed).length
  const trail = spine.events.filter((e) => e.kind === 'concept.defined' && e.module === ROOM).slice(-6).reverse()
  const open = (id) => uiBus.openRoom(id)

  const define = () => {
    const t = term.trim()
    if (!t || !room) return
    if (all.some((c) => c.term.toLowerCase() === t.toLowerCase())) {
      setMsg(`“${t}” already has a home — ${all.find((c) => c.term.toLowerCase() === t.toLowerCase()).room}. one word, one room.`)
      return
    }
    const st = station.trim()
    wsAppend('concept.defined', ROOM, `term “${t}” homed in ${room}${st ? ' · ' + st : ''}`, { term: t, room, station: st, def: def.trim() })
    setTerm('')
    setStation('')
    setDef('')
    setMsg(`“${t}” is homed in ${room} — the palette finds it now.`)
  }

  return (
    <>
      <RoomHead title="Every word arc uses, and the room it lives in." hint={`${FACTS.concepts.count} terms, each anchored to a room and a station — this is what the command palette searches`} right={<YoursBadge>concepts · definitions persisted</YoursBadge>} />

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="Find a term" hint="the same fold the ⌘K palette runs — substring, first 8">
            <Field label="Term"><TextInput value={q} onChange={setQ} placeholder="receipt · appetite · verdict · quarantine …" autoFocus /></Field>
            {s && (
              <div className="mt-3">
                {hits.length === 0 && <Empty icon={MagnifyingGlass} title={`No term contains “${s}”`} hint="define it below if arc needs the word." />}
                <div className="flex flex-wrap gap-2">
                  {hits.map((c) => (
                    <span key={c.term + c.room} className="inline-flex items-center gap-1.5 max-w-full">
                      <TermChip c={c} onOpen={open} />
                      <span className="text-[11.5px] truncate" style={{ color: 'var(--text-3)' }}>→ {(roomMeta(resolveRoom(c.room)) || { name: c.room }).name}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </HPanel>

          {!s && st && (
            <div className="flex items-center gap-3 mb-4 text-[12.5px]" style={{ color: 'var(--text-2)' }}>
              <span>showing station <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{st}</span> only</span>
              <Btn small onClick={() => setSt(null)}>Clear</Btn>
            </div>
          )}
          {!s && st && grouped.length === 0 && <div className="text-[12.5px] mb-4" style={{ color: 'var(--text-3)' }}>no term sits at station “{st}” in any room that resolves.</div>}
          {!s && grouped.map(({ room: r, terms }) => (
            <HPanel key={r.id} title={r.name} hint={r.sentence} actions={<Chip>{terms.length}</Chip>}>
              <div className="flex flex-wrap gap-2">
                {terms.map((c) => <TermChip key={c.term + (c.id || '')} c={c} onOpen={open} />)}
              </div>
            </HPanel>
          ))}

          {!s && unhomed.length > 0 && (
            <HPanel title="Unhomed" hint="a term without a room is a face-coverage failure in arc; here it is listed, not hidden" actions={<Chip tone="amber">{unhomed.length}</Chip>}>
              <div className="flex flex-wrap gap-2 mb-2">
                {unhomed.map((c) => <TermChip key={c.term + (c.id || '')} c={c} onOpen={open} />)}
              </div>
              <div className="text-[12px] leading-[17px] break-words" style={{ color: 'var(--text-3)' }}>
                room ids that resolve nowhere: <span style={{ fontFamily: MONO }}>{[...new Set(unhomed.map((c) => c.room))].join(', ')}</span>
              </div>
            </HPanel>
          )}

          <HPanel title="Define a term" hint="concept.defined → homed in a room, found by the palette">
            <form className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3" onSubmit={(e) => { e.preventDefault(); define() }}>
              <Field label="Term"><TextInput value={term} onChange={setTerm} placeholder="the word arc uses" /></Field>
              <Field label="Station" hint="optional"><TextInput value={station} onChange={setStation} placeholder="emit · validate · verdict …" /></Field>
              <Field label="One-line definition" className="sm:col-span-2"><TextInput value={def} onChange={setDef} placeholder="what it means, in one honest line" /></Field>
            </form>
            <Field label="Room" hint={room} className="mb-3">
              <PickRow options={ROOM_IDS} value={room} onPick={setRoom} small />
            </Field>
            <div className="flex justify-end"><Btn tone="primary" onClick={define}>Home it →</Btn></div>
            {msg && <Note>{msg}</Note>}
          </HPanel>
        </div>

        <div className="min-w-0">
          <HPanel title="Coverage" hint="terms per room · face-coverage asserts every term has a home">
            <div className="text-[12.5px] tnum mb-3 break-words" style={{ color: 'var(--text-2)' }}>
              {FACTS.concepts.count} seed terms + {yours} yours{unhomed.length ? ` · ${unhomed.length} unhomed` : ' · no unhomed term — face-coverage holds'}
            </div>
            <div className="-mx-2">
              {coverage.map(({ room: r, terms }) => (
                <button key={r.id} type="button" onClick={() => open(r.id)} className="w-full grid grid-cols-[96px_1fr_32px] items-center gap-3 px-2 py-[5px] text-[12.5px] cursor-pointer transition-colors duration-200 hover:bg-(--bg-3) focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)" style={{ borderRadius: 'var(--r-sm)' }}>
                  <span className="text-left truncate" style={{ color: 'var(--text-1)' }}>{r.name}</span>
                  <div className="min-w-0"><Meter value={terms.length / max} tone="blue" /></div>
                  <span className="text-right tnum" style={{ fontFamily: MONO, color: 'var(--text-2)' }}>{terms.length}</span>
                </button>
              ))}
            </div>
            {empty.length > 0 && (
              <div className="mt-4">
                <SectionLabel>No term yet · {empty.length} rooms</SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  {empty.map((r) => (
                    <Chip key={r.id}>{r.name}{r.planned ? ' · planned' : r.extra ? ' · this app' : ''}</Chip>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-4 text-[12.5px] leading-[19px] break-words" style={{ color: 'var(--text-3)' }}>{FACTS.concepts.note}</div>
            <div className="mt-2"><SimBadge>seed terms · repo fact 2026-08-19</SimBadge></div>
          </HPanel>

          <HPanel title="Stations" hint="where on the room's line a term sits · click to filter the grouped view" actions={<Chip>{stations.length}</Chip>}>
            <PickRow options={stations.map(([name, n]) => ({ value: name, label: `${name} ${n}` }))} value={st} onPick={(v) => setSt(st === v ? null : v)} small />
            <div className="mt-3 text-[12px] leading-[17px]" style={{ color: 'var(--text-3)' }}>this filter is local to the view — the ⌘K palette matches on the term, not the station</div>
          </HPanel>

          <HPanel title="The trail" hint="concept.defined — last 6">
            {trail.length === 0 && <div className="text-[12.5px]" style={{ color: 'var(--text-3)' }}>no term defined by you yet — the glossary is the seed.</div>}
            <div className="-mx-2">
              {trail.map((e) => (
                <EventRow key={e.id} e={e} onReceipt={setReceipt} />
              ))}
            </div>
          </HPanel>
        </div>
      </div>

      <ReceiptDrawer ev={receipt} onClose={() => setReceipt(null)} />
    </>
  )
}
