// View.tsx -- command/inbox: v0.7's Inbox, drawing what fold() returned and deciding nothing (face v2
// Phase 03, ADR-1320, REQ-08).
//
// Declared deltas from the reference: the arm-then-stamp gestures are buttons, not keys (the keyboard
// path is a debt row until Phase 05's verbs); "raised by the sim" badges are gone, because every card
// here is a real approval.requested; "Where cards come from" counts the gates the spine's own receipts
// named instead of a hand-typed list; "Stamped by you" is what this screen stamped this visit.
import { Stamp, Tray } from '@phosphor-icons/react'
import type { ModuleViewContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import { Btn, Chip, INPUT_CLASS, INPUT_STYLE, MONO, PickRow, UI, YoursBadge } from '../../../ui/kit'
import { DoorRefusal, Empty, HPanel, KpiStrip, Reading, ReceiptDrawer, RoomHead } from '../../../ui/bits'
export { Tray as Icon } from '@phosphor-icons/react'

const REASON_CLASS = `${INPUT_CLASS} h-auto! min-h-[84px] py-2 resize-y placeholder:text-(--text-3)`

export default function View({ f, ctx }: { f: Folded; ctx: ModuleViewContext }) {
  return (
    <>
      <RoomHead title={f.sentence} hint={f.lede} right={<YoursBadge>inbox · every stamp a decision.recorded receipt</YoursBadge>} />

      <KpiStrip items={f.kpis} />

      {f.hasStamped && (
        <p role="status" className="mb-4 px-4 py-2.5 text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-1)', background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }}>
          {f.stamped}
        </p>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel
            title="Waiting"
            hint="arm a verdict · type the reason · stamp"
            tone={f.waiting.tone}
            actions={<Chip tone={f.waiting.tone}>{f.waiting.chip}</Chip>}
          >
            {f.waiting.isReading && <Reading what="the inbox" />}
            {f.waiting.isRefused && <DoorRefusal code={f.waiting.refusal.code} human={f.waiting.refusal.human} />}
            {f.waiting.isZero && (
              <Empty icon={Tray} title="Inbox zero. The company runs itself." hint="Approvals arrive whenever a lane proposes something that needs your stamp." />
            )}
            {f.waiting.cards.map((c) => (
              <div
                key={c.id}
                data-approval={c.id}
                className="relative p-4 pl-5 mb-3 overflow-hidden transition-[border-color] duration-200"
                style={{ background: 'var(--well)', border: `1px solid ${c.edge}`, borderRadius: 'var(--r-md)' }}
              >
                <span aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: 'var(--amber)' }} />
                <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                  <b className="text-[13.5px] leading-[19px] min-w-0 break-words" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{c.title}</b>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px]" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{c.age}</span>
                    <Chip tone="amber">{c.gate}</Chip>
                  </span>
                </div>
                <dl className="mb-4 space-y-[5px]">
                  {c.facts.map((fact) => (
                    <div key={fact.k} className="grid grid-cols-[96px_1fr] gap-2 items-baseline">
                      <dt className="text-[10.5px] uppercase tracking-[0.06em] truncate" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-3)' }}>{fact.k}</dt>
                      {fact.isJson ? (
                        <dd className="min-w-0">
                          <pre className="text-[11.5px] leading-[17px] overflow-x-auto" style={{ fontFamily: MONO, color: 'var(--text-2)' }}>{fact.v}</pre>
                        </dd>
                      ) : (
                        <dd className="text-[12.5px] leading-[18px] min-w-0 break-words" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{fact.v}</dd>
                      )}
                    </div>
                  ))}
                </dl>
                {c.isArmed ? (
                  <div className="pt-3" style={{ borderTop: '1px solid var(--line-1)' }}>
                    <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
                      <span className="text-[12px] min-w-0" style={{ fontFamily: UI }}>
                        <span style={{ fontWeight: 600, color: c.armedInk }}>{c.armedLabel}</span>
                        <span className="ml-2" style={{ color: 'var(--text-3)' }}>the reason is the record</span>
                      </span>
                      <span className="text-[11px] tnum shrink-0" style={{ fontFamily: MONO, color: f.armed.bytesInk }}>{f.armed.bytes}</span>
                    </div>
                    <textarea
                      value={f.armed.reason}
                      onChange={(e) => ctx.onPick('reason', e.target.value)}
                      rows={3}
                      placeholder={f.armed.placeholder}
                      aria-label="the reason for this stamp"
                      className={REASON_CLASS}
                      style={INPUT_STYLE}
                    />
                    {f.armed.hasRefusal && (
                      <div className="mt-2">
                        <DoorRefusal code={f.armed.refusal.code} human={f.armed.refusal.human} />
                      </div>
                    )}
                    <div className="flex gap-2 flex-wrap mt-2 items-center">
                      <Btn
                        small
                        tone={c.stampTone}
                        disabled={!f.armed.canStamp}
                        onClick={() => ctx.onAct('/api/decide', { id: c.id, verdict: c.verdict, reason: f.armed.reason })}
                      >
                        {f.armed.stampLabel}
                      </Btn>
                      <Btn small onClick={() => ctx.onPick('armed', '')}>Disarm</Btn>
                      {f.armed.isEmpty && <span className="text-[12px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>No reason, no stamp</span>}
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    <Btn small tone="green" onClick={() => { ctx.onPick('reason', ''); ctx.onPick('armed', `${c.id}|approve`) }}>
                      Arm · approve
                    </Btn>
                    <Btn small tone="danger" onClick={() => { ctx.onPick('reason', ''); ctx.onPick('armed', `${c.id}|reject`) }}>
                      Arm · reject
                    </Btn>
                  </div>
                )}
              </div>
            ))}
          </HPanel>

          <HPanel title="Decision log" hint="decision.recorded, read back out of the spine · ⌗ opens the receipt">
            <div className="mb-3">
              <PickRow small options={f.log.options} value={f.log.view} onPick={(v) => ctx.onPick('log', v)} />
            </div>
            {f.log.isWaitingView && (
              <p className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
                The waiting queue is above. Switch to <b style={{ fontWeight: 600, color: 'var(--text-1)' }}>decided</b> to read every stamp on the spine, with its reason.
              </p>
            )}
            {f.log.isReading && <Reading what="the decision log" />}
            {f.log.isRefused && <DoorRefusal code={f.log.refusal.code} human={f.log.refusal.human} />}
            {f.log.isEmpty && (
              <Empty icon={Stamp} title="No decisions recorded yet" hint="Nothing is ever decided by default. Arm a card above, type the reason, and stamp it." />
            )}
            {f.log.hasRows && (
              <div className="-mx-2">
                {f.log.rows.map((d) => (
                  <div key={d.id} className="grid grid-cols-[52px_1fr_auto] gap-3 items-baseline px-2 py-2 transition-colors duration-200 hover:bg-(--bg-3)" style={{ borderBottom: '1px solid var(--line-1)', borderRadius: 'var(--r-sm)' }}>
                    <span className="text-[11.5px] tnum" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{d.time}</span>
                    <span className="min-w-0">
                      <span className="text-[12px] mr-2" style={{ fontFamily: UI, fontWeight: 600, color: d.ink }}>{d.label}</span>
                      <span className="text-[12px]" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{d.decides}</span>
                      <div className="text-[12px] leading-[18px] mt-0.5 break-words" style={{ fontFamily: UI, color: 'var(--text-2)' }}>reason: {d.reason}</div>
                    </span>
                    <button type="button" onClick={() => ctx.onPick('receipt', d.id)} className="text-[11px] cursor-pointer hover:text-(--accent)" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>
                      ⌗ {d.short}
                    </button>
                  </div>
                ))}
                <p className="mt-2 px-2 text-[11.5px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{f.log.foot}</p>
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
              <div>Every fact the approval carries is on the card, never behind a click.</div>
              <div>Arm, then stamp: arming picks a verdict, the stamp records it -- two gestures, never one.</div>
              <div>{f.lawReason}</div>
              <div>No bulk approve, no default action, no undo -- a wrong stamp is corrected by a new decision that supersedes it.</div>
              <div>Money-touching and kill cards are yours alone; the brain may open the room, never stamp.</div>
            </div>
          </HPanel>

          <HPanel title="Where cards come from" hint="the gate each raised approval named">
            {f.sources.isReading && <Reading what="the raised approvals" />}
            {f.sources.hasRows && (
              <div className="-mx-2">
                {f.sources.rows.map((s) => (
                  <div key={s.gate} className="flex items-baseline justify-between gap-3 px-2 py-[6px] transition-colors duration-200 hover:bg-(--bg-3)" style={{ borderBottom: '1px solid var(--line-1)', borderRadius: 'var(--r-sm)' }}>
                    <span className="text-[12.5px] min-w-0 break-words" style={{ fontFamily: MONO, color: 'var(--text-1)' }}>{s.gate}</span>
                    <span className="text-[12px] shrink-0" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{s.count}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-2 text-[11.5px] leading-[17px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{f.sources.foot}</p>
          </HPanel>
        </div>
      </div>

      <ReceiptDrawer receipt={f.receipt} onClose={() => ctx.onPick('receipt', '')} />
    </>
  )
}
