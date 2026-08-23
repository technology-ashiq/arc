import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

const el = document.getElementById('root')
// Not a `!`. A missing mount point is a real failure with a real cause (a broken index.html,
// a bad build), and saying so beats a TypeError from inside React that names nothing.
if (!el) throw new Error('arc face: no #root element in the document -- index.html is not the one this build expects')

createRoot(el).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
