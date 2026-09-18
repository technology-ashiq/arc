// 00 · OVERVIEW — the daily screen: figures, brief, live tape,
// approval inbox (j/k select · a approve · r reject), quick panels.
import { useEffect, useRef, useState } from 'react'
import { Tray, Pulse } from '@phosphor-icons/react'
import { UI, MONO, COLOR, Btn, SimBadge, Chip } from '../../ui/kit.jsx'
import { RoomHead, HPanel, KpiStrip, EventRow, ApprovalCard, ReceiptDrawer, Empty, SectionLabel } from '../bits.jsx'
import { spine, recordDecision, setSpeed } from '../../spine/store.js'
import { kpis, briefLines, timeline, ladder, calibration, clockLabel, greenFired } from '../../spine/derive.js'
import { useSpine } from '../useSpine.js'
import { uiBus } from '../../lib/uiBus.js'

const TONE_OF = { amber: COLOR.amber, green: COLOR.green, cyan: COLOR.cyan }

export default function Overview() {
  useSpine()
  const k = kpis()
  const brief = briefLines()
  const evs = timeline(24)
  const [sel, setSel] = useState(0)
  const [receipt, setReceipt] = useState(null)
  const feedRef = useRef(null)
  const pending = spine.pendingApprovals

  // the promised expert path — j/k move, a approve, r reject
  useEffect(() => {
    const onKey = (e) => {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return
      if (receipt && e.key === 'Escape') return setReceipt(null)
      if (!pending.length) return
      if (e.key === 'j') setSel((s) => Math.min(s + 1, pending.length - 1))
      else if (e.key === 'k') setSel((s) => Math.max(s - 1, 0))
      else if (e.key === 'a') {
        const ap = pending[Math.min(sel, pending.length - 1)]
        if (ap) recordDecision(ap.id, true, 'cleared via keyboard — evidence on the card', ap.actions[0]?.label)
        setSel((s) => Math.max(0, Math.min(s, pending.length - 2)))
      } else if (e.key === 'r') {
        const ap = pending[Math.min(sel, pending.length - 1)]
        if (ap) document.querySelector(`[data-approval="${ap.id}"] button`)?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pending, sel, receipt])

  // keep the feed pinned to the latest event
  useEffect(() => {
    const el = feedRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [evs.length])

  const decided = spine.events.filter((e) => e.kind === 'decision.recorded' && e.day === spine.dayIndex && e.decided).slice(-4)
  const real = greenFired()

  return (
    <>
      <RoomHead
        title={brief.greeting}
        hint="The whole company on one screen. Every number derives from the event log."
        right={<SimBadge>{spine.source === 'real' ? 'real spine · read-only' : 'simulated day · real vocabulary'}</SimBadge>}
      />

      {/* the instrument strip — figures lead; a number never shows a spinner */}
      <KpiStrip
        items={[
          real
            ? { v: '₹' + k.realRev.toLocaleString('en-IN'), l: 'Real revenue today', tone: 'green' }
            : { v: '₹0', l: 'Real revenue', sub: 'never fired · honest' },
          { v: '₹' + k.simRev.toLocaleString('en-IN'), l: 'Simulated revenue', sub: 'labeled, not counted', tone: 'violet' },
          { v: '₹' + k.cost.toLocaleString('en-IN'), l: 'AI spend today', sub: k.ret.toFixed(1) + '× return' },
          { v: k.ideas, l: 'Ideas captured' },
          { v: k.phases + ' · ' + k.content, l: 'Phases closed · published' },
          { v: '~' + k.minutesNeeded + ' min', l: 'Your time needed', sub: k.pending ? k.pending + ' decisions waiting' : 'inbox zero', tone: k.pending ? 'amber' : undefined },
        ]}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          {/* the brief — ≤40 lines by law; here it is 5, each with its tone */}
          <HPanel title="Brief" hint={`noise budget: whole day ≤ 40 lines · now ${clockLabel()}`}>
            <div className="-mx-2">
              {brief.lines.map((l) => {
                const c = TONE_OF[l.tone] || 'var(--text-3)'
                return (
                  <div key={l.tag} className="grid grid-cols-[110px_1fr] gap-3 items-baseline px-2 py-[7px] rounded-md transition-colors duration-200 hover:bg-(--bg-3)">
                    <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.06em] truncate" style={{ fontFamily: UI, fontWeight: 600, color: c }}>
                      <span aria-hidden="true" className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: c }} />
                      {l.tag}
                    </span>
                    <span className="text-[13.5px] leading-[21px]" style={{ fontFamily: UI, color: 'var(--text-1)' }}>{l.text}</span>
                  </div>
                )
              })}
            </div>
          </HPanel>

          {/* live timeline */}
          <HPanel
            title="Today"
            hint="everything the company did · ⌗ opens the receipt"
            actions={<Btn small onClick={() => uiBus.openRoom('spine')}>Open the spine</Btn>}
          >
            <div ref={feedRef} className="max-h-[520px] overflow-y-auto -mx-2" style={{ scrollbarWidth: 'thin' }}>
              {evs.length === 0 && (
                <Empty
                  icon={Pulse}
                  title="The day hasn't started"
                  hint="Press play and the company wakes up. Every line that appears here is an event on the spine."
                  action={<Btn small tone="primary" onClick={() => setSpeed(10)}>Play the day at 10×</Btn>}
                />
              )}
              {evs.map((e) => (
                <EventRow key={e.id} e={e} onReceipt={setReceipt} />
              ))}
            </div>
          </HPanel>
        </div>

        {/* inbox + quick panels */}
        <div className="min-w-0">
          <HPanel
            title="Approval inbox"
            hint="j k move · a approve · r reject"
            tone={pending.length ? 'amber' : undefined}
            actions={<Chip tone={pending.length ? 'amber' : undefined}>{pending.length} waiting</Chip>}
          >
            {pending.length === 0 && (
              <Empty icon={Tray} title="Inbox zero. The company runs itself." hint="New approvals stream in as the day plays. A reason typed here becomes calibration data." />
            )}
            {pending.map((ap, i) => (
              <ApprovalCard key={ap.id} ap={ap} selected={i === Math.min(sel, pending.length - 1)} onAct={(id, ok, reason, label) => recordDecision(id, ok, reason, label)} />
            ))}
            {decided.length > 0 && (
              <div className="pt-3 mt-1" style={{ borderTop: '1px solid var(--line-1)' }}>
                <SectionLabel>Decided today</SectionLabel>
                {decided.map((d) => (
                  <div key={d.id} className="grid grid-cols-[auto_1fr_auto] items-baseline gap-2.5 text-[12px] py-[4px]">
                    <span className="shrink-0" style={{ fontFamily: UI, fontWeight: 600, color: d.decided.approved ? COLOR.green : COLOR.red }}>{d.decided.approved ? d.decided.actionLabel || 'approved' : 'rejected'}</span>
                    <span className="truncate" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{d.decided.title}</span>
                    <button type="button" onClick={() => setReceipt(d)} className="text-[11px] cursor-pointer hover:text-(--accent)" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>⌗ {String(d.id).slice(-6)}</button>
                  </div>
                ))}
              </div>
            )}
          </HPanel>

          <HPanel title="Policy" hint="the ladder at a glance" actions={<Btn small onClick={() => uiBus.openRoom('policy')}>Policy room</Btn>}>
            <div className="space-y-1">
              {ladder().slice(0, 4).map((l) => (
                <div key={l.cap} className="grid grid-cols-[34px_1fr_auto] items-center gap-2.5 text-[12.5px] py-[3px]">
                  <span className="inline-flex items-center justify-center h-[20px] rounded text-[11px] tnum" style={{ fontFamily: MONO, fontWeight: 600, background: 'rgba(var(--accent-rgb),0.1)', color: 'var(--accent)' }}>{l.level}</span>
                  <span className="truncate" style={{ fontFamily: MONO, color: 'var(--text-1)' }}>{l.cap}</span>
                  <span className="truncate text-[12px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{l.cap2}</span>
                </div>
              ))}
            </div>
          </HPanel>

          <HPanel title="Learned this week" hint="calibration, not vibes" actions={<Btn small onClick={() => uiBus.openRoom('learn')}>Learn room</Btn>}>
            <div className="space-y-2">
              {calibration().rules.slice(0, 2).map((r) => (
                <div key={r.id} className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
                  <span className="mr-1.5" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-1)' }}>{r.id}</span>
                  {r.text}
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
