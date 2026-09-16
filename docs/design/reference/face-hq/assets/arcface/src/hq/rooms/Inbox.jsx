// INBOX — "A machine may raise it. Only you may decide it."
// The one write path in this product. arm-then-stamp: j/k move,
// a / r ARM a decision, Enter records it — with a typed reason
// (mandatory, ≤ 2000 bytes). No bulk action. No default. No undo.
// Every reason becomes calibration data the company learns from.
import { useEffect, useRef, useState } from 'react'
import { Tray, Stamp } from '@phosphor-icons/react'
import { UI, MONO, COLOR, Btn, Chip, SimBadge, YoursBadge, PickRow, INPUT_CLASS, INPUT_STYLE } from '../../ui/kit.jsx'
import { RoomHead, HPanel, KpiStrip, Empty, ReceiptDrawer } from '../bits.jsx'
import { spine, recordDecision } from '../../spine/store.js'
import { useSpine } from '../useSpine.js'
import { hhmm } from '../../spine/kinds.js'

export const REASON_MAX_BYTES = 2000
const bytes = (s) => new TextEncoder().encode(s || '').length
const factColor = { council: COLOR.cyan, money: COLOR.green, kill: COLOR.red }
// the reason box is the shared input style without the fixed control height
const REASON_CLASS = INPUT_CLASS.replace('h-[36px]', 'min-h-[84px] py-2') + ' resize-y placeholder:text-(--text-3)'
const KBD = { fontFamily: MONO, fontSize: 11, padding: '1px 5px', borderRadius: 'var(--r-sm)', background: 'var(--bg-4)', color: 'var(--text-1)' }
// the room that raises a card → the card it raises (an event kind is data)
const SOURCES = [
  ['bench', 'promotion.proposed', true],
  ['executor', 'hire (contractor tenure)'],
  ['absorb', 'adopt into lane (cap 12)'],
  ['policy / model-policy', 'level & tier changes (two keys)'],
  ['evolve', 'conclude experiment'],
  ['memory', 'promote lesson to rule'],
  ['ventures', 'kill review'],
  ['discover', 'kickoff'],
  ['growth', 'review pack'],
  ['design', 'pick'],
]

export default function Inbox() {
  useSpine()
  const pending = spine.pendingApprovals
  const [sel, setSel] = useState(0)
  const [armed, setArmed] = useState(null) // { id, approve, action }
  const [reason, setReason] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [view, setView] = useState('waiting')
  const reasonRef = useRef(null)
  const cur = pending[Math.min(sel, Math.max(0, pending.length - 1))]

  const arm = (ap, approve, action) => {
    if (!ap) return
    setArmed({ id: ap.id, approve, action: action || (approve ? ap.actions.find((a) => a.approved)?.label || 'approved' : 'rejected'), title: ap.title })
    setReason('')
    setTimeout(() => reasonRef.current && reasonRef.current.focus(), 20)
  }
  const disarm = () => setArmed(null)
  const stamp = () => {
    if (!armed) return
    const r = reason.trim()
    if (!r || bytes(r) > REASON_MAX_BYTES) return
    recordDecision(armed.id, armed.approve, r, armed.action)
    setArmed(null)
    setReason('')
    setSel((s) => Math.max(0, Math.min(s, pending.length - 2)))
  }

  useEffect(() => {
    const onKey = (e) => {
      const typing = e.target && /INPUT|TEXTAREA/.test(e.target.tagName)
      if (receipt && e.key === 'Escape') return setReceipt(null)
      if (typing) {
        if (e.key === 'Escape') disarm()
        if (e.key === 'Enter' && !e.shiftKey && armed) {
          e.preventDefault()
          stamp()
        }
        return
      }
      if (!pending.length) return
      if (e.key === 'j') setSel((s) => Math.min(s + 1, pending.length - 1))
      else if (e.key === 'k') setSel((s) => Math.max(s - 1, 0))
      else if (e.key === 'a') arm(cur, true)
      else if (e.key === 'r') arm(cur, false)
      else if (e.key === 'Escape') disarm()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const decisions = spine.events.filter((e) => e.kind === 'decision.recorded' && e.decided).slice().reverse()
  const yours = decisions.filter((e) => e.ws)
  const approved = decisions.filter((e) => e.decided.approved).length
  const avgReason = decisions.length ? Math.round(decisions.reduce((s, e) => s + bytes(e.decided.reason), 0) / decisions.length) : null
  const rows = view === 'waiting' ? [] : view === 'yours' ? yours : decisions

  return (
    <>
      <RoomHead
        title="A machine may raise it. Only you may decide it."
        hint="The one write path in this product — a typed reason, no bulk action, no default, no undo."
        right={<YoursBadge>inbox · every stamp persisted</YoursBadge>}
      />

      {/* the instrument strip — what your stamps taught, derived from decision.recorded only */}
      <KpiStrip
        items={[
          { v: pending.length, l: 'Waiting for you', sub: pending.length ? 'arm, then stamp' : 'inbox zero', tone: pending.length ? 'amber' : undefined },
          { v: decisions.length, l: 'Decisions ever' },
          { v: decisions.length ? Math.round((approved / decisions.length) * 100) + '%' : 'never-fired', l: 'Approve rate' },
          { v: avgReason === null ? 'never-fired' : avgReason + ' B', l: 'Average reason', sub: 'bytes · under ten is a smell' },
          { v: yours.length, l: 'Stamped by you', sub: 'persisted' },
        ]}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel
            title="Waiting"
            hint="j k move · a r arm · Enter stamps · esc disarms"
            tone={pending.length ? 'amber' : undefined}
            actions={<Chip tone={pending.length ? 'amber' : undefined}>{pending.length} waiting</Chip>}
          >
            {pending.length === 0 && (
              <Empty icon={Tray} title="Inbox zero. The company runs itself." hint="Approvals arrive as the day plays, and whenever a room proposes something that needs your stamp." />
            )}
            {pending.map((ap, i) => {
              const selected = i === Math.min(sel, pending.length - 1)
              const isArmed = armed && armed.id === ap.id
              const armColor = isArmed ? (armed.approve ? COLOR.green : COLOR.red) : null
              return (
                <div
                  key={ap.id}
                  data-approval={ap.id}
                  onClick={() => setSel(i)}
                  className="relative p-4 pl-5 mb-3 overflow-hidden transition-[border-color] duration-200 cursor-default"
                  style={{
                    background: 'var(--well)',
                    border: '1px solid ' + (armColor || (selected ? 'var(--accent)' : 'var(--line-1)')),
                    borderRadius: 'var(--r-md)',
                  }}
                >
                  <span aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: armColor || COLOR.amber }} />
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                    <b className="text-[13.5px] leading-[19px] min-w-0 break-words" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{ap.title}</b>
                    <span className="flex items-center gap-2 shrink-0">
                      {ap.ws ? <YoursBadge>raised by you</YoursBadge> : <SimBadge>raised by the sim</SimBadge>}
                      <Chip tone="amber">{ap.tag}</Chip>
                    </span>
                  </div>
                  <dl className="mb-4 space-y-[5px]">
                    {(ap.facts || []).map((f) => (
                      <div key={f.k} className="grid grid-cols-[56px_1fr] gap-2 items-baseline">
                        <dt className="text-[10.5px] uppercase tracking-[0.06em]" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-3)' }}>{f.k}</dt>
                        <dd className="text-[12.5px] leading-[18px] min-w-0 break-words" style={{ fontFamily: UI, color: factColor[f.k] || 'var(--text-2)' }}>{f.v}</dd>
                      </div>
                    ))}
                  </dl>
                  {!isArmed ? (
                    <div className="flex gap-2 flex-wrap">
                      {ap.actions.filter((a) => a.approved).map((a) => (
                        <Btn key={a.label} small tone={a.danger ? 'danger' : a.soft ? 'ghost' : 'green'} onClick={() => arm(ap, true, a.label)}>
                          Arm · {a.label}
                        </Btn>
                      ))}
                      <Btn small tone="danger" onClick={() => arm(ap, false)}>Arm · reject</Btn>
                    </div>
                  ) : (
                    <div className="pt-3" style={{ borderTop: '1px solid var(--line-1)' }}>
                      <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
                        <span className="text-[12px] min-w-0" style={{ fontFamily: UI }}>
                          <span style={{ fontWeight: 600, color: armColor }}>Armed · {armed.action}</span>
                          <span className="ml-2" style={{ color: 'var(--text-3)' }}>the reason is the record</span>
                        </span>
                        <span className="text-[11px] tnum shrink-0" style={{ fontFamily: MONO, color: bytes(reason) > REASON_MAX_BYTES ? COLOR.red : 'var(--text-3)' }}>{bytes(reason)} / {REASON_MAX_BYTES} bytes</span>
                      </div>
                      <textarea
                        ref={reasonRef}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                        placeholder="why — required. Cite the fact on the card you relied on. This sentence becomes calibration data."
                        className={REASON_CLASS}
                        style={INPUT_STYLE}
                      />
                      <div className="flex gap-2 flex-wrap mt-2 items-center">
                        <Btn small tone={armed.approve ? 'green' : 'danger'} onClick={stamp}>Stamp · enter</Btn>
                        <Btn small onClick={disarm}>Disarm · esc</Btn>
                        {!reason.trim() && <span className="text-[12px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>No reason, no stamp</span>}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </HPanel>

          <HPanel title="Decision log" hint="decision.recorded, read back out of the spine · ⌗ opens the receipt">
            <div className="mb-3">
              <PickRow
                small
                options={[
                  { value: 'waiting', label: `waiting ${pending.length}` },
                  { value: 'yours', label: `yours ${yours.length}` },
                  { value: 'all', label: `all ${decisions.length}` },
                ]}
                value={view}
                onPick={setView}
              />
            </div>
            {view === 'waiting' && (
              <p className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
                The waiting queue is above. Switch to <b style={{ fontWeight: 600, color: 'var(--text-1)' }}>yours</b> to read every stamp you recorded, with its reason.
              </p>
            )}
            {view !== 'waiting' && rows.length === 0 && (
              <Empty icon={Stamp} title="No decisions recorded yet" hint="Nothing is ever decided by default. Arm a card above, type the reason, and stamp it." />
            )}
            {rows.length > 0 && (
              <div className="-mx-2">
                {rows.slice(0, 40).map((d) => (
                  <div key={d.id} className="grid grid-cols-[52px_1fr_auto] gap-3 items-baseline px-2 py-2 transition-colors duration-200 hover:bg-(--bg-3)" style={{ borderBottom: '1px solid var(--line-1)', borderRadius: 'var(--r-sm)' }}>
                    <span className="text-[11.5px] tnum" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{hhmm(d.t)}</span>
                    <span className="min-w-0">
                      <span className="text-[12px] mr-2" style={{ fontFamily: UI, fontWeight: 600, color: d.decided.approved ? COLOR.green : COLOR.red }}>{d.decided.approved ? d.decided.actionLabel || 'approved' : 'rejected'}</span>
                      <span className="text-[13px] break-words" style={{ fontFamily: UI, fontWeight: 500, color: 'var(--text-1)' }}>{d.decided.title}</span>
                      <div className="text-[12px] leading-[18px] mt-0.5 break-words" style={{ fontFamily: UI, color: 'var(--text-2)' }}>reason: {d.decided.reason}</div>
                    </span>
                    <button type="button" onClick={() => setReceipt(d)} className="text-[11px] cursor-pointer hover:text-(--accent)" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>⌗ {String(d.id).slice(-6)}</button>
                  </div>
                ))}
              </div>
            )}
          </HPanel>
        </div>

        <div className="min-w-0">
          <HPanel title="Calibration" hint="what your stamps taught · derived from decision.recorded only">
            <p className="text-[13px] leading-[20px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              The reasons are the company learning its owner's taste. A reason under ten bytes is a smell; the council's calibration scoring reads these back.
            </p>
          </HPanel>

          <HPanel title="The inbox law">
            <div className="space-y-2 text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              <div>Three facts on every card — council, money, kill — never behind a click.</div>
              <div>
                Arm, then stamp: <kbd style={KBD}>a</kbd> / <kbd style={KBD}>r</kbd> arms, <kbd style={KBD}>Enter</kbd> records — two gestures, never one.
              </div>
              <div>A typed reason is mandatory, ≤ {REASON_MAX_BYTES} bytes; an empty reason cannot stamp.</div>
              <div>No bulk approve, no default action, no undo — a wrong stamp is corrected by a new decision that supersedes it.</div>
              <div>Money-touching and kill cards are yours alone; the brain may open the room, never stamp (Human Sovereignty, E2).</div>
            </div>
          </HPanel>

          <HPanel title="Where cards come from" hint="the room that raises it → the card it raises">
            <div className="-mx-2">
              {SOURCES.map(([room, card, mono]) => (
                <div key={room + card} className="flex items-baseline justify-between gap-3 px-2 py-[6px] transition-colors duration-200 hover:bg-(--bg-3)" style={{ borderBottom: '1px solid var(--line-1)', borderRadius: 'var(--r-sm)' }}>
                  <span className="text-[12.5px] shrink-0" style={{ fontFamily: UI, fontWeight: 500, color: 'var(--text-1)' }}>{room}</span>
                  <span className="text-[12px] text-right min-w-0 break-words" style={{ fontFamily: mono ? MONO : UI, color: 'var(--text-2)' }}>{card}</span>
                </div>
              ))}
            </div>
          </HPanel>
        </div>
      </div>

      <ReceiptDrawer ev={receipt} onClose={() => setReceipt(null)} />
    </>
  )
}
