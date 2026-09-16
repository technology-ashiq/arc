// ORG — "Sixteen lanes. Who is awake, who is idle, who is blocked."
// The company as a roster rather than a board: every born lane, its ring,
// its status as read from PROGRESS.md headers, and the one thing it waits
// on. A receipt firing today makes a lane awake whatever the file says.
// Statuses you set and lanes you birth are receipts; the roster is a fold.
import { useState } from 'react'
import { UsersThree } from '@phosphor-icons/react'
import { MONO, COLOR, Btn, Field, TextInput, PickRow, SimBadge, YoursBadge, Meter, Chip } from '../../ui/kit.jsx'
import { RoomHead, HPanel, KpiStrip, Empty, EventRow, ReceiptDrawer } from '../bits.jsx'
import { useSpine } from '../useSpine.js'
import { spine } from '../../spine/store.js'
import { wsAppend } from '../../spine/workspace.js'
import { lanesRoster, orgCounts } from '../../spine/registries.js'
import { FACTS } from '../../data/arcFacts.js'
import { uiBus } from '../../lib/uiBus.js'
import { RING_ORDER, roomMeta, resolveRoom } from '../roomRegistry.js'

const STATUSES = ['awake', 'idle', 'blocked']
const APPETITES = [{ value: 3, label: '3d' }, { value: 5, label: '5d' }, { value: 8, label: '8d' }, { value: 12, label: '12d' }]
const KINDS = new Set(['lane.status', 'lane.born'])
const LANE_RE = /^[a-z][a-z0-9-]+$/
const STATUS_TONE = { awake: 'cyan', blocked: 'amber' }

// the one line a lane is waiting on — amber only when it is blocked
function WaitingLine({ r }) {
  if (r.status === 'blocked') return <div className="text-[12.5px] leading-[18px] mt-2 break-words" style={{ color: COLOR.amber }}>waiting on: {r.waitingOn || r.dependsOn || 'unstated — the PROGRESS.md header carries no blocked-on line'}</div>
  if (r.status === 'idle') return <div className="text-[12.5px] leading-[18px] mt-2 break-words" style={{ color: 'var(--text-3)' }}>idle — {(r.next || '').slice(0, 80) || 'no next line written'}</div>
  return <div className="text-[12.5px] leading-[18px] mt-2" style={{ color: 'var(--text-2)' }}>awake · {r.receiptsToday} receipts today</div>
}

// an inline confirmation under a write path — quiet, never an alert
function Note({ children, className = '' }) {
  return (
    <div className={`pl-3 text-[12.5px] leading-[19px] break-words ${className}`} style={{ borderLeft: '2px solid var(--accent)', color: 'var(--text-2)' }}>
      {children}
    </div>
  )
}

export default function Org() {
  useSpine()
  const roster = lanesRoster()
  const counts = orgCounts()
  const receiptsToday = roster.reduce((s, r) => s + (r.receiptsToday || 0), 0)
  const blocked = roster.filter((r) => r.status === 'blocked')
  const [edit, setEdit] = useState(null) // { lane, to, waitingOn }
  const [lane, setLane] = useState('')
  const [ring, setRing] = useState('money')
  const [appetite, setAppetite] = useState(5)
  const [plan, setPlan] = useState('')
  const [msg, setMsg] = useState(null)
  const [receipt, setReceipt] = useState(null)
  const trail = spine.events.filter((e) => KINDS.has(e.kind)).slice(-6).reverse()

  const submitStatus = (r) => {
    const to = edit.to
    const waitingOn = edit.waitingOn.trim()
    if (to === 'blocked' && !waitingOn) return
    wsAppend('lane.status', 'org', `lane ${r.lane}: ${r.status} → ${to}${waitingOn ? ' · waiting on ' + waitingOn : ''}`, { lane: r.lane, status: to, waitingOn: waitingOn || null })
    setEdit(null)
    setMsg(`${r.lane} is ${to}${waitingOn ? ' — waiting on ' + waitingOn : ''}.`)
  }

  const birth = () => {
    const id = lane.trim()
    if (!LANE_RE.test(id) || roster.some((r) => r.lane === id)) return
    wsAppend('lane.born', 'org', `lane ${id} born in ${ring} · appetite ${appetite}d · its room lands dotted until built (the birth rule: a lane lands its room in the same change)`, { lane: id, ring, room: id, appetite: appetite + 'd', plan: plan.trim() || null })
    setLane('')
    setPlan('')
    setMsg(`${id} is born in ${ring} — awake, one phase, its room drawn dotted until it lands.`)
  }
  const laneBad = lane.trim() && (!LANE_RE.test(lane.trim()) || roster.some((r) => r.lane === lane.trim()))

  return (
    <>
      <RoomHead title="Sixteen lanes. Who is awake, who is idle, who is blocked." hint="the company as a roster rather than a board — every lane, its status, and the one thing it is waiting on" right={<YoursBadge>org · statuses persisted</YoursBadge>} />

      <KpiStrip
        items={[
          { v: counts.awake, l: 'Awake' },
          { v: counts.idle, l: 'Idle' },
          { v: counts.blocked, l: 'Blocked', tone: counts.blocked ? 'amber' : undefined },
          { v: receiptsToday, l: 'Receipts today' },
        ]}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          {RING_ORDER.map((ringId) => {
            const lanes = roster.filter((r) => r.ring === ringId)
            if (!lanes.length) return null
            return (
              <HPanel key={ringId} title={`${ringId} — ${lanes.length} lane${lanes.length === 1 ? '' : 's'}`} hint="status: from PROGRESS.md · liveness: from receipts">
                <div className="space-y-2.5">
                  {lanes.map((r) => {
                    const rid = resolveRoom(r.room)
                    const meta = rid ? roomMeta(rid) : null
                    const editing = edit && edit.lane === r.lane
                    const total = r.phasesTotal || 0
                    return (
                      <div key={r.lane} className="p-3.5 min-w-0" style={{ background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }}>
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span className="text-[13.5px]" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-1)' }}>{r.lane}</span>
                          <Chip tone={STATUS_TONE[r.status]}>{r.status}</Chip>
                          {meta ? (
                            <button type="button" onClick={() => uiBus.openRoom(rid)} className="text-[12px] cursor-pointer hover:underline" style={{ color: COLOR.cyan }}>{meta.name} →</button>
                          ) : (
                            <span className="text-[12px]" style={{ color: COLOR.violet }}>room {r.room} · dotted, not built</span>
                          )}
                          {r.appetite && <Chip>{r.appetite.value} bought · {r.appetite.burn} burnt</Chip>}
                          {r.seed ? <SimBadge>repo fact</SimBadge> : <YoursBadge>yours</YoursBadge>}
                        </div>
                        <div className="text-[12px] leading-[17px] break-words" style={{ color: 'var(--text-3)' }}>{r.cycle}</div>
                        <div className="text-[13px] leading-[19px] mt-1 break-words" style={{ color: 'var(--text-2)' }}>{(r.phase || '—').slice(0, 80)}</div>
                        <div className="flex items-center gap-3 mt-2.5">
                          <div className="flex-1 min-w-0"><Meter value={total ? r.phasesClosed / total : 0} tone="blue" /></div>
                          <span className="text-[12px] tnum shrink-0" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>closed {r.phasesClosed}/{total}</span>
                        </div>
                        <WaitingLine r={r} />
                        {r.src && <div className="mt-1 text-[11px] leading-[15px] break-all" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{r.src}</div>}
                        <div className="mt-3 flex gap-2 flex-wrap items-center">
                          {!editing && <Btn small onClick={() => setEdit({ lane: r.lane, to: r.status, waitingOn: r.waitingOn || '' })}>Set status</Btn>}
                          {editing && (
                            <div className="w-full space-y-2">
                              <PickRow options={STATUSES} value={edit.to} onPick={(to) => setEdit({ ...edit, to })} small />
                              <TextInput value={edit.waitingOn} onChange={(v) => setEdit({ ...edit, waitingOn: v })} placeholder={edit.to === 'blocked' ? 'waiting on — required when blocked' : 'waiting on — optional'} />
                              <div className="flex gap-2 flex-wrap items-center">
                                <Btn small tone="primary" onClick={() => submitStatus(r)}>Record status →</Btn>
                                <Btn small onClick={() => setEdit(null)}>Cancel</Btn>
                                {edit.to === 'blocked' && !edit.waitingOn.trim() && <span className="text-[12px]" style={{ color: COLOR.red }}>a blocked lane names what it waits on</span>}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </HPanel>
            )
          })}
          {!roster.length && (
            <HPanel title="Roster">
              <Empty icon={UsersThree} title="No lanes born" hint="the roster is empty, and it says so" />
            </HPanel>
          )}
          {msg && <Note className="mb-4">{msg}</Note>}

          <HPanel title="Birth a lane" hint="lane.born → awake · one phase · its room drawn dotted until it lands">
            <form
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                birth()
              }}
            >
              <Field label="Lane name" hint={<span style={{ fontFamily: MONO }}>/^[a-z][a-z0-9-]+$/</span>}><TextInput value={lane} onChange={setLane} placeholder="support · trader · discover" /></Field>
              <Field label="One-line plan"><TextInput value={plan} onChange={setPlan} placeholder="what this lane proves in its first cycle" /></Field>
              <Field label="Ring"><PickRow options={RING_ORDER} value={ring} onPick={setRing} /></Field>
              <Field label="Appetite"><PickRow options={APPETITES} value={appetite} onPick={setAppetite} /></Field>
              <div className="sm:col-span-2 flex items-center justify-between gap-3 flex-wrap">
                {laneBad ? (
                  <span className="text-[12px]" style={{ color: COLOR.red }}>lowercase, digits, hyphens — and not a lane that already exists</span>
                ) : (
                  <span className="text-[12px]" style={{ color: 'var(--text-3)' }}>the birth rule: a lane lands its room in the same change</span>
                )}
                <Btn tone="primary">Birth →</Btn>
              </div>
            </form>
          </HPanel>

          <HPanel title="The trail" hint="lane.status · lane.born — every status you set is a receipt">
            <div className="-mx-2">
              {trail.map((e) => (
                <EventRow key={e.id} e={e} onReceipt={setReceipt} />
              ))}
            </div>
            {!trail.length && <div className="text-[12.5px]" style={{ color: 'var(--text-3)' }}>nothing yet — the roster is read straight from the repo until you set a status</div>}
          </HPanel>
        </div>

        <div className="min-w-0">
          <HPanel title="The roster rule">
            <div className="text-[13.5px] leading-[21px] space-y-2 max-w-[72ch]" style={{ color: 'var(--text-2)' }}>
              <p>The company is a roster, not a board. A lane is a row: its ring, its status, and the one thing it is waiting on.</p>
              <p>Status is read from each lane's PROGRESS.md header — <span style={{ fontFamily: MONO }}>status:</span> and <span style={{ fontFamily: MONO }}>blocked-on:</span>. {FACTS.meta.note}.</p>
              <p>Receipts outrank the file: a lane whose room fired today is awake whatever the header says.</p>
            </div>
          </HPanel>

          <HPanel title="ADR bands" hint="each lane owns an ADR century">
            <div className="-mx-2">
              {(FACTS.portfolioBands || []).slice(0, 12).map((b) => (
                <div key={b.band} className="grid grid-cols-[86px_1fr] gap-3 px-2 py-[6px] text-[12.5px] leading-[18px] transition-colors duration-200 hover:bg-(--bg-3)" style={{ borderBottom: '1px solid var(--line-1)', borderRadius: 'var(--r-sm)' }}>
                  <span className="tnum truncate" style={{ fontFamily: MONO, color: 'var(--text-1)' }}>{b.band}</span>
                  <span className="min-w-0 break-words" style={{ color: 'var(--text-2)' }}>{b.owner}</span>
                </div>
              ))}
            </div>
          </HPanel>

          <HPanel title="Who is waiting on whom" actions={<Chip tone={blocked.length ? 'amber' : undefined}>{blocked.length} blocked</Chip>}>
            <div className="-mx-2">
              {blocked.map((r) => (
                <div key={r.lane} className="grid grid-cols-[auto_1fr] gap-2 px-2 py-[6px] text-[12.5px] leading-[18px] transition-colors duration-200 hover:bg-(--bg-3)" style={{ borderBottom: '1px solid var(--line-1)', borderRadius: 'var(--r-sm)' }}>
                  <span style={{ fontFamily: MONO, color: 'var(--text-1)' }}>{r.lane}</span>
                  <span className="min-w-0 break-words" style={{ color: COLOR.amber }}>→ {r.waitingOn || r.dependsOn || 'unstated'}</span>
                </div>
              ))}
            </div>
            {!blocked.length && <div className="text-[12.5px]" style={{ color: 'var(--text-3)' }}>nothing is blocked</div>}
          </HPanel>
        </div>
      </div>

      <ReceiptDrawer ev={receipt} onClose={() => setReceipt(null)} />
    </>
  )
}
