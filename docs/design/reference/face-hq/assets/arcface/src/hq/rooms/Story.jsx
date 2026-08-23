// 09 · STORY — the informative layer, kept: the ten explainer
// chapters render inside HQ as the company's own museum room.
import C01_Idea from '../../chapters/C01_Idea.jsx'
import C02_OS from '../../chapters/C02_OS.jsx'
import C03_Factory from '../../chapters/C03_Factory.jsx'
import C04_Spine from '../../chapters/C04_Spine.jsx'
import C05_Council from '../../chapters/C05_Council.jsx'
import C06_HQ from '../../chapters/C06_HQ.jsx'
import C07_Ventures from '../../chapters/C07_Ventures.jsx'
import C08_Roadmap from '../../chapters/C08_Roadmap.jsx'
import C09_Law from '../../chapters/C09_Law.jsx'
import { RoomHead } from '../bits.jsx'
import { SimBadge } from '../../ui/kit.jsx'

export default function Story() {
  return (
    <>
      <RoomHead
        title="The story of arc."
        hint="the explainer layer — what arc is and why, chapter by chapter. The rest of HQ is what arc does."
        right={<SimBadge>reference · every claim receipted</SimBadge>}
      />
      <div className="rounded-xl border border-white/10 overflow-hidden" style={{ background: 'rgba(0,0,0,0.35)' }}>
        <C01_Idea />
        <C02_OS />
        <C03_Factory />
        <C04_Spine />
        <C05_Council />
        <C06_HQ />
        <C07_Ventures />
        <C08_Roadmap />
        <C09_Law />
      </div>
    </>
  )
}
