import S1FaceOfArc from './sections/S1_FaceOfArc.jsx'
import S2Products from './sections/S2_Products.jsx'
import S3Commands from './sections/S3_Commands.jsx'
import S4Agents from './sections/S4_Agents.jsx'
import S5Loop from './sections/S5_Loop.jsx'
import S6Footer from './sections/S6_Footer.jsx'

export default function App() {
  return (
    <main style={{ background: '#000' }}>
      <S1FaceOfArc />
      <S2Products />
      <S3Commands />
      <S4Agents />
      <S5Loop />
      <S6Footer />
    </main>
  )
}
