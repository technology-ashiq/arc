// 09 · STORY — the informative layer, kept: the ten explainer
// chapters render inside HQ as the company's own museum room.
// The chapters are the landing's own components (src/chapters); this room
// only sets the reading measure around them — 14px/22px prose capped at
// 72ch, room-scale headings, one hairline between chapters, no bezels.
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
import { SimBadge, UI, FONT } from '../../ui/kit.jsx'

const CHAPTERS = [C01_Idea, C02_OS, C03_Factory, C04_Spine, C05_Council, C06_HQ, C07_Ventures, C08_Roadmap, C09_Law]

// the reading measure for the chapters — scoped to this room only. Every
// rule reads a token; the chapters keep their own words and structure. Each
// chapter's own eyebrow (01 · the idea) becomes the SectionLabel of its cycle.
const READ = `
[data-story-room] [data-chapter] { font-family: ${UI} !important; }
[data-story-room] [data-chapter] > div { max-width: none; padding: 8px 0 40px; }
[data-story-room] [data-chapter] h2 { font-family: ${FONT}; font-size: 24px; line-height: 1.2; letter-spacing: -0.01em; margin-bottom: 12px; color: var(--text-1); }
[data-story-room] [data-chapter] h2 br { display: none; }
[data-story-room] [data-chapter] p, [data-story-room] [data-chapter] li, [data-story-room] [data-chapter] blockquote { max-width: 72ch; }
[data-story-room] [data-chapter] p { font-size: 14px; line-height: 22px; font-weight: 400; }
[data-story-room] [data-chapter] blockquote { font-size: 18px; line-height: 27px; }
[data-story-room] [data-chapter] .uppercase { font-family: ${UI} !important; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; }
[data-story-room] [data-chapter] .rounded-2xl { border-radius: var(--r-lg); box-shadow: none !important; }
`

export default function Story() {
  return (
    <>
      <RoomHead
        title="The story of arc."
        hint="the explainer layer — what arc is and why, chapter by chapter. The rest of HQ is what arc does."
        right={<SimBadge>reference · every claim receipted</SimBadge>}
      />
      <div data-story-room="" className="min-w-0">
        <style>{READ}</style>
        {CHAPTERS.map((Chapter, i) => (
          <div key={i} className={`min-w-0 ${i ? 'pt-6' : ''}`} style={i ? { borderTop: '1px solid var(--line-1)' } : undefined}>
            <Chapter />
          </div>
        ))}
      </div>
    </>
  )
}
