// TOOLBELT — "Every command, every agent, every rule — one place to look."
// A read-only index over the arc repo tree (commands, agents, hooks, rules,
// lints, processes, gates, products). The only write is a pin; "explain"
// hands the question to ask-arc. Counts derive from the arrays, never typed.
import { useState } from 'react'
import { MagnifyingGlass, PushPin } from '@phosphor-icons/react'
import { UI, MONO, COLOR, tint, Btn, Field, TextInput, SimBadge, YoursBadge, Meter, Chip } from '../../ui/kit.jsx'
import { RoomHead, HPanel, KpiStrip, SectionLabel, Empty } from '../bits.jsx'
import { useSpine } from '../useSpine.js'
import { spine } from '../../spine/store.js'
import { wsAppend } from '../../spine/workspace.js'
import { FACTS } from '../../data/arcFacts.js'
import { ARC } from '../../data/arcKnowledge.js'
import { uiBus } from '../../lib/uiBus.js'
import { resolveRoom, roomMeta } from '../roomRegistry.js'

const ROOM = 'toolbelt'
const ROOM_RENAME = { today: 'overview', 'engine-room': 'engine', 'council-chamber': 'council', lane: 'org', ledger: 'money' }
const roomOf = (id) => resolveRoom(ROOM_RENAME[id] || id)
const TB = FACTS.toolbelt
const bare = (name) => name.replace(/\s*\((G|legacy|Phase \d+)\)\s*$/, '')
const detailOf = (type, name) => {
  if (type === 'command') {
    const c = ARC.commands.find((x) => x.name === '/' + bare(name))
    return c ? c.detail : null
  }
  if (type === 'agent') {
    const a = ARC.agents.find((x) => x.name === bare(name))
    return a ? a.detail || a.role : null
  }
  return null
}

const SECTIONS = [
  { type: 'command', title: 'commands', items: TB.commands.items, note: TB.commands.note, label: (n) => '/' + n },
  { type: 'agent', title: 'agents', items: TB.agents.items, note: TB.agents.note },
  { type: 'hook', title: 'hooks', items: TB.hooks.items, onDisk: TB.hooks.onDisk },
  { type: 'rule', title: 'rules', items: TB.rules.items, note: TB.rules.note, onDisk: TB.rules.onDisk },
  { type: 'lint', title: 'lints', items: TB.lints.items, compact: true },
  { type: 'process', title: 'processes', items: TB.processes.items, note: TB.processes.note, onDisk: TB.processes.onDisk },
  { type: 'gate', title: 'gates', items: TB.gates.items, note: 'seven gates · the room that holds them is review · ship' },
  { type: 'product', title: 'products', items: TB.products.items, note: TB.products.note },
]

// the room a tool is held in — a small accent pill that opens the room
function RoomChip({ room }) {
  const id = roomOf(room)
  const m = id ? roomMeta(id) : null
  if (!id) return <span className="text-[11px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{room} · no room</span>
  return (
    <button
      type="button"
      onClick={() => uiBus.openRoom(id)}
      title={`open ${m ? m.name : id}`}
      className="inline-flex items-center h-[22px] px-2 rounded-full text-[11px] whitespace-nowrap cursor-pointer transition-colors duration-200 hover:bg-(--accent)/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)"
      style={{ fontFamily: UI, fontWeight: 500, color: 'var(--accent)', background: tint('accent', 0.08), border: '1px solid ' + tint('accent', 0.28) }}
    >
      {m ? m.name : id}
    </button>
  )
}

// one catalogue row: name (mono — it is an id), its room, the three quiet actions.
// The action labels stay lowercase in the DOM (flows.mjs matches `pin` exactly)
// and read capitalised through CSS.
function ItemRow({ type, item, label, compact, open, onToggle, onPin, onExplain, pinned }) {
  const detail = detailOf(type, item.name)
  return (
    <div className={`min-w-0 px-2 rounded-md transition-colors duration-200 hover:bg-(--bg-3) border-b border-(--line-1) last:border-b-0 ${compact ? 'py-1.5' : 'py-2.5'}`}>
      <div className="flex items-center gap-2.5 flex-wrap min-w-0">
        <span className={`${compact ? 'text-[12.5px]' : 'text-[13px]'} break-all min-w-0`} style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-1)' }}>
          {label ? label(item.name) : item.name}
        </span>
        {item.room && <RoomChip room={item.room} />}
        {pinned && <YoursBadge>pinned</YoursBadge>}
        <span className="ml-auto flex gap-1.5 shrink-0">
          {detail && <Btn small className="capitalize" onClick={onToggle}>{open ? 'less' : 'detail'}</Btn>}
          <Btn small className="capitalize" onClick={onPin} title="pin to the top of this room">pin</Btn>
          <Btn small className="capitalize" onClick={onExplain} title="ask arc what this does">explain</Btn>
        </span>
      </div>
      {!compact && item.oneLine && (
        <div className="text-[12.5px] leading-[19px] mt-0.5 break-words" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{item.oneLine}</div>
      )}
      {open && detail && (
        <div className="text-[12.5px] leading-[19px] mt-2 px-3 py-2 break-words" style={{ fontFamily: UI, color: 'var(--text-1)', background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }}>
          {detail}
        </div>
      )}
    </div>
  )
}

export default function Toolbelt() {
  useSpine()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(null)
  const [msg, setMsg] = useState(null)
  const s = q.trim().toLowerCase()
  const hit = (it) => !s || it.name.toLowerCase().includes(s) || (it.oneLine || '').toLowerCase().includes(s) || (it.room || '').toLowerCase().includes(s)

  const pinEvents = spine.events.filter((e) => e.kind === 'tool.pinned' && e.payload && e.payload.name)
  const pinned = [...new Map(pinEvents.map((e) => [e.payload.name, e])).values()].slice(-8).reverse()
  const pinnedNames = new Set(pinned.map((e) => e.payload.name))

  const pin = (type, name) => {
    if (pinnedNames.has(name)) {
      setMsg({ tone: 'warn', text: `${type} ${name} is already pinned` })
      return
    }
    wsAppend('tool.pinned', ROOM, `pinned ${type} ${name}`, { name, type })
    setMsg({ tone: 'ok', text: `pinned ${type} ${name} — it sits at the top of this room now` })
  }
  const explain = (type, name) => {
    uiBus.pendingAskQ = `What does ${type} ${name} do in arc?`
    uiBus.openRoom('ask-arc')
  }

  // every item across every section, counted by the room it lives in (arc id → this app's id)
  const byRoom = new Map()
  for (const sec of SECTIONS) for (const it of sec.items) {
    const id = roomOf(it.room) || 'unresolved'
    byRoom.set(id, (byRoom.get(id) || 0) + 1)
  }
  const roomCounts = [...byRoom.entries()].sort((a, b) => b[1] - a[1])
  const roomMax = Math.max(1, ...roomCounts.map(([, n]) => n))

  const figures = [
    { v: TB.commands.items.length, l: 'Commands', sub: TB.commands.note },
    { v: TB.agents.items.length, l: 'Agents', sub: TB.agents.note },
    { v: TB.hooks.items.length, l: 'Hooks', sub: `${TB.hooks.onDisk.length} files on disk under hooks/` },
    { v: TB.rules.items.length, l: 'Rules', sub: TB.rules.note },
    { v: TB.lints.items.length, l: 'Lints', sub: `across ${new Set(TB.lints.items.map((l) => l.room)).size} rooms` },
    { v: TB.processes.items.length, l: 'Processes', sub: TB.processes.note },
  ]

  const groups = SECTIONS.map((sec) => ({ sec, items: sec.items.filter(hit) }))
  const nothingMatches = Boolean(s) && groups.every((g) => g.items.length === 0)

  return (
    <>
      <RoomHead title="Every command, every agent, every rule — one place to look." hint="commands, agents, hooks, rules and the lints that hold them; click one and the face explains it" right={<SimBadge>read-only index · repo facts 2026-08-19 · pins persisted</SimBadge>} />

      <KpiStrip items={figures} />

      <HPanel title="Find" hint="substring, case-insensitive — filters every section below">
        <Field label="Search the toolbelt">
          <TextInput value={q} onChange={setQ} placeholder="kickoff · council · lint · hook · rls …" autoFocus />
        </Field>
        {msg && (
          <p className="mt-3 text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: msg.tone === 'warn' ? COLOR.amber : 'var(--accent)' }}>
            {msg.text}
          </p>
        )}
      </HPanel>

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="By room" hint="where each tool is held — counts derived from the sections below · click a room to open it" actions={<Chip>{roomCounts.length} rooms</Chip>}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5">
              {roomCounts.map(([id, n]) => {
                const m = roomMeta(id)
                return (
                  <div key={id} className="grid grid-cols-[104px_1fr_28px] items-center gap-2.5 py-[3px] min-w-0">
                    <button
                      type="button"
                      onClick={() => m && uiBus.openRoom(id)}
                      title={m ? `open ${m.name}` : 'no room resolves'}
                      className="text-left text-[12.5px] truncate cursor-pointer transition-colors duration-200 hover:text-(--accent) focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent) rounded"
                      style={{ fontFamily: UI, color: m ? 'var(--text-1)' : 'var(--text-3)' }}
                    >
                      {m ? m.name : id}
                    </button>
                    <Meter value={n / roomMax} tone="blue" />
                    <span className="text-right text-[12px] tnum" style={{ fontFamily: MONO, color: 'var(--text-2)' }}>{n}</span>
                  </div>
                )
              })}
            </div>
          </HPanel>
        </div>

        <div className="min-w-0">
          <HPanel title="Pinned" hint="tool.pinned receipts, unique by name, last 8" actions={<Chip>{pinned.length}</Chip>}>
            {pinned.length === 0 && (
              <Empty icon={PushPin} title="Nothing pinned yet" hint="Pin a command or an agent from the catalogue and it stays here across sessions." />
            )}
            {pinned.length > 0 && (
              <div className="-mx-2">
                {pinned.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => explain(e.payload.type, e.payload.name)}
                    title="explain in ask arc"
                    className="w-full grid grid-cols-[64px_1fr_auto] items-baseline gap-3 px-2 py-2 text-left cursor-pointer rounded-md transition-colors duration-200 hover:bg-(--bg-3) border-b border-(--line-1) last:border-b-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)"
                  >
                    <span className="text-[11px] truncate" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{e.payload.type}</span>
                    <span className="text-[12.5px] truncate min-w-0" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-1)' }}>
                      {e.payload.type === 'command' ? '/' + e.payload.name : e.payload.name}
                    </span>
                    <span className="text-[11px] shrink-0" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>⌗ {String(e.id).slice(-6)}</span>
                  </button>
                ))}
              </div>
            )}
          </HPanel>
        </div>
      </div>

      <HPanel title="Catalogue" hint="eight sections · the search above filters every one of them">
        {nothingMatches && (
          <Empty icon={MagnifyingGlass} title={`Nothing matches “${q.trim()}”`} hint="Names, one-liners and rooms are searched. Try a shorter word." />
        )}
        {!nothingMatches &&
          groups.map(({ sec, items }, i) => (
            <div key={sec.type} className={i ? 'mt-6' : ''}>
              <div className="flex items-baseline justify-between gap-3 min-w-0">
                <SectionLabel>
                  {sec.title} · {items.length}
                  {s ? ` of ${sec.items.length}` : ''}
                </SectionLabel>
                {sec.note && (
                  <span className="hidden sm:inline text-[12px] truncate min-w-0 mb-2" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{sec.note}</span>
                )}
              </div>
              {items.length === 0 && (
                <div className="text-[12.5px] py-1" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
                  No {sec.type} matches “{q.trim()}”.
                </div>
              )}
              {items.length > 0 && (
                <div className={sec.compact ? '-mx-2 grid grid-cols-1 lg:grid-cols-2 gap-x-6' : '-mx-2'}>
                  {items.map((it) => {
                    const key = sec.type + ':' + it.name
                    return (
                      <ItemRow
                        key={key}
                        type={sec.type}
                        item={it}
                        label={sec.label}
                        compact={sec.compact}
                        open={open === key}
                        onToggle={() => setOpen(open === key ? null : key)}
                        onPin={() => pin(sec.type, it.name)}
                        onExplain={() => explain(sec.type, it.name)}
                        pinned={pinnedNames.has(it.name)}
                      />
                    )
                  })}
                </div>
              )}
              {sec.onDisk && (
                <div className="mt-2.5 text-[11px] leading-[17px] break-words" style={{ color: 'var(--text-3)' }}>
                  <span style={{ fontFamily: UI }}>on disk ({sec.onDisk.length}) · </span>
                  <span style={{ fontFamily: MONO }}>{sec.onDisk.join(' · ')}</span>
                </div>
              )}
            </div>
          ))}
      </HPanel>
    </>
  )
}
