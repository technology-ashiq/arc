// 07 · VENTURES — the factory is not the product. LexOS flagship card
// with its real receipts, the consumer repos, and the portfolio math.
import { Chapter, Head, Panel, PanelTitle, Receipt, Reveal, Stat, StatusDot, COLOR, MONO } from '../ui/kit.jsx'

export default function C07_Ventures() {
  return (
    <Chapter id="c07">
      <Head
        n="07"
        name="ventures"
        title={<>The Factory Is{' '}<br />Not The Product.</>}
        lede="Ventures are what the factory exists for — revenue products in their own repos, with their own money, their own kill criteria written at kickoff, and arc synced inside. The venture track wins every tie; when the OS gets too interesting, the OS freezes."
        receipt="venture rule · master plan §10 — OS-hours > venture-hours two weeks running → OS freeze"
      />

      {/* LexOS flagship */}
      <Reveal>
        <Panel tone="cyan" className="mb-6 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] rounded-full border border-[#4ade80]/45 px-3 py-[6px]" style={{ fontFamily: MONO, color: COLOR.green }}>
                  <StatusDot state="live" /> venture #1 · LIVE
                </span>
                <span className="text-[10px] uppercase tracking-[0.18em] text-white/48" style={{ fontFamily: MONO }}>
                  lexos-bay.vercel.app
                </span>
              </div>
              <h3 className="text-[38px] sm:text-[48px] tracking-tight text-white mb-3" style={{ fontWeight: 600 }}>
                LexOS<span className="text-[#00ffd1]">.</span>
              </h3>
              <p className="text-[14px] leading-[24px] text-white/68 mb-5 max-w-xl" style={{ fontWeight: 300 }}>
                Legal practice management for India — solo advocates and 2–10-lawyer firms. Clients, cases, hearing
                reminders on WhatsApp, invoicing through Razorpay, a no-login client portal, AI drafting. It replaces the
                WhatsApp-plus-Excel chaos a small firm actually runs on.
              </p>
              <div className="flex flex-wrap items-baseline gap-x-8 gap-y-4 mb-6">
                <Stat value="₹2,999" label="growth · per month" tone="green" />
                <Stat value="₹5,999" label="pro · per month" tone="green" />
                <Stat value="11" label="phases · own tier-L plan" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Receipt>decision: ADR-0007 — LexOS is company venture #1</Receipt>
                <Receipt tone="amber">kill checkpoint in writing: day 26 after billing</Receipt>
              </div>
            </div>

            {/* phase-1 receipts */}
            <div className="rounded-xl border border-white/12 p-5" style={{ background: 'rgba(0,0,0,0.45)' }}>
              <div className="text-[9.5px] uppercase tracking-[0.22em] text-white/48 mb-4" style={{ fontFamily: MONO }}>
                phase 1 — closed on evidence
              </div>
              <div className="space-y-3" style={{ fontFamily: MONO }}>
                {[
                  ['row-level security', '10/10 tables', COLOR.green],
                  ['tests', '163 green', COLOR.green],
                  ['p95 response', '267 ms', COLOR.cyan],
                  ['auth', 'Google OAuth', COLOR.cyan],
                  ['revenue events', 'simulated · labeled', COLOR.amber],
                  ['first real ₹', 'target Sep 2026', COLOR.amber],
                ].map(([k, v, c]) => (
                  <div key={k} className="flex items-baseline justify-between gap-4 text-[11.5px]">
                    <span className="text-white/55">{k}</span>
                    <span style={{ color: c, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 pt-4 border-t border-white/10 text-[11px] leading-[18px] text-white/55" style={{ fontWeight: 300 }}>
                arc is installed inside — the 3rd consumer repo. Its build days run on the spine.
              </div>
            </div>
          </div>
        </Panel>
      </Reveal>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        {/* consumer repos */}
        {[
          ['venturemind', 'Earlier product repo, now an arc consumer — the upgrade-path dogfood target.'],
          ['Opportunity-Scout', 'Pain-mining scout, the fresh-install dogfood target — seed of the future discover module.'],
        ].map(([name, what], i) => (
          <Reveal key={name} delay={i * 70}>
            <Panel className="h-full">
              <div className="flex items-center gap-2.5 mb-3">
                <StatusDot state="ok" />
                <span className="text-[15px] text-white/92" style={{ fontFamily: MONO }}>
                  {name}
                </span>
              </div>
              <p className="text-[12.5px] leading-[20px] text-white/58 mb-4" style={{ fontWeight: 300 }}>
                {what}
              </p>
              <Receipt>arc installed via sync · registry-tracked</Receipt>
            </Panel>
          </Reveal>
        ))}

        {/* venture #2 slot */}
        <Reveal delay={140}>
          <Panel className="h-full border-dashed" tone="default">
            <div className="flex items-center gap-2.5 mb-3">
              <StatusDot state="sleeping" />
              <span className="text-[15px] text-white/62" style={{ fontFamily: MONO }}>
                venture #2
              </span>
            </div>
            <p className="text-[12.5px] leading-[20px] text-white/55 mb-4" style={{ fontWeight: 300 }}>
              The slot exists, the process for filling it exists — discover mines real complaints, scores the clusters,
              and the council votes. It stays empty until the trigger fires.
            </p>
            <Receipt tone="amber">wakes when: venture #1 earns, or dies honestly</Receipt>
          </Panel>
        </Reveal>
      </div>

      {/* portfolio math */}
      <Reveal>
        <Panel>
          <PanelTitle tone="amber">portfolio honesty — written before the first launch</PanelTitle>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-[26px] tracking-tight text-white mb-1" style={{ fontWeight: 600 }}>
                1 in 4
              </div>
              <p className="text-[12px] leading-[19px] text-white/58" style={{ fontWeight: 300 }}>
                ventures is expected to live. That is the base rate, planned for — not a surprise to be absorbed later.
              </p>
            </div>
            <div>
              <div className="text-[26px] tracking-tight text-white mb-1" style={{ fontWeight: 600 }}>
                ship <span className="text-[#00ffd1]">with</span> distribution
              </div>
              <p className="text-[12px] leading-[19px] text-white/58" style={{ fontWeight: 300 }}>
                A venture without a distribution plan does not ship. Launch week is a written playbook, one channel per day.
              </p>
            </div>
            <div>
              <div className="text-[26px] tracking-tight text-white mb-1" style={{ fontWeight: 600 }}>
                kill honestly
              </div>
              <p className="text-[12px] leading-[19px] text-white/58" style={{ fontWeight: 300 }}>
                Fail the written criteria → attic'd with a retro, components harvested, lesson pinned. Constitution A10.
              </p>
            </div>
          </div>
        </Panel>
      </Reveal>
    </Chapter>
  )
}
