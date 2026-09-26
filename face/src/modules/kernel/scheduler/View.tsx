// View.tsx -- kernel/scheduler: v0.7's Scheduler, drawing what fold() returned and deciding nothing (face
// v2 Phase 03, ADR-1320).
//
// Declared deltas from the reference: the jobs are the served registry's, each with its last run from the
// door's run.completed receipts; the next fire and the heartbeat are read from /api/jobs, which runs the
// brief's own jobs panel over hq.jobs.yaml (Phase 04), and the heartbeat panel keeps the last fire the spine recorded, never a beat
// the clock did not send; Register, Fire now, Pause and Resume are verb-pending cards (ADR-1326); the
// grammar panel states the two cadence forms in words.
import type { ModuleViewContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import { MONO, UI, YoursBadge } from '../../../ui/kit'
import { DoorRefusal, HPanel, HoldsPanel, KpiStrip, LanePanel, Reading, ReceiptDrawer, RoomHead, RunRows, ServedTable, SourcesPanel, TrailPanel, VerbPending } from '../../../ui/bits'
export { Clock as Icon } from '@phosphor-icons/react'

export default function View({ f, ctx }: { f: Folded; ctx: ModuleViewContext }) {
  return (
    <>
      <RoomHead title={f.sentence} hint={f.lede} right={<YoursBadge>{f.badge}</YoursBadge>} />

      <KpiStrip items={f.kpis} />

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title={f.jobsTitle} hint="last outcome · runs · a fire is idempotent per slot">
            <div className="space-y-2.5">
              {f.trail.isRefused && <DoorRefusal code={f.trail.refusal.code} human={f.trail.refusal.human} />}
              <RunRows rows={f.jobs} isEmpty={f.showJobsEmpty} empty="The served registry homes no job in this room, and no run receipt names one." />
              <ServedTable item={f.nextFire} />
              <VerbPending item={f.fireVerb} />
            </div>
          </HPanel>

          <HPanel title="Register a job" hint="a job must name a policy subject · no catch-up">
            <VerbPending item={f.register} />
          </HPanel>

          <TrailPanel trail={f.trail} onReceipt={(id) => ctx.onPick('receipt', id)} />
        </div>

        <div className="min-w-0">
          <HPanel title="Heartbeat" hint="the proof the clock is alive">
            <div className="space-y-2.5">
              {f.trail.isReading && <Reading what="the last fire" />}
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.08em] mb-0.5" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-3)' }}>last fire the spine recorded</div>
                <div className="text-[12.5px] leading-[19px] break-words" style={{ fontFamily: UI, color: 'var(--text-1)' }}>{f.lastFire.line}</div>
                {f.lastFire.hasFire && <div className="text-[11px] mt-0.5 break-words" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{f.lastFire.detail}</div>}
              </div>
              <ServedTable item={f.heartbeat} />
            </div>
          </HPanel>

          <HPanel title="The grammar">
            <p className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              Two cadence forms and no timezone knob: daily at a time, or weekdays at a time, in IST, because the spine stamps every receipt at +05:30. A job that fails writes its receipt and is turned off rather than run unpoliced.
            </p>
          </HPanel>

          <LanePanel lane={f.lane} title="Lane phases" />

          <SourcesPanel sources={f.sources} title="State on disk" hint="the file the cadences will be parsed from" />

          <HoldsPanel holds={f.holds} century={f.century} hasHolds={f.hasHolds} note={f.holdsNote} />
        </div>
      </div>

      <ReceiptDrawer receipt={f.receipt} onClose={() => ctx.onPick('receipt', '')} />
    </>
  )
}
