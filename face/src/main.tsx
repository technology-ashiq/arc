import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { applyMood, readMood } from './lib/mood.mjs'

// The mood goes on <html> BEFORE the first render, not in an effect: an effect would paint one
// frame in the wrong mood, and a check that reads <html> just after a room renders would race it.
applyMood(document.documentElement.classList, readMood(safeStorage()))

const el = document.getElementById('root')
// Not a `!`. A missing mount point is a real failure with a real cause (a broken index.html,
// a bad build), and saying so beats a TypeError from inside React that names nothing.
if (!el) throw new Error('arc face: no #root element in the document -- index.html is not the one this build expects')

createRoot(el).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

/** `window.localStorage` itself can throw on access under a storage policy; that is dark, not a crash. */
function safeStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}
